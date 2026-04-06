import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert } from './ui_utils.js';

export const notificationsPageHtml = `
    <div id="notifications-container" class="animate-fade-in">
        <!-- Dashboard Category View -->
        <div id="notifications-categories" class="notifications-grid">
            <div class="notification-category-card recipe-card" id="cat-recipe-missing">
                <div class="category-icon">
                    <i class="fas fa-utensils"></i>
                </div>
                <div class="category-info">
                    <h3>レシピ未登録</h3>
                    <p>CSVインポートされた新規メニューのレシピ登録が必要です</p>
                    <div class="category-status">
                        <span class="count-badge" id="count-recipe-missing">0件</span>
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>

            <div class="notification-category-card info-card" id="cat-shift-published">
                <div class="category-icon">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <div class="category-info">
                    <h3>シフト公開</h3>
                    <p>店長によって確定・公開された最新のシフト情報です</p>
                    <div class="category-status">
                        <span class="count-badge" id="count-shift-published" style="background:var(--secondary);">0件</span>
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>

            <div class="notification-category-card task-card disabled">
                <div class="category-icon">
                    <i class="fas fa-calendar-check"></i>
                </div>
                <div class="category-info">
                    <h3>今月のタスク</h3>
                    <p>（将来の拡張：棚卸しリマインドなど）</p>
                    <div class="category-status">
                        <span class="count-badge gray">0件</span>
                        <i class="fas fa-lock" style="font-size: 0.8rem;"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detailed List View (Hidden by default) -->
        <div id="notifications-detail" style="display: none;">
            <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem;">
                <button id="btn-notif-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h3 id="detail-title" style="margin: 0; font-size: 1.25rem;">レシピ未登録リスト</h3>
            </div>
            
            <div class="glass-panel" style="padding: 0; overflow: hidden;">
                <div id="notif-list-body">
                    <!-- List items injected here -->
                </div>
            </div>
        </div>
    </div>

    <style>
        .notifications-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.5rem;
            margin-top: 1rem;
        }

        .notification-category-card {
            background: white;
            border-radius: 20px;
            padding: 1.5rem;
            display: flex;
            gap: 1.2rem;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(0,0,0,0.05);
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            position: relative;
            overflow: hidden;
        }

        .notification-category-card:hover:not(.disabled) {
            transform: translateY(-5px);
            box-shadow: 0 12px 20px -5px rgba(0,0,0,0.1);
            border-color: var(--primary);
        }

        .notification-category-card.disabled {
            opacity: 0.6;
            cursor: not-allowed;
            background: #f8fafc;
        }

        .category-icon {
            width: 56px;
            height: 56px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            flex-shrink: 0;
        }

        .recipe-card .category-icon { background: #fee2e2; color: #ef4444; }
        .info-card .category-icon { background: #e0f2fe; color: #0ea5e9; }
        .task-card .category-icon { background: #f0fdf4; color: #10b981; }

        .category-info { flex: 1; }
        .category-info h3 { margin: 0 0 0.4rem 0; font-size: 1.1rem; color: #1e293b; }
        .category-info p { margin: 0 0 1.2rem 0; font-size: 0.85rem; color: #64748b; line-height: 1.4; }
        
        .category-status {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 0.8rem;
            border-top: 1px solid #f1f5f9;
        }

        .count-badge {
            background: #ef4444;
            color: white;
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 700;
        }

        .count-badge.gray { background: #94a3b8; }

        .notif-item {
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.2s;
        }

        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: #f8fafc; }

        .notif-main-info { display: flex; flex-direction: column; gap: 0.3rem; }
        .notif-menu-name { font-weight: 800; color: #1e293b; font-size: 1rem; }
        .notif-meta { font-size: 0.75rem; color: #64748b; display: flex; gap: 0.8rem; align-items: center; }
        
        .btn-register-notif {
            background: var(--primary);
            color: white;
            border: none;
            padding: 0.6rem 1.2rem;
            border-radius: 8px;
            font-weight: 700;
            font-size: 0.85rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            transition: opacity 0.2s;
        }

        .btn-register-notif:hover { opacity: 0.9; }
    </style>
`;

let unsubscribeNotifs = null;

export function initNotificationsPage() {
    const catRecipe = document.getElementById('cat-recipe-missing');
    const catShift = document.getElementById('cat-shift-published');
    const btnBack = document.getElementById('btn-notif-back');
    const panelCategories = document.getElementById('notifications-categories');
    const panelDetail = document.getElementById('notifications-detail');
    const user = JSON.parse(localStorage.getItem('currentUser'));

    if (catRecipe) {
        catRecipe.onclick = () => {
            panelCategories.style.display = 'none';
            panelDetail.style.display = 'block';
            document.getElementById('detail-title').textContent = 'レシピ未登録リスト';
            loadDetails('recipe_missing');
        };
    }

    if (catShift) {
        catShift.onclick = () => {
            panelCategories.style.display = 'none';
            panelDetail.style.display = 'block';
            document.getElementById('detail-title').textContent = 'シフト公開通知';
            loadDetails('shift_published');
        };
    }

    if (btnBack) {
        btnBack.onclick = () => {
            panelDetail.style.display = 'none';
            panelCategories.style.display = 'grid';
        };
    }

    // クリーンアップ
    if (unsubscribeNotifs) unsubscribeNotifs();

    // リアルタイム監視（件数更新用）
    const q = query(collection(db, "notifications"), where("status", "==", "pending"));
    unsubscribeNotifs = onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        
        // 店舗フィルタリング (ユーザーが管理者の場合は全件、スタッフなら自店舗のみ)
        const mySid = user?.StoreID || user?.StoreId;
        const visibleNotifs = notifs.filter(n => {
            if (!mySid || user.Role === 'Admin' || user.Role === '管理者') return true;
            return n.store_id == mySid;
        });

        const recipeMissingCount = visibleNotifs.filter(n => n.type === 'recipe_missing').length;
        const shiftPublishedCount = visibleNotifs.filter(n => n.type === 'shift_published').length;
        
        const rEl = document.getElementById('count-recipe-missing');
        if (rEl) rEl.textContent = `${recipeMissingCount}件`;
        
        const sEl = document.getElementById('count-shift-published');
        if (sEl) sEl.textContent = `${shiftPublishedCount}件`;
        
        // 詳細ビューが開いている場合はリストも更新
        window.__currentVisibleNotifs = visibleNotifs; // キャッシュ
        if (panelDetail.style.display === 'block') {
            const currentTitle = document.getElementById('detail-title').textContent;
            const type = currentTitle.includes('レシピ') ? 'recipe_missing' : 'shift_published';
            renderNotifDetails(visibleNotifs.filter(n => n.type === type));
        }
    });
}

async function loadDetails(type) {
    const listBody = document.getElementById('notif-list-body');
    if (listBody && window.__currentVisibleNotifs) {
        renderNotifDetails(window.__currentVisibleNotifs.filter(n => n.type === type));
    }
}

function renderNotifDetails(items) {
    const listBody = document.getElementById('notif-list-body');
    if (!listBody) return;

    if (items.length === 0) {
        listBody.innerHTML = '<div style="padding: 3rem; text-align: center; color: #94a3b8;">未登録のレシピはありません</div>';
        return;
    }

    // 日付順
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    listBody.innerHTML = items.map(item => {
        const isShift = item.type === 'shift_published';
        return `
            <div class="notif-item">
                <div class="notif-main-info">
                    <div class="notif-menu-name">${isShift ? item.title : (item.menu_name || '名称不明')}</div>
                    <div class="notif-meta">
                        <span><i class="fas fa-store"></i> ${item.store_name || '店舗情報なし'}</span>
                        <span><i class="fas fa-calendar"></i> ${new Date(item.created_at).toLocaleDateString()}</span>
                        ${isShift ? `<span><i class="fas fa-bullhorn"></i> ${item.message}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    ${isShift ? `
                        <button class="btn btn-register-notif" style="background:var(--secondary);" onclick="window.navigateTo('shift')">
                            <i class="fas fa-eye"></i> シフトを確認
                        </button>
                    ` : `
                        <button class="btn btn-register-notif" onclick="goToMenuRecipe('${item.menu_id}')">
                            <i class="fas fa-edit"></i> レシピを登録
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// グローバルに公開（HTML文字列内のonclickから呼ぶ用）
window.goToMenuRecipe = (menuId) => {
    // productsページへの深リンク用フラグ
    window.__productTargetMenuId = menuId;
    if (window.navigateTo) {
        window.navigateTo('products');
    }
};
