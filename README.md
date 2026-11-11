# Present — Attendance & Marks Tracker

A browser-based attendance and marks tracker. The app stores its data in the browser's `localStorage` under the key `present.v1`.

## Run locally

Open `index.html` in a modern browser. No server or database is required for the built app.

## Rebuild the website

The source files are in `src/`. To regenerate the standalone `index.html` after editing the source:

```bash
python build.py
```

## Run core tests

With Node.js installed:

```bash
node test/core.test.js
```

## Publish with GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this folder (including `index.html`, `src/`, `build.py`, and `test/`).
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch **main** and folder **/(root)**, then save.
6. GitHub will provide the published website URL after deployment finishes.

The app is static and does not require a backend. User data is stored in the browser used to access the site; it is not automatically synced between devices.
