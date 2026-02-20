// ==UserScript==
// @name        GreyIsOdd: Enhanced Controls
// @namespace   Violentmonkey Scripts
// @match       https://www.greyisodd.com/*
// @grant       none
// @version     2.0
// @description Right-click for double-click, click hints to fill row/column
// ==/UserScript==
(function() {
    'use strict';

    // Inject custom CSS for hover effects
    const style = document.createElement('style');
    style.textContent = `
        .hint {
            cursor: pointer;
            transition: background 0.15s ease, box-shadow 0.15s ease;
        }

        .hint:not(.ok):hover {
            background: #3e3e55;
            box-shadow: 0 0 8px rgba(240, 240, 240, 0.3);
        }

        .cell.gray {
            transition: background 0.15s ease;
        }

        .cell.gray:hover {
            background: #b0b0b0;
        }
    `;
    document.head.appendChild(style);

    // Simulate clicks on a target element
    function simulateClicks(target, count) {
        for (let i = 0; i < count; i++) {
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            target.dispatchEvent(clickEvent);
        }
    }

    // Get grid size from HTML style (--grid-size)
    function getGridSize() {
        const htmlStyle = document.documentElement.style.getPropertyValue('--grid-size');
        return parseInt(htmlStyle, 10) || 7;
    }

    // Get all cells in a specific row (0-indexed)
    function getRowCells(rowIndex) {
        const gridSize = getGridSize();
        const board = document.querySelector('.board');
        if (!board) return [];

        const allChildren = Array.from(board.children);
        // Grid has gridSize+1 columns (hints + cells)
        // Row 0 starts after the first row of hints (gridSize+1 elements)
        // Each row has gridSize+1 elements (1 row-hint + gridSize cells)
        const columnsPerRow = gridSize + 1;
        const startIndex = (rowIndex + 1) * columnsPerRow + 1; // +1 to skip row-hint

        const cells = [];
        for (let i = 0; i < gridSize; i++) {
            const cell = allChildren[startIndex + i];
            if (cell && cell.classList.contains('cell')) {
                cells.push(cell);
            }
        }
        return cells;
    }

    // Get all cells in a specific column (0-indexed)
    function getColumnCells(colIndex) {
        const gridSize = getGridSize();
        const board = document.querySelector('.board');
        if (!board) return [];

        const allChildren = Array.from(board.children);
        const columnsPerRow = gridSize + 1;

        const cells = [];
        for (let row = 0; row < gridSize; row++) {
            // First row of grid is hints, so actual cells start at row 1
            // Each row: row-hint + cells
            const cellIndex = (row + 1) * columnsPerRow + 1 + colIndex;
            const cell = allChildren[cellIndex];
            if (cell && cell.classList.contains('cell')) {
                cells.push(cell);
            }
        }
        return cells;
    }

    // Apply clicks to cells that don't have dot or cross
    function fillCells(cells, clickCount) {
        cells.forEach(cell => {
            if (!cell.classList.contains('dot') && !cell.classList.contains('cross')) {
                simulateClicks(cell, clickCount);
            }
        });
    }

    // Get the index of a hint element
    function getHintIndex(hintElement) {
        const board = document.querySelector('.board');
        if (!board) return -1;

        const gridSize = getGridSize();

        if (hintElement.classList.contains('col-hint')) {
            // Column hints are in the first row, after the corner
            const colHints = Array.from(board.querySelectorAll('.col-hint'));
            return colHints.indexOf(hintElement);
        } else if (hintElement.classList.contains('row-hint')) {
            // Row hints are the first element of each row (after the header row)
            const rowHints = Array.from(board.querySelectorAll('.row-hint'));
            return rowHints.indexOf(hintElement);
        }
        return -1;
    }

    // Handle hint clicks
    function handleHintClick(event, isRightClick) {
        const hint = event.target;
        if (!hint.classList.contains('hint')) return;

        const clickCount = isRightClick ? 2 : 1;
        const index = getHintIndex(hint);

        if (index === -1) return;

        if (hint.classList.contains('col-hint')) {
            const cells = getColumnCells(index);
            fillCells(cells, clickCount);
        } else if (hint.classList.contains('row-hint')) {
            const cells = getRowCells(index);
            fillCells(cells, clickCount);
        }
    }

    // Right-click on cells: simulate double-click
    document.addEventListener('contextmenu', function(event) {
        event.preventDefault();

        const target = event.target;

        // If it's a hint, handle specially
        if (target.classList.contains('hint')) {
            handleHintClick(event, true);
            return;
        }

        // Otherwise, simulate double-click on the element
        simulateClicks(target, 2);
    }, true);

    // Left-click on hints: fill with single clicks
    document.addEventListener('click', function(event) {
        const target = event.target;

        if (target.classList.contains('hint')) {
            handleHintClick(event, false);
        }
    }, true);
})();