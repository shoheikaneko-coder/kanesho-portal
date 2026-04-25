import { db } from './firebase.js';
import { collection, getDocs, query, where, getDoc, doc, updateDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 各ページのインポート
import { dashboardPageHtml, initDashboardPage } from './dashboard.js?v=106';
import { attendancePageHtml, initAttendancePage } from './attendance.js?v=106';
import { salesPageHtml, initSalesPage } from './sales.js?v=106';
import { storesPageHtml, initStoresPage } from './stores.js?v=31';
import { usersPageHtml, initUsersPage } from './users.js?v=31';
import { inventoryPageHtml, initInventoryPage } from './inventory.js?v=33';
import { procurementPageHtml, initProcurementPage } from './procurement.js?v=8';
import { stocktakePageHtml, initStocktakePage } from './stocktake.js?v=1';
import { inventoryHistoryPageHtml, initInventoryHistoryPage } from './inventory_history.js?v=1';
import { productsPageHtml, initProductsPage } from './products.js?v=20260425_2153';
import { suppliersPageHtml, initSuppliersPage } from './suppliers.js?v=36';
import { storeItemsPageHtml, initStoreItemsPage } from './store_items.js?v=31';
import { recipesViewerPageHtml, initRecipesViewerPage } from './recipes.js?v=7';
import { attendanceCheckPageHtml, initAttendanceCheckPage } from './attendance_check.js?v=7';
import { csvExportPageHtml, initCsvExportPage } from './csv_export.js?v=7';
import { salesCorrectionPageHtml, initSalesCorrectionPage } from './sales_correction.js?v=7';
import { rolePermissionsPageHtml, initRolePermissionsPage } from './role_permissions.js?v=7';
import { menuOrderPageHtml, initMenuOrderPage } from './menu_order.js?v=7';
import { dailySakesPageHtml, initDailySakesPage } from './daily_sakes.js?v=116';
import { csvImportPageHtml, initCsvImportPage } from './csv_import.js?v=7';
import { productAnalysisPageHtml, initProductAnalysisPage } from './product_analysis.js?v=31';
import { notificationsPageHtml, initNotificationsPage } from './notifications.js?v=116';
import { calendarAdminPageHtml, initCalendarAdminPage, calendarViewerPageHtml, initCalendarViewerPage } from './calendar.js?v=63';
import { goalsAdminPageHtml, initGoalsAdminPage, goalsStorePageHtml, initGoalsStorePage } from './goals.js?v=7';
import { homePageHtml, initHomePage } from './home.js?v=120';
import { shiftSubmissionPageHtml, initShiftSubmissionPage, shiftAdminPageHtml, initShiftAdminPage, shiftViewerPageHtml, initShiftViewerPage, checkIfShiftPublished } from './shift.js?v=72';
import { loansPageHtml, initLoansPage } from './loans.js?v=116';
import { hubPageHtml, initHubPage } from './hubs.js?v=116';
import { inviteNaviPageHtml, initInviteNaviPage } from './invite_navi.js';
import { attendanceManagementPageHtml, initAttendanceManagementPage } from './attendance_management.js';
import { bottleKeepPageHtml, initBottleKeepPage } from './bottle_keep.js';
import { prototypeMenuPageHtml, initPrototypeMenuPage } from './prototype_menu.js?v=141';
import { competitorListPageHtml, initCompetitorListPage } from './competitor_list.js';
import { PullToRefresh } from './ptr_logic.js';



console.log("AntiGravity Portal: app.js loaded successfully.");

const state = {
    currentUser: null,
    currentPage: 'home',
    permissions: [],
    menuOrder: [],
    ptr: null
};
window.appState = state;


const defaultMenuItems = [
    { id: 'home', name: 'メインホーム', icon: 'fa-home', category: 'ハブ' },
    { id: 'ops_hub', name: '店舗業務', icon: 'fa-store', category: 'ハブ' },
    { id: 'hr_hub', name: '人事総務業務', icon: 'fa-user-friends', category: 'ハブ' },
    { id: 'utility_hub', name: '便利機能', icon: 'fa-lightbulb', category: 'ハブ' },
    { id: 'master_hub', name: '設定', icon: 'fa-cog', category: 'ハブ' },
    
    { id: 'dashboard', name: '分析ダッシュボード', icon: 'fa-chart-line', category: 'サブ機能' },
    { id: 'shift_submission', name: 'シフト提出・確認', icon: 'fa-calendar-alt', category: 'サブ機能' },
    { id: 'shift_admin', name: 'シフト作成・調整', icon: 'fa-user-edit', category: 'サブ機能' },
    { id: 'recipe_viewer', name: 'レシピ閲覧', icon: 'fa-book-open', category: 'サブ機能' },
    { id: 'daily_sakes', name: '日本酒管理', icon: 'fa-wine-glass-alt', category: 'サブ機能' },
    { id: 'bottle_keep', name: 'ボトルキープ', icon: 'fa-wine-bottle', category: 'サブ機能' },
    { id: 'attendance_management', name: '勤怠管理', icon: 'fa-user-clock', category: 'サブ機能' },
    { id: 'attendance_check', name: '勤怠照会', icon: 'fa-clipboard-check', category: 'サブ機能', hidden: true },
    { id: 'invite_navi', name: '従業員への招待案内', icon: 'fa-paper-plane', category: 'サブ機能' },
    { id: 'users', name: '従業員管理', icon: 'fa-users-cog', category: 'サブ機能', hidden: true }
];

/**
 * ハブの省略名称マッピング (パンくず用)
 */
const hubLabels = {
    'home': 'ホーム',
    'ops_hub': '業務',
    'hr_hub': '人事',
    'utility_hub': '便利機能',
    'master_hub': '設定'
};

/**
 * ページIDと親ハブの紐付けマッピング
 */
const pageParentMap = {
    'stocktake': 'ops_hub',
    'inventory_history': 'ops_hub',
    'dashboard': 'ops_hub',
    'attendance': 'ops_hub',
    'sales': 'ops_hub',
    'inventory': 'ops_hub',
    'procurement': 'ops_hub',
    'recipe_viewer': 'ops_hub',
    'menu_order': 'ops_hub',
    'calendar_viewer': 'ops_hub',
    'daily_sakes': 'ops_hub',
    'bottle_keep': 'ops_hub',
    'attendance_management': 'hr_hub',
    'attendance_check': 'hr_hub',
    'shift_submission': 'hr_hub',
    'users': 'hr_hub',
    'invite_navi': 'hr_hub',
    'loans': 'hr_hub',
    'notifications': 'hr_hub',
    'role_permissions': 'master_hub',
    'stores': 'master_hub',
    'products': 'master_hub',
    'suppliers': 'master_hub',
    'store_items': 'master_hub',
    'csv_export': 'master_hub',
    'csv_import': 'master_hub',
    'sales_correction': 'master_hub',
    'product_analysis': 'master_hub',
    'calendar_admin': 'master_hub',
    'goals_admin': 'master_hub',
    'goals_store': 'ops_hub',
    'prototype_menu': 'utility_hub',
    'competitor_list': 'utility_hub'
};

/**
 * ユーザーオブジェクトを正規化して、IDや店舗IDの不整合を解消する
 */
function normalizeUser(user) {
    if (!user) return null;
    const normalized = {
        ...user,
        id: user.id || user.uid || user.ID || null,
        StoreID: user.StoreID || user.StoreId || user.store_id || 'honten',
        Role: user.Role || 'Staff'
    };
    
    if (!normalized.id) console.warn("normalizeUser: User ID is missing for", user);
    return normalized;
}

/**
 * ログイン成功時の処理（初期化・画面遷移）
 */
async function loginSuccess(rawData) {
    const user = normalizeUser(rawData);
    if (!user || !user.id) {
        console.warn("loginSuccess: Invalid user data, aborting login flow.");
        return;
    }

    state.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));

    await renderSidebar(user);
    
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.remove();
    
    const layout = document.getElementById('dashboard-layout');
    if (layout) {
        layout.style.display = 'flex';
        layout.style.opacity = '1';
        
        // 店舗タブレットの場合はサイドバーをデフォルトで折りたたむ
        if (user.Role === 'Tablet') {
            layout.classList.add('sidebar-collapsed');
        } else {
            layout.classList.remove('sidebar-collapsed');
        }
        
        window.scrollTo(0, 0);
    }

    const nameEl = document.getElementById('display-user-name');
    const roleEl = document.getElementById('display-user-role');
    const avatarEl = document.getElementById('display-user-avatar');

    if (nameEl) nameEl.textContent = user.Name || 'ユーザー';
    if (roleEl) roleEl.textContent = user.Role || '一般';
    if (avatarEl) avatarEl.textContent = (user.Name || 'U').substring(0, 1).toUpperCase();

    const urlParams = new URLSearchParams(window.location.search);
    const targetPage = urlParams.get('page');

    if (targetPage) {
        showPage(targetPage);
    } else {
        showPage('home');
    }

    initNotificationBadge();
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 認証中...';
    }

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
        let user = null;
        
        // 効率的なクエリによる検索（大文字・小文字両方のフィールド名に対応）
        const tryQuery = async (field, val) => {
            const q = query(collection(db, "m_users"), where(field, "==", val));
            return await getDocs(q);
        };

        // 検索順序: Email(入力値) -> email(入力値) -> Email(小文字) -> email(小文字)
        let userSnap = await tryQuery("Email", email);
        if (userSnap.empty) userSnap = await tryQuery("email", email);
        if (userSnap.empty) userSnap = await tryQuery("Email", email.toLowerCase());
        if (userSnap.empty) userSnap = await tryQuery("email", email.toLowerCase());

        userSnap.forEach(d => {
            const data = d.data();
            const uLoginPass = String(data.LoginPassword || data.password || "");
            if (uLoginPass === password) {
                user = { id: d.id, ...data };
            }
        });

        // 管理者フォールバック
        if (!user && email.toLowerCase() === 'admin@kaneshow.jp' && password === 'password') {
            user = { id: 'admin-fallback', Name: '管理者', Email: email, Role: 'Admin' };
        }

        if (user) {
            await loginSuccess(user);
        } else {
            alert('ログイン失敗: IDまたはパスワードが正しくありません。');
        }
    } catch (err) {
        console.error("Login error:", err);
        alert('通信エラーが発生しました。ネットワーク接続を確認してください。\n' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ログイン';
        }
    }
}


/**
 * サイドバーのメニューを描画（権限考慮）
 */
async function renderSidebar(user) {
    const sidebarMenu = document.querySelector('.sidebar-menu');
    if (!sidebarMenu) return;

    const role = user.Role || 'Staff';
    let allowed = [];

    if (role === 'Admin' || role === '管理者') {
        allowed = defaultMenuItems.map(m => m.id);
        // 全般的な権限を付与
        const adminPerms = ['sales','attendance','inventory','procurement','stocktake','inventory_history','store_items','product_analysis','home_performance','shift_admin','shift_submission','attendance_check','users','invite_navi','loans','role_permissions','stores','products','suppliers','sales_correction','csv_export','csv_import','calendar_admin','goals_admin','goals_store','line_share','daily_sakes','bottle_keep'];
        adminPerms.forEach(id => { if (!allowed.includes(id)) allowed.push(id); });
    } else {
        try {
            const docSnap = await getDoc(doc(db, "m_role_permissions", role));
            if (docSnap.exists()) {
                allowed = docSnap.data().permissions || [];
            }
            if (role === 'Tablet' || role === '店舗タブレット') {
                if (!allowed.includes('bottle_keep')) allowed.push('bottle_keep');
            }
        } catch (e) {
            console.error("Permission check failed:", e);
        }
    }
    
    // 便利機能Hubは全従業員にデフォルト開放
    const commonPerms = ['utility_hub', 'prototype_menu', 'competitor_list'];
    commonPerms.forEach(id => {
        if (!allowed.includes(id)) allowed.push(id);
    });

    state.permissions = allowed;

    const hrNav = document.getElementById('nav-item-hr');
    if (hrNav) {
        hrNav.style.display = (role === 'Admin' || role === '管理者' || allowed.includes('hr_hub')) ? 'flex' : 'none';
    }

    const opsNav = document.getElementById('nav-item-ops');
    if (opsNav) {
        opsNav.style.display = (role === 'Admin' || role === '管理者' || allowed.includes('ops_hub')) ? 'flex' : 'none';
    }

    // クイック操作 (FAB) の制御
    const fabItems = [
        { id: 'fab-item-attendance', pid: 'fab_attendance' },
        { id: 'fab-item-sales', pid: 'fab_sales' },
        { id: 'fab-item-inventory', pid: 'fab_inventory' }
    ];
    fabItems.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.style.display = (role === 'Admin' || role === '管理者' || allowed.includes(item.pid)) ? 'flex' : 'none';
        }
    });

    let html = '';
    const categories = [...new Set(defaultMenuItems.map(item => item.category))];
    
    categories.forEach(cat => {
        const items = defaultMenuItems.filter(item => item.category === cat && !item.hidden);
        const allowedItems = items.filter(item => {
            if (allowed.includes(item.id)) return true;
            // 勤怠管理の特例: サブ機能の権限（直接編集 or 修正申請）があれば表示を許可する
            if (item.id === 'attendance_management') {
                return allowed.includes('attendance_direct_edit') || allowed.includes('attendance_correction_request');
            }
            return false;
        });
        
        if (allowedItems.length > 0) {
            html += `<div class="menu-category">${cat}</div>`;
            allowedItems.forEach(item => {
                let displayName = item.name;
                // 管理者以外で勤怠管理を表示する場合、名称を「勤怠修正申請」に変更する
                if (item.id === 'attendance_management' && !(role === 'Admin' || role === '管理者')) {
                    displayName = '勤怠修正申請';
                }
                html += `
                    <a href="#" class="menu-item ${state.currentPage === item.id ? 'active' : ''}" data-target="${item.id}">
                        <i class="fas ${item.icon}"></i> ${displayName}
                    </a>
                `;
            });
        }
    });

    sidebarMenu.innerHTML = html;

    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            window.navigateTo(e.currentTarget.dataset.target);
        };
    });
}

window.navigateTo = (target, pushToHistory = true) => {
    showPage(target);
    
    // ブラウザ履歴への追加
    if (pushToHistory) {
        history.pushState({ page: target }, "", `?page=${target}`);
    }

    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (window.innerWidth <= 1024) {
        sidebar?.classList.remove('show');
        overlay?.classList.remove('show');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ブラウザの「戻る・進む」ボタンへの対応
window.onpopstate = (event) => {
    if (event.state && event.state.page) {
        showPage(event.state.page);
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        const page = urlParams.get('page') || 'home';
        showPage(page);
    }
};

function showPage(target) {
    state.currentPage = target;
    const pageContent = document.getElementById('page-content');
    const pageTitle = document.getElementById('page-title');
    const pageTitleMobileCentral = document.getElementById('page-title-mobile-central');
    const breadcrumbArea = document.getElementById('breadcrumb-area');
    const backBtn = document.getElementById('header-back-btn');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');

    // モバイル用の中央タイトル更新補助
    const updateHeaderTitle = (title) => {
        if (pageTitle) pageTitle.textContent = title;
        if (pageTitleMobileCentral) pageTitleMobileCentral.textContent = title;
    };
    if (!pageContent || !pageTitle) return;

    // ナビゲーションUIの生成 (パンくず & 戻るボタン)
    renderNavigationUI(target, pageTitle, breadcrumbArea, backBtn, mobileMenuBtn);

    document.querySelectorAll('.menu-item').forEach(el => el.classList.toggle('active', el.dataset.target === target));

    try {
        switch (target) {
            case 'home':
                updateHeaderTitle('メインホーム');
                initHomePage();
                break;
            case 'ops_hub':
                updateHeaderTitle('店舗業務');
                pageContent.innerHTML = hubPageHtml('店舗業務', '店舗運営に必要な日次業務。');
                initHubPage('ops_hub');
                break;
            case 'hr_hub':
                updateHeaderTitle('人事総務業務');
                pageContent.innerHTML = hubPageHtml('人事総務業務', '従業員管理、貸与物、勤怠チェック。');
                initHubPage('hr_hub');
                break;
            case 'master_hub':
                updateHeaderTitle('設定・マスタ');
                pageContent.innerHTML = hubPageHtml('設定・マスタ', 'システム基盤情報の管理。');
                initHubPage('master_hub');
                break;
            case 'dashboard':
                updateHeaderTitle('ダッシュボード');
                pageContent.innerHTML = dashboardPageHtml;
                initDashboardPage();
                break;
            case 'attendance_check':
                updateHeaderTitle('勤怠状況確認');
                pageContent.innerHTML = attendanceCheckPageHtml;
                initAttendanceCheckPage();
                break;
            case 'attendance':
                updateHeaderTitle('勤怠入力');
                pageContent.innerHTML = attendancePageHtml;
                initAttendancePage(state.currentUser);
                break;
            case 'sales':
                updateHeaderTitle('営業実績報告');
                pageContent.innerHTML = salesPageHtml;
                initSalesPage();
                break;
            case 'inventory':
                updateHeaderTitle('在庫チェック');
                pageContent.innerHTML = inventoryPageHtml;
                initInventoryPage(state.currentUser);
                break;
            case 'procurement':
                updateHeaderTitle('仕入れ・仕込み');
                pageContent.innerHTML = procurementPageHtml;
                initProcurementPage(state.currentUser);
                break;
            case 'stocktake':
                updateHeaderTitle('棚卸し履歴');
                pageContent.innerHTML = stocktakePageHtml;
                initStocktakePage(state.currentUser);
                break;
            case 'inventory_history':
                updateHeaderTitle('在庫履歴');
                pageContent.innerHTML = inventoryHistoryPageHtml;
                initInventoryHistoryPage(state.currentUser);
                break;
            case 'stores':
                updateHeaderTitle('店舗マスタ');
                pageContent.innerHTML = storesPageHtml;
                initStoresPage();
                break;
            case 'users':
                updateHeaderTitle('ユーザー登録/変更');
                pageContent.innerHTML = usersPageHtml;
                initUsersPage();
                break;
            case 'products':
                pageTitle.textContent = '商品・レシピマスタ';
                pageContent.innerHTML = productsPageHtml;
                initProductsPage(state.currentUser);
                break;
            case 'suppliers':
                pageTitle.textContent = '業者マスタ管理';
                pageContent.innerHTML = suppliersPageHtml;
                initSuppliersPage();
                break;
            case 'store_items':
                pageTitle.textContent = '店舗別在庫設定';
                pageContent.innerHTML = storeItemsPageHtml;
                initStoreItemsPage();
                break;
            case 'recipe_viewer':
                pageTitle.textContent = 'レシピ閲覧';
                pageContent.innerHTML = recipesViewerPageHtml;
                initRecipesViewerPage();
                break;
            case 'role_permissions':
                pageTitle.textContent = '権限振り分け設定';
                pageContent.innerHTML = rolePermissionsPageHtml;
                initRolePermissionsPage();
                break;
            case 'menu_order':
                pageTitle.textContent = 'メニュー並び順設定';
                pageContent.innerHTML = menuOrderPageHtml;
                initMenuOrderPage();
                break;
            case 'csv_export':
                pageTitle.textContent = 'CSV出力';
                pageContent.innerHTML = csvExportPageHtml;
                initCsvExportPage();
                break;
            case 'sales_correction':
                pageTitle.textContent = '営業実績修正';
                pageContent.innerHTML = salesCorrectionPageHtml;
                initSalesCorrectionPage();
                break;
            case 'product_analysis':
                pageTitle.textContent = '商品分析（4つの窓）';
                pageContent.innerHTML = productAnalysisPageHtml;
                initProductAnalysisPage();
                break;
            case 'csv_import':
                pageTitle.textContent = 'CSVデータインポート';
                pageContent.innerHTML = csvImportPageHtml;
                initCsvImportPage();
                break;
            case 'notifications':
                updateHeaderTitle('通知センター');
                pageContent.innerHTML = notificationsPageHtml;
                initNotificationsPage();
                break;
            case 'calendar_admin':
                pageTitle.textContent = '営業カレンダー作成';
                pageContent.innerHTML = calendarAdminPageHtml;
                initCalendarAdminPage();
                break;
            case 'calendar_viewer':
                pageTitle.textContent = '営業カレンダー';
                pageContent.innerHTML = calendarViewerPageHtml;
                initCalendarViewerPage();
                break;
            case 'goals_admin':
                pageTitle.textContent = '年間ターゲット設定';
                pageContent.innerHTML = goalsAdminPageHtml;
                initGoalsAdminPage();
                break;
            case 'goals_store':
                pageTitle.textContent = '月次按分シミュレーション';
                if (pageTitleMobileCentral) pageTitleMobileCentral.textContent = '月次按分シミュレーション';
                pageContent.innerHTML = goalsStorePageHtml;
                initGoalsStorePage();
                break;
            case 'shift_submission':
                pageTitle.textContent = 'シフト希望提出';
                if (pageTitleMobileCentral) pageTitleMobileCentral.textContent = 'シフト希望提出';
                pageContent.innerHTML = shiftSubmissionPageHtml;
                initShiftSubmissionPage();
                break;
            case 'shift_viewer':
                pageTitle.textContent = '確定シフト閲覧';
                if (pageTitleMobileCentral) pageTitleMobileCentral.textContent = '確定シフト閲覧';
                pageContent.innerHTML = shiftViewerPageHtml;
                initShiftViewerPage();
                break;
            case 'shift_admin':
                pageTitle.textContent = 'シフト作成・調整 (コックピット)';
                if (pageTitleMobileCentral) pageTitleMobileCentral.textContent = 'シフト作成・調整 (コックピット)';
                pageContent.innerHTML = shiftAdminPageHtml;
                initShiftAdminPage();
                break;
            case 'loans':
                pageTitle.textContent = '貸与物管理(アセット)';
                pageContent.innerHTML = loansPageHtml;
                initLoansPage();
                break;
            case 'invite_navi':
                pageTitle.textContent = '従業員への招待案内';
                pageContent.innerHTML = inviteNaviPageHtml;
                initInviteNaviPage();
                break;
            case 'daily_sakes':
                pageTitle.textContent = '日本酒管理';
                pageContent.innerHTML = dailySakesPageHtml;
                initDailySakesPage();
                break;
            case 'attendance_management':
                pageTitle.textContent = '勤怠管理';
                pageContent.innerHTML = attendanceManagementPageHtml;
                initAttendanceManagementPage();
                break;
            case 'bottle_keep':
                pageTitle.textContent = 'ボトルキープ管理';
                pageContent.innerHTML = bottleKeepPageHtml;
                initBottleKeepPage();
                break;
            case 'utility_hub':
                pageTitle.textContent = '便利機能';
                pageContent.innerHTML = hubPageHtml('便利機能', '従業員のナレッジ共有・シミュレーションツール。');
                initHubPage('utility_hub');
                break;
            case 'prototype_menu':
                pageTitle.textContent = 'メニュー試作';
                pageContent.innerHTML = prototypeMenuPageHtml;
                initPrototypeMenuPage();
                break;
            case 'competitor_list':
                pageTitle.textContent = '行きたい店リスト';
                pageContent.innerHTML = competitorListPageHtml;
                initCompetitorListPage();
                break;
        }


        // ページ読み込み完了後にナビゲーションUIを確定
        renderNavigationUI(target, pageTitle, breadcrumbArea, backBtn, mobileMenuBtn);

        // Pull-to-Refresh の初期化
        initPullToRefresh(target);
        
    } catch (err) {

        console.error(err);
        pageContent.innerHTML = '<div style="padding:2rem;color:red;">Error loading page</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. まずログインフォームを最優先でバインドする (不具合再発防止)
    const form = document.getElementById('login-form');
    if (form) {
        form.onsubmit = handleLogin;
    } else {
        console.warn("DOMContentLoaded: #login-form not found.");
    }

    // 2. ログイン状態の確認と自動ログイン
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            if (userData) {
                loginSuccess(userData);
            }
        } catch (e) { 
            console.error("Auto-login error:", e);
            localStorage.removeItem('currentUser'); 
        }
    }

    const btnCalendar = document.getElementById('btn-calendar-viewer');
    if (btnCalendar) btnCalendar.onclick = () => window.navigateTo('calendar_viewer');

    const btnHeaderShift = document.getElementById('btn-header-shift');
    if (btnHeaderShift) {
        btnHeaderShift.onclick = () => {
            const role = state.currentUser?.Role;
            // 店舗タブレット以外は「自分のシフト表」へ直接遷移
            if (role === 'Tablet' || role === '店舗タブレット') return;
            window.navigateTo('shift_viewer');
        };
    }

    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        location.reload();
    });

    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    // Bottom nav logic removed

    const fabBtn = document.getElementById('fab-main-btn');
    const fabMenu = document.getElementById('fab-menu');
    if (fabBtn) {
        fabBtn.onclick = (e) => {
            e.stopPropagation();
            fabMenu.classList.toggle('show');
            fabBtn.querySelector('i').classList.toggle('fa-plus');
            fabBtn.querySelector('i').classList.toggle('fa-times');
        };
    }
    document.addEventListener('click', () => {
        fabMenu?.classList.remove('show');
        if (fabBtn) {
            fabBtn.querySelector('i').classList.add('fa-plus');
            fabBtn.querySelector('i').classList.remove('fa-times');
        }
    });

    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn) mobileBtn.onclick = () => {
        const layout = document.getElementById('dashboard-layout');
        if (window.innerWidth <= 1024) {
            // モバイル：サイドバーのオーバーレイ表示をトグル
            sidebar?.classList.toggle('show');
            overlay?.classList.toggle('show');
        } else {
            // デスクトップ/タブレット：サイドバーの折りたたみをトグル
            layout?.classList.toggle('sidebar-collapsed');
        }
    };

    // スマホ用閲覧集約メニューの制御
    const viewSwitcherBtn = document.getElementById('btn-view-switcher');
    const headerViewMenu = document.getElementById('header-view-menu');
    
    if (viewSwitcherBtn && headerViewMenu) {
        viewSwitcherBtn.onclick = (e) => {
            e.stopPropagation();
            headerViewMenu.classList.toggle('show');
        };

        headerViewMenu.querySelectorAll('.view-menu-item').forEach(item => {
            item.onclick = (e) => {
                const target = e.currentTarget.dataset.target;
                if (target === 'shift_viewer') {
                    const role = state.currentUser?.Role;
                    if (role === 'Tablet' || role === '店舗タブレット') return;
                }
                window.navigateTo(target);
                headerViewMenu.classList.remove('show');
            };
        });

        document.addEventListener('click', (e) => {
            if (!headerViewMenu.contains(e.target) && e.target !== viewSwitcherBtn) {
                headerViewMenu.classList.remove('show');
            }
        });
    }

    overlay?.addEventListener('click', () => {
        sidebar?.classList.remove('show');
        overlay?.classList.remove('show');
    });

    // 管理者連絡モーダル
    const adminModal = document.getElementById('admin-contact-modal');
    document.getElementById('btn-contact-admin')?.addEventListener('click', async () => {
        if (!adminModal) return;
        adminModal.style.display = 'flex';
        const container = document.getElementById('admin-list-container');
        try {
            const snap = await getDocs(collection(db, 'm_users'));
            const admins = [];
            snap.forEach(d => { if (d.data().Role === 'Admin') admins.push(d.data()); });
            container.innerHTML = admins.map(a => `
                <div style="padding:0.9rem 1rem; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:0.8rem;">
                    <div style="width:36px; height:36px; border-radius:50%; background:#fee2e2; color:#e53e3e; display:flex; align-items:center; justify-content:center; font-weight:700;">
                        ${(a.Name || 'A').substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight:600; font-size:0.9rem;">${a.Name || '管理者'}</div>
                        <div style="font-size:0.78rem; color:#64748b;">${a.Store || ''}</div>
                    </div>
                </div>
            `).join('');
        } catch(e) { container.innerHTML = '読み込みエラー'; }
    });
    document.getElementById('close-admin-modal')?.addEventListener('click', () => adminModal.style.display = 'none');

    // FABスクロール透過制御 (モバイル操作性向上)
    const pageContentEl = document.getElementById('page-content');
    const fabContainer = document.querySelector('.fab-container');
    let scrollTimeout;

    if (pageContentEl && fabContainer) {
        pageContentEl.addEventListener('scroll', () => {
            // スクロール中のみクラスを付与
            fabContainer.classList.add('scrolling');
            clearTimeout(scrollTimeout);
            // 停止して200ms後にクラスを除去
            scrollTimeout = setTimeout(() => {
                fabContainer.classList.remove('scrolling');
            }, 200);
        }, { passive: true });
    }
});

function initNotificationBadge() {
    const btnNotify = document.getElementById('btn-notifications');
    if (!btnNotify) return;
    btnNotify.onclick = () => window.navigateTo('notifications');
    
    // 全ユーザーがバッジを見れるように変更 (以前はAdmin限定)
    const user = state.currentUser;
    if (!user) return;

    const q = query(collection(db, "notifications"), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        let badge = document.getElementById('notification-badge');
        const notifs = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        
        // ハイブリッドカウント判定
        const mySid = user.StoreID || user.StoreId;
        const myId = user.id;

        const count = notifs.filter(n => {
            // 1. 店舗フィルタリング (管理者は全件、スタッフは自店舗分のみ)
            const isAuthorized = (user.Role === 'Admin' || user.Role === '管理者' || n.store_id == mySid);
            if (!isAuthorized) return false;

            // 2. タイプ別カウント判定
            if (n.type === 'shift_published') {
                // 既読管理型: 自分のIDが readBy に入っていないものだけカウント
                const readBy = n.readBy || [];
                return !readBy.includes(myId);
            }
            // タスク型 (recipe_missing, deletion_request): pending ならカウント (全共有)
            return true;
        }).length;

        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'notification-badge';
                badge.style.cssText = 'position:absolute; top:-5px; right:-5px; background:var(--danger); color:white; border-radius:10px; padding:2px 6px; font-size:10px; border:2px solid white;';
                btnNotify.style.position = 'relative';
                btnNotify.appendChild(badge);
            }
            badge.textContent = count;
            badge.style.display = 'block';
        } else if (badge) {
            badge.style.display = 'none';
        }
    });
}

/**
 * 画面に応じたナビゲーションUI（戻るボタン・パンくず）を描画する
 */
function renderNavigationUI(target, titleEl, breadcrumbEl, backBtn, menuBtn) {
    if (!breadcrumbEl) return;
    
    // リセット
    breadcrumbEl.innerHTML = '';
    if (backBtn) backBtn.style.display = 'none';
    if (menuBtn) menuBtn.style.display = 'flex';

    if (target === 'home') return;

    const parentHubId = pageParentMap[target];
    const hubLabel = hubLabels[parentHubId] || 'メニュー';
    const isHubPage = target === 'ops_hub' || target === 'hr_hub' || target === 'master_hub';

    // 1. パンくずリスト
    let breadcrumbHTML = `<span onclick="window.navigateTo('home')">ホーム</span>`;
    
    if (isHubPage) {
        breadcrumbHTML += ` <i class="fas fa-chevron-right"></i> <span>${hubLabels[target] || titleEl.textContent}</span>`;
    } else if (parentHubId) {
        const spanText = titleEl.querySelector('span')?.textContent;
        const firstNodeText = titleEl.firstChild?.nodeType === 3 ? titleEl.firstChild.textContent : titleEl.textContent;
        const cleanTitle = (spanText || firstNodeText || "").trim().split('\n')[0];
        
        breadcrumbHTML += ` <i class="fas fa-chevron-right"></i> <span onclick="window.navigateTo('${parentHubId}')">${hubLabel}</span>`;
        breadcrumbHTML += ` <i class="fas fa-chevron-right"></i> <span>${cleanTitle}</span>`;

        // 2. 戻るボタンの制御 (サブ機能のみ)
        if (backBtn && window.innerWidth <= 1024) {
            backBtn.style.display = 'flex';
            if (menuBtn) menuBtn.style.display = 'none'; // スペース確保のためハンバーガーを隠す
            backBtn.onclick = () => window.navigateTo(parentHubId);
        }
    }
    
    breadcrumbEl.innerHTML = breadcrumbHTML;
    
    // スマホ用パンくずの更新
    const mobileBreadcrumbEl = document.getElementById('mobile-breadcrumb-area');
    if (mobileBreadcrumbEl) {
        mobileBreadcrumbEl.innerHTML = breadcrumbHTML;
    }
}

// --- モバイル専用グローバルハンドラー (HTMLのonclickから直接呼び出し) ---
window.handleMobileMenuClick = function(e) {
    if (e) e.stopPropagation();
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('show');
    }
};

window.handleMobileNotifyClick = function(e) {
    if (e) e.stopPropagation();
    if (window.navigateTo) window.navigateTo('notifications');
};

window.handleMobileSwitcherClick = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('header-view-menu');
    if (menu) {
        menu.classList.toggle('show');
    }
};

window.handleDocumentClick = function(e) {
    // サイドバーの外をタップしたら閉じる (スマホ版のみ)
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('show') && !sidebar.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    }
    
    // スイッチャーメニューの外をタップしたら閉じる
    const menu = document.getElementById('header-view-menu');
    if (menu && menu.classList.contains('show') && !menu.contains(e.target)) {
        menu.classList.remove('show');
    }
};

// モバイル専用ヘッダーボタンのイベント紐付け (Filmarks Style)
function initMobileHeaderEvents() {
    const pageTitleMobileCentral = document.getElementById('page-title-mobile-central');
    const pageTitle = document.getElementById('page-title');
    
    // 画面外タップの監視のみJSで追加
    document.removeEventListener('click', window.handleDocumentClick);
    document.addEventListener('click', window.handleDocumentClick);

    // タイトル同期
    if (pageTitleMobileCentral && state.currentPage) {
        const titles = { 
            'home': 'メインホーム', 'ops_hub': '店舗業務', 'hr_hub': '人事総務業務', 
            'master_hub': 'マスタ管理', 'system_hub': 'システム設定', 'prototype_menu': 'メニュー試作'
        };
        pageTitleMobileCentral.textContent = titles[state.currentPage] || (pageTitle ? pageTitle.textContent : '');
    }
}
window.initMobileHeaderEvents = initMobileHeaderEvents;

// DOMContentLoaded時に実行
document.addEventListener('DOMContentLoaded', () => {
    if (window.initMobileHeaderEvents) window.initMobileHeaderEvents();
    
    // 初回のPTR初期化
    const state = window.appState;
    if (state && !state.ptr) {
        initPullToRefresh(state.currentPage);
    }
});

/**
 * Pull-to-Refresh の初期化とコールバック登録
 */
function initPullToRefresh(pageId) {
    const state = window.appState;
    if (!state) return;

    // メインホーム画面以外では機能させない（既存のインジケーターがあれば削除）
    if (pageId !== 'home') {
        const old = document.getElementById('ptr-indicator');
        if (old) old.remove();
        return;
    }

    // 既存のPTRインスタンスがあればUIレイヤーだけ再初期化
    if (state.ptr) {
        state.ptr.initUI();
    } else {
        state.ptr = new PullToRefresh('page-content', {
            threshold: 70,
            onRefresh: async () => {
                const currentPage = state.currentPage;
                console.log(`Refreshing page: ${currentPage}`);
                
                try {
                    if (currentPage === 'home') {
                        // ホーム画面は「データ更新のみ」を行い、ユーザー体験を優先
                        const { initHomePage } = await import('./home.js?v=' + Date.now());
                        await initHomePage();
                    } else {
                        // ホーム以外でここに来ることは無いはずだが、念のためのリロード
                        location.reload();
                    }
                } catch (e) {
                    console.error("Manual refresh failed, falling back to reload.", e);
                    location.reload();
                }
            }
        });
    }
}
