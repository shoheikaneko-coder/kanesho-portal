import { db } from '../firebase.js';
import { collection, getDocs, query, where, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function cleanupAttendance(isDryRun = true) {
    console.log(`Starting Attendance Cleanup (${isDryRun ? 'DRY RUN' : 'LIVE DELETE'})...`);
    
    const startDate = "2026-04-01";
    const endDate = "2026-04-30";
    
    // 1. 全打刻データの取得 (4月分)
    const q1 = query(collection(db, "t_attendance"), where("date", ">=", startDate), where("date", "<=", endDate));
    const q2 = query(collection(db, "t_attendance"), where("date", ">=", startDate.replace(/-/g, '/')), where("date", "<=", endDate.replace(/-/g, '/')));
    
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const allDocs = [];
    snap1.forEach(d => allDocs.push({ id: d.id, ref: d.ref, ...d.data() }));
    snap2.forEach(d => allDocs.push({ id: d.id, ref: d.ref, ...d.data() }));

    console.log(`Fetched ${allDocs.length} total records.`);

    const normalizeId = (id) => String(id || "").trim().replace(/^0+/, '');

    // 2. グルーピングして重複を特定
    // キー: {normalizedStaffId}_{timestamp}_{type}
    const groups = {};
    const duplicates = [];

    allDocs.forEach(doc => {
        const sid = normalizeId(doc.staff_id || doc.EmployeeCode || "");
        const ts = doc.timestamp || "";
        const type = doc.type || "";
        
        if (!sid || !ts || !type) return;

        const key = `${sid}_${ts}_${type}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(doc);
    });

    const report = [];
    let totalDuplicatesFound = 0;

    Object.entries(groups).forEach(([key, docs]) => {
        if (docs.length > 1) {
            // 重複あり。1つだけ残して他を削除対象にする。
            // modifiedAt がある新しい方を優先的に残す
            docs.sort((a, b) => {
                const timeA = a.modifiedAt?.toMillis ? a.modifiedAt.toMillis() : 0;
                const timeB = b.modifiedAt?.toMillis ? b.modifiedAt.toMillis() : 0;
                return timeB - timeA;
            });

            const keep = docs[0];
            const toDelete = docs.slice(1);
            totalDuplicatesFound += toDelete.length;

            report.push({
                staff: keep.staff_name || keep.staff_id,
                time: keep.timestamp,
                type: keep.type,
                keepId: keep.id,
                deleteIds: toDelete.map(d => d.id),
                isMixedFormat: docs.some(d => d.date?.includes('/')) && docs.some(d => d.date?.includes('-'))
            });

            if (!isDryRun) {
                // TODO: 実際の削除処理 (今回はまずレポートのみ)
            }
        }
    });

    console.log("--- DUPLICATE REPORT ---");
    report.slice(0, 20).forEach(r => {
        console.log(`[${r.staff}] ${r.time} ${r.type} -> 重複: ${r.deleteIds.length}件 (形式混在: ${r.isMixedFormat})`);
    });
    if (report.length > 20) console.log(`...and ${report.length - 20} more groups.`);
    
    console.log(`\nTotal duplicate records to be removed: ${totalDuplicatesFound}`);
    console.log("------------------------");
    
    return report;
}

// 実行
cleanupAttendance(true);
