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
    <div id="procurement-app" class="animate-fade-in" style="display: flex; height: calc(100vh - 120px); gap: 1rem; overflow: hidden; padding: 0 1rem;">
        
        <!-- Sidebar: Vendor Selection -->
        <aside id="proc-sidebar" class="glass-panel" style="width: 260px; display: flex; flex-direction: column; gap: 1rem; padding: 1.2rem; flex-shrink: 0;">
            <div id="proc-scope-config">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem;">表示設定</label>
                <div class="scope-toggle" style="display: flex; background: var(--surface-darker); padding: 3px; border-radius: 8px; border: 1px solid var(--border);">
                    <button id="btn-scope-store" class="toggle-btn active" style="flex: 1; padding: 0.4rem; font-size: 0.7rem; font-weight: 800; border-radius: 6px; border: none; cursor: pointer;">自店舗のみ</button>
                    <button id="btn-scope-group" class="toggle-btn" style="flex: 1; padding: 0.4rem; font-size: 0.7rem; font-weight: 800; border-radius: 6px; border: none; cursor: pointer;">グループ全体</button>
                </div>
            </div>

            <div style="flex: 1; overflow-y: auto;">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; margin-top: 1rem;">仕入先（業者）</label>
                <div id="proc-vendor-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <!-- Vendors injected here -->
                </div>
            </div>
        </aside>

        <!-- Main Area -->
        <main class="glass-panel" style="flex: 1; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
            <div id="proc-header" style="padding: 1rem 1.5rem; border-bottom: 2px solid var(--border); background: var(--surface-darker); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-truck-loading" style="color: var(--primary);"></i>
                    <h3 id="proc-current-title" style="margin: 0; font-size: 1rem; font-weight: 800;">仕入れ・調達</h3>
                    <span id="proc-scope-badge" class="badge" style="background: #eff6ff; color: #2563eb; font-size: 0.7rem;">自店舗</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <button id="btn-proc-refresh" class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; font-weight: 800;">
                        <i class="fas fa-sync-alt"></i> 更新
                    </button>
                </div>
            </div>
            
            <div id="proc-main-content" style="flex: 1; overflow-y: auto; padding: 0;">
                <!-- Accordion list injected here -->
            </div>
        </main>

        <!-- Loading overlay -->
        <div id="proc-loading" style="display:none; position:fixed; inset:0; background:rgba(255,255,255,0.75); z-index:9999; justify-content:center; align-items:center;">
            <div class="glass-panel" style="padding: 2rem; text-align:center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top: 1rem; font-weight: 600;">処理中...</p>
            </div>
        </div>

        <style>
            #proc-sidebar .toggle-btn { background: transparent; color: var(--text-secondary); transition: all 0.2s; }
            #proc-sidebar .toggle-btn.active { background: white; color: var(--primary); box-shadow: var(--shadow-sm); }
            
            .vendor-item { padding: 0.8rem 1rem; border-radius: 10px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; display: flex; align-items: center; justify-content: space-between; font-weight: 600; color: var(--text-secondary); }
            .vendor-item:hover { background: #f1f5f9; color: var(--text-primary); }
            .vendor-item.active { background: white; color: var(--primary); border-color: var(--primary); box-shadow: var(--shadow-sm); }
            .vendor-item .count { font-size: 0.7rem; background: #f1f5f9; padding: 2px 8px; border-radius: 10px; }
            .vendor-item.active .count { background: var(--primary); color: white; }

            .item-banner { background: #f1f5f9; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 0.8rem 1.2rem; cursor: pointer; user-select: none; }
            .item-banner:hover { background: #e2e8f0; }
            .item-banner .banner-content { display: flex; justify-content: space-between; align-items: center; }
            .item-banner .title { font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; gap: 0.8rem; color: #334155; }
            .item-banner .total-req { font-size: 0.75rem; font-weight: 800; color: var(--primary); background: white; padding: 0.3rem 0.8rem; border-radius: 20px; border: 1px solid #fee2e2; }

            /* Hide default arrows */
            input[type="number"]::-webkit-inner-spin-button, 
            input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            input[type="number"] { -moz-appearance: textfield; }

            .proc-row-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); background: white; transition: all 0.2s; }
            .proc-row-card:hover { background: #f8fafc; }
            
            .stepper-container { display: flex; align-items: center; background: #f1f5f9; border-radius: 10px; padding: 2px; border: 1px solid #e2e8f0; }
            .stepper-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: white; color: #64748b; cursor: pointer; font-weight: 800; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
            .stepper-btn:hover { background: var(--primary); color: white; }
            .stepper-btn:active { transform: scale(0.95); }
            
            .proc-buy-input { width: 50px; border: none; background: transparent; text-align: center; font-weight: 800; font-size: 1.1rem; color: var(--primary); outline: none; }
            
            .item-banner.hidden + .proc-detail-container { display: none; }
            .proc-detail-container.hidden { display: none; }
        </style>
    </div>
`;

// State
let selectedScope = 'store'; // 'store' or 'group'
let selectedVendor = null;
let allGroupStores = [];    // Stores in the same group
let currentStore = null;    // Current user's store object
let procurementData = [];   // Aggregated store items
let collapsedItems = new Set();
let cachedItems = [];
let cachedIngredients = [];
let cachedSuppliers = [];
let currentUser = null;

export async function initProcurementPage(user) {
    currentUser = user;
    selectedVendor = null;
    collapsedItems.clear();

    await showLoading(true);
    try {
        await loadInitialData();
        
        // デフォルトですべて畳んだ状態にする
        procurementData.forEach(si => collapsedItems.add(si.ProductID));

        // CK社員の場合はデフォルトでグループ表示にし、設定を隠す
        if (currentStore?.store_type === 'CK') {
            selectedScope = 'group';
            const scopeConfig = document.getElementById('proc-scope-config');
            if (scopeConfig) scopeConfig.style.display = 'none';
            const badge = document.getElementById('proc-scope-badge');
            if (badge) badge.textContent = 'グループ全体';
        } else {
            selectedScope = 'store';
        }

        setupEventListeners();
        render();
    } catch (err) {
        console.error("Procurement init failed:", err);
        showAlert("エラー", "データの読み込みに失敗しました");
    } finally {
        await showLoading(false);
    }
}

async function loadInitialData() {
    const [storeSnap, itemSnap, ingSnap, supSnap] = await Promise.all([
        getDocs(collection(db, "m_stores")),
        getDocs(collection(db, "m_items")),
        getDocs(collection(db, "m_ingredients")),
        getDocs(collection(db, "m_suppliers"))
    ]);

    const stores = storeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedItems = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedIngredients = ingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedSuppliers = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // User's store
    const storeId = currentUser?.StoreID || stores[0]?.id;
    currentStore = stores.find(s => s.id === storeId || s.store_id === storeId);
    
    if (!currentStore) throw new Error("所属店舗が見つかりません");

    // 2. Get all stores in the same group
    const groupName = currentStore.group_name || currentStore.所属グループ || '未設定';
    allGroupStores = stores.filter(s => (s.group_name || s.所属グループ || '未設定') === groupName);

    // 3. Load all store items for the group
    await refreshProcurementData();
}

async function refreshProcurementData() {
    const storeIds = allGroupStores.map(s => s.id);
    // Batch fetch store items for all stores in group
    const q = query(collection(db, "m_store_items"), where("StoreID", "in", storeIds));
    const snap = await getDocs(q);
    procurementData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function setupEventListeners() {
    const btnStore = document.getElementById('btn-scope-store');
    const btnGroup = document.getElementById('btn-scope-group');
    const btnRefresh = document.getElementById('btn-proc-refresh');

    if (btnStore) btnStore.onclick = () => {
        selectedScope = 'store';
        btnStore.classList.add('active');
        btnGroup.classList.remove('active');
        document.getElementById('proc-scope-badge').textContent = '自店舗';
        render();
    };

    if (btnGroup) btnGroup.onclick = () => {
        selectedScope = 'group';
        btnGroup.classList.add('active');
        btnStore.classList.remove('active');
        document.getElementById('proc-scope-badge').textContent = 'グループ全体';
        render();
    };

    if (btnRefresh) btnRefresh.onclick = async () => {
        await showLoading(true);
        await refreshProcurementData();
        render();
        await showLoading(false);
    };
}

function showLoading(show) {
    const el = document.getElementById('proc-loading');
    if (el) el.style.display = show ? 'flex' : 'none';
}

function getBusinessDate(store) {
    const resetTime = store?.reset_time || "05:00";
    const now = new Date();
    const [h, m] = resetTime.split(':').map(Number);
    let cutoff = new Date(now);
    cutoff.setHours(h, m, 0, 0);
    if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);
    return cutoff.toISOString().split('T')[0];
}

function renderItemRow(si, master, showStoreName = false) {
    const store = allGroupStores.find(s => s.id === si.StoreID);
    const sName = store?.store_name || store?.Name || si.StoreID;
    const diff = Number(si.定数 || 0) - Number(si.個数 || 0);
    const req = Math.round(Math.max(0, diff));
    const sUnit = si.display_unit || master?.unit || '';

    return `
        <div class="proc-row-card">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 150px;">
                <div style="width: 40px; height: 40px; background: #f8fafc; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--primary); border: 1px solid #e2e8f0;">
                    <i class="fas ${showStoreName ? 'fa-store' : 'fa-box'}" style="font-size:1.1rem;"></i>
                </div>
                <div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">${showStoreName ? sName : (master?.name || '品目不明')}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700;">
                        必要: <span style="color:var(--danger); font-size: 1rem; font-family: monospace;">${req}</span> ${sUnit}
                    </div>
                </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="stepper-container">
                    <button class="stepper-btn btn-minus" data-si-id="${si.id}"><i class="fas fa-minus"></i></button>
                    <input type="number" step="1" class="proc-buy-input" placeholder="0" data-si-id="${si.id}" value="${req}">
                    <button class="stepper-btn btn-plus" data-si-id="${si.id}"><i class="fas fa-plus"></i></button>
                </div>
                <button class="btn btn-primary btn-confirm-buy" data-si-id="${si.id}" style="padding: 0.6rem 1.2rem; font-size: 0.85rem; border-radius: 8px; font-weight: 800;">購入完了</button>
            </div>
        </div>
    `;
}

function render() {
    const sidebar = document.getElementById('proc-vendor-list');
    const main = document.getElementById('proc-main-content');
    if (!sidebar || !main) return;

    // 1. Filter data based on scope (Current store or all stores in group)
    let filteredData = procurementData;
    if (selectedScope === 'store') {
        filteredData = procurementData.filter(d => d.StoreID === currentStore.id);
    }

    // 2. Filter only short items (qty < par)
    const shortItems = filteredData.filter(si => {
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        return par > 0 && qty < par;
    });

    // 3. Extract Vendors and group items by Vendor then by ProductID
    const vendorMap = {};
    shortItems.forEach(si => {
        const item = cachedItems.find(i => i.id === si.ProductID);
        const ing = cachedIngredients.find(ing => ing.item_id === si.ProductID);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        
        const vendor = sup?.vendor_name || item?.supplier_name || item?.業者名 || '未設定';
        if (!vendorMap[vendor]) vendorMap[vendor] = [];
        vendorMap[vendor].push(si);
    });

    const vendors = Object.keys(vendorMap).sort((a,b) => {
        if (a === '未設定') return 1;
        if (b === '未設定') return -1;
        return a.localeCompare(b);
    });

    // 4. Render Sidebar
    if (!selectedVendor && vendors.length > 0) selectedVendor = vendors[0];
    sidebar.innerHTML = vendors.map(v => `
        <div class="vendor-item ${selectedVendor === v ? 'active' : ''}" data-vendor="${v}">
            <span>${v}</span>
            <span class="count">${vendorMap[v].length}</span>
        </div>
    `).join('') || `<div style="padding:1rem; font-size:0.75rem; color:var(--text-secondary);">不足品目はありません</div>`;

    sidebar.querySelectorAll('.vendor-item').forEach(item => {
        item.onclick = () => {
            selectedVendor = item.dataset.vendor;
            render();
        };
    });

    // 5. Render Main Content for Selected Vendor
    if (!selectedVendor || !vendorMap[selectedVendor]) {
        main.innerHTML = `<div style="text-align:center; padding:4rem; color:var(--text-secondary);"><i class="fas fa-check-circle" style="font-size:3rem; color:#10b981; opacity:0.2;"></i><p>現在、仕入れが必要な品目はありません</p></div>`;
        return;
    }

    // Group items by ProductID for aggregation
    const itemsByProduct = {};
    vendorMap[selectedVendor].forEach(si => {
        if (!itemsByProduct[si.ProductID]) itemsByProduct[si.ProductID] = [];
        itemsByProduct[si.ProductID].push(si);
    });

    let html = ``;
    Object.keys(itemsByProduct).forEach(productId => {
        const productItems = itemsByProduct[productId];
        const master = cachedItems.find(i => i.id === productId);
        const name = master?.name || productId;
        const representativeUnit = productItems[0]?.display_unit || master?.unit || '';
        
        // Calculate Total Requirement (rounding each store's need)
        const totalReq = productItems.reduce((sum, si) => {
            const diff = Number(si.定数 || 0) - Number(si.個数 || 0);
            return sum + Math.round(Math.max(0, diff));
        }, 0);
        
        const isCollapsed = collapsedItems.has(productId);
        const isSelfScope = selectedScope === 'store';

        if (isSelfScope) {
            html += renderItemRow(productItems[0], master, false);
        } else {
            html += `
                <div class="item-block" style="border-bottom: 1px solid var(--border);">
                    <div class="item-banner" data-id="${productId}">
                        <div class="banner-content">
                            <div class="title">
                                <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" style="width:1rem; font-size:0.8rem; color:var(--text-secondary);"></i>
                                <i class="fas fa-box" style="color:var(--primary); font-size:0.9rem;"></i>
                                ${name}
                            </div>
                            <div class="total-req">計 ${totalReq} ${representativeUnit} 必要</div>
                        </div>
                    </div>
                    <div class="proc-detail-container ${isCollapsed ? 'hidden' : ''}" style="background: #f8fafc;">
                        ${productItems.map(si => renderItemRow(si, master, true)).join('')}
                    </div>
                </div>
            `;
        }
    });

    main.innerHTML = html;

    // Listeners for Accordion
    main.querySelectorAll('.item-banner').forEach(banner => {
        banner.onclick = () => {
            const id = banner.dataset.id;
            if (collapsedItems.has(id)) collapsedItems.delete(id);
            else collapsedItems.add(id);
            render();
        };
    });

    // Listeners for Stepper Buttons
    main.querySelectorAll('.stepper-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const sid = btn.dataset.siId;
            const input = main.querySelector(`.proc-buy-input[data-si-id="${sid}"]`);
            if (!input) return;
            let val = parseInt(input.value) || 0;
            if (btn.classList.contains('btn-plus')) val++;
            else val = Math.max(0, val - 1);
            input.value = val;
        };
    });

    // Listeners for Purchase Buttons
    main.querySelectorAll('.btn-confirm-buy').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const siId = btn.dataset.siId;
            const input = main.querySelector(`.proc-buy-input[data-si-id="${siId}"]`);
            const buyQty = Number(input.value);
            if (buyQty <= 0) return;
            await executePurchase(siId, buyQty);
        };
    });
}

async function executePurchase(storeItemId, qty) {
    const si = procurementData.find(d => d.id === storeItemId);
    if (!si) return;

    await showLoading(true);
    try {
        const now = new Date().toISOString();
        const oldQty = Number(si.個数 || 0);
        const newQty = oldQty + qty;
        const store = allGroupStores.find(s => s.id === si.StoreID);
        const bizDate = getBusinessDate(store);

        // 1. Update Inventory
        await updateDoc(doc(db, "m_store_items", si.id), {
            個数: newQty,
            updated_at: now
        });

        // 2. Add History
        await addDoc(collection(db, "t_inventory_history"), {
            store_id: si.StoreID,
            item_id: si.ProductID,
            store_item_id: si.id,
            change_qty: qty,
            qty_after: newQty,
            reason_type: 'procurement',
            source_route: 'procurement_page',
            note: '仕入れによる追加',
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            business_date: bizDate
        });

        // 3. Update local data and Refresh
        si.個数 = newQty;
        showAlert("完了", "在庫に反映しました");
        render();
    } catch (err) {
        console.error("Purchase failed:", err);
        showAlert("エラー", "在庫の更新に失敗しました");
    } finally {
        await showLoading(false);
    }
}
