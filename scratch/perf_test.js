const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Inject performance timing into console
    page.on('console', msg => console.log(msg.text()));
    
    // We will serve the portal on localhost:8080 or just open index.html directly
    await page.goto('http://localhost:8080');
    
    // Login as Admin
    await page.evaluate(() => {
        document.getElementById('login-email').value = 'admin@example.com';
        document.getElementById('login-password').value = 'password';
        document.getElementById('btn-login').click();
    });
    await page.waitForTimeout(2000);
    
    // Measure Admin Attendance Dashboard
    await page.evaluate(() => {
        console.time('Admin_LoadIntData');
        window.navigateTo('attendance_management');
    });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
        console.timeEnd('Admin_LoadIntData');
        window.switchToIntegratedDashboard();
        return window.loadIntegratedData ? "exists" : "missing";
    });
    
    await browser.close();
})();
