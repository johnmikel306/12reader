# 01 - Design Principles In This Repo

Before learning files, learn the ideas.

This repo is not random code. It is built from a small set of design principles.

## 1. Separate responsibilities

A strong system gives different jobs to different parts.

In this repo:

- `apps/web/app.py` owns backend routes, sessions, and `edge-tts`
- `apps/web/static/js/app.js` owns browser rendering, click mapping, and highlighting for uploaded files
- `apps/extension/background.js` owns extension orchestration and persistence
- `apps/extension/offscreen.js` owns audio playback in the extension
- `apps/extension/content.js` owns webpage extraction, click-to-read, overlay UI, and webpage highlights

Why this is good:

- each part is easier to reason about
- bugs are easier to locate
- features can be changed with less damage to the rest of the system

## 2. Put logic where the information lives

This is one of the most important ideas in the repo.

Examples:

- the browser renders the document, so the browser builds the canonical reading map
- the backend owns `edge-tts`, so the backend creates streaming read sessions
- the content script can see webpage DOM, so it owns webpage highlighting
- the offscreen document can play audio in MV3, so it owns extension playback

This is good design because each part works with the data it can actually see.

## 3. Prefer streams over giant one-shot jobs

The app does not wait for full audio generation before playback.

Instead it:

- starts a read session
- streams audio chunks
- streams word timing events
- updates highlight while audio is already playing

This reduces waiting time and improves user experience.

## 4. Keep a clear source of truth

A lot of bugs come from two different parts disagreeing about state.

This repo tries to keep state explicit:

- web app: the frontend owns the canonical text map, the backend owns session streaming
- extension: the offscreen document owns live audio playback, while the background persists durable state in `chrome.storage.session`

Whenever you build systems, ask:

"Which part is the source of truth for this fact?"

Examples of facts:

- current reading offset
- current voice
- whether audio is paused
- which text range is active

## 5. Design for failure, not only success

Real systems fail.

This repo has to survive:

- missing files
- bad document types
- streaming errors
- mismatched offsets
- extension service worker restarts
- webpages that are weird or dynamic

That is why you see:

- cleanup functions
- retry-style logic in highlighting
- session cancellation
- state persistence for extension runtime state

## 6. Build the simple version first

This repo is advanced in behavior, but still simple in structure.

It avoids:

- a database
- React/Vue for the web app
- heavy build tooling for the backend
- too many microservices

That is a design choice.

Good software design is not about making something impressive. It is about making something understandable and useful.

## 7. Match the platform

The web app and the extension solve similar problems, but they do not use the same architecture.

Why?

Because the platform rules are different.

Examples:

- Flask app can hold backend routes and Python TTS logic
- Chrome extension cannot run Python directly
- extension service workers are temporary, so runtime state must be persisted
- offscreen documents are needed for long-lived audio playback in MV3

This is a big architecture lesson:

Do not force the same design everywhere. Respect the platform.

## Checkpoint questions

1. Why is `edge-tts` in the backend instead of in the extension directly?
2. Why does the frontend build the text map instead of the backend building it for every file type?
3. Why is state persistence especially important in the extension?
4. Which parts of the repo feel like UI, and which feel like orchestration?
