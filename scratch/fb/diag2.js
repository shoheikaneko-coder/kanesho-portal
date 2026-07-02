const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    projectId: "kaneshow-portal",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    console.log("Fetching all m_users to find Nguyen...");
    const uSnap = await getDocs(collection(db, 'm_users'));
    let targetIds = [];
    uSnap.forEach(d => {
        if (d.data().Name === 'グエン　チ　タイン') {
            targetIds.push(d.id);
            if (d.data().EmployeeCode) targetIds.push(d.data().EmployeeCode);
        }
    });
    console.log("Target IDs for Nguyen:", targetIds);

    console.log("Fetching ALL t_attendance...");
    const aSnap = await getDocs(collection(db, 't_attendance'));
    let found = 0;
    aSnap.forEach(d => {
        const p = d.data();
        const pid = p.staff_id || p.staff_code || p.EmployeeCode || p.UserId || "";
        if (targetIds.includes(String(pid).trim())) {
            // Only care about May or June for sanity, or just print everything
            if ((p.date && p.date.startsWith('2026-05')) || (p.timestamp && p.timestamp.startsWith('2026-05'))) {
                console.log("DocID:", d.id, "=>", JSON.stringify(p));
                found++;
            }
        }
    });
    console.log("Total found in May:", found);
}
run().catch(console.error);
