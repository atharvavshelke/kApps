// ─────────────────────────────────────────────────────
//  Service Worker — Intercepts cross-origin requests
//  from proxied pages and routes them through our server
// ─────────────────────────────────────────────────────

const PROXY_API = '/api/proxy?url=';

// ── Telemetry / tracking patterns to silently block ──
// These requests are non-essential and always fail when proxied,
// flooding the console with 502 errors.
const BLOCKED_PATTERNS = [
    '/gen_204',
    '/client_204',
    '/log?format=json',
    '/httpservice/retry/',
    'play.google.com/log',
    'ogads-pa.clients6.google.com',
    '.doubleclick.net/',
    'adservice.google.',
    '/pagead/',
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.com/tr',
    '/shared_dict/',
];

function isBlockedUrl(url) {
    return BLOCKED_PATTERNS.some(p => url.includes(p));
}

self.addEventListener('install', () => {
    // Activate immediately, don't wait for old SW to release
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Take control of all pages in scope immediately
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const selfOrigin = self.location.origin;

    // ── Same-origin requests: let them pass through ──
    if (url.origin === selfOrigin) {
        // /~/ page requests → handled by server
        // /api/ requests → handled by server
        // static files → handled by server
        return;
    }

    // ── Block telemetry / tracking requests ──
    if (isBlockedUrl(event.request.url)) {
        event.respondWith(new Response(null, { status: 204 }));
        return;
    }

    // ── Cross-origin requests from proxied pages ──
    // These are the requests that used to cause CORS errors!

    if (event.request.mode === 'navigate') {
        // Navigation (clicking a link, form submit, etc.)
        // → Redirect to our /~/ proxy route so the server can
        //   inject <base> tag and patches into the HTML
        event.respondWith(
            Response.redirect('/~/' + event.request.url, 302)
        );
        return;
    }

    // Sub-resource requests (scripts, images, XHR, fetch, etc.)
    // → Proxy through our API
    event.respondWith(proxyRequest(event.request));
});

async function proxyRequest(request) {
    const proxyUrl = PROXY_API + encodeURIComponent(request.url);

    try {
        // Forward the request body for POST/PUT/PATCH
        let body = null;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            try {
                body = await request.arrayBuffer();
            } catch {
                // Body may not be readable in some cases
            }
        }

        const response = await fetch(proxyUrl, {
            method: request.method,
            body: body,
            headers: {
                'Accept': request.headers.get('Accept') || '*/*',
            },
        });

        // Return the proxied response
        // We create a new Response to ensure it's not opaque
        const responseBody = await response.arrayBuffer();
        return new Response(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    } catch (err) {
        return new Response(`Service Worker Proxy Error: ${err.message}`, {
            status: 502,
            statusText: 'Bad Gateway',
        });
    }
}
