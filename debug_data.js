import { db } from './firebase.js';
import { collection, getDocs, limit, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function debugStructure() {
    console.log("Checking t_performance structure...");
    try {
        const q = query(collection(db, "t_performance"), limit(5));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            console.log("t_performance is empty!");
            return;
        }

        snap.forEach(doc => {
            console.log(`Document ID: ${doc.id}`);
            console.log("Data:", JSON.stringify(doc.data(), null, 2));
        });
    } catch (err) {
        console.error("Debug Error:", err);
    }
}

debugStructure();
