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

// Response headers that we remove before sending to the client
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
    'content-encoding', // We decompress server-side and send raw
    'content-length',   // We recalculate after decompression
]);

async function decompressBuffer(buffer, encoding) {
    try {
        if (encoding.includes('br')) return await brotliDecompress(buffer);
        if (encoding.includes('gzip')) return await gunzip(buffer);
        if (encoding.includes('deflate')) return await inflate(buffer);
    } catch (e) {
        console.warn('[Proxy] Decompression failed, using raw buffer:', e.message);
    }
    return buffer;
}

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

    // Build clean outbound headers — no identifying info
    const outboundHeaders = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Host': parsedUrl.host,
        'Connection': 'keep-alive',
        // Intentionally omitting all forwarding headers and client identity headers
    };

    try {
        console.log(`[Proxy] ${req.method} ${targetUrl}`);

        const fetchOptions = {
            method: req.method,
            headers: outboundHeaders,
            redirect: 'follow', // Let fetch handle redirects automatically
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            fetchOptions.body = req;
            fetchOptions.duplex = 'half';
        }

        const targetRes = await fetch(targetUrl, fetchOptions);
        const finalUrl = targetRes.url; // URL after redirects
        let parsedFinalUrl;
        try {
            parsedFinalUrl = new URL(finalUrl);
        } catch {
            parsedFinalUrl = parsedUrl;
        }

        // Copy safe response headers
        for (const [key, value] of targetRes.headers.entries()) {
            if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) {
                try { res.setHeader(key, value); } catch { }
            }
        }
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Read and decompress body
        const rawBuffer = Buffer.from(await targetRes.arrayBuffer());
        const encoding = targetRes.headers.get('content-encoding') || '';
        const body = await decompressBuffer(rawBuffer, encoding);

        // For HTML responses: inject <base> tag so relative URLs resolve correctly
        const contentType = targetRes.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
            let html = body.toString('utf-8');
            const baseTag = `<base href="${parsedFinalUrl.origin}/">`;
            // Inject after <head> if it exists, otherwise at the top
            if (html.includes('<head>')) {
                html = html.replace('<head>', `<head>${baseTag}`);
            } else if (html.includes('<head ')) {
                html = html.replace(/<head[^>]*>/, (m) => `${m}${baseTag}`);
            } else {
                html = baseTag + html;
            }
            const htmlBuffer = Buffer.from(html, 'utf-8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Length', htmlBuffer.length);
            res.status(targetRes.status).end(htmlBuffer);
        } else {
            res.setHeader('Content-Length', body.length);
            res.status(targetRes.status).end(body);
        }

    } catch (err) {
        console.error('[Proxy Error]', err);
        res.status(502).send(`Proxy Error: ${err.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Web Proxy Browser running on http://localhost:${PORT}`);
});
