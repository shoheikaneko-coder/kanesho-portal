import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where, orderBy, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { calculateAllTheoreticalStocks } from './stock_logic.js';

export const inventoryPageHtml = `
    <div id="inventory-app" class="animate-fade-in" style="display: flex; height: calc(100vh - 120px); gap: 1rem; overflow: hidden; padding: 0 1rem;">
        
        <!-- Sidebar: Store & Timing Selection -->
        <aside id="inv-sidebar" class="glass-panel" style="width: 260px; display: flex; flex-direction: column; gap: 1rem; padding: 1.2rem; flex-shrink: 0;">
            <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem;">拠点選択</label>
                <select id="inv-store-select" class="btn" style="width: 100%; background: white; border: 1px solid var(--border); font-size: 0.9rem;">
                    <option value="">店舗を選択...</option>
                </select>
            </div>

            <div style="flex: 1; overflow-y: auto;">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; margin-top: 1rem;">確認タイミング</label>
                <div id="inv-timing-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <!-- Timings injected here -->
                </div>
            </div>

            <div style="border-top: 1px solid var(--border); padding-top: 1rem;">
                <button id="btn-inv-settings" class="btn" style="width: 100%; padding: 0.6rem; background: var(--surface-darker); color: var(--text-secondary); border: 1px solid var(--border); font-size: 0.8rem; font-weight: 600;">
                    <i class="fas fa-cog"></i> 在庫マスタ設定
                </button>
            </div>
        </aside>

        <!-- Main Area: Inventory Table -->
        <main class="glass-panel" style="flex: 1; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
            <div id="inv-table-header" style="padding: 1rem 1.5rem; border-bottom: 2px solid var(--border); background: var(--surface-darker); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-warehouse" style="color: var(--primary);"></i>
                    <h3 id="inv-current-title" style="margin: 0; font-size: 1rem; font-weight: 800;">在庫チェック</h3>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <button id="btn-toggle-sort" class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px;">
                        <i class="fas fa-arrows-alt-v"></i> 並べ替え
                    </button>
                    <div id="inv-stats" style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;"></div>
                </div>
            </div>
            
            <div id="inv-main-content" style="flex: 1; overflow-y: auto; padding: 0;">
                <!-- Table injected here -->
            </div>
        </main>


        <!-- Modals and Overlays (Same as before but hidden) -->
        <div id="inv-keypad" style="display: none;"></div> <!-- Deprecated mobile keypad wrapper -->
        
        <div id="loc-edit-modal" class="modal-overlay" style="display: none; position: fixed !important; inset: 0 !important; background: rgba(0,0,0,0.5) !important; z-index: 10000 !important; align-items: center; justify-content: center;">
            <div class="glass-panel animate-scale-in" style="width: 100%; max-width: 350px; padding: 1.5rem;">
                <h3 style="margin-top: 0; margin-bottom: 1.2rem; font-size: 1.1rem; color: var(--text-primary);">
                    <i class="fas fa-cog" style="color: var(--primary); margin-right: 0.5rem;"></i>品目設定
                </h3>
                <div class="input-group" style="margin-bottom: 1rem;"><label style="font-size: 0.8rem;">保管場所ラベル</label><input type="text" id="loc-edit-input" list="loc-datalist" placeholder="例: 冷蔵庫A..." style="font-size: 0.9rem; padding: 0.6rem 0.6rem 0.6rem 2rem;"><i class="fas fa-map-marker-alt" style="top: 2rem; font-size: 0.8rem;"></i><datalist id="loc-datalist"></datalist></div>
                <div class="input-group" style="margin-bottom: 1.5rem;"><label style="font-size: 0.8rem;">定数 (Par Stock)</label><input type="number" id="loc-par-stock-input" step="any" placeholder="0" style="font-size: 0.9rem; padding: 0.6rem 0.6rem 0.6rem 2rem;"><i class="fas fa-layer-group" style="top: 2rem; font-size: 0.8rem;"></i></div>
                <div style="display: flex; gap: 0.75rem;"><button id="btn-loc-cancel" class="btn" style="flex: 1; background: #f1f5f9; color: var(--text-secondary); font-size: 0.85rem;">キャンセル</button><button id="btn-loc-save" class="btn btn-primary" style="flex: 1; font-size: 0.85rem;">保存</button></div>
            </div>
        </div>

        <div id="inv-loading-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.7); z-index:9999; justify-content:center; align-items:center;">
             <div class="glass-panel" style="padding: 2rem; text-align:center;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i><p style="margin-top:1rem; font-weight:600;">処理中...</p></div>
        </div>
    </div>

    <style>
        .inventory-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .inventory-table th { position: sticky; top: 0; background: white; z-index: 10; padding: 0.8rem 1rem; text-align: left; font-size: 0.75rem; color: var(--text-secondary); border-bottom: 1px solid var(--border); }
        .inventory-table td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--border); transition: background 0.2s; }
        .inventory-row:hover { background: #f8fafc; }
        .inventory-row.confirmed { background: #f0fdf4 !important; }
        .inventory-row.shortage:not(.confirmed) { background: #fef2f2; border-left: 4px solid #ef4444; }
        
        .timing-item { padding: 0.8rem 1rem; border-radius: 10px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; display: flex; align-items: center; gap: 0.6rem; font-weight: 600; color: var(--text-secondary); }
        .timing-item:hover { background: #f1f5f9; color: var(--text-primary); }
        .timing-item.active { background: white; color: var(--primary); border-color: var(--primary); box-shadow: var(--shadow-sm); }
        
        .qty-stepper-container {
            display: inline-flex;
            align-items: center;
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            margin: 0 auto;
        }
        .qty-stepper-container:focus-within {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(230, 57, 70, 0.1);
            transform: translateY(-1px);
        }
        
        .qty-input { 
            width: 65px !important; 
            height: 44px;
            padding: 0; 
            border: none !important;
            border-left: 1px solid #f1f5f9 !important;
            border-right: 1px solid #f1f5f9 !important;
            border-radius: 0 !important; 
            font-weight: 800; 
            text-align: center; 
            font-size: 1.25rem; 
            color: var(--primary); 
            background: white;
            outline: none;
        }
        
        .stepper-btn {
            width: 44px;
            height: 44px;
            border: none !important;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--text-secondary);
            transition: all 0.2s;
            font-size: 1rem;
        }
        .stepper-btn:hover { 
            background: #f8fafc; 
            color: var(--primary); 
        }
        .stepper-btn:active { 
            background: #f1f5f9;
            transform: scale(0.9); 
        }
        .stepper-btn.minus { border-radius: 0; }
        .stepper-btn.plus { border-radius: 0; }

        @media (max-width: 1024px) {
            #inv-sidebar { width: 220px; }
        }

        /* Inventory Optimized UI Styles */
        .location-banner {
            background: #e2e8f0; /* Slate 200 */
            border-top: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
            padding: 0;
            cursor: pointer;
            user-select: none;
            transition: background 0.2s;
        }
        .location-banner:hover { background: #cbd5e1; }
        .location-banner.completed { background: #dcfce7; }
        
        .location-banner td { padding: 0.5rem 1rem !important; border-left: 5px solid #94a3b8; }
        .location-banner.completed td { border-left-color: #10b981; }

        .location-banner .banner-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            white-space: nowrap;
            color: #334155; /* Slate 700 */
        }

        .location-banner .title { 
            font-weight: 800; 
            font-size: 0.95rem; 
            display: flex; 
            align-items: center; 
            gap: 0.8rem; 
        }
        .location-banner .progress { 
            font-size: 0.75rem; 
            font-weight: 800; 
            color: #64748b; 
            background: rgba(255,255,255,0.5); 
            padding: 0.2rem 0.7rem; 
            border-radius: 12px; 
            border: 1px solid rgba(0,0,0,0.05);
        }
        .location-banner.completed .progress { color: #059669; border-color: #bbf7d0; }

        .inventory-table tr.hidden { display: none; }
        
        .sort-handle { cursor: grab; color: #cbd5e1; padding: 0.5rem; transition: color 0.2s; }
        .inventory-table.sort-mode-active .sort-handle { color: var(--primary); }
        .inventory-table.sort-mode-active .qty-input, .inventory-table.sort-mode-active .stepper-btn { display: none !important; }
        
        .drag-over { border-top: 3px solid var(--primary) !important; background: rgba(230, 57, 70, 0.05); }
    /* Item Detail Settings Modal */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.4);
        backdrop-filter: blur(4px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 2100;
        opacity: 0;
        transition: opacity 0.2s ease;
    }
    .modal-overlay.active {
        display: flex;
        opacity: 1;
    }

    /* Master Settings Large Overlay */
    #inv-master-settings-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(241, 245, 249, 0.95);
        z-index: 2050;
        display: none;
        flex-direction: column;
        padding: 2rem;
        overflow-y: auto;
    }
    #inv-master-settings-overlay.active {
        display: flex;
    }
    </style>

    <!-- Item Detail Settings Modal -->
    <div id="inv-item-modal" class="modal-overlay">
        <div class="glass-panel animate-scale-in" style="width: 420px; padding: 0; overflow: hidden; border: 1px solid var(--border); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
            <div style="padding: 1.2rem; background: var(--surface-darker); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1rem; font-weight: 800;" id="modal-item-name">品目設定</h3>
                <button onclick="hideItemModal()" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size: 1.2rem;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.2rem;">
                <div class="input-group">
                    <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">店舗別表示名 (任意)</label>
                    <input type="text" id="modal-display-name" placeholder="例: 生ビール中" style="width: 100%; padding: 0.7rem; border-radius: 8px; border: 1px solid var(--border); font-weight: 700; color: var(--primary);">
                    <small style="display: block; margin-top: 0.3rem; color: var(--text-secondary); font-size: 0.65rem;">※店舗独自の名前で表示できます。マスタ名は変更されません。</small>
                </div>
                <div class="input-group">
                    <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">確認タイミング</label>
                    <select id="modal-timing" class="settings-input" style="width: 100%; padding: 0.7rem; border-radius: 8px; border: 1px solid var(--border); font-weight: 600;"></select>
                </div>
                <div class="input-group">
                    <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">保管場所</label>
                    <input type="text" id="modal-location" list="common-locations" placeholder="例: 冷蔵庫A" style="width: 100%; padding: 0.7rem; border-radius: 8px; border: 1px solid var(--border);">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="input-group">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">定数 (Par)</label>
                        <input type="number" id="modal-par" step="any" style="width: 100%; padding: 0.7rem; border-radius: 8px; border: 1px solid var(--border); text-align: center; font-weight: 700;">
                    </div>
                    <div class="input-group">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">管理単位</label>
                        <input type="text" id="modal-unit" list="common-units" placeholder="例: 小タッパ" style="width: 100%; padding: 0.7rem; border-radius: 8px; border: 1px solid var(--border); font-weight: 600;">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="input-group">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">単位換算量</label>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="number" id="modal-conv" step="any" style="flex: 1; padding: 0.7rem; border-radius: 8px; border: 1px solid var(--border); text-align: center; font-weight: 700;">
                            <span id="modal-master-unit" style="font-weight: 800; color: var(--text-secondary); font-size: 0.9rem; min-width: 30px;">-</span>
                        </div>
                    </div>
                    <div class="input-group">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">不足時アクション</label>
                        <select id="modal-action" style="width: 100%; padding: 0.7rem; border-radius: 8px; border: 1px solid var(--border); font-weight: 600;">
                            <option value="purchase">仕入れ</option>
                            <option value="prep">仕込み</option>
                            <option value="transfer">移動</option>
                        </select>
                    </div>
                </div>
                <button id="btn-save-single-item" class="btn btn-primary" style="width: 100%; padding: 1rem; margin-top: 0.5rem; font-weight: 800; font-size: 1rem; border-radius: 12px; box-shadow: var(--shadow-primary);">
                    設定を保存する
                </button>
            </div>
        </div>
    </div>

    <!-- Master Settings Large Overlay -->
    <div id="inv-master-settings-overlay">
        <div style="max-width: 1200px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="margin: 0; font-size: 1.8rem; font-weight: 900; color: var(--text-primary);">在庫マスタ設定</h2>
                    <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-weight: 600;">店舗で管理する品目の選択とタイミングの管理</p>
                </div>
                <button onclick="hideMasterSettings()" class="btn btn-secondary" style="border-radius: 50%; width: 50px; height: 50px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div id="inv-master-settings-content" style="display: flex; flex-direction: column; gap: 2rem;">
                <!-- Content injected by renderSettingsView -->
            </div>
        </div>
    </div>
`;

// Global State
let selectedStore = null;  // {id, name, internalCode, resetTime}
let currentTab = 'tiles';   // 'tiles' or 'list'
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
function isConfirmedToday(updatedAt, resetTime) {
    if (!updatedAt) return false;
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
    const sidebarTimings = document.getElementById('inv-timing-list');
    const storeSelect = document.getElementById('inv-store-select');

    if (!main || !storeSelect || !sidebarTimings) return;

    // Ensure common datalists exist for modal/settings
    const locs = [...new Set(inventoryData.map(d => d.location_label || d.保管場所).filter(Boolean))].sort();
    const units = [...new Set(inventoryData.map(d => d.display_unit).filter(Boolean))].sort();
    let datalists = document.getElementById('inv-datalists');
    if (!datalists) {
        datalists = document.createElement('div');
        datalists.id = 'inv-datalists';
        document.body.appendChild(datalists);
    }
    datalists.innerHTML = `
        <datalist id="common-locations">${locs.map(l => `<option value="${l}">`).join('')}</datalist>
        <datalist id="common-units">${units.map(u => `<option value="${u}">`).join('')}</datalist>
    `;

    // 1. Populate Store Select (Only once or if changed)
    if (storeSelect.options.length <= 1) {
        allStores.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            if (selectedStore && selectedStore.id === s.id) opt.selected = true;
            storeSelect.appendChild(opt);
        });
        
        // Auto-select store for users with a fixed StoreID
        if (!selectedStore && currentUser?.StoreID) {
            const myStore = allStores.find(s => s.id === currentUser.StoreID || s.code === currentUser.StoreID);
            if (myStore) {
                selectedStore = myStore;
                storeSelect.value = myStore.id;
                loadStoreInventory(myStore.code).then(() => render());
            }
        }

        storeSelect.onchange = async (e) => {
            const val = e.target.value;
            if (!val) {
                selectedStore = null;
                inventoryData = [];
            } else {
                const s = allStores.find(x => x.id === val);
                selectedStore = s;
                await loadStoreInventory(s.code);
            }
            selectedTiming = null;
            render();
        };
    }

    if (!selectedStore) {
        sidebarTimings.innerHTML = '<div style="font-size:0.8rem;color:var(--text-secondary);padding:1rem;">店舗を選択してください</div>';
        main.innerHTML = `
            <div style="text-align:center; padding: 5rem; color: var(--text-secondary);">
                <i class="fas fa-store-slash" style="font-size: 3rem; margin-bottom: 1.5rem; opacity: 0.3;"></i>
                <p>店舗を選択して在庫管理を開始してください</p>
            </div>
        `;
        return;
    }

    // 2. Render Sidebar Timings
    const rawTimings = [...new Set(inventoryData.map(d => d.確認タイミング))].filter(t => t).sort();
    sidebarTimings.innerHTML = rawTimings.map(tCode => {
        const tName = timingMaster[tCode] || tCode;
        const itemsInTiming = inventoryData.filter(d => d.確認タイミング === tCode);
        const confirmedItems = itemsInTiming.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime));
        const isAllDone = itemsInTiming.length > 0 && confirmedItems.length === itemsInTiming.length;
        const isActive = selectedTiming && selectedTiming.id === tCode;
        
        return `
            <div class="timing-item ${isActive ? 'active' : ''}" data-code="${tCode}" data-name="${tName}">
                <i class="fas ${isAllDone ? 'fa-check-circle' : 'fa-clock'}" style="${isAllDone ? 'color:var(--primary)' : ''}"></i>
                <span style="flex:1">${tName}</span>
                <span style="font-size:0.7rem;opacity:0.7">${confirmedItems.length}/${itemsInTiming.length}</span>
            </div>
        `;
    }).join('');

    sidebarTimings.querySelectorAll('.timing-item').forEach(item => {
        item.onclick = () => {
            selectedTiming = { id: item.dataset.code, name: item.dataset.name };
            render();
        };
    });

    // 3. Render Main Content
    if (currentTab === 'settings') {
        renderSettingsView(main);
    } else {
        if (!selectedTiming) {
            main.innerHTML = `
                <div style="text-align:center; padding: 5rem; color: var(--text-secondary);">
                    <i class="fas fa-arrow-left" style="font-size: 3rem; margin-bottom: 1.5rem; opacity: 0.3;"></i>
                    <p>左メニューからタイミングを選択してください</p>
                </div>
            `;
        } else {
            renderChecklist(main);
        }
    }

    // Settings Toggle (Re-purposed to open overlay)
    const btnSettings = document.getElementById('btn-inv-settings');
    if (btnSettings) {
        const canManage = currentUser?.Role === 'Admin' || currentUser?.Role === '管理者' || currentUser?.Role === 'Manager' || currentUser?.Role === '店長';
        btnSettings.style.display = canManage ? 'block' : 'none';
        btnSettings.onclick = () => {
            showMasterSettings();
        };
    }
}

async function showMasterSettings() {
    const overlay = document.getElementById('inv-master-settings-overlay');
    const content = document.getElementById('inv-master-settings-content');
    const overlayLoad = document.getElementById('inv-loading-overlay');
    
    if (overlay && content) {
        if (overlayLoad) overlayLoad.style.display = 'flex';
        
        try {
            // Re-load to ensure we have latest data
            await loadStoreInventory(selectedStore.code);
            overlay.classList.add('active');
            renderSettingsView(content);
        } catch (err) {
            console.error("Master settings open failed:", err);
            showAlert('エラー', 'データの取得に失敗しました');
        } finally {
            // Safety: Ensure loading is hidden even if render fails
            if (overlayLoad) overlayLoad.style.display = 'none';
        }
    }
}

window.hideMasterSettings = () => {
    const overlay = document.getElementById('inv-master-settings-overlay');
    if (overlay) overlay.classList.remove('active');
};

function renderChecklist(container) {
    const items = inventoryData.filter(d => d.確認タイミング === selectedTiming.id);
    document.getElementById('inv-current-title').textContent = `${selectedStore.name} / ${selectedTiming.name}`;
    
    const confirmedCount = items.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime)).length;
    document.getElementById('inv-stats').textContent = `完了: ${confirmedCount} / ${items.length}`;

    renderInventoryTable(container, items);
}

function renderInventoryTable(container, items) {
    // Sort items by location_label then name
    items.sort((a, b) => {
        const locA = a.location_label || a.保管場所 || '未設定';
        const locB = b.location_label || b.保管場所 || '未設定';
        if (locA !== locB) return locA.localeCompare(locB);
        return (productMap[a.ProductID] || '').localeCompare(productMap[b.ProductID] || '');
    });

    // グルーピングとプログレス計算
    const groupedItems = {};
    items.forEach(item => {
        const loc = item.location_label || item.保管場所 || '未設定';
        if (!groupedItems[loc]) groupedItems[loc] = [];
        groupedItems[loc].push(item);
    });

    // 各ロケーション内のソート
    Object.keys(groupedItems).forEach(loc => {
        groupedItems[loc].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    });

    let html = `
        <table class="inventory-table ${sortMode ? 'sort-mode-active' : ''}">
            <thead>
                <tr>
                    <th style="width: 40px; padding: 0.8rem 0.5rem;"></th>
                    <th>品目名</th>
                    <th style="width: 180px; text-align: center;">現在庫入力</th>
                    <th style="width: 90px; text-align: center;">単位</th>
                    <th style="width: 80px; text-align: center;">定数</th>
                    <th style="width: 50px; text-align: center;"><i class="fas fa-cog"></i></th>
                </tr>
            </thead>
            <tbody>
    `;

    Object.keys(groupedItems).forEach(loc => {
        const locItems = groupedItems[loc];
        const confirmedCount = locItems.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime)).length;
        const totalCount = locItems.length;
        const isCompleted = confirmedCount === totalCount;
        const isCollapsed = collapsedSections.has(loc);

        html += `
            <tr class="location-banner ${isCompleted ? 'completed' : ''}" data-loc="${loc}">
                <td colspan="6">
                    <div class="banner-content">
                        <div class="title">
                            <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" style="width: 1rem; font-size: 0.8rem; color: var(--text-secondary);"></i>
                            <i class="fas fa-map-marker-alt" style="color: var(--primary);"></i>
                            ${loc}
                            ${isCompleted ? '<i class="fas fa-check-circle" style="color:var(--primary); font-size: 0.9rem;"></i>' : ''}
                        </div>
                        <div class="progress">${confirmedCount} / ${totalCount}</div>
                    </div>
                </td>
            </tr>
        `;

        locItems.forEach((item, index) => {
            const isConfirmed = isConfirmedToday(item.updated_at, selectedStore.resetTime);
            const currentQty = item.個数 !== undefined ? item.個数 : '';
            const parStock = item.定数 || 0;
            const isShort = (parStock > 0) && (Number(currentQty) < parStock);
            
            // 表示名の出し分け
            const masterName = productMap[item.ProductID] || '不明';
            const displayName = item.display_name || masterName;
            const hasCustomName = item.display_name && item.display_name !== masterName;

            html += `
                <tr class="inventory-row ${isConfirmed ? 'confirmed' : ''} ${isShort && !isConfirmed ? 'shortage' : ''} ${isCollapsed ? 'hidden' : ''}" 
                    data-id="${item.id}" data-loc="${loc}" draggable="${sortMode}">
                    <td style="text-align: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.6rem;">
                            <div class="check-mark" style="display: ${sortMode ? 'none' : 'block'}; min-width: 1.2rem;">
                                ${isConfirmed ? '<i class="fas fa-check-circle" style="color:var(--primary)"></i>' : (index + 1)}
                            </div>
                            <div class="sort-handle" style="display: ${sortMode ? 'block' : 'none'};"><i class="fas fa-bars"></i></div>
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 800; font-size: 1rem; color: var(--text-primary);">${displayName}</div>
                        ${hasCustomName ? `<div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.1rem;">${masterName}</div>` : ''}
                    </td>
                    <td style="text-align: center;">
                        <div class="qty-stepper-container">
                            <button class="stepper-btn minus" data-id="${item.id}"><i class="fas fa-minus"></i></button>
                            <input type="number" step="any" inputmode="decimal" class="qty-input" 
                                   value="${currentQty}" placeholder="0" 
                                   data-id="${item.id}" data-index="${index}">
                            <button class="stepper-btn plus" data-id="${item.id}"><i class="fas fa-plus"></i></button>
                        </div>
                    </td>
                    <td style="text-align: center; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; white-space: nowrap;">
                        ${item.display_unit || ''}
                    </td>
                    <td style="text-align: center; font-family: monospace; font-weight: 700;">${parStock}</td>
                    <td style="text-align: center;">
                        <button class="btn-item-settings" data-id="${item.id}" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; padding: 5px;">
                            <i class="fas fa-cog"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Header listeners
    const btnSort = document.getElementById('btn-toggle-sort');
    if (btnSort) {
        btnSort.onclick = () => {
            sortMode = !sortMode;
            renderInventoryTable(container, items);
        };
    }

    // Banner listeners (Toggle)
    container.querySelectorAll('.location-banner').forEach(banner => {
        banner.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const loc = banner.dataset.loc;
            if (collapsedSections.has(loc)) {
                collapsedSections.delete(loc);
            } else {
                collapsedSections.add(loc);
            }
            render(); // 全体再描画
        };
    });

    // Input listeners (Auto-save on blur)
    container.querySelectorAll('.qty-input').forEach(input => {
        input.onfocus = () => input.select();
        input.onblur = () => {
            const item = items.find(i => i.id === input.dataset.id);
            if (item) {
                // 文字列として取得してitemにセット（saveItemQty内で数値化される）
                item.個数 = input.value;
                saveItemQty(item);
            }
        };
        // Enterキーでも保存
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        };
    });

    // Listeners for ⚙️ settings icon
    container.querySelectorAll('.btn-item-settings').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            showItemSettingsModal(btn.dataset.id);
        };
    });

    // Drag and Drop Logic
    if (sortMode) {
        let dragSrcEl = null;
        container.querySelectorAll('.inventory-row[draggable="true"]').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                dragSrcEl = row;
                e.dataTransfer.effectAllowed = 'move';
                row.style.opacity = '0.4';
            });
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                const locA = dragSrcEl.dataset.loc;
                const locB = row.dataset.loc;
                if (locA === locB && dragSrcEl !== row) {
                    row.classList.add('drag-over');
                }
            });
            row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
            row.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                row.classList.remove('drag-over');
                const locA = dragSrcEl.dataset.loc;
                const locB = row.dataset.loc;
                if (locA === locB && dragSrcEl !== row) {
                    // Reorder in groupedItems and save
                    const locItems = groupedItems[locA];
                    const srcId = dragSrcEl.dataset.id;
                    const targetId = row.dataset.id;
                    const srcIndex = locItems.findIndex(i => i.id === srcId);
                    const targetIndex = locItems.findIndex(i => i.id === targetId);
                    
                    const [removed] = locItems.splice(srcIndex, 1);
                    locItems.splice(targetIndex, 0, removed);
                    
                    // Update sort_order for all items in this loc
                    const batch = writeBatch(db);
                    locItems.forEach((item, i) => {
                        item.sort_order = i;
                        batch.update(doc(db, "m_store_items", item.id), { sort_order: i });
                    });
                    await batch.commit();
                    render(); // 全体再描画
                }
            });
            row.addEventListener('dragend', () => row.style.opacity = '1');
        });
    }

    // Listeners for keyboard navigation and docked keypad
    const inputs = container.querySelectorAll('.qty-input');
    inputs.forEach(input => {
        input.onfocus = (e) => {
            editingItem = items.find(i => i.id === input.dataset.id);
        };
        
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveItemQty(editingItem);
                const next = container.querySelector(`.qty-input[data-index="${parseInt(input.dataset.index) + 1}"]`);
                if (next) next.focus();
            }
        };
        
        input.oninput = (e) => {
            editingItem.個数 = e.target.value === "" ? 0 : Number(e.target.value);
        };
    });

    // Stepper Listeners
    container.querySelectorAll('.stepper-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const input = container.querySelector(`.qty-input[data-id="${id}"]`);
            const item = items.find(i => i.id === id);
            let val = Number(input.value) || 0;
            
            if (btn.classList.contains('plus')) {
                val += 0.5;
            } else {
                val = Math.max(0, val - 0.5);
            }
            
            input.value = val;
            item.個数 = val;
            // 変更を即座に保存
            await saveItemQty(item);
        };
    });
}

function renderItemsInGroups(container, items, hideIndicators) {
    // Sort items by location_label then name
    items.sort((a, b) => {
        const locA = a.location_label || a.保管場所 || '未設定';
        const locB = b.location_label || b.保管場所 || '未設定';
        if (locA !== locB) return locA.localeCompare(locB);
        return (productMap[a.ProductID] || '').localeCompare(productMap[b.ProductID] || '');
    });

    let currentLoc = null;
    let html = ``;

    items.forEach(item => {
        const loc = item.location_label || item.保管場所 || '未設定';
        if (loc !== currentLoc) {
            currentLoc = loc;
            html += `<div class="location-header"><i class="fas fa-map-marker-alt"></i> ${currentLoc}</div>`;
        }

        const isConfirmed = isConfirmedToday(item.updated_at, selectedStore.resetTime);
        const displayUnit = item.display_unit || '';
        const currentQty = item.個数 !== undefined ? item.個数 : '';
        const parStock = item.定数 || 0;
        const isShort = (parStock > 0) && (Number(currentQty) < parStock);
        const shortfall = isShort ? (parStock - Number(currentQty)).toFixed(1) : 0;

        html += `
            <div class="inventory-item ${isConfirmed ? 'completed' : ''}" data-id="${item.id}" style="padding: 0.6rem 0.8rem; margin-bottom: 0.5rem; gap: 0.5rem; display: flex; align-items: center; border-radius: 10px; ${isShort && !isConfirmed ? 'border-left: 3px solid var(--danger);' : ''}">
                <div style="flex: 1; min-width: 0;">
                    <div class="item-name" style="${isConfirmed ? 'color: var(--primary); font-weight:700;' : ''}; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${productMap[item.ProductID] || '不明'}
                        ${isConfirmed ? '<i class="fas fa-check-circle"></i>' : ''}
                        <i class="fas fa-cog btn-edit-loc" data-id="${item.id}" style="margin-left: 0.4rem; font-size: 0.75rem; color: #cbd5e1; cursor: pointer;"></i>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem;">
                        ${displayUnit ? `<span style="font-size: 0.7rem; background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; border-radius: 4px; padding: 0.1rem 0.4rem; font-weight: 600;">${displayUnit}</span>` : ''}
                        ${isShort && !isConfirmed ? `<span style="font-size: 0.7rem; background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; border-radius: 4px; padding: 0.1rem 0.4rem; font-weight: 700;">不足 -${shortfall}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <div style="text-align: right; min-width: 32px; display: ${hideIndicators ? 'none' : 'block'};">
                        <div style="font-size: 0.6rem; color: var(--text-secondary); line-height: 1;">定数</div>
                        <div style="font-weight: 700; font-size: 0.8rem;">${parStock}</div>
                    </div>
                    <input type="number" step="any" inputmode="decimal" class="item-qty-input" value="${currentQty}" placeholder="0" data-id="${item.id}" style="width: 55px; padding: 0.4rem; font-size: 0.9rem;">
                    <button class="btn btn-primary btn-confirm-qty" data-id="${item.id}" style="padding: 0.5rem; min-width: 38px; height: 38px;">
                        <i class="fas fa-check" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html || `<div style="text-align:center; padding: 2rem; color: var(--text-secondary);">該当する品目はありません。</div>`;

    // Listeners
    container.querySelectorAll('.item-qty-input').forEach(input => {
        input.onfocus = () => {
            editingItem = items.find(i => i.id === input.dataset.id);
            input.select();
        };
        input.oninput = (e) => {
            const item = items.find(i => i.id === input.dataset.id);
            item.個数 = e.target.value === "" ? 0 : Number(e.target.value);
        };
    });

    container.querySelectorAll('.btn-confirm-qty').forEach(btn => {
        btn.onclick = () => {
            const item = items.find(i => i.id === btn.dataset.id);
            saveItemQty(item);
        };
    });

    container.querySelectorAll('.btn-edit-loc').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openLocEdit(items.find(i => i.id === btn.dataset.id));
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
            updated_at: now,
            is_confirmed: true,
            confirmed_at: now,
            confirmed_by: currentUser?.Name || currentUser?.Email || 'unknown'
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

// Location Edit System
function openLocEdit(item) {
    editingItem = item;
    const modal = document.getElementById('loc-edit-modal');
    const input = document.getElementById('loc-edit-input');
    const parStockInput = document.getElementById('loc-par-stock-input');
    const datalist = document.getElementById('loc-datalist');

    input.value = item.location_label || item.保管場所 || '';
    parStockInput.value = item.定数 || 0;

    // Fill datalist with existing labels
    const labels = [...new Set(inventoryData.map(i => i.location_label || i.保管場所).filter(l => l))].sort();
    datalist.innerHTML = labels.map(l => `<option value="${l}">`).join('');

    // 二重オーバーレイ防止
    document.querySelectorAll('.modal-overlay').forEach(m => {
        if (m.id !== 'loc-edit-modal') m.style.setProperty('display', 'none', 'important');
    });

    modal.style.setProperty('display', 'flex', 'important');

    document.getElementById('btn-loc-cancel').onclick = () => modal.style.setProperty('display', 'none', 'important');
    document.getElementById('btn-loc-save').onclick = saveLocationChange;
}

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

export async function initInventoryPage(user) {
    currentUser = user;
    console.log("Initializing Inventory Page (V3 - Hybrid)...");
    selectedStore = null;
    selectedTiming = null;
    inventoryData = [];
    currentTab = 'tiles';

    await loadInitialData();
    render();
}

function openInvSettings() {
    currentTab = 'settings';
    render();
}

/**
 * フル画面の在庫設定ビューを生成
 */
function renderSettingsView(container) {
    if (!selectedStore) return;

    // Filter manageable items using unified logic
    const manageableItems = cachedItems.filter(isInventoryTarget);
    const categories = [...new Set(manageableItems.map(i => i.category || i.カテゴリー || 'その他'))].sort();

    container.innerHTML = `
        <!-- Header: Search & Filter Controls -->
        <div class="glass-panel" style="padding: 1.5rem; background: #f8fafc; border: 1px solid var(--border); border-radius: 16px; display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800;">
                    ${settingsBulkMode ? '<i class="fas fa-layer-group" style="color:var(--primary);"></i> 一括登録モード' : '<i class="fas fa-list-check" style="color:var(--primary);"></i> 現在の管理リスト'}
                </h3>
                <div style="display: flex; align-items: center; gap: 0.8rem; background: #e2e8f0; padding: 0.4rem 1rem; border-radius: 20px;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary);">一括登録モード</span>
                    <label class="switch" style="position: relative; display: inline-block; width: 40px; height: 20px;">
                        <input type="checkbox" id="settings-bulk-toggle" ${settingsBulkMode ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                        <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .4s; border-radius: 20px;"></span>
                    </label>
                </div>
            </div>

            <div style="display: flex; gap: 0.8rem;">
                <!-- Integrated Category Select -->
                <select id="settings-category-filter" style="width: 160px; padding: 0 1rem; border-radius: 12px; border: 2px solid #e2e8f0; font-weight: 800; font-size: 0.85rem; cursor: pointer; outline: none;">
                    <option value="ALL">全カテゴリ</option>
                    ${categories.map(c => `<option value="${c}" ${settingsSelectedCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                
                <!-- Search Box -->
                <div class="input-group" style="margin: 0; flex: 1; position: relative;">
                    <i class="fas fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary); pointer-events: none; z-index: 1;"></i>
                    <input type="text" id="inv-master-search" placeholder="${settingsBulkMode ? '追加したい品目を検索...' : '管理リスト内を検索...'}" value="${settingsSearchQuery}" style="padding-left: 2.5rem; height: 45px; border-radius: 12px; border: 2px solid #e2e8f0; font-size: 0.95rem; font-weight: 700;">
                    <!-- Floating Results for quick add in Normal Mode -->
                    <div id="inv-master-quick-add-results" style="position: absolute; top: 50px; left: 0; width: 100%; background: white; border-radius: 12px; box-shadow: var(--shadow-primary); border: 1px solid var(--border); z-index: 100; display: none; max-height: 250px; overflow-y: auto;"></div>
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 350px; gap: 2rem; align-items: start;">
            <!-- Left: Main List Area -->
            <div class="glass-panel" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; background: white; border: 1px solid var(--border); border-radius: 16px;">
                <div style="padding: 0.5rem; background: #f1f5f9; border-bottom: 1px solid var(--border); display: flex; font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">
                    ${settingsBulkMode ? '<div style="width: 40px;"></div>' : ''}
                    <div style="flex: 2; padding: 0.5rem 1rem;">品目名</div>
                    <div style="flex: 1; padding: 0.5rem;">仕入先</div>
                    <div style="width: ${settingsBulkMode ? '40px' : '100px'}; padding: 0.5rem; text-align: center;">操作</div>
                </div>
                <div id="inv-settings-list" style="height: 50vh; overflow-y: auto; background: white;">
                    <!-- Rows injected by renderSettingsItems -->
                </div>
                ${settingsBulkMode ? `
                <div style="padding: 1.2rem; background: #f8fafc; border-top: 1px solid var(--border); text-align: right;">
                    <button id="btn-bulk-add-save" class="btn btn-primary" style="padding: 0.8rem 2rem; font-weight: 800; border-radius: 12px; box-shadow: var(--shadow-primary);">選択した品目を一括追加</button>
                </div>
                ` : `
                <div style="padding: 1rem; background: #f8fafc; border-top: 1px solid var(--border); font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-info-circle"></i> ⚙️アイコンで詳細設定（定数や場所）、🗑️アイコンでリストからの削除を行えます。
                </div>
                `}
            </div>

            <!-- Right Column: Timing Management -->
            <div class="glass-panel" style="padding: 1.5rem; background: white; border: 1px solid var(--border); border-radius: 16px; align-self: start;">
                <h3 style="margin: 0 0 1.5rem 0; font-size: 1.1rem; font-weight: 800;"><i class="fas fa-clock" style="color: var(--primary);"></i> タイミング設定</h3>
                <div id="timing-master-list" style="display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.5rem;"></div>
                <div style="display: flex; gap: 0.6rem;">
                    <input type="text" id="new-timing-name" placeholder="例: 15時チェック" style="flex: 1; padding: 0.7rem; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 0.9rem; font-weight: 600;">
                    <button id="btn-add-timing" class="btn btn-secondary" style="padding: 0.7rem; border-radius: 10px; width: 45px; height: 45px;"><i class="fas fa-plus"></i></button>
                </div>
            </div>
        </div>
    `;

    // Dynamic Slider CSS (Inline)
    const styleId = 'bulk-toggle-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .switch input:checked + .slider { background-color: var(--primary) !important; }
            .switch input:checked + .slider:before { transform: translateX(20px); }
            .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        `;
        document.head.appendChild(style);
    }

    // Bind Events
    const toggle = document.getElementById('settings-bulk-toggle');
    toggle.onchange = (e) => {
        settingsBulkMode = e.target.checked;
        settingsSearchQuery = ''; // Reset search when switching
        renderSettingsView(container);
    };

    const categorySelect = document.getElementById('settings-category-filter');
    categorySelect.onchange = (e) => {
        settingsSelectedCategory = e.target.value;
        renderSettingsItems();
    };

    const searchInput = document.getElementById('inv-master-search');
    searchInput.oninput = (e) => {
        settingsSearchQuery = e.target.value;
        if (!settingsBulkMode) {
            handleQuickAddSearch(e.target.value);
        } else {
            renderSettingsItems();
        }
    };

    if (settingsBulkMode) {
        document.getElementById('btn-bulk-add-save').onclick = handleBulkAddSave;
    }

    document.getElementById('btn-add-timing').onclick = addTimingMaster;

    try {
        renderSettingsItems();
    } catch (e) {
        console.error("renderSettingsItems failed:", e);
        const listContainer = document.getElementById('inv-settings-list');
        if (listContainer) listContainer.innerHTML = '<div style="color:red;padding:1rem;">品目リストの描画に失敗しました: ' + e.message + '</div>';
    }

    try {
        renderTimingMasterList();
    } catch (e) {
        console.error("renderTimingMasterList failed:", e);
    }
}

function handleQuickAddSearch(query) {
    const resultsContainer = document.getElementById('inv-master-quick-add-results');
    if (!query || query.length < 1) {
        resultsContainer.style.display = 'none';
        return;
    }

    const existingPids = new Set(inventoryData.map(i => String(i.ProductID)));
    const matches = cachedItems.filter(i => {
        const nameMatch = i.name.toLowerCase().includes(query.toLowerCase());
        if (!nameMatch) return false;
        
        // Exclude menus
        const menu = cachedMenus.find(m => String(m.item_id) === String(i.id));
        if (menu && menu.is_sub_recipe !== true) return false;
        
        // Filter by category if selected
        if (settingsSelectedCategory !== 'ALL') {
            const cat = i.category || i.カテゴリー || 'その他';
            if (cat !== settingsSelectedCategory) return false;
        }

        return !existingPids.has(String(i.id));
    }).slice(0, 8);

    if (matches.length === 0) {
        resultsContainer.innerHTML = `<div style="padding: 1rem; color: var(--text-secondary); font-size: 0.85rem;">該当する品目はありません</div>`;
    } else {
        resultsContainer.innerHTML = matches.map(i => `
            <div class="search-result-row" data-id="${i.id}" style="padding: 0.8rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.1s;">
                <div style="font-size: 0.9rem; font-weight: 700;">${i.name}</div>
                <div style="font-size: 0.7rem; color: var(--text-secondary);">${i.category || i.カテゴリー || 'カテゴリーなし'}</div>
            </div>
        `).join('');
    }
    resultsContainer.style.display = 'block';

    resultsContainer.querySelectorAll('.search-result-row').forEach(row => {
        row.onclick = async () => {
            const pid = row.dataset.id;
            resultsContainer.style.display = 'none';
            document.getElementById('inv-master-search').value = '';
            settingsSearchQuery = '';
            await addStoreItem(pid);
        };
    });
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
        const nameMatch = i.name.toLowerCase().includes(query.toLowerCase());
        if (!nameMatch) return false;
        
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
            確認タイミング: fallbackTimingId,
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
    if (!confirm('この品目を管理リストから削除しますか？\n(定数や保管場所の設定データも消去されます)')) return;
    
    const overlay = document.getElementById('inv-loading-overlay');
    overlay.style.display = 'flex';

    try {
        await deleteDoc(doc(db, "m_store_items", storeItemId));
        await loadStoreInventory(selectedStore.code);
        renderSettingsItems();
        render(); // Update main dashboard
    } catch (err) {
        showAlert('エラー', '削除に失敗しました: ' + err.message);
    } finally {
        overlay.style.display = 'none';
    }
}

async function renderTimingMasterList() {
    const list = document.getElementById('timing-master-list');
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
        renderSettingsView(document.getElementById('inv-main-content'));
    } catch (err) {
        alert('削除エラー: ' + err.message);
    }
};

async function addTimingMaster() {
    const name = document.getElementById('new-timing-name').value.trim();
    if (!name) return;
    try {
        const id = 'T' + Date.now();
        await setDoc(doc(db, "m_check_timings", id), { ID: id, 確認タイミング: name });
        timingMaster[id] = name;
        document.getElementById('new-timing-name').value = '';
        renderSettingsView(document.getElementById('inv-main-content'));
    } catch (err) {
        alert('追加エラー: ' + err.message);
    }
}

async function loadStoreInventory(internalCode) {
    const main = document.getElementById('inv-main-content');
    if (main) main.innerHTML = `<div style="text-align:center; padding: 4rem;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i><p>読み込み中...</p></div>`;

    try {
        const q = query(collection(db, "m_store_items"), where("StoreID", "==", internalCode));
        const snap = await getDocs(q);
        inventoryData = [];
        snap.forEach(d => inventoryData.push({ id: d.id, ...d.data() }));
        console.log(`Loaded ${inventoryData.length} items for store ${internalCode}`);

        await loadTheoreticalStocks(internalCode);
    } catch (err) {
        console.error("Error loading store inventory:", err);
    }
}



function renderSettingsItems() {
    const container = document.getElementById('inv-settings-list');
    if (!container) return;

    try {
        if (settingsBulkMode) {
            // --- Mode B: Master Items (Bulk Add) ---
            const existingPids = new Set(inventoryData.map(i => String(i.ProductID)));
            
            let itemsToShow = cachedItems.filter(i => {
                if (!isInventoryTarget(i)) return false;
                if (existingPids.has(String(i.id))) return false;

                const itemName = (i.name || i.Name || '').toLowerCase();
                const itemCat = String(i.category || i.カテゴリー || 'その他');

                if (settingsSelectedCategory !== 'ALL' && itemCat !== settingsSelectedCategory) return false;
                if (settingsSearchQuery) {
                    const q = settingsSearchQuery.toLowerCase();
                    if (!itemName.includes(q)) return false;
                }
                return true;
            });

            itemsToShow.sort((a, b) => {
                const nameA = a.name || a.Name || '';
                const nameB = b.name || b.Name || '';
                return nameA.localeCompare(nameB);
            });

            if (itemsToShow.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-secondary); font-size: 0.9rem;">該当する未登録品目はありません</div>`;
                return;
            }

            container.innerHTML = itemsToShow.map(i => {
                const pid = String(i.id || '');
                const displayName = i.name || i.Name || '名称未設定';
                
                // 仕入れ先・自家製判定 (安全なアクセス)
                const ing = (cachedIngredients || []).find(ing => ing && String(ing.item_id || '') === pid);
                const vendor = (cachedSuppliers || []).find(v => v && (String(v.vendor_id || v.id) === String(ing?.vendor_id || '')));
                const menu = (cachedMenus || []).find(m => m && (String(m.item_id || '') === pid || String(m.id || '') === pid));
                const isSub = menu?.is_sub_recipe === true;

                let vendorDisplay = '';
                if (isSub) {
                    vendorDisplay = '<span style="color: #2563eb; font-weight: 700;">自家製原材料</span>';
                } else if (vendor) {
                    vendorDisplay = vendor.vendor_name || '名称不明';
                } else {
                    vendorDisplay = '<span style="color: #ef4444; font-weight: 600;">業者未登録</span>';
                }

                return `
                    <label style="display: flex; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.1s;">
                        <div style="width: 40px;"><input type="checkbox" class="bulk-add-chk" value="${pid}" style="width: 18px; height: 18px; cursor: pointer;"></div>
                        <div style="flex: 2; font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">${displayName}</div>
                        <div style="flex: 1; font-size: 0.75rem; color: var(--text-secondary);">${vendorDisplay}</div>
                        <div style="width: 40px; text-align: center;"><i class="fas fa-plus" style="color: var(--primary); opacity: 0.3;"></i></div>
                    </label>
                `;
            }).join('');

        } else {
            // --- Mode A: Management (Current Inventory) ---
            let data = [...inventoryData];

            // Category Filter
            if (settingsSelectedCategory !== 'ALL') {
                data = data.filter(d => {
                    const raw = cachedItems.find(i => String(i.id) === String(d.ProductID));
                    const cat = String(raw?.category || raw?.カテゴリー || 'その他');
                    return cat === settingsSelectedCategory;
                });
            }

            // Search Filter
            if (settingsSearchQuery) {
                const q = settingsSearchQuery.toLowerCase();
                data = data.filter(d => (productMap[d.ProductID] || '').toLowerCase().includes(q));
            }

            data.sort((a, b) => (productMap[a.ProductID] || '').localeCompare(productMap[b.ProductID] || ''));

            if (data.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-secondary); font-size: 0.9rem;">
                    ${settingsSearchQuery || settingsSelectedCategory !== 'ALL' ? '該当する品目はありません' : '登録されている品目はありません'}
                </div>`;
                return;
            }

            container.innerHTML = data.map(item => {
                const name = productMap[item.ProductID] || '不明な品目';
                const ing = cachedIngredients.find(ing => String(ing.item_id) === String(item.ProductID));
                const sup = cachedSuppliers.find(s => String(s.vendor_id || s.id) === String(ing?.vendor_id));
                const supName = sup?.vendor_name || '-';

                return `
                    <div style="display: flex; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; transition: background 0.1s;">
                        <div style="flex: 2; min-width: 0;">
                            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${item.display_name || name}
                            </div>
                            ${item.display_name ? `<div style="font-size: 0.65rem; color: var(--text-secondary);">${name}</div>` : ''}
                        </div>
                        <div style="flex: 1; font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${supName}</div>
                        <div style="width: 100px; text-align: center; display: flex; justify-content: space-around;">
                            <button class="btn-edit-item-master" data-id="${item.id}" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size: 1.1rem;"><i class="fas fa-cog"></i></button>
                            <button class="btn-remove-item" data-id="${item.id}" style="background:none; border:none; color:var(--accent); cursor:pointer; font-size: 1.1rem;"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                `;
            }).join('');

            // Re-bind listeners
            container.querySelectorAll('.btn-edit-item-master').forEach(btn => {
                btn.onclick = () => showItemSettingsModal(btn.dataset.id);
            });
            container.querySelectorAll('.btn-remove-item').forEach(btn => {
                btn.onclick = () => removeStoreItem(btn.dataset.id);
            });
        }
    } catch (err) {
        console.error("renderSettingsItems error:", err);
        container.innerHTML = `<div style="text-align:center; padding: 2rem; color: #ef4444;">
            <p>描画エラーが発生しました</p>
            <p style="font-size: 0.7rem; color: var(--text-secondary);">${err.message}</p>
        </div>`;
        // Emergency overlay hide
        const overlayLoad = document.getElementById('inv-loading-overlay');
        if (overlayLoad) overlayLoad.style.display = 'none';
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
    const modal = document.getElementById('inv-item-modal');
    document.getElementById('modal-item-name').textContent = productMap[item.ProductID] || '品目設定';
    
    // Find master unit for better UI (Affordance)
    let masterUnit = '-';
    const rawItem = cachedItems.find(i => i.id === item.ProductID);
    if (rawItem) {
        masterUnit = rawItem.unit || rawItem.単位 || '-';
    }
    if (masterUnit === '-') {
        const ing = cachedIngredients.find(i => i.item_id === item.ProductID);
        if (ing) masterUnit = ing.unit || ing.単位 || '-';
    }
    document.getElementById('modal-master-unit').textContent = masterUnit;
    
    const timingSelect = document.getElementById('modal-timing');
    timingSelect.innerHTML = Object.keys(timingMaster).map(id => `<option value="${id}">${timingMaster[id]}</option>`).join('');
    
    timingSelect.value = item.確認タイミング || "DAILY_ALL";
    document.getElementById('modal-display-name').value = item.display_name || "";
    document.getElementById('modal-location').value = item.location_label || item.保管場所 || "";
    document.getElementById('modal-par').value = item.定数 || 0;
    document.getElementById('modal-unit').value = item.display_unit || "";
    document.getElementById('modal-conv').value = item.unit_conversion_amount || 1;
    document.getElementById('modal-action').value = item.shortage_action_type || "purchase";

    modal.classList.add('active');
    document.getElementById('btn-save-single-item').onclick = saveSingleItemSettings;
}

window.hideItemModal = () => {
    document.getElementById('inv-item-modal').classList.remove('active');
};

async function saveSingleItemSettings() {
    if (!editingItem) return;
    const overlay = document.getElementById('inv-loading-overlay');
    overlay.style.display = 'flex';

    const data = {
        確認タイミング: document.getElementById('modal-timing').value,
        display_name: document.getElementById('modal-display-name').value.trim(),
        location_label: document.getElementById('modal-location').value,
        保管場所: document.getElementById('modal-location').value,
        定数: Number(document.getElementById('modal-par').value) || 0,
        display_unit: document.getElementById('modal-unit').value,
        unit_conversion_amount: Number(document.getElementById('modal-conv').value) || 1,
        shortage_action_type: document.getElementById('modal-action').value,
        updated_at: new Date().toISOString()
    };

    try {
        await updateDoc(doc(db, "m_store_items", editingItem.id), data);
        Object.assign(editingItem, data);
        hideItemModal();
        render();
    } catch (err) {
        alert('保存エラー: ' + err.message);
    } finally { overlay.style.display = 'none'; }
}
