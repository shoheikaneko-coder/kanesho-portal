const puppeteer = require('puppeteer-core');

async function run() {
    console.log("Launching Puppeteer script to test LINE sharing against http://127.0.0.1:5002 ...");
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

    let dialogMessage = '';
    page.on('dialog', async dialog => {
        dialogMessage = dialog.message();
        console.log(`[DIALOG]: ${dialogMessage}`);
        await dialog.dismiss();
    });
    page.on('pageerror', err => console.error('PAGE ERROR:', err.stack));
    page.on('console', msg => console.log(`CONSOLE [${msg.type()}]: ${msg.text()}`));

    try {
        await page.goto('http://127.0.0.1:5002/', { waitUntil: 'networkidle2', timeout: 30000 });
        
        console.log("Mocking currentUser session (ID002) and navigating to shift_admin...");
        await page.evaluate(() => {
            localStorage.setItem('currentUser', JSON.stringify({ 
                Name: 'テスト店長', 
                Role: 'Manager',
                id: 'test-manager-id',
                DisplayName: 'テスト店長',
                JobTitle: '店長',
                EmployeeCode: '9999',
                StoreID: 'ID002',
                StoreId: 'ID002'
            }));
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('shift_admin');
            } else if (typeof showPage === 'function') {
                showPage('shift_admin');
            }
        });

        console.log("Waiting for UI to load and render...");
        await new Promise(r => setTimeout(r, 6000));

        // Let's open the action menu
        console.log("Opening the mobile management action menu...");
        await page.evaluate(() => {
            if (typeof window.openAdminActionMenuMobile === 'function') {
                window.openAdminActionMenuMobile();
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        // Click the LINE share button in the menu
        console.log("Clicking the 'LINE通知' button...");
        await page.evaluate(() => {
            const btn = document.getElementById('btn-menu-share-line-mobile');
            if (btn) {
                btn.click();
            } else {
                console.error("LINE Share button not found in bottom sheet menu!");
            }
        });

        console.log("Waiting 5 seconds for html2canvas loading, capture rendering, and custom alert modal...");
        await new Promise(r => setTimeout(r, 5000));

        const alertCheck = await page.evaluate(() => {
            const modal = document.getElementById('ui-alert-modal');
            const isVisible = modal ? (window.getComputedStyle(modal).display === 'flex' || modal.style.display === 'flex') : false;
            const title = modal && modal.querySelector('h3') ? modal.querySelector('h3').textContent : '';
            const message = modal && modal.querySelector('p') ? modal.querySelector('p').textContent : '';
            
            return {
                hasModal: !!modal,
                isVisible,
                title,
                message
            };
        });

        console.log("Custom UI Alert Modal State Check:", alertCheck);

        console.log("Final verification of the custom modal message:");
        if (alertCheck.isVisible) {
            if (alertCheck.title.includes("エラー")) {
                console.error("TEST FAILED: Error dialog shown - " + alertCheck.message);
            } else if (alertCheck.message.includes("画像を保存し、メッセージをクリップボードにコピーしました")) {
                console.log("TEST SUCCESS: Fallback download triggered and dialog content is correct!");
            } else {
                console.log("TEST RESULT: Dialog shown with message - " + alertCheck.message);
            }
        } else {
            console.warn("TEST WARNING: No alert modal was visible in the DOM.");
        }

    } catch (e) {
        console.error("Test execution failed:", e);
    } finally {
        await browser.close();
        console.log("Puppeteer run complete.");
    }
}

run();
