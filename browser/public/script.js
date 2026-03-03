const form = document.getElementById("searchform");
const address = document.getElementById("address");
const iframe = document.getElementById("sj-frame");
const banner = document.getElementById("banner");

let isReady = false;

async function registerSW() {
    if (!("serviceWorker" in navigator)) {
        throw new Error("Your browser does not support service workers.");
    }

    // Unregister old service workers (like the one we had at the root)
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
        await reg.unregister();
    }

    await navigator.serviceWorker.register("/uv/sw.js", {
        scope: __uv$config.prefix,
    });
    // Removed `await navigator.serviceWorker.ready;` because it hangs indefinitely 
    // when the SW scope doesn't cover the root page.
}

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

async function init() {
    try {
        console.log("Starting init...");
        await registerSW();
        console.log("SW registered.");

        const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

        console.log("Checking transport...");
        if (await connection.getTransport() !== "/epoxy/index.mjs") {
            console.log("Setting transport...");
            await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
            console.log("Transport set.");
        } else {
            console.log("Transport already set.");
        }

        isReady = true;
        banner.style.display = 'none';
        console.log("Init complete.");
    } catch (err) {
        console.error("Initialization error:", err);
        banner.textContent = "⚠️ Proxy failed to initialize: " + err.message;
    }
}

function search(input) {
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

    document.getElementById("landing").classList.add("hidden");
    iframe.classList.remove("hidden");

    const url = search(address.value);
    iframe.src = __uv$config.prefix + __uv$config.encodeUrl(url);
});

init();
