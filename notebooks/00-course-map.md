# 00 - Course Map

This course teaches the repo in layers.

## Layer 1: Why the repo exists

This repo solves one main product problem:

"Take visible text, speak it aloud quickly, and help the user follow along visually."

There are two versions of that product:

- a web app for uploaded documents
- a Chrome extension for webpages

## Layer 2: What you will learn

By the end of these notes, you should understand:

- how to break a product into components
- how to choose where logic should live
- how frontend and backend cooperate in a streaming app
- how highlighting works without guessing
- why browser extension architecture is different from a normal web app
- how to build a simpler version from scratch

## Lesson order

### `01-design-principles.md`

Learn the software design ideas that show up all over this repo.

### `02-repo-tour.md`

Learn what each folder and major file is responsible for.

### `03-web-reader-architecture.md`

Learn how the document reader works from upload to playback.

### `04-streaming-tts-system.md`

Learn the streaming audio design and why the app uses sessions, SSE, and timing metadata.

### `05-extension-architecture.md`

Learn how the Chrome extension is split across popup, background, offscreen document, and content script.

### `06-highlighting-and-sync.md`

Learn how the app maps spoken words back to visible text.

### `07-build-it-yourself-roadmap.md`

Learn how you would rebuild this step by step as a beginner.

### `08-exercises-and-checkpoints.md`

Use small exercises to prove you understand the ideas.

### `09-visual-architecture-diagrams.md`

See the system as diagrams and flows instead of only words.

### `10-beginner-glossary.md`

Learn the important software and architecture terms used in this repo.

### `11-guided-mini-build.md`

Follow a hands-on path for building a smaller version yourself.

### `12-brand-and-ui-refresh.md`

See naming options, typography ideas, and a cleaner frontend direction for the product.

### `13-current-state.md`

See the current codebase snapshot after the latest product and deployment changes.

This is the quickest notebook to read if you want the repo as it exists now, not only the original teaching sequence.

## Study strategy

If a lesson feels difficult, stop and answer:

1. What problem is this part solving?
2. Why is this part in the frontend instead of the backend?
3. What data enters this part?
4. What data leaves this part?
5. What can fail here?

Those questions are the start of real architecture thinking.
