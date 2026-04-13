import express from "express";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post("/login", async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: "Request body is missing!" });
    }

    const { email, password } = req.body;

    try {
        const result = await pool.query(
            `SELECT u.*, d.name AS dept_name
             FROM users u
             LEFT JOIN departments d ON u.dept_id = d.dept_id
             WHERE u.email = $1`,
            [email]
        );

        if (result.rows.length !== 1) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = result.rows[0];

        // Block pending users from logging in
        if (user.status === 'pending') {
            return res.status(403).json({ message: "account_pending" });
        }

        if (user.role === 'admin') {
            return res.status(403).json({ message: "admin_use_business" });
        }


        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Include institution_id, dept_id, role in JWT
        const token = jwt.sign(
            {
                userId:        user.user_id,
                role:          user.role,
                institutionId: user.institution_id,
                deptId:        user.dept_id
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || "24h" }
        );

        res.json({
            ok: true,
            token,
            user: {
                id:            user.user_id,
                name:          user.name,
                role:          user.role,
                institutionId: user.institution_id,
                deptId:        user.dept_id,
                deptName:      user.dept_name,
                batch:         user.batch
            },
            redirect: "/dashboard.html"
        });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/signup", async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: "Request body is missing!" });
    }

    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: "weak_password" });
    }

    try {
        // Check if email was pre-registered by an admin (status = pending)
        const check = await pool.query(
            `SELECT user_id, status, role FROM users WHERE email = $1`,
            [email.trim().toLowerCase()]
        );

        if (check.rows.length === 0) {
            return res.status(403).json({ message: "not_preregistered" });
        }

        const user = check.rows[0];

        if (user.status === 'active') {
            return res.status(409).json({ message: "email_taken" });
        }

        // Activate the account — fill in name and password
        const hashpwd = await bcrypt.hash(password, 12);
        await pool.query(
            `UPDATE users
             SET name = $1, password = $2, status = 'active'
             WHERE user_id = $3`,
            [name.trim(), hashpwd, user.user_id]
        );

        res.json({ ok: true });

    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get("/user/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
        const result = await pool.query(
            `SELECT u.user_id, u.name, u.role, u.institution_id,
                    u.dept_id, u.batch, d.name AS dept_name
             FROM users u
             LEFT JOIN departments d ON u.dept_id = d.dept_id
             WHERE u.user_id = $1`,
            [id]
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (err) {
        console.error("Fetch User Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/change-password", async (req, res) => {
    const { user_id, current_password, new_password } = req.body;

    if (!user_id || !current_password || !new_password) {
        return res.status(400).json({ message: "All fields are required." });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    try {
        const check = await pool.query(
            `SELECT password FROM users WHERE user_id = $1`,
            [user_id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const valid = await bcrypt.compare(current_password, check.rows[0].password);
        if (!valid) {
            return res.status(401).json({ message: "Current password is incorrect." });
        }

        const newHash = await bcrypt.hash(new_password, 12);
        await pool.query(
            `UPDATE users SET password = $1 WHERE user_id = $2`,
            [newHash, user_id]
        );

        res.json({ ok: true, message: "Password updated successfully." });

    } catch (err) {
        console.error("Change Password Error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

export default router;
