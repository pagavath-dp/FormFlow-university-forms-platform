import express from "express";
import pool from "../db.js";

function generateFormCode() {
    return "FF-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function autoCloseExpiredForms(institutionId = null) {
    try {
        if (institutionId) {
            await pool.query(
                `update forms set status = 'closed'
                 where status = 'open' and deadline < NOW()
                 and institution_id = $1`,
                [institutionId]
            );
        } else {
            await pool.query(
                `update forms set status = 'closed'
                 where status = 'open' and deadline < NOW()`
            );
        }
    } catch (err) {
        console.warn("Auto-close failed:", err.message);
    }
}

const router = express.Router();

// ── Admin Delete Any Form ─────────────────────────────────────────────────────
// DELETE /forms/admin/:id?institution_id=1
// Admin can delete any form in their institution
router.delete("/admin/:id", async (req, res) => {
    const formId        = Number(req.params.id);
    const institutionId = Number(req.query.institution_id);

    if (isNaN(formId) || isNaN(institutionId)) {
        return res.status(400).json({ message: "Invalid parameters" });
    }

    try {
        const result = await pool.query(
            `delete from forms
             where form_id = $1 and institution_id = $2
             returning title`,
            [formId, institutionId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Form not found" });
        }

        res.json({ ok: true, message: `Form "${result.rows[0].title}" deleted.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete form" });
    }
});

// ── Create Form ───────────────────────────────────────────────────────────────
router.post("/create", async (req, res) => {
    const {
        title, description, questions, creator_id,
        access_type, deadline, theme, allow_multiple,
        // new targeting fields
        target_dept_id, target_role, target_batch
    } = req.body;

    if (!creator_id) {
        return res.status(400).json({ message: "creator_id is missing" });
    }

    // Validate access_type + required targeting fields
    const validTypes = ['public', 'dept', 'batch', 'role', 'dept_batch', 'dept_role'];
    if (!validTypes.includes(access_type)) {
        return res.status(400).json({ message: "Invalid access_type" });
    }
    if (['dept', 'dept_batch', 'dept_role'].includes(access_type) && !target_dept_id) {
        return res.status(400).json({ message: "target_dept_id required for this access type" });
    }
    if (['batch', 'dept_batch'].includes(access_type) && !target_batch) {
        return res.status(400).json({ message: "target_batch required for this access type" });
    }
    if (['role', 'dept_role'].includes(access_type) && !target_role) {
        return res.status(400).json({ message: "target_role required for this access type" });
    }

    const form_code = generateFormCode();
    const client    = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get creator's institution_id
        const creatorRes = await client.query(
            `SELECT institution_id FROM users WHERE user_id = $1`,
            [Number(creator_id)]
        );
        if (creatorRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Creator not found" });
        }
        const institution_id = creatorRes.rows[0].institution_id;

        const formResult = await client.query(
            `insert into forms
             (form_code, title, description, creator_id, institution_id,
              access_type, target_dept_id, target_role, target_batch,
              deadline, status, theme_color, allow_multiple)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,'open',$11,$12)
             returning form_id`,
            [
                form_code, title, description,
                Number(creator_id), institution_id,
                access_type,
                target_dept_id  || null,
                target_role     || null,
                target_batch    || null,
                deadline,
                theme           || 'emerald',
                allow_multiple  || 'no'
            ]
        );

        const formId = formResult.rows[0].form_id;

        for (const q of questions) {
            const qResult = await client.query(
                `insert into questions (form_id, question_text, question_type, is_required)
                 values ($1, $2, $3, $4) returning question_id`,
                [formId, q.text, q.type, q.required ? 1 : 0]
            );
            const questionId = qResult.rows[0].question_id;
            if (q.type === "mcq") {
                for (const opt of q.options) {
                    await client.query(
                        `insert into options (question_id, option_text) values ($1, $2)`,
                        [questionId, opt]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Form created successfully", form_id: formId, form_code });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: "Failed to create form" });
    } finally {
        client.release();
    }
});

// ── Fill Form by Code ─────────────────────────────────────────────────────────
router.get('/code/:code', async (req, res) => {
    const { code }   = req.params;
    const userId     = Number(req.query.user_id);

    if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user_id" });
    }

    try {
        await autoCloseExpiredForms();

        const formResult = await pool.query(
            `select form_id, institution_id from forms where form_code = $1`,
            [code]
        );

        if (formResult.rows.length === 0) {
            return res.status(404).json({ message: "Form not found" });
        }

        const { form_id, institution_id } = formResult.rows[0];

        // Check user belongs to same institution
        const userRes = await pool.query(
            `select institution_id from users where user_id = $1`,
            [userId]
        );
        if (userRes.rows.length === 0 || userRes.rows[0].institution_id !== institution_id) {
            return res.status(403).json({ message: "You do not have access to this form" });
        }

        // Use fn_user_can_see_form for full access check
        const accessRes = await pool.query(
            `select fn_user_can_see_form($1, $2) as can_see`,
            [userId, form_id]
        );

        if (!accessRes.rows[0].can_see) {
            return res.status(403).json({ message: "You do not have access to this form" });
        }

        const form = await pool.query(
            `select form_id, title, description, access_type, deadline,
                    theme_color, allow_multiple
             from forms where form_id = $1`,
            [form_id]
        );

        const qResult = await pool.query(
            `select question_id, question_text, question_type, is_required
             from questions where form_id = $1 order by question_id`,
            [form_id]
        );

        const oResult = await pool.query(
            `select question_id, option_id, option_text
             from options
             where question_id in (select question_id from questions where form_id = $1)
             order by option_id`,
            [form_id]
        );

        res.json({
            form:      form.rows[0],
            questions: qResult.rows,
            options:   oResult.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to retrieve form" });
    }
});

// ── My Forms (created by user) ────────────────────────────────────────────────
router.get("/myforms", async (req, res) => {
    const userid = Number(req.query.user_id);
    if (isNaN(userid)) {
        return res.status(400).json({ message: "Invalid user_id" });
    }

    try {
        // Get user's institution
        const userRes = await pool.query(
            `select institution_id from users where user_id = $1`,
            [userid]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const institution_id = userRes.rows[0].institution_id;

        await autoCloseExpiredForms(institution_id);

        const result = await pool.query(
            `select f.form_id, f.title, f.description, f.form_code, f.status,
                    f.deadline, f.created_at, f.access_type, f.report_released,
                    f.target_dept_id, f.target_role, f.target_batch,
                    d.name AS target_dept_name
             from forms f
             left join departments d on f.target_dept_id = d.dept_id
             where f.creator_id = $1
             order by f.created_at desc`,
            [userid]
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch forms" });
    }
});

// ── Form Feed (forms visible to user based on role/dept/batch) ────────────────
// GET /forms/feed?user_id=1
router.get("/feed", async (req, res) => {
    const userId = Number(req.query.user_id);
    if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user_id" });
    }

    try {
        // Get user details
        const userRes = await pool.query(
            `select institution_id, dept_id, role, batch from users where user_id = $1`,
            [userId]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const user = userRes.rows[0];

        await autoCloseExpiredForms(user.institution_id);

        // Fetch all open forms in institution, filter using fn_user_can_see_form
        // Exclude forms created by the user (they see those in My Forms)
        const result = await pool.query(
            `select f.form_id, f.title, f.description, f.form_code,
                    f.status, f.deadline, f.created_at, f.access_type,
                    f.target_dept_id, f.target_role, f.target_batch,
                    d.name AS target_dept_name,
                    u.name AS creator_name, u.role AS creator_role
             from forms f
             left join departments d on f.target_dept_id = d.dept_id
             join users u on f.creator_id = u.user_id
             where f.institution_id = $1
               and f.status = 'open'
               and f.creator_id != $2
               and fn_user_can_see_form($2, f.form_id) = TRUE
             order by f.created_at DESC`,
            [user.institution_id, userId]
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch feed" });
    }
});

// ── Toggle Form Status ────────────────────────────────────────────────────────
router.post("/toggle-status", async (req, res) => {
    const { form_id } = req.body;
    try {
        const current = await pool.query(
            `select status from forms where form_id = $1`,
            [Number(form_id)]
        );
        if (current.rows.length === 0) {
            return res.status(404).json({ message: "Form not found" });
        }
        const newStatus = current.rows[0].status === 'open' ? 'closed' : 'open';
        await pool.query(
            `update forms set status = $1 where form_id = $2`,
            [newStatus, Number(form_id)]
        );
        return res.json({ message: `Form is now ${newStatus}`, status: newStatus });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to update status" });
    }
});

// ── Toggle Report Released ────────────────────────────────────────────────────
router.post("/toggle-report", async (req, res) => {
    const { form_id } = req.body;
    try {
        const current = await pool.query(
            `select report_released from forms where form_id = $1`,
            [Number(form_id)]
        );
        const newVal = current.rows[0].report_released === "yes" ? "no" : "yes";
        await pool.query(
            `update forms set report_released = $1 where form_id = $2`,
            [newVal, Number(form_id)]
        );
        res.json({ message: "Report visibility updated", status: newVal });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update report status" });
    }
});

// ── Get Templates ─────────────────────────────────────────────────────────────
router.get("/get-templates", async (req, res) => {
    try {
        const result = await pool.query(
            `select template_id, name, description, structure
             from form_templates order by template_id`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch templates" });
    }
});

// ── Audit Logs (HOD and above only, institution-scoped) ───────────────────────
router.get("/audit-logs", async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(401).json({ message: "unauthorized" });

    try {
        const userCheck = await pool.query(
            `select role, institution_id, dept_id from users where user_id = $1`,
            [user_id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(403).json({ message: "forbidden" });
        }

        const { role, institution_id, dept_id } = userCheck.rows[0];

        // Admin uses /admin/audit-logs — block here
        if (role === 'admin') {
            return res.status(403).json({ message: "forbidden" });
        }

        // Only HOD can see audit logs on dashboard
        if (role !== 'hod') {
            return res.status(403).json({ message: "forbidden" });
        }

        // HOD sees only their dept's events
        // dept-scoped: forms created in their dept + responses to those forms


        const result = await pool.query(
            `select l.log_time, l.action_type, u.name as user_name,
                    f.title as form_title, l.metadata
             from audit_logs l
             left join users u on l.user_id = u.user_id
             left join forms f on l.form_id = f.form_id
             where l.institution_id = $1
               and (
                   -- Form events in this dept
                   (l.form_id is not null and f.creator_id in (
                       select user_id from users
                       where dept_id = $2 and institution_id = $1
                   ))
                   or
                   -- Member events (user belongs to this dept)
                   (l.form_id is null and l.user_id in (
                       select user_id from users
                       where dept_id = $2 and institution_id = $1
                   ))
               )
             order by l.log_time desc limit 100`,
            [institution_id, dept_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch logs" });
    }
});

// ── Edit Form ─────────────────────────────────────────────────────────────────
router.get("/:id/edit", async (req, res) => {
    const { id }     = req.params;
    const { user_id } = req.query;

    try {
        const fRes = await pool.query(
            `select f.form_id, f.title, f.description, f.access_type,
                    f.target_dept_id, f.target_role, f.target_batch,
                    f.deadline, f.theme_color, f.allow_multiple, f.creator_id,
                    d.name as target_dept_name
             from forms f
             left join departments d on f.target_dept_id = d.dept_id
             where f.form_id = $1`,
            [Number(id)]
        );
        if (fRes.rows.length === 0) return res.status(404).json({ message: "Form not found" });
        const form = fRes.rows[0];
        if (form.creator_id !== Number(user_id)) return res.status(403).json({ message: "Unauthorized" });

        const qRes = await pool.query(
            `select question_id, question_text, question_type, is_required
             from questions where form_id = $1 order by question_id`,
            [Number(id)]
        );
        const oRes = await pool.query(
            `select question_id, option_id, option_text
             from options where question_id in
               (select question_id from questions where form_id = $1)
             order by option_id`,
            [Number(id)]
        );
        const rRes = await pool.query(
            `select count(*) as cnt from responses where form_id = $1`,
            [Number(id)]
        );

        res.json({
            form,
            questions:    qRes.rows,
            options:      oRes.rows,
            hasResponses: Number(rRes.rows[0].cnt) > 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load form for editing" });
    }
});

// ── Update Form ───────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const {
        title, description, deadline, access_type,
        target_dept_id, target_role, target_batch,
        theme, allow_multiple, questions, user_id
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ownerRes = await client.query(
            `select creator_id from forms where form_id = $1`,
            [Number(id)]
        );
        if (ownerRes.rows.length === 0) return res.status(404).json({ message: "Form not found" });
        if (ownerRes.rows[0].creator_id !== Number(user_id)) return res.status(403).json({ message: "Unauthorized" });

        const rRes = await client.query(
            `select count(*) as cnt from responses where form_id = $1`,
            [Number(id)]
        );
        const hasResponses = Number(rRes.rows[0].cnt) > 0;

        await client.query(
            `update forms set
               title          = $1,
               description    = $2,
               deadline       = $3::timestamptz,
               access_type    = $4,
               target_dept_id = $5,
               target_role    = $6,
               target_batch   = $7,
               theme_color    = $8,
               allow_multiple = $9
             where form_id = $10`,
            [
                title, description, deadline, access_type,
                target_dept_id || null,
                target_role    || null,
                target_batch   || null,
                theme          || "emerald",
                allow_multiple || "no",
                Number(id)
            ]
        );

        if (!hasResponses && Array.isArray(questions) && questions.length > 0) {
            await client.query(`delete from questions where form_id = $1`, [Number(id)]);
            for (const q of questions) {
                const qResult = await client.query(
                    `insert into questions (form_id, question_text, question_type, is_required)
                     values ($1, $2, $3, $4) returning question_id`,
                    [Number(id), q.text, q.type, q.required ? 1 : 0]
                );
                const questionId = qResult.rows[0].question_id;
                if (q.type === "mcq") {
                    for (const opt of q.options) {
                        await client.query(
                            `insert into options (question_id, option_text) values ($1, $2)`,
                            [questionId, opt]
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Form updated successfully", questionsLocked: hasResponses });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: "Failed to update form" });
    } finally {
        client.release();
    }
});

// ── Delete Form ───────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
    const { id }      = req.params;
    const { user_id } = req.query;
    try {
        const ownerRes = await pool.query(
            `select creator_id from forms where form_id = $1`,
            [Number(id)]
        );
        if (ownerRes.rows.length === 0) return res.status(404).json({ message: "Form not found" });
        if (ownerRes.rows[0].creator_id !== Number(user_id)) return res.status(403).json({ message: "Unauthorized" });
        await pool.query(`delete from forms where form_id = $1`, [Number(id)]);
        res.json({ message: "Form deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete form" });
    }
});

// ── HOD Dept Forms Feed ───────────────────────────────────────────────────────
// GET /forms/dept-forms?user_id=1
// Returns all forms created by anyone in the HOD's department
router.get("/dept-forms", async (req, res) => {
    const userId = Number(req.query.user_id);
    if (isNaN(userId)) return res.status(400).json({ message: "Invalid user_id" });

    try {
        const userRes = await pool.query(
            `select role, institution_id, dept_id from users where user_id = $1`,
            [userId]
        );
        if (userRes.rows.length === 0) return res.status(404).json({ message: "User not found" });

        const { role, institution_id, dept_id } = userRes.rows[0];

        if (role !== 'hod') {
            return res.status(403).json({ message: "HOD only" });
        }

        await autoCloseExpiredForms(institution_id);

        const result = await pool.query(
            `select f.form_id, f.title, f.description, f.form_code,
                    f.status, f.deadline, f.created_at, f.access_type,
                    f.target_dept_id, f.target_role, f.target_batch,
                    d.name as target_dept_name,
                    u.name as creator_name, u.role as creator_role,
                    count(r.response_id) as response_count
             from forms f
             join users u on f.creator_id = u.user_id
             left join departments d on f.target_dept_id = d.dept_id
             left join responses r on f.form_id = r.form_id
             where f.institution_id = $1
               and u.dept_id = $2
             group by f.form_id, u.name, u.role, d.name
             order by f.created_at desc`,
            [institution_id, dept_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch dept forms" });
    }
});

export default router;
