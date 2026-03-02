# Local Wiki Preview

This folder contains the source files for the GitHub Wiki. You can preview them locally before uploading.

## 🚀 How to Preview

### Option A: VS Code (Recommended)

1. Open the `/wiki` folder in VS Code.
2. Open any file (e.g., `Home.md`).
3. Press `Cmd + Shift + V` (Mac) or `Ctrl + Shift + V` (Windows) to toggle the built-in preview.
4. Links like `[[Concepts]]` are GitHub-specific and may not resolve automatically in standard Markdown viewers unless converted.

### Option B: Simple Python Server

If you want to view them as a mini-website:

```bash
cd wiki
python3 -m http.server 8888
```

Then visit `http://localhost:8888` in your browser. Note that this will serve raw text; for rendered views, a dedicated Markdown viewer is required.

## 📤 Publishing to GitHub Wiki

1. Go to your repository on GitHub.
2. Click the **Wiki** tab.
3. If the Wiki is not yet created, create a dummy page.
4. Clone the wiki repository (it usually ends in `.wiki.git`).
5. Copy all files from this `/wiki` folder into the cloned wiki repo.
6. Commit and push.

---

[[Home]]
