import { db } from './firebase.js';
import { collection, doc, setDoc, getDocs, orderBy, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
        total_sales:         ['total_sales', '売上金額', '販売金額(税込)'] // 計算で上書きするが、念のためマップ
    }
};

const ATTENDANCE_TYPE_MAP = {
    '出勤': 'check_in',
    '退勤': 'check_out',
    '休憩開始': 'break_start',
    '休憩終了': 'break_end',
    'check_in': 'check_in',
    'check_out': 'check_out',
    'break_start': 'break_start',
    'break_end': 'break_end'
};

const NUMERIC_FIELDS = ['amount', 'customer_count', 'cash_diff', 'total_labor_hours', 'late_night_labor_hours', 'attendance_days', 'seat_count', 'quantity_sold', 'unit_price', 'total_sales'];

function normalize(s) { return String(s).replace(/[\s\u3000]/g, '').toLowerCase(); }

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
    return Number(s.replace(/[^\d.-]/g, '')) || 0;
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
        logFn("CSVファイルを検出しました。読み込みを開始します...");
        const decoder = new TextDecoder('shift-jis');
        const text = decoder.decode(arrayBuffer);
        
        // Diniiフォーマットの簡易検知 (ヘッダーに'メニューID'または'商品コード'が含まれるか)
        if (text.includes('メニューID') || text.includes('商品コード') || text.includes('dinii')) {
            return await processDiniiCSV(text, file.name, logFn);
        }
        return await processCSV(text, file.name, logFn);
    } else {
        const workbook = XLSX.read(arrayBuffer);
        return await processExcelWorkbook(workbook, logFn);
    }
}

async function processExcelWorkbook(workbook, logFn) {
    const checkedSheets = workbook.SheetNames.filter(name => {
        const clean = normalize(name);
        return SCHEMA_MAP[clean] || clean === 'stores' || clean === 'm_stores';
    });

    if (checkedSheets.length === 0) {
        logFn("対象となるシートが見つかりませんでした。", 'red');
        return;
    }

    for (const sheetName of checkedSheets) {
        logFn(`[${sheetName}] 処理開始...`);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", blankrows: false });
        
        let colName = sheetName.trim();
        const cleanName = normalize(colName);
        if (cleanName === 'stores' || cleanName === 'm_stores' || cleanName === 'm_stores') colName = 'm_stores';
        else if (cleanName === 't_performance' || cleanName === 'performance') colName = 't_performance';
        else if (cleanName === 't_workinghours' || cleanName === 'workinghours' || cleanName === 't_attendance' || cleanName === 'attendance') colName = 't_attendance';
        const map = SCHEMA_MAP[colName];
        if (!map) continue;

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const finalData = {};
            Object.keys(map).forEach(key => {
                let val = getVal(row, map[key]);
                if (key === 'date') val = normalizeDate(val);
                if (['total_labor_hours', 'late_night_labor_hours'].includes(key)) val = parseTime(val);
                else if (NUMERIC_FIELDS.includes(key)) val = Number(String(val).replace(/[^\d.-]/g, '')) || 0;
                finalData[key] = val !== undefined ? val : "";
            });

            // 打刻タイプのマッピング（t_attendanceの場合）
            if (colName === 't_attendance' && finalData.type) {
                const mapped = ATTENDANCE_TYPE_MAP[finalData.type];
                if (mapped) finalData.type = mapped;
            }

            if (finalData.date) {
                finalData.year_month = finalData.date.substring(0, 7);
                const d = new Date(finalData.date);
                const days = ['日','月','火','水','木','金','土'];
                finalData.day_of_week = days[d.getDay()] || "";
            }

            let docId = null;
            if (colName === 't_performance' && finalData.date && finalData.store_id) docId = `${finalData.store_id}_${finalData.date}`;
            else if (colName === 'm_stores' && finalData.store_id) docId = String(finalData.store_id);

            const docRef = docId ? doc(db, colName, docId) : doc(collection(db, colName));
            await setDoc(docRef, finalData);
        }
        logFn(`[${sheetName}] 完了`, 'green');
    }
}

// 営業日の取得キャッシュ
const performanceCache = {};

async function getOperatingDates(storeId, yearMonth) {
    const cacheKey = `${storeId}_${yearMonth}`;
    if (performanceCache[cacheKey]) return performanceCache[cacheKey];

    const dates = [];
    try {
        const q = query(collection(db, "t_performance"), where("store_id", "==", storeId), where("year_month", "==", yearMonth));
        const snap = await getDocs(q);
        snap.forEach(d => {
            if (d.data().date) dates.push(d.data().date);
        });
    } catch (e) { console.error(e); }
    
    performanceCache[cacheKey] = dates.sort();
    return performanceCache[cacheKey];
}

async function processCSV(text, filename, logFn) {
    const rows = text.split(/\r?\n/).filter(line => line.trim() !== "").map(line => line.split(','));
    const headers = rows[0].map(h => h.trim().replace(/^"/, '').replace(/"$/, ''));
    const data = rows.slice(1).map(r => r.map(c => c.replace(/^"/, '').replace(/"$/, '')));

    const storeMapByName = {};
    const snap = await getDocs(collection(db, "m_stores"));
    snap.forEach(d => {
        const s = d.data();
        if (s.store_name) storeMapByName[normalize(s.store_name)] = d.data().store_id; // id フィールドではなく store_id を使う
    });

    let targetYM = "";
    const m = filename.match(/(\d{4})[-_]?(\d{2})/);
    if (m) targetYM = `${m[1]}-${m[2]}`;
    else targetYM = prompt(`[${filename}] の対象年月を yyyy-mm 形式で入力してください`, new Date().toISOString().substring(0, 7));
    if (!targetYM) return;

    logFn(`勤怠データの同期中（営業日への均等割り振りを実行します）...`);
    let count = 0;
    for (let i = 0; i < data.length; i++) {
        const rowArr = data[i];
        const rowObj = {};
        headers.forEach((h, idx) => rowObj[h] = rowArr[idx]);

        const 所属名 = getVal(rowObj, ['所属名', '店舗名', 'store_name']);
        const storeId = 所属名 ? storeMapByName[normalize(所属名)] : null;
        if (!storeId) continue;

        const totalH = parseTime(getVal(rowObj, ['総労働時間', 'total_labor_hours']));
        const midnightH = parseTime(getVal(rowObj, ['総労働時間（深夜）', 'late_night_labor_hours', '深夜労働時間']));
        const staffId = getVal(rowObj, ['従業員コード', 'staff_id']);
        const staffName = getVal(rowObj, ['名前', '氏名', 'staff_name']);
        
        // 営業日の取得
        const opDates = await getOperatingDates(storeId, targetYM);
        
        if (opDates.length > 0) {
            const dailyH = totalH / opDates.length;
            const dailyMidH = midnightH / opDates.length;
            
            for (const d of opDates) {
                const finalData = {
                    staff_id: staffId,
                    staff_name: staffName,
                    total_labor_hours: dailyH,
                    late_night_labor_hours: dailyMidH,
                    attendance_days: 1 / opDates.length, // 月間で計1日になるように按分
                    store_id: storeId,
                    date: d,
                    year_month: targetYM,
                    timestamp: `${d}T12:00:00Z` // ダミーのタイムスタンプ
                };
                const docId = `${storeId}_${staffId}_${d}`;
                await setDoc(doc(db, "t_attendance", docId), finalData);
            }
            count++;
        } else {
            // 営業日が見つからない場合は1日に全投入
            logFn(`[警告] ${所属名} の ${targetYM} の営業データが見つかりません。1日にまとめて登録します。`, 'orange');
            const d = `${targetYM}-01`;
            const finalData = {
                staff_id: staffId,
                staff_name: staffName,
                total_labor_hours: totalH,
                late_night_labor_hours: midnightH,
                attendance_days: 1,
                store_id: storeId,
                date: d,
                year_month: targetYM,
                timestamp: `${d}T12:00:00Z`
            };
            const docId = `${storeId}_${staffId}_${d}`;
            await setDoc(doc(db, "t_attendance", docId), finalData);
            count++;
        }
    }
    logFn(`[${filename}] 完了（${count} 名分のデータを処理しました）`, 'green');
}

/**
 * Dinii売上実績CSV専用のインポート処理
 */
async function processDiniiCSV(text, filename, logFn) {
    const rows = text.split(/\r?\n/).filter(line => line.trim() !== "").map(line => line.split(','));
    const headers = rows[0].map(h => h.trim().replace(/^"/, '').replace(/"$/, ''));
    const data = rows.slice(1).map(r => r.map(c => c.replace(/^"/, '').replace(/"$/, '')));

    const storeMapByName = {};
    const snap = await getDocs(collection(db, "m_stores"));
    snap.forEach(d => {
        const s = d.data();
        if (s.store_name) storeMapByName[normalize(s.store_name)] = d.data().store_id;
    });

    let targetYM = "";
    if (window._import_context?.yearMonth) {
        targetYM = window._import_context.yearMonth;
    } else {
        const m = filename.match(/(\d{4})[-_]?(\d{2})/);
        if (m) targetYM = `${m[1]}-${m[2]}`;
        else targetYM = prompt(`[${filename}] の対象年月を yyyy-mm 形式で入力してください`, new Date().toISOString().substring(0, 7));
    }
    if (!targetYM) return;

    let storeId = "";
    if (window._import_context?.storeId) {
        storeId = window._import_context.storeId;
    } else {
        storeId = prompt("インポート先の店舗IDを入力してください（例: S01）", "");
    }
    if (!storeId) return;

    logFn(`Dinii売上データのインポート中 (${targetYM})...`);
    let count = 0;
    const map = SCHEMA_MAP.t_monthly_sales;

    // 店舗の全メニューマスタを取得（Dinii連携用）
    const menusSnap = await getDocs(query(collection(db, "m_menus")));
    const menuItemsMap = {}; // dinii_id -> { docId, itemId, name, sales_price }
    menusSnap.forEach(d => {
        const m = d.data();
        if (m.dinii_id) menuItemsMap[m.dinii_id] = { docId: d.id, ...m };
    });

    for (let i = 0; i < data.length; i++) {
        const rowArr = data[i];
        const rowObj = {};
        headers.forEach((h, idx) => rowObj[h] = rowArr[idx]);

        const finalData = {
            store_id: storeId,
            year_month: targetYM,
            updated_at: new Date().toISOString()
        };

        Object.keys(map).forEach(key => {
            if (['store_id', 'year_month'].includes(key)) return;
            let val = getVal(rowObj, map[key]);
            if (NUMERIC_FIELDS.includes(key)) val = Number(String(val).replace(/[^\d.-]/g, '')) || 0;
            finalData[key] = val !== undefined ? val : "";
        });

        // チョイスID判定
        const choiceId = getVal(rowObj, map.choice_id);
        finalData.is_total = (!choiceId || choiceId === "");

        // 売上金額の再計算 (販売数 * 売価(税抜))
        finalData.total_sales = (finalData.quantity_sold || 0) * (finalData.unit_price || 0);

        if (!finalData.dinii_id && !finalData.menu_name) continue;

        // マスタ同期: Dinii ID が一致し、かつ合計行の場合のみ実行
        if (finalData.dinii_id && finalData.is_total && menuItemsMap[finalData.dinii_id]) {
            const master = menuItemsMap[finalData.dinii_id];
            // 名称または価格が異なる場合に更新
            if (master.name !== finalData.menu_name || master.sales_price !== finalData.unit_price) {
                await updateDoc(doc(db, "m_menus", master.docId), {
                    name: finalData.menu_name,
                    sales_price: finalData.unit_price,
                    updated_at: new Date().toISOString()
                });
                // 更新後、m_items 名も同期
                if (master.item_id) {
                    await updateDoc(doc(db, "m_items", master.item_id), {
                        name: finalData.menu_name,
                        updated_at: new Date().toISOString()
                    });
                }
            }
        }

        const docId = `${storeId}_${targetYM}_${finalData.dinii_id || 'no_id'}_${choiceId || 'main'}_${i}`;
        await setDoc(doc(db, "t_monthly_sales", docId), finalData);
        count++;
    }
    logFn(`[${filename}] 完了（${count} 品目の売上データをインポートしました）`, 'green');
}
