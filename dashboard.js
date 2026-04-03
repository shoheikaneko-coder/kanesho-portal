import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const dashboardPageHtml = `
    <div class="animate-fade-in" id="dashboard-root">
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
        <div id="drilldown-modal" class="modal-overlay" style="display: none; position: fixed !important; inset: 0 !important; background: rgba(0,0,0,0.5) !important; z-index: 10000 !important; align-items: center; justify-content: center;">
            <div class="glass-panel animate-scale-in" style="width: 100%; max-width: 800px; padding: 0;">
                <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <h4 id="drilldown-modal-title" style="margin: 0; color: var(--text-primary); font-size: 1.1rem;"></h4>
                    <button class="btn btn-close" onclick="document.getElementById('drilldown-modal').style.display='none'"><i class="fas fa-times"></i></button>
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
    document.getElementById('dash-apply-btn').onclick = refreshDashboard;
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
        sSnap.forEach(d => { 
            const data = d.data();
            storeMap[d.id] = data; 
            const sid = data.store_id || data.StoreID || data['店舗ID'];
            if (sid) storeMap[String(sid)] = data;
        });

        const pSnap = await getDocs(collection(db, "t_performance"));
        let daily = [];
        pSnap.forEach(doc => {
            const d = doc.data();
            const normDate = (d.date || "").replace(/\//g, '-').replace(/\./g, '-');
            if (normDate >= dateFrom && normDate <= dateTo) {
                const si = storeMap[d.store_id];
                if (storeFilter !== 'all' && d.store_id !== storeFilter) return;
                if (groupFilter !== 'all' && (!si || si.group_name !== groupFilter)) return;
                daily.push({ ...d, date: normDate }); // 内部的にはハイフン形式で統一
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

        // 労働時間
        const lSnap = await getDocs(collection(db, "t_attendance"));
        const laborRaw = [];
        lSnap.forEach(doc => {
            const d = doc.data();
            const ts = d.timestamp || d.date || "";
            if (ts.substring(0, 10) >= dateFrom && ts.substring(0, 10) <= dateTo) laborRaw.push(d);
        });

        // store_name → store_id 逆引きマップ（直接打刻の過去データ救済用）
        const storeNameToId = {};
        Object.entries(storeMap).forEach(([k, v]) => {
            if (v.store_name) storeNameToId[v.store_name] = v.store_id || k;
        });

        const perStaff = {};
        laborRaw.forEach(r => {
            const ts = r.timestamp || r.date || r.Date || "";
            // store_id がない場合は store_name から逆引き補完（直接打刻の過去データ対応）
            const sid = r.store_id || r.StoreID || storeNameToId[r.store_name] || "";
            const staffId = r.staff_id || r.staff_code || r.EmployeeCode || "";
            if (!ts || !sid || !staffId) return;

            const key = `${staffId}__${ts.substring(0, 10)}__${sid}`;
            if (!perStaff[key]) perStaff[key] = [];
            perStaff[key].push(r);
        });

        const laborMap = {}; // ym__store_id -> hours
        Object.values(perStaff).forEach(recs => {
            // インポートデータ（total_labor_hoursがある）か打刻データかを判定
            const imported = recs.find(r => (r.total_labor_hours !== undefined || r.TotalLaborHours !== undefined));
            if (imported) {
                recs.forEach(r => {
                    const h = Number(r.total_labor_hours || r.TotalLaborHours || 0);
                    const ts = r.timestamp || r.date || r.Date || "";
                    const ym = r.year_month || r.YearMonth || (ts ? ts.substring(0, 7) : '');
                    const sid = r.store_id || r.StoreID || "";
                    if (ym && sid) {
                        const k = `${ym}__${sid}`;
                        laborMap[k] = (laborMap[k] || 0) + h;
                    }
                });
            } else {
                // 打刻データの場合のみペア計算を行う
                recs.sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
                let inT = null;
                recs.forEach(r => {
                    const ts = r.timestamp || r.date || r.Date || "";
                    if (!ts) return;
                    // store_id がない場合は store_name から逆引き補完（perStaff と同じ解決ロジック）
                    const sid = r.store_id || r.StoreID || storeNameToId[r.store_name] || "";
                    const type = String(r.type || r.Type || r['区分'] || '').toLowerCase();
                    if (type === 'in' || type.includes('check_in') || type.includes('出勤')) inT = new Date(ts);
                    else if ((type === 'out' || type.includes('check_out') || type.includes('退勤')) && inT) {
                        const h = (new Date(ts) - inT) / 3600000;
                        const ym = ts.substring(0, 7);
                        if (ym && sid) {
                            const k = `${ym}__${sid}`;
                            laborMap[k] = (laborMap[k] || 0) + h;
                        }
                        inT = null;
                    }
                });
            }
        });

        // CK按分
        const ckHoursByGroupYM = {};
        Object.entries(laborMap).forEach(([k, h]) => {
            const [ym, sid] = k.split('__');
            const si = storeMap[sid];
            if (si && (si.store_type === 'CK' || String(si.store_type).includes('CK')) && si.group_name) {
                const gkey = `${si.group_name}__${ym}`;
                ckHoursByGroupYM[gkey] = (ckHoursByGroupYM[gkey] || 0) + h;
            }
        });

        Object.keys(grouped).forEach(k => {
            if (laborMap[k]) grouped[k].op_hours = laborMap[k];
        });

        const groupSalesByYM = {};
        Object.values(grouped).forEach(r => {
            const gkey = `${r.group_name}__${r.ym}`;
            groupSalesByYM[gkey] = (groupSalesByYM[gkey] || 0) + r.sales / TAX_RATE;
        });

        Object.values(grouped).forEach(r => {
            const gkey = `${r.group_name}__${r.ym}`;
            const gTotal = groupSalesByYM[gkey] || 0;
            const ckH = ckHoursByGroupYM[gkey] || 0;
            if (gTotal > 0) r.ck_alloc = ckH * ( (r.sales/TAX_RATE) / gTotal );
        });

        const records = Object.values(grouped);
        renderKPIs(records);
        renderMonthlyTable(records, daily);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; color:var(--danger);">読込失敗</td></tr>';
    }
}

function renderKPIs(recs) {
    let s=0, c=0, opH=0, ckH=0;
    recs.forEach(r => { s+=r.sales; c+=r.customers; opH+=r.op_hours; ckH+=r.ck_alloc; });
    const exTax = s / TAX_RATE;

    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    set('kpi-sales-rate', '¥' + Math.round(exTax).toLocaleString()); // 税抜
    set('kpi-sales-actual', '¥' + Math.round(s).toLocaleString()); // 税込実績
    set('kpi-cust-rate', Math.round(c).toLocaleString() + '名');
    set('kpi-cust-actual', Math.round(c).toLocaleString() + '名');

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
            <td style="text-align:right; color:${r.cash_diff>=0?'var(--secondary)':'var(--danger)'}">${r.cash_diff}</td>
        `;
        tbody.appendChild(tr);
    });
    modal.style.display = 'flex';
}
