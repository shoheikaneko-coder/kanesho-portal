import { db } from './firebase.js';
import { collection, getDocs, limit, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function diagnostic() {
    console.log("--- Performance Data Diagnostic Start ---");
    try {
        const q = query(collection(db, "t_performance"), orderBy("date", "desc"), limit(3));
        const snap = await getDocs(q);
        console.log("Found " + snap.size + " performance records.");
        snap.forEach(d => {
            console.log("Doc ID: " + d.id, d.data());
        });

        console.log("--- Monthly Goals Diagnostic ---");
        const goalSnap = await getDocs(query(collection(db, "t_monthly_goals"), limit(3)));
        goalSnap.forEach(d => {
            console.log("Goal Doc ID: " + d.id, d.data());
        });
    } catch (e) {
        console.error("Diagnostic failed: ", e);
    }
}
diagnostic();
