const https = require('https');

const projectId = "kaneshow-portal";
const storeId = "ID002"; // Store ID in screenshot
const storeName = "酒場かね将地下一階";
const startDateStr = "2026-06-16";
const endDateStr = "2026-06-30";

// JST Date conversion helper
const formatDateJST = (d) => {
    const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toISOString().split("T")[0];
};

function getExtendedRange(start, end) {
    const s = new Date(start);
    s.setDate(s.getDate() - s.getDay()); 
    const e = new Date(end);
    e.setDate(e.getDate() + (6 - e.getDay()));
    return { 
        start: formatDateJST(s), 
        end: formatDateJST(e) 
    };
}

// 1. Fetch users of the store
function fetchStoreUsers() {
    return new Promise((resolve) => {
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/m_users?pageSize=300`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = JSON.parse(data);
                const docs = result.documents || [];
                const users = docs.map(d => {
                    const fields = d.fields || {};
                    const mapped = { id: d.name.split('/').pop() };
                    for (const [key, value] of Object.entries(fields)) {
                        mapped[key] = value.stringValue || value.booleanValue || value.integerValue || value.doubleValue || null;
                    }
                    return mapped;
                }).filter(u => u.StoreID === storeId || u.StoreId === storeId || u.Store === storeName);
                resolve(users);
            });
        });
    });
}

// 2. Fetch all shifts in the database
function fetchAllShifts() {
    return new Promise((resolve) => {
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/t_shifts?pageSize=1000`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = JSON.parse(data);
                const docs = result.documents || [];
                const shifts = docs.map(d => {
                    const fields = d.fields || {};
                    const mapped = { id: d.name.split('/').pop() };
                    for (const [key, value] of Object.entries(fields)) {
                        mapped[key] = value.stringValue || value.booleanValue || value.integerValue || value.doubleValue || null;
                    }
                    return mapped;
                });
                resolve(shifts);
            });
        });
    });
}

async function run() {
    const users = await fetchStoreUsers();
    console.log(`Loaded ${users.length} users for store ${storeName}:`);
    users.forEach(u => console.log(`  Name: ${u.Name} | Display: ${u.DisplayName} | Has28hLimit: ${u.Has28hLimit}`));

    const allShifts = await fetchAllShifts();
    console.log(`Loaded ${allShifts.length} total shifts in Firestore.`);

    const range = getExtendedRange(startDateStr, endDateStr);
    console.log(`Extended range: ${range.start} to ${range.end}`);

    // Filter shifts like loadShiftsBatch
    const globalShiftMap = {};
    const currentShifts = {};
    allShifts.forEach(s => {
        if (s.date < range.start || s.date > range.end) return;

        // globalShiftMap population
        if (!globalShiftMap[s.userId]) globalShiftMap[s.userId] = {};
        if (!globalShiftMap[s.userId][s.date]) globalShiftMap[s.userId][s.date] = [];
        globalShiftMap[s.userId][s.date].push(s);

        // store filter for currentShifts
        if (s.storeId != storeId) return;
        if (!currentShifts[s.userId]) currentShifts[s.userId] = {};
        currentShifts[s.userId][s.date] = s;
    });

    console.log("\nShifts in globalShiftMap for Nomi:");
    const nomiId = "ecxTQuH6AQJ8z9LftQNf";
    const nomiMap = globalShiftMap[nomiId] || {};
    for (const [date, list] of Object.entries(nomiMap)) {
        console.log(`  Date: ${date} -> ${list.map(s => `${s.start}-${s.end} (Status: ${s.status})`).join(', ')}`);
    }

    // Now run 28h calculation like updateOverallKPIs
    const violations = [];
    users.forEach(u => {
        const isTarget = u.Has28hLimit === true || u.Has28hLimit === 'true' || u.Has28hLimit === 'on' || u.has28hLimit === true;
        if (!isTarget) return;

        let tempDate = new Date(range.start);
        const limitEnd = new Date(range.end);

        while (tempDate <= limitEnd) {
            let weekHours = 0;
            const weekStart = new Date(tempDate);
            const weekLabel = `${weekStart.getMonth()+1}/${weekStart.getDate()}週`;

            for (let j = 0; j < 7; j++) {
                const checkD = new Date(weekStart);
                checkD.setDate(checkD.getDate() + j);
                const iso = formatDateJST(checkD);

                const dayShifts = globalShiftMap[u.id]?.[iso] || [];
                dayShifts.forEach(s => {
                    if (s && s.start && s.end && s.status !== 'rejected') {
                        const sA = s.start.split(':').map(Number);
                        const eA = s.end.split(':').map(Number);
                        let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60);
                        if (h < 0) h += 24;
                        weekHours += Math.max(0, h - (Number(s.breakMin || 0))/60);
                    }
                });
            }

            if (weekHours > 28) {
                violations.push(`${u.DisplayName || u.Name} (${weekLabel}: ${weekHours.toFixed(1)}h)`);
                break;
            }
            tempDate.setDate(tempDate.getDate() + 7);
        }
    });

    console.log(`\nViolations found: ${violations.length}`);
    console.log(violations);
}

run();
