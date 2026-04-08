function goMyForms() {
    work_area.className = "glass-bg flex-1 overflow-hidden p-8 m-8";
    work_area.innerHTML = `
        <div class="grid grid-cols-5 gap-6 h-full">

            <!-- LEFT: Forms -->
            <div class="col-span-3 overflow-y-auto pr-3 pl-1 flex flex-col min-h-0">
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
            <div class="col-span-2 overflow-y-auto pr-3 pl-1">
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
    navigator.clipboard.writeText(code);
    alert("Form code copied: " + code);
}

async function loadMyForms() {
    const params = new URLSearchParams(location.search);
    const userId = params.get("user_id");

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
    const filtered = q ? all.filter(f => f.TITLE.toLowerCase().includes(q)) : all;
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
    const deadline   = new Date(f.DEADLINE);
    const createDate = new Date(f.CREATED_AT);
    return `
        <div onclick="selectForm(${f.FORM_ID})"
            class="p-4 rounded-xl border cursor-pointer transition
            bg-white/5 border-white/10 hover:bg-white/10">

            <!-- HEADER -->
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="text-white font-semibold">${f.TITLE}</p>
                    <p class="text-gray-400 text-xs">${f.FORM_CODE}</p>
                </div>
                <span class="text-xs px-2 py-1 rounded-xl ${
                    f.STATUS === "open"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                }">
                    ${f.STATUS}
                </span>
            </div>

            <!-- DESCRIPTION -->
            <p class="text-gray-400 text-sm mb-3 line-clamp-2">
                ${f.DESCRIPTION || "No description"}
            </p>

            <!-- ACCESS INFO -->
            <p class="text-gray-400 text-sm mb-1">
                ${f.ACCESS_TYPE === "public" ? "Public Form" : `Department: ${f.TARGET_DEPT}`}
            </p>

            <!-- Dates -->
            <p class="text-gray-500 text-xs mb-1">Created: ${createDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p class="text-gray-500 text-xs mb-3">Deadline: ${deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>

            <!-- ACTIONS -->
            <div class="flex gap-2 flex-wrap">

                <button onclick="event.stopPropagation(); copyCode('${f.FORM_CODE}')" class="text-xs px-3 py-1 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                    Copy Code
                </button>

                <button onclick="event.stopPropagation(); toggleStatus(${f.FORM_ID})" class="text-xs px-3 py-1 rounded-xl
                    ${f.STATUS === "open" ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" : "bg-green-500/20 text-green-400 hover:bg-green-500/30"}">
                    ${f.STATUS === "open" ? "Close Form" : "Open Form"}
                </button>

                <button onclick="event.stopPropagation(); generateReport(${f.FORM_ID})"
                    class="text-xs px-3 py-1 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">
                    Report
                </button>

                <button onclick="event.stopPropagation(); toggleReport(${f.FORM_ID})"
                    class="text-xs px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30">
                    ${f.REPORT_RELEASED === "yes" ? "Hide Report" : "Release Report"}
                </button>

                <button onclick="event.stopPropagation(); editForm(${f.FORM_ID})"
                    class="text-xs px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                    <i class="fa-solid fa-pen-to-square mr-1"></i>Edit
                </button>

                <button onclick="event.stopPropagation(); deleteForm(${f.FORM_ID})"
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

    const totalResponses = new Set(answers.map(a => a.RESPONSE_ID)).size;

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
            if (!responseDept[a.RESPONSE_ID]) {
                responseDept[a.RESPONSE_ID] = a.DEPARTMENT || "Unknown";
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
                <p class="text-white font-semibold mb-2">${q.QUESTION_TEXT}</p>
        `;

        if (q.QUESTION_TYPE === "mcq") {

            const counts = {};

            options
                .filter(o => o.QUESTION_ID === q.QUESTION_ID)
                .forEach(o => counts[o.OPTION_TEXT] = 0);

            answers
                .filter(a => a.QUESTION_ID === q.QUESTION_ID)
                .forEach(a => {
                    const opt = options.find(o => o.OPTION_ID === a.SELECTED_OPTION_ID);
                    if (opt) counts[opt.OPTION_TEXT]++;
                });

            // Store chart data globally dynamically so we can render them after DOM updates
            if (!window.chartDataMap) window.chartDataMap = {};
            window.chartDataMap[`chart_${q.QUESTION_ID}`] = counts;

            html += `
                <div class="h-48 w-full mt-4 flex justify-center">
                    <canvas id="chart_${q.QUESTION_ID}"></canvas>
                </div>
            `;

        } else if (q.QUESTION_TYPE === "number") {

            const nums = answers
                .filter(a => a.QUESTION_ID === q.QUESTION_ID && a.ANSWER_NUMBER !== null)
                .map(a => a.ANSWER_NUMBER);

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
    questions.forEach(q => { qMap[q.QUESTION_ID] = q.QUESTION_TEXT; });

    function buildResponsesHTML(list) {
        return list.map(r => {
            const ans         = answers.filter(a => a.RESPONSE_ID === r.RESPONSE_ID);
            const submittedAt = new Date(r.SUBMITTED_AT);
            return `
                <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div class="flex justify-between items-center text-emerald-400 font-semibold mb-2">
                        <span>${r.NAME}</span>
                        <span class="text-xs font-normal text-gray-500">${submittedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    ${ans.map(a => `
                        <div class="mb-2">
                            <p class="text-gray-400 text-xs mb-0.5">${qMap[a.QUESTION_ID] || ''}</p>
                            <p class="text-white text-sm">${a.ANSWER_TEXT ?? a.ANSWER_NUMBER ?? a.OPTION_TEXT ?? '-'}</p>
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
    const filtered = q ? responses.filter(r => r.NAME.toLowerCase().includes(q)) : responses;

    const qMap = {};
    questions.forEach(q => { qMap[q.QUESTION_ID] = q.QUESTION_TEXT; });

    const list = document.getElementById('resp_list');
    if (!list) return;
    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-sm">No responses match "${query}".</p>`;
        return;
    }
    list.innerHTML = filtered.map(r => {
        const ans         = answers.filter(a => a.RESPONSE_ID === r.RESPONSE_ID);
        const submittedAt = new Date(r.SUBMITTED_AT);
        return `
            <div class="p-4 rounded-xl bg-white/5 border border-white/10">
                <div class="flex justify-between items-center text-emerald-400 font-semibold mb-2">
                    <span>${r.NAME}</span>
                    <span class="text-xs font-normal text-gray-500">${submittedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                ${ans.map(a => `
                    <div class="mb-2">
                        <p class="text-gray-400 text-xs mb-0.5">${qMap[a.QUESTION_ID] || ''}</p>
                        <p class="text-white text-sm">${a.ANSWER_TEXT ?? a.ANSWER_NUMBER ?? a.OPTION_TEXT ?? '-'}</p>
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
            responsesMap[r.RESPONSE_ID] = {
                ResponseID: r.RESPONSE_ID,
                RespondentName: r.NAME || "Unknown",
                SubmittedDate: new Date(r.SUBMITTED_AT).toLocaleString()
            };
        });
    }

    answers.forEach(a => {
        if (!responsesMap[a.RESPONSE_ID]) {
            responsesMap[a.RESPONSE_ID] = {
                ResponseID: a.RESPONSE_ID,
                RespondentName: "Anonymous",
                SubmittedDate: "Unknown"
            };
        }
        
        // Also capture department if it's there
        if (a.DEPARTMENT) {
            responsesMap[a.RESPONSE_ID].UserDept = a.DEPARTMENT;
        }
        
        let val = a.ANSWER_TEXT ?? a.ANSWER_NUMBER ?? a.OPTION_TEXT ?? "";
        if (a.SELECTED_OPTION_ID && !a.OPTION_TEXT && options) {
            const opt = options.find(o => o.OPTION_ID === a.SELECTED_OPTION_ID);
            if (opt) val = opt.OPTION_TEXT;
        }

        const qIdx = questions.findIndex(q => q.QUESTION_ID === a.QUESTION_ID);
        if (qIdx !== -1) {
            responsesMap[a.RESPONSE_ID][`Q${qIdx + 1}`] = val;
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
        const header = q.QUESTION_TEXT.replace(/"/g, '""');
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
    const params = new URLSearchParams(location.search);
    const userId = params.get("user_id");

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
    const form      = window.allFormsData?.find(f => f.FORM_ID === formId);
    const formTitle = form?.TITLE || 'this form';
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
             class="relative z-10 w-[380px] bg-gray-900/90 border border-white/10 rounded-2xl p-8
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
    const params = new URLSearchParams(location.search);
    const userId = params.get("user_id");

    const res  = await fetch(`/forms/${formId}?user_id=${userId}`, { method: 'DELETE' });
    const data = await res.json();

    document.getElementById('delete_modal')?.remove();

    if (!res.ok) {
        alert(data.message || "Failed to delete form");
        return;
    }

    // Remove from cached data
    if (window.allFormsData) {
        window.allFormsData = window.allFormsData.filter(f => f.FORM_ID !== formId);
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