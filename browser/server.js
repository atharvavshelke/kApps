const express = require('express');
const cors = require('cors');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// Headers from the target we strip before forwarding to client
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
    'transfer-encoding',
    'content-encoding', // we decode on the server and send plain
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

    // Build clean, non-identifying request headers from scratch
    const outboundHeaders = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br', // request compressed, decode server-side
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Host': parsedUrl.host,
        'Connection': 'keep-alive',
        // Intentionally omitting: x-forwarded-*, x-real-ip, forwarded, via, referer, cookie
    };

    try {
        console.log(`[Proxy] ${req.method} ${targetUrl}`);

        const fetchOptions = {
            method: req.method,
            headers: outboundHeaders,
            redirect: 'manual',
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            fetchOptions.body = req;
            fetchOptions.duplex = 'half';
        }

        const targetRes = await fetch(targetUrl, fetchOptions);

        // Rewrite redirects back through our proxy
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

        // Copy safe response headers
        for (const [key, value] of targetRes.headers.entries()) {
            if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(targetRes.status);

        // Read compressed body and decompress server-side
        const rawBuffer = Buffer.from(await targetRes.arrayBuffer());
        const encoding = targetRes.headers.get('content-encoding') || '';

        let body;
        try {
            if (encoding.includes('br')) {
                body = await brotliDecompress(rawBuffer);
            } else if (encoding.includes('gzip')) {
                body = await gunzip(rawBuffer);
            } else if (encoding.includes('deflate')) {
                body = await inflate(rawBuffer);
            } else {
                body = rawBuffer;
            }
        } catch (decompressErr) {
            // If decompression fails, send raw (it might already be uncompressed)
            console.warn('[Proxy] Decompression skipped:', decompressErr.message);
            body = rawBuffer;
        }

        res.end(body);

    } catch (err) {
        console.error('[Proxy Error]', err.message);
        res.status(502).send(`Proxy Error: ${err.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Web Proxy Browser running on http://localhost:${PORT}`);
});
