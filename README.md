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
# Deployment (GitHub Pages)

This repo includes a GitHub Actions workflow that will build the app and publish it to GitHub Pages when you push to the `main` branch.

What I added:
- `vite.config.js` — sets Vite's `base` to `./` so assets work when served from GitHub Pages.
- `.github/workflows/gh-pages.yml` — action that runs `npm ci`, builds, uploads the `dist/` artifact and deploys it to Pages.

How to enable deployment:
1. Commit and push your branch (must be `main` for the workflow as provided):

```bash
git add .
git commit -m "Add GitHub Pages workflow"
git push origin main
```

2. After the push the workflow will run automatically. You can watch the run under the repository's Actions tab.

3. In your repository Settings → Pages, GitHub will show the published site URL after the workflow completes (the action deploys via the official Pages actions).

Notes and tips
- If you want the site to be published from another branch, change the `on.push.branches` value in `.github/workflows/gh-pages.yml`.
- The workflow uses the official Pages actions and doesn't require a personal access token.
- If you prefer the site to be served from `https://<username>.github.io/<repo>/`, you don't need extra config — the workflow and `base: './'` handle relative URLs.

# JsonMergerFilterCounter
Merge online json responses, filter and count properties
