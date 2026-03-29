(function () {
    const audio = document.getElementById("player");
    const state = {
        tabId: null,
        sessionId: null,
        sessionToken: 0,
        startOffset: 0,
        currentOffset: 0,
        events: [],
        currentEventIndex: -1,
        lastProgressKey: "",
        eventSource: null,
        progressIntervalId: null,
        suppressPlaybackEvents: false
    };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.target !== "offscreen") {
            return undefined;
        }

        handleMessage(message)
            .then((result) => sendResponse({ ok: true, ...result }))
            .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
        return true;
    });

    audio.addEventListener("play", () => {
        if (state.suppressPlaybackEvents) {
            return;
        }

        startProgressTracking();
        void sendStatus("play");
    });

    audio.addEventListener("pause", () => {
        stopProgressTracking();
        if (state.suppressPlaybackEvents || audio.ended) {
            return;
        }

        void sendStatus("pause");
    });

    audio.addEventListener("ended", () => {
        stopProgressTracking();
        state.currentOffset = Math.max(state.currentOffset, state.startOffset);
        void sendStatus("ended");
    });

    audio.addEventListener("error", () => {
        stopProgressTracking();
        void sendStatus("error", "Audio stream failed.");
    });

    audio.addEventListener("timeupdate", () => {
        sendProgressIfNeeded();
    });

    async function handleMessage(message) {
        switch (message.type) {
            case "OFFSCREEN_START_SESSION":
                await startSession(message);
                return {};

            case "OFFSCREEN_SET_PLAYBACK_RATE":
                if (state.sessionToken === message.sessionToken) {
                    const nextRate = clamp(Number(message.playbackRate) || 1, 0.5, 2);
                    audio.playbackRate = nextRate;
                    audio.defaultPlaybackRate = nextRate;
                }
                return {};

            case "OFFSCREEN_PAUSE":
                if (state.sessionToken === message.sessionToken) {
                    audio.pause();
                }
                return {};

            case "OFFSCREEN_RESUME":
                if (state.sessionToken !== message.sessionToken || !audio.src) {
                    throw new Error("No prepared audio stream is available to resume.");
                }

                await audio.play();
                return {};

            case "OFFSCREEN_STOP":
                if (message.tabId === state.tabId) {
                    await clearSession();
                }
                return {};

            case "OFFSCREEN_GET_STATE":
                return { state: getSerializableState() };

            default:
                return {};
        }
    }

    async function startSession(message) {
        await clearSession();

        state.tabId = message.tabId;
        state.sessionId = message.sessionId;
        state.sessionToken = message.sessionToken;
        state.startOffset = Number(message.startOffset) || 0;
        state.currentOffset = state.startOffset;
        state.events = [];
        state.currentEventIndex = -1;
        state.lastProgressKey = "";

        connectEventStream(message.eventsUrl, message.sessionToken);

        audio.playbackRate = clamp(Number(message.playbackRate) || 1, 0.5, 2);
        audio.defaultPlaybackRate = audio.playbackRate;
        audio.src = withTimestamp(message.audioUrl);
        audio.load();

        if (message.autoplay) {
            await audio.play();
            return;
        }

        await sendStatus("ready");
    }

    function connectEventStream(eventsUrl, sessionToken) {
        const eventSource = new EventSource(withTimestamp(eventsUrl));
        state.eventSource = eventSource;

        eventSource.addEventListener("word", (event) => {
            if (state.sessionToken !== sessionToken) {
                return;
            }

            try {
                state.events.push(JSON.parse(event.data));
                sendProgressIfNeeded();
            } catch (error) {
                void sendStatus("error", "Timing data could not be parsed.");
            }
        });

        eventSource.addEventListener("done", () => {
            if (state.sessionToken === sessionToken) {
                eventSource.close();
                state.eventSource = null;
            }
        });

        eventSource.addEventListener("error", () => {
            if (eventSource.readyState === EventSource.CLOSED && state.eventSource === eventSource) {
                state.eventSource = null;
            }
        });
    }

    async function clearSession() {
        state.suppressPlaybackEvents = true;
        stopProgressTracking();

        if (state.eventSource) {
            state.eventSource.close();
            state.eventSource = null;
        }

        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        audio.playbackRate = 1;
        audio.defaultPlaybackRate = 1;

        state.tabId = null;
        state.sessionId = null;
        state.sessionToken = 0;
        state.startOffset = 0;
        state.currentOffset = 0;
        state.events = [];
        state.currentEventIndex = -1;
        state.lastProgressKey = "";

        await Promise.resolve();
        state.suppressPlaybackEvents = false;
    }

    function startProgressTracking() {
        stopProgressTracking();
        sendProgressIfNeeded();
        state.progressIntervalId = window.setInterval(sendProgressIfNeeded, 120);
    }

    function stopProgressTracking() {
        if (state.progressIntervalId) {
            window.clearInterval(state.progressIntervalId);
            state.progressIntervalId = null;
        }
    }

    function sendProgressIfNeeded() {
        const activeWord = getActiveWordAtCurrentTime();
        if (!activeWord || !activeWord.event) {
            return;
        }

        const { event, index } = activeWord;
        state.currentEventIndex = index;

        const highlightOffset = state.startOffset + event.char_start;
        const resumeOffset = chooseResumeOffset(event, audio.currentTime, state.startOffset);
        const progressKey = `${highlightOffset}:${resumeOffset}`;

        if (progressKey === state.lastProgressKey) {
            return;
        }

        state.lastProgressKey = progressKey;
        state.currentOffset = resumeOffset;

        void chrome.runtime.sendMessage({
            type: "OFFSCREEN_PROGRESS",
            tabId: state.tabId,
            sessionId: state.sessionId,
            sessionToken: state.sessionToken,
            highlightOffset,
            resumeOffset
        });
    }

    function getActiveWordAtCurrentTime() {
        if (!state.events.length) {
            return null;
        }

        const currentTime = audio.currentTime;
        let index = state.currentEventIndex;
        if (index < 0) {
            index = 0;
        }

        while (index + 1 < state.events.length && state.events[index + 1].time_start <= currentTime + 0.03) {
            index += 1;
        }
        while (index > 0 && state.events[index].time_start > currentTime + 0.03) {
            index -= 1;
        }

        const event = state.events[index];
        if (!event || currentTime < event.time_start) {
            return null;
        }

        return { event, index };
    }

    function chooseResumeOffset(event, currentTime, startOffset) {
        const absoluteStart = startOffset + event.char_start;
        const absoluteEnd = startOffset + event.char_end;
        const duration = Math.max(0, event.time_end - event.time_start);
        const threshold = duration > 0
            ? event.time_start + duration * 0.55
            : event.time_start + 0.12;

        return currentTime >= threshold ? absoluteEnd : absoluteStart;
    }

    function getSerializableState() {
        return {
            tabId: state.tabId,
            sessionId: state.sessionId,
            sessionToken: state.sessionToken,
            startOffset: state.startOffset,
            currentOffset: state.currentOffset,
            isPlaying: Boolean(audio.src && !audio.paused && !audio.ended),
            isPaused: Boolean(audio.src && audio.paused && !audio.ended),
            hasAudio: Boolean(audio.src)
        };
    }

    async function sendStatus(status, error) {
        await chrome.runtime.sendMessage({
            type: "OFFSCREEN_STATUS",
            tabId: state.tabId,
            sessionId: state.sessionId,
            sessionToken: state.sessionToken,
            status,
            error: error || ""
        });
    }

    function withTimestamp(url) {
        const nextUrl = new URL(url);
        nextUrl.searchParams.set("ts", Date.now().toString());
        return nextUrl.toString();
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
})();
