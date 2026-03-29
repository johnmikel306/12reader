# 02 - Repo Tour

This lesson gives you a mental map of the repo.

## Root level

### `app.py`

This is a thin entry point so you can still run the web app from the repo root.

It imports the real Flask app from `apps/web/app.py`.

### `requirements.txt`

This points to `apps/web/requirements.txt` so the repo still installs the web app dependencies from the root.

### `package.json`

This gives the monorepo a small JavaScript workspace shape and provides validation scripts.

### `README.md`

This explains the monorepo at a high level.

## `apps/web`

This is the uploaded-document product.

### `apps/web/app.py`

Main backend responsibilities:

- upload documents
- serve original files back to the browser
- accept a frontend-generated text manifest
- list voices
- create and manage streaming read sessions
- stream audio and SSE timing events

### `apps/web/templates/index.html`

The main reader page for uploaded files.

### `apps/web/static/js/app.js`

The main frontend brain for the web reader.

It handles:

- rendering by file type
- building the canonical text map
- click-to-read
- sentence detection
- highlight drawing
- hot-swapping playback settings

### `apps/web/static/css/app.css`

Reader UI styling.

## `apps/extension`

This is the webpage-reading product.

### `apps/extension/manifest.json`

The extension manifest.

It declares:

- permissions
- background service worker
- content script
- popup
- commands (keyboard shortcuts)

### `apps/extension/background.js`

The extension orchestrator.

It handles:

- commands
- popup actions
- session state persistence
- communication with the backend
- communication with the offscreen document
- communication with the content script

### `apps/extension/offscreen.js`

This owns audio playback for the extension.

It:

- opens the backend audio stream
- listens to backend timing events
- computes live progress
- reports progress and playback state back to the background worker

### `apps/extension/content.js`

This runs inside webpages.

It:

- extracts readable text from the page
- maps clicks to reading offsets
- highlights current word and sentence
- shows floating controls

### `apps/extension/popup.*`

Popup UI for manual control.

## `packages/reader-core`

This is a future shared package area.

Right now it is a placeholder for logic that could later be shared by both products.

Examples of future shared logic:

- sentence segmentation helpers
- offset helpers
- DOM range utilities

## The most important runtime boundaries

There are three big boundaries in this repo.

### Boundary 1: frontend vs backend

The backend streams audio and timing.
The frontend renders and highlights.

### Boundary 2: web app vs extension

They solve a similar problem, but they are different applications with different runtime limits.

### Boundary 3: extension internal boundaries

The extension is not one thing. It is four things:

- popup
- background service worker
- offscreen document
- content script

If you understand those boundaries, the extension becomes much less mysterious.

## Checkpoint questions

1. Which file would you inspect if reading works but highlighting is wrong on uploaded documents?
2. Which file would you inspect if the webpage extension can highlight but cannot play audio?
3. Which file would you inspect if keyboard shortcuts stop working?
