# 09 - Visual Architecture Diagrams

These diagrams show the current repo as simple text pictures.

## 1. Whole monorepo view

```text
Cadence monorepo
|
|- app.py
|- Dockerfile
|- apps/web
|  |- Flask backend
|  |- templates
|  |- frontend JS/CSS
|
|- apps/extension
|  |- popup
|  |- background service worker
|  |- offscreen audio document
|  |- content script
|
|- notebooks
```

## 2. Web app high-level architecture

```text
User
-> /reader
-> web frontend JS
-> Flask API
-> edge-tts

Then back:

edge-tts
-> Flask read session
-> audio stream + SSE events
-> browser audio + highlight UI
```

## 3. Web app source paths

```text
Source path A
Upload file
-> /api/upload
-> browser renderer
-> manifest route
-> /api/read-sessions

Source path B
Paste text
-> browser renderer
-> /api/page-read-sessions
```

## 4. Web app source of truth map

```text
Frontend owns:
- rendered surface
- text mapping
- click offsets
- highlights

Backend owns:
- uploaded files
- voices
- read sessions
- audio stream
- timing events
```

## 5. Extension architecture

```text
Popup <-> Background service worker <-> Offscreen document
                     |
                     v
                Content script <-> Webpage DOM
                     |
                     v
             Configured backend -> edge-tts
```

## 6. Extension attach flow

```text
User opens popup or presses shortcut
-> background pings content script
-> if missing, background injects content.js
-> content script becomes ready
-> normal reading flow continues
```

## 7. Extension playback flow

```text
User action
-> background gets readable page text
-> background POSTs /api/page-read-sessions
-> backend creates session
-> background tells offscreen to start session
-> offscreen loads audio + event stream
-> offscreen computes spoken offset
-> background receives progress
-> background forwards progress to content script
-> content script updates highlights and media controls
```

## 8. Floating controller surface

```text
Floating controller
- close / terminate
- jump back / previous sentence
- play / pause
- next sentence / jump forward
- seek bar
- speed select
- voice select
```

## 9. Highlighting model

```text
Visible text nodes
-> canonical reading string
-> offset map
-> speech timing event arrives
-> character range resolved
-> DOM range reconstructed
-> rectangles measured
-> overlay blocks drawn
```

## 10. Failure map

```text
Possible failure
-> likely area to inspect

Pasted text renders but will not play
-> web frontend session request branch

Extension popup works but page overlay does not appear
-> background injection path + content script readiness

Audio plays but highlights drift
-> timing events + offset mapping

Render deploy boots but extension still hits localhost
-> extension backend URL setting
```
