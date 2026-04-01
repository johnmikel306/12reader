(function () {
    const BLOCK_TAGS = new Set([
        "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIGCAPTION", "FIGURE",
        "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN",
        "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "UL"
    ]);

    const SKIP_TAGS = new Set([
        "AUDIO", "BUTTON", "CANVAS", "DATALIST", "IFRAME", "IMG", "INPUT", "METER", "NOSCRIPT",
        "OPTION", "PROGRESS", "SCRIPT", "SELECT", "STYLE", "SVG", "TEXTAREA", "VIDEO"
    ]);

    const LAYOUT_SKIP_TAGS = new Set(["HEADER", "NAV", "FOOTER", "ASIDE"]);
    const RATE_STEPS = ["-25%", "+0%", "+25%", "+50%"];
    const RATE_LABELS = {
        "-25%": "0.75x",
        "+0%": "1.0x",
        "+25%": "1.25x",
        "+50%": "1.5x"
    };
    const OVERLAY_ID = "twelve-reader-overlay";
    const STYLE_ID = "twelve-reader-style";
    const TOAST_ID = "twelve-reader-toast";
    const CONTROLLER_ID = "twelve-reader-controller";
    const CONTROLLER_TITLE_ID = "twelve-reader-controller-title";
    const CONTROLLER_SUBTITLE_ID = "twelve-reader-controller-subtitle";
    const CONTROLLER_STATUS_ID = "twelve-reader-controller-status";
    const CONTROLLER_CURRENT_TIME_ID = "twelve-reader-controller-current-time";
    const CONTROLLER_TOTAL_TIME_ID = "twelve-reader-controller-total-time";
    const CONTROLLER_SEEK_ID = "twelve-reader-controller-seek";
    const CONTROLLER_SPEED_ID = "twelve-reader-controller-speed";
    const CONTROLLER_VOICE_ID = "twelve-reader-controller-voice";
    const CONTROLLER_CLOSE_ID = "twelve-reader-controller-close";
    const CONTROLLER_REWIND_ID = "twelve-reader-controller-rewind";
    const CONTROLLER_PREVIOUS_ID = "twelve-reader-controller-previous";
    const CONTROLLER_TOGGLE_ID = "twelve-reader-controller-toggle";
    const CONTROLLER_NEXT_ID = "twelve-reader-controller-next";
    const CONTROLLER_FORWARD_ID = "twelve-reader-controller-forward";
    const CONTROLLER_STOP_ID = "twelve-reader-controller-stop";

    const state = {
        clickMode: false,
        readingMap: null,
        dirty: true,
        activeSentenceRange: null,
        activeWordRange: null,
        readerState: null,
        availableVoices: [],
        voicesPromise: null,
        voiceLoadErrorShown: false,
        mutationObserver: null,
        resizeScheduled: false,
        isScrubbing: false,
        scrubRatio: 0
    };

    injectStyles();
    installMutationObserver();
    bindEvents();
    syncInitialState();

    async function syncInitialState() {
        try {
            const response = await chrome.runtime.sendMessage({ type: "CONTENT_READY" });
            if (response && response.ok && response.state) {
                state.clickMode = Boolean(response.state.clickMode);
                updateClickModeMarker();
                applyReaderState(response.state);
            }
        } catch (error) {
            // Ignore when the background worker is temporarily unavailable.
        }
    }

    function bindEvents() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            handleMessage(message)
                .then((result) => sendResponse(result || { ok: true }))
                .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
            return true;
        });

        document.addEventListener("click", onDocumentClick, true);
        document.addEventListener("keydown", onDocumentKeyDown, true);
        window.addEventListener("scroll", scheduleHighlightRedraw, { passive: true });
        window.addEventListener("resize", scheduleHighlightRedraw, { passive: true });
    }

    async function onDocumentKeyDown(event) {
        if (!isPlaybackShortcut(event)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        try {
            const response = await chrome.runtime.sendMessage({ type: "FLOATING_TOGGLE_PLAYBACK" });
            if (!response || !response.ok) {
                throw new Error(response?.error || "Playback control failed.");
            }
            if (response.state) {
                applyReaderState(response.state);
            }
        } catch (error) {
            showToast(error.message || "Playback control failed.");
        }
    }

    function isPlaybackShortcut(event) {
        if (!event || event.defaultPrevented || event.repeat) {
            return false;
        }

        if (event.altKey || event.shiftKey) {
            return false;
        }

        if (!(event.ctrlKey || event.metaKey)) {
            return false;
        }

        if ((event.key || "").toLowerCase() !== "u") {
            return false;
        }

        return !isEditableTarget(event.target);
    }

    function isEditableTarget(target) {
        const element = target instanceof Element ? target : target?.parentElement;
        if (!element) {
            return false;
        }

        if (element.closest("input, textarea, select, [contenteditable]")) {
            return true;
        }

        return element instanceof HTMLElement && element.isContentEditable;
    }

    async function handleMessage(message) {
        switch (message.type) {
            case "GET_READING_SNAPSHOT": {
                const readingMap = buildOrReuseReadingMap();
                return {
                    ok: true,
                    text: readingMap.text,
                    url: location.href,
                    title: document.title
                };
            }

            case "CONTENT_PING":
                return { ok: true };

            case "SET_CLICK_MODE":
                state.clickMode = Boolean(message.enabled);
                updateClickModeMarker();
                showToast(state.clickMode ? "Cadence click-to-read enabled" : "Cadence click-to-read disabled");
                return { ok: true };

            case "READER_STATE_UPDATED":
                applyReaderState(message.state || null);
                return { ok: true };

            case "READER_STARTED":
                buildOrReuseReadingMap();
                if (state.readerState) {
                    state.readerState.currentOffset = Number(message.startOffset) || 0;
                    syncFloatingControllerProgress(state.readerState);
                }
                return { ok: true };

            case "READING_PROGRESS":
                buildOrReuseReadingMap();
                if (!highlightOffset(message.absoluteOffset || 0)) {
                    state.dirty = true;
                    buildOrReuseReadingMap();
                    highlightOffset(message.absoluteOffset || 0);
                }
                if (state.readerState) {
                    state.readerState.currentOffset = message.resumeOffset || message.absoluteOffset || 0;
                    syncFloatingControllerProgress(state.readerState);
                }
                return { ok: true };

            case "READING_DONE":
                scheduleHighlightRedraw();
                showToast("Cadence finished this page");
                return { ok: true };

            case "CLEAR_READER":
                clearHighlights();
                hideFloatingController();
                return { ok: true };

            default:
                return { ok: true };
        }
    }

    async function onDocumentClick(event) {
        const targetElement = event.target instanceof Element ? event.target : event.target?.parentElement;

        if (!state.clickMode) {
            return;
        }

        if (event.defaultPrevented) {
            return;
        }

        if (!targetElement) {
            return;
        }

        if (targetElement.closest(`#${OVERLAY_ID}`) || targetElement.closest(`#${CONTROLLER_ID}`)) {
            return;
        }

        if (targetElement.closest("input, textarea, select, button")) {
            return;
        }

        const readingMap = buildOrReuseReadingMap();
        if (!readingMap.text.trim()) {
            return;
        }

        const offset = getOffsetFromPoint(event.clientX, event.clientY, targetElement, readingMap);
        if (offset == null) {
            return;
        }

        if (targetElement.closest("a")) {
            event.preventDefault();
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        try {
            const response = await chrome.runtime.sendMessage({
                type: "PAGE_CLICK_READING_REQUEST",
                offset,
                text: readingMap.text
            });

            if (!response || !response.ok) {
                throw new Error(response?.error || "Could not start webpage reading.");
            }
        } catch (error) {
            showToast(error.message || "Cadence could not start reading here.");
        }
    }

    function buildOrReuseReadingMap() {
        if (!state.dirty && state.readingMap) {
            return state.readingMap;
        }

        const textNodes = collectReadableTextNodes();
        const runs = [];
        const runLookup = new WeakMap();
        const blockCache = new WeakMap();
        let text = "";
        let previousNode = null;

        textNodes.forEach((node) => {
            const nodeText = node.nodeValue || "";
            if (!nodeText.trim()) {
                return;
            }

            const separator = determineSeparator(previousNode, node, blockCache);
            text += separator;

            const start = text.length;
            text += nodeText;
            const end = text.length;

            const run = {
                node,
                start,
                end,
                text: nodeText,
                element: node.parentElement
            };
            runs.push(run);
            runLookup.set(node, run);
            previousNode = node;
        });

        state.readingMap = {
            text,
            runs,
            runLookup,
            wordCount: countWords(text),
            sentenceRanges: buildSentenceRanges(text)
        };
        state.dirty = false;
        return state.readingMap;
    }

    function collectReadableTextNodes() {
        const body = document.body;
        if (!body) {
            return [];
        }

        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.parentElement) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (!node.nodeValue || !node.nodeValue.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (isInsideOverlay(node.parentElement)) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (isInsideSkippedElement(node.parentElement)) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (!isElementVisible(node.parentElement)) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const nodes = [];
        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }
        return nodes;
    }

    function isInsideOverlay(element) {
        return Boolean(element.closest(`#${OVERLAY_ID}`));
    }

    function isInsideSkippedElement(element) {
        let current = element;
        while (current && current !== document.body) {
            if (SKIP_TAGS.has(current.tagName)) {
                return true;
            }

            if (current.getAttribute("aria-hidden") === "true") {
                return true;
            }

            if (current.isContentEditable) {
                return true;
            }

            if (LAYOUT_SKIP_TAGS.has(current.tagName) && !current.closest("main, article")) {
                return true;
            }

            current = current.parentElement;
        }

        return false;
    }

    function isElementVisible(element) {
        let current = element;
        while (current && current !== document.body) {
            const styles = window.getComputedStyle(current);
            if (styles.display === "none" || styles.visibility === "hidden") {
                return false;
            }
            current = current.parentElement;
        }
        return true;
    }

    function determineSeparator(previousNode, currentNode, blockCache) {
        if (!previousNode) {
            return "";
        }

        const previousBlock = findLogicalBlock(previousNode.parentElement, blockCache);
        const currentBlock = findLogicalBlock(currentNode.parentElement, blockCache);
        const between = getTextBetween(previousNode, currentNode);

        if (previousBlock !== currentBlock) {
            if (/\n{2,}/.test(between)) {
                return "\n\n";
            }
            if (/\n/.test(between)) {
                return "\n";
            }
            return "\n\n";
        }

        if (/\n{2,}/.test(between)) {
            return "\n\n";
        }
        if (/\n/.test(between)) {
            return "\n";
        }
        if (/\s/.test(between)) {
            return " ";
        }

        return "";
    }

    function findLogicalBlock(element, cache) {
        if (!element) {
            return document.body;
        }

        if (cache.has(element)) {
            return cache.get(element);
        }

        let current = element;
        while (current && current !== document.body) {
            if (BLOCK_TAGS.has(current.tagName)) {
                cache.set(element, current);
                return current;
            }

            const display = window.getComputedStyle(current).display;
            if (display === "block" || display === "list-item" || display === "table-cell" || display === "table-row") {
                cache.set(element, current);
                return current;
            }

            current = current.parentElement;
        }

        cache.set(element, document.body);
        return document.body;
    }

    function getTextBetween(previousNode, currentNode) {
        try {
            const range = document.createRange();
            range.setStartAfter(previousNode);
            range.setEndBefore(currentNode);
            return range.toString();
        } catch (error) {
            return "";
        }
    }

    function getOffsetFromPoint(clientX, clientY, target, readingMap) {
        if (document.caretPositionFromPoint) {
            const caret = document.caretPositionFromPoint(clientX, clientY);
            if (caret) {
                const offset = convertNodeOffsetToGlobal(caret.offsetNode, caret.offset, readingMap);
                if (offset != null) {
                    return offset;
                }
            }
        }

        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(clientX, clientY);
            if (range) {
                const offset = convertNodeOffsetToGlobal(range.startContainer, range.startOffset, readingMap);
                if (offset != null) {
                    return offset;
                }
            }
        }

        return findOffsetFromTarget(target, readingMap);
    }

    function convertNodeOffsetToGlobal(node, localOffset, readingMap) {
        if (!node) {
            return null;
        }

        const directRun = readingMap.runLookup.get(node);
        if (directRun) {
            return clamp(directRun.start + localOffset, directRun.start, directRun.end);
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const childTextNode = resolveClosestTextNode(node, localOffset);
            if (!childTextNode) {
                return null;
            }
            const run = readingMap.runLookup.get(childTextNode);
            if (!run) {
                return null;
            }
            return clamp(run.start + localOffset, run.start, run.end);
        }

        return null;
    }

    function resolveClosestTextNode(node, localOffset) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node;
        }

        const children = node.childNodes;
        if (!children.length) {
            return null;
        }

        const clampedIndex = clamp(localOffset, 0, children.length - 1);
        const directChild = children[clampedIndex] || children[clampedIndex - 1];
        if (!directChild) {
            return null;
        }

        if (directChild.nodeType === Node.TEXT_NODE) {
            return directChild;
        }

        const walker = document.createTreeWalker(directChild, NodeFilter.SHOW_TEXT);
        return walker.nextNode();
    }

    function findOffsetFromTarget(target, readingMap) {
        if (!(target instanceof Node)) {
            return null;
        }

        const run = readingMap.runs.find((candidate) => candidate.element && candidate.element.contains(target));
        return run ? run.start : null;
    }

    function buildSentenceRanges(text) {
        const ranges = [];

        if (window.Intl && Intl.Segmenter) {
            const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
            for (const segment of segmenter.segment(text)) {
                const trimmed = trimRange(text, segment.index, segment.index + segment.segment.length);
                if (trimmed) {
                    ranges.push(trimmed);
                }
            }
        }

        if (ranges.length) {
            return ranges;
        }

        const fallback = text.matchAll(/[^.!?\n]+(?:[.!?]+|\n+|$)/g);
        for (const match of fallback) {
            const start = match.index || 0;
            const end = start + match[0].length;
            const trimmed = trimRange(text, start, end);
            if (trimmed) {
                ranges.push(trimmed);
            }
        }

        if (!ranges.length && text.trim()) {
            return [{ start: 0, end: text.length }];
        }

        return ranges;
    }

    function trimRange(text, start, end) {
        let safeStart = start;
        let safeEnd = end;

        while (safeStart < safeEnd && /\s/.test(text[safeStart])) {
            safeStart += 1;
        }
        while (safeEnd > safeStart && /\s/.test(text[safeEnd - 1])) {
            safeEnd -= 1;
        }

        if (safeEnd <= safeStart) {
            return null;
        }

        return { start: safeStart, end: safeEnd };
    }

    function findSentenceForOffset(offset, sentenceRanges) {
        for (let index = 0; index < sentenceRanges.length; index += 1) {
            const range = sentenceRanges[index];
            if (offset >= range.start && offset < range.end) {
                return range;
            }
        }

        if (sentenceRanges.length && offset >= sentenceRanges[sentenceRanges.length - 1].end) {
            return sentenceRanges[sentenceRanges.length - 1];
        }

        return sentenceRanges[0] || null;
    }

    function findWordRangeAtOffset(text, offset) {
        const safeLength = text.length;
        if (!safeLength) {
            return null;
        }

        let cursor = clamp(offset, 0, safeLength - 1);
        while (cursor < safeLength && /\s/.test(text[cursor])) {
            cursor += 1;
        }
        if (cursor >= safeLength) {
            cursor = safeLength - 1;
        }

        let start = cursor;
        while (start > 0 && isWordCharacter(text[start - 1])) {
            start -= 1;
        }

        let end = cursor;
        while (end < safeLength && isWordCharacter(text[end])) {
            end += 1;
        }

        if (start === end) {
            start = cursor;
            while (start > 0 && !/\s/.test(text[start - 1]) && !isBoundaryPunctuation(text[start - 1])) {
                start -= 1;
            }
            end = cursor;
            while (end < safeLength && !/\s/.test(text[end]) && !isBoundaryPunctuation(text[end])) {
                end += 1;
            }
        }

        if (end <= start) {
            return null;
        }

        return { start, end };
    }

    function isWordCharacter(character) {
        return /[\p{L}\p{N}'-]/u.test(character);
    }

    function isBoundaryPunctuation(character) {
        return /[.,;:!?()[\]{}]/.test(character);
    }

    function highlightOffset(offset) {
        const readingMap = buildOrReuseReadingMap();
        const wordRange = findWordRangeAtOffset(readingMap.text, offset);
        const sentenceRange = findSentenceForOffset(offset, readingMap.sentenceRanges);

        state.activeWordRange = wordRange;
        state.activeSentenceRange = sentenceRange;
        const drewHighlights = redrawHighlights();
        scrollSentenceIntoView(sentenceRange, readingMap);
        return drewHighlights;
    }

    function redrawHighlights() {
        clearOverlayBlocks();

        if (!state.activeSentenceRange && !state.activeWordRange) {
            return false;
        }

        positionOverlay();
        const readingMap = buildOrReuseReadingMap();
        let drawnBlocks = 0;

        if (state.activeSentenceRange) {
            drawnBlocks += drawRangeRects(readingMap, state.activeSentenceRange, "twelve-reader-highlight sentence");
        }
        if (state.activeWordRange) {
            drawnBlocks += drawRangeRects(readingMap, state.activeWordRange, "twelve-reader-highlight word");
        }

        return drawnBlocks > 0;
    }

    function drawRangeRects(readingMap, rangeLike, className) {
        const range = createDomRange(readingMap.runs, rangeLike.start, rangeLike.end);
        if (!range) {
            return 0;
        }

        const overlay = ensureOverlay();
        const fragment = document.createDocumentFragment();
        let drawnBlocks = 0;
        Array.from(range.getClientRects()).forEach((rect) => {
            if (rect.width < 1 || rect.height < 1) {
                return;
            }

            const block = document.createElement("div");
            block.className = className;
            block.style.left = `${rect.left + window.scrollX}px`;
            block.style.top = `${rect.top + window.scrollY}px`;
            block.style.width = `${rect.width}px`;
            block.style.height = `${rect.height}px`;
            fragment.appendChild(block);
            drawnBlocks += 1;
        });

        overlay.appendChild(fragment);
        return drawnBlocks;
    }

    function createDomRange(runs, start, end) {
        if (!runs.length) {
            return null;
        }

        const maxOffset = runs[runs.length - 1].end;
        const safeStart = clamp(start, 0, maxOffset);
        const safeEnd = clamp(end, safeStart, maxOffset);
        if (safeEnd <= safeStart) {
            return null;
        }

        const startPosition = resolveOffsetPosition(runs, safeStart, "forward");
        const endPosition = resolveOffsetPosition(runs, safeEnd, "backward");
        if (!startPosition || !endPosition) {
            return null;
        }

        try {
            const range = document.createRange();
            range.setStart(startPosition.node, startPosition.offset);
            range.setEnd(endPosition.node, endPosition.offset);
            return range.collapsed ? null : range;
        } catch (error) {
            return null;
        }
    }

    function resolveOffsetPosition(runs, offset, bias) {
        let low = 0;
        let high = runs.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const run = runs[mid];
            if (offset < run.start) {
                high = mid - 1;
            } else if (offset >= run.end) {
                low = mid + 1;
            } else {
                return {
                    node: run.node,
                    offset: offset - run.start
                };
            }
        }

        if (bias === "forward") {
            const run = runs[Math.min(low, runs.length - 1)];
            return { node: run.node, offset: 0 };
        }

        const run = runs[Math.max(high, 0)];
        return { node: run.node, offset: run.text.length };
    }

    function clearHighlights() {
        state.activeSentenceRange = null;
        state.activeWordRange = null;
        clearOverlayBlocks();
    }

    function clearOverlayBlocks() {
        const overlay = ensureOverlay();
        overlay.innerHTML = "";
    }

    function ensureOverlay() {
        let overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = OVERLAY_ID;
            overlay.setAttribute("aria-hidden", "true");
            document.documentElement.appendChild(overlay);
        }
        positionOverlay();
        return overlay;
    }

    function positionOverlay() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) {
            return;
        }

        overlay.style.width = `${Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)}px`;
        overlay.style.height = `${Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)}px`;
    }

    function scrollSentenceIntoView(sentenceRange, readingMap) {
        if (!sentenceRange) {
            return;
        }

        const range = createDomRange(readingMap.runs, sentenceRange.start, sentenceRange.end);
        if (!range) {
            return;
        }

        const rect = range.getBoundingClientRect();
        const viewportPadding = 120;
        if (rect.top < viewportPadding || rect.bottom > window.innerHeight - viewportPadding) {
            const top = rect.top + window.scrollY - viewportPadding;
            window.scrollTo({ top, behavior: "smooth" });
        }
    }

    function scheduleHighlightRedraw() {
        if (state.resizeScheduled) {
            return;
        }

        state.resizeScheduled = true;
        window.requestAnimationFrame(() => {
            state.resizeScheduled = false;
            if (state.activeSentenceRange || state.activeWordRange) {
                redrawHighlights();
            }
        });
    }

    function installMutationObserver() {
        if (!document.body) {
            return;
        }

        state.mutationObserver = new MutationObserver(() => {
            state.dirty = true;
        });

        state.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function updateClickModeMarker() {
        document.documentElement.toggleAttribute("data-twelve-reader-click-mode", state.clickMode);
    }

    function applyReaderState(readerState) {
        const previousBackendBaseUrl = state.readerState?.backendBaseUrl || "";
        state.readerState = readerState || null;
        if (readerState && previousBackendBaseUrl !== (readerState.backendBaseUrl || "")) {
            state.availableVoices = [];
            state.voicesPromise = null;
            state.voiceLoadErrorShown = false;
        }
        updateFloatingController(readerState || null);
    }

    function updateFloatingController(readerState) {
        const shouldShow = Boolean(readerState && (readerState.isSpeaking || readerState.isPaused || readerState.isActiveTab));
        if (!shouldShow) {
            hideFloatingController();
            return;
        }

        const controller = ensureFloatingController();
        const readingMap = buildOrReuseReadingMap();
        const title = controller.querySelector(`#${CONTROLLER_TITLE_ID}`);
        const subtitle = controller.querySelector(`#${CONTROLLER_SUBTITLE_ID}`);
        const status = controller.querySelector(`#${CONTROLLER_STATUS_ID}`);
        const speed = controller.querySelector(`#${CONTROLLER_SPEED_ID}`);
        const voice = controller.querySelector(`#${CONTROLLER_VOICE_ID}`);
        const seekInput = controller.querySelector(`#${CONTROLLER_SEEK_ID}`);
        const toggleButton = controller.querySelector(`#${CONTROLLER_TOGGLE_ID}`);
        const navigationDisabled = !readingMap.text.trim();

        title.textContent = getControllerTitle();
        title.title = title.textContent;
        subtitle.textContent = `Narrator: ${formatVoiceName(readerState.voiceName).toUpperCase()}`;
        speed.value = RATE_STEPS.includes(readerState.rate) ? readerState.rate : "+0%";
        speed.title = formatRateLabel(readerState.rate);
        renderControllerVoiceOptions(readerState.voiceName);
        voice.title = formatVoiceLabel(readerState.voiceName);
        void ensureControllerVoices();

        if (readerState.isSpeaking) {
            status.textContent = "Reading aloud";
            toggleButton.innerHTML = controllerIcon("pause");
            toggleButton.disabled = false;
            controller.dataset.state = "reading";
        } else if (readerState.isPaused) {
            status.textContent = "Paused";
            toggleButton.innerHTML = controllerIcon("play");
            toggleButton.disabled = false;
            controller.dataset.state = "paused";
        } else {
            status.textContent = "Preparing audio";
            toggleButton.innerHTML = controllerIcon("pause");
            toggleButton.disabled = true;
            controller.dataset.state = "loading";
        }

        toggleButton.setAttribute("aria-label", readerState.isPaused ? "Resume playback" : "Pause playback");
        seekInput.disabled = navigationDisabled;
        controller.querySelector(`#${CONTROLLER_REWIND_ID}`).disabled = navigationDisabled;
        controller.querySelector(`#${CONTROLLER_PREVIOUS_ID}`).disabled = navigationDisabled;
        controller.querySelector(`#${CONTROLLER_NEXT_ID}`).disabled = navigationDisabled;
        controller.querySelector(`#${CONTROLLER_FORWARD_ID}`).disabled = navigationDisabled;

        syncFloatingControllerProgress(readerState);

        controller.hidden = false;
        controller.dataset.visible = "true";
    }

    function hideFloatingController() {
        const controller = document.getElementById(CONTROLLER_ID);
        if (!controller) {
            return;
        }

        state.isScrubbing = false;
        controller.hidden = true;
        controller.dataset.visible = "false";
    }

    function syncFloatingControllerProgress(readerState) {
        const controller = document.getElementById(CONTROLLER_ID);
        if (!controller || !readerState) {
            return;
        }

        const readingMap = buildOrReuseReadingMap();
        const seekInput = controller.querySelector(`#${CONTROLLER_SEEK_ID}`);
        const currentTime = controller.querySelector(`#${CONTROLLER_CURRENT_TIME_ID}`);
        const totalTime = controller.querySelector(`#${CONTROLLER_TOTAL_TIME_ID}`);
        const totalLength = readingMap.text.length;
        const liveOffset = clamp(Number(readerState.currentOffset) || 0, 0, totalLength);
        const displayOffset = state.isScrubbing
            ? offsetFromProgressRatio(totalLength, state.scrubRatio)
            : liveOffset;
        const progressRatio = totalLength > 0 ? displayOffset / totalLength : 0;
        const totalSeconds = estimateTotalDurationSeconds(readingMap, readerState.rate);
        const currentSeconds = totalSeconds * progressRatio;

        if (!state.isScrubbing) {
            seekInput.value = String(Math.round(progressRatio * 1000));
        }

        paintSeekTrack(seekInput, progressRatio);
        currentTime.textContent = formatClockLabel(currentSeconds);
        totalTime.textContent = formatClockLabel(totalSeconds);
    }

    async function ensureControllerVoices() {
        if (state.availableVoices.length) {
            return state.availableVoices;
        }

        if (state.voicesPromise) {
            return state.voicesPromise;
        }

        state.voicesPromise = chrome.runtime.sendMessage({ type: "GET_BACKEND_VOICES" })
            .then((response) => {
                if (!response || !response.ok) {
                    throw new Error(response?.error || "Could not load Edge TTS voices.");
                }

                state.availableVoices = Array.isArray(response.voices) ? response.voices : [];
                state.voiceLoadErrorShown = false;
                if (state.readerState) {
                    renderControllerVoiceOptions(state.readerState.voiceName);
                }
                return state.availableVoices;
            })
            .catch((error) => {
                if (!state.voiceLoadErrorShown) {
                    showToast(error.message || "Could not load Edge TTS voices.");
                    state.voiceLoadErrorShown = true;
                }
                return [];
            })
            .finally(() => {
                state.voicesPromise = null;
            });

        return state.voicesPromise;
    }

    function renderControllerVoiceOptions(selectedVoiceName) {
        const controller = document.getElementById(CONTROLLER_ID);
        if (!controller) {
            return;
        }

        const voiceSelect = controller.querySelector(`#${CONTROLLER_VOICE_ID}`);
        if (!voiceSelect) {
            return;
        }

        const safeSelectedVoice = selectedVoiceName || "en-US-AriaNeural";
        let options = state.availableVoices.length
            ? state.availableVoices
            : [{ name: safeSelectedVoice, locale: "" }];

        if (!options.some((voice) => voice.name === safeSelectedVoice)) {
            options = [{ name: safeSelectedVoice, locale: "" }, ...options];
        }

        voiceSelect.innerHTML = "";
        options.forEach((voice) => {
            const option = document.createElement("option");
            option.value = voice.name;
            option.textContent = formatVoiceName(voice.name);
            option.title = voice.locale ? `${voice.name} (${voice.locale})` : voice.name;
            voiceSelect.appendChild(option);
        });

        voiceSelect.value = safeSelectedVoice;
        voiceSelect.disabled = !state.availableVoices.length;
        voiceSelect.title = formatVoiceLabel(safeSelectedVoice);
    }

    async function updateFloatingSetting(settings, successMessage) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: "UPDATE_SETTINGS",
                settings
            });
            if (!response || !response.ok) {
                throw new Error(response?.error || "Settings update failed.");
            }
            if (response.state) {
                applyReaderState(response.state);
            }
            if (successMessage) {
                showToast(successMessage);
            }
        } catch (error) {
            showToast(error.message || "Settings update failed.");
        }
    }

    async function commitControllerSeekFromSlider() {
        if (!state.readerState) {
            return;
        }

        const readingMap = buildOrReuseReadingMap();
        const targetOffset = offsetFromProgressRatio(readingMap.text.length, state.scrubRatio);
        state.isScrubbing = false;
        await requestFloatingSeek(targetOffset, { autoplay: state.readerState.isSpeaking });
    }

    async function seekByEstimatedSeconds(deltaSeconds) {
        if (!state.readerState) {
            return;
        }

        const readingMap = buildOrReuseReadingMap();
        const totalSeconds = estimateTotalDurationSeconds(readingMap, state.readerState.rate);
        if (!readingMap.text.length || !totalSeconds) {
            return;
        }

        const currentOffset = clamp(Number(state.readerState.currentOffset) || 0, 0, readingMap.text.length);
        const currentSeconds = totalSeconds * (currentOffset / readingMap.text.length);
        const targetSeconds = clamp(currentSeconds + deltaSeconds, 0, totalSeconds);
        const targetOffset = offsetFromProgressRatio(readingMap.text.length, targetSeconds / totalSeconds);
        await requestFloatingSeek(targetOffset, { autoplay: state.readerState.isSpeaking });
    }

    async function seekBySentence(direction) {
        if (!state.readerState) {
            return;
        }

        const readingMap = buildOrReuseReadingMap();
        const sentenceRanges = readingMap.sentenceRanges;
        if (!sentenceRanges.length) {
            return;
        }

        const currentOffset = clamp(Number(state.readerState.currentOffset) || 0, 0, readingMap.text.length);
        const currentIndex = findSentenceIndexForOffset(currentOffset, sentenceRanges);
        if (currentIndex < 0) {
            return;
        }

        let nextIndex = currentIndex;
        if (direction < 0) {
            const currentSentence = sentenceRanges[currentIndex];
            nextIndex = currentOffset - currentSentence.start > 12
                ? currentIndex
                : Math.max(0, currentIndex - 1);
        } else if (direction > 0) {
            nextIndex = Math.min(sentenceRanges.length - 1, currentIndex + 1);
        }

        await requestFloatingSeek(sentenceRanges[nextIndex].start, { autoplay: state.readerState.isSpeaking });
    }

    async function requestFloatingSeek(targetOffset, options = {}) {
        if (!state.readerState) {
            return;
        }

        const readingMap = buildOrReuseReadingMap();
        const normalizedOffset = snapSeekOffset(readingMap.text, targetOffset);
        const autoplay = typeof options.autoplay === "boolean"
            ? options.autoplay
            : state.readerState.isSpeaking;

        state.readerState.currentOffset = normalizedOffset;
        syncFloatingControllerProgress(state.readerState);
        highlightOffset(normalizedOffset);

        try {
            const response = await chrome.runtime.sendMessage({
                type: "FLOATING_SEEK_READING",
                offset: normalizedOffset,
                autoplay
            });
            if (!response || !response.ok) {
                throw new Error(response?.error || "Seek failed.");
            }
            if (response.state) {
                applyReaderState(response.state);
            }
        } catch (error) {
            showToast(error.message || "Seek failed.");
            try {
                const response = await chrome.runtime.sendMessage({ type: "GET_TAB_STATE" });
                if (response && response.ok && response.state) {
                    applyReaderState(response.state);
                }
            } catch (refreshError) {
                // Ignore state refresh failures after a seek error.
            }
        }
    }

    function offsetFromProgressRatio(totalLength, ratio) {
        if (!totalLength) {
            return 0;
        }

        return clamp(Math.round(totalLength * clamp(ratio, 0, 1)), 0, totalLength);
    }

    function paintSeekTrack(seekInput, ratio) {
        const progress = `${Math.round(clamp(ratio, 0, 1) * 100)}%`;
        seekInput.style.setProperty("--twelve-reader-progress", progress);
    }

    function snapSeekOffset(text, rawOffset) {
        const safeText = text || "";
        let offset = clamp(Number(rawOffset) || 0, 0, safeText.length);
        if (!safeText || offset <= 0 || offset >= safeText.length) {
            return offset;
        }

        while (offset > 0 && /\S/.test(safeText[offset - 1]) && /\S/.test(safeText[offset])) {
            offset -= 1;
        }

        while (offset < safeText.length && /\s/.test(safeText[offset])) {
            offset += 1;
        }

        return clamp(offset, 0, safeText.length);
    }

    function findSentenceIndexForOffset(offset, sentenceRanges) {
        for (let index = 0; index < sentenceRanges.length; index += 1) {
            const range = sentenceRanges[index];
            if (offset >= range.start && offset < range.end) {
                return index;
            }
        }

        if (!sentenceRanges.length) {
            return -1;
        }

        return offset >= sentenceRanges[sentenceRanges.length - 1].end
            ? sentenceRanges.length - 1
            : 0;
    }

    function estimateTotalDurationSeconds(readingMap, rate) {
        if (!readingMap.wordCount) {
            return 0;
        }

        const baseWordsPerMinute = 170;
        return (readingMap.wordCount / (baseWordsPerMinute * rateToPlaybackMultiplier(rate))) * 60;
    }

    function rateToPlaybackMultiplier(rate) {
        const match = /^([+-])(\d+)%$/.exec(rate || "+0%");
        if (!match) {
            return 1;
        }

        const direction = match[1] === "+" ? 1 : -1;
        const amount = Number(match[2]) / 100;
        return clamp(1 + direction * amount, 0.5, 2);
    }

    function formatClockLabel(seconds) {
        const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainder = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
        }

        return `${minutes}:${String(remainder).padStart(2, "0")}`;
    }

    function countWords(text) {
        const matches = (text || "").match(/\S+/g);
        return matches ? matches.length : 0;
    }

    function getControllerTitle() {
        const title = (document.title || "").trim();
        if (title) {
            return title;
        }

        const hostname = safeHostname(location.href);
        return hostname || "Current page";
    }

    function safeHostname(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, "");
        } catch (error) {
            return "";
        }
    }

    function formatRateLabel(rate) {
        return RATE_LABELS[rate] || "1.0x";
    }

    function formatVoiceName(voiceName) {
        if (!voiceName) {
            return "Default voice";
        }

        const segments = voiceName.split("-");
        const rawName = segments[2] || voiceName;
        return rawName
            .replace(/Neural$/i, "")
            .replace(/([a-z])([A-Z])/g, "$1 $2");
    }

    function formatVoiceLabel(voiceName) {
        if (!voiceName) {
            return "Default voice";
        }

        const segments = voiceName.split("-");
        const locale = segments.length >= 2 ? `${segments[0]}-${segments[1]}`.toUpperCase() : "";
        const name = formatVoiceName(voiceName);
        return locale ? `${name} (${locale})` : name;
    }

    function controllerIcon(name) {
        const icons = {
            play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"></path></svg>',
            pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z"></path></svg>',
            previous: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6zm12 0L8 12l10 6z"></path></svg>',
            next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 6h2v12h-2zM6 6l10 6-10 6z"></path></svg>',
            rewind: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 0 6.6 9.3h-2.2A5 5 0 1 1 12 7h1.8L11 9.8 12.4 11 18 5.4 12.4-.2 11 1.2 13.8 4H12z"></path><text x="12" y="18" text-anchor="middle" font-size="6" font-family="Arial, sans-serif">15</text></svg>',
            forward: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.6 9.3h2.2A5 5 0 1 0 12 7h-1.8L13 9.8 11.6 11 6 5.4 11.6-.2 13 1.2 10.2 4H12z"></path><text x="12" y="18" text-anchor="middle" font-size="6" font-family="Arial, sans-serif">15</text></svg>',
            stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"></path></svg>'
        };

        return icons[name] || "";
    }

    function ensureFloatingController() {
        let controller = document.getElementById(CONTROLLER_ID);
        if (controller) {
            return controller;
        }

        controller = document.createElement("div");
        controller.id = CONTROLLER_ID;
        controller.hidden = true;
        controller.dataset.visible = "false";
        controller.innerHTML = `
            <button id="${CONTROLLER_CLOSE_ID}" type="button" class="twelve-reader-controller__close" aria-label="Close reader">&times;</button>
            <div class="twelve-reader-controller__artifact">
                <div class="twelve-reader-controller__cover" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <div class="twelve-reader-controller__meta">
                    <span id="${CONTROLLER_TITLE_ID}" class="twelve-reader-controller__title">Current page</span>
                    <span id="${CONTROLLER_SUBTITLE_ID}" class="twelve-reader-controller__subtitle">Narrator: DEFAULT VOICE</span>
                    <span id="${CONTROLLER_STATUS_ID}" class="twelve-reader-controller__sr-only" aria-live="polite">Preparing audio</span>
                </div>
            </div>
            <div class="twelve-reader-controller__transport">
                <div class="twelve-reader-controller__actions">
                    <button id="${CONTROLLER_REWIND_ID}" type="button" class="twelve-reader-controller__icon-button" aria-label="Jump back 15 seconds" data-control-action="rewind">${controllerIcon("rewind")}</button>
                    <button id="${CONTROLLER_PREVIOUS_ID}" type="button" class="twelve-reader-controller__icon-button" aria-label="Previous sentence" data-control-action="previous">${controllerIcon("previous")}</button>
                    <button id="${CONTROLLER_TOGGLE_ID}" type="button" class="twelve-reader-controller__play-button" aria-label="Pause playback">${controllerIcon("pause")}</button>
                    <button id="${CONTROLLER_NEXT_ID}" type="button" class="twelve-reader-controller__icon-button" aria-label="Next sentence" data-control-action="next">${controllerIcon("next")}</button>
                    <button id="${CONTROLLER_FORWARD_ID}" type="button" class="twelve-reader-controller__icon-button" aria-label="Jump forward 15 seconds" data-control-action="forward">${controllerIcon("forward")}</button>
                    <button id="${CONTROLLER_STOP_ID}" type="button" class="twelve-reader-controller__icon-button" aria-label="Stop reading" data-control-action="stop">${controllerIcon("stop")}</button>
                </div>
                <div class="twelve-reader-controller__timeline">
                    <span id="${CONTROLLER_CURRENT_TIME_ID}" class="twelve-reader-controller__time">0:00</span>
                    <input id="${CONTROLLER_SEEK_ID}" class="twelve-reader-controller__seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek reading position">
                    <span id="${CONTROLLER_TOTAL_TIME_ID}" class="twelve-reader-controller__time">0:00</span>
                </div>
            </div>
            <div class="twelve-reader-controller__settings">
                <div class="twelve-reader-controller__setting">
                    <label class="twelve-reader-controller__setting-label" for="${CONTROLLER_SPEED_ID}">Speed</label>
                    <div class="twelve-reader-controller__setting-input-wrap">
                        <select id="${CONTROLLER_SPEED_ID}" class="twelve-reader-controller__setting-select">
                            <option value="-25%">0.75x</option>
                            <option value="+0%" selected>1.0x</option>
                            <option value="+25%">1.25x</option>
                            <option value="+50%">1.5x</option>
                        </select>
                    </div>
                </div>
                <div class="twelve-reader-controller__setting">
                    <label class="twelve-reader-controller__setting-label" for="${CONTROLLER_VOICE_ID}">Voice</label>
                    <div class="twelve-reader-controller__setting-input-wrap twelve-reader-controller__setting-input-wrap--voice">
                        <select id="${CONTROLLER_VOICE_ID}" class="twelve-reader-controller__setting-select twelve-reader-controller__setting-select--voice" disabled>
                            <option>Loading voices...</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        controller.querySelector(`#${CONTROLLER_TOGGLE_ID}`).addEventListener("click", async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: "FLOATING_TOGGLE_PLAYBACK" });
                if (!response || !response.ok) {
                    throw new Error(response?.error || "Playback control failed.");
                }
                if (response.state) {
                    applyReaderState(response.state);
                }
            } catch (error) {
                showToast(error.message || "Playback control failed.");
            }
        });

        controller.querySelector(`#${CONTROLLER_STOP_ID}`).addEventListener("click", async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: "FLOATING_STOP_READING" });
                if (!response || !response.ok) {
                    throw new Error(response?.error || "Stop failed.");
                }
                if (response.state) {
                    applyReaderState(response.state);
                }
            } catch (error) {
                showToast(error.message || "Stop failed.");
            }
        });

        controller.querySelector(`#${CONTROLLER_CLOSE_ID}`).addEventListener("click", async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: "FLOATING_STOP_READING" });
                if (!response || !response.ok) {
                    throw new Error(response?.error || "Terminate failed.");
                }
                hideFloatingController();
            } catch (error) {
                showToast(error.message || "Terminate failed.");
            }
        });

        controller.querySelector(`#${CONTROLLER_REWIND_ID}`).addEventListener("click", () => {
            void seekByEstimatedSeconds(-15);
        });

        controller.querySelector(`#${CONTROLLER_PREVIOUS_ID}`).addEventListener("click", () => {
            void seekBySentence(-1);
        });

        controller.querySelector(`#${CONTROLLER_NEXT_ID}`).addEventListener("click", () => {
            void seekBySentence(1);
        });

        controller.querySelector(`#${CONTROLLER_FORWARD_ID}`).addEventListener("click", () => {
            void seekByEstimatedSeconds(15);
        });

        const seekInput = controller.querySelector(`#${CONTROLLER_SEEK_ID}`);
        seekInput.addEventListener("input", () => {
            state.isScrubbing = true;
            state.scrubRatio = clamp(Number(seekInput.value) / 1000, 0, 1);
            if (state.readerState) {
                syncFloatingControllerProgress(state.readerState);
            }
        });

        seekInput.addEventListener("change", () => {
            void commitControllerSeekFromSlider();
        });

        seekInput.addEventListener("blur", () => {
            if (!state.isScrubbing || !state.readerState) {
                return;
            }

            state.isScrubbing = false;
            syncFloatingControllerProgress(state.readerState);
        });

        controller.querySelector(`#${CONTROLLER_SPEED_ID}`).addEventListener("change", async (event) => {
            const nextRate = RATE_STEPS.includes(event.target.value) ? event.target.value : "+0%";
            await updateFloatingSetting({ rate: nextRate }, `Speed set to ${formatRateLabel(nextRate)}.`);
        });

        controller.querySelector(`#${CONTROLLER_VOICE_ID}`).addEventListener("change", async (event) => {
            if (!event.target.value) {
                return;
            }
            await updateFloatingSetting({ voiceName: event.target.value }, `Voice set to ${formatVoiceName(event.target.value)}.`);
        });

        document.documentElement.appendChild(controller);
        void ensureControllerVoices();
        return controller;
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID} {
                position: absolute;
                inset: 0 auto auto 0;
                pointer-events: none;
                z-index: 2147483646;
            }

            .twelve-reader-highlight {
                position: absolute;
                border-radius: 5px;
                pointer-events: none;
            }

            .twelve-reader-highlight.sentence {
                background: rgba(249, 203, 61, 0.28);
            }

            .twelve-reader-highlight.word {
                background: rgba(234, 94, 42, 0.38);
            }

            #${CONTROLLER_ID} {
                position: fixed;
                left: 50%;
                bottom: 16px;
                width: min(1880px, calc(100vw - 32px));
                display: grid;
                grid-template-columns: minmax(260px, 1.2fr) minmax(360px, 1.6fr) auto;
                align-items: center;
                gap: 30px;
                padding: 26px 32px;
                border: 1px solid rgba(89, 102, 129, 0.14);
                border-radius: 28px;
                background: rgba(255, 255, 255, 0.98);
                color: #111827;
                box-shadow: 0 24px 55px rgba(15, 23, 42, 0.16);
                backdrop-filter: blur(18px);
                z-index: 2147483647;
                opacity: 0;
                transform: translate(-50%, 28px);
                transition: opacity 180ms ease, transform 180ms ease;
                font: 500 14px/1.4 Inter, "Segoe UI", Arial, sans-serif;
                box-sizing: border-box;
            }

            .twelve-reader-controller__close {
                position: absolute;
                top: 12px;
                right: 12px;
                width: 34px;
                height: 34px;
                border: 0;
                border-radius: 999px;
                background: transparent;
                color: #8a8f98;
                font: 500 24px/1 Inter, "Segoe UI", Arial, sans-serif;
                cursor: pointer;
                transition: background 160ms ease, color 160ms ease, transform 160ms ease;
            }

            .twelve-reader-controller__close:hover {
                background: #f3f4f6;
                color: #111827;
                transform: translateY(-1px);
            }

            .twelve-reader-controller__close:focus {
                outline: none;
                box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
            }

            #${CONTROLLER_ID},
            #${CONTROLLER_ID} * {
                box-sizing: border-box;
            }

            #${CONTROLLER_ID}[data-visible="true"] {
                opacity: 1;
                transform: translate(-50%, 0);
            }

            .twelve-reader-controller__artifact {
                display: flex;
                align-items: center;
                gap: 22px;
                min-width: 0;
            }

            .twelve-reader-controller__cover {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                width: 76px;
                height: 76px;
                border-radius: 8px;
                background: linear-gradient(180deg, #fbfbfc 0%, #eef2f7 100%);
                border: 1px solid rgba(17, 24, 39, 0.06);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
            }

            .twelve-reader-controller__cover span {
                width: 4px;
                border-radius: 999px;
                background: linear-gradient(180deg, #c7cfdd 0%, #99a9c3 100%);
            }

            .twelve-reader-controller__cover span:nth-child(1) {
                height: 16px;
            }

            .twelve-reader-controller__cover span:nth-child(2) {
                height: 28px;
            }

            .twelve-reader-controller__cover span:nth-child(3) {
                height: 22px;
            }

            .twelve-reader-controller__cover span:nth-child(4) {
                height: 12px;
            }

            .twelve-reader-controller__meta {
                display: flex;
                flex-direction: column;
                gap: 6px;
                min-width: 0;
            }

            .twelve-reader-controller__title {
                font: 700 22px/1.12 Georgia, "Times New Roman", serif;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .twelve-reader-controller__subtitle {
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: #8a8f98;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .twelve-reader-controller__sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            }

            .twelve-reader-controller__transport {
                display: flex;
                flex-direction: column;
                gap: 18px;
                min-width: 0;
            }

            .twelve-reader-controller__actions {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 18px;
            }

            .twelve-reader-controller__icon-button,
            .twelve-reader-controller__play-button {
                appearance: none;
                border: 0;
                padding: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: transform 160ms ease, background 160ms ease, color 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
            }

            .twelve-reader-controller__icon-button {
                width: 42px;
                height: 42px;
                border-radius: 999px;
                background: transparent;
                color: #b2b8c2;
            }

            .twelve-reader-controller__icon-button svg,
            .twelve-reader-controller__play-button svg {
                width: 22px;
                height: 22px;
                fill: currentColor;
            }

            .twelve-reader-controller__icon-button:hover:not(:disabled) {
                background: #f3f4f6;
                color: #111827;
                transform: translateY(-1px);
            }

            .twelve-reader-controller__icon-button:disabled,
            .twelve-reader-controller__play-button:disabled {
                opacity: 0.55;
                cursor: default;
                transform: none;
                box-shadow: none;
            }

            .twelve-reader-controller__play-button {
                width: 76px;
                height: 76px;
                border-radius: 6px;
                background: #090909;
                color: #ffffff;
                box-shadow: 0 18px 26px rgba(17, 17, 17, 0.18);
            }

            .twelve-reader-controller__play-button svg {
                width: 30px;
                height: 30px;
            }

            .twelve-reader-controller__play-button:hover:not(:disabled) {
                background: #000000;
                transform: translateY(-1px);
            }

            .twelve-reader-controller__timeline {
                display: grid;
                grid-template-columns: auto minmax(0, 1fr) auto;
                align-items: center;
                gap: 16px;
            }

            .twelve-reader-controller__time {
                font-size: 12px;
                color: #8a8f98;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }

            .twelve-reader-controller__seek {
                --twelve-reader-progress: 0%;
                width: 100%;
                height: 24px;
                margin: 0;
                background: transparent;
                cursor: pointer;
                appearance: none;
                -webkit-appearance: none;
            }

            .twelve-reader-controller__seek:focus {
                outline: none;
            }

            .twelve-reader-controller__seek:disabled {
                cursor: default;
                opacity: 0.55;
            }

            .twelve-reader-controller__seek::-webkit-slider-runnable-track {
                height: 2px;
                background: linear-gradient(to right, #111111 0%, #111111 var(--twelve-reader-progress), rgba(17, 17, 17, 0.12) var(--twelve-reader-progress), rgba(17, 17, 17, 0.12) 100%);
            }

            .twelve-reader-controller__seek::-webkit-slider-thumb {
                width: 14px;
                height: 14px;
                margin-top: -6px;
                border: 0;
                border-radius: 999px;
                background: #111111;
                box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.96);
                appearance: none;
                -webkit-appearance: none;
            }

            .twelve-reader-controller__seek::-moz-range-track {
                height: 2px;
                background: rgba(17, 17, 17, 0.12);
            }

            .twelve-reader-controller__seek::-moz-range-progress {
                height: 2px;
                background: #111111;
            }

            .twelve-reader-controller__seek::-moz-range-thumb {
                width: 14px;
                height: 14px;
                border: 0;
                border-radius: 999px;
                background: #111111;
                box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.96);
            }

            .twelve-reader-controller__settings {
                display: flex;
                align-items: center;
                gap: 34px;
                justify-self: end;
            }

            .twelve-reader-controller__setting {
                display: flex;
                flex-direction: column;
                gap: 6px;
                min-width: 0;
            }

            .twelve-reader-controller__setting-label {
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: #8a8f98;
            }

            .twelve-reader-controller__setting-input-wrap {
                position: relative;
                min-width: 116px;
            }

            .twelve-reader-controller__setting-input-wrap--voice {
                min-width: 168px;
                max-width: 220px;
            }

            .twelve-reader-controller__setting-input-wrap::after {
                content: "";
                position: absolute;
                top: 50%;
                right: 14px;
                width: 7px;
                height: 7px;
                border-right: 1.5px solid #7a818d;
                border-bottom: 1.5px solid #7a818d;
                transform: translateY(-65%) rotate(45deg);
                pointer-events: none;
            }

            .twelve-reader-controller__setting-select {
                width: 100%;
                min-height: 40px;
                padding: 0 34px 0 12px;
                border: 1px solid rgba(17, 24, 39, 0.08);
                border-radius: 4px;
                background: #f6f7f9;
                color: #111827;
                font: 700 15px/1.2 Inter, "Segoe UI", Arial, sans-serif;
                appearance: none;
                -webkit-appearance: none;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
            }

            .twelve-reader-controller__setting-select:hover:not(:disabled) {
                border-color: rgba(17, 24, 39, 0.16);
                background: #f3f4f6;
            }

            .twelve-reader-controller__setting-select:focus {
                outline: none;
                border-color: rgba(17, 24, 39, 0.22);
                box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
            }

            .twelve-reader-controller__setting-select:disabled {
                cursor: default;
                opacity: 0.7;
            }

            @media (max-width: 1180px) {
                #${CONTROLLER_ID} {
                    grid-template-columns: 1fr;
                    gap: 18px;
                    padding: 20px;
                }

                .twelve-reader-controller__artifact,
                .twelve-reader-controller__settings {
                    justify-self: stretch;
                }

                .twelve-reader-controller__actions {
                    justify-content: flex-start;
                }

                .twelve-reader-controller__settings {
                    justify-content: space-between;
                    gap: 16px;
                }
            }

            @media (max-width: 720px) {
                #${CONTROLLER_ID} {
                    width: calc(100vw - 20px);
                    bottom: 10px;
                    padding: 18px 16px;
                    border-radius: 22px;
                }

                .twelve-reader-controller__artifact {
                    align-items: flex-start;
                }

                .twelve-reader-controller__cover {
                    width: 60px;
                    height: 60px;
                    border-radius: 8px;
                }

                .twelve-reader-controller__title {
                    font-size: 18px;
                }

                .twelve-reader-controller__actions {
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .twelve-reader-controller__icon-button {
                    width: 38px;
                    height: 38px;
                }

                .twelve-reader-controller__play-button {
                    width: 64px;
                    height: 64px;
                }

                .twelve-reader-controller__timeline {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }

                .twelve-reader-controller__time:last-child {
                    justify-self: end;
                }

                .twelve-reader-controller__settings {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .twelve-reader-controller__setting-input-wrap,
                .twelve-reader-controller__setting-input-wrap--voice {
                    min-width: min(220px, calc(100vw - 72px));
                    max-width: none;
                }
            }

            #${TOAST_ID} {
                position: fixed;
                right: 20px;
                bottom: 160px;
                max-width: 320px;
                padding: 10px 14px;
                border-radius: 999px;
                background: rgba(17, 24, 39, 0.92);
                color: #ffffff;
                font: 500 13px/1.4 Arial, sans-serif;
                box-shadow: 0 18px 45px rgba(15, 23, 42, 0.28);
                z-index: 2147483647;
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 180ms ease, transform 180ms ease;
                pointer-events: none;
            }

            #${TOAST_ID}[data-visible="true"] {
                opacity: 1;
                transform: translateY(0);
            }

            html[data-twelve-reader-click-mode] {
                cursor: crosshair;
            }
        `;

        document.documentElement.appendChild(style);
    }

    let toastTimeoutId = null;
    function showToast(message) {
        let toast = document.getElementById(TOAST_ID);
        if (!toast) {
            toast = document.createElement("div");
            toast.id = TOAST_ID;
            toast.setAttribute("aria-live", "polite");
            document.documentElement.appendChild(toast);
        }

        toast.textContent = message;
        toast.dataset.visible = "true";
        if (toastTimeoutId) {
            window.clearTimeout(toastTimeoutId);
        }
        toastTimeoutId = window.setTimeout(() => {
            toast.dataset.visible = "false";
        }, 1800);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
})();
