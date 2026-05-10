import { db } from './firebase.js';
import { collection, getDocs, onSnapshot, addDoc, updateDoc, doc, getDoc, query, where, orderBy, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { calculateAllTheoreticalStocks } from './stock_logic.js';
import { showAlert } from './ui_utils.js';

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
                <div style="display: flex; align-items: center; gap: 0.8rem; flex-shrink: 0;">
                    <i class="fas fa-warehouse" style="color: var(--primary);"></i>
                    <h3 id="inv-current-title" style="margin: 0; font-size: 1rem; font-weight: 800;">在庫チェック</h3>
                </div>

                <!-- Search Box -->
                <div id="inv-search-container" style="flex: 1; max-width: 350px; margin: 0 1.5rem; position: relative; display: none;">
                    <i class="fas fa-search" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: 0.8rem; pointer-events: none;"></i>
                    <input type="text" id="inv-item-search" placeholder="品目名で検索..." 
                           style="width: 100%; padding: 0.5rem 0.8rem 0.5rem 2.2rem; border-radius: 20px; border: 1px solid var(--border); font-size: 0.85rem; font-weight: 600; outline: none; transition: all 0.2s; background: white;">
                </div>

                <div style="display: flex; align-items: center; gap: 0.8rem; flex-shrink: 0;">
                    <button id="btn-toggle-sort" class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px;">
                        <i class="fas fa-arrows-alt-v"></i> 並べ替え
                    </button>
                    <div id="inv-stats" style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;"></div>
                    <button id="btn-manual-reset" class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px; color: #ef4444; border-color: #fecaca; display: none;">
                        <i class="fas fa-undo"></i> リセット
                    </button>
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
        
        .inventory-row.confirmed { 
            background: #f0fdf4 !important; 
            border-left: 4px solid #10b981 !important;
        }
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
        .stepper-btn:hover { background: #f8fafc; color: var(--primary); }
        .stepper-btn:active { background: #f1f5f9; transform: scale(0.9); }

        .confirm-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #e2e8f0;
            background: white;
            color: #cbd5e1;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .confirm-btn.active {
            background: #10b981;
            border-color: #10b981;
            color: white;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .confirm-btn:active { transform: scale(0.9); }

        .section-confirm-btn {
            font-size: 0.7rem;
            padding: 0.3rem 0.8rem;
            background: white;
            color: #059669;
            border: 1px solid #bbf7d0;
            border-radius: 20px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.3rem;
        }
        .section-confirm-btn:hover { background: #f0fdf4; border-color: #10b981; }

        @media (max-width: 1024px) {
            #inv-sidebar { width: 220px; }
        }

        .location-banner {
            background: #f1f5f9;
            border-top: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            padding: 0;
            cursor: pointer;
            user-select: none;
        }
        .location-banner:hover { background: #e2e8f0; }
        .location-banner.completed { background: #ecfdf5; }
        
        .location-banner td { padding: 0.6rem 0.5rem 0.6rem 1rem !important; border-left: 5px solid #cbd5e1; }
        .location-banner.completed td { border-left-color: #10b981; }

        .location-banner .banner-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            gap: 1rem;
        }

        .location-banner .title { font-weight: 800; font-size: 0.9rem; display: flex; align-items: center; gap: 0.8rem; color: #334155; }
        .location-banner .progress { font-size: 0.7rem; font-weight: 800; color: #64748b; background: white; padding: 0.2rem 0.6rem; border-radius: 12px; border: 1px solid #e2e8f0; }
        .location-banner.completed .progress { color: #059669; border-color: #bbf7d0; }

        .inventory-table tr.hidden { display: none; }
        
        #inv-loading-overlay {
            display: none;
            position: fixed;
            inset: 0;
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
        background: rgba(241, 245, 249, 0.98);
        z-index: 2050;
        display: none;
        flex-direction: column;
        padding: 1rem 2rem;
        overflow: hidden;
    }
    #inv-master-settings-overlay.active {
        display: flex;
    }
    </style>

    <!-- Item Detail Settings Modal -->
    <div id="inv-item-modal" class="modal-overlay">
        <div class="glass-panel animate-scale-in" style="width: 520px; padding: 0; overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow-lg);">
            <!-- Modal Header -->
            <div style="padding: 1rem 1.5rem; background: var(--surface-darker); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-cog" style="color: var(--primary); font-size: 1.1rem;"></i>
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: var(--text-primary);" id="modal-item-name">品目設定</h3>
                </div>
                <button onclick="hideItemModal()" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size: 1.2rem; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-secondary)'"><i class="fas fa-times"></i></button>
            </div>

            <!-- Modal Body -->
            <div style="padding: 1.2rem; display: flex; flex-direction: column; gap: 1rem; max-height: 85vh; overflow-y: auto;">
                
                <!-- Section 1: 基本設定 -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                    <div class="input-group" style="grid-column: span 2; margin: 0;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">店舗別表示名 <span style="font-weight: 400; color: #94a3b8; font-size: 0.7rem;">(任意・マスタ名は変わりません)</span></label>
                        <input type="text" id="modal-display-name" placeholder="例: 生ビール中" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 2px solid #f1f5f9; font-weight: 700; font-size: 1rem; color: var(--primary); transition: border-color 0.2s;">
                    </div>
                    <div class="input-group" style="margin: 0;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">確認タイミング</label>
                        <select id="modal-timing" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 2px solid #f1f5f9; font-weight: 600; background: white; cursor: pointer;"></select>
                    </div>
                    <div class="input-group" style="margin: 0;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">保管場所</label>
                        <input type="text" id="modal-location" list="common-locations" placeholder="例: 冷蔵庫A" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 2px solid #f1f5f9; font-weight: 600;">
                    </div>
                </div>

                <!-- Section 2: 在庫管理ロジック -->
                <div style="background: #f8fafc; padding: 1rem; border-radius: 12px; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                    <div class="input-group" style="margin: 0;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">定数 (Par Stock)</label>
                        <input type="number" id="modal-par" step="any" placeholder="0" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 2px solid #e2e8f0; text-align: center; font-weight: 800; font-size: 1.1rem; color: var(--primary);">
                    </div>
                    <div class="input-group" style="margin: 0;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">管理単位</label>
                        <input type="text" id="modal-unit" list="common-units" placeholder="例: 皿 / パック" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 2px solid #e2e8f0; font-weight: 700; text-align: center; color: var(--primary);">
                    </div>
                    <div class="input-group" style="grid-column: span 2; margin: 0; padding-top: 0.4rem; border-top: 1px dashed #e2e8f0;">
                        <label style="font-size: 0.7rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 0.3rem;">単位換算係数 <span style="font-weight: 400; color: #94a3b8;">(1 [管理単位] あたりの基本数量)</span></label>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.8rem; background: white; padding: 0.4rem; border-radius: 10px; border: 1px solid #f1f5f9;">
                            <span id="modal-unit-preview" style="font-weight: 800; color: #94a3b8; font-size: 0.9rem;">1 単位 ＝</span>
                            <input type="number" id="modal-conv" step="any" placeholder="1" style="width: 80px; padding: 0.3rem; border-radius: 6px; border: 2px solid var(--primary); text-align: center; font-weight: 800; font-size: 1rem; color: var(--primary);">
                            <span id="modal-master-unit" style="font-weight: 800; color: var(--text-secondary); font-size: 0.95rem; background: #f8fafc; padding: 0.2rem 0.6rem; border-radius: 6px;">-</span>
                        </div>
                    </div>
                </div>

                <!-- Section 3: 補充アクション (複数設定対応) -->
                <div style="background: #fdf2f2; padding: 1rem; border-radius: 12px; border: 1px solid #fee2e2;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: #b91c1c;">不足時アクション</label>
                    </div>
                    <div id="modal-actions-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <!-- アクションカードが動的に追加される -->
                    </div>
                    <button id="btn-add-action" type="button" style="margin-top: 0.5rem; width: 100%; padding: 0.4rem; border-radius: 8px; border: 1.5px dashed #fca5a5; background: transparent; color: #b91c1c; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-plus"></i> アクションを追加する
                    </button>
                </div>

                <!-- Action Button -->
                <button id="btn-save-single-item" class="btn btn-primary" style="width: 100%; padding: 0.9rem; margin-top: 0.2rem; font-weight: 900; font-size: 1.1rem; border-radius: 14px; box-shadow: var(--shadow-primary); display: flex; align-items: center; justify-content: center; gap: 0.8rem;">
                    <i class="fas fa-save"></i> 設定を保存する
                </button>
            </div>
        </div>
    </div>

    <!-- Master Settings Large Overlay -->
    <div id="inv-master-settings-overlay">
        <div style="max-width: 1300px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 0.8rem; height: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: var(--text-primary);">在庫マスタ設定</h2>
                    <p style="margin: 0; color: var(--text-secondary); font-weight: 600; font-size: 0.8rem;">店舗で管理する品目の選択とタイミングの管理</p>
                </div>
                <button onclick="hideMasterSettings()" class="btn btn-secondary" style="border-radius: 50%; width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div id="inv-master-settings-content" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                <!-- Content injected by renderSettingsView -->
            </div>
        </div>
    </div>
`;

// Global State
let selectedStore = null;  // {id, name, internalCode, resetTime}
let inventorySearchQuery = ''; 
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
let settingsManagementSearchQuery = ''; // 管理リスト専用の検索クエリ
let currentUser = null;
let inventoryUnsubscribe = null;

// --- パフォーマンス最適化フラグ ---
// マスターデータはセッション中1回だけ取得する
let masterDataLoaded = false;
// 現在リッスン中の店舗コード（同一店舗の重複リスナー防止）
let currentListenedStore = null;

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
    // [最適化] マスターデータはセッション中に1度だけ取得する。
    if (masterDataLoaded) {
        console.log("[Inventory PC] Master data already cached, skipping fetch.");
        return;
    }

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

        // キャッシュ完了フラグをセット
        masterDataLoaded = true;
        console.log("[Inventory PC] Master data loaded and cached.");

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
    const rawTimings = [...new Set(inventoryData.map(d => d.確認タイミング || ''))].sort((a,b) => {
        if (a === '') return -1;
        if (b === '') return 1;
        return a.localeCompare(b);
    });
    
    sidebarTimings.innerHTML = rawTimings.map(tCode => {
        const tName = tCode ? (timingMaster[tCode] || tCode) : "⚠️ タイミング未設定";
        const itemsInTiming = inventoryData.filter(d => (d.確認タイミング || '') === tCode);
        const confirmedItems = itemsInTiming.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime, i.is_confirmed));
        const isAllDone = itemsInTiming.length > 0 && confirmedItems.length === itemsInTiming.length;
        const isActive = selectedTiming && (selectedTiming.id || '') === tCode;
        
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
            inventorySearchQuery = ''; 
            
            // 全てのアコーディオンを閉じる
            const allLocs = [...new Set(inventoryData.filter(d => d.確認タイミング === selectedTiming.id).map(d => d.location_label || d.保管場所 || '未設定'))];
            collapsedSections = new Set(allLocs);
            
            render();
        };
    });

    // Search input control
    const searchContainer = document.getElementById('inv-search-container');
    if (searchContainer) {
        searchContainer.style.display = selectedTiming ? 'block' : 'none';
        const searchInput = document.getElementById('inv-item-search');
        if (searchInput) {
            searchInput.value = inventorySearchQuery;
            searchInput.oninput = (e) => {
                inventorySearchQuery = e.target.value;
                // ヘッダー全体ではなく、リスト部分のみを再描画してフォーカスを維持
                const mainContent = document.getElementById('inv-main-content');
                if (mainContent) renderChecklist(mainContent);
            };
        }
    }

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

    // Manual Reset Button
    const btnReset = document.getElementById('btn-manual-reset');
    if (btnReset) {
        const canReset = currentUser?.Role === 'Admin' || currentUser?.Role === '管理者' || currentUser?.Role === 'Manager' || currentUser?.Role === '店長';
        btnReset.style.display = (canReset && selectedTiming) ? 'block' : 'none';
        btnReset.onclick = handleManualReset;
    }
}

async function showMasterSettings() {
    const overlay = document.getElementById('inv-master-settings-overlay');
    const content = document.getElementById('inv-master-settings-content');
    
    if (overlay && content) {
        // [最適化] データは onSnapshot により常に最新状態のため、
        // 設定画面を開くたびに再フェッチする必要はない。
        overlay.classList.add('active');
        renderSettingsView(content);
    }
}

window.hideMasterSettings = () => {
    const overlay = document.getElementById('inv-master-settings-overlay');
    if (overlay) overlay.classList.remove('active');
};

function renderChecklist(container) {
    let items = [];
    let isGlobalSearch = false;

    // 検索フィルタの適用
    if (inventorySearchQuery) {
        isGlobalSearch = true;
        const q = inventorySearchQuery.toLowerCase();
        // 全データから検索
        items = inventoryData.filter(item => {
            const masterName = (productMap[item.ProductID] || '').toLowerCase();
            const displayName = (item.display_name || '').toLowerCase();
            const location = (item.location_label || item.保管場所 || '').toLowerCase();
            return masterName.includes(q) || displayName.includes(q) || location.includes(q);
        });

        // 検索結果があるロケーション（棚）は強制的に展開する
        items.forEach(item => {
            const loc = item.location_label || item.保管場所 || '未設定';
            if (collapsedSections.has(loc)) {
                collapsedSections.delete(loc);
            }
        });
        
        document.getElementById('inv-current-title').innerHTML = `
            <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">全タイミングから検索中:</span> 
            <span style="color: var(--primary);">${inventorySearchQuery}</span>
        `;
    } else {
        // 通常時：選択中のタイミングで絞り込み
        items = inventoryData.filter(d => (d.確認タイミング || '') === (selectedTiming.id || ''));
        document.getElementById('inv-current-title').textContent = `${selectedStore.name} / ${selectedTiming.name}`;
    }
    
    const confirmedCount = items.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime, i.is_confirmed)).length;
    document.getElementById('inv-stats').textContent = `${isGlobalSearch ? 'ヒット' : '完了'}: ${isGlobalSearch ? items.length : confirmedCount + ' / ' + items.length}`;

    renderInventoryTable(container, items, isGlobalSearch);
}

function renderInventoryTable(container, items, isGlobalSearch) {
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
                    <th style="width: 60px; text-align: center;">完了</th>
                    <th style="width: 80px; text-align: center;">定数</th>
                    <th style="width: 50px; text-align: center;"><i class="fas fa-cog"></i></th>
                </tr>
            </thead>
            <tbody>
    `;

    Object.keys(groupedItems).forEach(loc => {
        const locItems = groupedItems[loc];
        const confirmedCount = locItems.filter(i => isConfirmedToday(i.updated_at, selectedStore.resetTime, i.is_confirmed)).length;
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
                        <button class="section-confirm-btn" data-loc="${loc}" style="display: ${isGlobalSearch ? 'none' : 'flex'}">
                            <i class="fas fa-check-double"></i> この棚を完了
                        </button>
                    </div>
                </td>
            </tr>
        `;

        locItems.forEach((item, index) => {
            const isConfirmed = isConfirmedToday(item.updated_at, selectedStore.resetTime, item.is_confirmed);
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
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div style="font-weight: 800; font-size: 1rem; color: var(--text-primary);">${displayName}</div>
                            ${isGlobalSearch ? `<span style="font-size: 0.65rem; background: #f1f5f9; color: #64748b; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700;">${timingMaster[item.確認タイミング] || '未設定'}</span>` : ''}
                        </div>
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
                    <td style="text-align: center;">
                        <button class="confirm-btn ${isConfirmed ? 'active' : ''}" data-id="${item.id}" title="確定">
                            <i class="fas fa-check"></i>
                        </button>
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
            // 検索中かどうかを判定して渡す
            const isGlobalSearch = !!inventorySearchQuery;
            renderInventoryTable(container, items, isGlobalSearch);
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

    // 完了トグルボタンのリスナー
    container.querySelectorAll('.confirm-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            toggleItemConfirmation(btn.dataset.id);
        };
    });

    // 棚の一括完了ボタンのリスナー
    container.querySelectorAll('.section-confirm-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            handleSectionConfirm(btn.dataset.loc);
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
            
            // 検索モード中で、かつ選択中のタイミングと異なる場合、タイミングを同期させる
            if (isGlobalSearch && editingItem && editingItem.確認タイミング !== (selectedTiming ? selectedTiming.id : null)) {
                const tName = timingMaster[editingItem.確認タイミング] || "⚠️ タイミング未設定";
                selectedTiming = { id: editingItem.確認タイミング, name: tName };
                
                // サイドバーのハイライトを更新するために描画
                // ※ただし input のフォーカスが外れないように注意
                const sidebarTimings = document.getElementById('inv-timing-list');
                if (sidebarTimings) {
                    sidebarTimings.querySelectorAll('.timing-item').forEach(item => {
                        item.classList.toggle('active', item.dataset.code === (editingItem.確認タイミング || ''));
                    });
                }
            }
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
        // [最適化] ローカル状態はforEachループ内で更新済み。再フェッチ不要。
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

async function toggleItemConfirmation(id) {
    const item = inventoryData.find(i => i.id === id);
    if (!item) return;

    const isConfirmed = isConfirmedToday(item.updated_at, selectedStore.resetTime, item.is_confirmed);
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

        // [最適化] 楽観的ローカル更新。再フェッチ不要。
        // 他ユーザーの変更は onSnapshot のデルタ配信で自動反映される。
        item.is_confirmed = newConfirmed;
        item.updated_at = now;
        item.confirmed_at = newConfirmed ? now : null;
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

        // 履歴ログ（一括）
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

        // [最適化] 楽観的ローカル更新。バッチ後に再フェッチ不要。
        itemsInSection.forEach(item => {
            item.is_confirmed = true;
            item.updated_at = now;
            item.confirmed_at = now;
            item.confirmed_by = currentUser?.Name || 'unknown';
        });

        render();
    } catch (err) {
        console.error("Section confirm failed:", err);
        alert("一括完了に失敗しました");
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

export async function initInventoryPage(user) {
    // 既存のリスナーがあれば解除
    if (inventoryUnsubscribe) {
        inventoryUnsubscribe();
        inventoryUnsubscribe = null;
    }
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

    // 初回表示時のみ、すべてのタイミングをデフォルトで閉じる
    if (!settingsInitialized) {
        const allTimings = [...new Set(inventoryData.map(d => d.確認タイミング))];
        settingsCollapsedTimings = new Set(allTimings);
        settingsInitialized = true;
    }

    // Filter manageable items using unified logic
    const manageableItems = cachedItems.filter(isInventoryTarget);
    const categories = [...new Set(manageableItems.map(i => i.category || i.カテゴリー || 'その他'))].sort();
    
    // Get all unique vendors for datalist
    const vendors = [...new Set(cachedSuppliers.map(s => s.vendor_name).filter(Boolean))].sort();

    container.innerHTML = `
        <!-- Header: Store Info & Action -->
        <div style="margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center; background: white; padding: 0.6rem 1.2rem; border-radius: 12px; border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <span style="background: var(--primary); color: white; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">SETTING</span>
                <h2 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: var(--text-primary);">${selectedStore.name}</h2>
            </div>
            <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-secondary);">
                登録済み: <span style="color: var(--primary);">${inventoryData.length}</span> 品目
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 360px 1fr 280px; gap: 1rem; flex: 1; min-height: 0;">
            
            <!-- Column 1: Master Catalog (Add New) -->
            <div class="glass-panel" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; background: #f8fafc; border: 1px solid var(--border);">
                <div style="padding: 0.8rem 1.2rem; background: white; border-bottom: 1px solid var(--border);">
                    <h3 style="margin: 0 0 0.8rem 0; font-size: 0.9rem; font-weight: 800;"><i class="fas fa-search-plus" style="color: var(--primary);"></i> マスタから追加</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.6rem;">
                        <div class="input-group" style="margin:0;">
                            <input type="text" id="settings-supplier-filter" list="supplier-datalist" placeholder="業者絞込..." 
                                   value="${settingsSelectedSupplier === 'ALL' ? '' : settingsSelectedSupplier}"
                                   style="font-size: 0.75rem; padding: 0.4rem; border-radius: 6px;">
                            <datalist id="supplier-datalist">
                                ${vendors.map(v => `<option value="${v}">`).join('')}
                            </datalist>
                        </div>
                        <div class="input-group" style="margin:0;">
                            <input type="text" id="settings-category-filter-new" list="category-datalist" placeholder="カテゴリ絞込..." 
                                   value="${settingsSelectedCategory === 'ALL' ? '' : settingsSelectedCategory}"
                                   style="font-size: 0.75rem; padding: 0.4rem; border-radius: 6px;">
                            <datalist id="category-datalist">
                                ${categories.map(c => `<option value="${c}">`).join('')}
                            </datalist>
                        </div>
                    </div>
                    <div class="input-group" style="margin:0; position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); font-size: 0.8rem; color: #94a3b8;"></i>
                        <input type="text" id="inv-master-search-new" placeholder="品目名・ふりがなで検索..." 
                               value="${settingsSearchQuery}" 
                               style="padding: 0.4rem 0.4rem 0.4rem 2.2rem; font-size: 0.8rem; border-radius: 6px;">
                    </div>
                </div>

                <div id="inv-master-catalog-list" style="flex: 1; overflow-y: auto; padding: 0.5rem;">
                    <!-- Master Items injected here -->
                </div>

                <div style="padding: 0.8rem; background: white; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">※登録済は非表示</div>
                    <button id="btn-bulk-add-catalog" class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; font-weight: 800; border-radius: 6px;">選択を一括追加</button>
                </div>
            </div>

            <!-- Column 2: Management List (Current Inventory) -->
            <div class="glass-panel" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; background: white; border: 1px solid var(--border);">
                <div style="padding: 0.8rem 1.2rem; border-bottom: 1px solid var(--border); background: white; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 0.9rem; font-weight: 800;"><i class="fas fa-list-check" style="color: var(--primary);"></i> 現在の管理リスト</h3>
                    <div id="settings-store-stats" style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary);"></div>
                </div>

                <!-- 管理リスト用検索窓 -->
                <div style="padding: 0.6rem 0.8rem; background: #f8fafc; border-bottom: 1px solid #f1f5f9;">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;"></i>
                        <input type="text" id="settings-management-search" placeholder="管理中の品目を検索..." 
                            value="${settingsManagementSearchQuery}"
                            style="width: 100%; padding: 0.5rem 0.8rem 0.5rem 2rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8rem; font-weight: 600; outline: none; transition: all 0.2s;"
                            onfocus="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 0 0 3px rgba(37,99,235,0.1)'"
                            onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                    </div>
                </div>
                
                <div id="inv-settings-store-list" style="flex: 1; overflow-y: auto; padding: 0.8rem;">
                    <!-- Grouped Store Items injected here -->
                </div>
            </div>

            <!-- Column 3: Timing & Meta -->
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- Timing Management -->
                <div class="glass-panel" style="padding: 1rem; background: white; border: 1px solid var(--border); border-radius: 12px;">
                    <h3 style="margin: 0 0 0.8rem 0; font-size: 0.9rem; font-weight: 800;"><i class="fas fa-clock" style="color: var(--primary);"></i> タイミング管理</h3>
                    <div id="timing-master-list-new" style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 250px; overflow-y: auto; margin-bottom: 0.8rem; padding-right: 0.3rem;"></div>
                    <div style="display: flex; gap: 0.4rem;">
                        <input type="text" id="new-timing-name-new" placeholder="新規名称..." style="flex: 1; padding: 0.4rem; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
                        <button id="btn-add-timing-new" class="btn btn-secondary" style="padding: 0.4rem; width: 32px; height: 32px;"><i class="fas fa-plus"></i></button>
                    </div>
                </div>

                <!-- Info Box -->
                <div class="glass-panel" style="padding: 0.8rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;">
                    <h4 style="margin: 0 0 0.4rem 0; font-size: 0.75rem; font-weight: 800; color: #1e40af;"><i class="fas fa-info-circle"></i> ヒント</h4>
                    <ul style="margin: 0; padding-left: 1.1rem; font-size: 0.7rem; color: #1e40af; line-height: 1.4; font-weight: 600;">
                        <li>右側の [⚙️] で保管場所や定数を個別設定。</li>
                        <li>タイミング削除で品目は「未設定」に移動。</li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    // Bind Events
    const supplierInput = document.getElementById('settings-supplier-filter');
    supplierInput.onchange = (e) => {
        settingsSelectedSupplier = e.target.value || 'ALL';
        renderSettingsItems();
    };

    const categoryInput = document.getElementById('settings-category-filter-new');
    categoryInput.onchange = (e) => {
        settingsSelectedCategory = e.target.value || 'ALL';
        renderSettingsItems();
    };

    const searchInput = document.getElementById('inv-master-search-new');
    searchInput.oninput = (e) => {
        settingsSearchQuery = e.target.value;
        renderSettingsItems();
    };

    const mgmtSearchInput = document.getElementById('settings-management-search');
    mgmtSearchInput.oninput = (e) => {
        settingsManagementSearchQuery = e.target.value;
        renderSettingsItems();
    };

    document.getElementById('btn-bulk-add-catalog').onclick = async () => {
        const checkedPids = Array.from(document.querySelectorAll('.catalog-chk:checked')).map(el => el.value);
        if (checkedPids.length === 0) return;
        if (!confirm(`${checkedPids.length}件の品目を一括登録しますか？`)) return;
        
        await handleBulkAddPids(checkedPids);
    };

    document.getElementById('btn-add-timing-new').onclick = addTimingMaster;

    renderSettingsItems();
    renderTimingMasterList();
}

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
    const mq = settingsManagementSearchQuery.trim().toLowerCase();

    sortedTimingIds.forEach(tId => {
        let items = inventoryData.filter(d => (d.確認タイミング || '') === tId);
        if (items.length === 0) return;

        // 検索フィルタリング
        if (mq) {
            items = items.filter(item => {
                const name = (productMap[item.ProductID] || '').toLowerCase();
                const dName = (item.display_name || '').toLowerCase();
                return name.includes(mq) || dName.includes(mq);
            });
        }

        if (items.length === 0 && mq) return; // 検索中で、このグループにヒットがない場合は非表示

        const tName = tId ? (timingMaster[tId] || tId) : "⚠️ タイミング未設定";
        // 検索中は強制的に展開、それ以外は設定値を参照
        const isCollapsed = mq ? false : settingsCollapsedTimings.has(tId);
        
        html += `
            <div class="timing-accordion-v2" style="margin-bottom: 0.8rem; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div class="timing-header-btn" data-id="${tId}" style="display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem 1rem; background: ${isCollapsed ? '#fff' : '#f8fafc'}; cursor: pointer; user-select: none; transition: background 0.2s;">
                    <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" style="width: 1rem; color: #94a3b8; font-size: 0.8rem;"></i>
                    <span style="font-size: 0.85rem; font-weight: 800; color: #1e293b; flex: 1;">${tName}</span>
                    <span style="font-size: 0.65rem; color: var(--text-secondary); background: #f1f5f9; padding: 0.1rem 0.6rem; border-radius: 10px; font-weight: 700;">${items.length}品目</span>
                </div>
                <div style="display: ${isCollapsed ? 'none' : 'block'}; border-top: 1px solid #f1f5f9;">
                    ${items.map(item => {
                        const name = productMap[item.ProductID] || '不明';
                        const displayName = item.display_name || name;
                        
                        // 検索語のハイライト処理（簡易版）
                        let finalName = displayName;
                        if (mq) {
                            const regex = new RegExp(`(${mq})`, 'gi');
                            finalName = displayName.replace(regex, '<mark style="background:#fef08a; padding:0 2px; border-radius:2px; color:#854d0e;">$1</mark>');
                        }

                        return `
                            <div style="display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem 1rem; border-bottom: 1px solid #f1f5f9;">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${finalName}</div>
                                    <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.1rem;">${item.location_label || '場所未設定'} / ${item.定数 || 0} ${item.display_unit || ''}</div>
                                </div>
                                <div style="display: flex; gap: 0.4rem;">
                                    <button class="btn-edit-item-master" data-id="${item.id}" style="width: 34px; height: 34px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; color: #64748b; cursor: pointer; transition: all 0.2s;"><i class="fas fa-cog"></i></button>
                                    <button class="btn-remove-item" data-id="${item.id}" style="width: 34px; height: 34px; border-radius: 10px; border: 1px solid #fee2e2; background: white; color: #ef4444; cursor: pointer; transition: all 0.2s;"><i class="fas fa-trash-alt"></i></button>
                                </div>
                            </div>
                        `;
                    }).join('')}
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

    // [最適化] 同一店舗のリスナーが既に稼働中なら再生成しない。
    if (inventoryUnsubscribe && currentListenedStore === internalCode) {
        console.log("[Inventory PC] Already listening to store:", internalCode, "- reusing existing listener.");
        return;
    }

    // 別店舗への切替時のみ既存リスナーを解除する
    if (inventoryUnsubscribe) {
        inventoryUnsubscribe();
        inventoryUnsubscribe = null;
    }

    currentListenedStore = internalCode;

    const main = document.getElementById('inv-main-content');
    if (main) main.innerHTML = `<div style="text-align:center; padding: 4rem;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i><p>読み込み中...</p></div>`;

    return new Promise((resolve, reject) => {
        const q = query(collection(db, "m_store_items"), where("StoreID", "==", internalCode));
        
        let isFirstLoad = true;

        inventoryUnsubscribe = onSnapshot(q, async (snap) => {
            console.log("[Inventory PC] Snapshot received. Changed docs:", snap.docChanges().length, "/ Total:", snap.size);
            
            const newData = [];
            snap.forEach(d => {
                newData.push({ id: d.id, ...d.data() });
            });
            
            inventoryData = newData;

            // [最適化] resolve()を先に呼んでUIをブロックしない。
            // 理論在庫はバックグラウンドで計算する。
            if (isFirstLoad) {
                isFirstLoad = false;
                resolve();
                loadTheoreticalStocks(internalCode).catch(err => {
                    console.error("Theoretical stock error:", err);
                });
            }

            render();
            
        }, (err) => {
            console.error("[Inventory PC] Error in real-time listener:", err);
            currentListenedStore = null; // エラー時はリセット
            if (isFirstLoad) reject(err);
        });
    });
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

// ============================================================
// 複数アクションUI ヘルパー関数
// ============================================================

/**
 * shortage_actions配列を既存フィールドから生成する後方互換ヘルパー
 */
function getItemActions(item) {
    if (item.shortage_actions && item.shortage_actions.length > 0) {
        return item.shortage_actions;
    }
    // 旧フィールドからの変換
    const oldType = item.shortage_action_type || 'purchase';
    const action = { type: oldType };
    if (oldType === 'transfer' && item.default_source_store_id) {
        action.source_store_id = item.default_source_store_id;
    }
    return [action];
}

/**
 * アクションカードのHTMLを生成してコンテナに追加
 */
// addActionCard から参照するためにモジュールスコープで保持
let _updateUnitPreview = null;

function addActionCard(container, actionData, sameGroupStores, itemProductId) {
    const idx = container.children.length;
    const card = document.createElement('div');
    card.className = 'action-card';
    card.dataset.idx = idx;
    card.style.cssText = 'background: white; border: 1px solid #fca5a5; border-radius: 10px; padding: 0.8rem; position: relative;';

    const typeVal = actionData?.type || 'purchase';
    const sourceVal = actionData?.source_store_id || '';
    const consumeItemVal = actionData?.consume_item_id || '';
    const consumeQtyVal = actionData?.consume_qty_per_unit || 1;
    const consumeUnitVal = actionData?.consume_unit || '';

    const storeOptions = sameGroupStores.map(s =>
        `<option value="${s.code}" ${s.code === sourceVal ? 'selected' : ''}>${s.name}</option>`
    ).join('') || '<option value="">(グループ内店舗なし)</option>';

    // 消費品目の選択肢（cachedItemsから）
    const itemOptions = cachedItems.map(i =>
        `<option value="${i.id}" ${i.id === consumeItemVal ? 'selected' : ''}>${i.name || i.id}</option>`
    ).join('');

    card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;">
            <select class="action-type-select" style="flex: 1; padding: 0.5rem; border-radius: 6px; border: 1px solid #fca5a5; font-weight: 700; background: white; color: #b91c1c; font-size: 0.85rem;">
                <option value="purchase" ${typeVal === 'purchase' ? 'selected' : ''}>仕入れ</option>
                <option value="linked_purchase" ${typeVal === 'linked_purchase' ? 'selected' : ''}>仕込連動仕入れ</option>
                <option value="prep" ${typeVal === 'prep' ? 'selected' : ''}>店舗仕込み</option>
                <option value="ck_prep" ${typeVal === 'ck_prep' ? 'selected' : ''}>CK仕込み</option>
                <option value="transfer" ${typeVal === 'transfer' ? 'selected' : ''}>移動</option>
                <option value="consume" ${typeVal === 'consume' ? 'selected' : ''}>消費（仕込み連動）</option>
            </select>
            <button type="button" class="btn-remove-action" style="width:28px; height:28px; border-radius:50%; background:#fee2e2; border:none; color:#b91c1c; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <!-- transfer: 移動元店舗 -->
        <div class="action-transfer-config" style="display:${typeVal === 'transfer' ? 'block' : 'none'}; margin-top: 0.4rem;">
            <label style="font-size:0.7rem; font-weight:700; color:#b91c1c;">移動元店舗</label>
            <select class="action-source-store" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid #fca5a5; font-weight:600; background:white; color:#b91c1c; margin-top:0.2rem;">
                ${storeOptions}
            </select>
            <div class="transfer-source-warning" style="font-size:0.65rem; color:#dc2626; margin-top:0.3rem; font-weight:700; display:none;">
                <i class="fas fa-exclamation-triangle"></i> この店舗にはこの品目が登録されていません（移動元として設定できません）
            </div>
            <div class="transfer-source-synced" style="font-size:0.65rem; color:#059669; margin-top:0.3rem; font-weight:700; display:none;">
                <i class="fas fa-link"></i> 移動元の単位設定を引き継ぎます
            </div>
        </div>
        <!-- consume: 消費元・消費品目・数量 -->
        <div class="action-consume-config" style="display:${typeVal === 'consume' ? 'flex' : 'none'}; flex-direction:column; gap:0.4rem; margin-top:0.4rem;">
            <div>
                <label style="font-size:0.7rem; font-weight:700; color:#b91c1c;">消費元店舗（倉庫）</label>
                <select class="action-consume-source" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid #fca5a5; font-weight:600; background:white; color:#b91c1c; margin-top:0.2rem;">
                    ${storeOptions}
                </select>
            </div>
            <div style="position:relative;">
                <label style="font-size:0.7rem; font-weight:700; color:#b91c1c;">消費品目（倉庫から取り出す原材料）</label>
                <input type="hidden" class="action-consume-item" value="${consumeItemVal}">
                <div style="position:relative; margin-top:0.2rem;">
                    <i class="fas fa-search" style="position:absolute; left:0.5rem; top:50%; transform:translateY(-50%); color:#fca5a5; font-size:0.75rem; pointer-events:none;"></i>
                    <input type="text" class="action-consume-search" placeholder="品目名で検索..."
                        value=""
                        style="width:100%; padding:0.5rem 0.5rem 0.5rem 1.8rem; border-radius:6px; border:1px solid #fca5a5; font-weight:600; color:#b91c1c; box-sizing:border-box;">
                    <div class="action-consume-suggestions" style="display:none; position:absolute; top:100%; left:0; right:0; background:white; border:1px solid #fca5a5; border-radius:6px; box-shadow:0 8px 20px rgba(0,0,0,0.12); z-index:9999; max-height:180px; overflow-y:auto; margin-top:2px;"></div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; background:#fff5f5; padding:0.5rem; border-radius:6px;">
                <label style="font-size:0.7rem; font-weight:700; color:#b91c1c; white-space:nowrap;">
                    <span class="action-target-unit-label">${document.getElementById('modal-unit')?.value || '1単位'}</span>あたり消費量
                </label>
                <input type="number" class="action-consume-qty" step="any" min="0" value="${consumeQtyVal}" style="width:60px; padding:0.4rem; border-radius:6px; border:1px solid #fca5a5; text-align:center; font-weight:800; font-size:0.95rem; color:#b91c1c;">
                <span class="action-consume-unit-label" style="font-size:0.8rem; font-weight:700; color:#64748b;">${consumeUnitVal || '単位'}</span>
            </div>
        </div>

        <!-- linked_purchase: 仕込連動仕入れ（品目・数量） -->
        <div class="action-linked-purchase-config" style="display:${typeVal === 'linked_purchase' ? 'flex' : 'none'}; flex-direction:column; gap:0.4rem; margin-top:0.4rem;">
            <div style="position:relative;">
                <label style="font-size:0.7rem; font-weight:700; color:#b91c1c;">仕入れ品目（発注する原材料）</label>
                <input type="hidden" class="action-linked-purchase-item" value="${actionData?.purchase_item_id || ''}">
                <div style="position:relative; margin-top:0.2rem;">
                    <i class="fas fa-shopping-cart" style="position:absolute; left:0.5rem; top:50%; transform:translateY(-50%); color:#fca5a5; font-size:0.75rem; pointer-events:none;"></i>
                    <input type="text" class="action-linked-purchase-search" placeholder="品目名で検索..."
                        value="${cachedItems.find(i => i.id === actionData?.purchase_item_id)?.name || ''}"
                        style="width:100%; padding:0.5rem 0.5rem 0.5rem 1.8rem; border-radius:6px; border:1px solid #fca5a5; font-weight:600; color:#b91c1c; box-sizing:border-box;">
                    <div class="action-linked-purchase-suggestions" style="display:none; position:absolute; top:100%; left:0; right:0; background:white; border:1px solid #fca5a5; border-radius:6px; box-shadow:0 8px 20px rgba(0,0,0,0.12); z-index:9999; max-height:180px; overflow-y:auto; margin-top:2px;"></div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; background:#fff5f5; padding:0.5rem; border-radius:6px;">
                <label style="font-size:0.7rem; font-weight:700; color:#b91c1c; white-space:nowrap;">
                    <span class="action-target-unit-label">${document.getElementById('modal-unit')?.value || '1単位'}</span>あたり仕入量
                </label>
                <input type="number" class="action-linked-purchase-qty" step="any" min="0" value="${actionData?.purchase_qty_per_unit || 1}" style="width:60px; padding:0.4rem; border-radius:6px; border:1px solid #fca5a5; text-align:center; font-weight:800; font-size:0.95rem; color:#b91c1c;">
                <span class="action-linked-purchase-unit-label" style="font-size:0.8rem; font-weight:700; color:#64748b;">${actionData?.unit || '単位'}</span>
            </div>
        </div>
    `;

    // 種類変更時の表示切替
    const typeSelect = card.querySelector('.action-type-select');
    const transferConfig = card.querySelector('.action-transfer-config');
    const consumeConfig = card.querySelector('.action-consume-config');
    const linkedPurchaseConfig = card.querySelector('.action-linked-purchase-config');
    typeSelect.onchange = () => {
        const isTransfer = typeSelect.value === 'transfer';
        transferConfig.style.display = isTransfer ? 'block' : 'none';
        consumeConfig.style.display = typeSelect.value === 'consume' ? 'flex' : 'none';
        linkedPurchaseConfig.style.display = typeSelect.value === 'linked_purchase' ? 'flex' : 'none';

        // 移動以外に切り替わった場合は、単位のロックを強制解除する
        if (!isTransfer) {
            const modalUnit = document.getElementById('modal-unit');
            const modalConv = document.getElementById('modal-conv');
            if (modalUnit) {
                modalUnit.readOnly = false;
                modalUnit.style.background = '';
            }
            if (modalConv) {
                modalConv.readOnly = false;
                modalConv.style.background = '';
            }
            if (_updateUnitPreview) _updateUnitPreview();
            
            // 警告類もリセット
            const transferWarning = card.querySelector('.transfer-source-warning');
            const transferSynced = card.querySelector('.transfer-source-synced');
            if (transferWarning) transferWarning.style.display = 'none';
            if (transferSynced) transferSynced.style.display = 'none';
            card.dataset.invalidSource = 'false';
        } else {
            // 移動に切り替わった場合は現在の店舗設定でチェックを実行
            if (sourceStoreSelect) checkTransferSource();
        }
    };

    // 移動元店舗の値検証（単位引き継ぎ & 登録確認）
    const sourceStoreSelect = card.querySelector('.action-source-store');
    const transferWarning = card.querySelector('.transfer-source-warning');
    const transferSynced = card.querySelector('.transfer-source-synced');

    const checkTransferSource = async () => {
        const storeId = sourceStoreSelect?.value;
        if (!storeId || !itemProductId) return;

        // m_store_itemsのドキュメントID: 店舗code_productId
        const sid = `${storeId}_${itemProductId}`;
        try {
            const sDoc = await getDoc(doc(db, 'm_store_items', sid));
            if (sDoc.exists()) {
                const sData = sDoc.data();
                // 移動元の単位を移動先に即座に引き継ぎ（単位ロック）
                const modalUnit = document.getElementById('modal-unit');
                const modalConv = document.getElementById('modal-conv');
                if (modalUnit) {
                    modalUnit.value = sData.display_unit || '';
                    modalUnit.readOnly = true;
                    modalUnit.style.background = '#f1f5f9';
                }
                if (modalConv) {
                    modalConv.value = sData.unit_conversion_amount || 1;
                    modalConv.readOnly = true;
                    modalConv.style.background = '#f1f5f9';
                }
                if (_updateUnitPreview) _updateUnitPreview();
                if (transferWarning) transferWarning.style.display = 'none';
                if (transferSynced) transferSynced.style.display = 'block';
                card.dataset.invalidSource = 'false';
            } else {
                // 登録なし → 単位ロック解除・警告
                const modalUnit = document.getElementById('modal-unit');
                const modalConv = document.getElementById('modal-conv');
                if (modalUnit) {
                    modalUnit.readOnly = false;
                    modalUnit.style.background = '';
                }
                if (modalConv) {
                    modalConv.readOnly = false;
                    modalConv.style.background = '';
                }
                if (transferWarning) transferWarning.style.display = 'block';
                if (transferSynced) transferSynced.style.display = 'none';
                card.dataset.invalidSource = 'true';
            }
        } catch (e) {
            console.error('Source store check error:', e);
        }
    };

    if (sourceStoreSelect) {
        sourceStoreSelect.onchange = checkTransferSource;
        // 初期ロード時に transferで小が済みなら即座にチェック
        if (typeVal === 'transfer' && sourceVal) {
            checkTransferSource();
        }
    }

    // 消費品目検索入力のリアルタイムサジェスト
    const consumeItemHidden = card.querySelector('.action-consume-item');
    const consumeSearchInput = card.querySelector('.action-consume-search');
    const suggestionsDiv = card.querySelector('.action-consume-suggestions');
    const consumeUnitLabel = card.querySelector('.action-consume-unit-label');
    const consumeSourceSelect = card.querySelector('.action-consume-source');
    const targetUnitLabel = card.querySelector('.action-target-unit-label');

    // 消費元での単位を取得して更新する関数
    const updateConsumeSourceUnit = async () => {
        const storeId = consumeSourceSelect?.value;
        const itemId = consumeItemHidden?.value;
        if (!storeId || !itemId) return;

        try {
            const sid = `${storeId}_${itemId}`;
            const sDoc = await getDoc(doc(db, 'm_store_items', sid));
            if (sDoc.exists()) {
                const sData = sDoc.data();
                const unit = sData.display_unit || sData.unit || '単位';
                consumeUnitLabel.textContent = unit;
            } else {
                // 店舗未登録の場合はマスタから取得
                const master = cachedItems.find(i => i.id === itemId);
                const ing = cachedIngredients.find(i => i.item_id === itemId);
                consumeUnitLabel.textContent = master?.unit || master?.単位 || ing?.unit || ing?.単位 || '単位';
            }
        } catch (e) {
            console.error('Consume source unit check error:', e);
        }
    };

    // 初期値の設定（既存設定の読み込み時）
    if (consumeItemVal) {
        const initItem = cachedItems.find(i => i.id === consumeItemVal);
        if (initItem) {
            consumeSearchInput.value = initItem.name || initItem.id;
        }
        updateConsumeSourceUnit();
    }

    // ターゲット品目（今設定している品目）の単位ラベルを更新
    const syncTargetUnitLabel = () => {
        const val = document.getElementById('modal-unit')?.value || '1単位';
        if (targetUnitLabel) targetUnitLabel.textContent = val === '単位' ? '1単位' : val;
    };
    syncTargetUnitLabel();
    // modal-unit の変更を監視
    document.getElementById('modal-unit')?.addEventListener('input', syncTargetUnitLabel);

    consumeSearchInput.oninput = () => {
        const q = consumeSearchInput.value.trim().toLowerCase();
        if (!q) { suggestionsDiv.style.display = 'none'; return; }
        const matches = cachedItems.filter(i => (i.name || '').toLowerCase().includes(q)).slice(0, 25);
        if (matches.length === 0) { suggestionsDiv.style.display = 'none'; return; }
        suggestionsDiv.innerHTML = matches.map(i =>
            `<div style="padding:0.5rem 0.8rem; cursor:pointer; font-size:0.85rem; font-weight:600; color:#1e293b; border-bottom:1px solid #f1f5f9; transition:background 0.15s;"
                onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background='white'"
                data-id="${i.id}" data-name="${i.name || i.id}">${i.name || i.id}</div>`
        ).join('');
        suggestionsDiv.style.display = 'block';
    };

    suggestionsDiv.addEventListener('mousedown', (e) => {
        const item = e.target.closest('[data-id]');
        if (!item) return;
        e.preventDefault(); 
        consumeItemHidden.value = item.dataset.id;
        consumeSearchInput.value = item.dataset.name;
        updateConsumeSourceUnit();
        suggestionsDiv.style.display = 'none';
    });

    consumeSourceSelect.onchange = updateConsumeSourceUnit;

    consumeSearchInput.onblur = () => {
        setTimeout(() => { suggestionsDiv.style.display = 'none'; }, 150);
    };
    consumeSearchInput.onfocus = () => {
        if (consumeSearchInput.value.trim()) consumeSearchInput.dispatchEvent(new Event('input'));
    };

    // 消費品目変更時に管理単位ラベルを更新 (互換性維持)
    const consumeItemSelect = null; // 後方互揓性のため変数维持

    // 削除ボタン
    card.querySelector('.btn-remove-action').onclick = () => {
        card.remove();
    };

    // --- Linked Purchase Logic ---
    const linkedItemHidden = card.querySelector('.action-linked-purchase-item');
    const linkedSearchInput = card.querySelector('.action-linked-purchase-search');
    const linkedSuggestionsDiv = card.querySelector('.action-linked-purchase-suggestions');
    const linkedUnitLabel = card.querySelector('.action-linked-purchase-unit-label');

    if (linkedSearchInput) {
        linkedSearchInput.oninput = () => {
            const q = linkedSearchInput.value.trim().toLowerCase();
            if (!q) { linkedSuggestionsDiv.style.display = 'none'; return; }
            const matches = cachedItems.filter(i => (i.name || '').toLowerCase().includes(q)).slice(0, 25);
            if (matches.length === 0) { linkedSuggestionsDiv.style.display = 'none'; return; }
            linkedSuggestionsDiv.innerHTML = matches.map(i =>
                `<div style="padding:0.5rem 0.8rem; cursor:pointer; font-size:0.85rem; font-weight:600; color:#1e293b; border-bottom:1px solid #f1f5f9; transition:background 0.15s;"
                    onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background='white'"
                    data-id="${i.id}" data-name="${i.name || i.id}">${i.name || i.id}</div>`
            ).join('');
            linkedSuggestionsDiv.style.display = 'block';
        };

        linkedSuggestionsDiv.addEventListener('mousedown', (e) => {
            const item = e.target.closest('[data-id]');
            if (!item) return;
            e.preventDefault(); 
            linkedItemHidden.value = item.dataset.id;
            linkedSearchInput.value = item.dataset.name;
            // 単位ラベルの更新
            const master = cachedItems.find(i => i.id === item.dataset.id);
            linkedUnitLabel.textContent = master?.unit || master?.単位 || '単位';
            linkedSuggestionsDiv.style.display = 'none';
        });

        linkedSearchInput.onblur = () => {
            setTimeout(() => { linkedSuggestionsDiv.style.display = 'none'; }, 150);
        };
    }

    container.appendChild(card);
}

function showItemSettingsModal(itemId) {
    const item = inventoryData.find(i => i.id === itemId);
    if (!item) return;
    
    editingItem = item;
    const modal = document.getElementById('inv-item-modal');
    document.getElementById('modal-item-name').textContent = productMap[item.ProductID] || '品目設定';
    
    // Find master unit for better UI
    let masterUnit = '-';
    const rawItem = cachedItems.find(i => i.id === item.ProductID);
    if (rawItem) masterUnit = rawItem.unit || rawItem.単位 || '-';
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
    
    // 単位プレビューの更新
    const unitInput = document.getElementById('modal-unit');
    const unitPreview = document.getElementById('modal-unit-preview');
    const updateUnitPreview = () => {
        const val = unitInput.value || '単位';
        unitPreview.textContent = `1 ${val} ＝`;
    };
    _updateUnitPreview = updateUnitPreview; // addActionCard内から参照できるように登録
    unitInput.oninput = updateUnitPreview;
    updateUnitPreview();

    // --- 複数アクションUI の初期化 ---
    const actionsContainer = document.getElementById('modal-actions-container');
    actionsContainer.innerHTML = '';

    const currentStoreData = allStores.find(s => s.code === selectedStore.code);
    const currentGroup = currentStoreData?.group_name;
    const sameGroupStores = allStores.filter(s => s.code !== selectedStore.code && s.group_name === currentGroup);

    const existingActions = getItemActions(item);
    existingActions.forEach(actionData => {
        addActionCard(actionsContainer, actionData, sameGroupStores, item.ProductID);
    });

    // 「アクションを追加する」ボタン
    const btnAdd = document.getElementById('btn-add-action');
    btnAdd.onclick = () => {
        addActionCard(actionsContainer, { type: 'purchase' }, sameGroupStores, item.ProductID);
    };

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

    // --- 複数アクションを配列として収集 ---
    const actionsContainer = document.getElementById('modal-actions-container');
    const actionCards = actionsContainer.querySelectorAll('.action-card');
    const shortage_actions = [];
    actionCards.forEach(card => {
        const type = card.querySelector('.action-type-select').value;
        const actionEntry = { type };
        if (type === 'transfer') {
            const sourceId = card.querySelector('.action-source-store')?.value || '';
            actionEntry.source_store_id = sourceId;
            
            // バリデーション: 移動元の在庫登録チェック
            if (card.dataset.invalidSource === 'true') {
                const sourceName = card.querySelector('.action-source-store option:checked')?.textContent || sourceId;
                throw new Error(`「${sourceName}」にはこの品目が登録されていません。移動元として設定できません。`);
            }
        } else if (type === 'consume') {
            actionEntry.source_store_id = card.querySelector('.action-consume-source')?.value || '';
            actionEntry.consume_item_id = card.querySelector('.action-consume-item')?.value || '';
            actionEntry.consume_qty_per_unit = Number(card.querySelector('.action-consume-qty')?.value) || 1;
            actionEntry.consume_unit = card.querySelector('.action-consume-unit-label')?.textContent || '';
        } else if (type === 'linked_purchase') {
            actionEntry.purchase_item_id = card.querySelector('.action-linked-purchase-item')?.value || '';
            actionEntry.purchase_qty_per_unit = Number(card.querySelector('.action-linked-purchase-qty')?.value) || 1;
            actionEntry.unit = card.querySelector('.action-linked-purchase-unit-label')?.textContent || '';
        }
        shortage_actions.push(actionEntry);
    });

    // 後方互換: 旧フィールドは先頭アクションで設定
    const primaryAction = shortage_actions[0] || { type: 'purchase' };
    const primaryType = primaryAction.type;
    const legacySourceId = primaryType === 'transfer' ? (primaryAction.source_store_id || null) : null;

    const data = {
        確認タイミング: document.getElementById('modal-timing').value,
        display_name: document.getElementById('modal-display-name').value.trim(),
        location_label: document.getElementById('modal-location').value,
        保管場所: document.getElementById('modal-location').value,
        定数: Number(document.getElementById('modal-par').value) || 0,
        display_unit: document.getElementById('modal-unit').value,
        unit_conversion_amount: Number(document.getElementById('modal-conv').value) || 1,
        shortage_actions: shortage_actions,
        shortage_action_type: primaryType,          // 後方互換
        default_source_store_id: legacySourceId,    // 後方互換
        updated_at: new Date().toISOString()
    };

    try {
        await updateDoc(doc(db, "m_store_items", editingItem.id), data);

        // 【重要】移動元としての他店舗への連動更新（旧仕様との互換）
        if (legacySourceId) {
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
        }

        Object.assign(editingItem, data);
        hideItemModal();
        render();
    } catch (err) {
        if (overlay) overlay.style.display = 'none';
        showAlert('保存できません', err.message);
    } finally { 
        if (overlay) overlay.style.display = 'none'; 
    }
}
