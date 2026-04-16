import { db } from './firebase.js';
import { collection, getDocs, query, where, getDoc, doc, updateDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 各ページのインポート
import { dashboardPageHtml, initDashboardPage } from './dashboard.js?v=6';
import { attendancePageHtml, initAttendancePage } from './attendance.js?v=6';
import { salesPageHtml, initSalesPage } from './sales.js?v=6';
import { storesPageHtml, initStoresPage } from './stores.js?v=30';
import { usersPageHtml, initUsersPage } from './users.js?v=30';
import { inventoryPageHtml, initInventoryPage } from './inventory.js?v=30';
import { procurementPageHtml, initProcurementPage } from './procurement.js?v=6';
import { productsPageHtml, initProductsPage } from './products.js?v=60';
import { suppliersPageHtml, initSuppliersPage } from './suppliers.js?v=35';
import { storeItemsPageHtml, initStoreItemsPage } from './store_items.js?v=30';
import { recipesViewerPageHtml, initRecipesViewerPage } from './recipes.js?v=6';
import { attendanceCheckPageHtml, initAttendanceCheckPage } from './attendance_check.js?v=6';
import { csvExportPageHtml, initCsvExportPage } from './csv_export.js?v=6';
import { salesCorrectionPageHtml, initSalesCorrectionPage } from './sales_correction.js?v=6';
import { rolePermissionsPageHtml, initRolePermissionsPage } from './role_permissions.js?v=6';
import { menuOrderPageHtml, initMenuOrderPage } from './menu_order.js?v=6';
import { dailySakesPageHtml, initDailySakesPage } from './daily_sakes.js';
import { csvImportPageHtml, initCsvImportPage } from './csv_import.js?v=6';
import { productAnalysisPageHtml, initProductAnalysisPage } from './product_analysis.js?v=30';
import { notificationsPageHtml, initNotificationsPage } from './notifications.js?v=6';
import { calendarAdminPageHtml, initCalendarAdminPage, calendarViewerPageHtml, initCalendarViewerPage } from './calendar.js?v=62';
import { goalsAdminPageHtml, initGoalsAdminPage, goalsStorePageHtml, initGoalsStorePage } from './goals.js?v=6';
import { homePageHtml, initHomePage } from './home.js?v=6';
import { shiftSubmissionPageHtml, initShiftSubmissionPage, shiftAdminPageHtml, initShiftAdminPage, shiftViewerPageHtml, initShiftViewerPage, checkIfShiftPublished } from './shift.js?v=71';
import { loansPageHtml, initLoansPage } from './loans.js';
import { hubPageHtml, initHubPage } from './hubs.js';
import { inviteNaviPageHtml, initInviteNaviPage } from './invite_navi.js';

console.log("AntiGravity Portal: app.js loaded successfully.");

const state = {
    currentUser: null,
    currentPage: 'home',
    permissions: [],
    menuOrder: []
};
window.appState = state;

const defaultMenuItems = [
    { id: 'home', name: 'メインホーム', icon: 'fa-home', category: 'ハブ' },
    { id: 'ops_hub', name: '店舗業務', icon: 'fa-store', category: 'ハブ' },
    { id: 'hr_hub', name: '人事総務業務', icon: 'fa-user-friends', category: 'ハブ' },
    { id: 'master_hub', name: '設定', icon: 'fa-cog', category: 'ハブ' },
    
    { id: 'dashboard', name: '分析ダッシュボード', icon: 'fa-chart-line', category: 'サブ機能' },
    { id: 'shift_submission', name: 'シフト提出・確認', icon: 'fa-calendar-alt', category: 'サブ機能' },
    { id: 'shift_admin', name: 'シフト作成・調整', icon: 'fa-user-edit', category: 'サブ機能' },
    { id: 'recipe_viewer', name: 'レシピ閲覧', icon: 'fa-book-open', category: 'サブ機能' },
    { id: 'daily_sakes', name: '日本酒管理', icon: 'fa-wine-glass-alt', category: 'サブ機能' },
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
    'master_hub': '設定'
};

/**
 * ページIDと親ハブの紐付けマッピング
 */
const pageParentMap = {
    'dashboard': 'ops_hub',
    'attendance': 'ops_hub',
    'sales': 'ops_hub',
    'inventory': 'ops_hub',
    'procurement': 'ops_hub',
    'recipe_viewer': 'ops_hub',
    'menu_order': 'ops_hub',
    'calendar_viewer': 'ops_hub',
    'daily_sakes': 'ops_hub',
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
    'goals_store': 'ops_hub'
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
            user = { Name: '管理者', Email: email, Role: 'Admin' };
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
        const adminPerms = ['sales','attendance','inventory','procurement','product_analysis','home_performance','shift_admin','shift_submission','attendance_check','users','invite_navi','loans','role_permissions','stores','products','suppliers','sales_correction','csv_export','csv_import','calendar_admin','goals_admin','goals_store','line_share','daily_sakes'];
        adminPerms.forEach(id => { if (!allowed.includes(id)) allowed.push(id); });
    } else {
        try {
            const docSnap = await getDoc(doc(db, "m_role_permissions", role));
            if (docSnap.exists()) {
                allowed = docSnap.data().permissions || [];
            }
        } catch (e) {
            console.error("Permission check failed:", e);
        }
    }
    
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
        const allowedItems = items.filter(item => allowed.includes(item.id));
        
        if (allowedItems.length > 0) {
            html += `<div class="menu-category">${cat}</div>`;
            allowedItems.forEach(item => {
                html += `
                    <a href="#" class="menu-item ${state.currentPage === item.id ? 'active' : ''}" data-target="${item.id}">
                        <i class="fas ${item.icon}"></i> ${item.name}
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
    
    document.querySelectorAll('.bottom-nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.target === target);
    });
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
    const breadcrumbArea = document.getElementById('breadcrumb-area');
    const backSlot = document.getElementById('header-back-slot');
    if (!pageContent || !pageTitle) return;

    // ナビゲーションUIの生成 (パンくず & 戻るボタン)
    renderNavigationUI(target, pageTitle, breadcrumbArea, backSlot);

    document.querySelectorAll('.menu-item').forEach(el => el.classList.toggle('active', el.dataset.target === target));

    try {
        switch (target) {
            case 'home':
                pageTitle.textContent = 'メインホーム';
                pageContent.innerHTML = homePageHtml;
                initHomePage();
                break;
            case 'ops_hub':
                pageTitle.textContent = '店舗業務';
                pageContent.innerHTML = hubPageHtml('店舗業務', '店舗運営に必要な日次業務。');
                initHubPage('ops_hub');
                break;
            case 'hr_hub':
                pageTitle.textContent = '人事総務業務';
                pageContent.innerHTML = hubPageHtml('人事総務業務', '従業員管理、貸与物、勤怠チェック。');
                initHubPage('hr_hub');
                break;
            case 'master_hub':
                pageTitle.textContent = '設定・マスタ';
                pageContent.innerHTML = hubPageHtml('設定・マスタ', 'システム基盤情報の管理。');
                initHubPage('master_hub');
                break;
            case 'dashboard':
                pageTitle.textContent = 'ダッシュボード';
                pageContent.innerHTML = dashboardPageHtml;
                initDashboardPage();
                break;
            case 'attendance_check':
                pageTitle.textContent = '勤怠状況確認';
                pageContent.innerHTML = attendanceCheckPageHtml;
                initAttendanceCheckPage();
                break;
            case 'attendance':
                pageTitle.textContent = '勤怠入力';
                pageContent.innerHTML = attendancePageHtml;
                initAttendancePage(state.currentUser);
                break;
            case 'sales':
                pageTitle.textContent = '営業実績報告';
                pageContent.innerHTML = salesPageHtml;
                initSalesPage();
                break;
            case 'inventory':
                pageTitle.textContent = '在庫管理';
                pageContent.innerHTML = inventoryPageHtml;
                initInventoryPage(state.currentUser);
                break;
            case 'procurement':
                pageTitle.textContent = '仕入れ履歴';
                pageContent.innerHTML = procurementPageHtml;
                initProcurementPage();
                break;
            case 'stores':
                pageTitle.textContent = '店舗マスタ';
                pageContent.innerHTML = storesPageHtml;
                initStoresPage();
                break;
            case 'users':
                pageTitle.textContent = 'ユーザー登録/変更';
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
                pageTitle.textContent = '通知センター';
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
                pageContent.innerHTML = goalsStorePageHtml;
                initGoalsStorePage();
                break;
            case 'shift_submission':
                pageTitle.textContent = 'シフト希望提出';
                pageContent.innerHTML = shiftSubmissionPageHtml;
                initShiftSubmissionPage();
                break;
            case 'shift_viewer':
                pageTitle.textContent = '確定シフト閲覧';
                pageContent.innerHTML = shiftViewerPageHtml;
                initShiftViewerPage();
                break;
            case 'shift_admin':
                pageTitle.textContent = 'シフト作成・調整 (コックピット)';
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
        }

        // ページ読み込み完了後にナビゲーションUIを確定
        renderNavigationUI(target, pageTitle, breadcrumbArea);
        
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
    
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.onclick = (e) => {
            if (e.currentTarget.id === 'btn-mobile-menu') {
                sidebar?.classList.toggle('show');
                overlay?.classList.toggle('show');
            } else {
                window.navigateTo(e.currentTarget.dataset.target);
            }
        };
    });

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
    if (state.currentUser?.Role !== 'Admin') return;
    const q = query(collection(db, "notifications"), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        let badge = document.getElementById('notification-badge');
        if (snapshot.size > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'notification-badge';
                badge.style.cssText = 'position:absolute; top:-5px; right:-5px; background:var(--danger); color:white; border-radius:10px; padding:2px 6px; font-size:10px; border:2px solid white;';
                btnNotify.style.position = 'relative';
                btnNotify.appendChild(badge);
            }
            badge.textContent = snapshot.size;
            badge.style.display = 'block';
        } else if (badge) badge.style.display = 'none';
    });
}

/**
 * 画面に応じたナビゲーションUI（戻るボタン・パンくず）を描画する
 */
function renderNavigationUI(target, titleEl, breadcrumbEl) {
    if (!breadcrumbEl) return;
    
    // リセット
    breadcrumbEl.innerHTML = '';

    if (target === 'home') {
        // ホーム画面は何も表示しない
        return;
    }

    const parentHubId = pageParentMap[target];
    const hubLabel = hubLabels[parentHubId] || 'メニュー';
    const isHubPage = target === 'ops_hub' || target === 'hr_hub' || target === 'master_hub';

    // 1. パンくずリストの生成
    let breadcrumbHTML = `<span onclick="window.navigateTo('home')">ホーム</span>`;
    
    if (isHubPage) {
        // ハブページ自身の場合は「ホーム > 現在のハブ」
        breadcrumbHTML += ` <i class="fas fa-chevron-right"></i> <span>${hubLabels[target] || titleEl.textContent}</span>`;
    } else if (parentHubId) {
        // サブ機能の場合は「ホーム > ハブ > 現在の機能」
        breadcrumbHTML += ` <i class="fas fa-chevron-right"></i> <span onclick="window.navigateTo('${parentHubId}')">${hubLabel}</span>`;
        breadcrumbHTML += ` <i class="fas fa-chevron-right"></i> <span>${titleEl.textContent}</span>`;
    }
    
    breadcrumbEl.innerHTML = breadcrumbHTML;
}
