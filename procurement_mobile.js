import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getEffectivePrice } from './cost_engine.js';
import { showAlert, showConfirm } from './ui_utils.js';

/**
 * 仕入れ・仕込み・移動リスト (v2)
 * m_store_items の 個数 < 定数 を直接比較。
 * shortage_action_type で仕入れ/仕込みを分岐。
 */

export const procurementMobilePageHtml = `
    <div id="procurement-app" class="animate-fade-in" style="display: flex; flex-direction: column; height: calc(100vh - 80px); overflow: hidden; background: #f8fafc;">
        
        <!-- Top Tab Navigation: Business Categories -->
        <nav id="proc-category-nav" style="background: white; border-bottom: 1px solid #e2e8f0; display: flex; padding: 0.8rem 1rem; gap: 0.5rem; flex-shrink: 0; overflow-x: auto; scrollbar-width: none;">
            <button class="cat-tab" data-cat="purchase"><i class="fas fa-shopping-cart"></i> 仕入れ</button>
            <button class="cat-tab" data-cat="transfer"><i class="fas fa-exchange-alt"></i> 移動</button>
            <button class="cat-tab" data-cat="store_prep"><i class="fas fa-utensils"></i> 仕込み</button>
            <button class="cat-tab" data-cat="ck_prep"><i class="fas fa-industry"></i> CK仕込</button>
        </nav>

        <!-- Context Control: Scope & Vendor Pills -->
        <div id="proc-context-bar" style="background: white; border-bottom: 1px solid #e2e8f0; padding: 0.8rem 1rem; flex-shrink: 0; display: flex; flex-direction: column; gap: 0.8rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                <div id="proc-scope-config" style="display: flex; background: #f1f5f9; padding: 3px; border-radius: 10px; flex: 1;">
                    <button id="btn-scope-store" class="scope-tab active">自店舗</button>
                    <button id="btn-scope-group" class="scope-tab">グループ全体</button>
                </div>
                <button id="btn-proc-history" class="btn" style="width: 44px; height: 36px; padding: 0; background: #f1f5f9; color: #64748b; border: none; border-radius: 10px; display: none;">
                    <i class="fas fa-history"></i>
                </button>
                <button id="btn-proc-refresh" class="btn" style="width: 44px; height: 36px; padding: 0; background: #f1f5f9; color: #64748b; border: none; border-radius: 10px;">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>

            <!-- Horizontal Vendor Pills (Only for Purchase) -->
            <div id="proc-vendor-nav" style="overflow-x: auto; white-space: nowrap; display: none; gap: 0.5rem; scrollbar-width: none;">
                <!-- Vendors injected here -->
            </div>
        </div>
        
        <!-- Main Content Area: Cards -->
        <main id="proc-main-content" style="flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem;">
            <!-- Cards injected here -->
        </main>

        <!-- Loading overlay -->
        <div id="proc-loading" style="display:none; position:fixed; inset:0; background:rgba(255,255,255,0.75); z-index:9999; justify-content:center; align-items:center;">
            <div class="glass-panel" style="padding: 2rem; text-align:center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top: 1rem; font-weight: 600;">処理中...</p>
            </div>
        </div>

        <style>
            .cat-tab {
                flex: 1;
                min-width: 90px;
                height: 44px;
                border: 2px solid transparent;
                background: #f1f5f9;
                color: #64748b;
                border-radius: 12px;
                font-weight: 800;
                font-size: 0.85rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                transition: all 0.2s;
                white-space: nowrap;
            }
            .cat-tab.active {
                background: white;
                color: var(--primary);
                border-color: var(--primary);
                box-shadow: 0 4px 12px rgba(230, 57, 70, 0.1);
            }

            .scope-tab {
                flex: 1;
                height: 30px;
                border: none;
                background: transparent;
                color: #64748b;
                font-weight: 800;
                font-size: 0.75rem;
                border-radius: 8px;
                transition: all 0.2s;
            }
            .scope-tab.active {
                background: white;
                color: var(--primary);
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }

            .vendor-pill {
                display: inline-flex;
                padding: 0.5rem 1rem;
                background: #f1f5f9;
                color: #64748b;
                border-radius: 100px;
                font-weight: 800;
                font-size: 0.8rem;
                border: 1.5px solid transparent;
                cursor: pointer;
            }
            .vendor-pill.active {
                background: white;
                color: var(--primary);
                border-color: var(--primary);
            }

            .proc-card {
                background: white;
                border-radius: 20px;
                padding: 1.2rem;
                border: 1px solid #e2e8f0;
                display: flex;
                flex-direction: column;
                gap: 1.2rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.03);
            }

            .stepper-mobile {
                display: flex;
                align-items: center;
                background: #f8fafc;
                border-radius: 14px;
                padding: 4px;
                border: 1.5px solid #f1f5f9;
            }
            .stepper-btn-mobile {
                width: 48px;
                height: 48px;
                border-radius: 11px;
                background: white;
                color: #1e293b;
                border: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                font-size: 1.2rem;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .proc-buy-input {
                width: 60px;
                height: 48px;
                border: none;
                background: transparent;
                text-align: center;
                font-size: 1.4rem;
                font-weight: 900;
                color: var(--primary);
                outline: none;
            }

            .btn-action-mobile {
                flex: 1;
                height: 56px;
                border-radius: 16px;
                background: var(--primary);
                color: white;
                font-weight: 900;
                font-size: 1rem;
                border: none;
                box-shadow: var(--shadow-primary);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.6rem;
            }
            .btn-action-mobile:active { transform: scale(0.96); }
            .btn-action-mobile:disabled { background: #cbd5e1; box-shadow: none; }

            .source-badge {
                font-size: 0.75rem;
                font-weight: 800;
                color: #475569;
                background: #f1f5f9;
                padding: 0.4rem 0.8rem;
                border-radius: 10px;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
        </style>
    </div>
`;
    </div>
`;

// State
let selectedScope = 'store'; // 'store' or 'group'
let selectedCategory = null; // 'purchase', 'store_prep', 'ck_prep', 'transfer'
let selectedVendor = null;
let allGroupStores = [];    // Stores in the same group
let currentStore = null;    // Current user's store object
let procurementData = [];   // Aggregated store items
let collapsedItems = new Set();
let cachedItems = [];
let cachedIngredients = [];
let cachedSuppliers = [];
let currentUser = null;

export async function initProcurementMobilePage(user, category = null) {
    currentUser = user;
    selectedVendor = null;
    collapsedItems.clear();

    if (category) {
        selectedCategory = category;
    }

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

    // Business Category Tabs
    document.querySelectorAll('.cat-tab').forEach(tab => {
        tab.onclick = () => {
            selectedCategory = tab.dataset.cat;
            selectedVendor = null; 
            render();
        };
    });

    if (btnStore) btnStore.onclick = () => {
        selectedScope = 'store';
        render();
    };

    if (btnGroup) btnGroup.onclick = () => {
        selectedScope = 'group';
        render();
    };

    if (btnRefresh) btnRefresh.onclick = async () => {
        await showLoading(true);
        await refreshProcurementData();
        render();
        await showLoading(false);
    };

    const btnHistory = document.getElementById('btn-proc-history');
    if (btnHistory) btnHistory.onclick = showTransferHistory;
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

function renderItemCard(si, master, showStoreName = false) {
    const store = allGroupStores.find(s => s.id === si.StoreID);
    const sName = store?.store_name || store?.Name || si.StoreID;
    const diff = Number(si.定数 || 0) - Number(si.個数 || 0);
    const req = Math.round(Math.max(0, diff));
    const sUnit = si.display_unit || master?.unit || '';

    const actionLabels = { purchase: '発注・受取', store_prep: '仕込完了', ck_prep: '仕込完了', transfer: '移動実行' };
    const btnLabel = actionLabels[selectedCategory] || '完了';

    let transferUi = '';
    let sourceOptions = [];
    if (selectedCategory === 'transfer') {
        const otherStores = allGroupStores.filter(s => s.id !== si.StoreID);
        sourceOptions = otherStores.map(s => {
            const sourceItem = procurementData.find(d => d.StoreID === s.id && d.ProductID === si.ProductID);
            const stock = Number(sourceItem?.個数 || 0);
            return { id: s.id, name: s.store_name || s.Name, stock };
        }).sort((a, b) => b.stock - a.stock);

        const defaultSource = sourceOptions[0];
        const isOutOfStock = !defaultSource || defaultSource.stock <= 0;

        transferUi = `
            <div style="margin-bottom: 0.5rem;">
                <label style="font-size: 0.7rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 4px;">移動元</label>
                <select class="source-store-select" data-si-id="${si.id}" style="width: 100%; height: 40px; border-radius: 10px; border: 1.5px solid #f1f5f9; background: #f8fafc; font-weight: 800; font-size: 0.9rem; padding: 0 0.8rem;">
                    ${sourceOptions.map(o => `<option value="${o.id}" ${o.id === si.default_source_store_id ? 'selected' : ''} ${o.stock <= 0 ? 'disabled' : ''}>${o.name} (在庫:${o.stock})</option>`).join('')}
                </select>
                ${isOutOfStock ? '<div style="font-size: 0.65rem; color: var(--danger); font-weight: 800; margin-top: 4px;">※移動元の在庫が不足しています</div>' : ''}
            </div>
        `;
    }
    
    const itemName = si.display_name || master?.name || '品目不明';
    
    return `
        <div class="proc-card" data-id="${si.id}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-weight: 900; font-size: 1.1rem; color: #1e293b;">${itemName}</div>
                    ${showStoreName ? `<div style="font-size: 0.75rem; color: #64748b; font-weight: 700; margin-top: 4px;"><i class="fas fa-store"></i> 届け先: ${sName}</div>` : ''}
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">必要数</div>
                    <div style="color: var(--primary); font-size: 1.2rem; font-weight: 900;">${req} <span style="font-size: 0.8rem;">${sUnit}</span></div>
                </div>
            </div>

            ${transferUi}

            <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="stepper-mobile" style="flex: 1;">
                    <button class="stepper-btn-mobile btn-minus" data-si-id="${si.id}"><i class="fas fa-minus"></i></button>
                    <input type="number" class="proc-buy-input" value="${req}" data-si-id="${si.id}" inputmode="numeric">
                    <button class="stepper-btn-mobile btn-plus" data-si-id="${si.id}"><i class="fas fa-plus"></i></button>
                </div>
                <button class="btn-action-mobile btn-confirm-action" data-si-id="${si.id}" 
                    ${(selectedCategory === 'transfer' && (!sourceOptions || sourceOptions.every(o => o.stock <= 0))) ? 'disabled' : ''}>
                    ${btnLabel}
                </button>
            </div>
        </div>
    `;
}

function render() {
    const nav = document.getElementById('proc-category-nav');
    const main = document.getElementById('proc-main-content');
    const contextBar = document.getElementById('proc-context-bar');
    if (!nav || !main) return;

    // Update Category Tab UI
    nav.querySelectorAll('.cat-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.cat === (selectedCategory || ''));
    });

    // Update Scope Tab UI
    document.getElementById('btn-scope-store').classList.toggle('active', selectedScope === 'store');
    document.getElementById('btn-scope-group').classList.toggle('active', selectedScope === 'group');
    
    const btnHistory = document.getElementById('btn-proc-history');
    if (btnHistory) btnHistory.style.display = selectedCategory === 'transfer' ? 'block' : 'none';

    if (!selectedCategory) {
        main.innerHTML = `<div style="text-align:center; padding: 4rem; color: #94a3b8;">業務区分を選択してください</div>`;
        return;
    }

    let filteredData = procurementData;
    if (selectedScope === 'store') {
        filteredData = procurementData.filter(d => d.StoreID === currentStore.id);
    }

    const shortItems = filteredData.filter(si => {
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        return par > 0 && qty < par && (si.shortage_action_type || 'purchase') === selectedCategory;
    });

    if (selectedCategory === 'purchase') {
        renderPurchaseContent(shortItems);
    } else if (selectedCategory === 'transfer') {
        document.getElementById('proc-vendor-nav').style.display = 'none';
        renderTransferContent(shortItems);
    } else {
        document.getElementById('proc-vendor-nav').style.display = 'none';
        renderMainContent(shortItems);
    }
}

function renderPurchaseContent(shortItems) {
    const vendorNav = document.getElementById('proc-vendor-nav');
    if (!vendorNav) return;

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

    if (!selectedVendor && vendors.length > 0) selectedVendor = vendors[0];
    
    vendorNav.style.display = 'flex';
    vendorNav.innerHTML = vendors.map(v => `
        <div class="vendor-pill ${selectedVendor === v ? 'active' : ''}" data-vendor="${v}">
            ${v} (${vendorMap[v].length})
        </div>
    `).join('') || `<div style="font-size:0.75rem; color:var(--text-secondary);">不足品目なし</div>`;

    vendorNav.querySelectorAll('.vendor-pill').forEach(pill => {
        pill.onclick = () => {
            selectedVendor = pill.dataset.vendor;
            render();
        };
    });

    renderMainContent(vendorMap[selectedVendor] || []);
}

function renderTransferContent(items) {
    const main = document.getElementById('proc-main-content');
    if (!main) return;

    if (items.length === 0) {
        main.innerHTML = `<div style="text-align:center; padding:4rem; color:var(--text-secondary);"><i class="fas fa-check-circle" style="font-size:3rem; color:#10b981; opacity:0.2;"></i><p>現在、移動が必要な品目はありません</p></div>`;
        return;
    }

    // Group items by Source Store
    const itemsBySource = {};
    items.forEach(si => {
        const sourceId = si.default_source_store_id || 'UNKNOWN';
        if (!itemsBySource[sourceId]) itemsBySource[sourceId] = [];
        itemsBySource[sourceId].push(si);
    });

    let html = ``;
    Object.keys(itemsBySource).sort().forEach(sourceId => {
        const sourceStore = allGroupStores.find(s => s.id === sourceId);
        const sourceName = sourceStore?.store_name || sourceStore?.Name || (sourceId === 'UNKNOWN' ? '移動元未設定' : sourceId);
        const sourceItems = itemsBySource[sourceId];
        
        const isCollapsed = collapsedItems.has(sourceId);

        html += `
            <div class="item-block" style="border-bottom: 1px solid var(--border);">
                <div class="item-banner" data-id="${sourceId}" style="background: #fdf2f2; border-left: 4px solid #ef4444;">
                    <div class="banner-content">
                        <div class="title">
                            <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" style="width:1rem; font-size:0.8rem; color:var(--text-secondary);"></i>
                            <i class="fas fa-truck" style="color:#ef4444; font-size:0.9rem;"></i>
                            ${sourceName} から移動
                        </div>
                        <div class="total-req" style="background: #fee2e2; color: #b91c1c; border-color: #fca5a5;">${sourceItems.length} 品目</div>
                    </div>
                </div>
                <div class="proc-detail-container ${isCollapsed ? 'hidden' : ''}" style="background: #fffafa;">
                    ${sourceItems.map(si => {
                        const master = cachedItems.find(i => i.id === si.ProductID);
                        return renderItemRow(si, master, true);
                    }).join('')}
                </div>
            </div>
        `;
    });

    main.innerHTML = html;
    attachMainContentListeners(main);
}

function renderMainContent(items) {
    const main = document.getElementById('proc-main-content');
    if (!main) return;

    if (items.length === 0) {
        main.innerHTML = `<div style="text-align:center; padding:4rem; color:var(--text-secondary);"><i class="fas fa-check-circle" style="font-size:3rem; color:#10b981; opacity:0.2;"></i><p>現在、対象となる品目はありません</p></div>`;
        return;
    }

    // Group items by ProductID for aggregation
    const itemsByProduct = {};
    items.forEach(si => {
        if (!itemsByProduct[si.ProductID]) itemsByProduct[si.ProductID] = [];
        itemsByProduct[si.ProductID].push(si);
    });

    let html = ``;
    Object.keys(itemsByProduct).forEach(productId => {
        const productItems = itemsByProduct[productId];
        const master = cachedItems.find(i => i.id === productId);
        const name = master?.name || productId;
        const representativeUnit = productItems[0]?.display_unit || master?.unit || '';
        
        const totalReq = productItems.reduce((sum, si) => {
            const diff = Number(si.定数 || 0) - Number(si.個数 || 0);
            return sum + Math.round(Math.max(0, diff));
        }, 0);
        
        const isCollapsed = collapsedItems.has(productId);
        const isSelfScope = selectedScope === 'store';

        if (isSelfScope) {
            html += renderItemCard(productItems[0], master, false);
        } else {
            html += `
                <div class="item-block" style="border-bottom: 1px solid var(--border);">
                    <div class="item-banner" data-id="${productId}" style="background: white; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 14px;">
                        <div class="banner-content">
                            <div class="title">
                                <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" style="width:1rem; font-size:0.8rem; color:#94a3b8;"></i>
                                <div style="font-weight: 800; color: #1e293b;">${name}</div>
                            </div>
                            <div style="font-size: 0.7rem; font-weight: 800; color: var(--primary); background: #fff5f5; padding: 2px 8px; border-radius: 10px;">計 ${totalReq} ${representativeUnit}</div>
                        </div>
                    </div>
                    <div class="proc-detail-container ${isCollapsed ? 'hidden' : ''}" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                        ${productItems.map(si => renderItemCard(si, master, true)).join('')}
                    </div>
                </div>
            `;
        }
    });

    main.innerHTML = html;
    attachMainContentListeners(main);
}

    main.innerHTML = html;
    attachMainContentListeners(main);
}

function attachMainContentListeners(container) {
    // Accordion
    container.querySelectorAll('.item-banner').forEach(banner => {
        banner.onclick = () => {
            const id = banner.dataset.id;
            if (collapsedItems.has(id)) collapsedItems.delete(id);
            else collapsedItems.add(id);
            render();
        };
    });

    // Steppers
    container.querySelectorAll('.stepper-btn-mobile').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const sid = btn.dataset.siId;
            const input = container.querySelector(`.proc-buy-input[data-si-id="${sid}"]`);
            if (!input) return;
            let val = parseInt(input.value) || 0;
            if (btn.classList.contains('btn-plus')) val++;
            else val = Math.max(0, val - 1);
            input.value = val;
        };
    });

    // Action Buttons
    container.querySelectorAll('.btn-confirm-action').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const siId = btn.dataset.siId;
            const input = container.querySelector(`.proc-buy-input[data-si-id="${siId}"]`);
            const qty = Number(input.value);
            if (qty <= 0) return;
            
            if (selectedCategory === 'transfer') {
                await executeTransfer(siId, qty);
            } else {
                await executeAction(siId, qty);
            }
        };
    });
}

async function executeAction(storeItemId, qty) {
    const si = procurementData.find(d => d.id === storeItemId);
    if (!si) return;

    await showLoading(true);
    try {
        const now = new Date().toISOString();
        const oldQty = Number(si.個数 || 0);
        const newQty = oldQty + qty;
        const store = allGroupStores.find(s => s.id === si.StoreID);
        const bizDate = getBusinessDate(store);

        const reasonMap = { purchase: 'procurement', store_prep: 'preparation', ck_prep: 'ck_preparation' };
        const reasonType = reasonMap[selectedCategory] || 'procurement';
        const noteMap = { purchase: '仕入れによる追加', store_prep: '店舗仕込み完了', ck_prep: 'CK仕込み完了' };
        const note = noteMap[selectedCategory] || '手動追加';

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
            reason_type: reasonType,
            source_route: 'procurement_page',
            note: note,
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            business_date: bizDate
        });

        // 3. Update local data and Refresh
        si.個数 = newQty;
        showAlert("完了", "在庫に反映しました");
        render();
    } catch (err) {
        console.error("Action failed:", err);
        showAlert("エラー", "在庫の更新に失敗しました");
    } finally {
        await showLoading(false);
    }
}

async function executeTransfer(destStoreItemId, qty) {
    const destSi = procurementData.find(d => d.id === destStoreItemId);
    if (!destSi) return;

    const sourceStoreSelect = document.querySelector(`.source-store-select[data-si-id="${destStoreItemId}"]`);
    const sourceStoreId = sourceStoreSelect?.value;
    if (!sourceStoreId) {
        showAlert("エラー", "移動元店舗が選択されていません");
        return;
    }

    const sourceSi = procurementData.find(d => d.StoreID === sourceStoreId && d.ProductID === destSi.ProductID);
    
    // 単位換算の計算
    const destConv = Number(destSi.unit_conversion_amount || 1);
    const sourceConv = Number(sourceSi.unit_conversion_amount || 1);
    
    // 移動先での入力数(qty)を基本単位(physicalQty)に変換し、それを移動元の単位に再変換する
    const physicalQty = qty * destConv;
    const sourceDeductionQty = physicalQty / sourceConv;

    if (!sourceSi || Number(sourceSi.個数 || 0) < sourceDeductionQty) {
        const neededText = sourceSi ? ` (移動元で ${sourceDeductionQty.toFixed(2)}${sourceSi.display_unit || ''} 必要)` : "";
        showAlert("エラー", `移動元店舗に十分な在庫がありません${neededText}`);
        return;
    }

    const confirmTransfer = confirm(`移動元: ${sourceStoreId} (${sourceDeductionQty.toFixed(2)}${sourceSi.display_unit || ''} 減少)\n移動先: ${destSi.StoreID} (${qty}${destSi.display_unit || ''} 増加)\n\nを実行しますか？`);
    if (!confirmTransfer) return;

    await showLoading(true);
    try {
        const { writeBatch } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        const bizDate = getBusinessDate(allGroupStores.find(s => s.id === destSi.StoreID));

        const sourceOldQty = Number(sourceSi.個数 || 0);
        const sourceNewQty = sourceOldQty - sourceDeductionQty;
        const destOldQty = Number(destSi.個数 || 0);
        const destNewQty = destOldQty + qty;

        // 1. Update Destination
        batch.update(doc(db, "m_store_items", destSi.id), { 個数: destNewQty, updated_at: now });
        
        // 2. Update Source
        batch.update(doc(db, "m_store_items", sourceSi.id), { 個数: sourceNewQty, updated_at: now });

        // 3. Add History (Dest - Transfer In)
        const histDestRef = doc(collection(db, "t_inventory_history"));
        batch.set(histDestRef, {
            store_id: destSi.StoreID,
            item_id: destSi.ProductID,
            store_item_id: destSi.id,
            change_qty: qty,
            qty_after: destNewQty,
            reason_type: 'transfer_in',
            source_route: 'procurement_page',
            note: `店舗間移動(入庫): ${sourceStoreId} から`,
            executed_by: currentUser?.Name || 'unknown',
            executed_at: now,
            business_date: bizDate
        });

        // 4. Add History (Source - Transfer Out)
        const histSourceRef = doc(collection(db, "t_inventory_history"));
        batch.set(histSourceRef, {
            store_id: sourceSi.StoreID,
            item_id: sourceSi.ProductID,
            store_item_id: sourceSi.id,
            change_qty: -sourceDeductionQty,
            qty_after: sourceNewQty,
            reason_type: 'transfer_out',
            source_route: 'procurement_page',
            note: `店舗間移動(出庫): ${destSi.StoreID} へ (${qty}${destSi.display_unit || ''} 分)`,
            executed_by: currentUser?.Name || 'unknown',
            executed_at: now,
            business_date: bizDate
        });

        await batch.commit();

        // Update local data
        destSi.個数 = destNewQty;
        sourceSi.個数 = sourceNewQty;

        showAlert("完了", "店舗間移動を完了しました");
        render();
    } catch (err) {
        console.error("Transfer failed:", err);
        showAlert("エラー", "移動処理に失敗しました: " + err.message);
    } finally {
        await showLoading(false);
    }
}

async function showTransferHistory() {
    await showLoading(true);
    try {
        const q = query(
            collection(db, "t_inventory_history"), 
            where("reason_type", "in", ["transfer_in", "transfer_out"]),
            orderBy("executed_at", "desc")
        );
        const snap = await getDocs(q);
        const logs = snap.docs.map(d => d.data()).slice(0, 50); // Top 50

        const modalHtml = `
            <div id="transfer-history-modal" class="modal-overlay active" style="z-index: 10000; position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;">
                <div class="glass-panel" style="width: 90%; max-width: 800px; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column; padding: 0; background: white; border-radius: 16px; box-shadow: var(--shadow-lg);">
                    <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                        <h3 style="margin:0; font-weight: 800;"><i class="fas fa-history" style="color: var(--primary);"></i> 店舗間移動履歴 (直近50件)</h3>
                        <button onclick="document.getElementById('transfer-history-modal').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color: var(--text-secondary);">&times;</button>
                    </div>
                    <div style="flex:1; overflow-y:auto; padding: 1rem;">
                        <table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); text-align: left; color: var(--text-secondary);">
                                    <th style="padding: 0.8rem;">日時</th>
                                    <th style="padding: 0.8rem;">店舗</th>
                                    <th style="padding: 0.8rem;">品目</th>
                                    <th style="padding: 0.8rem; text-align: center;">数量</th>
                                    <th style="padding: 0.8rem;">内容</th>
                                    <th style="padding: 0.8rem;">実行者</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${logs.map(l => {
                                    const master = cachedItems.find(i => i.id === l.item_id);
                                    const store = allGroupStores.find(s => s.id === l.store_id);
                                    const date = new Date(l.executed_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    const isPlus = l.change_qty > 0;
                                    return `
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 0.8rem; color: var(--text-secondary); white-space: nowrap;">${date}</td>
                                            <td style="padding: 0.8rem; font-weight: 700;">${store?.store_name || store?.Name || l.store_id}</td>
                                            <td style="padding: 0.8rem; font-weight: 600;">${master?.name || l.item_id}</td>
                                            <td style="padding: 0.8rem; text-align: center; font-weight: 800; color: ${isPlus ? '#10b981' : '#ef4444'};">
                                                ${isPlus ? '+' : ''}${l.change_qty}
                                            </td>
                                            <td style="padding: 0.8rem; font-size: 0.75rem; color: var(--text-secondary);">${l.note}</td>
                                            <td style="padding: 0.8rem;">${l.executed_by}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        ${logs.length === 0 ? '<p style="text-align:center; padding: 3rem; color: var(--text-secondary);">履歴はありません</p>' : ''}
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (err) {
        console.error("History load failed:", err);
        showAlert("エラー", "履歴の読み込みに失敗しました");
    } finally {
        await showLoading(false);
    }
}
