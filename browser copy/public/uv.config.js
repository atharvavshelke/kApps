self.__uv$config = {
    prefix: '/uv/service/',
    bare: '/baremux/worker.js', // Although BareMux will intercept
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/uv/uv.handler.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv.config.js',
    sw: '/uv/sw.js',
};
