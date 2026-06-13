const https = require('https');

const projectId = "kaneshow-portal";
const userId = "ecxTQuH6AQJ8z9LftQNf"; // Nomi's ID
const startDateStr = "2026-06-14";
const endDateStr = "2026-07-04";

// 1. Fetch user data
function fetchUser() {
    return new Promise((resolve, reject) => {
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/m_users/${userId}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const u = JSON.parse(data);
                    resolve(u);
                } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

// 2. Fetch specific shift document by ID
function fetchShiftDoc(ymd, uid) {
    return new Promise((resolve) => {
        const docId = `${ymd}_${uid}`;
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/t_shifts/${docId}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const d = JSON.parse(data);
                        const fields = d.fields || {};
                        const mapped = {};
                        for (const [key, value] of Object.entries(fields)) {
                            mapped[key] = value.stringValue || value.booleanValue || value.integerValue || value.doubleValue || null;
                        }
                        resolve(mapped);
                    } catch(e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    try {
        const userDoc = await fetchUser();
        const fields = userDoc.fields || {};
        const u = {
            id: userId,
            Name: fields.Name?.stringValue,
            DisplayName: fields.DisplayName?.stringValue,
            Has28hLimit: fields.Has28hLimit?.booleanValue,
            has28hLimit: fields.has28hLimit?.booleanValue
        };
        console.log("=== NOMI USER PROFILE ===");
        console.log(JSON.stringify(u, null, 2));

        // Generate dates in the extended range
        const dates = [];
        let curr = new Date(startDateStr);
        const end = new Date(endDateStr);
        while (curr <= end) {
            dates.push(curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 1);
        }

        console.log(`\nChecking shifts for Nomi on ${dates.length} dates...`);
        const promises = dates.map(ymd => fetchShiftDoc(ymd, userId));
        const results = await Promise.all(promises);
        const shifts = results.filter(s => s !== null);

        console.log(`\n=== SHIFTS FOUND IN FIRESTORE ===`);
        console.log(`Total shifts found: ${shifts.length}`);
        shifts.forEach(s => {
            console.log(`  Date: ${s.date} | Start: ${s.start} | End: ${s.end} | Status: ${s.status} | Break: ${s.breakMin} | Store: ${s.storeId || s.StoreID}`);
        });

        // Simulate 28h calculations in shift.js:
        const globalShiftMap = {};
        shifts.forEach(s => {
            if (!globalShiftMap[s.userId]) globalShiftMap[s.userId] = {};
            if (!globalShiftMap[s.userId][s.date]) globalShiftMap[s.userId][s.date] = [];
            globalShiftMap[s.userId][s.date].push(s);
        });

        const isTarget = u.Has28hLimit === true || u.Has28hLimit === 'true' || u.Has28hLimit === 'on' || u.has28hLimit === true;
        console.log(`\nIs Nomi target for 28h limit check? ${isTarget}`);

        if (isTarget) {
            let tempDate = new Date(startDateStr);
            const limitEnd = new Date(endDateStr);
            const formatDateJST = (d) => {
                const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
                return jstDate.toISOString().split("T")[0];
            };

            while (tempDate <= limitEnd) {
                let weekHours = 0;
                const weekStart = new Date(tempDate);
                const weekLabel = `${weekStart.getMonth()+1}/${weekStart.getDate()}週`;
                const weekDays = [];

                for (let j = 0; j < 7; j++) {
                    const checkD = new Date(weekStart);
                    checkD.setDate(checkD.getDate() + j);
                    const iso = formatDateJST(checkD);
                    weekDays.push(iso);
                    
                    const dayShifts = globalShiftMap[u.id]?.[iso] || [];
                    dayShifts.forEach(s => {
                        if (s && s.start && s.end && s.status !== 'rejected') {
                            const sA = s.start.split(':').map(Number); 
                            const eA = s.end.split(':').map(Number);
                            let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60); 
                            if (h < 0) h += 24;
                            const net = Math.max(0, h - (Number(s.breakMin || 0))/60);
                            weekHours += net;
                        }
                    });
                }
                
                console.log(`Check Week: ${weekLabel} (${weekDays[0]} ~ ${weekDays[6]}) -> Hours: ${weekHours.toFixed(2)}h`);
                
                if (weekHours > 28) {
                    console.log(`>> VIOLATION FOUND! ${u.DisplayName || u.Name} (${weekLabel}: ${weekHours.toFixed(1)}h)`);
                }
                tempDate.setDate(tempDate.getDate() + 7);
            }
        }

    } catch(e) {
        console.error("Diagnostic error:", e);
    }
}

run();
