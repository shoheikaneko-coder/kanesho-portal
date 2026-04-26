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
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">表示設定</label>
                <div class="scope-toggle" style="display: flex; background: var(--surface-darker); padding: 3px; border-radius: 8px; border: 1px solid var(--border);">
                    <button id="btn-scope-store" class="toggle-btn active" style="flex: 1; padding: 0.4rem; font-size: 0.7rem; font-weight: 800; border-radius: 6px; border: none; cursor: pointer;">自店舗のみ</button>
                    <button id="btn-scope-group" class="toggle-btn" style="flex: 1; padding: 0.4rem; font-size: 0.7rem; font-weight: 800; border-radius: 6px; border: none; cursor: pointer;">グループ全体</button>
                </div>
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
                    <span id="proc-scope-badge" class="badge" style="background: #eff6ff; color: #2563eb; font-size: 0.7rem;">自店舗</span>
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

    // Business Category Buttons
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = () => {
            selectedCategory = btn.dataset.cat;
            selectedVendor = null; // Reset vendor when category changes
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b === btn));
            
            // Show/Hide Vendor Sidebar Section (only for Purchase)
            const vendorSection = document.getElementById('proc-vendor-section');
            if (vendorSection) vendorSection.style.display = selectedCategory === 'purchase' ? 'block' : 'none';
            
            render();
        };
    });

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
    let sourceOptions = [];
    if (selectedCategory === 'transfer') {
        // Find other stores that have this product and their stock
        const otherStores = allGroupStores.filter(s => s.id !== si.StoreID);
        const sourceOptions = otherStores.map(s => {
            const sourceItem = procurementData.find(d => d.StoreID === s.id && d.ProductID === si.ProductID);
            const stock = Number(sourceItem?.個数 || 0);
            const sNameShort = s.store_name || s.Name;
            return { id: s.id, name: sNameShort, stock };
        }).sort((a, b) => b.stock - a.stock); // Most stock first

        // Default to the store with most stock (usually CK)
        const defaultSource = sourceOptions[0];
        const isOutOfStock = !defaultSource || defaultSource.stock <= 0;

        transferUi = `
            <div style="margin-right: 1rem; display: flex; flex-direction: column; gap: 0.2rem;">
                <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-secondary);">移動元店舗</label>
                <select class="source-store-select" data-si-id="${si.id}" style="padding: 0.3rem; border-radius: 6px; border: 1px solid var(--border); font-size: 0.8rem; font-weight: 700; min-width: 120px;">
                    ${sourceOptions.map(o => `<option value="${o.id}" ${o.id === si.default_source_store_id ? 'selected' : ''} ${o.stock <= 0 ? 'disabled' : ''}>${o.name} (残:${o.stock})</option>`).join('')}
                </select>
                ${isOutOfStock ? '<span style="font-size: 0.6rem; color: var(--danger); font-weight: 800;">移動元に在庫がありません</span>' : ''}
            </div>
        `;
        
        // Add Source Location Text
        const sourceStoreItem = procurementData.find(d => d.StoreID === (si.default_source_store_id || defaultSource?.id) && d.ProductID === si.ProductID);
        const sourceLoc = sourceStoreItem?.location_label || sourceStoreItem?.保管場所 || '未設定';
        locHtml = `<div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.1rem;"><i class="fas fa-map-marker-alt" style="font-size:0.6rem;"></i> 移動元の棚: <span style="font-weight:700; color:#475569;">${sourceLoc}</span></div>`;
    }
    
    return `
        <div class="proc-row-card" style="${selectedCategory === 'transfer' ? 'padding-right: 1rem;' : ''}">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 150px;">
                <div style="width: 40px; height: 40px; background: #f8fafc; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--primary); border: 1px solid #e2e8f0;">
                    <i class="fas ${showStoreName ? 'fa-store' : 'fa-box'}" style="font-size:1.1rem;"></i>
                </div>
                <div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">${showStoreName ? sName : (master?.name || '品目不明')}</div>
                    ${selectedCategory === 'transfer' ? locHtml : ''}
                    <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700;">
                        必要: <span style="color:var(--danger); font-size: 1rem; font-family: monospace;">${req}</span> ${sUnit}
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
                    ${(selectedCategory === 'transfer' && (!sourceOptions || sourceOptions.every(o => o.stock <= 0))) ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}
                    style="padding: 0.6rem 1.2rem; font-size: 0.85rem; border-radius: 8px; font-weight: 800;">${btnLabel}</button>
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
    
    const btnHistory = document.getElementById('btn-proc-history');
    if (btnHistory) btnHistory.style.display = selectedCategory === 'transfer' ? 'block' : 'none';

    // 1. Filter data based on scope (Current store or all stores in group)
    let filteredData = procurementData;
    if (selectedScope === 'store') {
        filteredData = procurementData.filter(d => d.StoreID === currentStore.id);
    }

    // 2. Filter by Category (Shortage Action Type) and Short items
    const shortItems = filteredData.filter(si => {
        const qty = Number(si.個数 || 0);
        const par = Number(si.定数 || 0);
        if (par <= 0 || qty >= par) return false;

        const action = si.shortage_action_type || 'purchase';
        return action === selectedCategory;
    });

    if (selectedCategory === 'purchase') {
        // ... (existing vendor logic)
        renderPurchaseContent(shortItems, sidebar);
    } else if (selectedCategory === 'transfer') {
        sidebar.innerHTML = `<div style="padding:1rem; font-size:0.75rem; color:var(--text-secondary);">店舗間移動モード</div>`;
        renderTransferContent(shortItems);
    } else {
        sidebar.innerHTML = `<div style="padding:1rem; font-size:0.75rem; color:var(--text-secondary);">仕込みモード</div>`;
        renderMainContent(shortItems);
    }
}

function renderPurchaseContent(shortItems, sidebar) {
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
    attachMainContentListeners(main);
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
    if (!sourceSi || Number(sourceSi.個数 || 0) < qty) {
        showAlert("エラー", "移動元店舗に十分な在庫がありません");
        return;
    }

    const confirmTransfer = confirm(`移動元: ${sourceStoreId}\n移動先: ${destSi.StoreID}\n数量: ${qty}\nを実行しますか？`);
    if (!confirmTransfer) return;

    await showLoading(true);
    try {
        const { writeBatch } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        const bizDate = getBusinessDate(allGroupStores.find(s => s.id === destSi.StoreID));

        const sourceOldQty = Number(sourceSi.個数 || 0);
        const sourceNewQty = sourceOldQty - qty;
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
            change_qty: -qty,
            qty_after: sourceNewQty,
            reason_type: 'transfer_out',
            source_route: 'procurement_page',
            note: `店舗間移動(出庫): ${destSi.StoreID} へ`,
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
