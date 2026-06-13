const https = require('https');

const projectId = "kaneshow-portal";
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

// Query matching m_users where StoreID == 'ID002'
const queryBody = JSON.stringify({
  structuredQuery: {
    from: [{ collectionId: "m_users" }],
    where: {
      compositeFilter: {
        op: "OR",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "StoreID" },
              op: "EQUAL",
              value: { stringValue: "ID002" }
            }
          },
          {
            fieldFilter: {
              field: { fieldPath: "StoreId" },
              op: "EQUAL",
              value: { stringValue: "ID002" }
            }
          },
          {
            fieldFilter: {
              field: { fieldPath: "Store" },
              op: "EQUAL",
              value: { stringValue: "酒場かね将地下一階" }
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
            console.log(`Query returned ${results.length} results.`);
            
            results.forEach(item => {
                if (!item.document) return;
                const doc = item.document;
                const fields = doc.fields || {};
                const name = fields.Name?.stringValue || "";
                const dispName = fields.DisplayName?.stringValue || "";
                const id = doc.name.split('/').pop();
                const storeId = fields.StoreID?.stringValue || fields.StoreId?.stringValue || "";
                const store = fields.Store?.stringValue || "";
                const has28 = fields.Has28hLimit ? fields.Has28hLimit.booleanValue : undefined;
                
                console.log(`User ID: ${id} | Name: ${name} | Display: ${dispName} | StoreID: ${storeId} | Store: ${store} | Has28hLimit: ${has28}`);
            });
        } catch (e) {
            console.error("Parse error:", e.message);
        }
    });
});

req.on('error', e => console.error("HTTP error:", e.message));
req.write(queryBody);
req.end();
