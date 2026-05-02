import { db } from './firebase.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function checkOtoshiData() {
    console.log("--- お通しデータの調査開始 ---");
    const q = query(
        collection(db, "t_monthly_sales"), 
        where("year_month", "==", "2026-04"),
        where("menu_name", "==", "お通し")
    );
    const snap = await getDocs(q);
    
    if (snap.empty) {
        console.log("データが見つかりませんでした。");
    } else {
        snap.forEach(d => {
            const data = d.data();
            console.log(`ID: ${d.id}`);
            console.log(`  店舗ID: ${data.store_id}`);
            console.log(`  販売数: ${data.quantity_sold}`);
            console.log(`  チョイスID: ${data.choice_id}`);
            console.log(`  is_total: ${data.is_total}`);
            console.log(`  売上金額: ${data.total_sales}`);
        });
    }
}

checkOtoshiData();
