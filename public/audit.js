async function goAuditLogs() {
    work_area.className = "glass-bg flex-1 p-4 md:p-8 !overflow-y-auto";
    work_area.innerHTML = `
        <div class="relative z-10 h-full flex flex-col">
            <div class="flex justify-between items-center mb-6 flex-wrap gap-3">
                <h2 class="text-2xl font-bold text-white font-mono">
                    <i class="fa-solid fa-terminal mr-2 text-emerald-400"></i>Audit Terminal
                </h2>
                <button onclick="goAuditLogs()" class="text-sm px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition text-gray-300">
                    <i class="fa-solid fa-rotate-right mr-1"></i> Refresh
                </button>
            </div>
            <div class="bg-[#0a0a0a] border border-white/10 rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden shadow-2xl">
                <!-- Mac-like Terminal Header -->
                <div class="bg-white/5 border-b border-white/10 px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
                    <div class="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div class="w-3 h-3 rounded-full bg-amber-500/80"></div>
                    <div class="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                    <span class="ml-3 text-xs text-gray-500 font-mono tracking-wider">audit_stream.log</span>
                </div>
                <div class="p-2 md:p-4 font-mono text-sm flex-1 overflow-y-auto" id="audit_terminal">
                    <p class="text-emerald-500/50 mb-3 animate-pulse">Connecting to audit stream...</p>
                </div>
            </div>
        </div>
    `;

    try {
        const res = await fetch(`/forms/audit-logs?user_id=${userId}`);
        const data = await res.json();
        
        const terminal = document.getElementById("audit_terminal");
        
        if (!res.ok) {
            terminal.innerHTML = `<p class="text-red-400">Server Error: ${data.message || 'Access Denied'}</p>`;
            return;
        }
        
        if (!data || data.length === 0) {
            terminal.innerHTML = `<p class="text-gray-500">No audit events yet.</p>`;
            return;
        }

        const actionColor = (type) => {
            if (!type) return 'text-gray-300';
            if (type.includes('CREATED') || type.includes('ADDED'))    return 'text-blue-400';
            if (type.includes('SUBMITTED'))                             return 'text-emerald-400';
            if (type.includes('REMOVED') || type.includes('DELETED'))  return 'text-red-400';
            if (type.includes('SUSPENDED'))                             return 'text-amber-400';
            if (type.includes('IMPORT'))                                return 'text-cyan-400';
            return 'text-gray-300';
        };

        terminal.innerHTML = data.map(log => `
            <div class="py-3 border-b border-white/5 hover:bg-white/5 transition px-3 flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4">
                <!-- Date & User (Line 1 on Mobile) -->
                <div class="flex items-center justify-between md:justify-start md:gap-4 md:w-[310px] flex-shrink-0">
                    <span class="text-gray-500 text-[10px] md:text-xs font-mono whitespace-nowrap md:w-[170px] flex-shrink-0">
                        [${new Date(log.log_time).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })}]
                    </span>
                    <span class="text-amber-300/80 font-semibold text-[11px] md:text-xs md:w-28 truncate flex-shrink-0 text-right md:text-left">
                        ${log.user_name ? `usr_${log.user_name}` : 'SYSTEM'}
                    </span>
                </div>
                <!-- Action & Target (Line 2 on Mobile) -->
                <div class="flex items-center gap-2 md:gap-4 flex-1 min-w-0 mt-0.5 md:mt-0">
                    <span class="${actionColor(log.action_type)} font-bold text-[11px] md:text-xs md:w-44 flex-shrink-0">
                        ${log.action_type || 'UNKNOWN'}
                    </span>
                    <span class="text-gray-400 italic text-[11px] md:text-xs flex-1 truncate">
                        <span class="md:hidden text-gray-600"><i class="fa-solid fa-angles-right mr-1"></i> </span>${log.form_title || log.metadata || '—'}
                    </span>
                </div>
            </div>
        `).join('');
        
    } catch(e) {
        console.error("Frontend Fetch Error:", e);
        document.getElementById("audit_terminal").innerHTML = `<p class="text-red-500">UI Render Failed. Check browser console for details.</p>`;
    }
}