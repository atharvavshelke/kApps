const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers to strip from proxied responses ──
const BLOCKED_HEADERS = new Set([
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'strict-transport-security',
    'public-key-pins',
    'permissions-policy',
    'cross-origin-opener-policy',
    'cross-origin-embedder-policy',
    'cross-origin-resource-policy',
    'transfer-encoding',
    'content-encoding',
    'content-length',
]);

// ── Favicon ──
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// ── Static files (index.html, script.js, style.css, sw.js) ──
app.use(express.static('public'));

// ── Parse raw body for POST forwarding on /api/proxy ──
app.use('/api/proxy', express.raw({ type: '*/*', limit: '50mb' }));

// ── Helper: copy safe headers to response ──
function copySafeHeaders(from, to) {
    from.forEach((value, key) => {
        if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
            try { to.setHeader(key, value); } catch { }
        }
    });
}

// ── Helper: build upstream fetch options ──
function buildFetchOptions(method, reqHeaders, body) {
    const opts = {
        method,
        headers: {
            'Accept': reqHeaders.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': reqHeaders['accept-language'] || 'en-US,en;q=0.9',
            'User-Agent': reqHeaders['user-agent'] ||
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
        follow: 10,
    };
    if (body && body.length && method !== 'GET' && method !== 'HEAD') {
        opts.body = body;
        if (reqHeaders['content-type']) {
            opts.headers['Content-Type'] = reqHeaders['content-type'];
        }
    }
    return opts;
}

// ── Script injected into proxied HTML to patch browser APIs ──
function getInjectedScript() {
    return `<script data-proxy="true">
(function(){
    // Suppress history API SecurityErrors
    var _ps = history.pushState, _rs = history.replaceState;
    history.pushState = function(){try{return _ps.apply(this,arguments)}catch(e){}};
    history.replaceState = function(){try{return _rs.apply(this,arguments)}catch(e){}};

    // Suppress errors from cross-origin scripts
    window.addEventListener('error', function(e) {
        if (e.message === 'Script error.' || (e.filename && e.filename.includes('/proxy'))) {
            e.preventDefault();
        }
    });
})();
</script>`;
}

// ═══════════════════════════════════════════════════════
//  /api/proxy?url=TARGET  —  Raw proxy for Service Worker
// ═══════════════════════════════════════════════════════
app.all('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing ?url= parameter');

    try {
        new URL(targetUrl);
    } catch {
        return res.status(400).send('Invalid URL');
    }

    try {
        const upstream = await fetch(
            targetUrl,
            buildFetchOptions(req.method, req.headers, req.body)
        );

        copySafeHeaders(upstream.headers, res);

        // Ensure the browser can read this response
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        const body = await upstream.buffer();
        res.setHeader('Content-Length', body.length);
        res.status(upstream.status).end(body);
    } catch (err) {
        console.error('[API Proxy Error]', err.message);
        res.status(502).send(`Proxy Error: ${err.message}`);
    }
});

// Handle CORS preflight for proxy API
app.options('/api/proxy', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
});

// ═══════════════════════════════════════════════════════
//  /~/TARGET_URL  —  Full-page proxy (navigation endpoint)
// ═══════════════════════════════════════════════════════
app.use(async (req, res, next) => {
    // Only handle requests starting with /~/
    if (!req.originalUrl.startsWith('/~/')) return next();

    const targetUrl = req.originalUrl.slice(3); // Strip "/~/"
    if (!targetUrl) return res.status(400).send('Missing target URL');

    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch {
        return res.status(400).send('Invalid URL: ' + targetUrl);
    }

    try {
        console.log(`[Page Proxy] ${req.method} ${targetUrl}`);

        const upstream = await fetch(
            targetUrl,
            buildFetchOptions(req.method, req.headers, null)
        );

        // Determine the final URL after any redirects
        const finalUrl = upstream.url || targetUrl;
        let finalParsed;
        try { finalParsed = new URL(finalUrl); } catch { finalParsed = parsed; }

        copySafeHeaders(upstream.headers, res);

        // Ensure this can always be displayed in our iframe
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Frame-Options', 'ALLOWALL');

        const body = await upstream.buffer();
        const contentType = upstream.headers.get('content-type') || '';

        if (contentType.includes('text/html')) {
            let html = body.toString('utf-8');

            // Inject <base> tag pointing to the original site's origin
            // This makes relative URLs resolve to the original domain.
            // The Service Worker intercepts these cross-origin requests!
            const baseTag = `<base href="${finalParsed.origin}/">`;
            const patches = getInjectedScript();

            if (/<head[^>]*>/i.test(html)) {
                html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}\n${patches}`);
            } else if (/<html[^>]*>/i.test(html)) {
                html = html.replace(/<html[^>]*>/i, (m) => `${m}<head>${baseTag}${patches}</head>`);
            } else {
                html = `${baseTag}${patches}${html}`;
            }

            const buf = Buffer.from(html, 'utf-8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', buf.length);
            res.status(upstream.status).end(buf);
        } else {
            // Non-HTML: pass through as-is
            res.setHeader('Content-Length', body.length);
            res.status(upstream.status).end(body);
        }
    } catch (err) {
        console.error('[Page Proxy Error]', err.message);
        res.status(502).send(`Proxy Error: ${err.message}`);
    }
});

// ── Start ──
app.listen(PORT, () => {
    console.log(`🌐 Web Proxy Browser running → http://localhost:${PORT}`);
});
