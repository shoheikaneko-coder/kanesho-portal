
import { db } from './firebase.js';
import { collection, getDocs, limit, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function diagnose() {
    console.log("--- Firebase Schema Diagnosis Start ---");
    
    // 1. m_users のサンプル
    const uSnap = await getDocs(query(collection(db, "m_users"), limit(1)));
    if (!uSnap.empty) {
        console.log("Sample User Document Keys:", Object.keys(uSnap.docs[0].data()));
        console.log("Sample User Data:", uSnap.docs[0].data());
    } else {
        console.log("No users found in m_users");
    }

    // 2. m_stores のサンプル
    const sSnap = await getDocs(query(collection(db, "m_stores"), limit(1)));
    if (!sSnap.empty) {
        console.log("Sample Store Document Keys:", Object.keys(sSnap.docs[0].data()));
        console.log("Sample Store Data:", sSnap.docs[0].data());
    }

    // 3. t_attendance のサンプル
    const aSnap = await getDocs(query(collection(db, "t_attendance"), limit(1)));
    if (!aSnap.empty) {
        console.log("Sample Attendance Document Keys:", Object.keys(aSnap.docs[0].data()));
        console.log("Sample Attendance Data:", aSnap.docs[0].data());
    }
    
    console.log("--- Diagnosis End ---");
}

diagnose();
