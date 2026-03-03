import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const epoxyPath = fileURLToPath(new URL("./node_modules/@mercuryworkshop/epoxy-transport/dist", import.meta.url));
const publicPath = fileURLToPath(new URL("./public/", import.meta.url));

// ── Wisp Configuration ──
logging.set_level(logging.NONE);

// ── Fastify Server with Wisp WebSocket support ──
const fastify = Fastify({
    serverFactory: (handler) => {
        return createServer()
            .on("request", (req, res) => {
                // Prevent caching of our frontend scripts so changes immediately apply
                if (req.url && (req.url.endsWith('.js') || req.url.endsWith('.html') || req.url.endsWith('.mjs') || req.url === '/')) {
                    res.setHeader("Cache-Control", "no-store, must-revalidate");
                    res.setHeader("Pragma", "no-cache");
                }
                handler(req, res);
            })
            .on("upgrade", (req, socket, head) => {
                if (req.url.endsWith("/wisp/")) {
                    wisp.routeRequest(req, socket, head);
                } else {
                    socket.end();
                }
            });
    },
});

// ── Static file routes ──
fastify.register(fastifyStatic, {
    root: publicPath,
    decorateReply: true,
});

fastify.register(fastifyStatic, {
    root: libcurlPath,
    prefix: "/libcurl/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: epoxyPath,
    prefix: "/epoxy/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: baremuxPath,
    prefix: "/baremux/",
    decorateReply: false,
});

fastify.setNotFoundHandler((_req, reply) => {
    return reply.code(404).type("text/html").send(`<h1>404 Not Found</h1>`);
});

const port = process.env.PORT || 1337;
fastify.listen({ port: port, host: "0.0.0.0" }, (err, address) => {
    if (err) throw err;
    console.log(`Server listening on ${address}`);
});
