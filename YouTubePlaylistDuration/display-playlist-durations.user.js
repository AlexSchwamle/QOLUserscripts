// ==UserScript==
// @name         YouTube Playlist Total Duration & Remaining
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Calculates total playlist time + time remaining and displays it next to the video count. Handles SPA navigation correctly.
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_CONTAINER_SELECTOR = '.index-message-wrapper';
    const INJECTED_ID = 'playlist-total-duration';

    // --- 1. CORE LOGIC ---
    
    // Returns true if processed successfully, false if no data found
    function processPlaylistData(sourceData) {
        // Path to playlist contents on the "Watch" page
        let playlistContents = sourceData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents;

        if (!playlistContents) {
            // Not a playlist watch page, or structure changed
            return false;
        }

        // Get current video ID from URL to calculate "Remaining"
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
                    
                    // Add to total
                    totalSeconds += seconds;
                    videoCount++;

                    // Check if this is the current video
                    if (videoId === currentVideoId) {
                        foundCurrentVideo = true;
                    }

                    // Add to remaining if we have found the current video (Inclusive)
                    if (foundCurrentVideo) {
                        remainingSeconds += seconds;
                    }
                }
            }
        });

        if (videoCount === 0) return false;

        // Start UI Injection
        pollAndInject(totalSeconds, remainingSeconds);
        return true;
    }

    // --- 2. HELPERS ---
    
    function parseDuration(timeStr) {
        if (!timeStr) return 0;
        // Clean and split: "1:05" -> [1, 5] -> reverse [5, 1] (sec, min)
        const parts = timeStr.trim().split(':').map(Number).reverse();
        
        let seconds = 0;
        if (parts[0]) seconds += parts[0];           // Seconds
        if (parts[1]) seconds += parts[1] * 60;      // Minutes
        if (parts[2]) seconds += parts[2] * 3600;    // Hours
        if (parts[3]) seconds += parts[3] * 86400;   // Days
        return seconds;
    }

    function formatTime(totalSeconds) {
        // Format: 25h 30m 10s
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
        // Format: 1.25h
        const hours = totalSeconds / 3600;
        return `${hours.toFixed(2)}h`;
    }

    function removeInjectedElement() {
        const el = document.getElementById(INJECTED_ID);
        if (el) el.remove();
    }

    // --- 3. UI INJECTION ---
    
    function pollAndInject(totalSeconds, remainingSeconds) {
        // Wait for the UI container to exist and be visible
        // We use a counter to stop polling if it takes too long
        let attempts = 0;
        
        const pollInterval = setInterval(() => {
            attempts++;
            const indexWrapper = document.querySelector(TARGET_CONTAINER_SELECTOR);
            
            // Check existence and rough visibility
            const isVisible = indexWrapper && (indexWrapper.offsetWidth > 0 || indexWrapper.offsetHeight > 0);

            if (isVisible) {
                clearInterval(pollInterval);
                injectText(indexWrapper, totalSeconds, remainingSeconds);
            }

            if (attempts > 20) { // ~10 seconds
                 clearInterval(pollInterval);
            }
        }, 500);
    }

    function injectText(container, totalSeconds, remainingSeconds) {
        const formattedTotal = formatTime(totalSeconds);
        const formattedRemaining = formatDecimalHours(remainingSeconds);
        
        // Final string: "• 25h 30m 10s (12.55h left)"
        const finalText = ` • ${formattedTotal} (${formattedRemaining} left)`;

        let durationSpan = document.getElementById(INJECTED_ID);
        
        if (!durationSpan) {
            durationSpan = document.createElement('span');
            durationSpan.id = INJECTED_ID;
            
            // YouTube Metadata Styling
            durationSpan.style.color = 'var(--yt-spec-text-secondary)';
            durationSpan.style.marginLeft = '4px';
            durationSpan.style.fontSize = '1.2rem';
            durationSpan.style.fontWeight = '400';
            
            container.appendChild(durationSpan);
        }

        durationSpan.textContent = finalText;
        console.log(`Playlist Updated: ${finalText}`);
    }

    // --- 4. EXECUTION HANDLERS ---

    // Handler for the initial page load (Server Side Render)
    function handleInitialLoad() {
        // On first load, ytInitialData IS valid and fresh
        if (window.ytInitialData) {
            processPlaylistData(window.ytInitialData);
        }
    }

    // Handler for SPA Navigation (clicking videos/playlists without reload)
    function handleNavigation(event) {
        // 1. Try using the event response (Most efficient & Accurate)
        // This contains the NEW data for the page we just navigated to
        const responseData = event.detail && event.detail.response;
        const success = processPlaylistData(responseData);

        if (success) return;

        // 2. Fallback: Polymer Component Data
        // If event data didn't parse, wait for the DOM component to update.
        // We DO NOT use window.ytInitialData here because it is stale.
        console.log("Playlist Time: Event data incomplete, waiting for DOM component...");
        
        setTimeout(() => {
            // Access the live data attached to the playlist element
            const componentData = document.querySelector('ytd-playlist-panel-renderer')?.data;
                if (componentData) {
                    // Structure the mock to look like the API response
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
                }
        }, 1500); // 1.5s delay to let the UI framework settle
    }
    
    function handleNavigationStart() {
        // Remove the old time immediately so we don't show stale info while loading
        removeInjectedElement();
    }

    // --- 5. LISTENERS ---
    
    // 1. Run immediately on fresh load
    handleInitialLoad();

    // 2. Listen for navigation start (to clear UI immediately)
    window.addEventListener('yt-navigate-start', handleNavigationStart);

    // 3. Listen for navigation finish (to calculate new data)
    window.addEventListener('yt-navigate-finish', handleNavigation);

})();