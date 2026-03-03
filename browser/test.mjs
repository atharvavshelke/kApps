import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-features=SharedArrayBuffer']
    });
    const page = await browser.newPage();

    // Also listen to worker target console logs
    browser.on('targetcreated', async target => {
        if (target.type() === 'service_worker' || target.type() === 'shared_worker') {
            const workerSession = await target.createCDPSession();
            await workerSession.send('Runtime.enable');
            workerSession.on('Runtime.consoleAPICalled', msg => {
                const text = msg.args.map(a => a.value || a.description).join(' ');
                console.log(`[${target.type()}]`, text);
            });
            workerSession.on('Runtime.exceptionThrown', err => {
                console.log(`[${target.type()} ERROR]`, err.exceptionDetails);
            });
        }
    });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('response', response => {
        if (!response.ok()) console.log(`HTTP ${response.status()} ${response.url()}`);
    });

    console.log("Navigating to proxy page...");
    await page.goto('http://127.0.0.1:1337', { waitUntil: 'load' });

    console.log("Typing url...");
    await page.type('#address', 'google.com');
    await page.click('.search-btn');

    console.log("Waiting 5s for UV to process the request...");
    await new Promise(r => setTimeout(r, 5000));

    await browser.close();
})();
