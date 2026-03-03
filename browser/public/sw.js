importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Force immediate activation — don't wait for old tabs to close
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === 'claim') self.clients.claim();
});


async function handleRequest(event) {
    try {
        await scramjet.loadConfig();
    } catch (err) {
        // If config is missing or corrupted, serve the file natively without proxying.
        // The frontend script will detect the IDB corruption and prompt the user to repair it.
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
