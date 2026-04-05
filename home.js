import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const homePageHtml = `
    <div class="animate-fade-in" style="max-width: 1200px; margin: 0 auto; padding-bottom: 3rem;">
        <!-- ヘッドライン: ログイン中の主体名 -->
        <div style="margin-bottom: 3rem; text-align: center; padding-top: 1rem;">
            <h1 id="cockpit-user-name" style="font-size: 3.2rem; font-weight: 900; color: var(--primary); margin: 0; letter-spacing: -1px; text-shadow: 0 4px 10px rgba(0,0,0,0.05);">----</h1>
            <p id="cockpit-user-meta" style="color: var(--text-secondary); font-size: 1.1rem; margin-top: 0.5rem; font-weight: 600; letter-spacing: 0.05rem;">----</p>
        </div>

        <!-- 昨日の実績サマリー (権限がある場合のみ描画) -->
        <div id="yesterday-summary-container" style="display: none; margin-bottom: 3.5rem;">
            <h3 style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.5rem; color: var(--text-primary); font-weight: 800;">
                <i class="fas fa-chart-line" style="color: var(--primary);"></i> 昨日の営業実績サマリー
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); background: #f1f5f9; padding: 0.2rem 0.8rem; border-radius: 20px;" id="yesterday-date-label">----</span>
            </h3>
            <div class="kpi-grid" id="home-kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.2rem;">
                <!-- KPIカードがここに動的に生成される -->
            </div>
        </div>
 
        <!-- 本日の出動布陣 -->
        <div id="today-shifts-container" style="display: none; margin-bottom: 3.5rem;">
            <h3 style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.5rem; color: var(--text-primary); font-weight: 800;">
                <i class="fas fa-users-rectangle" style="color: #7c3aed;"></i> 本日の出勤メンバー
            </h3>
            <div id="home-shift-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.2rem;">
                <!-- シフトカードがここに動的に生成される -->
            </div>
        </div>

        <!-- 業務オペレーション (ハブ) -->
        <div id="operations-hub">
            <h3 style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.5rem; color: var(--text-primary); font-weight: 800;">
                <i class="fas fa-rocket" style="color: var(--warning);"></i> 業務コックピット
            </h3>
            <div class="ops-grid" id="home-ops-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                <!-- 業務カードがここに動的に生成される -->
            </div>
        </div>
    </div>

    <style>
        .cockpit-kpi-card {
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            border: 1px solid var(--border);
            box-shadow: var(--shadow-sm);
            transition: transform 0.2s;
        }
        .cockpit-kpi-card:hover { transform: translateY(-3px); }
        .cockpit-kpi-label { font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; }
        .cockpit-kpi-val { font-size: 1.6rem; font-weight: 900; font-family: 'Inter', sans-serif; }
        .cockpit-kpi-sub { font-size: 0.8rem; margin-top: 0.4rem; font-weight: 600; }

        .ops-card {
            background: white;
            padding: 2rem 1.5rem;
            border-radius: 24px;
            border: 1px solid var(--border);
            text-align: center;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.2rem;
            box-shadow: var(--shadow-sm);
        }
        .ops-card:hover {
            transform: translateY(-8px);
            border-color: var(--primary);
            box-shadow: 0 15px 30px rgba(230, 57, 70, 0.12);
        }
        .ops-card i {
            width: 70px;
            height: 70px;
            background: rgba(230, 57, 70, 0.05);
            color: var(--primary);
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.2rem;
            transition: 0.3s;
        }
        .ops-card:hover i {
            background: var(--primary);
            color: white;
            transform: scale(1.1) rotate(-5deg);
        }
        .ops-card h4 { margin: 0; font-size: 1.2rem; font-weight: 900; }
        .ops-card p { margin: 0; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; font-weight: 500; }
        
        .status-success { color: #10b981; }
        .status-danger { color: #ef4444; }
    </style>
`;

export async function initHomePage() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    // 名前を表示
    const nameEl = document.getElementById('cockpit-user-name');
    if (nameEl) nameEl.textContent = user.Name || user.name || 'User';

    // 店舗名と役職を表示
    const metaEl = document.getElementById('cockpit-user-meta');
    if (metaEl) {
        // フォールバック付きの店舗名取得
        let storeName = user.Store || '店舗情報なし'; 
        const storeId = user.StoreID || user.StoreId;

        if (storeId) {
            try {
                const storeSnap = await getDoc(doc(db, "m_stores", storeId));
                if (storeSnap.exists()) {
                    // store_name または name フィールドのいずれかを取得
                    storeName = storeSnap.data().store_name || storeSnap.data().name || storeName;
                } else if (storeId === 'ALL') {
                    storeName = '統括・全店舗';
                }
            } catch (e) { console.error("Store load error:", e); }
        } else if (user.Role === 'Admin' || user.Role === '管理者') {
            storeName = '管理者事務局';
        }

        const roleMap = {
            'Admin': '管理者',
            'Manager': '店長',
            'Staff': '一般社員',
            'Tablet': '店舗タブレット'
        };
        const roleName = roleMap[user.Role] || user.Role || '一般';
        metaEl.textContent = `${storeName} ｜ ${roleName}`;
    }

    const permissions = window.appState ? window.appState.permissions : [];
    
    // 実績サマリーの描画
    if (permissions.includes('home_performance')) {
        await renderPerformanceSummary(user);
    }
 
    // 本日のシフトの描画 (共通)
    await renderTodayShifts(user);

    // 業務カードの描画
    renderOperationCards(permissions);
}

/**
 * 本日の出勤メンバーを表示
 */
async function renderTodayShifts(user) {
    const container = document.getElementById('today-shifts-container');
    const grid = document.getElementById('home-shift-grid');
    if (!container || !grid) return;

    const storeId = user.StoreID || user.StoreId;
    if (!storeId || storeId === 'ALL') return;

    container.style.display = 'block';
    const todayYmd = new Date().toISOString().split('T')[0];

    try {
        const q = query(collection(db, "t_shifts"), 
            where("storeId", "==", storeId),
            where("date", "==", todayYmd),
            where("status", "==", "confirmed"));
        
        const snap = await getDocs(q);
        if (snap.empty) {
            grid.innerHTML = '<div style="grid-column: 1/-1; padding: 1.5rem; background: #f8fafc; border-radius: 16px; text-align: center; color: var(--text-secondary); border: 1px dashed var(--border); font-size: 0.9rem;">本日の確定済みシフトはありません。</div>';
            return;
        }

        let html = '';
        snap.forEach(d => {
            const s = d.data();
            html += `
                <div style="display: flex; align-items: center; gap: 1rem; padding: 1.2rem; background: white; border-radius: 20px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); border-left: 5px solid #8b5cf6;">
                    <div style="width: 44px; height: 44px; background: #f5f3ff; color: #7c3aed; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem;">
                        ${s.userName.substring(0,1)}
                    </div>
                    <div>
                        <div style="font-weight: 800; color: var(--text-primary); font-size: 1rem; margin-bottom: 0.1rem;">${s.userName}</div>
                        <div style="font-size: 0.8rem; color: #7c3aed; font-weight: 700; letter-spacing: 0.05rem;">${s.start} - ${s.end}</div>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;
    } catch (e) {
        console.error("Shift load error:", e);
        grid.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); padding:1rem;">シムトデータの取得に失敗しました。</div>';
    }
}

async function renderPerformanceSummary(user) {
    const container = document.getElementById('yesterday-summary-container');
    const grid = document.getElementById('home-kpi-grid');
    const dateLabel = document.getElementById('yesterday-date-label');
    if (!container || !grid) return;

    container.style.display = 'block';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = yesterday.toISOString().split('T')[0];
    const ym = ymd.substring(0, 7);
    dateLabel.textContent = `${yesterday.getMonth() + 1}月${yesterday.getDate()}日(${['日','月','火','水','木','金','土'][yesterday.getDay()]})`;

    try {
        // 実績取得
        const perfSnap = await getDocs(query(collection(db, "t_performance"), 
            where("store_id", "==", user.StoreId || "ALL"), 
            where("date", "==", ymd)));
        
        let actual = { sales: 0, customers: 0, op_hours: 0, total_hours: 0 };
        perfSnap.forEach(doc => {
            const d = doc.data();
            actual.sales += (d.sales || 0);
            actual.customers += (d.customers || 0);
            actual.op_hours += (d.op_hours || 0);
            actual.total_hours += (d.total_hours || 0) + (d.ck_alloc || 0);
        });

        // 目標取得
        let target = { sales: 0, customers: 0 };
        const goalSnap = await getDoc(doc(db, "t_monthly_goals", `${ym}_${user.StoreId}`));
        if (goalSnap.exists()) {
            const g = goalSnap.data();
            // 簡易的に日割り計算（本来は傾斜指数を使うが、ホーム画面では直感的な目安を表示）
            const calSnap = await getDoc(doc(db, "m_calendars", `${ym}_common`));
            const workDays = calSnap.exists() ? calSnap.data().days.filter(d => d.type === 'work').length : 25;
            target.sales = (g.sales_target || 0) / (workDays || 25);
            target.customers = (g.sales_target / 4500) / (workDays || 25);
        }

        const salesRate = target.sales > 0 ? (actual.sales / 1.1 / target.sales) * 100 : 0;
        const avgSpend = actual.customers > 0 ? Math.round(actual.sales / actual.customers) : 0;
        const ophSph = actual.op_hours > 0 ? Math.round((actual.sales / 1.1) / actual.op_hours) : 0;

        grid.innerHTML = `
            <div class="cockpit-kpi-card">
                <div class="cockpit-kpi-label">昨日の売上進捗 (税抜)</div>
                <div class="cockpit-kpi-val ${salesRate >= 100 ? 'status-success' : 'status-danger'}">${Math.round(salesRate)}%</div>
                <div class="cockpit-kpi-sub">実績: ¥${Math.round(actual.sales/1.1).toLocaleString()}</div>
            </div>
            <div class="cockpit-kpi-card">
                <div class="cockpit-kpi-label">来客数</div>
                <div class="cockpit-kpi-val">${actual.customers}名</div>
                <div class="cockpit-kpi-sub">昨対比: --%</div>
            </div>
            <div class="cockpit-kpi-card">
                <div class="cockpit-kpi-label">客単価 (税込)</div>
                <div class="cockpit-kpi-val">¥${avgSpend.toLocaleString()}</div>
                <div class="cockpit-kpi-sub">目標: ¥4,500</div>
            </div>
            <div class="cockpit-kpi-card">
                <div class="cockpit-kpi-label">営業人時売上</div>
                <div class="cockpit-kpi-val">¥${ophSph.toLocaleString()}</div>
                <div class="cockpit-kpi-sub">労働h: ${actual.op_hours}h</div>
            </div>
        `;
    } catch (e) {
        console.error("Home KPI Fetch Error:", e);
        grid.innerHTML = '<p style="color:red;">実績データの読み込みに失敗しました。</p>';
    }
}

function renderOperationCards(permissions) {
    const grid = document.getElementById('home-ops-grid');
    if (!grid) return;

    const cards = [
        { id: 'sales', name: '営業実績報告', icon: 'fa-calculator', desc: '売上・客数・各種経費の入力報告を行います。' },
        { id: 'attendance', name: '勤怠入力', icon: 'fa-clock', desc: 'スタッフの出勤・退勤打刻、シフトの確認。' },
        { id: 'inventory', name: '在庫管理', icon: 'fa-warehouse', desc: '現在の在庫数確認、棚卸登録を行います。' },
        { id: 'procurement', name: '仕入れ', icon: 'fa-shopping-cart', desc: '発注・入荷管理、仕入先への注文登録。' },
        { id: 'product_analysis', name: '商品分析(4つの窓)', icon: 'fa-chart-pie', desc: 'ABC分析等を行い、メニューの改善に繋げます。' }
    ];

    grid.innerHTML = cards
        .filter(c => permissions.includes(c.id))
        .map(c => `
            <div class="ops-card" onclick="window.navigateTo('${c.id}')">
                <i class="fas ${c.icon}"></i>
                <div>
                    <h4>${c.name}</h4>
                    <p>${c.desc}</p>
                </div>
            </div>
        `).join('');
}
