# 03 - Web Reader Architecture

This lesson explains the uploaded-document web app.

The main files are:

- `apps/web/app.py`
- `apps/web/templates/index.html`
- `apps/web/static/js/app.js`

## The main workflow

Here is the full flow for the web reader:

```text
User uploads file
-> Flask saves original file
-> Browser renders the original file
-> Browser builds canonical text map from rendered output
-> Browser sends canonical text manifest to Flask
-> User clicks a location or presses play
-> Flask creates read session with edge-tts
-> Audio stream starts
-> Timing events stream over SSE
-> Browser highlights current sentence and word
```

## Why the browser renders the document

This is a very important design choice.

The browser renders the original document because the user wants to read in the original visual structure.

Examples:

- PDF should look like PDF pages
- DOCX should keep formatting as much as possible
- Markdown should become clean HTML, not raw markdown symbols
- TXT should be shown in readable blocks

That is why the frontend uses different renderers for different file types.

## Why the browser builds the canonical text map

The spoken text and the visible text must match.

So the system does this:

- render the real visible content first
- walk the rendered DOM/text layer
- build one canonical text string in reading order
- store mapping from DOM runs to global text offsets

This is better than backend-only extraction because the browser already knows exactly what the user sees.

## Why the backend still matters

The frontend is not doing everything.

The backend still owns:

- file upload storage
- voice list loading
- session creation
- audio stream production
- SSE timing events

That means the browser handles presentation and mapping, while Flask handles streaming speech infrastructure.

## The key web routes

Look at `apps/web/app.py` and find these concepts:

- landing page route
- reader page route
- upload route
- document file route
- manifest route
- read session route
- audio route
- event route

These routes form the public contract between frontend and backend.

## Web design choices worth learning from

### Keep sessions explicit

Instead of "start speaking somehow", the app creates a named read session.

That is useful because sessions can be:

- started
- streamed
- observed
- cancelled

### Keep the frontend stateful, but not too magical

`apps/web/static/js/app.js` keeps the current document, the reading map, the current session, and the highlight state.

That is normal.

The important thing is that the state is named and updated deliberately.

### Keep file rendering per type

The code does not pretend PDF, DOCX, Markdown, and TXT are the same thing.

That is good design.

Different content types deserve different renderers.

## Beginner architecture lesson

When building your own app, do not start with a giant universal abstraction.

Start with:

- one product goal
- one pipeline
- one route per action
- one renderer per file type
- one state object per UI surface

That is exactly the kind of structure you see here.

## Checkpoint questions

1. Why does the browser send a text manifest back to Flask instead of Flask generating all display text itself?
2. Why is click-to-read easier when the frontend owns the text map?
3. If you wanted to support EPUB next, would you add it to the backend first or the frontend first?
