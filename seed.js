import { db } from './firebase.js';
import { collection, doc, setDoc, writeBatch, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 英語名 (snake_case) へのマッピング定義
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
        seat_count:     ['seat_count', '席数'],
        dinee_store_id: ['dinee_store_id', 'ダイニー店舗ID'],
        address:        ['address', '住所'],
        phone:          ['phone', '電話番号']
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

const NUMERIC_FIELDS = ['amount', 'customer_count', 'cash_diff', 'total_labor_hours', 'late_night_labor_hours', 'attendance_days', 'seat_count'];

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

function logInfo(msg, color = 'var(--text-primary)') {
    const logArea = document.getElementById('log-area');
    if (!logArea) return console.log(`[LOG] ${msg}`);
    const div = document.createElement('div');
    div.style.color = color;
    div.style.padding = '2px 0';
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logArea.appendChild(div);
    logArea.scrollTop = logArea.scrollHeight;
}

async function processExcel(file) {
    try {
        logInfo(`${file.name} を読み取り中...`);
        const arrayBuffer = await file.arrayBuffer();
        if (typeof XLSX === 'undefined') throw new Error("XLSXライブラリが未ロードです");

        if (file.name.endsWith('.csv')) {
            logInfo("CSVファイルを検出しました。Shift-JISで読み込みを開始します...");
            const decoder = new TextDecoder('shift-jis');
            const text = decoder.decode(arrayBuffer);
            await processCSV(text, file.name);
            return;
        }

        const workbook = XLSX.read(arrayBuffer);
        logInfo("Excelの解析に成功しました。");

        const sheetSelector = document.getElementById('sheet-selector-container');
        const importBtn = document.getElementById('import-btn');
        if (sheetSelector) sheetSelector.style.display = 'flex';
        if (importBtn) importBtn.style.display = 'block';

        const allSheets = workbook.SheetNames;
        logInfo(`検出されたシート: ${allSheets.join(', ')}`);
        sheetSelector.innerHTML = '<p style="width:100%; font-weight:bold; font-size:0.8rem; margin-bottom:0.5rem;">インポートするシートを選択:</p>';
        
        allSheets.forEach(sheetName => {
            const cleanName = normalize(sheetName);
            const label = document.createElement('label');
            label.className = 'sheet-option';
            label.style.display = 'block';
            label.style.padding = '0.5rem';
            const isTarget = SCHEMA_MAP[cleanName] !== undefined || cleanName === 'stores' || cleanName === 'm_stores';
            label.innerHTML = `<input type="checkbox" name="target-sheets" value="${sheetName}" ${isTarget ? 'checked' : ''}> ${sheetName}`;
            sheetSelector.appendChild(label);
        });

        importBtn.disabled = false;
        importBtn.onclick = async () => {
            try {
                const checkedSheets = Array.from(document.querySelectorAll('input[name="target-sheets"]:checked')).map(el => el.value);
                if (checkedSheets.length === 0) return alert("シートを選択してください");

                importBtn.disabled = true;
                logInfo("インポートを開始します...");

                for (const sheetName of checkedSheets) {
                    logInfo(`[${sheetName}] シートの同期を開始...`);
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", blankrows: false });
                    
                    if (jsonData.length === 0) {
                        logInfo(`[${sheetName}] 有効なデータ行がありません。`, 'var(--warning)');
                        continue;
                    }

                    let colName = sheetName.trim();
                    const cleanName = normalize(colName);
                    if (cleanName === 'stores' || cleanName === 'm_stores' || cleanName === 'm_stores') colName = 'm_stores';
                    else if (cleanName === 't_performance' || cleanName === 'performance') colName = 't_performance';
                    else if (cleanName === 't_workinghours' || cleanName === 'workinghours' || cleanName === 't_attendance' || cleanName === 'attendance') colName = 't_attendance';
                    const map = SCHEMA_MAP[colName];
                    if (!map) {
                        logInfo(`[${sheetName}] マッピング対象外のためスキップします。`);
                        continue;
                    }

                    logInfo(`[${sheetName}] 解析完了: ${jsonData.length} 件`);
                    logInfo(`[${sheetName}] 列名確認: ${Object.keys(jsonData[0]).join(', ')}`);

                    let count = 0;
                    for (let i = 0; i < jsonData.length; i++) {
                        try {
                            const row = jsonData[i];
                            const finalData = {};
                            Object.keys(map).forEach(key => {
                                let val = getVal(row, map[key]);
                                if (key === 'date') val = normalizeDate(val);
                                if (key === 'timestamp' && val) val = new Date(val).toISOString();
                                if (['total_labor_hours', 'late_night_labor_hours'].includes(key)) {
                                    val = parseTime(val);
                                } else if (NUMERIC_FIELDS.includes(key)) {
                                    val = Number(String(val).replace(/[^\d.-]/g, '')) || 0;
                                }
                                finalData[key] = val !== undefined ? val : "";
                            });

                            // 打刻タイプのマッピング
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
                            if (colName === 't_performance' && finalData.date && finalData.store_id) {
                                docId = `${finalData.store_id}_${finalData.date}`;
                            } else if (colName === 'm_stores' && finalData.store_id) {
                                docId = String(finalData.store_id);
                            }

                            const docRef = docId ? doc(db, colName, docId) : doc(collection(db, colName));
                            await setDoc(docRef, finalData);
                            count++;
                            
                            if (i % 20 === 0 || i === jsonData.length - 1) {
                                logInfo(`[${sheetName}] 同期中... ${i+1}/${jsonData.length}`);
                            }
                        } catch (err) { console.error(err); }
                    }
                    logInfo(`[${sheetName}] 同期成功: ${count} 件`, 'var(--secondary)');
                }
                logInfo("Excelの処理が完了しました！", 'var(--secondary)');
            } catch (err) {
                logInfo(`エラー: ${err.message}`, 'var(--danger)');
            } finally {
                importBtn.disabled = false;
            }
        };
    } catch (err) {
        logInfo(`解析エラー: ${err.message}`, 'var(--danger)');
    }
}

async function processCSV(text, filename) {
    try {
        const rows = text.split(/\r?\n/).filter(line => line.trim() !== "").map(line => line.split(','));
        if (rows.length < 2) throw new Error("CSVデータが足りません");

        const headers = rows[0].map(h => h.trim().replace(/^"/, '').replace(/"$/, ''));
        const data = rows.slice(1).map(r => r.map(c => c.replace(/^"/, '').replace(/"$/, '')));
        logInfo(`CSVヘッダー検出: ${headers.join(', ')}`);

        // 店舗マップ
        const storeMapByName = {};
        const snap = await getDocs(collection(db, "m_stores"));
        snap.forEach(d => {
            const s = d.data();
            if (s.store_name) storeMapByName[normalize(s.store_name)] = d.id;
        });

        // 日付判定
        let targetDate = "";
        const m = filename.match(/(\d{4})[-_]?(\d{2})/);
        if (m) {
            targetDate = `${m[1]}-${m[2]}`;
            logInfo(`日付を判定しました: ${targetDate}`);
        } else {
            targetDate = prompt(`[${filename}] の対象年月を yyyy-mm 形式で入力してください`, new Date().toISOString().substring(0, 7));
        }
        if (!targetDate) return;

        const storeSelector = document.getElementById('csv-store-selector');
        const defaultStoreId = storeSelector ? storeSelector.value : "";

        logInfo(`CSVデータ ${data.length} 件を同期中...`);
        let count = 0;
        for (let i = 0; i < data.length; i++) {
            try {
                const rowArr = data[i];
                const rowObj = {};
                headers.forEach((h, i) => rowObj[h] = rowArr[i]);

                const所属名 = getVal(rowObj, ['所属名', '店舗名', 'store_name']);
                let finalStoreId = (所属名 && storeMapByName[normalize(所属名)]) || defaultStoreId;

                if (!finalStoreId) continue;

                const finalData = {
                    staff_id:          getVal(rowObj, ['従業員コード', 'staff_id']),
                    staff_name:        getVal(rowObj, ['名前', '氏名', 'staff_name']),
                    total_labor_hours: parseTime(getVal(rowObj, ['総労働時間', 'total_labor_hours'])),
                    late_night_labor_hours: parseTime(getVal(rowObj, ['総労働時間（深夜）', 'late_night_labor_hours'])),
                    attendance_days:   Number(String(getVal(rowObj, ['出勤日数', 'attendance_days'])).replace(/[^\d.-]/g, '')) || 0,
                    store_id:          finalStoreId,
                    date:              targetDate + "-01",
                    year_month:        targetDate
                };

                const docId = `${finalStoreId}_${finalData.staff_id}_${finalData.year_month}`;
                await setDoc(doc(db, "t_attendance", docId), finalData);
                count++;
                if (i % 20 === 0 || i === data.length - 1) {
                    logInfo(`CSV同期中... ${i+1}/${data.length}`);
                }
            } catch (err) { console.error(err); }
        }
        logInfo(`[${filename}] 同期成功: ${count} 件`, 'var(--secondary)');
    } catch (err) {
        logInfo(`CSVエラー: ${err.message}`, 'var(--danger)');
    }
}

window.addEventListener('load', async () => {
    // 店舗リスト
    const storeSelector = document.getElementById('csv-store-selector');
    if (storeSelector) {
        try {
            const snap = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
            snap.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = `${d.id}: ${d.data().store_name || "店舗名なし"}`;
                storeSelector.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    }

    const input = document.getElementById('file-input');
    if (input) input.onchange = async (e) => {
        if (e.target.files.length > 0) {
            for (const file of e.target.files) {
                await processExcel(file);
            }
        }
    };
});
