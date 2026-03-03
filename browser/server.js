const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Main proxy route
app.use('/proxy', (req, res, next) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Target URL is required. Usage: /proxy?url=https://example.com');
    }

    try {
        const target = new URL(targetUrl);

        // Use http-proxy-middleware to handle the request
        return createProxyMiddleware({
            target: target.origin,
            changeOrigin: true,
            xfwd: false, // Do not add x-forwarded headers
            pathRewrite: (path, req) => {
                // Keep the path of the target URL, not the proxy path
                return target.pathname + target.search;
            },
            onProxyReq: (proxyReq, req, res) => {
                console.log(`[Proxying] ${req.method} ${targetUrl}`);

                // Strip headers that might leak client info
                proxyReq.removeHeader('x-forwarded-for');
                proxyReq.removeHeader('x-forwarded-host');
                proxyReq.removeHeader('x-forwarded-proto');
                proxyReq.removeHeader('x-real-ip');

                // Optional: You could also sanitize User-Agent or Referer if desired
                // proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            },
            onProxyRes: (proxyRes, req, res) => {
                // Add a header to confirm successful proxying
                proxyRes.headers['X-Proxied-By'] = 'kApps-Web-Browser';

                // Remove headers that prevent embedding in an iframe
                delete proxyRes.headers['x-frame-options'];
                delete proxyRes.headers['content-security-policy'];
                // Optionally disable strict-transport-security to simplify local testing and matching
                delete proxyRes.headers['strict-transport-security'];

                // Allow CORS
                proxyRes.headers['Access-Control-Allow-Origin'] = '*';
                proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
                proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';

                // We might need to handle redirects to rewrite them back through the proxy
                if (proxyRes.headers['location']) {
                    const originalLocation = proxyRes.headers['location'];
                    // Construct URL if relative
                    let absoluteLocation = originalLocation;
                    if (originalLocation.startsWith('/')) {
                        absoluteLocation = target.origin + originalLocation;
                    } else if (!originalLocation.startsWith('http')) {
                        absoluteLocation = target.origin + '/' + originalLocation;
                    }

                    // Rewrite location to point back to our proxy
                    proxyRes.headers['location'] = `/proxy?url=${encodeURIComponent(absoluteLocation)}`;
                }
            },
            onError: (err, req, res) => {
                console.error('Proxy Error:', err);
                res.status(500).send('Proxy Error' + err.message);
            }
        })(req, res, next);
    } catch (e) {
        console.error('URL Parsing Error:', e);
        return res.status(400).send('Invalid URL provided.');
    }
});

app.listen(PORT, () => {
    console.log(`Web Proxy Browser Server running on http://localhost:${PORT}`);
});
