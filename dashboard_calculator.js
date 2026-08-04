import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const TAX_RATE = 1.1;

export async function fetchAndCalculateDashboardData(db, dateFrom, dateTo, storeFilter, groupFilter) {
    const storeMap = {};
    const sSnap = await getDocs(collection(db, "m_stores"));
    sSnap.forEach(doc => {
        const data = doc.data();
        const fullData = { ...data, id: doc.id };
        storeMap[doc.id] = fullData;
        const sid = data.store_id || data.StoreID || data['店舗ID'];
        if (sid) storeMap[String(sid)] = fullData;
    });

    // 1. 売上データの取得
    const pRef = collection(db, "t_performance");
    const pSnap = await getDocs(query(pRef, where("date", ">=", dateFrom), where("date", "<=", dateTo)));
    
    let daily = [];
    let groupDaily = [];
    pSnap.forEach(doc => {
        const d = doc.data();
        const normDate = (d.date || "").replace(/\//g, '-').replace(/\./g, '-');
        if (normDate >= dateFrom && normDate <= dateTo) {
            const si = storeMap[d.store_id];
            const ym = d.year_month || normDate.substring(0, 7);
            
            groupDaily.push({ ...d, date: normDate, ym: ym });

            if (storeFilter !== 'all' && d.store_id !== storeFilter) return;
            if (groupFilter !== 'all' && (!si || si.group_name !== groupFilter)) return;
            daily.push({ ...d, date: normDate, ym: ym });
        }
    });

    const groupSalesByYM = {};
    groupDaily.forEach(r => {
        const si = storeMap[r.store_id];
        const gn = si ? (si.group_name || si.GroupName || si['グループ名']) : "";
        if (gn) {
            const gkey = `${gn}__${r.ym}`;
            groupSalesByYM[gkey] = (groupSalesByYM[gkey] || 0) + (r.amount || r.sales || 0) / TAX_RATE;
        }
    });

    const grouped = {};
    daily.forEach(r => {
        const sid = r.store_id || r.StoreID || "";
        const ym = r.year_month || r.YearMonth || (r.date ? r.date.substring(0, 7) : "");
        if (!sid || !ym) return;

        const key = `${ym}__${sid}`;
        if (!grouped[key]) {
            const si = storeMap[sid] || {};
            grouped[key] = {
                ym: ym,
                year_month: ym,
                store_id: sid, 
                store_name: r.store_name || r.StoreName || si.store_name || si.StoreName,
                group_name: si.group_name || si.GroupName || si['グループ名'],
                sales: 0, customers: 0, cash_diff: 0, days: 0, 
                op_hours: 0, ck_alloc: 0
            };
        }
        const g = grouped[key];
        g.sales += (r.amount || r.Amount || r['売上税込'] || 0);
        g.customers += (r.customer_count || r.CustomerCount || r['客数'] || 0);
        g.cash_diff += (r.cash_diff || r.CashDiff || r['現金過不足'] || 0);
        g.days += 1;
    });

    // 2. 勤怠データの取得 (深夜跨ぎ対応のため終了日に+1日)
    const dateToPlus1 = new Date(new Date(dateTo).getTime() + 86400000).toISOString().substring(0, 10);
    const lRef = collection(db, "t_attendance");
    // ※注意: where("date") のインデックスが必要になる場合があります。
    const lSnap = await getDocs(query(lRef, where("date", ">=", dateFrom), where("date", "<=", dateToPlus1)));
    const laborRaw = [];
    
    lSnap.forEach(doc => {
        const d = doc.data();
        const ts = d.timestamp || d.date || "";
        const rawDate = d.date || ts.substring(0, 10);
        const normDate = rawDate.replace(/\//g, '-').replace(/\./g, '-');
        
        if (normDate >= dateFrom && normDate <= dateToPlus1) {
            laborRaw.push(d);
        }
    });

    const storeNameToId = {};
    Object.entries(storeMap).forEach(([k, v]) => {
        if (v.store_name) storeNameToId[v.store_name] = v.id || k;
    });

    const perStaff = {};
    laborRaw.forEach(r => {
        const ts = r.timestamp || r.date || r.Date || "";
        const staffId = String(r.staff_id || r.staff_code || r.EmployeeCode || r.staff_name || r.name || "").trim();
        const rawSid = String(r.store_id || r.StoreID || r.labor_store_id || storeNameToId[r.store_name] || "").trim();
        const si = storeMap[rawSid];
        const sid = (si && si.id) ? si.id : rawSid; 
        
        if (!ts || !sid || !staffId) return;
        const key = staffId;
        if (!perStaff[key]) perStaff[key] = [];
        perStaff[key].push({ ...r, normalized_sid: sid });
    });

    const uSnap = await getDocs(collection(db, "m_users"));
    const userMap = {};
    uSnap.forEach(d => { 
        const data = d.data();
        userMap[String(d.id).trim()] = data;
        const code = data.EmployeeCode || data.staff_code || data.staff_id || "";
        if (code) userMap[String(code).trim()] = data;
        const name = data.staff_name || data.name || "";
        if (name) userMap[name.trim()] = data;
    });

    const laborMap = {};      
    const ckHoursPool = {};   
    const dailyLaborMap = {}; 
    const dailyCkHoursPool = {}; 

    Object.values(perStaff).forEach(recs => {
        const first = recs[0];
        const staffKey = String(first.staff_id || first.staff_code || first.EmployeeCode || first.staff_name || first.name || "").trim();
        const staffData = userMap[staffKey] || {};
        const staffStoreId = String(staffData.StoreID || staffData.StoreId || staffData.store_id || "").trim();
        const homeStore = storeMap[staffStoreId];
        const isCKStaff = homeStore && String(homeStore.store_type || "").trim() === 'CK';
        const staffGroupName = homeStore ? String(homeStore.group_name || homeStore.GroupName || homeStore['グループ名'] || "").trim() : "";

        recs.sort((a,b) => new Date(a.timestamp || a.date || 0) - new Date(b.timestamp || b.date || 0));
        let inT = null, breakStartT = null, totalBreakMs = 0, currentNormalizedSid = "", inDate = null;

        recs.forEach(r => {
            let ts = r.timestamp || r.date || r.Date || "";
            if (ts && typeof ts.toDate === 'function') ts = ts.toDate().toISOString();
            else ts = String(ts);
            
            if (!ts) return;
            const type = String(r.type || r.Type || '').toLowerCase();
            const sid = r.normalized_sid;
            const isImported = (r.total_labor_hours !== undefined || r.TotalLaborHours !== undefined);

            if (isImported) {
                const h = Number(r.total_labor_hours || r.TotalLaborHours || 0);
                const rawYm = r.year_month || r.YearMonth || String(ts).substring(0, 7);
                const ym = String(rawYm).replace(/\//g, '-');
                const rawSid = String(r.store_id || r.StoreID || "").trim();
                const si = storeMap[rawSid];
                const normSid = (si && si.id) ? si.id : rawSid;
                const fallbackSid = (staffData ? (staffData.StoreID || staffData.StoreId) : '') || 'unknown';
                const finalSid = normSid || fallbackSid;
                
                if (ym && ym >= dateFrom.substring(0,7) && ym <= dateTo.substring(0,7)) {
                    if (isCKStaff && staffGroupName) {
                        const gkey = `${staffGroupName}__${ym}`;
                        ckHoursPool[gkey] = (ckHoursPool[gkey] || 0) + h;
                    } else {
                        const k = `${ym}__${finalSid}`;
                        laborMap[k] = (laborMap[k] || 0) + h;
                    }
                }
            } else {
                if (type === 'in' || type.includes('check_in') || type.includes('出勤')) {
                    inT = new Date(ts);
                    if (!isNaN(inT.getTime())) {
                        totalBreakMs = 0; breakStartT = null; currentNormalizedSid = sid;
                        const jstInT = new Date(inT.getTime() + (9 * 60 * 60 * 1000));
                        inDate = r.date || jstInT.toISOString().substring(0, 10);
                    } else {
                        inT = null;
                    }
                } else if (type.includes('break_start') || type.includes('休憩開始')) {
                    breakStartT = new Date(ts);
                    if (isNaN(breakStartT.getTime())) breakStartT = null;
                } else if ((type.includes('break_end') || type.includes('休憩終了')) && breakStartT) {
                    const boT = new Date(ts);
                    if (!isNaN(boT.getTime())) {
                        totalBreakMs += (boT - breakStartT);
                    }
                    breakStartT = null;
                } else if ((type === 'out' || type.includes('check_out') || type.includes('退勤')) && inT) {
                    const outT = new Date(ts);
                    if (!isNaN(outT.getTime())) {
                        const netMs = Math.max(0, (outT - inT) - totalBreakMs);
                        const h = netMs / 3600000;
                        const shiftDate = inDate || r.date || new Date(inT.getTime() + (9 * 60 * 60 * 1000)).toISOString().substring(0, 10);
                        const ym = shiftDate.substring(0, 7).replace(/\//g, '-');
                        const finalSid = currentNormalizedSid || sid;

                        if (shiftDate >= dateFrom && shiftDate <= dateTo) {
                            if (isCKStaff && staffGroupName) {
                                const gkey = `${staffGroupName}__${ym}`;
                                const dgkey = `${staffGroupName}__${shiftDate}`;
                                ckHoursPool[gkey] = (ckHoursPool[gkey] || 0) + h;
                                dailyCkHoursPool[dgkey] = (dailyCkHoursPool[dgkey] || 0) + h;
                            } else {
                                const fallbackSid = (staffData ? (staffData.StoreID || staffData.StoreId) : '') || 'unknown';
                                const sidToUse = finalSid || fallbackSid;
                                const k = `${ym}__${sidToUse}`;
                                const dk = `${shiftDate}__${sidToUse}`;
                                laborMap[k] = (laborMap[k] || 0) + h;
                                dailyLaborMap[dk] = (dailyLaborMap[dk] || 0) + h;
                            }
                        }
                    }
                    inT = null; totalBreakMs = 0; breakStartT = null; inDate = null;
                }
            }
        });
    });

    Object.keys(grouped).forEach(k => {
        if (laborMap[k]) grouped[k].op_hours = laborMap[k];
    });

    const groupDailySales = {};
    groupDaily.forEach(r => {
        const si = storeMap[r.store_id];
        const gn = si ? (si.group_name || si.GroupName || si['グループ名']) : "";
        if (gn) {
            const dgkey = `${gn}__${r.date}`;
            groupDailySales[dgkey] = (groupDailySales[dgkey] || 0) + (r.amount || r.sales || 0) / TAX_RATE;
        }
    });

    daily.forEach(r => {
        const sid = r.store_id || r.StoreID || "";
        const si = storeMap[sid] || {};
        const gn = si.group_name || si.GroupName || si['グループ名'] || "";
        
        const dk = `${r.date}__${sid}`;
        r.op_hours = dailyLaborMap[dk] || 0;
        
        const dgkey = `${gn}__${r.date}`;
        const totalCkH = dailyCkHoursPool[dgkey] || 0;
        const gSales = groupDailySales[dgkey] || 0;
        const exTax = (r.amount || r.Amount || r['売上税込'] || 0) / TAX_RATE;
        
        if (gSales > 0 && totalCkH > 0) {
            r.ck_alloc = totalCkH * (exTax / gSales);
        } else {
            r.ck_alloc = 0;
        }
    });

    Object.values(grouped).forEach(r => {
        const gn = r.group_name || ""; 
        const gkey = `${gn}__${r.ym}`;
        const gTotalSales = groupSalesByYM[gkey] || 0;
        const totalCkH = ckHoursPool[gkey] || 0;
        
        if (gTotalSales > 0) {
            const ratio = (r.sales / TAX_RATE) / gTotalSales;
            r.ck_alloc = totalCkH * ratio;
        } else {
            r.ck_alloc = 0;
        }
    });

    let totalOpH = 0;
    let totalCkH = 0;
    const filteredLaborMap = {};

    Object.entries(laborMap).forEach(([key, h]) => {
        const [ym, sid] = key.split('__');
        if (storeFilter !== 'all' && sid !== storeFilter) return;
        const si = storeMap[sid];
        if (groupFilter !== 'all' && (!si || si.group_name !== groupFilter)) return;
        totalOpH += h;
        filteredLaborMap[key] = h;
    });

    Object.entries(ckHoursPool).forEach(([key, h]) => {
        const [gn, ym] = key.split('__');
        if (groupFilter !== 'all' && gn !== groupFilter) return;
        totalCkH += h;
    });

    const records = Object.values(grouped);
    const goals = await calculatePeriodGoals(db, storeFilter, groupFilter, storeMap, dateFrom, dateTo);

    return {
        records,
        goals,
        totalOpH,
        totalCkH,
        daily,
        storeMap,
        userMap,
        filteredLaborMap
    };
}


export async function calculatePeriodGoals(db, storeFilter, groupFilter, storeMap, dateFrom, dateTo) {
    const storesToProcess = [];
    if (storeFilter === 'all') {
        Object.values(storeMap).forEach(s => {
            const sid = s.id || s.StoreID || s.StoreId;
            if (!sid) return;
            const gn = s.group_name || s.GroupName || s['グループ名'] || "";
            if (groupFilter === 'all' || gn === groupFilter) {
                if (String(s.store_type || "").trim() !== 'CK') {
                    storesToProcess.push(sid);
                }
            }
        });
    } else {
        storesToProcess.push(storeFilter);
    }

    let totalSales = 0;
    let totalCust = 0;
    let sphOpSum = 0;
    let sphTotSum = 0;
    let laborTargetCount = 0;
    let dailySalesTargets = {};

    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    
    let fy = startDate.getFullYear();
    if (startDate.getMonth() < 6) fy--;

    const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
    
    // YMごとのカレンダーをキャッシュ
    const calendarCache = {};
    const getCalendar = async (ym, sid) => {
        const key = `${ym}_${sid}`;
        if (calendarCache[key]) return calendarCache[key];
        try {
            const snap = await getDoc(doc(db, "m_calendars", key));
            calendarCache[key] = snap.exists() ? snap.data() : { days: [] };
        } catch (e) {
            calendarCache[key] = { days: [] };
        }
        return calendarCache[key];
    };

    // 目標をキャッシュ
    const goalCache = {};
    const getGoal = async (ym, sid) => {
        const key = `${ym}_${sid}`;
        if (goalCache[key]) return goalCache[key];
        try {
            const snap = await getDoc(doc(db, "t_monthly_goals", key));
            goalCache[key] = snap.exists() ? snap.data() : {};
        } catch (e) {
            goalCache[key] = {};
        }
        return goalCache[key];
    };

    for (const sid of storesToProcess) {
        // m_annual_budgets から人時売上目標を取得
        try {
            const bSnap = await getDoc(doc(db, "m_annual_budgets", `${fy}_${sid}`));
            if (bSnap.exists()) {
                const b = bSnap.data();
                if (b.target_sales_per_hour_op) {
                    sphOpSum += Number(b.target_sales_per_hour_op || 0);
                    sphTotSum += Number(b.target_sales_per_hour_total || 0);
                    laborTargetCount++;
                }
            }
        } catch (e) { /* ignore */ }

        // t_monthly_goals と m_calendars を使って日割り目標を計算
        // 対象期間をループ
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const yyyy = d.getFullYear();
            const mm = d.getMonth() + 1;
            const ym = `${yyyy}-${String(mm).padStart(2, '0')}`;
            const dd = d.getDate();
            const dow = d.getDay();
            
            // 当該月全体の情報を取得して日割り係数を算出する (一度計算したらキャッシュできるが簡易化のため都度計算)
            const commonCal = await getCalendar(ym, "common");
            const storeCal = await getCalendar(ym, sid);
            const goalData = await getGoal(ym, sid);
            
            const weights = goalData.weights || { 
                mon_thu: 1.0, fri: 1.2, sat: 1.5, sun: 1.4, holiday: 1.5, day_before_holiday: 1.6 
            };
            
            const daysInMonth = new Date(yyyy, mm, 0).getDate();
            let monthTotalPoints = 0;
            
            // 月全体のポイントを計算
            for (let md = 1; md <= daysInMonth; md++) {
                const mdTypeC = commonCal.days?.find(i => i.day === md) || { type: 'work' };
                const mdTypeS = storeCal.days?.find(i => i.day === md);
                const type = mdTypeS ? mdTypeS.type : mdTypeC.type;
                if (type === 'off') continue;
                
                const mdDate = new Date(yyyy, mm - 1, md);
                const mdDow = mdDate.getDay();
                
                // 次の日の祝日判定
                const nextDate = new Date(yyyy, mm - 1, md + 1);
                const nextMd = nextDate.getDate();
                const nextTypeC = commonCal.days?.find(i => i.day === nextMd) || {};
                const isDayBeforeH = nextTypeC.is_holiday || false;

                const indices = [];
                if (mdDow >= 1 && mdDow <= 4) indices.push(weights.mon_thu);
                else if (mdDow === 5) indices.push(weights.fri);
                else if (mdDow === 6) indices.push(weights.sat);
                else if (mdDow === 0) indices.push(weights.sun);

                if (mdTypeC.is_holiday) indices.push(weights.holiday);
                if (isDayBeforeH) indices.push(weights.day_before_holiday || 1.0);

                monthTotalPoints += Math.max(...indices);
            }
            
            const monthlyTargetSales = goalData.sales_target || 0;
            const monthlyTargetCust = goalData.customers_target || 0;
            const unitSales = monthTotalPoints > 0 ? (monthlyTargetSales / monthTotalPoints) : 0;
            const unitCust = monthTotalPoints > 0 ? (monthlyTargetCust / monthTotalPoints) : 0;
            
            // 当日のポイントを計算
            const todayTypeC = commonCal.days?.find(i => i.day === dd) || { type: 'work' };
            const todayTypeS = storeCal.days?.find(i => i.day === dd);
            const todayType = todayTypeS ? todayTypeS.type : todayTypeC.type;
            
            if (todayType !== 'off') {
                const nextDate = new Date(yyyy, mm - 1, dd + 1);
                const nextMd = nextDate.getDate();
                const nextTypeC = commonCal.days?.find(i => i.day === nextMd) || {};
                const isDayBeforeH = nextTypeC.is_holiday || false;

                const indices = [];
                if (dow >= 1 && dow <= 4) indices.push(weights.mon_thu);
                else if (dow === 5) indices.push(weights.fri);
                else if (dow === 6) indices.push(weights.sat);
                else if (dow === 0) indices.push(weights.sun);

                if (todayTypeC.is_holiday) indices.push(weights.holiday);
                if (isDayBeforeH) indices.push(weights.day_before_holiday || 1.0);

                const todayPoint = Math.max(...indices);
                const dailySales = Math.round(unitSales * todayPoint);
                totalSales += dailySales;
                totalCust += Math.round(unitCust * todayPoint);
                
                const dStr = yyyy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
                if (!dailySalesTargets[dStr]) dailySalesTargets[dStr] = 0;
                dailySalesTargets[dStr] += dailySales;
            }
        }
    }

    return {
        sales: totalSales,
        customers: totalCust,
        sph_op: laborTargetCount > 0 ? (sphOpSum / laborTargetCount) : 0,
        sph_total: laborTargetCount > 0 ? (sphTotSum / laborTargetCount) : 0,
        dailySalesTargets: dailySalesTargets
    };
}
