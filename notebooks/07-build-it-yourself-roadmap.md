# 07 - Build It Yourself Roadmap

If you were starting from zero, do not try to build the full repo at once.

Build it in stages.

## Stage 1: Small text reader

Build a tiny page where the user pastes plain text and the app reads it aloud.

Learn:

- a basic Flask route
- a simple frontend form
- a simple audio playback loop

Goal:

- do not think about PDF, DOCX, or Chrome extensions yet

## Stage 2: Add streamed speech

Use `edge-tts` and stream audio instead of generating a giant file first.

Learn:

- what a session is
- how a streaming endpoint works
- how cancellation works

## Stage 3: Add word timing metadata

Make the backend send timing events.

Learn:

- why media and metadata can be separate streams
- how the frontend reacts to progress updates

## Stage 4: Add highlighting for plain text

Before complex documents, make highlighting work on a simple text block.

Learn:

- sentence segmentation
- offsets
- DOM ranges
- overlay highlights

## Stage 5: Add one real document type

Add PDF first.

Learn:

- rendering a real document in the browser
- reading from visible text rather than only extracted backend text

## Stage 6: Add restartable playback

Support:

- click-to-read
- pause
- stop
- voice change
- speed change

Learn:

- state machines
- session replacement
- current offset tracking

## Stage 7: Add more file types

Add:

- DOCX
- Markdown
- TXT

Learn:

- format-specific rendering
- consistent canonical text mapping across formats

## Stage 8: Add the extension

Only after you understand the web app.

Learn:

- content scripts
- service workers
- offscreen documents
- browser extension state persistence

## Beginner-friendly build order for this repo specifically

If you want to truly rebuild this repo as practice, do it in this order:

1. Flask app with one route and one HTML page
2. Text upload and plain text reading
3. `edge-tts` streaming with one session object
4. plain-text word highlighting
5. PDF rendering with click-to-read
6. DOCX / Markdown / TXT rendering
7. hot-swapping voice and speed
8. webpage extension with popup only
9. offscreen playback and page highlighting
10. floating controls and keyboard shortcuts

## Important rule for novices

Never add two hard things at once.

Bad example:

- add PDF rendering and extension support on the same day

Good example:

- first get highlighting right on plain text
- then move that idea into PDFs

## Checkpoint questions

1. Which stage feels easiest for you right now?
2. Which stage feels most confusing?
3. If you had to remove 70 percent of the complexity, what would your first mini-version include?
