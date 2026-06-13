const fs = require('fs');
const usersData = JSON.parse(fs.readFileSync('scratch/users_dump.json', 'utf8'));

usersData.documents.forEach(d => {
  const fields = d.fields;
  const name = fields.Name?.stringValue || "";
  const store = fields.Store?.stringValue || "";
  const storeId = fields.StoreID?.stringValue || "";
  const employeeCode = fields.EmployeeCode?.stringValue || "";
  
  if (name.includes("神田") || name.includes("加藤") || name.includes("長見")) {
    console.log(`Name: ${name}`);
    console.log(`  DocID: ${d.name.split('/').pop()}`);
    console.log(`  EmployeeCode: ${employeeCode}`);
    console.log(`  Store: ${store}`);
    console.log(`  StoreID: ${storeId}`);
  }
});
