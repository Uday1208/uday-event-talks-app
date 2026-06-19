# BigQuery Release Notes Engine 🚀

A web application designed to track, filter, and share Google Cloud BigQuery Release Notes. Built with a **Python Flask** backend and a plain vanilla **HTML/CSS/JS** frontend. The UI features a premium glowing dark theme with a split-screen Tweet Composer.

---

## 🌟 Key Features

*   **Granular Parsing**: Splitting daily release notes (which often bundle multiple features and issues) into individual, category-coded cards (Feature, Announcement, Change, Issue, Deprecation).
*   **Tweet Composer Sidebar**:
    *   Generates automatic text templates pre-populated with dates, emojis, summaries, and anchor links.
    *   **Twitter character calculation algorithm**: URL strings are treated as exactly 23 characters matching X's standard URL wrapping rule.
    *   Circular SVG indicator that fills dynamically and shifts colors as you approach/exceed the 280-character limit.
    *   Quick hashtag injection buttons (`#BigQuery`, `#GoogleCloud`, `#GeminiAI`).
    *   Native Twitter/X Share Intent integration.
*   **Resilient Local Caching**: Caches the Google Cloud RSS feed for 5 minutes in memory to minimize load.
*   **Resilience Fallbacks**: Gracefully serves cache content with warning alerts if Google's feed is down.
*   **Immediate Filters**: Instant client-side search filtering by release categories and keywords.

---

## 📂 Project Structure

```
bq-releases-notes/
├── app.py                   # Flask server with API endpoints, caching & fallbacks
├── requirements.txt         # Dependencies (Flask, requests)
├── .gitignore               # Excludes venv, pycache, OS files, and editor states
├── templates/
│   └── index.html           # Layout, skeletons, stats, and composer sidebar shell
└── static/
    ├── css/
    │   └── style.css        # Premium custom CSS system (glassmorphism & animations)
    └── js/
        └── app.js           # Client engine (parsing feed HTML, text calculation, copy)
```

---

## ⚙️ Running Locally

### Prerequisites
*   Python 3.9 or higher

### 1. Set Up the Virtual Environment
Navigate to the project directory and create a virtual environment:
```bash
python3 -m venv venv
```

Activate the environment:
```bash
# On macOS and Linux:
source venv/bin/activate

# On Windows (Command Prompt):
venv\Scripts\activate
```

### 2. Install Dependencies
Install Flask and the requests library:
```bash
pip install -r requirements.txt
```

### 3. Launch the Application
Start the local server:
```bash
python3 app.py
```

Open your browser and navigate to:
**[http://127.0.0.1:5001](http://127.0.0.1:5001)**

---

## 🔧 Architecture Details

### 1. Entry Splitting Protocol
Google's BigQuery Feed bundles daily updates into a single feed item. The client-side parser splits them by selecting `<h3>` headers as dividing markers:
```javascript
// Example: "<h3>Feature</h3><p>Para A</p><h3>Issue</h3><p>Para B</p>"
// parses to:
//   - Card A: Feature -> "Para A"
//   - Card B: Issue -> "Para B"
```
This isolates specific features, making it easy to copy or tweet single release items.

### 2. Cache Override
The frontend's **Refresh** button hits `/api/releases?refresh=true` which bypasses Flask's in-memory storage, forcing a new request to Google Cloud's servers and updating the cache with the new fetch.
