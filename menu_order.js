import { db } from './firebase.js';
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const menuOrderPageHtml = `
    <div class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                <i class="fas fa-sort-amount-down" style="color: var(--primary);"></i>
                メニュー並び順設定
            </h2>
            <button id="save-menu-order-btn" class="btn btn-primary" style="padding: 0.8rem 2rem;">
                <i class="fas fa-save" style="margin-right: 0.5rem;"></i> 設定を保存
            </button>
        </div>

        <div class="glass-panel" style="padding: 2rem; max-width: 600px; margin: 0 auto;">
            <p style="margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                <i class="fas fa-info-circle"></i> サイドバーに表示されるメニューの順番を調整できます。上下の矢印ボタンで移動させてください。
            </p>
            <div id="menu-order-list" style="display: flex; flex-direction: column; gap: 0.8rem;">
                <!-- JSで生成 -->
            </div>
        </div>
    </div>

    <style>
        .order-item {
            display: flex;
            align-items: center;
            padding: 1rem;
            background: white;
            border: 1px solid var(--border);
            border-radius: 12px;
            gap: 1rem;
            transition: all 0.2s;
        }
        .order-item:hover { border-color: var(--primary); background: #f8fafc; }
        .order-item i.drag-handle { color: #cbd5e1; cursor: default; }
        .order-item i.menu-icon { width: 24px; text-align: center; color: var(--text-secondary); }
        .order-btn {
            background: #f1f5f9;
            border: none;
            border-radius: 6px;
            width: 32px;
            height: 32px;
            cursor: pointer;
            color: #475569;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.1s;
        }
        .order-btn:hover { background: #e2e8f0; color: var(--primary); }
    </style>
`;

const defaultMenuItems = [
    { id: 'home', name: 'ホーム', icon: 'fa-home' },
    { id: 'dashboard', name: 'ダッシュボード', icon: 'fa-chart-line' },
    { id: 'attendance', name: '勤怠入力', icon: 'fa-clock' },
    { id: 'attendance_check', name: '勤怠状況確認', icon: 'fa-clipboard-check' },
    { id: 'inventory', name: '在庫管理', icon: 'fa-warehouse' },
    { id: 'procurement', name: '仕入れ', icon: 'fa-shopping-cart' },
    { id: 'sales', name: '営業実績報告', icon: 'fa-calculator' },
    { id: 'recipe_viewer', name: 'レシピ閲覧', icon: 'fa-book-open' },
    { id: 'users', name: 'ユーザー登録/変更', icon: 'fa-users-cog' },
    { id: 'stores', name: '店舗マスタ', icon: 'fa-store-alt' },
    { id: 'products', name: '商品・レシピマスタ', icon: 'fa-mortar-pestle' },
    { id: 'suppliers', name: '業者マスタ', icon: 'fa-truck' },
    { id: 'role_permissions', name: '権限振り分け', icon: 'fa-user-shield' },
    { id: 'sales_correction', name: '営業実績修正', icon: 'fa-edit' },
    { id: 'csv_export', name: 'CSV出力', icon: 'fa-file-csv' },
    { id: 'menu_order', name: 'メニュー並び順', icon: 'fa-sort-amount-down' },
    { id: 'line_share', name: 'アプリをLINE共有', icon: 'fa-share-alt' }
];

let currentOrder = [];

export async function initMenuOrderPage() {
    await loadOrder();
    renderList();

    const saveBtn = document.getElementById('save-menu-order-btn');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            try {
                await setDoc(doc(db, "m_settings", "sidebar_order"), {
                    order: currentOrder.map(item => item.id),
                    updatedAt: new Date().toISOString()
                });
                alert("並び順を保存しました。再読み込み後に反映されます。");
            } catch (err) {
                alert("保存エラー: " + err.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save" style="margin-right: 0.5rem;"></i> 設定を保存';
            }
        };
    }
}

async function loadOrder() {
    try {
        const docSnap = await getDoc(doc(db, "m_settings", "sidebar_order"));
        if (docSnap.exists()) {
            const savedIds = docSnap.data().order || [];
            // 保存済みのID順に並べ替え、新しく追加されたアイテムがあれば末尾に
            const ordered = [];
            savedIds.forEach(id => {
                const item = defaultMenuItems.find(m => m.id === id);
                if (item) ordered.push(item);
            });
            defaultMenuItems.forEach(item => {
                if (!savedIds.includes(item.id)) ordered.push(item);
            });
            currentOrder = ordered;
        } else {
            currentOrder = [...defaultMenuItems];
        }
    } catch (e) {
        console.error(e);
        currentOrder = [...defaultMenuItems];
    }
}

function renderList() {
    const list = document.getElementById('menu-order-list');
    if (!list) return;
    list.innerHTML = currentOrder.map((item, index) => `
        <div class="order-item">
            <i class="fas ${item.icon} menu-icon"></i>
            <span style="flex: 1; font-weight: 600;">${item.name}</span>
            <div style="display: flex; gap: 0.4rem;">
                <button class="order-btn" onclick="moveItem(${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button class="order-btn" onclick="moveItem(${index}, 1)" ${index === currentOrder.length - 1 ? 'disabled style="opacity:0.3"' : ''}>
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        </div>
    `).join('');
}

window.moveItem = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;
    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[newIndex];
    currentOrder[newIndex] = temp;
    renderList();
};
