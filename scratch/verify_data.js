const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
    const q = db.collection('t_attendance').where('date', '>=', '2026-07-01').where('date', '<=', '2026-09-04');
    const snap = await q.get();
    
    const qSlash = db.collection('t_attendance').where('date', '>=', '2026/07/01').where('date', '<=', '2026/09/04');
    const snapSlash = await qSlash.get();
    
    console.log(`Hyphen Count: ${snap.size}`);
    console.log(`Slash Count: ${snapSlash.size}`);
    
    if (snap.size > 0) {
        console.log('Sample Hyphen Doc:', snap.docs[0].data());
    }
    if (snapSlash.size > 0) {
        console.log('Sample Slash Doc:', snapSlash.docs[0].data());
    }
}
run().catch(console.error);
