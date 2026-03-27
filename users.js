import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const usersPageHtml = `
    <div class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h3 style="color: var(--text-secondary);">ユーザー登録/変更</h3>
            <button class="btn btn-primary" id="btn-add-user">
                <i class="fas fa-user-plus"></i> 新規ユーザーを追加
            </button>
        </div>
        
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div class="input-group" style="margin-bottom: 0; width: 300px; max-width: 100%;">
                    <i class="fas fa-search" style="top: 0.8rem;"></i>
                    <input type="text" id="user-search" placeholder="名前やコードで検索..." style="padding-top: 0.6rem; padding-bottom: 0.6rem;">
                </div>
                <div id="users-count" style="color: var(--text-secondary); font-size: 0.9rem; font-weight: 500;">
                    読込中...
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; min-width: 900px; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-secondary); font-size: 0.85rem;">
                            <th style="padding: 1rem; font-weight: 600;">従業員コード（TKC自動生成）</th>
                            <th style="padding: 1rem; font-weight: 600;">名前</th>
                            <th style="padding: 1rem; font-weight: 600;">打刻PW</th>
                            <th style="padding: 1rem; font-weight: 600;">ログインPW</th>
                            <th style="padding: 1rem; font-weight: 600;">メール / ID</th>
                            <th style="padding: 1rem; font-weight: 600;">権限</th>
                            <th style="padding: 1rem; font-weight: 600;">所属店舗</th>
                            <th style="padding: 1rem; text-align: right; font-weight: 600;">アクション</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body"></tbody>
                </table>
            </div>
        </div>
        
    </div>
    
    <!-- ユーザー編集モーダル -->
    <div id="user-modal" class="modal-overlay" style="display: none; position: fixed !important; inset: 0 !important; background: rgba(0,0,0,0.5) !important; z-index: 10000 !important; align-items: center; justify-content: center;">
        <div class="glass-panel animate-scale-in" style="width: 100%; max-width: 500px; padding: 2rem;">
            <button id="close-user-modal" style="position: absolute; right: 1.5rem; top: 1.5rem; background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-secondary);"><i class="fas fa-times"></i></button>
            <h3 id="user-modal-title" style="margin-bottom: 1.5rem;">ユーザー登録</h3>
            <form id="user-form">
                <input type="hidden" id="user-doc-id">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="input-group">
                        <label>従業員コード（TKC自動生成）</label>
                        <input type="text" id="user-code" placeholder="例: 135" required>
                    </div>
                    <div class="input-group">
                        <label>打刻パスワード (数字4桁)</label>
                        <input type="text" id="user-password" placeholder="例: 1234">
                    </div>
                    <div class="input-group">
                        <label>ログインパスワード</label>
                        <input type="password" id="user-login-password" placeholder="••••••••">
                    </div>
                </div>
                <div class="input-group">
                    <label>お名前</label>
                    <input type="text" id="user-name" required>
                </div>
                <div class="input-group">
                    <label>メールアドレス (ログイン・招待用)</label>
                    <input type="email" id="user-email" placeholder="任意：入力するとパスワード設定案内が可能">
                </div>
                <div class="input-group">
                    <label>所属店舗</label>
                    <select id="user-store-select" style="width: 100%; padding: 0.8rem 1rem; border: 1px solid var(--border); border-radius: 8px; background: white; font-size: 1rem;" required>
                        <option value="">店舗を選択してください</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>権限</label>
                    <select id="user-role" style="width: 100%; padding: 0.8rem 1rem; border: 1px solid var(--border); border-radius: 8px; background: white; font-size: 1rem;" required>
                        <option value="Staff">一般社員</option>
                        <option value="PartTimer">アルバイトスタッフ</option>
                        <option value="Tablet">店舗タブレット</option>
                        <option value="Manager">店長</option>
                        <option value="Admin">管理者</option>
                    </select>
                </div>
                
                <div id="password-reset-section" style="display: none; margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border);">
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.8rem; font-weight: 600;">各種設定案内:</p>
                    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                        <button type="button" id="btn-send-reset-email" class="btn btn-primary" style="width: 100%; font-size: 0.85rem; padding: 0.6rem;">
                            <i class="fas fa-paper-plane"></i> ログインID・PW設定案内を送信
                        </button>
                        <button type="button" id="btn-show-clock-in-pw" class="btn" style="width: 100%; font-size: 0.85rem; padding: 0.6rem; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;">
                            <i class="fas fa-key"></i> 打刻PW設定案内を表示
                        </button>
                    </div>
                </div>

                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 1rem;">
                    ※権限により、ポータルでの表示内容が制限されます。
                </p>
                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 1rem; margin-top: 1.5rem;"><i class="fas fa-save"></i> 保存する</button>
            </form>
        </div>
    </div>
    <style>
        .badge.parttimer { background: rgba(100, 116, 139, 0.1); color: #64748b; }
        .badge.tablet { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; }
    </style>
`;

export async function initUsersPage() {
    await fetchStoreOptions();
    await fetchAndRenderUsers();
    
    const btnAdd = document.getElementById('btn-add-user');
    const modal = document.getElementById('user-modal');
    const btnClose = document.getElementById('close-user-modal');
    const form = document.getElementById('user-form');
    
    if(btnAdd && modal) {
        btnAdd.onclick = () => {
            form.reset();
            document.getElementById('user-doc-id').value = '';
            document.getElementById('user-modal-title').textContent = '新規ユーザーを追加';
            document.getElementById('password-reset-section').style.display = 'none';
            modal.style.display = 'flex';
        };
        btnClose.onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }

    if(form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btnSubmit = form.querySelector('button[type="submit"]');
            const originalHtml = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            btnSubmit.disabled = true;

            const docId = document.getElementById('user-doc-id').value;
            const email = document.getElementById('user-email').value;
            const storeSelect = document.getElementById('user-store-select');
            const selectedOpt = storeSelect.options[storeSelect.selectedIndex];
            
            const newUser = {
                'EmployeeCode': document.getElementById('user-code').value,
                'Name': document.getElementById('user-name').value,
                'ClockInPassword': document.getElementById('user-password').value,
                'LoginPassword': document.getElementById('user-login-password').value,
                'Email': email,
                'Role': document.getElementById('user-role').value,
                'Store': selectedOpt ? selectedOpt.text : '', // 表示名称
                'StoreID': storeSelect.value, // 所属店舗ID
                'UpdatedAt': new Date().toISOString()
            };

            try {
                if (docId) { 
                    await updateDoc(doc(db, "m_users", docId), newUser); 
                    alert('保存しました。');
                } else { 
                    await addDoc(collection(db, "m_users"), newUser);
                    alert('登録しました。');
                }
                modal.style.display = 'none';
                await fetchAndRenderUsers(); 
            } catch (err) { alert('保存に失敗しました。'); }
            finally {
                btnSubmit.innerHTML = originalHtml;
                btnSubmit.disabled = false;
            }
        };

        document.getElementById('btn-send-reset-email').onclick = async () => {
            const email = document.getElementById('user-email').value;
            const name = document.getElementById('user-name').value;
            const loginPw = document.getElementById('user-login-password').value;
            if (!email) return alert('メールアドレスが設定されていません。');
            if (!loginPw) return alert('ログインパスワードが設定されていません。');
            const siteUrl = location.origin;
            const text =
`【かね将ポータル ログイン情報のご案内】
${name} 様

ポータルへのログイン情報をお知らせします。

ログインURL: ${siteUrl}
メールアドレス（ID）: ${email}
ログインパスワード: ${loginPw}

上記の情報でログインしてください。`;
            try {
                await navigator.clipboard.writeText(text);
                alert('ログイン情報をクリップボードにコピーしました。\nLINEやメールに貼り付けて送付してください。');
            } catch(e) {
                // フォールバック：テキストエリアを使ってコピー
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                alert('ログイン情報をクリップボードにコピーしました。\nLINEやメールに貼り付けて送付してください。');
            }
        };

        document.getElementById('btn-show-clock-in-pw').onclick = () => {
            const pw = document.getElementById('user-password').value;
            const name = document.getElementById('user-name').value;
            if(!pw) return alert("打刻パスワードが設定されていません。");
            
            const msg = `【打刻パスワードの案内】\n${name} 様\n\nあなたの打刻パスワードは「 ${pw} 」です。\n店舗のタブレット端末で打刻する際にご使用ください。`;
            alert(msg);
            // クリップボードにコピー
            navigator.clipboard.writeText(msg).then(() => {
                console.log("Copied to clipboard");
            });
        };
    }

    document.getElementById('user-search')?.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#users-table-body tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(val) ? '' : 'none';
        });
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
            opt.value = data.store_id; // ID を value に
            opt.textContent = data.store_name; // 名称を表示に
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
        let dataList = [];
        querySnapshot.forEach((doc) => {
            dataList.push({ id: doc.id, ...doc.data() });
        });

        countLabel.textContent = `全 ${dataList.length} 件`;

        tbody.innerHTML = '';
        dataList.forEach(item => {
            const code = item['EmployeeCode'] || '-';
            const name = item['Name'] || '-';
            const pw = item['ClockInPassword'] || '-';
            const loginPw = item['LoginPassword'] ? '********' : '-';
            const email = item['Email'] || '-';
            const role = item['Role'] || 'Staff';
            const store = item['Store'] || '-';

            const roleNameMap = {
                'Admin': '管理者',
                'Manager': '店長',
                'Staff': '一般社員',
                'PartTimer': 'アルバイト',
                'Tablet': '店舗タブレット'
            };

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding: 1rem; font-family: monospace;">${code}</td>
                <td style="padding: 1rem; font-weight: 600;">${name}</td>
                <td style="padding: 1rem; font-family: monospace; color: var(--text-secondary);">${pw}</td>
                <td style="padding: 1rem; font-family: monospace; color: var(--text-secondary);">${loginPw}</td>
                <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.85rem;">${email}</td>
                <td style="padding: 1rem;"><span class="badge ${role.toLowerCase()}">${roleNameMap[role] || role}</span></td>
                <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.9rem;">${store}</td>
                <td style="padding: 1rem; text-align: right;">
                    <button class="btn btn-edit-user" title="編集"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete-user" style="color:var(--danger);" title="削除"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;

            tr.querySelector('.btn-edit-user').onclick = () => {
                document.getElementById('user-doc-id').value = item.id;
                document.getElementById('user-code').value = code !== '-' ? code : '';
                document.getElementById('user-password').value = pw !== '-' ? pw : '';
                document.getElementById('user-login-password').value = item['LoginPassword'] || '';
                document.getElementById('user-name').value = name !== '-' ? name : '';
                document.getElementById('user-email').value = email !== '-' ? email : '';
                document.getElementById('user-role').value = role;
                // StoreIDがあればそれを優先使用（名称不一致を避けるため）
                const storeVal = item['StoreID'] || store;
                document.getElementById('user-store-select').value = storeVal !== '-' ? storeVal : '';
                document.getElementById('user-modal-title').textContent = 'ユーザーの編集';
                document.getElementById('password-reset-section').style.display = email !== '-' ? 'block' : 'none';
                document.getElementById('user-modal').style.display = 'flex';
            };

            tr.querySelector('.btn-delete-user').onclick = async () => {
                if(confirm(`削除しますか？`)) {
                    await deleteDoc(doc(db, "m_users", item.id));
                    fetchAndRenderUsers();
                }
            };
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7">読み込みエラー</td></tr>';
    }
}
