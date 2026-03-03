importScripts('uv.bundle.js');
importScripts('uv.config.js');
importScripts('uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('fetch', (event) => {
    event.respondWith(uv.fetch(event));
});
