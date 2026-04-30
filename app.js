import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, query, where, getDoc, doc, updateDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 各ページのインポート
import { dashboardPageHtml, initDashboardPage } from './dashboard.js?v=20260430_final';
import { attendancePageHtml, initAttendancePage } from './attendance.js?v=110';
import { salesPageHtml, initSalesPage } from './sales.js?v=110';
import { storesPageHtml, initStoresPage } from './stores.js?v=31';
import { productsPageHtml, initProductsPage } from './products.js?v=31';
import { hubPageHtml, initHubPage } from './hubs.js?v=31';
import { inventoryPageHtml, initInventoryPage } from './inventory.js?v=111';
import { inventorySettingsPageHtml, initInventorySettingsPage } from './inventory_settings.js?v=110';
import { recipesPageHtml, initRecipesPage } from './recipes.js?v=110';
import { recipeMasterPageHtml, initRecipeMasterPage } from './recipe_master.js?v=110';
import { performancePageHtml, initPerformancePage } from './performance.js?v=31';
import { managersPageHtml, initManagersPage } from './users.js?v=31';
import { meetingPageHtml, initMeetingPage } from './manager_meeting.js?v=102';
import { PullToRefresh } from './ptr_logic.js';

// --- グローバルステート ---
window.appState = {
    currentPage: 'home',
    currentUser: null,
    isMenuOpen: false
};

// --- 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // ログイン状態の監視
    onAuthStateChanged(auth, (user) => {
        if (user) {
            handleUserAuthenticated(user);
        } else {
            showLoginPage();
        }
    });

    // メニューボタンの制御
    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn) {
        menuBtn.onclick = toggleSidebar;
    }

    // オーバーレイの制御
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        overlay.onclick = closeSidebar;
    }

    // ログアウトボタン
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = handleLogout;
    }

    // サイドバーのナビゲーションリンク
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const page = e.currentTarget.getAttribute('data-page');
            if (page) {
                showPage(page);
                closeSidebar();
            }
        };
    });

    // URLパラメータによる初期ページ遷移
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = urlParams.get('page');
    if (initialPage) {
        window.appState.currentPage = initialPage;
    }
}

async function handleUserAuthenticated(user) {
    try {
        // ユーザー情報の取得
        const userDoc = await getDoc(doc(db, "m_users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            window.appState.currentUser = { id: user.uid, ...userData };
            localStorage.setItem('currentUser', JSON.stringify(window.appState.currentUser));
            
            updateUserProfileUI(userData);
            showPage(window.appState.currentPage || 'home');
            
            // PTR (Pull-to-Refresh) の初期化
            new PullToRefresh('main-content', {
                onRefresh: async () => {
                    await showPage(window.appState.currentPage);
                }
            });

        } else {
            console.error("User document not found");
            showLoginPage();
        }
    } catch (e) {
        console.error("Error fetching user data:", e);
        showLoginPage();
    }
}

function updateUserProfileUI(userData) {
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar-text');
    
    if (nameEl) nameEl.textContent = userData.staff_name || userData.name || 'ユーザー';
    if (roleEl) roleEl.textContent = userData.Role || '一般';
    if (avatarEl) avatarEl.textContent = (userData.staff_name || userData.name || 'U').substring(0, 1);
}

function showLoginPage() {
    window.location.href = 'login.html';
}

async function handleLogout() {
    try {
        await auth.signOut();
        localStorage.removeItem('currentUser');
        showLoginPage();
    } catch (e) {
        console.error("Logout error:", e);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isMobile = window.innerWidth <= 1024;

    if (isMobile) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}

// --- ページ遷移制御 ---
async function showPage(pageId) {
    const pageContent = document.getElementById('page-content');
    if (!pageContent) return;

    window.appState.currentPage = pageId;
    
    // URLの更新（リロード対策）
    const newUrl = `${window.location.pathname}?page=${pageId}`;
    window.history.pushState({ page: pageId }, '', newUrl);

    // ナビゲーションのハイライト更新
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('data-page') === pageId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // ページの表示切り替え
    switch (pageId) {
        case 'home':
            updateHeaderTitle('メインホーム');
            pageContent.innerHTML = `
                <div class="animate-fade-in" style="padding: 1rem;">
                    <h2 style="font-weight: 800; margin-bottom: 1.5rem; color: var(--text-primary);">Kaneshow Portal</h2>
                    <div id="dash-personal-section" class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; display: none;">
                        <h3 id="personal-info-label" style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"></h3>
                        <div id="personal-info-value" style="font-size: 1.2rem; font-weight: 700; color: var(--primary);"></div>
                    </div>
                    <div class="dashboard-grid">
                        <div class="dashboard-card" onclick="showPage('attendance')">
                            <i class="fas fa-clock fa-2x" style="color: var(--primary);"></i>
                            <h3>勤怠管理</h3>
                            <p>出退勤・休憩の打刻と履歴確認</p>
                        </div>
                        <div class="dashboard-card" onclick="showPage('sales')">
                            <i class="fas fa-yen-sign fa-2x" style="color: var(--secondary);"></i>
                            <h3>売上報告</h3>
                            <p>日次売上の入力と報告</p>
                        </div>
                        <div class="dashboard-card" onclick="showPage('inventory')">
                            <i class="fas fa-boxes fa-2x" style="color: var(--warning);"></i>
                            <h3>在庫・仕入</h3>
                            <p>在庫棚卸と仕入データの管理</p>
                        </div>
                        <div class="dashboard-card" onclick="showPage('dashboard')">
                            <i class="fas fa-chart-line fa-2x" style="color: #8B5CF6;"></i>
                            <h3>分析</h3>
                            <p>店舗状況の多角的な分析</p>
                        </div>
                    </div>
                </div>
            `;
            // ホーム画面専用の動的情報取得
            const { loadPersonalDashboard } = await import('./dashboard.js?v=final');
            if (loadPersonalDashboard) loadPersonalDashboard();
            break;

        case 'dashboard':
            updateHeaderTitle('ダッシュボード');
            pageContent.innerHTML = dashboardPageHtml;
            initDashboardPage();
            break;

        case 'attendance':
            updateHeaderTitle('勤怠管理');
            pageContent.innerHTML = attendancePageHtml;
            initAttendancePage();
            break;

        case 'sales':
            updateHeaderTitle('売上報告');
            pageContent.innerHTML = salesPageHtml;
            initSalesPage();
            break;

        case 'stores':
            updateHeaderTitle('店舗マスタ');
            pageContent.innerHTML = storesPageHtml;
            initStoresPage();
            break;

        case 'managers':
            updateHeaderTitle('ユーザー管理');
            pageContent.innerHTML = managersPageHtml;
            initManagersPage();
            break;

        case 'performance':
            updateHeaderTitle('営業実績一括管理');
            pageContent.innerHTML = performancePageHtml;
            initPerformancePage();
            break;

        case 'inventory':
            updateHeaderTitle('在庫・仕入/仕込');
            pageContent.innerHTML = inventoryPageHtml;
            initInventoryPage();
            break;

        case 'inventory_settings':
            updateHeaderTitle('棚卸・仕入設定');
            pageContent.innerHTML = inventorySettingsPageHtml;
            initInventorySettingsPage();
            break;

        case 'recipes':
            updateHeaderTitle('商品・レシピ構成');
            pageContent.innerHTML = recipesPageHtml;
            initRecipesPage();
            break;
        
        case 'recipe_master':
            updateHeaderTitle('商品・レシピマスタ');
            pageContent.innerHTML = recipeMasterPageHtml;
            initRecipeMasterPage();
            break;

        case 'products':
            updateHeaderTitle('製品マスタ');
            pageContent.innerHTML = productsPageHtml;
            initProductsPage();
            break;

        case 'hubs':
            updateHeaderTitle('調達ハブ');
            pageContent.innerHTML = hubPageHtml;
            initHubPage();
            break;

        case 'manager_meeting':
            updateHeaderTitle('店長会議資料');
            pageContent.innerHTML = meetingPageHtml;
            initMeetingPage();
            break;

        default:
            pageContent.innerHTML = '<div style="padding: 2rem;">ページが準備中です</div>';
    }
}

function updateHeaderTitle(title) {
    const titleEl = document.getElementById('header-title');
    if (titleEl) titleEl.textContent = title;
}

// ブラウザの戻る・進むボタン対応
window.onpopstate = (event) => {
    if (event.state && event.state.page) {
        showPage(event.state.page);
    }
};
