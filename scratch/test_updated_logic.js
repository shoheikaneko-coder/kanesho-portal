const fs = require('fs');

// Load user and shift mock data
const usersData = JSON.parse(fs.readFileSync('scratch/users_dump.json', 'utf8'));
const storeId = "ID002";
const storeName = "酒場かね将地下一階";

// Mimic loadStoreStaff
const allStoreUsers = usersData.documents.map(d => {
    const fields = d.fields || {};
    const mapped = { id: d.name.split('/').pop() };
    for (const [key, value] of Object.entries(fields)) {
        mapped[key] = value.stringValue !== undefined ? value.stringValue :
                     value.booleanValue !== undefined ? value.booleanValue :
                     value.integerValue !== undefined ? parseInt(value.integerValue) :
                     value.doubleValue !== undefined ? parseFloat(value.doubleValue) : null;
    }
    return mapped;
}).filter(u => u.StoreID === storeId || u.StoreId === storeId || u.Store === storeName);

// Mock slots
const currentSlot = {
    startDate: new Date(2026, 5, 16), // June 16, 2026
    endDate: new Date(2026, 5, 30)    // June 30, 2026
};

// Help users
const helpUsers = [];

// Daily Goal Sales (Mock)
const dailyGoalSales = {
    "2026-06-16": 243009,
    "2026-06-17": 243009,
    "2026-06-18": 243009,
    "2026-06-19": 398535,
    "2026-06-20": 272170,
    "2026-06-21": 204128,
    "2026-06-22": 0,
    "2026-06-23": 243009,
    "2026-06-24": 243009,
    "2026-06-25": 243009,
    "2026-06-26": 398535,
    "2026-06-27": 272170,
    "2026-06-28": 204128,
    "2026-06-29": 0,
    "2026-06-30": 243005
};

const formatDateJST = (d) => {
    if (!d) return "";
    const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toISOString().split("T")[0];
};

function getExtendedRange(start, end) {
    if (!start || !end) return { start: "", end: "" };
    const s = new Date(start);
    s.setDate(s.getDate() - s.getDay()); 
    const e = new Date(end);
    e.setDate(e.getDate() + (6 - e.getDay()));
    return { 
        start: formatDateJST(s), 
        end: formatDateJST(e) 
    };
}

// Global states to be populated
let currentShifts = {};
let globalShiftMap = {};

// Shifts data from query (Simulating initial database fetch)
const dbShifts = [
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-14", start: "17:00", end: "23:30", status: "confirmed", breakMin: 0, storeId: "ID002" },
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-18", start: "18:30", end: "23:30", status: "confirmed", breakMin: 0, storeId: "ID002" },
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-19", start: "18:30", end: "23:30", status: "confirmed", breakMin: 0, storeId: "ID002" },
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-20", start: "17:00", end: "23:30", status: "confirmed", breakMin: 0, storeId: "ID002" },
  // 6/21 week initial shifts
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-21", start: "17:00", end: "22:45", status: "confirmed", breakMin: 0, storeId: "ID002" },
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-24", start: "18:30", end: "23:30", status: "confirmed", breakMin: 0, storeId: "ID002" },
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-25", start: "18:30", end: "23:30", status: "confirmed", breakMin: 0, storeId: "ID002" },
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-26", start: "18:30", end: "23:30", status: "confirmed", breakMin: 0, storeId: "ID002" },
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-27", start: "17:00", end: "23:30", status: "confirmed", breakMin: 0, storeId: "ID002" },
  { userId: "ecxTQuH6AQJ8z9LftQNf", userName: "タマンノミ", date: "2026-06-28", start: "17:00", end: "22:45", status: "confirmed", breakMin: 0, storeId: "ID002" }
];

// Initialize state
dbShifts.forEach(data => {
    // Populate currentShifts
    if (!currentShifts[data.userId]) currentShifts[data.userId] = {};
    currentShifts[data.userId][data.date] = data;

    // Populate globalShiftMap
    if (!globalShiftMap[data.userId]) globalShiftMap[data.userId] = {};
    if (!globalShiftMap[data.userId][data.date]) globalShiftMap[data.userId][data.date] = [];
    globalShiftMap[data.userId][data.date].push(data);
});

// Simulated updateOverallKPIs
function updateOverallKPIs() {
    let hours = 0, target = 0;
    const users = [...allStoreUsers, ...helpUsers];
    
    // SPH calculation
    for (const ymd in dailyGoalSales) {
        target += dailyGoalSales[ymd];
        users.forEach(u => {
            const s = currentShifts[u.id]?.[ymd];
            if (s && s.start && s.end && s.status !== 'rejected') {
                const sA = s.start.split(':').map(Number); const eA = s.end.split(':').map(Number);
                let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60); if (h < 0) h += 24;
                const net = Math.max(0, h - (s.breakMin || 0)/60);
                hours += net;
            }
        });
    }
    const sph = Math.round(hours > 0 ? target/hours : 0);
    
    // 28h calculation
    const range = getExtendedRange(currentSlot.startDate, currentSlot.endDate);
    const violations = [];

    users.forEach(u => {
        const isTarget = u.Has28hLimit === true || u.Has28hLimit === 'true' || u.Has28hLimit === 'on' || u.has28hLimit === true;
        if (!isTarget) return;

        let tempDate = new Date(range.start);
        const limitEnd = new Date(range.end);
        
        while (tempDate <= limitEnd) {
            let weekHours = 0;
            const weekStart = new Date(tempDate);
            
            for (let j = 0; j < 7; j++) {
                const checkD = new Date(weekStart);
                checkD.setUTCDate(checkD.getUTCDate() + j);
                const iso = checkD.toISOString().split("T")[0];
                
                const dayShifts = globalShiftMap[u.id]?.[iso] || [];
                dayShifts.forEach(s => {
                    if (s && s.start && s.end && s.status !== 'rejected') {
                        const sA = s.start.split(':').map(Number); 
                        const eA = s.end.split(':').map(Number);
                        let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60); if (h < 0) h += 24;
                        weekHours += Math.max(0, h - (Number(s.breakMin || 0))/60);
                    }
                });
            }
            
            if (weekHours > 28) {
                const weekLabel = `${weekStart.getUTCMonth()+1}/${weekStart.getUTCDate()}週`;
                violations.push(`${u.DisplayName || u.Name} (${weekLabel}: ${weekHours.toFixed(1)}h)`);
                break;
            }
            tempDate.setUTCDate(tempDate.getUTCDate() + 7);
        }
    });

    return { sph, violations };
}

// 1. Initial run
console.log("=== Initial State ===");
let result = updateOverallKPIs();
console.log("SPH:", result.sph);
console.log("Violations:", result.violations);

// 2. Simulate saving a shift (06:00 - 22:00, 16h) on 2026-06-23 for Nomi
console.log("\n=== After Adding Nomi's Shift (06:00 - 22:00 on 6/23) ===");
const news = {
    userId: "ecxTQuH6AQJ8z9LftQNf",
    userName: "タマンノミ",
    date: "2026-06-23",
    start: "06:00",
    end: "22:00",
    status: "confirmed",
    breakMin: 0,
    storeId: "ID002",
    StoreID: "ID002"
};

// Simulate what saveShift does (our updated code)
const uid = news.userId;
const date = news.date;
const sid = news.storeId;

// Update currentShifts
if (!currentShifts[uid]) currentShifts[uid] = {};
currentShifts[uid][date] = news;

// Update globalShiftMap
if (!globalShiftMap[uid]) globalShiftMap[uid] = {};
if (!globalShiftMap[uid][date]) globalShiftMap[uid][date] = [];
globalShiftMap[uid][date] = globalShiftMap[uid][date].filter(s => s.storeId != sid && s.StoreID != sid);
globalShiftMap[uid][date].push(news);

// Run calculation again
result = updateOverallKPIs();
console.log("SPH:", result.sph);
console.log("Violations:", result.violations);

// 3. Simulate deleting/logical-deleting Nomi's shift
console.log("\n=== After Logical Deleting Nomi's Shift on 6/23 ===");
const deletedNews = {
    ...news,
    start: "",
    end: "",
    status: "rejected"
};

// Update currentShifts
currentShifts[uid][date] = deletedNews;

// Update globalShiftMap
globalShiftMap[uid][date] = globalShiftMap[uid][date].filter(s => s.storeId != sid && s.StoreID != sid);
globalShiftMap[uid][date].push(deletedNews);

// Run calculation again
result = updateOverallKPIs();
console.log("SPH:", result.sph);
console.log("Violations:", result.violations);
