import express from 'express';
import cors from 'cors';
import path from 'path';
import url from 'url';
import oracledb from 'oracledb';

import authRoutes from "./routes/auth.js";
import formRoutes from "./routes/forms.js";
import responseRoutes from "./routes/responses.js";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const port = process.env.PORT || 8000;
const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

app.use("/auth", authRoutes);
app.use("/forms", formRoutes);
app.use("/responses", responseRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signin.html'));
});

app.listen(port, () => {
    console.log(`http://localhost:${port}/`);
});