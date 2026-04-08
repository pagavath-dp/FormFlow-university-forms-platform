// ── goCreateForm ──────────────────────────────────────────────────────────────
async function goCreateForm() {
    window.editingFormId = null;
    work_area.className = "glass-bg flex-1 !overflow-y-auto p-12 m-8";
    work_area.innerHTML = `<h2 class="text-3xl font-bold text-white mb-6">Loading Templates...</h2>`;

    try {
        const res = await fetch('/forms/get-templates');
        const templates = await res.json();
        
        let galleryHtml = `
            <div class="mb-10 text-center">
                <h2 class="text-4xl font-bold text-white mb-4">Start a New Form</h2>
                <p class="text-gray-400">Choose a pre-made template below or start from scratch.</p>
            </div>
            <div class="grid grid-cols-4 gap-6 max-w-6xl mx-auto">
                <!-- Blank Form Card -->
                <div onclick="initFormBuilder()" class="p-8 rounded-3xl bg-white/5 border-2 border-dashed border-white/20 hover:border-emerald-400/50 hover:bg-white/10 cursor-pointer transition text-center flex flex-col items-center justify-center min-h-[220px] group">
                    <div class="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 group-hover:bg-emerald-500/30 transition">
                        <i class="fa-solid fa-plus"></i>
                    </div>
                    <h3 class="text-xl font-bold text-white">Blank Form</h3>
                </div>
        `;
        
        templates.forEach(t => {
            galleryHtml += `
                <div onclick="initFormBuilder(${t.TEMPLATE_ID})" class="p-8 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 hover:border-indigo-400/50 cursor-pointer transition text-left relative overflow-hidden group min-h-[220px] flex flex-col items-start justify-end">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-indigo-500/30 transition"></div>
                    <i class="fa-solid fa-file-lines text-3xl text-indigo-400/50 mb-auto"></i>
                    <h3 class="text-xl font-bold text-indigo-300 relative z-10">${t.NAME}</h3>
                    <p class="text-gray-400 text-sm mt-2 relative z-10 w-full line-clamp-2">${t.DESCRIPTION || ''}</p>
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
function initFormBuilder(templateId = null, editData = null) {
    work_area.className = "glass-bg flex-1 !overflow-y-auto p-12 m-8";
    questionCount = 0;
    window.editingFormId = editData ? editData.form.FORM_ID : null;
    window.editHasResponses = editData ? editData.hasResponses : false;

    const isEdit   = !!editData;
    const isLocked = isEdit && editData.hasResponses;
    const pageTitle   = isEdit ? 'Edit Form' : (templateId ? 'Template Editor' : 'Create New Form');
    const saveLabel   = isEdit ? 'Save Changes' : 'Publish Form';
    const saveIcon    = isEdit ? 'fa-floppy-disk' : 'fa-floppy-disk';
    const backAction  = isEdit ? 'goMyForms()' : 'goCreateForm()';

    work_area.innerHTML = `
        <div class="grid grid-cols-[2fr_1fr] gap-x-12 items-start">

            <!-- LEFT: FORM BUILDER -->
            <div class="pt-4 w-[90%]">
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
            <div class="w-full self-start mt-24">

                <h3 class="text-lg font-semibold text-emerald-400 mb-4">
                    Form Settings
                </h3>

                <label class="text-sm text-gray-400">Access Type</label>
                <select id="access_type" onchange="handleAccessTypeChange()"
                    class="w-full mt-2 mb-4 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white cursor-pointer">
                    <option value="public">Public</option>
                    <option value="group">Specific Group</option>
                </select>

                <div id="group_settings" class="hidden">
                    <select id="target_dept"
                        class="w-full mt-2 mb-4 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white">
                        <option value="" disabled selected>Select department</option>
                        <option value="CSE">Computer Science</option>
                        <option value="ECE">Electronics</option>
                        <option value="EEE">Electrical</option>
                        <option value="MECH">Mechanical</option>
                        <option value="CIVIL">Civil</option>
                        <option value="IT">Information Technology</option>
                    </select>
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

    // ── Set deadline min ──────────────────────────────────────────────────────
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById("deadline").min = now.toISOString().slice(0, 16);

    // ── Load from template ────────────────────────────────────────────────────
    if (templateId && window.loadedTemplates) {
        const tmpl = window.loadedTemplates.find(t => t.TEMPLATE_ID === templateId);
        if (tmpl && tmpl.STRUCTURE) {
            document.getElementById("form_title").value = tmpl.NAME;
            document.getElementById("form_desc").value = tmpl.DESCRIPTION || '';
            try {
                const questions = JSON.parse(tmpl.STRUCTURE);
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
        document.getElementById("form_title").value = f.TITLE || '';
        document.getElementById("form_desc").value  = f.DESCRIPTION || '';

        // Format deadline for datetime-local
        if (f.DEADLINE) {
            const d = new Date(f.DEADLINE);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            document.getElementById("deadline").value = d.toISOString().slice(0, 16);
        }

        document.getElementById("access_type").value = f.ACCESS_TYPE || 'public';
        handleAccessTypeChange();
        if (f.TARGET_DEPT) {
            const td = document.getElementById("target_dept");
            if (td) td.value = f.TARGET_DEPT;
        }
        document.getElementById("theme_color").value    = f.THEME_COLOR || 'emerald';
        document.getElementById("allow_multiple").checked = f.ALLOW_MULTIPLE === 'yes';

        // Load questions
        editData.questions.forEach(q => {
            addQuestion();
            const qDivs   = document.querySelectorAll("#questions > div[data-id]");
            const currentQ = qDivs[qDivs.length - 1];

            currentQ.querySelector("input[type='text']").value    = q.QUESTION_TEXT;
            currentQ.querySelector("input[type='checkbox']").checked = q.IS_REQUIRED === 1;

            const qtypeSelect = currentQ.querySelector("select");
            qtypeSelect.value = q.QUESTION_TYPE;
            qtypeSelect.dispatchEvent(new Event('change'));

            if (q.QUESTION_TYPE === 'mcq') {
                const optContainer = currentQ.querySelector(".options");
                optContainer.innerHTML = '';
                const qOptions = editData.options.filter(o => o.QUESTION_ID === q.QUESTION_ID);
                qOptions.forEach(opt => {
                    optContainer.insertAdjacentHTML("beforeend", createOptionHTML());
                    const optInputs = currentQ.querySelectorAll(".options input[type='text']");
                    optInputs[optInputs.length - 1].value = opt.OPTION_TEXT;
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
    const type = document.getElementById("access_type").value;
    const groupDiv = document.getElementById("group_settings");
    if (type === "group") {
        groupDiv.classList.remove("hidden");
    } else {
        groupDiv.classList.add("hidden");
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
                if (opt.value.trim()) options.push({ QUESTION_ID: qId, OPTION_ID: i + 1, OPTION_TEXT: opt.value.trim() });
            });
        }
        questions.push({ QUESTION_ID: qId, QUESTION_TEXT: text, QUESTION_TYPE: type, IS_REQUIRED: required ? 1 : 0, _options: options });
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
    modal.className = "fixed inset-0 flex items-center justify-center bg-black/60 z-50";
    modal.innerHTML = `
        <div class="bg-gray-900 p-8 rounded-2xl shadow-2xl text-center w-[400px] border border-gray-700">
            <h2 class="text-2xl font-bold text-emerald-400 mb-4">Form Created</h2>
            <p class="text-gray-400 mb-4">Share this code to collect responses:</p>
            <div class="bg-gray-800 border border-gray-700 px-4 py-3 rounded-lg text-lg font-mono select-all cursor-pointer">
                ${code}
            </div>
            <button onclick="copyCode('${code}')" 
                class="mt-4 bg-emerald-500 px-4 py-2 rounded-lg font-semibold">
                Copy
            </button>
            <button onclick="this.closest('.fixed').remove()" 
                class="mt-3 block text-gray-400 hover:text-white">
                Close
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

// ── Save / update form ────────────────────────────────────────────────────────
function saveForm() {
    const deadline      = document.getElementById("deadline").value;
    const access_type   = document.getElementById("access_type").value;
    const theme_color   = document.getElementById("theme_color").value;
    const allow_multiple = document.getElementById("allow_multiple").checked ? 'yes' : 'no';
    const isEdit        = !!window.editingFormId;
    const isLocked      = window.editHasResponses;

    let target_dept = null;
    if (access_type === "group") target_dept = document.getElementById("target_dept").value;

    if (!deadline) { alert("Please set a deadline"); return; }

    const form = {
        title:       document.getElementById("form_title").value.trim(),
        description: document.getElementById("form_desc").value.trim(),
        access_type, target_dept, deadline, theme: theme_color, questions: []
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
                access_type: form.access_type, target_dept: form.target_dept,
                deadline: form.deadline, theme: form.theme,
                allow_multiple, questions: form.questions, user_id: userId
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.questionsLocked) {
                showBanner('📋 Form metadata updated. Questions were kept unchanged (form has existing responses).', 'amber');
            } else {
                showBanner('✅ Form updated successfully!', 'emerald');
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
                access_type: form.access_type, target_dept: form.target_dept,
                deadline: form.deadline, theme: form.theme,
                allow_multiple, questions: form.questions, creator_id: userId
            })
        })
        .then(res => res.json())
        .then(data => { showFormCodeModal(data.form_code); });
        goCreateForm();
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
    banner.textContent = message;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 3000);
}