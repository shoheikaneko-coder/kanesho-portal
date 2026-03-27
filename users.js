let currentView = 'list';
let editingUserData = null;
let cachedUsers = [];

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
                            <th style="padding: 1rem; font-weight: 600;">所属店舗</th>
                            <th style="padding: 1rem; font-weight: 600;">権限</th>
                            <th style="padding: 1rem; font-weight: 600;">打刻PW</th>
                            <th style="padding: 1rem; font-weight: 600;">ログインPW</th>
                            <th style="padding: 1rem; text-align: right; font-weight: 600;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body"></tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('btn-add-user').onclick = () => {
        editingUserData = null;
        currentView = 'form';
        renderView();
    };

    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const val = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#users-table-body tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(val) ? '' : 'none';
            });
        };
    }

    fetchAndRenderUsers();
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
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="input-group">
                            <label style="font-weight: 700; color: #475569;">所属店舗</label>
                            <select id="user-store-select" required style="background: white; font-weight: 600;">
                                <option value="">店舗を選択...</option>
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
            document.getElementById('user-store-select').value = editingUserData.StoreID || '';
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
            'StoreID': storeSelect.value,
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
    renderView();
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

async function fetchAndRenderUsers() {
    const tbody = document.getElementById('users-table-body');
    const countLabel = document.getElementById('users-count');
    if (!tbody) return;

    try {
        const querySnapshot = await getDocs(collection(db, "m_users"));
        cachedUsers = [];
        querySnapshot.forEach((doc) => {
            cachedUsers.push({ id: doc.id, ...doc.data() });
        });

        countLabel.textContent = `全 ${cachedUsers.length} 件`;

        tbody.innerHTML = '';
        cachedUsers.forEach(item => {
            const roleNameMap = {
                'Admin': '管理者', 'Manager': '店長', 'Staff': '一般社員', 'PartTimer': 'アルバイト', 'Tablet': '店舗タブレット'
            };
            const role = item['Role'] || 'Staff';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding: 1rem; font-family: monospace;">${item['EmployeeCode'] || '-'}</td>
                <td style="padding: 1rem; font-weight: 600;">${item['Name'] || '-'}</td>
                <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.9rem;">${item['Store'] || '-'}</td>
                <td style="padding: 1rem;"><span class="badge ${role.toLowerCase()}">${roleNameMap[role] || role}</span></td>
                <td style="padding: 1rem; font-family: monospace; color: var(--text-secondary);">${item['ClockInPassword'] || '-'}</td>
                <td style="padding: 1rem; font-family: monospace; color: var(--text-secondary);">${item['LoginPassword'] ? '********' : '-'}</td>
                <td style="padding: 1rem; text-align: right;">
                    <button class="btn btn-edit-user" style="padding: 0.5rem; background: transparent; color: var(--text-secondary);"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete-user" style="padding: 0.5rem; background: transparent; color: var(--danger);"><i class="fas fa-trash-alt"></i></button>
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
                    fetchAndRenderUsers();
                });
            };
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7">読み込みエラー</td></tr>';
    }
}
