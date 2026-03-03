importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Force immediate activation — don't wait for old tabs to close
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Delete the stale $scramjet IDB so it gets rebuilt with the correct schema on reload
async function nukeStaleIDB() {
    return new Promise((resolve, reject) => {
        const req = self.indexedDB.deleteDatabase("$scramjet");
        req.onsuccess = resolve;
        req.onerror = reject;
        req.onblocked = resolve; // proceed even if another tab has it open
    });
}

// Notify all client tabs to reload after we wipe the stale DB
async function reloadClients() {
    const allClients = await self.clients.matchAll({ type: "window" });
    for (const client of allClients) {
        client.navigate(client.url);
    }
}

async function handleRequest(event) {
    try {
        await scramjet.loadConfig();
    } catch (err) {
        // "NotFoundError" means the IDB schema is stale (object store missing).
        // Delete the bad DB and reload all tabs so a fresh DB is created.
        if (err && (err.name === "NotFoundError" || err.name === "InvalidStateError")) {
            console.warn("[sw] Stale IDB detected — wiping $scramjet DB and reloading clients.", err);
            try { await nukeStaleIDB(); } catch (_) { /* ignore */ }
            await reloadClients();
        }
        // Fall back to a plain network fetch so this request doesn't hang
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
