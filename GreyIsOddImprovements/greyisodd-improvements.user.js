// ==UserScript==
// @name        GreyIsOdd: Right-Click to Double-Click
// @namespace   Violentmonkey Scripts
// @match       https://www.greyisodd.com/*
// @grant       none
// @version     1.0
// @description Captures right-clicks and simulates a double-click instead.
// ==/UserScript==

(function() {
    'use strict';

    // Add event listener to the document for the right-click context menu
    document.addEventListener('contextmenu', function(event) {
        // Prevent the default right-click menu from appearing
        event.preventDefault();

        // Create a new click event
        const clickEvent = new MouseEvent('click', {
            bubbles: true,        // Allow the event to bubble up the DOM
            cancelable: true,     // Allow the event to be canceled
            view: window,
            clientX: event.clientX, // Keep the original mouse coordinates
            clientY: event.clientY,
            screenX: event.screenX,
            screenY: event.screenY,
            button: 0             // Button 0 indicates a primary (left) button click
        });

        // Dispatch the simulated double-click to the element that was right-clicked
        event.target.dispatchEvent(clickEvent);
        event.target.dispatchEvent(clickEvent);

    }, true); // Setting 'true' uses the capture phase to ensure it runs early
})();