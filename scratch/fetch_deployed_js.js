const https = require('https');

https.get('https://kaneshow-portal.web.app/shift.js', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const idx = data.indexOf('function updateOverallKPIs');
        if (idx !== -1) {
            console.log("Found function updateOverallKPIs in deployed JS:");
            console.log(data.substring(idx, idx + 2000));
        } else {
            console.log("Could not find updateOverallKPIs in deployed JS");
        }
    });
}).on('error', e => console.error(e));
