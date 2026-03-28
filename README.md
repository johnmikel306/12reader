# 12reader

12reader is a Flask-based document read-aloud app that lets you upload a file, render it in the browser, click any visible passage, and start listening from that point with streamed speech and synchronized highlighting.

It is built as a simple MVP for a multi-format reader that feels closer to browser read-aloud than a plain text-to-speech demo.

## What it does

- Uploads and reads `pdf`, `docx`, `md`, and `txt` files
- Renders each file in a format-appropriate viewer instead of flattening everything into one raw text block
- Lets you click a word, sentence, or paragraph area to begin reading from that point
- Streams speech from `edge-tts` so playback starts quickly
- Highlights the current word and current sentence while audio plays
- Supports play, pause, resume, stop, voice selection, speed changes, and hot-swapping voice/speed during playback
- Includes keyboard shortcuts and a landing page plus a dedicated reader view

## Supported formats

- `PDF` - rendered with `pdf.js` and read from the PDF text layer
- `DOCX` - rendered with `docx-preview` with best-effort formatting preservation
- `Markdown` - rendered to clean HTML so markdown symbols are not spoken
- `TXT` - displayed as readable paragraphs and lines

## Current UX

- Home page at `/`
- Reader at `/reader`
- Upload a file, wait for rendering, then click anywhere in the document to start reading
- Changing voice or speed during playback restarts the stream from the current reading position
- Speed changes also apply immediately on the client so the response feels instant

## Keyboard shortcuts

- `Space` - pause/resume
- `Esc` - stop
- `[` - previous sentence
- `]` - next sentence

## Tech stack

- Backend: `Flask`
- Streaming TTS: `edge-tts`
- Frontend rendering:
  - `pdf.js` for PDF
  - `docx-preview` for DOCX
  - `marked` + `DOMPurify` for Markdown
- Sync model: streamed MP3 audio plus Server-Sent Events for word timing

## Project structure

```text
12reader/
|- app.py
|- requirements.txt
|- templates/
|  |- landing.html
|  |- index.html
|- static/
|  |- css/
|  |  |- app.css
|  |  |- landing.css
|  |- js/
|     |- app.js
|     |- landing.js
|- uploads/
```

## Getting started

### 1. Create and activate a virtual environment

Git Bash on Windows:

```bash
python -m venv .venv
source .venv/Scripts/activate
```

PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```bash
python -m pip install -r requirements.txt
```

### 3. Start the app

```bash
python app.py
```

Open:

- `http://127.0.0.1:5000/` for the landing page
- `http://127.0.0.1:5000/reader` for the reader directly

## How it works

1. The backend stores the uploaded original document locally in `uploads/`
2. The browser renders the original file in a viewer that matches its format
3. The frontend builds a canonical reading index from the rendered document
4. When you click a location, the frontend sends the reading offset to the backend
5. The backend starts an `edge-tts` session from that point and streams audio
6. Word timing events are sent alongside the stream so the frontend can highlight the active word and sentence

## API overview

- `GET /` - landing page
- `GET /reader` - reader UI
- `POST /api/upload` - upload a supported document
- `GET /api/voices` - fetch available Edge TTS voices
- `GET /api/documents/<document_id>/file` - serve the uploaded original file
- `POST /api/documents/<document_id>/manifest` - save the frontend-built canonical text manifest
- `POST /api/read-sessions` - create a streamed read session from an offset
- `GET /api/read-sessions/<session_id>/audio` - stream MP3 audio
- `GET /api/read-sessions/<session_id>/events` - stream word timing events via SSE
- `DELETE /api/read-sessions/<session_id>` - stop a session

## Limitations

- Scanned or image-only PDFs do not have reliable text-layer click-to-read without OCR
- Very complex PDFs and DOCX files can still produce minor timing or text alignment drift
- Uploaded files and sessions are stored locally/in memory and expire automatically; there is no database persistence
- The app currently depends on an internet connection for `edge-tts` and CDN-hosted frontend libraries
- There is no authentication, multi-user persistence, or production hardening yet

## Development notes

- The backend is intentionally simple and keeps session state in memory
- The frontend does most of the heavy lifting for rendering, click mapping, and highlight sync
- Voice and speed changes during playback are handled by hot-swapping to a new stream from the current reading position

## Quick test flow

1. Start the server
2. Open `/reader`
3. Upload one of each: `pdf`, `docx`, `md`, `txt`
4. Click inside the rendered document to start reading
5. Change speed and voice while playback is active
6. Verify the highlight follows the spoken content
