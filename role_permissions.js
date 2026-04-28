import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const rolePermissionsPageHtml = `
    <div class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                <i class="fas fa-user-shield" style="color: var(--primary);"></i>
                権限振り分け設定
            </h2>
        </div>

        <div style="display: grid; grid-template-columns: 250px 1fr; gap: 2rem;">
            <!-- ロール一覧 -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <h3 style="font-size: 1rem; margin-bottom: 1.5rem; color: var(--text-secondary);">ロール選択</h3>
                <div id="role-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <button class="role-item active" data-role="Admin">管理者 (Admin)</button>
                    <button class="role-item" data-role="Manager">店長 (Manager)</button>
                    <button class="role-item" data-role="Staff">一般社員 (Staff)</button>
                    <button class="role-item" data-role="PartTimer">アルバイトスタッフ (PartTimer)</button>
                    <button class="role-item" data-role="Tablet">店舗タブレット (Tablet)</button>
                </div>
            </div>

            <!-- 機能一覧 -->
            <div class="glass-panel" style="padding: 2.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h3 id="current-role-title" style="margin: 0; font-size: 1.2rem;">管理者 の権限設定</h3>
                        <p style="margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">このロールに許可する機能を選択してください。</p>
                    </div>
                    <button id="save-permissions-btn" class="btn btn-primary" style="padding: 0.8rem 2rem;">
                        <i class="fas fa-save" style="margin-right: 0.5rem;"></i> 設定を保存
                    </button>
                </div>

                <div id="permissions-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
                    <!-- 機能チェックボックス群 -->
                </div>
            </div>
        </div>
    </div>

    <style>
        .role-item {
            text-align: left;
            padding: 1rem;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 600;
            font-size: 0.9rem;
        }
        .role-item:hover { background: #f8fafc; border-color: var(--primary); }
        .role-item.active { background: var(--primary); color: white; border-color: var(--primary); box-shadow: 0 4px 12px rgba(230,57,70,0.2); }
        
        .perm-card {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            cursor: pointer;
            transition: all 0.2s;
        }
        .perm-card:hover { border-color: var(--primary); background: rgba(230,57,70,0.02); }
        .perm-card input[type="checkbox"] { width: 1.2rem; height: 1.2rem; cursor: pointer; }
        .perm-card i { font-size: 1.2rem; color: var(--text-secondary); width: 24px; text-align: center; }
        .perm-card.selected { border-color: var(--primary); background: rgba(230,57,70,0.05); }
        .perm-card.selected i { color: var(--primary); }
    </style>
`;

const menuItems = [
    { id: 'dashboard', name: 'ダッシュボード', icon: 'fa-chart-line' },
    { id: 'attendance', name: '勤怠入力', icon: 'fa-clock' },
    { id: 'attendance_management', name: '勤怠管理', icon: 'fa-user-clock' },
    { id: 'attendance_direct_edit', name: '[機能] 勤怠の直接編集(管理者用)', icon: 'fa-check-double' },
    { id: 'attendance_correction_request', name: '[機能] 勤怠の修正申請(店長用)', icon: 'fa-paper-plane' },
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
    { id: 'invite_navi', name: '従業員への招待案内 (Email)', icon: 'fa-paper-plane' },
    { id: 'home_performance', name: 'ホーム実績サマリー表示', icon: 'fa-eye-slash' },
    { id: 'shift_submission', name: 'シフト提出・確認', icon: 'fa-calendar-alt' },
    { id: 'shift_admin', name: 'シフト作成・調整', icon: 'fa-user-edit' },
    // サイドバーのナビゲーションハブ
    { id: 'home', name: '[ナビ領域] メインホーム', icon: 'fa-home' },
    { id: 'ops_hub', name: '[ナビ領域] 店舗業務Hub', icon: 'fa-store' },
    { id: 'hr_hub', name: '[ナビ領域] 人事総務業務Hub', icon: 'fa-user-friends' },
    { id: 'master_hub', name: '[ナビ領域] 設定Hub', icon: 'fa-cog' },
    // クイック操作 (FAB)
    { id: 'fab_attendance', name: '[クイック操作] 出退勤打刻', icon: 'fa-fingerprint' },
    { id: 'fab_sales', name: '[クイック操作] 営業実績報告', icon: 'fa-calculator' },
    { id: 'fab_inventory', name: '[クイック操作] 棚卸・在庫登録', icon: 'fa-warehouse' },
    // 目標管理
    { id: 'goals_admin', name: '目標設定 (社長用)', icon: 'fa-bullseye' },
    { id: 'goals_store', name: '月次計画 (店長用)', icon: 'fa-tasks' },
    { id: 'manager_meeting', name: '店長会議資料', icon: 'fa-file-signature' },
    { id: 'daily_sakes', name: '日本酒管理', icon: 'fa-wine-glass-alt' },
    { id: 'bottle_keep', name: 'ボトルキープ', icon: 'fa-wine-bottle' },
    // 便利機能
    { id: 'utility_hub', name: '[ナビ領域] 便利機能Hub', icon: 'fa-lightbulb' },
    { id: 'prototype_menu', name: 'メニュー試作', icon: 'fa-flask' },
    { id: 'competitor_list', name: '行きたい店リスト', icon: 'fa-map-marked-alt' }
];


let selectedRole = 'Admin';

export async function initRolePermissionsPage() {
    renderPermissions();
    await loadRolePermissions(selectedRole);

    const roleBtns = document.querySelectorAll('.role-item');
    roleBtns.forEach(btn => {
        btn.onclick = async () => {
            roleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRole = btn.dataset.role;
            document.getElementById('current-role-title').textContent = `${btn.textContent} の権限設定`;
            await loadRolePermissions(selectedRole);
        };
    });

    const saveBtn = document.getElementById('save-permissions-btn');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const originalHtml = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            saveBtn.disabled = true;

            const checked = [];
            document.querySelectorAll('.perm-checkbox').forEach(cb => {
                if (cb.checked) checked.push(cb.dataset.id);
            });

            try {
                await setDoc(doc(db, "m_role_permissions", selectedRole), {
                    permissions: checked,
                    updatedAt: new Date().toISOString()
                });
                
                // 現在ログイン中のユーザー自身の権限を変更した場合は即座にアプリに反映させる
                if (window.state && window.state.currentUser && window.state.currentUser.Role === selectedRole) {
                    if (window.appState) {
                        window.appState.permissions = checked;
                    }
                }
                
                alert("権限設定を保存しました。");
            } catch (err) {
                alert("保存に失敗しました: " + err.message);
            } finally {
                saveBtn.innerHTML = originalHtml;
                saveBtn.disabled = false;
            }
        };
    }
}

function renderPermissions() {
    const grid = document.getElementById('permissions-grid');
    if (!grid) return;
    grid.innerHTML = menuItems.map(item => `
        <label class="perm-card" id="card-${item.id}">
            <input type="checkbox" class="perm-checkbox" data-id="${item.id}" onchange="this.parentElement.classList.toggle('selected', this.checked)">
            <i class="fas ${item.icon}"></i>
            <span style="font-size: 0.95rem; font-weight: 500;">${item.name}</span>
        </label>
    `).join('');
}

async function loadRolePermissions(role) {
    // リセット
    document.querySelectorAll('.perm-checkbox').forEach(cb => {
        cb.checked = false;
        cb.parentElement.classList.remove('selected');
    });

    try {
        const docSnap = await getDoc(doc(db, "m_role_permissions", role));
        if (docSnap.exists()) {
            const perms = docSnap.data().permissions || [];
            perms.forEach(pid => {
                const cb = document.querySelector(`.perm-checkbox[data-id="${pid}"]`);
                if (cb) {
                    cb.checked = true;
                    cb.parentElement.classList.add('selected');
                }
            });
        }
    } catch (err) {
        console.error("Error loading permissions:", err);
    }
}
