import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where, orderBy, onSnapshot, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
        <aside id="proc-sidebar" class="glass-panel" style="width: 260px; display: flex; flex-direction: column; gap: 1.5rem; padding: 1.2rem; flex-shrink: 0;">
            
            <div id="proc-category-config">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">業務区分</label>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <button class="cat-btn" data-cat="purchase" style="display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem 1rem; border-radius: 10px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s; color: var(--text-secondary);">
                        <i class="fas fa-shopping-cart" style="width: 1.2rem;"></i> 仕入れ
                    </button>
                    <button class="cat-btn" data-cat="store_prep" style="display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem 1rem; border-radius: 10px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s; color: var(--text-secondary);">
                        <i class="fas fa-utensils" style="width: 1.2rem;"></i> 店舗仕込み
                    </button>
                    <button class="cat-btn" data-cat="ck_prep" style="display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem 1rem; border-radius: 10px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s; color: var(--text-secondary);">
                        <i class="fas fa-industry" style="width: 1.2rem;"></i> CK仕込み
                    </button>
                    <button class="cat-btn" data-cat="transfer" style="display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem 1rem; border-radius: 10px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s; color: var(--text-secondary);">
                        <i class="fas fa-exchange-alt" style="width: 1.2rem;"></i> 移動
                    </button>
                </div>
            </div>

            <div id="proc-scope-config">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;">表示店舗</label>
                <select id="select-proc-store" style="width: 100%; padding: 0.6rem; border-radius: 10px; border: 1px solid var(--border); font-size: 0.85rem; font-weight: 800; background: white; outline: none; cursor: pointer; color: #1e293b;">
                    <!-- Options generated dynamically -->
                </select>
            </div>


            <div id="proc-vendor-section" style="flex: 1; overflow-y: auto; display: none;">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; margin-top: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">仕入先（業者）</label>
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
                    <div id="proc-header-scope-container">
                        <span id="proc-scope-badge" class="badge" style="background: #eff6ff; color: #2563eb; font-size: 0.7rem;">自店舗</span>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <button id="btn-proc-history" class="btn btn-outline" style="display: none; padding: 0.4rem 0.8rem; font-size: 0.75rem; font-weight: 800; border-color: var(--primary); color: var(--primary);">
                        <i class="fas fa-history"></i> 移動履歴
                    </button>
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

            .cat-btn.active { background: var(--primary) !important; color: white !important; border-color: var(--primary) !important; box-shadow: var(--shadow-md); }
            .cat-btn:hover:not(.active) { background: #f8fafc; border-color: var(--primary); color: var(--primary); }

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
let selectedVendor = null;
let selectedScope = 'store'; // 'store' or 'group'
let selectedTargetStoreId = null; // Specific store ID if scope is 'store'
let selectedCategory = null; // 'purchase', 'store_prep', 'ck_prep', 'transfer'
let cachedItems = [];
let cachedIngredients = [];
let cachedSuppliers = [];
let cachedMenus = [];
let allGroupStores = [];    // Stores in the same group
let currentStore = null;    // Current user's store object
let procurementData = [];   // Aggregated store items
let collapsedItems = new Set();
let currentUser = null;
let procurementUnsubscribe = null;
let prepRequests = [];
let prepUnsubscribe = null;



export async function initProcurementPage(user, category = null) {
    currentUser = user;
    selectedVendor = null;
    collapsedItems.clear();

    if (category) {
        selectedCategory = category;
    }

    // 既存のリスナーがあれば解除
    if (procurementUnsubscribe) {
        procurementUnsubscribe();
        procurementUnsubscribe = null;
    }
    if (prepUnsubscribe) {
        prepUnsubscribe();
        prepUnsubscribe = null;
    }



    await showLoading(true);
    try {
        await loadInitialData();
        
        // デフォルトですべて畳んだ状態にする
        if (procurementData) {
            procurementData.forEach(si => {
                if (si.ProductID) collapsedItems.add(si.ProductID);
            });
        }

        // CK社員の場合はデフォルトでグループ表示にし、設定を隠す
        if (selectedCategory === 'ck_prep') {
            selectedScope = 'group';
            selectedTargetStoreId = 'GROUP_TOTAL';
        } else {
            selectedScope = 'store';
            selectedTargetStoreId = currentStore?.id || 'ALL';
        }

        setupEventListeners();
        populateStoreSelector();
        render();

    } catch (err) {
        console.error("Procurement init failed:", err);
        showAlert("エラー", `データの読み込みに失敗しました: ${err.message || '不明なエラー'}`);
    } finally {
        await showLoading(false);
    }
}

async function loadInitialData() {
    console.log("[Debug] loadInitialData starting...");
    const [storeSnap, itemSnap, ingSnap, supSnap, menuSnap] = await Promise.all([
        getDocs(collection(db, "m_stores")),
        getDocs(collection(db, "m_items")),
        getDocs(collection(db, "m_ingredients")),
        getDocs(collection(db, "m_suppliers")),
        getDocs(collection(db, "m_menus"))
    ]);

    const stores = storeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedItems = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedIngredients = ingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedSuppliers = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedMenus = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`[Debug] Data loaded. Stores:${stores.length}, Menus:${cachedMenus.length}`);

    // User's store identification
    const userStoreId = currentUser?.StoreID;
    currentStore = stores.find(s => s.id === userStoreId || s.store_id === userStoreId || s.code === userStoreId) || stores[0];
    
    // Group identification
    const gName = currentStore?.group_name || currentStore?.所属グループ || '未設定';
    allGroupStores = stores.filter(s => (s.group_name || s.所属グループ || '未設定') === gName);

    if (allGroupStores.length === 0 && currentStore) {
        allGroupStores = [currentStore];
    }
    
    console.log(`[Aggregation Debug] UserStoreID: ${userStoreId}, Group: ${gName}, StoresInGroup: ${allGroupStores.length}`);

    // 3. Load all store items for the group
    await Promise.all([refreshProcurementData(), refreshPrepRequests()]);
}

async function refreshProcurementData() {
    // 監視対象の店舗IDリストを作成（id, store_id, code のすべてを含める）
    const storeIds = [];
    allGroupStores.forEach(s => {
        if (s.id) storeIds.push(s.id);
        if (s.store_id && !storeIds.includes(s.store_id)) storeIds.push(s.store_id);
        if (s.code && !storeIds.includes(s.code)) storeIds.push(s.code);
    });

    // De-duplicate
    const uniqueIds = [...new Set(storeIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
        procurementData = [];
        return;
    }

    // 既存のリスナーがあれば解除
    if (procurementUnsubscribe) {
        procurementUnsubscribe();
        procurementUnsubscribe = null;
    }

    return new Promise((resolve) => {
        try {
            const q = query(
                collection(db, "m_store_items"), 
                where("StoreID", "in", uniqueIds.slice(0, 30))
            );
            
            let isFirstLoad = true;
            procurementUnsubscribe = onSnapshot(q, (snap) => {
                procurementData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                console.log(`[Debug] Procurement Data loaded: ${procurementData.length} items for uniqueIds:`, uniqueIds);
                if (isFirstLoad) {
                    isFirstLoad = false;
                    resolve();
                } else {
                    render();
                }
            }, (err) => {
                console.error("Procurement listener error:", err);
                resolve();
            });
        } catch (err) {
            console.error("refreshProcurementData query failed:", err);
            resolve();
        }
    });
}

async function refreshPrepRequests() {
    if (prepUnsubscribe) {
        prepUnsubscribe();
        prepUnsubscribe = null;
    }

    if (selectedCategory !== 'store_prep' && selectedCategory !== 'ck_prep') return;

    let storeIds = [];
    if (selectedCategory === 'store_prep') {
        const target = allGroupStores.find(s => s.id === selectedTargetStoreId);
        if (target) {
            if (target.id) storeIds.push(target.id);
            if (target.store_id) storeIds.push(target.store_id);
            if (target.code) storeIds.push(target.code);
        } else {
            // Fallback to current store
            if (currentStore.id) storeIds.push(currentStore.id);
            if (currentStore.store_id) storeIds.push(currentStore.store_id);
            if (currentStore.code) storeIds.push(currentStore.code);
        }
    } else {
        // CK Prep: Entire Group
        allGroupStores.forEach(s => {
            if (s.id) storeIds.push(s.id);
            if (s.store_id && !storeIds.includes(s.store_id)) storeIds.push(s.store_id);
            if (s.code && !storeIds.includes(s.code)) storeIds.push(s.code);
        });
    }

    // De-duplicate
    const uniqueIds = [...new Set(storeIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
        prepRequests = [];
        return;
    }

    return new Promise((resolve) => {
        try {
            const q = query(
                collection(db, "t_prep_requests"), 
                where("store_id", "in", uniqueIds.slice(0, 30)),
                where("status", "==", "PENDING")
            );
            
            let isFirstLoad = true;
            prepUnsubscribe = onSnapshot(q, (snap) => {
                prepRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (isFirstLoad) {
                    isFirstLoad = false;
                    resolve();
                } else {
                    render();
                }
            }, (err) => {
                console.error("Prep requests listener error:", err);
                resolve();
            });
        } catch (err) {
            console.error("refreshPrepRequests failed to query:", err);
            resolve();
        }
    });
}



function setupEventListeners() {
    const btnRefresh = document.getElementById('btn-proc-refresh');

    // Business Category Buttons
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = () => {
            selectedCategory = btn.dataset.cat;
            selectedVendor = null; // Reset vendor when category changes
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b === btn));
            
            // Show/Hide Vendor Sidebar Section (only for Purchase)
            const vendorSection = document.getElementById('proc-vendor-section');
            if (vendorSection) vendorSection.style.display = selectedCategory === 'purchase' ? 'block' : 'none';
            
            // カテゴリー切り替え時に表示設定の初期化（CK仕込みの場合は強制グループ表示）
            if (selectedCategory === 'ck_prep') {
                selectedScope = 'group';
                selectedTargetStoreId = 'GROUP_TOTAL';
            } else if (selectedTargetStoreId === 'GROUP_TOTAL' || !selectedTargetStoreId) {
                // CK仕込み以外でグループ全体になっていたら自店舗に戻す（運用上の好みによりますが一旦自店舗へ）
                selectedScope = 'store';
                selectedTargetStoreId = currentStore.id;
            }

            refreshPrepRequests();
            populateStoreSelector();
            render();
        };
    });

    if (btnRefresh) btnRefresh.onclick = async () => {
        await showLoading(true);
        await refreshProcurementData();
        await refreshPrepRequests();
        render();
        await showLoading(false);
    };

    const btnHistory = document.getElementById('btn-proc-history');
    if (btnHistory) btnHistory.onclick = showTransferHistory;
}

function populateStoreSelector() {
    const sidebarSelector = document.getElementById('select-proc-store');
    const headerContainer = document.getElementById('proc-header-scope-container');
    
    // 現在アクティブなセレクターを特定（サイドバーかヘッダーか）
    const isHeaderMode = selectedCategory !== 'purchase';
    
    // ヘッダーモードの場合はヘッダー内にセレクトボックスを作成
    if (isHeaderMode && headerContainer) {
        headerContainer.innerHTML = `
            <select id="select-proc-store-header" style="padding: 0.3rem 0.6rem; border-radius: 6px; border: 1px solid var(--border); font-size: 0.75rem; font-weight: 800; background: white; outline: none; cursor: pointer; color: #2563eb; border-color: #dbeafe;">
            </select>
        `;
    } else if (headerContainer) {
        headerContainer.innerHTML = `<span id="proc-scope-badge" class="badge" style="background: #eff6ff; color: #2563eb; font-size: 0.7rem;">自店舗</span>`;
    }

    const activeSelector = isHeaderMode ? document.getElementById('select-proc-store-header') : sidebarSelector;
    if (!activeSelector) return;

    let html = '';
    allGroupStores.forEach(s => {
        const isCurrent = s.id === selectedTargetStoreId;
        html += `<option value="${s.id}" ${isCurrent ? 'selected' : ''}>${s.store_name || s.Name}</option>`;
    });
    
    const isGroup = selectedScope === 'group' || selectedTargetStoreId === 'GROUP_TOTAL';
    html += `<option value="GROUP_TOTAL" ${isGroup ? 'selected' : ''}>グループ全体</option>`;
    
    activeSelector.innerHTML = html;
    
    activeSelector.onchange = () => {
        const val = activeSelector.value;
        if (val === 'GROUP_TOTAL') {
            selectedScope = 'group';
            selectedTargetStoreId = 'GROUP_TOTAL';
        } else {
            selectedScope = 'store';
            selectedTargetStoreId = val;
        }
        render();
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

    // Action specific labels
    const actionLabels = { purchase: '購入完了', store_prep: '仕込み完了', ck_prep: '仕込み完了', transfer: '移動完了' };
    const btnLabel = actionLabels[selectedCategory] || '完了';

    let transferUi = '';
    let locHtml = '';
    if (selectedCategory === 'transfer') {
        const sourceId = si.default_source_store_id;
        const sourceStore = allGroupStores.find(s => s.id === sourceId || s.store_id === sourceId || s.code === sourceId);
        const sourceStoreItem = procurementData.find(d => 
            (d.StoreID === sourceId) && d.ProductID === si.ProductID
        );
        const stock = Number(sourceStoreItem?.個数 || 0);
        const sourceName = sourceStore?.store_name || sourceStore?.Name || (sourceId === 'UNKNOWN' ? '未設定' : sourceId);
        const isOutOfStock = stock <= 0;

        transferUi = `
            <div style="margin-right: 1.5rem; text-align: right;">
                <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-secondary);">移動元</div>
                <div style="font-size: 0.9rem; font-weight: 800; color: #1e293b;">${sourceName}</div>
                <div style="font-size: 0.75rem; font-weight: 700; color: ${isOutOfStock ? '#ef4444' : '#059669'};">
                    残在庫: ${stock} ${sUnit}
                </div>
            </div>
        `;
        
        const sourceLoc = sourceStoreItem?.location_label || sourceStoreItem?.保管場所 || '未設定';
        locHtml = `<div style="font-size: 0.7rem; color: #64748b; margin-top: 0.1rem; font-weight: 600;"><i class="fas fa-map-marker-alt" style="font-size:0.6rem; color:#ef4444;"></i> 移動元の棚: <span style="color:#1e293b;">${sourceLoc}</span></div>`;
    }
    
    const itemName = si.display_name || master?.name || '品目不明';
    
    return `
        <div class="proc-row-card">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 150px;">
                <div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">${itemName}</div>
                    ${selectedCategory === 'transfer' ? locHtml : ''}
                    <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700; margin-top: 2px;">
                        必要: <span style="color:var(--danger); font-size: 1rem; font-family: monospace;">${req}</span> ${sUnit}
                        ${(() => {
                            const conv = Number(si.unit_conversion_amount || 1);
                            if (conv === 1) return '';
                            let mUnit = master?.unit || master?.単位 || '';
                            if (!mUnit) {
                                const ing = cachedIngredients.find(i => i.item_id === si.ProductID);
                                mUnit = ing?.unit || ing?.単位 || '';
                            }
                            if (!mUnit) return '';
                            const baseQty = (req * conv).toLocaleString();
                            return `<span style="color: #64748b; font-weight: 600; margin-left: 0.3rem;">(= ${baseQty} ${mUnit})</span>`;
                        })()}
                    </div>
                </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                ${transferUi}
                <div class="stepper-container">
                    <button class="stepper-btn btn-minus" data-si-id="${si.id}"><i class="fas fa-minus"></i></button>
                    <input type="number" step="1" class="proc-buy-input" placeholder="0" data-si-id="${si.id}" value="${req}">
                    <button class="stepper-btn btn-plus" data-si-id="${si.id}"><i class="fas fa-plus"></i></button>
                </div>
                <button class="btn btn-primary btn-confirm-action" data-si-id="${si.id}" 
                    style="padding: 0.6rem 1.2rem; font-size: 0.85rem; border-radius: 8px; font-weight: 800; min-width: 90px;">${btnLabel}</button>
            </div>
        </div>
    `;
}

function render() {
    const sidebar = document.getElementById('proc-vendor-list');
    const main = document.getElementById('proc-main-content');
    const headerTitle = document.getElementById('proc-current-title');
    if (!sidebar || !main) return;

    // Blank State
    if (!selectedCategory) {
        main.innerHTML = `
            <div style="text-align:center; padding: 6rem 2rem; color: var(--text-secondary);">
                <div style="font-size: 4rem; margin-bottom: 2rem; opacity: 0.1;">
                    <i class="fas fa-tasks"></i>
                </div>
                <h3 style="font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">業務区分を選択してください</h3>
                <p style="font-size: 0.9rem;">左側のメニューから「仕入れ」「仕込み」「移動」のいずれかを選択して開始します。</p>
            </div>
        `;
        headerTitle.textContent = '調達・供給管理ハブ';
        return;
    }

    // Update Title & Buttons
    const catNames = { purchase: '仕入れ・調達', store_prep: '店舗仕込み', ck_prep: 'CK仕込み', transfer: '店舗間移動' };
    headerTitle.textContent = catNames[selectedCategory];
    
    // カテゴリーに応じてサイドバー全体の表示/非表示を切り替える（仕入れ以外は非表示にしてメインエリアを広げる）
    const aside = document.getElementById('proc-sidebar');
    if (aside) {
        aside.style.display = (selectedCategory === 'purchase') ? 'flex' : 'none';
    }

    const vendorSection = document.getElementById('proc-vendor-section');
    if (vendorSection) vendorSection.style.display = selectedCategory === 'purchase' ? 'block' : 'none';

    const scopeConfig = document.getElementById('proc-scope-config');
    if (scopeConfig) {
        scopeConfig.style.display = (selectedCategory === 'purchase') ? 'block' : 'none';
    }

    const btnHistory = document.getElementById('btn-proc-history');
    if (btnHistory) btnHistory.style.display = selectedCategory === 'transfer' ? 'block' : 'none';

    // 店舗選択セレクターの状態を同期（サイドバー隠す場合はヘッダー側に表示）
    populateStoreSelector();

    // 1. Filter data based on scope (Selected store or all stores in group)
    let filteredData = procurementData;
    if (selectedCategory === 'ck_prep') {
        // Force group scope for CK Prep
        filteredData = procurementData;
    } else if (selectedScope === 'store' && selectedTargetStoreId) {
        const targetStore = allGroupStores.find(s => s.id === selectedTargetStoreId);
        const cId = targetStore?.id;
        const cSid = targetStore?.store_id;
        const cCode = targetStore?.code;
        filteredData = procurementData.filter(d => d.StoreID === cId || d.StoreID === cSid || d.StoreID === cCode);
    }


    // 2. Filter by Category (Shortage Action Type) and Short items
    // shortage_actions配列（新仕様）と shortage_action_type（旧仕様）の両方に対応
    const shortItems = filteredData.filter(si => {
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        if (par <= 0 || qty >= par) return false;
        
        // 完了済みのアクションを除外して、有効なアクションが残っているか
        const activeActions = getProcItemActions(si).filter(a => !isActionCompletedToday(a, currentStore));
        return activeActions.some(a => procMatchesCategory(a.type, selectedCategory));
    });

    // 消費アイテム（移動リスト用）: shortage_actions に consume が含まれる品目から生成
    let consumeItems = [];
    let linkedPurchaseItems = [];
    
    if (selectedCategory === 'transfer' || selectedCategory === 'purchase') {
        filteredData.forEach(si => {
            const qty = Number(si.個数 || 0);
            const par = Number(si.定数 || 0);
            if (par <= 0 || qty >= par) return;
            const shortage = par - qty;
            
            getProcItemActions(si).forEach(action => {
                // すでに今日完了している場合はスキップ
                if (isActionCompletedToday(action, currentStore)) return;

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

    console.log(`[Debug] render() - category:${selectedCategory}, totalData:${filteredData.length}, shortItems:${shortItems.length}, consumeItems:${consumeItems.length}, linkedPurchaseItems:${linkedPurchaseItems.length}`);

    if (selectedCategory === 'purchase') {
        renderPurchaseContent(shortItems, sidebar, linkedPurchaseItems);
    } else if (selectedCategory === 'transfer') {
        sidebar.innerHTML = `<div style="padding:1rem; font-size:0.75rem; color:var(--text-secondary);">店舗間移動モード</div>`;
        renderTransferContent(shortItems, consumeItems);
    } else {
        sidebar.innerHTML = `
            <div style="padding:1rem; display:flex; flex-direction:column; gap:1.5rem;">
                <div style="font-size:0.75rem; font-weight:800; color:var(--text-secondary); text-transform:uppercase;">仕込み戦略</div>
                <button id="btn-prep-radar" class="btn btn-outline" style="width:100%; display:flex; align-items:center; gap:0.6rem; padding:0.8rem; border-color:var(--primary); color:var(--primary); font-size:0.8rem; font-weight:800;">
                    <i class="fas fa-chart-pie"></i> 前倒し仕込み検討
                </button>
                <div style="font-size:0.7rem; color:var(--text-secondary); line-height:1.4;">
                    <i class="fas fa-info-circle"></i> 定数に余裕がある品目も、ここから前倒しで仕込み指示を出せます。
                </div>
            </div>
        `;
        renderPrepContent(shortItems);
    }
}

// --- 後方互換ヘルパー（procurement.js専用） ---
function getProcItemActions(si) {
    if (si.shortage_actions && si.shortage_actions.length > 0) return si.shortage_actions;
    const oldType = si.shortage_action_type || 'purchase';
    const a = { type: oldType };
    if (oldType === 'transfer' && si.default_source_store_id) a.source_store_id = si.default_source_store_id;
    return [a];
}
function procMatchesCategory(actionType, category) {
    if (actionType === category) return true;
    if (category === 'store_prep' && actionType === 'prep') return true;
    if (category === 'purchase' && actionType === 'linked_purchase') return true;
    return false;
}

/**
 * アクションが今日の営業日内ですでに完了しているかチェック
 */
function isActionCompletedToday(action, store) {
    if (!action.completed_at) return false;
    const resetTime = store?.reset_time || "05:00";
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


function renderPurchaseContent(shortItems, sidebar, linkedPurchaseItems = []) {
    const vendorMap = {};
    
    // 通常の仕入れ品
    shortItems.forEach(si => {
        const actions = getProcItemActions(si);
        const hasRegularPurchase = actions.some(a => a.type === 'purchase');
        if (!hasRegularPurchase) return;

        const item = cachedItems.find(i => i.id === si.ProductID);
        const ing = cachedIngredients.find(ing => ing.item_id === si.ProductID);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        
        const vendor = sup?.vendor_name || item?.supplier_name || item?.業者名 || '未設定';
        if (!vendorMap[vendor]) vendorMap[vendor] = { regulars: [], linked: [] };
        vendorMap[vendor].regulars.push(si);
    });

    // 仕込連動仕入れ品
    linkedPurchaseItems.forEach(lpi => {
        const item = lpi.master;
        const ing = cachedIngredients.find(ing => ing.item_id === item?.id);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        
        const vendor = sup?.vendor_name || item?.supplier_name || item?.業者名 || '未設定';
        if (!vendorMap[vendor]) vendorMap[vendor] = { regulars: [], linked: [] };
        vendorMap[vendor].linked.push(lpi);
    });

    const vendors = Object.keys(vendorMap).sort((a,b) => {
        if (a === '未設定') return 1;
        if (b === '未設定') return -1;
        return a.localeCompare(b);
    });

    if (!selectedVendor && vendors.length > 0) selectedVendor = vendors[0];
    
    sidebar.innerHTML = vendors.map(v => {
        const count = vendorMap[v].regulars.length + vendorMap[v].linked.length;
        return `
            <div class="vendor-item ${selectedVendor === v ? 'active' : ''}" data-vendor="${v}">
                <span>${v}</span>
                <span class="count">${count}</span>
            </div>
        `;
    }).join('') || `<div style="padding:1rem; font-size:0.75rem; color:var(--text-secondary);">不足品目はありません</div>`;

    sidebar.querySelectorAll('.vendor-item').forEach(item => {
        item.onclick = () => {
            selectedVendor = item.dataset.vendor;
            render();
        };
    });

    // 配列に平滑化して渡す
    const currentVendorData = vendorMap[selectedVendor] || { regulars: [], linked: [] };
    renderMainContent(currentVendorData);
}

function renderTransferContent(items, consumeItems = []) {
    const main = document.getElementById('proc-main-content');
    if (!main) return;

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
        const sourceStore = allGroupStores.find(s => s.id === sourceId || s.store_id === sourceId || s.code === sourceId);
        const sourceName = sourceStore?.store_name || sourceStore?.Name || (sourceId === 'UNKNOWN' ? '移動元未設定' : sourceId);
        const { transfers, consumes } = combinedBySource[sourceId];
        const totalCount = transfers.length + consumes.length;
        const isCollapsed = collapsedItems.has(sourceId);

        html += `
            <div class="item-block" style="border-bottom: 1px solid var(--border);">
                <div class="item-banner" data-id="${sourceId}" style="background: #fdf2f2; border-left: 4px solid #ef4444;">
                    <div class="banner-content">
                        <div class="title">
                            <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" style="width:1rem; font-size:0.8rem; color:var(--text-secondary);"></i>
                            <i class="fas fa-truck" style="color:#ef4444;"></i>
                            ${sourceName} から移動・消費
                        </div>
                        <div style="display:flex; gap:0.4rem;">
                            ${transfers.length > 0 ? `<div class="total-req" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;">移動 ${transfers.length}</div>` : ''}
                            ${consumes.length > 0 ? `<div class="total-req" style="background:#ffedd5; color:#c2410c; border-color:#fdba74;">🔥 消費 ${consumes.length}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div class="proc-detail-container ${isCollapsed ? 'hidden' : ''}" style="background:#fffafa;">
                    <!-- 通常移動品目 -->
                    ${transfers.map(si => { 
                        const master = cachedItems.find(i => i.id === si.ProductID); 
                        return renderItemRow(si, master, true); 
                    }).join('')}
                    
                    <!-- 仕込み連動消費品目（背景色で区別） -->
                    ${consumes.map(ci => renderConsumeRow(ci)).join('')}
                </div>
            </div>
        `;
    });

    main.innerHTML = html;
    attachMainContentListeners(main);

    // 消費完了ボタンのリスナー
    main.querySelectorAll('.btn-confirm-consume').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const uniqueKey = btn.dataset.uniqueKey;
            const ci = consumeItems.find(c => `${c.parentSi.id}_${c.action.consume_item_id}` === uniqueKey);
            if (!ci) return;
            const inputEl = main.querySelector(`.proc-consume-qty-input[data-unique-key="${uniqueKey}"]`);
            const qty = Number(inputEl?.value || ci.neededQty);
            await executeConsumeAction(ci, qty);
        };
    });
}

function renderConsumeRow(ci) {
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
    const sourceName = sourceStore?.store_name || sourceStore?.Name || (sourceId === 'UNKNOWN' ? '未設定' : sourceId);
    const sourceLoc = sourceItem?.location_label || sourceItem?.保管場所 || '未設定';

    return `
        <div class="proc-row-card" style="background:#fffbf5; border-left:4px solid #f97316;">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 150px;">
                <div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">
                        ${consumeName}
                        <span style="font-size:0.65rem; background:#ffedd5; color:#c2410c; padding:2px 8px; border-radius:20px; font-weight:800; margin-left:0.5rem; vertical-align:middle;">🔥 仕込み連動</span>
                    </div>
                    <div style="font-size: 0.7rem; color: #f97316; font-weight: 700; margin-top: 2px;">
                        <i class="fas fa-link"></i> ${parentName} の不足に連動
                    </div>
                    <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.1rem; font-weight: 600;">
                        <i class="fas fa-map-marker-alt" style="font-size:0.6rem; color:#f97316;"></i> 移動元の棚: <span style="color:#1e293b;">${sourceLoc}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700; margin-top: 2px;">
                        消費量: <span style="color:#c2410c; font-size: 1rem; font-family: monospace;">${neededQty}</span> ${consumeUnit}
                    </div>
                </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <div style="margin-right: 1.5rem; text-align: right;">
                    <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-secondary);">消費元</div>
                    <div style="font-size: 0.9rem; font-weight: 800; color: #1e293b;">${sourceName}</div>
                    <div style="font-size: 0.75rem; font-weight: 700; color: ${isLowStock ? '#ef4444' : '#059669'};">
                        残在庫: ${sourceStock} ${consumeUnit}
                    </div>
                    ${isLowStock ? '<div style="color:#ef4444; font-size: 0.65rem; font-weight: 800; margin-top: 2px;">⚠ 在庫不足</div>' : ''}
                </div>
                <div class="stepper-container">
                    <button class="stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0,Number(inp.value)-1);"><i class="fas fa-minus"></i></button>
                    <input type="number" class="proc-buy-input proc-consume-qty-input" data-unique-key="${uniqueKey}" value="${neededQty}" style="width:50px;">
                    <button class="stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=Number(inp.value)+1;"><i class="fas fa-plus"></i></button>
                </div>
                <button class="btn btn-primary btn-confirm-consume" data-unique-key="${uniqueKey}"
                    style="padding: 0.6rem 1.2rem; font-size: 0.85rem; border-radius: 8px; font-weight: 800; background:#f97316; border:none; min-width: 90px;">消費完了</button>
            </div>
        </div>
    `;
}

function renderMainContent(data) {
    const main = document.getElementById('proc-main-content');
    if (!main) return;

    // data が配列（通常）か、オブジェクト（仕入れ時の regulars/linked）かを判定
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

    // ProductIDごとにグループ化（集計表示用）
    const itemsByProduct = {};
    regulars.forEach(si => {
        if (!itemsByProduct[si.ProductID]) itemsByProduct[si.ProductID] = [];
        itemsByProduct[si.ProductID].push(si);
    });

    let html = ``;

    // 1. 通常の仕入れ品を表示
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
                    <div class="item-banner" data-id="${productId}">
                        <div class="banner-content">
                            <div class="title">
                                <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" style="width:1rem; font-size:0.8rem; color:var(--text-secondary);"></i>
                                <span style="font-weight:800; color:var(--text-primary); margin-left:0.5rem;">${name}</span>
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

    // 2. 仕込連動仕入れ品を表示（仕入れ画面のみ）
    if (linked.length > 0) {
        if (html) html += `<div style="padding: 1.5rem 1rem 0.5rem; font-size: 0.75rem; font-weight: 800; color: #f97316; border-top: 2px solid #fff7ed; background: #fffaf0; display:flex; align-items:center; gap:0.5rem;"><i class="fas fa-link"></i> 仕込み連動・直接消費型</div>`;
        html += linked.map(lpi => renderLinkedPurchaseRow(lpi)).join('');
    }

    main.innerHTML = html;
    attachMainContentListeners(main);

    // 連動仕入れ完了ボタンのリスナー
    main.querySelectorAll('.btn-confirm-linked-purchase').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const uniqueKey = btn.dataset.uniqueKey;
            const lpi = linked.find(l => `${l.parentSi.id}_${l.action.purchase_item_id}` === uniqueKey);
            if (!lpi) return;
            const inputEl = main.querySelector(`.proc-linked-qty-input[data-unique-key="${uniqueKey}"]`);
            const qty = Number(inputEl?.value || lpi.neededQty);
            await executeLinkedPurchaseAction(lpi, qty);
        };
    });
}

function renderLinkedPurchaseRow(lpi) {
    const { parentSi, action, master, neededQty } = lpi;
    const parentName = parentSi.display_name || cachedItems.find(i => i.id === parentSi.ProductID)?.name || '不明';
    const purchaseName = master?.name || action.purchase_item_id || '不明';
    const purchaseUnit = action.purchase_unit || master?.unit || '';
    const uniqueKey = `${parentSi.id}_${action.purchase_item_id}`;

    return `
        <div class="proc-row-card" style="background:#fffaf0; border-left:4px solid #f97316;">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 150px;">
                <div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">
                        ${purchaseName}
                        <span style="font-size:0.65rem; background:#ffedd5; color:#c2410c; padding:2px 8px; border-radius:20px; font-weight:800; margin-left:0.5rem; vertical-align:middle;">🔥 仕込連動</span>
                    </div>
                    <div style="font-size: 0.7rem; color: #f97316; font-weight: 700; margin-top: 2px;">
                        <i class="fas fa-link"></i> ${parentName} の不足に連動（在庫には加算されません）
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700; margin-top: 2px;">
                        必要量: <span style="color:#c2410c; font-size: 1rem; font-family: monospace;">${neededQty}</span> ${purchaseUnit}
                    </div>
                </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <div class="stepper-container">
                    <button class="stepper-btn" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0,Number(inp.value)-1);"><i class="fas fa-minus"></i></button>
                    <input type="number" class="proc-buy-input proc-linked-qty-input" data-unique-key="${uniqueKey}" value="${neededQty}" style="width:50px;">
                    <button class="stepper-btn" onclick="const inp=this.previousElementSibling; inp.value=Number(inp.value)+1;"><i class="fas fa-plus"></i></button>
                </div>
                <button class="btn btn-primary btn-confirm-linked-purchase" data-unique-key="${uniqueKey}"
                    style="padding: 0.6rem 1.2rem; font-size: 0.85rem; border-radius: 8px; font-weight: 800; background:#f97316; border:none; min-width: 90px;">購入完了</button>
            </div>
        </div>
    `;
}

async function executeLinkedPurchaseAction(lpi, qty) {
    if (!lpi || qty <= 0) return;
    const { action, master, parentSi } = lpi;
    const purchaseName = master?.name || action.purchase_item_id || '仕入品目';
    const purchaseUnit = action.purchase_unit || master?.unit || '';
    const parentName = parentSi.display_name || cachedItems.find(i => i.id === parentSi.ProductID)?.name || '不明';

    if (!confirm(`「${purchaseName}」を ${qty}${purchaseUnit} 購入完了にしますか？\n（${parentName} の仕込連動）\n\n※この品目は直接消費されるため、在庫数は増えません。`)) return;

    await showLoading(true);
    try {
        const now = new Date().toISOString();
        const bizDate = getBusinessDate(allGroupStores.find(s => s.id === parentSi.StoreID));

        // 1. Update status in parent action
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

        // 2. Add History (Increments are NOT done, but we record the purchase)
        await addDoc(collection(db, "t_inventory_history"), {
            store_id: parentSi.StoreID,
            item_id: action.purchase_item_id,
            change_qty: qty,
            qty_after: -1, // Special flag or current stock (but not updated)
            reason_type: 'procurement',
            source_route: 'procurement_page',
            note: `仕込連動仕入れ: ${parentName} の不足分（直接消費のため在庫加算なし）`,
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            business_date: bizDate
        });

        showAlert("完了", `「${purchaseName}」の購入を記録しました。`);
        render();
    } catch (err) {
        console.error("Linked purchase action failed:", err);
        showAlert("エラー", "処理に失敗しました: " + err.message);
    } finally {
        await showLoading(false);
    }
}

function renderPrepContent(shortItems) {
    const main = document.getElementById('proc-main-content');
    if (!main) return;

    // Explicitly define local isCK to override global fallback
    const isCK = selectedCategory === 'ck_prep';
    window.isCK = isCK; 
    
    const isFullWidth = selectedCategory === 'ck_prep' || selectedCategory === 'store_prep';
    const splitRatio = isFullWidth ? '3fr 1fr' : '1.2fr 1fr';
    const gridCols = isFullWidth ? '1fr 1fr 1fr' : '1fr 1fr';
    const gridSpan = isFullWidth ? 3 : 2;

    // --- Aggregation Logic (for CK) ---
    let displayAutoItems = [];
    if (selectedCategory === 'ck_prep') {
        const groups = {};
        shortItems.forEach(si => {
            const pid = si.ProductID || si.productId;
            if (!groups[pid]) groups[pid] = [];
            groups[pid].push(si);
        });
        displayAutoItems = Object.keys(groups).map(pid => {
            const items = groups[pid];
            if (items.length <= 1) return { ...items[0], ProductID: pid, isAggregated: false };
            const total = items.reduce((sum, si) => sum + Math.round(Math.max(0, (si.定数 || 0) - (si.個数 || 0))), 0);
            return { 
                ProductID: pid, 
                totalReq: total, 
                storeItems: items, 
                isAggregated: true, 
                display_unit: items[0].display_unit,
                unit_conversion_amount: items[0].unit_conversion_amount // 代表値として最初の店舗の設定を使用
            };
        });
    } else {
        displayAutoItems = shortItems.map(si => ({ ...si, isAggregated: false }));
    }

    let displayManualItems = [];
    if (selectedCategory === 'ck_prep') {
        const groups = {};
        prepRequests.forEach(req => {
            const pid = req.item_id || req.productId;
            if (!groups[pid]) groups[pid] = [];
            groups[pid].push(req);
        });
        displayManualItems = Object.keys(groups).map(pid => {
            const reqs = groups[pid];
            if (reqs.length <= 1) return { ...reqs[0], ProductID: pid, isAggregated: false };
            const total = reqs.reduce((sum, r) => sum + Number(r.requested_qty || 0), 0);
            
            // 手動依頼の場合、その品目のマスター設定から換算係数を探す
            const masterSi = procurementData.find(d => d.ProductID === pid);

            return { 
                ProductID: pid, 
                totalReq: total, 
                requests: reqs, 
                isAggregated: true, 
                item_name: reqs[0].item_name, 
                unit: reqs[0].unit,
                unit_conversion_amount: masterSi?.unit_conversion_amount || 1
            };
        });
    } else {
        displayManualItems = prepRequests.map(req => ({ ...req, isAggregated: false }));
    }
    // ----------------------------------

    main.innerHTML = `
        <div style="display: grid; grid-template-columns: ${splitRatio}; height: 100%; overflow: hidden;">
            <!-- Left: Auto Alerts -->
            <div id="prep-auto-list" style="border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden;">
                <div style="padding: 0.8rem 1.2rem; background: #fef2f2; border-bottom: 1px solid #fee2e2; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #b91c1c;"><i class="fas fa-robot"></i> 不足品目 (自動判定)</span>
                        ${isCK ? `<span style="font-size: 0.6rem; color: #ef4444; font-weight: 700;">集計対象: ${allGroupStores.length} 店舗</span>` : ''}
                    </div>
                    <span class="badge" style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem;">${displayAutoItems.length}</span>
                </div>
                <div class="prep-scroll-area" style="flex: 1; overflow-y: auto; padding: 0.6rem; display: grid; grid-template-columns: ${gridCols}; gap: 0.6rem; align-content: start;">
                    ${displayAutoItems.map(item => {
                        const pid = item.ProductID || item.item_id;
                        const master = cachedItems.find(i => i.id === pid);
                        return renderPrepRow(item, master, 'auto');
                    }).join('') || `<div style="grid-column: span ${gridSpan}; text-align:center; padding:3rem; color:#94a3b8; font-size:0.8rem;">現在、不足している品目はありません</div>`}
                </div>
            </div>
            
            <div id="prep-manual-list" style="display: flex; flex-direction: column; overflow: hidden; background: #fafafa;">
                <div style="padding: 0.8rem 1.2rem; background: #f0fdf4; border-bottom: 1px solid #dcfce7; display: flex; flex-direction: column; gap: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #166534;"><i class="fas fa-hand-paper"></i> 追加仕込み (手動/依頼)</span>
                        <span class="badge" style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem;">${displayManualItems.length}</span>
                    </div>
                    
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;"></i>
                        <input type="text" id="prep-search-input" placeholder="品名を検索して追加..." 
                            style="width: 100%; padding: 0.5rem 0.5rem 0.5rem 2rem; border-radius: 8px; border: 1px solid #dcfce7; font-size: 0.8rem; font-weight: 700; outline: none;">
                        <div id="prep-search-results" class="glass-panel" style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 100; max-height: 300px; overflow-y: auto; margin-top: 5px; padding: 0.5rem; background: white; border: 1px solid var(--border); box-shadow: var(--shadow-md);"></div>
                    </div>
                </div>
                <div class="prep-scroll-area" style="flex: 1; overflow-y: auto; padding: 0.6rem;">
                    ${displayManualItems.map(item => {
                        const pid = item.isAggregated ? item.productId : item.item_id;
                        const master = cachedItems.find(i => i.id === pid);
                        return renderPrepRow(item, master, 'manual');
                    }).join('') || '<div style="text-align:center; padding:3rem; color:#94a3b8; font-size:0.8rem;">追加の仕込み指示はありません</div>'}
                </div>
            </div>
        </div>
    `;
    attachPrepListeners(main);
}

function renderPrepRow(data, master, type = 'auto') {
    const isManual = type === 'manual';
    const isAggregated = data.isAggregated;
    
    const name = isAggregated ? (master?.name || data.productId) : (isManual ? data.item_name : (data.display_name || master?.name || '品目不明'));
    const unit = isAggregated ? (data.display_unit || data.unit || master?.unit || '') : (isManual ? data.unit : (data.display_unit || master?.unit || ''));
    
    const reqQty = isAggregated ? data.totalReq : (isManual ? data.requested_qty : Math.round(Math.max(0, (data.定数 || 0) - (data.個数 || 0))));

    const tagHtml = isManual && !isAggregated ? `<span style="font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; background: ${data.request_type === 'CK_CHOICE' ? '#dcfce7' : '#fef9c3'}; color: ${data.request_type === 'CK_CHOICE' ? '#166534' : '#854d0e'}; font-weight: 800; margin-left: 0.5rem;">${data.request_type === 'CK_CHOICE' ? 'CK判断' : '夜勤依頼'}</span>` : '';
    const aggregateBadge = isAggregated ? `<span style="font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; background: #eff6ff; color: #1e40af; font-weight: 800; margin-left: 0.5rem;"><i class="fas fa-layer-group"></i> ${isManual ? data.requests.length : data.storeItems.length}店舗分</span>` : '';

    return `
        <div class="prep-row" style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.6rem 0.8rem; border-radius: 10px; border: 1px solid var(--border); background: white; box-shadow: var(--shadow-sm); transition: all 0.2s; position: relative;">
            ${isManual && !isAggregated ? `
                <button class="btn-delete-prep" data-id="${data.id}" style="position: absolute; top: 4px; right: 4px; background: none; border: none; padding: 2px; cursor: pointer; color: #cbd5e1; font-size: 0.75rem; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'">
                    <i class="fas fa-times"></i>
                </button>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.4rem; padding-right: ${isManual && !isAggregated ? '14px' : '0'};">
                <div style="font-weight: 800; font-size: 0.8rem; color: #1e293b; line-height: 1.2; word-break: break-all; flex: 1;">
                    ${name}${tagHtml}${aggregateBadge}
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 800; white-space: nowrap; text-align: right; padding-top: 2px;">
                    計: <span style="color: ${isManual ? '#10b981' : '#ef4444'}; font-size: 0.85rem;">${reqQty}</span> ${unit}
                    ${(() => {
                        const conv = Number(data.unit_conversion_amount || 1);
                        if (conv === 1) return '';
                        
                        let mUnit = master?.unit || master?.単位 || '';
                        if (!mUnit) {
                            const ing = cachedIngredients.find(i => i.item_id === (master?.id || data.ProductID || data.productId));
                            mUnit = ing?.unit || ing?.単位 || '';
                        }
                        if (!mUnit) return '';
                        
                        return `<div style="font-size: 0.6rem; color: #94a3b8; font-weight: 600; margin-top: 1px;">(= ${(reqQty * conv).toLocaleString()} ${mUnit})</div>`;
                    })()}
                </div>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; border-top: 1px solid #f1f5f9; padding-top: 0.4rem;">
                ${isAggregated ? `
                    <div style="display: flex; gap: 0.4rem; width: 100%;">
                        <button class="btn btn-outline btn-show-breakdown" data-pid="${master?.id || data.productId}" data-type="${type}"
                            style="flex: 1; padding: 0.4rem; font-size: 0.72rem; border-radius: 6px; font-weight: 800; color: #2563eb; border-color: #dbeafe; background: #f8fafc;">
                            <i class="fas fa-list-ul"></i> 内訳・個別反映
                        </button>
                        ${cachedMenus.some(m => m.item_id === (master?.id || data.productId)) ? `
                            <button class="btn btn-outline btn-quick-recipe" data-pid="${master?.id || data.productId}" 
                                style="padding: 0.4rem 0.6rem; font-size: 0.72rem; border-radius: 6px; border-color: #dbeafe; color: #2563eb; background: #eff6ff;">
                                <i class="fas fa-mortar-pestle"></i>
                            </button>
                        ` : ''}
                    </div>
                ` : `
                    <div class="stepper-container" style="padding: 1px; transform: scale(0.95); transform-origin: left;">
                        <button class="stepper-btn btn-minus" style="width:24px; height:24px; font-size:0.7rem;" data-id="${data.id}" data-type="${type}"><i class="fas fa-minus"></i></button>
                        <input type="number" class="prep-qty-input" data-id="${data.id}" data-type="${type}" value="${reqQty}" 
                            style="width: 34px; border: none; background: transparent; text-align: center; font-weight: 800; font-size: 0.85rem; color: var(--primary); outline: none;">
                        <button class="stepper-btn btn-plus" style="width:24px; height:24px; font-size:0.7rem;" data-id="${data.id}" data-type="${type}"><i class="fas fa-plus"></i></button>
                    </div>
                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                        ${cachedMenus.some(m => m.item_id === (master?.id || data.productId)) ? `
                            <button class="btn btn-outline btn-quick-recipe" data-pid="${master?.id || data.productId}" 
                                style="padding: 0.35rem 0.5rem; font-size: 0.72rem; border-radius: 6px; border-color: #dbeafe; color: #2563eb; background: #eff6ff;">
                                <i class="fas fa-mortar-pestle"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-primary btn-confirm-prep" data-id="${data.id}" data-type="${type}"
                            style="padding: 0.35rem 0.6rem; font-size: 0.72rem; border-radius: 6px; font-weight: 800; white-space: nowrap;">仕込み完了</button>
                    </div>
                `}
            </div>
        </div>
    `;
}

function attachPrepListeners(container) {
    // Breakdown Buttons (Aggregated only)
    container.querySelectorAll('.btn-show-breakdown').forEach(btn => {
        btn.onclick = () => {
            const pid = btn.dataset.pid;
            const type = btn.dataset.type;
            showPrepBreakdownModal(pid, type);
        };
    });

    // Quick Recipe Buttons
    container.querySelectorAll('.btn-quick-recipe').forEach(btn => {
        btn.onclick = () => {
            const pid = btn.dataset.pid;
            showQuickRecipeModal(pid);
        };
    });
    // Steppers
    container.querySelectorAll('.stepper-btn').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            const input = container.querySelector(`.prep-qty-input[data-id="${id}"][data-type="${type}"]`);
            if (!input) return;
            let val = parseInt(input.value) || 0;
            if (btn.classList.contains('btn-plus')) val++;
            else val = Math.max(0, val - 1);
            input.value = val;
        };
    });

    // Confirm Buttons
    container.querySelectorAll('.btn-confirm-prep').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            const input = container.querySelector(`.prep-qty-input[data-id="${id}"][data-type="${type}"]`);
            const qty = Number(input.value);
            if (qty <= 0) return;

            // Get name for message
            const row = btn.closest('.prep-row');
            const name = row?.querySelector('div[style*="font-weight: 800"]')?.textContent.split('\n')[0].trim() || 'この品目';

            showConfirm('仕込み完了', `${name} を ${qty} 個（または単位）で仕込み完了として反映しますか？`, async () => {
                await executePrepAction(id, type, qty);
            });
        };
    });

    // Delete Buttons (Manual Requests)
    container.querySelectorAll('.btn-delete-prep').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const confirmed = confirm("この仕込み依頼を削除しますか？");
            if (confirmed) {
                await deletePrepRequest(id);
            }
        };
    });

    // Search Input
    const searchInput = document.getElementById('prep-search-input');
    const resultsArea = document.getElementById('prep-search-results');
    if (searchInput && resultsArea) {
        searchInput.oninput = () => {
            const val = searchInput.value.toLowerCase().trim();
            if (!val) {
                resultsArea.style.display = 'none';
                return;
            }

    // Filter procurementData for target store and current category (store_prep/ck_prep)
    const targetId = (selectedCategory === 'ck_prep') ? 'GROUP_TOTAL' : selectedTargetStoreId;
    
    const prepCapableItems = procurementData.filter(d => {
        const matchesStore = (targetId === 'GROUP_TOTAL') || (d.StoreID === targetId || d.StoreID === allGroupStores.find(s=>s.id===targetId)?.code || d.StoreID === allGroupStores.find(s=>s.id===targetId)?.store_id);
        const action = d.shortage_action_type || 'purchase';
        const matchesCategory = (action === selectedCategory) || (selectedCategory === 'store_prep' && action === 'prep');
        return matchesStore && matchesCategory;
    });


            const matches = prepCapableItems.map(si => {
                const master = cachedItems.find(i => i.id === si.ProductID);
                return { si, master };
            }).filter(m => {
                const name = m.si.display_name || m.master?.name || '';
                const kana = m.master?.kana || '';
                return name.toLowerCase().includes(val) || kana.includes(val);
            }).slice(0, 10);

            if (matches.length === 0) {
                resultsArea.innerHTML = `<div style="padding:0.8rem; font-size:0.75rem; color:#94a3b8; text-align:center;">
                    <i class="fas fa-exclamation-circle"></i> "${selectedCategory === 'store_prep' ? '店舗仕込み' : 'CK仕込み'}" に設定された品目が見つかりません
                </div>`;
            } else {
                resultsArea.innerHTML = matches.map(m => {
                    const qty = Number(m.si.個数 || 0);
                    const par = Number(m.si.定数 || 0);
                    const name = m.si.display_name || m.master?.name || '不明';
                    return `
                        <div class="search-result-item" data-id="${m.si.ProductID}" style="padding:0.8rem; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.2s;">
                            <div style="flex:1;">
                                <div style="font-weight:800; font-size:0.85rem; color:#334155;">${name}</div>
                                <div style="font-size:0.7rem; color:#94a3b8;">${m.si.display_unit || m.master?.unit || ''}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:0.75rem; font-weight:700; color:${qty < par ? '#ef4444' : '#64748b'};">残: ${qty} / ${par}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                resultsArea.querySelectorAll('.search-result-item').forEach(item => {
                    item.onclick = () => {
                        const mid = item.dataset.id;
                        addPrepRequest(mid);
                        searchInput.value = '';
                        resultsArea.style.display = 'none';
                    };
                });
            }
            resultsArea.style.display = 'block';
        };
    }

    // Radar Button
    const btnRadar = document.getElementById('btn-prep-radar');
    if (btnRadar) btnRadar.onclick = showPrepRadar;
}

async function showPrepBreakdownModal(productId, type) {
    const master = cachedItems.find(i => i.id === productId);
    
    // 集計対象の店舗データを抽出
    let targets = [];
    if (type === 'auto') {
        targets = procurementData.filter(d => d.ProductID === productId && (d.定数 || 0) > (d.個数 || 0));
    } else {
        targets = prepRequests.filter(r => r.item_id === productId);
    }
    
    // 単位を取得（店舗設定があればそれを優先）
    const unit = targets[0]?.display_unit || targets[0]?.unit || master?.unit || '';

    const modalHtml = `
        <div id="prep-breakdown-modal" class="modal-overlay active" style="z-index: 10000; position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px);">
            <div class="glass-panel" style="width: 90%; max-width: 500px; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column; padding: 0; background: white; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.2);">
                <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                    <div>
                        <h3 style="margin:0; font-weight: 800; font-size: 1.1rem; color: #1e293b;">${master?.name || productId}</h3>
                        <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; margin-top: 2px;">店舗別 内訳・個別反映</div>
                    </div>
                    <button onclick="document.getElementById('prep-breakdown-modal').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color: #94a3b8;">&times;</button>
                </div>
                
                <div style="flex:1; overflow-y:auto; padding: 1.2rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                        ${targets.map((t, idx) => {
                            const store = allGroupStores.find(s => s.id === t.StoreID || s.id === t.store_id || s.code === t.StoreID || s.store_id === t.StoreID);
                            const storeName = store?.store_name || store?.Name || t.StoreID || t.store_id || '店舗不明';
                            
                            let currentQty = 0;
                            let parQty = 0;
                            let defaultInput = 0;
                            let targetId = '';

                            if (type === 'auto') {
                                currentQty = Number(t.個数 || 0);
                                parQty = Number(t.定数 || 0);
                                defaultInput = Math.round(Math.max(0, parQty - currentQty));
                                targetId = t.id; // m_store_items.id
                            } else {
                                // Manual requests: look up inventory for stock info
                                const si = procurementData.find(d => d.ProductID === productId && (d.StoreID === t.store_id || d.StoreID === store?.id));
                                currentQty = Number(si?.個数 || 0);
                                parQty = Number(si?.定数 || 0);
                                defaultInput = Number(t.requested_qty || 0);
                                targetId = t.id; // t_prep_requests.id
                            }

                            return `
                                <div style="padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-weight: 800; font-size: 0.85rem; color: #1e293b;">${storeName}</div>
                                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; margin-top: 4px;">
                                            現在庫: ${currentQty} / 定数: ${parQty}
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <div class="stepper-container" style="display: flex; align-items: center; background: white; border: 2px solid #cbd5e1; border-radius: 8px; padding: 2px;">
                                            <button class="modal-stepper-btn minus" style="width: 28px; height: 28px; border: none; background: #f1f5f9; border-radius: 4px; cursor: pointer; color: #64748b; font-size: 0.8rem;"><i class="fas fa-minus"></i></button>
                                            <input type="number" class="breakdown-input" 
                                                data-target-id="${targetId}" 
                                                data-store-id="${store?.id || t.StoreID || t.store_id}" 
                                                value="${defaultInput}" 
                                                style="width: 50px; height: 28px; text-align: center; border: none; background: transparent; font-weight: 800; font-size: 1rem; color: var(--primary); outline: none;">
                                            <button class="modal-stepper-btn plus" style="width: 28px; height: 28px; border: none; background: #f1f5f9; border-radius: 4px; cursor: pointer; color: #64748b; font-size: 0.8rem;"><i class="fas fa-plus"></i></button>
                                        </div>
                                        <span style="font-size: 0.75rem; font-weight: 800; color: #64748b;">${unit}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div style="padding: 1.2rem; border-top: 1px solid var(--border); background: #f8fafc; display: flex; gap: 0.8rem;">
                    <button onclick="document.getElementById('prep-breakdown-modal').remove()" class="btn btn-outline" style="flex: 1; border-radius: 12px; font-weight: 800;">キャンセル</button>
                    <button id="btn-confirm-batch-prep" class="btn btn-primary" style="flex: 2; border-radius: 12px; font-weight: 800; box-shadow: 0 10px 20px rgba(230, 57, 70, 0.2);">
                        <i class="fas fa-check-double"></i> 一括確定・反映
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add Stepper Listeners
    const modal = document.getElementById('prep-breakdown-modal');
    modal.querySelectorAll('.modal-stepper-btn').forEach(btn => {
        btn.onclick = () => {
            const inp = btn.parentElement.querySelector('input');
            let v = Number(inp.value);
            if (btn.classList.contains('minus')) v = Math.max(0, v - 1);
            else v = v + 1;
            inp.value = v;
        };
    });

    document.getElementById('btn-confirm-batch-prep').onclick = async () => {
        const inputs = document.querySelectorAll('.breakdown-input');
        const updates = Array.from(inputs).map(inp => ({
            id: inp.dataset.targetId,
            storeId: inp.dataset.storeId,
            qty: Number(inp.value)
        })).filter(u => u.qty > 0);

        if (updates.length === 0) return;

        showConfirm('一括確定', `${updates.length} 店舗分をまとめて確定・反映しますか？`, async () => {
            document.getElementById('prep-breakdown-modal').remove();
            await executeBatchPrepAction(productId, type, updates);
        });
    };
}

async function executeBatchPrepAction(productId, type, updates) {
    await showLoading(true);
    try {
        const { writeBatch } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        
        for (const u of updates) {
            let si = null;
            let requestId = null;

            if (type === 'manual') {
                requestId = u.id;
                si = procurementData.find(d => d.ProductID === productId && d.StoreID === u.storeId);
            } else {
                si = procurementData.find(d => d.id === u.id);
            }

            if (!si) continue;

            const bizDate = getBusinessDate(allGroupStores.find(s => s.id === si.StoreID));
            const oldQty = Number(si.個数 || 0);
            const newQty = oldQty + u.qty;

            // 1. Update Inventory
            batch.update(doc(db, "m_store_items", si.id), { 個数: newQty, updated_at: now });

            // 2. Add History
            const histRef = doc(collection(db, "t_inventory_history"));
            batch.set(histRef, {
                store_id: si.StoreID,
                item_id: si.ProductID,
                store_item_id: si.id,
                change_qty: u.qty,
                qty_after: newQty,
                reason_type: 'preparation',
                source_route: 'procurement_page',
                note: type === 'manual' ? 'CK一括(手動依頼分)' : 'CK一括(自動判定分)',
                executed_by: currentUser?.Name || 'unknown',
                executed_at: now,
                business_date: bizDate
            });

            // 3. Mark request as COMPLETED (if manual)
            if (requestId) {
                batch.update(doc(db, "t_prep_requests", requestId), { status: 'COMPLETED', completed_at: now });
            }
        }

        await batch.commit();
        showAlert("完了", "一括反映が完了しました");
    } catch (err) {
        console.error("Batch prep failed:", err);
        showAlert("エラー", "更新に失敗しました: " + err.message);
    } finally {
        await showLoading(false);
    }
}

async function deletePrepRequest(requestId) {
    await showLoading(true);
    try {
        await deleteDoc(doc(db, "t_prep_requests", requestId));
        showAlert("完了", "依頼を削除しました");
    } catch (err) {
        console.error("Failed to delete prep request:", err);
        showAlert("エラー", "削除に失敗しました");
    } finally {
        await showLoading(false);
    }
}

async function addPrepRequest(productId) {
    const master = cachedItems.find(i => i.id === productId);
    if (!master) return;

    // Determine request type
    const requestType = currentStore?.store_type === 'CK' ? 'CK_CHOICE' : 'NIGHT_REQUEST';

    await showLoading(true);
    try {
        await addDoc(collection(db, "t_prep_requests"), {
            store_id: currentStore.id || currentStore.store_id || currentStore.code,
            item_id: productId,
            item_name: master.name,
            unit: master.unit || '',
            requested_qty: 0, // Default to 0, let user input
            request_type: requestType,
            status: 'PENDING',
            created_at: new Date().toISOString(),
            created_by: currentUser?.Name || 'unknown'
        });
    } catch (err) {
        console.error("Failed to add prep request:", err);
        showAlert("エラー", "追加に失敗しました");
    } finally {
        await showLoading(false);
    }
}

async function executePrepAction(id, type, qty) {
    await showLoading(true);
    try {
        const now = new Date().toISOString();
        const bizDate = getBusinessDate(currentStore);

        let si = null;
        let productId = '';
        let requestId = null;

        if (type === 'manual') {
            const req = prepRequests.find(r => r.id === id);
            productId = req.item_id;
            requestId = req.id;
            // Find store item to update its stock
            si = procurementData.find(d => d.ProductID === productId && (d.StoreID === currentStore.id || d.StoreID === currentStore.code));
        } else {
            si = procurementData.find(d => d.id === id);
            productId = si.ProductID;
        }

        if (!si) {
            throw new Error("対象の在庫データが見つかりません。マスタ登録されているか確認してください。");
        }

        const oldQty = Number(si.個数 || 0);
        const newQty = oldQty + qty;

        const batch = writeBatch(db);

        // 1. Update Inventory
        batch.update(doc(db, "m_store_items", si.id), { 個数: newQty, updated_at: now });

        // 2. Add History
        const histRef = doc(collection(db, "t_inventory_history"));
        batch.set(histRef, {
            store_id: si.StoreID,
            item_id: si.ProductID,
            store_item_id: si.id,
            change_qty: qty,
            qty_after: newQty,
            reason_type: 'preparation',
            source_route: 'procurement_page',
            note: type === 'manual' ? '手動追加仕込み' : '不足分仕込み',
            executed_by: currentUser?.Name || 'unknown',
            executed_at: now,
            business_date: bizDate
        });

        // 3. Mark request as COMPLETED (if manual)
        if (requestId) {
            batch.update(doc(db, "t_prep_requests", requestId), { status: 'COMPLETED', completed_at: now });
        }

        await batch.commit();
        showAlert("完了", "仕込みを在庫に反映しました");
    } catch (err) {
        console.error("Prep execution failed:", err);
        showAlert("エラー", "更新に失敗しました: " + err.message);
    } finally {
        await showLoading(false);
    }
}

async function showPrepRadar() {
    // Filter all items that have shortage_action_type === 'store_prep' or 'ck_prep'
    const targetType = selectedCategory; // 'store_prep' or 'ck_prep'
    const allPrepItems = procurementData.filter(si => {
        const action = si.shortage_action_type || 'purchase';
        const isTarget = (action === targetType) || (targetType === 'store_prep' && action === 'prep');
        return isTarget && 
               (si.StoreID === currentStore.id || si.StoreID === currentStore.code);
    }).sort((a, b) => {
        const ratioA = Number(a.個数 || 0) / Number(a.定数 || 1);
        const ratioB = Number(b.個数 || 0) / Number(b.定数 || 1);
        return ratioA - ratioB; // Lowest ratio first
    });

    const modalHtml = `
        <div id="prep-radar-modal" class="modal-overlay active" style="z-index: 10000; position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;">
            <div class="glass-panel" style="width: 90%; max-width: 600px; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column; padding: 0; background: white; border-radius: 16px; box-shadow: var(--shadow-lg);">
                <div style="padding: 1.2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                    <h3 style="margin:0; font-weight: 800;"><i class="fas fa-chart-pie" style="color: var(--primary);"></i> 前倒し仕込み検討 (仕込み品目一覧)</h3>
                    <button onclick="document.getElementById('prep-radar-modal').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color: var(--text-secondary);">&times;</button>
                </div>
                <div style="flex:1; overflow-y:auto; padding: 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1rem; background: #eff6ff; padding: 0.8rem; border-radius: 8px; border: 1px solid #dbeafe;">
                        <i class="fas fa-info-circle"></i> 在庫状況をゲージで表示しています。時間に余裕がある時、前倒しで仕込む品目を選んでください。選択するとメイン画面の右側に追加されます。
                    </div>
                    ${allPrepItems.map(si => {
                        const master = cachedItems.find(i => i.id === si.ProductID);
                        const qty = Number(si.個数 || 0);
                        const par = Number(si.定数 || 0);
                        const ratio = Math.min(100, (qty / Math.max(1, par)) * 100);
                        const color = ratio < 30 ? '#ef4444' : ratio < 70 ? '#f59e0b' : '#10b981';
                        
                        return `
                            <div class="radar-item" onclick="addPrepFromRadar('${si.ProductID}')" style="padding: 0.8rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                                    <span style="font-weight: 800; font-size: 0.85rem; color: #334155;">${si.display_name || master?.name || si.ProductID}</span>
                                    <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">${qty} / ${par} ${si.display_unit || master?.unit || ''}</span>
                                </div>
                                <div style="height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: ${ratio}%; background: ${color}; transition: width 0.3s;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    ${allPrepItems.length === 0 ? '<p style="text-align:center; padding: 3rem; color: var(--text-secondary);">対象となる仕込み品目がありません</p>' : ''}
                </div>
            </div>
        </div>
        <style>
            .radar-item:hover { background: #f8fafc; transform: translateX(5px); }
        </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    window.addPrepFromRadar = (productId) => {
        addPrepRequest(productId);
        document.getElementById('prep-radar-modal').remove();
    };
}

function attachMainContentListeners(container) {
    // Listeners for Accordion
    container.querySelectorAll('.item-banner').forEach(banner => {
        banner.onclick = () => {
            const id = banner.dataset.id;
            if (collapsedItems.has(id)) collapsedItems.delete(id);
            else collapsedItems.add(id);
            render();
        };
    });

    // Listeners for Stepper Buttons
    container.querySelectorAll('.stepper-btn').forEach(btn => {
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

    // Listeners for Action Buttons (Confirm Purchase/Prep/Transfer)
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

async function executeConsumeAction(ci, qty) {
    if (!ci || qty <= 0) return;
    const { action, master, sourceItem, parentSi } = ci;
    const consumeName = master?.name || action.consume_item_id || '消費品目';
    const consumeUnit = action.consume_unit || master?.unit || '';

    if (!sourceItem) {
        showAlert('エラー', `消費元店舗に「${consumeName}」が登録されていません`);
        return;
    }
    const currentStock = Number(sourceItem.個数 || 0);
    if (currentStock < qty) {
        if (!confirm(`【在庫不足】消費元の在庫は ${currentStock}${consumeUnit} しかありません。\n${qty}${consumeUnit} を消費しますか？`)) return;
    }

    const parentName = parentSi.display_name || cachedItems.find(i => i.id === parentSi.ProductID)?.name || '不明';
    if (!confirm(`「${consumeName}」を ${qty}${consumeUnit} 消費します。\n（${parentName} の仕込み連動）\n\n消費元在庫: ${currentStock} → ${currentStock - qty}${consumeUnit}`)) return;

    await showLoading(true);
    try {
        const now = new Date().toISOString();
        const newQty = currentStock - qty;
        const bizDate = getBusinessDate(allGroupStores.find(s => s.id === sourceItem.StoreID));

        await updateDoc(doc(db, 'm_store_items', sourceItem.id), {
            個数: newQty,
            updated_at: now
        });

        await addDoc(collection(db, 't_inventory_history'), {
            store_id: sourceItem.StoreID,
            item_id: sourceItem.ProductID,
            store_item_id: sourceItem.id,
            change_qty: -qty,
            qty_after: newQty,
            reason_type: 'consume_out',
            source_route: 'procurement_page',
            note: `消費（仕込み連動）: ${parentName} の不足により ${qty}${consumeUnit} 消費`,
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            business_date: bizDate
        });

        sourceItem.個数 = newQty;
        showAlert('完了', `「${consumeName}」${qty}${consumeUnit} を消費しました`);
        render();
    } catch (err) {
        console.error('Consume action failed:', err);
        showAlert('エラー', '消費処理に失敗しました: ' + err.message);
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

/**
 * Quick Recipe Viewer Modal for Prep Screen
 */
async function showQuickRecipeModal(productId) {
    const menu = cachedMenus.find(m => m.item_id === productId);
    const master = cachedItems.find(i => i.id === productId);
    if (!menu || !master) return;

    const modal = document.createElement('div');
    modal.className = 'quick-recipe-modal';
    modal.style = `
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); z-index: 2000;
        display: flex; align-items: center; justify-content: center; padding: 1rem;
        opacity: 0; transform: scale(0.98); transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        will-change: opacity, transform;
    `;

    const steps = Array.isArray(menu.instructions || menu.steps) ? (menu.instructions || menu.steps) : (menu.instructions || menu.steps ? [menu.instructions || menu.steps] : []);

    modal.innerHTML = `
        <div class="glass-panel" style="width: 100%; max-width: 600px; max-height: 90vh; background: #f8fafc; border-radius: 24px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="padding: 1.5rem; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 0.7rem; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Recipe Quick View</div>
                    <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; color: #1e293b;">${master.name}</h3>
                </div>
                <button class="btn-close-modal" style="width: 40px; height: 40px; border-radius: 50%; border: none; background: #f1f5f9; color: #64748b; cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="flex: 1; overflow-y: auto; padding: 2rem;">
                <div style="margin-bottom: 2.5rem;">
                    <h4 style="font-size: 1rem; font-weight: 800; color: #10b981; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-shopping-basket"></i> 材料・分量
                    </h4>
                    <div style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
                        ${menu.recipe && menu.recipe.length > 0 ? menu.recipe.map(ri => {
                            const ing = cachedItems.find(i => i.id === ri.ingredient_id);
                            return `
                                <div style="display: flex; justify-content: space-between; padding: 0.8rem 1.2rem; border-bottom: 1px dashed #f1f5f9;">
                                    <span style="font-weight: 700; color: #334155;">${ing?.name || '不明な食材'}</span>
                                    <span style="font-weight: 900; color: #e63946;">${ri.quantity} <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 700;">${ing?.unit || ''}</span></span>
                                </div>
                            `;
                        }).join('') : '<div style="padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">レシピが未登録です</div>'}
                    </div>
                </div>

                <div>
                    <h4 style="font-size: 1rem; font-weight: 800; color: #e63946; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-list-ol"></i> 工程・ポイント
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${steps.length > 0 ? steps.map((s, i) => `
                            <div style="display: flex; gap: 1rem;">
                                <div style="width: 1.8rem; height: 1.8rem; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 800; color: #64748b; flex-shrink: 0;">${i+1}</div>
                                <div style="font-size: 0.95rem; line-height: 1.6; color: #334155; padding-top: 2px;">${s.replace(/\n/g, '<br>')}</div>
                            </div>
                        `).join('') : '<div style="padding: 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">工程は登録されていません</div>'}
                    </div>
                </div>
            </div>
            
            <div style="padding: 1.2rem; background: white; border-top: 1px solid #e2e8f0; text-align: center;">
                <button class="btn btn-primary btn-close-modal" style="width: 100%; padding: 1rem; border-radius: 12px; font-weight: 800;">確認しました</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Trigger animation
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.style.transform = 'scale(1)';
    });

    const close = () => {
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.98)';
        setTimeout(() => modal.remove(), 150);
    };

    modal.querySelectorAll('.btn-close-modal').forEach(btn => btn.onclick = close);
    modal.onclick = (e) => { if (e.target === modal) close(); };
}
