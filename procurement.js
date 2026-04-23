import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getEffectivePrice } from './cost_engine.js';
import { showAlert, showConfirm } from './ui_utils.js';

/**
 * 仕入れ・仕込み・移動リスト (v2)
 * m_store_items の 個数 < 定数 を直接比較。
 * shortage_action_type で仕入れ/仕込みを分岐。
 */

export const procurementPageHtml = `
    <div id="procurement-app" class="animate-fade-in" style="max-width: 1100px; margin: 0 auto; padding-bottom: 3rem;">

        <!-- Header -->
        <div class="glass-panel" style="padding: 1.2rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <select id="proc-store-select" class="btn" style="background: white; border: 1px solid var(--border); min-width: 180px; font-size: 0.95rem;">
                    <option value="">拠点を選択...</option>
                </select>
                <button id="btn-proc-refresh" class="btn" style="background: var(--surface-darker); color: var(--text-secondary); border: 1px solid var(--border);">
                    <i class="fas fa-sync-alt"></i> 更新
                </button>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                在庫 &lt; 定数 の品目を表示しています
            </div>
        </div>

        <!-- Tabs -->
        <div class="tabs-container" style="margin-bottom: 1.5rem;">
            <div class="tab-item active" data-tab="purchase"><i class="fas fa-shopping-cart"></i> 仕入れリスト</div>
            <div class="tab-item" data-tab="prep"><i class="fas fa-mortar-pestle"></i> 仕込みリスト</div>
            <div class="tab-item" data-tab="transfer"><i class="fas fa-exchange-alt"></i> 移動・納品</div>
        </div>

        <!-- Content -->
        <div id="proc-content">
            <div style="text-align:center; padding: 4rem; color: var(--text-secondary);">
                <i class="fas fa-store-slash" style="font-size: 2rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                <p>拠点を選択してください</p>
            </div>
        </div>

        <!-- Loading overlay -->
        <div id="proc-loading" style="display:none; position:fixed; inset:0; background:rgba(255,255,255,0.75); z-index:9999; justify-content:center; align-items:center;">
            <div class="glass-panel" style="padding: 2rem; text-align:center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top: 1rem; font-weight: 600;">処理中...</p>
            </div>
        </div>
    </div>
`;

// State
let currentTab = 'purchase';
let selectedStoreId = null;
let allStores = [];
let storeItems = [];      // m_store_items for selected store
let cachedItems = [];
let cachedIngredients = [];
let cachedMenus = [];
let currentUser = null;

export async function initProcurementPage(user) {
    currentUser = user;
    selectedStoreId = null;
    storeItems = [];
    currentTab = 'purchase';

    await loadMasterData();
    setupTabs();
    setupStoreSelect();
}

async function loadMasterData() {
    const [itemSnap, storeSnap, ingSnap, menuSnap] = await Promise.all([
        getDocs(collection(db, "m_items")),
        getDocs(collection(db, "m_stores")),
        getDocs(collection(db, "m_ingredients")),
        getDocs(collection(db, "m_menus"))
    ]);
    cachedItems = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allStores = storeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedIngredients = ingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedMenus = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const sel = document.getElementById('proc-store-select');
    if (sel) {
        allStores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.store_id || s.id;
            opt.textContent = s.store_name || s.Name || s.id;
            sel.appendChild(opt);
        });
    }
}

function setupStoreSelect() {
    const sel = document.getElementById('proc-store-select');
    if (!sel) return;
    sel.onchange = async (e) => {
        selectedStoreId = e.target.value;
        if (selectedStoreId) {
            await loadStoreItems();
            renderContent();
        }
    };
    const refresh = document.getElementById('btn-proc-refresh');
    if (refresh) refresh.onclick = async () => {
        if (selectedStoreId) { await loadStoreItems(); renderContent(); }
    };
}

function setupTabs() {
    document.querySelectorAll('#procurement-app .tab-item').forEach(tab => {
        tab.onclick = () => {
            currentTab = tab.dataset.tab;
            document.querySelectorAll('#procurement-app .tab-item').forEach(t => t.classList.toggle('active', t === tab));
            renderContent();
        };
    });
}

async function loadStoreItems() {
    const q = query(collection(db, "m_store_items"), where("StoreID", "==", selectedStoreId));
    const snap = await getDocs(q);
    storeItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function getItemName(productId) {
    return cachedItems.find(i => i.id === productId)?.name || productId;
}

function getDisplayUnit(si) {
    if (si.display_unit) return si.display_unit;
    const item = cachedItems.find(i => i.id === si.ProductID);
    return item?.unit || '';
}

function getBusinessDate() {
    const store = allStores.find(s => (s.store_id || s.id) === selectedStoreId);
    const resetTime = store?.reset_time || "05:00";
    const now = new Date();
    const [h, m] = resetTime.split(':').map(Number);
    let cutoff = new Date(now);
    cutoff.setHours(h, m, 0, 0);
    if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);
    return cutoff.toISOString().split('T')[0];
}

function renderContent() {
    const content = document.getElementById('proc-content');
    if (!content) return;
    if (!selectedStoreId) {
        content.innerHTML = `<div style="text-align:center; padding:4rem; color:var(--text-secondary);"><i class="fas fa-store-slash" style="font-size:2rem;opacity:0.3;"></i><p>拠点を選択してください</p></div>`;
        return;
    }
    if (currentTab === 'purchase') renderPurchaseTab(content);
    else if (currentTab === 'prep') renderPrepTab(content);
    else renderTransferTab(content);
}

// ─── PURCHASE TAB ────────────────────────────────────────────────────────────
function renderPurchaseTab(container) {
    const shortItems = storeItems.filter(si => {
        const action = si.shortage_action_type || 'purchase';
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        return action === 'purchase' && par > 0 && qty < par;
    });

    if (shortItems.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-secondary);">
            <i class="fas fa-check-circle" style="font-size:2.5rem; color:#10b981; margin-bottom:1rem;"></i>
            <p style="font-weight:700;">仕入れが必要な品目はありません</p>
        </div>`;
        return;
    }

    const rows = shortItems.map(si => {
        const name = getItemName(si.ProductID);
        const unit = getDisplayUnit(si);
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        const shortage = (par - qty).toFixed(1);
        const autoAdd = si.auto_add_on_order !== false;
        return `
        <tr style="border-bottom:1px solid var(--border);" data-id="${si.id}">
            <td style="padding:1rem; font-weight:600;">${name}</td>
            <td style="padding:1rem; color:var(--primary); font-family:monospace; font-weight:700;">${qty} ${unit}</td>
            <td style="padding:1rem; color:var(--text-secondary); font-family:monospace;">${par} ${unit}</td>
            <td style="padding:1rem; color:var(--danger); font-weight:700; font-family:monospace;">-${shortage} ${unit}</td>
            <td style="padding:1rem;">
                <input type="number" class="proc-qty-input" step="any" value="${shortage}" style="width:80px; padding:0.4rem; border:1px solid var(--border); border-radius:6px; text-align:right;">
                <span style="font-size:0.8rem; color:var(--text-secondary); margin-left:0.3rem;">${unit}</span>
            </td>
            <td style="padding:1rem;">
                <select class="proc-route-select btn" style="background:white; border:1px solid var(--border); font-size:0.85rem; padding:0.4rem;">
                    <option value="direct_buy">買付先から</option>
                    <option value="from_warehouse">倉庫から</option>
                    <option value="delivery">業者納品</option>
                </select>
            </td>
            <td style="padding:1rem;">
                ${autoAdd
                    ? `<button class="btn btn-primary btn-proc-exec" style="font-size:0.85rem; padding:0.5rem 1rem;"><i class="fas fa-plus"></i> 反映</button>`
                    : `<button class="btn btn-proc-exec" style="background:#f59e0b;color:white;font-size:0.85rem;padding:0.5rem 1rem;"><i class="fas fa-clipboard-check"></i> 記録のみ</button>`}
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="padding:0; overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                    <tr style="background:var(--surface-darker); border-bottom:2px solid var(--border); color:var(--text-secondary);">
                        <th style="padding:1rem;">品目</th>
                        <th style="padding:1rem;">現在庫</th>
                        <th style="padding:1rem;">定数</th>
                        <th style="padding:1rem;">不足数</th>
                        <th style="padding:1rem;">購入数</th>
                        <th style="padding:1rem;">ルート</th>
                        <th style="padding:1rem;">操作</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;

    container.querySelectorAll('.btn-proc-exec').forEach((btn, idx) => {
        btn.onclick = () => executePurchase(shortItems[idx], btn);
    });
}

async function executePurchase(si, btn) {
    const row = btn.closest('tr');
    const qty = Number(row.querySelector('.proc-qty-input').value);
    const route = row.querySelector('.proc-route-select').value;
    if (qty <= 0) { showAlert('エラー', '数量は0より大きい値を入力してください。'); return; }

    showLoading(true);
    try {
        const autoAdd = si.auto_add_on_order !== false;
        const now = new Date().toISOString();
        const newQty = autoAdd ? (Number(si.個数 || 0) + qty) : Number(si.個数 || 0);
        const businessDate = getBusinessDate();

        if (autoAdd) {
            await updateDoc(doc(db, "m_store_items", si.id), { 個数: newQty, updated_at: now });
            si.個数 = newQty;
        }

        await addDoc(collection(db, "t_inventory_history"), {
            store_id: selectedStoreId,
            item_id: si.ProductID,
            store_item_id: si.id,
            change_qty: qty,
            qty_after: newQty,
            reason_type: 'purchase',
            source_route: route,
            note: '',
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            related_id: '',
            business_date: businessDate
        });

        showAlert('完了', `${getItemName(si.ProductID)} +${qty} ${getDisplayUnit(si)} を記録しました。`);
        renderContent();
    } catch (err) {
        showAlert('エラー', err.message);
    } finally {
        showLoading(false);
    }
}

// ─── PREP TAB ─────────────────────────────────────────────────────────────────
function renderPrepTab(container) {
    const shortItems = storeItems.filter(si => {
        const action = si.shortage_action_type || 'purchase';
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        return action === 'prep' && par > 0 && qty < par;
    });

    if (shortItems.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-secondary);">
            <i class="fas fa-check-circle" style="font-size:2.5rem; color:#10b981; margin-bottom:1rem;"></i>
            <p style="font-weight:700;">仕込みが必要な品目はありません</p>
        </div>`;
        return;
    }

    const rows = shortItems.map(si => {
        const name = getItemName(si.ProductID);
        const unit = getDisplayUnit(si);
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        const shortage = (par - qty).toFixed(1);
        return `
        <tr style="border-bottom:1px solid var(--border);" data-id="${si.id}">
            <td style="padding:1rem;">
                <div style="font-weight:600;">${name}</div>
                <span class="badge" style="background:#eff6ff;color:#2563eb;border:1px solid #dbeafe;font-size:0.7rem;">仕込み</span>
            </td>
            <td style="padding:1rem; color:var(--primary); font-family:monospace; font-weight:700;">${qty} ${unit}</td>
            <td style="padding:1rem; color:var(--text-secondary); font-family:monospace;">${par} ${unit}</td>
            <td style="padding:1rem; color:var(--danger); font-weight:700; font-family:monospace;">-${shortage} ${unit}</td>
            <td style="padding:1rem;">
                <input type="number" class="proc-prep-input" step="any" value="${shortage}" style="width:80px; padding:0.4rem; border:1px solid var(--border); border-radius:6px; text-align:right;">
                <span style="font-size:0.8rem; color:var(--text-secondary); margin-left:0.3rem;">${unit}</span>
            </td>
            <td style="padding:1rem;">
                <button class="btn btn-primary btn-prep-exec" style="font-size:0.85rem; padding:0.5rem 1rem; background:#8b5cf6;">
                    <i class="fas fa-check"></i> 仕込み完了
                </button>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="padding:0; overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                    <tr style="background:var(--surface-darker); border-bottom:2px solid var(--border); color:var(--text-secondary);">
                        <th style="padding:1rem;">品目</th>
                        <th style="padding:1rem;">現在庫</th>
                        <th style="padding:1rem;">定数</th>
                        <th style="padding:1rem;">不足数</th>
                        <th style="padding:1rem;">仕込み量</th>
                        <th style="padding:1rem;">操作</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;

    container.querySelectorAll('.btn-prep-exec').forEach((btn, idx) => {
        btn.onclick = () => executePrep(shortItems[idx], btn);
    });
}

async function executePrep(si, btn) {
    const row = btn.closest('tr');
    const qty = Number(row.querySelector('.proc-prep-input').value);
    if (qty <= 0) { showAlert('エラー', '数量は0より大きい値を入力してください。'); return; }

    showLoading(true);
    try {
        const now = new Date().toISOString();
        const newQty = Number(si.個数 || 0) + qty;
        const businessDate = getBusinessDate();

        await updateDoc(doc(db, "m_store_items", si.id), { 個数: newQty, updated_at: now });

        await addDoc(collection(db, "t_inventory_history"), {
            store_id: selectedStoreId,
            item_id: si.ProductID,
            store_item_id: si.id,
            change_qty: qty,
            qty_after: newQty,
            reason_type: 'prep_complete',
            source_route: '',
            note: '',
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            related_id: '',
            business_date: businessDate
        });

        si.個数 = newQty;
        showAlert('完了', `${getItemName(si.ProductID)} 仕込み完了 +${qty} ${getDisplayUnit(si)}`);
        renderContent();
    } catch (err) {
        showAlert('エラー', err.message);
    } finally {
        showLoading(false);
    }
}

// ─── TRANSFER TAB ─────────────────────────────────────────────────────────────
function renderTransferTab(container) {
    const storeOptions = allStores.map(s =>
        `<option value="${s.store_id || s.id}">${s.store_name || s.Name || s.id}</option>`
    ).join('');

    const itemOptions = storeItems.map(si => {
        const name = getItemName(si.ProductID);
        const unit = getDisplayUnit(si);
        return `<option value="${si.id}" data-unit="${unit}">${name} (現在: ${si.個数 || 0} ${unit})</option>`;
    }).join('');

    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="max-width:600px; margin:0 auto; padding:2rem;">
            <h3 style="margin-top:0; display:flex; align-items:center; gap:0.6rem;">
                <i class="fas fa-exchange-alt" style="color:var(--primary);"></i> 移動・納品登録
            </h3>
            <div style="display:flex; flex-direction:column; gap:1.2rem;">
                <div>
                    <label style="display:block; font-weight:700; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">品目 (現拠点: ${selectedStoreId})</label>
                    <select id="tr-item-select" style="width:100%; padding:0.7rem; border:1px solid var(--border); border-radius:8px; font-size:0.95rem;">
                        <option value="">品目を選択...</option>
                        ${itemOptions}
                    </select>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <label style="display:block; font-weight:700; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">操作種別</label>
                        <select id="tr-type-select" style="width:100%; padding:0.7rem; border:1px solid var(--border); border-radius:8px; font-size:0.95rem;">
                            <option value="delivery">業者納品（増加）</option>
                            <option value="from_warehouse">倉庫から持ち出し（増加）</option>
                            <option value="manual_add">手動追加</option>
                            <option value="transfer_out">他拠点へ移動（減少）</option>
                            <option value="manual_remove">手動減少</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-weight:700; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">数量 <span id="tr-unit-label"></span></label>
                        <input type="number" id="tr-qty-input" step="any" placeholder="0" style="width:100%; padding:0.7rem; border:1px solid var(--border); border-radius:8px; font-size:0.95rem;">
                    </div>
                </div>
                <div>
                    <label style="display:block; font-weight:700; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">メモ（任意）</label>
                    <input type="text" id="tr-note-input" placeholder="例: A社定期配送" style="width:100%; padding:0.7rem; border:1px solid var(--border); border-radius:8px; font-size:0.95rem;">
                </div>
                <button id="btn-tr-exec" class="btn btn-primary" style="padding:1rem; font-size:1rem; font-weight:700;">
                    <i class="fas fa-check"></i> 実行する
                </button>
            </div>
        </div>`;

    document.getElementById('tr-item-select').onchange = (e) => {
        const opt = e.target.selectedOptions[0];
        const unitLabel = document.getElementById('tr-unit-label');
        if (unitLabel) unitLabel.textContent = `(${opt?.dataset?.unit || ''})`;
    };

    document.getElementById('btn-tr-exec').onclick = executeTransfer;
}

async function executeTransfer() {
    const itemSel = document.getElementById('tr-item-select');
    const typeSel = document.getElementById('tr-type-select');
    const qtyInput = document.getElementById('tr-qty-input');
    const noteInput = document.getElementById('tr-note-input');

    const siId = itemSel.value;
    const type = typeSel.value;
    const qty = Number(qtyInput.value);
    const note = noteInput.value.trim();

    if (!siId) { showAlert('エラー', '品目を選択してください。'); return; }
    if (qty <= 0) { showAlert('エラー', '数量は0より大きい値を入力してください。'); return; }

    const si = storeItems.find(s => s.id === siId);
    if (!si) return;

    const isDecrease = ['transfer_out', 'manual_remove'].includes(type);
    const delta = isDecrease ? -qty : qty;
    const newQty = Math.max(0, Number(si.個数 || 0) + delta);

    showLoading(true);
    try {
        const now = new Date().toISOString();
        const businessDate = getBusinessDate();
        const reasonMap = {
            'delivery': 'purchase',
            'from_warehouse': 'transfer_in',
            'manual_add': 'manual',
            'transfer_out': 'transfer_out',
            'manual_remove': 'manual'
        };

        await updateDoc(doc(db, "m_store_items", si.id), { 個数: newQty, updated_at: now });

        await addDoc(collection(db, "t_inventory_history"), {
            store_id: selectedStoreId,
            item_id: si.ProductID,
            store_item_id: si.id,
            change_qty: delta,
            qty_after: newQty,
            reason_type: reasonMap[type] || 'manual',
            source_route: type === 'delivery' ? 'delivery' : (type === 'from_warehouse' ? 'from_warehouse' : ''),
            note: note,
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            related_id: '',
            business_date: businessDate
        });

        si.個数 = newQty;
        showAlert('完了', `${getItemName(si.ProductID)}: ${isDecrease ? '-' : '+'}${qty} → 現在庫 ${newQty} ${getDisplayUnit(si)}`);
        await loadStoreItems();
        renderTransferTab(document.getElementById('proc-content'));
    } catch (err) {
        showAlert('エラー', err.message);
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const el = document.getElementById('proc-loading');
    if (el) el.style.display = show ? 'flex' : 'none';
}
