# 📝 FormFlow: Institutional Form Management System

**FormFlow** is a full-stack, **Multi-Tenant SaaS platform** designed specifically for the hierarchical needs of academic institutions. It replaces generic form builders with a system that understands university structures—departments, batches, and roles—while leveraging LLMs for automated generation and data analysis.

---

## 🚀 Key Technical Features

### 🏗️ Multi-Tenant Architecture
The platform is built as a **Shared Database, Shared Schema** SaaS application, allowing a single deployment to serve multiple independent universities (tenants).
* **Logical Isolation:** All data, including users, forms, and responses, is strictly isolated using a unique `institution_id`.
* **JWT-Based Scoping:** Every session is scoped to a specific tenant; the `institutionId` is embedded in the **JSON Web Token (JWT)**, ensuring users can only interact with their own university's data.
* **Cross-Institution Blocking:** Robust security is enforced at the database layer via the `fn_user_can_see_form` function, which programmatically blocks any cross-tenant data access.

### 🔐 Enterprise-Grade Security & RBAC
* **Role-Based Access Control (RBAC):** Supports four distinct institutional roles: Admin, HOD, Faculty, and Student.
* **Session Guard & JWT:** Implements secure authentication with **Bcryptjs** hashing and stateless JWT management.
* **Tiered Rate Limiting:** Protects the platform using specialized limits for Global traffic, Authentication attempts, and AI API consumption.

### 🤖 Strategic AI Integration
* **Model Selection:** Utilizes **Gemini 2.5 Flash Lite** for its high **RPM (Requests Per Minute)** and **TPD (Tokens Per Day)**, prioritizing throughput for form generation.
* **Prompt Engineering:** Structured prompts ensure the AI returns strictly valid JSON, enabling direct integration with the PostgreSQL backend.
* **Response Insights:** A custom data pipeline aggregates numeric and text responses into structured reports, which are then analyzed by the AI for faculty-level insights.

### 🏗️ Advanced Database Architecture
* **Automated Auditing:** Employs **PostgreSQL Triggers** to maintain a tamper-proof `audit_logs` table for all critical institutional actions.
* **Complex Visibility Logic:** Custom SQL functions handle multifaceted access rules (e.g., "Specific Department + Specific Batch") directly in the database, reducing backend complexity.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL (with PL/pgSQL for triggers and functions)
* **AI:** Google Gemini API (`gemini-2.5-flash-lite`)
* **Frontend:** HTML5, Tailwind CSS, Vanilla JavaScript

---

## ⚙️ Why These Choices?

| Decision | Justification |
| :--- | :--- |
| **Multi-Tenant SaaS** | Allows for centralized maintenance while providing each university with a private, branded experience. |
| **PostgreSQL vs NoSQL** | Relational integrity was critical for university hierarchies where `departments`, `users`, and `forms` are deeply interconnected. |
| **Gemini 2.5 Flash Lite** | Optimal for high-frequency tasks. It provides a superior balance of rate limits for production-scale use compared to heavier models. |

---

## 🏃‍♂️ Getting Started

### Prerequisites
* Node.js (v20.6.0+ for native `--env-file` support)
* PostgreSQL Instance

### Installation
1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/pagavath-dp/FormFlow-university-forms-platform.git](https://github.com/pagavath-dp/FormFlow-university-forms-platform.git)
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Setup:** Create a `.env` file and add your `PORT`, `DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET`, `JWT_EXPIRY`, `ENCRYPTION_KEY` and `NODE_ENV`.
4.  **Database Migration:** Run the schema provided in `project_db.sql` to set up tables, triggers, and functions.
5.  **Start the server:**
    ```bash
    npm run dev
    ```

---

## 📈 Future Works
- [x] Multi-Tenant SaaS Isolation
- [x] AI-Powered Form Generation & Analysis
- [x] Tiered Rate Limiting & Security Guards
- [ ] Multi-file upload support via Multer
- [ ] Email notifications for form deadlines
- [ ] Real-time response notifications using WebSockets
