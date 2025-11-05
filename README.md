# JsonMergerFilterCounter

This repository contains a small React (Vite) web app that helps you paste multiple JSON responses, optionally filter each input to keep only a particular path (supports array indices), and merge them into a single JSON response.

Run locally
1. Install dependencies:

```bash
cd /workspaces/JsonMergerFilterCounter
npm install
```

2. Start dev server:

```bash
npm run dev
```

Open the URL printed by Vite (usually http://localhost:5173) to use the app.

Features
- Multiple input textareas, add/remove inputs
- Per-input filter paths (comma-separated), e.g. `data.data.prodAttrs[0].attrvalue` or `prodAttrs[0].attrvalue`
- Merge arrays from `data.data` across inputs
- Optional deduplication by `reviewid`
- Copy and download merged JSON

Usage
1. Start the dev server and open the app.
2. Paste each JSON response in its own input box. Use the filter field to keep only specific path(s) within each object item.
3. Click `Merge`. Copy or download the result.

Notes
- This is a client-side tool. No network requests are made by the application.
# JsonMergerFilterCounter
Merge online json responses, filter and count properties
