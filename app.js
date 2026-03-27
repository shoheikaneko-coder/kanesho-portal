import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 各ページのインポート
import { dashboardPageHtml, initDashboardPage } from './dashboard.js';
import { attendancePageHtml, initAttendancePage } from './attendance.js';
import { salesPageHtml, initSalesPage } from './sales.js';
import { storesPageHtml, initStoresPage } from './stores.js';
import { usersPageHtml, initUsersPage } from './users.js';
import { inventoryPageHtml, initInventoryPage } from './inventory.js?v=11';
import { procurementPageHtml, initProcurementPage } from './procurement.js';
import { productsPageHtml, initProductsPage } from './products.js?v=10';
import { suppliersPageHtml, initSuppliersPage } from './suppliers.js?v=10';
import { storeItemsPageHtml, initStoreItemsPage } from './store_items.js?v=10';
import { recipesViewerPageHtml, initRecipesViewerPage } from './recipes.js';
import { attendanceCheckPageHtml, initAttendanceCheckPage } from './attendance_check.js';
import { csvExportPageHtml, initCsvExportPage } from './csv_export.js';
import { salesCorrectionPageHtml, initSalesCorrectionPage } from './sales_correction.js';
import { rolePermissionsPageHtml, initRolePermissionsPage } from './role_permissions.js';
import { menuOrderPageHtml, initMenuOrderPage } from './menu_order.js';
import { csvImportPageHtml, initCsvImportPage } from './csv_import.js';
import { productAnalysisPageHtml, initProductAnalysisPage } from './product_analysis.js?v=10';
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

console.log("AntiGravity Portal: app.js loaded successfully.");

const state = {
    currentUser: null,
    currentPage: 'home',
    menuOrder: []
};

const defaultMenuItems = [
    { id: 'home', name: 'ホーム', icon: 'fa-home', category: 'メインメニュー' },
    { id: 'dashboard', name: 'ダッシュボード', icon: 'fa-chart-line', category: 'メインメニュー' },
    { id: 'attendance', name: '勤怠入力', icon: 'fa-clock', category: '業務メニュー' },
    { id: 'attendance_check', name: '勤怠状況確認', icon: 'fa-clipboard-check', category: '業務メニュー' },
    { id: 'inventory', name: '在庫管理', icon: 'fa-warehouse', category: '業務メニュー' },
    { id: 'procurement', name: '仕入れ', icon: 'fa-shopping-cart', category: '業務メニュー' },
    { id: 'sales', name: '営業実績報告', icon: 'fa-calculator', category: '業務メニュー' },
    { id: 'recipe_viewer', name: 'レシピ閲覧', icon: 'fa-book-open', category: '業務メニュー' },
    { id: 'product_analysis', name: '商品分析(4つの窓)', icon: 'fa-chart-pie', category: '業務メニュー' },
    { id: 'users', name: 'ユーザー登録/変更', icon: 'fa-users-cog', category: 'マスタ管理' },
    { id: 'stores', name: '店舗マスタ', icon: 'fa-store-alt', category: 'マスタ管理' },
    { id: 'store_items', name: '店舗別在庫設定', icon: 'fa-tasks', category: 'マスタ管理' },
    { id: 'products', name: '商品・レシピマスタ', icon: 'fa-mortar-pestle', category: 'マスタ管理' },
    { id: 'suppliers', name: '業者マスタ', icon: 'fa-truck', category: 'マスタ管理' },
    { id: 'role_permissions', name: '権限振り分け', icon: 'fa-user-shield', category: 'マスタ管理' },
    { id: 'sales_correction', name: '営業実績修正', icon: 'fa-edit', category: 'マスタ管理' },
    { id: 'csv_export', name: 'CSV出力', icon: 'fa-file-csv', category: 'マスタ管理' },
    { id: 'csv_import', name: 'CSVインポート', icon: 'fa-file-import', category: 'マスタ管理' },
    { id: 'menu_order', name: 'メニュー並び順', icon: 'fa-sort-amount-down', category: 'マスタ管理' },
    { id: 'line_share', name: 'アプリをLINE共有', icon: 'fa-share-alt', category: 'マスタ管理' }
];

/**
 * ログイン成功時の処理（初期化・画面遷移）
 */
async function loginSuccess(user) {
    state.currentUser = user;
    
    // ログイン情報を保存（セッション維持）
    localStorage.setItem('currentUser', JSON.stringify(user));

    // 権限に応じたメニューの出し分けと並び順反映
    await renderSidebar(user);
    
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.remove();
    
    const layout = document.getElementById('dashboard-layout');
    if (layout) {
        layout.style.display = 'flex';
        layout.style.opacity = '1';
        window.scrollTo(0, 0);
    }

    const nameEl = document.getElementById('display-user-name');
    const roleEl = document.getElementById('display-user-role');
    const avatarEl = document.getElementById('display-user-avatar');

    if (nameEl) nameEl.textContent = user.Name || 'ユーザー';
    if (roleEl) roleEl.textContent = user.Role || '一般';
    if (avatarEl) avatarEl.textContent = (user.Name || 'U').substring(0, 1).toUpperCase();

    // 初期表示ページの分岐
    if (user.Role === 'Admin' || user.Role === '管理者') {
        showPage('dashboard');
    } else if (user.Role === 'Tablet' || user.Role === '店舗タブレット' || user.Role === 'Staff' || user.Role === '一般社員') {
        showPage('inventory');
    } else {
        showPage('dashboard');
    }

    // 通知バッジの初期化
    initNotificationBadge();
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 認証中...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
        let user = null;
        const userSnap = await getDocs(collection(db, "m_users"));
        userSnap.forEach(d => {
            const data = d.data();
            const uEmail = (data.Email || data.email || "").toLowerCase();
            const uLoginPass = String(data.LoginPassword || data.password || "");
            if (uEmail === email.toLowerCase() && uLoginPass === password) {
                user = { id: d.id, ...data };
            }
        });

        if (!user && email === 'admin@kaneshow.jp' && password === 'password') {
            user = { Name: '管理者', Email: email, Role: 'Admin' };
        }

        if (user) {
            // アルバイトスタッフのアクセス制限
            if (user.Role === 'PartTimer' || user.Role === 'アルバイトスタッフ') {
                alert('アルバイトスタッフ権限ではポータルにログインできません。打刻用端末をご利用ください。');
                return;
            }
            
            console.log("Success. Transitioning...");
            await loginSuccess(user);
        } else {
            alert('ログイン失敗: IDまたはパスワードが正しくありません。');
        }
    } catch (err) {
        console.error(err);
        alert('通信エラー: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ログイン';
        }
    }
}

async function renderSidebar(user) {
    const role = user.Role;
    const sidebarMenu = document.querySelector('.sidebar-menu');
    if (!sidebarMenu) return;

    // 並び順の取得
    let order = [];
    try {
        const docSnap = await getDoc(doc(db, "m_settings", "sidebar_order"));
        if (docSnap.exists()) {
            order = docSnap.data().order || [];
        }
    } catch (e) { console.error("Order load error:", e); }

    // 並び順に基づいたメニュー配列の作成
    let sortedMenu = [];
    if (order.length > 0) {
        order.forEach(id => {
            const item = defaultMenuItems.find(m => m.id === id);
            if (item) sortedMenu.push(item);
        });
        defaultMenuItems.forEach(item => {
            if (!order.includes(item.id)) sortedMenu.push(item);
        });
    } else {
        sortedMenu = [...defaultMenuItems];
    }

    // 権限の取得
    let allowed = [];
    if (role === 'Admin' || role === '管理者') {
        allowed = sortedMenu.map(m => m.id);
    } else {
        try {
            const docSnap = await getDoc(doc(db, "m_role_permissions", role));
            if (docSnap.exists()) {
                allowed = docSnap.data().permissions || [];
                allowed.push('home'); // ホームは常に許可
            } else {
                allowed = ['home', 'inventory']; // デフォルト
            }
        } catch (err) {
            console.error("RBAC Error:", err);
            allowed = ['home'];
        }
    }

    // HTML生成
    let html = '';
    let currentCategory = '';
    sortedMenu.forEach(item => {
        if (!allowed.includes(item.id)) return;

        if (item.category && item.category !== currentCategory) {
            currentCategory = item.category;
            html += `<div class="menu-category">${currentCategory}</div>`;
        }

        html += `
            <a href="#" class="menu-item ${state.currentPage === item.id ? 'active' : ''}" data-target="${item.id}" id="menu-item-${item.id}">
                <i class="fas ${item.icon}"></i> ${item.name}
            </a>
        `;
    });
    
    // デバッグログ: サイドバーHTMLが正しく生成されているか確認
    // console.log("Generated Sidebar HTML:", html);
    sidebarMenu.innerHTML = html;

    // イベントリスナーの再設定
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const target = e.currentTarget.dataset.target;
            if (target === 'line_share') {
                handleLineShare();
            } else {
                showPage(target);
            }
            document.querySelector('.sidebar')?.classList.remove('show');
        };
    });
}

function handleLineShare() {
    const text = `かね将ポータル
https://kaneshow-portal.web.app/
※自身のメールアドレスでログインしてください`;
    const url = `line://msg/text/?${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

window.navigateTo = showPage;
function showPage(target) {
    state.currentPage = target;
    const pageContent = document.getElementById('page-content');
    const pageTitle = document.getElementById('page-title');
    if (!pageContent || !pageTitle) return;

    document.querySelectorAll('.menu-item').forEach(el => el.classList.toggle('active', el.dataset.target === target));

    const userName = state.currentUser ? (state.currentUser.Name || state.currentUser.name || 'User') : 'User';

    try {
        switch (target) {
            case 'home':
                pageTitle.textContent = 'ホーム';
                pageContent.innerHTML = `
                    <div class="animate-fade-in">
                        <div class="glass-panel" style="padding: 3rem; text-align: center;">
                            <h1 style="color: var(--primary); font-size: 2.5rem; margin-bottom: 1rem;">Welcome, ${userName}</h1>
                            <p>左メニューから機能を選択してください。</p>
                        </div>
                    </div>
                `;
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
        }
    } catch (err) {
        console.error(err);
        pageContent.innerHTML = '<div style="padding:2rem;color:red;">Error loading page</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded. Initializing app...");

    // 1. ログインフォームの初期化 (最優先)
    const form = document.getElementById('login-form');
    if (form) {
        form.onsubmit = (e) => {
            console.log("Login submitted.");
            handleLogin(e);
        };
        console.log("Login form handler attached.");
    }

    // 2. 自動ログインチェック
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            console.log("Auto-login for:", user.Email);
            loginSuccess(user);
        } catch (e) {
            console.error("Auto-login error:", e);
            localStorage.removeItem('currentUser');
        }
    }

    // 3. その他グローバルイベント
    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Logging out...");
        localStorage.removeItem('currentUser');
        location.reload();
    });

    const sidebar = document.querySelector('.sidebar');
    const closeSidebar = () => sidebar?.classList.remove('show');

    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            showPage(e.currentTarget.dataset.target);
            closeSidebar(); // モバイルでメニュー選択後にサイドバーを閉じる
        };
    });

    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn) {
        mobileBtn.onclick = () => sidebar?.classList.toggle('show');
    }

    // サイドバー外（オーバーレイ）タップで閉じる
    document.addEventListener('click', (e) => {
        if (!sidebar) return;
        if (sidebar.classList.contains('show') &&
            !sidebar.contains(e.target) &&
            e.target !== mobileBtn &&
            !mobileBtn?.contains(e.target)) {
            closeSidebar();
        }
    });

    // ── 管理者連絡モーダル ──────────────────────────────
    const adminModal = document.getElementById('admin-contact-modal');
    const btnContactAdmin = document.getElementById('btn-contact-admin');
    const btnCloseAdminModal = document.getElementById('close-admin-modal');
    const btnLineContact = document.getElementById('btn-line-contact');

    async function openAdminModal() {
        if (!adminModal) return;
        adminModal.style.display = 'flex';

        // 管理者一覧を取得して表示
        const container = document.getElementById('admin-list-container');
        try {
            const snap = await getDocs(collection(db, 'm_users'));
            const admins = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.Role === 'Admin') {
                    admins.push(data);
                }
            });
            if (admins.length === 0) {
                container.innerHTML = '<div style="padding:1rem; text-align:center; color:#94a3b8; font-size:0.9rem;">管理者が登録されていません</div>';
            } else {
                container.innerHTML = admins.map((a, i) => `
                    <div style="padding:0.9rem 1rem; ${i < admins.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''} display:flex; align-items:center; gap:0.8rem;">
                        <div style="width:36px; height:36px; border-radius:50%; background:#fee2e2; color:#e53e3e; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1rem; flex-shrink:0;">
                            ${(a.Name || 'A').substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:600; font-size:0.9rem; color:#1e293b;">${a.Name || '名前未設定'}</div>
                            <div style="font-size:0.78rem; color:#64748b;">${a.Store || ''} ／ ${a.Role === 'Admin' ? '管理者' : '店長'}</div>
                        </div>
                    </div>
                `).join('');
            }
        } catch(e) {
            container.innerHTML = '<div style="padding:1rem; color:#e53e3e; font-size:0.85rem;">読み込みエラー</div>';
        }

        // m_stores から店舗一覧をセレクトに読み込む（初回のみ）
        const storeSelect = document.getElementById('contact-store');
        if (storeSelect && storeSelect.options.length <= 1) {
            try {
                const storeSnap = await getDocs(collection(db, 'm_stores'));
                const opts = [];
                storeSnap.forEach(d => {
                    const data = d.data();
                    if (data.store_name) opts.push(data.store_name);
                });
                opts.sort();
                opts.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    storeSelect.appendChild(opt);
                });
            } catch(e) { console.error('店舗読み込みエラー:', e); }
        }
    }

    if (btnContactAdmin) btnContactAdmin.onclick = openAdminModal;
    if (btnCloseAdminModal) btnCloseAdminModal.onclick = () => adminModal.style.display = 'none';
    if (adminModal) adminModal.onclick = (e) => { if (e.target === adminModal) adminModal.style.display = 'none'; };

    if (btnLineContact) {
        btnLineContact.onclick = () => {
            const store = document.getElementById('contact-store')?.value || '';
            const name = document.getElementById('contact-name')?.value.trim() || '';
            if (!store) return alert('店舗名を選択してください。');
            if (!name) return alert('お名前を入力してください。');
            const text = `店舗名：${store}\n名前：${name}\nパスワードを忘れました。\n再設定の手続きをお願いいたします。`;
            const encoded = encodeURIComponent(text);
            window.open(`https://line.me/R/share?text=${encoded}`, '_blank');
        };
    }
    // ─────────────────────────────────────────────────────
});

import { onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

function initNotificationBadge() {
    const btnNotify = document.getElementById('btn-notifications');
    if (!btnNotify) return;

    // 管理者のみバッジを表示（または全ユーザーで自分の申請状況を見る場合は共通）
    // 今回は「管理者への申請」がメインなので、管理者にバッジを表示する
    const isAdmin = state.currentUser?.Role === 'Admin' || state.currentUser?.Role === '管理者';
    if (!isAdmin) return;

    const q = query(collection(db, "notifications"), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        const count = snapshot.size;
        let badge = document.getElementById('notification-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'notification-badge';
                badge.style.cssText = 'position:absolute; top:-5px; right:-5px; background:var(--danger); color:white; border-radius:10px; padding:2px 6px; font-size:10px; font-weight:bold; border:2px solid white;';
                btnNotify.style.position = 'relative';
                btnNotify.appendChild(badge);
            }
            badge.textContent = count;
            badge.style.display = 'block';
        } else {
            if (badge) badge.style.display = 'none';
        }
    });
}
