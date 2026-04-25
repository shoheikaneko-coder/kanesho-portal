import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const dashboardPageHtml = `
        <!-- パーソナライズ・クイック情報 -->
        <div id="dash-personal-section" style="margin-bottom: 1.5rem; display: none;">
            <div class="glass-panel" style="padding: 1.2rem 1.5rem; border-left: 5px solid var(--secondary); display: flex; justify-content: space-between; align-items: center; background: linear-gradient(to right, #ffffff, #f0fdf4);">
                <div style="display: flex; align-items: center; gap: 1.2rem;">
                    <div style="width: 50px; height: 50px; background: var(--secondary); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700;" id="personal-info-label">次回の出勤予定</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-primary);" id="personal-info-value">読み込み中...</div>
                    </div>
                </div>
                <button class="btn btn-secondary" onclick="window.navigateTo('shift')" style="font-size: 0.85rem; font-weight: 800;">詳細を確認</button>
            </div>
        </div>

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

        <!-- KPIカード -->
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

        <!-- 月次実績リスト -->
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="overflow-x: auto;">
                <table id="monthly-table" style="width: 100%; min-width: 1100px; border-collapse: collapse; text-align: right; font-size: 0.85rem;">
                    <thead>
                        <tr style="color: var(--text-secondary); border-bottom: 2px solid var(--border);">
                            <th style="padding: 0.8rem; text-align:left;">対象月</th>
                            <th style="padding: 0.8rem; text-align:left;">店舗名</th>
                            <th style="padding: 0.8rem;">営業日数</th>
                            <th style="padding: 0.8rem;">売上合計</th>
                            <th style="padding: 0.8rem;">来客数</th>
                            <th style="padding: 0.8rem;">客単価</th>
                            <th style="padding: 0.8rem;">客数/日</th>
                            <th style="padding: 0.8rem; color:var(--warning);">営業労働h</th>
                            <th style="padding: 0.8rem; color:#8B5CF6;">CK按分h</th>
                            <th style="padding: 0.8rem; font-weight:bold;">総労働h</th>
                            <th style="padding: 0.8rem;">営業人時売上</th>
                            <th style="padding: 0.8rem;">総人時売上</th>
                            <th style="padding: 0.8rem;">現金過不足</th>
                        </tr>
                    </thead>
                    <tbody id="monthly-table-body">
                        <tr><td colspan="13" style="text-align:center; padding: 2rem;">読込中...</td></tr>
                    </tbody>
                </table>
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
        .kpi-card { padding: 1.4rem; transition: transform 0.2s; }
        .kpi-card:hover { transform: translateY(-2px); }
        .kpi-label { font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.4rem; }
        .kpi-rate { font-size: 1.8rem; font-weight: 800; color: var(--primary); }
        .kpi-rate-bar-wrap { width: 100%; height: 6px; background: rgba(0,0,0,0.07); border-radius: 3px; margin: 0.6rem 0 0.8rem; overflow:hidden; }
        .kpi-rate-bar { height: 100%; transition: width 0.8s; }
        .kpi-row { display: flex; justify-content: space-between; }
        .kpi-sub-label { font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; }
        .kpi-val { font-size: 1rem; font-weight: 700; font-family: monospace; }
        .kpi-val-muted { color: var(--text-secondary); font-weight: 500; }
        .kpi-rate-bar-wrap { position: relative; }
        .kpi-target-marker { 
            position: absolute; 
            top: 0; 
            width: 2px; 
            height: 100%; 
            background: #1e293b; 
            z-index: 2; 
            box-shadow: 0 0 4px rgba(255,255,255,0.8);
            transition: left 0.5s;
        }
        .dashboard-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 1000px) { .dashboard-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .dashboard-kpi-grid { grid-template-columns: 1fr; } }
        #monthly-table td { padding: 0.7rem; border-bottom: 1px solid var(--border); }
        .diff-pos { color: #059669; font-weight: 600; }
        .diff-neg { color: var(--danger); font-weight: 600; }
    `;
    document.head.appendChild(style);
}

const TAX_RATE = 1.1;

export async function initDashboardPage() {
    injectStyles();
    const now = new Date();
    document.getElementById('dash-date-from').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    document.getElementById('dash-date-to').value = now.toISOString().substring(0, 10);

    await loadFilterOptions();
    await refreshDashboard();
    await loadPersonalDashboard(); // 追加
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

    const tbody = document.getElementById('monthly-table-body');
    tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:2rem;">集計中...</td></tr>';

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

        const nextDay = new Date(new Date(dateTo).getTime() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
        const q = query(collection(db, "t_attendance"), 
            where("date", ">=", dateFrom),
            where("date", "<=", nextDay)
        );
        const lSnap = await getDocs(q);
        const laborRaw = [];
        lSnap.forEach(doc => {
            laborRaw.push(doc.data());
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

        Object.values(perStaff).forEach(recs => {
            const imported = recs.find(r => (r.total_labor_hours !== undefined || r.TotalLaborHours !== undefined));
            
            // スタッフ情報の特定 (IDがなければ名前でマスタを引く)
            const first = recs[0];
            const staffKey = String(first.staff_id || first.staff_code || first.EmployeeCode || first.staff_name || first.name || "").trim();
            const staffData = userMap[staffKey] || {};
            
            // 従業員マスタの所属店舗IDを取得
            const staffStoreId = String(staffData.StoreID || staffData.StoreId || staffData.store_id || "").trim();
            const homeStore = storeMap[staffStoreId];
            
            // ユーザー指定の判定基準: store_type が "CK" ならCK所属
            const isCKStaff = homeStore && String(homeStore.store_type || "").trim() === 'CK';
            const staffGroupName = homeStore ? String(homeStore.group_name || homeStore.GroupName || homeStore['グループ名'] || "").trim() : "";

            if (imported) {
                recs.forEach(r => {
                    const h = Number(r.total_labor_hours || r.TotalLaborHours || 0);
                    const ts = r.timestamp || r.date || r.Date || "";
                    const ym = r.year_month || r.YearMonth || (ts ? ts.substring(0, 7) : '');
                    
                    // インポートデータの店舗IDも正規化する
                    const rawSid = String(r.store_id || r.StoreID || "").trim();
                    const si = storeMap[rawSid];
                    const sid = (si && si.id) ? si.id : rawSid;
                    
                    if (!ym) return;

                    if (isCKStaff && staffGroupName) {
                        const gkey = `${staffGroupName}__${ym}`;
                        ckHoursPool[gkey] = (ckHoursPool[gkey] || 0) + h;
                    } else if (sid) {
                        const k = `${ym}__${sid}`;
                        laborMap[k] = (laborMap[k] || 0) + h;
                    }
                });
            } else {
                recs.sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
                let inT = null, breakStartT = null, totalBreakMs = 0, currentNormalizedSid = "";

                recs.forEach(r => {
                    const ts = r.timestamp || r.date || r.Date || "";
                    if (!ts) return;
                    const type = String(r.type || r.Type || '').toLowerCase();
                    const sid = r.normalized_sid;

                    if (type === 'in' || type.includes('check_in') || type.includes('出勤')) {
                        inT = new Date(ts);
                        totalBreakMs = 0;
                        breakStartT = null;
                        currentNormalizedSid = sid;
                    } else if (type.includes('break_start') || type.includes('休憩開始')) {
                        breakStartT = new Date(ts);
                    } else if ((type.includes('break_end') || type.includes('休憩終了')) && breakStartT) {
                        totalBreakMs += (new Date(ts) - breakStartT);
                        breakStartT = null;
                    } else if ((type === 'out' || type.includes('check_out') || type.includes('退勤')) && inT) {
                        const outT = new Date(ts);
                        const netMs = Math.max(0, (outT - inT) - totalBreakMs);
                        const h = netMs / 3600000;
                        
                        // 日本時間(JST)ベースで日付を判定 (dateフィールドがあればそれを優先)
                        const jstInT = new Date(inT.getTime() + (9 * 60 * 60 * 1000));
                        const shiftDate = r.date || jstInT.toISOString().substring(0, 10);
                        const ym = shiftDate.substring(0, 7);
                        const finalSid = currentNormalizedSid || sid;

                        // 表示対象期間内であれば加算
                        if (shiftDate >= dateFrom && shiftDate <= dateTo) {
                            if (isCKStaff && staffGroupName) {
                                const gkey = `${staffGroupName}__${ym}`;
                                ckHoursPool[gkey] = (ckHoursPool[gkey] || 0) + h;
                            } else if (finalSid) {
                                const k = `${ym}__${finalSid}`;
                                laborMap[k] = (laborMap[k] || 0) + h;
                            }
                        }
                        inT = null; totalBreakMs = 0; breakStartT = null;
                    }
                });
            }
        });

        Object.keys(grouped).forEach(k => {
            if (laborMap[k]) grouped[k].op_hours = laborMap[k];
        });

        Object.values(grouped).forEach(r => {
            // 表示店舗側のグループ名も表記揺れ対応
            const gn = r.group_name || ""; 
            const gkey = `${gn}__${r.ym}`;
            const gTotalSales = groupSalesByYM[gkey] || 0;
            const totalCkH = ckHoursPool[gkey] || 0;
            
            if (gTotalSales > 0) {
                // 按分比率 = その店舗の売上 / グループ総売上
                const ratio = (r.sales / TAX_RATE) / gTotalSales;
                r.ck_alloc = totalCkH * ratio;
            } else {
                r.ck_alloc = 0;
            }
        });

        const records = Object.values(grouped);
        
        // --- 目標データの取得と累計計算 ---
        const goals = await calculatePeriodGoals(storeFilter, dateFrom, dateTo);
        
        renderKPIs(records, goals);
        renderMonthlyTable(records, daily);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color:var(--danger);">読込失敗</td></tr>';
    }
}

function renderKPIs(recs, goals = { sales: 0, customers: 0 }) {
    let s=0, c=0, opH=0, ckH=0;
    recs.forEach(r => { s+=r.sales; c+=r.customers; opH+=r.op_hours; ckH+=r.ck_alloc; });
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
                // 客数目標（重み付けなしで単純営業日割）
                const dailyCust = (m.sales_target / 10000) * 1.5; // 仮ロジック（実際は客数目標も同様に扱える）
                
                totalSales += dailySales;
                totalCust += (m.sales_target / 4500) * (weight/1.0); // 客単価案分
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

function renderMonthlyTable(recs, daily) {
    const tbody = document.getElementById('monthly-table-body');
    if (!tbody) return;
    recs.sort((a,b) => b.ym.localeCompare(a.ym) || a.store_name.localeCompare(b.store_name));
    tbody.innerHTML = '';
    recs.forEach(r => {
        const exTax = r.sales / TAX_RATE;
        const totH = r.op_hours + r.ck_alloc;
        const up = r.customers > 0 ? Math.round(r.sales/r.customers) : 0;
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td style="text-align:left; font-weight:600;">${r.ym}</td>
            <td style="text-align:left;">${r.store_name}</td>
            <td>${r.days}</td>
            <td>¥${Math.round(r.sales).toLocaleString()}</td>
            <td>${r.customers.toLocaleString()}</td>
            <td>¥${up.toLocaleString()}</td>
            <td>${r.days > 0 ? (r.customers/r.days).toFixed(1) : 0}</td>
            <td>${r.op_hours.toFixed(1)}</td>
            <td>${r.ck_alloc.toFixed(1)}</td>
            <td style="font-weight:bold;">${totH.toFixed(1)}</td>
            <td>¥${r.op_hours > 0 ? Math.round(exTax/r.op_hours).toLocaleString() : 0}</td>
            <td>¥${totH > 0 ? Math.round(exTax/totH).toLocaleString() : 0}</td>
            <td class="${r.cash_diff >= 0 ? 'diff-pos' : 'diff-neg'}">${r.cash_diff.toLocaleString()}</td>
        `;
        tr.onclick = () => showDrilldown(r.ym, r.store_id, r.store_name, daily);
        tbody.appendChild(tr);
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
