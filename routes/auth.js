import express from "express";
import { getConnection } from "../db.js";
import oracledb from "oracledb";

const router = express.Router();

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    let conn;

    try {
        conn = await getConnection();

        const result = await conn.execute(
            `select * from users where email = :email and password = :password`,
            { email, password },
            { outFormat: oracledb.OUT_FORMAT_OBJECT } 
        );

        if (result.rows.length === 1) {
            const userId = result.rows[0].USER_ID;
            res.json({ ok: true, redirect: `/dashboard.html?user_id=${userId}` });
        } else {
            res.status(401).json({ message: "Invalid credentials" });
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        if (conn) await conn.close();
    }
});

router.post("/signup", async (req, res) => {
    const { name, email, password, user_type, department, batch } = req.body;
    let conn;

    try {
        conn = await getConnection();
        
        const result = await conn.execute(
            `insert into users (name, email, password, user_type, department, batch) values (:name, :email, :password, :user_type, :department, :batch)`,
            { name, email, password, user_type, department, batch },
            { autoCommit: true }
        );

        if (result.rowsAffected === 1) {
            res.json({ ok: true });
        } else {
            res.status(400).json({ message: "Invalid fields / Error in insertion" });
        }
    } catch (err) {
        if (err.message?.includes("ORA-00001")) {
            res.status(409).json({ message: "email_taken" });
        } else {
            console.error("Signup Error:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    } finally {
        if (conn) await conn.close();
    }
});

router.get("/user/:id", async (req, res) => {
    let conn;
    
    try {
        conn = await getConnection();

        const result = await conn.execute(
            `select user_id, name, user_type from users where user_id = :id`,
            { id: req.params.id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (err) {
        console.error("Fetch User Error:", err);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        if (conn) await conn.close();
    }
});

router.post("/change-password", async (req, res) => {
    const { user_id, current_password, new_password } = req.body;
    let conn;

    if (!user_id || !current_password || !new_password) {
        return res.status(400).json({ message: "All fields are required." });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    try {
        conn = await getConnection();

        // Verify current password
        const check = await conn.execute(
            `SELECT user_id FROM users WHERE user_id = :user_id AND password = :current_password`,
            { user_id, current_password },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (check.rows.length === 0) {
            return res.status(401).json({ message: "Current password is incorrect." });
        }

        // Update to new password
        await conn.execute(
            `UPDATE users SET password = :new_password WHERE user_id = :user_id`,
            { new_password, user_id },
            { autoCommit: true }
        );

        res.json({ ok: true, message: "Password updated successfully." });
    } catch (err) {
        console.error("Change Password Error:", err);
        res.status(500).json({ message: "Internal server error." });
    } finally {
        if (conn) await conn.close();
    }
});

export default router;