import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query, where } from "firebase/firestore";

const firebaseConfig = {
  projectId: "kanesho-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const q = query(collection(db, 't_attendance'), limit(5));
    const snap = await getDocs(q);
    snap.forEach(d => {
        console.log(d.id, d.data().date, d.data().staff_id);
    });
}
run();
