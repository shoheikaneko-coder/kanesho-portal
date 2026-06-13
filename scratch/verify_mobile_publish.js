const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function run() {
    console.log("Launching Puppeteer script against http://127.0.0.1:5002 ...");
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true }); // standard small iPhone width

    // Listen to console and errors
    page.on('dialog', async dialog => {
        console.log(`[DIALOG]: ${dialog.message()}`);
        await dialog.dismiss();
    });
    page.on('pageerror', err => console.error('PAGE ERROR:', err.stack));
    page.on('console', msg => console.log(`CONSOLE [${msg.type()}]: ${msg.text()}`));

    try {
        await page.goto('http://127.0.0.1:5002/', { waitUntil: 'networkidle2', timeout: 30000 });
        
        console.log("Mocking currentUser Manager session and navigating to shift_admin...");
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

        // Take a screenshot of the operations banner
        const bannerPath = '/Users/shoheikaneko/.gemini/antigravity/brain/b709bc0b-1718-44ba-9076-f49d25b4232b/mobile_operations_banner.png';
        await page.screenshot({ path: bannerPath });
        console.log(`Saved screenshot of main banner to: ${bannerPath}`);

        // Verify the visibility of the Publish/Alert elements
        const bannerCheck = await page.evaluate(() => {
            const btnPublish = document.getElementById('btn-publish-mobile');
            const alertBadge = document.getElementById('admin-28h-alerts-mobile');
            const violations = window.current28hViolations || [];
            
            return {
                hasPublishBtn: !!btnPublish,
                publishBtnDisplay: btnPublish ? window.getComputedStyle(btnPublish).display : 'none',
                hasAlertBadge: !!alertBadge,
                alertBadgeDisplay: alertBadge ? window.getComputedStyle(alertBadge).display : 'none',
                violationsCount: violations.length,
                violationsList: violations
            };
        });

        console.log("Banner State Verification (No Violations):", bannerCheck);

        console.log("Testing with a simulated 28h violation...");
        const violationCheck = await page.evaluate(async () => {
            const shiftModule = await import('/shift.js');
            const allStoreUsers = shiftModule.allStoreUsers;
            const helpUsers = shiftModule.helpUsers;
            const currentShifts = shiftModule.currentShifts;
            const globalShiftMap = shiftModule.globalShiftMap;

            const users = [...allStoreUsers, ...helpUsers];
            if (users.length > 0) {
                const targetUser = users[0];
                targetUser.Has28hLimit = true;
                
                // Add 10-hour shifts on 3 consecutive days in the active week to total 30 hours
                const ymds = ['2026-06-16', '2026-06-17', '2026-06-18'];
                if (!currentShifts[targetUser.id]) currentShifts[targetUser.id] = {};
                if (!globalShiftMap[targetUser.id]) globalShiftMap[targetUser.id] = {};
                
                ymds.forEach(ymd => {
                    const shiftData = { start: '10:00', end: '20:00', breakMin: 0, status: 'confirmed', date: ymd };
                    currentShifts[targetUser.id][ymd] = shiftData;
                    globalShiftMap[targetUser.id][ymd] = [shiftData];
                });
                
                // Trigger recalculation
                window.updateOverallKPIsMobile();
            }
            
            const btnPublish = document.getElementById('btn-publish-mobile');
            const alertBadge = document.getElementById('admin-28h-alerts-mobile');
            const btnMenuPublish = document.getElementById('btn-menu-publish-mobile');
            const violations = window.current28hViolations || [];
            
            return {
                publishBtnDisplay: btnPublish ? window.getComputedStyle(btnPublish).display : 'none',
                alertBadgeDisplay: alertBadge ? window.getComputedStyle(alertBadge).display : 'none',
                menuPublishDisabled: btnMenuPublish ? btnMenuPublish.disabled : false,
                menuPublishHTML: btnMenuPublish ? btnMenuPublish.innerHTML : '',
                violationsCount: violations.length,
                violationsList: violations
            };
        });

        console.log("Simulated Violation State Verification:", violationCheck);
        
        // Take a screenshot of the operations banner with violation showing
        const bannerViolationPath = '/Users/shoheikaneko/.gemini/antigravity/brain/b709bc0b-1718-44ba-9076-f49d25b4232b/mobile_operations_banner_violation.png';
        await page.screenshot({ path: bannerViolationPath });
        console.log(`Saved screenshot of banner with violation to: ${bannerViolationPath}`);
        const modalOpened = await page.evaluate(() => {
            const firstCell = document.querySelector('.shift-cell');
            if (firstCell) {
                firstCell.click();
                return true;
            }
            return false;
        });

        if (modalOpened) {
            console.log("Waiting 1 second for modal transition...");
            await new Promise(r => setTimeout(r, 1000));

            // Check dimensions of the modal & select elements
            const modalCheck = await page.evaluate(() => {
                const modal = document.getElementById('admin-mobile-bottom-sheet-mobile');
                const timeSelects = Array.from(modal.querySelectorAll('.time-select'));
                const selectWidths = timeSelects.map(el => el.getBoundingClientRect().width);
                const modalWidth = modal.getBoundingClientRect().width;
                const modalComputed = window.getComputedStyle(modal);
                const selectComputed = timeSelects.length > 0 ? window.getComputedStyle(timeSelects[0]) : null;

                // Check if any element overflows the modal
                const modalRect = modal.getBoundingClientRect();
                const overflowing = timeSelects.some(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.right > modalRect.right || rect.left < modalRect.left;
                });

                return {
                    modalWidth,
                    modalPadding: modalComputed.padding,
                    selectWidths,
                    selectPadding: selectComputed ? selectComputed.padding : '',
                    hasOverflow: overflowing
                };
            });

            console.log("Modal Layout Verification:", modalCheck);

            const modalPath = '/Users/shoheikaneko/.gemini/antigravity/brain/b709bc0b-1718-44ba-9076-f49d25b4232b/mobile_quick_editor_modal.png';
            await page.screenshot({ path: modalPath });
            console.log(`Saved screenshot of modal to: ${modalPath}`);
        } else {
            console.warn("Could not open shift editor modal (no shift cells found).");
        }

    } catch (e) {
        console.error("Test execution failed:", e);
    } finally {
        await browser.close();
        console.log("Puppeteer run complete.");
    }
}

run();
