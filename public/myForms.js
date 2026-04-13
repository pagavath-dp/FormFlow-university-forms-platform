function goMyForms() {
    work_area.className = "glass-bg flex-1 overflow-hidden p-3 md:p-8 m-1 md:m-4 lg:m-8";
    work_area.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-6 gap-4 lg:gap-6 h-full lg:overflow-hidden overflow-y-auto">

            <!-- LEFT: Forms -->
            <div class="lg:col-span-3 overflow-y-auto pr-1 md:pr-3 pl-1 flex flex-col min-h-0">
                <div class="flex items-center justify-between mb-4 flex-shrink-0">
                    <h2 class="text-2xl font-bold text-emerald-400">My Forms</h2>
                    <div class="relative">
                        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none"></i>
                        <input id="form_search" type="text" placeholder="Search forms..."
                            oninput="filterForms(this.value)"
                            class="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 w-48"/>
                    </div>
                </div>
                <div id="forms_list" class="space-y-3 pb-4 flex-1 overflow-y-auto"></div>
            </div>

            <!-- RIGHT: Responses -->
            <div class="lg:col-span-3 overflow-y-auto pr-1 md:pr-3 pl-1">
                <h2 class="text-2xl font-bold text-emerald-400 mb-4">Responses</h2>
                <div id="responses_area" class="text-gray-400 pb-4">
                    Select a form to view responses
                </div>
            </div>

        </div>
    `;

    loadMyForms();
}

function copyCode(code) {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code)
            .then(() => alert("Form code copied: " + code))
            .catch(() => fallbackCopy(code));
    } else {
        // Fallback for older browsers and mobile
        fallbackCopy(code);
    }
}

function fallbackCopy(code) {
    // Create temporary input element
    const input = document.createElement('textarea');
    input.value = code;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    
    // Select and copy
    input.select();
    try {
        document.execCommand('copy');
        alert("Form code copied: " + code);
    } catch (e) {
        alert("Copy failed. Form code: " + code);
    }
    
    // Clean up
    document.body.removeChild(input);
}

async function loadMyForms() {
    const userId = JSON.parse(localStorage.getItem("ff_user") || "null")?.id;
    const res = await fetch(`/forms/myforms?user_id=${userId}`);
    const data = await res.json();

    const container = document.getElementById("forms_list");

    if (!res.ok) {
        container.innerHTML = `<p class="text-red-400">${data.message}</p>`;
        return;
    }

    if (data.length === 0) {
        container.innerHTML = `<p class="text-gray-400">No forms created yet.</p>`;
        return;
    }

    window.allFormsData = data;
    container.innerHTML = data.map(f => renderFormCard(f)).join("");
}

function filterForms(query) {
    const all = window.allFormsData || [];
    const q   = query.toLowerCase().trim();
    const filtered = q ? all.filter(f => f.title.toLowerCase().includes(q)) : all;
    const container = document.getElementById("forms_list");
    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-sm">No forms match "${query}".</p>`;
    } else {
        container.innerHTML = filtered.map(f => renderFormCard(f)).join("");
    }
}

async function toggleStatus(formId) {
    const res = await fetch("/forms/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: formId })
    });

    const data = await res.json();
    alert(data.message);

    loadMyForms(); // refresh
}


function renderFormCard(f) {
    const deadline   = new Date(f.deadline);
    const createDate = new Date(f.created_at);
    return `
        <div onclick="selectForm(${f.form_id})"
            class="p-4 rounded-xl border cursor-pointer transition
            bg-white/5 border-white/10 hover:bg-white/10">

            <!-- HEADER -->
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="text-white font-semibold">${f.title}</p>
                    <p class="text-gray-400 text-xs">${f.form_code}</p>
                </div>
                <span class="text-xs px-2 py-1 rounded-xl ${
                    f.status === "open"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                }">
                    ${f.status}
                </span>
            </div>

            <!-- DESCRIPTION -->
            <p class="text-gray-400 text-sm mb-3 line-clamp-2">
                ${f.description || "No description"}
            </p>

            <!-- ACCESS INFO -->
            <p class="text-gray-400 text-sm mb-1">
                ${f.access_type === "public" ? "Public Form" : `${f.access_type} · ${f.target_dept_name || 'All'}`}
            </p>

            <!-- Dates -->
            <p class="text-gray-500 text-xs mb-1">Created: ${createDate.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
            <p class="text-gray-500 text-xs mb-3">Deadline: ${deadline.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>

            <!-- ACTIONS -->
            <div class="flex gap-2 flex-wrap">

                <button onclick="event.stopPropagation(); copyCode('${f.form_code}');" class="text-xs px-3 py-1 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                    Copy Code
                </button>

                <button onclick="event.stopPropagation(); toggleStatus(${f.form_id})" class="text-xs px-3 py-1 rounded-xl
                    ${f.status === "open" ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" : "bg-green-500/20 text-green-400 hover:bg-green-500/30"}">
                    ${f.status === "open" ? "Close Form" : "Open Form"}
                </button>

                <button onclick="event.stopPropagation(); generateReport(${f.form_id})"
                    class="text-xs px-3 py-1 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">
                    Report
                </button>

                <button onclick="event.stopPropagation(); aiAnalyze(${f.form_id})"
                    class="text-xs px-3 py-1 rounded-xl bg-violet-500/20 text-violet-400 hover:bg-violet-500/30">
                    <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>AI Insights
                </button>

                <button onclick="event.stopPropagation(); toggleReport(${f.form_id})"
                    class="text-xs px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30">
                    ${f.report_released === "yes" ? "Hide Report" : "Release Report"}
                </button>

                <button onclick="event.stopPropagation(); editForm(${f.form_id})"
                    class="text-xs px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                    <i class="fa-solid fa-pen-to-square mr-1"></i>Edit
                </button>

                <button onclick="event.stopPropagation(); deleteForm(${f.form_id})"
                    class="text-xs px-3 py-1 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30">
                    <i class="fa-solid fa-trash mr-1"></i>Delete
                </button>

            </div>

        </div>
    `;
}

async function toggleReport(formId) {
    const res = await fetch("/forms/toggle-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: formId })
    });

    const data = await res.json();
    alert(data.message);

    loadMyForms();
}

async function selectForm(formId) {
    const res = await fetch(`/responses/form/${formId}`);
    const data = await res.json();

    renderResponsesSide(data);
}

async function generateReport(formId) {
    const res = await fetch(`/responses/report/${formId}?user_id=${userId}`);
    const data = await res.json();

    if (!res.ok) {
        alert(data.message);
        return;
    }

    renderReport(data);
}

function renderReport(data, containerId = "responses_area") {
    const { questions, answers, options, access_type } = data;
    const area = document.getElementById(containerId);

    let html = `<div class="space-y-4">`;

    const totalResponses = new Set(answers.map(a => a.response_id)).size;

    window.currentReportData = data;

    html += `
        <div class="p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
            <p class="text-white text-lg font-semibold">
                Total Responses: ${totalResponses}
            </p>
            <button onclick="exportCurrentReportToCSV()" class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition text-sm flex items-center gap-2">
                <i class="fa-solid fa-download"></i> Export CSV
            </button>
        </div>
    `;

    if (access_type?.toLowerCase() === "public") {

        const responseDept = {};

        answers.forEach(a => {
            if (!responseDept[a.response_id]) {
                responseDept[a.response_id] = a.department || "Unknown";
            }
        });

        const deptCount = {};

        Object.values(responseDept).forEach(dept => {
            deptCount[dept] = (deptCount[dept] || 0) + 1;
        });

        const entries = Object.entries(deptCount);

        if (entries.length > 0) {
            const maxDept = entries.reduce((a, b) => a[1] > b[1] ? a : b);
            const minDept = entries.reduce((a, b) => a[1] < b[1] ? a : b);

            html += `
                <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p class="text-white font-semibold mb-2">Department Insights</p>

                    <p class="text-green-400 text-sm">
                        Highest: ${maxDept[0]} (${maxDept[1]})
                    </p>

                    <p class="text-red-400 text-sm">
                        Lowest: ${minDept[0]} (${minDept[1]})
                    </p>
                </div>
            `;
        }
    }

    questions.forEach(q => {

        html += `
            <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                <p class="text-white font-semibold mb-2">${q.question_text}</p>
        `;

        if (q.question_type === "mcq") {

            const counts = {};

            options
                .filter(o => o.question_id === q.question_id)
                .forEach(o => counts[o.option_text] = 0);

            answers
                .filter(a => a.question_id === q.question_id)
                .forEach(a => {
                    const opt = options.find(o => o.option_id === a.selected_option_id);
                    if (opt) counts[opt.option_text]++;
                });

            // Store chart data globally dynamically so we can render them after DOM updates
            if (!window.chartDataMap) window.chartDataMap = {};
            window.chartDataMap[`chart_${q.question_id}`] = counts;

            html += `
                <div class="h-48 w-full mt-4 flex justify-center">
                    <canvas id="chart_${q.question_id}"></canvas>
                </div>
            `;

        } else if (q.question_type === "number") {

            const nums = answers
                .filter(a => a.question_id === q.question_id && a.answer_number !== null)
                .map(a => a.answer_number);

            if (nums.length > 0) {
                const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
                const min = Math.min(...nums);
                const max = Math.max(...nums);

                html += `<p class="text-gray-300 text-sm">Average: ${avg}</p>`;
                html += `<p class="text-gray-300 text-sm">Minimum: ${min}</p>`;
                html += `<p class="text-gray-300 text-sm">Maximum: ${max}</p>`;
            } else {
                html += `<p class="text-gray-400 text-sm">No responses</p>`;
            }

        } else {
            html += `<p class="text-gray-400 text-sm">Text responses collected</p>`;
        }

        html += `</div>`;
    });

    html += `</div>`;
    area.innerHTML = html;

    // Render Charts
    if (window.chartDataMap) {
        Object.keys(window.chartDataMap).forEach(chartId => {
            const ctx = document.getElementById(chartId);
            if (ctx) {
                const data = window.chartDataMap[chartId];
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(data),
                        datasets: [{
                            data: Object.values(data),
                            backgroundColor: [
                                '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'
                            ],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: { color: '#cbd5e1' }
                            }
                        }
                    }
                });
            }
        });
        window.chartDataMap = {}; // clear map after render
    }
}

function renderResponsesSide(data) {
    const { responses, answers, questions } = data;
    const area = document.getElementById("responses_area");

    if (!responses || responses.length === 0) {
        area.innerHTML = `<p class="text-gray-500">No responses yet.</p>`;
        return;
    }

    // Store for search filtering
    window._currentResponses = { responses, answers, questions };

    const qMap = {};
    questions.forEach(q => { qMap[q.question_id] = q.question_text; });

    function buildResponsesHTML(list) {
        return list.map(r => {
            const ans         = answers.filter(a => a.response_id === r.response_id);
            const submittedAt = new Date(r.submitted_at);
            return `
                <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div class="flex justify-between items-center text-emerald-400 font-semibold mb-2">
                        <span>${r.name}</span>
                        <span class="text-xs font-normal text-gray-500">${submittedAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                    </div>
                    ${ans.map(a => `
                        <div class="mb-2">
                            <p class="text-gray-400 text-xs mb-0.5">${qMap[a.question_id] || ''}</p>
                            <p class="text-white text-sm">${a.answer_text ?? a.answer_number ?? a.option_text ?? '-'}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');
    }

    area.innerHTML = `
        <div class="relative mb-3">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none"></i>
            <input id="resp_search" type="text" placeholder="Search by name..."
                oninput="filterResponses(this.value)"
                class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"/>
        </div>
        <div id="resp_list" class="space-y-3 pb-4">${buildResponsesHTML(responses)}</div>
    `;
}

function filterResponses(query) {
    if (!window._currentResponses) return;
    const { responses, answers, questions } = window._currentResponses;
    const q = query.toLowerCase().trim();
    const filtered = q ? responses.filter(r => r.name.toLowerCase().includes(q)) : responses;

    const qMap = {};
    questions.forEach(q => { qMap[q.question_id] = q.question_text; });

    const list = document.getElementById('resp_list');
    if (!list) return;
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-sm">No responses match "${query}".</p>`;
        return;
    }
    list.innerHTML = filtered.map(r => {
        const ans         = answers.filter(a => a.response_id === r.response_id);
        const submittedAt = new Date(r.submitted_at);
        return `
            <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                <div class="flex justify-between items-center text-emerald-400 font-semibold mb-2">
                    <span>${r.name}</span>
                    <span class="text-xs font-normal text-gray-500">${submittedAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                </div>
                ${ans.map(a => `
                    <div class="mb-2">
                        <p class="text-gray-400 text-xs mb-0.5">${qMap[a.question_id] || ''}</p>
                        <p class="text-white text-sm">${a.answer_text ?? a.answer_number ?? a.option_text ?? '-'}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

function exportCurrentReportToCSV() {
    if (!window.currentReportData) return;

    const { questions, answers, options, responses } = window.currentReportData;

    // Group answers by RESPONSE_ID
    const responsesMap = {};
    
    // First setup the base dictionary from responses array if it exists (for individual responses tab)
    if (responses) {
        responses.forEach(r => {
            responsesMap[r.response_id] = {
                ResponseID: r.response_id,
                RespondentName: r.name || "Unknown",
                SubmittedDate: new Date(r.submitted_at).toLocaleString()
            };
        });
    }

    answers.forEach(a => {
        if (!responsesMap[a.response_id]) {
            responsesMap[a.response_id] = {
                ResponseID: a.response_id,
                RespondentName: "Anonymous",
                SubmittedDate: "Unknown"
            };
        }
        
        // Also capture department if it's there
        if (a.department) {
            responsesMap[a.response_id].UserDept = a.department;
        }
        
        let val = a.answer_text ?? a.answer_number ?? a.option_text ?? "";
        if (a.selected_option_id && !a.option_text && options) {
            const opt = options.find(o => o.option_id === a.selected_option_id);
            if (opt) val = opt.option_text;
        }

        const qIdx = questions.findIndex(q => q.question_id === a.question_id);
        if (qIdx !== -1) {
            responsesMap[a.response_id][`Q${qIdx + 1}`] = val;
        }
    });

    // Create Headers
    let csvStr = "Response ID,Respondent Name,Submission Date";
    
    // Some forms have department logging tracked in the answers array payload
    const hasDept = Object.values(responsesMap).some(r => r.UserDept);
    if (hasDept) {
        csvStr += ",Department";
    }

    questions.forEach((q, i) => {
        const header = q.question_text.replace(/"/g, '""');
        csvStr += `,"${header}"`;
    });
    csvStr += "\n";

    // Create Data Rows
    Object.values(responsesMap).forEach(r => {
        csvStr += `${r.ResponseID},"${r.RespondentName}","${r.SubmittedDate}"`;
        if (hasDept) {
            csvStr += `,"${r.UserDept || ''}"`;
        }
        
        questions.forEach((q, i) => {
            let val = r[`Q${i + 1}`] || "";
            val = String(val).replace(/"/g, '""');
            csvStr += `,"${val}"`;
        });
        csvStr += "\n";
    });

    // Download blob
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Form_Report_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ── Edit form ─────────────────────────────────────────────────────────────────
async function editForm(formId) {
    const userId = JSON.parse(localStorage.getItem("ff_user") || "null")?.id;
    const res  = await fetch(`/forms/${formId}/edit?user_id=${userId}`);
    const data = await res.json();

    if (!res.ok) {
        alert(data.message || "Failed to load form for editing");
        return;
    }

    // Switch to the form builder in edit mode
    setActive(document.querySelector('.nav-btn'));   // deselect nav highlight
    initFormBuilder(null, data);
}

// ── Delete form ───────────────────────────────────────────────────────────────
function deleteForm(formId) {
    const form      = window.allFormsData?.find(f => f.form_id === formId);
    const formTitle = form?.title || 'this form';
    // Remove existing modal if any
    const existing = document.getElementById('delete_modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'delete_modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"
             onclick="document.getElementById('delete_modal').remove()"></div>

        <div id="delete_modal_card"
             class="relative z-10 w-full max-w-[380px] mx-4 bg-gray-900/90 border border-white/10 rounded-2xl p-8
                    shadow-[0_30px_80px_rgba(0,0,0,.7)] text-center
                    scale-95 opacity-0 transition-all duration-200 ease-out">

            <div class="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-5">
                <i class="fa-solid fa-trash text-red-400 text-2xl"></i>
            </div>

            <h3 class="text-xl font-bold text-white mb-2">Delete Form?</h3>
            <p class="text-gray-400 text-sm mb-2 leading-relaxed">
                You are about to permanently delete:
            </p>
            <p class="text-white font-semibold mb-6 px-4">"${formTitle}"</p>
            <p class="text-red-400/70 text-xs mb-7">
                <i class="fa-solid fa-triangle-exclamation mr-1"></i>
                All responses and data will be lost. This cannot be undone.
            </p>

            <div class="flex gap-3">
                <button onclick="document.getElementById('delete_modal').remove()"
                    class="flex-1 py-2.5 rounded-xl bg-white/6 border border-white/10
                           text-gray-300 hover:bg-white/10 transition text-sm font-medium">
                    Cancel
                </button>
                <button onclick="confirmDeleteForm(${formId})"
                    class="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30
                           text-red-400 hover:bg-red-500/30 transition text-sm font-semibold">
                    <i class="fa-solid fa-trash mr-1.5"></i> Delete
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => {
        document.getElementById('delete_modal_card').classList.remove('scale-95', 'opacity-0');
    });
}

async function confirmDeleteForm(formId) {
    const userId = JSON.parse(localStorage.getItem("ff_user") || "null")?.id;
    const res  = await fetch(`/forms/${formId}?user_id=${userId}`, { method: 'DELETE' });
    const data = await res.json();

    document.getElementById('delete_modal')?.remove();

    if (!res.ok) {
        alert(data.message || "Failed to delete form");
        return;
    }

    // Remove from cached data
    if (window.allFormsData) {
        window.allFormsData = window.allFormsData.filter(f => f.form_id !== formId);
    }

    // Fade out and remove card from DOM
    const cards = document.querySelectorAll('#forms_list > div');
    cards.forEach(card => {
        if (card.getAttribute('onclick')?.includes(formId)) {
            card.style.transition = 'opacity .3s, transform .3s';
            card.style.opacity    = '0';
            card.style.transform  = 'scale(0.96)';
            setTimeout(() => card.remove(), 300);
        }
    });

    // Clear responses panel
    const ra = document.getElementById('responses_area');
    if (ra) ra.innerHTML = `<p class="text-gray-500">Form deleted.</p>`;
}

// ── AI Response Analytics ─────────────────────────────────────────────────────
async function aiAnalyze(formId) {
    const area = document.getElementById('responses_area');
    if (!area) return;

    area.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 text-center">
            <div class="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mb-4 animate-pulse">
                <i class="fa-solid fa-wand-magic-sparkles text-violet-400 text-2xl"></i>
            </div>
            <p class="text-violet-400 font-semibold mb-1">Analyzing responses...</p>
            <p class="text-gray-500 text-sm">Gemini AI is reading through the data</p>
        </div>
    `;

    try {
        const userId = JSON.parse(localStorage.getItem("ff_user") || "null")?.id;
        const res    = await fetch(`/ai/analyze/${formId}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ user_id: userId })
        });
        const data = await res.json();

        if (!res.ok) {
            area.innerHTML = `
                <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <i class="fa-solid fa-circle-exclamation mr-2"></i>${data.message}
                </div>`;
            return;
        }

        const { overview, keyFindings, patterns, recommendations } = data.insights;

        const formatted = `
            <div class="mb-4">
                <p class="text-gray-300 text-sm leading-relaxed">${overview}</p>
            </div>
            
            <!-- Key Findings -->
            <div class="bg-white/5 border border-white/10 rounded-xl p-4">
                <h4 class="text-violet-400 font-semibold mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-chart-pie"></i> Key Findings
                </h4>
                <ul class="space-y-2">
                    ${(keyFindings || []).map(f => `<li class="text-gray-300 text-sm flex items-start gap-2"><i class="fa-solid fa-angle-right text-violet-500/50 mt-1 flex-shrink-0"></i> <span>${f}</span></li>`).join('')}
                </ul>
            </div>

            <!-- Notable Patterns -->
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 mt-4">
                <h4 class="text-emerald-400 font-semibold mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-microscope"></i> Notable Patterns
                </h4>
                <ul class="space-y-2">
                    ${(patterns || []).map(p => `<li class="text-gray-300 text-sm flex items-start gap-2"><i class="fa-solid fa-angle-right text-emerald-500/50 mt-1 flex-shrink-0"></i> <span>${p}</span></li>`).join('')}
                </ul>
            </div>

            <!-- Recommendations -->
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 mt-4">
                <h4 class="text-blue-400 font-semibold mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-lightbulb"></i> Recommendations
                </h4>
                <ul class="space-y-2">
                    ${(recommendations || []).map(r => `<li class="text-gray-300 text-sm flex items-start gap-2"><i class="fa-solid fa-angle-right text-blue-500/50 mt-1 flex-shrink-0"></i> <span>${r}</span></li>`).join('')}
                </ul>
            </div>
        `;

        area.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-wand-magic-sparkles text-violet-400"></i>
                        <span class="text-violet-400 font-semibold text-sm">AI Insights</span>
                        <span class="text-gray-500 text-xs">${data.total_responses} response${data.total_responses !== 1 ? 's' : ''} analyzed</span>
                    </div>
                    <button onclick="aiAnalyze(${formId})"
                        class="text-xs px-3 py-1 rounded-xl bg-white/5 border border-white/10
                               text-gray-400 hover:text-white hover:bg-white/10 transition">
                        <i class="fa-solid fa-rotate-right mr-1"></i>Refresh
                    </button>
                </div>
                <div class="p-5 rounded-xl bg-violet-500/5 border border-violet-500/20 shadow-lg">
                    ${formatted}
                </div>
                <p class="text-gray-600 text-xs text-center">
                    <i class="fa-solid fa-circle-info mr-1"></i>AI-generated insights may not be 100% accurate. Always verify with raw data.
                </p>
            </div>
        `;
    } catch(e) {
        area.innerHTML = `
            <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <i class="fa-solid fa-circle-exclamation mr-2"></i>Failed to connect. Please try again.
            </div>`;
    }
}