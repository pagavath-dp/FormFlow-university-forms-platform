// ── goCreateForm ──────────────────────────────────────────────────────────────
async function goCreateForm() {
    window.editingFormId = null;
    work_area.className = "glass-bg flex-1 !overflow-y-auto p-3 md:p-8 lg:p-12 m-1 md:m-4 lg:m-8";
    work_area.innerHTML = `<h2 class="text-3xl font-bold text-white mb-6">Loading Templates...</h2>`;

    try {
        const res = await fetch('/forms/get-templates');
        const templates = await res.json();
        
        let galleryHtml = `
            <div class="mb-10 text-center">
                <h2 class="text-4xl font-bold text-white mb-4">Start a New Form</h2>
                <p class="text-gray-400">Choose a pre-made template below or start from scratch.</p>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
                <!-- Blank Form Card -->
                <div onclick="(async()=>await initFormBuilder())()" class="p-8 rounded-3xl bg-white/5 border-2 border-dashed border-white/20 hover:border-emerald-400/50 hover:bg-white/10 cursor-pointer transition text-center flex flex-col items-center justify-center min-h-[220px] group">
                    <div class="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 group-hover:bg-emerald-500/30 transition">
                        <i class="fa-solid fa-plus"></i>
                    </div>
                    <h3 class="text-xl font-bold text-white">Blank Form</h3>
                </div>

                <!-- AI Generate Card -->
                <div onclick="showAIGeneratePanel()"
                    class="p-8 rounded-3xl bg-gradient-to-br from-violet-500/10 to-purple-500/5
                           border border-violet-500/30 hover:border-violet-400/60 cursor-pointer
                           transition text-center flex flex-col items-center justify-center
                           min-h-[220px] group relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
                    <div class="w-14 h-14 rounded-full bg-violet-500/20 text-violet-400 flex items-center
                                justify-center text-2xl mb-4 group-hover:scale-110 transition relative z-10">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </div>
                    <h3 class="text-xl font-bold text-white relative z-10">Generate with AI</h3>
                    <p class="text-gray-400 text-xs mt-2 relative z-10">Describe your form, AI builds it</p>
                </div>
        `;
        
        templates.forEach(t => {
            galleryHtml += `
                <div onclick="(async()=>await initFormBuilder(${t.template_id}))()" class="p-8 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 hover:border-indigo-400/50 cursor-pointer transition text-left relative overflow-hidden group min-h-[220px] flex flex-col items-start justify-end">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-indigo-500/30 transition"></div>
                    <i class="fa-solid fa-file-lines text-3xl text-indigo-400/50 mb-auto"></i>
                    <h3 class="text-xl font-bold text-indigo-300 relative z-10">${t.name}</h3>
                    <p class="text-gray-400 text-sm mt-2 relative z-10 w-full line-clamp-2">${t.description || ''}</p>
                </div>
            `;
        });
        
        galleryHtml += `</div>`;
        work_area.innerHTML = galleryHtml;
        window.loadedTemplates = templates;
        
    } catch (e) {
        console.error(e);
        initFormBuilder();
    }
}

// ── initFormBuilder ───────────────────────────────────────────────────────────
async function initFormBuilder(templateId = null, editData = null) {
    work_area.className = "glass-bg flex-1 !overflow-y-auto p-3 md:p-8 lg:p-12 m-1 md:m-4 lg:m-8";
    questionCount = 0;
    window.editingFormId = editData ? editData.form.form_id : null;
    window.editHasResponses = editData ? editData.hasResponses : false;

    const isEdit   = !!editData;
    const isLocked = isEdit && editData.hasResponses;
    const pageTitle   = isEdit ? 'Edit Form' : (templateId ? 'Template Editor' : 'Create New Form');
    const saveLabel   = isEdit ? 'Save Changes' : 'Publish Form';
    const saveIcon    = isEdit ? 'fa-floppy-disk' : 'fa-floppy-disk';
    const backAction  = isEdit ? 'goMyForms()' : 'goCreateForm()';

    work_area.innerHTML = `
        <div class="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-x-12 items-start">

            <!-- LEFT: FORM BUILDER -->
            <div class="pt-4 w-full xl:w-[90%]">
                <div class="flex items-center gap-4 mb-8">
                    <button onclick="${backAction}" class="text-gray-400 hover:text-white transition w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-3xl font-bold text-emerald-400">${pageTitle}</h2>
                </div>

                ${isLocked ? `
                <div class="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm flex items-center gap-2">
                    <i class="fa-solid fa-lock text-xs"></i>
                    Questions are locked — this form has existing submissions. Only title, description, deadline and settings can be changed.
                </div>` : ''}

                <input id="form_title" type="text" placeholder="Form Title"
                    class="w-full mb-4 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white"/>

                <textarea id="form_desc" placeholder="Form Description" rows="3"
                    class="h-auto max-h-48 min-h-16 w-full mb-6 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white"></textarea>

                <!-- Questions -->
                <div id="questions" class="space-y-4"></div>

                <!-- Buttons -->
                <div class="mt-10 flex gap-4 justify-center flex-wrap">
                    ${isLocked ? '' : `
                    <button onclick="addQuestion()" class="quick-btn">
                        <i class="fa-solid fa-plus"></i> Add Question
                    </button>
                    <button onclick="generateQuestionsAI()" class="px-6 py-3 rounded-full font-semibold text-sm transition-all bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> AI Suggest
                    </button>`}

                    <button onclick="previewForm()" class="quick-btn secondary">
                        <i class="fa-solid fa-eye"></i> Preview
                    </button>

                    <button onclick="saveForm()" class="quick-btn secondary">
                        <i class="fa-solid fa-${saveIcon}"></i> ${saveLabel}
                    </button>
                </div>

            </div>

            <!-- RIGHT: SETTINGS PANEL -->
            <div class="w-full self-start mt-6 xl:mt-24">

                <h3 class="text-lg font-semibold text-emerald-400 mb-4">
                    Form Settings
                </h3>

                <label class="text-sm text-gray-400">Access Type</label>
                <select id="access_type" onchange="handleAccessTypeChange()"
                    class="w-full mt-2 mb-4 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white cursor-pointer">
                </select>

                <!-- Dept picker — shown when access_type needs a dept -->
                <div id="setting_dept" class="hidden">
                    <label class="text-sm text-gray-400">Department</label>
                    <select id="target_dept_id"
                        class="w-full mt-2 mb-4 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white">
                        <option value="" disabled selected>Loading departments...</option>
                    </select>
                </div>

                <!-- Role picker — shown for role / dept_role -->
                <div id="setting_role" class="hidden">
                    <label class="text-sm text-gray-400">Target Role</label>
                    <select id="target_role"
                        class="w-full mt-2 mb-4 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white">
                        <option value="" disabled selected>Select role</option>
                    </select>
                </div>

                <!-- Batch picker — shown for batch / dept_batch -->
                <div id="setting_batch" class="hidden">
                    <label class="text-sm text-gray-400">Target Batch Year</label>
                    <input type="number" id="target_batch" placeholder="e.g. 2023"
                        class="w-full mt-2 mb-4 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"/>
                </div>

                <label class="text-sm text-gray-400">Deadline</label>
                <input type="datetime-local" id="deadline"
                    class="w-full mt-2 mb-4 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white cursor-pointer"/>

                <label class="text-sm text-gray-400">Form Theme</label>
                <select id="theme_color"
                    class="w-full mt-2 mb-4 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white cursor-pointer">
                    <option value="emerald">Emerald (Default)</option>
                    <option value="indigo">Indigo</option>
                    <option value="rose">Rose</option>
                    <option value="amber">Amber</option>
                </select>

                <label class="flex items-center gap-3 mb-6 cursor-pointer group">
                    <div class="relative">
                        <input type="checkbox" id="allow_multiple" class="sr-only peer"/>
                        <div class="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-500 transition-colors duration-200"></div>
                        <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-5"></div>
                    </div>
                    <div>
                        <p class="text-sm text-gray-200 font-medium">Allow Multiple Responses</p>
                        <p class="text-xs text-gray-500">e.g. for leave forms, query forms</p>
                    </div>
                </label>

                <hr class="border-white/10 mb-4"/>

                <p class="text-xs text-gray-400 leading-relaxed">
                    • Public forms are visible to everyone<br/>
                    • Group forms are restricted by specific department<br/>
                    • Forms close automatically after deadline
                </p>

            </div>
        </div>
    `;

    populateAccessTypeOptions();
    await loadDepartmentsForPicker();

    // ── Set deadline min to current time (allow today but from now onwards) ───
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const currentTime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    document.getElementById("deadline").min = currentTime;


    // ── Load from template ────────────────────────────────────────────────────
    if (templateId && window.loadedTemplates) {
        const tmpl = window.loadedTemplates.find(t => t.template_id === templateId);
        if (tmpl && tmpl.structure) {
            document.getElementById("form_title").value = tmpl.name;
            document.getElementById("form_desc").value = tmpl.description || '';
            try {
                const questions = JSON.parse(tmpl.structure);
                questions.forEach(qData => {
                    addQuestion();
                    const qDivs = document.querySelectorAll("#questions > div[data-id]");
                    const currentQ = qDivs[qDivs.length - 1];
                    currentQ.querySelector("input[type='text']").value = qData.text;
                    currentQ.querySelector("input[type='checkbox']").checked = qData.required;
                    const qtypeSelect = currentQ.querySelector("select");
                    qtypeSelect.value = qData.type;
                    qtypeSelect.dispatchEvent(new Event('change'));
                    if (qData.type === 'mcq' && Array.isArray(qData.options)) {
                        const optionsContainer = currentQ.querySelector(".options");
                        optionsContainer.innerHTML = '';
                        qData.options.forEach(optText => {
                            optionsContainer.insertAdjacentHTML("beforeend", createOptionHTML());
                            const optInputs = currentQ.querySelectorAll(".options input[type='text']");
                            optInputs[optInputs.length - 1].value = optText;
                        });
                        optionsContainer.insertAdjacentHTML("beforeend", `
                            <button type="button" onclick="addOption(this)" class="block mx-auto text-emerald-400 text-sm mt-3 add-option-btn">
                                <i class="fa-solid fa-plus"></i> Add Option
                            </button>
                        `);
                    }
                });
            } catch(e) {
                console.error("Template parse failed", e);
                addQuestion();
            }
        }
        return;
    }

    // ── Load from existing form (edit mode) ───────────────────────────────────
    if (editData) {
        const f = editData.form;
        document.getElementById("form_title").value = f.title || '';
        document.getElementById("form_desc").value  = f.description || '';

        // Format deadline for datetime-local
        if (f.deadline) {
            const d = new Date(f.deadline);
            const pad = n => String(n).padStart(2, '0');
            document.getElementById("deadline").value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }

        populateAccessTypeOptions();
        await loadDepartmentsForPicker();
        document.getElementById("access_type").value = f.access_type || 'public';
        handleAccessTypeChange();
        if (f.target_dept_id) {
            const td = document.getElementById("target_dept_id");
            if (td) td.value = f.target_dept_id;
        }
        if (f.target_role) {
            const tr = document.getElementById("target_role");
            if (tr) tr.value = f.target_role;
        }
        if (f.target_batch) {
            const tb = document.getElementById("target_batch");
            if (tb) tb.value = f.target_batch;
        }
        document.getElementById("theme_color").value    = f.theme_color || 'emerald';
        document.getElementById("allow_multiple").checked = f.allow_multiple === 'yes';

        // Load questions
        editData.questions.forEach(q => {
            addQuestion();
            const qDivs   = document.querySelectorAll("#questions > div[data-id]");
            const currentQ = qDivs[qDivs.length - 1];

            currentQ.querySelector("input[type='text']").value    = q.question_text;
            currentQ.querySelector("input[type='checkbox']").checked = q.is_required === 1;

            const qtypeSelect = currentQ.querySelector("select");
            qtypeSelect.value = q.question_type;
            qtypeSelect.dispatchEvent(new Event('change'));

            if (q.question_type === 'mcq') {
                const optContainer = currentQ.querySelector(".options");
                optContainer.innerHTML = '';
                const qOptions = editData.options.filter(o => o.question_id === q.question_id);
                qOptions.forEach(opt => {
                    optContainer.insertAdjacentHTML("beforeend", createOptionHTML());
                    const optInputs = currentQ.querySelectorAll(".options input[type='text']");
                    optInputs[optInputs.length - 1].value = opt.option_text;
                });
                optContainer.insertAdjacentHTML("beforeend", `
                    <button type="button" onclick="addOption(this)" class="block mx-auto text-emerald-400 text-sm mt-3 add-option-btn">
                        <i class="fa-solid fa-plus"></i> Add Option
                    </button>
                `);
            }

            // Lock question controls if form has responses
            if (editData.hasResponses) {
                currentQ.querySelectorAll("input, select, button:not(.no-lock)").forEach(el => {
                    el.disabled = true;
                    el.style.opacity = '0.45';
                    el.style.cursor  = 'not-allowed';
                });
                currentQ.style.cursor = 'default';
            }
        });
        return;
    }

    // ── Default: blank form with one empty question ───────────────────────────
    addQuestion();
}

let questionCount = 0;
let dragSrc = null;

function handleAccessTypeChange() {
    const type     = document.getElementById("access_type").value;
    const userData = JSON.parse(localStorage.getItem("ff_user") ?? 'null');
    const role     = userData?.role || 'student';

    // Students can only target their OWN dept/batch — no picker needed
    const isStudent = role === 'student';

    const needsDept  = ['dept', 'dept_batch', 'dept_role'].includes(type);
    const needsRole  = ['role', 'dept_role'].includes(type);
    const needsBatch = ['batch', 'dept_batch'].includes(type);

    // Show dept picker only for non-students who need it
    document.getElementById("setting_dept").classList.toggle("hidden", !needsDept || isStudent);
    // Role picker — students never see this (no role targeting for students)
    document.getElementById("setting_role").classList.toggle("hidden", !needsRole);
    // Batch picker only for non-students
    document.getElementById("setting_batch").classList.toggle("hidden", !needsBatch || isStudent);
}

// Populate access_type options based on user role
function populateAccessTypeOptions() {
    const userData = JSON.parse(localStorage.getItem("ff_user") ?? 'null');
    const role     = userData?.role || 'student';
    const sel      = document.getElementById("access_type");
    if (!sel) return;

    const options = {
        admin:   [
            { value: 'public',     label: 'Public — Everyone in institution' },
            { value: 'dept',       label: 'Department — Specific department' },
            { value: 'batch',      label: 'Batch — Specific year' },
            { value: 'role',       label: 'Role — Specific role' },
            { value: 'dept_batch', label: 'Department + Batch' },
            { value: 'dept_role',  label: 'Department + Role' },
        ],
        hod:     [
            { value: 'public',     label: 'Public — Everyone in institution' },
            { value: 'dept',       label: 'Department — Specific department' },
            { value: 'batch',      label: 'Batch — Specific year' },
            { value: 'role',       label: 'Role — Specific role' },
            { value: 'dept_batch', label: 'Department + Batch' },
            { value: 'dept_role',  label: 'Department + Role' },
        ],
        faculty: [
            { value: 'public',     label: 'Public — Everyone in institution' },
            { value: 'dept',       label: 'Department — Specific department' },
            { value: 'role',       label: 'Role — All faculty (any department)' },
            { value: 'dept_role',  label: 'Department + Role — e.g. CSE faculty only' },
        ],
        student: [
            { value: 'public',     label: 'Public — Everyone in institution' },
            { value: 'dept',       label: 'My Department' },
            { value: 'batch',      label: 'My Batch' },
            { value: 'dept_batch', label: 'My Department + My Batch' },
        ],
    };

    const roleOptions = options[role] || options.student;
    sel.innerHTML = roleOptions.map(o =>
        `<option value="${o.value}">${o.label}</option>`
    ).join('');

    // Populate role dropdown options (restricted by creator role)
    const roleEl = document.getElementById("target_role");
    if (roleEl) {
        const roleChoices = role === 'student' ? [] :
            role === 'faculty' ? [{ v: 'faculty', l: 'Faculty' }] :
            [
                { v: 'hod',     l: 'HOD' },
                { v: 'faculty', l: 'Faculty' },
                { v: 'student', l: 'Student' },
            ];
        roleEl.innerHTML = `<option value="" disabled selected>Select role</option>` +
            roleChoices.map(r => `<option value="${r.v}">${r.l}</option>`).join('');
    }

    handleAccessTypeChange();
}

async function loadDepartmentsForPicker() {
    const userData = JSON.parse(localStorage.getItem("ff_user") || "null");
    const institutionId = userData?.institutionId;
    if (!institutionId) return;

    try {
        const res  = await fetch(`/institutions/${institutionId}/departments`);
        const data = await res.json();
        const sel  = document.getElementById("target_dept_id");
        if (!sel) return;
        sel.innerHTML = `<option value="" disabled selected>Select department</option>` +
            data.map(d => `<option value="${d.dept_id}">${d.name}</option>`).join('');
    } catch(e) {
        console.error("Failed to load departments", e);
    }
}

// Question Renumbering after deletion / drag
function renumberQuestions() {
    document.querySelectorAll("#questions > div").forEach((q, i) => {
        const h3 = q.querySelector("h3");
        if (h3) h3.innerText = `Question ${i + 1}`;
    });
}

function hasAtLeastOneQuestion() {
    return document.querySelectorAll("#questions > div[data-id]").length > 0;
}

// ── Drag helpers ──────────────────────────────────────────────────────────────
function initDragOnCard(card) {
    card.addEventListener('dragstart', e => {
        dragSrc = card;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => card.classList.add('drag-ghost'), 0);
    });
    card.addEventListener('dragend', () => {
        card.classList.remove('drag-ghost', 'drag-over-top', 'drag-over-bottom');
        document.querySelectorAll('#questions > div[data-id]').forEach(c =>
            c.classList.remove('drag-over-top', 'drag-over-bottom')
        );
    });
    card.addEventListener('dragover', e => {
        e.preventDefault();
        if (card === dragSrc) return;
        const mid = card.getBoundingClientRect().top + card.offsetHeight / 2;
        card.classList.toggle('drag-over-top',    e.clientY < mid);
        card.classList.toggle('drag-over-bottom', e.clientY >= mid);
    });
    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    card.addEventListener('drop', e => {
        e.preventDefault();
        if (card === dragSrc) return;
        const mid = card.getBoundingClientRect().top + card.offsetHeight / 2;
        e.clientY < mid ? card.before(dragSrc) : card.after(dragSrc);
        card.classList.remove('drag-over-top', 'drag-over-bottom');
        renumberQuestions();
    });
}

// ── Type change handler ───────────────────────────────────────────────────────
function handleTypeChange(select) {
    const container = select.closest("div[data-id]");
    const optionsDiv = container.querySelector(".options");

    if (select.value === "mcq") {
        optionsDiv.classList.remove("hidden");
        optionsDiv.innerHTML = `
            ${createOptionHTML("Option")}
            ${createOptionHTML("Option")}
            <button onclick="addOption(this)" class="block mx-auto text-emerald-400 text-sm mt-3 add-option-btn">
                <i class="fa-solid fa-plus"></i> Add Option
            </button>
        `;
    } else {
        optionsDiv.classList.add("hidden");
        optionsDiv.innerHTML = "";
    }
}

// ── Option helpers ────────────────────────────────────────────────────────────
function addOption(btn) {
    const optionsDiv = btn.closest(".options");
    btn.insertAdjacentHTML("beforebegin", createOptionHTML());
    optionsDiv.scrollTop = optionsDiv.scrollHeight;
}

function createOptionHTML(placeholder = "Option") {
    return `
        <div class="flex items-center gap-2 mb-1">
            <span class="text-gray-500 text-xs">○</span>
            <input type="text" placeholder="${placeholder}" class="flex-1 px-3 py-2 rounded-lg bg-gray-900/60 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"/>
            <button type="button" onclick="deleteOption(this)" class="text-red-400/60 hover:text-red-400 transition">
                <i class="fa-solid fa-xmark text-xs"></i>
            </button>
        </div>
    `;
}

function deleteOption(btn) {
    const list = btn.closest(".options");
    if (list.children.length <= 3) {
        alert("MCQ must have at least 2 options");
        return;
    }
    btn.parentElement.remove();
}

// ── Add question ──────────────────────────────────────────────────────────────
function addQuestion() {
    questionCount++;

    const q = document.createElement("div");
    q.className = "p-5 rounded-xl bg-white/5 border border-white/10 transition-all duration-200";
    q.dataset.id = questionCount;
    q.draggable  = true;

    q.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <div class="flex items-center gap-2">
                <span class="text-gray-600 hover:text-gray-400 transition cursor-grab active:cursor-grabbing px-1 no-lock">
                    <i class="fa-solid fa-grip-vertical text-xs"></i>
                </span>
                <h3 class="font-semibold text-xs text-gray-400 uppercase tracking-widest">Question ${questionCount}</h3>
            </div>
            <button onclick="this.closest('div[data-id]').remove(); renumberQuestions()" class="text-red-400/60 hover:text-red-400 transition no-lock">
                <i class="fa-solid fa-trash text-xs"></i>
            </button>
        </div>

        <input type="text" placeholder="Question text" class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white mb-3"/>

        <select onchange="handleTypeChange(this)" class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white mb-3">
            <option value="text">Short Text</option>
            <option value="textarea">Long Text (Paragraph)</option>
            <option value="number">Number</option>
            <option value="email">Email Address</option>
            <option value="date">Date</option>
            <option value="mcq">Multiple Choice (MCQ)</option>
        </select>

        <div class="options hidden mt-1 p-3 rounded-lg bg-white/[0.03] border border-white/10 space-y-1"></div>

        <label class="flex items-center gap-2 text-sm text-gray-400 accent-emerald-600 mt-3">
            <input type="checkbox"> Required
        </label>
    `;

    document.getElementById("questions").appendChild(q);
    initDragOnCard(q);
    renumberQuestions();

    setTimeout(() => {
        work_area.scrollTo({ top: work_area.scrollHeight, behavior: "smooth" });
    }, 10);
}

// ── Preview ───────────────────────────────────────────────────────────────────
function previewForm() {
    const title       = document.getElementById('form_title')?.value.trim() || 'Form Preview';
    const description = document.getElementById('form_desc')?.value.trim()  || '';
    const tc          = document.getElementById('theme_color')?.value || 'emerald';

    // Collect questions from DOM
    const questions = [];
    let qId = 1;
    document.querySelectorAll('#questions > div[data-id]').forEach(q => {
        const text     = q.querySelector("input[type='text']")?.value.trim() || `Question ${qId}`;
        const type     = q.querySelector('select')?.value || 'text';
        const required = q.querySelector("input[type='checkbox']")?.checked || false;

        const options = [];
        if (type === 'mcq') {
            q.querySelectorAll('.options input[type="text"]').forEach((opt, i) => {
                if (opt.value.trim()) options.push({ question_id: qId, option_id: i + 1, option_text: opt.value.trim() });
            });
        }
        questions.push({ question_id: qId, question_text: text, question_type: type, is_required: required ? 1 : 0, _options: options });
        qId++;
    });

    const allOptions = questions.flatMap(q => q._options);

    // Theme colours (mirror fillForm.js)
    let titleColor = 'text-emerald-400', btnColor = 'bg-gradient-to-br from-emerald-500 to-emerald-700',
        borderTopColor = 'border-t-emerald-500', glowClass = 'shadow-[0_0_40px_rgba(16,185,129,0.15)]';
    if (tc === 'indigo') { titleColor='text-indigo-400'; btnColor='bg-gradient-to-br from-indigo-500 to-indigo-700'; borderTopColor='border-t-indigo-500'; glowClass='shadow-[0_0_40px_rgba(99,102,241,0.15)]'; }
    else if (tc === 'rose')  { titleColor='text-rose-400';  btnColor='bg-gradient-to-br from-rose-500 to-rose-700';   borderTopColor='border-t-rose-500';  glowClass='shadow-[0_0_40px_rgba(244,63,94,0.15)]'; }
    else if (tc === 'amber') { titleColor='text-amber-400'; btnColor='bg-gradient-to-br from-amber-500 to-amber-700'; borderTopColor='border-t-amber-500'; glowClass='shadow-[0_0_40px_rgba(245,158,11,0.15)]'; }

    const questionsHtml = questions.length
        ? questions.map(q => renderQuestion(q, allOptions, tc)).join('')
        : `<p class="text-gray-500 text-center py-8">No questions added yet.</p>`;

    const existing = document.getElementById('preview_modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'preview_modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="document.getElementById('preview_modal').remove()"></div>
        <div class="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-gray-950/80 border border-white/10 border-t-8 ${borderTopColor} ${glowClass} mx-4 p-10">
            <div class="flex justify-between items-center mb-6">
                <span class="text-xs text-amber-400/80 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <i class="fa-solid fa-eye text-[10px]"></i> Preview Mode
                </span>
                <button onclick="document.getElementById('preview_modal').remove()" class="text-gray-400 hover:text-white transition w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <h3 class="text-3xl font-bold mb-3 ${titleColor}">${title}</h3>
            <p class="text-gray-300 mb-8 leading-relaxed">${description}</p>
            <div class="space-y-6">${questionsHtml}</div>
            <div class="mt-8">
                <button disabled class="w-full text-white/40 font-bold py-3 px-4 rounded-xl ${btnColor} opacity-30 cursor-not-allowed">
                    Submit Response  ·  Preview Only
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ── Show form code modal ──────────────────────────────────────────────────────
function showFormCodeModal(code) {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50";
    modal.innerHTML = `
        <div class="relative w-full max-w-md mx-4 rounded-3xl bg-gray-900/90 backdrop-blur-xl border border-white/10 shadow-2xl p-8 text-center">
            <button id="closeBtn" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition">
                <i class="fa-solid fa-xmark"></i>
            </button>
            
            <h2 class="text-2xl font-bold text-emerald-400 mb-2">Form Created</h2>
            <p class="text-gray-400 text-sm mb-6">Share this code with participants</p>
            
            <div class="bg-gray-800/50 border border-emerald-500/30 rounded-2xl p-5 mb-6 select-all cursor-pointer hover:border-emerald-500/50 transition">
                <div class="text-3xl font-mono font-bold text-emerald-300 tracking-widest">${code}</div>
            </div>
            
            <button id="copyBtn" class="w-40 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition">
                <i class="fa-solid fa-copy mr-2"></i>Copy Code
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('copyBtn').addEventListener('click', function() {
        copyCode(code);
        this.innerHTML = '<i class="fa-solid fa-check mr-2"></i>Copied!';
        this.classList.add('!bg-emerald-700');
        setTimeout(() => {
            this.innerHTML = '<i class="fa-solid fa-copy mr-2"></i>Copy Code';
            this.classList.remove('!bg-emerald-700');
        }, 2000);
    });
    
    document.getElementById('closeBtn').addEventListener('click', function() {
        modal.remove();
    });
}

// ── Save / update form ────────────────────────────────────────────────────────
function saveForm() {
    const deadlineRaw   = document.getElementById("deadline").value;
    const deadline      = deadlineRaw ? new Date(deadlineRaw).toISOString() : "";
    const access_type   = document.getElementById("access_type").value;
    const theme_color   = document.getElementById("theme_color").value;
    const allow_multiple = document.getElementById("allow_multiple").checked ? 'yes' : 'no';
    const isEdit        = !!window.editingFormId;
    const isLocked      = window.editHasResponses;

    const userData   = JSON.parse(localStorage.getItem("ff_user") || "null");
    const userRole   = userData?.role || 'student';
    const isStudent  = userRole === 'student';

    const target_dept_id = ['dept','dept_batch','dept_role'].includes(access_type)
        ? (isStudent ? userData?.deptId : document.getElementById("target_dept_id").value) || null : null;
    const target_role = ['role','dept_role'].includes(access_type)
        ? document.getElementById("target_role").value || null : null;
    const target_batch = ['batch','dept_batch'].includes(access_type)
        ? (isStudent ? userData?.batch : document.getElementById("target_batch").value) || null : null;

    if (!deadline) { alert("Please set a deadline"); return; }

    // Validate deadline is not in the past
    const now = new Date().toISOString();
    
    if (deadline <= now) {
        alert("Deadline cannot be in the past. Please select a future date and time.");
        return;
    }


    const form = {
        title:         document.getElementById("form_title").value.trim(),
        description:   document.getElementById("form_desc").value.trim(),
        access_type, target_dept_id, target_role, target_batch,
        deadline, theme: theme_color, questions: []
    };

    if (!form.title) { alert("Add a title to save the Form"); return; }

    // Only collect questions if they're not locked
    if (!isLocked) {
        if (!hasAtLeastOneQuestion()) { alert("Add at least one question to save the Form"); return; }

        document.querySelectorAll("#questions > div[data-id]").forEach(q => {
            const question_text = q.querySelector("input[type='text']").value.trim();
            const type          = q.querySelector("select").value;
            const required      = q.querySelector("input[type='checkbox']").checked;
            if (!question_text) return;

            const question = { text: question_text, type, required, options: [] };
            if (type === 'mcq') {
                q.querySelectorAll(".options input[type='text']").forEach(opt => {
                    if (opt.value.trim()) question.options.push(opt.value.trim());
                });
                if (question.options.length < 2) { alert("MCQ must have at least 2 options"); return; }
            }
            form.questions.push(question);
        });
    }

    if (isEdit) {
        // ── Edit mode: PUT ──────────────────────────────────────────────────
        fetch(`/forms/${window.editingFormId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: form.title, description: form.description,
                access_type: form.access_type,
                target_dept_id: form.target_dept_id,
                target_role: form.target_role,
                target_batch: form.target_batch,
                deadline: form.deadline, theme: form.theme,
                allow_multiple, questions: form.questions, user_id: userId
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.questionsLocked) {
                showBanner('<i class="fa-solid fa-clipboard mr-2"></i>Form metadata updated. Questions were kept unchanged (form has existing responses).', 'amber');
            } else {
                showBanner('<i class="fa-solid fa-check mr-2"></i>Form updated successfully!', 'emerald');
            }
            setTimeout(() => goMyForms(), 1500);
        })
        .catch(() => alert("Failed to update form"));
    } else {
        // ── Create mode: POST ───────────────────────────────────────────────
        fetch("/forms/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: form.title, description: form.description,
                access_type: form.access_type,
                target_dept_id: form.target_dept_id,
                target_role: form.target_role,
                target_batch: form.target_batch,
                deadline: form.deadline, theme: form.theme,
                allow_multiple, questions: form.questions, creator_id: userId
            })
        })
        .then(res => res.json())
        .then(data => {
            showFormCodeModal(data.form_code); 
            setTimeout(() => goCreateForm(), 1500);
        });
    }
}

function showBanner(message, color = 'emerald') {
    const existing = document.getElementById('save_banner');
    if (existing) existing.remove();
    const colors = {
        emerald: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
        amber:   'bg-amber-500/20   border-amber-500/30   text-amber-300'
    };
    const banner = document.createElement('div');
    banner.id = 'save_banner';
    banner.className = `fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl border text-sm font-medium shadow-xl ${colors[color] || colors.emerald}`;
    banner.innerHTML = message;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 3000);
}

// ── AI Generate Panel (from template gallery) ─────────────────────────────────
function showAIGeneratePanel() {
    work_area.className = "glass-bg flex-1 !overflow-y-auto p-3 md:p-8 lg:p-12 m-1 md:m-4 lg:m-8";
    work_area.innerHTML = `
        <div class="relative z-10 max-w-2xl mx-auto">
            <div class="flex items-center gap-4 mb-8">
                <button onclick="goCreateForm()" class="text-gray-400 hover:text-white transition w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                    <h2 class="text-3xl font-bold text-violet-400 flex items-center gap-3">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Generate with AI
                    </h2>
                    <p class="text-gray-400 text-sm mt-1">Describe your form and AI will build it for you.</p>
                </div>
            </div>

            <div class="p-6 rounded-2xl bg-white/5 border border-violet-500/20">
                <label class="text-sm text-gray-400 mb-2 block">Describe your form</label>
                <textarea id="ai_description" rows="4" placeholder="e.g. A course feedback form for students to rate faculty teaching quality, course difficulty, and provide suggestions..."
                    class="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white
                           placeholder-gray-500 focus:outline-none focus:border-violet-500/50
                           resize-none text-sm mb-4"></textarea>

                <div class="flex items-center gap-4 mb-4">
                    <label class="text-sm text-gray-400">Number of questions:</label>
                    <select id="ai_num_questions"
                        class="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm">
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5" selected>5</option>
                        <option value="6">6</option>
                        <option value="7">7</option>
                        <option value="8">8</option>
                        <option value="9">9</option>
                        <option value="10">10</option>
                        <option value="12">12</option>
                        <option value="14">14</option>
                        <option value="16">16</option>
                        <option value="18">18</option>
                        <option value="20">20</option>
                    </select>
                </div>

                <p id="ai_error" class="text-red-400 text-sm mb-3 hidden"></p>

                <button id="ai_generate_btn" onclick="runAIGenerate()"
                    class="w-full px-6 py-3 rounded-full font-semibold text-sm transition-all bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25">
                    <i class="fa-solid fa-wand-magic-sparkles mr-2"></i> Generate Form
                </button>
            </div>

            <div id="ai_preview" class="hidden mt-6 p-6 rounded-2xl bg-white/5 border border-violet-500/20">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-white font-semibold">Generated Questions</h3>
                    <button onclick="useGeneratedForm()"
                        class="quick-btn text-sm px-4 py-2">
                        <i class="fa-solid fa-check mr-1"></i> Use This Form
                    </button>
                </div>
                <div id="ai_questions_preview" class="space-y-2"></div>
            </div>
        </div>
    `;
}

async function runAIGenerate() {
    const description   = document.getElementById('ai_description').value.trim();
    const num_questions = document.getElementById('ai_num_questions').value;
    const errEl         = document.getElementById('ai_error');
    const btn           = document.getElementById('ai_generate_btn');

    errEl.classList.add('hidden');

    if (!description) {
        errEl.textContent = 'Please describe your form first.';
        errEl.classList.remove('hidden');
        return;
    }

    btn.disabled  = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Generating...';

    try {
        const res  = await fetch('/ai/generate-form', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ description, num_questions: Number(num_questions) })
        });
        const data = await res.json();

        if (!res.ok) {
            errEl.textContent = data.message || 'Generation failed. Try again.';
            errEl.classList.remove('hidden');
            return;
        }

        // Store generated questions globally
        window._aiGeneratedQuestions = data.questions;

        // Show preview
        const preview = document.getElementById('ai_preview');
        const list    = document.getElementById('ai_questions_preview');
        preview.classList.remove('hidden');

        const typeIcon = { text:'font', textarea:'align-left', number:'hashtag', email:'envelope', date:'calendar', mcq:'list-ul' };

        list.innerHTML = data.questions.map((q, i) => `
            <div class="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <span class="text-violet-400 text-xs mt-1 w-5 flex-shrink-0">
                    <i class="fa-solid fa-${typeIcon[q.type] || 'circle-dot'}"></i>
                </span>
                <div class="min-w-0">
                    <p class="text-white text-sm">${q.text} ${q.required ? '<span class="text-red-400">*</span>' : ''}</p>
                    <p class="text-gray-500 text-xs mt-0.5">${q.type}${q.options ? ` · ${q.options.join(', ')}` : ''}</p>
                </div>
            </div>
        `).join('');

    } catch(e) {
        errEl.textContent = 'Connection error. Please try again.';
        errEl.classList.remove('hidden');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-2"></i> Regenerate';
    }
}

async function useGeneratedForm() {
    const questions = window._aiGeneratedQuestions;
    if (!questions?.length) return;

    // Initialize blank form builder then populate with AI questions
    await initFormBuilder();

    // Clear the default empty question
    document.getElementById('questions').innerHTML = '';
    questionCount = 0;

    // Add each AI-generated question
    for (const q of questions) {
        addQuestion();
        const qDivs    = document.querySelectorAll('#questions > div[data-id]');
        const currentQ = qDivs[qDivs.length - 1];

        currentQ.querySelector("input[type='text']").value    = q.text;
        currentQ.querySelector("input[type='checkbox']").checked = q.required;

        const typeSelect = currentQ.querySelector('select');
        typeSelect.value = q.type;
        typeSelect.dispatchEvent(new Event('change'));

        if (q.type === 'mcq' && Array.isArray(q.options)) {
            const optContainer = currentQ.querySelector('.options');
            optContainer.innerHTML = '';
            q.options.forEach(opt => {
                optContainer.insertAdjacentHTML('beforeend', createOptionHTML());
                const inputs = currentQ.querySelectorAll('.options input[type="text"]');
                inputs[inputs.length - 1].value = opt;
            });
            optContainer.insertAdjacentHTML('beforeend', `
                <button type="button" onclick="addOption(this)" class="block mx-auto text-emerald-400 text-sm mt-3 add-option-btn">
                    <i class="fa-solid fa-plus"></i> Add Option
                </button>
            `);
        }
    }

    showBanner('<i class="fa-solid fa-wand-magic-sparkles mr-2"></i> AI questions loaded! Review and publish.', 'emerald');
}

// ── AI Suggest (from inside form builder) ─────────────────────────────────────
async function generateQuestionsAI() {
    const title = document.getElementById('form_title')?.value.trim();
    const desc  = document.getElementById('form_desc')?.value.trim();

    const description = [title, desc].filter(Boolean).join(' — ') || '';

    if (!description) {
        showBanner('<i class="fa-solid fa-triangle-exclamation mr-2"></i> Add a title or description first so AI knows what to generate.', 'amber');
        return;
    }

    // Show inline loading state
    const btn = document.querySelector('button[onclick="generateQuestionsAI()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...'; }

    try {
        const existingCount = document.querySelectorAll('#questions > div[data-id]').length;
        const num           = Math.max(3, 6 - existingCount); // suggest up to 6 total

        const res  = await fetch('/ai/generate-form', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ description, num_questions: num })
        });
        const data = await res.json();

        if (!res.ok) {
            showBanner(`<i class="fa-solid fa-circle-exclamation mr-2"></i> ${data.message}`, 'amber');
            return;
        }

        // Append generated questions to existing ones
        for (const q of data.questions) {
            addQuestion();
            const qDivs    = document.querySelectorAll('#questions > div[data-id]');
            const currentQ = qDivs[qDivs.length - 1];

            currentQ.querySelector("input[type='text']").value       = q.text;
            currentQ.querySelector("input[type='checkbox']").checked = q.required;

            const typeSelect = currentQ.querySelector('select');
            typeSelect.value = q.type;
            typeSelect.dispatchEvent(new Event('change'));

            if (q.type === 'mcq' && Array.isArray(q.options)) {
                const optContainer = currentQ.querySelector('.options');
                optContainer.innerHTML = '';
                q.options.forEach(opt => {
                    optContainer.insertAdjacentHTML('beforeend', createOptionHTML());
                    const inputs = currentQ.querySelectorAll('.options input[type="text"]');
                    inputs[inputs.length - 1].value = opt;
                });
                optContainer.insertAdjacentHTML('beforeend', `
                    <button type="button" onclick="addOption(this)" class="block mx-auto text-emerald-400 text-sm mt-3 add-option-btn">
                        <i class="fa-solid fa-plus"></i> Add Option
                    </button>
                `);
            }
        }

        showBanner(`<i class="fa-solid fa-wand-magic-sparkles mr-2"></i> Added ${data.questions.length} AI-suggested questions!`, 'emerald');

    } catch(e) {
        showBanner('<i class="fa-solid fa-circle-exclamation mr-2"></i> AI generation failed. Please try again.', 'amber');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Suggest'; }
    }
}