import express from "express";
import pool from "../db.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();
const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// GET /ai/list-models
router.get("/list-models", async (req, res) => {
    try {
        // We use the direct fetch to bypass any SDK pathing issues
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`
        );
        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json({ 
                error: "Failed to fetch models", 
                details: data 
            });
        }

        // Filter for models that support 'generateContent'
        const availableModels = data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => ({
                name: m.name, // Usually 'models/gemini-1.5-flash'
                displayName: m.displayName,
                description: m.description
            }));

        res.json({
            count: availableModels.length,
            models: availableModels
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Generate Form from Description ───────────────────────────────────────────
// POST /ai/generate-form
// Body: { description, num_questions (optional) }
router.post("/generate-form", async (req, res) => {
    const { description, num_questions = 6 } = req.body;

    if (!description?.trim()) {
        return res.status(400).json({ message: "Description is required." });
    }

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
You are a university forms assistant. Generate a form based on this description:
"${description}"

Create exactly ${num_questions} questions. Return ONLY a valid JSON array, no markdown, no explanation.

Each question object must have:
- "text": the question text (string)
- "type": one of: "text", "textarea", "number", "email", "date", "mcq"
- "required": true or false
- "options": array of strings (ONLY if type is "mcq", otherwise omit this field)

MCQ questions must have 2-5 options.
Mix question types appropriately for the context.

Example format:
[
  {"text":"Full Name","type":"text","required":true},
  {"text":"Rating (1-5)","type":"number","required":true},
  {"text":"Department","type":"mcq","required":true,"options":["CSE","ECE","MECH","CIVIL"]},
  {"text":"Additional comments","type":"textarea","required":false}
]

Return ONLY the JSON array. No other text.`;

        const result = await model.generateContent(prompt);
        const raw    = result.response.text().trim();

        // Strip markdown fences if present
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const questions = JSON.parse(cleaned);

        if (!Array.isArray(questions)) {
            throw new Error("Invalid response format");
        }

        res.json({ ok: true, questions });

    } catch (err) {
        console.error("AI Generate Error:", err.message);
        res.status(500).json({
            message: "Failed to generate form. Please try again or adjust your description."
        });
    }
});

// ── Analyze Form Responses ────────────────────────────────────────────────────
// POST /ai/analyze/:formId
// Body: { user_id }
router.post("/analyze/:formId", async (req, res) => {
    const formId = Number(req.params.formId);
    const { user_id } = req.body;

    if (isNaN(formId) || !user_id) {
        return res.status(400).json({ message: "formId and user_id are required." });
    }

    try {
        // Verify user is creator or admin
        const formCheck = await pool.query(
            `select f.title, f.creator_id, f.institution_id, f.allow_multiple
             from forms f where f.form_id = $1`,
            [formId]
        );
        if (formCheck.rows.length === 0) {
            return res.status(404).json({ message: "Form not found." });
        }

        const form = formCheck.rows[0];
        const userCheck = await pool.query(
            `select role from users where user_id = $1`,
            [Number(user_id)]
        );
        const role = userCheck.rows[0]?.role;

        if (form.creator_id !== Number(user_id) && role !== 'admin' && role !== 'hod') {
            return res.status(403).json({ message: "Unauthorized." });
        }

        // Fetch questions
        const qResult = await pool.query(
            `select question_id, question_text, question_type
             from questions where form_id = $1 order by question_id`,
            [formId]
        );

        // Fetch all answers with option text resolved
        const aResult = await pool.query(
            `select q.question_text, q.question_type,
                    a.answer_text, a.answer_number,
                    o.option_text,
                    u.role as respondent_role,
                    d.name as respondent_dept
             from answers a
             join responses r on a.response_id = r.response_id
             join questions q on a.question_id = q.question_id
             join users u on r.user_id = u.user_id
             left join departments d on u.dept_id = d.dept_id
             left join options o on a.selected_option_id = o.option_id
             where r.form_id = $1`,
            [formId]
        );

        if (aResult.rows.length === 0) {
            return res.status(400).json({ message: "No responses yet to analyze." });
        }

        // Count total responses
        const countResult = await pool.query(
            `select count(distinct response_id) as total from responses where form_id = $1`,
            [formId]
        );
        const totalResponses = Number(countResult.rows[0].total);

        // Build structured summary for Gemini
        const questionMap = {};
        qResult.rows.forEach(q => {
            questionMap[q.question_text] = { type: q.question_type, answers: [] };
        });

        aResult.rows.forEach(a => {
            const val = a.option_text ?? a.answer_text ?? a.answer_number ?? null;
            if (val !== null && questionMap[a.question_text]) {
                questionMap[a.question_text].answers.push(String(val));
            }
        });

        // Format data for prompt
        const summaryLines = Object.entries(questionMap).map(([q, data]) => {
            if (data.type === 'mcq') {
                const counts = {};
                data.answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
                const breakdown = Object.entries(counts)
                    .map(([opt, cnt]) => `${opt}: ${cnt} (${Math.round(cnt/totalResponses*100)}%)`)
                    .join(', ');
                return `Q: "${q}" → ${breakdown}`;
            } else if (data.type === 'number') {
                const nums = data.answers.map(Number).filter(n => !isNaN(n));
                if (nums.length === 0) return `Q: "${q}" → No numeric responses`;
                const avg = (nums.reduce((a,b) => a+b, 0) / nums.length).toFixed(2);
                const min = Math.min(...nums);
                const max = Math.max(...nums);
                return `Q: "${q}" → avg: ${avg}, min: ${min}, max: ${max}`;
            } else {
                const sample = data.answers.slice(0, 8).map(a => `"${a}"`).join(', ');
                return `Q: "${q}" → Text responses (${data.answers.length} total): ${sample}`;
            }
        }).join('\n');

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });
        const prompt = `
You are an academic data analyst. Analyze these form responses and write a concise insights report.

Form: "${form.title}"
Total Responses: ${totalResponses}
Allow Multiple Submissions: ${form.allow_multiple}

Response Data:
${summaryLines}

Write a professional insights report. Return ONLY a valid JSON object with exactly this structure:
{
  "overview": "Brief summary of participation and general sentiment.",
  "keyFindings": ["Finding 1 with specific numbers", "Finding 2"],
  "patterns": ["Pattern 1", "Pattern 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Keep it concise and data-driven. Use specific numbers from the data.`;

        const result  = await model.generateContent(prompt);
        const raw = result.response.text().trim();
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const insights = JSON.parse(cleaned);

        res.json({ ok: true, insights, total_responses: totalResponses });

    } catch (err) {
        console.error("AI Analyze Error:", err.message);
        res.status(500).json({ message: "Failed to analyze responses. Please try again." });
    }
});

export default router;
