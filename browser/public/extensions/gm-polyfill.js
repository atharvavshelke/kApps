/**
 * Greasemonkey/Tampermonkey API Polyfill
 * This script runs in the proxied webpage to provide basic GM_ functions
 * to userscripts injected by Ultraviolet.
 */

(function () {
    window.GM_addStyle = function (cssText) {
        try {
            const style = document.createElement('style');
            style.textContent = cssText;
            (document.head || document.documentElement).appendChild(style);
        } catch (e) {
            console.error("GM_addStyle polyfill error:", e);
        }
    };

    window.GM_setValue = function (key, value) {
        try {
            localStorage.setItem('GM_' + key, JSON.stringify(value));
        } catch (e) {
            console.error("GM_setValue polyfill error:", e);
        }
    };

    window.GM_getValue = function (key, defaultValue) {
        try {
            const val = localStorage.getItem('GM_' + key);
            return val ? JSON.parse(val) : defaultValue;
        } catch (e) {
            console.error("GM_getValue polyfill error:", e);
            return defaultValue;
        }
    };

    window.GM_deleteValue = function (key) {
        try {
            localStorage.removeItem('GM_' + key);
        } catch (e) {
            console.error("GM_deleteValue polyfill error:", e);
        }
    };

    // Sometimes scripts just expect the GM object to exist
    window.GM = {
        addStyle: window.GM_addStyle,
        setValue: window.GM_setValue,
        getValue: window.GM_getValue,
        deleteValue: window.GM_deleteValue
    };
})();
