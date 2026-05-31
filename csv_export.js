import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── HTML テンプレート ────────────────────────────────────────
export const csvExportPageHtml = `
<div class="animate-fade-in" style="max-width:800px; margin:0 auto;">
    <div style="display:flex; align-items:center; gap:0.8rem; margin-bottom:2rem;">
        <i class="fas fa-file-csv" style="color:var(--primary); font-size:1.4rem;"></i>
        <h2 style="margin:0; font-size:1.4rem;">CSV出力</h2>
    </div>

    <div class="glass-panel" style="padding:2rem;">
        <h3 style="margin:0 0 1.5rem; font-size:1.1rem; color:var(--text-secondary);">出力期間の設定</h3>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:2rem; background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
            <div class="input-group" style="margin:0;">
                <label style="font-weight: 700; color: #475569;">開始日</label>
                <input type="date" id="export-start-date" style="padding:0.7rem; background: white;">
            </div>
            <div class="input-group" style="margin:0;">
                <label style="font-weight: 700; color: #475569;">終了日</label>
                <input type="date" id="export-end-date" style="padding:0.7rem; background: white;">
            </div>
        </div>

        <h3 style="margin:0 0 1.2rem; font-size:1.1rem; color:var(--text-secondary);">出力フォーマットの選択</h3>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
            <!-- TKC形式 -->
            <div class="glass-panel" style="padding:1.5rem; background:white; display:flex; flex-direction:column; justify-content:space-between; border:1px solid var(--border); border-radius: 12px;">
                <div>
                    <h4 style="margin:0; font-size:1rem; display:flex; align-items:center; gap:0.5rem; color: #475569;">
                        <i class="fas fa-table" style="color:#64748b;"></i>
                        TKC形式
                    </h4>
                    <p style="margin:0.5rem 0 1.5rem; font-size:0.8rem; color:var(--text-secondary); line-height: 1.4;">
                        従業員コード、名前、総労働時間、深夜労働時間、出勤日数を出力します（TKC給与計算ソフト用）。
                    </p>
                </div>
                <button id="btn-export-tkc" class="btn" style="width:100%; padding:0.8rem; font-weight:700; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">
                    <i class="fas fa-download"></i> TKC形式で出力
                </button>
            </div>

            <!-- マネーフォワード形式 -->
            <div class="glass-panel" style="padding:1.5rem; background:white; display:flex; flex-direction:column; justify-content:space-between; border:2px solid #fcd34d; border-radius: 12px; position:relative; overflow:hidden;">
                <div style="position:absolute; top:0; right:0; background:#f59e0b; color:white; font-size:0.65rem; padding:0.2rem 0.8rem; font-weight:800; border-bottom-left-radius:8px;">RECOMMENDED</div>
                <div>
                    <h4 style="margin:0; font-size:1rem; display:flex; align-items:center; gap:0.5rem; color:#b45309;">
                        <i class="fas fa-cloud-upload-alt" style="color:#f59e0b;"></i>
                        マネーフォワード標準形式
                    </h4>
                    <p style="margin:0.5rem 0 1.5rem; font-size:0.8rem; color:var(--text-secondary); line-height: 1.4;">
                        マネーフォワード クラウド給与の標準インポート（Version 3）に合わせたコロン区切り時間表記のCSVを出力します。
                    </p>
                </div>
                <button id="btn-export-mf" class="btn btn-primary" style="width:100%; padding:0.8rem; font-weight:700; background:#f59e0b; border:none; color:white;">
                    <i class="fas fa-download"></i> MF標準形式で出力
                </button>
            </div>
        </div>
    </div>
</div>
`;

// ─── 初期化 ──────────────────────────────────────────────────
export async function initCsvExportPage() {
    const btnTkc = document.getElementById('btn-export-tkc');
    const btnMf = document.getElementById('btn-export-mf');
    const startInput = document.getElementById('export-start-date');
    const endInput = document.getElementById('export-end-date');

    // デフォルト期間（当月21日〜翌月20日っぽい指定が多いが、一旦直近1ヶ月）
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const today = new Date(now.getTime() + jstOffset).toISOString().substring(0, 10);
    const lastMonth = new Date(now.getTime() + jstOffset - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    
    startInput.value = lastMonth;
    endInput.value = today;

    if (btnTkc) {
        btnTkc.onclick = () => handleTkcExport(startInput.value, endInput.value);
    }
    if (btnMf) {
        btnMf.onclick = () => handleMfExport(startInput.value, endInput.value);
    }
}

// ─── TKC形式エクスポート ──────────────────────────────────────
async function handleTkcExport(startDate, endDate) {
    if (!startDate || !endDate) return alert('期間を選択してください。');
    
    // UI表示
    const btn = document.getElementById('btn-export-tkc');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 計算中...';

    try {
        // 1. ユーザーリスト取得（従業員コード紐付け用）
        const userSnap = await getDocs(collection(db, 'm_users'));
        const users = {};
        userSnap.forEach(d => {
            const data = d.data();
            const sid = data.EmployeeCode || d.id;
            users[sid] = {
                code: data.EmployeeCode || '-',
                name: data.Name || '-',
                store: data.Store || '-',
                status: data.Status || 'active',
                resignationDate: data.ResignationDate || '',
                hireDate: data.HireDate || ''
            };
        });

        // 2. 打刻データ取得（翌日分まで取得して夜勤に対応）
        const nextDay = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
        
        // 効率化のため、dateフィールドでフィルタ（インデックスが必要な場合はorderByを除く）
        const q = query(collection(db, 't_attendance'), 
            where('date', '>=', startDate),
            where('date', '<=', nextDay)
        );
        const punchSnap = await getDocs(q);
        const allPunches = [];
        punchSnap.forEach(d => allPunches.push(d.data()));
        
        // メモリ内でソート
        allPunches.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        // 3. 集計ロジック
        const results = processAttendance(users, allPunches, startDate, endDate);

        // 4. CSV生成・ダウンロード
        generateCSV(results, startDate, endDate);

    } catch (e) {
        console.error(e);
        alert('エラーが発生しました: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ─── 集計コアロジック ─────────────────────────────────────────
function processAttendance(users, allPunches, startDate, endDate) {
    const staffStats = {}; // { staff_id: { code, name, totalHours, lateHours, days: Set } }

    // 初期化
    Object.keys(users).forEach(sid => {
        const user = users[sid];
        const status = user.status;
        const resDate = user.resignationDate;

        // 1. 退職ステータスで、かつ退職日が指定期間の開始日（startDate）より前の場合は除外
        const isRetiredInPast = (status === 'retired' || status === '退職済' || status === 'resigning' || status === '退職手続き中') && 
                                resDate && resDate < startDate;

        // 2. 退職ステータスだが退職日が未設定の場合（例外パターン）の判定用
        const isRetiredWithoutDate = (status === 'retired' || status === '退職済') && !resDate;

        // 3. 入社予定日が指定期間の終了日（endDate）より後の場合は除外
        const isNotHiredYet = user.hireDate && user.hireDate > endDate;

        // 期間中の打刻データの有無をチェック（セーフティネット）
        const hasPunchesInPeriod = allPunches.some(p => p.staff_id === sid && p.date >= startDate && p.date <= endDate);

        // 過去に退職済み、または未来に入社予定で、かつこの期間中に打刻データもない場合は除外
        if (isRetiredInPast && !hasPunchesInPeriod) {
            return;
        }
        if (isRetiredWithoutDate && !hasPunchesInPeriod) {
            return;
        }
        if (isNotHiredYet && !hasPunchesInPeriod) {
            return;
        }

        staffStats[sid] = {
            code: user.code,
            name: user.name,
            totalHours: 0,
            lateHours: 0,
            days: new Set()
        };
    });

    // スタッフごとにグループ化
    const staffPunches = {};
    allPunches.forEach(p => {
        const sid = p.staff_id;
        if (!staffPunches[sid]) staffPunches[sid] = [];
        staffPunches[sid].push(p);
    });

    // 各スタッフの勤務セッションを計算
    for (const [sid, punches] of Object.entries(staffPunches)) {
        if (!staffStats[sid]) continue;

        let lastIn = null;
        let breakStart = null;
        let breakSessions = [];

        for (const p of punches) {
            const type = p.type;
            const time = new Date(p.timestamp);

            if (type === 'check_in') {
                // 開始日が期間外ならスキップ（session-based: 出勤日で判定）
                if (p.date < startDate || p.date > endDate) {
                    lastIn = null;
                    continue;
                }
                lastIn = time;
                breakSessions = [];
                staffStats[sid].days.add(p.date);
            } 
            else if (type === 'break_start' && lastIn) {
                breakStart = time;
            } 
            else if (type === 'break_end' && breakStart) {
                breakSessions.push({ start: breakStart, end: time });
                breakStart = null;
            } 
            else if (type === 'check_out' && lastIn) {
                const totalBreaks = breakSessions.reduce((sum, s) => sum + (s.end - s.start) / 3600000, 0);
                const totalShift = (time - lastIn) / 3600000;
                const netLabor = totalShift - totalBreaks;
                
                if (netLabor > 0) {
                    staffStats[sid].totalHours += netLabor;
                    // 深夜労働計算 (22:00 - 05:00)
                    // 1. 深夜時間枠との重複（休憩前）
                    const rawLate = calculateOverlapLateNightHours(lastIn, time);
                    // 2. 休憩時間のうち、深夜時間枠と重なっている部分
                    const lateBreaks = breakSessions.reduce((sum, s) => sum + calculateOverlapLateNightHours(s.start, s.end), 0);
                    
                    staffStats[sid].lateHours += Math.max(0, rawLate - lateBreaks);
                }
                lastIn = null;
                breakSessions = [];
            }
        }
    }

    return Object.values(staffStats);
}

// ─── 深夜労働計算 (22:00 〜 05:00 の重複を算出) ──────────────────
function calculateOverlapLateNightHours(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    if (s >= e) return 0;

    let totalLateMs = 0;

    // startの前日〜endの翌日までループして、深夜時間枠（22:00〜翌05:00）をすべてカバー
    const loopStart = new Date(s.getTime());
    loopStart.setDate(loopStart.getDate() - 1);
    const loopEnd = new Date(e.getTime());
    loopEnd.setDate(loopEnd.getDate() + 1);

    for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
        // d日の 22:00
        const l22 = new Date(d);
        l22.setHours(22, 0, 0, 0);

        // d+1日の 05:00
        const l05 = new Date(d);
        l05.setDate(l05.getDate() + 1);
        l05.setHours(5, 0, 0, 0);

        // 重なりを計算
        const overlapStart = s > l22 ? s : l22;
        const overlapEnd = e < l05 ? e : l05;

        if (overlapEnd > overlapStart) {
            totalLateMs += (overlapEnd - overlapStart);
        }
    }

    return totalLateMs / 3600000;
}

// 60進数時間変換用ヘルパー (例: 8.5時間 -> 8時間30分 -> "8.30")
function formatTo60Decimal(decimalHours) {
    let hours = Math.floor(decimalHours);
    let minutes = Math.round((decimalHours - hours) * 60);
    if (minutes === 60) {
        hours += 1;
        minutes = 0;
    }
    return `${hours}.${String(minutes).padStart(2, '0')}`;
}

// ─── CSV生成 ────────────────────────────────────────────────
function generateCSV(data, start, end) {
    // ヘッダー
    let csvContent = "\uFEFF"; // BOM for Excel
    csvContent += "従業員コード,名前,総労働時間,総労働時間（深夜）,出勤日数\n";

    data.forEach(row => {
        const line = [
            row.code,
            row.name,
            formatTo60Decimal(row.totalHours),
            formatTo60Decimal(row.lateHours),
            row.days.size
        ].join(",");
        csvContent += line + "\n";
    });

    const filename = `勤怠データ${start.replace(/-/g, '')}_${end.replace(/-/g, '')}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ─── マネーフォワード形式エクスポート ──────────────────────────────────
async function handleMfExport(startDate, endDate) {
    if (!startDate || !endDate) return alert('期間を選択してください。');
    
    // UI表示
    const btn = document.getElementById('btn-export-mf');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 計算中...';

    try {
        // 1. ユーザーリスト取得
        const userSnap = await getDocs(collection(db, 'm_users'));
        const users = {};
        userSnap.forEach(d => {
            const data = d.data();
            const sid = data.EmployeeCode || d.id;
            users[sid] = {
                code: data.EmployeeCode || '-',
                name: data.Name || '-',
                lastName: data.LastName || '',
                firstName: data.FirstName || '',
                store: data.Store || '-',
                status: data.Status || 'active',
                resignationDate: data.ResignationDate || '',
                hireDate: data.HireDate || ''
            };
        });

        // 2. 打刻データ取得（翌日分まで取得して夜勤に対応）
        const nextDay = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
        
        const q = query(collection(db, 't_attendance'), 
            where('date', '>=', startDate),
            where('date', '<=', nextDay)
        );
        const punchSnap = await getDocs(q);
        const allPunches = [];
        punchSnap.forEach(d => allPunches.push(d.data()));
        
        // メモリ内でソート
        allPunches.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        // 3. 集計ロジック（TKCと同じ共通のprocessAttendanceロジックを流用）
        const results = processAttendance(users, allPunches, startDate, endDate);

        // 4. 姓名未登録（警告バリデーション）のチェック
        const missingNameStaff = [];
        results.forEach(row => {
            // 総労働時間 > 0 または 出勤日数 > 0（＝実際に勤務した）スタッフが対象
            if (row.totalHours > 0 || row.days.size > 0) {
                let userObj = null;
                for (const u of Object.values(users)) {
                    if (u.code === row.code) {
                        userObj = u;
                        break;
                    }
                }

                if (!userObj || !userObj.lastName || !userObj.firstName) {
                    missingNameStaff.push(row.name);
                }
            }
        });

        if (missingNameStaff.length > 0) {
            // ダウンロードをブロックして警告アラート表示
            alert(`【出力エラー】\n以下のスタッフの「給与連携用の姓・名」が従業員マスタに登録されていません。\n給与計算の安全のため、ダウンロードを中止しました。\n\n対象スタッフ:\n・${missingNameStaff.join('\n・')}\n\n※従業員管理画面から該当スタッフの「姓」「名」を正しく登録してください。`);
            return;
        }

        // 5. マネーフォワード用CSV生成・ダウンロード
        generateMfCSV(results, users, startDate, endDate);

    } catch (e) {
        console.error(e);
        alert('エラーが発生しました: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// 小数時間をコロン区切り(60進数)に変換するヘルパー (例: 8.5 -> "8:30")
function formatToMfTime(decimalHours) {
    if (!decimalHours || decimalHours <= 0) return "0:00";
    let hours = Math.floor(decimalHours);
    let minutes = Math.round((decimalHours - hours) * 60);
    if (minutes === 60) {
        hours += 1;
        minutes = 0;
    }
    return `${hours}:${String(minutes).padStart(2, '0')}`;
}

// ─── マネーフォワード用CSV生成 ──────────────────────────────────
function generateMfCSV(data, users, start, end) {
    // 48項目のヘッダー定義
    const headers = [
        "Version", "従業員識別子", "従業員番号", "姓", "名", "事業所名", "部門名", "職種名", "契約種別",
        "1日の所定労働時間", "所定労働日数(当月)", "所定労働日数(月平均)", "所定労働時間(当月)", "所定労働時間(月平均)",
        "総労働時間", "深夜労働時間", "出勤日数", "役員報酬(月給)", "基本給(月給)", "役職手当(月給)",
        "固定残業手当(月給)", "深夜手当(月給)", "勤続手当(月給)", "職務手当（人事総務）(月給)", "通勤手当/課税(月給)",
        "通勤手当/非課(月給)", "立替経費(月給)", "基本給(時給)", "深夜手当(時給)", "通勤手当/課税(時給)",
        "通勤手当/非課(時給)", "職務手当（事務）(時給)", "職務手当（調理）(時給)", "基本給(日給)", "残業手当(日給)",
        "深夜残業手当(日給)", "法定休日手当(日給)", "所定休日手当(日給)", "通勤手当/課税(日給)", "通勤手当/非課(日給)",
        "健康保険料", "介護保険料", "子ども・子育て支援金", "厚生年金保険料", "雇用保険料", "所得税", "住民税", "備考欄"
    ];

    let csvContent = "\uFEFF"; // Excel用のBOM
    csvContent += headers.join(",") + "\r\n";

    data.forEach(row => {
        // 従業員コードからマスタのユーザー情報を逆引き
        let userObj = null;
        for (const u of Object.values(users)) {
            if (u.code === row.code) {
                userObj = u;
                break;
            }
        }

        const lastName = userObj ? userObj.lastName : "";
        const firstName = userObj ? userObj.firstName : "";

        // 各列の値を定義（48列）
        const rowData = Array(headers.length).fill("");
        
        rowData[0] = "3"; // Version
        rowData[1] = "";  // 従業員識別子 (空でOK)
        rowData[2] = row.code; // 従業員番号
        rowData[3] = lastName; // 姓
        rowData[4] = firstName; // 名
        // 5〜13列目は空欄
        rowData[14] = formatToMfTime(row.totalHours); // 総労働時間
        rowData[15] = formatToMfTime(row.lateHours);  // 深夜労働時間
        rowData[16] = String(row.days.size);          // 出勤日数
        // 17〜47列目はすべて空欄

        // CSVの各値をカンマ区切りにし、必要な場合のみダブルクォーテーションで囲む
        const csvLine = rowData.map(val => {
            const s = String(val);
            if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        }).join(",");

        csvContent += csvLine + "\r\n";
    });

    const filename = `MF給与連携データ_${start.replace(/-/g, '')}_${end.replace(/-/g, '')}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
