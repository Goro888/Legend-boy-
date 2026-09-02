# (Continuation of the AI Garm Flask Application code - Frontend Dashboard Template)

DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Garm - Autonomous Multi-Tool AI Agent</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        brand: {
                            50: '#fdf4f0',
                            500: '#f97316',
                            600: '#ea580c',
                            700: '#c2410c',
                        }
                    }
                }
            }
        }
    </script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans">

    <!-- Top Navigation Bar -->
    <header class="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
            <div class="bg-gradient-to-tr from-orange-600 to-amber-500 p-2.5 rounded-xl text-white shadow-lg shadow-orange-500/20">
                <i class="fa-solid fa-microchip text-xl"></i>
            </div>
            <div>
                <h1 class="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">AI Garm</h1>
                <p class="text-xs text-slate-400">Autonomous Regional Intelligence & Multi-Tool Agent</p>
            </div>
        </div>

        <div class="flex items-center space-x-4">
            <div id="status-badge" class="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-medium">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Systems Operational</span>
            </div>
            <select id="lang-select" class="bg-slate-800 border border-slate-700 rounded-lg text-xs px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500">
                <option value="ckb">کوردی (Sorani)</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
            </select>
        </div>
    </header>

    <!-- Main Workspace -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <!-- Sidebar Controls / Tools Status -->
        <div class="lg:col-span-1 space-y-6">
            <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
                    <span>Tool Registry</span>
                    <i class="fa-solid fa-toolbox text-slate-500"></i>
                </h2>
                <div id="tool-status-list" class="space-y-3">
                    <!-- Populated dynamically via JS -->
                    <div class="animate-pulse flex items-center justify-between text-xs text-slate-500 py-1">
                        <span>Loading tools status...</span>
                    </div>
                </div>
            </div>

            <!-- Quick Market Intelligence Widget -->
            <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Kurdistan Intel</span>
                    <i class="fa-solid fa-chart-line text-orange-500"></i>
                </h2>
                <div id="market-widget" class="text-xs space-y-2 text-slate-400">
                    <p>Fetching live currency and market metrics...</p>
                </div>
            </div>
        </div>

        <!-- Chat / Prompt Execution Panel -->
        <div class="lg:col-span-3 flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            
            <!-- Output Log Area -->
            <div id="chat-container" class="flex-1 p-6 overflow-y-auto space-y-4 max-h-[600px] min-h-[450px]">
                <div class="flex items-start space-x-3">
                    <div class="bg-orange-600/20 border border-orange-500/30 text-orange-400 p-2 rounded-lg mt-1">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 max-w-2xl text-sm leading-relaxed">
                        <p class="font-medium text-slate-200">Welcome to AI Garm Agent.</p>
                        <p class="text-slate-400 mt-1">Type a prompt below. Select tools manually or leave it on <span class="text-orange-400 font-semibold">Auto-Detect</span> to let Garm choose the right pipeline.</p>
                    </div>
                </div>
            </div>

            <!-- Input Controls Area -->
            <div class="p-4 border-t border-slate-800 bg-slate-900/90">
                <div class="flex flex-wrap gap-2 mb-3">
                    <span class="text-xs text-slate-400 self-center mr-2">Active Mode:</span>
                    <label class="inline-flex items-center text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full cursor-pointer hover:border-orange-500 transition">
                        <input type="checkbox" name="tool-toggle" value="auto" checked class="sr-only peer">
                        <span class="peer-checked:text-orange-400 font-medium">⚡ Auto Pipeline</span>
                    </label>
                    <label class="inline-flex items-center text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full cursor-pointer hover:border-orange-500 transition">
                        <input type="checkbox" name="tool-toggle" value="web_search" class="sr-only peer">
                        <span class="peer-checked:text-orange-400">🔍 Web Search</span>
                    </label>
                    <label class="inline-flex items-center text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full cursor-pointer hover:border-orange-500 transition">
                        <input type="checkbox" name="tool-toggle" value="image_gen" class="sr-only peer">
                        <span class="peer-checked:text-orange-400">🎨 Image Gen</span>
                    </label>
                    <label class="inline-flex items-center text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full cursor-pointer hover:border-orange-500 transition">
                        <input type="checkbox" name="tool-toggle" value="maps_search" class="sr-only peer">
                        <span class="peer-checked:text-orange-400">📍 Maps</span>
                    </label>
                </div>

                <div class="flex items-center space-x-3">
                    <textarea id="prompt-input" rows="1" placeholder="Ask AI Garm anything (e.g., 'Find car dealerships in Erbil' or 'شۆفێرێکی زیرەک')..." class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"></textarea>
                    <button id="send-btn" class="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white px-6 py-3 rounded-xl font-medium text-sm shadow-lg shadow-orange-600/20 transition flex items-center space-x-2">
                        <span>Execute</span>
                        <i class="fa-solid fa-paper-plane text-xs"></i>
                    </button>
                </div>
            </div>

        </div>

    </main>

    <!-- Client Script -->
    <script>
        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const container = document.getElementById('tool-status-list');
                container.innerHTML = '';
                
                for (const [key, info] of Object.entries(data)) {
                    const isOnline = info.status === 'online';
                    container.innerHTML += `
                        <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50">
                            <span class="text-slate-300 capitalize">${key.replace('_', ' ')}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-medium ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}">
                                ${info.label}
                            </span>
                        </div>
                    `;
                }
            } catch (err) {
                console.error("Failed to fetch status", err);
            }
        }

        async function fetchMarket() {
            try {
                const res = await fetch('/api/analytics/currency');
                const data = await res.json();
                const widget = document.getElementById('market-widget');
                widget.innerHTML = `
                    <div class="flex justify-between py-1 border-b border-slate-800">
                        <span class="text-slate-400">USD/IQD Rate:</span>
                        <span class="text-slate-200 font-semibold">${data.rate || '153,000'}</span>
                    </div>
                    <div class="flex justify-between py-1">
                        <span class="text-slate-400">Region:</span>
                        <span class="text-slate-200">Erbil / Sulaymaniyah</span>
                    </div>
                `;
            } catch (err) {
                document.getElementById('market-widget').innerHTML = '<span class="text-slate-500">Market data offline</span>';
            }
        }

        document.getElementById('send-btn').addEventListener('click', async () => {
            const input = document.getElementById('prompt-input');
            const prompt = input.value.trim();
            if (!prompt) return;

            const chat = document.getElementById('chat-container');
            const lang = document.getElementById('lang-select').value;

            // Gather selected tools
            const checkboxes = document.querySelectorAll('input[name="tool-toggle"]:checked');
            const tools = Array.from(checkboxes).map(cb => cb.value);

            // Append User Message
            chat.innerHTML += `
                <div class="flex items-start justify-end space-x-3">
                    <div class="bg-orange-600 text-white rounded-2xl p-4 max-w-2xl text-sm leading-relaxed shadow-lg">
                        <p>${prompt}</p>
                    </div>
                </div>
            `;
            input.value = '';
            chat.scrollTop = chat.scrollHeight;

            // Append Loading Indicator
            const loadingId = 'loading-' + Date.now();
            chat.innerHTML += `
                <div id="${loadingId}" class="flex items-start space-x-3">
                    <div class="bg-orange-600/20 border border-orange-500/30 text-orange-400 p-2 rounded-lg mt-1">
                        <i class="fa-solid fa-robot animate-spin"></i>
                    </div>
                    <div class="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 text-sm text-slate-400">
                        Processing autonomous workflow across modules...
                    </div>
                </div>
            `;
            chat.scrollTop = chat.scrollHeight;

            try {
                const response = await fetch('/api/agent', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ prompt, tools, lang })
                });
                const resData = await response.json();
                
                document.getElementById(loadingId).remove();

                if (resData.success) {
                    let resultsHtml = '';
                    for (const [tool, content] of Object.entries(resData.results)) {
                        resultsHtml += `
                            <div class="mb-3 last:mb-0 bg-slate-900/90 border border-slate-700/60 rounded-xl p-3">
                                <span class="text-[10px] uppercase tracking-wider font-bold text-orange-400 block mb-1">Tool: ${tool}</span>
                                <pre class="text-xs text-slate-300 whitespace-pre-wrap font-mono">${typeof content === 'object' ? JSON.stringify(content, null, 2) : content}</pre>
                            </div>
                        `;
                    }

                    chat.innerHTML += `
                        <div class="flex items-start space-x-3">
                            <div class="bg-orange-600/20 border border-orange-500/30 text-orange-400 p-2 rounded-lg mt-1">
                                <i class="fa-solid fa-robot"></i>
                            </div>
                            <div class="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 max-w-3xl w-full text-sm leading-relaxed space-y-2">
                                <p class="font-semibold text-slate-200">Execution Results:</p>
                                ${resultsHtml}
                            </div>
                        </div>
                    `;
                } else {
                    chat.innerHTML += `<div class="text-red-400 text-xs p-3 bg-red-500/10 rounded-xl">Error: ${resData.error}</div>`;
                }
            } catch (err) {
                document.getElementById(loadingId).remove();
                chat.innerHTML += `<div class="text-red-400 text-xs p-3 bg-red-500/10 rounded-xl">Network Error: ${err.message}</div>`;
            }
            chat.scrollTop = chat.scrollHeight;
        });

        // Initialize dashboard widgets on load
        fetchStatus();
        fetchMarket();
    </script>
</body>
</html>
"""
