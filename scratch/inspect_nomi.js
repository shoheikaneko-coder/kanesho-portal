const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/users_dump.json', 'utf-8'));

data.documents.forEach(doc => {
    const fields = doc.fields;
    const name = fields.Name?.stringValue || "";
    const dispName = fields.DisplayName?.stringValue || "";
    if (name.includes("ノミ") || dispName.includes("ノミ")) {
        console.log(`Document Path: ${doc.name}`);
        console.log("Fields:");
        for (const [key, value] of Object.entries(fields)) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
    }
});
