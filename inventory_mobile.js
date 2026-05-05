import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where, orderBy, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { calculateAllTheoreticalStocks } from './stock_logic.js';
import { showAlert } from './ui_utils.js';

export const inventoryMobilePageHtml = `
    <div id="inventory-app" class="animate-fade-in" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; background: #fff; position: relative;">
        
        <!-- Sticky Top Navigation -->
        <header style="background: white; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; z-index: 100;">
            <div style="display: flex; align-items: center; gap: 0.8rem; padding: 0.6rem 1rem; border-bottom: 1px solid #f8fafc;">
                <div onclick="showStoreSelectSheet()" style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; background: #f8fafc; padding: 0.4rem 0.8rem; border-radius: 8px; flex: 1; min-width: 0;">
                    <i class="fas fa-store" style="font-size: 0.8rem; color: var(--primary);"></i>
                    <span id="display-selected-store-name" style="font-size: 0.85rem; font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">店舗を選択...</span>
                    <i class="fas fa-chevron-down" style="font-size: 0.6rem; color: #94a3b8;"></i>
                </div>
                <div style="display: flex; gap: 0.3rem;">
                    <button id="btn-inv-refresh" class="btn-icon-sm"><i class="fas fa-sync-alt"></i></button>
                </div>
            </div>

            <!-- Timing Chips -->
            <div class="scroll-fade-container">
                <div id="inv-timing-nav" class="horizontal-scroll-chips-slim"></div>
            </div>

            <!-- Search Bar -->
            <div style="padding: 0 1rem 0.6rem 1rem;">
                <div style="position: relative;">
                    <i class="fas fa-search" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: #cbd5e1; font-size: 0.8rem;"></i>
                    <input type="text" id="inv-item-search" placeholder="品目を検索..." 
                           style="width: 100%; height: 36px; padding: 0 0.8rem 0 2.2rem; border-radius: 10px; border: 1.5px solid #f1f5f9; background: #f8fafc; font-size: 0.9rem; font-weight: 700; outline: none;">
                </div>
            </div>
        </header>

        <!-- Main Content Area -->
        <main id="inv-main-content" style="flex: 1; overflow-y: auto; padding: 0; padding-bottom: 100px; -webkit-overflow-scrolling: touch;">
            <div style="text-align:center; padding: 5rem 2rem; color: #94a3b8;">
                <i class="fas fa-store-slash" style="font-size: 3rem; opacity: 0.2; margin-bottom: 1rem;"></i>
                <p style="font-size: 0.9rem; font-weight: 700;">店舗を選択して開始してください</p>
                <button onclick="showStoreSelectSheet()" class="btn btn-primary" style="margin-top: 1.5rem; border-radius: 12px; height: 50px; padding: 0 2rem; font-weight: 800;">店舗を選択する</button>
            </div>
        </main>

        <!-- Bottom Tab Bar -->
        <footer id="inv-mobile-tab-bar" style="background: white; border-top: 1px solid #f1f5f9; display: flex; height: 60px; padding-bottom: env(safe-area-inset-bottom); flex-shrink: 0; z-index: 100; position: absolute; bottom: 0; width: 100%;">
            <div class="mobile-tab-item active" data-tab="inventory">
                <i class="fas fa-clipboard-list"></i>
                <span>在庫チェック</span>
            </div>
            <div class="mobile-tab-item" data-tab="procurement">
                <i class="fas fa-truck-loading"></i>
                <span>仕入・移動</span>
            </div>
            <div class="mobile-tab-item" data-tab="history">
                <i class="fas fa-history"></i>
                <span>履歴</span>
            </div>
            <div class="mobile-tab-item" data-tab="master">
                <i class="fas fa-cog"></i>
                <span>設定</span>
            </div>
        </footer>

        <div id="inv-progress-line-container" style="height: 2px; background: #f1f5f9; flex-shrink: 0; position: absolute; bottom: calc(60px + env(safe-area-inset-bottom)); width: 100%; z-index: 101;">
            <div id="inv-progress-line" style="height: 100%; width: 0%; background: #10b981; transition: width 0.3s;"></div>
        </div>

        <!-- Overlays -->
        <div id="inv-loading-overlay" style="display:none; position:fixed; inset:0; background:rgba(255,255,255,0.8); z-index:9999; justify-content:center; align-items:center; flex-direction: column; gap: 1rem;">
             <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
             <span style="font-weight: 800; color: #1e293b; font-size: 0.9rem;">処理中...</span>
        </div>

        <!-- Sheets -->
        <div id="store-select-sheet" class="bottom-sheet" style="display: none;">
            <div class="bottom-sheet-backdrop" onclick="closeStoreSelectSheet()"></div>
            <div class="bottom-sheet-content">
                <div class="bottom-sheet-handle"></div>
                <div style="padding: 1rem 1.5rem;">
                    <h3 style="margin: 0 0 1.2rem 0; font-size: 1.1rem; font-weight: 900; color: #1e293b;">店舗を選択</h3>
                    <div id="store-sheet-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 60vh; overflow-y: auto;"></div>
                </div>
            </div>
        </div>

        <div id="inv-master-settings-overlay" style="display: none; position: fixed; inset: 0; background: white; z-index: 10000; flex-direction: column;">
            <header style="padding: 1rem; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
                <h2 style="margin: 0; font-size: 1.1rem; font-weight: 900;">在庫マスタ設定</h2>
                <button onclick="hideMasterSettings()" class="btn-icon-mobile"><i class="fas fa-times"></i></button>
            </header>
            <div id="inv-master-settings-content" style="flex: 1; overflow-y: auto;"></div>
        </div>
    </div>

    <style>
        /* This page only CSS overrides */
        .page-content { overflow: hidden !important; padding: 0 !important; }
        
        .bottom-sheet { position: fixed; inset: 0; z-index: 10000; display: flex; flex-direction: column; justify-content: flex-end; }
        .bottom-sheet-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
        .bottom-sheet-content { position: relative; background: white; border-radius: 30px 30px 0 0; padding-bottom: env(safe-area-inset-bottom); max-height: 90vh; overflow-y: auto; animation: sheet-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .bottom-sheet-handle { width: 40px; height: 5px; background: #e2e8f0; border-radius: 10px; margin: 12px auto; }
        @keyframes sheet-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

        .mobile-tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #94a3b8; font-size: 0.65rem; font-weight: 800; }
        .mobile-tab-item i { font-size: 1.2rem; }
        .mobile-tab-item.active { color: var(--primary); }

        .horizontal-scroll-chips-slim { display: flex; gap: 0.6rem; overflow-x: auto; scrollbar-width: none; padding: 0.4rem 1rem 0.8rem 1rem; }
        .horizontal-scroll-chips-slim::-webkit-scrollbar { display: none; }

        .timing-chip { padding: 0.4rem 0.9rem; background: #f8fafc; color: #64748b; border-radius: 20px; font-weight: 800; font-size: 0.75rem; white-space: nowrap; border: 1.5px solid #f1f5f9; }
        .timing-chip.active { background: #fff; color: var(--primary); border-color: var(--primary); box-shadow: 0 2px 6px rgba(230,57,70,0.1); }

        .inv-row { display: flex; align-items: center; padding: 0.8rem 1rem; border-bottom: 1px solid #f8fafc; gap: 0.8rem; background: white; }
        .inv-row.confirmed { background: #f0fdf4; }
        .inv-row.shortage:not(.confirmed) { background: #fff5f5; }
        .inv-row-content { flex: 1; min-width: 0; }
        .inv-row-title { font-weight: 900; font-size: 0.95rem; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .inv-row-meta { font-size: 0.65rem; color: #94a3b8; font-weight: 700; }

        .qty-stepper-sm { display: flex; align-items: center; background: #f8fafc; border-radius: 8px; padding: 2px; border: 1px solid #f1f5f9; }
        .stepper-btn-sm { width: 32px; height: 32px; border-radius: 6px; background: white; color: #1e293b; border: none; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; }
        .qty-input-sm { width: 44px; border: none; background: transparent; text-align: center; font-size: 1.1rem; font-weight: 900; color: var(--primary); outline: none; }

        .btn-confirm-sm { width: 38px; height: 38px; border-radius: 10px; border: none; background: #f1f5f9; color: #cbd5e1; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; }
        .btn-confirm-sm.active { background: #10b981; color: white; }

        .inv-row-controls { display: flex; align-items: center; gap: 1.2rem; flex-shrink: 0; }

        .btn-icon-sm { width: 32px; height: 32px; border-radius: 8px; border: none; background: #f8fafc; color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
        .location-header-sm { padding: 0.4rem 1rem; background: #f8fafc; color: #94a3b8; font-size: 0.7rem; font-weight: 900; text-transform: uppercase; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; }

        .btn-icon-mobile { width: 44px; height: 44px; border-radius: 12px; border: none; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .store-item-row { padding: 1rem; background: white; border-radius: 12px; border: 1.5px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; font-weight: 800; color: #1e293b; margin-bottom: 0.5rem; }
        .store-item-row.active { border-color: var(--primary); background: #fff5f5; color: var(--primary); }
    </style>
`;

// Global State
let selectedStore = null;  // {id, name, internalCode, resetTime}
let inventorySearchQuery = ''; 
let currentTab = 'tiles';   // 'tiles' or 'list'
let collapsedLocations = new Set(); 
let selectedTiming = null; // {id, name}
let allStores = [];
let timingMaster = {};     // ID -> Name
let inventoryData = [];    // m_store_items + item_name
let productMap = {};       // ProductID -> Name
let cachedItems = [];
let cachedIngredients = [];
let cachedSuppliers = [];
let cachedMenus = [];
let currentUser = null;

// Settings State
let settingsSearchQuery = '';
let settingsBulkMode = false;
let settingsSelectedCategory = 'ALL';
let settingsSelectedSupplier = 'ALL';
let settingsCollapsedTimings = new Set();
let settingsInitialized = false;

/**
 * Helper to determine if an item is a valid inventory target
 * (Ingredient or Sub-recipe, not a standard Sales Menu)
 */
function isInventoryTarget(item) {
    if (!item) return false;
    const pid = String(item.id);
    
    // メニューマスタに存在するか確認
    const menu = cachedMenus.find(m => String(m.item_id) === pid || String(m.id) === pid);
    
    if (menu) {
        // メニューにある場合、is_sub_recipe が明示的に true のものだけを対象とする
        // (通常の販売メニューを除外するため)
        return menu.is_sub_recipe === true;
    }
    
    // 原材料マスタにあるか確認
    const isIng = cachedIngredients.some(ing => String(ing.item_id) === pid);
    if (isIng) return true;

    // どちらにも明確に属さない場合は、デフォルトで管理対象候補とする（安全策）
    return true; 
}
let tempSelectedPids = new Set();
let settingsCurrentTab = 'ingredients'; 
let editingItem = null;    // Item for keypad or loc-edit
let sortMode = false;
let collapsedSections = new Set(); // Store location names


async function loadInitialData() {
    try {
        // 1. Load Stores from m_stores (The master source)
        const storeSnap = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
        allStores = [];
        storeSnap.forEach(d => {
            const data = d.data();
            allStores.push({
                id: d.id,
                name: data.store_name || data.Name || d.id,
                code: data.store_id || d.id,
                group_name: data.group_name || data.所属グループ || '',
                resetTime: data.reset_time || "05:00"
            });
        });

        // 2. Load Timing Master
        const timingSnap = await getDocs(collection(db, "m_check_timings"));
        timingMaster = {};
        timingSnap.forEach(d => {
            const data = d.data();
            timingMaster[data.ID || d.id] = data.確認タイミング || data.Name || d.id;
        });

        // 3. Load Items, Ingredients, Suppliers, and Menus
        const [itemSnap, ingSnap, supSnap, menuSnap] = await Promise.all([
            getDocs(collection(db, "m_items")),
            getDocs(collection(db, "m_ingredients")),
            getDocs(collection(db, "m_suppliers")),
            getDocs(collection(db, "m_menus"))
        ]);

        cachedItems = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        cachedIngredients = ingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        cachedSuppliers = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        cachedMenus = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        productMap = {};
        cachedItems.forEach(i => {
            productMap[i.id] = i.name || i.Name || i.id;
        });

        cachedMenusForInv = cachedMenus;

    } catch (err) {
        console.error("Error loading initial inventory data:", err);
    }
}

let cachedMenusForInv = [];

// 理論在庫のキャッシュ (StoreID_ProductID -> value)
let theoreticalStockCache = {};

async function loadTheoreticalStocks(storeCode) {
    const masterCache = {
        items: Object.keys(productMap).map(id => ({ id: id, name: productMap[id] })),
        menus: cachedMenusForInv,
        ingredients: [] // stock_logic now uses menus to find recipes, ingredients list is less critical but good to have for consistency if needed
    };
    theoreticalStockCache = await calculateAllTheoreticalStocks(storeCode, masterCache);
}

// Helper: Check if the entry is from the current "business day"
function isConfirmedToday(updatedAt, resetTime, isConfirmedFlag) {
    if (!updatedAt || isConfirmedFlag === false) return false;
    const now = new Date();
    const update = new Date(updatedAt);

    // Calculate the last reset point
    const [h, m] = resetTime.split(':').map(Number);
    let lastReset = new Date(now);
    lastReset.setHours(h, m, 0, 0);

    if (now < lastReset) {
        lastReset.setDate(lastReset.getDate() - 1);
    }

    return update >= lastReset;
}

// Helper: Get current business date string "YYYY-MM-DD" based on store reset time
function getBusinessDate(resetTime = "05:00") {
    const now = new Date();
    const [h, m] = (resetTime || "05:00").split(':').map(Number);
    let cutoff = new Date(now);
    cutoff.setHours(h, m, 0, 0);
    if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);
    return cutoff.toISOString().split('T')[0];
}

function render() {
    const main = document.getElementById('inv-main-content');
    if (!main) return;

    // Hide global FAB
    const globalFab = document.getElementById('fab-main-btn');
    if (globalFab) globalFab.style.display = 'none';

    // Populate Store UI
    const storeDisplay = document.getElementById('display-selected-store-name');
    if (storeDisplay) {
        storeDisplay.textContent = selectedStore ? selectedStore.name : '店舗を選択してください';
    }

    if (!selectedStore) {
        main.innerHTML = `
            <div style="text-align:center; padding: 5rem; color: #94a3b8;">
                <i class="fas fa-store-slash" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                <p style="font-size: 0.9rem;">店舗を選択して開始してください</p>
                <button onclick="showStoreSelectSheet()" class="btn btn-primary" style="margin-top: 1rem; border-radius: 8px;">店舗を選択する</button>
            </div>
        `;
        return;
    }

    // 1. Render Slim Timing Chips
    const timingNav = document.getElementById('inv-timing-nav');
    if (timingNav) {
        const rawTimings = [...new Set(inventoryData.map(d => d.確認タイミング || ''))].sort((a,b) => {
            if (a === '') return -1;
            if (b === '') return 1;
            return a.localeCompare(b);
        });

        if (!selectedTiming && rawTimings.length > 0) {
            const firstId = rawTimings[0];
            selectedTiming = { id: firstId, name: timingMaster[firstId] || firstId || '未設定' };
        }

        timingNav.innerHTML = rawTimings.map(tCode => {
            const tName = tCode ? (timingMaster[tCode] || tCode) : "未設定";
            const itemsInTiming = inventoryData.filter(d => (d.確認タイミング || '') === tCode);
            const confirmedCount = itemsInTiming.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime, i.is_confirmed)).length;
            const isActive = selectedTiming && (selectedTiming.id || '') === tCode;
            
            return `
                <div class="timing-chip ${isActive ? 'active' : ''}" data-code="${tCode}" data-name="${tName}">
                    ${tName} <span style="opacity: 0.5; font-size: 0.65rem; margin-left: 2px;">${confirmedCount}/${itemsInTiming.length}</span>
                </div>
            `;
        }).join('');

        timingNav.querySelectorAll('.timing-chip').forEach(chip => {
            chip.onclick = () => {
                const tid = chip.dataset.code;
                const tname = chip.dataset.name;
                selectedTiming = { id: tid, name: tname };
                inventorySearchQuery = ''; 
                
                // 全ての保管場所をデフォルトで閉じる
                collapsedLocations = new Set();
                const uniqueLocs = [...new Set(inventoryData.filter(d => (d.確認タイミング || '') === tid).map(d => d.location_label || d.保管場所 || '未配置'))];
                uniqueLocs.forEach(loc => collapsedLocations.add(loc));

                render();
            };
        });
    }

    // 2. Update Progress Line
    const itemsInCurrentTiming = inventoryData.filter(d => (d.確認タイミング || '') === (selectedTiming ? selectedTiming.id : ''));
    if (itemsInCurrentTiming.length > 0) {
        const confirmedCount = itemsInCurrentTiming.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime, i.is_confirmed)).length;
        const percent = Math.round((confirmedCount / itemsInCurrentTiming.length) * 100);
        const progressLine = document.getElementById('inv-progress-line');
        if (progressLine) progressLine.style.width = `${percent}%`;
    }

    // 3. Bottom Tab Bar Interaction
    document.querySelectorAll('.mobile-tab-item').forEach(tab => {
        const tabId = tab.dataset.tab;
        tab.classList.toggle('active', tabId === 'inventory');
        tab.onclick = () => {
            if (tabId === 'procurement') {
                if (window.switchOpsHubTab) window.switchOpsHubTab('transfer');
                else window.navigateTo('procurement');
            }
            else if (tabId === 'master') showMasterSettings();
            else if (tabId === 'history') {
                if (window.switchOpsHubTab) showAlert('近日公開', '履歴機能は現在開発中です。');
                else showAlert('近日公開', '履歴機能は現在開発中です。');
            }
            else {
                if (window.switchOpsHubTab) window.switchOpsHubTab('inventory');
                else render();
            }
        };
    });

    // 4. Header Button Listeners
    const btnReset = document.getElementById('btn-manual-reset');
    if (btnReset) btnReset.onclick = handleManualReset;

    const btnRefresh = document.getElementById('btn-inv-refresh');
    if (btnRefresh) btnRefresh.onclick = async () => {
        const loader = document.getElementById('inv-loading-overlay');
        loader.style.display = 'flex';
        await loadStoreInventory(selectedStore.code);
        render();
        loader.style.display = 'none';
    };

    const searchInput = document.getElementById('inv-item-search');
    if (searchInput) {
        searchInput.value = inventorySearchQuery;
        searchInput.oninput = (e) => {
            inventorySearchQuery = e.target.value;
            renderChecklist(main);
        };
    }

    // 5. Render Checklist
    if (!selectedTiming) {
        main.innerHTML = `<div style="text-align:center; padding: 5rem; color: #94a3b8; font-size: 0.9rem;">タイミングを選択してください</div>`;
    } else {
        renderChecklist(main);
    }
}

window.showStoreSelectSheet = () => {
    const sheet = document.getElementById('store-select-sheet');
    const list = document.getElementById('store-sheet-list');
    list.innerHTML = allStores.sort((a,b) => a.name.localeCompare(b.name)).map(s => `
        <div class="store-item-row ${selectedStore?.id === s.id ? 'active' : ''}" data-id="${s.id}">
            <span>${s.name}</span>
            ${selectedStore?.id === s.id ? '<i class="fas fa-check-circle"></i>' : ''}
        </div>
    `).join('');

    list.querySelectorAll('.store-item-row').forEach(row => {
        row.onclick = async () => {
            const overlay = document.getElementById('inv-loading-overlay');
            try {
                if (overlay) overlay.style.display = 'flex';
                
                const s = allStores.find(x => x.id === row.dataset.id);
                if (!s) throw new Error("店舗データが見つかりません: " + row.dataset.id);
                
                console.log("Selected store:", s);
                selectedStore = s;
                closeStoreSelectSheet();
                render();
                
                await loadStoreInventory(s.code);
                render();
            } catch (err) {
                console.error("Store selection failed:", err);
                showAlert('エラー', '店舗の読み込みに失敗しました: ' + err.message);
            } finally {
                if (overlay) overlay.style.display = 'none';
            }
        };
    });
    sheet.style.display = 'flex';
};

window.closeStoreSelectSheet = () => {
    document.getElementById('store-select-sheet').style.display = 'none';
};

window.showMasterSettings = async () => {
    const overlay = document.getElementById('inv-master-settings-overlay');
    const content = document.getElementById('inv-master-settings-content');
    const overlayLoad = document.getElementById('inv-loading-overlay');
    
    if (overlay && content) {
        if (overlayLoad) overlayLoad.style.display = 'flex';
        try {
            await loadStoreInventory(selectedStore.code);
            overlay.style.display = 'flex';
            renderSettingsView(content);
        } catch (err) {
            console.error("Master settings open failed:", err);
            showAlert('エラー', 'データの取得に失敗しました');
        } finally {
            if (overlayLoad) overlayLoad.style.display = 'none';
        }
    }
};

window.hideMasterSettings = () => {
    const overlay = document.getElementById('inv-master-settings-overlay');
    if (overlay) overlay.style.display = 'none';
};

function renderChecklist(container) {
    let items = [];
    let isGlobalSearch = false;

    if (inventorySearchQuery) {
        isGlobalSearch = true;
        const q = inventorySearchQuery.toLowerCase();
        items = inventoryData.filter(item => {
            const masterName = (productMap[item.ProductID] || '').toLowerCase();
            const displayName = (item.display_name || '').toLowerCase();
            const location = (item.location_label || item.保管場所 || '').toLowerCase();
            return masterName.includes(q) || displayName.includes(q) || location.includes(q);
        });
    } else {
        items = inventoryData.filter(d => (d.確認タイミング || '') === (selectedTiming ? selectedTiming.id : ''));
    }
    renderInventoryRows(container, items, isGlobalSearch);
}

function renderInventoryRows(container, items, isGlobalSearch) {
    items.sort((a, b) => {
        const locA = a.location_label || a.保管場所 || '未設定';
        const locB = b.location_label || b.保管場所 || '未設定';
        if (locA !== locB) return locA.localeCompare(locB);
        return (productMap[a.ProductID] || '').localeCompare(productMap[b.ProductID] || '');
    });

    const groupedItems = {};
    items.forEach(item => {
        const loc = item.location_label || item.保管場所 || '未設定';
        if (!groupedItems[loc]) groupedItems[loc] = [];
        groupedItems[loc].push(item);
    });

    let html = '';
    Object.keys(groupedItems).forEach(loc => {
        const locItems = groupedItems[loc];
        const confirmedCount = locItems.filter(i => isConfirmedToday(i.confirmed_at, selectedStore.resetTime, i.is_confirmed)).length;
        const totalCount = locItems.length;
        const isCollapsed = collapsedLocations.has(loc);
        const hasShortage = locItems.some(i => !isConfirmedToday(i.confirmed_at, selectedStore.resetTime, i.is_confirmed) && (i.定数 > 0) && (Number(i.個数 || 0) < i.定数));

        html += `
            <div class="location-accordion ${isCollapsed ? 'is-collapsed' : ''}">
                <div class="location-header-sm" onclick="window.toggleLocationAccordion('${loc}')" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 0.8rem 1rem; background: #f8fafc; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <i class="fas fa-chevron-down accordion-icon" style="font-size: 0.7rem; color: #94a3b8; transition: transform 0.2s; ${isCollapsed ? 'transform: rotate(-90deg);' : ''}"></i>
                        <span style="font-size: 0.75rem; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">${loc}</span>
                        ${hasShortage ? '<i class="fas fa-exclamation-circle" style="color: #ef4444; font-size: 0.7rem;"></i>' : ''}
                    </div>
                    <div style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; background: white; padding: 0.2rem 0.6rem; border-radius: 10px; border: 1px solid #f1f5f9;">
                        ${confirmedCount} / ${totalCount}
                    </div>
                </div>
                <div class="location-content" style="${isCollapsed ? 'display: none;' : ''}">
                    ${locItems.map(item => {
                        const isConfirmed = isConfirmedToday(item.confirmed_at, selectedStore.resetTime, item.is_confirmed);
                        const currentQty = item.個数 !== undefined ? item.個数 : '';
                        const parStock = item.定数 || 0;
                        const isShort = (parStock > 0) && (Number(currentQty) < parStock);
                        const masterName = productMap[item.ProductID] || '不明';
                        const displayName = item.display_name || masterName;

                        return `
                            <div class="inv-row ${isConfirmed ? 'confirmed' : ''} ${isShort && !isConfirmed ? 'shortage' : ''}" data-id="${item.id}">
                                <div class="inv-row-content" onclick="window.showItemSettingsModal('${item.id}')">
                                    <div class="inv-row-title">${displayName}</div>
                                    <div class="inv-row-meta">
                                        ${isGlobalSearch ? `<span style="color:var(--primary); font-weight:800; margin-right:4px;">[${timingMaster[item.確認タイミング] || '未'}]</span>` : ''}
                                        定数: ${parStock}${item.display_unit || ''}
                                    </div>
                                </div>
                                <div class="inv-row-controls">
                                    <button class="btn-confirm-sm ${isConfirmed ? 'active' : ''}" data-id="${item.id}">
                                        <i class="fas fa-check"></i>
                                    </button>
                                    <div class="qty-stepper-sm">
                                        <button class="stepper-btn-sm btn-minus" data-id="${item.id}"><i class="fas fa-minus"></i></button>
                                        <input type="number" class="qty-input-sm" value="${currentQty}" placeholder="-" data-id="${item.id}" inputmode="decimal" step="0.5">
                                        <button class="stepper-btn-sm btn-plus" data-id="${item.id}"><i class="fas fa-plus"></i></button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html || `<div style="text-align:center; padding: 3rem; color: #94a3b8; font-size: 0.85rem;">品目はありません</div>`;
    attachInventoryListeners(container);
}

function attachInventoryListeners(container) {
    container.querySelectorAll('.stepper-btn-sm').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const input = container.querySelector(`.qty-input-sm[data-id="${id}"]`);
            const item = inventoryData.find(i => i.id === id);
            if (!item || !input) return;

            let val = parseFloat(input.value) || 0;
            val = btn.classList.contains('btn-plus') ? val + 0.5 : Math.max(0, val - 0.5);
            val = Math.round(val * 10) / 10; // 浮動小数点の誤差防止
            
            input.value = val;
            item.個数 = val;
            await saveItemQty(item);
            const row = container.querySelector(`.inv-row[data-id="${id}"]`);
            if (row) {
                const isShort = (item.定数 > 0) && (val < item.定数);
                row.classList.toggle('shortage', isShort);
            }
        };
    });

    container.querySelectorAll('.qty-input-sm').forEach(input => {
        input.onclick = (e) => e.stopPropagation();
        input.onfocus = () => input.select();
        input.onblur = async () => {
            const item = inventoryData.find(i => i.id === input.dataset.id);
            if (item && input.value !== "") {
                const val = Number(input.value);
                item.個数 = val;
                await saveItemQty(item);
                const row = container.querySelector(`.inv-row[data-id="${input.dataset.id}"]`);
                if (row) row.classList.toggle('shortage', (item.定数 > 0) && (val < item.定数));
            }
        };
        input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
    });

    container.querySelectorAll('.btn-confirm-sm').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            toggleItemConfirmation(btn.dataset.id);
        };
    });
}


function hideKeypad() {
    // Deprecated in docked UI
}

function handleKeypadInput(val) {
    if (!editingItem) return;
    const input = document.querySelector(`.qty-input[data-id="${editingItem.id}"]`);
    if (!input) return;

    let current = input.value;
    if (val === 'BS') {
        input.value = current.slice(0, -1);
    } else if (val === '.') {
        if (!current.includes('.')) input.value = current + '.';
    } else {
        input.value = current + val;
    }
    editingItem.個数 = input.value === "" ? 0 : Number(input.value);
    
    // Auto-update Firestore if needed or wait for confirm
}

async function handleManualReset() {
    if (!selectedStore || !selectedTiming) return;

    const itemsToReset = inventoryData.filter(d => 
        d.確認タイミング === selectedTiming.id && 
        isConfirmedToday(d.updated_at, selectedStore.resetTime, d.is_confirmed)
    );

    if (itemsToReset.length === 0) {
        showAlert('情報', '現在リセットが必要な項目はありません。');
        return;
    }

    const confirmed = confirm(
        `「${selectedTiming.name}」の在庫チェックのリセットを行います。よろしいですか？`
    );

    if (!confirmed) return;

    const overlay = document.getElementById('inv-loading-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        const resetTimestamp = "2000-01-01T00:00:00Z"; // Reset to far past
        const businessDate = getBusinessDate(selectedStore.resetTime);

        itemsToReset.forEach(item => {
            const docRef = doc(db, "m_store_items", item.id);
            batch.update(docRef, {
                is_confirmed: false,
                updated_at: resetTimestamp,
                confirmed_at: null,
                reset_by: currentUser?.Name || currentUser?.Email || 'unknown',
                reset_at: now
            });
            
            // Update local object immediately
            item.is_confirmed = false;
            item.updated_at = resetTimestamp;
        });

        // Log the reset action to history
        const historyRef = doc(collection(db, "t_inventory_history"));
        batch.set(historyRef, {
            store_id: selectedStore.code,
            item_id: 'SYSTEM_RESET',
            store_item_id: selectedTiming.id,
            change_qty: 0,
            qty_after: 0,
            reason_type: 'manual_reset',
            source_route: 'inventory_page',
            note: `${selectedTiming.name} を手動リセットしました`,
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            business_date: businessDate
        });

        await batch.commit();
        await loadStoreInventory(selectedStore.code);
        render(); 
        if (overlay) overlay.style.setProperty('display', 'none', 'important');
        alert(`「${selectedTiming.name}」の在庫チェックをリセットしました。`);
    } catch (err) {
        console.error("Reset failed:", err);
        if (overlay) overlay.style.setProperty('display', 'none', 'important');
        alert('リセットに失敗しました: ' + err.message);
    } finally {
        if (overlay) overlay.style.setProperty('display', 'none', 'important');
    }
}
window.toggleLocationAccordion = (loc) => {
    if (collapsedLocations.has(loc)) {
        collapsedLocations.delete(loc);
    } else {
        collapsedLocations.add(loc);
    }
    render();
};

async function saveItemQty(item) {
    if (item.個数 === undefined || item.個数 === null) return;

    const overlay = document.getElementById('inv-loading-overlay');
    overlay.style.setProperty('display', 'flex', 'important');

    try {
        const docRef = doc(db, "m_store_items", item.id);
        const now = new Date().toISOString();
        const finalQty = Number(item.個数);
        const businessDate = getBusinessDate(selectedStore.resetTime);

        await updateDoc(docRef, {
            個数: finalQty,
            updated_at: now
        });

        // 旧ログはそのまま維持
        await addDoc(collection(db, "t_inventory_logs"), {
            InvID: item.id,
            CountValue: finalQty,
            StoreID: selectedStore.code,
            ProductID: item.ProductID,
            Timing: item.確認タイミング,
            InputAt: now,
            StaffEmail: currentUser?.Email || 'unknown'
        });

        // 新履歴コレクションに追加記録
        await addDoc(collection(db, "t_inventory_history"), {
            store_id: selectedStore.code,
            item_id: item.ProductID,
            store_item_id: item.id,
            change_qty: finalQty,
            qty_after: finalQty,
            reason_type: 'stock_check',
            source_route: 'inventory_page',
            note: '',
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            business_date: businessDate
        });

        item.updated_at = now;
        item.個数 = finalQty;
        render(); // 再描画してプログレスを更新
    } catch (err) {
        console.error("Save failed:", err);
        showAlert('エラー', '保存に失敗しました: ' + err.message);
    } finally {
        overlay.style.setProperty('display', 'none', 'important');
    }
}

// Item settings are now handled via bottom sheet (showItemSettingsModal)

async function saveLocationChange() {
    const newLoc = document.getElementById('loc-edit-input').value.trim();
    const newParStock = Number(document.getElementById('loc-par-stock-input').value) || 0;

    const overlay = document.getElementById('inv-loading-overlay');
    overlay.style.setProperty('display', 'flex', 'important');

    try {
        const docRef = doc(db, "m_store_items", editingItem.id);
        await updateDoc(docRef, {
            location_label: newLoc,
            保管場所: newLoc,
            定数: newParStock
        });
        editingItem.location_label = newLoc;
        editingItem.保管場所 = newLoc;
        editingItem.定数 = newParStock;
        document.getElementById('loc-edit-modal').style.setProperty('display', 'none', 'important');
        render();
    } catch (err) {
        alert("保存エラー: " + err.message);
    } finally {
        overlay.style.setProperty('display', 'none', 'important');
    }
}

async function toggleItemConfirmation(id) {
    const item = inventoryData.find(i => i.id === id);
    if (!item) return;

    const isConfirmed = isConfirmedToday(item.confirmed_at, selectedStore.resetTime, item.is_confirmed);
    const newConfirmed = !isConfirmed;
    const now = new Date().toISOString();

    const overlay = document.getElementById('inv-loading-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        const docRef = doc(db, "m_store_items", id);
        await updateDoc(docRef, {
            is_confirmed: newConfirmed,
            updated_at: now,
            confirmed_at: newConfirmed ? now : null,
            confirmed_by: newConfirmed ? (currentUser?.Name || 'unknown') : null
        });

        // 履歴ログ
        await addDoc(collection(db, "t_inventory_history"), {
            store_id: selectedStore.code,
            item_id: item.ProductID,
            store_item_id: item.id,
            reason_type: 'confirmation_toggle',
            note: newConfirmed ? '確定' : '未確定に戻す',
            executed_by: currentUser?.Name || 'unknown',
            executed_at: now,
            business_date: getBusinessDate(selectedStore.resetTime)
        });

        await loadStoreInventory(selectedStore.code);
        render();
    } catch (err) {
        console.error("Toggle confirmation failed:", err);
        alert("確定状態の変更に失敗しました");
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

async function handleSectionConfirm(locationName) {
    const itemsInSection = inventoryData.filter(d => 
        d.確認タイミング === selectedTiming.id && 
        (d.location_label || d.保管場所 || '未設定') === locationName
    );

    if (itemsInSection.length === 0) return;

    const confirmed = confirm(`「${locationName}」の全 ${itemsInSection.length} 品目を完了にしますか？`);
    if (!confirmed) return;

    const overlay = document.getElementById('inv-loading-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        const bizDate = getBusinessDate(selectedStore.resetTime);

        itemsInSection.forEach(item => {
            const docRef = doc(db, "m_store_items", item.id);
            batch.update(docRef, {
                is_confirmed: true,
                updated_at: now,
                confirmed_at: now,
                confirmed_by: currentUser?.Name || 'unknown'
            });
        });

        const historyRef = doc(collection(db, "t_inventory_history"));
        batch.set(historyRef, {
            store_id: selectedStore.code,
            item_id: 'SECTION_CONFIRM',
            store_item_id: locationName,
            reason_type: 'section_confirm',
            note: `棚 [${locationName}] を一括完了`,
            executed_by: currentUser?.Name || 'unknown',
            executed_at: now,
            business_date: bizDate
        });

        await batch.commit();
        await loadStoreInventory(selectedStore.code);
        render();
    } catch (err) {
        console.error("Section confirm failed:", err);
        alert("一括完了に失敗しました");
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

export async function initInventoryMobilePage(user) {
    currentUser = user;
    console.log("Initializing Inventory Page (Mobile-First)...");
    selectedStore = null;
    selectedTiming = null;
    inventoryData = [];
    currentTab = 'tiles';

    // Hide global FAB while on this page to avoid UI collision
    const globalFab = document.getElementById('fab-main-btn');
    if (globalFab) globalFab.style.display = 'none';

    await loadInitialData();

    // パンくずリストの手動更新
    const mbArea = document.getElementById('mobile-breadcrumb-area');
    if (mbArea) {
        mbArea.innerHTML = `
            <span onclick="window.navigateTo('home')">ホーム</span>
            <i class="fas fa-chevron-right"></i>
            <span onclick="window.navigateTo('ops_hub')">店舗業務</span>
            <i class="fas fa-chevron-right"></i>
            <span>在庫チェック</span>
        `;
    }

    const titleEl = document.getElementById('page-title-mobile-central');
    if (titleEl) titleEl.textContent = '在庫チェック';

    // ユーザーに紐づく店舗を自動選択
    if (user) {
        const userStoreId = user.StoreID || user.Store || user.所属店舗;
        if (userStoreId) {
            const autoSelect = allStores.find(s => s.code === userStoreId || s.id === userStoreId || s.name === userStoreId);
            if (autoSelect) {
                console.log("Auto-selecting store for user:", autoSelect.name);
                selectedStore = autoSelect;
                // 店舗が選択されたので在庫も読み込む
                try {
                    await loadStoreInventory(autoSelect.code);
                } catch (e) {
                    console.error("Auto-load failed:", e);
                }
            }
        }
    }

    render();
}

function openInvSettings() {
    showMasterSettings();
}

/**
 * スマホ向け在庫マスタ設定ビューを生成
 */
function renderSettingsView(container) {
    if (!selectedStore) return;

    // 初期化状態の管理
    if (!settingsInitialized) {
        settingsCollapsedTimings = new Set(Object.keys(timingMaster));
        settingsCurrentTab = 'catalog'; // デフォルトタブ
        settingsInitialized = true;
    }

    const manageableItems = cachedItems.filter(isInventoryTarget);
    const categories = [...new Set(manageableItems.map(i => i.category || i.カテゴリー || 'その他'))].sort();
    const vendors = [...new Set(cachedSuppliers.map(s => s.vendor_name).filter(Boolean))].sort();

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%; background: #f8fafc;">
            <!-- Internal Tab Navigation -->
            <nav style="display: flex; background: white; border-bottom: 1px solid #e2e8f0; padding: 0.5rem; gap: 0.4rem; flex-shrink: 0;">
                <button class="settings-tab-btn ${settingsCurrentTab === 'catalog' ? 'active' : ''}" onclick="window.switchSettingsTab('catalog')">カタログ</button>
                <button class="settings-tab-btn ${settingsCurrentTab === 'list' ? 'active' : ''}" onclick="window.switchSettingsTab('list')">管理リスト</button>
                <button class="settings-tab-btn ${settingsCurrentTab === 'timing' ? 'active' : ''}" onclick="window.switchSettingsTab('timing')">タイミング</button>
            </nav>

            <div style="flex: 1; overflow-y: auto; padding: 1rem;">
                ${settingsCurrentTab === 'catalog' ? `
                    <!-- Catalog View -->
                    <div class="animate-fade-in">
                        <div style="background: white; padding: 1.2rem; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.8rem;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                                <div class="pro-form-field">
                                    <label class="pro-form-label">業者</label>
                                    <select id="settings-supplier-filter" class="mobile-input-v2" style="height: 40px; font-size: 0.85rem;">
                                        <option value="ALL">すべて</option>
                                        ${vendors.map(v => `<option value="${v}" ${settingsSelectedSupplier === v ? 'selected' : ''}>${v}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="pro-form-field">
                                    <label class="pro-form-label">カテゴリ</label>
                                    <select id="settings-category-filter" class="mobile-input-v2" style="height: 40px; font-size: 0.85rem;">
                                        <option value="ALL">すべて</option>
                                        ${categories.map(c => `<option value="${c}" ${settingsSelectedCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="pro-form-field">
                                <label class="pro-form-label">キーワード検索</label>
                                <div style="position: relative;">
                                    <i class="fas fa-search" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;"></i>
                                    <input type="text" id="inv-master-search-new" value="${settingsSearchQuery}" placeholder="品目名で検索..." class="mobile-input-v2" style="height: 40px; padding-left: 2.2rem; font-size: 0.9rem;">
                                </div>
                            </div>
                        </div>

                        <div id="inv-master-catalog-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <!-- Items injected here -->
                        </div>
                    </div>
                ` : settingsCurrentTab === 'list' ? `
                    <!-- Management List View -->
                    <div class="animate-fade-in">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0 0.5rem;">
                            <div style="font-size: 0.9rem; font-weight: 900; color: #1e293b;">登録済み: ${inventoryData.length}品目</div>
                        </div>
                        <div id="inv-settings-store-list" style="display: flex; flex-direction: column; gap: 0.8rem;">
                            <!-- Grouped list injected here -->
                        </div>
                    </div>
                ` : `
                    <!-- Timing Master View -->
                    <div class="animate-fade-in">
                        <div style="background: white; padding: 1.2rem; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 1.2rem;">
                            <h3 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 900;">新しいタイミングを追加</h3>
                            <div style="display: flex; gap: 0.8rem;">
                                <input type="text" id="new-timing-name-new" placeholder="例: 深夜チェック" class="mobile-input-v2" style="flex: 1;">
                                <button id="btn-add-timing-new" class="btn-confirm-mobile active" style="width: 50px; height: 50px; border-radius: 12px;"><i class="fas fa-plus"></i></button>
                            </div>
                        </div>
                        <div id="timing-master-list-new" style="display: flex; flex-direction: column; gap: 0.8rem;">
                            <!-- Timings injected here -->
                        </div>
                    </div>
                `}
            </div>

            ${settingsCurrentTab === 'catalog' ? `
                <div style="padding: 1rem; background: white; border-top: 1px solid #e2e8f0; display: flex; gap: 0.8rem; flex-shrink: 0;">
                    <button id="btn-bulk-add-catalog" class="btn-action-mobile" style="flex: 1; height: 54px;">選択した品目を一括追加</button>
                </div>
            ` : ''}
        </div>

        <style>
            .settings-tab-btn {
                flex: 1;
                height: 40px;
                border: none;
                background: #f1f5f9;
                color: #64748b;
                border-radius: 8px;
                font-weight: 800;
                font-size: 0.85rem;
                transition: all 0.2s;
            }
            .settings-tab-btn.active {
                background: var(--primary);
                color: white;
                box-shadow: 0 4px 12px rgba(230, 57, 70, 0.1);
            }
        </style>
    `;

    // Events
    if (settingsCurrentTab === 'catalog') {
        const supplierInput = document.getElementById('settings-supplier-filter');
        supplierInput.onchange = (e) => {
            settingsSelectedSupplier = e.target.value;
            renderSettingsItems();
        };
        const categoryInput = document.getElementById('settings-category-filter');
        categoryInput.onchange = (e) => {
            settingsSelectedCategory = e.target.value;
            renderSettingsItems();
        };
        const searchInput = document.getElementById('inv-master-search-new');
        searchInput.oninput = (e) => {
            settingsSearchQuery = e.target.value;
            renderSettingsItems();
        };
        document.getElementById('btn-bulk-add-catalog').onclick = async () => {
            const checkedPids = Array.from(document.querySelectorAll('.catalog-chk:checked')).map(el => el.value);
            if (checkedPids.length === 0) return;
            if (!confirm(`${checkedPids.length}件の品目を一括登録しますか？`)) return;
            await handleBulkAddPids(checkedPids);
        };
        renderSettingsItems();
    } else if (settingsCurrentTab === 'list') {
        renderSettingsItems();
    } else if (settingsCurrentTab === 'timing') {
        document.getElementById('btn-add-timing-new').onclick = addTimingMaster;
        renderTimingMasterList();
    }
}

window.switchSettingsTab = (tab) => {
    settingsCurrentTab = tab;
    const container = document.getElementById('inv-master-settings-content');
    renderSettingsView(container);
};


function handleQuickAddSearch(query) {
    // This is now replaced by the persistent catalog column
}

async function handleBulkAddSave() {
    const checkedPids = Array.from(document.querySelectorAll('.bulk-add-chk:checked')).map(el => el.value);
    if (checkedPids.length === 0) return;

    if (!confirm(`${checkedPids.length}件の品目を一括登録しますか？`)) return;

    const overlay = document.getElementById('inv-loading-overlay');
    overlay.style.display = 'flex';

    const fallbackTimingId = Object.keys(timingMaster)[0] || "DAILY_ALL";

    try {
        for (const pid of checkedPids) {
            const docId = `${selectedStore.code}_${pid}`;
            await setDoc(doc(db, "m_store_items", docId), {
                StoreID: selectedStore.code,
                ProductID: pid,
                確認タイミング: fallbackTimingId,
                定数: 0,
                location_label: "未配置",
                保管場所: "未配置",
                is_confirmed: false,
                個数: 0,
                updated_at: new Date().toISOString()
            });
        }
        await loadStoreInventory(selectedStore.code);
        settingsBulkMode = false; // Return to list view
        renderSettingsView(document.getElementById('inv-master-settings-content'));
        render(); // Update dashboard
        showAlert('成功', '品目を一括登録しました');
    } catch (err) {
        showAlert('エラー', '登録失敗: ' + err.message);
    } finally {
        overlay.style.display = 'none';
    }
}

function handleMasterSearch(query) {
    const resultsContainer = document.getElementById('inv-master-search-results');
    if (!query || query.length < 1) {
        resultsContainer.style.display = 'none';
        return;
    }

    // Filter master items that ARE NOT already in inventoryData
    const existingPids = new Set(inventoryData.map(i => String(i.ProductID)));
    
    // Find matching items (excluding sales menus as per user request)
    const matches = cachedItems.filter(i => {
        const q = query.toLowerCase();
        const nameMatch = (i.name || '').toLowerCase().includes(q);
        const furiganaMatch = (i.furigana || i.ふりがな || '').toLowerCase().includes(q);
        if (!nameMatch && !furiganaMatch) return false;
        
        // Exclude menus
        const menu = cachedMenus.find(m => String(m.item_id) === String(i.id));
        if (menu && menu.is_sub_recipe !== true) return false;
        
        // Exclude already added
        if (existingPids.has(String(i.id))) return false;
        
        return true;
    }).slice(0, 10); // Limit to top 10 for performance

    if (matches.length === 0) {
        resultsContainer.innerHTML = `<div style="padding: 1rem; color: var(--text-secondary); font-size: 0.85rem;">該当する品目はありません</div>`;
    } else {
        resultsContainer.innerHTML = matches.map(i => `
            <div class="search-result-row" data-id="${i.id}" style="padding: 0.8rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.1s;">
                <div style="font-size: 0.9rem; font-weight: 700;">${i.name}</div>
                <div style="font-size: 0.7rem; color: var(--text-secondary);">${i.category || 'カテゴリーなし'}</div>
            </div>
        `).join('');
    }

    resultsContainer.style.display = 'block';

    // Click to add
    resultsContainer.querySelectorAll('.search-result-row').forEach(row => {
        row.onclick = async () => {
            const pid = row.dataset.id;
            resultsContainer.style.display = 'none';
            document.getElementById('inv-master-add-search').value = '';
            await addStoreItem(pid);
        };
    });
}

async function addStoreItem(pid) {
    if (!selectedStore) return;
    const overlay = document.getElementById('inv-loading-overlay');
    overlay.style.display = 'flex';

    const fallbackTimingId = Object.keys(timingMaster)[0] || "DAILY_ALL";

    try {
        const docId = `${selectedStore.code}_${pid}`;
        await setDoc(doc(db, "m_store_items", docId), {
            StoreID: selectedStore.code,
            ProductID: pid,
            確認タイミング: "",
            定数: 0,
            location_label: "未配置",
            保管場所: "未配置",
            is_confirmed: false,
            個数: 0,
            updated_at: new Date().toISOString()
        });
        
        // Re-load and re-render
        await loadStoreInventory(selectedStore.code);
        renderSettingsItems();
        render(); // Update main dashboard
    } catch (err) {
        showAlert('エラー', '追加に失敗しました: ' + err.message);
    } finally {
        overlay.style.display = 'none';
    }
}

async function removeStoreItem(storeItemId) {
    // 削除対象のProductIDを取得
    const itemToDelete = inventoryData.find(i => i.id === storeItemId);
    if (!itemToDelete) return;

    if (!confirm('この品目を管理リストから削除しますか？\n(定数や保管場所の設定データも消去されます)')) return;
    
    const overlay = document.getElementById('inv-loading-overlay');
    if(overlay) overlay.style.display = 'flex';

    try {
        // 1. 他店からの参照チェック（逆引きガード）
        const q = query(collection(db, "m_store_items"), 
                        where("default_source_store_id", "==", selectedStore.code),
                        where("ProductID", "==", itemToDelete.ProductID));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const depStoreNames = snap.docs.map(d => {
                const sCode = d.data().StoreID;
                const store = allStores.find(s => s.code === sCode || s.id === sCode);
                return store ? store.name : sCode;
            });
            
            const warningMsg = `【重要：削除警告】\nこの品目は以下の店舗で「移動元」として設定されています：\n\n・${depStoreNames.join('\n・')}\n\nここで削除すると、これらの店舗で在庫移動（入庫）が行えなくなります。\n本当に削除してもよろしいですか？`;
            
            if (!confirm(warningMsg)) {
                if(overlay) overlay.style.display = 'none';
                return;
            }
        }

        // 2. 削除処理の実行
        // Optimistic delete from local data
        inventoryData = inventoryData.filter(i => i.id !== storeItemId);
        renderSettingsItems();
        render();

        await deleteDoc(doc(db, "m_store_items", storeItemId));
        await loadStoreInventory(selectedStore.code);
        renderSettingsItems();
        render();
    } catch (err) {
        showAlert('エラー', '削除に失敗しました: ' + err.message);
        await loadStoreInventory(selectedStore.code);
        renderSettingsItems();
    } finally {
        if(overlay) overlay.style.display = 'none';
    }
}

function renderSettingsItems() {
    const catalogContainer = document.getElementById('inv-master-catalog-list');
    const storeContainer = document.getElementById('inv-settings-store-list');
    if (!catalogContainer || !storeContainer) return;

    // --- 1. Render Master Catalog (Items NOT in store) ---
    const existingPids = new Set(inventoryData.map(i => String(i.ProductID)));
    let catalogItems = cachedItems.filter(i => isInventoryTarget(i) && !existingPids.has(String(i.id)));

    // Filters for Catalog
    if (settingsSelectedCategory !== 'ALL') {
        catalogItems = catalogItems.filter(i => (i.category || i.カテゴリー || 'その他') === settingsSelectedCategory);
    }
    if (settingsSelectedSupplier !== 'ALL') {
        catalogItems = catalogItems.filter(i => {
            const ing = cachedIngredients.find(ing => String(ing.item_id) === String(i.id));
            const sup = cachedSuppliers.find(s => String(s.vendor_id || s.id) === String(ing?.vendor_id));
            return sup?.vendor_name === settingsSelectedSupplier;
        });
    }
    if (settingsSearchQuery) {
        const q = settingsSearchQuery.toLowerCase();
        catalogItems = catalogItems.filter(i => (i.name || '').toLowerCase().includes(q) || (i.furigana || i.ふりがな || '').toLowerCase().includes(q));
    }

    catalogItems.sort((a,b) => (a.name || '').localeCompare(b.name || ''));

    catalogContainer.innerHTML = catalogItems.length === 0 ? 
        `<div style="padding:2rem; text-align:center; color:var(--text-secondary); font-size:0.8rem;">該当する品目はありません</div>` :
        catalogItems.map(i => {
            const ing = cachedIngredients.find(ing => String(ing.item_id) === String(i.id));
            const sup = cachedSuppliers.find(s => String(s.vendor_id || s.id) === String(ing?.vendor_id));
            const vendorName = sup ? sup.vendor_name : '自社仕込';

            return `
                <div style="display: flex; align-items: center; padding: 0.6rem 0.8rem; background: white; border-radius: 8px; margin-bottom: 0.4rem; border: 1px solid #f1f5f9; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <input type="checkbox" class="catalog-chk" value="${i.id}" style="margin-right: 0.8rem; width: 16px; height: 16px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${i.name}</div>
                        <div style="font-size: 0.65rem; color: var(--text-secondary); display: flex; gap: 0.4rem; align-items: center;">
                            <span>${i.category || '未分類'}</span>
                            <span style="color: #e2e8f0;">|</span>
                            <span style="font-weight: 700; color: #64748b;">${vendorName}</span>
                        </div>
                    </div>
                    <button class="btn-quick-add" data-id="${i.id}" style="background: var(--surface-darker); border: 1px solid var(--border); color: var(--primary); padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 800;">
                        <i class="fas fa-plus"></i> 追加
                    </button>
                </div>
            `;
        }).join('');

    catalogContainer.querySelectorAll('.btn-quick-add').forEach(btn => {
        btn.onclick = async () => {
            const pid = btn.dataset.id;
            await addStoreItem(pid);
        };
    });


    // --- 2. Render Store Management List (Accordion by Timing) ---
    const timingIds = [...new Set(inventoryData.map(d => d.確認タイミング || ''))];
    Object.keys(timingMaster).forEach(tId => { if(!timingIds.includes(tId)) timingIds.push(tId); });

    const sortedTimingIds = timingIds.sort((a,b) => {
        if (a === '') return -1;
        if (b === '') return 1;
        const countA = inventoryData.filter(d => (d.確認タイミング || '') === a).length;
        const countB = inventoryData.filter(d => (d.確認タイミング || '') === b).length;
        return countB - countA;
    });

    let html = '';
    sortedTimingIds.forEach(tId => {
        const items = inventoryData.filter(d => (d.確認タイミング || '') === tId);
        if (items.length === 0) return;

        const tName = tId ? (timingMaster[tId] || tId) : "⚠️ タイミング未設定";
        const isCollapsed = settingsCollapsedTimings.has(tId);
        
        html += `
            <div class="timing-accordion-v2" style="margin-bottom: 0.8rem; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div class="timing-header-btn" data-id="${tId}" style="display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem 1rem; background: ${isCollapsed ? '#fff' : '#f8fafc'}; cursor: pointer; user-select: none; transition: background 0.2s;">
                    <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" style="width: 1rem; color: #94a3b8; font-size: 0.8rem;"></i>
                    <span style="font-size: 0.85rem; font-weight: 800; color: #1e293b; flex: 1;">${tName}</span>
                    <span style="font-size: 0.65rem; color: var(--text-secondary); background: #f1f5f9; padding: 0.1rem 0.6rem; border-radius: 10px; font-weight: 700;">${items.length}品目</span>
                </div>
                <div style="display: ${isCollapsed ? 'none' : 'block'}; border-top: 1px solid #f1f5f9;">
                    ${items.length === 0 ? 
                        `<div style="padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.75rem;">このタイミングに登録された品目はありません</div>` :
                        items.map(item => {
                            const name = productMap[item.ProductID] || '不明';
                            return `
                                <div style="display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem 1rem; border-bottom: 1px solid #f1f5f9;">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.display_name || name}</div>
                                        <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.1rem;">${item.location_label || '場所未設定'} / ${item.定数 || 0} ${item.display_unit || ''}</div>
                                    </div>
                                    <div style="display: flex; gap: 0.4rem;">
                                        <button class="btn-edit-item-master" data-id="${item.id}" style="width: 34px; height: 34px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; color: #64748b; cursor: pointer; transition: all 0.2s;"><i class="fas fa-cog"></i></button>
                                        <button class="btn-remove-item" data-id="${item.id}" style="width: 34px; height: 34px; border-radius: 10px; border: 1px solid #fee2e2; background: white; color: #ef4444; cursor: pointer; transition: all 0.2s;"><i class="fas fa-trash-alt"></i></button>
                                    </div>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        `;
    });

    storeContainer.innerHTML = html || `<div style="padding:4rem; text-align:center; color:var(--text-secondary);">管理リストは空です</div>`;

    // Accordion Toggle Listeners
    storeContainer.querySelectorAll('.timing-header-btn').forEach(btn => {
        btn.onclick = () => {
            const tId = btn.dataset.id;
            if (settingsCollapsedTimings.has(tId)) {
                settingsCollapsedTimings.delete(tId);
            } else {
                settingsCollapsedTimings.add(tId);
            }
            renderSettingsItems();
        };
    });

    storeContainer.querySelectorAll('.btn-edit-item-master').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const item = inventoryData.find(i => i.id === id);
            if(item) showItemSettingsModal(id);
        };
    });

    storeContainer.querySelectorAll('.btn-remove-item').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            removeStoreItem(btn.dataset.id);
        };
    });
}

async function handleBulkAddPids(pids) {
    const overlay = document.getElementById('inv-loading-overlay');
    if(overlay) overlay.style.display = 'flex';

    const fallbackTimingId = Object.keys(timingMaster)[0] || "DAILY_ALL";

    try {
        const batch = [];
        for (const pid of pids) {
            const docId = `${selectedStore.code}_${pid}`;
            batch.push(setDoc(doc(db, "m_store_items", docId), {
                StoreID: selectedStore.code,
                ProductID: pid,
                確認タイミング: "",
                定数: 0,
                location_label: "未配置",
                保管場所: "未配置",
                is_confirmed: false,
                個数: 0,
                updated_at: new Date().toISOString()
            }));
        }
        await Promise.all(batch);
        await loadStoreInventory(selectedStore.code);
        renderSettingsItems();
        render(); 
        showAlert('成功', `${pids.length}件の品目を追加しました`);
    } catch (err) {
        showAlert('エラー', '一括追加に失敗しました: ' + err.message);
    } finally {
        if(overlay) overlay.style.display = 'none';
    }
}

async function renderTimingMasterList() {
    const list = document.getElementById('timing-master-list-new');
    if (!list) return;
    
    list.innerHTML = Object.keys(timingMaster).map(id => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0;">
            <span style="font-size: 0.85rem; font-weight: 600;">${timingMaster[id]}</span>
            <button onclick="window.deleteTimingMaster('${id}')" style="background:none; border:none; color:var(--accent); cursor:pointer;"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

window.deleteTimingMaster = async (id) => {
    if (!confirm('このタイミング設定を削除しますか？品目に設定されている場合は注意してください。')) return;
    try {
        await deleteDoc(doc(db, "m_check_timings", id));
        delete timingMaster[id];
        renderSettingsItems();
        renderTimingMasterList();
    } catch (err) {
        alert('削除エラー: ' + err.message);
    }
};

async function addTimingMaster() {
    const name = document.getElementById('new-timing-name-new').value.trim();
    if (!name) return;
    try {
        const id = 'T' + Date.now();
        await setDoc(doc(db, "m_check_timings", id), { ID: id, 確認タイミング: name });
        timingMaster[id] = name;
        document.getElementById('new-timing-name-new').value = '';
        renderSettingsItems();
        renderTimingMasterList();
    } catch (err) {
        alert('追加エラー: ' + err.message);
    }
}

async function loadStoreInventory(internalCode) {
    if (!internalCode) {
        console.warn("loadStoreInventory called without internalCode");
        return;
    }
    const main = document.getElementById('inv-main-content');
    if (main) main.innerHTML = `<div style="text-align:center; padding: 4rem;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i><p style="margin-top:1rem; font-weight:600;">データを取得中...</p></div>`;

    try {
        console.log("Loading inventory for store:", internalCode);
        const q = query(collection(db, "m_store_items"), where("StoreID", "==", internalCode));
        const snap = await getDocs(q);
        
        inventoryData = [];
        snap.forEach(d => {
            const data = d.data();
            inventoryData.push({ id: d.id, ...data });
        });
        
        console.log(`Fetched ${inventoryData.length} items. Calculating theoretical stocks...`);
        
        try {
            await loadTheoreticalStocks(internalCode);
        } catch (stockErr) {
            console.error("Theoretical stock calculation failed, but continuing:", stockErr);
        }
        
        console.log("Inventory load complete.");
    } catch (err) {
        console.error("Error loading store inventory:", err);
        if (main) {
            main.innerHTML = `
                <div style="text-align:center; padding: 3rem; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>データの取得に失敗しました</p>
                    <p style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.5rem;">${err.message}</p>
                    <button onclick="location.reload()" class="btn btn-secondary" style="margin-top: 1rem;">再読み込み</button>
                </div>
            `;
        }
        throw err; 
    }
}



function renderChips(type, dataList) {
    const container = document.getElementById(type === 'category' ? 'inv-settings-category-chips' : 'inv-settings-supplier-chips');
    if (!container) return;

    const label = type === 'category' ? 'カテゴリー' : '仕入先';
    const selected = type === 'category' ? settingsSelectedCategory : settingsSelectedSupplier;

    let html = `<span style="color: var(--text-secondary); white-space: nowrap; margin-right:5px;">${label}:</span>`;

    // 「すべて」チップ
    html += `<span class="chip ${!selected ? 'active' : ''}" onclick="window.toggleInvFilter('${type}', null)">すべて</span>`;

    dataList.forEach(item => {
        const val = type === 'category' ? item : (item.vendor_id || item.id);
        const text = type === 'category' ? item : item.vendor_name;
        html += `<span class="chip ${selected === val ? 'active' : ''}" onclick="window.toggleInvFilter('${type}', '${val}')">${text}</span>`;
    });

    container.innerHTML = html;
}

window.toggleInvFilter = (type, value) => {
    if (type === 'category') settingsSelectedCategory = (settingsSelectedCategory === value) ? null : value;
    else settingsSelectedSupplier = (settingsSelectedSupplier === value) ? null : value;
    renderSettingsItems();
};

async function saveInvSettings() {
    if (!selectedStore) return;
    const overlay = document.getElementById('inv-loading-overlay');
    overlay.style.display = 'flex';

    // 1. Identify manageable items (Only those visible in the settings tabs)
    const manageablePids = new Set(cachedItems.filter(i => {
        const menu = cachedMenus.find(m => m.item_id === i.id);
        const isSub = menu && (menu.is_sub_recipe === true);
        const isIng = cachedIngredients.some(ing => ing.item_id === i.id) || !menu;
        return isSub || isIng; // Exclude regular sales menus
    }).map(i => i.id));

    const checkedIds = Array.from(tempSelectedPids);
    const existingIds = inventoryData.map(i => i.ProductID);

    // 2. Determine Add/Remove scope
    // We ONLY remove if it was an item we could have managed (is in manageablePids) 
    // AND it is no longer in our selection.
    const toRemove = Array.from(manageablePids).filter(pid => 
        existingIds.includes(pid) && !tempSelectedPids.has(pid)
    );
    const toAdd = checkedIds.filter(id => !existingIds.includes(id));

    // 3. Fallback timing (Pick the first valid one from master)
    const fallbackTimingId = Object.keys(timingMaster)[0] || "DAILY_ALL";

    try {
        // Bulk delete (Scoped)
        for (const pid of toRemove) {
            await deleteDoc(doc(db, "m_store_items", `${selectedStore.code}_${pid}`));
        }
        // Bulk add
        for (const pid of toAdd) {
            await setDoc(doc(db, "m_store_items", `${selectedStore.code}_${pid}`), {
                StoreID: selectedStore.code,
                ProductID: pid,
                確認タイミング: fallbackTimingId,
                定数: 0,
                location_label: "未配置",
                保管場所: "未配置",
                is_confirmed: false,
                個数: 0,
                updated_at: new Date().toISOString()
            });
        }
        
        showAlert('成功', '在庫管理対象を更新しました。詳細設定は各品目の⚙️アイコンから行ってください。');
        hideMasterSettings();
        await loadStoreInventory(selectedStore.code);
        render();
    } catch (err) {
        console.error(err);
        showAlert('エラー', '保存失敗: ' + err.message);
    } finally { 
        overlay.style.display = 'none'; 
    }
}

function showItemSettingsModal(itemId) {
    const item = inventoryData.find(i => i.id === itemId);
    if (!item) return;
    
    editingItem = item;
    const sheet = document.getElementById('inv-item-settings-sheet');
    document.getElementById('sheet-item-name').textContent = productMap[item.ProductID] || '品目設定';
    
    let masterUnit = '-';
    const rawItem = cachedItems.find(i => i.id === item.ProductID);
    if (rawItem) masterUnit = rawItem.unit || rawItem.単位 || '-';
    if (masterUnit === '-') {
        const ing = cachedIngredients.find(i => i.item_id === item.ProductID);
        if (ing) masterUnit = ing.unit || ing.単位 || '-';
    }
    document.getElementById('sheet-master-unit').textContent = masterUnit;
    
    const timingSelect = document.getElementById('sheet-timing');
    timingSelect.innerHTML = Object.keys(timingMaster).map(id => `<option value="${id}">${timingMaster[id]}</option>`).join('');
    
    timingSelect.value = item.確認タイミング || "DAILY_ALL";
    document.getElementById('sheet-display-name').value = item.display_name || "";
    document.getElementById('sheet-location').value = item.location_label || item.保管場所 || "";
    document.getElementById('sheet-par').value = item.定数 || 0;
    document.getElementById('sheet-unit').value = item.display_unit || "";
    document.getElementById('sheet-conv').value = item.unit_conversion_amount || 1;
    document.getElementById('sheet-action').value = item.shortage_action_type || "purchase";
    
    const unitInput = document.getElementById('sheet-unit');
    const unitPreview = document.getElementById('sheet-unit-preview');
    const updateUnitPreview = () => {
        const val = unitInput.value || '単位';
        unitPreview.textContent = `1 ${val} ＝`;
    };
    unitInput.oninput = updateUnitPreview;
    updateUnitPreview();
    
    const sourceContainer = document.getElementById('sheet-source-store-container');
    const sourceSelect = document.getElementById('sheet-source-store');
    const actionSelect = document.getElementById('sheet-action');
    
    const updateSourceVisibility = async () => {
        if (actionSelect.value === 'transfer') {
            sourceContainer.style.display = 'block';
            const currentStoreData = allStores.find(s => s.code === selectedStore.code);
            const currentGroup = currentStoreData?.group_name;
            const sameGroupStores = allStores.filter(s => s.code !== selectedStore.code && s.group_name === currentGroup);
            
            sourceSelect.innerHTML = sameGroupStores.map(s => `<option value="${s.code}" ${s.code === item.default_source_store_id ? 'selected' : ''}>${s.name}</option>`).join('') || '<option value="">(グループ内店舗なし)</option>';
            
            if (sourceSelect.value) {
                const sid = `${sourceSelect.value}_${item.ProductID}`;
                const sDoc = await getDoc(doc(db, "m_store_items", sid));
                if (sDoc.exists()) {
                    const sData = sDoc.data();
                    document.getElementById('sheet-unit').value = sData.display_unit || "";
                    document.getElementById('sheet-conv').value = sData.unit_conversion_amount || 1;
                    document.getElementById('sheet-unit').readOnly = true;
                    document.getElementById('sheet-conv').readOnly = true;
                    document.getElementById('sheet-unit').style.background = "#f1f5f9";
                    document.getElementById('sheet-conv').style.background = "#f1f5f9";
                }
            }
        } else {
            sourceContainer.style.display = 'none';
            document.getElementById('sheet-unit').readOnly = false;
            document.getElementById('sheet-conv').readOnly = false;
            document.getElementById('sheet-unit').style.background = "";
            document.getElementById('sheet-conv').style.background = "";
        }
        updateUnitPreview();
    };

    actionSelect.onchange = updateSourceVisibility;
    sourceSelect.onchange = updateSourceVisibility;
    updateSourceVisibility();

    sheet.style.display = 'flex';
    document.getElementById('btn-sheet-save').onclick = saveItemSettings;
}

window.closeItemSettings = () => {
    document.getElementById('inv-item-settings-sheet').style.display = 'none';
};

async function saveItemSettings() {
    if (!editingItem) return;
    const overlay = document.getElementById('inv-loading-overlay');
    overlay.style.display = 'flex';

    const data = {
        確認タイミング: document.getElementById('sheet-timing').value,
        display_name: document.getElementById('sheet-display-name').value.trim(),
        location_label: document.getElementById('sheet-location').value,
        保管場所: document.getElementById('sheet-location').value,
        定数: Number(document.getElementById('sheet-par').value) || 0,
        display_unit: document.getElementById('sheet-unit').value,
        unit_conversion_amount: Number(document.getElementById('sheet-conv').value) || 1,
        shortage_action_type: document.getElementById('sheet-action').value,
        default_source_store_id: document.getElementById('sheet-action').value === 'transfer' ? document.getElementById('sheet-source-store').value : null,
        updated_at: new Date().toISOString()
    };

    if (data.shortage_action_type === 'transfer' && data.default_source_store_id) {
        try {
            const sourceDoc = await getDoc(doc(db, "m_store_items", `${data.default_source_store_id}_${editingItem.ProductID}`));
            if (!sourceDoc.exists()) {
                if (!confirm('【警告】選択された移動元店舗に、この品目が登録されていません。このまま保存しますか？')) {
                    overlay.style.display = 'none';
                    return;
                }
            }
        } catch (e) { console.error(e); }
    }

    try {
        await updateDoc(doc(db, "m_store_items", editingItem.id), data);
        
        // Dependency sync
        const q = query(collection(db, "m_store_items"), 
                        where("ProductID", "==", editingItem.ProductID),
                        where("default_source_store_id", "==", selectedStore.code));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const batch = writeBatch(db);
            snap.forEach(d => {
                batch.update(d.ref, {
                    display_unit: data.display_unit,
                    unit_conversion_amount: data.unit_conversion_amount,
                    updated_at: data.updated_at
                });
            });
            await batch.commit();
        }

        Object.assign(editingItem, data);
        closeItemSettings();
        render();
        if (settingsCurrentTab === 'list') renderSettingsItems();
    } catch (err) {
        alert('保存エラー: ' + err.message);
    } finally { overlay.style.display = 'none'; }
}
