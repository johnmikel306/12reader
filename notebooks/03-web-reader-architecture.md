# 03 - Web Reader Architecture

This lesson explains the current web reader.

It now supports two source types:

- uploaded documents
- pasted text that lives only for the current browser session

Main files:

- `apps/web/app.py`
- `apps/web/templates/index.html`
- `apps/web/static/js/app.js`

## The two main flows

### Flow A: uploaded document

```text
User uploads file
-> Flask stores original file
-> Browser renders the original file
-> Browser builds canonical text map
-> Browser sends manifest to Flask
-> User clicks or presses play
-> Flask creates read session
-> Audio stream starts
-> Timing events stream over SSE
-> Browser highlights current sentence and word
```

### Flow B: pasted text

```text
User pastes text
-> Browser renders text immediately
-> Browser builds canonical text map
-> User clicks or presses play
-> Flask creates raw-text read session
-> Audio stream starts
-> Timing events stream over SSE
-> Browser highlights current sentence and word
```

## Why the browser still owns rendering

The user cares about the visible reading surface.

That means:

- PDF should still look like PDF pages
- DOCX should keep formatting when possible
- Markdown should become readable HTML
- pasted text should become a readable article surface

The backend should not guess the final visual layout.

## Why uploaded documents use a manifest

For uploaded files, the browser sends a canonical text manifest back to Flask because the browser already knows the exact reading order of the rendered surface.

That keeps highlighting aligned with what the user actually sees.

## Why pasted text skips file storage

Pasted text is intentionally lightweight.

The current design keeps it ephemeral:

- no database storage
- no permanent document record
- no surviving refresh in the browser

The browser simply renders it and asks the backend for a streaming session from raw text.

## Current backend responsibilities

The backend still owns:

- file upload handling
- voice list loading
- read session creation
- audio streaming
- SSE timing events
- runtime config and health endpoints

## Current frontend responsibilities

The frontend owns:

- source-mode selection
- renderer selection
- canonical text mapping
- click-to-read offsets
- highlight drawing
- media progress UI

## Good design lesson here

The web reader did not create a second totally separate app for pasted text.

Instead it reused the same reader surface and most of the same frontend state machine.

That is a strong product-engineering choice:

- keep one UI model
- branch only where the source type truly differs

## Checkpoint questions

1. Why do uploaded files need a manifest route while pasted text does not?
2. Why is pasted text considered ephemeral in the current design?
3. If EPUB support is added later, which part of the pipeline probably changes first?
