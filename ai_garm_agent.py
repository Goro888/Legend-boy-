# AI Garm (AI گرم) — Free Autonomous Business Agent
## All-in-One Flask Application for Render / PythonAnywhere

"""
AI Garm — Kurdish Business Automation Agent
Free Tier Architecture:
  - Web Search:     DuckDuckGo (free, no API key)
  - Image Gen:      Replicate (free credits on signup)
  - Web Scrape:     BeautifulSoup (free)
  - Social Search:  SocialData.io (free tier, 100 credits)
  - Google Maps:    SerpAPI (free 100 queries/month)
  - TTS:            gTTS (free) + OpenAI TTS-1 (if API key available)
  - Workflow:       n8n (self-hosted free) or in-app workflow engine
  - Hosting:        Render free tier / PythonAnywhere free
"""

import os
import json
import requests
import urllib.parse
from flask import Flask, request, jsonify, render_template_string
from functools import wraps

# ============================================================
# CONFIGURATION — Set these as environment variables
# ============================================================
REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "")
SERPAPI_API_KEY = os.environ.get("SERPAPI_API_KEY", "")
SOCIALDATA_API_KEY = os.environ.get("SOCIALDATA_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
N8N_WEBHOOK_URL = os.environ.get("N8N_WEBHOOK_URL", "")

app = Flask(__name__)

# ============================================================
# HTML DASHBOARD (single-page UI)
# ============================================================
DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="ckb" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Garm — AI گرم</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            text-align: center;
            padding: 30px 0;
            border-bottom: 2px solid rgba(255,255,255,0.1);
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 3em;
            background: linear-gradient(90deg, #00d2ff, #3a7bd5);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header p { color: #aaa; font-size: 1.1em; margin-top: 10px; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid rgba(255,255,255,0.1);
            transition: transform 0.3s, box-shadow 0.3s;
        }
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .card h3 {
            font-size: 1.3em;
            margin-bottom: 15px;
            color: #00d2ff;
        }
        .card p { color: #ccc; font-size: 0.9em; line-height: 1.6; }
        .card .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            margin-top: 10px;
        }
        .status.online { background: #00c853; color: #fff; }
        .status.offline { background: #ff5252; color: #fff; }
        .status.partial { background: #ffd600; color: #000; }
        .input-section {
            background: rgba(255,255,255,0.05);
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .input-section textarea {
            width: 100%;
            padding: 15px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.2);
            background: rgba(0,0,0,0.3);
            color: #fff;
            font-size: 1em;
            min-height: 120px;
            resize: vertical;
        }
        .input-section textarea:focus { outline: none; border-color: #00d2ff; }
        .btn {
            padding: 12px 30px;
            border: none;
            border-radius: 10px;
            background: linear-gradient(90deg, #00d2ff, #3a7bd5);
            color: #fff;
            font-size: 1em;
            cursor: pointer;
            margin-top: 15px;
            transition: opacity 0.3s;
        }
        .btn:hover { opacity: 0.9; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .result-box {
            background: rgba(0,0,0,0.3);
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
            white-space: pre-wrap;
            font-size: 0.9em;
            max-height: 500px;
            overflow-y: auto;
            display: none;
        }
        .lang-selector {
            display: flex;
            gap: 10px;
            margin: 15px 0;
            justify-content: center;
        }
        .lang-btn {
            padding: 8px 20px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.2);
            background: transparent;
            color: #fff;
            cursor: pointer;
            transition: all 0.3s;
        }
        .lang-btn.active { background: #00d2ff; border-color: #00d2ff; }
        .tool-selector {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 15px 0;
        }
        .tool-chip {
            padding: 6px 16px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.2);
            background: transparent;
            color: #fff;
            cursor: pointer;
            font-size: 0.85em;
            transition: all 0.3s;
        }
        .tool-chip.active { background: #3a7bd5; border-color: #3a7bd5; }
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        .spinner {
            border: 3px solid rgba(255,255,255,0.1);
            border-top: 3px solid #00d2ff;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        footer {
            text-align: center;
            padding: 30px;
            color: #666;
            font-size: 0.85em;
        }
        .badge {
            display: inline-block;
            background: rgba(0,210,255,0.2);
            padding: 2px 10px;
            border-radius: 10px;
            font-size: 0.75em;
            color: #00d2ff;
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AI Garm — AI گرم</h1>
            <p>Kurdistan Autonomous AI Business Engine • بزوێنەری بازرگانی زیرەکی دەستکردی کوردستان</p>
            <div class="lang-selector">
                <button class="lang-btn active" onclick="setLang('ckb')">Sorani (سۆرانی)</button>
                <button class="lang-btn" onclick="setLang('bad')">Badini (بادینی)</button>
                <button class="lang-btn" onclick="setLang('ar')">Arabic (عربي)</button>
                <button class="lang-btn" onclick="setLang('en')">English</button>
            </div>
        </div>

        <div class="input-section">
            <h3>🎯 Agent Command</h3>
            <p style="color:#aaa;margin-bottom:15px;">Tell AI Garm what to do — search, generate, scrape, or analyze</p>
            <div class="tool-selector" id="toolSelector">
                <span class="tool-chip active" data-tool="web_search">🔍 Web Search</span>
                <span class="tool-chip" data-tool="image_gen">🎨 Generate Image</span>
                <span class="tool-chip" data-tool="web_scrape">📄 Scrape Website</span>
                <span class="tool-chip" data-tool="social_search">📱 Social Search</span>
                <span class="tool-chip" data-tool="maps_search">🗺️ Maps Search</span>
                <span class="tool-chip" data-tool="tts">🔊 Text to Speech</span>
                <span class="tool-chip" data-tool="auto">⚡ Auto (AI decides)</span>
            </div>
            <textarea id="promptInput" placeholder="Describe what you want AI Garm to do... e.g., 'Search for latest car prices in Erbil market' or 'Generate an image of a modern pharmacy in Duhok'"></textarea>
            <button class="btn" id="runBtn" onclick="runAgent()">🚀 Execute</button>
            <div class="loading" id="loading"><div class="spinner"></div><p style="margin-top:10px;color:#aaa;">AI Garm is thinking...</p></div>
            <div class="result-box" id="resultBox"></div>
        </div>

        <div class="grid" id="statusGrid">
            <div class="card">
                <h3>🔍 Web Search</h3>
                <p>Search the web using DuckDuckGo & Tavily. Get LLM-ready results.</p>
                <span class="status online" id="s-web_search">Online</span>
            </div>
            <div class="card">
                <h3>🎨 Image Generation (Flux)</h3>
                <p>Generate images using Flux models via Replicate API.</p>
                <span class="status partial" id="s-image_gen">API Key Needed</span>
            </div>
            <div class="card">
                <h3>📄 Web Scraper</h3>
                <p>Scrape any website content with BeautifulSoup. No API key needed.</p>
                <span class="status online" id="s-web_scrape">Online</span>
            </div>
            <div class="card">
                <h3>📱 Social Media Search</h3>
                <p>Search social platforms via SocialData.io API.</p>
                <span class="status partial" id="s-social_search">API Key Needed</span>
            </div>
            <div class="card">
                <h3>🗺️ Google Maps Search</h3>
                <p>Search businesses on Google Maps via SerpAPI.</p>
                <span class="status partial" id="s-maps_search">API Key Needed</span>
            </div>
            <div class="card">
                <h3>🔊 Text-to-Speech</h3>
                <p>Convert text to speech with gTTS (free) or OpenAI TTS.</p>
                <span class="status online" id="s-tts">Online</span>
            </div>
            <div class="card">
                <h3>⚡ Workflow Engine</h3>
                <p>Automate business workflows — n8n webhook compatible.</p>
                <span class="status partial" id="s-workflow">Configure</span>
            </div>
            <div class="card">
                <h3>📊 Business Analytics</h3>
                <p>Kurdistan market analysis, currency tracking, and reporting.</p>
                <span class="status online" id="s-analytics">Online</span>
            </div>
        </div>
        <footer>
            AI Garm v1.0 • Free Tier • Built for Kurdistan Region Businesses • 🏴 Erbil & Duhok
        </footer>
    </div>

    <script>
        let selectedTools = ['web_search'];
        let currentLang = 'ckb';

        document.querySelectorAll('.tool-chip').forEach(chip => {
            chip.addEventListener('click', function() {
                if (this.dataset.tool === 'auto') {
                    document.querySelectorAll('.tool-chip').forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    selectedTools = ['auto'];
                    return;
                }
                document.querySelector('[data-tool="auto"]').classList.remove('active');
                this.classList.toggle('active');
                selectedTools = Array.from(document.querySelectorAll('.tool-chip.active'))
                    .map(c => c.dataset.tool)
                    .filter(t => t !== 'auto');
                if (selectedTools.length === 0) {
                    document.querySelector('[data-tool="auto"]').classList.add('active');
                    selectedTools = ['auto'];
                }
            });
        });

        function setLang(lang) {
            currentLang = lang;
            document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');
        }

        async function runAgent() {
            const prompt = document.getElementById('promptInput').value.trim();
            if (!prompt) { alert('Please enter a command!'); return; }

            const btn = document.getElementById('runBtn');
            const loading = document.getElementById('loading');
            const resultBox = document.getElementById('resultBox');

            btn.disabled = true;
            loading.style.display = 'block';
            resultBox.style.display = 'none';

            try {
                const resp = await fetch('/api/agent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        tools: selectedTools,
                        lang: currentLang
                    })
                });
                const data = await resp.json();
                resultBox.textContent = JSON.stringify(data, null, 2);
                resultBox.style.display = 'block';
            } catch (err) {
                resultBox.textContent = 'Error: ' + err.message;
                resultBox.style.display = 'block';
            } finally {
                btn.disabled = false;
                loading.style.display = 'none';
            }
        }

        // Check API key status on load
        async function checkStatus() {
            try {
                const resp = await fetch('/api/status');
                const data = await resp.json();
                for (const [key, status] of Object.entries(data)) {
                    const el = document.getElementById('s-' + key);
                    if (el) {
                        el.className = 'status ' + status.status;
                        el.textContent = status.label;
                    }
                }
            } catch(e) {}
        }
        checkStatus();
    </script>
</body>
</html>
"""

# ============================================================
# CORE AGENT ENGINE
# ============================================================

class AgentTool:
    """Base class for all AI Garm tools"""
    name = ""
    description = ""

    def run(self, params):
        raise NotImplementedError


class WebSearchTool(AgentTool):
    name = "web_search"
    description = "Search the web for current information"

    def run(self, query, max_results=5):
        """Free DuckDuckGo search via the ddg library"""
        try:
            from duckduckgo_search import DDGS
            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=max_results):
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "snippet": r.get("body", "")
                    })
            return {"success": True, "results": results, "source": "duckduckgo"}
        except ImportError:
            # Fallback: use a free search API
            return self._fallback_search(query, max_results)
        except Exception as e:
            return {"success": False, "error": str(e), "source": "duckduckgo"}

    def _fallback_search(self, query, max_results):
        """Fallback using Tavily if key is available, or a simple scrape"""
        if TAVILY_API_KEY:
            try:
                resp = requests.post(
                    "https://api.tavily.com/search",
                    json={"api_key": TAVILY_API_KEY, "query": query, "max_results": max_results}
                )
                if resp.ok:
                    data = resp.json()
                    return {"success": True, "results": data.get("results", []), "source": "tavily"}
            except:
                pass
        # Last resort: simple Google scraping
        try:
            from googlesearch import search
            results = []
            for url in search(query, num_results=max_results):
                results.append({"url": url, "title": url, "snippet": ""})
            return {"success": True, "results": results, "source": "google_scrape"}
        except:
            return {"success": False, "error": "No search API available", "source": "none"}


class ImageGenTool(AgentTool):
    name = "image_gen"
    description = "Generate images using Flux AI models"

    def run(self, prompt, model="flux-schnell"):
        """Generate image via Replicate (Flux) or Hugging Face"""
        if not REPLICATE_API_TOKEN:
            return {"success": False, "error": "REPLICATE_API_TOKEN not set. Get free credits at replicate.com", "source": "replicate"}

        try:
            headers = {
                "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
                "Content-Type": "application/json"
            }

            model_map = {
                "flux-schnell": "black-forest-labs/flux-schnell",
                "flux-dev": "black-forest-labs/flux-dev",
                "flux-pro": "black-forest-labs/flux-pro"
            }
            model_id = model_map.get(model, model_map["flux-schnell"])

            payload = {
                "input": {
                    "prompt": prompt,
                    "num_outputs": 1,
                    "aspect_ratio": "1:1",
                    "output_format": "png"
                }
            }

            # Create prediction
            resp = requests.post(
                f"https://api.replicate.com/v1/models/{model_id}/predictions",
                headers=headers,
                json=payload
            )

            if not resp.ok:
                return {"success": False, "error": f"Replicate API error: {resp.text}", "source": "replicate"}

            prediction = resp.json()
            prediction_id = prediction["id"]

            # Poll for completion
            import time
            for _ in range(30):
                time.sleep(1)
                status_resp = requests.get(
                    f"https://api.replicate.com/v1/predictions/{prediction_id}",
                    headers=headers
                )
                if status_resp.ok:
                    status_data = status_resp.json()
                    if status_data["status"] == "succeeded":
                        return {
                            "success": True,
                            "image_url": status_data["output"][0] if isinstance(status_data["output"], list) else status_data["output"],
                            "source": "replicate/flux"
                        }
                    elif status_data["status"] == "failed":
                        return {"success": False, "error": "Image generation failed", "source": "replicate"}

            return {"success": False, "error": "Timeout waiting for image", "source": "replicate"}

        except Exception as e:
            return {"success": False, "error": str(e), "source": "replicate"}


class WebScrapeTool(AgentTool):
    name = "web_scrape"
    description = "Scrape and extract content from any website"

    def run(self, url):
        """Scrape a website using BeautifulSoup (completely free)"""
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            resp = requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, 'html.parser')

            # Remove script/style elements
            for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
                tag.decompose()

            title = soup.title.string if soup.title else "No title"
            text = soup.get_text(separator='\n', strip=True)
            # Truncate to first 5000 chars
            text = text[:5000]

            return {
                "success": True,
                "title": title,
                "content": text,
                "url": url,
                "source": "beautifulsoup"
            }
        except Exception as e:
            return {"success": False, "error": str(e), "source": "beautifulsoup"}


class SocialSearchTool(AgentTool):
    name = "social_search"
    description = "Search social media platforms"

    def run(self, query, platform="twitter"):
        """Search social media via SocialData.io free tier"""
        if not SOCIALDATA_API_KEY:
            return {"success": False, "error": "SOCIALDATA_API_KEY not set. Get free tier at socialdata.io", "source": "socialdata"}

        try:
            headers = {"Authorization": f"Bearer {SOCIALDATA_API_KEY}"}
            params = {"query": query, "platform": platform, "count": 10}

            resp = requests.get(
                "https://api.socialdata.io/search",
                headers=headers,
                params=params
            )
            if resp.ok:
                return {"success": True, "results": resp.json().get("data", []), "source": "socialdata"}
            else:
                return {"success": False, "error": f"SocialData error: {resp.text}", "source": "socialdata"}
        except Exception as e:
            return {"success": False, "error": str(e), "source": "socialdata"}


class MapsSearchTool(AgentTool):
    name = "maps_search"
    description = "Search Google Maps for businesses and places"

    def run(self, query, location=""):
        """Search Google Maps via SerpAPI free tier"""
        if not SERPAPI_API_KEY:
            return {"success": False, "error": "SERPAPI_API_KEY not set. Get free 100 queries/month at serpapi.com", "source": "serpapi"}

        try:
            params = {
                "api_key": SERPAPI_API_KEY,
                "engine": "google_maps",
                "q": query,
                "type": "search"
            }
            if location:
                params["ll"] = location

            resp = requests.get("https://serpapi.com/search", params=params)
            if resp.ok:
                data = resp.json()
                results = data.get("local_results", [])
                return {
                    "success": True,
                    "results": results,
                    "source": "serpapi/google_maps"
                }
            else:
                return {"success": False, "error": f"SerpAPI error: {resp.text}", "source": "serpapi"}
        except Exception as e:
            return {"success": False, "error": str(e), "source": "serpapi"}


class TTSTool(AgentTool):
    name = "tts"
    description = "Convert text to speech"

    def run(self, text, lang="ckb", use_openai=False):
        """Convert text to speech using gTTS (free) or OpenAI TTS"""
        try:
            if use_openai and OPENAI_API_KEY:
                # OpenAI TTS
                headers = {
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                }
                voice = "alloy"  # Options: alloy, echo, fable, onyx, nova, shimmer
                resp = requests.post(
                    "https://api.openai.com/v1/audio/speech",
                    headers=headers,
                    json={
                        "model": "tts-1",
                        "input": text,
                        "voice": voice,
                        "response_format": "mp3"
                    }
                )
                if resp.ok:
                    # Return base64 audio
                    import base64
                    audio_b64 = base64.b64encode(resp.content).decode()
                    return {
                        "success": True,
                        "audio_base64": audio_b64,
                        "format": "mp3",
                        "source": "openai_tts"
                    }
                else:
                    return {"success": False, "error": f"OpenAI TTS error: {resp.text}", "source": "openai_tts"}
            else:
                # Free gTTS
                from gtts import gTTS
                import tempfile
                import base64

                # Map language codes
                lang_map = {
                    "ckb": "ku",  # Kurdish (Sorani)
                    "bad": "ku",  # Kurdish (Badini) — gTTS uses same ku
                    "ar": "ar",   # Arabic
                    "en": "en"    # English
                }
                tts_lang = lang_map.get(lang, "en")

                tts = gTTS(text=text, lang=tts_lang, slow=False)
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
                    tts.save(f.name)
                    with open(f.name, "rb") as audio_file:
                        audio_b64 = base64.b64encode(audio_file.read()).decode()
                    os.unlink(f.name)

                return {
                    "success": True,
                    "audio_base64": audio_b64,
                    "format": "mp3",
                    "source": "gtts"
                }
        except Exception as e:
            return {"success": False, "error": str(e), "source": "gtts"}


class WorkflowEngine:
    """Simple in-app workflow engine + n8n webhook support"""
    name = "workflow"
    description = "Execute and manage business workflows"

    def trigger_n8n(self, workflow_data):
        """Send data to n8n webhook"""
        if not N8N_WEBHOOK_URL:
            return {"success": False, "error": "N8N_WEBHOOK_URL not configured", "source": "n8n"}
        try:
            resp = requests.post(N8N_WEBHOOK_URL, json=workflow_data, timeout=10)
            return {"success": resp.ok, "status_code": resp.status_code, "source": "n8n"}
        except Exception as e:
            return {"success": False, "error": str(e), "source": "n8n"}

    def create_workflow(self, name, steps):
        """Create a local workflow definition"""
        return {
            "success": True,
            "workflow": {
                "name": name,
                "steps": steps,
                "status": "created"
            },
            "source": "local_engine"
        }


class BusinessAnalytics:
    """Kurdistan-specific business analytics"""
    name = "analytics"
    description = "Kurdistan market analytics and business intelligence"

    def analyze_market(self, sector, location):
        """Generate market analysis for Kurdistan sectors"""
        insights = {
            "car_dealership": {
                "erbil": {
                    "trend": "Growing demand for Japanese and Korean cars",
                    "challenges": "Currency fluctuation USD/IQD, import delays",
                    "opportunity": "Online showroom + WhatsApp automation"
                },
                "duhok": {
                    "trend": "Increasing used car market",
                    "challenges": "Limited financing options",
                    "opportunity": "Vehicle history verification service"
                }
            },
            "pharmacy": {
                "erbil": {
                    "trend": "24-hour pharmacy demand rising",
                    "challenges": "Inventory management, prescription tracking",
                    "opportunity": "Automated refill reminders via WhatsApp"
                },
                "duhok": {
                    "trend": "New pharmacy openings increasing",
                    "challenges": "Regulatory compliance, supplier coordination",
                    "opportunity": "Multi-pharmacy stock sharing network"
                }
            },
            "restaurant": {
                "erbil": {
                    "trend": "Food delivery apps dominating",
                    "challenges": "High commission fees, manual order management",
                    "opportunity": "Direct ordering system + loyalty program"
                },
                "duhok": {
                    "trend": "Traditional restaurants expanding",
                    "challenges": "Staff scheduling, supply chain",
                    "opportunity": "Automated roster + supplier portal"
                }
            },
            "wholesale": {
                "erbil": {
                    "trend": "Cross-border trade with Turkey/Iran",
                    "challenges": "Customs delays, currency exchange",
                    "opportunity": "Automated invoice + tracking system"
                },
                "duhok": {
                    "trend": "Agricultural wholesale growing",
                    "challenges": "Seasonal inventory, transport costs",
                    "opportunity": "Predictive ordering system"
                }
            }
        }

        sector_data = insights.get(sector, {}).get(location, {})
        if not sector_data:
            return {
                "success": True,
                "analysis": f"General market insights for {sector} in {location}",
                "note": "Specific data not available — run a web search for current data"
            }

        return {
            "success": True,
            "analysis": sector_data,
            "sector": sector,
            "location": location
        }

    def currency_tracker(self):
        """Track USD/IQD exchange rate (free API)"""
        try:
            resp = requests.get("https://api.exchangerate-api.com/v4/latest/USD")
            if resp.ok:
                data = resp.json()
                iqd_rate = data["rates"].get("IQD", "N/A")
                return {
                    "success": True,
                    "usd_to_iqd": iqd_rate,
                    "last_updated": data.get("date", ""),
                    "source": "exchangerate-api.com"
                }
        except:
            pass
        return {"success": False, "error": "Could not fetch currency data"}


# ============================================================
# AI GARM ORCHESTRATOR
# ============================================================

class AIGarm:
    """Main orchestrator — routes commands to tools"""

    def __init__(self):
        self.tools = {
            "web_search": WebSearchTool(),
            "image_gen": ImageGenTool(),
            "web_scrape": WebScrapeTool(),
            "social_search": SocialSearchTool(),
            "maps_search": MapsSearchTool(),
            "tts": TTSTool(),
        }
        self.workflow = WorkflowEngine()
        self.analytics = BusinessAnalytics()

    def process(self, prompt, tools=None, lang="en"):
        """
        Process a user command with AI-powered intent detection
        """
        tools = tools or ["auto"]

        # If auto mode, detect intent from prompt
        if "auto" in tools:
            tools = self._detect_intent(prompt)

        results = {}

        for tool_name in tools:
            if tool_name == "auto":
                continue

            tool = self.tools.get(tool_name)
            if not tool:
                results[tool_name] = {"success": False, "error": f"Unknown tool: {tool_name}"}
                continue

            # Prepare parameters based on tool type
            params = self._prepare_params(tool_name, prompt, lang)

            # Execute tool
            results[tool_name] = tool.run(**params)

        # If no tools matched, do a web search as default
        if not results:
            results["web_search"] = self.tools["web_search"].run(query=prompt)

        # Add workflow suggestion
        results["_workflow"] = self._suggest_workflow(prompt, results)

        return {
            "success": True,
            "prompt": prompt,
            "tools_used": list(results.keys()),
            "results": results,
            "lang": lang
        }

    def _detect_intent(self, prompt):
        """Simple keyword-based intent detection"""
        prompt_lower = prompt.lower()
        tools = []

        # Image generation keywords
        if any(w in prompt_lower for w in ["generate image", "create image", "draw", "make a picture",
                                             "flux", "تصویر", "وێنە", "image of", "picture of"]):
            tools.append("image_gen")

        # Scraping keywords
        if any(w in prompt_lower for w in ["scrape", "extract", "get content from", "fetch website",
                                             "website content", "page content"]):
            tools.append("web_scrape")

        # Social media keywords
        if any(w in prompt_lower for w in ["social media", "twitter", "instagram", "facebook", "social",
                                             "tweet", "post"]):
            tools.append("social_search")

        # Maps keywords
        if any(w in prompt_lower for w in ["maps", "location", "place", "business near", "nearby",
                                             "store", "restaurant in", "pharmacy in", "car dealer"]):
            tools.append("maps_search")

        # TTS keywords
        if any(w in prompt_lower for w in ["speak", "say", "read aloud", "text to speech", "tts",
                                             "voice", "pronounce", "بێژە", "قول"]):
            tools.append("tts")

        # Always add web search as default
        tools.append("web_search")

        return tools

    def _prepare_params(self, tool_name, prompt, lang):
        """Extract parameters from prompt for each tool"""
        params = {"prompt": prompt, "lang": lang}

        if tool_name == "web_search":
            # Clean the query
            query = prompt
            for prefix in ["search for ", "search ", "find ", "look up ", "tell me about "]:
                if query.lower().startswith(prefix):
                    query = query[len(prefix):]
            return {"query": query, "max_results": 5}

        if tool_name == "image_gen":
            # Extract image description
            desc = prompt
            for prefix in ["generate image of ", "generate image of a ", "create image of ",
                           "draw ", "make a picture of "]:
                if desc.lower().startswith(prefix):
                    desc = desc[len(prefix):]
            return {"prompt": desc}

        if tool_name == "web_scrape":
            # Extract URL from prompt
            import re
            urls = re.findall(r'https?://[^\s]+', prompt)
            if urls:
                return {"url": urls[0]}
            return {"url": prompt}  # Try prompt as URL

        if tool_name == "social_search":
            return {"query": prompt}

        if tool_name == "maps_search":
            return {"query": prompt}

        if tool_name == "tts":
            return {"text": prompt, "lang": lang}

        return params

    def _suggest_workflow(self, prompt, results):
        """Suggest automation workflows based on results"""
        suggestions = []

        if "maps_search" in results and results["maps_search"].get("success"):
            suggestions.append({
                "type": "lead_generation",
                "description": "Auto-save these businesses to CRM and send follow-up WhatsApp messages",
                "action": "Create workflow: Maps Search → Google Sheets → WhatsApp Auto-Message"
            })

        if "web_search" in results and results["web_search"].get("success"):
            suggestions.append({
                "type": "market_monitor",
                "description": "Schedule daily search for this topic and get Telegram alerts",
                "action": "Create workflow: Daily Search → Filter → Telegram Alert"
            })

        if "social_search" in results and results["social_search"].get("success"):
            suggestions.append({
                "type": "social_monitor",
                "description": "Monitor social mentions and auto-respond to customer inquiries",
                "action": "Create workflow: Social Monitor → Auto-Reply → CRM Log"
            })

        return suggestions


# ============================================================
# FLASK ROUTES
# ============================================================

ai_garm = AIGarm()


@app.route("/")
def index():
    return render_template_string(DASHBOARD_HTML)


@app.route("/api/agent", methods=["POST"])
def agent_api():
    """Main API endpoint — process any command"""
    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"success": False, "error": "Missing 'prompt' in request body"}), 400

    prompt = data["prompt"]
    tools = data.get("tools", ["auto"])
    lang = data.get("lang", "en")

    result = ai_garm.process(prompt, tools, lang)
    return jsonify(result)


@app.route("/api/search", methods=["GET"])
def search_api():
    """Direct web search endpoint"""
    query = request.args.get("q", "")
    if not query:
        return jsonify({"success": False, "error": "Missing query parameter 'q'"}), 400
    result = ai_garm.tools["web_search"].run(query=query)
    return jsonify(result)


@app.route("/api/scrape", methods=["GET"])
def scrape_api():
    """Direct web scrape endpoint"""
    url = request.args.get("url", "")
    if not url:
        return jsonify({"success": False, "error": "Missing url parameter"}), 400
    result = ai_garm.tools["web_scrape"].run(url=url)
    return jsonify(result)


@app.route("/api/generate-image", methods=["POST"])
def image_api():
    """Direct image generation endpoint"""
    data = request.get_json()
    prompt = data.get("prompt", "") if data else ""
    if not prompt:
        return jsonify({"success": False, "error": "Missing 'prompt'"}), 400
    result = ai_garm.tools["image_gen"].run(prompt=prompt)
    return jsonify(result)


@app.route("/api/tts", methods=["POST"])
def tts_api():
    """Direct text-to-speech endpoint"""
    data = request.get_json()
    text = data.get("text", "") if data else ""
    lang = data.get("lang", "en") if data else "en"
    if not text:
        return jsonify({"success": False, "error": "Missing 'text'"}), 400
    result = ai_garm.tools["tts"].run(text=text, lang=lang)
    return jsonify(result)


@app.route("/api/maps", methods=["GET"])
def maps_api():
    """Direct Google Maps search"""
    query = request.args.get("q", "")
    location = request.args.get("location", "")
    if not query:
        return jsonify({"success": False, "error": "Missing query parameter 'q'"}), 400
    result = ai_garm.tools["maps_search"].run(query=query, location=location)
    return jsonify(result)


@app.route("/api/analyze-market", methods=["GET"])
def market_analysis():
    """Kurdistan market analysis endpoint"""
    sector = request.args.get("sector", "car_dealership")
    location = request.args.get("location", "erbil")
    result = ai_garm.analytics.analyze_market(sector, location)
    return jsonify(result)


@app.route("/api/currency", methods=["GET"])
def currency_api():
    """USD/IQD exchange rate"""
    result = ai_garm.analytics.currency_tracker()
    return jsonify(result)


@app.route("/api/workflow", methods=["POST"])
def workflow_api():
    """Trigger n8n or local workflow"""
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Missing workflow data"}), 400
    result = ai_garm.workflow.trigger_n8n(data)
    return jsonify(result)


@app.route("/api/status", methods=["GET"])
def status_api():
    """Check which tools are configured and ready"""
    return jsonify({
        "web_search": {
            "status": "online",
            "label": "Online (DuckDuckGo)"
        },
        "image_gen": {
            "status": "online" if REPLICATE_API_TOKEN else "offline",
            "label": "Configured ✓" if REPLICATE_API_TOKEN else "REPLICATE_API_TOKEN needed"
        },
        "web_scrape": {
            "status": "online",
            "label": "Online (BeautifulSoup)"
        },
        "social_search": {
            "status": "online" if SOCIALDATA_API_KEY else "offline",
            "label": "Configured ✓" if SOCIALDATA_API_KEY else "SOCIALDATA_API_KEY needed"
        },
        "maps_search": {
            "status": "online" if SERPAPI_API_KEY else "offline",
            "label": "Configured ✓" if SERPAPI_API_KEY else "SERPAPI_API_KEY needed"
        },
        "tts": {
            "status": "online",
            "label": "Online (gTTS)"
        },
        "workflow": {
            "status": "online" if N8N_WEBHOOK_URL else "partial",
            "label": "n8n Ready" if N8N_WEBHOOK_URL else "Local engine active"
        },
        "analytics": {
            "status": "online",
            "label": "Online"
        }
    })


@app.route("/api/business-pitch", methods=["GET"])
def business_pitch():
    """Generate business pitch in Kurdish/Arabic"""
    sector = request.args.get("sector", "car_dealership")
    lang = request.args.get("lang", "ckb")

    pitches = {
        "ckb": {  # Sorani Kurdish
            "car_dealership": f"ئەی خاوەن کارخانەی ئۆتۆمبێل، ئێمە یارمەتیت دەدەین بۆ زیادکردنی فرۆشتنەکانت بە ڕێژەی ٪٣٠ لە ڕێگەی ئۆتۆماتیکیکردنی پەیوەندییەکانت لەگەڵ کڕیاران. سیستەمێکی زیرەک کە بە شێوەیەکی خۆکار پەیام بۆ کڕیاران دەنێرێت، یادخستنەوەی چاککردنەوە و فرۆشتنی ئۆتۆمبێلی نوێ.",
            "pharmacy": f"ئەی خاوەن دەرمانخانە، کێشەی بەڕێوەبردنی کۆگا و یادخستنەوەی کڕیارانت هەیە؟ ئێمە سیستەمێکی ئۆتۆماتیکت پێشکەش دەکەین کە بە شێوەی خۆکار بەرپرس دەبێت لە بەڕێوەبردنی کۆگا، ناردنی یادخستنەوە بۆ کڕیاران، و ڕێکخستنی داواکارییەکان.",
            "restaurant": f"ئەی خاوەن چێشتخانە، کاتی ئەوەیە کە بەرنامەی دڵسۆزی کڕیار و داواکاری ئۆنلاین بە شێوەیەکی ئۆتۆماتیک دابمەزرێنیت. ئێمە ڕێگە دەدەین کڕیارەکانت بە ئاسانی داواکاری بکەن و تۆش بە شێوەی خۆکار بەڕێوەیان ببەیت.",
            "wholesale": f"ئەی خاوەن کۆمپانیای پارتەکەری، ڕێکخستنی داواکاری و بەدواداچوونی بارهەڵگرەکانمان بە شێوەیەکی ئۆتۆماتیک ڕێکدەخەین. کەمکردنەوەی هەڵەکانی مرۆڤ و زیادکردنی خێرایی کارەکان."
        },
        "bad": {  # Badini Kurdish
            "car_dealership": f"ئەی خاوەن کارخانەی ئۆتۆمبیل، ئێمە دەتوانین فرۆشتنەکانی تە بە ٪٣٠ زیاد بکەین بە ئۆتۆماتیک کردنی پەیوەندی لەگەڵ کڕیاران. سیستمەکە بە شێوەیەکی خۆکار پەیامان بۆ کڕیاران دەشێنێت و بیرخستنەوەی چاککردن و فرۆشتنی ئۆتۆمبیلان دەکات.",
            "pharmacy": f"ئەی خاوەن دەرمانخانە، ئێمە سیستمێکی ئۆتۆماتیک بۆ بەڕێوەبردنی کۆگا و ناردنی بیرخستنەوە بۆ کڕیاران پێشکەش دەکەین. بەرێوەبردنی داواکاری و کۆگا بە ئاسانی.",
            "restaurant": f"ئەی خاوەن چێشتخانە، سیستمێکی داواکاری ئۆنلاین و دڵسۆزی کڕیار بە شێوەیەکی ئۆتۆماتیک دابمەزرێنین.",
            "wholesale": f"ئەی خاوەن کۆمپانیای پارتەکەری، داواکاری و بەدواداچوونی باران بە شێوەیەکی ئۆتۆماتیک ڕێکدەخەین."
        },
        "ar": {  # Arabic
            "car_dealership": f"صاحب معرض السيارات، نحن نساعدك على زيادة مبيعاتك بنسبة ٣٠٪ من خلال أتمتة التواصل مع العملاء. نظام ذكي يرسل رسائل تلقائية للعملاء، تذكير بالصيانة، وعروض السيارات الجديدة.",
            "pharmacy": f"صاحب الصيدلية، لدينا نظام آلي لإدارة المخزون وإرسال تذكيرات للعملاء وتنظيم الطلبات. وفر وقتك وركز على خدمة المرضى.",
            "restaurant": f"صاحب المطعم، حان الوقت لنظام طلب إلكتروني وبرنامج ولاء للعملاء بشكل آلي. نظام متكامل يزيد أرباحك.",
            "wholesale": f"صاحب شركة الجملة، ننظم الطلبات ومتابعة الشحنات بشكل آلي. تقليل الأخطاء البشرية وزيادة سرعة العمل."
        },
        "en": {
            "car_dealership": f"Car dealership owner — we help you increase sales by 30% through automated customer communication. Smart system sends automatic messages, maintenance reminders, and new car offers.",
            "pharmacy": f"Pharmacy owner — automated inventory management, customer refill reminders, and order management system. Save time and focus on patients.",
            "restaurant": f"Restaurant owner — automated online ordering and customer loyalty program. Integrated system that increases your profits.",
            "wholesale": f"Wholesale company owner — automated order management and shipment tracking. Reduce human errors and increase work speed."
        }
    }

    pitch = pitches.get(lang, pitches["en"]).get(sector, pitches["en"]["car_dealership"])

    return jsonify({
        "success": True,
        "pitch": pitch,
        "sector": sector,
        "lang": lang
    })


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("🤖 AI Garm — AI گرم is running!")
    print(f"🌐 Dashboard: http://0.0.0.0:{port}")
    print(f"📡 API: http://0.0.0.0:{port}/api/agent")
    app.run(host="0.0.0.0", port=port, debug=True)
