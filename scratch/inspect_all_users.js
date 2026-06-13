const fs = require('fs');
const usersData = JSON.parse(fs.readFileSync('scratch/users_dump.json', 'utf8'));

console.log("=== m_users Store/StoreID 一覧 ===");
usersData.documents.forEach(d => {
  const fields = d.fields;
  const name = fields.Name?.stringValue || "";
  const store = fields.Store?.stringValue || "";
  const storeId = fields.StoreID?.stringValue || "";
  const employeeCode = fields.EmployeeCode?.stringValue || "";
  
  console.log(`Name: ${name.padEnd(15)} | Store: ${store.padEnd(20)} | StoreID: ${storeId.padEnd(10)} | Code: ${employeeCode}`);
});
