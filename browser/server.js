const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// Headers that we NEVER want to pass to the target site
const BLOCKED_REQUEST_HEADERS = new Set([
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-forwarded-port',
    'x-real-ip',
    'x-original-ip',
    'cf-connecting-ip',
    'true-client-ip',
    'forwarded',
    'via',
    'host',
    'connection',
    'cookie',   // don't pass client's cookies to target
    'referer',  // don't reveal where we came from
]);

// Headers from the target we don't want to pass back to the client
const BLOCKED_RESPONSE_HEADERS = new Set([
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'strict-transport-security',
    'public-key-pins',
    'permissions-policy',
    'cross-origin-opener-policy',
    'cross-origin-embedder-policy',
    'cross-origin-resource-policy',
    'transfer-encoding', // we handle this ourselves
]);

app.use('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Target URL is required. Usage: /proxy?url=https://example.com');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return res.status(400).send('Invalid URL provided.');
    }

    // Build clean request headers — only pass safe, non-identifying ones
    const outboundHeaders = {
        'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Host': parsedUrl.host,
        'Connection': 'keep-alive',
    };

    try {
        console.log(`[Proxy] Fetching: ${targetUrl}`);

        const fetchOptions = {
            method: req.method,
            headers: outboundHeaders,
            redirect: 'manual', // handle redirects ourselves so we can rewrite them
        };

        // Forward body for POST/PUT/PATCH
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            fetchOptions.body = req;
            fetchOptions.duplex = 'half';
        }

        const targetRes = await fetch(targetUrl, fetchOptions);

        // Handle redirects — rewrite Location header to go through our proxy
        if ([301, 302, 303, 307, 308].includes(targetRes.status)) {
            const location = targetRes.headers.get('location');
            if (location) {
                let absoluteLocation = location;
                if (location.startsWith('/')) {
                    absoluteLocation = parsedUrl.origin + location;
                } else if (!location.startsWith('http')) {
                    absoluteLocation = parsedUrl.origin + '/' + location;
                }
                res.setHeader('Location', `/proxy?url=${encodeURIComponent(absoluteLocation)}`);
                return res.status(targetRes.status).end();
            }
        }

        // Build clean response headers
        for (const [key, value] of targetRes.headers.entries()) {
            const lowerKey = key.toLowerCase();
            if (!BLOCKED_RESPONSE_HEADERS.has(lowerKey)) {
                res.setHeader(key, value);
            }
        }

        // Set CORS so our frontend can use the response
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Proxied-By', 'kApps-Browser');

        res.status(targetRes.status);

        // Stream the response body back
        const body = await targetRes.arrayBuffer();
        res.end(Buffer.from(body));

    } catch (err) {
        console.error('[Proxy Error]', err.message);
        res.status(500).send(`Proxy Error: ${err.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Web Proxy Browser running on http://localhost:${PORT}`);
});
