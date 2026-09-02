# (Continuing the AI Garm Flask Application code)

    def _detect_intent(self, prompt):
        """Simple keyword-based intent detector for auto mode"""
        prompt_lower = prompt.lower()
        detected = []

        if any(w in prompt_lower for w in ["image", "photo", "picture", "draw", "wێنە", "رەسم"]):
            detected.append("image_gen")
        if any(w in prompt_lower for w in ["scrape", "extract", "url", "http", "website"]):
            detected.append("web_scrape")
        if any(w in prompt_lower for w in ["twitter", "tweet", "social", "post"]):
            detected.append("social_search")
        if any(w in prompt_lower for w in ["map", "location", "shop near", "restaurant near", "جامعە", "نەخشە"]):
            detected.append("maps_search")
        if any(w in prompt_lower for w in ["speak", "audio", "voice", "say", "دەنگ"]):
            detected.append("tts")

        # Default to web search if no specific intent detected
        if not detected:
            detected.append("web_search")

        return detected

    def _prepare_params(self, tool_name, prompt, lang):
        """Map prompt to appropriate tool parameters"""
        if tool_name == "web_search":
            return {"query": prompt, "max_results": 5}
        elif tool_name == "image_gen":
            return {"prompt": prompt, "model": "flux-schnell"}
        elif tool_name == "web_scrape":
            # Extract URL if present, otherwise use prompt as URL
            words = prompt.split()
            url = next((w for w in words if w.startswith("http")), "https://www.rudaw.net")
            return {"url": url}
        elif tool_name == "social_search":
            return {"query": prompt, "platform": "twitter"}
        elif tool_name == "maps_search":
            return {"query": prompt, "location": "36.1900,44.0091"}  # Default Erbil coordinates
        elif tool_name == "tts":
            return {"text": prompt, "lang": lang, "use_openai": False}
        return {"query": prompt}


# Initialize Agent
agent = AIGarm()

# ============================================================
# FLASK ROUTES
# ============================================================

@app.route("/")
def index():
    return render_template_string(DASHBOARD_HTML)


@app.route("/api/status", methods=["GET"])
def api_status():
    """Check availability status of all tools and API keys"""
    return jsonify({
        "web_search": {
            "status": "online",
            "label": "Online (DuckDuckGo / Tavily)"
        },
        "image_gen": {
            "status": "online" if REPLICATE_API_TOKEN else "partial",
            "label": "Configured" if REPLICATE_API_TOKEN else "API Key Needed"
        },
        "web_scrape": {
            "status": "online",
            "label": "Online (BeautifulSoup)"
        },
        "social_search": {
            "status": "online" if SOCIALDATA_API_KEY else "partial",
            "label": "Configured" if SOCIALDATA_API_KEY else "API Key Needed"
        },
        "maps_search": {
            "status": "online" if SERPAPI_API_KEY else "partial",
            "label": "Configured" if SERPAPI_API_KEY else "API Key Needed"
        },
        "tts": {
            "status": "online",
            "label": "Online (gTTS / OpenAI)"
        },
        "workflow": {
            "status": "online" if N8N_WEBHOOK_URL else "partial",
            "label": "Connected" if N8N_WEBHOOK_URL else "Configure n8n"
        },
        "analytics": {
            "status": "online",
            "label": "Online (Kurdistan Intelligence)"
        }
    })


@app.route("/api/agent", methods=["POST"])
def api_agent():
    """Main execution endpoint for AI Garm"""
    data = request.json or {}
    prompt = data.get("prompt", "")
    tools = data.get("tools", ["auto"])
    lang = data.get("lang", "ckb")

    if not prompt:
        return jsonify({"success": False, "error": "Prompt is required"}), 400

    try:
        results = agent.process(prompt, tools=tools, lang=lang)
        return jsonify({
            "success": True,
            "prompt": prompt,
            "language": lang,
            "results": results
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/analytics/market", methods=["GET"])
def api_market_analytics():
    """Get Kurdistan market intelligence"""
    sector = request.args.get("sector", "car_dealership")
    location = request.args.get("location", "erbil")
    result = agent.analytics.analyze_market(sector, location)
    return jsonify(result)


@app.route("/api/analytics/currency", methods=["GET"])
def api_currency():
    """Get current USD/IQD exchange rate info"""
    result = agent.analytics.currency_tracker()
    return jsonify(result)


@app.route("/api/workflow/n8n", methods=["POST"])
def api_n8n_webhook():
    """Receive or trigger n8n workflows"""
    data = request.json or {}
    result = agent.workflow.trigger_n8n(data)
    return jsonify(result)


# ============================================================
# MAIN ENTRY POINT
# ============================================================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
