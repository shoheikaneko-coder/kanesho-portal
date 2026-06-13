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
        console.log(`CONSOLE [${msg.type()}]: ${msg.text()}`);
    });

    console.log("Navigating to http://127.0.0.1:8083/ ...");
    try {
        await page.goto('http://127.0.0.1:8083/', { waitUntil: 'load', timeout: 30000 });
        console.log("Waiting 3 seconds...");
        await new Promise(r => setTimeout(r, 3000));
        console.log("Check complete.");
    } catch (e) {
        console.error("Navigation/Execution failed:", e.message);
    }

    await browser.close();
}

run().catch(console.error);
