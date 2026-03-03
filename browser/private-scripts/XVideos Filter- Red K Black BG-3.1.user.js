// ==UserScript==
// @name         XVideos Filter: Red K Black BG
// @namespace    http://tampermonkey.net/
// @version      3.1
// @match        *://*.xvideos.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let minViews = parseInt(localStorage.getItem('xv_min_views')) || 500000;
    let minMinutes = parseInt(localStorage.getItem('xv_min_mins')) || 10;

    // --- Create UI ---
    const ui = document.createElement('div');
    ui.id = 'xv-filter-root';
    ui.style = "position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; font-family: sans-serif;";

    ui.innerHTML = `
        <style>
            #xv-panel {
                background: #111; color: white; padding: 15px; border-radius: 12px;
                border: 2px solid #f00; width: 190px; box-shadow: 0 0 20px rgba(0,0,0,0.9);
                display: none;
            }
            #xv-bubble {
                display: flex; align-items: center; justify-content: center;
                width: 60px; height: 60px;
                background: #000 !important; /* Black Background */
                color: #f00; /* Red Letter K */
                font-size: 35px; font-weight: bold;
                border-radius: 50%; border: 3px solid #f00; cursor: pointer;
                box-shadow: 0 0 15px rgba(255,0,0,0.3);
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                user-select: none;
            }
            #xv-bubble:hover { transform: scale(1.1); box-shadow: 0 0 20px rgba(255,0,0,0.6); }

            .xv-label { font-size: 10px; color: #aaa; margin-bottom: 5px; text-transform: uppercase; font-weight: bold; }
            .xv-input { width:100%; background:#222; color:white; border:1px solid #444; margin-bottom: 15px; padding: 8px; border-radius: 6px; box-sizing: border-box; }
            #xv-apply { width:100%; background:#f00; border:none; color:white; padding: 10px; cursor:pointer; font-weight:bold; border-radius: 6px; }
        </style>

        <div id="xv-bubble">K</div>
        <div id="xv-panel">
            <div style="font-weight: bold; color: #f00; font-size: 12px; margin-bottom: 15px; display:flex; justify-content:space-between; align-items:center;">
                <span>FILTER SETTINGS</span>
                <span id="xv-minimize" style="cursor:pointer; padding: 2px 8px; background: #333; border-radius: 4px; font-size: 10px; color: #fff;">CLOSE</span>
            </div>
            <div class="xv-label">Min Views</div>
            <input type="number" id="v-val" value="${minViews}" class="xv-input">
            <div class="xv-label">Min Minutes</div>
            <input type="number" id="t-val" value="${minMinutes}" class="xv-input">
            <button id="xv-apply">Apply & Hide</button>
            <div id="xv-counter" style="font-size: 11px; color: #0f0; margin-top: 15px; text-align: center; font-weight: bold;">Scanning...</div>
        </div>
    `;
    document.body.appendChild(ui);

    const panel = document.getElementById('xv-panel');
    const bubble = document.getElementById('xv-bubble');

    function applyFilter() {
        const videoTiles = document.querySelectorAll('.thumb-block, [id^="video_"], .mozaique .thumb-inside, .thumb');
        let hidden = 0;
        videoTiles.forEach(tile => {
            const metaText = tile.innerText.toLowerCase();
            if (!metaText) return;
            let hide = false;
            const vMatch = metaText.match(/([\d.]+)([km])\s*views/) || metaText.match(/([\d.]+)([km])(?!\w)/);
            let vCount = 0;
            if (vMatch) vCount = parseFloat(vMatch[1]) * (vMatch[2] === 'm' ? 1000000 : 1000);
            if (vCount > 0 && vCount < minViews) hide = true;
            if (!hide) {
                let mins = 0;
                const hM = metaText.match(/(\d+)\s*h/);
                const mM = metaText.match(/(\d+)\s*min/);
                if (hM) mins += parseInt(hM[1]) * 60;
                if (mM) mins += parseInt(mM[1]);
                if (mins > 0 && mins < minMinutes) hide = true;
            }
            tile.style.setProperty('display', hide ? 'none' : '', 'important');
            if (hide) hidden++;
        });
        const counter = document.getElementById('xv-counter');
        if (counter) counter.innerText = `Hidden: ${hidden}`;
    }

    document.getElementById('xv-apply').onclick = () => {
        minViews = parseInt(document.getElementById('v-val').value) || 0;
        minMinutes = parseInt(document.getElementById('t-val').value) || 0;
        localStorage.setItem('xv_min_views', minViews);
        localStorage.setItem('xv_min_mins', minMinutes);
        applyFilter();
        panel.style.display = 'none'; bubble.style.display = 'flex';
    };

    document.getElementById('xv-minimize').onclick = () => { panel.style.display = 'none'; bubble.style.display = 'flex'; };
    bubble.onclick = () => { bubble.style.display = 'none'; panel.style.display = 'block'; };

    setInterval(applyFilter, 1500);
})();