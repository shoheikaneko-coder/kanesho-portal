import { db, storage, doc, updateDoc, getDoc, setDoc } from './firebase.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { workflowEngine } from './workflow_engine.js';
import { showAlert, showConfirm } from './ui_utils.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { roleMasterService } from './role_master_service.js';

export const invoicesPageHtml = `
<style>
/* PC特化レイアウト用スタイル */
.invoice-container {
    display: flex;
    gap: 1.5rem;
    /* height: calc(100vh - 100px); 削除：100vhバグ回避のためapp-container-fillに一任 */
    padding: 1rem;
    box-sizing: border-box;
}
.invoice-list-pane {
    width: 380px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}
.invoice-detail-pane {
    flex: 1;
    background: white;
    border-radius: 12px;
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}
.list-header {
    padding: 1.2rem;
    background: white;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.list-filters {
    display: flex;
    gap: 0.5rem;
    padding: 0.8rem;
    background: white;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
}
.filter-btn {
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    border: 1px solid var(--border);
    background: white;
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
}
.filter-btn:hover {
    background: #f1f5f9;
}
.filter-btn.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
}
.invoice-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}
.invoice-card {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
}
.invoice-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    border-color: #cbd5e1;
}
.invoice-card.selected {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(230, 57, 70, 0.2);
}
.invoice-card.my-task::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #10b981;
    border-radius: 8px 0 0 8px;
}
.status-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
}
.status-pending_approval { background: #fef08a; color: #854d0e; }
.status-pending_transfer { background: #bfdbfe; color: #1e40af; }
.status-pending_mf { background: #e9d5ff; color: #6b21a8; }
.status-completed { background: #bbf7d0; color: #166534; }
.status-rejected { background: #fecaca; color: #991b1b; }

.detail-header {
    padding: 1.2rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8fafc;
}
.detail-content {
    flex: 1;
    display: flex;
    overflow: hidden;
}
.detail-pdf-viewer {
    flex: 1;
    border-right: 1px solid var(--border);
    background: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}
.detail-info {
    width: 400px;
    overflow-y: auto;
    padding: 1.5rem;
    box-sizing: border-box;
    background: white;
}
.timeline-container {
    margin-top: 2rem;
    border-top: 1px solid var(--border);
    padding-top: 1.5rem;
}
.timeline-item {
    padding-left: 1.5rem;
    border-left: 2px solid #cbd5e1;
    position: relative;
    margin-bottom: 1.5rem;
}
.timeline-item::before {
    content: '';
    position: absolute;
    left: -6px;
    top: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--primary);
}
.timeline-date {
    font-size: 0.75rem;
    color: var(--text-secondary);
}
.timeline-user {
    font-weight: 800;
    font-size: 0.85rem;
    margin: 0.2rem 0;
}
.timeline-comment {
    background: #f1f5f9;
    padding: 0.8rem;
    border-radius: 8px;
    font-size: 0.85rem;
    margin-top: 0.5rem;
    color: #334155;
    white-space: pre-wrap;
}
.action-box {
    background: #f8fafc;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1.5rem;
}
.setting-row {
    margin-bottom: 1.5rem;
}
.setting-row label {
    font-weight: 800;
    color: #1e293b;
    display: block;
    margin-bottom: 0.5rem;
}
.checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
}
.checkbox-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: white;
    border: 1px solid #cbd5e1;
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.85rem;
    cursor: pointer;
}
.history-table-container {
    width: 100%;
    overflow-x: auto;
    background: white;
    border-radius: 8px;
    border: 1px solid var(--border);
}
.history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
}
.history-table th, .history-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
}
.history-table th {
    background: #f8fafc;
    font-weight: 800;
    color: var(--text-secondary);
    white-space: nowrap;
}
.history-table tr:hover {
    background: #f1f5f9;
    cursor: pointer;
}
.comment-tooltip {
    position: relative;
    display: inline-block;
    cursor: pointer;
    color: #10b981;
}
.comment-tooltip .tooltip-text {
    visibility: hidden;
    width: max-content;
    max-width: 300px;
    background-color: #334155;
    color: #fff;
    text-align: left;
    border-radius: 6px;
    padding: 0.5rem;
    position: absolute;
    z-index: 10;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s;
    font-size: 0.75rem;
    white-space: pre-wrap;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.comment-tooltip:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
}
.history-filter-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
}
.history-filter-row input {
    flex: 1;
    min-width: 150px;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.85rem;
}
.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
}
</style>

<div class="invoice-container animate-fade-in app-container-fill">
    <!-- 左側：リストペイン -->
    <div class="invoice-list-pane">
        <div class="list-header">
            <h3 style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:0.5rem;">
                <i class="fas fa-file-invoice-dollar" style="color:var(--primary);"></i> 請求書
            </h3>
            <div style="display:flex; gap:0.5rem;">
                <button id="btn-history" class="btn btn-secondary" style="padding: 0.5rem; border-radius:8px;" title="過去の履歴"><i class="fas fa-history"></i></button>
                <button id="btn-settings" class="btn btn-secondary" style="padding: 0.5rem; border-radius:8px;" title="ワークフロー設定"><i class="fas fa-cog"></i></button>
                <button id="btn-new-invoice" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem; font-weight:800; border-radius:8px;">
                    <i class="fas fa-plus"></i> 新規
                </button>
            </div>
        </div>
        <div class="list-filters">
            <button class="filter-btn active" data-filter="my_task">自分のタスク</button>
            <button class="filter-btn" data-filter="all">進行中</button>
        </div>
        <div class="invoice-list" id="invoice-list-container">
            <div style="text-align:center; padding:2rem; color:var(--text-secondary);">読み込み中...</div>
        </div>
    </div>

    <!-- 右側：詳細ペイン -->
    <div class="invoice-detail-pane" id="invoice-detail-container">
        <div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-secondary); flex-direction:column; gap:1rem;">
            <i class="fas fa-file-invoice" style="font-size: 5rem; color: #e2e8f0;"></i>
            <p style="font-weight:700; text-align:center; line-height:1.6; color:#94a3b8;">
                左のリストから案件を選択するか、<br>新規申請ボタンから請求書をアップロードしてください。
            </p>
        </div>
    </div>
</div>

<!-- 新規申請モーダル -->
<div id="modal-new-invoice" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:4000; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
    <div class="glass-panel" style="background:white; width:90%; max-width:900px; border-radius:16px; padding:0; overflow:hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <div style="padding:1.2rem 1.8rem; border-bottom:1px solid var(--border); background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:1.2rem; font-weight:800; color:#1e293b;"><i class="fas fa-upload" style="color:#3b82f6;"></i> 請求書の新規申請</h3>
            <button id="btn-close-new-modal" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#64748b;"><i class="fas fa-times"></i></button>
        </div>
        <div style="padding:2rem; display:flex; gap:2rem;">
            <div style="flex:1;">
                <label style="font-weight:800; font-size:0.85rem; display:block; margin-bottom:0.5rem; color:#475569;">請求書ファイル (PDF/画像)</label>
                <div style="border:2px dashed #cbd5e1; border-radius:12px; padding:3rem 1rem; text-align:center; background:#f8fafc; cursor:pointer; transition:all 0.2s;" id="invoice-dropzone" onmouseover="this.style.borderColor='#3b82f6'; this.style.background='#eff6ff'" onmouseout="this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc'">
                    <i class="fas fa-cloud-upload-alt" style="font-size:2.5rem; color:#94a3b8; margin-bottom:1rem;"></i>
                    <p style="margin:0; font-weight:700; color:#64748b;">クリックしてファイルを選択<br><span style="font-size:0.75rem; font-weight:normal;">またはここにドロップ</span></p>
                    <input type="file" id="invoice-file-input" accept="application/pdf,image/*" style="display:none;">
                </div>
                <div id="invoice-file-name" style="margin-top:0.8rem; font-weight:800; color:#3b82f6; font-size:0.85rem; text-align:center;"></div>
            </div>
            <div style="flex:1.2; display:flex; flex-direction:column; gap:1.2rem;">
                <div class="input-group" style="margin:0;">
                    <label style="font-weight:800; color:#475569;">取引先名</label>
                    <input type="text" id="inv-supplier" placeholder="例：〇〇株式会社" autocomplete="off" required style="font-size:1rem; padding:0.8rem;">
                    <datalist id="supplier-list"></datalist>
                </div>
                <div style="input-group" style="margin:0; display:flex; gap:1rem;">
                    <div style="flex:1;">
                        <label style="font-weight:800; color:#475569; display:block; margin-bottom:0.4rem;">請求金額（税込）</label>
                        <input type="text" inputmode="numeric" id="inv-amount" placeholder="例：50,000" required style="width:100%; font-size:1rem; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px;">
                    </div>
                    <div style="flex:1;">
                        <label style="font-weight:800; color:#475569; display:block; margin-bottom:0.4rem;">支払期限</label>
                        <input type="date" id="inv-deadline" required style="width:100%; font-size:1rem; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px;">
                    </div>
                </div>
                <div class="input-group" style="margin:0;">
                    <label style="font-weight:800; color:#475569;">備考・コメント</label>
                    <textarea id="inv-note" rows="3" placeholder="特記事項があれば入力" style="width:100%; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.9rem; resize:vertical;"></textarea>
                </div>
            </div>
        </div>
        <div style="padding:1.2rem 1.8rem; border-top:1px solid var(--border); background:#f8fafc; display:flex; justify-content:flex-end; gap:1rem;">
            <button id="btn-cancel-new" class="btn btn-secondary" style="font-weight:800; padding:0.6rem 1.2rem;">キャンセル</button>
            <button id="btn-submit-new" class="btn btn-primary" style="font-weight:800; padding:0.6rem 1.5rem; background:#10b981; border-color:#10b981;"><i class="fas fa-paper-plane"></i> 申請する</button>
        </div>
    </div>
</div>

<!-- ワークフロー担当者設定モーダル -->
<div id="modal-workflow-settings" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:4000; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
    <div class="glass-panel" style="background:white; width:90%; max-width:600px; border-radius:16px; padding:0; overflow:hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <div style="padding:1.2rem 1.8rem; border-bottom:1px solid var(--border); background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:1.2rem; font-weight:800; color:#1e293b;"><i class="fas fa-cog" style="color:#64748b;"></i> 担当役職の割り当て設定</h3>
            <button id="btn-close-settings-modal" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#64748b;"><i class="fas fa-times"></i></button>
        </div>
        <div style="padding:2rem; max-height:70vh; overflow-y:auto;" id="settings-form-container">
            <!-- JSでフォーム生成 -->
        </div>
        <div style="padding:1.2rem 1.8rem; border-top:1px solid var(--border); background:#f8fafc; display:flex; justify-content:flex-end; gap:1rem;">
            <button id="btn-cancel-settings" class="btn btn-secondary" style="font-weight:800;">キャンセル</button>
            <button id="btn-save-settings" class="btn btn-primary" style="font-weight:800;"><i class="fas fa-save"></i> 保存する</button>
        </div>
    </div>
</div>
`;

let currentWorkflows = [];
let selectedWorkflowId = null;
let currentFilter = 'my_task';
let currentFile = null;

// 履歴モード用状態管理
let isHistoryMode = false;
let historyCurrentPage = 1;
const historyItemsPerPage = 20;
let historyFilters = {
    date: '',
    supplier: '',
    amount: '',
    deadline: '',
    applicant: ''
};

const STATUS_MAP = {
    'pending_approval': { label: '社長承認待ち', class: 'status-pending_approval' },
    'pending_transfer': { label: '振込待ち', class: 'status-pending_transfer' },
    'pending_mf': { label: 'MF登録待ち', class: 'status-pending_mf' },
    'completed': { label: '完了', class: 'status-completed' },
    'rejected': { label: '差戻し', class: 'status-rejected' }
};

let AVAILABLE_ROLES = [];
let ALL_USERS = [];

// デフォルトの担当者設定
let workflowConfig = {
    pending_approval: { roles: ['President', '社長'], userIds: [] },
    pending_transfer: { roles: ['Accounting', '経理', 'Admin', '管理者'], userIds: [] },
    pending_mf: { roles: ['Accounting', '経理', 'Admin', '管理者'], userIds: [] }
};

export async function initInvoicesPage() {
    bindEvents();
    
    // 役職とユーザーリストをロード
    AVAILABLE_ROLES = await roleMasterService.getRoles();
    const usersSnap = await getDocs(collection(db, 'm_users'));
    ALL_USERS = [];
    usersSnap.forEach(d => {
        const u = d.data();
        ALL_USERS.push({ id: d.id, name: `${u.LastName || ''} ${u.FirstName || ''}`.trim() || u.Name || '名称未設定' });
    });

    await loadSettings();
    loadWorkflows();
}

async function loadSettings() {
    try {
        const docSnap = await getDoc(doc(db, 'workflow_settings', 'invoice_assignees'));
        if (docSnap.exists()) {
            const data = docSnap.data();
            ['pending_approval', 'pending_transfer', 'pending_mf'].forEach(step => {
                if (data[step]) {
                    if (Array.isArray(data[step])) {
                        workflowConfig[step] = { roles: data[step], userIds: [] };
                    } else {
                        workflowConfig[step] = data[step];
                    }
                }
            });
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

async function saveSettings() {
    try {
        const btn = document.getElementById('btn-save-settings');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

        await setDoc(doc(db, 'workflow_settings', 'invoice_assignees'), workflowConfig);
        
        showAlert('設定を保存しました。', 'success');
        document.getElementById('modal-workflow-settings').style.display = 'none';
        
        // リストを再レンダリング（マイタスクの判定が変わる可能性があるため）
        renderList();
    } catch (e) {
        console.error('Failed to save settings:', e);
        showAlert('保存に失敗しました', 'error');
    } finally {
        const btn = document.getElementById('btn-save-settings');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> 保存する';
    }
}

function renderSettingsModal() {
    const container = document.getElementById('settings-form-container');
    
    const steps = [
        { key: 'pending_approval', name: 'Step 1: 社長承認' },
        { key: 'pending_transfer', name: 'Step 2: 振込処理' },
        { key: 'pending_mf', name: 'Step 3: MF登録' }
    ];

    let html = '';
    steps.forEach(step => {
        const config = workflowConfig[step.key] || { roles: [], userIds: [] };
        const currentRoles = config.roles || [];
        const currentUserIds = config.userIds || [];
        
        let selectedRoleBadges = currentRoles.map(roleIdentifier => {
            const r = AVAILABLE_ROLES.find(role => role.id === roleIdentifier || role.label === roleIdentifier);
            if (!r) return '';
            return `
                <div style="display:inline-flex; align-items:center; background:#f1f5f9; border:1px solid #cbd5e1; padding:0.2rem 0.6rem; border-radius:16px; font-size:0.85rem; margin-right:0.5rem; margin-bottom:0.5rem;">
                    ${r.label}
                    <input type="checkbox" data-step="${step.key}" value="${r.id}" data-label="${r.label}" checked style="display:none;">
                    <i class="fas fa-times btn-remove-role" style="margin-left:0.5rem; cursor:pointer; color:#94a3b8;" data-step="${step.key}" data-rid="${r.id}" data-rlabel="${r.label}"></i>
                </div>
            `;
        }).join('');

        let roleOptions = AVAILABLE_ROLES.filter(r => !currentRoles.includes(r.id) && !currentRoles.includes(r.label)).map(r => `
            <option value="${r.id}">${r.label}</option>
        `).join('');

        let selectedUserBadges = currentUserIds.map(uid => {
            const u = ALL_USERS.find(user => user.id === uid);
            if (!u) return '';
            return `
                <div style="display:inline-flex; align-items:center; background:#f1f5f9; border:1px solid #cbd5e1; padding:0.2rem 0.6rem; border-radius:16px; font-size:0.85rem; margin-right:0.5rem; margin-bottom:0.5rem;">
                    ${u.name}
                    <input type="checkbox" data-step-user="${step.key}" value="${u.id}" checked style="display:none;">
                    <i class="fas fa-times btn-remove-user" style="margin-left:0.5rem; cursor:pointer; color:#94a3b8;" data-step="${step.key}" data-uid="${u.id}"></i>
                </div>
            `;
        }).join('');

        html += `
            <div class="setting-row" style="margin-bottom: 2rem;">
                <label style="font-weight: 800; font-size: 1.1rem; color: #1e293b; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; display: block; margin-bottom: 1rem;">${step.name}</label>
                <div style="margin-bottom: 1.5rem;">
                    <div style="font-weight: 700; color: #475569; margin-bottom: 0.5rem;">担当役職（グループ指定）</div>
                    <div id="selected-roles-container-${step.key}" style="margin-bottom: 0.5rem;">
                        ${selectedRoleBadges}
                    </div>
                    <div style="max-width: 300px;">
                        <select class="role-select-add" data-step="${step.key}" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem;">
                            <option value="">➕ 役職を追加...</option>
                            ${roleOptions}
                        </select>
                    </div>
                </div>
                <div>
                    <div style="font-weight: 700; color: #475569; margin-bottom: 0.5rem;">特定の担当者（個人指定・オプション）</div>
                    <div id="selected-users-container-${step.key}" style="margin-bottom: 0.5rem;">
                        ${selectedUserBadges}
                    </div>
                    <div style="position: relative; max-width: 300px;">
                        <input type="text" class="user-search-input" data-step="${step.key}" placeholder="🔍 名前を検索して追加..." style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem;">
                        <div id="search-results-${step.key}" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--border); border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 10; display: none; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"></div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // 役職バッジの削除イベント
    container.querySelectorAll('.btn-remove-role').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stepKey = e.target.dataset.step;
            const rid = e.target.dataset.rid;
            const rlabel = e.target.dataset.rlabel;
            // 役職はIDで保存されている場合とLabelで保存されている場合があるため、両方をフィルタリング
            workflowConfig[stepKey].roles = workflowConfig[stepKey].roles.filter(id => id !== rid && id !== rlabel);
            renderSettingsModal();
        });
    });

    // 役職の追加イベント
    container.querySelectorAll('.role-select-add').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const stepKey = e.target.dataset.step;
            const rid = e.target.value;
            if (!rid) return;
            if (!workflowConfig[stepKey].roles) workflowConfig[stepKey].roles = [];
            workflowConfig[stepKey].roles.push(rid);
            renderSettingsModal();
        });
    });

    // ユーザーバッジの削除イベント
    container.querySelectorAll('.btn-remove-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stepKey = e.target.dataset.step;
            const uid = e.target.dataset.uid;
            workflowConfig[stepKey].userIds = workflowConfig[stepKey].userIds.filter(id => id !== uid);
            renderSettingsModal();
        });
    });

    // 検索入力イベント
    container.querySelectorAll('.user-search-input').forEach(input => {
        const stepKey = input.dataset.step;
        const resultsContainer = document.getElementById(`search-results-${stepKey}`);
        
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (!query) {
                resultsContainer.style.display = 'none';
                return;
            }
            
            const currentIds = workflowConfig[stepKey]?.userIds || [];
            const hits = ALL_USERS.filter(u => 
                !currentIds.includes(u.id) && 
                u.name && u.name.toLowerCase().includes(query)
            );
            
            if (hits.length === 0) {
                resultsContainer.innerHTML = '<div style="padding: 0.8rem; color: #94a3b8; font-size: 0.85rem;">該当するユーザーがいません</div>';
            } else {
                resultsContainer.innerHTML = hits.map(u => `
                    <div class="search-result-item" data-uid="${u.id}" style="padding: 0.8rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; font-size: 0.9rem;">
                        ${u.name}
                    </div>
                `).join('');
                
                resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', (ev) => {
                        const uid = ev.target.dataset.uid;
                        if (!workflowConfig[stepKey].userIds) workflowConfig[stepKey].userIds = [];
                        workflowConfig[stepKey].userIds.push(uid);
                        renderSettingsModal();
                    });
                });
            }
            resultsContainer.style.display = 'block';
        });

        // フォーカスが外れたら候補を閉じる（クリックイベントを発火させるため遅延させる）
        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (resultsContainer) resultsContainer.style.display = 'none';
            }, 200);
        });
    });
}

function bindEvents() {
    document.getElementById('btn-new-invoice').addEventListener('click', openNewModal);
    document.getElementById('btn-close-new-modal').addEventListener('click', closeNewModal);
    document.getElementById('btn-cancel-new').addEventListener('click', closeNewModal);
    
    // Settings Modal
    document.getElementById('btn-settings').addEventListener('click', () => {
        renderSettingsModal();
        document.getElementById('modal-workflow-settings').style.display = 'flex';
    });
    document.getElementById('btn-close-settings-modal').addEventListener('click', () => document.getElementById('modal-workflow-settings').style.display = 'none');
    document.getElementById('btn-cancel-settings').addEventListener('click', () => document.getElementById('modal-workflow-settings').style.display = 'none');
    
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        // Collect checkbox values
        ['pending_approval', 'pending_transfer', 'pending_mf'].forEach(step => {
            const checkedRoles = Array.from(document.querySelectorAll(`input[data-step="${step}"]:checked`));
            const roles = [];
            checkedRoles.forEach(cb => {
                roles.push(cb.value);
                if (cb.dataset.label) roles.push(cb.dataset.label);
            });
            
            const checkedUsers = Array.from(document.querySelectorAll(`input[data-step-user="${step}"]:checked`));
            const userIds = checkedUsers.map(cb => cb.value);
            
            workflowConfig[step] = { roles, userIds };
        });
        saveSettings();
    });
    
    const dropzone = document.getElementById('invoice-dropzone');
    const fileInput = document.getElementById('invoice-file-input');
    
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.background = '#eff6ff'; });
    dropzone.addEventListener('dragleave', () => dropzone.style.background = '#f8fafc');
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.background = '#f8fafc';
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    document.getElementById('btn-submit-new').addEventListener('click', submitNewInvoice);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            isHistoryMode = false;
            selectedWorkflowId = null;
            renderList();
            renderDetail(null);
        });
    });

    document.getElementById('btn-history').addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        isHistoryMode = true;
        historyCurrentPage = 1;
        selectedWorkflowId = null;
        renderHistoryTable();
    });

    // 請求金額のカンマ自動挿入リスナー
    const amountInput = document.getElementById('inv-amount');
    if (amountInput) {
        amountInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^\d]/g, ''); // 数字以外を除去
            if (val) {
                e.target.value = Number(val).toLocaleString('ja-JP');
            } else {
                e.target.value = '';
            }
        });
    }

    // 取引先名サジェストの表示制御（入力時のみ表示）
    const supplierInput = document.getElementById('inv-supplier');
    if (supplierInput) {
        supplierInput.removeAttribute('list'); // 初期状態は紐付け解除
        supplierInput.addEventListener('input', (e) => {
            if (e.target.value.length > 0) {
                e.target.setAttribute('list', 'supplier-list');
            } else {
                e.target.removeAttribute('list');
            }
        });
    }
}

function handleFileSelect(file) {
    currentFile = file;
    document.getElementById('invoice-file-name').textContent = file.name;
    document.getElementById('invoice-dropzone').style.borderColor = '#10b981';
}

function openNewModal() {
    document.getElementById('modal-new-invoice').style.display = 'flex';
    currentFile = null;
    document.getElementById('invoice-file-name').textContent = '';
    document.getElementById('invoice-dropzone').style.borderColor = '#cbd5e1';
    document.getElementById('inv-supplier').value = '';
    document.getElementById('inv-amount').value = '';
    document.getElementById('inv-deadline').value = '';
    document.getElementById('inv-note').value = '';

    // 取引先サジェストの更新
    updateSupplierDatalist();
}

function updateSupplierDatalist() {
    const datalist = document.getElementById('supplier-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    
    // 過去のワークフローから取引先名を抽出して重複排除
    const suppliers = new Set();
    if (typeof currentWorkflows !== 'undefined' && Array.isArray(currentWorkflows)) {
        currentWorkflows.forEach(wf => {
            if (wf.payload && wf.payload.supplier) {
                suppliers.add(wf.payload.supplier);
            }
        });
    }
    
    // オプション要素を追加
    suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup;
        datalist.appendChild(option);
    });
}

function closeNewModal() {
    document.getElementById('modal-new-invoice').style.display = 'none';
}

function isMyTask(wf) {
    const user = window.appState?.currentUser;
    if (!user) return false;
    if (wf.status === 'completed' || wf.status === 'rejected') return false;
    
    // DB上のassignee_rolesとユーザー権限を照合
    const hasRole = wf.assignee_roles?.includes(user.Role) || wf.assignee_roles?.includes(user.JobTitle);
    const hasUserId = wf.assignee_user_ids?.includes(user.id);
    
    // 設定に基づくフォールバック（旧データや整合性用）
    const config = workflowConfig[wf.status] || { roles: [], userIds: [] };
    const requiredRoles = Array.isArray(config) ? config : config.roles || [];
    const requiredUserIds = config.userIds || [];
    const hasFallbackRole = requiredRoles.includes(user.Role) || requiredRoles.includes(user.JobTitle);
    const hasFallbackUserId = requiredUserIds.includes(user.id);

    // 管理者は「自分のタスク」ではなく、全てを「進行中」から見られるようにするため、
    // ここで強制的に true にするロジック（旧仕様）は削除し、実際に割り当てられているかのみを判定。
    return hasRole || hasUserId || hasFallbackRole || hasFallbackUserId;
}

async function loadWorkflows() {
    try {
        const filters = { type: 'invoice' };
        currentWorkflows = await workflowEngine.getWorkflows(filters);
        renderList();
    } catch (error) {
        showAlert('データの読み込みに失敗しました。', 'error');
    }
}

function renderList() {
    const container = document.getElementById('invoice-list-container');
    container.innerHTML = '';

    const filtered = currentWorkflows.filter(wf => {
        if (currentFilter === 'my_task') return isMyTask(wf);
        if (currentFilter === 'completed') return wf.status === 'completed' || wf.status === 'rejected';
        if (currentFilter === 'all') return wf.status !== 'completed' && wf.status !== 'rejected';
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-secondary);">該当する案件はありません</div>';
        return;
    }

    filtered.forEach(wf => {
        const isMine = isMyTask(wf);
        const isSelected = wf.id === selectedWorkflowId;
        const statusObj = STATUS_MAP[wf.status] || { label: wf.status, class: '' };
        
        const card = document.createElement('div');
        card.className = `invoice-card ${isMine ? 'my-task' : ''} ${isSelected ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="${statusObj.class} status-badge">${statusObj.label}</div>
            <div style="font-weight:800; color:#1e293b; margin-bottom:0.3rem;">${wf.payload.supplier}</div>
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#64748b;">
                <span><i class="fas fa-yen-sign"></i> ${Number(wf.payload.amount).toLocaleString()}</span>
                <span style="${new Date(wf.payload?.deadline) < new Date() ? 'color:#ef4444;font-weight:bold;' : ''}"><i class="far fa-calendar-alt"></i> 振込期限: ${wf.payload?.deadline || '未設定'}</span>
            </div>
        `;
        card.addEventListener('click', () => {
            selectedWorkflowId = wf.id;
            renderList(); // update selection highlight
            renderDetail(wf);
        });
        container.appendChild(card);
    });
}

function renderDetail(wf, isHistoryDetail = false) {
    const container = document.getElementById('invoice-detail-container');
    if (!wf) {
        container.innerHTML = `
            <div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-secondary); flex-direction:column; gap:1rem;">
                <i class="fas fa-file-invoice" style="font-size: 5rem; color: #e2e8f0;"></i>
                <p style="font-weight:700; text-align:center; line-height:1.6; color:#94a3b8;">
                    左のリストから案件を選択するか、<br>新規申請ボタンから請求書をアップロードしてください。
                </p>
            </div>
        `;
        return;
    }
    
    const statusObj = STATUS_MAP[wf.status] || { label: wf.status, class: '' };
    const user = window.appState?.currentUser;
    const isMine = isMyTask(wf);
    const isAdmin = user?.Role === 'Admin' || user?.Role === '管理者';

    const pdfUrl = wf.attachments?.[0] || '';
    const displayFileName = wf.payload?.fileName || '添付ファイル（証憑）';
    
    const fileLinkHtml = pdfUrl ? `
        <a href="${pdfUrl}" target="_blank" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.8rem; padding:1rem; border:1px solid #cbd5e1; border-radius:8px; background:white; color:#1e293b; text-decoration:none; margin-bottom:1.5rem; transition:all 0.2s;">
            <i class="fas fa-file-pdf fa-2x" style="color:#ef4444;"></i>
            <div style="flex:1;">
                <div style="font-weight:800; font-size:1rem;">${displayFileName}</div>
                <div style="font-size:0.75rem; color:#64748b;">クリックして表示</div>
            </div>
            <i class="fas fa-external-link-alt" style="color:#94a3b8;"></i>
        </a>
    ` : `<div style="padding:1rem; border:1px dashed #cbd5e1; border-radius:8px; color:#94a3b8; text-align:center; margin-bottom:1.5rem;"><i class="fas fa-file-excel"></i> 添付ファイルなし</div>`;

    const requester = ALL_USERS.find(u => u.id === wf.requester_id);
    const requesterName = requester ? requester.name : wf.requester_id;

    let actionsHtml = '';
    if (isMine) {
        if (wf.status === 'pending_approval') {
            actionsHtml = `
                <div class="action-box">
                    <h4 style="margin:0 0 1rem 0; font-size:0.9rem; color:#1e293b;">社長承認アクション</h4>
                    <textarea id="action-comment" rows="2" placeholder="コメント (任意)" style="width:100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:1rem;"></textarea>
                    <div style="display:flex; gap:0.5rem; flex-direction:column;">
                        <button class="btn btn-primary" onclick="window.invoiceAction('${wf.id}', 'pending_transfer')" style="width:100%; background:#10b981; border-color:#10b981;"><i class="fas fa-check"></i> 承認して振込へ</button>
                        <button class="btn btn-secondary" onclick="window.invoiceAction('${wf.id}', 'rejected_start')" style="width:100%; border-color:#fca5a5; color:#ef4444;"><i class="fas fa-undo"></i> 最初からやり直し (申請者へ差戻し)</button>
                    </div>
                </div>
            `;
        } else if (wf.status === 'pending_transfer') {
            actionsHtml = `
                <div class="action-box">
                    <h4 style="margin:0 0 1rem 0; font-size:0.9rem; color:#1e293b;">振込処理アクション</h4>
                    <textarea id="action-comment" rows="2" placeholder="振込メモなど (任意)" style="width:100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:1rem;"></textarea>
                    <button class="btn btn-primary" onclick="window.invoiceAction('${wf.id}', 'pending_mf')" style="width:100%; background:#3b82f6; border-color:#3b82f6; margin-bottom:0.5rem;"><i class="fas fa-check"></i> 振込完了 (経理へ)</button>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-secondary" onclick="window.invoiceAction('${wf.id}', 'rejected_prev')" style="flex:1; font-size:0.8rem; border-color:#fca5a5; color:#ef4444;">1つ前へ差戻し</button>
                        <button class="btn btn-secondary" onclick="window.invoiceAction('${wf.id}', 'rejected_start')" style="flex:1; font-size:0.8rem; border-color:#fca5a5; color:#ef4444;">最初からやり直し</button>
                    </div>
                </div>
            `;
        } else if (wf.status === 'pending_mf') {
            actionsHtml = `
                <div class="action-box">
                    <h4 style="margin:0 0 1rem 0; font-size:0.9rem; color:#1e293b;">MF登録アクション</h4>

                    <div style="display:flex; align-items:center; margin-bottom:1rem; padding-left: 36px; position:relative;">
                        <span style="position:absolute; left:0; display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; background:#3b82f6; color:white; border-radius:50%; font-weight:bold; font-size:0.85rem;">1</span>
                        <button class="btn btn-primary" onclick="window.forceDownload('${pdfUrl}', '${displayFileName}', event)" style="width:100%; background:#3b82f6; border-color:#3b82f6;"><i class="fas fa-download"></i> 証憑をダウンロード</button>
                    </div>

                    <div style="display:flex; align-items:center; margin-bottom:1.5rem; padding-left: 36px; position:relative;">
                        <span style="position:absolute; left:0; display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; background:#10b981; color:white; border-radius:50%; font-weight:bold; font-size:0.85rem;">2</span>
                        <button class="btn btn-primary" onclick="window.open('https://box.moneyforward.com/files?page=1', '_blank')" style="width:100%; background:#10b981; border-color:#10b981;"><i class="fas fa-external-link-alt"></i> MFクラウドBOXに格納</button>
                    </div>

                    <div style="display:flex; align-items:flex-start; margin-bottom:0.5rem; flex-direction:column; padding-left: 36px; position:relative;">
                        <span style="position:absolute; left:0; top:0; display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; background:#8b5cf6; color:white; border-radius:50%; font-weight:bold; font-size:0.85rem;">3</span>
                        <textarea id="action-comment" rows="1" placeholder="コメント (任意)" style="width:100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:0.5rem; box-sizing: border-box;"></textarea>
                        <button class="btn btn-primary" onclick="window.invoiceAction('${wf.id}', 'completed')" style="width:100%; background:#8b5cf6; border-color:#8b5cf6;"><i class="fas fa-check-double"></i> MF登録完了</button>
                    </div>

                    <div style="display:flex; gap:0.5rem; margin-top: 1rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                        <button class="btn btn-secondary" onclick="window.invoiceAction('${wf.id}', 'rejected_prev')" style="flex:1; font-size:0.8rem; border-color:#fca5a5; color:#ef4444;">1つ前へ差戻し</button>
                        <button class="btn btn-secondary" onclick="window.invoiceAction('${wf.id}', 'rejected_start')" style="flex:1; font-size:0.8rem; border-color:#fca5a5; color:#ef4444;">最初からやり直し</button>
                    </div>
                </div>
            `;
        }
    }

    if (isAdmin) {
        actionsHtml += `
            <div style="margin-top:2rem; text-align:right;">
                <button class="btn btn-secondary" onclick="window.deleteInvoice('${wf.id}')" style="border-color:#ef4444; color:#ef4444; background:white; font-size:0.8rem;">
                    <i class="fas fa-trash-alt"></i> この案件を削除 (管理者のみ)
                </button>
            </div>
        `;
    }

    const historyHtml = (wf.history || []).map(h => {
        const histUser = ALL_USERS.find(u => u.id === h.user_id);
        const histUserName = histUser ? histUser.name : h.user_id;
        return `
        <div class="timeline-item">
            <div class="timeline-date">${new Date(h.timestamp).toLocaleString('ja-JP')}</div>
            <div class="timeline-user"><i class="fas fa-user-circle"></i> ${histUserName} <span style="font-size:0.7rem; color:#64748b; font-weight:normal;">(${h.action})</span></div>
            ${h.comment ? `<div class="timeline-comment">${h.comment}</div>` : ''}
        </div>
        `;
    }).join('');

    const closeBtnHtml = isHistoryDetail ? `
        <button class="btn btn-secondary" onclick="window.renderHistoryTable()" style="margin-bottom: 1rem; border-color: #cbd5e1; color: #475569; font-weight: 800;"><i class="fas fa-arrow-left"></i> 履歴リストへ戻る</button>
    ` : '';

    container.innerHTML = `
        <div style="padding:1.5rem; height:100%; overflow-y:auto; box-sizing:border-box;">
            ${closeBtnHtml}
            <div class="detail-header">
                <div>
                    <div class="${statusObj.class} status-badge">${statusObj.label}</div>
                    <h2 style="margin:0; font-size:1.4rem; color:#1e293b;">${wf.payload?.supplier || '不明'}</h2>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.85rem; color:#64748b; font-weight:700;">請求金額</div>
                    <div style="font-size:1.5rem; font-weight:900; color:#1e293b;">¥${Number(wf.payload?.amount || 0).toLocaleString()}</div>
                </div>
            </div>
            <div class="detail-content" style="display:block; overflow-y:auto; padding:0; padding-top:1.5rem;">
            ${fileLinkHtml}
            <div style="background:#f8fafc; padding:1rem; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:1.5rem;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <div style="font-size:0.75rem; color:#64748b; font-weight:700;">支払期限</div>
                        <div style="font-weight:800; color:${new Date(wf.payload?.deadline) < new Date() ? '#ef4444' : '#1e293b'};">${wf.payload?.deadline || '未設定'}</div>
                    </div>
                    <div>
                        <div style="font-size:0.75rem; color:#64748b; font-weight:700;">申請者</div>
                        <div style="font-weight:800; color:#1e293b;">${requesterName}</div>
                    </div>
                </div>
            </div>

            ${actionsHtml}

            <div class="timeline-container">
                <h4 style="margin:0 0 1.5rem 0; font-size:1rem; color:#1e293b; display:flex; align-items:center; gap:0.5rem;"><i class="fas fa-history" style="color:#64748b;"></i> 対応履歴</h4>
                ${historyHtml}
            </div>
        </div>
        </div>
    `;
}

async function submitNewInvoice() {
    const supplier = document.getElementById('inv-supplier').value;
    const amount = document.getElementById('inv-amount').value;
    const deadline = document.getElementById('inv-deadline').value;
    const note = document.getElementById('inv-note').value;
    const user = window.appState?.currentUser;

    if (!supplier || !amount || !deadline) {
        showAlert('必須項目を入力してください。', 'warning');
        return;
    }
    if (!currentFile) {
        showAlert('請求書ファイルをアップロードしてください。', 'warning');
        return;
    }

    const rawAmount = amount.replace(/,/g, '');
    const numAmount = Number(rawAmount);

    // 重複チェック
    let duplicateLinksHtml = '';
    if (typeof currentWorkflows !== 'undefined' && Array.isArray(currentWorkflows)) {
        const duplicates = currentWorkflows.filter(wf => {
            return wf.payload &&
                   wf.payload.supplier === supplier &&
                   Number(wf.payload.amount) === numAmount &&
                   wf.payload.deadline === deadline;
        });

        if (duplicates.length > 0) {
            let links = duplicates.map((wf, idx) => {
                const url = wf.attachments?.[0] || '#';
                const dateStr = new Date(wf.createdAt || Date.now()).toLocaleDateString('ja-JP');
                return `<a href="${url}" target="_blank" style="display:block; color:#2563eb; text-decoration:underline; margin-bottom:0.4rem;">🔗 過去のファイル ${idx + 1}（${dateStr} 申請分）</a>`;
            }).join('');

            duplicateLinksHtml = `
                <div style="color: #991b1b; margin-bottom: 1rem; border: 1px solid #f87171; padding: 1rem; background: #fef2f2; border-radius: 8px;">
                    <div style="font-weight: 800; display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
                        <i class="fas fa-exclamation-triangle"></i> 【警告】二重支払いの可能性があります
                    </div>
                    <p style="margin:0 0 0.8rem 0; font-size:0.85rem;">過去に同じ内容（取引先名、請求金額、支払期限）の申請が存在します。以下のファイルを開き、今回申請する内容と同一でないかご確認ください。</p>
                    <div style="font-size:0.85rem; padding-left:0.5rem;">
                        ${links}
                    </div>
                </div>
            `;
        }
    }

    // --- 確認ダイアログの表示 ---
    const formattedAmount = numAmount.toLocaleString('ja-JP');
    const confirmHtml = `
        ${duplicateLinksHtml}
        <div style="text-align: left; background: #f8fafc; padding: 1rem; border-radius: 8px; font-size: 0.9rem;">
            <p style="margin: 0.2rem 0;"><strong>取引先名:</strong> ${supplier}</p>
            <p style="margin: 0.2rem 0;"><strong>請求金額:</strong> ${formattedAmount} 円 (税込)</p>
            <p style="margin: 0.2rem 0;"><strong>支払期限:</strong> ${deadline}</p>
            <p style="margin: 0.2rem 0;"><strong>ファイル:</strong> ${currentFile.name}</p>
            ${note ? `<p style="margin: 0.5rem 0 0.2rem 0;"><strong>備考:</strong><br>${note.replace(/\n/g, '<br>')}</p>` : ''}
        </div>
        <p style="margin-top:1.5rem; text-align:center; font-weight:800; color:var(--text-primary);">この内容で申請してもよろしいですか？</p>
    `;

    const isConfirmed = await showConfirm('申請内容の確認', confirmHtml);
    if (!isConfirmed) {
        return; // キャンセルされた場合は中断
    }

    const btn = document.getElementById('btn-submit-new');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

    try {
        const fileExt = currentFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const storageRef = ref(storage, `invoices/${fileName}`);
        await uploadBytes(storageRef, currentFile);
        const downloadUrl = await getDownloadURL(storageRef);

        const payload = {
            supplier,
            amount: numAmount,
            deadline,
            note,
            fileName: currentFile.name
        };

        const assignees = (workflowConfig['pending_approval'] || { roles: [], userIds: [] });

        const wfId = await workflowEngine.createWorkflow('invoice', payload, assignees, 'pending_approval', user.displayName || user.id);
        
        if (downloadUrl) {
             await updateDoc(doc(db, 'workflows', wfId), { attachments: [downloadUrl] });
        }
        
        if (note) {
            await workflowEngine.addComment(wfId, user.displayName || user.id, note);
        }

        showAlert('請求書の申請が完了しました！', 'success');
        closeNewModal();
        loadWorkflows();

    } catch (error) {
        console.error(error);
        showAlert('申請に失敗しました。', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> 申請する';
    }
}

window.invoiceAction = async function(wfId, actionType) {
    const commentEl = document.getElementById('action-comment');
    const comment = commentEl ? commentEl.value : '';
    const user = window.appState?.currentUser;
    const userName = user?.displayName || user?.id || 'Unknown';
    
    const wf = currentWorkflows.find(w => w.id === wfId);
    if (!wf) return;

    let targetStatus = '';
    let nextAssignees = { roles: [], userIds: [] };
    let actionName = '';

    if (actionType === 'pending_transfer') {
        targetStatus = 'pending_transfer';
        actionName = 'APPROVED';
        nextAssignees = (workflowConfig['pending_transfer'] || { roles: [], userIds: [] }); 
    } else if (actionType === 'pending_mf') {
        targetStatus = 'pending_mf';
        actionName = 'TRANSFERRED';
        nextAssignees = (workflowConfig['pending_mf'] || { roles: [], userIds: [] });
    } else if (actionType === 'completed') {
        targetStatus = 'completed';
        actionName = 'MF_REGISTERED';
    } else if (actionType === 'rejected_start') {
        targetStatus = 'rejected';
        actionName = 'REJECTED_TO_START';
        if (!comment) {
            showAlert('差戻しの場合はコメントを入力してください。', 'warning');
            return;
        }
    } else if (actionType === 'rejected_prev') {
        actionName = 'REJECTED_TO_PREV';
        if (!comment) {
            showAlert('差戻しの場合はコメントを入力してください。', 'warning');
            return;
        }
        if (wf.status === 'pending_transfer') {
            targetStatus = 'pending_approval';
            nextAssignees = (workflowConfig['pending_approval'] || { roles: [], userIds: [] });
        } else if (wf.status === 'pending_mf') {
            targetStatus = 'pending_transfer';
            nextAssignees = (workflowConfig['pending_transfer'] || { roles: [], userIds: [] });
        }
    }

    if (!await showConfirm('このアクションを実行しますか？')) return;

    try {
        await workflowEngine.updateWorkflowStatus(wfId, targetStatus, nextAssignees, userName, actionName, comment);
        showAlert('処理が完了しました。', 'success');
        loadWorkflows();
        
        document.getElementById('invoice-detail-container').innerHTML = `
            <div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-secondary); flex-direction:column; gap:1rem;">
                <i class="fas fa-check-circle" style="font-size: 5rem; color: #10b981;"></i>
                <p style="font-weight:700; text-align:center; line-height:1.6; color:#94a3b8;">
                    処理が完了しました。<br>次のタスクを選択してください。
                </p>
            </div>
        `;
    } catch (error) {
        showAlert('処理に失敗しました。', 'error');
    }
};

window.deleteInvoice = async function(wfId) {
    if (!await showConfirm('本当にこの申請データを完全に削除しますか？\n（この操作は元に戻せません）')) return;

    try {
        await workflowEngine.deleteWorkflow(wfId);
        showAlert('削除しました。', 'success');
        selectedWorkflowId = null;

        if (isHistoryMode) {
            currentWorkflows = currentWorkflows.filter(w => w.id !== wfId);
            renderHistoryTable();
        } else {
            loadWorkflows();
        }
        
        document.getElementById('invoice-detail-container').innerHTML = `
            <div style="display:flex; height:100%; align-items:center; justify-content:center; color:var(--text-secondary); flex-direction:column; gap:1rem;">
                <i class="fas fa-trash-alt" style="font-size: 5rem; color: #cbd5e1;"></i>
                <p style="font-weight:700; text-align:center; line-height:1.6; color:#94a3b8;">
                    データを削除しました。<br>左のリストから案件を選択してください。
                </p>
            </div>
        `;
    } catch (error) {
        showAlert('削除に失敗しました。', 'error');
    }
};

window.forceDownload = async function(url, filename, event) {
    let btn = null;
    if (event && event.currentTarget) {
        btn = event.currentTarget;
    }
    
    try {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ダウンロード中...';
            btn.disabled = true;
        }

        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);

        if (btn) {
            btn.innerHTML = '<i class="fas fa-download"></i> 証憑をダウンロード';
            btn.disabled = false;
        }
    } catch (e) {
        console.error('Download failed', e);
        window.open(url, '_blank');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-download"></i> 証憑をダウンロード';
            btn.disabled = false;
        }
    }
};

function renderHistoryTable() {
    const container = document.getElementById('invoice-detail-container');
    
    // Filter logic
    let historyWfs = currentWorkflows.filter(wf => wf.status === 'completed' || wf.status === 'rejected');
    
    // Apply historyFilters
    if (historyFilters.date) {
        historyWfs = historyWfs.filter(wf => {
            if (!wf.updated_at) return false;
            const dt = new Date(wf.updated_at.seconds ? wf.updated_at.seconds * 1000 : wf.updated_at);
            const ds = dt.toISOString().split('T')[0];
            return ds === historyFilters.date;
        });
    }
    if (historyFilters.supplier) {
        const query = historyFilters.supplier.toLowerCase();
        historyWfs = historyWfs.filter(wf => (wf.payload?.supplier || '').toLowerCase().includes(query));
    }
    if (historyFilters.amount) {
        const amt = parseInt(historyFilters.amount, 10);
        historyWfs = historyWfs.filter(wf => parseInt(wf.payload?.amount, 10) === amt);
    }
    if (historyFilters.deadline) {
        historyWfs = historyWfs.filter(wf => wf.payload?.deadline === historyFilters.deadline);
    }
    if (historyFilters.applicant) {
        const query = historyFilters.applicant.toLowerCase();
        historyWfs = historyWfs.filter(wf => {
            const requester = ALL_USERS.find(u => u.id === wf.requester_id);
            const applicantName = requester ? requester.name : wf.requester_id;
            return (applicantName || '').toLowerCase().includes(query);
        });
    }

    const totalItems = historyWfs.length;
    const totalPages = Math.ceil(totalItems / historyItemsPerPage) || 1;
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    if (historyCurrentPage < 1) historyCurrentPage = 1;

    const startIdx = (historyCurrentPage - 1) * historyItemsPerPage;
    const pagedWfs = historyWfs.slice(startIdx, startIdx + historyItemsPerPage);

    let rowsHtml = '';
    if (pagedWfs.length === 0) {
        rowsHtml = '<tr><td colspan="7" style="text-align:center; padding: 3rem; color: var(--text-secondary);">該当する履歴がありません</td></tr>';
    } else {
        pagedWfs.forEach(wf => {
            const dateStr = wf.updated_at ? new Date(wf.updated_at.seconds ? wf.updated_at.seconds * 1000 : wf.updated_at).toLocaleDateString() : '';
            const supplier = wf.payload?.supplier || '-';
            const amount = wf.payload?.amount ? `¥${parseInt(wf.payload.amount).toLocaleString()}` : '-';
            const deadline = wf.payload?.deadline || '-';
            const requester = ALL_USERS.find(u => u.id === wf.requester_id);
            const applicant = requester ? requester.name : wf.requester_id;
            
            let fileHtml = '-';
            const pdfUrl = wf.attachments?.[0] || '';
            if (pdfUrl) {
                fileHtml = `<button class="btn btn-secondary" style="padding:0.4rem 0.6rem; font-size:0.85rem; border-color:#cbd5e1;" onclick="window.open('${pdfUrl}', '_blank'); event.stopPropagation();"><i class="fas fa-file-pdf" style="color:#ef4444;"></i> 表示</button>`;
            }
            
            let commentHtml = '-';
            // 完了時（または差戻し時）のコメントを探す
            let lastComment = '';
            if (wf.history && wf.history.length > 0) {
                const completionEvents = wf.history.filter(t => (t.action === 'completed' || t.action === 'rejected') && t.comment);
                if (completionEvents.length > 0) {
                    lastComment = completionEvents[completionEvents.length - 1].comment;
                }
            }
            
            if (lastComment) {
                commentHtml = `
                    <div class="comment-tooltip" onclick="event.stopPropagation();">
                        <i class="fas fa-comment-dots" style="font-size: 1.2rem; color: #10b981;"></i>
                        <span class="tooltip-text">${lastComment.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
                    </div>
                `;
            }

            rowsHtml += `
                <tr class="history-row" data-wfid="${wf.id}">
                    <td>${dateStr}</td>
                    <td style="font-weight:700;">${supplier}</td>
                    <td>${amount}</td>
                    <td>${deadline}</td>
                    <td>${applicant}</td>
                    <td>${fileHtml}</td>
                    <td style="text-align:center;">${commentHtml}</td>
                </tr>
            `;
        });
    }

    let paginationHtml = '';
    if (totalPages > 1) {
        let pageBtns = '';
        for (let i = 1; i <= totalPages; i++) {
            if (i === historyCurrentPage) {
                pageBtns += `<button class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem; background: #3b82f6; border-color: #3b82f6;">${i}</button>`;
            } else {
                pageBtns += `<button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" onclick="window.goToHistoryPage(${i})">${i}</button>`;
            }
        }
        paginationHtml = `
            <div class="pagination">
                <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" onclick="window.goToHistoryPage(${historyCurrentPage - 1})" ${historyCurrentPage === 1 ? 'disabled' : ''}>前へ</button>
                ${pageBtns}
                <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" onclick="window.goToHistoryPage(${historyCurrentPage + 1})" ${historyCurrentPage === totalPages ? 'disabled' : ''}>次へ</button>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="padding: 1.5rem; height: 100%; overflow-y: auto; box-sizing: border-box; background: #f8fafc; border-radius: 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h2 style="margin:0; color:#1e293b; font-size:1.3rem; font-weight:800;"><i class="fas fa-history" style="color:#64748b;"></i> 過去の履歴一覧</h2>
                <div style="font-size:0.85rem; color:#64748b;">全 ${totalItems} 件中 ${startIdx + 1}〜${Math.min(startIdx + historyItemsPerPage, totalItems)} 件を表示</div>
            </div>
            
            <div class="history-filter-row">
                <div style="flex:1;"><label style="font-size:0.75rem; color:#64748b; display:block; margin-bottom:0.2rem;">完了日</label><input type="date" id="filter-date" value="${historyFilters.date}"></div>
                <div style="flex:1.5;"><label style="font-size:0.75rem; color:#64748b; display:block; margin-bottom:0.2rem;">取引先名</label><input type="text" id="filter-supplier" value="${historyFilters.supplier}" placeholder="部分一致"></div>
                <div style="flex:1;"><label style="font-size:0.75rem; color:#64748b; display:block; margin-bottom:0.2rem;">請求金額</label><input type="number" id="filter-amount" value="${historyFilters.amount}" placeholder="完全一致"></div>
                <div style="flex:1;"><label style="font-size:0.75rem; color:#64748b; display:block; margin-bottom:0.2rem;">支払期限</label><input type="date" id="filter-deadline" value="${historyFilters.deadline}"></div>
                <div style="flex:1.5;"><label style="font-size:0.75rem; color:#64748b; display:block; margin-bottom:0.2rem;">申請者</label><input type="text" id="filter-applicant" value="${historyFilters.applicant}" placeholder="部分一致"></div>
                <div style="display:flex; align-items:flex-end;">
                    <button class="btn btn-secondary" onclick="window.clearHistoryFilters()" style="padding: 0.55rem 1rem; height: 38px;"><i class="fas fa-times"></i> クリア</button>
                </div>
            </div>

            <div class="history-table-container">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>完了日</th>
                            <th>取引先名</th>
                            <th>請求金額</th>
                            <th>支払期限</th>
                            <th>申請者</th>
                            <th>ファイル</th>
                            <th style="text-align:center;">コメント</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            
            ${paginationHtml}
        </div>
    `;

    // バインディング
    document.querySelectorAll('.history-row').forEach(row => {
        row.addEventListener('click', () => {
            const wfId = row.getAttribute('data-wfid');
            console.log('Row clicked:', wfId);
            try {
                viewHistoryDetail(wfId);
            } catch (e) {
                alert('Click handling error: ' + e.message);
            }
        });
    });

    const bindFilter = (id, key) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                historyFilters[key] = e.target.value;
                historyCurrentPage = 1;
                renderHistoryTable();
            });
        }
    };
    bindFilter('filter-date', 'date');
    bindFilter('filter-supplier', 'supplier');
    bindFilter('filter-amount', 'amount');
    bindFilter('filter-deadline', 'deadline');
    bindFilter('filter-applicant', 'applicant');
}

window.goToHistoryPage = function(page) {
    historyCurrentPage = page;
    renderHistoryTable();
};

window.clearHistoryFilters = function() {
    historyFilters = { date: '', supplier: '', amount: '', deadline: '', applicant: '' };
    historyCurrentPage = 1;
    renderHistoryTable();
};

function viewHistoryDetail(wfId) {
    try {
        selectedWorkflowId = wfId;
        const wf = currentWorkflows.find(w => w.id === wfId);
        renderDetail(wf, true);
    } catch (e) {
        console.error("viewHistoryDetail Error:", e);
        alert("詳細画面の描画でエラーが発生しました: " + e.message);
    }
}

window.viewHistoryDetail = viewHistoryDetail;

window.renderHistoryTable = renderHistoryTable;
