/**
 * kApps Proxy Adblocker Simulator
 * Injected into all pages via Ultraviolet
 * Hides common ad elements and prevents popups.
 */

(function () {
    // 1. Hide ad elements via CSS
    const adStyle = document.createElement('style');
    adStyle.textContent = `
        .ad, .ads, .ad-banner, .advertisement, [id^="div-gpt-ad-"],
        [class*="-ad-"], [class*="ad-"], [id*="ad-"],
        iframe[src*="doubleclick.net"], iframe[src*="googlesyndication.com"],
        .sponsored, .taboola, .outbrain
        { display: none !important; opacity: 0 !important; pointer-events: none !important; }
    `;
    (document.head || document.documentElement).appendChild(adStyle);

    // 2. Intercept window.open (Popups)
    const originalOpen = window.open;
    window.open = function (url, target, features) {
        if (target === "_blank" || !target) {
            console.log("kApps Adblocker blocked a popup attempt to:", url);
            return null; // Block popup
        }
        return originalOpen(url, target, features);
    };

    console.log("kApps Adblocker (uBlock Simulation) Initialized.");
})();
