// ==UserScript==
// @name         Global Auto Hide Cursor
// @namespace    http://your-namespace
// @version      1.1
// @description  Hides mouse cursor after 5s of no movement, shows it for 5s after movement
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const HIDE_DELAY = 5000; // Time in ms before cursor is hidden
    let hideTimeout;

    function resetCursorTimer() {
        // Show the cursor by resetting it
        document.body.style.cursor = ''; // This allows the page's custom cursor to take effect
        clearTimeout(hideTimeout);

        // Hide again after delay with important to override any inline or stylesheet rules
        hideTimeout = setTimeout(() => {
            document.body.style.setProperty('cursor', 'none', 'important');
        }, HIDE_DELAY);
    }

    // Hook into any movement or interaction
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event =>
        document.addEventListener(event, resetCursorTimer, { passive: true })
    );

    // Start the timer on page load
    resetCursorTimer();
})();
