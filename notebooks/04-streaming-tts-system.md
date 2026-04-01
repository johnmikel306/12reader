# 04 - Streaming TTS System Design

This lesson explains the streaming design shared by the web reader and the extension backend flow.

The main backend file is `apps/web/app.py`.

## Main idea

Cadence creates a read session and streams two things in parallel:

- MP3 audio
- word timing events over SSE

That is true whether the source started as:

- an uploaded document
- pasted text in the web reader
- webpage text collected by the extension

## Why streaming fits this product

Streaming makes it easy to:

- start playback quickly
- restart from a new offset
- hot-swap voice or speed
- keep the highlight UI synchronized

## Current session entry points

### `POST /api/read-sessions`

Used when the source is an uploaded document that already has a frontend-built manifest.

### `POST /api/page-read-sessions`

Used when the source is raw text.

Examples:

- pasted text in the web reader
- webpage text from the extension

## Why audio and events are separate streams

Audio alone tells the browser what to play.

Timing events tell the browser what to highlight.

Both are needed for a real follow-along reading experience.

## Why offsets matter

The backend emits:

- `char_start`
- `char_end`
- `time_start`
- `time_end`

The frontend then maps those offsets back onto the visible text surface.

That is the core contract between speech and highlighting.

## Why cancellation still matters

Sessions are frequently replaced when the user:

- clicks a different sentence
- drags the seek bar
- changes voice
- changes speed
- stops playback

The system stays sane because it cancels and replaces sessions instead of letting old ones continue in the background.

## Deployment note

The same backend serves:

- local development
- the extension when pointed at localhost
- production deployment on Render

The streaming model stays the same in each environment.

## Checkpoint questions

1. Why is one MP3 stream not enough for highlighting?
2. Why does the app use two session entry points instead of forcing everything through file upload?
3. What bugs appear if the session text and the frontend text map disagree?
