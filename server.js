import express from 'express';
import cors from 'cors';
import path from 'path';
import url from 'url';
import { rateLimit } from 'express-rate-limit';

import authRoutes        from "./routes/auth.js";
import formRoutes        from "./routes/forms.js";
import responseRoutes    from "./routes/responses.js";
import institutionRoutes from "./routes/institutions.js";
import adminRoutes       from "./routes/admin.js";
import aiRoutes          from "./routes/ai.js";

const port = process.env.PORT || 8000;
const app  = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 5,
    message: { message: "Too many login attempts. Please try again in 15 minutes." },
    standardHeaders: true, legacyHeaders: false,
});
const globalLimiter = rateLimit({
    windowMs: 60 * 1000, limit: 100,
    message: { message: "Too many requests. Please slow down." },
    standardHeaders: true, legacyHeaders: false,
});
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, limit: 10,
    message: { message: "Too many AI requests. Please wait a moment." },
    standardHeaders: true, legacyHeaders: false,
});

app.use(globalLimiter);
app.use("/auth/login", loginLimiter);
app.use("/institutions/admin-login", loginLimiter);
app.use("/ai", aiLimiter);

const __filename = url.fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

app.use("/auth",         authRoutes);
app.use("/forms",        formRoutes);
app.use("/responses",    responseRoutes);
app.use("/institutions", institutionRoutes);
app.use("/admin",        adminRoutes);
app.use("/ai",           aiRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signin.html'));
});

app.listen(port, () => { 
    console.log(`http://localhost:${port}/`); 
});