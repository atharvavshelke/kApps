const form = document.getElementById("searchform");
const addressInput = document.getElementById("address");
const iframe = document.getElementById("sj-frame");
const banner = document.getElementById("banner");
const landing = document.getElementById("landing");

const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnReload = document.getElementById("btn-reload");

let isReady = false;

async function registerSW() {
    if (!("serviceWorker" in navigator)) {
        throw new Error("Your browser does not support service workers.");
    }

    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
        await reg.unregister();
    }

    await navigator.serviceWorker.register("/uv/sw.js", {
        scope: __uv$config.prefix,
    });
}

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

async function init() {
    try {
        await registerSW();

        const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

        if (await connection.getTransport() !== "/epoxy/index.mjs") {
            await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
        }

        isReady = true;
        banner.style.display = 'none';
    } catch (err) {
        console.error("Initialization error:", err);
        banner.textContent = "⚠️ Proxy failed to initialize: " + err.message;
    }
}

function normalizeUrl(input) {
    input = input.trim();
    if (!input) return "";
    try {
        return new URL(input).toString();
    } catch (err) {
        try {
            const url = new URL(`https://${input}`);
            if (url.hostname.includes(".")) return url.toString();
        } catch (err) { }
    }
    return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isReady) return;

    landing.classList.add("hidden");
    iframe.classList.remove("hidden");

    let url = normalizeUrl(addressInput.value);

    // Blur the input to hide keyboard on mobile
    addressInput.blur();

    // Optimistically update the address bar text for aesthetic
    addressInput.value = url;

    iframe.src = __uv$config.prefix + __uv$config.encodeUrl(url);
});

// Browser Navigation Controls
btnBack.addEventListener("click", () => {
    if (iframe.contentWindow) iframe.contentWindow.history.back();
});

btnForward.addEventListener("click", () => {
    if (iframe.contentWindow) iframe.contentWindow.history.forward();
});

btnReload.addEventListener("click", () => {
    if (iframe.contentWindow) iframe.contentWindow.location.reload();
});

// Sync Address Bar with Iframe Internal Navigation
iframe.addEventListener("load", () => {
    try {
        // Since the UV iframe is technically on the same origin (e.g. /uv/service/... ), 
        // we can read its contentWindow.location!
        const proxyPath = iframe.contentWindow.location.pathname;

        // Ensure it's a proxied path
        if (proxyPath.startsWith(__uv$config.prefix)) {
            // Extract the encoded portion
            const encodedUrl = proxyPath.slice(__uv$config.prefix.length);
            // Decode the URL back to plaintext
            const decodedUrl = __uv$config.decodeUrl(encodedUrl);

            // Only update if it's not empty and different (prevents cursor jumping while typing)
            if (decodedUrl && document.activeElement !== addressInput) {
                addressInput.value = decodedUrl;
            }
        }
    } catch (err) {
        // Cross-origin boundaries or other edge cases may silently fail, ignore
        console.warn("Could not sync URL:", err);
    }
});

// Start initialization
init();
