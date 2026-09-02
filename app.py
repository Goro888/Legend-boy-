import os
from flask import Flask, jsonify, request, render_template_string
from ai_garm_agent import AIGarmAgent

app = Flask(__name__)
agent = AIGarmAgent()

HOME_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Kurdistan Autonomous AI Business Engine</title>
    <style>
        body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        h1 { color: #38bdf8; text-align: center; }
        .endpoint { background: #334155; padding: 15px; margin: 10px 0; border-radius: 8px; }
        code { color: #f472b6; background: #0f172a; padding: 2px 6px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>AI Garm (AI گرم) Engine</h1>
        <p>Operational framework deployed for Erbil & Duhok regional markets (Car Dealerships, Pharmacies, Wholesale).</p>
        <hr style="border-color: #475569;">
        <h3>Available API Endpoints:</h3>
        <div class="endpoint">
            <strong>POST <code>/api/search</code></strong><br>
            Payload: <code>{"query": "car parts Erbil"}</code>
        </div>
        <div class="endpoint">
            <strong>POST <code>/api/scrape</code></strong><br>
            Payload: <code>{"url": "https://example.com"}</code>
        </div>
        <div class="endpoint">
            <strong>POST <code>/api/pitch</code></strong><br>
            Payload: <code>{"sector": "car dealership", "language": "badini"}</code>
        </div>
    </div>
</body>
</html>
"""

@app.route("/", methods=["GET"])
def home():
    return render_template_string(HOME_TEMPLATE)

@app.route("/api/search", methods=["POST"])
def api_search():
    data = request.get_json() or {}
    query = data.get("query", "Kurdistan business automated workflows")
    results = agent.web_search(query)
    return jsonify({"status": "success", "query": query, "results": results})

@app.route("/api/scrape", methods=["POST"])
def api_scrape():
    data = request.get_json() or {}
    url = data.get("url")
    if not url:
        return jsonify({"error": "URL parameter is missing"}), 400
    content = agent.scrape_website(url)
    return jsonify({"status": "success", "url": url, "content": content})

@app.route("/api/pitch", methods=["POST"])
def api_pitch():
    data = request.get_json() or {}
    sector = data.get("sector", "car dealership")
    language = data.get("language", "badini")
    pitch = agent.generate_localized_pitch(sector, language)
    return jsonify({"status": "success", "sector": sector, "language": language, "pitch": pitch})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
