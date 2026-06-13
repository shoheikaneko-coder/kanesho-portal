const puppeteer = require('puppeteer-core');

async function run() {
    console.log("Launching Chrome...");
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    page.on('pageerror', (err) => {
        console.error('PAGE ERROR STACK:', err.stack || err.toString());
    });

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            console.error(`CONSOLE ERROR: ${msg.text()}`);
        }
    });

    console.log("Navigating to https://kaneshow-portal.web.app/ ...");
    try {
        await page.goto('https://kaneshow-portal.web.app/', { waitUntil: 'networkidle0', timeout: 15000 });
        console.log("Waiting 3 seconds...");
        await new Promise(r => setTimeout(r, 3000));
        console.log("Check complete.");
    } catch (e) {
        console.error("Navigation/Execution failed:", e.message);
    }

    await browser.close();
}

run().catch(console.error);
