import express from "express";
import { getConnection } from "../db.js";
import oracledb from "oracledb";

async function autoCloseExpiredForms(conn) {
    try {
        await conn.execute(`BEGIN prc_close_expired_forms; END;`);
    } catch (err) {
        // Log the error but DO NOT crash the app!
        console.warn("Auto-close procedure failed, but ignoring:", err.message);
    }
}

const router = express.Router();

router.post("/submit", async (req, res) => {
    const { form_id, user_id, answers } = req.body;

    let conn;

    try {
        conn = await getConnection();

        await autoCloseExpiredForms(conn);

        const formCheck = await conn.execute(
            `select deadline, creator_id, status, allow_multiple from forms where form_id = :formId`,
            { formId: form_id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (formCheck.rows.length === 0) {
            res.json({ 
                success: false,
                message: "Form not found" 
            });
            return;
        }

        const raw = formCheck.rows[0];

        const form = {
            form_id: raw.FORM_ID,
            creator_id: raw.CREATOR_ID,
            status: raw.STATUS,
            deadline: raw.DEADLINE,
            allow_multiple: raw.ALLOW_MULTIPLE?.trim().toLowerCase()
        };

        const now = new Date();
        const deadline = new Date(form.deadline);

        const uid = Number(user_id);

        if (form.creator_id === uid) {
            res.json({ 
                success: false,
                message: "You cannot submit response to your own form" 
            });
            return;
        }

        if (isNaN(deadline)) {
            return res.json({
                success: false,
                message: "Invalid deadline configuration"
            });
        }

        if (form.status === "closed") {
            res.json({ 
                success: false,
                message: "Form is closed" 
            });
            return;
        }

        if (now > deadline) {
            res.json({ 
                success: false,
                message: "This form is closed (deadline passed)" 
            });
            return;
        }

        // Only block duplicate submissions if allow_multiple is NOT 'yes'
        if (form.allow_multiple !== 'yes') {
            const existing = await conn.execute(
                `select * from responses where form_id = :formId and user_id = :userId`,
                { formId: form_id, userId: uid },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            if (existing.rows.length > 0) {
                res.json({ 
                    success: false,
                    error_code: "ALREADY_SUBMITTED",
                    message: "You have already submitted a response for this form" 
                });
                return;
            }
        }

        const result = await conn.execute(
            `insert into responses (form_id, user_id) values (:formId, :userId) returning response_id into :rid`,
            {
                formId: form_id,
                userId: uid,
                rid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            }
        );

        const responseId = result.outBinds.rid[0];

        for (const a of answers) {

            let answer_text = null;
            let answer_number = null;
            let selected_option_id = null;

            // MCQ
            if (a.option_id !== null && a.option_id !== undefined) {
                selected_option_id = Number(a.option_id);
            }

            // Number input
            else if (a.answer_text !== null && a.answer_text.trim() !== "" && !isNaN(a.answer_text)) {
                answer_number = Number(a.answer_text);
            }

            // Text input
            else if (a.answer_text !== null && a.answer_text.trim() !== "") {
                answer_text = a.answer_text;
            }

            await conn.execute(
                `insert into answers (response_id, question_id, answer_text, answer_number, selected_option_id) values (:rid, :qid, :text, :num, :opt)`,
                {
                    rid: responseId,
                    qid: Number(a.question_id),
                    text: answer_text,
                    num: answer_number,
                    opt: selected_option_id
                }
            );
        }

        await conn.commit();

        res.json({ 
            success: true,
            message: "Response saved successfully" 
        });

    } catch (err) {
        if (conn) await conn.rollback();
        console.error(err);
        res.status(500).json({ 
            success: false,
            message: "Failed to save response" 
        });

    } finally {
        if (conn) await conn.close();
    }
});

router.get("/form/:form_id", async (req, res) => {
    const { form_id } = req.params;

    let conn;

    try {
        conn = await getConnection();

        await autoCloseExpiredForms(conn);

        // Get all responses
        const responses = await conn.execute(
            `select r.response_id, r.user_id, u.name, r.submitted_at
             from responses r
             join users u on r.user_id = u.user_id
             where r.form_id = :fid
             order by r.response_id`,
            { fid: Number(form_id) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Get all answers
        const answers = await conn.execute(
            `select a.response_id, a.question_id,
                    a.answer_text, a.answer_number, a.selected_option_id,
                    o.option_text
             from answers a
             left join options o on a.selected_option_id = o.option_id
             where a.response_id in (
                 select response_id FROM responses WHERE form_id = :fid
             )`,
            { fid: Number(form_id) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const questions = await conn.execute(
            `select question_id, question_text from questions where form_id = :fid`,
            { fid: Number(form_id) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json({
            responses: responses.rows,
            answers: answers.rows,
            questions: questions.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch responses" });

    } finally {
        if (conn) await conn.close();
    }
});

router.get("/report/:formId", async (req, res) => {
    const { formId } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ message: "user_id is required" });
    }

    let conn;

    try {
        conn = await getConnection();

        // Check authentication
        const authCheck = await conn.execute(
            `select creator_id, report_released from forms where form_id = :fid`,
            { fid: Number(formId) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (authCheck.rows.length === 0) {
            return res.status(404).json({ message: "Form not found" });
        }

        const { CREATOR_ID, REPORT_RELEASED } = authCheck.rows[0];

        if (CREATOR_ID !== Number(user_id) && REPORT_RELEASED !== "yes") {
            return res.status(403).json({ message: "This report has not been released by the creator." });
        }

        // Questions
        const qResult = await conn.execute(
            `select question_id, question_text, question_type 
             from questions where form_id = :fid`,
            { fid: Number(formId) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Answers + Department
        const aResult = await conn.execute(
            `select a.*, u.department
             from answers a
             join responses r on a.response_id = r.response_id
             join users u on r.user_id = u.user_id
             where r.form_id = :fid`,
            { fid: Number(formId) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Options
        const oResult = await conn.execute(
            `select option_id, question_id, option_text 
             from options 
             where question_id in (
                select question_id from questions where form_id = :fid
             )`,
            { fid: Number(formId) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Form access type
        const formMeta = await conn.execute(
            `select access_type from forms where form_id = :fid`,
            { fid: Number(formId) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json({
            questions: qResult.rows,
            answers: aResult.rows,
            options: oResult.rows,
            access_type: formMeta.rows[0].ACCESS_TYPE
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to generate report" });
    } finally {
        if (conn) await conn.close();
    }
});

router.get("/my/:userId", async (req, res) => {
    const { userId } = req.params;

    let conn;

    try {
        conn = await getConnection();

        const result = await conn.execute(
            `select 
                r.response_id, 
                f.form_id, 
                f.title, 
                f.report_released,
                r.submitted_at
            from responses r
            join forms f on r.form_id = f.form_id
            where r.user_id = :userid
            order by r.submitted_at desc`,
            { userid: Number(userId) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch responses" });

    } finally {
        if (conn) await conn.close();
    }
});

router.get("/single/:responseId", async (req, res) => {
    const { responseId } = req.params;

    let conn;

    try {
        conn = await getConnection();

        const answers = await conn.execute(
            `select a.*, q.question_text, o.option_text
             from answers a
             join questions q on a.question_id = q.question_id
             left join options o on a.selected_option_id = o.option_id
             where a.response_id = :rid`,
            { rid: Number(responseId) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(answers.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch response" });

    } finally {
        if (conn) await conn.close();
    }
});

export default router;