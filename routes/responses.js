import express from "express";
import pool from "../db.js";

async function autoCloseExpiredForms() {
    try {
        await pool.query(`update forms set status = 'closed' where status = 'open' and deadline < now()`);
    } catch (err) {
        console.warn("Auto-close failed, but ignoring:", err.message);
    }
}

const router = express.Router();

router.post("/submit", async (req, res) => {
    const { form_id, user_id, answers } = req.body;

    const client = await pool.connect();

    try {
        await autoCloseExpiredForms();

        const formCheck = await client.query(
            `select deadline, creator_id, status, allow_multiple from forms where form_id = $1`,
            [form_id]
        );

        if (formCheck.rows.length === 0) {
            return res.json({
                success: false,
                message: "Form not found"
            });
        }

        const raw = formCheck.rows[0];

        const form = {
            form_id: raw.form_id,
            creator_id: raw.creator_id,
            status: raw.status,
            deadline: raw.deadline,
            allow_multiple: raw.allow_multiple?.trim().toLowerCase()
        };

        const now = new Date();
        const deadline = new Date(form.deadline);
        const uid = Number(user_id);

        if (form.creator_id === uid) {
            return res.json({
                success: false,
                message: "You cannot submit response to your own form"
            });
        }

        if (isNaN(deadline)) {
            return res.json({
                success: false,
                message: "Invalid deadline configuration"
            });
        }

        if (form.status === "closed") {
            return res.json({
                success: false,
                message: "Form is closed"
            });
        }

        if (now > deadline) {
            return res.json({
                success: false,
                message: "This form is closed (deadline passed)"
            });
        }

        // Only block duplicate submissions if allow_multiple is NOT 'yes'
        if (form.allow_multiple !== 'yes') {
            const existing = await client.query(
                `select * from responses where form_id = $1 and user_id = $2`,
                [form_id, uid]
            );

            if (existing.rows.length > 0) {
                return res.json({
                    success: false,
                    error_code: "ALREADY_SUBMITTED",
                    message: "You have already submitted a response for this form"
                });
            }
        }

        await client.query('BEGIN');

        const result = await client.query(
            `insert into responses (form_id, user_id) values ($1, $2) returning response_id`,
            [form_id, uid]
        );

        const responseId = result.rows[0].response_id;

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

            await client.query(
                `insert into answers (response_id, question_id, answer_text, answer_number, selected_option_id) values ($1, $2, $3, $4, $5)`,
                [responseId, Number(a.question_id), answer_text, answer_number, selected_option_id]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: "Response saved successfully"
        });

    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Failed to save response"
        });
    } finally {
        client.release();
    }
});

router.get("/form/:form_id", async (req, res) => {
    const { form_id } = req.params;

    try {
        await autoCloseExpiredForms();

        const responses = await pool.query(
            `select r.response_id, r.user_id, u.name, r.submitted_at
             from responses r
             join users u on r.user_id = u.user_id
             where r.form_id = $1
             order by r.response_id`,
            [Number(form_id)]
        );

        const answers = await pool.query(
            `select a.response_id, a.question_id,
                    a.answer_text, a.answer_number, a.selected_option_id,
                    o.option_text
             from answers a
             left join options o on a.selected_option_id = o.option_id
             where a.response_id in (
                 select response_id from responses where form_id = $1
             )`,
            [Number(form_id)]
        );

        const questions = await pool.query(
            `select question_id, question_text from questions where form_id = $1`,
            [Number(form_id)]
        );

        res.json({
            responses: responses.rows,
            answers: answers.rows,
            questions: questions.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch responses" });
    }
});

router.get("/report/:formId", async (req, res) => {
    const { formId } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ message: "user_id is required" });
    }

    try {
        const authCheck = await pool.query(
            `select creator_id, report_released from forms where form_id = $1`,
            [Number(formId)]
        );

        if (authCheck.rows.length === 0) {
            return res.status(404).json({ message: "Form not found" });
        }

        const { creator_id, report_released } = authCheck.rows[0];

        if (creator_id !== Number(user_id) && report_released !== "yes") {
            return res.status(403).json({ message: "This report has not been released by the creator." });
        }

        const qResult = await pool.query(
            `select question_id, question_text, question_type from questions where form_id = $1`,
            [Number(formId)]
        );

        const aResult = await pool.query(
            `select a.*, d.name as department
             from answers a
             join responses r on a.response_id = r.response_id
             join users u on r.user_id = u.user_id
             left join departments d on u.dept_id = d.dept_id
             where r.form_id = $1`,
            [Number(formId)]
        );

        const oResult = await pool.query(
            `select option_id, question_id, option_text 
             from options 
             where question_id in (
                select question_id from questions where form_id = $1
             )`,
            [Number(formId)]
        );

        const formMeta = await pool.query(
            `select access_type from forms where form_id = $1`,
            [Number(formId)]
        );

        res.json({
            questions: qResult.rows,
            answers: aResult.rows,
            options: oResult.rows,
            access_type: formMeta.rows[0].access_type
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to generate report" });
    }
});

router.get("/my/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const result = await pool.query(
            `select 
                r.response_id, 
                f.form_id, 
                f.title, 
                f.description,
                f.report_released,
                r.submitted_at
            from responses r
            join forms f on r.form_id = f.form_id
            where r.user_id = $1
            order by r.submitted_at desc`,
            [Number(userId)]
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch responses" });
    }
});

router.get("/single/:responseId", async (req, res) => {
    const { responseId } = req.params;

    try {
        const answers = await pool.query(
            `select a.*, q.question_text, o.option_text
             from answers a
             join questions q on a.question_id = q.question_id
             left join options o on a.selected_option_id = o.option_id
             where a.response_id = $1`,
            [Number(responseId)]
        );

        res.json(answers.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch response" });
    }
});

export default router;
