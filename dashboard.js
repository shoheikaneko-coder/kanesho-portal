import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const dashboardPageHtml = `
        <!-- フィルターバー -->
        <div class="glass-panel" style="padding: 1.2rem 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 130px;">
                    <label style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">開始日</label>
                    <input type="date" id="dash-date-from" style="padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 130px;">
                    <label style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">終了日</label>
                    <input type="date" id="dash-date-to" style="padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 130px;">
                    <label style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">店舗</label>
                    <select id="dash-store-filter" style="padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem;">
                        <option value="all">全店舗</option>
                    </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 130px;">
                    <label style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">グループ</label>
                    <select id="dash-group-filter" style="padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem;">
                        <option value="all">全社</option>
                    </select>
                </div>
                <button id="dash-apply-btn" class="btn btn-primary" style="padding: 0.5rem 1.2rem; font-size: 0.9rem; white-space: nowrap; height: 38px;">
                    <i class="fas fa-search"></i> 表示
                </button>
            </div>
        </div>

        <!-- タブナビゲーション -->
        <div class="dash-tabs-container">
            <button class="dash-tab-btn active" data-tab="tab-summary"><i class="fas fa-chart-pie"></i> サマリー</button>
            <button class="dash-tab-btn" data-tab="tab-daily"><i class="fas fa-list"></i> 日別詳細レポート</button>
            <button class="dash-tab-btn" data-tab="tab-monthly"><i class="fas fa-table"></i> 店舗別・月別集計</button>
            <button class="dash-tab-btn" data-tab="tab-analytics"><i class="fas fa-chart-bar"></i> 多角分析</button>
        </div>

        <!-- コンテンツエリア -->
        <div id="dash-contents-area" style="position: relative;">
            <div id="dash-loading-overlay" style="display: none; position: absolute; inset: 0; background: rgba(255,255,255,0.7); z-index: 10; align-items: center; justify-content: center; backdrop-filter: blur(2px); border-radius: 12px;">
                <div style="text-align: center; color: var(--primary);">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <div style="font-weight: 800; margin-top: 0.5rem;">集計中...</div>
                </div>
            </div>

            <!-- タブ1: サマリー -->
            <div id="tab-summary" class="dash-tab-content active">
                <div class="dashboard-kpi-grid" style="gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="glass-panel kpi-card" style="border-top:4px solid var(--primary);">
                        <div class="kpi-label"><i class="fas fa-yen-sign"></i> 売上合計(税抜)</div>
                        <div class="kpi-rate" id="kpi-sales-rate">¥---</div>
                        <div class="kpi-rate-bar-wrap"><div class="kpi-rate-bar" id="kpi-sales-bar" style="background:var(--primary); width:100%;"></div></div>
                        <div class="kpi-row">
                            <div><div class="kpi-sub-label">税込実績</div><div class="kpi-val" id="kpi-sales-actual">¥---</div></div>
                            <div style="text-align:right;"><div class="kpi-sub-label">目標</div><div class="kpi-val kpi-val-muted">未設定</div></div>
                        </div>
                    </div>
                    <div class="glass-panel kpi-card" style="border-top:4px solid var(--secondary);">
                        <div class="kpi-label"><i class="fas fa-users"></i> 客数</div>
                        <div class="kpi-rate" id="kpi-cust-rate" style="color:var(--secondary);">---名</div>
                        <div class="kpi-rate-bar-wrap"><div class="kpi-rate-bar" id="kpi-cust-bar" style="background:var(--secondary); width:100%;"></div></div>
                        <div class="kpi-row">
                            <div><div class="kpi-sub-label">実績</div><div class="kpi-val" id="kpi-cust-actual">---名</div></div>
                            <div style="text-align:right;"><div class="kpi-sub-label">目標</div><div class="kpi-val kpi-val-muted">未設定</div></div>
                        </div>
                    </div>
                    <div class="glass-panel kpi-card" style="border-top:4px solid var(--warning);">
                        <div class="kpi-label"><i class="fas fa-clock"></i> 営業人時売上</div>
                        <div class="kpi-rate" id="kpi-ophour-rate" style="color:var(--warning);">¥---</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.6rem;">売上税抜 ÷ 営業労働h</div>
                        <div class="kpi-row">
                            <div><div class="kpi-sub-label">実績</div><div class="kpi-val" id="kpi-ophour-actual">¥---</div></div>
                            <div style="text-align:right;"><div class="kpi-sub-label">労働合計</div><div class="kpi-val kpi-val-muted" id="kpi-ophour-target">---h</div></div>
                        </div>
                    </div>
                    <div class="glass-panel kpi-card" style="border-top:4px solid #8B5CF6;">
                        <div class="kpi-label"><i class="fas fa-building"></i> 総人時売上</div>
                        <div class="kpi-rate" id="kpi-totalhour-rate" style="color:#8B5CF6;">¥---</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.6rem;">売上税抜 ÷ (営業+CK按分h)</div>
                        <div class="kpi-row">
                            <div><div class="kpi-sub-label">実績</div><div class="kpi-val" id="kpi-totalhour-actual">¥---</div></div>
                            <div style="text-align:right;"><div class="kpi-sub-label">総労働h</div><div class="kpi-val kpi-val-muted" id="kpi-totalhour-target">---h</div></div>
                        </div>
                    </div>
                </div>

                <div class="glass-panel" style="padding: 1.5rem;">
                    <h3 style="font-size: 1.1rem; margin: 0 0 1rem; color: var(--text-primary);"><i class="fas fa-chart-area" style="color: var(--primary);"></i> 売上・効率 日別推移</h3>
                    <div style="position: relative; height: 350px; width: 100%;">
                        <canvas id="chart-summary-trend"></canvas>
                    </div>
                </div>
            </div>

            <!-- タブ2: 日別詳細レポート -->
            <div id="tab-daily" class="dash-tab-content" style="display: none;">
                <div class="glass-panel" style="padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <h3 style="font-size: 1.1rem; margin: 0; color: var(--text-primary);"><i class="fas fa-list" style="color: var(--secondary);"></i> 日別詳細レポート</h3>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">
                            <span style="display: inline-block; width: 12px; height: 12px; background: #fffde7; border: 1px solid #fde047; margin-right: 4px;"></span>効率異常アラート
                        </div>
                    </div>
                    <div class="dash-table-wrapper">
                        <table class="dash-data-table">
                            <thead>
                                <tr>
                                    <th>日付</th>
                                    <th>曜日</th>
                                    <th>天気１・２</th>
                                    <th style="text-align: right;">売上(税抜)</th>
                                    <th style="text-align: right;">客数</th>
                                    <th style="text-align: right;">客単価</th>
                                    <th style="text-align: right;">営業人時売上</th>
                                    <th style="text-align: right;">総人時売上</th>
                                    <th style="text-align: right;">現金過不足</th>
                                    <th style="text-align: right;">営業労働h</th>
                                    <th style="text-align: right;">CK按分h</th>
                                    <th>備考</th>
                                    <th style="text-align: right;">小口支払</th>
                                </tr>
                            </thead>
                            <tbody id="daily-table-body">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- タブ3: 店舗別・月別集計 -->
            <div id="tab-monthly" class="dash-tab-content" style="display: none;">
                <div class="glass-panel" style="padding: 1.5rem;">
                    <h3 style="font-size: 1.1rem; margin: 0 0 1rem; color: var(--text-primary);"><i class="fas fa-table" style="color: #8B5CF6;"></i> 店舗別・月別集計</h3>
                    <div class="dash-table-wrapper">
                        <table class="dash-data-table">
                            <thead>
                                <tr>
                                    <th>年月</th>
                                    <th style="text-align: center;">営業日数</th>
                                    <th style="text-align: right;">売上(税抜)</th>
                                    <th style="text-align: right;">来客数</th>
                                    <th style="text-align: right;">客単価</th>
                                    <th style="text-align: right;">現金過不足計</th>
                                    <th style="text-align: right;">売上平均(税抜)</th>
                                    <th style="text-align: right;">来客平均</th>
                                    <th style="text-align: right;">営業人時売上</th>
                                    <th style="text-align: right;">総人時売上</th>
                                    <th style="text-align: right;">営業労働h</th>
                                    <th style="text-align: right;">CK按分h</th>
                                </tr>
                            </thead>
                            <tbody id="monthly-pivot-body">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- タブ4: 多角分析 -->
            <div id="tab-analytics" class="dash-tab-content" style="display: none;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 1.5rem;">
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 style="font-size: 1.1rem; margin: 0 0 1rem; color: var(--text-primary);"><i class="fas fa-calendar-day" style="color: var(--primary);"></i> 曜日別 平均比較</h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="chart-dow"></canvas>
                        </div>
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 style="font-size: 1.1rem; margin: 0 0 1rem; color: var(--text-primary);"><i class="fas fa-cloud-sun-rain" style="color: var(--secondary);"></i> 天候別 平均比較</h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="chart-weather"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- モーダル -->
        <div id="drilldown-modal" class="modal-overlay">
            <div class="modal-content-box animate-scale-in" style="max-width: 800px;">
                <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <h4 id="drilldown-modal-title" style="margin: 0; color: var(--text-primary); font-size: 1.1rem;"></h4>
                    <button class="btn btn-close" onclick="closeDrilldown()"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding: 1.5rem; overflow-y: auto; flex: 1;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); color: var(--text-secondary);">
                                <th style="padding: 0.8rem;">日付</th>
                                <th style="padding: 0.8rem;">曜日</th>
                                <th style="padding: 0.8rem; text-align: right;">金額</th>
                                <th style="padding: 0.8rem; text-align: right;">客数</th>
                                <th style="padding: 0.8rem; text-align: right;">過不足</th>
                            </tr>
                        </thead>
                        <tbody id="drilldown-modal-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
`;

window.closeDrilldown = () => {
    const modal = document.getElementById('drilldown-modal');
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
};

function injectStyles() {
    if (document.getElementById('dash-fix-styles')) return;
    const style = document.createElement('style');
    style.id = 'dash-fix-styles';
    style.textContent = `
        /* KPI Cards */
        .kpi-card { padding: 1.4rem; transition: transform 0.2s; }
        .kpi-card:hover { transform: translateY(-2px); }
        .kpi-label { font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.4rem; }
        .kpi-rate { font-size: 1.8rem; font-weight: 800; color: var(--primary); }
        .kpi-rate-bar-wrap { width: 100%; height: 6px; background: rgba(0,0,0,0.07); border-radius: 3px; margin: 0.6rem 0 0.8rem; overflow:hidden; position:relative; }
        .kpi-rate-bar { height: 100%; transition: width 0.8s; }
        .kpi-row { display: flex; justify-content: space-between; }
        .kpi-sub-label { font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; }
        .kpi-val { font-size: 1rem; font-weight: 700; font-family: monospace; }
        .kpi-val-muted { color: var(--text-secondary); font-weight: 500; }
        .kpi-target-marker { position: absolute; top: 0; width: 2px; height: 100%; background: #1e293b; z-index: 2; box-shadow: 0 0 4px rgba(255,255,255,0.8); transition: left 0.5s; }
        .dashboard-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 1000px) { .dashboard-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .dashboard-kpi-grid { grid-template-columns: 1fr; } }
        
        /* Tabs */
        .dash-tabs-container { display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem; overflow-x: auto; scrollbar-width: none; }
        .dash-tabs-container::-webkit-scrollbar { display: none; }
        .dash-tab-btn { background: none; border: none; padding: 0.8rem 1.2rem; font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: 0.2s; white-space: nowrap; }
        .dash-tab-btn:hover { color: var(--primary); }
        .dash-tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
        
        /* Data Tables */
        .dash-table-wrapper { overflow-x: auto; max-height: 600px; }
        .dash-data-table { width: 100%; min-width: 1200px; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .dash-data-table th { padding: 0.8rem; border-bottom: 2px solid var(--border); color: var(--text-secondary); position: sticky; top: 0; background: #fff; z-index: 1; font-weight: 700; }
        .dash-data-table td { padding: 0.7rem 0.8rem; border-bottom: 1px solid var(--border); }
        .dash-data-table tbody tr:hover { background: #f8fafc; }
        .row-weekend { background-color: #fafafa; }
        .row-alert { background-color: #fffde7; }
        .val-red { color: var(--danger); font-weight: 700; }
        .val-muted { color: var(--text-secondary); }
    `;
    document.head.appendChild(style);
}

const TAX_RATE = 1.1;

export async function initDashboardPage() {
    injectStyles();
    const now = new Date();
    document.getElementById('dash-date-from').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    document.getElementById('dash-date-to').value = now.toISOString().substring(0, 10);

    // タブ切り替え設定
    const tabBtns = document.querySelectorAll('.dash-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.dash-tab-content').forEach(c => c.style.display = 'none');
            
            const targetTab = e.currentTarget.getAttribute('data-tab');
            e.currentTarget.classList.add('active');
            document.getElementById(targetTab).style.display = 'block';
        });
    });

    await loadFilterOptions();
    await refreshDashboard();
    
    document.getElementById('dash-apply-btn').onclick = refreshDashboard;
}

async function loadPersonalDashboard() {
    const section = document.getElementById('dash-personal-section');
    const label = document.getElementById('personal-info-label');
    const value = document.getElementById('personal-info-value');
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || !section) return;

    section.style.display = 'block';
    const isAdmin = user.Role === 'Admin' || user.Role === '管理者';

    try {
        if (isAdmin) {
            label.textContent = "本日の店舗状況";
            const today = new Date().toISOString().split('T')[0];
            const sid = user.StoreID || user.StoreId;
            // 本日のシフト人数をカウント
            const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            let q = query(collection(db, "t_shifts"), where("date", "==", today), where("status", "==", "confirmed"));
            const snap = await getDocs(q);
            let count = 0;
            snap.forEach(d => {
                if (!sid || d.data().storeId == sid) count++;
            });
            value.textContent = `本日(${today}) は ${count} 名が出勤予定です`;
        } else {
            label.textContent = "次回の出勤予定";
            const today = new Date().toISOString().split('T')[0];
            const nextMonth = new Date();
            nextMonth.setDate(nextMonth.getDate() + 35);
            const eDate = nextMonth.toISOString().split('T')[0];

            const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            // インデックス不要の検索 (日付範囲のみで取得)
            const q = query(
                collection(db, "t_shifts"), 
                where("date", ">=", today), 
                where("date", "<=", eDate)
            );
            const snap = await getDocs(q);
            
            let matchedShifts = [];
            snap.forEach(d => {
                const s = d.data();
                if (s.userId === user.id && s.status === 'confirmed') {
                    matchedShifts.push(s);
                }
            });

            if (matchedShifts.length > 0) {
                // 日付順にソートして一番近いものを取得
                matchedShifts.sort((a,b) => a.date.localeCompare(b.date));
                const s = matchedShifts[0];
                const d = new Date(s.date);
                const dow = ['日','月','火','水','木','金','土'][d.getDay()];
                value.textContent = `${s.date}(${dow})  ${s.start} 〜 ${s.end}`;
            } else {
                value.textContent = "確定済みの出勤予定はありません";
            }
        }
    } catch (e) {
        console.error("Personal dashboard load error:", e);
        value.textContent = "情報の取得に失敗しました";
    }
}

async function loadFilterOptions() {
    const sSel = document.getElementById('dash-store-filter');
    const gSel = document.getElementById('dash-group-filter');
    try {
        const snap = await getDocs(collection(db, "m_stores"));
        const groups = new Set();
        sSel.innerHTML = '<option value="all">全店舗</option>';
        snap.forEach(doc => {
            const d = doc.data();
            if (d.store_type !== 'CK') {
                const opt = document.createElement('option');
                opt.value = d.store_id; opt.textContent = d.store_name;
                sSel.appendChild(opt);
            }
            if (d.group_name) groups.add(d.group_name);
        });
        gSel.innerHTML = '<option value="all">全社</option>';
        Array.from(groups).sort().forEach(g => {
            const opt = document.createElement('option');
            opt.value = g; opt.textContent = g;
            gSel.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function refreshDashboard() {
    const dateFrom    = document.getElementById('dash-date-from').value;
    const dateTo      = document.getElementById('dash-date-to').value;
    const storeFilter = document.getElementById('dash-store-filter').value;
    const groupFilter = document.getElementById('dash-group-filter').value;

    const dtbody = document.getElementById('daily-table-body');
    const mtbody = document.getElementById('monthly-pivot-body');
    const loadingOverlay = document.getElementById('dash-loading-overlay');
    
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (dtbody) dtbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:2rem;">集計中...</td></tr>';
    if (mtbody) mtbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:2rem;">集計中...</td></tr>';

    try {
        const storeMap = {};
        const sSnap = await getDocs(collection(db, "m_stores"));
        sSnap.forEach(doc => {
            const data = doc.data();
            const fullData = { ...data, id: doc.id };
            storeMap[doc.id] = fullData;
            const sid = data.store_id || data.StoreID || data['店舗ID'];
            if (sid) storeMap[String(sid)] = fullData;
        });

        const pSnap = await getDocs(collection(db, "t_performance"));
        let daily = [];
        let groupDaily = []; // フィルターに関わらずグループ全体の計算用
        pSnap.forEach(doc => {
            const d = doc.data();
            const normDate = (d.date || "").replace(/\//g, '-').replace(/\./g, '-');
            if (normDate >= dateFrom && normDate <= dateTo) {
                const si = storeMap[d.store_id];
                const ym = d.year_month || normDate.substring(0, 7);
                
                // 全店舗のデータを一旦保持（按分の分母用）
                groupDaily.push({ ...d, date: normDate, ym: ym });

                // 表示用のフィルタリング
                if (storeFilter !== 'all' && d.store_id !== storeFilter) return;
                if (groupFilter !== 'all' && (!si || si.group_name !== groupFilter)) return;
                daily.push({ ...d, date: normDate, ym: ym });
            }
        });

        const groupSalesByYM = {};
        groupDaily.forEach(r => {
            const si = storeMap[r.store_id];
            // 表記揺れに対応したグループ名取得
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
                    year_month: ym, // 両方の呼び名に対応
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

        const lSnap = await getDocs(collection(db, "t_attendance"));
        const laborRaw = [];
        
        lSnap.forEach(doc => {
            const d = doc.data();
            const ts = d.timestamp || d.date || "";
            // 日付形式をハイフンに統一 (2026/04/15 -> 2026-04-15)
            const rawDate = d.date || ts.substring(0, 10);
            const normDate = rawDate.replace(/\//g, '-').replace(/\./g, '-');
            
            // 判定を1日余裕を持たせる (深夜跨ぎの退勤を拾うため)
            const dateToPlus1 = new Date(new Date(dateTo).getTime() + 86400000).toISOString().substring(0, 10);
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
            // IDがなければ名前を使用（管理者修正対策）
            const staffId = String(r.staff_id || r.staff_code || r.EmployeeCode || r.staff_name || r.name || "").trim();
            
            // 店舗IDの正規化: 数値IDなどをドキュメントID(ID001等)に変換
            const rawSid = String(r.store_id || r.StoreID || r.labor_store_id || storeNameToId[r.store_name] || "").trim();
            const si = storeMap[rawSid];
            const sid = (si && si.id) ? si.id : rawSid; // マスタにあれば正式なIDを使用
            
            if (!ts || !sid || !staffId) return;
            // 重要: 日付(substring)で区切らず、スタッフID/名前のみでグルーピングする
            const key = staffId;
            if (!perStaff[key]) perStaff[key] = [];
            perStaff[key].push({ ...r, normalized_sid: sid });
        });

        // スタッフマスタ（ID/従業員番号/名前のすべてで引けるようにインデックスを作成）
        const uSnap = await getDocs(collection(db, "m_users"));
        const userMap = {};
        uSnap.forEach(d => { 
            const data = d.data();
            userMap[String(d.id).trim()] = data;
            const code = data.EmployeeCode || data.staff_code || data.staff_id || "";
            if (code) userMap[String(code).trim()] = data;
            // 名前でも引けるように（修正打刻対策）
            const name = data.staff_name || data.name || "";
            if (name) userMap[name.trim()] = data;
        });

        const laborMap = {};      // ym__store_id -> op_hours
        const ckHoursPool = {};   // group__ym -> total_ck_hours
        const dailyLaborMap = {}; // date__store_id -> op_hours
        const dailyCkHoursPool = {}; // group__date -> total_ck_hours

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

        // グループ全体の「日別売上」を計算（日別CK按分のため）
        const groupDailySales = {};
        groupDaily.forEach(r => {
            const si = storeMap[r.store_id];
            const gn = si ? (si.group_name || si.GroupName || si['グループ名']) : "";
            if (gn) {
                const dgkey = `${gn}__${r.date}`;
                groupDailySales[dgkey] = (groupDailySales[dgkey] || 0) + (r.amount || r.sales || 0) / TAX_RATE;
            }
        });

        // 各日次データに労働時間とCK按分を付与
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
        const goals = await calculatePeriodGoals(storeFilter, dateFrom, dateTo);
        window.__lastLaborMap = filteredLaborMap;

        // 全タブのレンダリング
        renderAllTabs(records, goals, totalOpH, totalCkH, daily, storeMap, storeFilter, userMap, dateFrom, dateTo);
        
        // ローディング非表示
        document.getElementById('dash-loading-overlay').style.display = 'none';
    } catch (e) {
        console.error(e);
        alert("ダッシュボード読込エラー: " + e.message + "\\n" + e.stack);
        if (dtbody) dtbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color:var(--danger);">読込失敗</td></tr>';
        if (mtbody) mtbody.innerHTML = '<tr><td colspan="12" style="text-align:center; color:var(--danger);">読込失敗</td></tr>';
        if (document.getElementById('dash-loading-overlay')) document.getElementById('dash-loading-overlay').style.display = 'none';
    }
}

function renderAllTabs(records, goals, totalOpH, totalCkH, daily, storeMap, storeFilter, userMap, dateFrom, dateTo) {
    // 既存のKPI更新
    renderKPIs(records, goals, totalOpH, totalCkH);
    
    // タブ1: サマリーチャート
    renderSummaryChart(daily, goals, dateFrom, dateTo);
    
    // タブ2: 日別詳細レポート
    renderDailyTab(daily);
    
    // タブ3: 店舗別・月別集計 (既存の renderMonthlyTable をリネーム・拡張)
    renderMonthlyPivotTab(records, daily);
    
    // タブ4: 多角分析チャート
    renderAnalyticsTab(daily);
}

function renderKPIs(recs, goals = { sales: 0, customers: 0 }, forcedOpH = null, forcedCkH = null) {
    let s=0, c=0, opH=0, ckH=0;
    recs.forEach(r => { s+=r.sales; c+=r.customers; opH+=r.op_hours; ckH+=r.ck_alloc; });
    
    // 引数で合計値が渡されている場合はそれを使用 (売上データに紐付かない労働時間も救済するため)
    if (forcedOpH !== null) opH = forcedOpH;
    if (forcedCkH !== null) ckH = forcedCkH;

    const exTax = s / TAX_RATE;

    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    set('kpi-sales-rate', '¥' + Math.round(exTax).toLocaleString()); 
    set('kpi-sales-actual', '¥' + Math.round(s).toLocaleString());
    set('kpi-cust-rate', Math.round(c).toLocaleString() + '名');
    set('kpi-cust-actual', Math.round(c).toLocaleString() + '名');

    // 売上進捗率とバーの更新
    if (goals.sales > 0) {
        const rate = Math.round((exTax / goals.sales) * 100);
        set('kpi-sales-rate', rate + '%');
        document.getElementById('kpi-sales-bar').style.width = Math.min(100, rate) + '%';
        document.getElementById('kpi-sales-bar').style.background = rate >= 100 ? '#10b981' : 'var(--primary)';
        
        // 目標ラベル (税抜目標を表示)
        const targetLabel = recs.length > 0 ? document.getElementById('kpi-sales-actual').parentElement.nextElementSibling.querySelector('.kpi-val') : null;
        if (targetLabel) targetLabel.textContent = '¥' + Math.round(goals.sales).toLocaleString();
        
        // ターゲットマーカー（常に100%地点＝右端 ではない。期間全体に対する「本日時点の理想値」を示す等の運用も可能だが、
        // 今回は「期間全体の目標」に対する進捗バーとして実装するため、マーカーは「現在の期間比率」や「100%地点」等で表現可能。
        // ここでは、バーの100%を目標値とした上で、達成しているかを目視しやすくするため、常に100%地点にマーカーを表示。
        updateTargetMarker('kpi-sales-bar', 100); 
    }

    if (goals.customers > 0) {
        const rate = Math.round((c / goals.customers) * 100);
        set('kpi-cust-rate', rate + '%');
        document.getElementById('kpi-cust-bar').style.width = Math.min(100, rate) + '%';
        
        const targetLabel = document.getElementById('kpi-cust-actual').parentElement.nextElementSibling.querySelector('.kpi-val');
        if (targetLabel) targetLabel.textContent = Math.round(goals.customers).toLocaleString() + '名';
        
        updateTargetMarker('kpi-cust-bar', 100);
    }

    const opS = opH > 0 ? Math.round(exTax / opH) : 0;
    set('kpi-ophour-rate', '¥' + opS.toLocaleString());
    set('kpi-ophour-actual', '¥' + opS.toLocaleString());
    set('kpi-ophour-target', opH.toFixed(1) + 'h');

    const totH = opH + ckH;
    const totS = totH > 0 ? Math.round(exTax / totH) : 0;
    set('kpi-totalhour-rate', '¥' + totS.toLocaleString());
    set('kpi-totalhour-actual', '¥' + totS.toLocaleString());
    set('kpi-totalhour-target', totH.toFixed(1) + 'h');
}

function updateTargetMarker(barId, pct) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    const wrap = bar.parentElement;
    let marker = wrap.querySelector('.kpi-target-marker');
    if (!marker) {
        marker = document.createElement('div');
        marker.className = 'kpi-target-marker';
        wrap.appendChild(marker);
    }
    marker.style.left = pct + '%';
}

/**
 * 期間内の累計目標を計算
 */
async function calculatePeriodGoals(storeId, from, to) {
    if (storeId === 'all') return { sales: 0, customers: 0 };
    
    let totalSales = 0;
    let totalCust = 0;
    
    const start = new Date(from);
    const end = new Date(to);
    
    // 月ごとのキャッシュ
    const monthCache = {};

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const key = `${ym}_${storeId}`;
        
        if (!monthCache[key]) {
            const snap = await getDoc(doc(db, "t_monthly_goals", key));
            if (snap.exists()) {
                const data = snap.data();
                const weights = data.weights || { 
                    mon_thu: 1.0, fri: 1.2, sat: 1.5, sun: 1.4, holiday: 1.5, day_before_holiday: 1.6 
                };

                // 月の総指数を再計算
                const calSnap = await getDoc(doc(db, "m_calendars", `${ym}_common`));
                const calDays = calSnap.exists() ? calSnap.data().days : [];
                
                let totalWeights = 0;
                calDays.forEach(day => {
                    if (day.type !== 'work') return;
                    totalWeights += calculateDayWeight(d.getFullYear(), d.getMonth() + 1, day, calDays, weights);
                });
                
                monthCache[key] = { ...data, weights, totalWeights, calDays };
            } else {
                monthCache[key] = null;
            }
        }
        
        const m = monthCache[key];
        if (m) {
            const calDay = m.calDays.find(cd => cd.day === d.getDate());
            if (calDay && calDay.type === 'work') {
                const weight = calculateDayWeight(d.getFullYear(), d.getMonth() + 1, calDay, m.calDays, m.weights);
                const dailySales = (m.sales_target / m.totalWeights) * weight;
                
                totalSales += dailySales;
                totalCust += dailySales / 4500; // その日の目標売上 ÷ 客単価
            }
        }
    }
    
    return { sales: totalSales, customers: totalCust };
}

function calculateDayWeight(y, m, day, calDays, weights) {
    const date = new Date(y, m - 1, day.day);
    const dow = date.getDay();
    const nextDayObj = calDays.find(nd => nd.day === day.day + 1);
    const isDayBeforeH = nextDayObj ? nextDayObj.is_holiday : false;

    const indices = [];
    if (dow >= 1 && dow <= 4) indices.push(weights.mon_thu);
    else if (dow === 5) indices.push(weights.fri);
    else if (dow === 6) indices.push(weights.sat);
    else if (dow === 0) indices.push(weights.sun);

    if (day.is_holiday) indices.push(weights.holiday);
    if (isDayBeforeH) indices.push(weights.day_before_holiday);

    return Math.max(...indices);
}

function renderSummaryChart(daily, goals, dateFrom, dateTo) {
    const canvas = document.getElementById('chart-summary-trend');
    if (!canvas) return;

    if (window.__dashCharts['summary']) window.__dashCharts['summary'].destroy();

    // 日付順にソート
    const sorted = [...daily].sort((a,b) => a.date.localeCompare(b.date));
    
    // 日付ごとの集計（複数店舗対応）
    const dailyAgg = {};
    sorted.forEach(r => {
        if (!dailyAgg[r.date]) {
            dailyAgg[r.date] = { sales: 0, opH: 0, ckH: 0 };
        }
        dailyAgg[r.date].sales += (r.amount || r.Amount || r['売上税込'] || 0) / TAX_RATE;
        dailyAgg[r.date].opH += (r.op_hours || 0);
        dailyAgg[r.date].ckH += (r.ck_alloc || 0);
    });

    const labels = [];
    const salesData = [];
    const efficiencyData = [];
    
    // 期間内の日付を埋める
    let current = new Date(dateFrom);
    const end = new Date(dateTo);
    while (current <= end) {
        const dStr = current.toISOString().substring(0, 10);
        const md = dStr.substring(5).replace('-', '/');
        labels.push(md);
        
        const dAgg = dailyAgg[dStr] || { sales: 0, opH: 0 };
        salesData.push(Math.round(dAgg.sales));
        
        // 人時売上 (効率)
        const eff = dAgg.opH > 0 ? Math.round(dAgg.sales / dAgg.opH) : null;
        efficiencyData.push(eff);
        
        current.setDate(current.getDate() + 1);
    }

    // 目標の推移（簡易的に期間平均）
    const targetData = labels.map(() => goals.sales > 0 ? Math.round(goals.sales / labels.length) : null);

    window.__dashCharts['summary'] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '売上(税抜)',
                    data: salesData,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: '目標',
                    data: targetData,
                    type: 'line',
                    borderColor: 'rgba(239, 68, 68, 0.8)',
                    borderDash: [5, 5],
                    fill: false,
                    yAxisID: 'y',
                    pointRadius: 0
                },
                {
                    label: '営業人時売上',
                    data: efficiencyData,
                    type: 'line',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    backgroundColor: 'rgba(245, 158, 11, 1)',
                    yAxisID: 'y1',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: '金額(円)' } },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '人時売上(円)' } }
            }
        }
    });
}

function renderDailyTab(daily) {
    const tbody = document.getElementById('daily-table-body');
    if (!tbody) return;
    
    // 日付降順にソート
    const sorted = [...daily].sort((a,b) => b.date.localeCompare(a.date));
    
    // 営業人時売上の平均値算出（アラート用）
    let totalEff = 0, effCount = 0;
    sorted.forEach(r => {
        const exTax = (r.amount || r.Amount || 0) / TAX_RATE;
        if (r.op_hours > 0) {
            totalEff += (exTax / r.op_hours);
            effCount++;
        }
    });
    const avgEff = effCount > 0 ? totalEff / effCount : 0;
    const alertThreshold = avgEff * 0.7; // 平均の70%未満を異常値とする

    tbody.innerHTML = '';
    
    sorted.forEach(r => {
        const exTax = (r.amount || r.Amount || 0) / TAX_RATE;
        const cust = r.customer_count || r.CustomerCount || 0;
        const up = cust > 0 ? Math.round(exTax / cust) : 0;
        const opS = r.op_hours > 0 ? Math.round(exTax / r.op_hours) : 0;
        const totH = (r.op_hours || 0) + (r.ck_alloc || 0);
        const totS = totH > 0 ? Math.round(exTax / totH) : 0;
        const cashDiff = r.cash_diff || r.CashDiff || 0;
        const dObj = new Date(r.date);
        const dow = dObj.getDay();
        const dowStr = ['日','月','火','水','木','金','土'][dow];
        
        const isWeekend = dow === 0 || dow === 6;
        const isAlert = opS > 0 && opS < alertThreshold;
        
        const tr = document.createElement('tr');
        if (isAlert) tr.className = 'row-alert';
        else if (isWeekend) tr.className = 'row-weekend';
        
        const pettyCash = r.petty_cash || r.PettyCash || 0;
        
        tr.innerHTML = `
            <td>${r.date}</td>
            <td style="color:${dow===0?'var(--danger)':(dow===6?'var(--primary)':'inherit')}">${dowStr}</td>
            <td>${r.weather_1 || '-'} / ${r.weather_2 || '-'}</td>
            <td style="text-align: right;">¥${Math.round(exTax).toLocaleString()}</td>
            <td style="text-align: right;">${cust.toLocaleString()}</td>
            <td style="text-align: right;">¥${up.toLocaleString()}</td>
            <td style="text-align: right; ${isAlert ? 'color: var(--danger); font-weight:bold;' : ''}">¥${opS.toLocaleString()}</td>
            <td style="text-align: right;">¥${totS.toLocaleString()}</td>
            <td style="text-align: right;" class="${cashDiff !== 0 ? 'val-red' : ''}">${cashDiff.toLocaleString()}</td>
            <td style="text-align: right;">${(r.op_hours||0).toFixed(1)}</td>
            <td style="text-align: right;">${(r.ck_alloc||0).toFixed(1)}</td>
            <td><div style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.memo || ''}">${r.memo || ''}</div></td>
            <td style="text-align: right;">¥${pettyCash.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderMonthlyPivotTab(records, daily) {
    const tbody = document.getElementById('monthly-pivot-body');
    if (!tbody) return;

    // 店舗ごとにグループ化して月別に並べる
    const storeGroups = {};
    records.forEach(r => {
        if (!storeGroups[r.store_name]) storeGroups[r.store_name] = [];
        storeGroups[r.store_name].push(r);
    });

    tbody.innerHTML = '';

    Object.keys(storeGroups).sort().forEach(sName => {
        const rows = storeGroups[sName];
        rows.sort((a,b) => a.ym.localeCompare(b.ym));
        
        let sDays=0, sSales=0, sCust=0, sCash=0, sOpH=0, sCkH=0;
        
        rows.forEach(r => {
            const exTax = r.sales / TAX_RATE;
            const up = r.customers > 0 ? Math.round(exTax/r.customers) : 0;
            const opS = r.op_hours > 0 ? Math.round(exTax/r.op_hours) : 0;
            const totH = r.op_hours + (r.ck_alloc || 0);
            const totS = totH > 0 ? Math.round(exTax/totH) : 0;
            const avgSales = r.days > 0 ? Math.round(exTax/r.days) : 0;
            const avgCust = r.days > 0 ? (r.customers/r.days).toFixed(1) : 0;

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = () => showDrilldown(r.ym, r.store_id, r.store_name, daily);
            
            tr.innerHTML = `
                <td><span style="font-size:0.7rem; color:var(--text-secondary); display:block;">${sName}</span>${r.ym}</td>
                <td style="text-align: center;">${r.days}</td>
                <td style="text-align: right;">¥${Math.round(exTax).toLocaleString()}</td>
                <td style="text-align: right;">${r.customers.toLocaleString()}</td>
                <td style="text-align: right;">¥${up.toLocaleString()}</td>
                <td style="text-align: right;" class="${r.cash_diff !== 0 ? 'val-red' : ''}">${r.cash_diff.toLocaleString()}</td>
                <td style="text-align: right;">¥${avgSales.toLocaleString()}</td>
                <td style="text-align: right;">${avgCust}</td>
                <td style="text-align: right;">¥${opS.toLocaleString()}</td>
                <td style="text-align: right;">¥${totS.toLocaleString()}</td>
                <td style="text-align: right;">${r.op_hours.toFixed(1)}</td>
                <td style="text-align: right;">${(r.ck_alloc||0).toFixed(1)}</td>
            `;
            tbody.appendChild(tr);
            
            sDays += r.days; sSales += r.sales; sCust += r.customers; sCash += r.cash_diff; sOpH += r.op_hours; sCkH += (r.ck_alloc||0);
        });
        
        // 小計行
        if (rows.length > 1) {
            const exTax = sSales / TAX_RATE;
            const tr = document.createElement('tr');
            tr.style.background = '#f1f5f9';
            tr.style.fontWeight = 'bold';
            tr.innerHTML = `
                <td>${sName} 計</td>
                <td style="text-align: center;">${sDays}</td>
                <td style="text-align: right;">¥${Math.round(exTax).toLocaleString()}</td>
                <td style="text-align: right;">${sCust.toLocaleString()}</td>
                <td style="text-align: right;">¥${sCust > 0 ? Math.round(exTax/sCust).toLocaleString() : 0}</td>
                <td style="text-align: right;" class="${sCash !== 0 ? 'val-red' : ''}">${sCash.toLocaleString()}</td>
                <td style="text-align: right;">¥${sDays > 0 ? Math.round(exTax/sDays).toLocaleString() : 0}</td>
                <td style="text-align: right;">${sDays > 0 ? (sCust/sDays).toFixed(1) : 0}</td>
                <td style="text-align: right;">¥${sOpH > 0 ? Math.round(exTax/sOpH).toLocaleString() : 0}</td>
                <td style="text-align: right;">¥${(sOpH+sCkH) > 0 ? Math.round(exTax/(sOpH+sCkH)).toLocaleString() : 0}</td>
                <td style="text-align: right;">${sOpH.toFixed(1)}</td>
                <td style="text-align: right;">${sCkH.toFixed(1)}</td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function renderAnalyticsTab(daily) {
    if (!document.getElementById('chart-dow')) return;

    // 曜日別集計
    const dowStats = [0,1,2,3,4,5,6].map(() => ({ count: 0, sales: 0, cust: 0 }));
    // 天候別集計
    const wthStats = {};

    daily.forEach(r => {
        const exTax = (r.amount || r.Amount || 0) / TAX_RATE;
        const cust = r.customer_count || r.CustomerCount || 0;
        
        const dow = new Date(r.date).getDay();
        if(!isNaN(dow)) {
            dowStats[dow].count++;
            dowStats[dow].sales += exTax;
            dowStats[dow].cust += cust;
        }

        const w = r.weather_1 || '未設定';
        if (!wthStats[w]) wthStats[w] = { count: 0, sales: 0, cust: 0 };
        wthStats[w].count++;
        wthStats[w].sales += exTax;
        wthStats[w].cust += cust;
    });

    // グラフ: 曜日別
    if (window.__dashCharts['dow']) window.__dashCharts['dow'].destroy();
    window.__dashCharts['dow'] = new Chart(document.getElementById('chart-dow'), {
        type: 'bar',
        data: {
            labels: ['日','月','火','水','木','金','土'],
            datasets: [
                {
                    label: '平均売上',
                    data: dowStats.map(d => d.count > 0 ? Math.round(d.sales / d.count) : 0),
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    yAxisID: 'y'
                },
                {
                    label: '平均客数',
                    data: dowStats.map(d => d.count > 0 ? Math.round(d.cust / d.count) : 0),
                    type: 'line',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    backgroundColor: 'rgba(245, 158, 11, 1)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { display: true, position: 'left' },
                y1: { display: true, position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });

    // グラフ: 天候別
    if (window.__dashCharts['weather']) window.__dashCharts['weather'].destroy();
    const wLabels = Object.keys(wthStats).filter(k => k !== '未設定');
    window.__dashCharts['weather'] = new Chart(document.getElementById('chart-weather'), {
        type: 'bar',
        data: {
            labels: wLabels,
            datasets: [
                {
                    label: '平均売上',
                    data: wLabels.map(k => Math.round(wthStats[k].sales / wthStats[k].count)),
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    yAxisID: 'y'
                },
                {
                    label: '平均客数',
                    data: wLabels.map(k => Math.round(wthStats[k].cust / wthStats[k].count)),
                    type: 'line',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    backgroundColor: 'rgba(239, 68, 68, 1)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { display: true, position: 'left' },
                y1: { display: true, position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });
}

function showDrilldown(ym, sid, sname, daily) {
    const modal = document.getElementById('drilldown-modal');
    document.getElementById('drilldown-modal-title').textContent = `${ym} : ${sname}`;
    const list = daily.filter(r => r.year_month === ym && r.store_id === sid).sort((a,b) => a.date.localeCompare(b.date));
    const tbody = document.getElementById('drilldown-modal-body');
    tbody.innerHTML = '';
    list.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:0.6rem;">${r.date}</td>
            <td>${r.day_of_week || '-'}</td>
            <td style="text-align:right;">¥${r.amount.toLocaleString()}</td>
            <td style="text-align:right;">${r.customer_count}</td>
            <td style="text-align:right; color:${r.cash_diff>=0?'#059669':'var(--danger)'}">${r.cash_diff}</td>
        `;
        tbody.appendChild(tr);
    });
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('show'); }, 10);
}
