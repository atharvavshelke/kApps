self.__uv$config = {
    prefix: '/uv/service/',
    bare: '/baremux/worker.js', // Although BareMux will intercept
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/uv/uv.handler.js',
    client: '/uv/uv.client.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv/uv.config.js',
    sw: '/uv/uv.sw.js',

    // Extension & Userscript Injection
    inject: [
        // 0. The Adblocker Simulated Extension
        {
            host: /.*/,
            injectTo: 'head',
            html: `<script src="/extensions/adblocker.js"></script>`
        },
        // 1. The Greasemonkey Polyfill (injected on ALL sites first to prevent GM_ errors)
        {
            host: /.*/,
            injectTo: 'head',
            html: `<script src="/extensions/gm-polyfill.js"></script>`
        },
        // 2. jav.guru script
        {
            host: /jav\.guru/,
            injectTo: 'body',
            html: `<script src="/extensions/jav.guru-%20Add%20MissAV%20link%20next%20to%20Code-1.1.user.js"></script>`
        },
        // 3. XVideos filter
        {
            host: /\.xvideos\.com/,
            injectTo: 'body',
            html: `<script src="/extensions/XVideos%20Filter-%20Red%20K%20Black%20BG-3.1.user.js"></script>`
        },
        // 4. Pornhub tweaks
        {
            host: /pornhub\.com/,
            injectTo: 'body',
            html: `<script src="/extensions/PH%20-%20Search%20%26%20UI%20Tweaks-4.0.4.user.js"></script>`
        },
        // 5. Manga loader
        {
            host: /(\.hitomi\.la|\.nhentai\.net|nhentai\.to|hitomi\.la)/,
            injectTo: 'body',
            html: `<script src="/extensions/Manga%20Loader%20NSFW%20+%20Download-1.0.0.1.user.js"></script>`
        }
    ]
};
