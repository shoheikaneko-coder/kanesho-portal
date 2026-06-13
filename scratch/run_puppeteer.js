const puppeteer = require('puppeteer-core');

async function run() {
    console.log("Launching Chrome in mobile mode against production...");
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    page.on('dialog', async dialog => {
        console.log(`DIALOG [${dialog.type()}]: ${dialog.message()}`);
        await dialog.dismiss();
    });

    page.on('pageerror', (err) => {
        console.error('PAGE ERROR STACK:\n', err.stack || err.toString());
    });

    page.on('console', (msg) => {
        const type = msg.type();
        const text = msg.text();
        console.log(`CONSOLE [${type.toUpperCase()}]: ${text}`);
    });

    console.log("Navigating to http://localhost:8082/ ...");
    try {
        await page.goto('http://localhost:8082/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        console.log("Simulating login and navigating to shift_admin...");
        await page.evaluate(() => {
            localStorage.setItem('currentUser', JSON.stringify({ 
                Name: 'テスト店長', 
                Role: 'Manager',
                id: 'test-manager-id',
                DisplayName: 'テスト店長',
                JobTitle: '店長',
                EmployeeCode: '9999'
            }));
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('shift_admin');
            } else if (typeof showPage === 'function') {
                showPage('shift_admin');
            }
        });

        console.log("Waiting 3 seconds for UI rendering...");
        await new Promise(r => setTimeout(r, 3000));

        console.log("Analyzing UI Elements...");
        const result = await page.evaluate(() => {
            const pageTitle = document.getElementById('page-title-mobile-central');
            const customTitleContainer = pageTitle ? pageTitle.querySelector('.mobile-title-container-custom') : null;
            const storeLabelInTitle = pageTitle ? pageTitle.querySelector('#admin-active-store-mobile') : null;
            const selectInTitle = pageTitle ? pageTitle.querySelector('#admin-slot-select-mobile') : null;
            
            const menuBtnInTopBanner = document.querySelector('.mobile-only #btn-open-action-menu-mobile');
            const rejectedHopeBtn = document.getElementById('btn-toggle-rejected-mobile');
            const rejectedHopeText = rejectedHopeBtn ? rejectedHopeBtn.textContent.trim() : '';
            
            const bottomBar = document.getElementById('admin-mobile-bottom-bar-mobile');
            const menuBtnInBottomBar = bottomBar ? bottomBar.querySelector('#btn-open-action-menu-mobile') : null;
            
            const bottomSheet = document.querySelector('.bottom-sheet');
            const bottomSheetStyle = bottomSheet ? window.getComputedStyle(bottomSheet) : null;
            
            const firstCell = document.querySelector('#shift-admin-table-mobile td');
            const firstCellBorder = firstCell ? window.getComputedStyle(firstCell).border : 'none';
            
            return {
                titleCustomized: !!customTitleContainer,
                storeInTitle: !!storeLabelInTitle,
                selectInTitle: !!selectInTitle,
                menuInTopBanner: !!menuBtnInTopBanner,
                rejectedHopeText: rejectedHopeText,
                menuRemovedFromBottomBar: !menuBtnInBottomBar,
                bottomSheetHidden: bottomSheetStyle ? bottomSheetStyle.visibility : 'visible',
                firstCellHasBorder: firstCellBorder !== 'none' && !firstCellBorder.includes('0px')
            };
        });

        console.log("TEST RESULTS:");
        console.log(`- Header layout customized (Store + Period side-by-side): ${result.titleCustomized}`);
        console.log(`- Store name exists in header: ${result.storeInTitle}`);
        console.log(`- Period select dropdown exists in header: ${result.selectInTitle}`);
        console.log(`- "Menu" button exists in top operation banner: ${result.menuInTopBanner}`);
        console.log(`- Rejected hope button text: "${result.rejectedHopeText}" (Expected: "削った希望を確認")`);
        console.log(`- "Menu" button removed from bottom bar: ${result.menuRemovedFromBottomBar}`);
        console.log(`- Bottom Sheet visibility style: ${result.bottomSheetHidden} (Expected: hidden)`);
        console.log(`- Shift table cells have borders (gridlines): ${result.firstCellHasBorder}`);

        const allPassed = result.titleCustomized && result.storeInTitle && result.selectInTitle && 
                          result.menuInTopBanner && result.rejectedHopeText === '削った希望を確認' && 
                          result.menuRemovedFromBottomBar && result.bottomSheetHidden === 'hidden' && 
                          result.firstCellHasBorder;

        if (allPassed) {
            console.log("SUCCESS: All production mobile UI/UX improvements validated successfully!");
        } else {
            console.error("FAILURE: Production Mobile UI/UX layout validation failed.");
        }

    } catch (e) {
        console.error("Navigation/Execution failed:", e.message);
    }

    await browser.close();
    console.log("Done.");
}

run().catch(console.error);
