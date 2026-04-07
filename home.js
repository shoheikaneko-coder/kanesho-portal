import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm } from './ui_utils.js';
import { 
    initAttendancePage, refreshData, startClock, renderUnclockedDropdown, 
    renderGallery, renderTodayHistory, setupEventListeners 
} from './attendance.js';

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

        <!-- 【店舗タブレット専用】勤怠打刻セクション -->
        <div id="tablet-attendance-section" style="display: none; margin-top: 3.5rem;">
            <!-- 時計表示 -->
            <div style="text-align: center; margin-bottom: 2rem;">
                <div id="tablet-clock-display" style="font-size: 4rem; font-weight: 900; font-family: monospace; color: var(--text-primary); letter-spacing: 2px; text-shadow: 0 4px 12px rgba(0,0,0,0.1);">00:00:00</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
                <!-- 打刻入力エリア -->
                <div class="glass-panel" style="padding: 2rem;">
                    <h3 style="margin: 0 0 1.5rem; font-size: 1.1rem; font-weight: 800; display: flex; align-items: center; gap: 0.8rem;">
                        <i class="fas fa-fingerprint" style="color: var(--primary);"></i> スタッフ打刻
                    </h3>
                    <div id="current-store-label" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; font-weight: 600;"></div>
                    <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                        <select id="staff-select" style="flex: 1; min-width: 200px; padding: 1rem; border: 1px solid var(--border); border-radius: 16px; background: white; font-size: 1.1rem; font-weight: 600;">
                            <option value="">スタッフを選択してください</option>
                        </select>
                        <button id="btn-checkin" class="btn" style="padding: 1rem 2.5rem; background: var(--secondary); color: white; font-weight: 800; border-radius: 16px; font-size: 1.1rem; white-space: nowrap; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);">
                            <i class="fas fa-sign-in-alt"></i> 出勤
                        </button>
                    </div>
                </div>

                <!-- 勤務中スタッフ一覧 -->
                <div class="glass-panel" style="padding: 2rem;">
                    <h3 style="margin: 0 0 1.5rem; font-size: 1.1rem; font-weight: 800; color: var(--text-secondary); display: flex; align-items: center; gap: 0.8rem;">
                        <i class="fas fa-users" style="color: #3b82f6;"></i> 現在勤務中のスタッフ
                    </h3>
                    <div id="active-staff-gallery" style="display: flex; flex-wrap: wrap; gap: 1rem;">
                        <div style="color: var(--text-secondary); font-size: 0.9rem; padding: 0.5rem;">読み込み中...</div>
                    </div>
                </div>

                <!-- 本日の打刻履歴 -->
                <div class="glass-panel" style="padding: 2rem;">
                    <h3 style="margin: 0 0 1.5rem; font-size: 1.1rem; font-weight: 800; color: var(--text-secondary); display: flex; align-items: center; gap: 0.8rem;">
                        <i class="fas fa-history" style="color: #64748b;"></i> 本日の打刻履歴
                    </h3>
                    <div id="attendance-history" style="display: flex; flex-direction: column; gap: 0.8rem; max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">
                        <!-- 履歴がここに動的に生成される -->
                    </div>
                </div>
            </div>
        </div>

        <!-- 個人の貸与物管理 (スタッフ用) -->
        <div id="personal-assets-container" style="display: none; margin-top: 3.5rem;">
            <h3 style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.5rem; color: var(--text-primary); font-weight: 800;">
                <i class="fas fa-hand-holding-heart" style="color: #ed3ef2;"></i> マイ・アセット (貸与物)
            </h3>
            <div id="home-assets-list" class="glass-panel" style="padding: 1.5rem;">
                <!-- 貸与物リストがここに動的に生成される -->
            </div>
        </div>
    </div>

    <!-- Inventory Alert Modal -->
    <div id="inventory-alert-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:99999; backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:20px;">
        <div style="background:white; width:100%; max-width:500px; border-radius:24px; padding:2rem; box-shadow:0 20px 40px rgba(0,0,0,0.3);">
            <div style="text-align:center; margin-bottom:1.5rem;">
                <div style="width:70px; height:70px; background:#fff1f2; color:#e11d48; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2rem; margin:0 auto 1rem;">
                    <i class="fas fa-box-open"></i>
                </div>
                <h2 style="margin:0; font-size:1.5rem; color:#1e293b;">貸与物の確認をお願いします</h2>
                <p style="color:#64748b; font-size:0.9rem; margin-top:0.5rem;">半期に一度の棚卸し確認期間です。<br>手元に以下のアイテムがあるか確認してください。</p>
            </div>
            <div id="alert-items-list" style="margin-bottom:2rem; max-height:250px; overflow-y:auto; background:#f8fafc; border-radius:16px; padding:1rem;">
                <!-- Items to check -->
            </div>
            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                <button id="btn-confirm-assets" class="btn btn-primary" style="padding:1rem; font-weight:800; font-size:1.1rem; width:100%;">
                    <i class="fas fa-check-circle"></i> 全て手元にあることを確認しました
                </button>
                <button onclick="document.getElementById('inventory-alert-modal').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:0.85rem; cursor:pointer; font-weight:600;">後で確認する</button>
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
 
    if (user.Role === 'Tablet') {
        // 店舗タブレット専用レイアウト
        renderOperationCards(permissions); // 業務コックピットを先に描画
        await initTabletHomeAttendance(user); // その下に勤怠埋め込み
    } else {
        // 一般ユーザーレイアウト
        await renderTodayShifts(user); // 本日の出勤メンバー（予定）
        renderOperationCards(permissions); // 業務コックピット
    }

    // スタッフ用マイアセットと棚卸しアラート
    await renderPersonalAssets(user);
}

/**
 * 店舗タブレットのホーム画面に勤怠機能をセットアップ
 */
async function initTabletHomeAttendance(user) {
    const shiftContainer = document.getElementById('today-shifts-container');
    const attendanceSection = document.getElementById('tablet-attendance-section');
    if (!attendanceSection) return;

    // 1. レイアウト調整: 「本日の出勤メンバー（予定）」を非表示にし、打刻セクションを表示
    if (shiftContainer) shiftContainer.style.display = 'none';
    attendanceSection.style.display = 'block';

    // 2. 勤怠ロジックの初期化 (attendance.js のリソースを再利用)
    await initAttendancePage(user);
    
    // 3. 時計の起動 (ホーム専用IDを指定)
    startClock('tablet-clock-display');

    // 4. イベントリスナーの再登録 ( attendance.js で定義されたボタンIDと一致するためそのまま動作する)
    setupEventListeners();

    // 5. データの初期描画
    await refreshData();
}

/**
 * スタッフ自身の貸与物を表示し、必要なら棚卸しアラートを出す
 */
async function renderPersonalAssets(user) {
    const container = document.getElementById('personal-assets-container');
    const grid = document.getElementById('home-assets-list');
    if (!container || !grid) return;

    try {
        const q = query(collection(db, "t_staff_loans"), 
            where("userId", "==", user.id),
            where("status", "==", "loaned"));
        
        const snap = await getDocs(q);
        if (snap.empty) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        
        // マスターデータのキャッシュ用
        const masterSnap = await getDocs(collection(db, "m_loan_items"));
        const masterMap = {};
        masterSnap.forEach(d => masterMap[d.id] = d.data());

        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">';
        let needsVerification = false;
        let itemsForAlert = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        snap.forEach(doc => {
            const loan = doc.data();
            const item = masterMap[loan.itemId] || { name: '不明' };
            const lastCheck = loan.lastVerifiedAt ? new Date(loan.lastVerifiedAt.seconds * 1000) : null;
            
            if (!lastCheck || lastCheck < thirtyDaysAgo) {
                needsVerification = true;
                itemsForAlert.push({ id: doc.id, name: item.name });
            }

            html += `
                <div style="background: #f8fafc; padding: 1.2rem; border-radius: 18px; border: 1px solid #e2e8f0; display:flex; align-items:center; gap: 1rem;">
                    <div style="width:48px; height:48px; background:white; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#ed3ef2; font-size:1.2rem; border:1px solid #eee;">
                        <i class="fas ${item.category === 'rank_a' ? 'fa-key' : 'fa-tshirt'}"></i>
                    </div>
                    <div>
                        <div style="font-weight:800; font-size:0.95rem;">${item.name}</div>
                        <div style="font-size:0.75rem; color:#64748b;">${loan.quantity}個 ${loan.serialNo ? `/ No: ${loan.serialNo}` : ''}</div>
                        <div style="font-size:0.7rem; color:${lastCheck ? '#10b981' : '#f59e0b'}; font-weight:700; margin-top:0.2rem;">
                            <i class="fas fa-check-circle"></i> 確認日: ${lastCheck ? lastCheck.toLocaleDateString() : '未確認'}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        grid.innerHTML = html;

        // 棚卸しアラートの表示 (前回のポップアップから1日経過している場合のみなど、簡易的にlocalStorageで制御)
        const lastPopupDate = localStorage.getItem('last_inventory_popup');
        const todayStr = new Date().toISOString().split('T')[0];

        if (needsVerification && lastPopupDate !== todayStr) {
            const modal = document.getElementById('inventory-alert-modal');
            const alertList = document.getElementById('alert-items-list');
            modal.style.display = 'flex';
            alertList.innerHTML = itemsForAlert.map(i => `
                <div style="display:flex; align-items:center; gap:0.8rem; padding:0.6rem 0; border-bottom:1px solid #eee;">
                    <i class="fas fa-check-square" style="color:#e11d48;"></i>
                    <span style="font-weight:700; font-size:1rem;">${i.name}</span>
                </div>
            `).join('');

            document.getElementById('btn-confirm-assets').onclick = async () => {
                const btn = document.getElementById('btn-confirm-assets');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 確認を送信中...';
                
                try {
                    for (const item of itemsForAlert) {
                        await updateDoc(doc(db, "t_staff_loans", item.id), {
                            lastVerifiedAt: serverTimestamp()
                        });
                    }
                    modal.style.display = 'none';
                    localStorage.setItem('last_inventory_popup', todayStr);
                    showAlert('確認完了', '貸与物の所在を確認しました。ご協力ありがとうございます。');
                    renderPersonalAssets(user); // 再描画
                } catch (e) {
                    console.error(e);
                    showAlert('エラー', '通信に失敗しました。');
                } finally {
                    btn.disabled = false;
                }
            };
        }

    } catch (e) {
        console.error("Personal Assets Error:", e);
    }
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
        { id: 'loans', name: '貸与物管理', icon: 'fa-key', desc: '従業員への制服、鍵、端末等の貸与状況を管理。' },
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
