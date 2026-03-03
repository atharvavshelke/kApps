# Proxy Engine Debugging Summary

Here is a comprehensive log of the steps we took to completely rebuild and debug the proxy engine using the Ultraviolet and Bare-Mux stack. The process started by completely wiping the old Scramjet configuration and moving to the modern TitaniumNetwork architecture.

## 1. The Clean Slate Rebuild
**Commits:**
- `8fd8f3b` Complete proxy engine rewrite
- `81812de` Complete proxy engine rewrite 2

**What we did:** 
We experienced infinite caching loops with the old Scramjet proxy. To solve this, we completely deleted the contents of your `browser/` folder, generated a fresh `package.json`, and rebuilt the `script.js`, `index.html`, and `style.css` from absolute scratch.

## 2. Moving the SW Scope
**Commits:**
- `ce26662` Swap proxy engine to Ultraviolet
- `d5ea35d` Fix UV service worker scope
- `d0d6181` Fix UV config loading paths

**What we did:** 
We switched from Scramjet to Ultraviolet. Ultraviolet explicitly requires the Service Worker (`sw.js`) to live inside the interception path (`/uv/sw.js`) so that it can securely claim the `/uv/service/` scope. We relocated the script and configured Fastify to route the backend files. We also had to fix the `<script>` tag in `index.html` to load our custom `uv.config.js` properly so the prefix wasn't overridden.

## 3. Fixing Service Worker Relative Path Quirks
**Commits:**
- `5950227` Use absolute paths for UV Service Worker imports
- `9c9f9dd` Fix overwritten UV SW imports

**What we did:**
The Service Worker was returning `404 Not Found` errors when evaluating because the browser was maliciously resolving relative imports like `importScripts('uv.sw.js')` to the root domain (`/`) instead of the `/uv/` folder. We fixed this by rewriting all dynamic internal imports to use strict absolute paths (e.g., `importScripts('/uv/uv.sw.js')`).

## 4. Bypassing Boilerplate Bugs
**Commits:**
- `4dc256b` Fix UV variable redeclaration crash
- `5b6b267` Fix UV config ReferenceError in SW

**What we did:**
The official TitaniumNetwork setup documentation contained two bugs. First, it injected a hidden `uv` variable globally, causing a `SyntaxError` when we tried to run `const uv = new UVServiceWorker()`. Second, it tried to parse the SW path `__uv$config.sw` immediately before the configuration was fully loaded into the browser's context (`ReferenceError`). We mitigated both edge cases by manually typing down strict variables (`uvWorker`) and hardcoding the path string so the script could finally parse safely.

## 5. Resolving the Bare-Mux Connection Handshake
**Commits:**
- `464170d` Fix Bare-Mux race condition on SW controller
- `628ad7b` Fix BareMux race condition by eagerly instantiating connection

**What we did:**
The Service Worker evaluated, but we were bombarded with `bare-mux: failed to get a bare-mux SharedWorker MessagePort within 1s` errors. Bare-Mux communicates with the Service Worker by attaching an event listener and waiting for a `"getPort"` broadcast ping. However, we placed `new BareMux.BareMuxConnection()` *inside* of an `async` block that awaited `registerSW()`. This caused a severe race condition where the Service Worker shouted `"getPort"` *before* the main thread had even attached the event listener to catch it. We eagerly instantiated the connection at the absolute top of the file to fix this.

## 6. The Final WebAssembly Memory Crash
**Commits:**
- `b80d2bf` Downgrade epoxy-transport to fix Wasm headers crash

**What we did:**
The errors stopped, but the proxy simply returned a blank white screen. I set up a headless Puppeteer browser to dump the web-worker debug logs, and discovered a silent `TypeError: headers is not iterable`. Version `3.x` of `@mercuryworkshop/epoxy-transport` broke API compatibility with the current `bare-mux` proxy client! We uninstalled the toxic package and pinned the version exactly to `2.1.28`, which relies on standard object formatting. This permanently resolved the internal server `500` error and allowed the Wasm thread to fetch pages flawlessly!
