// ==UserScript==
// @name         Instagram Sound Unmuter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Unmutes on load
// @match        https://www.instagram.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function runScript() {
        const test = document.querySelector("div[aria-label='Video player']");

        if (test) {
            try {
                const target = test.children[0]?.children[0]?.children[0]?.children[0]?.children[0];

                if (target) {
                    target.click();
                    console.log("Script: Successfully clicked the nested element.");
                }
            } catch (error) {
                console.error("Script: Video player found, but the child structure did not match.", error);
            }
        }
    }

    setTimeout(1000);
    runScript();

})();