import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

export const suppliersPageHtml = `
    <div class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h3 style="color: var(--text-secondary);">業者マスタ管理</h3>
            <button class="btn btn-primary" id="btn-add-supplier">
                <i class="fas fa-plus"></i> 新規業者を登録
            </button>
        </div>
        
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div class="input-group" style="margin-bottom: 0; width: 300px; max-width: 100%;">
                    <i class="fas fa-search" style="top: 0.8rem;"></i>
                    <input type="text" placeholder="企業名や担当者で検索..." style="padding-top: 0.6rem; padding-bottom: 0.6rem;">
                </div>
                <div id="suppliers-count" style="color: var(--text-secondary); font-size: 0.9rem; font-weight: 500;">
                    読み込み中...
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; min-width: 800px; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-secondary); font-size: 0.9rem;">
                            <th style="padding: 1rem; font-weight: 600;">業者ID</th>
                            <th style="padding: 1rem; font-weight: 600;">企業名</th>
                            <th style="padding: 1rem; font-weight: 600;">担当店舗</th>
                            <th style="padding: 1rem; font-weight: 600;">電話・連絡先</th>
                            <th style="padding: 1rem; text-align: right; font-weight: 600;">アクション</th>
                        </tr>
                    </thead>
                    <tbody id="suppliers-table-body">
                    </tbody>
                </table>
            </div>
        </div>
        
        <div id="supplier-modal" class="modal-overlay" style="display: none; position: fixed !important; inset: 0 !important; background: rgba(0,0,0,0.5) !important; z-index: 10000 !important; align-items: center; justify-content: center;">
            <div class="glass-panel animate-scale-in" style="width: 100%; max-width: 500px; padding: 2rem;">
                <button id="close-supplier-modal" style="position: absolute; right: 1.5rem; top: 1.5rem; background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-secondary);"><i class="fas fa-times"></i></button>
                <h3 id="supplier-modal-title" style="margin-bottom: 1.5rem;">新規業者の登録</h3>
                <form id="supplier-form">
                    <input type="hidden" id="supplier-doc-id">
                    <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1rem;">
                        <div class="input-group">
                            <label>業者ID</label>
                            <input type="text" id="vendor-id" required placeholder="例: SUP-001">
                        </div>
                        <div class="input-group">
                            <label>企業名</label>
                            <input type="text" id="vendor-name" required>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>担当者名</label>
                        <input type="text" id="vendor-contact">
                    </div>
                    <div class="input-group">
                        <label>電話番号・連絡先</label>
                        <input type="text" id="vendor-phone">
                    </div>
                    <div class="input-group">
                        <label>担当店舗</label>
                        <div id="responsible-stores-container" style="display: flex; flex-wrap: wrap; gap: 0.5rem; background: rgba(0,0,0,0.02); padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border);">
                            <!-- Stores injected here -->
                        </div>
                    </div>
                    <div class="input-group">
                        <label>備考 (発注内容など)</label>
                        <textarea id="vendor-remarks" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; min-height: 80px;"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 1rem; margin-top: 1rem;"><i class="fas fa-save"></i> 保存する</button>
                </form>
            </div>
        </div>
    </div>
`;

export async function initSuppliersPage() {
    await reloadStores(); // 店舗リスト取得
    await fetchAndRenderSuppliers();
    
    const btnAdd = document.getElementById('btn-add-supplier');
    const modal = document.getElementById('supplier-modal');
    const btnClose = document.getElementById('close-supplier-modal');
    const form = document.getElementById('supplier-form');
    
    if(btnAdd && modal) {
        btnAdd.addEventListener('click', () => {
            if(form) form.reset();
            document.querySelectorAll('#responsible-stores-container input').forEach(cb => cb.checked = false);
            document.getElementById('supplier-doc-id').value = '';
            document.getElementById('supplier-modal-title').textContent = '新規業者の登録';
            modal.style.display = 'flex';
        });
        btnClose.addEventListener('click', () => modal.style.display = 'none');
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = form.querySelector('button[type="submit"]');
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            btnSubmit.disabled = true;

            const docId = document.getElementById('supplier-doc-id').value;
            const selectedStores = Array.from(document.querySelectorAll('#responsible-stores-container input:checked')).map(cb => cb.value);

            const vendorData = {
                vendor_id: document.getElementById('vendor-id').value,
                vendor_name: document.getElementById('vendor-name').value,
                contact_person: document.getElementById('vendor-contact').value,
                phone: document.getElementById('vendor-phone').value,
                responsible_stores: selectedStores,
                remarks: document.getElementById('vendor-remarks').value,
                updated_at: new Date().toISOString()
            };

            try {
                if (docId) { 
                    await updateDoc(doc(db, "m_suppliers", docId), vendorData); 
                } else { 
                    await addDoc(collection(db, "m_suppliers"), vendorData); 
                }
                modal.style.display = 'none';
                await fetchAndRenderSuppliers(); 
                showAlert('成功', '業者情報を保存しました。');
            } catch (err) {
                console.error(err);
                showAlert('エラー', '保存に失敗しました。');
            } finally {
                btnSubmit.innerHTML = '<i class="fas fa-save"></i> 保存する';
                btnSubmit.disabled = false;
            }
        });
    }
}

let cachedStores = [];
async function reloadStores() {
    const container = document.getElementById('responsible-stores-container');
    if (!container) return;
    try {
        const snap = await getDocs(collection(db, "m_stores"));
        cachedStores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        container.innerHTML = cachedStores.map(s => `
            <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; cursor: pointer; background: white; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid var(--border);">
                <input type="checkbox" value="${s.store_id || s.id}"> ${s.store_name || s.Name}
            </label>
        `).join('');
    } catch(e) { console.error(e); }
}

async function fetchAndRenderSuppliers() {
    const tbody = document.getElementById('suppliers-table-body');
    const countLabel = document.getElementById('suppliers-count');
    if (!tbody) return;

    try {
        let querySnapshot = await getDocs(collection(db, "m_suppliers"));
        let dataList = [];
        querySnapshot.forEach((doc) => {
            dataList.push({ id: doc.id, ...doc.data() });
        });

        countLabel.textContent = `全 ${dataList.length} 件`;

        if (dataList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-secondary);">データがありません</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        dataList.forEach(item => {
            const vendorId = item.vendor_id || '-';
            const vendorName = item.vendor_name || '-';
            const phone = item.phone || '-';
            const stores = (item.responsible_stores || []).map(sid => {
                const s = cachedStores.find(cs => (cs.store_id || cs.id) === sid);
                return s ? (s.store_name || s.Name) : sid;
            }).join(', ');

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding: 1rem; font-family: monospace; color: var(--text-secondary);">${vendorId}</td>
                <td style="padding: 1rem; font-weight: 600;">${vendorName}</td>
                <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.85rem;">${stores || '未設定'}</td>
                <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.9rem;">${phone}</td>
                <td style="padding: 1rem; text-align: right;">
                    <button class="btn btn-edit-supplier" style="padding: 0.4rem; background: transparent; color: var(--text-secondary);" title="編集"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete-supplier" style="padding: 0.4rem; background: transparent; color: var(--danger);" title="削除"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;

            tr.querySelector('.btn-edit-supplier').onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('supplier-doc-id').value = item.id;
                document.getElementById('vendor-id').value = item.vendor_id || '';
                document.getElementById('vendor-name').value = item.vendor_name || '';
                document.getElementById('vendor-contact').value = item.contact_person || '';
                document.getElementById('vendor-phone').value = item.phone || '';
                document.getElementById('vendor-remarks').value = item.remarks || '';
                
                // チェックボックス復元
                const selected = item.responsible_stores || [];
                document.querySelectorAll('#responsible-stores-container input').forEach(cb => {
                    cb.checked = selected.includes(cb.value);
                });

                document.getElementById('supplier-modal-title').textContent = '業者の編集';
                document.getElementById('supplier-modal').style.display = 'flex';
            };

            tr.querySelector('.btn-delete-supplier').onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const btn = e.currentTarget;
                const currentVendorName = item.vendor_name || '';
                showConfirm('業者の削除', `業者「${currentVendorName}」を削除してもよろしいですか？`, async () => {
                    try {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        await deleteDoc(doc(db, "m_suppliers", item.id));
                        await fetchAndRenderSuppliers();
                        showAlert('成功', '削除しました。');
                    } catch (error) {
                        console.error(error);
                        showAlert('エラー', '削除に失敗しました。');
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                    }
                });
            };
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> エラーが発生しました</td></tr>';
    }
}
