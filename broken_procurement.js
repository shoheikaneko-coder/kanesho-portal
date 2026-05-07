import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getEffectivePrice } from './cost_engine.js';
import { showAlert, showConfirm } from './ui_utils.js';

/**
 * 仕入れ・仕込み・移動リスト (v2)
 * m_store_items の 個数 < 定数 を直接比較。
 * shortage_action_type で仕入れ/仕込みを分岐。
 */

export const procurementMobilePageHtml = `
    <div id="procurement-app" class="animate-fade-in" style="display: flex; flex-direction: column; height: calc(100vh - 80px); overflow: hidden; background: #f8fafc;">
        
        <!-- Compact Header: Scope & Category Switcher -->
        <div style="background: white; border-bottom: 1px solid #e2e8f0; padding: 0.6rem 1rem; flex-shrink: 0; display: flex; flex-direction: column; gap: 0.6rem;">
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <div id="proc-scope-config" style="display: flex; background: #f1f5f9; padding: 2px; border-radius: 8px; width: 140px;">
                    <button id="btn-scope-store" class="scope-tab active">自店舗</button>
                    <button id="btn-scope-group" class="scope-tab">グループ</button>
                </div>
                
                <nav id="proc-category-nav" style="flex: 1; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;">
                    <button class="cat-tab-mini-mini" data-cat="purchase">仕入れ</button>
                    <button class="cat-tab-mini-mini" data-cat="transfer">移動</button>
                    <button class="cat-tab-mini-mini" data-cat="store_prep">仕込</button>
                    <button class="cat-tab-mini-mini" data-cat="ck_prep">CK仕込</button>
                </nav>

                <button id="btn-proc-refresh" style="width: 32px; height: 32px; border: none; background: #f1f5f9; color: #64748b; border-radius: 8px; font-size: 0.8rem;">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>

            <!-- Vendor Selection Bar (Purchase Only) -->
            <div id="proc-vendor-bar" style="display: none; align-items: center; gap: 0.6rem;">
                <div id="btn-vendor-selector" style="flex: 1; display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 0.8rem; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-truck" style="color: var(--primary); font-size: 0.8rem;"></i>
                        <span id="current-vendor-label" style="font-size: 0.85rem; font-weight: 800; color: #1e293b;">すべての業者</span>
                    </div>
                    <i class="fas fa-chevron-down" style="font-size: 0.7rem; color: #94a3b8;"></i>
                </div>
                <button id="btn-proc-history" style="width: 36px; height: 36px; border: none; background: #f1f5f9; color: #64748b; border-radius: 10px; display: none;">
                    <i class="fas fa-history"></i>
                </button>
            </div>
        </div>
        
        <!-- Main Content Area: High-Density List -->
        <main id="proc-main-content" style="flex: 1; overflow-y: auto; background: white;">
            <!-- Items injected here -->
        </main>

        <!-- Vendor Selection Modal (Bottom Sheet style) -->
        <div id="vendor-modal" class="modal-overlay" style="display: none; align-items: flex-end;">
            <div class="glass-panel animate-slide-up" style="width: 100%; max-height: 80vh; border-radius: 24px 24px 0 0; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900;">業者を選択</h3>
                    <button id="btn-close-vendor-modal" style="background: none; border: none; font-size: 1.2rem; color: #94a3b8;"><i class="fas fa-times"></i></button>
                </div>
                <div style="position: relative;">
                    <i class="fas fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;"></i>
                    <input type="text" id="vendor-search-input" placeholder="業者名で検索..." style="width: 100%; padding: 0.7rem 1rem 0.7rem 2.2rem; border-radius: 12px; border: 2px solid #f1f5f9; font-size: 0.9rem; outline: none;">
                </div>
                <div id="vendor-list-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; min-height: 200px;">
                    <!-- Vendors injected here -->
                </div>
            </div>
        </div>

        <style>
            .cat-tab-mini-mini {
                flex: 1;
                height: 32px;
                padding: 0 8px;
                border: 1.5px solid transparent;
                background: #f1f5f9;
                color: #64748b;
                border-radius: 8px;
                font-weight: 800;
                font-size: 0.7rem;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                white-space: nowrap;
            }
            .cat-tab-mini-mini.active {
                background: white;
                color: var(--primary);
                border-color: var(--primary);
                box-shadow: 0 2px 6px rgba(230, 57, 70, 0.1);
            }

            .scope-tab {
                flex: 1;
                height: 28px;
                border: none;
                background: transparent;
                color: #64748b;
                font-weight: 800;
                font-size: 0.7rem;
                border-radius: 6px;
                transition: all 0.2s;
            }
            .scope-tab.active {
                background: white;
                color: var(--primary);
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }

            /* High-density item row */
            .proc-item-row {
                display: flex;
                align-items: center;
                padding: 0.8rem 1rem;
                border-bottom: 1px solid #f1f5f9;
                gap: 0.8rem;
                background: white;
            }
            .proc-item-row:active { background: #f8fafc; }
            
            .proc-item-info { flex: 1; min-width: 0; }
            .proc-item-name { font-weight: 800; font-size: 0.95rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .proc-item-meta { font-size: 0.7rem; color: #94a3b8; font-weight: 600; display: flex; gap: 0.5rem; }

            .proc-req-badge {
                padding: 0.2rem 0.6rem;
                background: #fff5f5;
                color: var(--primary);
                border-radius: 6px;
                font-weight: 900;
                font-size: 0.85rem;
                text-align: right;
                min-width: 60px;
            }

            .proc-stepper {
                display: flex;
                align-items: center;
                background: #f1f5f9;
                border-radius: 8px;
                padding: 2px;
                gap: 2px;
            }
            .proc-stepper-btn {
                width: 32px;
                height: 32px;
                border: none;
                background: white;
                border-radius: 6px;
                color: #1e293b;
                font-size: 0.8rem;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .proc-qty-input {
                width: 40px;
                height: 32px;
                border: none;
                background: transparent;
                text-align: center;
                font-size: 1rem;
                font-weight: 900;
                color: var(--primary);
                outline: none;
            }

            .proc-confirm-btn-small {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: var(--primary);
                color: white;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 10px rgba(230, 57, 70, 0.2);
                flex-shrink: 0;
            }
            .proc-confirm-btn-small:disabled { background: #cbd5e1; box-shadow: none; }
            
            .vendor-item {
                padding: 1rem;
                background: #f8fafc;
                border-radius: 14px;
                font-weight: 800;
                font-size: 0.95rem;
                color: #1e293b;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border: 2px solid transparent;
            }
            .vendor-item.active {
                background: #fff5f5;
                border-color: var(--primary);
                color: var(--primary);
            }

            /* Animations */
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        </style>
    </div>
`


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
let procurementUnsubscribe = null;

export async function initProcurementMobilePage(user, category = null) {
    currentUser = user;
    selectedVendor = null;
    collapsedItems.clear();

    // 既存のリスナーがあれば解除
    if (procurementUnsubscribe) {
        procurementUnsubscribe();
        procurementUnsubscribe = null;
    }

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
    if (!allGroupStores || allGroupStores.length === 0) return;
    
    const storeIds = allGroupStores.map(s => s.id);
    
    // 既存のリスナーがあれば解除
    if (procurementUnsubscribe) {
        procurementUnsubscribe();
        procurementUnsubscribe = null;
    }

    console.log("Setting up real-time listener for procurement (Group):", storeIds);
    
    return new Promise((resolve) => {
        const q = query(collection(db, "m_store_items"), where("StoreID", "in", storeIds));
        
        let isFirstLoad = true;
        procurementUnsubscribe = onSnapshot(q, (snap) => {
            console.log("Procurement snapshot received. Size:", snap.size);
            procurementData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            if (isFirstLoad) {
                isFirstLoad = false;
                resolve();
            }
            render();
        }, (err) => {
            console.error("Procurement listener error:", err);
            resolve(); // エラーでも次へ進む
        });
    });
}
));
}

function setupEventListeners() {
    const btnStore = document.getElementById('btn-scope-store');
    const btnGroup = document.getElementById('btn-scope-group');
    const btnRefresh = document.getElementById('btn-proc-refresh');

    // Business Category Tabs
    document.querySelectorAll('.cat-tab-mini-mini').forEach(tab => {
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
        // リスナー経由で同期されるが、明示的なリロードも残す
        await refreshProcurementData();
        render();
        await showLoading(false);
    };

    const btnHistory = document.getElementById('btn-proc-history');
    if (btnHistory) btnHistory.onclick = showTransferHistory;

    // Vendor Selector Logic
    const btnVendorSelector = document.getElementById('btn-vendor-selector');
    const vendorModal = document.getElementById('vendor-modal');
    const btnCloseVendorModal = document.getElementById('btn-close-vendor-modal');
    const vendorSearchInput = document.getElementById('vendor-search-input');

    if (btnVendorSelector) btnVendorSelector.onclick = () => {
        vendorModal.style.display = 'flex';
        renderVendorList();
    };

    if (btnCloseVendorModal) btnCloseVendorModal.onclick = () => {
        vendorModal.style.display = 'none';
    };

    if (vendorSearchInput) {
        vendorSearchInput.oninput = () => renderVendorList(vendorSearchInput.value);
    }
}
;
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

// Group-based category filtering (Exposed for ops_hub_main.js)
window.filterProcurementCategories = (mode) => {
    const nav = document.getElementById('proc-category-nav');
    if (!nav) return;

    const buyMoveCats = ['purchase', 'transfer'];
    const makeCats = ['store_prep', 'ck_prep'];
    const targetCats = mode === 'buy_move' ? buyMoveCats : makeCats;

    nav.querySelectorAll('.cat-tab-mini').forEach(tab => {
        const cat = tab.dataset.cat;
        const isVisible = targetCats.includes(cat);
        tab.style.display = isVisible ? 'flex' : 'none';
    });

    // Automatically select the first visible tab if current category is not in target
    if (!targetCats.includes(selectedCategory)) {
        selectedCategory = targetCats[0];
        render();
    }
};

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
    
    const itemName = si.display_name || master?.name || '品目不明';

    return `
        <div class="proc-item-row" data-id="${si.id}">
            <div class="proc-item-info">
                <div class="proc-item-name">${itemName}</div>
                <div class="proc-item-meta">
                    ${showStoreName ? `<span><i class="fas fa-store"></i> ${sName}</span>` : ''}
                    <span><i class="fas fa-tag"></i> ${sUnit}</span>
                </div>
            </div>
            
            <div class="proc-req-badge">
                ${req}<span style="font-size:0.6rem; margin-left:1px;">${sUnit}</span>
            </div>

            <div class="proc-stepper">
                <button class="proc-stepper-btn btn-minus" data-si-id="${si.id}"><i class="fas fa-minus"></i></button>
                <input type="number" class="proc-qty-input" value="${req}" data-si-id="${si.id}" inputmode="numeric">
                <button class="proc-stepper-btn btn-plus" data-si-id="${si.id}"><i class="fas fa-plus"></i></button>
            </div>

            <button class="proc-confirm-btn-small btn-confirm-action" data-si-id="${si.id}">
                <i class="fas fa-check"></i>
            </button>
        </div>
    `;
}
;
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
    nav.querySelectorAll('.cat-tab-mini').forEach(tab => {
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
        const vbar = document.getElementById('proc-vendor-bar'); if(vbar) vbar.style.display = 'none';
        renderTransferContent(shortItems);
    } else {
        const vbar = document.getElementById('proc-vendor-bar'); if(vbar) vbar.style.display = 'none';
        renderMainContent(shortItems);
    }
}

function renderPurchaseContent(shortItems) {
    const vendorBar = document.getElementById('proc-vendor-bar');
    if (vendorBar) {
        vendorBar.style.display = 'flex';
        const label = document.getElementById('current-vendor-label');
        if (label) label.textContent = selectedVendor || 'すべての業者';
    }

    const filteredItems = selectedVendor 
        ? shortItems.filter(si => {
            const item = cachedItems.find(i => i.id === si.ProductID);
            const ing = cachedIngredients.find(ing => ing.item_id === si.ProductID);
            const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
            const v = sup?.vendor_name || item?.supplier_name || item?.業者名 || '未設定';
            return v === selectedVendor;
          })
        : shortItems;

    renderMainContent(filteredItems);
}
;
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
                <div class="proc-detail-container ${isCollapsed ? 'hidden' : ''}" style="background: #fffafa; display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
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
            html += renderItemRow(productItems[0], master, false);
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
                        ${productItems.map(si => renderItemRow(si, master, true)).join('')}
                    </div>
                </div>
            `;
        }
    });

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
    container.querySelectorAll('.proc-stepper-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const sid = btn.dataset.siId;
            const input = container.querySelector(`.proc-qty-input[data-si-id="${sid}"]`);
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
            const input = container.querySelector(`.proc-qty-input[data-si-id="${siId}"]`);
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

window.showTransferHistory = showTransferHistory;
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

function renderVendorList(query = '') {
    const container = document.getElementById('vendor-list-container');
    if (!container) return;

    // 現在表示されている品目から業者リストを作成
    const filteredData = selectedScope === 'store' 
        ? procurementData.filter(d => d.StoreID === currentStore.id)
        : procurementData;

    const shortItems = filteredData.filter(si => {
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        return par > 0 && qty < par && (si.shortage_action_type || 'purchase') === selectedCategory;
    });

    const vendorMap = {};
    shortItems.forEach(si => {
        const item = cachedItems.find(i => i.id === si.ProductID);
        const ing = cachedIngredients.find(ing => ing.item_id === si.ProductID);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        const v = sup?.vendor_name || item?.supplier_name || item?.業者名 || '未設定';
        if (!vendorMap[v]) vendorMap[v] = 0;
        vendorMap[v]++;
    });

    const vendors = Object.keys(vendorMap).filter(v => v.toLowerCase().includes(query.toLowerCase())).sort();
    
    let html = `<div class="vendor-item ${!selectedVendor ? 'active' : ''}" onclick="window.selectVendor(null)">
        <span>すべての業者</span>
        <span style="font-size:0.75rem; opacity:0.7">${shortItems.length}</span>
    </div>`;

    html += vendors.map(v => `
        <div class="vendor-item ${selectedVendor === v ? 'active' : ''}" onclick="window.selectVendor('${v}')">
            <span>${v}</span>
            <span style="font-size:0.75rem; opacity:0.7">${vendorMap[v]}</span>
        </div>
    `).join('');

    container.innerHTML = html;
}

window.selectVendor = (v) => {
    selectedVendor = v;
    document.getElementById('vendor-modal').style.display = 'none';
    const label = document.getElementById('current-vendor-label');
    if (label) label.textContent = v || 'すべての業者';
    render();
};
