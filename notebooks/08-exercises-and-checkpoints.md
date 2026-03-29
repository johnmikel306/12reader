# 08 - Exercises And Checkpoints

These exercises are meant to turn passive reading into active learning.

Do not worry about getting everything perfect. The point is to think.

## Exercise 1: Draw the web app flow

Without looking at the code, draw this pipeline from memory:

- upload
- render
- build canonical text
- create session
- stream audio
- stream events
- highlight

If you can draw it, you understand it better.

## Exercise 2: Name the responsibilities

For each file, write one sentence explaining its job:

- `apps/web/app.py`
- `apps/web/static/js/app.js`
- `apps/extension/background.js`
- `apps/extension/offscreen.js`
- `apps/extension/content.js`

Try to keep each sentence under 20 words.

That forces clarity.

## Exercise 3: Explain one design choice

Pick one of these and explain why the repo does it this way:

- uses streamed audio instead of full generation first
- builds text maps in the frontend
- uses an offscreen document in the extension
- persists extension runtime state in `chrome.storage.session`

## Exercise 4: Reduce the system

Imagine you had only one weekend.

What is the smallest version of this repo you could still build?

Write your answer using:

- features included
- features skipped
- why those tradeoffs are acceptable

## Exercise 5: Add a new feature on paper

Design one of these before coding it:

- previous / next sentence controls
- OCR for scanned PDFs
- save last reading position per document
- side panel UI for the extension

For your chosen feature, answer:

1. Which files change?
2. What new state is needed?
3. What can fail?
4. Which part should own the source of truth?

## Exercise 6: Review the architecture like an engineer

Answer these:

- what is the most fragile part of the repo?
- what is the cleanest part of the repo?
- what would you refactor into `packages/reader-core` first?
- where would you add tests first?

## Exercise 7: Build your own version

Make a folder outside this repo and rebuild a tiny version with only:

- plain text input
- one voice
- one play button
- sentence highlighting

Do not add PDF or extensions yet.

If you can build that mini-version, you will understand the full repo much better.

## Final checkpoint

You are ready to say you understand the repo at a beginner level if you can explain:

1. why the frontend and backend are split the way they are
2. how the app knows what text is currently being spoken
3. why the extension needs background, content, and offscreen parts
4. why state persistence matters in MV3
5. how you would build a smaller version yourself

If you cannot answer those yet, that is okay. Re-read lessons 3 through 6 and try again.
