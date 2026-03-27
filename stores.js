let currentView = 'list'; // 'list' or 'form'
let editingStoreData = null;

export const storesPageHtml = `
    <div id="stores-page-container" class="animate-fade-in">
        <!-- Content swapped here -->
    </div>
`;

function renderView() {
    const container = document.getElementById('stores-page-container');
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
                    <i class="fas fa-store" style="color: var(--primary);"></i>
                    店舗マスタ管理
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem;">全店舗の基本情報と営業設定を管理します</p>
            </div>
            <button class="btn btn-primary" id="btn-add-store" style="padding: 0.8rem 1.5rem; font-weight: 700;">
                <i class="fas fa-plus"></i> 新規店舗追加
            </button>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">
                        <th style="padding: 1.2rem; font-weight: 600;">ID</th>
                        <th style="padding: 1.2rem; font-weight: 600;">店舗名</th>
                        <th style="padding: 1.2rem; font-weight: 600;">タイプ</th>
                        <th style="padding: 1.2rem; font-weight: 600;">グループ</th>
                        <th style="padding: 1.2rem; font-weight: 600;">席数</th>
                        <th style="padding: 1.2rem; font-weight: 600;">リセット</th>
                        <th style="padding: 1.2rem; text-align: right; font-weight: 600;">操作</th>
                    </tr>
                </thead>
                <tbody id="store-table-body">
                    <tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-secondary);">読込中...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    const btnAdd = document.getElementById('btn-add-store');
    if (btnAdd) {
        btnAdd.onclick = () => {
            editingStoreData = null;
            currentView = 'form';
            renderView();
        };
    }

    fetchStores();
}

function renderFormView(container) {
    const isEdit = !!editingStoreData;
    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="max-width: 600px; margin: 0 auto; padding: 0; overflow: hidden;">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas ${isEdit ? 'fa-edit' : 'fa-plus-circle'}" style="color: var(--primary);"></i>
                    ${isEdit ? '店舗情報の編集' : '新規店舗の登録'}
                </h3>
                <button id="btn-form-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary);">
                    <i class="fas fa-times"></i> キャンセル
                </button>
            </div>
            
            <div style="padding: 2.5rem;">
                <form id="store-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.9rem; color: #475569;">店舗ID (英数字)</label>
                        <input type="text" id="m-store-id" required ${isEdit ? 'disabled' : ''} placeholder="例: honten" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-family: monospace; font-size: 1.1rem;">
                        ${isEdit ? '<p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.3rem;">※IDは変更できません</p>' : ''}
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.9rem; color: #475569;">店舗名称</label>
                        <input type="text" id="m-store-name" required placeholder="例: かね将 本店" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1.1rem;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.9rem; color: #475569;">店舗タイプ</label>
                            <select id="m-store-type" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; background: white; font-weight: 600;">
                                <option value="Store">通常店舗</option>
                                <option value="CK">CK (セントラルキッチン)</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.9rem; color: #475569;">グループ名</label>
                            <input type="text" id="m-group-name" placeholder="例: 直営" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.9rem; color: #475569;">席数</label>
                            <input type="number" id="m-seat-count" placeholder="0" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.9rem; color: #475569;">リセット時間</label>
                            <input type="time" id="m-reset-time" value="05:00" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
                        <button type="button" id="btn-form-cancel" class="btn" style="flex: 1; background: #f1f5f9; color: var(--text-secondary); font-weight: 700;">キャンセル</button>
                        <button type="submit" class="btn btn-primary" style="flex: 2; padding: 1rem; font-weight: 800; font-size: 1.1rem;">
                            <i class="fas fa-save" style="margin-right: 0.5rem;"></i>
                            店舗情報を保存
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

    if (isEdit) {
        document.getElementById('m-store-id').value = editingStoreData.store_id;
        document.getElementById('m-store-name').value = editingStoreData.store_name || '';
        document.getElementById('m-store-type').value = editingStoreData.store_type || 'Store';
        document.getElementById('m-group-name').value = editingStoreData.group_name || '';
        document.getElementById('m-seat-count').value = editingStoreData.seat_count || '';
        document.getElementById('m-reset-time').value = editingStoreData.reset_time || '05:00';
    }

    setupFormLogic();
}

export async function initStoresPage() {
    renderView();
}

function setupFormLogic() {
    const form = document.getElementById('store-form');
    if (!form) return;
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
            const oldDoc = await getDoc(doc(db, "m_stores", sid));
            const oldName = oldDoc.exists() ? oldDoc.data().store_name : null;

            await setDoc(doc(db, "m_stores", sid), data);

            if (oldName && oldName !== newName) {
                // Cascading updates
                let uSnap = await getDocs(query(collection(db, "m_users"), where("StoreID", "==", sid)));
                if (uSnap.empty) uSnap = await getDocs(query(collection(db, "m_users"), where("Store", "==", oldName)));
                for (const d of uSnap.docs) await updateDoc(doc(db, "m_users", d.id), { "Store": newName, "StoreID": sid });

                const pSnap = await getDocs(query(collection(db, "t_performance"), where("store_id", "==", sid)));
                for (const d of pSnap.docs) await updateDoc(doc(db, "t_performance", d.id), { "store_name": newName });

                const wSnap = await getDocs(query(collection(db, "t_attendance"), where("store_id", "==", sid)));
                for (const d of wSnap.docs) await updateDoc(doc(db, "t_attendance", d.id), { "store_name": newName });
            }

            currentView = 'list';
            renderView();
            showAlert("成功", "店舗情報を更新しました。");
        } catch (err) { showAlert("エラー", err.message); }
    };
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
                <td style="padding: 1.2rem; font-weight: 600; font-family: monospace;">${s.store_id}</td>
                <td style="padding: 1.2rem; font-weight: 700;">${s.store_name}</td>
                <td style="padding: 1.2rem;"><span class="badge" style="background: ${s.store_type==='CK'?'#8B5CF6':'var(--primary-light)'}; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${s.store_type==='CK'?'CK':'店舗'}</span></td>
                <td style="padding: 1.2rem; color: var(--text-secondary);">${s.group_name || '-'}</td>
                <td style="padding: 1.2rem;">${s.seat_count || '-'}</td>
                <td style="padding: 1.2rem; font-family: monospace; color: var(--text-secondary);">${s.reset_time || '05:00'}</td>
                <td style="padding: 1.2rem; text-align: right;">
                    <button class="btn btn-edit-store" style="padding: 0.5rem; background: transparent; color: var(--text-secondary);"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete-store" style="padding: 0.5rem; background: transparent; color: var(--danger);"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            const editBtn = tr.querySelector('.btn-edit-store');
            if (editBtn) editBtn.onclick = (e) => { 
                e.stopPropagation(); 
                editingStoreData = s;
                currentView = 'form';
                renderView();
            };
            
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

// openStoreModal is replaced by renderView('form')

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
