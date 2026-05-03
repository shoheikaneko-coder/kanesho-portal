import { inventoryPageHtml, initInventoryPage } from './inventory.js';
import { inventoryMobilePageHtml, initInventoryMobilePage } from './inventory_mobile.js';
import { procurementPageHtml, initProcurementPage } from './procurement.js';
import { procurementMobilePageHtml, initProcurementMobilePage } from './procurement_mobile.js';

export const opsHubMainPageHtml = `
    <div id="ops-hub-main-container" class="animate-fade-in" style="display: flex; flex-direction: column; height: calc(100vh - 80px); overflow: hidden;">
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
            
            <!-- Shortcut to Master -->
            <button id="btn-goto-recipe-master" style="margin-left: auto; display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.2rem; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; cursor: pointer; font-weight: 800; font-size: 0.85rem; transition: all 0.2s; white-space: nowrap;">
                <i class="fas fa-book"></i> 商品レシピマスタ <i class="fas fa-external-link-alt" style="font-size: 0.7rem; opacity: 0.7;"></i>
            </button>
        </div>

        <!-- Content Area -->
        <div id="ops-hub-content" style="flex: 1; overflow: hidden; position: relative;">
            <!-- Child pages will be injected here -->
        </div>

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
            #ops-hub-content > div { height: 100% !important; padding-top: 1rem !important; }
            /* 統合ハブ内では既存の垂直カテゴリー選択（procurement.js内）を隠す */
            #ops-hub-content #proc-category-config { display: none !important; }
        </style>
    </div>
`;

let currentTab = 'inventory';
let currentUser = null;

export async function initOpsHubMainPage(user) {
    currentUser = user;
    setupTabListeners();
    // デフォルトタブを表示
    switchTab('inventory');
}

function setupTabListeners() {
    const tabs = document.querySelectorAll('.ops-tab-btn');
    tabs.forEach(tab => {
        tab.onclick = () => {
            const tabId = tab.dataset.tab;
            if (tabId === currentTab) return;
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
}

async function switchTab(tabId) {
    currentTab = tabId;
    const content = document.getElementById('ops-hub-content');
    if (!content) return;

    // タブの活性状態を更新
    document.querySelectorAll('.ops-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // コンテンツの切り替え
    if (tabId === 'inventory') {
        if (window.innerWidth < 768) {
            content.innerHTML = inventoryMobilePageHtml;
            await initInventoryMobilePage(currentUser);
        } else {
            content.innerHTML = inventoryPageHtml;
            await initInventoryPage(currentUser);
        }
    } else {
        // 仕入れ・仕込み・移動はすべて procurement.js を使用
        if (window.innerWidth < 768) {
            content.innerHTML = procurementMobilePageHtml;
            await initProcurementMobilePage(currentUser, tabId);
        } else {
            content.innerHTML = procurementPageHtml;
            await initProcurementPage(currentUser, tabId);
        }
    }
}
