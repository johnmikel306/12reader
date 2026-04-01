# Cadence

Cadence is a reading product with two surfaces:

- a Flask web reader for uploaded documents and session-only pasted text
- a Chrome extension for reading webpages aloud

## What it does

- streams `edge-tts` audio and timing events
- highlights the current sentence and word
- lets the user start from a clicked passage
- supports voice and speed changes during playback
- includes a floating media controller in the extension
- ships with a Dockerfile for Render deployment

## Repo layout

```text
cadence/
|- app.py
|- requirements.txt
|- Dockerfile
|- apps/
|  |- web/
|  |- extension/
|- notebooks/
```

## Run locally

```bash
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -r requirements.txt
python app.py
```

Open:

- `http://127.0.0.1:5000/`
- `http://127.0.0.1:5000/reader`

## Extension

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click `Load unpacked`
4. Select `apps/extension`
5. Set the backend URL in the popup

Use:

- `http://127.0.0.1:5000` for local development
- your Render app URL in production

## Checks

```bash
npm run check:web
npm run check:extension
```

## Deploy to Render

- deploy the repo with the included `Dockerfile`
- set `CADENCE_PUBLIC_BASE_URL=https://your-app.onrender.com`

## Notes

- uploaded files and pasted text are ephemeral in the current setup
- refreshing the web reader clears pasted text
- restarting the app clears in-memory reading sessions
