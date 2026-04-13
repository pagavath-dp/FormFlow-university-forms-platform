import express from "express";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// ── Register Institution + Admin Account ──────────────────────────────────────
// POST /institutions/register
// Body: { institution_name, domain, admin_name, admin_email, admin_password }
router.post("/register", async (req, res) => {
    const { institution_name, domain, admin_name, admin_email, admin_password } = req.body;

    if (!institution_name || !admin_name || !admin_email || !admin_password) {
        return res.status(400).json({ message: "All fields are required." });
    }
    if (admin_password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Check if admin email already exists
        const emailCheck = await client.query(
            `select user_id from users where email = $1`,
            [admin_email]
        );
        if (emailCheck.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "email_taken" });
        }

        // 1. Create institution
        const instResult = await client.query(
            `insert into institutions (name, domain)
             values ($1, $2)
             returning institution_id`,
            [institution_name.trim(), domain?.trim() || null]
        );
        const institutionId = instResult.rows[0].institution_id;

        // 2. Create admin user
        const hashedPassword = await bcrypt.hash(admin_password, 12);
        const userResult = await client.query(
            `insert into users (institution_id, name, email, password, role, status)
             values ($1, $2, $3, $4, 'admin', 'active')
             returning user_id`,
            [institutionId, admin_name.trim(), admin_email.trim().toLowerCase(), hashedPassword]
        );
        const adminUserId = userResult.rows[0].user_id;

        // 3. Log it
        await client.query(
            `insert into audit_logs (institution_id, action_type, user_id, metadata)
             values ($1, 'INSTITUTION REGISTERED', $2, $3)`,
            [institutionId, adminUserId, institution_name]
        );

        await client.query("COMMIT");

        // 4. Sign JWT for the admin
        const token = jwt.sign(
            { userId: adminUserId, role: "admin", institutionId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || "24h" }
        );

        res.status(201).json({
            ok: true,
            token,
            user: {
                id: adminUserId,
                name: admin_name,
                role: "admin",
                institutionId
            },
            redirect: "/admin.html"
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Institution Register Error:", err);
        res.status(500).json({ message: "Internal server error." });
    } finally {
        client.release();
    }
});

// ── Admin Login ───────────────────────────────────────────────────────────────
// POST /institutions/admin-login
// Separate from regular /auth/login — only allows admin role
router.post("/admin-login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        const result = await pool.query(
            `select u.*, i.name AS institution_name
             from users u
             join institutions i on u.institution_id = i.institution_id
             where u.email = $1`,
            [email.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const user = result.rows[0];

        // Only admins can log in here
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admin accounts only." });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const token = jwt.sign(
            { userId: user.user_id, role: "admin", institutionId: user.institution_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || "24h" }
        );

        res.json({
            ok: true,
            token,
            user: {
                id: user.user_id,
                name: user.name,
                role: "admin",
                institutionId: user.institution_id,
                institutionName: user.institution_name
            },
            redirect: "/admin.html"
        });

    } catch (err) {
        console.error("Admin Login Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── Get Institution Details ───────────────────────────────────────────────────
// GET /institutions/:id
router.get("/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid institution ID." });

    try {
        const result = await pool.query(
            `select i.*, 
                    COUNT(DISTINCT u.user_id) AS member_count,
                    COUNT(DISTINCT d.dept_id) AS dept_count
             from institutions i
             left join users u on u.institution_id = i.institution_id
             left join departments d on d.institution_id = i.institution_id
             where i.institution_id = $1
             group by i.institution_id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Institution not found." });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Get Institution Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── Add Department ────────────────────────────────────────────────────────────
// POST /institutions/:id/departments
// Body: { name }
router.post("/:id/departments", async (req, res) => {
    const institutionId = parseInt(req.params.id);
    const { name } = req.body;

    if (isNaN(institutionId)) return res.status(400).json({ message: "Invalid institution ID." });
    if (!name?.trim()) return res.status(400).json({ message: "Department name is required." });

    try {
        const result = await pool.query(
            `insert into departments (institution_id, name)
             values ($1, $2)
             returning dept_id, name`,
            [institutionId, name.trim()]
        );
        res.status(201).json({ ok: true, department: result.rows[0] });
    } catch (err) {
        console.error("Add Department Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── List Departments ──────────────────────────────────────────────────────────
// GET /institutions/:id/departments
router.get("/:id/departments", async (req, res) => {
    const institutionId = parseInt(req.params.id);
    if (isNaN(institutionId)) return res.status(400).json({ message: "Invalid institution ID." });

    try {
        const result = await pool.query(
            `select d.dept_id, d.name,
                    COUNT(u.user_id) AS member_count
             from departments d
             left join users u on u.dept_id = d.dept_id
             where d.institution_id = $1
             group by d.dept_id, d.name
             order by d.name`,
            [institutionId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("List Departments Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ── Delete Department ─────────────────────────────────────────────────────────
// DELETE /institutions/:id/departments/:deptId
router.delete("/:id/departments/:deptId", async (req, res) => {
    const deptId = parseInt(req.params.deptId);
    const institutionId = parseInt(req.params.id);

    try {
        await pool.query(
            `delete from departments where dept_id = $1 and institution_id = $2`,
            [deptId, institutionId]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error("Delete Department Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

export default router;
