import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { calculateAllTheoreticalStocks } from './stock_logic.js';

export const inventoryPageHtml = `
    <div id="inventory-app" class="animate-fade-in" style="max-width: 900px; margin: 0 auto; padding-bottom: 250px;">
        <!-- New Sticky Header -->
        <div class="glass-panel" style="position: sticky; top: 1rem; z-index: 100; padding: 1rem; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <a href="javascript:void(0)" onclick="window.navigateTo('products')" style="font-size: 0.75rem; color: var(--primary); text-decoration: none; border-bottom: 1px solid var(--primary); padding-bottom: 2px; font-weight: 700;">
                        <i class="fas fa-mortar-pestle" style="font-size: 0.7rem;"></i> 商品・レシピマスタ 🔗
                    </a>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <select id="inv-store-select" class="btn" style="background: white; border: 1px solid var(--border); min-width: 180px;">
                        <option value="">店舗を選択...</option>
                    </select>
                    <button id="btn-inv-settings" class="btn" style="display: none; padding: 0.6rem 1rem; background: var(--surface-darker); color: var(--text-secondary); border: 1px solid var(--border); font-size: 0.85rem; font-weight: 600;" title="店舗別品目設定">
                        <i class="fas fa-cog"></i> 在庫設定
                    </button>
                    <button id="btn-inv-back-from-settings" class="btn" style="display: none; padding: 0.6rem 1rem; background: white; color: var(--text-primary); border: 1px solid var(--border); font-size: 0.85rem; font-weight: 600;">
                        <i class="fas fa-arrow-left"></i> 戻る
                    </button>
                </div>
            </div>
            
            <div id="inv-tabs" class="tabs-container" style="margin-bottom: 0; display: none;">
                <div class="tab-item active" data-tab="tiles"><i class="fas fa-th-large"></i> タイミング別</div>
                <div class="tab-item" data-tab="list"><i class="fas fa-list"></i> 全件表示</div>
            </div>
        </div>

        <!-- Main Content Area -->
        <div id="inv-main-content">
            <!-- Content dynamic -->
        </div>

        <!-- Custom Numeric Keypad (Slide-up) -->
        <div id="inv-keypad" style="position: fixed; bottom: -300px; left: 0; right: 0; background: #f8fafc; border-top: 1px solid var(--border); z-index: 2000; transition: bottom 0.3s ease; box-shadow: 0 -5px 20px rgba(0,0,0,0.1); padding: 1rem; display: none; flex-direction: column; gap: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding: 0 0.5rem;">
                <span id="keypad-item-name" style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">商品名</span>
                <button id="btn-keypad-close" class="btn" style="padding: 0.4rem; background: #eee;"><i class="fas fa-times"></i></button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
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
            <button id="btn-keypad-confirm" class="btn btn-primary" style="margin-top: 0.5rem; padding: 1.25rem;">確定</button>
        </div>

        <!-- Location Edit Popup -->
        <div id="loc-edit-modal" class="modal-overlay" style="display: none; position: fixed !important; inset: 0 !important; background: rgba(0,0,0,0.5) !important; z-index: 10000 !important; align-items: center; justify-content: center;">
            <div class="glass-panel animate-scale-in" style="width: 100%; max-width: 350px; padding: 1.5rem;">
                <h3 style="margin-top: 0; margin-bottom: 1.2rem; font-size: 1.1rem; color: var(--text-primary);">
                    <i class="fas fa-cog" style="color: var(--primary); margin-right: 0.5rem;"></i>品目設定
                </h3>
                
                <div class="input-group" style="margin-bottom: 1rem;">
                    <label style="font-size: 0.8rem;">保管場所ラベル</label>
                    <input type="text" id="loc-edit-input" list="loc-datalist" placeholder="例: 冷蔵庫A, 乾物棚" style="font-size: 0.9rem; padding: 0.6rem 0.6rem 0.6rem 2rem;">
                    <i class="fas fa-map-marker-alt" style="top: 2rem; font-size: 0.8rem;"></i>
                    <datalist id="loc-datalist"></datalist>
                </div>

                <div class="input-group" style="margin-bottom: 1.5rem;">
                    <label style="font-size: 0.8rem;">定数 (Par Stock)</label>
                    <input type="number" id="loc-par-stock-input" step="any" placeholder="0" style="font-size: 0.9rem; padding: 0.6rem 0.6rem 0.6rem 2rem;">
                    <i class="fas fa-layer-group" style="top: 2rem; font-size: 0.8rem;"></i>
                </div>

                <div style="display: flex; gap: 0.75rem;">
                    <button id="btn-loc-cancel" class="btn" style="flex: 1; background: #f1f5f9; color: var(--text-secondary); font-size: 0.85rem;">キャンセル</button>
                    <button id="btn-loc-save" class="btn btn-primary" style="flex: 1; font-size: 0.85rem;">保存</button>
                </div>
            </div>
        </div>

        <!-- Loading Overlay -->
        <div id="inv-loading-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.7); z-index:9999; justify-content:center; align-items:center;">
             <div class="glass-panel" style="padding: 2rem; text-align:center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top:1rem; font-weight:600;">処理中...</p>
             </div>
        </div>

    </div>

    <style>
        .keypad-btn {
            background: white;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.25rem 0;
            font-size: 1.5rem;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.1s;
        }
        .keypad-btn:active {
            background: #e2e8f0;
        }
        .location-header {
            background: #f1f5f9;
            padding: 0.5rem 1rem;
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--text-secondary);
            border-radius: 8px;
            margin: 1.5rem 0 0.75rem 0;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .location-header:first-of-type {
            margin-top: 0;
        }
        .chip {
            padding: 0.3rem 0.7rem;
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 20px;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
            color: var(--text-secondary);
        }
        .chip.active {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }
    </style>
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
    const tabs = document.getElementById('inv-tabs');
    const storeSelect = document.getElementById('inv-store-select');

    if (!main || !storeSelect) return;

    // Populate Store Select
    if (storeSelect.options.length <= 1) {
        allStores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            if (selectedStore && selectedStore.id === s.id) opt.selected = true;
            storeSelect.appendChild(opt);
        });
        storeSelect.onchange = async (e) => {
            const val = e.target.value;
            if (!val) {
                selectedStore = null;
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
        tabs.style.display = 'none';
        main.innerHTML = `
            <div style="text-align:center; padding: 5rem; color: var(--text-secondary);">
                <i class="fas fa-store-slash" style="font-size: 3rem; margin-bottom: 1.5rem; opacity: 0.3;"></i>
                <p>店舗を選択して在庫管理を開始してください</p>
            </div>
        `;
        return;
    }

    const btnSettings = document.getElementById('btn-inv-settings');
    const btnBack = document.getElementById('btn-inv-back-from-settings');
    const pageTitle = document.getElementById('page-title');

    if (currentTab === 'settings') {
        tabs.style.display = 'none';
        btnSettings.style.display = 'none';
        btnBack.style.display = 'flex';
        if (pageTitle) pageTitle.textContent = '在庫設定';
        renderSettingsView(main);
        
        btnBack.onclick = () => {
            currentTab = 'tiles';
            render();
        };
    } else {
        tabs.style.display = 'flex';
        btnSettings.style.display = (currentUser?.Role === 'Admin' || currentUser?.Role === '管理者' || currentUser?.Role === 'Manager' || currentUser?.Role === '店長') ? 'flex' : 'none';
        btnBack.style.display = 'none';
        if (pageTitle) pageTitle.textContent = '在庫管理';

        tabs.querySelectorAll('.tab-item').forEach(tab => {
            tab.onclick = () => {
                currentTab = tab.dataset.tab;
                tabs.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t === tab));
                selectedTiming = null;
                render();
            };
        });

        if (currentTab === 'tiles') {
            if (selectedTiming) {
                renderChecklist(main);
            } else {
                renderTimingTiles(main);
            }
        } else {
            renderFullList(main);
        }
    }
}

function renderTimingTiles(container) {
    const rawTimings = [...new Set(inventoryData.map(d => d.確認タイミング))].filter(t => t).sort();

    if (rawTimings.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-secondary);">この店舗に設定された品目はありません。</div>`;
        return;
    }

    let html = `<div class="menu-grid animate-fade-in" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.8rem;">`;
    rawTimings.forEach(tCode => {
        const tName = timingMaster[tCode] || tCode;
        const itemsInTiming = inventoryData.filter(d => d.確認タイミング === tCode);
        const confirmedItems = itemsInTiming.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime));
        const progress = itemsInTiming.length > 0 ? (confirmedItems.length / itemsInTiming.length) * 100 : 0;
        const isAllDone = progress === 100;

        html += `
            <div class="glass-panel timing-card ${isAllDone ? 'completed' : ''}" 
                 data-code="${tCode}" data-name="${tName}"
                 style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 1rem; border-width: 2px; ${isAllDone ? 'border-color: var(--primary);' : ''}">
                <i class="fas ${isAllDone ? 'fa-check-circle' : 'fa-clock'}" style="font-size: 1.5rem; color: ${isAllDone ? 'var(--primary)' : 'var(--text-secondary)'};"></i>
                <h3 style="margin: 0; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${tName}</h3>
                <div style="width: 100%; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; margin-top: 0.2rem;">
                    <div style="width: ${progress}%; height: 100%; background: ${isAllDone ? 'var(--primary)' : 'var(--secondary)'}; transition: width 0.3s ease;"></div>
                </div>
                <div style="font-size: 0.7rem; font-weight: 700; color: ${isAllDone ? 'var(--primary)' : 'var(--text-secondary)'};">
                    ${Math.round(progress)}% (${confirmedItems.length}/${itemsInTiming.length})
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;

    container.querySelectorAll('.timing-card').forEach(card => {
        card.onclick = () => {
            selectedTiming = { id: card.dataset.code, name: card.dataset.name };
            render();
        };
    });
}

function renderFullList(container) {
    let html = `
        <div class="glass-panel animate-fade-in" style="padding: 1rem; margin-bottom: 2rem;">
            <div class="input-group" style="margin-bottom: 0;">
                <i class="fas fa-search"></i>
                <input type="text" id="inv-search" placeholder="品目名で検索..." style="padding-left: 2.5rem;">
            </div>
        </div>
        <div id="inv-list-container"></div>
    `;
    container.innerHTML = html;

    const searchInput = document.getElementById('inv-search');
    searchInput.oninput = (e) => renderFilteredList(e.target.value);

    renderFilteredList('');
}

function renderFilteredList(query) {
    const listContainer = document.getElementById('inv-list-container');
    if (!listContainer) return;

    let filtered = inventoryData;
    if (query) {
        filtered = inventoryData.filter(i => (productMap[i.ProductID] || '').toLowerCase().includes(query.toLowerCase()));
    }

    renderItemsInGroups(listContainer, filtered, true);
}

function renderChecklist(container) {
    let items = inventoryData.filter(d => d.確認タイミング === selectedTiming.id);

    const confirmedCount = items.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime)).length;
    const totalCount = items.length;

    let html = `
        <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <button class="btn btn-secondary btn-sm" id="btn-back-to-tiles"><i class="fas fa-chevron-left"></i> 戻る</button>
            <div style="text-align: right;">
                <div style="font-weight: 700; font-size: 1rem;">${selectedTiming.name}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">進捗: ${confirmedCount} / ${totalCount}</div>
            </div>
        </div>
        <div id="inv-checklist-items"></div>
    `;
    container.innerHTML = html;

    document.getElementById('btn-back-to-tiles').onclick = () => { selectedTiming = null; render(); };

    const countContainer = document.getElementById('inv-checklist-items');
    renderItemsInGroups(countContainer, items, false);
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
    const keypad = document.getElementById('inv-keypad');
    const nameLabel = document.getElementById('keypad-item-name');
    nameLabel.textContent = productMap[item.ProductID] || '在庫入力';
    keypad.style.display = 'flex';
    setTimeout(() => keypad.style.bottom = '0', 10);

    // Set up keypad buttons
    const btns = document.querySelectorAll('.keypad-btn');
    btns.forEach(btn => {
        btn.onclick = () => handleKeypadInput(btn.dataset.val);
    });

    document.getElementById('btn-keypad-close').onclick = hideKeypad;
    document.getElementById('btn-keypad-confirm').onclick = () => {
        saveItemQty(editingItem);
        hideKeypad();
    };
}

function hideKeypad() {
    const keypad = document.getElementById('inv-keypad');
    if (!keypad) return;
    keypad.style.bottom = '-300px';
    setTimeout(() => keypad.style.display = 'none', 300);
}

function handleKeypadInput(val) {
    const input = document.querySelector(`.item-qty-input[data-id="${editingItem.id}"]`);
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
    console.log("Initializing Inventory Page (V2)...");
    selectedStore = null;
    selectedTiming = null;
    inventoryData = [];
    currentTab = 'tiles';

    await loadInitialData();
    render();

    // 権限チェック (Manager以上のみ⚙️を表示)
    const canManage = user?.Role === 'Admin' || user?.Role === '管理者' || user?.Role === 'Manager' || user?.Role === '店長';
    const btnSettings = document.getElementById('btn-inv-settings');
    if (btnSettings) {
        btnSettings.style.display = canManage ? 'flex' : 'none';
        btnSettings.onclick = openInvSettings;
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
