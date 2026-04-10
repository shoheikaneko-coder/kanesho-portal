import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm, showLoader } from './ui_utils.js';

let cachedUsers = [];
const pageSize = 50;
let currentPage = 1;

export const inviteNaviPageHtml = `
    <div id="invite-navi-container" class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-paper-plane" style="color: var(--secondary);"></i>
                    従業員への招待案内 (Email)
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem;">
                    名簿に登録された従業員へ、ポータルのログイン情報をメールで安全に送信します。
                </p>
            </div>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <!-- フィルタ・検索エリア -->
            <div style="padding: 1.2rem; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center; background: #f8fafc;">
                <div style="display: flex; gap: 1rem; align-items: center; flex: 1; min-width: 300px;">
                    <div class="input-group" style="margin-bottom: 0; flex: 1;">
                        <i class="fas fa-search" style="top: 0.8rem;"></i>
                        <input type="text" id="invite-search" placeholder="名前やコードで検索..." style="padding-top: 0.6rem; padding-bottom: 0.6rem; border-radius: 20px;">
                    </div>
                    <select id="invite-store-filter" style="padding: 0.6rem 1rem; border-radius: 20px; border: 1px solid var(--border); background: white; font-weight: 600; font-size: 0.85rem; outline: none;">
                        <option value="">全ての店舗</option>
                    </select>
                </div>
                <div id="invite-count" style="color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                    読込中...
                </div>
            </div>

            <!-- PC用テーブルエリア (1024px以上で表示) -->
            <div class="invite-desktop-view" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: white; border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.8rem;">
                            <th style="padding: 1rem; font-weight: 600;">従業員コード</th>
                            <th style="padding: 1rem; font-weight: 600;">お名前</th>
                            <th style="padding: 1rem; font-weight: 600;">所属</th>
                            <th style="padding: 1rem; font-weight: 600;">メールアドレス</th>
                            <th style="padding: 1rem; font-weight: 600; text-align: center;">招待状況</th>
                            <th style="padding: 1rem; text-align: right; font-weight: 600;">招待を送る</th>
                        </tr>
                    </thead>
                    <tbody id="invite-table-body"></tbody>
                </table>
            </div>

            <!-- スマホ用カードリストエリア (1024px未満で表示) -->
            <div id="invite-mobile-cards" class="invite-mobile-view" style="display: none; padding: 1rem; background: #f1f5f9; flex-direction: column; gap: 1rem;">
                <!-- カードがここに動的に生成されます -->
            </div>
            
            <div id="invite-pagination" style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin: 1.5rem 0;"></div>
        </div>

        <style>
            /* 【安全性最優先】招待画面が表示されている時だけ、アプリ全体の「下地」を塗り替える */
            /* 1024px以下のスマホ表示時のみ適用 */
            @media (max-width: 1024px) {
                /* この画面が開いている間、アプリ全体の地肌をグレーに「同期」させる */
                body:has(#invite-navi-container) {
                    background-color: #f1f5f9 !important;
                }
                body:has(#invite-navi-container) #page-content {
                    padding: 0 !important;
                    background-color: transparent !important;
                }

                #invite-navi-container {
                    background: transparent !important;
                    padding: 1rem 1rem 100px 1rem !important; /* バーとの干渉を防ぐ固定余白 */
                    display: flex;
                    flex-direction: column;
                }

                /* 白い「箱」を透明化し、地肌（グレー）と一体化 */
                #invite-navi-container .glass-panel {
                    background: transparent !important;
                    box-shadow: none !important;
                    border: none !important;
                    padding: 0 !important;
                }

                .invite-desktop-view { display: none !important; }
                .invite-mobile-view { 
                    display: flex !important; 
                    background: transparent !important;
                }
            }

            @media (min-width: 1025px) {
                .invite-desktop-view { display: block !important; }
                .invite-mobile-view { display: none !important; }
            }

            /* カードのデザイン */
            .invite-card {
                background: white;
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 1.25rem;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
        </style>

        <!-- セキュリティ案内 -->
        <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(14, 165, 233, 0.05); border: 1px solid rgba(14, 165, 233, 0.2); border-radius: 12px; display: flex; gap: 1rem; align-items: flex-start;">
            <i class="fas fa-shield-alt" style="color: #0ea5e9; font-size: 1.25rem; margin-top: 0.2rem;"></i>
            <div>
                <h4 style="margin: 0 0 0.4rem; color: #0369a1; font-size: 0.9rem;">安全な案内のための仕組み</h4>
                <p style="margin: 0; font-size: 0.8rem; color: #0c4a6e; line-height: 1.5;">
                    ボタンを押すと、登録済みのメールアドレスを宛先に指定した状態でメールアプリが起動します。宛先が固定されるため、LINE共有よりも誤送信のリスクが低く安全です。
                    <br>※管理者が従業員マスタで設定した「メールアドレス」と「ログインパスワード」が案内文に自動的に含まれます。
                </p>
            </div>
        </div>
    </div>
`;

export async function initInviteNaviPage() {
    const container = document.getElementById('invite-navi-container');
    if (!container) return;

    // 初期化
    currentPage = 1;
    
    // 検索・フィルタイベント
    const searchInput = document.getElementById('invite-search');
    const storeFilter = document.getElementById('invite-store-filter');

    if (searchInput) {
        searchInput.oninput = () => {
            currentPage = 1;
            renderInviteTable();
        };
    }
    if (storeFilter) {
        storeFilter.onchange = () => {
            currentPage = 1;
            renderInviteTable();
        };
    }

    try {
        await Promise.all([
            fetchUsersData(),
            fetchStoreOptions()
        ]);
        renderInviteTable();
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="padding:2rem;color:red;">データの読み込みに失敗しました</div>`;
    }
}

async function fetchUsersData() {
    const snap = await getDocs(query(collection(db, "m_users"), orderBy("EmployeeCode")));
    cachedUsers = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.Status !== 'retired') {
            cachedUsers.push({ id: d.id, ...data });
        }
    });
}

async function fetchStoreOptions() {
    const sel = document.getElementById('invite-store-filter');
    if (!sel) return;
    try {
        const snap = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
        let html = '<option value="">全ての店舗</option>';
        snap.forEach(d => {
            const data = d.data();
            html += `<option value="${data.store_id}">${data.store_name}</option>`;
        });
        sel.innerHTML = html;
    } catch (e) { console.error(e); }
}

function renderInviteTable() {
    const tbody = document.getElementById('invite-table-body');
    const mobileContainer = document.getElementById('invite-mobile-cards');
    const countLabel = document.getElementById('invite-count');
    const searchVal = document.getElementById('invite-search')?.value.toLowerCase() || "";
    const storeFilterValue = document.getElementById('invite-store-filter')?.value || "";

    if (!tbody || !mobileContainer) return;

    const filtered = cachedUsers.filter(u => {
        const matchesSearch = (u.Name || '').toLowerCase().includes(searchVal) || 
                              (u.EmployeeCode || '').toLowerCase().includes(searchVal);
        const matchesStore = !storeFilterValue || u.StoreID === storeFilterValue;
        return matchesSearch && matchesStore;
    });

    const totalItems = filtered.length;
    let totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages === 0) totalPages = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const itemsToShow = filtered.slice(startIndex, startIndex + pageSize);

    if (countLabel) {
        countLabel.textContent = totalItems === 0 ? '表示中: 0 件' : `表示中: ${totalItems} 件`;
    }

    tbody.innerHTML = '';
    mobileContainer.innerHTML = '';

    if (itemsToShow.length === 0) {
        const emptyMsg = '該当する従業員が見つかりません';
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 4rem; color: var(--text-secondary);">${emptyMsg}</td></tr>`;
        mobileContainer.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-secondary);">${emptyMsg}</div>`;
        return;
    }

    itemsToShow.forEach(user => {
        const hasEmail = !!user.Email;
        const hasPw = !!user.LoginPassword;

        // --- PC用テーブル行 ---
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.style.transition = 'background 0.2s';
        
        tr.innerHTML = `
            <td style="padding: 1rem; font-family: monospace;">${user.EmployeeCode || '-'}</td>
            <td style="padding: 1rem; font-weight: 600;">${user.Name || '-'}</td>
            <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.85rem;">${user.Store || '-'}</td>
            <td style="padding: 1rem; font-size: 0.85rem;">
                ${hasEmail ? 
                    user.Email : 
                    `<button class="btn-register-email" style="background:rgba(14, 165, 233, 0.1); color:#0ea5e9; border:none; padding:4px 10px; border-radius:12px; font-size:0.75rem; cursor:pointer; display:flex; align-items:center; gap:4px;">
                        <i class="fas fa-plus"></i> 未設定
                    </button>`
                }
            </td>
            <td style="padding: 1rem; text-align: center;">
                ${(!hasEmail || !hasPw) ? 
                    '<span style="font-size: 0.75rem; color: var(--danger);"><i class="fas fa-exclamation-circle"></i> 設定不備</span>' : 
                    '<span style="font-size: 0.75rem; color: var(--text-secondary);"><i class="fas fa-check-circle"></i> 準備完了</span>'}
            </td>
            <td style="padding: 1rem; text-align: right;">
                <button class="btn btn-invite-mail" style="padding: 0.5rem 1rem; background: ${hasEmail ? 'rgba(230, 57, 70, 0.1)' : '#f1f5f9'}; color: ${hasEmail ? 'var(--primary)' : '#94a3b8'}; font-weight: 700; font-size: 0.8rem; border-radius: 20px;" ${!hasEmail ? 'disabled' : ''}>
                    <i class="fas fa-envelope"></i> メールを作成
                </button>
            </td>
        `;

        // --- スマホ用カード ---
        const card = document.createElement('div');
        card.className = 'invite-card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.1rem;">コード: ${user.EmployeeCode || '-'}</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${user.Name || '-'}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${user.Store || '-'}</div>
                </div>
                <div>
                    ${(!hasEmail || !hasPw) ? 
                        '<span style="font-size: 0.7rem; color: #ef4444; background: #fef2f2; padding: 2px 8px; border-radius: 99px; border:1px solid #fee2e2;">設定不備</span>' : 
                        '<span style="font-size: 0.7rem; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 99px; border:1px solid #d1fae5;">準備完了</span>'}
                </div>
            </div>

            <div style="background: #f8fafc; padding: 0.8rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.3rem;">メールアドレス</div>
                <div style="word-break: break-all; font-size: 0.95rem; font-weight: 500;">
                    ${hasEmail ? 
                        user.Email : 
                        `<button class="btn-register-email" style="background:white; border:1px solid #0ea5e9; color:#0ea5e9; padding:0.5rem 1rem; border-radius:8px; width:100%; margin-top:0.4rem; font-weight:700;">
                            <i class="fas fa-plus"></i> メールアドレスを登録
                        </button>`
                    }
                </div>
            </div>

            <button class="btn btn-invite-mail" style="width: 100%; padding: 0.9rem; background: ${hasEmail ? 'var(--primary)' : '#e2e8f0'}; color: ${hasEmail ? 'white' : '#94a3b8'}; border-radius: 12px; font-weight: 700; font-size: 1rem;" ${!hasEmail ? 'disabled' : ''}>
                <i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> メールで招待を送る
            </button>
        `;

        // イベント紐付け
        const pcInviteBtn = tr.querySelector('.btn-invite-mail');
        if (pcInviteBtn && hasEmail) pcInviteBtn.onclick = () => sendEmailInvite(user);
        
        const pcRegBtn = tr.querySelector('.btn-register-email');
        if (pcRegBtn) pcRegBtn.onclick = () => showEmailPrompt(user);

        const mobileInviteBtn = card.querySelector('.btn-invite-mail');
        if (mobileInviteBtn && hasEmail) mobileInviteBtn.onclick = () => sendEmailInvite(user);
        
        const mobileRegBtn = card.querySelector('.btn-register-email');
        if (mobileRegBtn) mobileRegBtn.onclick = () => showEmailPrompt(user);

        tbody.appendChild(tr);
        mobileContainer.appendChild(card);
    });

    renderPagination(totalPages);
}

function sendEmailInvite(user) {
    if (!user.Email) return showAlert('エラー', 'メールアドレスが設定されていません。');
    if (!user.LoginPassword) return showAlert('エラー', 'ログインパスワードが設定されていません。');

    const portalUrl = window.location.origin;
    const subject = `【かね将ポータル】ログイン情報のご案内（${user.Name} 様）`;
    
    const body = `【かね将ポータル 招待状】
${user.Name} 様

お疲れ様です。
かね将ポータルのアカウント登録が完了しました。
以下の情報でログインしてください。

■ ログインURL
${portalUrl}

■ ログインID (メールアドレス)
${user.Email}

■ 初期パスワード
${user.LoginPassword}

※ログイン後、画面上のマイページ等からパスワードの変更をお願いいたします。
--------------------------------------------------
かね将ポータル 業務管理システム`;

    const mailtoUrl = `mailto:${user.Email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
}

function showEmailPrompt(user) {
    const modalId = 'email-register-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed !important; inset:0 !important; background:rgba(0,0,0,0.6) !important; z-index:10000 !important; display:none; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(4px);';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="glass-panel animate-zoom-fade" style="width:100%; max-width:450px; padding:2.5rem; margin: auto; border: 1px solid var(--border);">
            <div style="text-align: center; margin-bottom: 2rem;">
                <div style="width:60px; height:60px; background:rgba(14, 165, 233, 0.1); color:#0ea5e9; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; font-size:1.5rem;">
                    <i class="fas fa-envelope"></i>
                </div>
                <h3 style="margin:0; font-size:1.25rem; color:var(--text-primary);">メールアドレスの登録</h3>
                <p style="margin:0.5rem 0 0; font-size:0.9rem; color:var(--text-secondary);">${user.Name} さんのアドレスを登録します</p>
            </div>

            <div class="input-group" style="margin-bottom: 2rem;">
                <label style="font-weight:700; color:var(--text-primary); margin-bottom:0.5rem; display:block;">メールアドレス</label>
                <input type="email" id="new-user-email" placeholder="example@kaneshow.jp" style="width:100%; padding:1rem; border-radius:12px; border:2px solid var(--border); font-size:1rem; outline:none; transition:border-color 0.2s;">
            </div>

            <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 1rem; border-radius: 12px; margin-bottom: 2rem; display: flex; gap: 0.8rem;">
                <i class="fas fa-exclamation-triangle" style="color:#ef4444; margin-top:0.2rem;"></i>
                <p style="margin:0; font-size:0.75rem; color:#b91c1c; line-height:1.4;">
                    一度登録すると、この画面からは変更できません。入力ミスがないか十分にご確認ください。
                </p>
            </div>

            <div style="display:flex; gap:1rem;">
                <button id="email-prompt-cancel" class="btn" style="flex:1; background:#f1f5f9; color:#64748b; font-weight:700;">キャンセル</button>
                <button id="email-prompt-save" class="btn btn-primary" style="flex:2; font-weight:700;">
                    <i class="fas fa-check" style="margin-right:0.5rem;"></i> 情報を保存
                </button>
            </div>
        </div>
    `;

    modal.style.setProperty('display', 'flex', 'important');
    const input = document.getElementById('new-user-email');
    input.focus();

    document.getElementById('email-prompt-cancel').onclick = () => {
        modal.style.setProperty('display', 'none', 'important');
    };

    document.getElementById('email-prompt-save').onclick = async () => {
        const email = input.value.trim();
        if (!email || !email.includes('@')) {
            return showAlert('エラー', '有効なメールアドレスを入力してください。');
        }
        modal.style.setProperty('display', 'none', 'important');
        await updateEmployeeEmail(user, email);
    };
}

async function updateEmployeeEmail(user, email) {
    const loader = showLoader();
    try {
        const userRef = doc(db, "m_users", user.id);
        await updateDoc(userRef, {
            Email: email,
            LoginPassword: email,
            UpdatedAt: new Date().toISOString()
        });

        const cachedIdx = cachedUsers.findIndex(u => u.id === user.id);
        if (cachedIdx !== -1) {
            cachedUsers[cachedIdx].Email = email;
            cachedUsers[cachedIdx].LoginPassword = email;
        }

        showAlert('成功', `${user.Name} さんのメールアドレスを登録しました。`);
        renderInviteTable();
    } catch (err) {
        console.error(err);
        showAlert('エラー', '保存に失敗しました。');
    } finally {
        loader.remove();
    }
}

function renderPagination(totalPages) {
    const container = document.getElementById('invite-pagination');
    if (!container || totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }
    container.innerHTML = `<p style="font-size:0.75rem; color:var(--text-secondary);">全 ${totalPages} ページ</p>`;
}
