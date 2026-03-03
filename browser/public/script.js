// ── Scramjet Proxy Frontend ──
// Uses Scramjet's JS-level URL rewriting - no iframe sandboxing needed

// Scramjet exposes its controller loader globally after scramjet.all.js runs
const { ScramjetController } = $scramjetLoadController();

// ── DOM References ──
const urlInput = document.getElementById('url-input');
const goBtn = document.getElementById('go-btn');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const homeBtn = document.getElementById('home-btn');
const swBanner = document.getElementById('sw-banner');
const landing = document.getElementById('landing');
const proxyFrame = document.getElementById('proxy-frame');
const landingInput = document.getElementById('landing-input');
const landingGo = document.getElementById('landing-go');

// ── Create Scramjet Controller ──
const scramjet = new ScramjetController({
    prefix: "/scram/",
    files: {
        wasm: "/scram/scramjet.wasm.wasm",
        all: "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
    },
});

// ScramjetFrame wraps the iframe and provides navigation
let scramjetFrame = null;

// ── URL Helpers ──
function formatUrl(input) {
    input = input.trim();
    if (!input) return null;
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
        // Looks like a domain, not a search
        if (input.includes('.') && !input.includes(' ')) {
            return 'https://' + input;
        }
        // Search query
        return 'https://duckduckgo.com/?q=' + encodeURIComponent(input);
    }
    return input;
}

// ── Show/hide landing vs proxy ──
function showLanding() {
    landing.classList.remove('hidden');
    proxyFrame.classList.add('hidden');
    urlInput.value = '';
    document.querySelector('.security-icon').className = 'fas fa-globe security-icon';
}

function showProxy() {
    landing.classList.add('hidden');
    proxyFrame.classList.remove('hidden');
}

function updateAddressBar(url) {
    urlInput.value = url || '';
    const icon = document.querySelector('.security-icon');
    icon.className = (url && url.startsWith('https://'))
        ? 'fas fa-lock security-icon'
        : 'fas fa-unlock security-icon';
}

// ── Navigate to URL through Scramjet ──
function navigate(rawInput) {
    const url = formatUrl(rawInput);
    if (!url) return;

    console.log('Loading:', url);
    updateAddressBar(url);
    showProxy();

    if (scramjetFrame) {
        scramjetFrame.go(url);
    } else {
        // Fallback: use encodeUrl directly
        proxyFrame.src = scramjet.encodeUrl(url);
    }
}

// ── Sync address bar from Scramjet frame ──
function syncAddressBar() {
    if (!scramjetFrame) return;
    try {
        const real = scramjetFrame.url;
        if (real && real.href !== 'about:blank') {
            updateAddressBar(real.href);
        }
    } catch { /* cross-origin fine */ }
}

proxyFrame.addEventListener('load', syncAddressBar);

// ── Service Worker + Scramjet init ──
async function ensureCleanIDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open('$scramjet');
        req.onupgradeneeded = (e) => {
            // DB doesn't exist or needs upgrade. Let Scramjet handle it later.
            e.target.transaction.abort();
            resolve(true);
        };
        req.onsuccess = async (e) => {
            const db = e.target.result;
            const hasConfig = db.objectStoreNames.contains('config');
            db.close();

            if (!hasConfig) {
                console.warn('Scramjet IDB is corrupted (missing config). Wiping...');
                try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const reg of regs) await reg.unregister();
                } catch (err) { }

                const delReq = indexedDB.deleteDatabase('$scramjet');
                delReq.onsuccess = () => resolve(false);
                delReq.onerror = () => resolve(false);
                delReq.onblocked = () => resolve(false);
            } else {
                resolve(true);
            }
        };
        req.onerror = () => resolve(true);
    });
}

async function init() {
    if (!('serviceWorker' in navigator)) {
        swBanner.querySelector('span').textContent = '⚠️ Service Workers not supported';
        return;
    }

    // Check and repair IDB before any SW starts
    const isClean = await ensureCleanIDB();
    if (!isClean) {
        swBanner.querySelector('span').innerHTML = '⚠️ Corrupted proxy database cleared. <a href="javascript:window.location.reload()" style="color:var(--primary)">Click here to reload</a>.';
        return;
    }

    try {
        // Register fresh Scramjet Service Worker
        await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
        });

        // Wait for the service worker to be fully ready
        await navigator.serviceWorker.ready;

        // Send Scramjet config to SW (This must happen BEFORE bare-mux tries to download its transport script, or the SW will crash)
        await scramjet.init();

        // Set up bare-mux transport — epoxy-transport is ESM + no WASM dependency
        const conn = new BareMux.BareMuxConnection('/baremux/worker.js');
        const wispUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/wisp/`;

        console.log('Transport setup: /epoxy/index.mjs');
        // epoxy-transport expects an object with a 'wisp' property
        await conn.setTransport('/epoxy/index.mjs', [{ wisp: wispUrl }]);

        // Create a ScramjetFrame wrapping the proxy iframe
        scramjetFrame = scramjet.createFrame(proxyFrame);

        console.log('✅ Scramjet proxy ready');
        swBanner.style.display = 'none';
    } catch (err) {
        console.error('Proxy init error:', err);
        swBanner.querySelector('span').textContent = '⚠️ Proxy engine error: ' + err.message;
    }
}

// ── Toolbar Events ──
goBtn.addEventListener('click', () => navigate(urlInput.value));
urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') navigate(urlInput.value);
});

backBtn.addEventListener('click', () => {
    scramjetFrame ? scramjetFrame.back() : proxyFrame.contentWindow?.history.back();
});
forwardBtn.addEventListener('click', () => {
    scramjetFrame ? scramjetFrame.forward() : proxyFrame.contentWindow?.history.forward();
});
reloadBtn.addEventListener('click', () => {
    if (!proxyFrame.classList.contains('hidden')) {
        scramjetFrame ? scramjetFrame.reload() : proxyFrame.contentWindow?.location.reload();
    }
});
homeBtn.addEventListener('click', showLanding);

// ── Landing page events ──
landingGo.addEventListener('click', () => navigate(landingInput.value));
landingInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') navigate(landingInput.value);
});
document.querySelectorAll('.shortcut').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.url));
});

// ── Ctrl+L: focus address bar ──
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        urlInput.focus();
        urlInput.select();
    }
});

// ── Boot ──
init();
