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
            pathRewrite: (path, req) => {
                // Keep the path of the target URL, not the proxy path
                return target.pathname + target.search;
            },
            onProxyRes: (proxyRes, req, res) => {
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
