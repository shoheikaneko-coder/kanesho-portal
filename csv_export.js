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
        <h3 style="margin:0 0 1.5rem; font-size:1.1rem; color:var(--text-secondary);">出力データ選択</h3>
        
        <div style="display:flex; flex-direction:column; gap:1rem;">
            <!-- 勤怠データ（TKC形式） -->
            <div style="border:1px solid var(--border); border-radius:12px; padding:1.5rem; background:white;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <div>
                        <h4 style="margin:0; font-size:1rem;">勤怠データ（TKC形式）</h4>
                        <p style="margin:0.3rem 0 0; font-size:0.8rem; color:var(--text-secondary);">
                            従業員コード、名前、総労働時間、深夜労働時間、出勤日数を出力します。
                        </p>
                    </div>
                    <i class="fas fa-table" style="font-size:1.5rem; color:#e2e8f0;"></i>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                    <div class="input-group" style="margin:0;">
                        <label style="font-size:0.75rem;">開始日</label>
                        <input type="date" id="export-start-date" style="padding:0.7rem;">
                    </div>
                    <div class="input-group" style="margin:0;">
                        <label style="font-size:0.75rem;">終了日</label>
                        <input type="date" id="export-end-date" style="padding:0.7rem;">
                    </div>
                </div>

                <button id="btn-export-tkc" class="btn btn-primary" style="width:100%; padding:1rem; font-weight:700;">
                    <i class="fas fa-download"></i> CSVをダウンロード
                </button>
            </div>
            
            <!-- 他の形式が必要な場合はここに追加 -->
        </div>
    </div>
</div>
`;

// ─── 初期化 ──────────────────────────────────────────────────
export async function initCsvExportPage() {
    const btnTkc = document.getElementById('btn-export-tkc');
    const startInput = document.getElementById('export-start-date');
    const endInput = document.getElementById('export-end-date');

    // デフォルト期間（当月21日〜翌月20日っぽい指定が多いが、一旦直近1ヶ月）
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const today = new Date(now.getTime() + jstOffset).toISOString().substring(0, 10);
    const lastMonth = new Date(now.getTime() + jstOffset - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    
    startInput.value = lastMonth;
    endInput.value = today;

    btnTkc.onclick = () => handleTkcExport(startInput.value, endInput.value);
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
                store: data.Store || '-'
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
        staffStats[sid] = {
            code: users[sid].code,
            name: users[sid].name,
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
        let currentBreaks = 0;

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
                currentBreaks = 0;
                staffStats[sid].days.add(p.date);
            } 
            else if (type === 'break_start' && lastIn) {
                breakStart = time;
            } 
            else if (type === 'break_end' && breakStart) {
                currentBreaks += (time - breakStart) / 3600000;
                breakStart = null;
            } 
            else if (type === 'check_out' && lastIn) {
                const totalShift = (time - lastIn) / 3600000;
                const netLabor = totalShift - currentBreaks;
                
                if (netLabor > 0) {
                    staffStats[sid].totalHours += netLabor;
                    // 深夜労働計算 (22:00 - 05:00)
                    staffStats[sid].lateHours += calculateLateNightHours(lastIn, time, currentBreaks);
                }
                lastIn = null;
            }
        }
    }

    return Object.values(staffStats);
}

// ─── 深夜労働計算 (22:00 〜 05:00) ──────────────────────────
function calculateLateNightHours(start, end, totalBreaks) {
    let late = 0;
    const s = new Date(start);
    const e = new Date(end);

    // 22:00 のライン（開始日）
    const l22 = new Date(s);
    l22.setHours(22, 0, 0, 0);

    // 翌 05:00 のライン
    const l05 = new Date(s);
    l05.setDate(l05.getDate() + 1);
    l05.setHours(5, 0, 0, 0);

    // 勤務時間と深夜枠の重なりを計算
    const overlapStart = s > l22 ? s : l22;
    const overlapEnd = e < l05 ? e : l05;

    if (overlapEnd > overlapStart) {
        late = (overlapEnd - overlapStart) / 3600000;
        
        // 休憩時間の扱い：深夜時間中に休憩したか厳密に追うのは困難なため、
        // 労働時間に対する深夜の割合で按分するか、単純に差し引く。
        // ここでは単純に「深夜時間帯が勤務の大部分を占める場合は休憩を引く」等の簡略化が必要。
        // 今回は「深夜時間帯からも休憩時間を比例配分で引く」ロジックとする。
        const totalDuration = (e - s) / 3600000;
        if (totalDuration > 0) {
            const ratio = late / totalDuration;
            late -= (totalBreaks * ratio);
        }
    }

    return Math.max(0, late);
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
            row.totalHours.toFixed(2),
            row.lateHours.toFixed(2),
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
