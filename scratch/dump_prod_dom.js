const puppeteer = require('puppeteer-core');

async function run() {
    console.log("Launching Chrome...");
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    console.log("Navigating to https://kaneshow-portal.web.app/ ...");
    try {
        // タイムアウトを短くし、エラーをキャッチして進める
        await page.goto('https://kaneshow-portal.web.app/', { timeout: 10000 }).catch(e => console.log('Goto timeout/error:', e.message));
        
        console.log("Waiting 3 seconds...");
        await new Promise(r => setTimeout(r, 3000));
        
        const html = await page.content();
        console.log("=== DOM DUMP ===");
        console.log(html.substring(0, 1500)); // 最初の1500文字
        console.log("=================");
        
        const loginForm = await page.$('#login-form');
        console.log("Login form exists?", !!loginForm);
        
        if (loginForm) {
            console.log("Attempting to type and submit...");
            await page.type('#email', 'admin@kaneshow.jp');
            await page.type('#password', 'password');
            await page.click('button[type="submit"]');
            console.log("Clicked submit. Waiting 3 seconds...");
            await new Promise(r => setTimeout(r, 3000));
            const newHtml = await page.content();
            console.log("=== DOM DUMP AFTER LOGIN ===");
            console.log(newHtml.substring(0, 1500));
            console.log("=================");
        }
    } catch (e) {
        console.error("Execution failed:", e.message);
    }

    await browser.close();
}

run().catch(console.error);
