# 04 - Streaming TTS System Design

This lesson explains the core streaming design shared by the web reader and the extension backend flow.

The most important file is `apps/web/app.py`.

## The main idea

The app does not synthesize a full document, save a complete file, then play it later.

Instead it creates a read session that streams two things in parallel:

- audio chunks
- word timing events

That is the core system design idea.

## Why streaming is better here

If you generate everything first:

- the user waits longer
- pause/resume/jump changes are clumsy
- voice changes are slower
- highlighting is harder to align in real time

If you stream:

- playback starts sooner
- you can cancel old sessions quickly
- you can restart at a new offset quickly
- the UI feels more alive

## The `ReadSession` model

In `apps/web/app.py`, `ReadSession` is the main backend runtime object.

What it stores:

- `session_id`
- `text`
- `start_offset`
- `voice`
- `rate`
- `audio_chunks`
- `events`
- completion flags
- cancellation state

Why this matters:

It packages one unit of work into one object.

That is a common architecture pattern.

## Why there are two streams

### Audio stream

This is what the user hears.

### SSE event stream

This tells the browser which word is being spoken.

Without the second stream, you can play audio, but you cannot do precise follow-along highlighting.

## Why the backend emits character offsets

Highlighting needs location, not just timing.

So the backend tries to match each spoken boundary token back onto the session text and emits:

- `char_start`
- `char_end`
- `time_start`
- `time_end`

That lets the frontend turn speech progress into visible highlights.

## Why session cancellation matters

Imagine the user:

- clicks a new sentence
- changes voice
- changes speed
- stops playback

If old sessions keep running, the app becomes inconsistent.

So the design uses cancellation and replacement, not only new playback.

## Tradeoffs in this system

Every system design has tradeoffs.

### Pros

- responsive playback
- supports live controls
- supports highlighting
- works for both web app and extension backend usage

### Cons

- more moving parts than a static MP3 file
- timing drift can still happen on tricky content
- session state must be managed carefully

## A beginner-friendly sequence diagram

```text
Frontend asks for session
-> Backend creates ReadSession
-> edge-tts streams word boundaries and audio
-> Backend buffers chunks and events
-> Audio endpoint yields MP3 stream
-> Events endpoint yields SSE messages
-> Frontend merges timing with visible text map
-> Frontend highlights spoken word and sentence
```

## Architecture lesson

Whenever you need both media playback and synchronized UI, ask whether you need:

- one stream for media
- one stream for metadata

That pattern appears in many real systems beyond TTS.

## Checkpoint questions

1. Why is one audio stream alone not enough for follow-along reading?
2. Why does the app cancel and replace sessions instead of mutating old ones in place?
3. What kinds of bugs happen if timing metadata and text content disagree?
