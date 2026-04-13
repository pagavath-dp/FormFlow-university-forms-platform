import express from "express";
import pool from "../db.js";

function generateFormCode() {
    return "FF-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function autoCloseExpiredForms(institutionId = null) {
    try {
        if (institutionId) {
            await pool.query(
                `UPDATE forms SET status = 'closed'
                 WHERE status = 'open' AND deadline < NOW()
                 AND institution_id = $1`,
                [institutionId]
            );
        } else {
            await pool.query(
                `UPDATE forms SET status = 'closed'
                 WHERE status = 'open' AND deadline < NOW()`
            );
        }
    } catch (err) {
        console.warn("Auto-close failed:", err.message);
    }
}

const router = express.Router();

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
            `INSERT INTO forms
             (form_code, title, description, creator_id, institution_id,
              access_type, target_dept_id, target_role, target_batch,
              deadline, status, theme_color, allow_multiple)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,'open',$11,$12)
             RETURNING form_id`,
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
                `INSERT INTO questions (form_id, question_text, question_type, is_required)
                 VALUES ($1, $2, $3, $4) RETURNING question_id`,
                [formId, q.text, q.type, q.required ? 1 : 0]
            );
            const questionId = qResult.rows[0].question_id;
            if (q.type === "mcq") {
                for (const opt of q.options) {
                    await client.query(
                        `INSERT INTO options (question_id, option_text) VALUES ($1, $2)`,
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
            `SELECT form_id, institution_id FROM forms WHERE form_code = $1`,
            [code]
        );

        if (formResult.rows.length === 0) {
            return res.status(404).json({ message: "Form not found" });
        }

        const { form_id, institution_id } = formResult.rows[0];

        // Check user belongs to same institution
        const userRes = await pool.query(
            `SELECT institution_id FROM users WHERE user_id = $1`,
            [userId]
        );
        if (userRes.rows.length === 0 || userRes.rows[0].institution_id !== institution_id) {
            return res.status(403).json({ message: "You do not have access to this form" });
        }

        // Use fn_user_can_see_form for full access check
        const accessRes = await pool.query(
            `SELECT fn_user_can_see_form($1, $2) AS can_see`,
            [userId, form_id]
        );

        if (!accessRes.rows[0].can_see) {
            return res.status(403).json({ message: "You do not have access to this form" });
        }

        const form = await pool.query(
            `SELECT form_id, title, description, access_type, deadline,
                    theme_color, allow_multiple
             FROM forms WHERE form_id = $1`,
            [form_id]
        );

        const qResult = await pool.query(
            `SELECT question_id, question_text, question_type, is_required
             FROM questions WHERE form_id = $1 ORDER BY question_id`,
            [form_id]
        );

        const oResult = await pool.query(
            `SELECT question_id, option_id, option_text
             FROM options
             WHERE question_id IN (SELECT question_id FROM questions WHERE form_id = $1)
             ORDER BY option_id`,
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
            `SELECT institution_id FROM users WHERE user_id = $1`,
            [userid]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const institution_id = userRes.rows[0].institution_id;

        await autoCloseExpiredForms(institution_id);

        const result = await pool.query(
            `SELECT f.form_id, f.title, f.description, f.form_code, f.status,
                    f.deadline, f.created_at, f.access_type, f.report_released,
                    f.target_dept_id, f.target_role, f.target_batch,
                    d.name AS target_dept_name
             FROM forms f
             LEFT JOIN departments d ON f.target_dept_id = d.dept_id
             WHERE f.creator_id = $1
             ORDER BY f.created_at DESC`,
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
            `SELECT institution_id, dept_id, role, batch FROM users WHERE user_id = $1`,
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
            `SELECT f.form_id, f.title, f.description, f.form_code,
                    f.status, f.deadline, f.created_at, f.access_type,
                    f.target_dept_id, f.target_role, f.target_batch,
                    d.name AS target_dept_name,
                    u.name AS creator_name, u.role AS creator_role
             FROM forms f
             LEFT JOIN departments d ON f.target_dept_id = d.dept_id
             JOIN users u ON f.creator_id = u.user_id
             WHERE f.institution_id = $1
               AND f.status = 'open'
               AND f.creator_id != $2
               AND fn_user_can_see_form($2, f.form_id) = TRUE
             ORDER BY f.created_at DESC`,
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
            `SELECT status FROM forms WHERE form_id = $1`,
            [Number(form_id)]
        );
        if (current.rows.length === 0) {
            return res.status(404).json({ message: "Form not found" });
        }
        const newStatus = current.rows[0].status === 'open' ? 'closed' : 'open';
        await pool.query(
            `UPDATE forms SET status = $1 WHERE form_id = $2`,
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
            `SELECT report_released FROM forms WHERE form_id = $1`,
            [Number(form_id)]
        );
        const newVal = current.rows[0].report_released === "yes" ? "no" : "yes";
        await pool.query(
            `UPDATE forms SET report_released = $1 WHERE form_id = $2`,
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
            `SELECT template_id, name, description, structure
             FROM form_templates ORDER BY template_id`
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
            `SELECT role, institution_id, dept_id FROM users WHERE user_id = $1`,
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
            `SELECT l.log_time, l.action_type, u.name AS user_name,
                    f.title AS form_title, l.metadata
             FROM audit_logs l
             LEFT JOIN users u ON l.user_id = u.user_id
             LEFT JOIN forms f ON l.form_id = f.form_id
             WHERE l.institution_id = $1
               AND (
                   -- Form events in this dept
                   (l.form_id IS NOT NULL AND f.creator_id IN (
                       SELECT user_id FROM users
                       WHERE dept_id = $2 AND institution_id = $1
                   ))
                   OR
                   -- Member events (user belongs to this dept)
                   (l.form_id IS NULL AND l.user_id IN (
                       SELECT user_id FROM users
                       WHERE dept_id = $2 AND institution_id = $1
                   ))
               )
             ORDER BY l.log_time DESC LIMIT 100`,
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
            `SELECT f.form_id, f.title, f.description, f.access_type,
                    f.target_dept_id, f.target_role, f.target_batch,
                    f.deadline, f.theme_color, f.allow_multiple, f.creator_id,
                    d.name AS target_dept_name
             FROM forms f
             LEFT JOIN departments d ON f.target_dept_id = d.dept_id
             WHERE f.form_id = $1`,
            [Number(id)]
        );
        if (fRes.rows.length === 0) return res.status(404).json({ message: "Form not found" });
        const form = fRes.rows[0];
        if (form.creator_id !== Number(user_id)) return res.status(403).json({ message: "Unauthorized" });

        const qRes = await pool.query(
            `SELECT question_id, question_text, question_type, is_required
             FROM questions WHERE form_id = $1 ORDER BY question_id`,
            [Number(id)]
        );
        const oRes = await pool.query(
            `SELECT question_id, option_id, option_text
             FROM options WHERE question_id IN
               (SELECT question_id FROM questions WHERE form_id = $1)
             ORDER BY option_id`,
            [Number(id)]
        );
        const rRes = await pool.query(
            `SELECT COUNT(*) AS cnt FROM responses WHERE form_id = $1`,
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
            `SELECT creator_id FROM forms WHERE form_id = $1`,
            [Number(id)]
        );
        if (ownerRes.rows.length === 0) return res.status(404).json({ message: "Form not found" });
        if (ownerRes.rows[0].creator_id !== Number(user_id)) return res.status(403).json({ message: "Unauthorized" });

        const rRes = await client.query(
            `SELECT COUNT(*) AS cnt FROM responses WHERE form_id = $1`,
            [Number(id)]
        );
        const hasResponses = Number(rRes.rows[0].cnt) > 0;

        await client.query(
            `UPDATE forms SET
               title          = $1,
               description    = $2,
               deadline       = $3::timestamptz,
               access_type    = $4,
               target_dept_id = $5,
               target_role    = $6,
               target_batch   = $7,
               theme_color    = $8,
               allow_multiple = $9
             WHERE form_id = $10`,
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
            await client.query(`DELETE FROM questions WHERE form_id = $1`, [Number(id)]);
            for (const q of questions) {
                const qResult = await client.query(
                    `INSERT INTO questions (form_id, question_text, question_type, is_required)
                     VALUES ($1, $2, $3, $4) RETURNING question_id`,
                    [Number(id), q.text, q.type, q.required ? 1 : 0]
                );
                const questionId = qResult.rows[0].question_id;
                if (q.type === "mcq") {
                    for (const opt of q.options) {
                        await client.query(
                            `INSERT INTO options (question_id, option_text) VALUES ($1, $2)`,
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
            `SELECT creator_id FROM forms WHERE form_id = $1`,
            [Number(id)]
        );
        if (ownerRes.rows.length === 0) return res.status(404).json({ message: "Form not found" });
        if (ownerRes.rows[0].creator_id !== Number(user_id)) return res.status(403).json({ message: "Unauthorized" });
        await pool.query(`DELETE FROM forms WHERE form_id = $1`, [Number(id)]);
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
            `SELECT role, institution_id, dept_id FROM users WHERE user_id = $1`,
            [userId]
        );
        if (userRes.rows.length === 0) return res.status(404).json({ message: "User not found" });

        const { role, institution_id, dept_id } = userRes.rows[0];

        if (role !== 'hod') {
            return res.status(403).json({ message: "HOD only" });
        }

        await autoCloseExpiredForms(institution_id);

        const result = await pool.query(
            `SELECT f.form_id, f.title, f.description, f.form_code,
                    f.status, f.deadline, f.created_at, f.access_type,
                    f.target_dept_id, f.target_role, f.target_batch,
                    d.name AS target_dept_name,
                    u.name AS creator_name, u.role AS creator_role,
                    COUNT(r.response_id) AS response_count
             FROM forms f
             JOIN users u ON f.creator_id = u.user_id
             LEFT JOIN departments d ON f.target_dept_id = d.dept_id
             LEFT JOIN responses r ON f.form_id = r.form_id
             WHERE f.institution_id = $1
               AND u.dept_id = $2
             GROUP BY f.form_id, u.name, u.role, d.name
             ORDER BY f.created_at DESC`,
            [institution_id, dept_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch dept forms" });
    }
});

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
            `DELETE FROM forms
             WHERE form_id = $1 AND institution_id = $2
             RETURNING title`,
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

export default router;
