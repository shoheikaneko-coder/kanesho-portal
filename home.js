import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm } from './ui_utils.js';
import { 
    initAttendancePage, refreshData, startClock, renderUnclockedDropdown, 
    renderGallery, renderTodayHistory, setupEventListeners 
} from './attendance.js';
const formatDateJST = (d) => {
    const jst = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    return jst.toISOString().split('T')[0];
};

export const homePageHtml = `
    <div class="animate-fade-in" style="max-width: 1200px; margin: 0 auto; padding-bottom: 3rem;">
        <!-- ヘッドライン: ログイン中の主体名 -->
        <div style="margin-bottom: 3rem; text-align: center; padding-top: 1rem;">
            <h1 id="cockpit-user-name" style="font-size: 3.2rem; font-weight: 900; color: var(--primary); margin: 0; letter-spacing: -1px; text-shadow: 0 4px 10px rgba(0,0,0,0.05);">----</h1>
            <p id="cockpit-user-meta" style="color: var(--text-secondary); font-size: 1.1rem; margin-top: 0.5rem; font-weight: 600; letter-spacing: 0.05rem;">----</p>
        </div>
        
        <!-- 個人用シフトサマリー (アルバイトスタッフ用) -->
        <div id="personal-shift-summary-container" style="display: none; margin-bottom: 3rem;"></div>

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
            <div id="tablet-cockpit-container" style="display: none; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 0.8rem; font-size: 0.85rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">
                    <i class="fas fa-rocket" style="color: var(--primary); font-size: 0.8rem;"></i> クイックアクション
                </h3>
                <div id="home-ops-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.8rem;"></div>
            </div>

            <!-- 通常用コックピット（管理者・一般社員） -->
            <div id="standard-cockpit-section">
                <h3 style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.5rem; color: var(--text-primary); font-weight: 800;">
                    <i class="fas fa-rocket" style="color: var(--warning);"></i> 業務コックピット
                </h3>
                <div id="standard-ops-grid" class="ops-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                    <!-- 業務カードがここに動的に生成される -->
                </div>
            </div>
        </div>

        <!-- 【店舗タブレット専用】勤怠打刻セクション -->
        <div id="tablet-attendance-section" style="display: none; margin-top: 0.5rem;">
            <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                <!-- 打刻入力エリア -->
                <div class="glass-panel" style="padding: 1.2rem;">
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem;">
                        <i class="fas fa-fingerprint" style="color: var(--primary);"></i> スタッフ打刻
                    </h3>
                    <div style="display: flex; align-items: center; gap: 0.8rem; margin-top: 0.5rem; margin-bottom: 1rem;">
                        <div id="current-store-label" style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;"></div>
                        <button id="btn-help-mode" class="btn" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 10px; font-weight: 700;">
                            <i class="fas fa-hands-helping"></i> ヘルプ出勤
                        </button>
                    </div>
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
                <div class="glass-panel" style="padding: 1.2rem;">
                    <h3 style="margin: 0 0 1rem; font-size: 1rem; font-weight: 800; color: var(--text-secondary); display: flex; align-items: center; gap: 0.6rem;">
                        <i class="fas fa-users" style="color: #3b82f6;"></i> 現在勤務中のスタッフ
                    </h3>
                    <div id="active-staff-gallery" style="display: flex; flex-wrap: wrap; gap: 0.8rem;">
                        <div style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">読み込み中...</div>
                    </div>
                </div>

                <!-- 本日の打刻履歴 -->
                <div class="glass-panel" style="padding: 1.2rem;">
                    <h3 style="margin: 0 0 1rem; font-size: 1rem; font-weight: 800; color: var(--text-secondary); display: flex; align-items: center; gap: 0.6rem;">
                        <i class="fas fa-history" style="color: #64748b;"></i> 本日の打刻履歴
                    </h3>
                    <div id="attendance-history" style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 250px; overflow-y: auto; padding-right: 0.5rem;">
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
            position: relative;
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

        /* タブレット用スリムアクションボタン: より高密度で洗練されたデザインに */
        .ops-action-btn {
            background: white;
            border: 1px solid var(--border);
            padding: 0.7rem 1rem;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 0.8rem;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.04);
            position: relative;
            overflow: hidden;
        }
        .ops-action-btn:hover {
            border-color: var(--primary);
            background: #fffafa;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(230, 57, 70, 0.1);
        }
        .ops-action-btn i {
            font-size: 1.05rem;
            color: var(--primary);
            width: 32px;
            height: 32px;
            background: rgba(230, 57, 70, 0.06);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: 0.2s;
        }
        .ops-action-btn:hover i {
            background: var(--primary);
            color: white;
        }
        .ops-action-btn span {
            font-weight: 700;
            font-size: 0.9rem;
            color: var(--text-primary);
        }

        /* 個人シフト用スタイル */
        .personal-shift-card {
            background: white;
            border-radius: 20px;
            padding: 1.2rem;
            border: 1px solid var(--border);
            margin-bottom: 0.8rem;
            display: flex;
            align-items: center;
            gap: 1.2rem;
            transition: transform 0.2s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        .personal-shift-card:hover { transform: translateY(-2px); }
        .shift-date-box {
            background: #f1f5f9;
            width: 54px;
            height: 54px;
            border-radius: 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .shift-date-box .day { font-size: 1.1rem; font-weight: 900; color: var(--text-primary); line-height: 1; }
        .shift-date-box .weekday { font-size: 0.65rem; font-weight: 700; color: var(--text-secondary); margin-top: 0.2rem; }
        .shift-info { flex: 1; }
        .shift-time { font-size: 1.05rem; font-weight: 800; color: var(--primary); }
        .shift-store { font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; margin-top: 0.1rem; }
        .shift-status-badge {
            font-size: 0.65rem;
            padding: 0.3rem 0.6rem;
            border-radius: 20px;
            font-weight: 800;
            text-transform: uppercase;
        }
        .status-confirmed { background: rgba(16, 185, 129, 0.1); color: #059669; }
        .status-pending { background: rgba(245, 158, 11, 0.1); color: #D97706; }
    </style>
`;

export const homePageMobileHtml = `
    <style>
        /* 【緊急回避】モバイル専用スタイルをインライン化 */
        .mobile-mode {
            padding: 1rem 0.8rem !important;
            background: #f8fafc;
        }
        .mobile-profile-mini {
            padding: 0.2rem;
            margin-bottom: 0.8rem;
        }
        .mobile-profile-mini h2 { font-size: 1.1rem; font-weight: 850; margin: 0; color: var(--text-primary); }
        .mobile-profile-mini p { font-size: 0.75rem; margin: 0; font-weight: 600; color: var(--text-secondary); }

        .quick-nav-bar {
            display: flex;
            justify-content: flex-start;
            gap: 1.2rem;
            padding: 0.8rem 0.2rem;
            margin-bottom: 1.2rem;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }
        .quick-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.4rem;
            flex-shrink: 0;
        }
        .quick-nav-icon {
            width: 60px;
            height: 60px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.4rem;
            color: var(--primary);
            box-shadow: 0 4px 10px rgba(0,0,0,0.06);
            border: 1px solid var(--border);
        }
        .quick-nav-item.active .quick-nav-icon {
            background: var(--primary);
            color: white;
            box-shadow: 0 6px 15px rgba(230, 57, 70, 0.25);
        }
        .quick-nav-label { font-size: 0.65rem; font-weight: 800; color: var(--text-secondary); }

        .kpi-grid-mobile {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.8rem;
            margin-bottom: 1.5rem;
        }
        .kpi-card-mobile {
            background: white;
            border-radius: 20px;
            padding: 1rem;
            border: 1px solid var(--border);
            box-shadow: 0 4px 12px rgba(0,0,0,0.04);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 140px;
            position: relative;
        }
        .kpi-card-mobile .label { font-size: 0.65rem; font-weight: 800; color: var(--text-secondary); margin-bottom: 0.4rem; }
        .kpi-card-mobile .value { font-size: 1.4rem; font-weight: 900; }
        .kpi-card-mobile .sub-info { font-size: 0.6rem; font-weight: 700; color: var(--text-secondary); margin-top: 0.5rem; }
        
        .ring-container { position: absolute; top: 10px; right: 10px; width: 36px; height: 36px; }
        .progress-ring { transform: rotate(-90deg); }
        .progress-ring__circle { transition: stroke-dashoffset 0.35s; transform-origin: 50% 50%; }

        .accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease, opacity 0.2s ease; opacity: 0; }
        .accordion-content.show { max-height: 2000px; opacity: 1; margin-bottom: 1.5rem; }
    </style>
    <div class="mobile-mode animate-fade-in">
        <!-- 1. コンパクトプロフィール -->
        <div class="mobile-profile-mini">
            <h2 id="mobile-user-name">----</h2>
            <p id="mobile-user-meta" style="color: var(--text-secondary);">----</p>
        </div>

        <!-- 2. クイック・ナビゲーション・バー -->
        <div class="quick-nav-bar" id="mobile-quick-nav">
            <!-- ボタンが動的に生成される -->
        </div>

        <!-- 3. アコーディオン表示エリア -->
        <div id="mobile-accordion-container" class="accordion-content">
            <div id="mobile-accordion-inner" class="glass-panel" style="padding: 1rem; position: relative;">
                <button onclick="window.toggleMobileAccordion(null)" style="position: absolute; top: 10px; right: 10px; border: none; background: #f1f5f9; width: 28px; height: 28px; border-radius: 50%; color: #64748b; font-size: 0.8rem;"><i class="fas fa-times"></i></button>
                <div id="mobile-accordion-body"></div>
            </div>
        </div>
        <!-- 5. 本日の目標セクション (バナー形式) -->
        <div id="mobile-today-target-section" style="display: none; margin-bottom: 1.5rem;">
            <!-- バナーがここに描画される -->
        </div>

        <!-- 4. KPIセクション (2x2) -->
        <div id="mobile-kpi-section" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                <h3 style="font-size: 0.85rem; font-weight: 850; margin: 0; color: var(--text-primary);">
                    <i class="fas fa-chart-line" style="color: var(--primary); margin-right: 0.4rem;"></i> 昨日実績サマリー
                </h3>
                <span id="mobile-yesterday-label" style="font-size: 0.65rem; font-weight: 700; color: var(--text-secondary); background: #fff; padding: 2px 8px; border-radius: 10px; border: 1px solid #eee;">----</span>
            </div>
            <div class="kpi-grid-mobile" id="mobile-kpi-grid">
                <!-- KPI 2x2 がここに描画される -->
            </div>
        </div>

        <!-- ターゲットコンテナ（アコーディオンの中身の流し込み先） -->
        <div id="target-today-shifts" style="display:none;"></div>
        <div id="target-ops-hub" style="display:none;"></div>
        <div id="target-personal-assets" style="display:none;"></div>
    </div>

    <!-- PC版と共通のモーダルなどは維持 -->
    <div id="inventory-alert-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:99999; backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:20px;">
        <!-- ... (PC版と同じモーダル内容) ... -->
    </div>
`;


export async function initHomePage() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    // 役職と画面幅を判定
    const isTabletRole = user.Role === 'Tablet';
    // タブレットロール以外で、1024px未満ならモバイル表示
    const isMobileLayout = !isTabletRole && window.innerWidth < 1024;

    if (isMobileLayout) {
        await renderHomePageMobile(user);
    } else {
        await renderHomePagePC(user);
    }

    // ウィンドウサイズ変更時に、PC/モバイルのレイアウト境界をまたいだ場合のみ再描画
    window.onresize = () => {
        const currentIsMobile = !isTabletRole && window.innerWidth < 1024;
        if (currentIsMobile !== isMobileLayout) {
            initHomePage();
        }
    };
}

/**
 * 【PC版・店舗タブレット用】メインホーム描画
 */
async function renderHomePagePC(user) {
    const pageContent = document.getElementById('page-content');
    if (!pageContent) return;

    pageContent.innerHTML = homePageHtml;
    await setupCommonHomeElements(user);
}

/**
 * 【スマホ版】メインホーム描画
 * 現状はPC版と同じ構造ですが、ここでIDやクラスを調整してスマホ専用UIを即座に構築可能です。
 */
async function renderHomePageMobile(user) {
    const pageContent = document.getElementById('page-content');
    if (!pageContent) return;

    pageContent.innerHTML = homePageMobileHtml;

    // コンパクトプロフィールの設定
    const nameEl = document.getElementById('mobile-user-name');
    const metaEl = document.getElementById('mobile-user-meta');
    if (nameEl) nameEl.textContent = user.Name || user.name || 'User';
    if (metaEl) {
        const roleMap = { 'Admin': '管理者', 'Manager': '店長', 'Staff': '一般社員', 'Tablet': '店舗タブレット', 'PartTimer': 'アルバイト' };
        const roleName = roleMap[user.Role] || user.Role || '一般';
        metaEl.textContent = `${user.Store || ''} ｜ ${roleName}`;
    }

    const permissions = window.appState ? window.appState.permissions : [];
    
    // クイックナビの設定
    setupMobileShortcuts(user, permissions);

    // 1. 今日の目標バナー (管理者・店長・社員のみ)
    if (permissions.includes('home_performance')) {
        await renderTodayTargetBanner(user);
    }

    // 2. 昨日のKPI描画
    if (permissions.includes('home_performance')) {
        await renderPerformanceSummary(user, true); // true = mobile mode
    }

    // アコーディオンのグローバル関数化
    window.toggleMobileAccordion = (type) => toggleMobileAccordion(type, user, permissions);
}

/**
 * スマホ用クイックナビゲーションのセットアップ
 */
function setupMobileShortcuts(user, permissions) {
    const navBar = document.getElementById('mobile-quick-nav');
    if (!navBar) return;

    const allShortcuts = [
        { id: 'shifts', name: '今日のスタッフ', icon: 'fa-users-rectangle', role: ['Admin', 'Manager', 'Staff'] },
        { id: 'ops', name: '業務ハブ', icon: 'fa-rocket', role: ['Admin', 'Manager', 'Staff'] },
        { id: 'assets', name: 'マイ・アセット', icon: 'fa-hand-holding-heart', role: ['Admin', 'Manager', 'Staff', 'PartTimer'] },
        { id: 'attendance', name: '勤怠', icon: 'fa-clock', role: ['PartTimer'] }
    ];

    navBar.innerHTML = allShortcuts
        .filter(s => s.role.includes(user.Role))
        .map(s => `
            <div class="quick-nav-item" onclick="window.toggleMobileAccordion('${s.id}')" id="nav-${s.id}">
                <div class="quick-nav-icon"><i class="fas ${s.icon}"></i></div>
                <div class="quick-nav-label">${s.name}</div>
            </div>
        `).join('');
}

/**
 * アコーディオンの開閉制御
 */
let currentAccordionType = null;
async function toggleMobileAccordion(type, user, permissions) {
    const container = document.getElementById('mobile-accordion-container');
    const body = document.getElementById('mobile-accordion-body');
    
    // 全てのナビアイテムから active クラスを外す
    document.querySelectorAll('.quick-nav-item').forEach(el => el.classList.remove('active'));

    if (!type || currentAccordionType === type) {
        container.classList.remove('show');
        currentAccordionType = null;
        return;
    }

    // アクティブクラス付与
    const navItem = document.getElementById(`nav-${type}`);
    if (navItem) navItem.classList.add('active');

    // コンテンツの読み込み
    body.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';
    container.classList.add('show');
    currentAccordionType = type;

    try {
        if (type === 'shifts') {
            body.innerHTML = '<div id="home-shift-grid" style="display:grid; grid-template-columns:1fr; gap:0.8rem;"></div>';
            await renderTodayShifts(user);
        } else if (type === 'ops') {
            body.innerHTML = '<div id="home-ops-grid" class="ops-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem;"></div>';
            renderOperationCards(permissions, user.Role);
        } else if (type === 'assets') {
            body.innerHTML = '<div id="home-assets-list"></div>';
            await renderPersonalAssets(user);
        }
    } catch (e) {
        body.innerHTML = '<div style="color:var(--danger); padding:1rem;">読み込みに失敗しました。</div>';
    }
}

/**
 * 共通のホーム要素（名前、KPI、各ロール専用機能）のセットアップ
 */
async function setupCommonHomeElements(user) {
    const nameEl = document.getElementById('cockpit-user-name');
    if (nameEl) nameEl.textContent = user.Name || user.name || 'User';

    const metaEl = document.getElementById('cockpit-user-meta');
    if (metaEl) {
        let storeName = user.Store || '店舗情報なし'; 
        const storeId = user.StoreID || user.StoreId;

        if (storeId) {
            try {
                const storeSnap = await getDoc(doc(db, "m_stores", storeId));
                if (storeSnap.exists()) {
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
            'Tablet': '店舗タブレット',
            'PartTimer': 'アルバイトスタッフ'
        };
        const roleName = roleMap[user.Role] || user.Role || '一般';
        if (user.Role === 'Tablet') {
            metaEl.innerHTML = `${storeName} ｜ ${roleName} <span id="tablet-clock-header" style="margin-left: 1.5rem; font-family: monospace; font-weight: 900; color: var(--text-primary); background: #f1f5f9; padding: 0.2rem 0.8rem; border-radius: 8px; border: 1px solid var(--border);">00:00:00</span>`;
        } else {
            metaEl.textContent = `${storeName} ｜ ${roleName}`;
        }
    }

    const permissions = window.appState ? window.appState.permissions : [];
    
    if (permissions.includes('home_performance')) {
        await renderPerformanceSummary(user);
    }
 
    if (user.Role === 'Tablet') {
        document.getElementById('standard-cockpit-section').style.display = 'none';
        document.getElementById('tablet-cockpit-container').style.display = 'block';
        renderOperationCards(permissions, 'Tablet'); 
        await initTabletHomeAttendance(user); 
    } else {
        document.getElementById('tablet-cockpit-container').style.display = 'none';
        
        if (user.Role !== 'PartTimer') {
            await renderTodayShifts(user);
        }

        renderOperationCards(permissions, user.Role); 

        if (user.Role === 'PartTimer') {
            const cockpit = document.getElementById('standard-cockpit-section');
            if (cockpit) cockpit.style.display = 'none';
            
            const shifts = document.getElementById('today-shifts-container');
            if (shifts) shifts.style.display = 'none';

            await renderPersonalShiftsSemimonthly(user);
        }
    }

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

    // 2. 勤怠ロジックの初期化 (店舗IDを明示的にバトンパス)
    const storeId = user.StoreID || user.StoreId || user.store_id || '';
    await initAttendancePage(user, storeId);
    
    // 3. 時計の起動 (ヘッダーの控えめな位置を指定)
    startClock('tablet-clock-header');

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
        const userId = user?.id || user?.uid || user?.ID || null;
        if (!userId || userId === 'undefined') {
            console.warn("renderPersonalAssets: userId is invalid, skipping query.");
            if (container) container.style.display = 'none';
            return;
        }

        const q = query(collection(db, "t_staff_loans"), 
            where("userId", "==", userId),
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
    
    // 今日（JST）の判定
    const nowJst = new Date(Date.now() + (9 * 60 * 60 * 1000));
    const todayYmd = nowJst.toISOString().split('T')[0];

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
                        ${s.userName ? s.userName.substring(0,1) : '?'}
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

/**
 * 昨日の営業実績サマリーを描画
 */
async function renderPerformanceSummary(user, isMobile = false) {
    const container = document.getElementById(isMobile ? 'mobile-kpi-section' : 'yesterday-summary-container');
    const grid = document.getElementById(isMobile ? 'mobile-kpi-grid' : 'home-kpi-grid');
    const dateLabel = document.getElementById(isMobile ? 'mobile-yesterday-label' : 'yesterday-date-label');
    if (!container || !grid) return;

    container.style.display = 'block';

    const me = JSON.parse(localStorage.getItem('currentUser'));
    const storeId = user.StoreID || user.StoreId || window.currentAdminStoreId || (me ? (me.StoreID || me.StoreId) : null) || "ALL";

    try {
        if (!storeId || storeId === 'undefined') {
            console.warn("renderPerformanceSummary: storeId is invalid.", storeId);
            return;
        }

        // 昨日の判定 (店舗の営業終了時間を考慮)
        const storeSnap = await getDoc(doc(db, "m_stores", storeId));
        const storeData = storeSnap.exists() ? storeSnap.data() : {};
        
        // --- 目標値算出の共通処理を実行 ---
        const now = new Date();
        const jstHour = (now.getUTCHours() + 9) % 24;
        let lastWorkDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        lastWorkDate.setUTCHours(0, 0, 0, 0); 

        const changeHour = storeData.day_change_time || 5;
        if (jstHour < changeHour) {
            lastWorkDate.setUTCDate(lastWorkDate.getUTCDate() - 2);
        } else {
            lastWorkDate.setUTCDate(lastWorkDate.getUTCDate() - 1);
        }
        
        const ymd = formatDateJST(lastWorkDate);
        const dailyTargets = await calculateDailyTargets(storeId, ymd);

        const ym = ymd.substring(0, 7);
        
        if (dateLabel) {
            const dow = ['日','月','火','水','木','金','土'][new Date(ymd).getDay()];
            const [y, m, d] = ymd.split('-');
            dateLabel.textContent = `${parseInt(m)}月${parseInt(d)}日(${dow})`;
        }

        // 実績取得 (t_performance)
        const perfSnap = await getDocs(query(collection(db, "t_performance"), 
            where("store_id", "==", storeId), 
            where("date", "==", ymd)));
        
        // 勤怠取得 (t_attendance) - 人時売上算出用
        const attendanceSnap = await getDocs(query(collection(db, "t_attendance"),
            where("store_id", "==", storeId),
            where("date", "==", ymd)));
        
        let actual = { sales: 0, sales_ex_tax: 0, customers: 0, total_labor_hours: 0 };
        
        perfSnap.forEach(doc => {
            const d = doc.data();
            actual.sales += (d.amount || d.sales || 0);
            actual.sales_ex_tax += (d.amount_ex_tax || (actual.sales / 1.1));
            actual.customers += (d.customer_count || d.customers || 0);
        });

        attendanceSnap.forEach(doc => {
            const d = doc.data();
            actual.total_labor_hours += (d.total_labor_hours || 0);
        });

        // 共通関数から取得した目標値を変数に展開
        const targetSales = dailyTargets.sales;
        const targetCustomers = dailyTargets.customers;
        const targetAvgSpend = dailyTargets.customeravg;
        
        // 予算目標 (m_annual_budgets) から人時売上目標のみ追加取得 (sphのみcalculateDailyTargetsに未実装のため)
        let targetSPH = 0;
        try {
            const now = new Date();
            let fy = now.getFullYear();
            if (now.getMonth() < 6) fy--; 
            const budgetSnap = await getDoc(doc(db, "m_annual_budgets", `${fy}_${storeId}`));
            if (budgetSnap.exists()) {
                targetSPH = budgetSnap.data().target_sales_per_hour_op || 0;
            }
        } catch (e) {}

        const salesRate = targetSales > 0 ? (actual.sales_ex_tax / targetSales) * 100 : 0;
        const custRate = targetCustomers > 0 ? (actual.customers / targetCustomers) * 100 : 0;
        
        const avgSpend = actual.customers > 0 ? Math.round(actual.sales_ex_tax / actual.customers) : 0;
        const avgSpendRate = targetAvgSpend > 0 ? (avgSpend / targetAvgSpend) * 100 : 0;
        
        const sph = actual.total_labor_hours > 0 ? Math.round(actual.sales_ex_tax / actual.total_labor_hours) : 0;
        const sphRate = targetSPH > 0 ? (sph / targetSPH) * 100 : 0;

        if (isMobile) {
            grid.innerHTML = `
                ${renderKpiCardMobile('昨日の売上 (税抜)', actual.sales_ex_tax, targetSales, '¥', salesRate)}
                ${renderKpiCardMobile('来客数', actual.customers, targetCustomers, '名', custRate)}
                ${renderKpiCardMobile('客単価 (税抜)', avgSpend, targetAvgSpend, '¥', avgSpendRate)}
                ${renderKpiCardMobile('人時売上', sph, targetSPH, '¥', sphRate, actual.total_labor_hours)}
            `;
        } else {
            grid.innerHTML = `
                <div class="cockpit-kpi-card">
                    <div class="cockpit-kpi-label">昨日の売上進捗 (税抜)</div>
                    <div class="cockpit-kpi-val ${salesRate >= 100 ? 'status-success' : 'status-danger'}">${Math.round(salesRate)}%</div>
                    <div class="cockpit-kpi-sub">
                        <div>実績: ¥${Math.round(actual.sales_ex_tax).toLocaleString()}</div>
                        <div>目標: ¥${Math.round(targetSales).toLocaleString()}</div>
                    </div>
                </div>
                <div class="cockpit-kpi-card">
                    <div class="cockpit-kpi-label">来客進捗</div>
                    <div class="cockpit-kpi-val ${custRate >= 100 ? 'status-success' : 'status-danger'}">${Math.round(custRate)}%</div>
                    <div class="cockpit-kpi-sub">
                        <div>実績: ${actual.customers}名</div>
                        <div>目標: ${Math.round(targetCustomers)}名</div>
                    </div>
                </div>
                <div class="cockpit-kpi-card">
                    <div class="cockpit-kpi-label">客単価 (税抜)</div>
                    <div class="cockpit-kpi-val ${avgSpendRate >= 100 ? 'status-success' : 'status-danger'}">${Math.round(avgSpendRate)}%</div>
                    <div class="cockpit-kpi-sub">
                        <div>実績: ¥${avgSpend.toLocaleString()}</div>
                        <div>目標: ¥${targetAvgSpend.toLocaleString()}</div>
                    </div>
                </div>
                <div class="cockpit-kpi-card">
                    <div class="cockpit-kpi-label">営業人時売上</div>
                    <div class="cockpit-kpi-val ${sphRate >= 100 ? 'status-success' : 'status-danger'}">${Math.round(sphRate)}%</div>
                    <div class="cockpit-kpi-sub">
                        <div>実績: ¥${sph.toLocaleString()}</div>
                        <div>目標: ¥${targetSPH.toLocaleString()}</div>
                    </div>
                    <div style="position: absolute; bottom: 0.8rem; right: 1rem; font-size: 0.65rem; color: var(--text-secondary); font-weight: 700; opacity: 0.8;">
                        労働h: ${actual.total_labor_hours.toFixed(1)}h
                    </div>
                </div>
            `;
        }

    } catch (e) {
        console.error("Performance Summary Error:", e);
        grid.innerHTML = '<p style="color:red; font-weight:800;">実績データの読み込みに失敗しました。</p>';
    }
}

/**
 * スマホ用KPIカードの個別描画 (進捗リング付き)
 */
function renderKpiCardMobile(label, actual, target, unit, rate, extraInfo = null) {
    // 目標・実績ともに0の場合は「店休日（達成扱い）」として 100% とする
    let displayRate = Math.round(rate || 0);
    let color = rate >= 100 ? '#10b981' : '#e11d48';
    
    if (target === 0 && actual === 0) {
        displayRate = 100;
        color = '#10b981';
    } else if (target === 0 && actual > 0) {
        displayRate = 999; // 目標0で実績ありは特殊表示（ひとまず振り切らせる）
    }

    const safeRate = Math.min(100, Math.max(0, displayRate));
    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (safeRate / 100) * circumference;

    const isPrefix = unit === '¥';

    return `
        <div class="kpi-card-mobile">
            <div class="label">${label}</div>
            <div class="ring-container">
                <svg class="progress-ring" width="36" height="36">
                    <circle stroke="#f1f5f9" stroke-width="4" fill="transparent" r="${radius}" cx="18" cy="18"/>
                    <circle class="progress-ring__circle" stroke="${color}" stroke-width="4" stroke-dasharray="${circumference} ${circumference}" style="stroke-dashoffset: ${offset}" fill="transparent" r="${radius}" cx="18" cy="18"/>
                </svg>
            </div>
            <div class="value" style="color: ${color}">${displayRate > 500 ? 'over' : displayRate}%</div>
            <div class="sub-info">
                <div>実績: ${isPrefix ? unit : ''}${Math.round(actual).toLocaleString()}${!isPrefix ? unit : ''}</div>
                <div>目標: ${isPrefix ? unit : ''}${Math.round(target).toLocaleString()}${!isPrefix ? unit : ''}</div>
                ${extraInfo !== null ? `<div style="margin-top:2px; font-size:0.55rem; opacity:0.7;">(労働時間: ${extraInfo.toFixed(1)}h)</div>` : ''}
            </div>
            <div class="trend-tag ${displayRate >= 100 ? 'trend-up' : 'trend-down'}">
                <i class="fas ${displayRate >= 100 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                ${displayRate >= 100 ? '達成' : '未達'}
            </div>
        </div>
    `;
}


function renderOperationCards(permissions, role) {
    const isTablet = role === 'Tablet';
    const gridId = isTablet ? 'home-ops-grid' : 'standard-ops-grid';
    const grid = document.getElementById(gridId);
    if (!grid) return;

    let cards = [
        { id: 'sales', name: '営業実績報告', icon: 'fa-calculator', desc: '売上・客数・各種経費の入力報告を行います。' },
        { id: 'attendance', name: '勤怠入力', icon: 'fa-clock', desc: 'スタッフの出勤・退勤打刻、シフトの確認。' },
        { id: 'inventory', name: '在庫管理', icon: 'fa-warehouse', desc: '現在の在庫数確認、棚卸登録を行います。' },
        { id: 'procurement', name: '仕入れ', icon: 'fa-shopping-cart', desc: '発注・入荷管理、仕入先への注文登録。' },
        { id: 'bottle_keep', name: 'ボトルキープ', icon: 'fa-wine-bottle', desc: 'お客様のキープボトル配置・期限管理を行います。' },
        { id: 'recipe_viewer', name: 'レシピ閲覧', icon: 'fa-book-open', desc: '料理やドリンクの作り方、盛り付けを確認します。' },
        { id: 'goals_store', name: '月次計画(店長用)', icon: 'fa-tasks', desc: '月の目標値の按分シミュレーションと保存。' },
        { id: 'loans', name: '貸与物管理', icon: 'fa-key', desc: '従業員への制服、鍵、端末等の貸与状況を管理。' },
        { id: 'product_analysis', name: '商品分析', icon: 'fa-chart-pie', desc: 'ABC分析等を行い、メニューの改善に繋げます。' }
    ];

    // タブレット時は勤怠入力を除外（埋め込み済みのため）
    if (isTablet) {
        cards = cards.filter(c => c.id !== 'attendance');
    }

    grid.innerHTML = cards
        .filter(c => permissions.includes(c.id))
        .map(c => {
            if (isTablet) {
                return `
                    <div class="ops-action-btn" onclick="window.navigateTo('${c.id}')">
                        <i class="fas ${c.icon}"></i>
                        <span>${c.name}</span>
                    </div>
                `;
            } else {
                return `
                    <div class="ops-card" onclick="window.navigateTo('${c.id}')">
                        <i class="fas ${c.icon}"></i>
                        <div>
                            <h4>${c.name}</h4>
                            <p>${c.desc}</p>
                        </div>
                    </div>
                `;
            }
        }).join('');
}

/**
 * アルバイトスタッフ向け：直近の自分のシフトを2期間（半月ごと）分表示する
 */
async function renderPersonalShiftsSemimonthly(user) {
    const container = document.getElementById('personal-shift-summary-container');
    if (!container) return;

    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth(); 
    const year = today.getFullYear();

    let p1_start, p1_end, p2_start, p2_end;
    let label1, label2;

    if (day <= 15) {
        p1_start = new Date(year, month, 1);
        p1_end = new Date(year, month, 15);
        p2_start = new Date(year, month, 16);
        p2_end = new Date(year, month + 1, 0); 
        label1 = `${month + 1}月前半 (1日〜15日)`;
        label2 = `${month + 1}月後半 (16日〜末日)`;
    } else {
        p1_start = new Date(year, month, 16);
        p1_end = new Date(year, month + 1, 0);
        p2_start = new Date(year, month + 1, 1);
        p2_end = new Date(year, month + 1, 15);
        label1 = `${month + 1}月後半 (16日〜末日)`;
        const nextMonth = new Date(year, month + 1, 1);
        label2 = `${nextMonth.getMonth() + 1}月前半 (1日〜15日)`;
    }

    const toYmd = (d) => d.toISOString().split('T')[0];
    const range1 = [toYmd(p1_start), toYmd(p1_end)];
    const range2 = [toYmd(p2_start), toYmd(p2_end)];

    container.style.display = 'block';
    container.innerHTML = '<div style="text-align:center; padding:1rem;"><i class="fas fa-spinner fa-spin"></i> シフトを読み込み中...</div>';

    try {
        const userId = user.id || user.uid || user.ID;
        if (!userId) {
            console.warn("renderPersonalShiftsSemimonthly: userId is missing.");
            container.style.display = 'none';
            return;
        }

        const q = query(collection(db, "t_shifts"), where("userId", "==", userId));
        const snap = await getDocs(q);
        const allMyShifts = [];
        snap.forEach(doc => allMyShifts.push(doc.data()));

        const filterShifts = (shifts, start, end) => {
            return shifts
                .filter(s => s.date >= start && s.date <= end)
                .sort((a, b) => a.date.localeCompare(b.date));
        };

        const shifts1 = filterShifts(allMyShifts, range1[0], range1[1]);
        const shifts2 = filterShifts(allMyShifts, range2[0], range2[1]);

        const renderShiftList = (shifts, label) => {
            let html = `
                <div style="margin-bottom: 2rem;">
                    <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-secondary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.6rem;">
                        <i class="far fa-calendar-alt" style="color:var(--primary);"></i> ${label}
                    </h4>
            `;
            if (shifts.length === 0) {
                html += '<div style="padding: 1.2rem; background: #f8fafc; border-radius: 18px; text-align: center; color: var(--text-secondary); font-size: 0.85rem; border: 1px dashed var(--border);">この期間のシフト予定はありません。</div>';
            } else {
                shifts.forEach(s => {
                    const d = new Date(s.date);
                    const weekday = ['日','月','火','水','木','金','土'][d.getDay()];
                    const isConfirmed = s.status === 'confirmed';
                    html += `
                        <div class="personal-shift-card">
                            <div class="shift-date-box" style="background: ${d.getDay() === 0 ? '#fee2e2' : d.getDay() === 6 ? '#e0f2fe' : '#f1f5f9'};">
                                <div class="day">${d.getDate()}</div>
                                <div class="weekday">${weekday}</div>
                            </div>
                            <div class="shift-info">
                                <div class="shift-time">${s.start} - ${s.end}</div>
                                <div class="shift-store"><i class="fas fa-map-marker-alt"></i> ${s.storeName || '店舗不明'}</div>
                            </div>
                            <div class="shift-status">
                                <span class="shift-status-badge ${isConfirmed ? 'status-confirmed' : 'status-pending'}">
                                    ${isConfirmed ? '確定' : '予定'}
                                </span>
                            </div>
                        </div>
                    `;
                });
            }
            html += '</div>';
            return html;
        };

        container.innerHTML = `
            <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.8rem;">
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: var(--text-primary);">
                    <i class="fas fa-calendar-check" style="color:#2563eb;"></i> 自分のシフト一覧
                </h3>
            </div>
            ${renderShiftList(shifts1, label1)}
            ${renderShiftList(shifts2, label2)}
        `;

    } catch (e) {
        console.error("Personal Shift Summary Error:", e);
        container.innerHTML = '<div style="color:var(--danger); padding:1rem;">シフトデータの読み込みに失敗しました。</div>';
    }
}

/**
 * 指定された日付の按分目標値を計算する
 */
async function calculateDailyTargets(storeId, targetYmd) {
    const ym = targetYmd.substring(0, 7);
    const [commonCalSnap, storeCalSnap] = await Promise.all([
        getDoc(doc(db, "m_calendars", `${ym}_common`)),
        getDoc(doc(db, "m_calendars", `${ym}_${storeId}`))
    ]);

    const commonCal = commonCalSnap.exists() ? commonCalSnap.data() : { days: [] };
    const storeCal = storeCalSnap.exists() ? storeCalSnap.data() : { days: [] };
    const calendarData = {};
    const ymDate = new Date(targetYmd);
    const year = ymDate.getFullYear();
    const month = ymDate.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
        const calYmd = `${ym}-${String(d).padStart(2, '0')}`;
        const c = commonCal.days?.find(i => i.day === d) || { type: 'work' };
        const s = storeCal.days?.find(i => i.day === d);
        calendarData[calYmd] = { 
            type: s ? s.type : c.type, 
            is_holiday: c.is_holiday || false 
        };
    }

    const goalSnap = await getDoc(doc(db, "t_monthly_goals", `${ym}_${storeId}`));
    const goalData = goalSnap.exists() ? goalSnap.data() : {};
    
    // シフト表と同じ重み係数 (weights) を取得
    const weights = goalData.weights || { 
        mon_thu: 1.0, fri: 1.2, sat: 1.5, sun: 1.4, holiday: 1.5, day_before_holiday: 1.6 
    };

    const keys = ['sales']; // 他に客数などが必要なら拡張可能
    const totalPoints = { sales: 0 };

    for (let d = 1; d <= daysInMonth; d++) {
        const loopDate = new Date(year, month - 1, d);
        const loopYmd = formatDateJST(loopDate);
        const cal = calendarData[loopYmd] || { type: 'work' };
        if (cal.type === 'off') continue;

        const dow = loopDate.getDay();
        const nextDate = new Date(year, month - 1, d + 1);
        const nextYmd = formatDateJST(nextDate);
        const nextCal = calendarData[nextYmd] || {};
        const isDayBeforeH = nextCal.is_holiday || false;

        const indices = [];
        if (dow >= 1 && dow <= 4) indices.push(weights.mon_thu);
        else if (dow === 5) indices.push(weights.fri);
        else if (dow === 6) indices.push(weights.sat);
        else if (dow === 0) indices.push(weights.sun);

        if (cal.is_holiday) indices.push(weights.holiday);
        if (isDayBeforeH) indices.push(weights.day_before_holiday || 1.0);

        totalPoints.sales += Math.max(...indices);
    }

    const monthlyTarget = goalData.sales_target || 0;
    const unitValue = totalPoints.sales > 0 ? (monthlyTarget / totalPoints.sales) : 0;
    
    const fullMonthRounded = {};
    let monthCheckSum = 0;
    const workDays = [];

    for (let d = 1; d <= daysInMonth; d++) {
        const loopDate = new Date(year, month - 1, d);
        const loopYmd = formatDateJST(loopDate);
        const cal = calendarData[loopYmd] || { type: 'work' };
        
        if (cal.type === 'off') {
            fullMonthRounded[loopYmd] = 0;
            continue;
        }

        workDays.push(loopYmd);
        const dow = loopDate.getDay();
        const nextDate = new Date(year, month - 1, d + 1);
        const nextYmd = formatDateJST(nextDate);
        const nextCal = calendarData[nextYmd] || {};
        const isDayBeforeH = nextCal.is_holiday || false;

        const indices = [];
        if (dow >= 1 && dow <= 4) indices.push(weights.mon_thu);
        else if (dow === 5) indices.push(weights.fri);
        else if (dow === 6) indices.push(weights.sat);
        else if (dow === 0) indices.push(weights.sun);

        if (cal.is_holiday) indices.push(weights.holiday);
        if (isDayBeforeH) indices.push(weights.day_before_holiday || 1.0);

        const dayPoint = Math.max(...indices);
        const val = Math.round(unitValue * dayPoint);
        fullMonthRounded[loopYmd] = val;
        monthCheckSum += val;
    }

    // 1円単位のズレ調整
    const diff = monthlyTarget - monthCheckSum;
    if (diff !== 0 && workDays.length > 0) {
        const lastWorkDay = workDays[workDays.length - 1];
        fullMonthRounded[lastWorkDay] += diff;
    }

    // 他の指標（客数目標など）の算出
    // 予算目標 (m_annual_budgets) から客単価目標を算出
    let targetAvgSpend = 4500;
    try {
        let fy = year;
        if (month < 7) fy--; 
        const budgetSnap = await getDoc(doc(db, "m_annual_budgets", `${fy}_${storeId}`));
        if (budgetSnap.exists()) {
            const b = budgetSnap.data();
            if (b.total_sales_target && b.total_cust_target) {
                targetAvgSpend = Math.round(b.total_sales_target / b.total_cust_target);
            }
        }
    } catch (e) {}

    const salesTarget = fullMonthRounded[targetYmd] || 0;
    const customerTarget = targetAvgSpend > 0 ? Math.round(salesTarget / targetAvgSpend) : 0;

    return {
        sales: salesTarget,
        customers: customerTarget,
        customeravg: targetAvgSpend,
        labor: 0 // 必要に応じて追加
    };
}

/**
 * 「本日の目標」バナーを描画
 */
async function renderTodayTargetBanner(user) {
    const section = document.getElementById('mobile-today-target-section');
    if (!section) return;

    const me = JSON.parse(localStorage.getItem('currentUser'));
    const storeId = user.StoreID || user.StoreId || window.currentAdminStoreId || (me ? (me.StoreID || me.StoreId) : null) || "ALL";
    if (storeId === 'ALL') return;

    try {
        const now = new Date();
        const todayYmd = formatDateJST(now);
        const targets = await calculateDailyTargets(storeId, todayYmd);

        section.style.display = 'block';
        section.innerHTML = `
            <div style="background: linear-gradient(135deg, #fff5f5 0%, #fff0f0 100%); border: 1px solid #fee2e2; border-radius: 20px; padding: 1rem 1.2rem; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 6px -1px rgba(230, 57, 70, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <div style="width: 36px; height: 36px; background: white; color: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; box-shadow: 0 2px 4px rgba(230, 57, 70, 0.1);">
                        <i class="fas fa-bullseye"></i>
                    </div>
                    <span style="font-size: 0.9rem; font-weight: 850; color: var(--text-primary);">今日の目標</span>
                </div>
                <div style="display: flex; gap: 1.5rem; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-coins" style="font-size: 0.8rem; color: #f59e0b;"></i>
                        <span style="font-size: 1.15rem; font-weight: 900; color: var(--text-primary);">¥${targets.sales.toLocaleString()}</span>
                    </div>
                    <div style="width: 1px; height: 20px; background: #fecaca;"></div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-users" style="font-size: 0.8rem; color: #3b82f6;"></i>
                        <span style="font-size: 1.15rem; font-weight: 900; color: var(--text-primary);">${targets.customers}名</span>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        console.error("Today Target Banner Error:", e);
    }
}
