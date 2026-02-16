// ==UserScript==
// @name         YouTube Playlist Total Duration & Remaining
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  Calculates total playlist time + time remaining and displays it next to the video count. Handles SPA navigation correctly.
// @author       You
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_CONTAINER_SELECTOR = '.index-message-wrapper';
    const INJECTED_ID = 'playlist-total-duration';

    // Global timers to manage cleanup during navigation
    let activePollInterval = null;
    let activeFallbackTimeout = null;

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

        pollAndInject(totalSeconds, remainingSeconds);
        return true;
    }

    // --- 2. HELPERS ---
    
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

    // --- 3. UI INJECTION ---
    
    function pollAndInject(totalSeconds, remainingSeconds) {
        // Clear any previous pollers to prevent conflicts
        if (activePollInterval) clearInterval(activePollInterval);

        let attempts = 0;
        
        activePollInterval = setInterval(() => {
            attempts++;
            const indexWrapper = document.querySelector(TARGET_CONTAINER_SELECTOR);
            
            const isVisible = indexWrapper && (indexWrapper.offsetWidth > 0 || indexWrapper.offsetHeight > 0);

            if (isVisible) {
                clearInterval(activePollInterval);
                activePollInterval = null;
                injectText(indexWrapper, totalSeconds, remainingSeconds);
            }

            if (attempts > 20) { 
                 clearInterval(activePollInterval);
                 activePollInterval = null;
            }
        }, 500);
    }

    function injectText(container, totalSeconds, remainingSeconds) {
        const formattedTotal = formatTime(totalSeconds);
        const formattedRemaining = formatDecimalHours(remainingSeconds);
        
        const finalText = ` • ${formattedTotal} (${formattedRemaining} left)`;

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

        durationSpan.textContent = finalText;
        console.log(`Playlist Updated: ${finalText}`);
    }

    // --- 4. EXECUTION HANDLERS ---

    function handleInitialLoad() {
        if (window.ytInitialData) {
            processPlaylistData(window.ytInitialData);
        }
    }

    function handleNavigation(event) {
        // Clear any lingering fallback timers from previous navigation attempts
        clearTimers();

        const responseData = event.detail && event.detail.response;
        const success = processPlaylistData(responseData);

        if (success) return;

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
                }
        }, 1500); 
    }
    
    function handleNavigationStart() {
        // STOP everything from the previous page
        clearTimers();
        removeInjectedElement();
    }

    // --- 5. LISTENERS ---
    
    handleInitialLoad();
    window.addEventListener('yt-navigate-start', handleNavigationStart);
    window.addEventListener('yt-navigate-finish', handleNavigation);

})();