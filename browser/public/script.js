document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url-input');
    const goBtn = document.getElementById('go-btn');
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const reloadBtn = document.getElementById('reload-btn');
    const browserFrame = document.getElementById('browser-frame');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Keep history of visited URLs
    let history = [];
    let historyIndex = -1;

    // Base URL for the proxy server (Relative path works because we are on a unified origin)
    const PROXY_URL = '/proxy?url=';

    function isUrlValid(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function formatUrl(input) {
        input = input.trim();
        // If it doesn't start with http/https, try to see if it's a domain or search query
        if (!input.startsWith('http://') && !input.startsWith('https://')) {
            // Very basic heuristic for a domain
            if (input.includes('.') && !input.includes(' ')) {
                return 'https://' + input;
            } else {
                // Treat as google search
                return 'https://www.google.com/search?q=' + encodeURIComponent(input);
            }
        }
        return input;
    }

    function loadUrl(targetUrl, pushToHistory = true) {
        if (!targetUrl) return;

        const formattedUrl = formatUrl(targetUrl);
        urlInput.value = formattedUrl;

        // Ensure we only try to load valid URLs through the proxy
        if (isUrlValid(formattedUrl)) {
            // Show loading overlay
            loadingOverlay.classList.remove('hidden');

            const proxyTarget = PROXY_URL + encodeURIComponent(formattedUrl);
            console.log("Loading via proxy:", proxyTarget);

            // Note: because it's an iframe, we can't easily detect when it actually finishes loading
            // due to CORS issues if it navigates away, but we can detect the 'load' event on the iframe itself.
            browserFrame.src = proxyTarget;

            if (pushToHistory) {
                // If we're not at the end of the history array, truncate it
                if (historyIndex < history.length - 1) {
                    history = history.slice(0, historyIndex + 1);
                }
                history.push(formattedUrl);
                historyIndex++;
            }
        } else {
            console.error("Invalid URL attempted:", formattedUrl);
        }
    }

    // Event Listeners
    goBtn.addEventListener('click', () => {
        loadUrl(urlInput.value);
    });

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            loadUrl(urlInput.value);
        }
    });

    backBtn.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            loadUrl(history[historyIndex], false);
        }
    });

    forwardBtn.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            loadUrl(history[historyIndex], false);
        }
    });

    reloadBtn.addEventListener('click', () => {
        if (historyIndex >= 0) {
            loadUrl(history[historyIndex], false);
        }
    });

    // Handle iframe load completion
    browserFrame.addEventListener('load', () => {
        loadingOverlay.classList.add('hidden');
    });

    // Load initial URL
    const initialUrl = urlInput.value;
    if (initialUrl) {
        loadUrl(initialUrl);
    }
});
