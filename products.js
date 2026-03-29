import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';
import { getEffectivePrice } from './cost_engine.js?v=9';

let currentTab = 'menus'; // 'menus', 'sub_recipes', or 'ingredients'
let currentView = 'list'; // 'list' or 'form'
let currentPage = 1;
const pageSize = 30;
let cachedItems = [];
let cachedIngredients = [];
let cachedMenus = [];
let cachedVendors = [];
let currentUser = null;
let editingItemData = null;
let currentSearchQuery = ''; // 検索条件の永続化用

export const productsPageHtml = `
    <div id="products-page-container" class="animate-fade-in">
        <!-- Content will be swapped here -->
    </div>
`;

function renderView() {
    const container = document.getElementById('products-page-container');
    if (!container) return;

    if (currentView === 'form') {
        renderFormView(container);
    } else {
        renderListView(container);
    }
}

function renderFormView(container) {
    const isEdit = !!editingItemData;
    if (currentTab === 'sub_recipes') {
        renderSubRecipeForm(container);
    } else {
        renderStandardForm(container, isEdit);
    }

    const btnBack = document.getElementById('btn-form-back');
    const btnCancel = document.getElementById('btn-form-cancel');
    if (btnBack) btnBack.onclick = () => { currentView = 'list'; renderView(); };
    if (btnCancel) btnCancel.onclick = () => { currentView = 'list'; renderView(); };

    const btnSubmitProxy = document.getElementById('btn-form-submit-proxy');
    if (btnSubmitProxy) {
        btnSubmitProxy.onclick = () => {
            const form = document.getElementById('item-form');
            if (form) form.requestSubmit();
        };
    }

    setupFormLogic();
}

function renderStandardForm(container, isEdit) {
    container.innerHTML = `
        <div class="animate-fade-in" style="background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas ${isEdit ? 'fa-edit' : 'fa-plus-circle'}" style="color: var(--primary);"></i>
                    ${isEdit ? 'アイテムの編集' : '新規アイテムの登録'}
                </h3>
                <button id="btn-form-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary);">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>
            
            <div class="form-wrapper form-with-fixed-bottom product-edit-container" style="padding: 1rem; max-width: 1200px; margin: 0 auto; width: 100%;">
                <form id="item-form" class="product-edit-split pro-compact-form">
                    
                    <!-- 左カラム: 基本情報・備考 -->
                    <div class="form-col-left" style="flex: 1; display: flex; flex-direction: column; gap: 1.5rem;">
                        <section style="flex: 1; display: flex; flex-direction: column; background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: var(--primary); font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; border-left: 4px solid var(--primary); padding-left: 0.8rem;">
                                基本スペック
                            </h4>
                            <div style="margin-bottom: 1rem;">
                                <div class="input-group compact-input" style="margin-bottom: 0.5rem;">
                                    <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">ふりがな（ひらがな）</label>
                                    <input type="text" id="item-furigana" placeholder="例: ばちまぐろ / とくようしょうゆ" 
                                           style="font-size: 0.95rem; padding: 0.5rem; background: #f8fafc;" value="${isEdit ? (editingItemData.furigana || '') : ''}">
                                </div>
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-weight: 800; color: #1e293b; font-size: 0.9rem;">品目名 / 食材名 <span style="color: var(--danger);">*</span></label>
                                    <input type="text" id="item-name" required placeholder="例: 鉢鮪 / 徳用醤油 1.8L" 
                                           style="font-size: 1.2rem; font-weight: 900; padding: 0.8rem; border: 2px solid var(--primary); border-radius: 8px;" value="${isEdit ? editingItemData.name : ''}">
                                </div>
                            </div>
    
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">カテゴリー</label>
                                    <input type="text" id="item-category" placeholder="例: 牛肉 / 調味料" 
                                           style="font-size: 0.95rem; padding: 0.6rem;" value="${isEdit ? (editingItemData.category || '') : ''}">
                                </div>
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">単位</label>
                                    <input type="text" id="item-unit" list="unit-suggestions" placeholder="例: g / 本 / 枚" 
                                           style="font-size: 0.95rem; padding: 0.6rem;" value="${isEdit ? (editingItemData.unit || '') : ''}">
                                    <datalist id="unit-suggestions">
                                        ${[...new Set(cachedItems.map(i => i.unit).filter(Boolean))].sort().map(u => `<option value="${u}">`).join('\n')}
                                    </datalist>
                                </div>
                            </div>

                            <div class="input-group compact-input" style="flex: 1; display: flex; flex-direction: column; margin-bottom: 0;">
                                <label style="font-weight: 700; color: #475569; font-size: 0.8rem; margin-bottom: 0.4rem;">備考 / 内部メモ</label>
                                <textarea id="item-notes" placeholder="仕入れ時の注意点、小分けのルール、レシピの提供手順など" style="flex: 1; height: 0; min-height: 120px; resize: none; width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">${isEdit ? (editingItemData.notes || '') : ''}</textarea>
                            </div>
                        </section>
                    </div>

                    <!-- 右カラム: 金額設定・ボタン -->
                    <div class="form-col-right" style="flex: 1; display: flex; flex-direction: column; gap: 1.5rem;">
                        <!-- 販売・原価セクション -->
                        <section id="section-menu" style="display: flex; flex-direction: column; background: #f1f5f9; padding: 1.2rem; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <h4 id="section-menu-title" style="margin-top: 0; margin-bottom: 1rem; color: #2563EB; font-size: 0.95rem; font-weight: 800;">
                                販売・レシピ設定
                            </h4>
                            <div id="menu-price-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">販売価格(税込)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="menu-sales-price" placeholder="例: 1200" style="padding:0.6rem; font-weight: 700; font-family: monospace;">
                                        <span class="input-addon" style="padding:0 0.8rem; font-size:0.8rem;">円</span>
                                    </div>
                                </div>
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">Dinii ID</label>
                                    <input type="text" id="menu-dinii-id" placeholder="連携コード" style="padding:0.6rem; font-family: monospace;">
                                </div>
                            </div>
                            <div id="section-recipe">
                                <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem; display: block;">レシピ構成 (食材の積み上げ)</label>
                                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.8rem;">
                                    <select id="recipe-add-select" style="flex: 1; padding: 0.4rem; border-radius: 8px; border: 1px solid var(--border); font-size:0.9rem;"></select>
                                    <button type="button" id="btn-recipe-add" class="btn" style="background: #2563EB; color: white; padding: 0.4rem 0.8rem;"><i class="fas fa-plus"></i></button>
                                </div>
                                <div id="recipe-items-container" style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 200px; overflow-y: auto;">
                                    <!-- Recipe rows dynamic -->
                                </div>
                                <div id="recipe-total-cost" style="margin-top: 0.8rem; text-align: right; font-weight: 800; color: var(--primary); font-size: 1rem;">
                                    原価: ¥0
                                </div>
                            </div>
                        </section>

                        <!-- 仕入・歩留セクション -->
                        <section id="section-ingredient" style="flex: 1; display: flex; flex-direction: column; background: #ecfdf5; padding: 1.2rem; border-radius: 12px; border: 1px solid #bbf7d0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h4 style="margin: 0; color: #059669; font-size: 0.95rem; font-weight: 800;">
                                    仕入・原価情報
                                </h4>
                            </div>
                            <div class="input-group compact-input" style="margin-bottom: 1rem;">
                                <label style="font-size: 0.8rem; font-weight: 700;">デフォルト仕入先</label>
                                <div style="display: flex; gap: 0.5rem; align-items: center; width: 100%;">
                                    <select id="ing-vendor-id" style="width: calc(100% - 52px); flex: none; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.9rem;"></select>
                                    <a href="index.html?page=suppliers" target="_blank" style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: #64748b; font-size: 1.4rem; text-decoration: none;" title="別タブで業者マスタを開く">
                                        <span class="fas fa-cog" style="position: static !important; display: block;"></span>
                                    </a>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">仕入単価(税込)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="ing-purchase-price" placeholder="例: 5000" style="padding:0.6rem; font-weight: 700; font-family: monospace;">
                                        <span class="input-addon" style="padding:0 0.8rem; font-size:0.8rem;">円</span>
                                    </div>
                                </div>
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">内容量 (入力単位)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="item-content-amount" placeholder="例: 1000" step="any" style="padding:0.6rem; font-weight: 700; font-family: monospace;" value="${isEdit ? (editingItemData.content_amount || 0) : 0}">
                                        <span class="input-addon" id="addon-content-amount" style="padding:0 0.8rem; font-size:0.8rem;"></span>
                                    </div>
                                </div>
                            </div>
                            
                             <!-- 歩留計算アシスタントと手動入力枠 -->
                            <div style="display: flex; gap: 1rem; align-items: flex-end; margin-top: 1rem; margin-bottom: 1.2rem;">
                                <div class="input-group compact-input" style="flex: 1; margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">歩留 (0.01〜1.0)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="ing-yield-rate" placeholder="例: 1.0" step="0.01" style="padding:0.6rem; font-weight: 700; font-family: monospace;">
                                        <span class="input-addon" style="padding:0 0.8rem; font-size:0.8rem;">倍</span>
                                    </div>
                                </div>
                                <div style="flex: 2; display: flex; flex-direction: column; gap: 0.2rem; background: rgba(255,255,255,0.7); padding: 0.4rem; border-radius: 8px; border: 1px dashed #10b981;">
                                    <label style="font-size: 0.7rem; font-weight: 700; color: #059669; margin-bottom: 0;">
                                        <i class="fas fa-calculator"></i> 歩留計算アシスタント
                                    </label>
                                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                                        <input type="number" id="calc-pre" placeholder="前" style="flex:1; width:70px; padding:0.3rem; font-size:0.8rem; font-family: monospace;" min="0">
                                        <span style="font-size: 0.7rem; font-weight: bold;">→</span>
                                        <input type="number" id="calc-post" placeholder="後" style="flex:1; width:70px; padding:0.3rem; font-size:0.8rem; font-family: monospace;" min="0">
                                        <button type="button" id="btn-calc-yield" class="btn" style="background: #10b981; color: white; padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px;">反映</button>
                                    </div>
                                </div>
                            </div>

                            <!-- 正味単価の自動計算表示 (ReadOnly) -->
                            <div class="input-group compact-input" style="margin-bottom: 0; background: #f0fdf4; padding: 1rem; border-radius: 8px; border: 1px solid #bbf7d0;">
                                <label style="font-size: 0.8rem; font-weight: 800; color: #166534; margin-bottom: 0.4rem; display: block;">正味単価（円/単位） <span style="font-weight: normal; font-size: 0.7rem; color: #15803d; margin-left: 0.4rem;">※自動計算</span></label>
                                <div style="display: flex; align-items: baseline; gap: 0.4rem;">
                                    <span style="font-size: 0.9rem; font-weight: 700; color: #166534;">¥</span>
                                    <input type="text" id="ing-net-unit-price" readonly value="0.00" 
                                           style="border: none; background: transparent; font-size: 1.6rem; font-weight: 900; color: #166534; font-family: monospace; padding: 0; width: 100%; outline: none;" tabIndex="-1">
                                </div>
                            </div>
                        </section>
                    </div>
                </form>

                <!-- ボタンエリア -->
                <div class="mobile-fixed-bottom desktop-actions" style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; width: 100%; padding: 0.5rem 0;">
                    ${renderFormActions(isEdit)}
                </div>
            </div>
        </div>
    `;
}

function renderSubRecipeForm(container) {
    const isEdit = !!editingItemData;
    const menuData = isEdit ? cachedMenus.find(m => m.item_id === editingItemData.id) : null;
    
    container.innerHTML = `
        <div class="animate-fade-in" style="background: white; border-radius: 12px; box-shadow: 0 4px 30px rgba(0,0,0,0.1); overflow: hidden;">
            <!-- Header -->
            <div style="padding: 1rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #1e293b; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-mortar-pestle" style="color: #059669;"></i>
                    自家製原材料マスタ - ${isEdit ? '高度編集' : '新規開発'}
                </h3>
                <button id="btn-form-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); padding: 0.5rem 1rem;">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>

            <form id="item-form" class="recipe-form-v39">
                <!-- Upper Section: Spec -->
                <div class="recipe-section recipe-header-grid">
                    <div class="input-group compact-input" style="margin-bottom:0;">
                        <label>ふりがな</label>
                        <input type="text" id="item-furigana" value="${isEdit ? (editingItemData.furigana || '') : ''}" placeholder="ひらがな">
                    </div>
                    <div class="input-group compact-input" style="margin-bottom:0;">
                        <label>品目名 / 仕込み名称 <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="item-name" required value="${isEdit ? editingItemData.name : ''}" style="font-weight:800; font-size:1.1rem; border-color:#059669;">
                    </div>
                    <div class="input-group compact-input" style="margin-bottom:0;">
                        <label>カテゴリー</label>
                        <input type="text" id="item-category" value="${isEdit ? (editingItemData.category || '') : ''}" placeholder="例: スープ / タレ">
                    </div>
                    <div class="input-group compact-input" style="margin-bottom:0;">
                        <label>管理単位 <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="item-unit" value="${isEdit ? (editingItemData.unit || '') : ''}" required placeholder="g / ml / 枚">
                    </div>
                </div>

                <!-- Middle Section: Cost Summary -->
                <div class="recipe-middle-summary">
                    <div class="summary-item">
                        <span class="summary-label">レシピ総原価</span>
                        <span class="summary-value" id="display-total-cost">¥ 0</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">今回の出来高</span>
                        <div class="summary-input-wrapper">
                            <input type="number" id="recipe-yield-amount" class="summary-input" value="${menuData?.yield_amount || 0}" step="any">
                            <span class="summary-unit-label" style="font-weight:700;">${isEdit ? (editingItemData.unit || '') : ''}</span>
                        </div>
                    </div>
                    <div class="summary-item" style="text-align: right;">
                        <span class="summary-label">算出 正味単価 (¥/単位)</span>
                        <span class="summary-value" id="display-net-unit-price" style="color: #4ade80;">¥ 0.00</span>
                    </div>
                </div>

                <!-- Lower Section: Main Content -->
                <div class="recipe-bottom-grid">
                    <!-- Left: Instructions -->
                    <div class="recipe-section recipe-instructions-area">
                        <h4 style="font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem;"><i class="fas fa-list-ol"></i> 作り方・工程</h4>
                        <textarea id="recipe-instructions" placeholder="1. 材料を計量する&#10;2. 鍋に入れて中火で加熱する...">${menuData?.instructions || ''}</textarea>
                    </div>

                    <!-- Right: Recipe Table -->
                    <div class="recipe-section recipe-table-area">
                        <h4 style="font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem;"><i class="fas fa-utensils"></i> レシピ構成</h4>
                        
                        <!-- Incremental Search -->
                        <div class="incremental-search-container">
                            <div class="input-with-addon-wrapper" style="margin-bottom: 1rem;">
                                <input type="text" id="recipe-search-input" placeholder="食材名で検索 (スペース区切りでAND検索)..." style="border-radius: 8px 0 0 8px;">
                                <span class="input-addon" style="background:#059669; color:white; border-color:#059669;">
                                    <i class="fas fa-search"></i>
                                </span>
                            </div>
                            <div id="search-results-list" class="incremental-search-results"></div>
                        </div>

                        <div id="recipe-items-container" style="flex:1; overflow-y:auto; border-top:1px solid #f1f5f9; padding-top:1rem;">
                            <!-- Recipe rows -->
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="mobile-fixed-bottom desktop-actions" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0;">
                    ${renderFormActions(isEdit)}
                </div>
            </form>
        </div>
    `;
    
    // 同期・非同期のイベント紐付け
    setupIncrementalSearch();
}

function renderFormActions(isEdit) {
    return `
        ${isEdit ? `
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
            <span style="font-size: 0.7rem; color: #94a3b8;">
                最終更新: ${editingItemData.updated_at ? new Date(editingItemData.updated_at).toLocaleDateString() : '-'}
            </span>
            <button type="button" id="btn-form-delete" class="btn" style="height: 40px; background: white; color: #ef4444; border: 1px solid #fee2e2; font-size: 0.85rem;">
                <i class="fas fa-trash-alt"></i> 削除
            </button>
        </div>` : `<div></div>`}
        
        <div style="display: flex; gap: 0.8rem;">
            <button type="button" id="btn-form-cancel" class="btn" style="height: 44px; min-width: 100px; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; font-size: 0.9rem;">
                キャンセル
            </button>
            <button type="button" id="btn-form-submit-proxy" class="btn btn-primary" style="height: 44px; min-width: 160px; background: linear-gradient(135deg, #059669, #10b981);">
                <i class="fas fa-save"></i> 情報を保存
            </button>
        </div>
    `;
}

function renderStandardForm(container, isEdit) {
    container.innerHTML = `
        <div class="animate-fade-in" style="background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas ${isEdit ? 'fa-edit' : 'fa-plus-circle'}" style="color: var(--primary);"></i>
                    ${isEdit ? 'アイテムの編集' : '新規アイテムの登録'}
                </h3>
                <button id="btn-form-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary);">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>
            
            <div class="form-wrapper form-with-fixed-bottom product-edit-container" style="padding: 1rem; max-width: 1200px; margin: 0 auto; width: 100%;">
                <form id="item-form" class="product-edit-split pro-compact-form">
                    
                    <!-- 左カラム: 基本情報・備考 -->
                    <div class="form-col-left" style="flex: 1; display: flex; flex-direction: column; gap: 1.5rem;">
                        <section style="flex: 1; display: flex; flex-direction: column; background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: var(--primary); font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; border-left: 4px solid var(--primary); padding-left: 0.8rem;">
                                基本スペック
                            </h4>
                            <div style="margin-bottom: 1rem;">
                                <div class="input-group compact-input" style="margin-bottom: 0.5rem;">
                                    <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">ふりがな（ひらがな）</label>
                                    <input type="text" id="item-furigana" placeholder="例: ばちまぐろ / とくようしょうゆ" 
                                           style="font-size: 0.95rem; padding: 0.5rem; background: #f8fafc;" value="${isEdit ? (editingItemData.furigana || '') : ''}">
                                </div>
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-weight: 800; color: #1e293b; font-size: 0.9rem;">品目名 / 食材名 <span style="color: var(--danger);">*</span></label>
                                    <input type="text" id="item-name" required placeholder="例: 鉢鮪 / 徳用醤油 1.8L" 
                                           style="font-size: 1.2rem; font-weight: 900; padding: 0.8rem; border: 2px solid var(--primary); border-radius: 8px;" value="${isEdit ? editingItemData.name : ''}">
                                </div>
                            </div>
    
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">カテゴリー</label>
                                    <input type="text" id="item-category" placeholder="例: 牛肉 / 調味料" 
                                           style="font-size: 0.95rem; padding: 0.6rem;" value="${isEdit ? (editingItemData.category || '') : ''}">
                                </div>
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">単位</label>
                                    <input type="text" id="item-unit" list="unit-suggestions" placeholder="例: g / 本 / 枚" 
                                           style="font-size: 0.95rem; padding: 0.6rem;" value="${isEdit ? (editingItemData.unit || '') : ''}">
                                    <datalist id="unit-suggestions">
                                        ${[...new Set(cachedItems.map(i => i.unit).filter(Boolean))].sort().map(u => `<option value="${u}">`).join('\n')}
                                    </datalist>
                                </div>
                            </div>

                            <div class="input-group compact-input" style="flex: 1; display: flex; flex-direction: column; margin-bottom: 0;">
                                <label style="font-weight: 700; color: #475569; font-size: 0.8rem; margin-bottom: 0.4rem;">備考 / 内部メモ</label>
                                <textarea id="item-notes" placeholder="仕入れ時の注意点、小分けのルール、レシピの提供手順など" style="flex: 1; height: 0; min-height: 120px; resize: none; width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">${isEdit ? (editingItemData.notes || '') : ''}</textarea>
                            </div>
                        </section>
                    </div>

                    <!-- 右カラム: 金額設定・ボタン -->
                    <div class="form-col-right" style="flex: 1; display: flex; flex-direction: column; gap: 1.5rem;">
                        <!-- 販売・原価セクション -->
                        <section id="section-menu" style="display: flex; flex-direction: column; background: #f1f5f9; padding: 1.2rem; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <h4 id="section-menu-title" style="margin-top: 0; margin-bottom: 1rem; color: #2563EB; font-size: 0.95rem; font-weight: 800;">
                                販売・レシピ設定
                            </h4>
                            <div id="menu-price-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">販売価格(税込)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="menu-sales-price" placeholder="例: 1200" style="padding:0.6rem; font-weight: 700; font-family: monospace;">
                                        <span class="input-addon" style="padding:0 0.8rem; font-size:0.8rem;">円</span>
                                    </div>
                                </div>
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">Dinii ID</label>
                                    <input type="text" id="menu-dinii-id" placeholder="連携コード" style="padding:0.6rem; font-family: monospace;">
                                </div>
                            </div>
                            <div id="section-recipe">
                                <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem; display: block;">レシピ構成 (食材の積み上げ)</label>
                                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.8rem;">
                                    <select id="recipe-add-select" style="flex: 1; padding: 0.4rem; border-radius: 8px; border: 1px solid var(--border); font-size:0.9rem;"></select>
                                    <button type="button" id="btn-recipe-add" class="btn" style="background: #2563EB; color: white; padding: 0.4rem 0.8rem;"><i class="fas fa-plus"></i></button>
                                </div>
                                <div id="recipe-items-container" style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 200px; overflow-y: auto;">
                                    <!-- Recipe rows dynamic -->
                                </div>
                                <div id="recipe-total-cost" style="margin-top: 0.8rem; text-align: right; font-weight: 800; color: var(--primary); font-size: 1rem;">
                                    原価: ¥0
                                </div>
                            </div>
                        </section>

                        <!-- 仕入・歩留セクション -->
                        <section id="section-ingredient" style="flex: 1; display: flex; flex-direction: column; background: #ecfdf5; padding: 1.2rem; border-radius: 12px; border: 1px solid #bbf7d0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h4 style="margin: 0; color: #059669; font-size: 0.95rem; font-weight: 800;">
                                    仕入・原価情報
                                </h4>
                            </div>
                            <div class="input-group compact-input" style="margin-bottom: 1rem;">
                                <label style="font-size: 0.8rem; font-weight: 700;">デフォルト仕入先</label>
                                <div style="display: flex; gap: 0.5rem; align-items: center; width: 100%;">
                                    <select id="ing-vendor-id" style="width: calc(100% - 52px); flex: none; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.9rem;"></select>
                                    <a href="index.html?page=suppliers" target="_blank" style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: #64748b; font-size: 1.4rem; text-decoration: none;" title="別タブで業者マスタを開く">
                                        <span class="fas fa-cog" style="position: static !important; display: block;"></span>
                                    </a>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">仕入単価(税込)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="ing-purchase-price" placeholder="例: 5000" style="padding:0.6rem; font-weight: 700; font-family: monospace;">
                                        <span class="input-addon" style="padding:0 0.8rem; font-size:0.8rem;">円</span>
                                    </div>
                                </div>
                                <div class="input-group compact-input" style="margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">内容量 (入力単位)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="item-content-amount" placeholder="例: 1000" step="any" style="padding:0.6rem; font-weight: 700; font-family: monospace;" value="${isEdit ? (editingItemData.content_amount || 0) : 0}">
                                        <span class="input-addon" id="addon-content-amount" style="padding:0 0.8rem; font-size:0.8rem;"></span>
                                    </div>
                                </div>
                            </div>
                            
                             <!-- 歩留計算アシスタントと手動入力枠 -->
                            <div style="display: flex; gap: 1rem; align-items: flex-end; margin-top: 1rem; margin-bottom: 1.2rem;">
                                <div class="input-group compact-input" style="flex: 1; margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; font-weight: 700;">歩留 (0.01〜1.0)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="ing-yield-rate" placeholder="例: 1.0" step="0.01" style="padding:0.6rem; font-weight: 700; font-family: monospace;">
                                        <span class="input-addon" style="padding:0 0.8rem; font-size:0.8rem;">倍</span>
                                    </div>
                                </div>
                                <div style="flex: 2; display: flex; flex-direction: column; gap: 0.2rem; background: rgba(255,255,255,0.7); padding: 0.4rem; border-radius: 8px; border: 1px dashed #10b981;">
                                    <label style="font-size: 0.7rem; font-weight: 700; color: #059669; margin-bottom: 0;">
                                        <i class="fas fa-calculator"></i> 歩留計算アシスタント
                                    </label>
                                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                                        <input type="number" id="calc-pre" placeholder="前" style="flex:1; width:70px; padding:0.3rem; font-size:0.8rem; font-family: monospace;" min="0">
                                        <span style="font-size: 0.7rem; font-weight: bold;">→</span>
                                        <input type="number" id="calc-post" placeholder="後" style="flex:1; width:70px; padding:0.3rem; font-size:0.8rem; font-family: monospace;" min="0">
                                        <button type="button" id="btn-calc-yield" class="btn" style="background: #10b981; color: white; padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px;">反映</button>
                                    </div>
                                </div>
                            </div>

                            <!-- 正味単価の自動計算表示 (ReadOnly) -->
                            <div class="input-group compact-input" style="margin-bottom: 0; background: #f0fdf4; padding: 1rem; border-radius: 8px; border: 1px solid #bbf7d0;">
                                <label style="font-size: 0.8rem; font-weight: 800; color: #166534; margin-bottom: 0.4rem; display: block;">正味単価（円/単位） <span style="font-weight: normal; font-size: 0.7rem; color: #15803d; margin-left: 0.4rem;">※自動計算</span></label>
                                <div style="display: flex; align-items: baseline; gap: 0.4rem;">
                                    <span style="font-size: 0.9rem; font-weight: 700; color: #166534;">¥</span>
                                    <input type="text" id="ing-net-unit-price" readonly value="0.00" 
                                           style="border: none; background: transparent; font-size: 1.6rem; font-weight: 900; color: #166534; font-family: monospace; padding: 0; width: 100%; outline: none;" tabIndex="-1">
                                </div>
                            </div>
                        </section>
                    </div>
                </form>

                <!-- ボタンエリア -->
                <div class="mobile-fixed-bottom desktop-actions" style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; width: 100%; padding: 0.5rem 0;">
                    ${renderFormActions(isEdit)}
                </div>
            </div>
        </div>
    `;
}

function renderSubRecipeForm(container) {
    const isEdit = !!editingItemData;
    const menuData = isEdit ? cachedMenus.find(m => m.item_id === editingItemData.id) : null;
    
    container.innerHTML = `
        <div class="animate-fade-in" style="background: white; border-radius: 12px; box-shadow: 0 4px 30px rgba(0,0,0,0.1); overflow: hidden;">
            <!-- Header -->
            <div style="padding: 1rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #1e293b; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-mortar-pestle" style="color: #059669;"></i>
                    自家製原材料マスタ - ${isEdit ? '高度編集' : '新規開発'}
                </h3>
                <button id="btn-form-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); padding: 0.5rem 1rem;">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>

            <form id="item-form" class="recipe-form-v39">
                <!-- Upper Section: Spec -->
                <div class="recipe-section recipe-header-grid">
                    <div class="input-group compact-input" style="margin-bottom:0;">
                        <label>ふりがな</label>
                        <input type="text" id="item-furigana" value="${isEdit ? (editingItemData.furigana || '') : ''}" placeholder="ひらがな">
                    </div>
                    <div class="input-group compact-input" style="margin-bottom:0;">
                        <label>品目名 / 仕込み名称 <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="item-name" required value="${isEdit ? editingItemData.name : ''}" style="font-weight:800; font-size:1.1rem; border-color:#059669;">
                    </div>
                    <div class="input-group compact-input" style="margin-bottom:0;">
                        <label>カテゴリー</label>
                        <input type="text" id="item-category" value="${isEdit ? (editingItemData.category || '') : ''}" placeholder="例: スープ / タレ">
                    </div>
                    <div class="input-group compact-input" style="margin-bottom:0;">
                        <label>管理単位 <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="item-unit" value="${isEdit ? (editingItemData.unit || '') : ''}" required placeholder="g / ml / 枚">
                    </div>
                </div>

                <!-- Middle Section: Cost Summary -->
                <div class="recipe-middle-summary">
                    <div class="summary-item">
                        <span class="summary-label">レシピ総原価</span>
                        <span class="summary-value" id="display-total-cost">¥ 0</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">今回の出来高</span>
                        <div class="summary-input-wrapper">
                            <input type="number" id="recipe-yield-amount" class="summary-input" value="${menuData?.yield_amount || 0}" step="any">
                            <span class="summary-unit-label" style="font-weight:700;">${isEdit ? (editingItemData.unit || '') : ''}</span>
                        </div>
                    </div>
                    <div class="summary-item" style="text-align: right;">
                        <span class="summary-label">算出 正味単価 (¥/単位)</span>
                        <span class="summary-value" id="display-net-unit-price" style="color: #4ade80;">¥ 0.00</span>
                    </div>
                </div>

                <!-- Lower Section: Main Content -->
                <div class="recipe-bottom-grid">
                    <!-- Left: Instructions -->
                    <div class="recipe-section recipe-instructions-area">
                        <h4 style="font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem;"><i class="fas fa-list-ol"></i> 作り方・工程</h4>
                        <textarea id="recipe-instructions" placeholder="1. 材料を計量する&#10;2. 鍋に入れて中火で加熱する...">${menuData?.instructions || ''}</textarea>
                    </div>

                    <!-- Right: Recipe Table -->
                    <div class="recipe-section recipe-table-area">
                        <h4 style="font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem;"><i class="fas fa-utensils"></i> レシピ構成</h4>
                        
                        <!-- Incremental Search -->
                        <div class="incremental-search-container">
                            <div class="input-with-addon-wrapper" style="margin-bottom: 1rem;">
                                <input type="text" id="recipe-search-input" placeholder="食材名で検索 (スペース区切りでAND検索)..." style="border-radius: 8px 0 0 8px;">
                                <span class="input-addon" style="background:#059669; color:white; border-color:#059669;">
                                    <i class="fas fa-search"></i>
                                </span>
                            </div>
                            <div id="search-results-list" class="incremental-search-results"></div>
                        </div>

                        <div id="recipe-items-container" style="flex:1; overflow-y:auto; border-top:1px solid #f1f5f9; padding-top:1rem;">
                            <!-- Recipe rows -->
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="mobile-fixed-bottom desktop-actions" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0;">
                    ${renderFormActions(isEdit)}
                </div>
            </form>
        </div>
    `;
}

function renderFormActions(isEdit) {
    return `
        ${isEdit ? `
        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
            <span style="font-size: 0.7rem; color: #94a3b8;">
                最終更新: ${editingItemData.updated_at ? new Date(editingItemData.updated_at).toLocaleDateString() : '-'}
            </span>
            <button type="button" id="btn-form-delete" class="btn" style="height: 40px; background: white; color: #ef4444; border: 1px solid #fee2e2; font-size: 0.85rem;">
                <i class="fas fa-trash-alt"></i> 削除
            </button>
        </div>` : `<div></div>`}
        
        <div style="display: flex; gap: 0.8rem;">
            <button type="button" id="btn-form-cancel" class="btn" style="height: 44px; min-width: 100px; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; font-size: 0.9rem;">
                キャンセル
            </button>
            <button type="button" id="btn-form-submit-proxy" class="btn btn-primary" style="height: 44px; min-width: 160px; background: linear-gradient(135deg, #059669, #10b981);">
                <i class="fas fa-save"></i> 情報を保存
            </button>
        </div>
    `;
}

function setupIncrementalSearch() {
    const input = document.getElementById('recipe-search-input');
    const resultsList = document.getElementById('search-results-list');
    if (!input || !resultsList) return;

    let selectedIndex = -1;
    let filteredItems = [];

    const renderResults = () => {
        const query = input.value.trim().toLowerCase();
        if (!query) {
            resultsList.style.display = 'none';
            return;
        }

        const keywords = query.split(/\s+/);
        filteredItems = cachedItems.filter(item => {
            const name = (item.name || "").toLowerCase();
            const cat = (item.category || "").toLowerCase();
            const ing = cachedIngredients.find(i => i.item_id === item.id);
            const vendor = cachedVendors.find(v => (v.vendor_id || v.id) === ing?.vendor_id);
            const vendorName = (vendor?.vendor_name || "").toLowerCase();
            
            return keywords.every(kw => name.includes(kw) || cat.includes(kw) || vendorName.includes(kw));
        }).slice(0, 15);

        if (filteredItems.length === 0) {
            resultsList.innerHTML = '<div style="padding:1rem; color:#94a3b8; font-size:0.85rem;">該当なし</div>';
        } else {
            resultsList.innerHTML = filteredItems.map((item, idx) => {
                const ing = cachedIngredients.find(i => i.item_id === item.id);
                const price = getEffectivePrice(item.id, { items: cachedItems, ingredients: cachedIngredients, menus: cachedMenus });
                const vendor = cachedVendors.find(v => (v.vendor_id || v.id) === ing?.vendor_id);
                return `
                    <div class="search-result-item ${idx === selectedIndex ? 'selected' : ''}" data-id="${item.id}" data-index="${idx}">
                        <div>
                            <div class="search-result-name">${item.name}</div>
                            <div class="search-result-meta">${vendor?.vendor_name || '業者不明'} | 単価参考: ¥${price.toFixed(2)}/${item.unit || ''}</div>
                        </div>
                        <div class="search-result-price">¥${price.toFixed(2)}</div>
                    </div>
                `;
            }).join('');
        }
        resultsList.style.display = 'block';
        selectedIndex = -1;
    };

    input.addEventListener('input', renderResults);
    input.addEventListener('focus', renderResults);

    input.addEventListener('keydown', (e) => {
        const items = resultsList.querySelectorAll('.search-result-item');
        if (e.key === 'ArrowDown') {
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection(items);
            e.preventDefault();
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0) {
                addIngredientToRecipe(filteredItems[selectedIndex].id);
                input.value = '';
                resultsList.style.display = 'none';
            }
            e.preventDefault();
        }
    });

    const updateSelection = (items) => {
        items.forEach((it, idx) => {
            it.classList.toggle('selected', idx === selectedIndex);
            if (idx === selectedIndex) it.scrollIntoView({ block: 'nearest' });
        });
    };

    resultsList.addEventListener('click', (e) => {
        const item = e.target.closest('.search-result-item');
        if (item) {
            addIngredientToRecipe(item.dataset.id);
            input.value = '';
            resultsList.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !resultsList.contains(e.target)) {
            resultsList.style.display = 'none';
        }
    });
}

function addIngredientToRecipe(itemId) {
    if (currentRecipe.some(r => r.ingredient_id === itemId)) {
        showAlert('警告', '既にレシピに含まれています');
        return;
    }
    currentRecipe.push({ ingredient_id: itemId, quantity: 0 });
    renderRecipeRows();
    
    // Focus the quantity input of the newly added row
    setTimeout(() => {
        const rows = document.querySelectorAll('#recipe-items-container .recipe-row-input');
        if (rows.length > 0) rows[rows.length - 1].focus();
    }, 50);
}

function setupFormLogic() {
    setupRecipeEditor();
    const isSubRecipe = currentTab === 'sub_recipes';
    const form = document.getElementById('item-form');
    if (!form) return;

    if (isSubRecipe) {
        setupIncrementalSearch();
        const yieldInput = document.getElementById('recipe-yield-amount');
        if (yieldInput) yieldInput.addEventListener('input', calculateRecipeCost);
        
        const unitInput = document.getElementById('item-unit');
        if (unitInput) {
            unitInput.addEventListener('input', () => {
                const labels = document.querySelectorAll('.summary-unit-label');
                labels.forEach(l => l.textContent = unitInput.value);
            });
        }
    }

    // Set initial values if editing
    if (editingItemData) {
        const item = editingItemData;
        const menuRecord = cachedMenus.find(m => m.item_id === item.id);
        currentRecipe = menuRecord?.recipe || [];
        renderRecipeRows();

        if (currentTab === 'menus' || currentTab === 'sub_recipes' || (menuRecord && menuRecord.is_sub_recipe !== true)) {
            if (document.getElementById('menu-sales-price')) {
                document.getElementById('menu-sales-price').value = menuRecord?.sales_price || 0;
            }
            if (document.getElementById('menu-dinii-id')) {
                document.getElementById('menu-dinii-id').value = menuRecord?.dinii_id || '';
            }
            if (isSubRecipe) {
                if (document.getElementById('recipe-yield-amount')) {
                    document.getElementById('recipe-yield-amount').value = menuRecord?.yield_amount || 0;
                }
                if (document.getElementById('recipe-instructions')) {
                    document.getElementById('recipe-instructions').value = menuRecord?.instructions || '';
                }
            }
        } 
        
        if (currentTab === 'ingredients') {
            const ing = cachedIngredients.find(i => i.item_id === item.id);
            const purchasePriceEl = document.getElementById('ing-purchase-price');
            if (purchasePriceEl) purchasePriceEl.value = ing?.purchase_price || 0;
            const yieldRateEl = document.getElementById('ing-yield-rate');
            if (yieldRateEl) yieldRateEl.value = ing?.yield_rate || 1.0;
            
            const vendorSelect = document.getElementById('ing-vendor-id');
            if (vendorSelect) {
                vendorSelect.innerHTML = '<option value="">業者を選択...</option>';
                cachedVendors.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.vendor_id || v.id;
                    opt.textContent = v.vendor_name;
                    if (ing?.vendor_id === opt.value) opt.selected = true;
                    vendorSelect.appendChild(opt);
                });
            }
        }
    } else {
        currentRecipe = [];
        renderRecipeRows();
        if (currentTab === 'ingredients') {
            const vendorSelect = document.getElementById('ing-vendor-id');
            if (vendorSelect) {
                vendorSelect.innerHTML = '<option value="">業者を選択...</option>';
                cachedVendors.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.vendor_id || v.id;
                    opt.textContent = v.vendor_name;
                    vendorSelect.appendChild(opt);
                });
            }
        }
    }

    // Event Listeners (Common or Shared)
    const btnDelete = document.getElementById('btn-form-delete');
    if (btnDelete && editingItemData) {
        btnDelete.onclick = (e) => {
            e.preventDefault();
            const item = editingItemData;
            const isAdmin = currentUser?.Role === 'Admin' || currentUser?.Role === '管理者';

            if (isAdmin) {
                showConfirm('アイテムの削除', `「${item.name}」を完全に削除しますか？\n(関連するすべてのデータが削除されます)`, async () => {
                    try {
                        await Promise.all([
                            deleteDoc(doc(db, "m_items", item.id)),
                            deleteDoc(doc(db, "m_ingredients", item.id)),
                            deleteDoc(doc(db, "m_menus", item.id))
                        ]);
                        await reloadData();
                        currentView = 'list';
                        renderView();
                        showAlert('成功', '削除しました。');
                    } catch(err) {
                        showAlert('エラー', '削除に失敗しました。');
                    }
                });
            } else {
                showConfirm('削除申請', `「${item.name}」の削除を管理者に申請しますか？`, async () => {
                    try {
                        await addDoc(collection(db, "notifications"), {
                            type: 'deletion_request', page: 'products',
                            target_id: item.id, target_name: item.name,
                            requester_id: currentUser?.id, requester_name: currentUser?.Name,
                            status: 'pending', created_at: new Date().toISOString()
                        });
                        showAlert('申請完了', '削除申請を送信しました。');
                    } catch(err) {
                        showAlert('エラー', '申請に失敗しました。');
                    }
                });
            }
        };
    }

    // Standard Form Unit/Cost Listeners
    if (!isSubRecipe) {
        const unitInputStd = document.getElementById('item-unit');
        if (unitInputStd) {
            unitInputStd.addEventListener('input', () => {
                const addonC = document.getElementById('addon-content-amount');
                if (addonC) addonC.textContent = unitInputStd.value.trim();
            });
        }
        
        const updateNetPrice = () => {
            const buy = parseFloat(document.getElementById('ing-purchase-price')?.value) || 0;
            const amount = parseFloat(document.getElementById('item-content-amount')?.value) || 0;
            const rate = parseFloat(document.getElementById('ing-yield-rate')?.value) || 0;
            const netInput = document.getElementById('ing-net-unit-price');
            if (netInput) netInput.value = (amount > 0 && rate > 0) ? (buy / (amount * rate)).toFixed(2) : "0.00";
        };
        ['ing-purchase-price', 'item-content-amount', 'ing-yield-rate'].forEach(idx => {
            document.getElementById(idx)?.addEventListener('input', updateNetPrice);
        });
        setTimeout(updateNetPrice, 100);
    }

    // Yield assistant
    const btnCalcYield = document.getElementById('btn-calc-yield');
    if (btnCalcYield) {
        btnCalcYield.onclick = () => {
            const pre = parseFloat(document.getElementById('calc-pre').value);
            const post = parseFloat(document.getElementById('calc-post').value);
            if (pre > 0 && post >= 0) {
                const yieldInput = document.getElementById('ing-yield-rate');
                if (yieldInput) {
                    yieldInput.value = (Math.round((post / pre) * 100) / 100);
                    const e = new Event('input');
                    yieldInput.dispatchEvent(e); // Trigger auto calc if standard form
                }
            }
        };
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btn-form-submit-proxy');
        if (btnSubmit) { btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...'; btnSubmit.disabled = true; }

        const itemId = editingItemData ? editingItemData.id : `item_${Date.now()}`;
        const baseItem = {
            furigana: document.getElementById('item-furigana').value || "",
            name: document.getElementById('item-name').value,
            category: document.getElementById('item-category').value,
            unit: document.getElementById('item-unit').value,
            content_amount: Number(document.getElementById('item-content-amount')?.value || 0),
            notes: document.getElementById('item-notes').value || "",
            created_at: editingItemData?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, "m_items", itemId), baseItem, { merge: true });

            if (currentTab === 'menus') {
                await setDoc(doc(db, "m_menus", itemId), {
                    item_id: itemId, sales_price: Number(document.getElementById('menu-sales-price').value) || 0,
                    dinii_id: document.getElementById('menu-dinii-id').value || "", recipe: currentRecipe,
                    is_sub_recipe: false, updated_at: new Date().toISOString()
                }, { merge: true });
            } else if (currentTab === 'sub_recipes') {
                const yieldAmt = Number(document.getElementById('recipe-yield-amount').value) || 0;
                const recipeInst = document.getElementById('recipe-instructions').value || "";
                
                const cache = { items: cachedItems, ingredients: cachedIngredients, menus: cachedMenus };
                let totalC = 0;
                currentRecipe.forEach(r => totalC += getEffectivePrice(r.ingredient_id, cache) * (r.quantity || 0));
                
                const netPrice = yieldAmt > 0 ? (totalC / yieldAmt) : 0;
                await setDoc(doc(db, "m_menus", itemId), {
                    item_id: itemId, sales_price: 0, recipe: currentRecipe,
                    yield_amount: yieldAmt, instructions: recipeInst,
                    is_sub_recipe: true, updated_at: new Date().toISOString()
                }, { merge: true });

                await setDoc(doc(db, "m_ingredients", itemId), {
                    item_id: itemId, purchase_price: 0, yield_rate: 1.0,
                    net_unit_price: netPrice, vendor_id: "INTERNAL", updated_at: new Date().toISOString()
                }, { merge: true });
            } else {
                const buy = Number(document.getElementById('ing-purchase-price').value) || 0;
                const amt = Number(document.getElementById('item-content-amount').value) || 0;
                const r = Number(document.getElementById('ing-yield-rate').value) || 1.0;
                const net = (amt > 0 && r > 0) ? (buy / (amt * r)) : 0;
                await setDoc(doc(db, "m_ingredients", itemId), {
                    item_id: itemId, purchase_price: buy, yield_rate: r, net_unit_price: net,
                    vendor_id: document.getElementById('ing-vendor-id').value || "", updated_at: new Date().toISOString()
                }, { merge: true });
            }

            currentView = 'list';
            await reloadData();
            renderView();
            showAlert('成功', '保存しました。');
        } catch (err) {
            console.error(err);
            showAlert('エラー', err.message);
        } finally {
            if (btnSubmit) { btnSubmit.innerHTML = '<i class="fas fa-save"></i> 情報を保存'; btnSubmit.disabled = false; }
        }
    };
}

function renderListView(container) {
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
                <h2 style="margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-boxes" style="color: var(--primary);"></i>
                    マスタ管理
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">販売メニュー、自家製食材、仕入品を一括管理します</p>
            </div>
            <div style="display: flex; gap: 0.8rem;">
                <button class="btn btn-primary" id="btn-add-item" style="padding: 0.8rem 1.5rem; font-weight: 700;">
                    <i class="fas fa-plus"></i> 新規登録
                </button>
            </div>
        </div>

        <div class="tabs-container" style="margin-bottom: 2rem;">
            <div class="tab-item ${currentTab === 'menus' ? 'active' : ''}" data-tab="menus">
                <i class="fas fa-utensils"></i> 販売メニュー
            </div>
            <div class="tab-item ${currentTab === 'sub_recipes' ? 'active' : ''}" data-tab="sub_recipes">
                <i class="fas fa-mortar-pestle"></i> 自家製原材料
            </div>
            <div class="tab-item ${currentTab === 'ingredients' ? 'active' : ''}" data-tab="ingredients">
                <i class="fas fa-leaf"></i> 食材・仕入品
            </div>
        </div>
        
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div class="input-group" style="margin-bottom: 0; width: 320px; max-width: 100%;">
                    <i class="fas fa-search" style="top: 0.8rem;"></i>
                    <input type="text" id="master-search" placeholder="名称やカテゴリで検索..." style="padding-top: 0.6rem; padding-bottom: 0.6rem;" value="${currentSearchQuery}">
                </div>
                <div id="master-count" style="color: var(--text-secondary); font-size: 0.9rem; font-weight: 500;">
                    表示中: ...
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; min-width: 800px; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr id="table-header-row" style="border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">
                            <!-- Dynamic Headers -->
                        </tr>
                    </thead>
                    <tbody id="master-table-body">
                    </tbody>
                </table>
            </div>
            
            <div id="master-pagination" style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border);">
            </div>
        </div>
    `;

    // Re-attach listeners for list view
    setupListViewListeners();
    renderTable(currentSearchQuery);
}

function setupListViewListeners() {
    const container = document.getElementById('products-page-container');
    if (!container) return;

    const tabs = container.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.onclick = () => {
            currentTab = tab.dataset.tab;
            currentPage = 1;
            renderView();
        };
    });

    const btnAdd = container.querySelector('#btn-add-item');
    if (btnAdd) {
        btnAdd.onclick = () => {
            editingItemData = null;
            currentView = 'form';
            renderView();
        };
    }

    const searchInput = container.querySelector('#master-search');
    if (searchInput) {
        searchInput.oninput = () => {
            currentSearchQuery = searchInput.value;
            currentPage = 1;
            renderTable(currentSearchQuery);
        };
    }
}

export async function initProductsPage(user) {
    currentUser = user;
    const container = document.getElementById('products-page-container');
    
    // 1. ローディング表示
    if (container) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem; color: var(--primary);"></i>
                <p>商品データを読み込んでいます...</p>
            </div>
        `;
    }
    
    try {
        // 2. データの取得
        await reloadData();
        
        // 3. 描画
        currentView = 'list';
        currentPage = 1; // 必ずデータ取得後に初期化
        renderView(); 
    } catch (error) {
        console.error("Failed to load product data:", error);
        if (container) {
            container.innerHTML = `
                <div style="padding: 3rem; color: var(--danger); text-align: center; max-width: 600px; margin: 0 auto; background: #fef2f2; border-radius: 12px; margin-top: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3 style="margin-top: 0;">データの読み込みに失敗しました</h3>
                    <p style="font-weight: 600; font-size: 1.1rem;">Firebase APIまたはネットワークでエラーが発生しています。</p>
                    <p style="font-family: monospace; font-size: 0.9rem; background: rgba(0,0,0,0.05); padding: 1rem; border-radius: 8px; text-align: left; overflow-x: auto;">
                        ${error.message || error.toString()}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 1.5rem;">※ 詳細なログはブラウザのコンソール(F12)をご確認ください。</p>
                </div>
            `;
        }
    }
}


async function reloadData() {
    const [itemsSnap, ingsSnap, menusSnap, vendorsSnap] = await Promise.all([
        getDocs(collection(db, "m_items")),
        getDocs(collection(db, "m_ingredients")),
        getDocs(collection(db, "m_menus")),
        getDocs(collection(db, "m_suppliers"))
    ]);

    cachedItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedIngredients = ingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedMenus = menusSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedVendors = vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function toHiragana(str) {
    if (!str) return '';
    return str.replace(/[\u30a1-\u30f6]/g, function(match) {
        var chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
}

function renderTable(filter = "") {
    const tbody = document.getElementById('master-table-body');
    const headerRow = document.getElementById('table-header-row');
    const countLabel = document.getElementById('master-count');
    if (!tbody || !headerRow) return;

    headerRow.innerHTML = '';
    if (currentTab === 'menus' || currentTab === 'sub_recipes') {
        headerRow.innerHTML = `
            <th style="padding: 1rem; font-weight: 600; width: 30%;">品目名</th>
            <th style="padding: 1rem; font-weight: 600;">${currentTab === 'menus' ? '販売単価' : '用途'}</th>
            <th style="padding: 1rem; font-weight: 600;">計算原価</th>
            <th style="padding: 1rem; font-weight: 600;">${currentTab === 'menus' ? '粗利(率)' : '備考'}</th>
            <th style="padding: 1rem; font-weight: 600;">${currentTab === 'menus' ? 'Dinii ID' : ''}</th>
            <th style="padding: 1rem; text-align: right; font-weight: 600;">アクション</th>
        `;
    } else {
        headerRow.innerHTML = `
            <th style="padding: 1rem; font-weight: 600; width: 25%;">食材名</th>
            <th style="padding: 1rem; font-weight: 600;">仕入業者</th>
            <th style="padding: 1rem; font-weight: 600;">内容量</th>
            <th style="padding: 1rem; font-weight: 600;">仕入単価</th>
            <th style="padding: 1rem; font-weight: 600;">正味単価</th>
            <th style="padding: 1rem; font-weight: 600;">歩留</th>
            <th style="padding: 1rem; text-align: right; font-weight: 600;">アクション</th>
        `;
    }

    const query = filter.toLowerCase();
    const queryHira = toHiragana(query);

    const filteredItems = cachedItems.filter(item => {
        const nameHira = toHiragana((item.name || "").toLowerCase());
        const catHira = toHiragana((item.category || "").toLowerCase());
        const furiHira = (item.furigana || "").toLowerCase();

        const isMatch = (item.name && item.name.toLowerCase().includes(query)) ||
                      nameHira.includes(queryHira) ||
                      (item.category && item.category.toLowerCase().includes(query)) ||
                      catHira.includes(queryHira) ||
                      furiHira.includes(queryHira);
        
        if (!isMatch && filter !== "") return false;

        const menu = cachedMenus.find(m => m.item_id === item.id);
        if (currentTab === 'menus') {
            // is_sub_recipe が存在しない、または false
            return menu && (menu.is_sub_recipe !== true);
        } else if (currentTab === 'sub_recipes') {
            return menu && (menu.is_sub_recipe === true);
        } else {
            // 食材タブ: m_ingredients にあるもの、またはどちらのフラグもない基本アイテム
            return cachedIngredients.some(ing => ing.item_id === item.id) || (!menu);
        }
    });

    const totalItems = filteredItems.length;
    let totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages === 0) totalPages = 1;
    
    // Ensure currentPage is within bounds
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const itemsToShow = filteredItems.slice(startIndex, startIndex + pageSize);

    if (totalItems === 0) {
        countLabel.textContent = `表示中: 0 件`;
    } else {
        countLabel.textContent = `表示中: ${startIndex + 1}-${Math.min(startIndex + pageSize, totalItems)} / ${totalItems} 件`;
    }
    tbody.innerHTML = '';

    renderPagination(totalPages, filter);

    if (itemsToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 4rem; color: var(--text-secondary);">該当するデータがありません</td></tr>';
        return;
    }

    itemsToShow.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.style.transition = 'background 0.2s';
        
        if (currentTab === 'menus' || currentTab === 'sub_recipes') {
            const menu = cachedMenus.find(m => m.item_id === item.id);
            const salesPrice = menu?.sales_price || 0;
            const cost = getEffectivePrice(item.id, { items: cachedItems, ingredients: cachedIngredients, menus: cachedMenus });
            const profit = salesPrice - cost;
            const margin = salesPrice > 0 ? (profit / salesPrice) * 100 : 0;

            const notesIcon = item.notes ? `<i class="fas fa-comment-dots btn-notes" style="color:var(--primary); cursor:pointer; margin-left:0.5rem;" title="備考あり"></i>` : '';

            // Highlight if cost or pricing is weird
            if (cost === 0) tr.style.background = '#fef2f2';

            tr.innerHTML = `
                <td style="padding: 1rem; font-weight: 600;">
                    ${item.furigana ? `<div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.2; margin-bottom: 0.1rem;">${item.furigana}</div>` : ''}
                    <div style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">${item.name} ${notesIcon}</div>
                    <div style="margin-top: 0.4rem;"><span class="badge ${currentTab === 'menus' ? 'badge-blue' : 'badge-orange'}" style="font-size: 0.65rem;">${item.category || '未分類'}</span></div>
                </td>
                <td style="padding: 1rem; font-weight: 600; font-family: monospace;">
                    ${currentTab === 'menus' ? `¥${salesPrice.toLocaleString()}` : '<span style="color:var(--text-secondary); font-size:0.8rem;">自家製原材料</span>'}
                </td>
                <td style="padding: 1rem; color:var(--text-secondary); font-family: monospace;">¥${Math.round(cost).toLocaleString()}</td>
                <td style="padding: 1rem;">
                    ${currentTab === 'menus' ? `
                        <div style="font-weight: 700; color: ${margin > 70 ? 'var(--primary)' : 'inherit'}">¥${Math.round(profit).toLocaleString()}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${Math.round(margin)}%</div>
                    ` : `
                        <div style="font-size: 0.8rem; color: var(--text-secondary); max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.notes || '-'}</div>
                    `}
                </td>
                <td style="padding: 1rem; color:var(--text-secondary); font-size:0.8rem; font-family: monospace;">${menu?.dinii_id || ''}</td>
                <td style="padding: 1rem; text-align: right;">
                    <button class="btn btn-edit" style="padding: 0.5rem; background: transparent; color: var(--text-secondary);" title="編集"><i class="fas fa-edit"></i></button>
                    <!-- 行削除ボタンは廃止（編集画面内へ集約） -->
                </td>
            `;

            if (item.notes) {
                const icon = tr.querySelector('.btn-notes');
                if (icon) icon.onclick = (e) => { e.stopPropagation(); showAlert('アイテム備考', item.notes); };
            }
        } else {
            const ing = cachedIngredients.find(i => i.item_id === item.id);
            const vendor = cachedVendors.find(v => (v.vendor_id || v.id) === ing?.vendor_id);
            const contentAmount = item.content_amount || 0;
            const purchasePrice = ing?.purchase_price || 0;
            const yieldRate = ing?.yield_rate || 1.0;
            const netUnitPrice = (contentAmount > 0 && yieldRate > 0) ? purchasePrice / (yieldRate * contentAmount) : 0;
            
            // Highlight: 0 values in purchase price or content amount
            if (purchasePrice === 0 || contentAmount === 0) {
                tr.style.background = '#fef2f2'; // bg-red-50 equivalent
            }

            const notesIcon = item.notes ? `<i class="fas fa-comment-dots btn-notes" style="color:var(--primary); cursor:pointer; margin-left:0.5rem;" title="備考あり"></i>` : '';

            tr.innerHTML = `
                <td style="padding: 1rem; font-weight: 600;">
                    ${item.furigana ? `<div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.2; margin-bottom: 0.1rem;">${item.furigana}</div>` : ''}
                    <div style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">${item.name} ${notesIcon}</div>
                    <div style="margin-top: 0.4rem; display: flex; align-items: center;">
                        <span class="badge badge-green" style="font-size: 0.65rem;">${item.category || '未分類'}</span>
                        <span style="color:var(--text-secondary); font-weight:500; font-size: 0.75rem; margin-left: 0.6rem;">単位: ${item.unit || '-'}</span>
                    </div>
                </td>
                <td style="padding: 1rem; color:var(--text-secondary); font-size: 0.85rem;">${vendor?.vendor_name || '-'}</td>
                <td style="padding: 1rem; color:var(--text-secondary); font-family: monospace;">${contentAmount.toLocaleString()}${item.unit}</td>
                <td style="padding: 1rem; font-weight: 600; font-family: monospace;">¥${purchasePrice.toLocaleString()}</td>
                <td style="padding: 1rem; font-weight: 700; color: var(--primary); font-family: monospace;">¥${netUnitPrice.toFixed(2)}</td>
                <td style="padding: 1rem; font-weight: 600; color: #059669;">${Math.round(yieldRate * 100)}%</td>
                <td style="padding: 1rem; text-align: right;">
                    <button class="btn btn-edit" style="padding: 0.5rem; background: transparent; color: var(--text-secondary);" title="編集"><i class="fas fa-edit"></i></button>
                    <!-- 行削除ボタンは廃止（編集画面内へ集約） -->
                </td>
            `;

            if (item.notes) {
                const icon = tr.querySelector('.btn-notes');
                if (icon) {
                    icon.onclick = (e) => {
                        e.stopPropagation();
                        showAlert('アイテム備考', item.notes);
                    };
                }
            }
        }

        tr.querySelector('.btn-edit').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            editingItemData = item;
            currentView = 'form';
            renderView();
        };

        tbody.appendChild(tr);
    });
}

function renderPagination(totalPages, filter) {
    const container = document.getElementById('master-pagination');
    if (!container) return;
    container.innerHTML = '';
    
    if (totalPages <= 1) return;

    // Previous Button
    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn';
    btnPrev.style.padding = '0.4rem 0.8rem';
    btnPrev.style.background = 'var(--surface-darker)';
    btnPrev.disabled = currentPage === 1;
    btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnPrev.onclick = () => {
        currentPage--;
        renderTable(filter);
        document.querySelector('.page-content').scrollTop = 0;
    };
    container.appendChild(btnPrev);

    // Page Numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.padding = '0.4rem 0.8rem';
        btn.style.minWidth = '36px';
        if (i === currentPage) {
            btn.classList.add('btn-primary');
        } else {
            btn.style.background = 'white';
            btn.style.border = '1px solid var(--border)';
            btn.onclick = () => {
                currentPage = i;
                renderTable(filter);
                document.querySelector('.page-content').scrollTop = 0;
            };
        }
        btn.textContent = i;
        container.appendChild(btn);
    }

    // Next Button
    const btnNext = document.createElement('button');
    btnNext.className = 'btn';
    btnNext.style.padding = '0.4rem 0.8rem';
    btnNext.style.background = 'var(--surface-darker)';
    btnNext.disabled = currentPage === totalPages;
    btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnNext.onclick = () => {
        currentPage++;
        renderTable(filter);
        document.querySelector('.page-content').scrollTop = 0;
    };
    container.appendChild(btnNext);
}

function toggleFormSections() {
    const sMenu = document.getElementById('section-menu');
    const sRecipe = document.getElementById('section-recipe');
    const sIng = document.getElementById('section-ingredient');
    
    if (currentTab === 'menus') {
        sMenu.style.display = 'flex';
        sRecipe.style.display = 'flex';
        sIng.style.display = 'none';
        document.getElementById('menu-price-container').style.display = 'flex';
    } else if (currentTab === 'sub_recipes') {
        sMenu.style.display = 'flex';
        sRecipe.style.display = 'flex';
        sIng.style.display = 'none';
        document.getElementById('menu-price-container').style.display = 'none';
        document.getElementById('section-menu-title').textContent = '基本設定';
        document.getElementById('section-menu-title').style.color = '#059669';
    } else {
        sMenu.style.display = 'none';
        sRecipe.style.display = 'none';
        sIng.style.display = 'flex';
        document.getElementById('section-menu-title').textContent = '販売・レシピ設定';
        document.getElementById('section-menu-title').style.color = '#2563EB';
    }
}

let currentRecipe = [];

function setupRecipeEditor() {
    const select = document.getElementById('recipe-add-select');
    const btnAdd = document.getElementById('btn-recipe-add');
    if (!select || !btnAdd) return;

    // 食材リストをプルダウンにセット (m_ingredients にあるもの)
    select.innerHTML = '<option value="">食材を選択...</option>';
    cachedIngredients.forEach(ing => {
        const item = cachedItems.find(it => it.id === ing.item_id);
        if (item) {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = `${item.name} (${item.unit})`;
            select.appendChild(opt);
        }
    });

    // 追加ボタン
    btnAdd.onclick = (e) => {
        e.preventDefault();
        const itemId = select.value;
        if (!itemId) return;
        if (currentRecipe.some(r => r.ingredient_id === itemId)) {
            showAlert('警告', '既に追加されています');
            return;
        }
        currentRecipe.push({ ingredient_id: itemId, quantity: 0 });
        renderRecipeRows();
        select.value = '';
    };

    // 販売価格変更時にも原価率を再計算
    const priceInput = document.getElementById('menu-sales-price');
    if (priceInput) {
        priceInput.removeEventListener('input', calculateRecipeCost);
        priceInput.addEventListener('input', calculateRecipeCost);
    }
}

function renderRecipeRows() {
    const container = document.getElementById('recipe-items-container');
    if (!container) return;

    const isSubRecipe = currentTab === 'sub_recipes';
    container.innerHTML = '';
    
    currentRecipe.forEach((row, index) => {
        const item = cachedItems.find(it => it.id === row.ingredient_id);
        const div = document.createElement('div');
        
        if (isSubRecipe) {
            // High-density row for sub_recipes
            div.className = 'recipe-row';
            div.innerHTML = `
                <div class="recipe-row-name">
                    <span style="font-weight:700;">${item?.name || '不明'}</span>
                    <span style="font-size:0.75rem; color:#94a3b8; margin-left:0.5rem;">${item?.unit || ''}</span>
                </div>
                <div class="recipe-row-input-group">
                    <input type="number" class="recipe-row-input" value="${row.quantity}" step="any">
                    <span class="recipe-row-unit">${item?.unit || ''}</span>
                </div>
                <div class="recipe-row-cost row-cost">¥ 0</div>
                <button type="button" class="recipe-row-remove btn-remove"><i class="fas fa-times"></i></button>
            `;
        } else {
            // Standard row for menus
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '0.5rem';
            div.style.background = 'white';
            div.style.padding = '0.5rem';
            div.style.borderRadius = '8px';
            div.style.border = '1px solid var(--border)';
            div.innerHTML = `
                <div style="flex: 1; font-size: 0.85rem; font-weight: 600;">${item?.name || '不明'}</div>
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <input type="number" value="${row.quantity}" step="any" style="width: 70px; padding: 0.3rem; border: 1px solid var(--border); border-radius: 4px; text-align: right; font-size: 0.85rem;" class="recipe-row-input">
                    <span style="font-size: 0.75rem; color: var(--text-secondary); width: 25px;">${item?.unit || ''}</span>
                </div>
                <div class="row-cost" style="width: 60px; text-align: right; font-size: 0.8rem; font-family: monospace; color: var(--text-secondary);">¥0</div>
                <button type="button" class="btn-remove" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0.2rem;"><i class="fas fa-times"></i></button>
            `;
        }

        const input = div.querySelector('.recipe-row-input');
        input.addEventListener('input', (e) => {
            row.quantity = Number(e.target.value);
            calculateRecipeCost();
        });

        div.querySelector('.btn-remove').onclick = () => {
            currentRecipe.splice(index, 1);
            renderRecipeRows();
        };

        container.appendChild(div);
    });
    calculateRecipeCost();
}

function calculateRecipeCost() {
    let total = 0;
    const isSubRecipe = currentTab === 'sub_recipes';
    const containers = document.querySelectorAll('#recipe-items-container > div');
    
    const cache = {
        items: cachedItems,
        ingredients: cachedIngredients,
        menus: cachedMenus
    };

    currentRecipe.forEach((row, index) => {
        const unitPrice = getEffectivePrice(row.ingredient_id, cache);
        const cost = unitPrice * (row.quantity || 0);
        total += cost;
        
        const rowCostEl = containers[index]?.querySelector('.row-cost');
        if (rowCostEl) rowCostEl.textContent = `¥${Math.round(cost).toLocaleString()}`;
    });

    if (isSubRecipe) {
        // v39 Cost Summary items
        const totalCostEl = document.getElementById('display-total-cost');
        const yieldInput = document.getElementById('recipe-yield-amount');
        const netUnitPriceEl = document.getElementById('display-net-unit-price');

        if (totalCostEl) totalCostEl.textContent = `¥ ${Math.round(total).toLocaleString()}`;
        
        const yieldAmount = parseFloat(yieldInput?.value) || 0;
        if (netUnitPriceEl) {
            if (yieldAmount > 0) {
                const netPrice = total / yieldAmount;
                netUnitPriceEl.textContent = `¥ ${netPrice.toFixed(2)}`;
            } else {
                netUnitPriceEl.textContent = '¥ -';
            }
        }
    } else {
        // Standard menu cost display
        const salesPriceInput = document.getElementById('menu-sales-price');
        const salesPrice = (salesPriceInput && salesPriceInput.offsetParent !== null) ? Number(salesPriceInput.value) : 0;
        const ratio = salesPrice > 0 ? Math.round((total / salesPrice) * 100) : 0;
        
        const totalEl = document.getElementById('recipe-total-cost');
        if (totalEl) {
            if (salesPrice > 0) {
                totalEl.textContent = `原価: ¥${Math.round(total).toLocaleString()} (${ratio}%)`;
                totalEl.style.color = ratio > 35 ? 'var(--danger)' : (ratio > 25 ? 'var(--warning)' : '#059669');
            } else {
                totalEl.textContent = `構成原価: ¥${Math.round(total).toLocaleString()}`;
                totalEl.style.color = 'var(--primary)';
            }
        }
    }
}

