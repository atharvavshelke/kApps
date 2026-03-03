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
        await scramjet.loadConfig();
    } catch (err) {
        // "NotFoundError"/"InvalidStateError" = stale IDB schema (object store missing).
        // Wipe the bad DB silently — scramjet.init() on the page will recreate it
        // with the correct schema. Fall through to a plain fetch() for this request.
        if (err && (err.name === "NotFoundError" || err.name === "InvalidStateError")) {
            console.warn("[sw] Stale IDB detected — wiping $scramjet DB.", err.message);
            try { await nukeStaleIDB(); } catch (_) { /* ignore */ }
        }
        return fetch(event.request);
    }

    if (scramjet.route(event)) {
        return scramjet.fetch(event);
    }
    return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event));
});
