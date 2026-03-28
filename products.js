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
            
            <div class="form-wrapper form-with-fixed-bottom" style="padding: 2.5rem; max-width: 1000px; margin: 0 auto; width: 100%;">
                <form id="item-form" style="display: flex; flex-direction: column; gap: 2.5rem;">
                    <!-- 基本情報 -->
                    <section>
                        <h4 style="margin-top: 0; margin-bottom: 1.5rem; color: var(--primary); font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; border-left: 4px solid var(--primary); padding-left: 0.8rem;">
                            基本スペック
                        </h4>
                        <div style="margin-bottom: 1.5rem;">
                            <div class="input-group" style="margin-bottom: 0.5rem;">
                                <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">ふりがな（ひらがな）</label>
                                <input type="text" id="item-furigana" placeholder="例: ばちまぐろ / とくようしょうゆ" 
                                       style="font-size: 0.95rem; padding: 0.6rem; background: #f8fafc;" value="${isEdit ? (editingItemData.furigana || '') : ''}">
                            </div>
                            <div class="input-group">
                                <label style="font-weight: 800; color: #1e293b; font-size: 0.9rem;">品目名 / 食材名 <span style="color: var(--danger);">*</span></label>
                                <input type="text" id="item-name" required placeholder="例: 鉢鮪 / 徳用醤油 1.8L" 
                                       style="font-size: 1.25rem; font-weight: 800; padding: 1rem; border: 2px solid var(--primary); border-radius: 8px;" value="${isEdit ? editingItemData.name : ''}">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="input-group">
                                <label style="font-weight: 700; color: #475569;">カテゴリー</label>
                                <input type="text" id="item-category" placeholder="例: 牛肉 / 調味料" 
                                       style="font-size: 1rem; padding: 0.8rem;" value="${isEdit ? (editingItemData.category || '') : ''}">
                            </div>
                            <div class="input-group">
                                <label style="font-weight: 700; color: #475569;">単位</label>
                                <input type="text" id="item-unit" placeholder="例: g / 本 / 枚" 
                                       style="font-size: 1rem; padding: 0.8rem;" value="${isEdit ? (editingItemData.unit || '') : ''}">
                            </div>
                        </div>
                    </section>

                    <div class="product-form-grid">
                        <!-- 販売・原価セクション -->
                        <section id="section-menu" style="background: #f1f5f9; padding: 1.5rem; border-radius: 12px; height: 100%;">
                            <h4 id="section-menu-title" style="margin-top: 0; margin-bottom: 1.2rem; color: #2563EB; font-size: 1rem; font-weight: 800;">
                                販売・レシピ設定
                            </h4>
                            <div id="menu-price-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                                <div class="input-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.85rem; font-weight: 700;">販売価格(税込)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="menu-sales-price" placeholder="例: 1200" style="font-weight: 700; font-family: monospace;">
                                        <span class="input-addon">円</span>
                                    </div>
                                </div>
                                <div class="input-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.85rem; font-weight: 700;">Dinii ID</label>
                                    <input type="text" id="menu-dinii-id" placeholder="連携コード" style="font-family: monospace;">
                                </div>
                            </div>
                            <div id="section-recipe">
                                <label style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.5rem; display: block;">レシピ構成 (食材の積み上げ)</label>
                                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                                    <select id="recipe-add-select" style="flex: 1; padding: 0.5rem; border-radius: 8px; border: 1px solid var(--border);"></select>
                                    <button type="button" id="btn-recipe-add" class="btn" style="background: #2563EB; color: white; padding: 0.5rem 1rem;"><i class="fas fa-plus"></i></button>
                                </div>
                                <div id="recipe-items-container" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto;">
                                    <!-- Recipe rows dynamic -->
                                </div>
                                <div id="recipe-total-cost" style="margin-top: 1rem; text-align: right; font-weight: 800; color: var(--primary); font-size: 1.1rem;">
                                    原価: ¥0
                                </div>
                            </div>
                        </section>

                        <!-- 仕入・歩留セクション -->
                        <section id="section-ingredient" style="background: #ecfdf5; padding: 1.5rem; border-radius: 12px; height: 100%;">
                            <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: #059669; font-size: 1rem; font-weight: 800;">
                                仕入・原価情報
                            </h4>
                            <div class="input-group">
                                <label style="font-size: 0.85rem; font-weight: 700;">デフォルト仕入先</label>
                                <select id="ing-vendor-id" style="width: 100%; padding: 0.875rem 1rem; border-radius: 8px; border: 1px solid var(--border);"></select>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                                <div class="input-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.85rem; font-weight: 700;">仕入単価(税込)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="ing-purchase-price" placeholder="例: 5000" style="font-weight: 700; font-family: monospace;">
                                        <span class="input-addon">円</span>
                                    </div>
                                </div>
                                <div class="input-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.85rem; font-weight: 700;">内容量 (入力単位)</label>
                                    <div class="input-with-addon-wrapper">
                                        <input type="number" id="item-content-amount" placeholder="例: 1000" step="any" style="font-weight: 700; font-family: monospace;" value="${isEdit ? (editingItemData.content_amount || 0) : 0}">
                                        <span class="input-addon">g/ml</span>
                                    </div>
                                </div>
                            </div>
                            <div class="input-group" style="margin-top: 1.5rem;">
                                <label style="font-size: 0.85rem; font-weight: 700;">歩留 (0.0〜1.0)</label>
                                <div class="input-with-addon-wrapper">
                                    <input type="number" id="ing-yield-rate" placeholder="例: 1.0" step="0.01" style="font-weight: 700; font-family: monospace;">
                                    <span class="input-addon">%</span>
                                </div>
                                <p style="font-size: 0.75rem; color: #059669; margin-top: 0.5rem; line-height: 1.4;">※可食部100%なら 1.0、半分なら 0.5 を入力してください。原価計算に直結します。</p>
                            </div>
                        </section>
                    </div>

                    <div class="input-group" style="margin-bottom: 0;">
                        <label style="font-weight: 700; color: #475569;">備考 / 内部メモ</label>
                        <textarea id="item-notes" rows="3" placeholder="仕入れ時の注意点、小分けのルール、レシピの提供手順など" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">${isEdit ? (editingItemData.notes || '') : ''}</textarea>
                    </div>

                    <div class="mobile-fixed-bottom" style="display: flex; gap: 1rem; padding-top: 2rem; border-top: 1px solid var(--border);">
                        <button type="button" id="btn-form-cancel" class="btn" style="flex: 1; background: #f8fafc; color: #64748b; font-weight: 700; padding: 1.2rem; border: 1px solid #e2e8f0; font-size: 1.05rem;"><i class="fas fa-times" style="margin-right: 0.5rem;"></i> キャンセル</button>
                        <button type="submit" class="btn btn-primary" style="flex: 2; padding: 1.2rem; font-weight: 800; font-size: 1.1rem; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); background: linear-gradient(135deg, #059669, #10b981);">
                            <i class="fas fa-save" style="margin-right: 0.5rem;"></i>
                            アイテム情報保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('btn-form-back').onclick = document.getElementById('btn-form-cancel').onclick = () => {
        currentView = 'list';
        renderView();
    };

    toggleFormSections();
    setupFormLogic();
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
                    <input type="text" id="master-search" placeholder="名称やカテゴリで検索..." style="padding-top: 0.6rem; padding-bottom: 0.6rem;">
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
    renderTable();
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
            currentPage = 1;
            renderTable(searchInput.value);
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

function setupFormLogic() {
    setupRecipeEditor();
    const form = document.getElementById('item-form');
    if (!form) return;

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
        } 
        
        if (currentTab === 'ingredients') {
            const ing = cachedIngredients.find(i => i.item_id === item.id);
            if (document.getElementById('ing-purchase-price')) document.getElementById('ing-purchase-price').value = ing?.purchase_price || 0;
            if (document.getElementById('ing-yield-rate')) document.getElementById('ing-yield-rate').value = ing?.yield_rate || 1.0;
            
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

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        btnSubmit.disabled = true;

        const itemId = editingItemData ? editingItemData.id : `item_${Date.now()}`;

        const baseItem = {
            furigana: document.getElementById('item-furigana').value || "",
            name: document.getElementById('item-name').value,
            category: document.getElementById('item-category').value,
            unit: document.getElementById('item-unit').value,
            content_amount: Number(document.getElementById('item-content-amount').value) || 0,
            notes: document.getElementById('item-notes').value || "",
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
                await setDoc(doc(db, "m_menus", itemId), {
                    item_id: itemId, sales_price: 0, recipe: currentRecipe,
                    is_sub_recipe: true, updated_at: new Date().toISOString()
                }, { merge: true });
            } else {
                await setDoc(doc(db, "m_ingredients", itemId), {
                    item_id: itemId, purchase_price: Number(document.getElementById('ing-purchase-price').value) || 0,
                    yield_rate: Number(document.getElementById('ing-yield-rate').value) || 1.0,
                    vendor_id: document.getElementById('ing-vendor-id').value || "", updated_at: new Date().toISOString()
                }, { merge: true });
            }

            currentView = 'list';
            await reloadData();
            renderView();
            showAlert('成功', '保存しました。');
        } catch (err) {
            console.error(err);
            showAlert('保存に失敗しました。', err.message);
        } finally {
            btnSubmit.innerHTML = '<i class="fas fa-save"></i> 保存する';
            btnSubmit.disabled = false;
        }
    };
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
                    <button class="btn btn-delete" style="padding: 0.5rem; background: transparent; color: var(--danger);" title="削除"><i class="fas fa-trash-alt"></i></button>
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
                    <button class="btn btn-delete" style="padding: 0.5rem; background: transparent; color: var(--danger);" title="削除"><i class="fas fa-trash-alt"></i></button>
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

        tr.querySelector('.btn-delete').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
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
                        renderTable();
                        showAlert('成功', '削除しました。');
                    } catch(err) {
                        showAlert('エラー', '削除に失敗しました。');
                    }
                });
            } else {
                showConfirm('削除申請', `「${item.name}」の削除を管理者に申請しますか？`, async () => {
                    try {
                        await addDoc(collection(db, "notifications"), {
                            type: 'deletion_request',
                            page: 'products',
                            target_id: item.id,
                            target_name: item.name,
                            requester_id: currentUser?.id || 'unknown',
                            requester_name: currentUser?.Name || '不明',
                            status: 'pending',
                            created_at: new Date().toISOString()
                        });
                        showAlert('申請完了', '削除申請を送信しました。管理者の承認をお待ちください。');
                    } catch(err) {
                        console.error(err);
                        showAlert('エラー', '申請に失敗しました。');
                    }
                });
            }
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
        sMenu.style.display = 'block';
        sRecipe.style.display = 'block';
        sIng.style.display = 'none';
        document.getElementById('menu-price-container').style.display = 'flex';
    } else if (currentTab === 'sub_recipes') {
        sMenu.style.display = 'block';
        sRecipe.style.display = 'block';
        sIng.style.display = 'none';
        document.getElementById('menu-price-container').style.display = 'none';
        document.getElementById('section-menu-title').textContent = '基本設定';
        document.getElementById('section-menu-title').style.color = '#059669';
    } else {
        sMenu.style.display = 'none';
        sRecipe.style.display = 'none';
        sIng.style.display = 'block';
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

    container.innerHTML = '';
    currentRecipe.forEach((row, index) => {
        const item = cachedItems.find(it => it.id === row.ingredient_id);
        const div = document.createElement('div');
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
                <input type="number" value="${row.quantity}" step="any" style="width: 70px; padding: 0.3rem; border: 1px solid var(--border); border-radius: 4px; text-align: right; font-size: 0.85rem;">
                <span style="font-size: 0.75rem; color: var(--text-secondary); width: 25px;">${item?.unit || ''}</span>
            </div>
            <div class="row-cost" style="width: 60px; text-align: right; font-size: 0.8rem; font-family: monospace; color: var(--text-secondary);">¥0</div>
            <button type="button" class="btn-remove" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0.2rem;"><i class="fas fa-times"></i></button>
        `;

        const input = div.querySelector('input');
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
    const containers = document.querySelectorAll('#recipe-items-container > div');
    
    // cost_engine 用のキャッシュ
    const cache = {
        items: cachedItems,
        ingredients: cachedIngredients,
        menus: cachedMenus
    };

    currentRecipe.forEach((row, index) => {
        // 再帰計算エンジンを使用
        const unitPrice = getEffectivePrice(row.ingredient_id, cache);
        const cost = unitPrice * (row.quantity || 0);
        total += cost;
        
        const rowCostEl = containers[index]?.querySelector('.row-cost');
        if (rowCostEl) rowCostEl.textContent = `¥${Math.round(cost)}`;
    });

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

