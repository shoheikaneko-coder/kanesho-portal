const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if(!admin.apps.length) admin.initializeApp({credential: admin.credential.cert(serviceAccount)});
const db = admin.firestore();

async function check() {
  console.log("=== t_performance samples ===");
  const tPerf = await db.collection('t_performance').orderBy('Date', 'desc').limit(3).get();
  tPerf.forEach(d => console.log(JSON.stringify(d.data())));

  console.log("\n=== m_stores samples ===");
  const mStores = await db.collection('m_stores').limit(3).get();
  mStores.forEach(d => console.log(JSON.stringify(d.data())));
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
