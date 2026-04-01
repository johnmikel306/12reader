# 05 - Extension Architecture

The extension is still the hardest part of the repo.

It is not one program. It is several smaller programs working together.

Main files:

- `apps/extension/manifest.json`
- `apps/extension/background.js`
- `apps/extension/offscreen.js`
- `apps/extension/content.js`
- `apps/extension/popup.js`

## The extension parts

### Popup

The toolbar control surface.

Responsibilities:

- show state
- let the user change voice and speed
- let the user set the backend URL
- send actions to the background worker

### Background service worker

The extension coordinator.

Responsibilities:

- handle popup actions and extension commands
- talk to the backend
- persist session state
- inject the content script into already-open pages when needed
- coordinate the offscreen document and content script

### Offscreen document

A hidden extension page that owns audio playback.

Responsibilities:

- play streamed audio
- listen to timing events
- compute live progress
- report playback state back to background

### Content script

Code that runs inside webpages.

Responsibilities:

- extract readable text
- map clicks to reading offsets
- draw sentence and word highlights
- handle the floating media controller
- respond to page-level shortcut input

## Current extension startup paths

### Popup or extension command

```text
User action
-> background ensures content script is ready
-> background gets readable page text
-> background creates page read session
-> background tells offscreen to start audio
-> offscreen streams audio and timing
-> background forwards progress to content script
-> content script updates highlights and controller UI
```

### Page-level shortcut

The content script also listens for `Ctrl/Cmd + U` on normal webpages so playback can start, pause, or resume without reopening the popup.

## Why the backend is configurable now

The extension no longer assumes only one hardcoded local backend.

It can point at:

- local Flask in development
- a Render deployment in production

That makes the extension more usable outside the developer machine.

## Why no-reload attachment matters

Previously, the user could need a page refresh before the extension overlay worked.

The background worker now injects the content script into the current page on demand.

That is a good architecture lesson:

- do not force a user-facing refresh if the platform can attach programmatically

## Why there is a floating media controller

The popup is useful for setup, but it is far from the content.

The in-page controller now acts like a real media surface:

- play and pause
- sentence jump
- short seek jumps
- draggable progress track
- speed and voice controls
- close button that terminates the current reading session

## Keyboard controls to remember

- `Ctrl/Cmd + U` on the page toggles reading
- extension commands still exist for browser-level shortcuts like start-from-top

## Checkpoint questions

1. Why is the offscreen document a better place for audio than the content script?
2. Why does the background worker inject the content script instead of assuming it is always already active?
3. Why is backend URL configuration handled in settings instead of hardcoded in the worker?
