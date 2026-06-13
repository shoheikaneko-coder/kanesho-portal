const fs = require('fs');

// 1. ダンプデータの読み込み
const usersData = JSON.parse(fs.readFileSync('scratch/users_dump.json', 'utf8'));
const storesData = JSON.parse(fs.readFileSync('scratch/stores_dump.json', 'utf8'));
const punchesData = JSON.parse(fs.readFileSync('scratch/punches_dump.json', 'utf8'));

// cachedStores の再現
const cachedStores = storesData.documents.map(d => {
  const fields = d.fields;
  const parts = d.name.split('/');
  const id = parts[parts.length - 1];
  return {
    id: id,
    store_id: fields.store_id?.stringValue || "",
    store_name: fields.store_name?.stringValue || "",
    StoreID: fields.store_id?.stringValue || "",
    day_change_time: 5 // デフォルト
  };
});

// staffMap の再現
const staffMap = {};
usersData.documents.forEach(d => {
  const fields = d.fields;
  const parts = d.name.split('/');
  const docId = parts[parts.length - 1];
  
  const EmployeeCode = fields.EmployeeCode?.stringValue || "";
  const staff_id = fields.staff_id?.stringValue || "";
  const staff_code = fields.staff_code?.stringValue || "";
  const UserId = fields.UserId?.stringValue || "";
  const sid = EmployeeCode || staff_id || staff_code || UserId || docId;
  
  const name = fields.Name?.stringValue || fields.name?.stringValue || fields.staff_name?.stringValue || "(名前なし)";
  const sName = fields.Store?.stringValue || fields.store_name?.stringValue || "";
  const StoreID = fields.StoreID?.stringValue || "";

  const matchedStore = cachedStores.find(st => 
    st.store_name === sName || 
    st.id === StoreID || 
    st.store_id === StoreID
  );
  
  const sidStr = String(sid).trim();
  staffMap[sidStr] = { 
    code: sidStr, 
    name: String(name).trim(), 
    store_id: matchedStore ? (matchedStore.store_id || matchedStore.id) : (StoreID || matchedStore?.id || ""),
    store_name: matchedStore ? matchedStore.store_name : (sName || "不明")
  };
});

// year_month = "2026-04" の打刻のみをフィルタリング (loadIntegratedData の再現)
const punches = [];
punchesData.documents.forEach(d => {
  const fields = d.fields;
  const year_month = fields.year_month?.stringValue || "";
  if (year_month === "2026-04") {
    punches.push({
      docId: d.name.split('/').pop(),
      staff_id: fields.staff_id?.stringValue || "",
      timestamp: fields.timestamp?.stringValue || "",
      date: fields.date?.stringValue || "",
      type: fields.type?.stringValue || ""
    });
  }
});

console.log("=== Loaded 2026-04 punches size ===", punches.length);

// 集計ロジック (loadIntegratedData の再現)
const staffSessions = {};
const staffMonthlyStats = {};

Object.keys(staffMap).forEach(sid => {
  staffMonthlyStats[sid] = {
    code: staffMap[sid].code,
    name: staffMap[sid].name,
    store_id: staffMap[sid].store_id,
    store_name: staffMap[sid].store_name,
    totalHours: 0,
    lateHours: 0,
    days: new Set(),
    errors: []
  };
  staffSessions[sid] = [];
});

const staffPunches = {};
punches.forEach(p => {
  const sid = String(p.staff_id || "").trim();
  if (!staffPunches[sid]) staffPunches[sid] = [];
  staffPunches[sid].push(p);
});

// 深夜時間計算ヘルパー
function calculateOverlapLateNightHours(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (s >= e) return 0;
  let totalLateMs = 0;
  const loopStart = new Date(s.getTime());
  loopStart.setDate(loopStart.getDate() - 1);
  const loopEnd = new Date(e.getTime());
  loopEnd.setDate(loopEnd.getDate() + 1);
  for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
    const l22 = new Date(d);
    l22.setHours(22, 0, 0, 0);
    const l05 = new Date(d);
    l05.setDate(l05.getDate() + 1);
    l05.setHours(5, 0, 0, 0);
    const overlapStart = s > l22 ? s : l22;
    const overlapEnd = e < l05 ? e : l05;
    if (overlapEnd > overlapStart) {
      totalLateMs += (overlapEnd - overlapStart);
    }
  }
  return totalLateMs / 3600000;
}

for (const [sid, records] of Object.entries(staffPunches)) {
  if (!staffMonthlyStats[sid]) continue;
  
  records.sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  
  let lastIn = null;
  let bStart = null;
  let breakSessions = [];

  records.forEach(r => {
    const ts = new Date(r.timestamp);
    const type = r.type;

    if (type === 'check_in' || type === '出勤') {
      lastIn = { timestamp: ts, record: r };
      breakSessions = [];
      staffMonthlyStats[sid].days.add(r.date);
    } 
    else if ((type === 'break_start' || type === '休憩開始') && lastIn) {
      bStart = { timestamp: ts, record: r };
    }
    else if ((type === 'break_end' || type === '休憩終了') && bStart) {
      breakSessions.push({ start: bStart.timestamp, end: ts, startRecord: bStart.record, endRecord: r });
      bStart = null;
    }
    else if (type === 'check_out' || type === '退勤') {
      if (lastIn) {
        const totalBreaks = breakSessions.reduce((sum, s) => sum + (s.end - s.start) / 3600000, 0);
        const grossShift = (ts - lastIn.timestamp) / 3600000;
        const netLabor = Math.max(0, grossShift - totalBreaks);
        
        let lateLabor = 0;
        if (netLabor > 0) {
          const rawLate = calculateOverlapLateNightHours(lastIn.timestamp, ts);
          const lateBreaks = breakSessions.reduce((sum, s) => sum + calculateOverlapLateNightHours(s.start, s.end), 0);
          lateLabor = Math.max(0, rawLate - lateBreaks);
          
          staffMonthlyStats[sid].totalHours += netLabor;
          staffMonthlyStats[sid].lateHours += lateLabor;
        }

        staffSessions[sid].push({
          date: lastIn.record.date || lastIn.record.timestamp.substring(0, 10),
          checkIn: lastIn,
          checkOut: { timestamp: ts, record: r },
          breakSessions: breakSessions,
          netLabor: netLabor,
          lateLabor: lateLabor
        });

        lastIn = null;
        breakSessions = [];
      }
    }
  });
}

// renderIntDaily() の再現と、クラッシュテスト
console.log("\n=== Starting renderIntDaily simulation ===");
const storeId = "ID001";
const date = "2026-04-30";

const activeStaff = Object.values(staffMap).filter(s => {
  return !storeId || String(s.store_id) === String(storeId);
});

console.log("activeStaff size:", activeStaff.length);

let renderedCount = 0;
try {
  activeStaff.sort((a,b) => a.code.localeCompare(b.code)).forEach(s => {
    const mySessions = staffSessions[s.code] || [];
    const todaySession = mySessions.find(sess => sess.date === date);

    let checkInStr = '-';
    let checkOutStr = '-';
    let laborStr = '-';
    let lateStr = '-';

    if (todaySession) {
      // 潜んでいるかもしれないクラッシュ箇所！
      checkInStr = todaySession.checkIn.record.timestamp.substring(11, 16);
      checkOutStr = todaySession.checkOut.record.timestamp.substring(11, 16);
      laborStr = `${todaySession.netLabor.toFixed(2)}h`;
      lateStr = todaySession.lateLabor > 0 ? `${todaySession.lateLabor.toFixed(2)}h` : '-';
    }
    
    renderedCount++;
    console.log(`Rendered #${renderedCount}: ${s.code} ${s.name} (HasSession: ${!!todaySession})`);
  });
  console.log("\n=== SUCCESS! No crash in renderIntDaily ===");
} catch (e) {
  console.error("\n=== CRASH DETECTED in renderIntDaily! ===");
  console.error(e);
}
