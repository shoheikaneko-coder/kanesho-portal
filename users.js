import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let currentView = 'list';
let editingUserData = null;
let cachedUsers = [];
let currentPage = 1;
const pageSize = 30;

export const usersPageHtml = `
    <div id="users-page-container" class="animate-fade-in">
        <!-- Content swapped here -->
    </div>
    <style>
        .badge.parttimer { background: rgba(100, 116, 139, 0.1); color: #64748b; }
        .badge.tablet { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; }
        .badge.staff { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
        .badge.manager { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .badge.admin { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
        .badge.status-active { background: rgba(16, 185, 129, 0.1); color: #059669; }
        .badge.status-resigning { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .badge.status-retired { background: rgba(100, 116, 139, 0.1); color: #64748b; }
    </style>
`;

function renderView() {
    const container = document.getElementById('users-page-container');
    if (!container) return;

    if (currentView === 'form') {
        renderFormView(container);
    } else {
        renderListView(container);
    }
}

function renderListView(container) {
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-users-cog" style="color: var(--primary);"></i>
                    ユーザー・従業員管理
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem;">スタッフのログイン権限、所属店舗、パスワード設定を管理します</p>
            </div>
            <button class="btn btn-primary" id="btn-add-user" style="padding: 0.8rem 1.5rem; font-weight: 700;">
                <i class="fas fa-plus"></i> 新規ユーザーを追加
            </button>
        </div>
        
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <div style="padding: 1.2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <div class="input-group" style="margin-bottom: 0; width: 350px;">
                    <i class="fas fa-search" style="top: 0.8rem;"></i>
                    <input type="text" id="user-search" placeholder="名前やコードで検索..." style="padding-top: 0.6rem; padding-bottom: 0.6rem; border-radius: 20px;">
                </div>
                <div id="users-count" style="color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                    読込中...
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: white; border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase;">
                            <th style="padding: 1rem; font-weight: 600;">従業員コード</th>
                            <th style="padding: 1rem; font-weight: 600;">お名前</th>
                            <th style="padding: 1rem; font-weight: 600;">所属性</th>
                            <th style="padding: 1rem; font-weight: 600;">権限</th>
                            <th style="padding: 1rem; font-weight: 600;">ステータス</th>
                            <th style="padding: 1rem; font-weight: 600;">打刻PW</th>
                            <th style="padding: 1rem; font-weight: 600;">ログインPW</th>
                            <th style="padding: 1rem; text-align: right; font-weight: 600;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body"></tbody>
                </table>
            </div>
            <div id="user-pagination" style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin: 1.5rem 0; clear: both;">
            </div>
        </div>
    `;

    const btnAdd = document.getElementById('btn-add-user');
    if (btnAdd) {
        btnAdd.onclick = () => {
            editingUserData = null;
            currentView = 'form';
            renderView();
        };
    }

    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        searchInput.oninput = (e) => {
            currentPage = 1;
            renderTable(e.target.value);
        };
    }

    renderTable();
}

function renderFormView(container) {
    const isEdit = !!editingUserData;
    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="max-width: 750px; margin: 0 auto; padding: 0; overflow: hidden;">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas ${isEdit ? 'fa-user-edit' : 'fa-user-plus'}" style="color: var(--primary);"></i>
                    ${isEdit ? 'ユーザー情報の編集' : '新規ユーザーの登録'}
                </h3>
                <button id="btn-form-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary);">
                    <i class="fas fa-times"></i> キャンセル
                </button>
            </div>
            
            <div style="padding: 2.5rem;">
                <form id="user-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="input-group">
                            <label style="font-weight: 700; color: #475569;">従業員コード (TKC連携用)</label>
                            <input type="text" id="user-code" placeholder="例: 135" required style="font-family: monospace; font-size: 1.1rem;">
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 700; color: #475569;">お名前</label>
                            <input type="text" id="user-name" required placeholder="例: 山田 太郎" style="font-size: 1.1rem;">
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 700; color: #475569;">シフト表示名 (ニックネーム)</label>
                            <input type="text" id="user-display-name" placeholder="例: 太郎" style="font-size: 1.1rem; background: #fffdf0; border: 1px solid #fde68a;">
                            <p style="font-size: 0.7rem; color: #b45309; margin-top: 0.2rem;">※シフト表に短く表示したい場合のみ入力</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1rem;">
                        <div class="input-group">
                            <label style="font-weight: 700; color: #475569;">所属店舗</label>
                            <select id="user-store-select" required style="background: white; font-weight: 600;">
                                <option value="">店舗を選択...</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 700; color: #475569;">在職状況</label>
                            <select id="user-status" required style="background: white; font-weight: 600;">
                                <option value="active">在職中</option>
                                <option value="resigning">退職手続き中</option>
                                <option value="retired">退職済</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 700; color: #475569;">権限レベル</label>
                            <select id="user-role" required style="background: white; font-weight: 600;">
                                <option value="Staff">一般社員</option>
                                <option value="PartTimer">アルバイトスタッフ</option>
                                <option value="Tablet">店舗タブレット</option>
                                <option value="Manager">店長</option>
                                <option value="Admin">管理者</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 700; color: #475569;">表示役職</label>
                            <input type="text" id="user-job-title" placeholder="副店長等" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
                        </div>
                    </div>

                    <div class="glass-panel" style="padding: 1rem 1.5rem; background: #fffcf0; border: 1px solid #fde68a; display: flex; align-items: center; gap: 1rem;">
                        <div style="flex: 1;">
                            <label style="font-weight: 800; color: #92400e; display: block; margin-bottom: 0.2rem;">週28時間制限 (留学生など)</label>
                            <p style="font-size: 0.75rem; color: #b45309; margin: 0;">チェックを入れるとシフト管理画面で28h超過アラートが有効になります</p>
                        </div>
                        <div class="switch-container">
                            <input type="checkbox" id="user-28h-limit" style="width: 20px; height: 20px; cursor: pointer;">
                        </div>
                    </div>

                    <div class="input-group">
                        <label style="font-weight: 700; color: #475569;">メールアドレス (ログイン用ID)</label>
                        <input type="email" id="user-email" placeholder="example@kaneshow.jp">
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.3rem;">※ポータルへのログインに使用します</p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; background: #f1f5f9; padding: 1.5rem; border-radius: 12px;">
                        <div class="input-group">
                            <label style="font-weight: 700; color: #334155;">打刻パスワード (数字4桁)</label>
                            <input type="text" id="user-password" placeholder="例: 1234" maxlength="4" style="font-family: monospace; text-align: center; font-size: 1.25rem; letter-spacing: 0.2em;">
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 700; color: #334155;">ログインパスワード</label>
                            <input type="password" id="user-login-password" placeholder="••••••••" style="font-size: 1.1rem;">
                        </div>
                    </div>

                    <!-- 操作案内ツール (編集時のみ) -->
                    <div id="password-info-section" style="display: ${isEdit ? 'block' : 'none'}; border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; background: white;">
                        <p style="font-size: 0.85rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; color: #475569;">設定情報の共有</p>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <button type="button" id="btn-send-reset-email" class="btn" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.85rem; padding: 0.8rem;">
                                <i class="fas fa-share-square"></i> ログイン情報をコピー
                            </button>
                            <button type="button" id="btn-show-clock-in-pw" class="btn" style="background: #fdf2f8; color: #db2777; border: 1px solid #fbcfe8; font-size: 0.85rem; padding: 0.8rem;">
                                <i class="fas fa-key"></i> 打刻PWを案内
                            </button>
                        </div>
                        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.8rem; text-align: center;">※クリックすると各案内の案内文がクリップボードにコピーされます</p>
                    </div>

                    <div style="display: flex; gap: 1rem; margin-top: 1rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
                        <button type="button" id="btn-form-cancel" class="btn" style="flex: 1; background: #f1f5f9; color: var(--text-secondary); font-weight: 700;">キャンセル</button>
                        <button type="submit" class="btn btn-primary" style="flex: 2; padding: 1rem; font-weight: 800; font-size: 1.1rem;">
                            <i class="fas fa-save" style="margin-right: 0.5rem;"></i>
                            ユーザー情報を保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('btn-form-back').onclick = document.getElementById('btn-form-cancel').onclick = () => {
        currentView = 'list';
        renderView();
    };

    fetchStoreOptions().then(() => {
        if (isEdit) {
            document.getElementById('user-code').value = editingUserData.EmployeeCode || '';
            document.getElementById('user-name').value = editingUserData.Name || '';
            document.getElementById('user-password').value = editingUserData.ClockInPassword || '';
            document.getElementById('user-login-password').value = editingUserData.LoginPassword || '';
            document.getElementById('user-email').value = editingUserData.Email || '';
            document.getElementById('user-role').value = editingUserData.Role || 'Staff';
            document.getElementById('user-status').value = editingUserData.Status || 'active';
            document.getElementById('user-store-select').value = editingUserData.StoreID || '';
            document.getElementById('user-28h-limit').checked = !!editingUserData.Has28hLimit;
            document.getElementById('user-display-name').value = editingUserData.DisplayName || '';
            document.getElementById('user-job-title').value = editingUserData.JobTitle || '';
        }
    });

    setupFormLogic();
}

function setupFormLogic() {
    const form = document.getElementById('user-form');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector('button[type="submit"]');
        const originalHtml = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        btnSubmit.disabled = true;

        const docId = editingUserData ? editingUserData.id : null;
        const storeSelect = document.getElementById('user-store-select');
        const selectedOpt = storeSelect.options[storeSelect.selectedIndex];
        
        const newUser = {
            'EmployeeCode': document.getElementById('user-code').value,
            'Name': document.getElementById('user-name').value,
            'ClockInPassword': document.getElementById('user-password').value,
            'LoginPassword': document.getElementById('user-login-password').value,
            'Email': document.getElementById('user-email').value,
            'Role': document.getElementById('user-role').value,
            'Store': selectedOpt ? selectedOpt.text : '',
            'StoreID': storeSelect.value || '', // StoreID is now primary
            'Has28hLimit': document.getElementById('user-28h-limit').checked,
            'DisplayName': document.getElementById('user-display-name').value,
            'JobTitle': document.getElementById('user-job-title').value,
            'Status': document.getElementById('user-status').value,
            'UpdatedAt': new Date().toISOString()
        };

        try {
            if (docId) { 
                await updateDoc(doc(db, "m_users", docId), newUser); 
                showAlert('成功', '保存しました。');
            } else { 
                await addDoc(collection(db, "m_users"), newUser);
                showAlert('成功', '登録しました。');
            }
            currentView = 'list';
            renderView();
        } catch (err) { 
            console.error(err);
            showAlert('エラー', '保存に失敗しました。'); 
        } finally {
            btnSubmit.innerHTML = originalHtml;
            btnSubmit.disabled = false;
        }
    };

    // Password info buttons
    const btnCopyLogin = document.getElementById('btn-send-reset-email');
    if (btnCopyLogin) {
        btnCopyLogin.onclick = async () => {
            const email = document.getElementById('user-email').value;
            const name = document.getElementById('user-name').value;
            const loginPw = document.getElementById('user-login-password').value;
            if (!email) return showAlert('警告', 'メールアドレスが設定されていません。');
            if (!loginPw) return showAlert('警告', 'ログインパスワードが設定されていません。');
            
            const text = `【かね将ポータル ログイン情報のご案内】\n${name} 様\n\nログインURL: ${location.origin}\nID: ${email}\nPW: ${loginPw}\n\n上記の情報でログインしてください。`;
            try {
                await navigator.clipboard.writeText(text);
                showAlert('成功', 'ログイン情報をコピーしました。');
            } catch(e) { showAlert('エラー', 'コピーに失敗しました。'); }
        };
    }

    const btnShowClockIn = document.getElementById('btn-show-clock-in-pw');
    if (btnShowClockIn) {
        btnShowClockIn.onclick = () => {
            const pw = document.getElementById('user-password').value;
            const name = document.getElementById('user-name').value;
            if(!pw) return showAlert('警告', "打刻パスワードが設定されていません。");
            
            const msg = `【打刻パスワードの案内】\n${name} 様\n\nあなたの打刻パスワードは「 ${pw} 」です。\n店舗のタブレット端末で打刻する際にご使用ください。`;
            navigator.clipboard.writeText(msg).then(() => {
                showAlert('案内文のコピー', msg);
            });
        };
    }
}

export async function initUsersPage() {
    const container = document.getElementById('users-page-container');
    if (container) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem; color: var(--primary);"></i>
                <p>ユーザーデータを読み込んでいます...</p>
            </div>
            <style>
                .badge.parttimer { background: rgba(100, 116, 139, 0.1); color: #64748b; }
                .badge.tablet { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; }
                .badge.staff { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
                .badge.manager { background: rgba(245, 158, 11, 0.1); color: #d97706; }
                .badge.admin { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
            </style>
        `;
    }

    try {
        await fetchUsersData();
        currentView = 'list';
        currentPage = 1;
        renderView();
    } catch (error) {
        console.error("Failed to load users data:", error);
        if (container) {
            container.innerHTML = `
                <div style="padding: 3rem; color: var(--danger); text-align: center; max-width: 600px; margin: 0 auto; background: #fef2f2; border-radius: 12px; margin-top: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3 style="margin-top: 0;">データの読み込みに失敗しました</h3>
                    <p style="font-weight: 600; font-size: 1.1rem;">Firebase APIまたはネットワークでエラーが発生しています。</p>
                    <p style="font-family: monospace; font-size: 0.9rem; background: rgba(0,0,0,0.05); padding: 1rem; border-radius: 8px; text-align: left; overflow-x: auto;">
                        ${error.message || error.toString()}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 1.5rem;">※ 詳細なログはブラウザのコンソール(F12)をご確認ください。</p>
                </div>
            `;
        }
    }
}

async function fetchUsersData() {
    const querySnapshot = await getDocs(collection(db, "m_users"));
    cachedUsers = [];
    querySnapshot.forEach((doc) => {
        cachedUsers.push({ id: doc.id, ...doc.data() });
    });
}

async function fetchStoreOptions() {
    const sel = document.getElementById('user-store-select');
    if(!sel) return;
    try {
        const snap = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
        sel.innerHTML = '<option value="">店舗を選択してください</option>';
        snap.forEach(d => {
            const data = d.data();
            const opt = document.createElement('option');
            opt.value = data.store_id;
            opt.textContent = data.store_name;
            sel.appendChild(opt);
        });
    } catch(e) { console.error(e); }
}

function renderTable(filter = "") {
    const tbody = document.getElementById('users-table-body');
    const countLabel = document.getElementById('users-count');
    if (!tbody) return;

    try {
        const filtered = cachedUsers.filter(u => {
            const f = filter.toLowerCase();
            return (u.Name || '').toLowerCase().includes(f) || 
                   (u.EmployeeCode || '').toLowerCase().includes(f);
        });

        const totalItems = filtered.length;
        let totalPages = Math.ceil(totalItems / pageSize);
        if (totalPages === 0) totalPages = 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * pageSize;
        const itemsToShow = filtered.slice(startIndex, startIndex + pageSize);

        if (countLabel) {
            if (totalItems === 0) {
                countLabel.textContent = '表示中: 0 件';
            } else {
                countLabel.textContent = `表示中: ${startIndex + 1}-${Math.min(startIndex + pageSize, totalItems)} / ${totalItems} 件`;
            }
        }

        tbody.innerHTML = '';
        renderPagination(totalPages, filter);

        if (itemsToShow.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 4rem; color: var(--text-secondary);">該当するユーザーが見つかりません</td></tr>';
            return;
        }

        itemsToShow.forEach(item => {
            const roleNameMap = {
                'Admin': '管理者', 'Manager': '店長', 'Staff': '一般社員', 'PartTimer': 'アルバイト', 'Tablet': '店舗タブレット'
            };
            const role = item['Role'] || 'Staff';
            const status = item['Status'] || 'active';
            const statusMap = { 'active': '在職', 'resigning': '退職手続中', 'retired': '退職' };

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.style.transition = 'background 0.2s';
            tr.innerHTML = `
                <td style="padding: 1rem; font-family: monospace;">${item['EmployeeCode'] || '-'}</td>
                <td style="padding: 1rem; font-weight: 600;">
                    ${item['Name'] || '-'}
                    ${item['DisplayName'] ? `<br><span style="font-size:0.7rem; color:var(--text-secondary); font-weight:400;">(${item['DisplayName']})</span>` : ''}
                </td>
                <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.85rem;">${item['Store'] || '-'}</td>
                <td style="padding: 1rem;"><span class="badge ${role.toLowerCase()}">${roleNameMap[role] || role}</span></td>
                <td style="padding: 1rem;"><span class="badge status-${status}">${statusMap[status]}</span></td>
                <td style="padding: 1rem; font-family: monospace; color: var(--text-secondary);">${item['ClockInPassword'] || '-'}</td>
                <td style="padding: 1rem; font-family: monospace; color: var(--text-secondary);">${item['LoginPassword'] ? '********' : '-'}</td>
                <td style="padding: 1rem; text-align: right;">
                    <button class="btn btn-edit-user" style="padding: 0.5rem; background: transparent; color: var(--text-secondary);" title="編集"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete-user" style="padding: 0.5rem; background: transparent; color: var(--danger);" title="削除"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;

            tr.querySelector('.btn-edit-user').onclick = () => {
                editingUserData = item;
                currentView = 'form';
                renderView();
            };

            tr.querySelector('.btn-delete-user').onclick = async () => {
                showConfirm('ユーザー削除', `${item['Name']} 様を削除しますか？`, async () => {
                    await deleteDoc(doc(db, "m_users", item.id));
                    await fetchUsersData();
                    renderTable(filter);
                });
            };
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Error rendering users:', e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> エラーが発生しました</td></tr>';
    }
}

function renderPagination(totalPages, filter) {
    const container = document.getElementById('user-pagination');
    if (!container) return;
    container.innerHTML = '';
    
    if (totalPages <= 1) return;

    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn';
    btnPrev.style.padding = '0.4rem 0.8rem';
    btnPrev.style.background = 'var(--surface-darker)';
    btnPrev.disabled = currentPage === 1;
    btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnPrev.onclick = () => {
        currentPage--;
        renderTable(filter);
        document.querySelector('.page-content').scrollTop = 0;
    };
    container.appendChild(btnPrev);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.padding = '0.4rem 0.8rem';
        btn.style.minWidth = '36px';
        if (i === currentPage) {
            btn.classList.add('btn-primary');
        } else {
            btn.style.background = 'white';
            btn.style.border = '1px solid var(--border)';
            btn.onclick = () => {
                currentPage = i;
                renderTable(filter);
                document.querySelector('.page-content').scrollTop = 0;
            };
        }
        btn.textContent = i;
        container.appendChild(btn);
    }

    const btnNext = document.createElement('button');
    btnNext.className = 'btn';
    btnNext.style.padding = '0.4rem 0.8rem';
    btnNext.style.background = 'var(--surface-darker)';
    btnNext.disabled = currentPage === totalPages;
    btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnNext.onclick = () => {
        currentPage++;
        renderTable(filter);
        document.querySelector('.page-content').scrollTop = 0;
    };
    container.appendChild(btnNext);
}
