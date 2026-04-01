# 02 - Repo Tour

This lesson gives you a current map of the repo.

## Root level

### `app.py`

A thin entry point that imports the real Flask app from `apps/web/app.py`.

### `requirements.txt`

Installs the Python dependencies for the web app from the repo root.

### `Dockerfile`

Production container for Render.

It installs Python dependencies and runs the Flask app with `gunicorn`.

### `package.json`

Provides lightweight repo scripts for validation.

### `README.md`

Short high-level project documentation.

### `notebooks/`

Architecture and learning notes for the repo.

## `apps/web`

This is the web reading product.

### `apps/web/app.py`

Main backend responsibilities:

- serve the landing page and reader page
- upload and serve document files
- accept frontend-generated manifests for uploaded documents
- create streaming read sessions
- create raw-text read sessions for pasted text and webpage content
- list available voices
- expose runtime config and health routes

### `apps/web/templates/index.html`

The main reader page.

It now supports two input paths:

- upload a document
- paste text for a session-only reading surface

### `apps/web/static/js/app.js`

The main frontend state machine for the web reader.

It handles:

- file upload flow
- pasted-text flow
- renderer selection by source type
- canonical text mapping
- click-to-read
- highlight drawing
- hot-swapping playback settings

### `apps/web/static/css/app.css`

Reader styling for the control panel, viewer, progress bar, and pasted-text UI.

## `apps/extension`

This is the webpage-reading product.

### `apps/extension/manifest.json`

Declares permissions, commands, popup, background worker, and content script registration.

### `apps/extension/background.js`

The extension orchestrator.

It handles:

- commands and popup actions
- backend requests
- session persistence
- offscreen audio coordination
- content-script messaging
- on-demand content-script injection for already-open pages
- backend URL configuration

### `apps/extension/offscreen.js`

Owns audio playback for the extension.

It plays the stream, listens to timing events, and reports live progress back to the background worker.

### `apps/extension/content.js`

Runs inside webpages.

It handles:

- text extraction
- click-to-read offsets
- sentence and word highlights
- the floating media controller
- page-level shortcut handling

### `apps/extension/popup.*`

Manual control surface for the extension.

It now includes:

- voice and speed controls
- click-to-read toggle
- backend URL input for local or Render usage

## `packages/reader-core`

Still a future shared-package area.

The repo does not yet move shared offset or segmentation logic there.

## Runtime boundaries that matter most

### Boundary 1: browser rendering vs backend streaming

The browser renders visible text and owns highlight mapping.

The backend owns TTS sessions, audio streaming, and timing events.

### Boundary 2: web app vs extension

They solve the same product problem with different runtime rules.

### Boundary 3: extension internal split

The extension is four cooperating pieces:

- popup
- background service worker
- offscreen document
- content script

## Checkpoint questions

1. Which file would you inspect if pasted text renders but playback does not start?
2. Which file would you inspect if the extension popup can talk to the backend but the page overlay never appears?
3. Which file would you inspect if the Render deployment starts but the app does not boot inside the container?
