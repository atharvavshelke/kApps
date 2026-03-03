importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Force immediate activation — don't wait for old tabs to close
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === 'claim') self.clients.claim();
});

// Delete the stale $scramjet IDB so it gets rebuilt with the correct schema on reload
async function nukeStaleIDB() {
    return new Promise((resolve, reject) => {
        const req = self.indexedDB.deleteDatabase("$scramjet");
        req.onsuccess = resolve;
        req.onerror = reject;
        req.onblocked = resolve; // proceed even if another tab has it open
    });
}


async function handleRequest(event) {
    try {
        const url = new URL(event.request.url);

        // Skip interception for core Scramjet files if they are requested directly
        if (url.pathname.startsWith("/scram/") &&
            (url.pathname.endsWith(".js") || url.pathname.endsWith(".wasm") || url.pathname.endsWith(".json"))) {
            return fetch(event.request);
        }

        await scramjet.loadConfig();

        // Defensive check: if config is missing, fall back to standard fetch
        if (!scramjet.config || !scramjet.config.prefix) {
            return fetch(event.request);
        }

        if (scramjet.route(event)) {
            return await scramjet.fetch(event);
        }
    } catch (err) {
        console.error("[sw] Scramjet interception error:", err);
        return fetch(event.request);
    }

    return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event));
});
