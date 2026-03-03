const form = document.getElementById("searchform");
const address = document.getElementById("address");
const iframe = document.getElementById("sj-frame");
const banner = document.getElementById("banner");

const { ScramjetController } = $scramjetLoadController();
const scramjet = new ScramjetController({
    prefix: "/scram/",
    files: {
        wasm: "/scram/scramjet.wasm",
        all: "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
    },
});

let scramjetFrame;
let isReady = false;

async function ensureCleanIDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open('$scramjet');
        req.onupgradeneeded = (e) => {
            e.target.transaction.abort();
            resolve(true);
        };
        req.onsuccess = async (e) => {
            const db = e.target.result;
            const hasConfig = db.objectStoreNames.contains('config');
            db.close();

            if (!hasConfig) {
                console.warn('Scramjet IDB is corrupted (missing config). Wiping...');
                try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const reg of regs) await reg.unregister();
                } catch (err) { }

                const delReq = indexedDB.deleteDatabase('$scramjet');
                delReq.onsuccess = () => resolve(false);
                delReq.onerror = () => resolve(false);
                delReq.onblocked = () => resolve(false);
            } else {
                resolve(true);
            }
        };
        req.onerror = () => resolve(true);
    });
}

async function registerSW() {
    if (!("serviceWorker" in navigator)) {
        throw new Error("Your browser does not support service workers.");
    }
    await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
    });
    await navigator.serviceWorker.ready;
}

async function init() {
    // Check and repair IDB before any SW starts
    const isClean = await ensureCleanIDB();
    if (!isClean) {
        banner.innerHTML = '⚠️ Corrupted proxy database cleared. <a href="javascript:window.location.reload()" style="color:var(--primary)">Click here to reload</a>.';
        return;
    }

    try {
        await registerSW();

        await scramjet.init();

        const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
        const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

        await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);

        scramjetFrame = scramjet.createFrame(iframe);
        isReady = true;

        banner.style.display = 'none';
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
    scramjetFrame.go(url);
});

init();
