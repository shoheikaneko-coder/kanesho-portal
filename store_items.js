import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let selectedStoreId = null;
let currentView = 'list'; // 'list' or 'form'
let cachedItems = [];
let cachedStoreItems = [];
let cachedTimings = [];
let cachedIngredients = [];
let cachedSuppliers = [];

export const storeItemsPageHtml = `
    <div class="animate-fade-in" style="max-width: 1200px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                <i class="fas fa-warehouse" style="color: var(--primary);"></i>
                店舗別在庫設定
            </h2>
            <div style="display: flex; gap: 1rem; align-items: center;">
                <select id="si-store-select" class="glass-panel" style="padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.95rem; min-width: 200px;">
                    <option value="">店舗を選択...</option>
                </select>
                <button class="btn btn-primary" id="btn-si-add-item" disabled>
                    <i class="fas fa-plus"></i> 品目を追加
                </button>
                <button class="btn" id="btn-si-back" style="display: none; background: white; border: 1px solid var(--border);">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>
        </div>

        <div id="si-main-container" style="display: none;">
            <div class="glass-panel" style="padding: 0; overflow: hidden; margin-bottom: 2rem;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: var(--surface-darker); border-bottom: 2px solid var(--border); color: var(--text-secondary);">
                            <th style="padding: 1.2rem;">品目名</th>
                            <th style="padding: 1.2rem;">確認タイミング</th>
                            <th style="padding: 1.2rem; text-align: center;">定数 (Par Stock)</th>
                            <th style="padding: 1.2rem;">保管場所ラベル</th>
                            <th style="padding: 1.2rem; text-align: right;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="si-table-body">
                        <!-- Items will be loaded here -->
                    </tbody>
                </table>
            </div>
        </div>

        <div id="si-empty-state" style="text-align: center; padding: 5rem; color: var(--text-secondary);">
            <i class="fas fa-store-slash" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
            <p>店舗を選択して設定を開始してください</p>
        </div>

    </div>
`;

export async function initStoreItemsPage() {
    await loadInitialData();
    renderView();

    const storeSelect = document.getElementById('si-store-select');
    if (storeSelect) {
        storeSelect.onchange = async (e) => {
            selectedStoreId = e.target.value;
            currentView = 'list';
            if (selectedStoreId) {
                await loadStoreItems();
            }
            renderView();
        };
    }
}

function renderView() {
    const container = document.getElementById('si-main-container');
    const emptyState = document.getElementById('si-empty-state');
    const btnAdd = document.getElementById('btn-si-add-item');
    const btnBack = document.getElementById('btn-si-back');
    const storeSelect = document.getElementById('si-store-select');

    if (!selectedStoreId) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        if (btnAdd) btnAdd.style.display = 'flex';
        if (btnAdd) btnAdd.disabled = true;
        if (btnBack) btnBack.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    container.style.display = 'block';

    if (currentView === 'form') {
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnBack) {
            btnBack.style.display = 'flex';
            btnBack.onclick = () => {
                currentView = 'list';
                renderView();
            };
        }
        if (storeSelect) storeSelect.style.display = 'none';
        renderFormView(container);
    } else {
        if (btnAdd) {
            btnAdd.style.display = 'flex';
            btnAdd.disabled = false;
            btnAdd.onclick = () => {
                currentView = 'form';
                renderView();
            };
        }
        if (btnBack) btnBack.style.display = 'none';
        if (storeSelect) storeSelect.style.display = 'block';
        renderTableView(container);
    }
}

function renderTableView(container) {
    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="padding: 0; overflow: hidden; margin-bottom: 2rem;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: var(--surface-darker); border-bottom: 2px solid var(--border); color: var(--text-secondary);">
                        <th style="padding: 1.2rem;">品目名</th>
                        <th style="padding: 1.2rem;">確認タイミング</th>
                        <th style="padding: 1.2rem; text-align: center;">定数 (Par Stock)</th>
                        <th style="padding: 1.2rem;">保管場所ラベル</th>
                        <th style="padding: 1.2rem; text-align: right;">操作</th>
                    </tr>
                </thead>
                <tbody id="si-table-body"></tbody>
            </table>
        </div>
    `;
    renderTableRows();
}

function renderFormView(container) {
    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="max-width: 600px; margin: 0 auto; padding: 2.5rem;">
            <h3 style="margin-top: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-plus-circle" style="color: var(--primary);"></i>
                在庫品目の追加
            </h3>
            <form id="si-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div>
                    <label style="display: block; margin-bottom: 0.6rem; font-weight: 700; font-size: 0.9rem; color: var(--text-secondary);">品目を選択 (複数選択可)</label>
                    <div id="si-item-list-container" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border); border-radius: 12px; padding: 1rem; background: #fff; display: flex; flex-direction: column; gap: 0.5rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                        <!-- Items injected here -->
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 0.6rem; font-weight: 700; font-size: 0.9rem; color: var(--text-secondary);">確認タイミング</label>
                    <select id="si-timing-select" required style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem;">
                        <option value="">タイミングを選択...</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div>
                        <label style="display: block; margin-bottom: 0.6rem; font-weight: 700; font-size: 0.9rem; color: var(--text-secondary);">定数 (パーストック)</label>
                        <input type="number" id="si-par-stock" step="any" value="0" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.6rem; font-weight: 700; font-size: 0.9rem; color: var(--text-secondary);">保管場所ラベル</label>
                        <input type="text" id="si-location" placeholder="例: 冷蔵庫A..." style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem;">
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1.5rem;">
                    <button type="button" class="btn" id="btn-si-cancel" style="flex: 1; background: #f1f5f9; color: var(--text-secondary); font-weight: 600;">キャンセル</button>
                    <button type="submit" class="btn btn-primary" style="flex: 2; padding: 1rem; font-weight: 700;">
                        <i class="fas fa-save"></i> 店舗在庫として追加する
                    </button>
                </div>
            </form>
        </div>
    `;

    // Populate Timings
    const timingSelect = document.getElementById('si-timing-select');
    cachedTimings.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.ID || t.id;
        opt.textContent = t.確認タイミング || t.Name || t.id;
        timingSelect.appendChild(opt);
    });

    // Populate Items
    const itemList = document.getElementById('si-item-list-container');
    cachedItems.sort((a, b) => a.name.localeCompare(b.name)).forEach(i => {
        const ing = cachedIngredients.find(ing => ing.item_id === i.id);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        const supName = sup?.vendor_name || '不明';
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.gap = '0.8rem'; div.style.padding = '0.5rem'; div.style.borderRadius = '8px';
        div.onmouseover = () => div.style.background = '#f8fafc';
        div.onmouseout = () => div.style.background = 'transparent';
        const id = `chk-si-${i.id}`;
        div.innerHTML = `
            <input type="checkbox" id="${id}" value="${i.id}" class="si-checkbox" style="width: 20px; height: 20px; cursor: pointer;">
            <label for="${id}" style="cursor: pointer; font-size: 0.95rem; user-select: none; flex: 1;">
                <span style="font-weight: 600;">${i.name}</span>
                <span style="color: var(--text-secondary); font-size: 0.8rem; margin-left: 0.5rem;">(${supName})</span>
            </label>
        `;
        itemList.appendChild(div);
    });

    document.getElementById('btn-si-cancel').onclick = () => {
        currentView = 'list';
        renderView();
    };

    const form = document.getElementById('si-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        await saveStoreItem();
    };
}

async function loadInitialData() {
    const [itemSnap, storeSnap, timingSnap, ingSnap, supSnap] = await Promise.all([
        getDocs(collection(db, "m_items")),
        getDocs(collection(db, "m_stores")),
        getDocs(collection(db, "m_check_timings")),
        getDocs(collection(db, "m_ingredients")),
        getDocs(collection(db, "m_suppliers"))
    ]);

    cachedItems = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const stores = storeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedTimings = timingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedIngredients = ingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedSuppliers = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const storeSelect = document.getElementById('si-store-select');
    if (storeSelect) {
        storeSelect.innerHTML = '<option value="">店舗を選択...</option>';
        stores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.store_id || s.id;
            opt.textContent = s.store_name || s.Name || s.id;
            storeSelect.appendChild(opt);
        });
    }
}

async function loadStoreItems() {
    if (!selectedStoreId) return;
    const q = query(collection(db, "m_store_items"), where("StoreID", "==", selectedStoreId));
    const snap = await getDocs(q);
    cachedStoreItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderTableRows() {
    const tbody = document.getElementById('si-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (cachedStoreItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 3rem; color: var(--text-secondary);">品目が設定されていません</td></tr>';
        return;
    }

    // Sort by Timing then Name
    cachedStoreItems.sort((a, b) => {
        if (a.確認タイミング !== b.確認タイミング) return a.確認タイミング.localeCompare(b.確認タイミング);
        const nameA = cachedItems.find(i => i.id === a.ProductID)?.name || '';
        const nameB = cachedItems.find(i => i.id === b.ProductID)?.name || '';
        return nameA.localeCompare(nameB);
    });

    cachedStoreItems.forEach(si => {
        const item = cachedItems.find(i => i.id === si.ProductID);
        const timing = cachedTimings.find(t => (t.ID || t.id) === si.確認タイミング);
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
            <td style="padding: 1.2rem;">
                <div style="font-weight: 600;">${item?.name || '不明'}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${item?.category || ''}</div>
            </td>
            <td style="padding: 1.2rem;"><span class="badge badge-blue">${timing?.確認タイミング || si.確認タイミング}</span></td>
            <td style="padding: 1.2rem; text-align: center; font-family: monospace; font-weight: 700;">${si.定数 || 0}</td>
            <td style="padding: 1.2rem; color: var(--text-secondary);">${si.location_label || si.保管場所 || '-'}</td>
            <td style="padding: 1.2rem; text-align: right;">
                <button class="btn btn-delete-si" style="padding: 0.5rem; background: transparent; color: var(--danger);"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;

        tr.querySelector('.btn-delete-si').onclick = async () => {
            if (await showConfirm(`削除の確認`, `「${item?.name}」をこの店舗の在庫リストから削除しますか？`)) {
                await deleteDoc(doc(db, "m_store_items", si.id));
                await loadStoreItems();
                renderTableRows();
            }
        };

        tbody.appendChild(tr);
    });
}

// openModal is removed in favor of renderView() switching currentView

async function saveStoreItem() {
    const checkedBoxes = Array.from(document.querySelectorAll('.si-checkbox:checked'));
    const timingId = document.getElementById('si-timing-select').value;
    const parStock = Number(document.getElementById('si-par-stock').value) || 0;
    const locationLabel = document.getElementById('si-location').value;

    if (!selectedStoreId || checkedBoxes.length === 0) {
        showAlert('エラー', "品目を選択してください。");
        return;
    }
    if (!timingId) {
        showAlert('エラー', "タイミングを選択してください。");
        return;
    }

    const btnSubmit = document.querySelector('#si-form button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

    try {
        let count = 0;
        for (const box of checkedBoxes) {
            const itemId = box.value;
            
            // 重複チェック
            if (cachedStoreItems.some(si => si.ProductID === itemId)) {
                console.log(`Skipping duplicate: ${itemId}`);
                continue;
            }

            const newItem = {
                StoreID: selectedStoreId,
                ProductID: itemId,
                確認タイミング: timingId,
                定数: parStock,
                location_label: locationLabel,
                is_confirmed: false,
                個数: 0,
                updated_at: new Date().toISOString()
            };

            await setDoc(doc(db, "m_store_items", `${selectedStoreId}_${itemId}`), newItem);
            count++;
        }

        showAlert('完了', `${count}件の品目を追加しました。`);
        currentView = 'list';
        await loadStoreItems();
        renderView();
    } catch (err) {
        showAlert('エラー', "保存に失敗しました: " + err.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '追加する';
    }
}
