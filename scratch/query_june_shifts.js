const https = require('https');

const projectId = "kaneshow-portal";
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

const queryBody = JSON.stringify({
  structuredQuery: {
    from: [{ collectionId: "t_shifts" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "date" },
              op: "GREATER_THAN_OR_EQUAL",
              value: { stringValue: "2026-06-14" }
            }
          },
          {
            fieldFilter: {
              field: { fieldPath: "date" },
              op: "LESS_THAN_OR_EQUAL",
              value: { stringValue: "2026-07-04" }
            }
          }
        ]
      }
    }
  }
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(queryBody)
  }
};

const req = https.request(url, options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const results = JSON.parse(data);
            console.log(`Query returned ${results.length} items.`);
            
            const shifts = results
                .filter(item => item.document)
                .map(item => {
                    const doc = item.document;
                    const fields = doc.fields || {};
                    const mapped = { id: doc.name.split('/').pop() };
                    for (const [key, value] of Object.entries(fields)) {
                        mapped[key] = value.stringValue || value.booleanValue || value.integerValue || value.doubleValue || null;
                    }
                    return mapped;
                });
                
            console.log(`Mapped ${shifts.length} shifts.`);
            const nomiShifts = shifts.filter(s => s.userId === "ecxTQuH6AQJ8z9LftQNf");
            console.log(`\n=== NOMI SHIFTS IN QUERY RESULT ===`);
            console.log(`Total shifts for Nomi: ${nomiShifts.length}`);
            nomiShifts.forEach(s => {
                console.log(`  Date: ${s.date} | Start: ${s.start} | End: ${s.end} | Status: ${s.status} | Store: ${s.storeId || s.StoreID}`);
            });
        } catch (e) {
            console.error("Error parsing JSON:", e.message);
            console.log("Response data snippet:", data.substring(0, 500));
        }
    });
});

req.on('error', (e) => {
    console.error("HTTP Request Error:", e.message);
});

req.write(queryBody);
req.end();
