const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function inspect() {
    console.log("=== 評価テンプレートマスタ（m_evaluation_templates）のデータ調査 ===");
    const snap = await db.collection("m_evaluation_templates").get();
    
    snap.forEach(d => {
        const data = d.data();
        console.log(`DocumentID: ${d.id} (${data.template_name})`);
        const items = data.items || [];
        console.log(`  Items Count: ${items.length}`);
        items.slice(0, 5).forEach((item, idx) => {
            console.log(`    [Item ${idx + 1}] ID: ${item.item_id}, Order: ${item.display_order}, Category: ${item.category}, Title: ${item.title}`);
        });
        if (items.length > 5) {
            console.log(`    ... and ${items.length - 5} more items`);
        }
        console.log("-----------------------------------------");
    });
}

inspect().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
