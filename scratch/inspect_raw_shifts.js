const https = require('https');
const projectId = "kaneshow-portal";
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/t_shifts/2026-06-23_ecxTQuH6AQJ8z9LftQNf`;

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            console.log("Status Code:", res.statusCode);
            console.log(JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.error("JSON parse error:", e);
            console.log("Raw data:", data);
        }
    });
}).on('error', e => console.error(e));
