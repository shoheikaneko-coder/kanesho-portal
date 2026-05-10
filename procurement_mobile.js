import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where, orderBy, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
                <div id="proc-scope-container" style="display: flex; flex: 1; align-items: center; gap: 0.8rem; min-width: 0;">
                    <!-- Tabs or Store Selector will be injected here -->
                </div>
                
                <nav id="proc-category-nav" style="flex: 1; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;">
                    <button class="cat-tab-mini" data-cat="purchase" style="flex: 1;">仕入れ</button>
                    <button class="cat-tab-mini" data-cat="transfer" style="flex: 1;">移動</button>
                </nav>

                <button id="btn-proc-refresh" style="width: 32px; height: 32px; border: none; background: #f1f5f9; color: #64748b; border-radius: 8px; font-size: 0.8rem;">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>

            <div id="proc-vendor-bar" style="display: none; align-items: center; gap: 0.6rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 0.5rem 1rem;">
                <span id="secondary-store-name-label" style="font-size: 0.8rem; font-weight: 800; color: #1e293b; white-space: nowrap; flex-shrink: 0;"></span>
                <div id="btn-vendor-selector" style="flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.4rem 0.8rem; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden;">
                        <i class="fas fa-truck" style="color: var(--primary); font-size: 0.8rem;"></i>
                        <span id="current-vendor-label" style="font-size: 0.8rem; font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">すべての業者</span>
                    </div>
                    <i class="fas fa-chevron-down" style="font-size: 0.7rem; color: #94a3b8;"></i>
                </div>
                <button id="btn-master-batch-confirm" style="flex: 1; height: 40px; border: none; background: var(--primary); color: white; border-radius: 10px; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 4px 10px rgba(230, 57, 70, 0.2); transition: all 0.2s;">
                    <i class="fas fa-check-double"></i> 一括確定
                </button>
            </div>
        </div>
        
        <!-- Main Content Area: High-Density List -->
        <main id="proc-main-content" style="flex: 1; overflow-y: auto; background: white;">
            <!-- Items injected here -->
        </main>

        <!-- Vendor Selection Modal (Bottom Sheet style) -->
        <div id="vendor-modal" class="proc-modal-overlay" style="display: none; align-items: flex-end;">
            <div class="proc-glass-panel animate-slide-up" style="width: 100%; max-height: 80vh; border-radius: 24px 24px 0 0; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
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

        <!-- Store Selection Modal (Transfer Mode Only) -->
        <div id="proc-store-modal" class="proc-modal-overlay" style="display: none; align-items: flex-end;">
            <div class="proc-glass-panel animate-slide-up" style="width: 100%; max-height: 80vh; border-radius: 24px 24px 0 0; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900;">対象店舗を選択</h3>
                    <button id="btn-close-proc-store-modal" style="background: none; border: none; font-size: 1.2rem; color: #94a3b8;"><i class="fas fa-times"></i></button>
                </div>
                <div id="proc-store-list-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; min-height: 250px;">
                    <!-- Stores injected here -->
                </div>
            </div>
        </div>

        <style>
            .cat-tab-mini {
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
            .cat-tab-mini.active {
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
            
            .proc-item-info { flex: 1; min-width: 0; position: relative; }
            .proc-item-name { font-weight: 800; font-size: 0.95rem; color: #1e293b; position: relative; }
            .proc-item-name-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
            .proc-item-meta { font-size: 0.7rem; color: #94a3b8; font-weight: 600; display: flex; gap: 0.5rem; }

            .proc-req-badge {
                padding: 0.2rem 0.4rem;
                background: #fff5f5;
                color: var(--primary);
                border-radius: 8px;
                font-weight: 900;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-width: 54px;
                line-height: 1.1;
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

            /* Item Name Tooltip (Touch) */
            .proc-item-name {
                position: relative;
                cursor: pointer;
                user-select: none;
                -webkit-user-select: none;
                -webkit-tap-highlight-color: transparent;
            }
            .proc-item-name::after {
                content: attr(data-full-name);
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                background: #1e293b;
                color: white;
                padding: 0 0.5rem;
                border-radius: 4px;
                font-size: 0.95rem;
                font-weight: 800;
                white-space: nowrap;
                display: flex;
                align-items: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .proc-item-name.tooltip-active::after {
                opacity: 1;
            }

            .source-stock-label {
                font-size: 0.7rem;
                font-weight: 700;
                background: #f1f5f9;
                color: #475569;
                padding: 1px 6px;
                border-radius: 4px;
                margin-top: 2px;
                display: inline-flex;
                align-items: center;
                gap: 3px;
            }
            .source-stock-label.warning {
                background: #fff1f2;
                color: #e11d48;
            }

            .proc-batch-btn {
                background: var(--primary);
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 8px;
                font-size: 0.75rem;
                font-weight: 800;
                display: flex;
                align-items: center;
                gap: 4px;
                box-shadow: 0 2px 4px rgba(230, 57, 70, 0.2);
                transition: all 0.2s;
            }
            .proc-batch-btn:active {
                transform: scale(0.95);
                opacity: 0.9;
            }
            #btn-master-batch-confirm:disabled {
                background: #e2e8f0 !important;
                color: #94a3b8 !important;
                box-shadow: none !important;
                cursor: not-allowed;
                opacity: 1 !important;
            }

            /* Modal & Overlay (Procurement Page Only) */
            .proc-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(4px);
                z-index: 9999;
                display: flex;
                justify-content: center;
                transition: all 0.3s ease;
            }
            .proc-glass-panel {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            }

            #btn-vendor-selector:active {
                background: #f1f5f9 !important;
                transform: scale(0.98);
            }

            /* Animations */
            @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }

            /* Store Selector Fix */
            .inventory-store-selector-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 0.8rem;
                cursor: pointer;
                transition: all 0.2s;
            }
            .selector-content {
                display: flex;
                align-items: center;
                gap: 0.4rem;
                overflow: hidden;
                flex: 1;
            }
            .store-name {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .hidden { display: none !important; }
        </style>
    </div>
`;

// State
let selectedScope = 'store'; // 'store' or 'group'
let selectedCategory = null; // 'purchase', 'store_prep', 'ck_prep', 'transfer'
let selectedVendor = null;
let allGroupStores = [];    // Stores in the same group
let currentStore = null;    // Current user's store object
let procurementData = [];   // Aggregated store items
let expandedItems = new Set();
let cachedItems = [];
let cachedIngredients = [];
let cachedSuppliers = [];
let currentUser = null;
let procurementUnsubscribe = null;

export async function initProcurementMobilePage(user, category = null) {
    currentUser = user;
    selectedVendor = null;
    expandedItems.clear();

    // 既存のリスナーがあれば解除
    if (procurementUnsubscribe) {
        procurementUnsubscribe();
        procurementUnsubscribe = null;
    }

    if (category) {
        selectedCategory = category;
    }

    await showLoading(true);
    try {
        await loadInitialData();
        
        // デフォルトで「仕入れ」を選択
        if (!selectedCategory) {
            selectedCategory = 'purchase';
        }

        // CK社員の場合はデフォルトでグループ全体を選択状態にする
        if (currentStore?.store_type === 'CK') {
            currentStore = { id: 'GROUP_TOTAL', store_name: 'グループ全体' };
            selectedScope = 'group';
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
    
    // 監視対象の店舗IDリストを作成（id, store_id, code のすべてを含める）
    const storeIds = [];
    allGroupStores.forEach(s => {
        if (s.id) storeIds.push(s.id);
        if (s.store_id && !storeIds.includes(s.store_id)) storeIds.push(s.store_id);
        if (s.code && !storeIds.includes(s.code)) storeIds.push(s.code);
    });

    
    // 既存のリスナーがあれば解除
    if (procurementUnsubscribe) {
        procurementUnsubscribe();
        procurementUnsubscribe = null;
    }

    console.log("Setting up real-time listener for procurement (Group):", storeIds);
    
    return new Promise((resolve) => {
        // Firestoreの 'in' クエリは最大30件まで
        const q = query(collection(db, "m_store_items"), where("StoreID", "in", storeIds.slice(0, 30)));

        
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

function setupEventListeners() {
    const btnStore = document.getElementById('btn-scope-store');
    const btnGroup = document.getElementById('btn-scope-group');
    const btnRefresh = document.getElementById('btn-proc-refresh');

    // Business Category Tabs
    document.querySelectorAll('.cat-tab-mini').forEach(tab => {
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

    if (btnVendorSelector) {
        btnVendorSelector.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (vendorModal) {
                vendorModal.style.display = 'flex';
                renderVendorList();
            }
        };
    }

    if (btnCloseVendorModal) {
        btnCloseVendorModal.onclick = () => {
            if (vendorModal) vendorModal.style.display = 'none';
        };
    }

    if (vendorSearchInput) {
        vendorSearchInput.oninput = () => renderVendorList(vendorSearchInput.value);
    }

    const masterBatchBtn = document.getElementById('btn-master-batch-confirm');
    if (masterBatchBtn) {
        masterBatchBtn.onclick = () => executeVendorBatchAction();
    }
}

// Group-based category filtering (Exposed for ops_hub_main.js)
window.filterProcurementCategories = (mode) => {
    const nav = document.getElementById('proc-category-nav');
    if (!nav) return;

    const buyMoveCats = ['purchase', 'transfer'];
    const makeCats = ['store_prep', 'ck_prep'];
    const targetCats = mode === 'buy_move' ? buyMoveCats : makeCats;

    nav.querySelectorAll('.cat-tab').forEach(tab => {
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

function getBusinessDate(store) {
    const resetTime = store?.reset_time || "05:00";
    const now = new Date();
    const [h, m] = resetTime.split(':').map(Number);
    let cutoff = new Date(now);
    cutoff.setHours(h, m, 0, 0);
    if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);
    return cutoff.toISOString().split('T')[0];
}

function showLoading(show) {
    const el = document.getElementById('proc-loading');
    if (el) el.style.display = show ? 'flex' : 'none';
}

function renderItemRow(si, master, showStoreName = false, isInnerRow = false) {
    const store = allGroupStores.find(s => s.id === si.StoreID);
    const sName = store?.store_name || store?.Name || si.StoreID;
    const diff = Number(si.定数 || 0) - Number(si.個数 || 0);
    const req = Math.round(Math.max(0, diff));
    const sUnit = si.display_unit || master?.unit || '';
    const itemName = si.display_name || master?.name || '品目不明';
    const currentStock = Number(si.個数 || 0);

    // 移動元店舗情報の取得（移動時のみ）
    let sourceText = '';
    if (selectedCategory === 'transfer') {
        const sourceId = si.default_source_store_id;
        const sourceStore = allGroupStores.find(s => s.id === sourceId || s.store_id === sourceId || s.code === sourceId);
        const sourceStoreItem = procurementData.find(d => (d.StoreID === sourceId) && d.ProductID === si.ProductID);
        const stock = Number(sourceStoreItem?.個数 || 0);
        const sourceName = sourceStore?.store_name || sourceStore?.Name || '未設定';
        sourceText = `<span style="color:#ef4444; font-weight:800; font-size:0.7rem; background:#fff1f2; padding:1px 6px; border-radius:6px; margin-left:4px;">${sourceName} 残:${stock}</span>`;
    }

    if (isInnerRow) {
        return `
            <div class="proc-item-row inner-row" data-id="${si.id}" style="padding: 0.5rem 1rem; background: #fafafa; border-bottom: 1px solid #f1f5f9; align-items: center;">
                <div class="proc-item-info" style="display: flex; flex-direction: column; justify-content: center; gap: 2px;">
                    <div style="font-size: 0.82rem; font-weight: 800; color: #475569; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">
                        ${sName}
                    </div>
                    <div style="display: flex; align-items: center;">
                        <span class="stock-badge ${currentStock <= 0 ? 'critical' : ''}" style="background: ${currentStock <= 0 ? '#FFF1F2' : '#F1F5F9'}; color: ${currentStock <= 0 ? 'var(--primary)' : '#64748b'}; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 0.65rem; white-space: nowrap;">在庫: ${currentStock}</span>
                    </div>
                </div>
                
                <div class="proc-req-badge" style="min-width: 45px; margin-left: 4px;">
                    <span style="font-size: 1rem;">${req}</span>
                    <span style="font-size: 0.55rem; font-weight: 700; opacity: 0.8;">${sUnit}</span>
                </div>

                <div class="proc-stepper" style="margin-left: auto; gap: 2px;">
                    <button class="proc-stepper-btn btn-minus" data-si-id="${si.id}" style="width: 28px; height: 28px; font-size: 0.7rem;"><i class="fas fa-minus"></i></button>
                    <input type="number" class="proc-qty-input" value="${req}" data-si-id="${si.id}" inputmode="numeric" style="width: 32px; font-size: 1rem;">
                    <button class="proc-stepper-btn btn-plus" data-si-id="${si.id}" style="width: 28px; height: 28px; font-size: 0.7rem;"><i class="fas fa-plus"></i></button>
                </div>

                <button class="proc-confirm-btn-small btn-confirm-action" data-si-id="${si.id}">
                    <i class="fas fa-check"></i>
                </button>
            </div>
        `;
    }

    return `
        <div class="proc-item-row" data-id="${si.id}">
            <div class="proc-item-info">
                <div class="proc-item-name" data-full-name="${itemName}">
                    <div class="proc-item-name-text" style="font-weight: 800;">${itemName}</div>
                </div>
                <div class="proc-item-meta" style="margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <span class="stock-badge ${currentStock <= 0 ? 'critical' : ''}" style="background: ${currentStock <= 0 ? '#FFF1F2' : '#F1F5F9'}; color: ${currentStock <= 0 ? 'var(--primary)' : '#64748b'}; padding: 2px 10px; border-radius: 8px; font-weight: 700; font-size: 0.75rem; white-space: nowrap;">在庫: ${currentStock}</span>
                    ${sourceText}
                </div>
            </div>
            
            <div class="proc-req-badge">
                <span style="font-size: 1.1rem;">${req}</span>
                <span style="font-size: 0.6rem; font-weight: 700; opacity: 0.8;">${sUnit}</span>
                ${(() => {
                    const conv = Number(si.unit_conversion_amount || 1);
                    if (conv === 1) return '';
                    let mUnit = master?.unit || master?.単位 || '';
                    if (!mUnit) {
                        const ing = cachedIngredients.find(i => i.item_id === si.ProductID);
                        mUnit = ing?.unit || ing?.単位 || '';
                    }
                    if (!mUnit) return '';
                    return `<span style="font-size: 0.55rem; color: #64748b; font-weight: 600; margin-top: 1px;">(= ${(req * conv).toLocaleString()}${mUnit})</span>`;
                })()}
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

function render() {
    // グローバルFABを非表示にする
    const globalFab = document.getElementById('fab-main-btn');
    if (globalFab) globalFab.style.display = 'none';

    const nav = document.getElementById('proc-category-nav');
    const main = document.getElementById('proc-main-content');
    const scopeContainer = document.getElementById('proc-scope-container');
    if (!nav || !main || !scopeContainer) return;

    // 1. Update Category Tab UI
    nav.querySelectorAll('.cat-tab-mini').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.cat === (selectedCategory || ''));
    });

    // 2. Update Scope Container UI (Always use Store Selector)
    const displayName = currentStore?.id === 'GROUP_TOTAL' ? 'グループ全体' : (currentStore?.store_name || currentStore?.Name || '店舗選択');
    scopeContainer.innerHTML = `
        <div class="inventory-store-selector-bar" id="btn-proc-store-selector" style="width: 135px; flex-shrink: 0; margin: 0; background: #f8fafc; border: 1.5px solid #e2e8f0; height: 36px; border-radius: 10px;">
            <div class="selector-content" style="gap: 0.4rem;">
                <i class="fas fa-store" style="font-size: 0.75rem; color: var(--primary);"></i>
                <div class="selector-text">
                    <span class="store-name" style="font-size: 0.75rem; font-weight: 800; color: #1e293b;">${displayName}</span>
                </div>
            </div>
            <i class="fas fa-chevron-down" style="font-size: 0.65rem; color: #94a3b8;"></i>
        </div>
    `;
    const selBtn = document.getElementById('btn-proc-store-selector');
    if (selBtn) selBtn.onclick = () => showProcStoreSelectorModal();
    
    const btnHistory = document.getElementById('btn-proc-history');
    if (btnHistory) btnHistory.style.display = selectedCategory === 'transfer' ? 'block' : 'none';

    if (!selectedCategory) {
        main.innerHTML = `<div style="text-align:center; padding: 4rem; color: #94a3b8;">業務区分を選択してください</div>`;
        return;
    }

    let filteredData = procurementData;
    // 店舗が選択されている場合はフィルタリング (グループ全体以外)
    if (currentStore?.id !== 'GROUP_TOTAL') {
        filteredData = procurementData.filter(d => d.StoreID === currentStore.id);
    }

    const shortItems = filteredData.filter(si => {
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        if (par <= 0 || qty >= par) return false;
        
        const activeActions = getMobileProcItemActions(si).filter(a => !isMobileActionCompletedToday(a));
        return activeActions.some(a => mobileProcMatchesCategory(a.type, selectedCategory));
    });

    // 消費アイテム（移動画面用）
    let consumeItems = [];
    let linkedPurchaseItems = [];
    
    if (selectedCategory === 'transfer' || selectedCategory === 'purchase') {
        filteredData.forEach(si => {
            const qty = Number(si.個数 || 0);
            const par = Number(si.定数 || 0);
            if (par <= 0 || qty >= par) return;
            const shortage = par - qty;
            
            getMobileProcItemActions(si).forEach(action => {
                if (isMobileActionCompletedToday(action)) return;

                if (selectedCategory === 'transfer' && action.type === 'consume') {
                    const consumeMaster = cachedItems.find(i => i.id === action.consume_item_id);
                    const sourceItem = procurementData.find(d =>
                        d.StoreID === action.source_store_id && d.ProductID === action.consume_item_id
                    );
                    consumeItems.push({
                        parentSi: si,
                        action: action,
                        master: consumeMaster,
                        neededQty: Math.ceil(shortage * (action.consume_qty_per_unit || 1)),
                        sourceItem: sourceItem
                    });
                }
                
                if (selectedCategory === 'purchase' && action.type === 'linked_purchase') {
                    const purchaseMaster = cachedItems.find(i => i.id === action.purchase_item_id);
                    linkedPurchaseItems.push({
                        parentSi: si,
                        action: action,
                        master: purchaseMaster,
                        neededQty: Math.ceil(shortage * (action.purchase_qty_per_unit || 1))
                    });
                }
            });
        });
    }

    if (selectedCategory === 'purchase') {
        renderPurchaseContent(shortItems, linkedPurchaseItems);
    } else if (selectedCategory === 'transfer') {
        renderTransferContent(shortItems, consumeItems);
    } else {
        const vbar = document.getElementById('proc-vendor-bar'); if(vbar) vbar.style.display = 'none';
        renderMainContent(shortItems);
    }
}

function getMobileProcItemActions(si) {
    if (si.shortage_actions && si.shortage_actions.length > 0) return si.shortage_actions;
    const oldType = si.shortage_action_type || 'purchase';
    const a = { type: oldType };
    if (oldType === 'transfer' && si.default_source_store_id) a.source_store_id = si.default_source_store_id;
    return [a];
}
function mobileProcMatchesCategory(actionType, category) {
    if (actionType === category) return true;
    if (category === 'store_prep' && actionType === 'prep') return true;
    if (category === 'purchase' && actionType === 'linked_purchase') return true;
    return false;
}

/**
 * アクションが今日の営業日内ですでに完了しているかチェック
 */
function isMobileActionCompletedToday(action) {
    if (!action.completed_at) return false;
    const resetTime = currentStore?.reset_time || "05:00";
    const now = new Date();
    const update = new Date(action.completed_at);

    // 営業日の切り替わり時刻を計算
    const [h, m] = resetTime.split(':').map(Number);
    let lastReset = new Date(now);
    lastReset.setHours(h, m, 0, 0);

    if (now < lastReset) {
        lastReset.setDate(lastReset.getDate() - 1);
    }

    return update >= lastReset;
}

function renderPurchaseContent(shortItems, linkedPurchaseItems = []) {
    const vendorBar = document.getElementById('proc-vendor-bar');
    const main = document.getElementById('proc-main-content');
    
    if (vendorBar) {
        vendorBar.style.display = 'flex';
        const storeLabel = document.getElementById('secondary-store-name-label');
        if (storeLabel) storeLabel.style.display = 'none';
        
        const vendorSelector = document.getElementById('btn-vendor-selector');
        if (vendorSelector) vendorSelector.style.display = 'flex';
        const batchBtn = document.getElementById('btn-master-batch-confirm');
        if (batchBtn) {
            batchBtn.style.display = 'flex';
            batchBtn.disabled = !selectedVendor;
        }

        const label = document.getElementById('current-vendor-label');
        if (label) label.textContent = selectedVendor || '業者を選択してください';
    }

    // 業者ごとに集計（通常 + 連動）
    const vendorDataMap = {};

    shortItems.forEach(si => {
        const item = cachedItems.find(i => i.id === si.ProductID);
        const ing = cachedIngredients.find(ing => ing.item_id === si.ProductID);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        const v = sup?.vendor_name || item?.supplier_name || item?.業者名 || '未設定';
        if (!vendorDataMap[v]) vendorDataMap[v] = { regulars: [], linked: [] };
        vendorDataMap[v].regulars.push(si);
    });

    linkedPurchaseItems.forEach(lpi => {
        const item = lpi.master;
        const ing = cachedIngredients.find(ing => ing.item_id === item?.id);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        const v = sup?.vendor_name || item?.supplier_name || item?.業者名 || '未設定';
        if (!vendorDataMap[v]) vendorDataMap[v] = { regulars: [], linked: [] };
        vendorDataMap[v].linked.push(lpi);
    });

    // 業者未選択時の表示
    if (!selectedVendor) {
        if (main) {
            main.innerHTML = `
                <div style="text-align:center; padding: 5rem 2rem; color: #94a3b8;">
                    <div style="width: 80px; height: 80px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #cbd5e1;">
                        <i class="fas fa-truck-loading" style="font-size: 2.5rem;"></i>
                    </div>
                    <h3 style="font-size: 1.1rem; color: #475569; margin-bottom: 0.5rem; font-weight: 800;">業者を選択してください</h3>
                    <p style="font-size: 0.85rem; line-height: 1.5; color: #94a3b8;">
                        上の「業者を選択」から、<br>現在仕入れを行う業者を選んでください。
                    </p>
                    <button onclick="document.getElementById('btn-vendor-selector').click()" class="btn" style="margin-top: 1.5rem; background: var(--primary); color: white; border-radius: 12px; padding: 0.8rem 1.5rem; font-weight: 800; box-shadow: 0 4px 12px rgba(230, 57, 70, 0.2);">
                        業者を選択する
                    </button>
                </div>
            `;
        }
        return;
    }

    const currentVendor = vendorDataMap[selectedVendor] || { regulars: [], linked: [] };

    // 仕入れ完了時の自動リセット
    if (selectedVendor && currentVendor.regulars.length === 0 && currentVendor.linked.length === 0) {
        selectedVendor = null;
        render(); 
        return;
    }

    renderMainContent(currentVendor);
}

function renderTransferContent(items, consumeItems = []) {
    const main = document.getElementById('proc-main-content');
    if (!main) return;

    const vendorBar = document.getElementById('proc-vendor-bar');
    if (vendorBar) {
        vendorBar.style.display = 'flex';
        const storeLabel = document.getElementById('secondary-store-name-label');
        if (storeLabel) {
            storeLabel.style.display = 'block';
            storeLabel.textContent = (currentStore?.store_name || currentStore?.Name || '') + ' への移動';
        }
        const vendorSelector = document.getElementById('btn-vendor-selector');
        if (vendorSelector) vendorSelector.style.display = 'none';
        const batchBtn = document.getElementById('btn-master-batch-confirm');
        if (batchBtn) batchBtn.style.display = 'none';
    }

    if (items.length === 0 && consumeItems.length === 0) {
        main.innerHTML = `<div style="text-align:center; padding:4rem; color:var(--text-secondary);"><i class="fas fa-check-circle" style="font-size:3rem; color:#10b981; opacity:0.2;"></i><p>現在、移動・消費が必要な品目はありません</p></div>`;
        return;
    }

    // 移動元店舗ごとに品目をグループ化（通常移動 + 消費）
    const combinedBySource = {};

    items.forEach(si => {
        const sourceId = si.default_source_store_id || 'UNKNOWN';
        if (!combinedBySource[sourceId]) combinedBySource[sourceId] = { transfers: [], consumes: [] };
        combinedBySource[sourceId].transfers.push(si);
    });

    consumeItems.forEach(ci => {
        const sourceId = ci.action.source_store_id || 'UNKNOWN';
        if (!combinedBySource[sourceId]) combinedBySource[sourceId] = { transfers: [], consumes: [] };
        combinedBySource[sourceId].consumes.push(ci);
    });

    let html = '';
    Object.keys(combinedBySource).sort().forEach(sourceId => {
        const sourceStore = allGroupStores.find(s => s.id === sourceId || s.store_id === sourceId);
        const sourceName = sourceStore?.store_name || sourceStore?.Name || (sourceId === 'UNKNOWN' ? '移動元未設定' : sourceId);
        const { transfers, consumes } = combinedBySource[sourceId];
        const isExpanded = expandedItems.has(sourceId);

        html += `
            <div class="inventory-section-group ${isExpanded ? 'expanded' : ''}" style="margin-bottom:0.5rem;">
                <div class="section-header" onclick="window.toggleProcSection('${sourceId}')" style="background:#FFF5F5; border-left:4px solid var(--primary); padding:0.8rem 1rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:0.8rem;">
                        <i class="fas fa-truck" style="color:var(--primary);"></i>
                        <span style="font-size:1rem; font-weight:800; color:#1e293b;">${sourceName} から移動・消費</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                        ${transfers.length > 0 ? `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:10px; font-weight:700; font-size:0.75rem;">${transfers.length}</span>` : ''}
                        ${consumes.length > 0 ? `<span style="background:#ffedd5; color:#c2410c; padding:2px 8px; border-radius:10px; font-weight:700; font-size:0.75rem;">🔥 ${consumes.length}</span>` : ''}
                        <i class="fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="font-size:0.8rem; color:#94a3b8; margin-left:4px;"></i>
                    </div>
                </div>
                <div style="${isExpanded ? 'display:block;' : 'display:none;'} background:white;">
                    <!-- 通常移動 -->
                    ${transfers.map(si => { 
                        const master = cachedItems.find(i => i.id === si.ProductID) || cachedIngredients.find(m => m.id === si.ProductID); 
                        return renderItemRow(si, master, false); 
                    }).join('')}
                    
                    <!-- 仕込み連動消費 -->
                    ${consumes.map(ci => renderMobileConsumeRow(ci)).join('')}
                </div>
            </div>
        `;
    });

    main.innerHTML = html;
    attachMainContentListeners(main);

    // 消費完了ボタンのリスナー
    main.querySelectorAll('.btn-mobile-consume').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const uniqueKey = btn.dataset.uniqueKey;
            const ci = consumeItems.find(c => `${c.parentSi.id}_${c.action.consume_item_id}` === uniqueKey);
            if (!ci) return;
            const inputEl = main.querySelector(`.mobile-consume-qty[data-unique-key="${uniqueKey}"]`);
            const qty = Number(inputEl?.value || ci.neededQty);
            await executeMobileConsumeAction(ci, qty);
        };
    });
}

function renderMobileConsumeRow(ci) {
    const { parentSi, action, master, neededQty, sourceItem } = ci;
    const parentName = parentSi.display_name || cachedItems.find(i => i.id === parentSi.ProductID)?.name || '不明';
    const consumeName = master?.name || action.consume_item_id || '不明';
    const consumeUnit = action.consume_unit || master?.unit || '';
    const sourceStock = Number(sourceItem?.個数 || 0);
    const isLowStock = sourceStock < neededQty;
    const uniqueKey = `${parentSi.id}_${action.consume_item_id}`;

    // 移動元店舗の情報
    const sourceId = action.source_store_id;
    const sourceStore = allGroupStores.find(s => s.id === sourceId || s.store_id === sourceId || s.code === sourceId);
    const sourceName = sourceStore?.store_name || sourceStore?.Name || '未設定';

    return `
        <div class="proc-item-row" style="border-left:4px solid #f97316; background:#fffbf5;">
            <div class="proc-item-info">
                <div class="proc-item-name" style="font-weight: 800;">
                    ${consumeName}
                    <span style="font-size:0.6rem; background:#ffedd5; color:#c2410c; padding:1px 6px; border-radius:10px; font-weight:800; margin-left:4px;">🔥 消費</span>
                </div>
                <div class="proc-item-meta" style="margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <span class="stock-badge ${isLowStock ? 'critical' : ''}" style="background: ${isLowStock ? '#FFF1F2' : '#F0FDF4'}; color: ${isLowStock ? 'var(--primary)' : '#166534'}; padding: 2px 10px; border-radius: 8px; font-weight: 700; font-size: 0.75rem; white-space: nowrap;">
                        ${sourceName} 在庫: ${sourceStock}
                    </span>
                    <span style="font-size:0.65rem; color:#f97316; font-weight:700;"><i class="fas fa-link"></i> ${parentName.slice(0, 8)}...連動</span>
                </div>
            </div>
            
            <div class="proc-req-badge">
                <span style="font-size: 1.1rem; color:#c2410c;">${neededQty}</span>
                <span style="font-size: 0.6rem; font-weight: 700; opacity: 0.8;">${consumeUnit}</span>
            </div>

            <div class="proc-stepper">
                <button class="proc-stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0,Number(inp.value)-1);"><i class="fas fa-minus"></i></button>
                <input type="number" class="proc-qty-input mobile-consume-qty" value="${neededQty}" data-unique-key="${uniqueKey}" inputmode="numeric">
                <button class="proc-stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=Number(inp.value)+1;"><i class="fas fa-plus"></i></button>
            </div>

            <button class="proc-confirm-btn-small btn-mobile-consume" data-unique-key="${uniqueKey}" style="background:#f97316;">
                <i class="fas fa-check"></i>
            </button>
        </div>
    `;
}

async function executeMobileConsumeAction(ci, qty) {
    if (!ci || qty <= 0) return;
    const { action, master, sourceItem, parentSi } = ci;
    const consumeName = master?.name || action.consume_item_id || '消費品目';
    const consumeUnit = action.consume_unit || master?.unit || '';
    if (!sourceItem) { showAlert('エラー', `消費元に「${consumeName}」が登録されていません`); return; }
    const currentStock = Number(sourceItem.個数 || 0);
    const parentName = parentSi.display_name || cachedItems.find(i => i.id === parentSi.ProductID)?.name || '不明';
    if (!confirm(`「${consumeName}」 ${qty}${consumeUnit} 消費\n（${parentName}仕込み連動）\n在庫: ${currentStock} → ${currentStock - qty}`)) return;
    await showLoading(true);
    try {
        const now = new Date().toISOString();
        const newQty = currentStock - qty;
        await updateDoc(doc(db, 'm_store_items', sourceItem.id), { 個数: newQty, updated_at: now });
        await addDoc(collection(db, 't_inventory_history'), {
            store_id: sourceItem.StoreID, item_id: sourceItem.ProductID, store_item_id: sourceItem.id,
            change_qty: -qty, qty_after: newQty, reason_type: 'consume_out',
            source_route: 'procurement_mobile', note: `消費（${parentName}連動）: ${qty}${consumeUnit}`,
            executed_by: currentUser?.Name || 'unknown', executed_at: now
        });
        sourceItem.個数 = newQty;
        showAlert('完了', `「${consumeName}」${qty}${consumeUnit} 消費完了`);
        render();
    } catch (err) {
        showAlert('エラー', '消費処理に失敗: ' + err.message);
    } finally {
        await showLoading(false);
    }
}

/**
 * 店舗選択モーダルの表示
 */
function showProcStoreSelectorModal() {
    const modal = document.getElementById('proc-store-modal');
    const container = document.getElementById('proc-store-list-container');
    if (!modal || !container) return;

    let html = '';
    
    // 仕入れ・仕込みモードのみ「グループ全体」を選択肢に含める
    if (selectedCategory !== 'transfer') {
        const isGroupActive = currentStore?.id === 'GROUP_TOTAL';
        html += `
            <div class="vendor-item ${isGroupActive ? 'active' : ''}" onclick="window.selectProcStore('GROUP_TOTAL')">
                <span>グループ全体</span>
                ${isGroupActive ? '<i class="fas fa-check" style="color: var(--primary);"></i>' : ''}
            </div>
        `;
    }

    allGroupStores.forEach(s => {
        const isActive = s.id === currentStore?.id;
        html += `
            <div class="vendor-item ${isActive ? 'active' : ''}" onclick="window.selectProcStore('${s.id}')">
                <span>${s.store_name || s.Name}</span>
                ${isActive ? '<i class="fas fa-check" style="color: var(--primary);"></i>' : ''}
            </div>
        `;
    });
    container.innerHTML = html;
    modal.style.display = 'flex';

    document.getElementById('btn-close-proc-store-modal').onclick = () => {
        modal.style.display = 'none';
    };
}

window.selectProcStore = (storeId) => {
    if (storeId === 'GROUP_TOTAL') {
        currentStore = { id: 'GROUP_TOTAL', store_name: 'グループ全体' };
        selectedScope = 'group';
        const modal = document.getElementById('proc-store-modal');
        if (modal) modal.style.display = 'none';
        render();
        return;
    }

    const store = allGroupStores.find(s => s.id === storeId);
    if (store) {
        currentStore = store;
        selectedScope = 'store';
        localStorage.setItem('inventory_last_store_id', store.id);
        const modal = document.getElementById('proc-store-modal');
        if (modal) modal.style.display = 'none';
        render();
    }
};

window.toggleProcSection = (sourceId) => {
    if (expandedItems.has(sourceId)) {
        expandedItems.delete(sourceId);
    } else {
        expandedItems.clear(); // 他のアコーディオンを閉じる
        expandedItems.add(sourceId);
    }
    render();
};

function renderMainContent(data) {
    const main = document.getElementById('proc-main-content');
    if (!main) return;

    let regulars = [];
    let linked = [];
    if (Array.isArray(data)) {
        regulars = data;
    } else {
        regulars = data.regulars || [];
        linked = data.linked || [];
    }

    if (regulars.length === 0 && linked.length === 0) {
        main.innerHTML = `<div style="text-align:center; padding:4rem; color:var(--text-secondary);"><i class="fas fa-check-circle" style="font-size:3rem; color:#10b981; opacity:0.2;"></i><p>現在、対象となる品目はありません</p></div>`;
        return;
    }

    // ProductIDごとにグループ化
    const itemsByProduct = {};
    regulars.forEach(si => {
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
        
        const isExpanded = expandedItems.has(productId);
        const isSelfScope = selectedScope === 'store';

        if (isSelfScope) {
            html += renderItemRow(productItems[0], master, false, false);
        } else {
            html += `
                <div class="item-block" style="border-bottom: 1px solid var(--border);">
                    <div class="item-banner" data-id="${productId}" style="background: white; padding: 0.8rem 1rem; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer;">
                        <div class="banner-content" style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="title" style="display:flex; align-items:center; gap:0.5rem; flex: 1; min-width: 0;">
                                <i class="fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="width:1rem; font-size:0.8rem; color:#94a3b8;"></i>
                                <div class="proc-item-name-text" style="font-weight: 800; color: #1e293b;">${name}</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div style="font-size: 0.7rem; font-weight: 800; color: var(--primary); background: #fff5f5; padding: 2px 8px; border-radius: 10px; white-space: nowrap;">
                                    計 ${totalReq} ${representativeUnit}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="proc-detail-container ${isExpanded ? '' : 'hidden'}" style="display: flex; flex-direction: column; gap: 0rem;">
                        ${productItems.map(si => renderItemRow(si, master, true, true)).join('')}
                    </div>
                </div>
            `;
        }
    });

    // 連動仕入れの表示
    if (linked.length > 0) {
        html += `<div style="padding: 1rem; font-size: 0.75rem; font-weight: 800; color: #f97316; background: #fffaf0;"><i class="fas fa-link"></i> 仕込み連動・直接消費型</div>`;
        html += linked.map(lpi => renderMobileLinkedPurchaseRow(lpi)).join('');
    }

    main.innerHTML = html;
    attachMainContentListeners(main);

    // 連動仕入れボタンリスナー
    main.querySelectorAll('.btn-mobile-linked-purchase').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const uniqueKey = btn.dataset.uniqueKey;
            const lpi = linked.find(l => `${l.parentSi.id}_${l.action.purchase_item_id}` === uniqueKey);
            if (!lpi) return;
            const inputEl = main.querySelector(`.mobile-linked-qty[data-unique-key="${uniqueKey}"]`);
            const qty = Number(inputEl?.value || lpi.neededQty);
            await executeMobileLinkedPurchaseAction(lpi, qty);
        };
    });
}

function renderMobileLinkedPurchaseRow(lpi) {
    const { parentSi, action, master, neededQty } = lpi;
    const parentName = parentSi.display_name || cachedItems.find(i => i.id === parentSi.ProductID)?.name || '不明';
    const purchaseName = master?.name || action.purchase_item_id || '不明';
    const purchaseUnit = action.purchase_unit || master?.unit || '';
    const uniqueKey = `${parentSi.id}_${action.purchase_item_id}`;

    return `
        <div class="proc-item-row" style="border-left:4px solid #f97316; background:#fffaf0;">
            <div class="proc-item-info">
                <div class="proc-item-name" style="font-weight: 800;">
                    ${purchaseName}
                    <span style="font-size:0.6rem; background:#ffedd5; color:#c2410c; padding:1px 6px; border-radius:10px; font-weight:800; margin-left:4px;">🔥 仕込連動</span>
                </div>
                <div class="proc-item-meta" style="margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <span style="font-size:0.65rem; color:#f97316; font-weight:700;"><i class="fas fa-link"></i> ${parentName.slice(0, 10)}...連動</span>
                </div>
            </div>
            
            <div class="proc-req-badge">
                <span style="font-size: 1.1rem; color:#c2410c;">${neededQty}</span>
                <span style="font-size: 0.6rem; font-weight: 700; opacity: 0.8;">${purchaseUnit}</span>
            </div>
            <div class="proc-stepper">
                <button class="proc-stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0,Number(inp.value)-1);"><i class="fas fa-minus"></i></button>
                <input type="number" class="proc-qty-input mobile-linked-qty" value="${neededQty}" data-unique-key="${uniqueKey}" inputmode="numeric">
                <button class="proc-stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=Number(inp.value)+1;"><i class="fas fa-plus"></i></button>
            </div>
            <button class="proc-confirm-btn-small btn-mobile-linked-purchase" data-unique-key="${uniqueKey}" style="background:#f97316;">
                <i class="fas fa-check"></i>
            </button>
        </div>
    `;
}

async function executeMobileLinkedPurchaseAction(lpi, qty) {
    if (!lpi || qty <= 0) return;
    const { action, master, parentSi } = lpi;
    const purchaseName = master?.name || action.purchase_item_id || '仕入品目';
    const purchaseUnit = action.purchase_unit || master?.unit || '';
    const parentName = parentSi.display_name || cachedItems.find(i => i.id === parentSi.ProductID)?.name || '不明';

    if (!confirm(`「${purchaseName}」 ${qty}${purchaseUnit} 購入完了\n（${parentName}連動）\n※在庫は増えません`)) return;

    await showLoading(true);
    try {
        const now = new Date().toISOString();
        // 親アクションのステータス更新
        const parentDoc = await getDoc(doc(db, "m_store_items", parentSi.id));
        const parentData = parentDoc.data();
        if (parentData.shortage_actions) {
            const updatedActions = parentData.shortage_actions.map(a => {
                if (a.type === 'linked_purchase' && a.purchase_item_id === action.purchase_item_id) {
                    return { ...a, completed_at: now };
                }
                return a;
            });
            await updateDoc(doc(db, "m_store_items", parentSi.id), { shortage_actions: updatedActions });
        }
        // 履歴の追加
        await addDoc(collection(db, "t_inventory_history"), {
            store_id: parentSi.StoreID, item_id: action.purchase_item_id, change_qty: qty, qty_after: -1,
            reason_type: 'procurement', source_route: 'procurement_mobile',
            note: `仕込連動仕入れ: ${parentName} 連動（在庫加算なし）`,
            executed_by: currentUser?.Name || 'unknown', executed_at: now
        });
        showAlert("完了", `「${purchaseName}」購入を記録しました`);
        render();
    } catch (err) {
        showAlert("エラー", "処理に失敗: " + err.message);
    } finally {
        await showLoading(false);
    }
}

function attachMainContentListeners(container) {
    // Accordion
    container.querySelectorAll('.item-banner').forEach(banner => {
        banner.onclick = (e) => {
            e.stopPropagation();
            const id = banner.getAttribute('data-id');
            if (!id) return;
            window.toggleProcSection(id);
        };
    });

    // Batch Confirm
    // (Master button in header now handles this)
    
    // Tooltips (Click to toggle)
    container.querySelectorAll('.proc-item-name').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const isActive = el.classList.contains('tooltip-active');
            // Close all others first
            document.querySelectorAll('.proc-item-name.tooltip-active').forEach(other => {
                other.classList.remove('tooltip-active');
            });
            if (!isActive) el.classList.add('tooltip-active');
        };
    });

    // Close tooltips when clicking anywhere else
    if (!window._procTooltipListenerAdded) {
        document.addEventListener('click', () => {
            document.querySelectorAll('.proc-item-name.tooltip-active').forEach(el => {
                el.classList.remove('tooltip-active');
            });
        });
        window._procTooltipListenerAdded = true;
    }

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
    const batchBtn = document.getElementById('btn-master-batch-confirm');
    if (batchBtn) {
        const isDisabled = !selectedVendor || selectedVendor === '';
        batchBtn.disabled = isDisabled;
        // 視覚的にもはっきりと無効化されていることを伝える
        if (isDisabled) {
            batchBtn.style.background = '#e2e8f0';
            batchBtn.style.color = '#94a3b8';
        } else {
            batchBtn.style.background = 'var(--primary)';
            batchBtn.style.color = 'white';
        }
    }
}

async function executeVendorBatchAction() {
    if (!selectedVendor) {
        showAlert("警告", "業者を選択してから一括確定してください");
        return;
    }

    const filteredData = procurementData.filter(si => {
        // 仕入れカテゴリで、定数以下の品目を対象にする
        const par = Number(si.定数 || 0);
        const qty = Number(si.個数 || 0);
        const isPurchase = par > 0 && qty < par && (si.shortage_action_type || 'purchase') === 'purchase';
        if (!isPurchase) return false;

        const item = cachedItems.find(i => i.id === si.ProductID);
        const ing = cachedIngredients.find(ing => ing.item_id === si.ProductID);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        const v = sup?.vendor_name || item?.supplier_name || item?.業者名 || '未設定';
        
        return v === selectedVendor;
    });

    if (filteredData.length === 0) {
        showAlert("情報", "対象となる品目がありません");
        return;
    }

    const count = filteredData.length;
    if (!confirm(`${selectedVendor} の全${count}件を一括確定しますか？\n在庫データが更新され、リストから消えます。`)) return;

    await showLoading(true);
    try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        
        const reasonMap = { purchase: 'procurement', store_prep: 'preparation', ck_prep: 'ck_preparation' };
        const reasonType = reasonMap[selectedCategory] || 'procurement';
        const noteMap = { purchase: '業者一括仕入れ確定', store_prep: '業者一括仕込み完了', ck_prep: '業者一括CK仕込み完了' };
        const baseNote = noteMap[selectedCategory] || '業者一括更新';

        for (const si of filteredData) {
            // アコーディオンが開いている場合は入力値を取得、閉じていれば必要数を採用
            const input = document.querySelector(`.proc-qty-input[data-si-id="${si.id}"]`);
            let qty = 0;
            if (input) {
                qty = Number(input.value);
            } else {
                const diff = Number(si.定数 || 0) - Number(si.個数 || 0);
                qty = Math.round(Math.max(0, diff));
            }

            if (qty <= 0) continue;

            const oldQty = Number(si.個数 || 0);
            const newQty = oldQty + qty;
            const store = allGroupStores.find(s => s.id === si.StoreID);
            const bizDate = getBusinessDate(store);

            // 1. Update Inventory
            batch.update(doc(db, "m_store_items", si.id), {
                個数: newQty,
                updated_at: now
            });

            // 2. Add History
            const histRef = doc(collection(db, "t_inventory_history"));
            batch.set(histRef, {
                store_id: si.StoreID,
                item_id: si.ProductID,
                store_item_id: si.id,
                change_qty: qty,
                qty_after: newQty,
                reason_type: reasonType,
                source_route: 'procurement_page',
                note: `${selectedVendor}: ${baseNote}`,
                executed_by: currentUser?.Name || 'unknown',
                executed_at: now,
                business_date: bizDate
            });

            // Local update
            si.個数 = newQty;
        }

        await batch.commit();
        showAlert("完了", "一括確定を完了しました");
        render();
    } catch (err) {
        console.error("Batch action failed:", err);
        showAlert("エラー", "一括確定に失敗しました");
    } finally {
        await showLoading(false);
    }
}

async function executeTransfer(destStoreItemId, qty) {
    const destSi = procurementData.find(d => d.id === destStoreItemId);
    if (!destSi) return;

    // 移動元店舗IDを直接取得
    const sourceStoreId = destSi.default_source_store_id;
    if (!sourceStoreId) {
        showAlert("エラー", "移動元店舗が設定されていません");
        return;
    }

    const sourceSi = procurementData.find(d => 
        (d.StoreID === sourceStoreId || d.StoreID === sourceStoreId) && 
        d.ProductID === destSi.ProductID
    );

    
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

    const sourceStore = allGroupStores.find(s => s.id === sourceStoreId);
    const destStore = allGroupStores.find(s => s.id === destSi.StoreID);
    const sourceName = sourceStore?.store_name || sourceStore?.Name || sourceStoreId;
    const destName = destStore?.store_name || destStore?.Name || destSi.StoreID;

    const confirmTransfer = confirm(`移動元: ${sourceName} (${sourceDeductionQty.toFixed(2)}${sourceSi.display_unit || ''} 減少)\n移動先: ${destName} (${qty}${destSi.display_unit || ''} 増加)\n\nを実行しますか？`);
    if (!confirmTransfer) return;

    await showLoading(true);
    try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        const bizDate = getBusinessDate(destStore);

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
            note: `店舗間移動(入庫): ${sourceName} から`,
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
            note: `店舗間移動(出庫): ${destName} へ (${qty}${destSi.display_unit || ''} 分)`,
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

function renderVendorList(search = '') {
    const container = document.getElementById('vendor-list-container');
    if (!container) return;

    const filteredData = selectedScope === 'store' 
        ? procurementData.filter(d => d.StoreID === currentStore.id || d.StoreID === currentStore.store_id || d.StoreID === currentStore.code)
        : procurementData;


    const purchaseItems = filteredData.filter(si => {
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        return par > 0 && qty < par && (si.shortage_action_type || 'purchase') === 'purchase';
    });

    const vendorMap = {};
    purchaseItems.forEach(si => {
        const item = cachedItems.find(i => i.id === si.ProductID);
        const ing = cachedIngredients.find(ing => ing.item_id === si.ProductID);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        const v = sup?.vendor_name || item?.supplier_name || item?.業者名 || '未設定';
        if (!vendorMap[v]) vendorMap[v] = 0;
        vendorMap[v]++;
    });

    const vendors = Object.keys(vendorMap).sort((a,b) => {
        if (a === '未設定') return 1;
        if (b === '未設定') return -1;
        return a.localeCompare(b);
    });

    const searchLower = search.toLowerCase();
    const displayVendors = vendors.filter(v => v.toLowerCase().includes(searchLower)); // 「すべての業者」を削除

    container.innerHTML = displayVendors.map(v => {
        const isActive = selectedVendor === v;
        return `
            <div class="vendor-item ${isActive ? 'active' : ''}" onclick="selectVendor('${v}')">
                <span>${v}</span>
                <span style="font-size:0.75rem; opacity:0.6;">${vendorMap[v]} 品目</span>
                ${isActive ? '<i class="fas fa-check-circle"></i>' : ''}
            </div>
        `;
    }).join('');
    
    if (displayVendors.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:3rem; color:#94a3b8;">該当する業者はありません</div>`;
    }
}

window.selectVendor = (v) => {
    selectedVendor = v || null;
    const modal = document.getElementById('vendor-modal');
    if (modal) modal.style.display = 'none';
    render();
};

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
