const https = require('https');

const projectId = "kaneshow-portal";
const userId = "ecxTQuH6AQJ8z9LftQNf"; // Nomi's ID
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/t_shifts?pageSize=100`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            const docs = result.documents || [];
            console.log(`Total shifts in database: ${docs.length}`);
            
            const nomiShifts = docs.filter(doc => {
                const fields = doc.fields || {};
                return fields.userId?.stringValue === userId;
            });
            
            console.log(`=== Nomi's Shifts (User ID: ${userId}) ===`);
            nomiShifts.forEach(doc => {
                const fields = doc.fields || {};
                console.log(`Document: ${doc.name.split('/').pop()}`);
                console.log(`  Date: ${fields.date?.stringValue}`);
                console.log(`  Start: ${fields.start?.stringValue}`);
                console.log(`  End: ${fields.end?.stringValue}`);
                console.log(`  Status: ${fields.status?.stringValue}`);
                console.log(`  StoreId: ${fields.storeId?.stringValue || fields.StoreID?.stringValue}`);
                console.log(`  Has28hLimit: ${fields.Has28hLimit?.booleanValue}`);
            });
        } catch (e) {
            console.error("Error parsing JSON:", e.message);
            console.log("Response data snippet:", data.substring(0, 500));
        }
    });
}).on('error', (e) => {
    console.error("HTTP Request Error:", e.message);
});
