const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
    projectId: "kaneshow-portal"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const uSnap = await getDocs(collection(db, 'm_users'));
    let targetUser = null;
    uSnap.forEach(d => {
        const data = d.data();
        if (data.Name && data.Name.includes('グエン')) {
            targetUser = { id: d.id, ...data };
        }
    });

    if (!targetUser) {
        console.log("User not found");
        return;
    }
    console.log("Found user:", targetUser.id, targetUser.EmployeeCode);

    const q1 = query(collection(db, 't_attendance'), where('staff_id', '==', targetUser.id));
    const q2 = query(collection(db, 't_attendance'), where('staff_id', '==', targetUser.EmployeeCode || 'NONE'));
    const q3 = query(collection(db, 't_attendance'), where('staff_id', '==', 'グエン チ タイン'));
    
    const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
    
    const all = [];
    const add = snap => {
        snap.forEach(d => {
            const dat = d.data();
            if ((dat.date && dat.date.startsWith('2026-05')) || (dat.timestamp && dat.timestamp.startsWith('2026-05'))) {
                all.push({ id: d.id, ...dat });
            }
        });
    };
    add(s1); add(s2); add(s3);
    
    // remove dupes
    const unique = [];
    const ids = new Set();
    all.forEach(a => {
        if (!ids.has(a.id)) {
            ids.add(a.id);
            unique.push(a);
        }
    });
    
    unique.sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    console.log(JSON.stringify(unique, null, 2));
    process.exit(0);
}
run();
