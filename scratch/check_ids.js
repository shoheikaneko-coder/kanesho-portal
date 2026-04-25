import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, limit, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// app.js 等から設定を推測するか、単に環境変数から取得できないため
// プロジェクトIDのみ指定して初期化を試みる
const firebaseConfig = {
    projectId: "kaneshow-portal"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkIds() {
    console.log("--- m_users Sample ---");
    const uSnap = await getDocs(query(collection(db, "m_users"), limit(3)));
    uSnap.forEach(d => {
        console.log(`DocID: ${d.id}, Data:`, JSON.stringify(d.data()));
    });

    console.log("\n--- t_attendance Sample ---");
    const aSnap = await getDocs(query(collection(db, "t_attendance"), limit(3)));
    aSnap.forEach(d => {
        console.log(`Data:`, JSON.stringify(d.data()));
    });
}

checkIds();
