import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert } from './ui_utils.js';

// ─── HTML テンプレート ────────────────────────────────────────
export const attendanceManagementPageHtml = `
<div id="attendance-mgmt-container" class="animate-fade-in">
    
    <!-- 1. トップハブ画面 -->
    <div id="attn-hub-view" class="view-section">
        <div style="margin-bottom: 2rem;">
            <p style="color: var(--text-secondary);">勤怠状況の確認・編集およびデータの出力を行います。</p>
        </div>

        <div class="menu-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;">
            <div class="glass-panel menu-card" onclick="window.switchAttnView('monthly')">
                <i class="fas fa-calendar-alt"></i>
                <h3>月別データ</h3>
                <p>従業員の月間集計を確認します</p>
            </div>
            <div class="glass-panel menu-card" style="opacity: 0.6; cursor: not-allowed;" title="現在開発中">
                <i class="fas fa-calendar-day"></i>
                <h3>日別データ</h3>
                <p>店舗ごとの日次実績を確認・編集します</p>
            </div>
            <div class="glass-panel menu-card" id="btn-attn-error-check">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>エラーチェック</h3>
                <p>打刻漏れや不整合を確認します (準備中)</p>
            </div>
            <div class="glass-panel menu-card" onclick="window.navigateTo('csv_export')">
                <i class="fas fa-file-export"></i>
                <h3>データ出力</h3>
                <p>外部給与ソフト用CSVを出力します</p>
            </div>
        </div>
    </div>

    <!-- 2. 月別実績画面 -->
    <div id="attn-monthly-view" class="view-section" style="display: none;">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
                <div class="input-group" style="margin-bottom: 0; min-width: 150px;">
                    <label>対象月</label>
                    <input type="month" id="attn-month-select" style="padding: 0.6rem;">
                </div>
                <div class="input-group" style="margin-bottom: 0; min-width: 180px;">
                    <label>店舗絞り込み</label>
                    <select id="attn-store-filter" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px;">
                        <option value="">全店舗</option>
                    </select>
                </div>
                <button id="btn-attn-monthly-refresh" class="btn btn-primary" style="padding: 0.65rem 1.5rem;">
                    <i class="fas fa-search"></i> 表示
                </button>
                <button onclick="window.switchAttnView('hub')" class="btn" style="padding: 0.65rem 1.2rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1px solid var(--border); color: var(--text-secondary);">
                            <th style="padding: 1rem;">コード</th>
                            <th style="padding: 1rem;">名前</th>
                            <th style="padding: 1rem;">所属店舗</th>
                            <th style="padding: 1rem; text-align: right;">出勤日数</th>
                            <th style="padding: 1rem; text-align: right;">総労働時間</th>
                            <th style="padding: 1rem; text-align: right;">深夜時間</th>
                            <th style="padding: 1rem; text-align: center;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="attn-monthly-body">
                        <!-- JSで描画 -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

</div>

<style>
    #attendance-mgmt-container .menu-card {
        padding: 2.5rem 1.5rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid var(--border);
    }
    #attendance-mgmt-container .menu-card:hover:not([style*="not-allowed"]) {
        transform: translateY(-8px);
        border-color: var(--primary);
        box-shadow: 0 12px 30px -10px rgba(230, 57, 70, 0.2);
    }
    #attendance-mgmt-container .menu-card i {
        font-size: 3rem;
        margin-bottom: 1.5rem;
        color: var(--primary);
    }
    #attendance-mgmt-container .menu-card h3 {
        font-size: 1.25rem;
        margin-bottom: 0.5rem;
    }
    #attendance-mgmt-container .menu-card p {
        font-size: 0.85rem;
        opacity: 0.8;
    }
    
    #attn-monthly-body tr {
        border-bottom: 1px solid #f1f5f9;
        transition: background 0.2s;
    }
    #attn-monthly-body tr:hover {
        background: #fdf2f2;
    }
    #attn-monthly-body td {
        padding: 1rem;
    }
</style>
`;

// ─── 状態 ────────────────────────────────────────────────────
let cachedStores = [];

// ─── 初期化 ──────────────────────────────────────────────────
export async function initAttendanceManagementPage() {
    // グローバル関数として公開（テンプレートから呼ぶため）
    window.switchAttnView = switchView;

    // 店舗リストの読み込み
    await loadStoreList();

    // デフォルト日付セット
    const monthInput = document.getElementById('attn-month-select');
    if (monthInput) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // イベントリスナー
    const btnRefresh = document.getElementById('btn-attn-monthly-refresh');
    if (btnRefresh) {
        btnRefresh.onclick = () => loadMonthlyData();
    }

    const btnError = document.getElementById('btn-attn-error-check');
    if (btnError) {
        btnError.onclick = () => showAlert('情報', 'エラーチェック機能は現在準備中です。');
    }

    // 最初にトップ画面を表示
    switchView('hub');
}

// ─── 表示切り替え ──────────────────────────────────────────
function switchView(viewName) {
    const hub = document.getElementById('attn-hub-view');
    const monthly = document.getElementById('attn-monthly-view');
    if (!hub || !monthly) return;

    if (viewName === 'hub') {
        hub.style.display = 'block';
        monthly.style.display = 'none';
        // パンくずのタイトル等を調整（app.js側が面倒を見てくれるが、必要ならここでも）
    } else if (viewName === 'monthly') {
        hub.style.display = 'none';
        monthly.style.display = 'block';
        loadMonthlyData(); // 遷移時に自動読み込み
    }
}

// ─── データ読み込み系 ──────────────────────────────────────
async function loadStoreList() {
    const selector = document.getElementById('attn-store-filter');
    if (!selector) return;

    try {
        const snap = await getDocs(collection(db, "m_stores"));
        cachedStores = [];
        selector.innerHTML = '<option value="">全店舗</option>';
        
        snap.forEach(d => {
            const data = d.data();
            const sName = data.store_name || '名称未設定';
            cachedStores.push({ id: d.id, name: sName });
            
            const opt = document.createElement('option');
            opt.value = sName;
            opt.textContent = sName;
            selector.appendChild(opt);
        });
    } catch (e) {
        console.error("Failed to load stores:", e);
    }
}

async function loadMonthlyData() {
    const month = document.getElementById('attn-month-select')?.value;
    const storeName = document.getElementById('attn-store-filter')?.value;
    const body = document.getElementById('attn-monthly-body');
    if (!body) return;

    if (!month) return showAlert('通知', '対象月を選択してください。');

    body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary);"></i><br><br>集計中...</td></tr>';

    try {
        // 1. ユーザーリスト取得
        const userSnap = await getDocs(collection(db, 'm_users'));
        const staffMap = {};
        userSnap.forEach(d => {
            const data = d.data();
            const sid = data.EmployeeCode || d.id;
            staffMap[sid] = {
                id: d.id,
                code: data.EmployeeCode || '-',
                name: data.Name || '-',
                store: data.Store || '-'
            };
        });

        // 2. 打刻データ取得 (対象月)
        const q = query(collection(db, 't_attendance'), where('year_month', '==', month));
        const punchSnap = await getDocs(q);
        const allPunches = [];
        punchSnap.forEach(d => allPunches.push(d.data()));
        allPunches.sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        // 3. 集計処理
        const staffStats = processSummaryAttendance(staffMap, allPunches);

        // 4. フィルタリング (店舗)
        let filtered = Object.values(staffStats);
        if (storeName) {
            filtered = filtered.filter(s => s.store === storeName);
        }

        // 5. 描画
        body.innerHTML = '';
        if (filtered.length === 0) {
            body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-secondary);">該当するデータはありませんでした。</td></tr>';
            return;
        }

        filtered.sort((a,b) => (a.code || '').localeCompare(b.code || '')).forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family: monospace;">${s.code}</td>
                <td style="font-weight: 600;">${s.name}</td>
                <td style="color: var(--text-secondary); font-size: 0.85rem;">${s.store}</td>
                <td style="text-align: right;">${s.days.size}日</td>
                <td style="text-align: right; font-weight: 700;">${s.totalHours.toFixed(1)}h</td>
                <td style="text-align: right; color: var(--primary);">${s.lateHours.toFixed(1)}h</td>
                <td style="text-align: center;">
                    <button class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: #e2e8f0; color: #475569;" onclick="window.showAlert('通知', '詳細編集機能（日別データ）は次フェーズで実装予定です。')">
                        <i class="fas fa-edit"></i> 詳細
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });

    } catch (e) {
        console.error("Monthly load error:", e);
        body.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--danger);">集計エラー: ${e.message}</td></tr>`;
    }
}

// ─── 集計ロジック (csv_export.js から援用) ───────────────────
function processSummaryAttendance(staffMap, punches) {
    const stats = {};
    
    // 初期化
    Object.keys(staffMap).forEach(sid => {
        stats[sid] = {
            ...staffMap[sid],
            totalHours: 0,
            lateHours: 0,
            days: new Set()
        };
    });

    const staffGroup = {};
    punches.forEach(p => {
        const sid = p.staff_id;
        if (!staffGroup[sid]) staffGroup[sid] = [];
        staffGroup[sid].push(p);
    });

    for (const [sid, recs] of Object.entries(staffGroup)) {
        if (!stats[sid]) continue;

        let lastIn = null;
        let breakStart = null;
        let currentBreaks = 0;

        recs.forEach(p => {
            const type = p.type;
            const time = new Date(p.timestamp);

            if (type === 'check_in') {
                lastIn = time;
                currentBreaks = 0;
                stats[sid].days.add(p.date || p.timestamp.substring(0, 10));
            } else if (type === 'break_start' && lastIn) {
                breakStart = time;
            } else if (type === 'break_end' && breakStart) {
                currentBreaks += (time - breakStart) / 3600000;
                breakStart = null;
            } else if (type === 'check_out' && lastIn) {
                const totalShift = (time - lastIn) / 3600000;
                const netLabor = totalShift - currentBreaks;
                if (netLabor > 0) {
                    stats[sid].totalHours += netLabor;
                    stats[sid].lateHours += calculateLateNight(lastIn, time, currentBreaks);
                }
                lastIn = null;
            }
        });
    }

    return stats;
}

function calculateLateNight(start, end, totalBreaks) {
    let late = 0;
    const s = new Date(start);
    const e = new Date(end);

    const l22 = new Date(s);
    l22.setHours(22, 0, 0, 0);

    const l05 = new Date(s);
    l05.setDate(l05.getDate() + 1);
    l05.setHours(5, 0, 0, 0);

    const overlapStart = s > l22 ? s : l22;
    const overlapEnd = e < l05 ? e : l05;

    if (overlapEnd > overlapStart) {
        late = (overlapEnd - overlapStart) / 3600000;
        const totalDuration = (e - s) / 3600000;
        if (totalDuration > 0) {
            const ratio = late / totalDuration;
            late -= (totalBreaks * ratio);
        }
    }
    return Math.max(0, late);
}
