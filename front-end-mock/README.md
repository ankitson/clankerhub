# Live AI Web App Builder — Mock Front End

## Overview
This folder contains a single-page, local-first front-end prototype for a live AI web app builder. It mirrors the UX plan (chat + editor + preview), the code structure sketch (chat pipeline, preview bridge, local persistence), and the infra scaffold context (future gateway/edge router), while fully mocking the backend in-browser.

## What’s Included
- **Chat sidebar** with quick actions, status banners, and an audit log.
- **Live preview** rendered in a sandboxed iframe with responsive toggles.
- **Code editor + file tree** with instant local changes.
- **Snapshots + undo** to support safe experimentation.
- **Local persistence** using `localStorage` to simulate IndexedDB storage.
- **Mocked AI responses** that generate patch-like updates on prompt.

## Files
- `index.html` — App shell and layout.
- `styles.css` — UI styling for the builder interface.
- `app.js` — Mock state store, AI patch simulation, preview rendering, and persistence.
- `notes.md` — Work log and observations.

## How to Run
Open `index.html` in a browser, or serve the folder locally:

```bash
cd front-end-mock
python3 -m http.server 8000
```

Then visit `http://localhost:8000/front-end-mock/`.

## Mocked Backend Behavior
- **Prompt handling** is simulated with a short delay.
- **AI patches** mutate the in-memory file map and create snapshot entries.
- **Audit log** stores timestamped summaries of AI actions.
- **Export** downloads a JSON snapshot of current files + audit history.

## Alignment With Source Material
- **UX plan:** chat, preview, code editor, status feedback, and audit trail.
- **Code sketch:** local persistence, patch-based updates, preview bridge behavior.
- **Infra scaffold:** mock gateway/edge-router notes implied via “mocked backend.”
