# 10 - Beginner Glossary

This glossary explains the main terms used in this repo in simple language.

## API

A defined way for one part of the system to ask another part to do something.

Example in this repo:

- the frontend calls `/api/read-sessions`

## Architecture

The high-level structure of a system: what parts exist, what they do, and how they talk.

## Backend

The server-side part of the app.

In this repo, Flask is the backend.

## Canonical text

The single master text string used for reading and highlighting.

The app builds this so spoken progress can be mapped back to visible text.

## Content script

A browser extension script that runs inside webpages.

In this repo, it extracts webpage text and draws webpage highlights.

## DOM

The browser's object representation of the page.

If HTML is the source, DOM is the live structure JavaScript works with.

## Event stream

A continuous flow of small messages over time.

In this repo, SSE is used to send timing events while audio is playing.

## Extension service worker

The background brain of a Manifest V3 extension.

Important: it can stop when idle, so you cannot trust global memory forever.

## Flask

A lightweight Python web framework used for the backend.

## Frontend

The part running in the browser that the user sees and interacts with.

## Highlight overlay

A visual layer drawn on top of text instead of rewriting the text itself.

## Hot-swap

Changing active playback settings like voice or speed by restarting from the current offset quickly.

## Manifest V3

The current Chrome extension platform model.

It has stricter rules than old extensions, especially around service workers and background behavior.

## Monorepo

One repo that contains multiple apps or packages.

This repo contains both a web app and a Chrome extension.

## Offscreen document

A hidden extension page used for work that needs a document context, like media playback.

In this repo, it plays streamed audio for the extension.

## Offset

A position inside a string.

If the current spoken word begins at character 120, then 120 is an offset.

## Orchestration

Coordinating multiple components so they work together.

The extension background script is mainly an orchestrator.

## Renderer

The code or library that turns file data into visible content.

Examples:

- `pdf.js`
- `docx-preview`

## Route

A backend URL endpoint.

Example:

- `POST /api/page-read-sessions`

## Session

A named unit of runtime work.

In this repo, a read session represents one active streaming TTS run.

## SSE

Server-Sent Events.

A browser-friendly way for the server to push messages to the client over time.

## Source of truth

The part of the system that should be considered the authoritative owner of a piece of data.

## State

The current facts the program needs to remember.

Examples:

- current voice
- whether playback is paused
- current reading offset

## Streaming

Sending data in pieces while it is being produced instead of waiting for all of it first.

## System design

Designing how multiple parts of a system work together at a higher level.

## TTS

Text-to-speech.

Turning text into spoken audio.

## Webhook

Not used in this repo right now, but useful to know: a webhook is a server-to-server callback triggered by an event.

## Worker thread

A separate execution thread for background work.

In this repo, backend sessions use threads to stream TTS work without blocking everything else.

## Suggested exercise

Pick 10 terms from this glossary and explain them without looking.

If you struggle, that is normal. Repeat until they start to feel natural.
