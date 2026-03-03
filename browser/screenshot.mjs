import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set a desktop viewpoint
    await page.setViewport({ width: 1280, height: 800 });

    console.log("Navigating to proxy page...");
    await page.goto('http://127.0.0.1:8081', { waitUntil: 'domcontentloaded' });

    // Wait for UV to initialize
    await new Promise(r => setTimeout(r, 2000));

    // Take a screenshot of the landing state
    await page.screenshot({ path: '/home/privateproperty/.gemini/antigravity/brain/0875bcc3-4593-4d62-a6b6-2944497d4230/ui_landing.png' });

    console.log("Typing url...");
    await page.type('#address', 'google.com');

    console.log("Submitting form...");
    // Manually submit the form via js since there's no explicit submit button
    await page.evaluate(() => document.getElementById('searchform').dispatchEvent(new Event('submit')));

    console.log("Waiting 3s for iframe to render...");
    await new Promise(r => setTimeout(r, 3000));

    // Take a screenshot of the active browser state
    await page.screenshot({ path: '/home/privateproperty/.gemini/antigravity/brain/0875bcc3-4593-4d62-a6b6-2944497d4230/ui_active_browser.png' });

    await browser.close();
    console.log("Screenshots captured!");
})();
