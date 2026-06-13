const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
if(!admin.apps.length) admin.initializeApp({credential: admin.credential.cert(serviceAccount)});
const db = admin.firestore();

async function check() {
  console.log("=== 1. ユーザー情報 (長見和夏) の検索 ===");
  const userSnap = await db.collection('m_users').where('Name', '==', '長見和夏').get();
  let employeeCodes = [];
  userSnap.forEach(d => {
    const data = d.data();
    console.log("User Document ID:", d.id);
    console.log("User Data:", JSON.stringify(data));
    const code = data.EmployeeCode || data.staff_id || data.staff_code || d.id;
    if (code) employeeCodes.push(String(code).trim());
  });

  if (employeeCodes.length === 0) {
    console.log("ユーザーが見つからなかったため、すべてのユーザーから「長見」を部分一致検索します...");
    const allUsers = await db.collection('m_users').get();
    allUsers.forEach(d => {
      const data = d.data();
      if (data.Name && data.Name.includes('長見')) {
        console.log("Matched User:", d.id, JSON.stringify(data));
        const code = data.EmployeeCode || data.staff_id || data.staff_code || d.id;
        if (code) employeeCodes.push(String(code).trim());
      }
    });
  }

  console.log("検索対象の従業員コード:", employeeCodes);

  console.log("\n=== 2. t_attendance の全データ (長見和夏) の検索 ===");
  const allAttn = await db.collection('t_attendance').get();
  let count = 0;
  allAttn.forEach(d => {
    const data = d.data();
    const sid = String(data.staff_id || data.staff_code || data.EmployeeCode || "").trim();
    if (employeeCodes.includes(sid)) {
      count++;
      console.log(`[Attn Record #${count}] DocID:`, d.id);
      console.log("  Record Data:", JSON.stringify(data));
    }
  });

  if (count === 0) {
    console.log("t_attendance に長見和夏さんの打刻が1件も見つかりませんでした。別のキーで保存されている可能性があります。");
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
