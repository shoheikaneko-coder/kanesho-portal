const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = {
    projectId: "kaneshow-portal",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    console.log("Querying m_users for Nguyen...");
    const uq = query(collection(db, 'm_users'), where('Name', '==', 'グエン　チ　タイン'));
    const uSnap = await getDocs(uq);
    let uids = [];
    let empCode = "";
    uSnap.forEach(d => {
        console.log("User:", d.id, d.data());
        uids.push(d.id);
        empCode = d.data().EmployeeCode;
        uids.push(empCode);
    });

    console.log("Querying t_attendance for date 2026-05-30 and 2026-05-31...");
    const aq = query(collection(db, 't_attendance'), where('date', '>=', '2026-05-29'), where('date', '<=', '2026-05-31'));
    const aSnap = await getDocs(aq);
    
    aSnap.forEach(d => {
        const p = d.data();
        const pid = p.staff_id || p.staff_code || p.EmployeeCode || p.UserId || "";
        if (uids.includes(pid)) {
            console.log("Punch Doc:", d.id);
            console.log("  date:", p.date);
            console.log("  timestamp:", p.timestamp);
            console.log("  type:", p.type);
            console.log("  staff_id:", p.staff_id);
            console.log("  UserId:", p.UserId);
            console.log("  EmployeeCode:", p.EmployeeCode);
        }
    });
    console.log("Done");
}
run();
