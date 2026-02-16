// ==UserScript==
// @name         YouTube Playlist Total Duration
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Calculates total playlist time using internal YouTube data (ytInitialData) and displays it next to the video count
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_CONTAINER_SELECTOR = '.index-message-wrapper';
    const INJECTED_ID = 'playlist-total-duration';

    // --- 1. DATA EXTRACTION (Instant & Reliable) ---
    function getPlaylistTotalSeconds() {
        // We look for the data specifically on the "Watch" page (side panel playlist)
        // Path: contents -> twoColumnWatchNextResults -> playlist -> playlist -> contents
        const data = window.ytInitialData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents;

        if (!data) return null; // Not a playlist watch page

        let totalSeconds = 0;
        let videoCount = 0;

        data.forEach(item => {
            const renderer = item.playlistPanelVideoRenderer;
            if (renderer) {
                // Duration is usually in simpleText (e.g. "1:23")
                const durationText = renderer.lengthText?.simpleText;
                if (durationText) {
                    totalSeconds += parseDuration(durationText);
                    videoCount++;
                }
            }
        });

        if (videoCount === 0) return null;
        return totalSeconds;
    }

    // --- 2. HELPERS ---
    function parseDuration(timeStr) {
        if (!timeStr) return 0;
        // Split "1:05" -> [1, 5], reverse to [5, 1] (seconds, minutes)
        // This handles ss, mm:ss, hh:mm:ss, d:hh:mm:ss automatically
        const parts = timeStr.trim().split(':').map(Number).reverse();

        let seconds = 0;
        if (parts[0]) seconds += parts[0];           // Seconds
        if (parts[1]) seconds += parts[1] * 60;      // Minutes
        if (parts[2]) seconds += parts[2] * 3600;    // Hours
        if (parts[3]) seconds += parts[3] * 86400;   // Days
        return seconds;
    }

    function formatTime(totalSeconds) {
        // Calculate hours directly (allowing > 24h) rather than rolling over to Days
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        let output = "";
        if (hours > 0) output += `${hours}h `;
        output += `${minutes}m`;
        output += ` ${seconds}s`;

        return output;
    }

    // --- 3. INJECTION LOGIC ---
    function processPlaylist() {
        // Step A: Calculate Time (Data Layer)
        const totalSeconds = getPlaylistTotalSeconds();

        // If no playlist data found, we stop.
        if (totalSeconds === null) return;

        // Step B: Wait for UI (View Layer)
        // We poll briefly for the container to appear
        const pollInterval = setInterval(() => {
            const indexWrapper = document.querySelector(TARGET_CONTAINER_SELECTOR);

            // Check existence and visibility
            const isVisible = indexWrapper && (indexWrapper.offsetWidth > 0 || indexWrapper.offsetHeight > 0);

            if (isVisible) {
                clearInterval(pollInterval);
                injectText(indexWrapper, totalSeconds);
            }
        }, 500);

        // Safety timeout: stop polling after 10 seconds if UI never loads
        setTimeout(() => clearInterval(pollInterval), 10000);
    }

    function injectText(container, totalSeconds) {
        // Avoid duplicates
        if (document.getElementById(INJECTED_ID)) {
             // If it exists, just update text (in case playlist changed length dynamically)
             document.getElementById(INJECTED_ID).textContent = ` • ${formatTime(totalSeconds)}`;
             return;
        }

        const formattedTime = formatTime(totalSeconds);

        const durationSpan = document.createElement('span');
        durationSpan.id = INJECTED_ID;
        durationSpan.textContent = ` • ${formattedTime}`;

        // Styling to match YouTube
        durationSpan.style.color = 'var(--yt-spec-text-secondary)';
        durationSpan.style.marginLeft = '4px';
        durationSpan.style.fontSize = '1.2rem';
        durationSpan.style.fontWeight = '400';

        container.appendChild(durationSpan);
        console.log(`Playlist Total Injected: ${formattedTime}`);
    }

    // --- 4. EXECUTION TRIGGERS ---

    // Run on initial page load
    processPlaylist();

    // Run when navigating between videos (YouTube is a Single Page App)
    window.addEventListener('yt-navigate-finish', () => {
        // We add a tiny delay to ensure internal data is updated if navigating playlists
        setTimeout(processPlaylist, 500);
    });

})();