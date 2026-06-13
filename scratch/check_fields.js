const fs = require('fs');
const usersData = JSON.parse(fs.readFileSync('scratch/users_dump.json', 'utf8'));

console.log("=== 不完全または特殊な m_users ドキュメントの検出 ===");
usersData.documents.forEach((d, idx) => {
  const fields = d.fields;
  const nameField = fields.Name || fields.name || fields.staff_name || fields.DisplayName;
  const codeField = fields.EmployeeCode || fields.staff_id || fields.staff_code || fields.UserId;
  const storeField = fields.Store || fields.store_name;
  
  const name = nameField ? (nameField.stringValue || nameField.integerValue || "") : null;
  const code = codeField ? (codeField.stringValue || codeField.integerValue || "") : null;
  const store = storeField ? (storeField.stringValue || storeField.integerValue || "") : null;
  
  if (!name || !code || !store) {
    console.log(`[Warning #${idx}] Document ID: ${d.name.split('/').pop()}`);
    console.log(`  Name Field:`, JSON.stringify(nameField));
    console.log(`  Code Field:`, JSON.stringify(codeField));
    console.log(`  Store Field:`, JSON.stringify(storeField));
  }
});
