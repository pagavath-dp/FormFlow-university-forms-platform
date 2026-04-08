async function goAuditLogs() {
    work_area.className = "glass-bg flex-1 overflow-hidden p-8 m-8 flex flex-col";
    work_area.innerHTML = `
        <div class="flex justify-between items-center mb-6 flex-shrink-0">
            <h2 class="text-3xl font-bold text-emerald-400 font-mono tracking-tight cursor-default flex items-center gap-3">
                <i class="fa-solid fa-terminal"></i> Database Audit Terminal
            </h2>
            <button onclick="goAuditLogs()" class="text-sm px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition text-gray-300">
                <i class="fa-solid fa-rotate-right"></i> Refresh Stream
            </button>
        </div>
        
        <div class="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 font-mono text-sm flex-1 overflow-y-auto min-h-0" id="audit_terminal">
            <p class="text-emerald-500/50 mb-4 animate-pulse">Establishing secure connection to Oracle Audit Engine...</p>
        </div>
    `;

    try {
        const res = await fetch(`/forms/audit-logs?user_id=${userId}`);
        const data = await res.json();
        
        const terminal = document.getElementById("audit_terminal");
        terminal.innerHTML = '';
        
        if (!res.ok) {
            terminal.innerHTML = `<p class="text-red-400">Server Error: ${data.message || 'Access Denied'}</p>`;
            return;
        }
        
        if (!data || data.length === 0) {
            terminal.innerHTML = `<p class="text-gray-500">No logs found. Awaiting events...</p>`;
            return;
        }

        let html = '';
        data.forEach(log => {
            const time = new Date(log.LOG_TIME).toLocaleString();
            let color = 'text-gray-300';
            
            if (log.ACTION_TYPE && log.ACTION_TYPE.includes("CREATED")) color = 'text-indigo-400';
            else if (log.ACTION_TYPE && log.ACTION_TYPE.includes("SUBMITTED")) color = 'text-emerald-400';
            
            html += `
                <div class="flex items-center gap-4 py-2 border-b border-white/5 hover:bg-white/5 transition px-2">
                    <span class="text-gray-500 whitespace-nowrap w-44 flex-shrink-0">[${time}]</span>
                    <span class="text-amber-300/80 uppercase font-semibold w-36 flex-shrink-0 truncate">usr_${log.USER_NAME || 'SYSTEM'}</span>
                    <span class="${color} font-bold w-44 flex-shrink-0 tracking-wider">${log.ACTION_TYPE || 'UNKNOWN'}</span>
                    <span class="text-gray-400 italic flex-1 truncate">${log.FORM_TITLE || '-'}</span>
                </div>
            `;
        });
        terminal.innerHTML = html;
        
    } catch(e) {
        console.error("Frontend Fetch Error:", e);
        document.getElementById("audit_terminal").innerHTML = `<p class="text-red-500">UI Render Failed. Check browser console for details.</p>`;
    }
}
