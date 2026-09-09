const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:8000/?page=attendance_management');
  
  // Wait a few seconds for data to load
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await browser.close();
})();
