document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url-input');
    const goBtn = document.getElementById('go-btn');
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const reloadBtn = document.getElementById('reload-btn');
    const browserFrame = document.getElementById('browser-frame');
    const loadingOverlay = document.getElementById('loading-overlay');
    const swBanner = document.getElementById('sw-banner');

    // History stack
    let history = [];
    let historyIndex = -1;

    // ── Service Worker Registration ──
    // We MUST wait for the SW to be active before loading anything,
    // otherwise cross-origin requests won't be intercepted.
    let swReady = false;

    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Workers not supported — proxy will have limited functionality');
            swBanner.style.display = 'none';
            swReady = true;
            loadInitial();
            return;
        }

        try {
            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            console.log('Service Worker registered:', reg.scope);

            // Wait for the SW to become active
            if (reg.active) {
                onSwReady();
            } else {
                const sw = reg.installing || reg.waiting;
                if (sw) {
                    sw.addEventListener('statechange', () => {
                        if (sw.state === 'activated') onSwReady();
                    });
                }
            }
        } catch (err) {
            console.error('Service Worker registration failed:', err);
            swBanner.textContent = 'Proxy engine failed to start';
            // Fall back to direct loading
            swReady = true;
            loadInitial();
        }
    }

    function onSwReady() {
        console.log('✅ Service Worker active — proxy engine ready');
        swReady = true;
        swBanner.style.display = 'none';
        loadInitial();
    }

    // ── URL helpers ──
    function isUrlValid(str) {
        try { new URL(str); return true; } catch { return false; }
    }

    function formatUrl(input) {
        input = input.trim();
        if (!input.startsWith('http://') && !input.startsWith('https://')) {
            if (input.includes('.') && !input.includes(' ')) {
                return 'https://' + input;
            }
            return 'https://www.google.com/search?q=' + encodeURIComponent(input);
        }
        return input;
    }

    // ── Load a URL through the proxy ──
    function loadUrl(targetUrl, pushToHistory = true) {
        if (!targetUrl) return;

        const formattedUrl = formatUrl(targetUrl);
        urlInput.value = formattedUrl;

        if (!isUrlValid(formattedUrl)) {
            console.error('Invalid URL:', formattedUrl);
            return;
        }

        // Show loading
        loadingOverlay.classList.remove('hidden');

        // Use the /~/ route — the server fetches the page, injects <base> + patches,
        // and the Service Worker handles all sub-resource requests
        const proxiedPath = '/~/' + formattedUrl;
        console.log('Loading:', proxiedPath);
        browserFrame.src = proxiedPath;

        if (pushToHistory) {
            if (historyIndex < history.length - 1) {
                history = history.slice(0, historyIndex + 1);
            }
            history.push(formattedUrl);
            historyIndex++;
        }

        updateNavButtons();
    }

    function updateNavButtons() {
        backBtn.disabled = historyIndex <= 0;
        forwardBtn.disabled = historyIndex >= history.length - 1;
        backBtn.style.opacity = historyIndex > 0 ? '1' : '0.4';
        forwardBtn.style.opacity = historyIndex < history.length - 1 ? '1' : '0.4';
    }

    // ── Event Listeners ──
    goBtn.addEventListener('click', () => loadUrl(urlInput.value));

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadUrl(urlInput.value);
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
        if (historyIndex >= 0) loadUrl(history[historyIndex], false);
    });

    // Handle iframe load completion
    browserFrame.addEventListener('load', () => {
        loadingOverlay.classList.add('hidden');

        // Try to update the URL bar with the actual URL the iframe navigated to
        try {
            const iframePath = browserFrame.contentWindow.location.pathname;
            if (iframePath && iframePath.startsWith('/~/')) {
                const realUrl = iframePath.slice(3) + browserFrame.contentWindow.location.search;
                if (realUrl && realUrl !== urlInput.value) {
                    urlInput.value = realUrl;
                }
            }
        } catch {
            // Cross-origin access blocked — that's fine
        }
    });

    // ── Initial load ──
    function loadInitial() {
        const initialUrl = urlInput.value;
        if (initialUrl) loadUrl(initialUrl);
        updateNavButtons();
    }

    // Go!
    registerServiceWorker();
});
