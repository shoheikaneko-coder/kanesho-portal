import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let currentTab = 'loans'; // 'loans' or 'master'
let cachedMasterItems = [];
let cachedStaffLoans = [];
let cachedUsers = [];

export const loansPageHtml = `
    <div id="loans-page-container" class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-key" style="color: var(--primary);"></i>
                    貸与物管理 (アセット)
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem;">備品・鍵・ユニフォーム等の貸与状況とマスタを管理します</p>
            </div>
            <div style="display: flex; gap: 0.5rem;" id="loans-action-buttons">
                <!-- Dynamic buttons based on tab -->
            </div>
        </div>

        <!-- タブ切替 -->
        <div style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
            <button class="tab-btn active" id="tab-loans-list">貸与状況一覧</button>
            <button class="tab-btn" id="tab-master-list">貸与物マスタ設定</button>
        </div>

        <div id="loans-content-area">
            <!-- Table or Form injected here -->
        </div>

        <style>
            .tab-btn {
                background: none; border: none; padding: 0.6rem 1.2rem; font-weight: 700; color: var(--text-secondary); cursor: pointer; border-radius: 8px; transition: 0.3s;
            }
            .tab-btn.active { background: rgba(230, 57, 70, 0.05); color: var(--primary); }
            .rank-badge { padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; }
            .rank-a { background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; }
            .rank-b { background: #e0f2fe; color: #0ea5e9; border: 1px solid #bae6fd; }
            .rank-c { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
            
            .loan-status-badge { padding: 0.3rem 0.7rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
            .status-loaned { background: #dcfce7; color: #15803d; }
            .status-returned { background: #f1f5f9; color: #64748b; }
            .status-lost { background: #fee2e2; color: #dc2626; box-shadow: 0 0 10px rgba(239, 68, 68, 0.2); }
            
            .loan-modal {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000;
                display: none; align-items: center; justify-content: center; backdrop-filter: blur(4px);
            }
            .loan-modal-content {
                background: white; width: 90%; max-width: 500px; border-radius: 24px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            }
        </style>
    </div>

    <!-- Issue Loan Modal -->
    <div id="issue-loan-modal" class="loan-modal">
        <div class="loan-modal-content">
            <h3 style="margin-top:0;"><i class="fas fa-plus-circle"></i> 貸与物の発行</h3>
            <form id="issue-loan-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                <div class="input-group">
                    <label>対象スタッフ</label>
                    <select id="loan-user-select" required style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                        <option value="">スタッフを選択...</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>アイテム</label>
                    <select id="loan-item-select" required style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                        <option value="">アイテムを選択...</option>
                    </select>
                </div>
                <div id="serial-group" class="input-group" style="display:none;">
                    <label>シリアル番号 / 鍵番号</label>
                    <input type="text" id="loan-serial" placeholder="シリアルNo等を入力" style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="input-group">
                        <label>数量</label>
                        <input type="number" id="loan-qty" value="1" min="1" style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                    </div>
                    <div class="input-group">
                        <label>サイズ (任意)</label>
                        <input type="text" id="loan-size" placeholder="L, M等" style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                    </div>
                </div>
                <div class="input-group">
                    <label>メモ</label>
                    <input type="text" id="loan-notes" placeholder="特記事項" style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button type="button" class="btn" id="btn-cancel-issue" style="flex: 1; background: #f1f5f9;">キャンセル</button>
                    <button type="submit" class="btn btn-primary" style="flex: 2;">発行する</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Master Edit Modal -->
    <div id="master-item-modal" class="loan-modal">
        <div class="loan-modal-content">
            <h3 id="master-modal-title" style="margin-top:0;">貸与物マスタ登録</h3>
            <form id="master-item-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                <div class="input-group">
                    <label>アイテム名</label>
                    <input type="text" id="master-name" required placeholder="例: 店舗鍵, エプロン" style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                </div>
                <div class="input-group">
                    <label>重要度ランク</label>
                    <select id="master-rank" required style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                        <option value="rank_a">ランクA (要シリアル/厳格管理)</option>
                        <option value="rank_b">ランクB (標準管理/ユニフォーム等)</option>
                        <option value="rank_c">ランクC (簡易管理/消耗品等)</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="input-group">
                        <label>参考価格 (税抜)</label>
                        <input type="number" id="master-price" placeholder="0" style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                    </div>
                    <div class="input-group">
                        <label>耐用年数 (目安)</label>
                        <input type="number" id="master-years" placeholder="0" style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border);">
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button type="button" class="btn" id="btn-cancel-master" style="flex: 1; background: #f1f5f9;">キャンセル</button>
                    <button type="submit" class="btn btn-primary" style="flex: 2;">保存する</button>
                </div>
            </form>
        </div>
    </div>
`;

export async function initLoansPage() {
    const tabLoans = document.getElementById('tab-loans-list');
    const tabMaster = document.getElementById('tab-master-list');

    if (tabLoans) {
        tabLoans.onclick = () => {
            currentTab = 'loans';
            tabLoans.classList.add('active');
            tabMaster.classList.remove('active');
            renderContent();
        };
    }

    if (tabMaster) {
        tabMaster.onclick = () => {
            currentTab = 'master';
            tabMaster.classList.add('active');
            tabLoans.classList.remove('active');
            renderContent();
        };
    }

    // モダルイベント
    const btnCancelIssue = document.getElementById('btn-cancel-issue');
    if (btnCancelIssue) btnCancelIssue.onclick = () => document.getElementById('issue-loan-modal').style.display = 'none';
    
    const btnCancelMaster = document.getElementById('btn-cancel-master');
    if (btnCancelMaster) btnCancelMaster.onclick = () => document.getElementById('master-item-modal').style.display = 'none';

    const loanItemSelect = document.getElementById('loan-item-select');
    if (loanItemSelect) {
        loanItemSelect.onchange = (e) => {
            const item = cachedMasterItems.find(i => i.id === e.target.value);
            document.getElementById('serial-group').style.display = (item && item.category === 'rank_a') ? 'block' : 'none';
        };
    }

    const issueForm = document.getElementById('issue-loan-form');
    if (issueForm) issueForm.onsubmit = handleIssueSubmit;
    
    const masterForm = document.getElementById('master-item-form');
    if (masterForm) masterForm.onsubmit = handleMasterSubmit;

    await fetchData();
    renderContent();
}

async function fetchData() {
    // ユーザー
    const userSnap = await getDocs(query(collection(db, "m_users"), orderBy("Name")));
    cachedUsers = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // マスタ
    const masterSnap = await getDocs(query(collection(db, "m_loan_items"), orderBy("name")));
    cachedMasterItems = masterSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 貸与状況
    const loanSnap = await getDocs(query(collection(db, "t_staff_loans"), where("status", "==", "loaned")));
    cachedStaffLoans = loanSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderContent() {
    const container = document.getElementById('loans-content-area');
    const actionArea = document.getElementById('loans-action-buttons');
    if (!container) return;

    if (currentTab === 'loans') {
        actionArea.innerHTML = `
            <button class="btn btn-primary" onclick="window.showIssueModal()">
                <i class="fas fa-plus"></i> 新たに貸与する
            </button>
        `;
        renderLoansList(container);
    } else {
        actionArea.innerHTML = `
            <button class="btn btn-primary" onclick="window.showMasterModal()">
                <i class="fas fa-plus"></i> マスタ新規追加
            </button>
        `;
        renderMasterList(container);
    }
}

function renderLoansList(container) {
    const summary = {
        total: cachedStaffLoans.length,
        rank_a: cachedStaffLoans.filter(l => {
            const item = cachedMasterItems.find(i => i.id === l.itemId);
            return item && item.category === 'rank_a';
        }).length
    };

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div class="glass-panel" style="padding: 1.2rem; display: flex; align-items: center; gap: 1.2rem;">
                <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(37, 99, 235, 0.1); color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                    <i class="fas fa-hand-holding"></i>
                </div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">貸与中アイテム</div>
                    <div style="font-size: 1.6rem; font-weight: 900;">${summary.total}<span style="font-size: 0.9rem; font-weight: 600; margin-left: 0.2rem;">件</span></div>
                </div>
            </div>
            <div class="glass-panel" style="padding: 1.2rem; display: flex; align-items: center; gap: 1.2rem;">
                <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(239, 68, 68, 0.1); color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">最重要(ランクA)</div>
                    <div style="font-size: 1.6rem; font-weight: 900; color: #ef4444;">${summary.rank_a}<span style="font-size: 0.9rem; font-weight: 600; margin-left: 0.2rem; color: var(--text-secondary);">件</span></div>
                </div>
            </div>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid var(--border); color: #64748b; font-size: 0.75rem; text-transform: uppercase;">
                        <th style="padding: 1rem;">スタッフ</th>
                        <th style="padding: 1rem;">貸与物</th>
                        <th style="padding: 1rem;">ランク</th>
                        <th style="padding: 1rem;">詳細 / シリアル</th>
                        <th style="padding: 1rem;">貸与日</th>
                        <th style="padding: 1rem;">最終本人確認</th>
                        <th style="padding: 1rem; text-align: right;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${cachedStaffLoans.length === 0 ? '<tr><td colspan="7" style="padding: 3rem; text-align: center; color: var(--text-secondary);">現在、貸与中のデータはありません。</td></tr>' : ''}
                    ${cachedStaffLoans.map(loan => {
                        const user = cachedUsers.find(u => u.id === loan.userId);
                        const itemMaster = cachedMasterItems.find(i => i.id === loan.itemId);
                        const lastCheck = loan.lastVerifiedAt ? new Date(loan.lastVerifiedAt.seconds * 1000).toLocaleDateString() : '未実施';
                        const loanDate = (loan.loanedAt && loan.loanedAt.seconds) ? new Date(loan.loanedAt.seconds * 1000).toLocaleDateString() : '-';
                        
                        return `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 1rem;">
                                    <div style="font-weight: 700;">${user ? user.Name : '不明'}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-secondary);">${user ? (user.Store || '-') : ''}</div>
                                </td>
                                <td style="padding: 1rem;">
                                    <div style="font-weight: 700;">${itemMaster ? itemMaster.name : '不明'}</div>
                                    <div style="font-size: 0.75rem; color: #64748b;">${loan.quantity || 1} 個 / ${loan.size || '-'}</div>
                                </td>
                                <td style="padding: 1rem;">
                                    <span class="rank-badge ${itemMaster ? itemMaster.category.replace('_','-') : ''}">${itemMaster ? itemMaster.category.split('_')[1].toUpperCase() : '-'}</span>
                                </td>
                                <td style="padding: 1rem; font-family: monospace; font-size: 0.85rem;">${loan.serialNo || '-'}</td>
                                <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.85rem;">${loanDate}</td>
                                <td style="padding: 1rem;">
                                    <div style="font-size: 0.85rem;">${lastCheck}</div>
                                </td>
                                <td style="padding: 1rem; text-align: right;">
                                    <button class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; background: #f1f5f9;" onclick="window.handleReturn('${loan.id}')">返却</button>
                                    <button class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; background: #fee2e2; color: #ef4444;" onclick="window.handleLoss('${loan.id}')">紛失</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderMasterList(container) {
    container.innerHTML = `
        <div class="glass-panel" style="padding: 0; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid var(--border); color: #64748b; font-size: 0.75rem; text-transform: uppercase;">
                        <th style="padding: 1rem;">アイテム名</th>
                        <th style="padding: 1rem;">管理ランク</th>
                        <th style="padding: 1rem;">参考価格</th>
                        <th style="padding: 1rem;">耐用年数</th>
                        <th style="padding: 1rem; text-align: right;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${cachedMasterItems.length === 0 ? '<tr><td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-secondary);">マスタが登録されていません。</td></tr>' : ''}
                    ${cachedMasterItems.map(item => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 1rem; font-weight: 700;">${item.name}</td>
                            <td style="padding: 1rem;"><span class="rank-badge ${item.category.replace('_','-')}">${item.category.split('_')[1].toUpperCase()}</span></td>
                            <td style="padding: 1rem;">¥${(item.unit_price || 0).toLocaleString()}</td>
                            <td style="padding: 1rem;">${item.durable_years || '-'} 年</td>
                            <td style="padding: 1rem; text-align: right;">
                                <button class="btn" onclick="window.showMasterModal('${item.id}')" style="padding:0.4rem; color:var(--text-secondary);"><i class="fas fa-edit"></i></button>
                                <button class="btn" onclick="window.deleteMasterItem('${item.id}')" style="padding:0.4rem; color:var(--danger);"><i class="fas fa-trash-alt"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// グローバル関数（インラインonclick用）
window.showIssueModal = () => {
    const modal = document.getElementById('issue-loan-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const userSelect = document.getElementById('loan-user-select');
    const itemSelect = document.getElementById('loan-item-select');
    userSelect.innerHTML = '<option value="">スタッフを選択...</option>' + cachedUsers.map(u => `<option value="${u.id}">${u.Name} (${u.Store || '-'})</option>`).join('');
    itemSelect.innerHTML = '<option value="">アイテムを選択...</option>' + cachedMasterItems.map(i => `<option value="${i.id}">${i.name} [Rank ${i.category.split('_')[1].toUpperCase()}]</option>`).join('');
    const form = document.getElementById('issue-loan-form');
    if (form) form.reset();
    document.getElementById('serial-group').style.display = 'none';
};

let editingMasterId = null;
window.showMasterModal = (id = null) => {
    editingMasterId = id;
    const modal = document.getElementById('master-item-modal');
    if (!modal) return;
    const title = document.getElementById('master-modal-title');
    const form = document.getElementById('master-item-form');
    modal.style.display = 'flex';
    if (form) form.reset();
    
    if (id) {
        if (title) title.innerHTML = '<i class="fas fa-edit"></i> マスタの編集';
        const item = cachedMasterItems.find(i => i.id === id);
        if (item) {
            document.getElementById('master-name').value = item.name;
            document.getElementById('master-rank').value = item.category;
            document.getElementById('master-price').value = item.unit_price;
            document.getElementById('master-years').value = item.durable_years;
        }
    } else {
        if (title) title.innerHTML = '<i class="fas fa-plus-circle"></i> 貸与物マスタ登録';
    }
};

async function handleIssueSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    const data = {
        userId: document.getElementById('loan-user-select').value,
        itemId: document.getElementById('loan-item-select').value,
        serialNo: document.getElementById('loan-serial').value,
        quantity: parseInt(document.getElementById('loan-qty').value),
        size: document.getElementById('loan-size').value,
        notes: document.getElementById('loan-notes').value,
        status: 'loaned',
        loanedAt: serverTimestamp(),
        lastVerifiedAt: null
    };

    try {
        await addDoc(collection(db, "t_staff_loans"), data);
        showAlert('成功', '貸与登録を完了しました。');
        document.getElementById('issue-loan-modal').style.display = 'none';
        await fetchData();
        renderContent();
    } catch (err) {
        console.error(err);
        showAlert('エラー', '登録に失敗しました。');
    } finally {
        btn.disabled = false;
    }
}

async function handleMasterSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    const data = {
        name: document.getElementById('master-name').value,
        category: document.getElementById('master-rank').value,
        unit_price: parseInt(document.getElementById('master-price').value || 0),
        durable_years: parseInt(document.getElementById('master-years').value || 0)
    };

    try {
        if (editingMasterId) {
            await updateDoc(doc(db, "m_loan_items", editingMasterId), data);
            showAlert('成功', '更新しました。');
        } else {
            await addDoc(collection(db, "m_loan_items"), data);
            showAlert('成功', '登録しました。');
        }
        document.getElementById('master-item-modal').style.display = 'none';
        await fetchData();
        renderContent();
    } catch (err) {
        console.error(err);
        showAlert('エラー', '保存に失敗しました。');
    } finally {
        btn.disabled = false;
    }
}

window.handleReturn = async (id) => {
    showConfirm('返却処理', 'このアイテムの返却を完了しますか？', async () => {
        try {
            await updateDoc(doc(db, "t_staff_loans", id), { status: 'returned', returnedAt: serverTimestamp() });
            showAlert('成功', '返却処理を完了しました。');
            await fetchData();
            renderContent();
        } catch (e) { showAlert('エラー', '処理に失敗しました。'); }
    });
};

window.handleLoss = async (id) => {
    showConfirm('紛失報告', 'このアイテムが紛失したとして記録しますか？', async () => {
        try {
            await updateDoc(doc(db, "t_staff_loans", id), { status: 'lost', lostAt: serverTimestamp() });
            showAlert('成功', '紛失記録を完了しました。');
            await fetchData();
            renderContent();
        } catch (e) { showAlert('エラー', '処理に失敗しました。'); }
    });
};

window.deleteMasterItem = async (id) => {
    showConfirm('マスタ削除', 'このマスタを削除しますか？(過去の貸与記録には影響しません)', async () => {
        try {
            await deleteDoc(doc(db, "m_loan_items", id));
            await fetchData();
            renderContent();
        } catch (e) { showAlert('エラー', '削除に失敗しました。'); }
    });
};
