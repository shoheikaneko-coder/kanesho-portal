import { db } from '../firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function diagnose() {
    console.log("Starting Diagnostic...");
    
    // 期間設定 (ユーザーの申告に合わせて 4/1 - 4/20 と想定)
    const startDate = "2026-04-01";
    const endDate = "2026-04-20";
    
    // 1. マスタ取得
    const uSnap = await getDocs(collection(db, "m_users"));
    const userMap = {};
    uSnap.forEach(d => {
        const data = d.data();
        const id = d.id;
        const code = data.EmployeeCode || "";
        userMap[id] = data;
        if (code) userMap[code] = data;
    });

    const sSnap = await getDocs(collection(db, "m_stores"));
    const storeMap = {};
    sSnap.forEach(d => {
        storeMap[d.id] = d.data();
        const sid = d.data().store_id || d.data().StoreID;
        if (sid) storeMap[String(sid)] = d.data();
    });

    // 2. 打刻データ取得 (CSVと同じロジックで取得)
    const lSnap = await getDocs(collection(db, "t_attendance"));
    const allPunches = [];
    lSnap.forEach(d => {
        const data = d.data();
        const date = (data.date || "").replace(/\//g, '-');
        if (date >= startDate && date <= "2026-04-21") { // 翌日まで
            allPunches.push({ ...data, date });
        }
    });
    
    allPunches.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

    // 3. CSV方式での集計
    const csvStats = {};
    const staffPunches = {};
    allPunches.forEach(p => {
        const sid = p.staff_id;
        if (!staffPunches[sid]) staffPunches[sid] = [];
        staffPunches[sid].push(p);
    });

    for (const [sid, punches] of Object.entries(staffPunches)) {
        let total = 0;
        let lastIn = null;
        let breakSum = 0;
        let bStart = null;

        punches.forEach(p => {
            const type = p.type;
            const time = new Date(p.timestamp);
            if (type === 'check_in') {
                if (p.date <= endDate) {
                    lastIn = time;
                    breakSum = 0;
                }
            } else if (type === 'break_start' && lastIn) {
                bStart = time;
            } else if (type === 'break_end' && bStart) {
                breakSum += (time - bStart);
                bStart = null;
            } else if (type === 'check_out' && lastIn) {
                total += (time - lastIn - breakSum) / 3600000;
                lastIn = null;
            }
        });
        if (total > 0) csvStats[sid] = total;
    }

    // 4. 差分抽出
    console.log("--- Comparison Result ---");
    let csvTotal = 0;
    Object.entries(csvStats).forEach(([sid, h]) => {
        csvTotal += h;
        const user = userMap[sid] || { Name: "Unknown" };
        // 加藤さんなどの既知の正常データ以外で、目立つものを探す
        if (h > 0) {
            // console.log(`${user.Name} (${sid}): ${h.toFixed(2)}h`);
        }
    });

    console.log(`CSV Logic Total: ${csvTotal.toFixed(2)}h`);
}

diagnose();
