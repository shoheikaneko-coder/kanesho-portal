import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

export const storesPageHtml = `
    <div class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                <i class="fas fa-store" style="color: var(--primary);"></i>
                店舗マスタ管理
            </h2>
            <button class="btn btn-primary" id="btn-add-store">
                <i class="fas fa-plus"></i> 新規店舗追加
            </button>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: var(--surface-darker); border-bottom: 2px solid var(--border); color: var(--text-secondary);">
                        <th style="padding: 1.2rem;">ID</th>
                        <th style="padding: 1.2rem;">店舗名</th>
                        <th style="padding: 1.2rem;">タイプ</th>
                        <th style="padding: 1.2rem;">グループ</th>
                        <th style="padding: 1.2rem;">席数</th>
                        <th style="padding: 1.2rem;">リセット</th>
                        <th style="padding: 1.2rem;">操作</th>
                    </tr>
                </thead>
                <tbody id="store-table-body">
                    <tr><td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-secondary);">読込中...</td></tr>
                </tbody>
            </table>
        </div>

        <!-- モーダル -->
        <div id="store-modal" class="modal-overlay" style="display: none; position: fixed !important; inset: 0 !important; background: rgba(0,0,0,0.5) !important; z-index: 10000 !important; align-items: center; justify-content: center;">
            <div class="glass-panel animate-scale-in" style="width: 100%; max-width: 500px; padding: 2rem;">
                <h3 id="modal-title" style="margin-top: 0; margin-bottom: 1.5rem;">店舗情報の追加/編集</h3>
                <form id="store-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                    <div>
                        <label style="display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.9rem;">店舗ID</label>
                        <input type="text" id="m-store-id" required style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.9rem;">店舗名称</label>
                        <input type="text" id="m-store-name" required style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.9rem;">店舗タイプ</label>
                            <select id="m-store-type" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; background: white;">
                                <option value="Store">通常店舗</option>
                                <option value="CK">CK (セントラルキッチン)</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.9rem;">グループ名</label>
                            <input type="text" id="m-group-name" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.9rem;">席数</label>
                            <input type="number" id="m-seat-count" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.9rem;">リセット時間</label>
                            <input type="time" id="m-reset-time" value="05:00" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                        <button type="button" class="btn" id="btn-close-store-modal" style="flex: 1; background: #eee;">キャンセル</button>
                        <button type="submit" class="btn btn-primary" style="flex: 2;">保存</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
`;

export async function initStoresPage() {
    await fetchStores();

    const btnAdd = document.getElementById('btn-add-store');
    if (btnAdd) btnAdd.onclick = () => openStoreModal();
    
    const btnClose = document.getElementById('btn-close-store-modal');
    if (btnClose) btnClose.onclick = () => document.getElementById('store-modal').style.display = 'none';

    const form = document.getElementById('store-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const sid = document.getElementById('m-store-id').value.trim();
            const newName = document.getElementById('m-store-name').value.trim();
            const data = {
                store_id: sid,
                store_name: newName,
                store_type: document.getElementById('m-store-type').value,
                group_name: document.getElementById('m-group-name').value.trim(),
                seat_count: Number(document.getElementById('m-seat-count').value) || 0,
                reset_time: document.getElementById('m-reset-time').value || "05:00"
            };
            try {
                // 既存データの取得
                const oldDoc = await getDoc(doc(db, "m_stores", sid));
                const oldName = oldDoc.exists() ? oldDoc.data().store_name : null;

                // 店舗マスタの更新
                await setDoc(doc(db, "m_stores", sid), data);

                // 名称が変更された場合、関連データを連動更新
                if (oldName && oldName !== newName) {
                    console.log(`店舗名変更を検知: ${oldName} -> ${newName}. 関連データを更新します...`);
                    
                    // 1. ユーザーリスト (m_users) - StoreID または 名称で検索
                    let uSnap = await getDocs(query(collection(db, "m_users"), where("StoreID", "==", sid)));
                    if (uSnap.empty) {
                        // 移行用：IDでなければ名称で再検索
                        uSnap = await getDocs(query(collection(db, "m_users"), where("Store", "==", oldName)));
                    }
                    for (const d of uSnap.docs) {
                        await updateDoc(doc(db, "m_users", d.id), { "Store": newName, "StoreID": sid });
                    }

                    // 2. 売上実績 (t_performance) - store_idで検索し名称を更新
                    const pSnap = await getDocs(query(collection(db, "t_performance"), where("store_id", "==", sid)));
                    for (const d of pSnap.docs) {
                        await updateDoc(doc(db, "t_performance", d.id), { "store_name": newName });
                    }

                    // 3. 勤怠データ (t_attendance) - store_idで検索し名称を更新
                    const wSnap = await getDocs(query(collection(db, "t_attendance"), where("store_id", "==", sid)));
                    for (const d of wSnap.docs) {
                        await updateDoc(doc(db, "t_attendance", d.id), { "store_name": newName });
                    }
                }

                document.getElementById('store-modal').style.display = 'none';
                fetchStores();
                alert("店舗情報を更新しました。名称変更に伴い関連データも更新されました。");
            } catch (err) { alert(err); }
        };
    }
}

async function fetchStores() {
    const tbody = document.getElementById('store-table-body');
    if (!tbody) return;
    try {
        const snapshot = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
        tbody.innerHTML = '';
        snapshot.forEach(d => {
            const s = d.data();
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding: 1.2rem; font-weight: 600;">${s.store_id}</td>
                <td style="padding: 1.2rem;">${s.store_name}</td>
                <td style="padding: 1.2rem;"><span class="badge" style="background: ${s.store_type==='CK'?'#8B5CF6':'var(--primary-light)'}; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${s.store_type==='CK'?'CK':'店舗'}</span></td>
                <td style="padding: 1.2rem; color: var(--text-secondary);">${s.group_name || '-'}</td>
                <td style="padding: 1.2rem;">${s.seat_count || '-'}</td>
                <td style="padding: 1.2rem; font-family: monospace;">${s.reset_time || '05:00'}</td>
                <td style="padding: 1.2rem;">
                    <button class="btn btn-edit-store" style="padding: 0.4rem; background: var(--surface-darker);"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete-store" style="padding: 0.4rem; background: #fee2e2; color: #ef4444;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            const editBtn = tr.querySelector('.btn-edit-store');
            if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); openStoreModal(s); };
            
            const delBtn = tr.querySelector('.btn-delete-store');
            if (delBtn) delBtn.onclick = (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                showConfirm('店舗の削除', `店舗ID: ${s.store_id} を完全に削除しますか？`, () => {
                    deleteStore(s.store_id);
                });
            };
            
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

function openStoreModal(data = null) {
    const modal = document.getElementById('store-modal');
    if (!modal) return;
    const sidInput = document.getElementById('m-store-id');
    const form = document.getElementById('store-form');
    if (form) form.reset();
    if (data) {
        sidInput.value = data.store_id;
        sidInput.disabled = true;
        document.getElementById('m-store-name').value = data.store_name || '';
        document.getElementById('m-store-type').value = data.store_type || 'Store';
        document.getElementById('m-group-name').value = data.group_name || '';
        document.getElementById('m-seat-count').value = data.seat_count || '';
        document.getElementById('m-reset-time').value = data.reset_time || '05:00';
    } else {
        sidInput.disabled = false;
    }
    modal.style.display = 'flex';
}

async function deleteStore(id) {
    try {
        await deleteDoc(doc(db, "m_stores", id));
        showAlert('成功', '店舗を削除しました。');
        initStoresPage();
    } catch (e) {
        console.error(e);
        showAlert('エラー', '削除に失敗しました。');
    }
}
