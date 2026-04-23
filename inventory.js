import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where, orderBy, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
                <div id="inv-stats" style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;"></div>
            </div>
            
            <div id="inv-main-content" style="flex: 1; overflow-y: auto; padding: 0;">
                <!-- Table injected here -->
            </div>
        </main>

        <!-- Right Side: Docked Numeric Keypad -->
        <aside id="inv-keypad-dock" class="glass-panel" style="width: 280px; display: flex; flex-direction: column; gap: 1rem; padding: 1.2rem; flex-shrink: 0;">
            <div style="padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
                <div id="keypad-item-name" style="font-weight: 800; font-size: 1rem; color: var(--primary); margin-bottom: 0.2rem; min-height: 1.2rem;">項目を選択</div>
                <div id="keypad-item-unit" style="font-size: 0.75rem; color: var(--text-secondary);">--</div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-top: 0.5rem;">
                <button class="keypad-btn" data-val="1">1</button>
                <button class="keypad-btn" data-val="2">2</button>
                <button class="keypad-btn" data-val="3">3</button>
                <button class="keypad-btn" data-val="4">4</button>
                <button class="keypad-btn" data-val="5">5</button>
                <button class="keypad-btn" data-val="6">6</button>
                <button class="keypad-btn" data-val="7">7</button>
                <button class="keypad-btn" data-val="8">8</button>
                <button class="keypad-btn" data-val="9">9</button>
                <button class="keypad-btn" data-val=".">.</button>
                <button class="keypad-btn" data-val="0">0</button>
                <button class="keypad-btn" data-val="BS"><i class="fas fa-backspace"></i></button>
            </div>
            
            <button id="btn-keypad-confirm" class="btn btn-primary" style="margin-top: auto; padding: 1.2rem; font-size: 1.1rem; font-weight: 800; box-shadow: var(--shadow-md);">
                <i class="fas fa-check-circle"></i> 確定 (Enter)
            </button>
        </aside>

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
        
        .qty-input { width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 6px; font-weight: 700; text-align: right; font-size: 1.1rem; color: var(--primary); }
        .qty-input:focus { outline: 2px solid var(--primary); background: #fff; }
        
        .keypad-btn { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem 0; font-size: 1.3rem; font-weight: 700; cursor: pointer; transition: all 0.1s; box-shadow: var(--shadow-sm); }
        .keypad-btn:active { transform: scale(0.95); background: #f1f5f9; }
        
        @media (max-width: 1024px) {
            #inv-sidebar { width: 200px; }
            #inv-keypad-dock { width: 240px; }
        }
    </style>
`;
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
let settingsCurrentTab = 'menus';
let settingsSelectedCategory = null;
let settingsSelectedSupplier = null;
let editingItem = null;    // Item for keypad or loc-edit


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

    // Settings Toggle
    const btnSettings = document.getElementById('btn-inv-settings');
    if (btnSettings) {
        const canManage = currentUser?.Role === 'Admin' || currentUser?.Role === '管理者' || currentUser?.Role === 'Manager' || currentUser?.Role === '店長';
        btnSettings.style.display = canManage ? 'block' : 'none';
        btnSettings.onclick = () => {
            if (currentTab === 'settings') {
                currentTab = 'tiles';
                btnSettings.innerHTML = '<i class="fas fa-cog"></i> 在庫マスタ設定';
            } else {
                currentTab = 'settings';
                btnSettings.innerHTML = '<i class="fas fa-arrow-left"></i> 戻る';
            }
            render();
        };
    }
}

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

    let html = `
        <table class="inventory-table">
            <thead>
                <tr>
                    <th style="width: 40px; padding: 0.8rem 0.5rem;"></th>
                    <th>品目名 / 保管場所</th>
                    <th style="width: 80px; text-align: center;">定数</th>
                    <th style="width: 120px; text-align: right;">現在庫入力</th>
                    <th style="width: 80px; text-align: left; padding-left: 1rem;">単位</th>
                </tr>
            </thead>
            <tbody>
    `;

    items.forEach((item, index) => {
        const isConfirmed = isConfirmedToday(item.updated_at, selectedStore.resetTime);
        const currentQty = item.個数 !== undefined ? item.個数 : '';
        const parStock = item.定数 || 0;
        const isShort = (parStock > 0) && (Number(currentQty) < parStock);
        const loc = item.location_label || item.保管場所 || '-';

        html += `
            <tr class="inventory-row ${isConfirmed ? 'confirmed' : ''} ${isShort && !isConfirmed ? 'shortage' : ''}" data-id="${item.id}">
                <td style="text-align: center; color: var(--text-secondary);">
                    ${isConfirmed ? '<i class="fas fa-check-circle" style="color:var(--primary)"></i>' : (index + 1)}
                </td>
                <td>
                    <div style="font-weight: 700; font-size: 0.95rem;">${productMap[item.ProductID] || '不明'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary);"><i class="fas fa-map-marker-alt" style="font-size: 0.6rem;"></i> ${loc}</div>
                </td>
                <td style="text-align: center; font-family: monospace; font-weight: 700;">${parStock}</td>
                <td>
                    <input type="number" step="any" class="qty-input" 
                           value="${currentQty}" placeholder="0" 
                           data-id="${item.id}" data-index="${index}"
                           onfocus="this.select()">
                </td>
                <td style="padding-left: 1rem; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">
                    ${item.display_unit || ''}
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Listeners for keyboard navigation and docked keypad
    const inputs = container.querySelectorAll('.qty-input');
    inputs.forEach(input => {
        input.onfocus = () => {
            editingItem = items.find(i => i.id === input.dataset.id);
            updateKeypadDisplay();
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
}

function updateKeypadDisplay() {
    const nameEl = document.getElementById('keypad-item-name');
    const unitEl = document.getElementById('keypad-item-unit');
    if (editingItem) {
        nameEl.textContent = productMap[editingItem.ProductID] || '不明';
        unitEl.textContent = editingItem.display_unit || '単位未設定';
    }
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
                    <input type="number" step="any" class="item-qty-input" value="${currentQty}" placeholder="0" readonly data-id="${item.id}" style="width: 55px; padding: 0.4rem; font-size: 0.9rem;">
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
        input.onclick = () => showKeypad(items.find(i => i.id === input.dataset.id));
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

// Keypad System
function showKeypad(item) {
    editingItem = item;
    updateKeypadDisplay();
    // In the new UI, we focus the input and use the docked keypad
    const input = document.querySelector(`.qty-input[data-id="${item.id}"]`);
    if (input) input.focus();
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

        // 旧ログはそのまま維持（stock_logic.jsへの影響防止）
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
            source_route: '',
            note: '',
            executed_by: currentUser?.Name || currentUser?.Email || 'unknown',
            executed_at: now,
            related_id: '',
            business_date: businessDate
        });

        item.updated_at = now;
        item.個数 = finalQty;
        render();
    } catch (err) {
        alert("保存エラー: " + err.message);
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

    // Keypad listeners (Docked)
    document.querySelectorAll('.keypad-btn').forEach(btn => {
        btn.onclick = () => handleKeypadInput(btn.dataset.val);
    });

    const btnConfirm = document.getElementById('btn-keypad-confirm');
    if (btnConfirm) {
        btnConfirm.onclick = () => {
            if (editingItem) {
                saveItemQty(editingItem);
                // Move focus to next
                const currentInput = document.querySelector(`.qty-input[data-id="${editingItem.id}"]`);
                if (currentInput) {
                    const next = document.querySelector(`.qty-input[data-index="${parseInt(currentInput.dataset.index) + 1}"]`);
                    if (next) next.focus();
                }
            }
        };
    }
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

    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="width: 100%; border: 1px solid var(--border); background: white; padding: 0; display: flex; flex-direction: column;">
            <!-- Settings Header Area -->
            <div style="padding: 1.5rem; background: #f8fafc; border-bottom: 1px solid var(--border);">
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="tabs-container" style="margin: 0; background: #e2e8f0; padding: 0.2rem; border-radius: 8px;">
                        <div class="tab-item ${settingsCurrentTab === 'menus' ? 'active' : ''}" data-tab="menus" style="flex: 1; text-align: center; font-size:0.85rem; padding: 0.5rem;"><i class="fas fa-utensils"></i> 販売メニュー</div>
                        <div class="tab-item ${settingsCurrentTab === 'sub_recipes' ? 'active' : ''}" data-tab="sub_recipes" style="flex: 1; text-align: center; font-size:0.85rem; padding: 0.5rem;"><i class="fas fa-mortar-pestle"></i> 自家製原材料</div>
                        <div class="tab-item ${settingsCurrentTab === 'ingredients' ? 'active' : ''}" data-tab="ingredients" style="flex: 1; text-align: center; font-size:0.85rem; padding: 0.5rem;"><i class="fas fa-leaf"></i> 食材・仕入品</div>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <div class="input-group" style="margin: 0; flex: 1;">
                            <i class="fas fa-search" style="left: 0.8rem;"></i>
                            <input type="text" id="inv-settings-search" placeholder="品目名で検索..." style="padding-left: 2.2rem; height: 40px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.9rem;">
                        </div>
                        <button id="btn-save-inv-settings" class="btn btn-primary" style="height: 40px; min-width: 150px; font-weight: 700;">
                            <i class="fas fa-save"></i> 設定を保存
                        </button>
                    </div>

                    <!-- Filters -->
                    <div id="inv-settings-filters" style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.6rem; overflow-x: auto; padding-bottom: 2px;" id="inv-settings-category-chips">
                            <span style="color: var(--text-secondary); white-space: nowrap; font-weight: 600;">カテゴリー:</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.6rem; overflow-x: auto; padding-bottom: 2px;" id="inv-settings-supplier-chips">
                            <span style="color: var(--text-secondary); white-space: nowrap; font-weight: 600;">仕入先:</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- List Area -->
            <div id="inv-settings-list" style="max-height: 60vh; overflow-y: auto; background: white;">
                <!-- Rows injected by renderSettingsItems -->
            </div>

            <!-- Footer helper -->
            <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border); background: #f8fafc; font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-info-circle"></i>
                チェックした品目が「${selectedStore.name}」の在庫管理対象としてダッシュボードに表示されます
            </div>
        </div>
    `;

    // Initialize Settings Tabs
    container.querySelectorAll('.tab-item').forEach(tab => {
        tab.onclick = () => {
            settingsCurrentTab = tab.dataset.tab;
            settingsSelectedCategory = null;
            settingsSelectedSupplier = null;
            renderSettingsView(container);
        };
    });

    // Search input
    const searchInput = document.getElementById('inv-settings-search');
    searchInput.oninput = () => renderSettingsItems();

    // Save button
    document.getElementById('btn-save-inv-settings').onclick = saveInvSettings;

    // Initial render items and filters
    renderSettingsFilters();
    renderSettingsItems();
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



function renderSettingsItems(tab = settingsCurrentTab, filterText = '') {
    const container = document.getElementById('inv-settings-list');
    if (!container) return;

    // 現在の検索ワード取得（引数がない場合はDOMから）
    const searchQuery = filterText || document.getElementById('inv-settings-search').value || '';

    // 1. 基本的なタブフィルタリング
    let baseItems = cachedItems.filter(i => {
        const menu = cachedMenus.find(m => m.item_id === i.id);
        if (tab === 'menus') return menu && (menu.is_sub_recipe !== true);
        if (tab === 'sub_recipes') return menu && (menu.is_sub_recipe === true);
        if (tab === 'ingredients') return cachedIngredients.some(ing => ing.item_id === i.id) || !menu;
        return true;
    });

    // 2. フィルタ用チップのデータ抽出
    const categories = [...new Set(baseItems.map(i => i.category || '未分類'))].sort();
    const supplierIds = [...new Set(cachedIngredients.filter(ing => baseItems.some(bi => bi.id === ing.item_id)).map(ing => ing.vendor_id))];
    const suppliers = cachedSuppliers.filter(s => supplierIds.includes(s.vendor_id || s.id)).sort((a, b) => a.vendor_name.localeCompare(b.vendor_name));

    renderChips('category', categories);
    renderChips('supplier', suppliers);

    // 3. 実際の絞り込み (Category x Supplier x Search)
    const filteredItems = baseItems.filter(i => {
        // 名称検索
        const nameMatch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!nameMatch) return false;

        // カテゴリー検索
        if (settingsSelectedCategory && (i.category || '未分類') !== settingsSelectedCategory) return false;

        // 仕入先検索
        if (settingsSelectedSupplier) {
            const ing = cachedIngredients.find(ing => ing.item_id === i.id);
            if (!ing || (ing.vendor_id !== settingsSelectedSupplier)) return false;
        }

        return true;
    });

    // ソート
    filteredItems.sort((a, b) => a.name.localeCompare(b.name));

    if (filteredItems.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--text-secondary);">該当する品目はありません</div>`;
        return;
    }

    container.innerHTML = filteredItems.map(i => {
        const isSelected = inventoryData.some(si => si.ProductID === i.id);
        const ing = cachedIngredients.find(ing => ing.item_id === i.id);
        const sup = cachedSuppliers.find(s => (s.vendor_id || s.id) === ing?.vendor_id);
        const supName = sup?.vendor_name || '自社/不明';

        return `
            <label style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1.5rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.1s;">
                <input type="checkbox" class="inv-setting-chk" value="${i.id}" ${isSelected ? 'checked' : ''} style="width: 18px; height: 18px; margin: 0; cursor: pointer;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.9rem; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${i.name}</div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); border-left: 1px solid #eee; padding-left: 1rem; min-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${supName}
                </div>
            </label>
        `;
    }).join('');
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

    const checkedIds = Array.from(document.querySelectorAll('.inv-setting-chk:checked')).map(el => el.value);
    const existingIds = inventoryData.map(i => i.ProductID);

    const toAdd = checkedIds.filter(id => !existingIds.includes(id));
    const toRemove = existingIds.filter(id => !checkedIds.includes(id));

    try {
        // 削除
        for (const pid of toRemove) {
            await deleteDoc(doc(db, "m_store_items", `${selectedStore.code}_${pid}`));
        }

        // 追加
        for (const pid of toAdd) {
            await setDoc(doc(db, "m_store_items", `${selectedStore.code}_${pid}`), {
                StoreID: selectedStore.code,
                ProductID: pid,
                確認タイミング: "DAILY_ALL", // デフォルト
                定数: 0,
                location_label: "未配置",
                is_confirmed: false,
                個数: 0,
                updated_at: new Date().toISOString()
            });
        }

        showAlert('成功', `${toAdd.length}件追加、${toRemove.length}件削除しました。`);
        document.getElementById('inv-settings-modal').style.setProperty('display', 'none', 'important');
        await loadStoreInventory(selectedStore.code);
        render();
    } catch (err) {
        console.error(err);
        showAlert('エラー', '設定の保存に失敗しました');
    } finally {
        overlay.style.display = 'none';
    }
}
