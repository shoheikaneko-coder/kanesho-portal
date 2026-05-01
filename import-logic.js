import { db } from './firebase.js';
import { collection, doc, setDoc, getDocs, orderBy, query, where, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { processDiniiCSV as processDiniiMasterCSV } from './dinii_import.js';

const SCHEMA_MAP = {
    t_performance: {
        date:           ['date', 'Date', '日付'],
        amount:         ['amount', 'sales_inc_tax', 'Amount', '売上税込', '売上金額'],
        customer_count: ['customer_count', 'guests', 'CustomerCount', '客数', '来客数'],
        cash_diff:      ['cash_diff', 'CashDiff', '現金過不足'],
        store_id:       ['store_id', 'StoreID', '店舗 ID', '店舗ID'],
        store_name:     ['store_name', 'StoreName', '店舗名'],
        note:           ['note', 'notes', 'Note', '備考']
    },
    m_stores: {
        store_id:       ['store_id', 'StoreID', '店舗 ID', '店舗ID'],
        store_name:     ['store_name', 'StoreName', '店舗名'],
        store_type:     ['store_type', 'Type', '店舗タイプ'],
        group_name:     ['group_name', 'Group', 'グループ名', 'GroupName', '店舗グループ'],
        seat_count:     ['seat_count', '席数']
    },
    t_attendance: {
        attendance_id:       ['attendance_id', '勤怠ID'],
        date:                ['date', '日付'],
        timestamp:           ['timestamp', 'Timestamp', '打刻時刻'],
        staff_id:            ['staff_id', 'staff_code', 'UserId', 'user_id', '従業員コード'],
        staff_name:          ['staff_name', '名前'],
        store_id:            ['store_id', 'StoreID', '店舗ID'],
        store_name:          ['store_name', '所属名', '店舗名'],
        total_labor_hours:    ['total_labor_hours', '労働合計時間'],
        late_night_labor_hours: ['late_night_labor_hours', '深夜所定時間（打刻に基づく）'],
        attendance_days:     ['attendance_days', '出勤日数'],
        type:                ['type', 'Type', '区分']
    },
    t_monthly_sales: {
        store_id:            ['store_id', '店舗ID'],
        year_month:          ['year_month', '対象年月'],
        dinii_id:            ['dinii_id', 'メニューID', '商品コード'],
        menu_name:           ['menu_name', 'メニュー名称', '商品名'],
        choice_id:           ['choice_id', 'チョイスID'],
        choice_name:         ['choice_name', 'チョイス名称'],
        quantity_sold:       ['quantity_sold', '数量', '合計数量', '売上数量', '販売数'],
        unit_price:          ['unit_price', '売価(税抜)', '単価'],
        total_sales:         ['total_sales', '売上金額', '販売金額(税込)'], 
        tax_type:            ['tax_type', '消費税率区分']
    }
};

const ATTENDANCE_TYPE_MAP = {
    '出勤': 'check_in', '退勤': 'check_out', '休憩開始': 'break_start', '休憩終了': 'break_end'
};

const NUMERIC_FIELDS = ['amount', 'customer_count', 'cash_diff', 'total_labor_hours', 'late_night_labor_hours', 'attendance_days', 'seat_count', 'quantity_sold', 'unit_price', 'total_sales'];

function normalize(s) { return String(s || "").replace(/[\s\u3000]/g, '').toLowerCase(); }

function getVal(data, keys) {
    if (!data) return undefined;
    const dataKeys = Object.keys(data);
    for (const targetKey of keys) {
        const normTarget = normalize(targetKey);
        const found = dataKeys.find(k => normalize(k) === normTarget);
        if (found) return data[found];
    }
    return undefined;
}

function parseTime(val) {
    if (!val && val !== 0) return 0;
    if (typeof val === 'number') return val;
    const s = String(val).trim();
    if (s.includes(':')) {
        const parts = s.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        return h + (m / 60);
    }
    return Number(String(val).replace(/[^\d.-]/g, '')) || 0;
}

function normalizeDate(val) {
    if (!val && val !== 0) return '';
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        const d = new Date(Math.round((num - 25569) * 86400 * 1000));
        return d.toISOString().substring(0, 10);
    }
    let str = String(val).replace(/\//g, '-').replace(/\./g, '-');
    const parts = str.split('-');
    if (parts.length === 3) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return str;
}

export async function processFile(file, logFn) {
    const arrayBuffer = await file.arrayBuffer();
    if (file.name.endsWith('.csv')) {
        const decoder = new TextDecoder('shift-jis');
        const text = decoder.decode(arrayBuffer);
        if (text.includes('メニューID') || text.includes('商品コード') || text.includes('dinii')) {
            if (text.includes('数量') || text.includes('出数') || text.includes('売上金額') || text.includes('販売金額')) {
                return await processDiniiCSV(text, file.name, logFn);
            }
            return await processDiniiMasterCSV(text, file.name, logFn);
        }
        return await processCSV(text, file.name, logFn);
    } else {
        const workbook = XLSX.read(arrayBuffer);
        return await processExcelWorkbook(workbook, logFn);
    }
}

async function processExcelWorkbook(workbook, logFn) {
    for (const sheetName of workbook.SheetNames) {
        const clean = normalize(sheetName);
        if (!SCHEMA_MAP[clean] && clean !== 'stores' && clean !== 'm_stores') continue;
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", blankrows: false });
        let colName = (clean === 'stores' || clean === 'm_stores') ? 'm_stores' : clean;
        const map = SCHEMA_MAP[colName];
        for (const row of jsonData) {
            const finalData = {};
            Object.keys(map).forEach(k => {
                let v = getVal(row, map[k]);
                if (k === 'date') v = normalizeDate(v);
                else if (NUMERIC_FIELDS.includes(k)) v = Number(String(v || 0).replace(/[^\d.-]/g, '')) || 0;
                finalData[k] = v !== undefined ? v : "";
            });
            let docId = (colName === 't_performance' && finalData.date && finalData.store_id) ? `${finalData.store_id}_${finalData.date}` : (colName === 'm_stores' ? String(finalData.store_id) : null);
            await setDoc(docId ? doc(db, colName, docId) : doc(collection(db, colName)), finalData);
        }
    }
}

async function getOperatingDates(storeId, yearMonth) {
    const dates = [];
    const q = query(collection(db, "t_performance"), where("store_id", "==", storeId), where("year_month", "==", yearMonth));
    const snap = await getDocs(q);
    snap.forEach(d => { if (d.data().date) dates.push(d.data().date); });
    return dates.sort();
}

async function processCSV(text, filename, logFn) {
    const rows = text.split(/\r?\n/).filter(line => line.trim() !== "").map(line => line.split(','));
    const headers = rows[0].map(h => h.trim().replace(/^"/, '').replace(/"$/, ''));
    const data = rows.slice(1).map(r => r.map(c => c.replace(/^"/, '').replace(/"$/, '')));
    const storeMap = {};
    const snap = await getDocs(collection(db, "m_stores"));
    snap.forEach(d => { if (d.data().store_name) storeMap[normalize(d.data().store_name)] = d.data().store_id; });
    const m = filename.match(/(\d{4})[-_]?(\d{2})/);
    const targetYM = m ? `${m[1]}-${m[2]}` : prompt("yyyy-mm:", new Date().toISOString().substring(0, 7));
    if (!targetYM) return;
    for (const rowArr of data) {
        const rowObj = {}; headers.forEach((h, idx) => rowObj[h] = rowArr[idx]);
        const storeId = storeMap[normalize(getVal(rowObj, ['所属名', '店舗名']))];
        if (!storeId) continue;
        const totalH = parseTime(getVal(rowObj, ['総労働時間']));
        const staffId = getVal(rowObj, ['従業員コード']);
        const staffName = getVal(rowObj, ['名前']);
        const opDates = await getOperatingDates(storeId, targetYM);
        for (const d of opDates) {
            const finalData = { staff_id: staffId, staff_name: staffName, total_labor_hours: totalH / opDates.length, store_id: storeId, date: d, year_month: targetYM };
            await setDoc(doc(db, "t_attendance", `${storeId}_${staffId}_${d}`), finalData);
        }
    }
}

/**
 * Dinii売上実績CSV専用のインポート処理
 */
async function processDiniiCSV(text, filename, logFn) {
    const rows = text.split(/\r?\n/).filter(l => l.trim() !== "").map(l => l.split(','));
    const headers = rows[0].map(h => h.trim().replace(/^"/, '').replace(/"$/, ''));
    const data = rows.slice(1).map(r => r.map(c => c.replace(/^"/, '').replace(/"$/, '')));

    const storeMapByDiniiId = {};
    const storesSnap = await getDocs(collection(db, "m_stores"));
    storesSnap.forEach(d => {
        const s = d.data();
        if (s.dinii_store_id) storeMapByDiniiId[normalize(s.dinii_store_id)] = s.store_id || d.id;
    });

    const m = filename.match(/(\d{4})[-_]?(\d{2})/);
    const targetYM = window._import_context?.yearMonth || (m ? `${m[1]}-${m[2]}` : prompt("yyyy-mm:", new Date().toISOString().substring(0, 7)));
    if (!targetYM) return;

    const storeIdContext = window._import_context?.storeId || "";
    logFn(`Dinii売上データの集計中 (${targetYM})...`);
    
    const menusSnap = await getDocs(collection(db, "m_menus"));
    const menuItemsMap = {}; 
    menusSnap.forEach(d => { if (d.data().dinii_id) menuItemsMap[d.data().dinii_id] = { docId: d.id, ...d.data() }; });

    const menuGroups = {}; 
    const map = SCHEMA_MAP.t_monthly_sales;

    for (const rowArr of data) {
        if (rowArr.length < 2) continue;
        const rowObj = {}; headers.forEach((h, idx) => rowObj[h] = rowArr[idx]);

        const sid = storeMapByDiniiId[normalize(getVal(rowObj, ['店舗ID', '店舗 ID', 'StoreID']))] || storeIdContext;
        if (!sid) continue;

        const diniiId = getVal(rowObj, map.dinii_id);
        if (!diniiId) continue;

        // 【重要】カンマを除去してから数値化する
        const rawQty = getVal(rowObj, map.quantity_sold);
        const qty = parseFloat(String(rawQty || 0).replace(/[^\d.-]/g, '')) || 0;
        const choiceId = getVal(rowObj, map.choice_id);

        const finalData = { store_id: sid, year_month: targetYM, dinii_id: diniiId, updated_at: new Date().toISOString() };
        Object.keys(map).forEach(k => {
            if (['store_id', 'year_month', 'dinii_id'].includes(k)) return;
            let v = getVal(rowObj, map[k]);
            if (k === 'quantity_sold') v = qty;
            else if (NUMERIC_FIELDS.includes(k)) v = parseFloat(String(v || 0).replace(/[^\d.-]/g, '')) || 0;
            finalData[k] = v !== undefined ? v : "";
        });

        if (!finalData.total_sales) finalData.total_sales = (finalData.quantity_sold || 0) * (finalData.unit_price || 0);

        if (!menuGroups[diniiId]) menuGroups[diniiId] = { totalRow: null, maxQtyRow: null, maxQty: -1 };
        const entry = { data: finalData, choiceId: choiceId || 'main', qty: qty };

        if (!choiceId || choiceId === "" || choiceId === "null") {
            menuGroups[diniiId].totalRow = entry;
        } else {
            if (qty > menuGroups[diniiId].maxQty) {
                menuGroups[diniiId].maxQty = qty;
                menuGroups[diniiId].maxQtyRow = entry;
            }
        }
    }

    logFn(`データベースのクリーンアップと保存を開始します...`);
    let count = 0;
    for (const mId in menuGroups) {
        const group = menuGroups[mId];
        const winner = group.totalRow || group.maxQtyRow;
        if (winner) {
            winner.data.is_total = true;
            const fd = winner.data;

            // マスタ同期
            if (menuItemsMap[mId]) {
                const master = menuItemsMap[mId];
                if (master.name !== fd.menu_name || master.sales_price !== fd.unit_price) {
                    await updateDoc(doc(db, "m_menus", master.docId), { name: fd.menu_name, sales_price: fd.unit_price, updated_at: new Date().toISOString() });
                }
            }

            // 【重要】重複防止のためのクリーンアップ
            // このメニューIDに紐付く古い「合計行（is_total: true）」のデータをすべて削除する
            const oldDocsQ = query(collection(db, "t_monthly_sales"), 
                where("store_id", "==", fd.store_id), 
                where("year_month", "==", fd.year_month), 
                where("dinii_id", "==", mId),
                where("is_total", "==", true)
            );
            const oldDocsSnap = await getDocs(oldDocsQ);
            const batch = writeBatch(db);
            oldDocsSnap.forEach(d => batch.delete(d.ref));
            await batch.commit();

            // 新しいデータを固定IDで保存
            const docId = `${fd.store_id}_${fd.year_month}_${mId}_TOTAL`;
            await setDoc(doc(db, "t_monthly_sales", docId), fd);
            count++;
        }
    }
    logFn(`インポート完了（${count} 品目のデータを最新に更新しました）`, 'green');
}
