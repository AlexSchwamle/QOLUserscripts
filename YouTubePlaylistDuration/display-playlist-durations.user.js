// ==UserScript==
// @name         YouTube Playlist Total Duration & Remaining
// @namespace    http://tampermonkey.net/
// @version      3.5
// @description  Calculates total playlist time + time remaining (adjusted for playback speed) and displays it next to the video count. Handles SPA navigation correctly.
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_CONTAINER_SELECTOR = '.index-message-wrapper';
    const INJECTED_ID = 'playlist-total-duration';
    const TIME_REMAINING_ID = 'ytp-time-remaining-custom';

    // Global timers to manage cleanup during navigation
    let activePollInterval = null;
    let activeFallbackTimeout = null;

    // State for reactivity (Speed changes)
    let gTotalSeconds = 0;
    let gRemainingSeconds = 0;
    let videoElement = null;

    // --- 1. CORE LOGIC ---

    // Returns true if processed successfully, false if no data found
    function processPlaylistData(sourceData) {
        // Path to playlist contents on the "Watch" page
        let playlistContents = sourceData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents;

        if (!playlistContents) {
            return false;
        }

        const currentVideoId = new URLSearchParams(window.location.search).get('v');

        let totalSeconds = 0;
        let remainingSeconds = 0;
        let foundCurrentVideo = false;
        let videoCount = 0;

        playlistContents.forEach(item => {
            const renderer = item.playlistPanelVideoRenderer;
            if (renderer) {
                const durationText = renderer.lengthText?.simpleText;
                const videoId = renderer.videoId;

                if (durationText) {
                    const seconds = parseDuration(durationText);

                    totalSeconds += seconds;
                    videoCount++;

                    if (videoId === currentVideoId) {
                        foundCurrentVideo = true;
                    }

                    if (foundCurrentVideo) {
                        remainingSeconds += seconds;
                    }
                }
            }
        });

        if (videoCount === 0) return false;

        // Save state for speed updates
        gTotalSeconds = totalSeconds;
        gRemainingSeconds = remainingSeconds;

        // Attach listener for speed changes
        setupSpeedListener();

        // Perform initial UI update
        updateUIText();

        return true;
    }

    // --- 2. SPEED REACTIVITY ---

    function setupSpeedListener() {
        const vid = document.querySelector('video');

        // Only attach if it's a new element or we haven't attached yet
        if (vid && vid !== videoElement) {
            // Cleanup old listener if exists
            if (videoElement) {
                videoElement.removeEventListener('ratechange', updateUIText);
            }

            videoElement = vid;
            videoElement.addEventListener('ratechange', updateUIText);
        }
    }

    function updateUIText() {
        // Get current speed (Default to 1 if not found)
        const speed = videoElement ? videoElement.playbackRate : 1;
        const effectiveSpeed = speed > 0 ? speed : 1;

        // Calculate adjusted remaining time
        const adjustedRemaining = gRemainingSeconds / effectiveSpeed;

        // Format
        const formattedTotal = formatTime(gTotalSeconds);
        const formattedRemaining = formatDecimalHours(adjustedRemaining);

        // removed leading space as requested
        const finalText = `• ${formattedTotal} (${formattedRemaining} left)`;

        pollAndInject(finalText);
    }

    // --- 3. HELPERS ---

    function parseDuration(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':').map(Number).reverse();

        let seconds = 0;
        if (parts[0]) seconds += parts[0];           // Seconds
        if (parts[1]) seconds += parts[1] * 60;      // Minutes
        if (parts[2]) seconds += parts[2] * 3600;    // Hours
        if (parts[3]) seconds += parts[3] * 86400;   // Days
        return seconds;
    }

    function formatTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let output = "";
        if (hours > 0) output += `${hours}h `;
        output += `${minutes}m`;
        output += ` ${seconds}s`;

        return output;
    }

    function formatDecimalHours(totalSeconds) {
        const hours = totalSeconds / 3600;
        return `${hours.toFixed(2)}h`;
    }

    function removeInjectedElement() {
        const el = document.getElementById(INJECTED_ID);
        if (el) el.remove();
    }

    function clearTimers() {
        if (activePollInterval) {
            clearInterval(activePollInterval);
            activePollInterval = null;
        }
        if (activeFallbackTimeout) {
            clearTimeout(activeFallbackTimeout);
            activeFallbackTimeout = null;
        }
    }

    // --- 4. UI INJECTION ---

    function pollAndInject(textToInject) {
        // Optimization: If element already exists, update immediately for reactivity
        // This makes scrolling the speed wheel feel instant
        const existingSpan = document.getElementById(INJECTED_ID);
        if (existingSpan) {
            existingSpan.textContent = textToInject;
            return;
        }

        // Standard Polling for initial creation (waiting for container)
        if (activePollInterval) clearInterval(activePollInterval);

        let attempts = 0;

        activePollInterval = setInterval(() => {
            attempts++;
            const indexWrapper = document.querySelector(TARGET_CONTAINER_SELECTOR);

            const isVisible = indexWrapper && (indexWrapper.offsetWidth > 0 || indexWrapper.offsetHeight > 0);

            if (isVisible) {
                clearInterval(activePollInterval);
                activePollInterval = null;
                injectText(indexWrapper, textToInject);
            }

            if (attempts > 20) {
                 clearInterval(activePollInterval);
                 activePollInterval = null;
            }
        }, 500);
    }

    function injectText(container, text) {
        let durationSpan = document.getElementById(INJECTED_ID);

        if (!durationSpan) {
            durationSpan = document.createElement('span');
            durationSpan.id = INJECTED_ID;

            durationSpan.style.color = 'var(--yt-spec-text-secondary)';
            durationSpan.style.marginLeft = '4px';
            durationSpan.style.fontSize = '1.2rem';
            durationSpan.style.fontWeight = '400';

            container.appendChild(durationSpan);
        }

        durationSpan.textContent = text;
        console.log(`Playlist UI Updated: ${text}`);
    }

    // --- 5. EXECUTION HANDLERS ---

    function handleInitialLoad() {
        // Show loading if it looks like a playlist page
        if (new URLSearchParams(window.location.search).has('list')) {
            pollAndInject("• Calculating...");
        }

        if (window.ytInitialData) {
            processPlaylistData(window.ytInitialData);
        }
    }

    function handleNavigation(event) {
        clearTimers();

        // 1. Trigger Loading State immediately if it's a playlist
        if (new URLSearchParams(window.location.search).has('list')) {
            pollAndInject("• Calculating...");
        } else {
            removeInjectedElement();
            // Also detach listener to be clean
            if (videoElement) {
                videoElement.removeEventListener('ratechange', updateUIText);
                videoElement = null;
            }
            return;
        }

        // 2. Try processing with the fast navigation data
        const responseData = event.detail && event.detail.response;
        const success = processPlaylistData(responseData);

        if (success) return;

        // 3. Fallback: Wait for DOM component
        console.log("Playlist Time: Event data incomplete, waiting for DOM component...");

        activeFallbackTimeout = setTimeout(() => {
            const componentData = document.querySelector('ytd-playlist-panel-renderer')?.data;
                if (componentData) {
                    const mockSource = {
                        contents: {
                            twoColumnWatchNextResults: {
                                playlist: {
                                    playlist: componentData
                                }
                            }
                        }
                    };
                    processPlaylistData(mockSource);
                } else {
                    console.log("Playlist Time: Could not find fresh playlist data.");
                    removeInjectedElement();
                }
        }, 1500);
    }

    function handleNavigationStart() {
        clearTimers();
        removeInjectedElement();
    }

    // --- 6. VIDEO TIME REMAINING INJECTION ---

    function formatTimeRemaining(totalSeconds) {
        totalSeconds = Math.max(0, Math.floor(totalSeconds));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let output = '';
        if (hours > 0) output += `${hours}h`;
        output += `${minutes}m`;
        output += `${seconds}s`;

        return `(${output})`;
    }

    function updateTimeRemaining() {
        const vid = document.querySelector('video');
        if (!vid) return;

        const speed = vid.playbackRate > 0 ? vid.playbackRate : 1;
        const timeWatched = vid.currentTime; 
        const videoDuration = vid.duration;
        if (isNaN(videoDuration) || isNaN(timeWatched)) return; 
        const remaining = (videoDuration - timeWatched) / speed;

        let span = document.getElementById(TIME_REMAINING_ID);
        if (!span) {
            const durationEl = document.querySelector('.ytp-time-duration');
            if (!durationEl) return;

            // Create the space text node and span via DOM API (avoids Trusted Types CSP)
            const space = document.createTextNode(' ');
            span = document.createElement('span');
            span.id = TIME_REMAINING_ID;
            span.style.color = 'rgba(255,255,255,0.7)';
            span.style.fontSize = 'inherit';
            span.style.fontWeight = '400';

            durationEl.after(space, span);
        }

        span.textContent = formatTimeRemaining(remaining);
    }

    function setupTimeRemainingListener() {
        const vid = document.querySelector('video');
        if (!vid || vid._timeRemainingAttached) return;

        vid._timeRemainingAttached = true;
        vid.addEventListener('timeupdate', updateTimeRemaining);
        vid.addEventListener('ratechange', updateTimeRemaining);
        vid.addEventListener('seeking', updateTimeRemaining);
    }

    // Poll for video element availability (handles SPA navigation)
    function initTimeRemaining() {
        const removeTimeRemaining = () => {
            const el = document.getElementById(TIME_REMAINING_ID);
            if (el) el.remove();
        };

        window.addEventListener('yt-navigate-start', () => {
            removeTimeRemaining();
            const vid = document.querySelector('video');
            if (vid) vid._timeRemainingAttached = false;
        });

        // Poll until video element exists
        const poll = setInterval(() => {
            const vid = document.querySelector('video');
            if (vid && document.querySelector('.ytp-time-duration')) {
                setupTimeRemainingListener();
                updateTimeRemaining();
                clearInterval(poll);
            }
        }, 500);
    }

    initTimeRemaining();

    // --- 7. LISTENERS ---

    handleInitialLoad();
    window.addEventListener('yt-navigate-start', handleNavigationStart);
    window.addEventListener('yt-navigate-finish', handleNavigation);

})();