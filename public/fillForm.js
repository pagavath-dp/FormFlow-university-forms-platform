// Fill a Form
function goFillForm() {
    work_area.className = "glass-bg flex-1 flex flex-col p-3 md:p-8 lg:p-12 m-1 md:m-4 lg:m-8 !overflow-y-auto";
    work_area.innerHTML = `
        <div class="content-card my-auto mx-auto w-full max-w-2xl transition-all duration-300" style="height: fit-content;">

        <h2 id="fill_form_title" class="text-3xl font-bold text-emerald-400 mb-6"> Fill a Form </h2>

        <div class="flex gap-3 mb-6" id="form_code_area">
            <input id="form_code_input" placeholder="Enter Form Code (e.g. FF-8K3X9Q)" class="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white"/>

            <button onclick="loadFormByCode()" class="quick-btn"> Load </button>
        </div>

        <div id="fill_form_area"></div>

        </div>
    `;
}

async function loadFormByCode() {
    
    const code = document.getElementById("form_code_input").value.trim();
    const area = document.getElementById("fill_form_area");
    const form_code_area = document.getElementById("form_code_area");

    if (!code) {
        alert("Please enter a form code");
        return;
    }

    const userId = JSON.parse(localStorage.getItem("ff_user") || "null")?.id;
    const res = await fetch(`/forms/code/${code}?user_id=${userId}`);
    const data = await res.json();

    if (!res.ok) {
        area.innerHTML = `<p class="text-red-400 mt-4">${data.message}</p>`;
        return;
    }

    // Hide the input fields on success
    form_code_area.classList.add("hidden");
    const titleEl = document.getElementById("fill_form_title");
    if (titleEl) titleEl.classList.add("hidden");

    renderFillForm(data);
}

async function submitResponse(e, formId) {
    e.preventDefault();
    e.stopPropagation();
    const answers = [];

    document.querySelectorAll("[name^='q_']").forEach(input => {

        if (input.type === "radio") {
            if (!input.checked) return;

            answers.push({
                question_id: Number(input.name.replace("q_", "")),
                option_id: Number(input.value),
                answer_text: null
            });

        } else {
            if (!input.value.trim()) return;

            answers.push({
                question_id: Number(input.name.replace("q_", "")),
                option_id: null,
                answer_text: input.value.trim()
            });
        }
    });

    const res = await fetch("/responses/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            form_id: Number(formId),
            user_id: Number(userId),
            answers
        })
    });

    const data = await res.json();

    if (!data.success) {
        // Show beautiful card for already-submitted case
        if (data.error_code === "ALREADY_SUBMITTED") {
            showAlreadySubmittedCard();
            return;
        }
        // Generic error
        const area = document.getElementById("fill_form_area");
        area.innerHTML = `<div class="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3">
            <i class="fa-solid fa-circle-exclamation text-xl"></i>
            <span>${data.message}</span>
        </div>`;
        return;
    }

    // Success — show a nice card instead of alert
    showSuccessCard();
    return false;
}

function showAlreadySubmittedCard() {
    const card = document.querySelector(".content-card");
    if (card) {
        card.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-center">
                <div class="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-5">
                    <i class="fa-solid fa-clock-rotate-left text-amber-400 text-3xl"></i>
                </div>
                <h3 class="text-2xl font-bold text-amber-400 mb-2">Already Submitted</h3>
                <p class="text-gray-400 mb-6 max-w-sm">You've already submitted a response for this form. Only one submission is allowed per person.</p>
                <button onclick="goFillForm()" class="quick-btn secondary">
                    <i class="fa-solid fa-arrow-left mr-2"></i> Try Another Form
                </button>
            </div>
        `;
    }
}

function showSuccessCard() {
    const card = document.querySelector(".content-card");
    if (card) {
        card.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-center">
                <div class="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-5 animate-bounce">
                    <i class="fa-solid fa-check text-emerald-400 text-3xl"></i>
                </div>
                <h3 class="text-2xl font-bold text-emerald-400 mb-2">Response Submitted!</h3>
                <p class="text-gray-400 mb-6 max-w-sm">Your response has been recorded successfully. Thank you!</p>
                <button onclick="goFillForm()" class="quick-btn secondary">
                    <i class="fa-solid fa-arrow-left mr-2"></i> Fill Another Form
                </button>
            </div>
        `;
    }
}

function renderFillForm(data) {
    const { form, questions, options } = data;
    const area = document.getElementById("fill_form_area");

    const tc = form.theme_color?.toLowerCase()?.trim() || 'emerald';
    
    let titleColor = "text-emerald-400";
    let btnColor = "bg-gradient-to-br from-emerald-500 to-emerald-700";
    let borderTopColor = "border-t-emerald-500";
    let glowClass = "shadow-[0_0_40px_rgba(16,185,129,0.15)]";
    
    if(tc === 'indigo') { 
        titleColor="text-indigo-400"; btnColor="bg-gradient-to-br from-indigo-500 to-indigo-700"; 
        borderTopColor="border-t-indigo-500"; glowClass="shadow-[0_0_40px_rgba(99,102,241,0.15)]";
    }
    else if(tc === 'rose') { 
        titleColor="text-rose-400"; btnColor="bg-gradient-to-br from-rose-500 to-rose-700"; 
        borderTopColor="border-t-rose-500"; glowClass="shadow-[0_0_40px_rgba(244,63,94,0.15)]";
    }
    else if(tc === 'amber') { 
        titleColor="text-amber-400"; btnColor="bg-gradient-to-br from-amber-500 to-amber-700"; 
        borderTopColor="border-t-amber-500"; glowClass="shadow-[0_0_40px_rgba(245,158,11,0.15)]";
    }

    const card = area.parentElement;
    card.className = `content-card my-auto mx-auto w-full max-w-2xl transition-all duration-500 border-t-8 ${borderTopColor} ${glowClass}`;

    area.innerHTML = `
        <h3 class="text-3xl font-bold mb-3 mt-6 ${titleColor}">${form.title}</h3>
        <p class="text-gray-300 mb-8 leading-relaxed">${form.description || ""}</p>

        <form onsubmit="submitResponse(event, ${form.form_id})" class="space-y-6"> 
            ${questions.map(q => renderQuestion(q, options, tc)).join("")}
            <button type="submit" class="w-full text-white font-bold py-3 px-4 rounded-xl shadow-lg transition transform hover:-translate-y-1 ${btnColor}">
                Submit Response
            </button>
        </form>
    `;
}

function renderQuestion(q, options, tc) {
    let focusRing = "focus:ring-emerald-500";
    let accentBtn = "accent-emerald-500";
    let qBorder = "border-l-emerald-500";

    if(tc === 'indigo') { focusRing="focus:ring-indigo-500"; accentBtn="accent-indigo-500"; qBorder="border-l-indigo-500"; }
    else if(tc === 'rose') { focusRing="focus:ring-rose-500"; accentBtn="accent-rose-500"; qBorder="border-l-rose-500"; }
    else if(tc === 'amber') { focusRing="focus:ring-amber-500"; accentBtn="accent-amber-500"; qBorder="border-l-amber-500"; }

    let html = `
        <div class="p-6 rounded-xl bg-white/5 border border-white/10 border-l-4 ${qBorder} shadow-sm transition-all duration-300 hover:bg-white/10">
        <label class="block mb-4 font-semibold text-lg text-white"> 
            ${q.question_text} ${q.is_required ? '<span class="text-red-500">*</span>' : ''} 
        </label>
    `;

    if (q.question_type === "text") {
        html += `<input type="text" name="q_${q.question_id}" placeholder="Enter your answer..." class="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 transition ${focusRing}" ${q.is_required ? "required" : ""} />`;
    }

    if (q.question_type === "textarea") {
        html += `<textarea name="q_${q.question_id}" placeholder="Enter your answer..." rows="4" class="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 transition resize-none ${focusRing}" ${q.is_required ? "required" : ""}></textarea>`;
    }

    if (q.question_type === "email") {
        html += `<input type="email" name="q_${q.question_id}" placeholder="you@example.com" class="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 transition ${focusRing}" ${q.is_required ? "required" : ""} />`;
    }

    if (q.question_type === "date") {
        html += `<input type="date" name="q_${q.question_id}" class="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 transition ${focusRing} [color-scheme:dark]" ${q.is_required ? "required" : ""} />`;
    }

    if (q.question_type === "number") {
        html += `<input type="number" name="q_${q.question_id}" placeholder="Enter a number..." class="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:ring-2 transition ${focusRing}"
            ${q.is_required ? "required" : ""} />`;
    }

    if (q.question_type === "mcq") {
        options
        .filter(o => o.question_id === q.question_id)
        .forEach(o => {
            html += `
                <label class="flex items-center gap-3 my-3 text-gray-300 cursor-pointer hover:text-white transition">
                    <input type="radio" name="q_${q.question_id}" value="${o.option_id}" ${q.is_required ? "required" : ""} class="${accentBtn} w-5 h-5 transition"/> 
                    <span class="text-base">${o.option_text}</span>
                </label>
            `;
        });
    }

    html += `</div>`;
    return html;
}