
import sys
import re

path = '/Users/shoheikaneko/Desktop/antigravity_かね将ポータル/procurement_mobile.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Imports
content = content.replace('orderBy } from', 'orderBy, onSnapshot } from')

# 2. Add Global Variable
if 'let procurementUnsubscribe = null;' not in content:
    content = content.replace('let currentUser = null;', 'let currentUser = null;\nlet procurementUnsubscribe = null;')

# 3. Update initProcurementMobilePage
init_pattern = r'export async function initProcurementMobilePage\(user, category = null\) \{'
init_replacement = """export async function initProcurementMobilePage(user, category = null) {
    currentUser = user;
    selectedVendor = null;
    collapsedItems.clear();

    // 既存のリスナーがあれば解除
    if (procurementUnsubscribe) {
        procurementUnsubscribe();
        procurementUnsubscribe = null;
    }
"""
content = re.sub(init_pattern, init_replacement, content)

# 4. Overhaul HTML and Styles
# We'll replace procurementMobilePageHtml entirely with a high-density version
new_html = """export const procurementMobilePageHtml = `
    <div id="procurement-app" class="animate-fade-in" style="display: flex; flex-direction: column; height: calc(100vh - 80px); overflow: hidden; background: #f8fafc;">
        
        <!-- Compact Header: Scope & Category Switcher -->
        <div style="background: white; border-bottom: 1px solid #e2e8f0; padding: 0.6rem 1rem; flex-shrink: 0; display: flex; flex-direction: column; gap: 0.6rem;">
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <div id="proc-scope-config" style="display: flex; background: #f1f5f9; padding: 2px; border-radius: 8px; width: 140px;">
                    <button id="btn-scope-store" class="scope-tab active">自店舗</button>
                    <button id="btn-scope-group" class="scope-tab">グループ</button>
                </div>
                
                <nav id="proc-category-nav" style="flex: 1; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;">
                    <button class="cat-tab-mini" data-cat="purchase">仕入れ</button>
                    <button class="cat-tab-mini" data-cat="transfer">移動</button>
                    <button class="cat-tab-mini" data-cat="store_prep">仕込</button>
                    <button class="cat-tab-mini" data-cat="ck_prep">CK仕込</button>
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
"""
content = re.sub(r'export const procurementMobilePageHtml = `.*?`;', new_html, content, flags=re.DOTALL)

# 5. Replace renderItemCard with a high-density version
new_item_row = """function renderItemRow(si, master, showStoreName = false) {
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
"""
# Replace renderItemCard and its call
content = content.replace('function renderItemCard(si, master, showStoreName = false) {', 'function renderItemRow(si, master, showStoreName = false) {')
# (The internal logic of renderItemRow is slightly different now, I'll replace the whole function)
content = re.sub(r'function renderItemRow\(si, master, showStoreName = false\) \{.*?\}', new_item_row, content, flags=re.DOTALL)

# 6. Update setupEventListeners to include Modal logic
new_listeners = """function setupEventListeners() {
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
"""
content = re.sub(r'function setupEventListeners\(\) \{.*?\}', new_listeners, content, flags=re.DOTALL)

# 7. Add renderVendorList function
if 'function renderVendorList' not in content:
    content += """
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
    
    let html = `<div class="vendor-item ${!selectedVendor ? 'active' : ''}" onclick="selectVendor(null)">
        <span>すべての業者</span>
        <span style="font-size:0.75rem; opacity:0.7">${shortItems.length}</span>
    </div>`;

    html += vendors.map(v => `
        <div class="vendor-item ${selectedVendor === v ? 'active' : ''}" onclick="selectVendor('${v}')">
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
"""

# 8. Update refreshProcurementData to use onSnapshot
new_refresh_logic = """async function refreshProcurementData() {
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
"""
content = re.sub(r'async function refreshProcurementData\(\) \{.*?\}', new_refresh_logic, content, flags=re.DOTALL)

# 9. Final tweaks to render() and card calls
content = content.replace('renderItemCard(', 'renderItemRow(')
content = content.replace('cat-tab', 'cat-tab-mini')

# Replace renderPurchaseContent to hide the bar properly
new_purchase_content = """function renderPurchaseContent(shortItems) {
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
"""
content = re.sub(r'function renderPurchaseContent\(shortItems\) \{.*?\}', new_purchase_content, content, flags=re.DOTALL)

# Also update the transfer render call to hide the vendor bar
content = content.replace("document.getElementById('proc-vendor-nav').style.display = 'none';", "const vbar = document.getElementById('proc-vendor-bar'); if(vbar) vbar.style.display = 'none';")

# 10. Update Steppers and Input Listeners
content = content.replace('.stepper-btn-mobile', '.proc-stepper-btn')
content = content.replace('.proc-buy-input', '.proc-qty-input')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Successfully overhauled procurement_mobile.js")
