import { inventoryPageHtml, initInventoryPage } from './inventory.js';
import { inventoryMobilePageHtml, initInventoryMobilePage } from './inventory_mobile.js';
import { procurementPageHtml, initProcurementPage } from './procurement.js';
import { procurementMobilePageHtml, initProcurementMobilePage } from './procurement_mobile.js';
import { stocktakePageHtml, initStocktakePage } from './stocktake.js';

export const opsHubMainPageHtml = `
    <div id="ops-hub-main-container" class="animate-fade-in app-container-fill" style="display: flex; flex-direction: column; overflow: hidden;">
        <!-- Top Tab Navigation -->
        <div class="ops-hub-tabs glass" style="display: flex; gap: 0.5rem; padding: 0.8rem 1.5rem; background: rgba(255,255,255,0.6); border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0;">
            <button class="ops-tab-btn active" data-tab="inventory" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.2rem; border-radius: 12px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 800; font-size: 0.85rem; transition: all 0.2s; white-space: nowrap;">
                <i class="fas fa-warehouse"></i> 在庫チェック
            </button>
            <button class="ops-tab-btn" data-tab="transfer" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.2rem; border-radius: 12px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 800; font-size: 0.85rem; transition: all 0.2s; white-space: nowrap;">
                <i class="fas fa-exchange-alt"></i> 移動
            </button>
            <button class="ops-tab-btn" data-tab="purchase" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.2rem; border-radius: 12px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 800; font-size: 0.85rem; transition: all 0.2s; white-space: nowrap;">
                <i class="fas fa-shopping-cart"></i> 仕入れ
            </button>
            <button class="ops-tab-btn" data-tab="store_prep" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.2rem; border-radius: 12px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 800; font-size: 0.85rem; transition: all 0.2s; white-space: nowrap;">
                <i class="fas fa-utensils"></i> 店舗仕込み
            </button>
            <button class="ops-tab-btn" data-tab="ck_prep" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.2rem; border-radius: 12px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 800; font-size: 0.85rem; transition: all 0.2s; white-space: nowrap;">
                <i class="fas fa-industry"></i> CK仕込み
            </button>
            <button class="ops-tab-btn" data-tab="stocktake" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.2rem; border-radius: 12px; border: 1px solid var(--border); background: white; cursor: pointer; font-weight: 800; font-size: 0.85rem; transition: all 0.2s; white-space: nowrap;">
                <i class="fas fa-clipboard-list"></i> 棚卸
            </button>
            
            <!-- Shortcut to Master -->
            <button id="btn-goto-recipe-master" style="margin-left: auto; display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.2rem; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; cursor: pointer; font-weight: 800; font-size: 0.85rem; transition: all 0.2s; white-space: nowrap;">
                <i class="fas fa-book"></i> 商品レシピマスタ <i class="fas fa-external-link-alt" style="font-size: 0.7rem; opacity: 0.7;"></i>
            </button>
        </div>

        <!-- Content Area -->
        <div id="ops-hub-content" style="flex: 1; overflow: hidden; position: relative;">
            <!-- Child pages will be injected here -->
        </div>

        <!-- Common Progress Bar (Mobile Only) -->
        <div id="ops-progress-bar-container" style="display: none; height: 5px; background: #e2e8f0; flex-shrink: 0; z-index: 1001; width: 100%;">
            <div id="ops-progress-line" style="height: 100%; width: 0%; background: #10b981; transition: width 0.3s; box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);"></div>
        </div>

        <!-- Common Bottom Navigation (Mobile Only) -->
        <footer id="ops-mobile-tab-bar" style="display: none; background: white; border-top: 1px solid #f1f5f9; height: 60px; padding-bottom: env(safe-area-inset-bottom); flex-shrink: 0; z-index: 1000; width: 100%;">
            <div class="mobile-tab-item active" data-tab="inventory">
                <i class="fas fa-clipboard-list"></i>
                <span>在庫チェック</span>
            </div>
            <div class="mobile-tab-item" data-tab="buy_move">
                <i class="fas fa-truck-loading"></i>
                <span>買う・動かす</span>
            </div>
            <div class="mobile-tab-item" data-tab="make">
                <i class="fas fa-utensils"></i>
                <span>作る</span>
            </div>
            <div class="mobile-tab-item" data-tab="settings">
                <i class="fas fa-cog"></i>
                <span>設定</span>
            </div>
        </footer>

        <style>
            .ops-tab-btn.active { 
                background: var(--primary) !important; 
                color: white !important; 
                border-color: var(--primary) !important; 
                box-shadow: 0 4px 12px rgba(230, 57, 70, 0.2); 
            }
            .ops-tab-btn:hover:not(.active) { 
                background: #f8fafc; 
                border-color: var(--primary); 
                color: var(--primary); 
            }
            /* 子画面のスタイル調整 */
            #ops-hub-content > div { height: 100% !important; padding-top: 0 !important; }
            /* 統合ハブ内では既存の垂直カテゴリー選択（procurement.js内）を隠す */
            #ops-hub-content #proc-category-config { display: none !important; }

            /* スマホ版スタイル */
            @media (max-width: 768px) {
                .ops-hub-tabs { display: none !important; }
                #ops-hub-main-container { height: 100% !important; }
                #ops-mobile-tab-bar { display: flex !important; }
                
                .mobile-tab-item { 
                    flex: 1; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    gap: 4px; 
                    color: #94a3b8; 
                    font-size: 0.65rem; 
                    font-weight: 800; 
                }
                .mobile-tab-item i { font-size: 1.2rem; }
                .mobile-tab-item.active { color: var(--primary); }
            }
        </style>
    </div>
`;

let currentTab = 'inventory';
let currentUser = null;

export async function initOpsHubMainPage(user) {
    currentUser = user;
    setupTabListeners();
    
    // 所属店舗のタイプを判定してデフォルトタブを切り替える
    let defaultTab = 'inventory';
    try {
        const { db } = await import('./firebase.js');
        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const storeSnap = await getDoc(doc(db, "m_stores", user.StoreID || 'honten'));
        if (storeSnap.exists() && storeSnap.data().store_type === 'CK') {
            defaultTab = 'buy_move';
        }
    } catch (e) {
        console.error("Failed to determine store type for default tab:", e);
    }
    
    // デフォルトタブを表示
    switchTab(defaultTab);
}

function setupTabListeners() {
    // PC Tabs
    const tabs = document.querySelectorAll('.ops-tab-btn');
    tabs.forEach(tab => {
        tab.onclick = () => {
            const tabId = tab.dataset.tab;
            if (tabId === currentTab) return;
            switchTab(tabId);
        };
    });

    // Mobile Bottom Tabs
    const mobileTabs = document.querySelectorAll('.mobile-tab-item');
    mobileTabs.forEach(tab => {
        tab.onclick = () => {
            const tabId = tab.dataset.tab;
            if (tabId === currentTab && tabId !== 'settings') return;
            switchTab(tabId);
        };
    });

    const btnMaster = document.getElementById('btn-goto-recipe-master');
    if (btnMaster) {
        btnMaster.onclick = () => {
            if (window.navigateTo) {
                window.navigateTo('products');
            }
        };
    }

    // グローバルに公開
    window.switchOpsHubTab = switchTab;
    
    window.updateOpsHubProgress = (percent) => {
        const line = document.getElementById('ops-progress-line');
        if (line) {
            line.style.width = `${percent}%`;
            // 0% のときはバー自体をさらに薄くする工夫
            const container = document.getElementById('ops-progress-bar-container');
            if (container) container.style.opacity = percent === 0 ? '0.2' : '1';
        }
    };
}

const tabContainers = {};
const tabInitialized = {};

async function switchTab(tabId) {
    currentTab = tabId;
    const content = document.getElementById('ops-hub-content');
    if (!content) return;

    // タブの活性状態を更新 (PC)
    document.querySelectorAll('.ops-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // タブの活性状態を更新 (Mobile)
    document.querySelectorAll('.mobile-tab-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    const isMobile = window.innerWidth < 768;

    // コンテンツの切り替え
    const progressContainer = document.getElementById('ops-progress-bar-container');
    if (progressContainer) {
        progressContainer.style.display = (isMobile && tabId === 'inventory') ? 'block' : 'none';
    }

    // 既存のコンテナを非表示
    Object.values(tabContainers).forEach(el => {
        el.style.display = 'none';
    });

    let cacheKey = tabId;
    const procurementTabs = ['transfer', 'purchase', 'store_prep', 'ck_prep'];
    
    if (procurementTabs.includes(tabId)) {
        cacheKey = isMobile ? 'procurement_mobile' : 'procurement_pc';
    } else if (tabId === 'buy_move' || tabId === 'make') {
        cacheKey = 'procurement_mobile';
    } else if (tabId === 'settings' && isMobile) {
        // モバイルの設定画面は在庫タブのHTMLを流用するため、同じコンテナを使う
        cacheKey = 'inventory';
    }

    if (!tabContainers[cacheKey]) {
        const el = document.createElement('div');
        el.style.cssText = 'height: 100%; position: relative;';
        el.dataset.tabContent = cacheKey;
        content.appendChild(el);
        tabContainers[cacheKey] = el;

        if (cacheKey === 'inventory') {
            if (isMobile) {
                el.innerHTML = inventoryMobilePageHtml;
                await initInventoryMobilePage(currentUser);
                if (tabId === 'settings' && window.showMasterSettings) {
                    window.showMasterSettings();
                }
            } else {
                el.innerHTML = inventoryPageHtml;
                await initInventoryPage(currentUser);
            }
        } 
        else if (cacheKey === 'procurement_mobile') {
            const defaultSubTab = tabId === 'buy_move' ? 'purchase' : 'store_prep';
            // buy_move や make はモバイル専用カテゴリ、purchase等はPCから来る場合がある
            const initialCategory = (tabId === 'buy_move' || tabId === 'make') ? defaultSubTab : tabId;
            el.innerHTML = procurementMobilePageHtml;
            await initProcurementMobilePage(currentUser, initialCategory);
            
            if (window.filterProcurementCategories) {
                window.filterProcurementCategories(tabId);
            }
        }
        else if (cacheKey === 'procurement_pc') {
            el.innerHTML = procurementPageHtml;
            await initProcurementPage(currentUser, tabId);
        }
        else if (tabId === 'stocktake') {
            el.innerHTML = stocktakePageHtml;
            await initStocktakePage(currentUser);
        }
        
        tabInitialized[cacheKey] = true;
    } else {
        // 既にDOMが存在する場合、カテゴリー切り替えなどの初期化関数を再度呼ぶ
        if (tabId === 'buy_move' || tabId === 'make') {
            const defaultSubTab = tabId === 'buy_move' ? 'purchase' : 'store_prep';
            await initProcurementMobilePage(currentUser, defaultSubTab);
            if (window.filterProcurementCategories) {
                window.filterProcurementCategories(tabId);
            }
        } else if (procurementTabs.includes(tabId)) {
            if (isMobile) {
                await initProcurementMobilePage(currentUser, tabId);
            } else {
                await initProcurementPage(currentUser, tabId);
            }
        } else if (tabId === 'settings' && isMobile && window.showMasterSettings) {
            window.showMasterSettings();
        }
    }

    tabContainers[cacheKey].style.display = 'block';
}
