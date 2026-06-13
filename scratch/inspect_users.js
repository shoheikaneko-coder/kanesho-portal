const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function inspect() {
    console.log("=== ユーザーマスタ（m_users）のデータ調査 ===");
    const snap = await db.collection("m_users").get();
    
    snap.forEach(d => {
        const data = d.data();
        console.log(`DocumentID: ${d.id}`);
        console.log(`  Name: ${data.Name}`);
        console.log(`  EmployeeCode: ${data.EmployeeCode} (${typeof data.EmployeeCode})`);
        console.log(`  LastName: ${data.LastName}`);
        console.log(`  FirstName: ${data.FirstName}`);
        console.log(`  Role: ${data.Role}`);
        console.log("-----------------------------------------");
    });
}

inspect().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
