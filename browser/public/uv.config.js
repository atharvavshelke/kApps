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
            html: `<script src="${typeof location !== 'undefined' ? location.origin : ''}/extensions/adblocker.js"></script>`
        },
        // 1. The Greasemonkey Polyfill (injected on ALL sites first to prevent GM_ errors)
        {
            host: /.*/,
            injectTo: 'head',
            html: `<script src="${typeof location !== 'undefined' ? location.origin : ''}/extensions/gm-polyfill.js"></script>`
        },
        // 2. jav.guru script
        {
            host: /jav\.guru/,
            injectTo: 'body',
            html: `<script src="${typeof location !== 'undefined' ? location.origin : ''}/extensions/jav-guru.user.js"></script>`
        },
        // 3. XVideos filter
        {
            host: /\.xvideos\.com/,
            injectTo: 'body',
            html: `<script src="${typeof location !== 'undefined' ? location.origin : ''}/extensions/xvideos-filter.user.js"></script>`
        },
        // 4. Pornhub tweaks
        {
            host: /pornhub\.com/,
            injectTo: 'body',
            html: `<script src="${typeof location !== 'undefined' ? location.origin : ''}/extensions/ph-tweaks.user.js"></script>`
        },
        // 5. Manga loader
        {
            host: /(\.hitomi\.la|\.nhentai\.net|nhentai\.to|hitomi\.la)/,
            injectTo: 'body',
            html: `<script src="${typeof location !== 'undefined' ? location.origin : ''}/extensions/manga-loader.user.js"></script>`
        }
    ]
};
