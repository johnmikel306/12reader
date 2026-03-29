# 06 - Highlighting And Sync

This lesson explains the most magical-looking part of the repo.

How can the app know which word to highlight?

The short answer is:

- build one canonical text string
- map visible text runs into that string
- receive timing events from speech
- convert timing offsets back into visible DOM ranges

That is the whole trick.

## Step 1: Build canonical reading text

Both the web app and the extension build a text representation that acts like a master reading string.

That string is not just raw DOM text pasted together carelessly.

The app inserts separators like:

- spaces
- newlines
- paragraph breaks

This is necessary because visible text comes from many separate DOM nodes.

## Step 2: Store run boundaries

For every visible run of text, the app stores something like:

```text
run = {
  node,
  start,
  end,
  text
}
```

Now the app knows that a node corresponds to a slice of the canonical text.

## Step 3: Segment sentences

The app uses sentence segmentation so it can:

- start from sentence boundaries when needed
- keep the containing sentence highlighted

This is a great example of separating two ideas:

- current word highlight
- current sentence highlight

They are related, but not identical.

## Step 4: Receive spoken timing events

The backend sends events like:

- word text
- start char
- end char
- start time
- end time

The frontend does not guess the current word from audio waveforms.

It uses explicit metadata.

## Step 5: Convert offsets into DOM ranges

Once the app knows the current character range, it can:

- find the corresponding runs
- create a DOM `Range`
- ask the browser for client rectangles
- draw overlay blocks on top of those rectangles

This is why highlighting works even when the text is split across multiple DOM nodes.

## Why overlays are used instead of mutating text

Overlay highlighting is safer because it does not rewrite the original page structure.

That matters for:

- PDFs with text layers
- complex webpage DOM
- dynamic content

It also reduces the chance of breaking the page's own behavior.

## Why sync can fail

Highlighting bugs usually come from one of these problems:

1. the text map and spoken text are not identical
2. timing events arrive late or not at all
3. DOM changed after the map was built
4. state restarted and current progress was lost

This repo has code to reduce those risks, but this is where many subtle bugs live.

## Small pseudocode model

```text
on playback event:
  currentWord = event.char_start..event.char_end
  currentSentence = sentence containing currentWord
  domRangeWord = convertOffsetsToRange(currentWord)
  domRangeSentence = convertOffsetsToRange(currentSentence)
  draw overlays for both
```

That pseudocode is more important than memorizing exact implementation details.

## Architecture lesson

Whenever you need synchronized UI, build:

- a stable model of the content
- a stable model of progress
- a deterministic conversion from progress to UI

If you rely on guesswork, the system will drift.

## Checkpoint questions

1. Why does the app keep both word and sentence ranges?
2. Why are client rectangles useful for highlighting?
3. Why can two different text normalizations break highlighting?
