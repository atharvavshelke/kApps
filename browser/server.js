import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const epoxyPath = fileURLToPath(new URL("./node_modules/@mercuryworkshop/epoxy-transport/dist", import.meta.url));

const publicPath = fileURLToPath(new URL("./public/", import.meta.url));

// ── Wisp Configuration ──
logging.set_level(logging.NONE);
Object.assign(wisp.options, {
    allow_udp_streams: false,
    dns_servers: ["1.1.1.1", "1.0.0.1"],
});

// ── Fastify Server with Wisp WebSocket support ──
const fastify = Fastify({
    serverFactory: (handler) => {
        return createServer()
            .on("request", (req, res) => {
                // No-cache for HTML/JS to prevent stale scripts from running old transport code
                if (req.url && (req.url.endsWith('.js') || req.url.endsWith('.html') || req.url.endsWith('.mjs') || req.url === '/')) {
                    res.setHeader("Cache-Control", "no-store, must-revalidate");
                    res.setHeader("Pragma", "no-cache");
                }
                handler(req, res);
            })
            .on("upgrade", (req, socket, head) => {
                if (req.url.endsWith("/wisp/"))
                    wisp.routeRequest(req, socket, head);
                else socket.end();
            });
    },
});

// ── Static file routes ──

// Main app (public/)
fastify.register(fastifyStatic, {
    root: publicPath,
    decorateReply: true,
});

// Scramjet core bundle
fastify.register(fastifyStatic, {
    root: scramjetPath,
    prefix: "/scram/",
    decorateReply: false,
});

// libcurl transport
fastify.register(fastifyStatic, {
    root: libcurlPath,
    prefix: "/libcurl/",
    decorateReply: false,
});

// epoxy transport (ESM-compatible)
fastify.register(fastifyStatic, {
    root: epoxyPath,
    prefix: "/epoxy/",
    decorateReply: false,
});

// bare-mux
fastify.register(fastifyStatic, {
    root: baremuxPath,
    prefix: "/baremux/",
    decorateReply: false,
});

// ── 404 handler ──
fastify.setNotFoundHandler((_req, reply) => {
    return reply.code(404).type("text/html").send(`
        <!DOCTYPE html>
        <html><head><title>404</title></head>
        <body style="background:#0a0a0a;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
            <div style="text-align:center">
                <h1 style="font-size:4rem;margin:0">404</h1>
                <p style="opacity:0.6">Page not found</p>
                <a href="/" style="color:#6c63ff">← Go home</a>
            </div>
        </body></html>
    `);
});

// ── Startup ──
fastify.server.on("listening", () => {
    const address = fastify.server.address();
    console.log("🌐 kApps Web Proxy Browser running:");
    console.log(`   http://localhost:${address.port}`);
    console.log(`   http://${hostname()}:${address.port}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
    console.log("Shutting down...");
    fastify.close();
    process.exit(0);
}

const port = parseInt(process.env.PORT || "") || 3000;

fastify.listen({ port, host: "0.0.0.0" });
