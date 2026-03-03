const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// Response headers to strip before sending to client
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
    'content-encoding',
    'content-length',
]);

app.use('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Usage: /proxy?url=https://example.com');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return res.status(400).send('Invalid URL.');
    }

    try {
        console.log(`[Proxy] ${req.method} ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                // Do NOT set Host manually — node-fetch handles it, including after redirects
            },
            redirect: 'follow',
            follow: 10,
            // Let node-fetch handle decompression automatically
        });

        const finalUrl = response.url || targetUrl;
        let parsedFinalUrl;
        try { parsedFinalUrl = new URL(finalUrl); } catch { parsedFinalUrl = parsedUrl; }

        // Copy safe response headers
        response.headers.forEach((value, key) => {
            if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) {
                try { res.setHeader(key, value); } catch (e) { }
            }
        });

        res.setHeader('Access-Control-Allow-Origin', '*');

        // Read body (node-fetch auto-decompresses by default)
        const body = await response.buffer();

        // For HTML: inject <base> tag so relative URLs resolve to original site
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
            let html = body.toString('utf-8');
            const baseTag = `<base href="${parsedFinalUrl.origin}/">`;
            if (/<head[^>]*>/i.test(html)) {
                html = html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
            } else {
                html = baseTag + html;
            }
            const htmlBuffer = Buffer.from(html, 'utf-8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', htmlBuffer.length);
            res.status(response.status).end(htmlBuffer);
        } else {
            res.setHeader('Content-Length', body.length);
            res.status(response.status).end(body);
        }

    } catch (err) {
        console.error('[Proxy Error]', err.message);
        res.status(502).send(`Proxy Error: ${err.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Web Proxy Browser running on http://localhost:${PORT}`);
});
