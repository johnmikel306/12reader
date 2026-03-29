# 05 - Extension Architecture

This is the hardest part of the repo, so read slowly.

The extension is not one program. It is several small programs working together.

Main files:

- `apps/extension/manifest.json`
- `apps/extension/background.js`
- `apps/extension/offscreen.js`
- `apps/extension/content.js`
- `apps/extension/popup.js`

## The extension parts

### Popup

What the user clicks from the browser toolbar.

Responsibilities:

- show controls
- show current state
- send user actions to background

### Background service worker

The main extension coordinator.

Responsibilities:

- handle commands
- handle popup actions
- talk to backend
- persist session state
- talk to content script and offscreen document

### Offscreen document

A hidden extension page that can own audio playback.

Responsibilities:

- play streamed audio
- listen to timing events
- compute current progress
- report playback state back to background

### Content script

Code injected into webpages.

Responsibilities:

- read visible DOM text
- map click locations to offsets
- draw overlay highlights
- show floating controls on the page

## Why the extension needs all these pieces

Because Manifest V3 has rules.

Important constraint:

- the background service worker can shut down when idle

That is why you cannot safely keep all runtime state only in background memory.

This repo solves that by:

- persisting state in `chrome.storage.session`
- letting the offscreen document report live playback state back when needed

## Extension data flow

### Start from popup or keyboard shortcut

```text
User action
-> background asks content script for readable text
-> background calls Flask backend to create page read session
-> background tells offscreen document to start audio
-> offscreen streams audio and events
-> offscreen reports progress back to background
-> background forwards progress to content script
-> content script highlights webpage text
```

### Pause or resume

```text
User action
-> background rehydrates state if needed
-> background tells offscreen to pause or resume
-> offscreen updates playback state
-> background persists new state
-> content script floating controls stay in sync
```

## Why the extension uses the Flask backend

Because the extension wants `edge-tts`, and `edge-tts` is Python.

So the extension is really a client of the local Flask app.

That means:

- the backend must be running
- the extension reads pages locally but outsources TTS generation to the backend

## Why there is a floating controller

This is a product design decision.

The popup is useful, but it is far away from the content.

The floating controller keeps controls near the reading experience.

This is a good UX lesson:

put the most common controls near the user's current focus.

## Why there are keyboard shortcuts

Shortcuts reduce friction.

They are especially useful for accessibility and power users.

In this repo, the extension now uses commands for:

- start reading from the top
- pause/resume toggle

## Architecture lesson

When building browser extensions, always ask:

- what code needs page DOM access?
- what code needs browser APIs?
- what code needs long-lived audio or media?
- what state must survive worker restarts?

Those answers usually tell you how to split the extension.

## Checkpoint questions

1. Why is webpage highlighting not done in the background script?
2. Why is audio playback not done in the content script?
3. Why is `chrome.storage.session` valuable here?
