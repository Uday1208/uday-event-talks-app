import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION = 300  # 5 minutes

def parse_feed(xml_data):
    try:
        # Atom Namespace
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(xml_data)
        
        entries = []
        for entry in root.findall('atom:entry', namespaces):
            title_elem = entry.find('atom:title', namespaces)
            updated_elem = entry.find('atom:updated', namespaces)
            link_elem = entry.find('atom:link[@rel="alternate"]', namespaces)
            if link_elem is None:
                link_elem = entry.find('atom:link', namespaces)
            content_elem = entry.find('atom:content', namespaces)
            
            title = title_elem.text if title_elem is not None else ""
            updated = updated_elem.text if updated_elem is not None else ""
            link = link_elem.attrib.get('href') if link_elem is not None else ""
            content_html = content_elem.text if content_elem is not None else ""
            
            entries.append({
                "title": title,
                "updated": updated,
                "link": link,
                "content_html": content_html
            })
        return entries
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    if force_refresh or not cache["data"] or (now - cache["last_fetched"] > CACHE_DURATION):
        try:
            response = requests.get(FEED_URL, timeout=10)
            response.raise_for_status()
            
            entries = parse_feed(response.content)
            if entries:
                cache["data"] = entries
                cache["last_fetched"] = now
                return jsonify({
                    "success": True,
                    "source": "live",
                    "updated_at": cache["last_fetched"],
                    "releases": entries
                })
            else:
                raise ValueError("No entries parsed from feed")
        except Exception as e:
            # Fallback to cache if available
            if cache["data"]:
                return jsonify({
                    "success": True,
                    "source": "cache_fallback",
                    "error": str(e),
                    "updated_at": cache["last_fetched"],
                    "releases": cache["data"]
                })
            return jsonify({
                "success": False,
                "error": f"Failed to fetch and parse release notes: {str(e)}"
            }), 500
    
    return jsonify({
        "success": True,
        "source": "cache",
        "updated_at": cache["last_fetched"],
        "releases": cache["data"]
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)
