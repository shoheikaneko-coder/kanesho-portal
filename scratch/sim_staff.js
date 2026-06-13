const fs = require('fs');

// 1. ダンプデータの読み込み
const usersData = JSON.parse(fs.readFileSync('scratch/users_dump.json', 'utf8'));
const storesData = JSON.parse(fs.readFileSync('scratch/stores_dump.json', 'utf8'));

// cachedStores の再現
const cachedStores = storesData.documents.map(d => {
  const fields = d.fields;
  const parts = d.name.split('/');
  const id = parts[parts.length - 1];
  return {
    id: id,
    store_id: fields.store_id?.stringValue || "",
    store_name: fields.store_name?.stringValue || "",
    StoreID: fields.store_id?.stringValue || ""
  };
});

console.log("=== cachedStores ===");
console.log(cachedStores);

// loadIntegratedData() の staffMap 生成ロジックのシミュレート
const staffMap = {};
usersData.documents.forEach(d => {
  const fields = d.fields;
  const parts = d.name.split('/');
  const docId = parts[parts.length - 1];
  
  const EmployeeCode = fields.EmployeeCode?.stringValue || "";
  const staff_id = fields.staff_id?.stringValue || "";
  const staff_code = fields.staff_code?.stringValue || "";
  const UserId = fields.UserId?.stringValue || "";
  const sid = EmployeeCode || staff_id || staff_code || UserId || docId;
  
  const name = fields.Name?.stringValue || fields.name?.stringValue || fields.staff_name?.stringValue || "(名前なし)";
  const sName = fields.Store?.stringValue || fields.store_name?.stringValue || "";
  const StoreID = fields.StoreID?.stringValue || "";

  const matchedStore = cachedStores.find(st => 
    st.store_name === sName || 
    st.id === StoreID || 
    st.store_id === StoreID
  );
  
  const sidStr = String(sid).trim();
  staffMap[sidStr] = { 
    code: sidStr, 
    name: String(name).trim(), 
    store_id: matchedStore ? (matchedStore.store_id || matchedStore.id) : (StoreID || matchedStore?.id || ""),
    store_name: matchedStore ? matchedStore.store_name : (sName || "不明"),
    rawStore: sName,
    rawStoreID: StoreID
  };
});

console.log("\n=== staffMap size ===", Object.keys(staffMap).length);

// 長見和夏のデータをダンプしてみる
console.log("\n=== 長見和夏 (EmployeeCode: 0000119) の staffMap 登録結果 ===");
console.log(staffMap["0000119"] || "登録されていません！");

// 焼きとん酒場かね将 (ID001) の activeStaff を再現
const storeId = "ID001";
const activeStaff = Object.values(staffMap).filter(s => {
  return !storeId || String(s.store_id) === String(storeId);
});

console.log(`\n=== activeStaff (storeId: ${storeId}) size ===`, activeStaff.length);
console.log("=== activeStaff 一覧 ===");
activeStaff.forEach(s => {
  console.log(`- Code: ${s.code}, Name: ${s.name}, store_id: ${s.store_id}, store_name: ${s.store_name}, rawStore: ${s.rawStore}`);
});
