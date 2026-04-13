import express from "express";
import pool from "../db.js";
import multer from "multer";
import { parse } from "csv-parse/sync";

const router = express.Router();

// Multer — store CSV in memory (no disk writes)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

// ── Middleware: verify admin token ────────────────────────────────────────────
// Simple check — institutionId must be in query or body and match token
// Full JWT middleware comes in Step 6
function requireAdmin(req, res, next) {
    const institutionId = parseInt(req.query.institution_id || req.body?.institution_id);
    if (!institutionId || isNaN(institutionId)) {
        return res.status(400).json({ message: "institution_id is required." });
    }
    req.institutionId = institutionId;
    next();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
// GET /admin/stats?institution_id=1
router.get("/stats", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `select
                (select COUNT(*) from users    where institution_id = $1) as member_count,
                (select COUNT(*) from forms    where institution_id = $1) as form_count,
                (select COUNT(*) from responses r
                 join forms f on r.form_id = f.form_id
                 where f.institution_id = $1)                             as response_count,
                (select COUNT(*) from users
                 where institution_id = $1 and status = 'pending')        as pending_count`,
            [req.institutionId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Admin Stats Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── List Members ──────────────────────────────────────────────────────────────
// GET /admin/members?institution_id=1
router.get("/members", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `select u.user_id, u.name, u.email, u.role, u.status, u.batch,
                    u.joined_at, d.name AS dept_name, d.dept_id
             from users u
             left join departments d on u.dept_id = d.dept_id
             where u.institution_id = $1
               and u.role != 'admin'
             order by u.role, u.name`,
            [req.institutionId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("List Members Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── Add Single Member ─────────────────────────────────────────────────────────
// POST /admin/members/add
// Body: { institution_id, email, role, dept_id, batch }
router.post("/members/add", async (req, res) => {
    const { institution_id, email, role, dept_id, batch } = req.body;

    if (!institution_id || !email?.trim() || !role) {
        return res.status(400).json({ message: "institution_id, email and role are required." });
    }

    const validRoles = ['hod', 'faculty', 'student'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be hod, faculty or student." });
    }

    try {
        // Check if email already exists in the system
        const existing = await pool.query(
            `select user_id from users where email = $1`,
            [email.trim().toLowerCase()]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ message: "email_exists" });
        }

        await pool.query(
            `insert into users (institution_id, email, role, dept_id, batch, status)
             values ($1, $2, $3, $4, $5, 'pending')`,
            [
                institution_id,
                email.trim().toLowerCase(),
                role,
                dept_id || null,
                batch || null
            ]
        );

        // Log it — include admin_id if provided
        await pool.query(
            `insert into audit_logs (institution_id, action_type, user_id, metadata)
             values ($1, 'MEMBER ADDED', $2, $3)`,
            [institution_id, req.body.admin_id || null, email.trim().toLowerCase()]
        );

        res.status(201).json({ ok: true, message: "Member added successfully." });
    } catch (err) {
        console.error("Add Member Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── Import Members via CSV ────────────────────────────────────────────────────
// POST /admin/members/import-csv
// Form field: institution_id + file (CSV)
// CSV format: email, role, dept_name, batch
router.post("/members/import-csv", upload.single('csv_file'), async (req, res) => {
    const institution_id = parseInt(req.body?.institution_id);

    if (!institution_id || isNaN(institution_id)) {
        return res.status(400).json({ message: "institution_id is required." });
    }
    if (!req.file) {
        return res.status(400).json({ message: "CSV file is required." });
    }

    try {
        // Parse CSV from buffer
        const records = parse(req.file.buffer, {
            columns: true,           // first row = headers
            skip_empty_lines: true,
            trim: true
        });

        if (records.length === 0) {
            return res.status(400).json({ message: "CSV file is empty." });
        }

        // Fetch all departments for this institution (to map dept_name → dept_id)
        const deptResult = await pool.query(
            `select dept_id, lower(name) as name from departments where institution_id = $1`,
            [institution_id]
        );
        const deptMap = {};
        deptResult.rows.forEach(d => { deptMap[d.name] = d.dept_id; });

        const validRoles  = ['hod', 'faculty', 'student'];
        const results     = { added: 0, skipped: 0, errors: [] };
        const client      = await pool.connect();

        try {
            await client.query('BEGIN');

            for (let i = 0; i < records.length; i++) {
                const row   = records[i];
                const email = row.email?.trim().toLowerCase();
                const role  = row.role?.trim().toLowerCase();
                const dept  = row.dept_name?.trim().toLowerCase();
                const batch = row.batch?.trim() ? parseInt(row.batch) : null;
                const rowNum = i + 2; // +2 because row 1 is header

                // Validate
                if (!email || !role) {
                    results.errors.push(`Row ${rowNum}: email and role are required.`);
                    results.skipped++;
                    continue;
                }
                if (!validRoles.includes(role)) {
                    results.errors.push(`Row ${rowNum}: invalid role "${role}".`);
                    results.skipped++;
                    continue;
                }

                // Check if email already exists
                const existing = await client.query(
                    `SELECT user_id FROM users WHERE email = $1`, [email]
                );
                if (existing.rows.length > 0) {
                    results.errors.push(`Row ${rowNum}: ${email} already exists.`);
                    results.skipped++;
                    continue;
                }

                // Resolve dept_name → dept_id
                const dept_id = dept ? (deptMap[dept] || null) : null;
                if (dept && !dept_id) {
                    results.errors.push(`Row ${rowNum}: department "${row.dept_name}" not found — member added without dept.`);
                }

                await client.query(
                    `insert into users (institution_id, email, role, dept_id, batch, status)
                     values ($1, $2, $3, $4, $5, 'pending')`,
                    [institution_id, email, role, dept_id, batch]
                );
                results.added++;
            }

            await client.query('COMMIT');

            // Log bulk import — include admin_id if provided
            const adminId = parseInt(req.body?.admin_id) || null;
            await pool.query(
                `insert into audit_logs (institution_id, action_type, user_id, metadata)
                 values ($1, 'BULK IMPORT', $2, $3)`,
                [institution_id, adminId, `Imported ${results.added} members, skipped ${results.skipped}`]
            );

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({
            ok: true,
            added: results.added,
            skipped: results.skipped,
            errors: results.errors
        });

    } catch (err) {
        console.error("CSV Import Error:", err);
        res.status(500).json({ message: err.message || "Failed to import CSV." });
    }
});

// ── Update Member Status (suspend / activate) ─────────────────────────────────
// PUT /admin/members/:id/status
// Body: { institution_id, status: 'active' | 'pending' }
router.put("/members/:id/status", async (req, res) => {
    const userId = parseInt(req.params.id);
    const { institution_id, status } = req.body;

    if (!['active', 'pending'].includes(status)) {
        return res.status(400).json({ message: "Status must be active or pending." });
    }

    try {
        await pool.query(
            `update users SET status = $1
             where user_id = $2 and institution_id = $3 and role != 'admin'`,
            [status, userId, institution_id]
        );

        const memberRes = await pool.query(
            `select name, email from users where user_id = $1`,
            [userId]
        );
        const memberLabel = memberRes.rows[0]?.name || memberRes.rows[0]?.email || `user_id: ${userId}`;

        await pool.query(
            `insert into audit_logs (institution_id, action_type, user_id, metadata)
            values ($1, $2, $3, $4)`,
            [
                institution_id,
                status === 'pending' ? 'MEMBER SUSPENDED' : 'MEMBER ACTIVATED',
                req.body.admin_id || null,   // admin who did the action
                memberLabel                  // name or email of affected member
            ]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error("Update Member Status Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── Remove Member ─────────────────────────────────────────────────────────────
// DELETE /admin/members/:id?institution_id=1
router.delete("/members/:id", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);

    try {
        const result = await pool.query(
            `delete from users
             where user_id = $1 and institution_id = $2 and role != 'admin'
             returning email`,
            [userId, req.institutionId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Member not found." });
        }

        await pool.query(
            `insert into audit_logs (institution_id, action_type, user_id, metadata)
            values ($1, 'MEMBER REMOVED', $2, $3)`,
            [req.institutionId, req.query.admin_id || null, result.rows[0].email]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error("Remove Member Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── All Forms in Institution ───────────────────────────────────────────────────
// GET /admin/forms?institution_id=1
router.get("/forms", requireAdmin, async (req, res) => {
    try {
        await pool.query(
            `update forms SET status = 'closed'
             where status = 'open' and deadline < NOW()
               and institution_id = $1`,
            [req.institutionId]
        );

        const result = await pool.query(
            `select f.form_id, f.title, f.status, f.access_type,
                    f.created_at, f.deadline, f.form_code,
                    u.name as creator_name, u.role as creator_role,
                    d.name as target_dept_name,
                    COUNT(r.response_id) as response_count
             from forms f
             join users u on f.creator_id = u.user_id
             left join departments d on f.target_dept_id = d.dept_id
             left join responses r on f.form_id = r.form_id
             where f.institution_id = $1
             group by f.form_id, u.name, u.role, d.name
             order by f.created_at DESC`,
            [req.institutionId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Admin Forms Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── Audit Logs ────────────────────────────────────────────────────────────────
// GET /admin/audit-logs?institution_id=1&limit=100
router.get("/audit-logs", requireAdmin, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    try {
        const result = await pool.query(
            `select l.log_id, l.log_time, l.action_type, l.metadata,
                    u.name as user_name, u.role as user_role,
                    f.title as form_title
             from audit_logs l
             left join users u on l.user_id = u.user_id
             left join forms f on l.form_id = f.form_id
             where l.institution_id = $1
             order by l.log_time desc
             limit $2`,
            [req.institutionId, limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Admin Audit Logs Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

export default router;
