import { roleMasterService } from './role_master_service.js?v=20260710_06';
import { showAlert } from './ui_utils.js';

export const rolesAdminHtml = `
<div class="animate-fade-in" style="max-width: 800px; margin: 0 auto; padding: 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
            <i class="fas fa-user-tag" style="color: var(--primary);"></i>
            権限・役職マスタ
        </h2>
    </div>

    <div class="glass-panel" style="padding: 2rem; border-radius: 12px;">
        <p style="color: var(--text-secondary); margin-bottom: 2rem; line-height: 1.6;">
            システム内で使用される権限・役職を作成・管理します。ここで作成した役職は、ユーザー登録画面の「権限レベル」や、ワークフローの担当者設定で選択できるようになります。<br>
            ※データの整合性を保つため、一度登録した役職は削除できません（名称変更で対応してください）。
        </p>

        <!-- 新規追加フォーム -->
        <div style="display: flex; gap: 1rem; margin-bottom: 2.5rem; background: #f8fafc; padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border);">
            <div style="flex: 1;">
                <label style="display: block; font-weight: 700; color: #475569; margin-bottom: 0.5rem;">新しい役職名を追加</label>
                <input type="text" id="new-role-name" placeholder="例：経理、財務、エリアマネージャー等" style="width: 100%; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem;">
            </div>
            <div style="display: flex; align-items: flex-end;">
                <button id="btn-add-role" class="btn btn-primary" style="padding: 0.8rem 1.5rem; font-weight: 800; white-space: nowrap;">
                    <i class="fas fa-plus"></i> 追加
                </button>
            </div>
        </div>

        <!-- 役職一覧 -->
        <h3 style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">登録済みの権限・役職</h3>
        <div id="roles-list-container" style="display: flex; flex-direction: column; gap: 0.8rem;">
            <div style="text-align:center; padding:2rem; color:var(--text-secondary);">読み込み中...</div>
        </div>
    </div>
</div>

<!-- 編集モーダル -->
<div id="role-edit-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
    <div class="glass-panel animate-fade-in" style="background: white; padding: 2rem; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <h3 style="margin-top: 0; margin-bottom: 1.5rem; color: var(--text-primary);">役職の編集</h3>
        
        <input type="hidden" id="edit-role-id">
        
        <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-weight: 700; color: #475569; margin-bottom: 0.5rem;">役職名</label>
            <input type="text" id="edit-role-label" style="width: 100%; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem;">
        </div>
        
        <div style="margin-bottom: 2rem;">
            <label style="display: block; font-weight: 700; color: #475569; margin-bottom: 0.5rem;">メモ（任意）</label>
            <input type="text" id="edit-role-memo" placeholder="例：経理機能のみを閲覧できる権限" style="width: 100%; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem;">
            <p style="margin: 0.4rem 0 0; font-size: 0.8rem; color: var(--text-secondary);">この権限の役割や、付与すべき従業員の条件などの説明を記入できます。</p>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 1rem;">
            <button id="btn-close-role-edit" class="btn" style="padding: 0.8rem 1.5rem; background: #f1f5f9; color: #475569; font-weight: 700;">キャンセル</button>
            <button id="btn-save-role-edit" class="btn btn-primary" style="padding: 0.8rem 1.5rem; font-weight: 800;">保存</button>
        </div>
    </div>
</div>

<style>
.role-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    transition: all 0.2s;
}
.role-list-item:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.btn-edit-role {
    background: #f1f5f9;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 700;
    transition: background 0.2s;
}
.btn-edit-role:hover {
    background: #e0f2fe;
}
.role-memo {
    font-size: 0.85rem;
    color: #64748b;
    margin-left: 1rem;
    font-weight: normal;
}
</style>
`;

export async function initRolesAdminPage() {
    await renderRolesList();

    const btnAdd = document.getElementById('btn-add-role');
    if (!btnAdd) return; // DOMが既に破棄されている場合は中断

    btnAdd.addEventListener('click', async () => {
        const input = document.getElementById('new-role-name');
        if (!input) return;
        const label = input.value.trim();
        if (!label) {
            showAlert('役職名を入力してください。', 'warning');
            return;
        }

        const btn = document.getElementById('btn-add-role');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 追加中...';

        try {
            await roleMasterService.createRole(label);
            showAlert(`「${label}」を追加しました。`, 'success');
            input.value = '';
            await renderRolesList();
        } catch (error) {
            console.error(error);
            showAlert('追加に失敗しました。', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> 追加';
        }
    });

    // モーダルのイベント設定
    const modal = document.getElementById('role-edit-modal');
    const btnClose = document.getElementById('btn-close-role-edit');
    const btnSave = document.getElementById('btn-save-role-edit');

    if (btnClose && modal) {
        btnClose.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    if (btnSave && modal) {
        btnSave.addEventListener('click', async () => {
            const idInput = document.getElementById('edit-role-id');
            const labelInput = document.getElementById('edit-role-label');
            const memoInput = document.getElementById('edit-role-memo');
            if (!idInput || !labelInput || !memoInput) return;

            const id = idInput.value;
            const label = labelInput.value.trim();
            const memo = memoInput.value.trim();
        
        if (!label) {
            showAlert('役職名を入力してください。', 'warning');
            return;
        }

        const btn = document.getElementById('btn-save-role-edit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

        try {
            await roleMasterService.updateRole(id, { label, memo });
            showAlert('役職情報を更新しました。', 'success');
            modal.style.display = 'none';
            await renderRolesList();
        } catch (error) {
            console.error(error);
            showAlert('更新に失敗しました。', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '保存';
        }
    });
    }
}

// 役職データを保持する
let currentRolesList = [];

async function renderRolesList() {
    const container = document.getElementById('roles-list-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';

    try {
        currentRolesList = await roleMasterService.getRoles();
        
        // 非同期処理中に画面遷移した場合は中断
        const currentContainer = document.getElementById('roles-list-container');
        if (!currentContainer) return;

        currentContainer.innerHTML = '';

        if (currentRolesList.length === 0) {
            currentContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-secondary);">役職が登録されていません。</div>';
            return;
        }

        currentRolesList.forEach(role => {
            const item = document.createElement('div');
            item.className = 'role-list-item';

            const memoHtml = role.memo ? `<span class="role-memo"> - ${role.memo}</span>` : '';

            item.innerHTML = `
                <div style="display:flex; align-items:baseline;">
                    <div style="font-weight:800; color:#1e293b; font-size:1.05rem;">${role.label}</div>
                    ${memoHtml}
                </div>
                <div>
                    <button class="btn-edit-role" onclick="window.openRoleEditModal('${role.id}')"><i class="fas fa-pen"></i> 編集</button>
                </div>
            `;
            currentContainer.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        const currentContainer = document.getElementById('roles-list-container');
        if (currentContainer) {
            currentContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:#ef4444;">データの読み込みに失敗しました。</div>';
        }
    }
}

window.openRoleEditModal = function(id) {
    const role = currentRolesList.find(r => r.id === id);
    if (!role) return;

    document.getElementById('edit-role-id').value = role.id;
    document.getElementById('edit-role-label').value = role.label;
    document.getElementById('edit-role-memo').value = role.memo || '';
    
    document.getElementById('role-edit-modal').style.display = 'flex';
};
