import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';
import { getEffectivePrice } from './cost_engine.js?v=9';

let currentTab = 'menus'; // 'menus', 'sub_recipes', or 'ingredients'
let currentPage = 1;
const pageSize = 30;
let cachedItems = [];
let cachedIngredients = [];
let cachedMenus = [];
let cachedVendors = [];
let currentUser = null;

export const productsPageHtml = `
    <div class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
                <h3 style="margin-bottom: 0.2rem;">マスタ管理</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">販売メニューと仕入れ食材を管理します</p>
            </div>
            <div style="display: flex; gap: 0.8rem;">
                <button class="btn" id="btn-sync-legacy" style="background: rgba(0,0,0,0.05); color: var(--text-secondary); font-size: 0.8rem;">
                    <i class="fas fa-sync-alt"></i> 旧マスタを同期
                </button>
                <button class="btn btn-primary" id="btn-add-item">
                    <i class="fas fa-plus"></i> 新規登録
                </button>
            </div>
        </div>

        <!-- 統合管理タブ -->
        <div class="tabs-container">
            <div class="tab-item active" data-tab="menus" id="tab-menus">
                <i class="fas fa-utensils"></i> 販売メニュー
            </div>
            <div class="tab-item" data-tab="sub_recipes" id="tab-sub_recipes">
                <i class="fas fa-mortar-pestle"></i> 自家製原材料
            </div>
            <div class="tab-item" data-tab="ingredients" id="tab-ingredients">
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
                    読み込み中...
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; min-width: 800px; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr id="table-header-row" style="border-bottom: 1px solid var(--border); color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">
                            <!-- Dynamic Headers -->
                        </tr>
                    </thead>
                    <tbody id="master-table-body">
                    </tbody>
                </table>
            </div>
            
            <!-- Pagination Controls -->
            <div id="master-pagination" style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border);">
            </div>
        </div>
        
        <!-- アイテム登録・編集モーダル -->
        <div id="item-modal" class="modal-overlay" style="display: none; position: fixed !important; inset: 0 !important; background: rgba(0,0,0,0.5) !important; z-index: 10000 !important; align-items: center; justify-content: center;">
            <div class="glass-panel animate-scale-in" style="width: 100%; max-width: 600px; padding: 0;">
                <div id="item-modal-header" style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; border-radius: 16px 16px 0 0;">
                    <h3 id="item-modal-title" style="margin: 0; font-size: 1.25rem; color: #1e293b;">アイテム登録</h3>
                    <button id="close-item-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-secondary);"><i class="fas fa-times"></i></button>
                </div>
                
                <div style="padding: 2rem;">
                
                <form id="item-form">
                    <input type="hidden" id="item-doc-id">
                    
                    <div style="background: rgba(0,0,0,0.02); padding: 1.2rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; text-transform: uppercase;">基本情報</h4>
                        <div class="input-group">
                            <label>アイテム名称</label>
                            <input type="text" id="item-name" placeholder="例: 豚バラ串, キャベツ" required>
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <div class="input-group" style="flex: 1.5;">
                                <label>カテゴリ</label>
                                <input type="text" id="item-category" list="category-list" placeholder="例: 肉類, 野菜, ドリンク">
                                <datalist id="category-list"></datalist>
                            </div>
                            <div class="input-group" style="flex: 1;">
                                <label>基本単位</label>
                                <input type="text" id="item-unit" placeholder="例: kg, g, 個" required>
                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <div class="input-group" style="flex: 1;">
                                <label>内容量 (1単位あたり)</label>
                                <input type="number" id="item-content-amount" placeholder="例: 1000, 500" step="any">
                            </div>
                            <div class="input-group" style="flex: 2;">
                                <label>備考</label>
                                <input type="text" id="item-notes" placeholder="メモなど">
                            </div>
                        </div>
                    </div>

                    <!-- 販売メニュー専用フィールド -->
                    <div id="section-menu" style="background: rgba(59, 130, 246, 0.03); padding: 1.2rem; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.1); margin-bottom: 1.5rem; display: none;">
                        <h4 id="section-menu-title" style="font-size: 0.85rem; color: #2563EB; margin-bottom: 1rem; text-transform: uppercase;">販売・レシピ設定</h4>
                        <div id="menu-price-container" style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                            <div class="input-group" style="flex: 1; margin-bottom: 0;">
                                <label>販売価格 (税抜)</label>
                                <input type="number" id="menu-sales-price" placeholder="0">
                            </div>
                            <div class="input-group" style="flex: 1; margin-bottom: 0;">
                                <label>Dinii ID</label>
                                <input type="text" id="menu-dinii-id" placeholder="連携ID">
                            </div>
                        </div>
                    </div>

                    <!-- 共通レシピ編集セクション（メニューまたは自家製食材） -->
                    <div id="section-recipe" style="display: none; background: rgba(0,0,0,0.02); padding: 1.2rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                            <h5 style="font-size: 0.9rem; color: var(--text-primary); margin: 0;">レシピ / 構成材料</h5>
                            <div id="recipe-total-cost" style="font-size: 0.85rem; font-weight: 700; color: var(--primary);">原価: ¥0</div>
                        </div>
                        
                        <div id="recipe-items-container" style="display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem;">
                            <!-- Recipe rows injected here -->
                        </div>

                        <div style="display: flex; gap: 0.5rem;">
                            <select id="recipe-add-select" style="flex: 1; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.9rem;">
                                <option value="">食材を追加...</option>
                            </select>
                            <button type="button" id="btn-recipe-add" class="btn" style="padding: 0.6rem; background: var(--surface-darker); color: var(--text-primary); border: 1px solid var(--border);">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">※自家製（半成品）の場合はレシピを登録してください。仕入品の場合は空欄でOKです。</p>
                    </div>

                    <!-- 食材専用フィールド -->
                    <div id="section-ingredient" style="display: none; background: rgba(5, 150, 105, 0.03); padding: 1.2rem; border-radius: 12px; border: 1px solid rgba(5, 150, 105, 0.1); margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.85rem; color: #059669; margin-bottom: 1rem; text-transform: uppercase;">仕入・原価設定</h4>
                        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                            <div class="input-group" style="flex: 1; margin-bottom: 0;">
                                <label>仕入れ単価 (税抜)</label>
                                <input type="number" id="ing-purchase-price" placeholder="0">
                            </div>
                            <div class="input-group" style="flex: 1; margin-bottom: 0;">
                                <label>歩留率 (0.0〜1.0)</label>
                                <input type="number" id="ing-yield-rate" step="0.01" value="1.00">
                            </div>
                        </div>
                        <div class="input-group">
                            <label>仕入先業者</label>
                            <select id="ing-vendor-id" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.95rem;">
                                <option value="">業者を選択...</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 1rem; margin-top: 0.5rem;"><i class="fas fa-save"></i> 保存する</button>
                </form>
            </div>
        </div>
    </div>
`;

export async function initProductsPage(user) {
    currentUser = user;
    
    // 権限チェック (Manager以上)
    const canEdit = user?.Role === 'Admin' || user?.Role === '管理者' || user?.Role === 'Manager' || user?.Role === '店長';
    if (!canEdit) {
        document.getElementById('page-content').innerHTML = `
            <div style="text-align:center; padding: 5rem; color: var(--text-secondary);">
                <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 1.5rem; opacity: 0.3;"></i>
                <p>マスタ編集権限がありません。</p>
            </div>
        `;
        return;
    }

    await reloadData();
    renderTable();

    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderTable();
        });
    });

    const btnSync = document.getElementById('btn-sync-legacy');
    if (btnSync) {
        btnSync.onclick = () => {
            showConfirm('データ同期', '旧 m_products のデータを新スキーマにコピーしますか？\n(既に移行済みのデータは上書きされません)', async () => {
                btnSync.disabled = true;
                btnSync.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 同期中...';
                try {
                    const legacySnap = await getDocs(collection(db, "m_products"));
                    let count = 0;
                    for (const d of legacySnap.docs) {
                        const data = d.data();
                        const itemId = d.id;
                        const name = data['商品名'] || data['ProductName'] || '名称未設定';
                        // items
                        await setDoc(doc(db, "m_items", itemId), {
                            name: name,
                            category: data['大分類'] || data['CategoryL'] || '未分類',
                            unit: '個', // デフォルト
                            updated_at: new Date().toISOString()
                        }, { merge: true });
                        // menus (提供価格がある場合はメニューとみなす)
                        const price = data['提供価格'] || data['Price'] || 0;
                        if (price > 0) {
                            await setDoc(doc(db, "m_menus", itemId), {
                                item_id: itemId,
                                sales_price: Number(price),
                                dinii_id: "",
                                updated_at: new Date().toISOString()
                            }, { merge: true });
                        } else {
                            // それ以外は食材とみなす
                            await setDoc(doc(db, "m_ingredients", itemId), {
                                item_id: itemId,
                                purchase_price: 0,
                                yield_rate: 1.0,
                                updated_at: new Date().toISOString()
                            }, { merge: true });
                        }
                        count++;
                    }
                    showAlert('同期完了', `${count} 件のデータを同期しました。`);
                    await reloadData();
                    renderTable();
                } catch(e) { 
                    console.error(e);
                    showAlert('エラー', '同期に失敗しました。');
                } finally {
                    btnSync.disabled = false;
                    btnSync.innerHTML = '<i class="fas fa-sync-alt"></i> 旧マスタを同期';
                }
            });
        };
    }

    const btnAdd = document.getElementById('btn-add-item');
    const modal = document.getElementById('item-modal');
    const btnClose = document.getElementById('close-item-modal');
    const form = document.getElementById('item-form');
    
    if(btnAdd && modal) {
        btnAdd.onclick = () => {
            form.reset();
            document.getElementById('item-doc-id').value = '';
            
            let title = '新規登録';
            if (currentTab === 'menus') title = '販売メニューの登録';
            else if (currentTab === 'sub_recipes') title = '自家製原材料の登録';
            else title = '食材・仕入品の登録';
            
            document.getElementById('item-modal-title').textContent = title;
            
            // UIリセット
            toggleModalSections();
            
            currentRecipe = [];
            setupRecipeEditor();
            renderRecipeRows();
            
            modal.style.display = 'flex';
        };
        btnClose.onclick = () => modal.style.display = 'none';
        const backdrop = document.getElementById('modal-backdrop');
        if (backdrop) backdrop.onclick = () => modal.style.display = 'none';
    }

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = form.querySelector('button[type="submit"]');
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            btnSubmit.disabled = true;

            const docId = document.getElementById('item-doc-id').value;
            const itemId = docId || `item_${Date.now()}`;

            const baseItem = {
                name: document.getElementById('item-name').value,
                category: document.getElementById('item-category').value,
                unit: document.getElementById('item-unit').value,
                content_amount: Number(document.getElementById('item-content-amount').value) || 0,
                notes: document.getElementById('item-notes').value || "",
                updated_at: new Date().toISOString()
            };

            try {
                // 1. m_items への保存
                await setDoc(doc(db, "m_items", itemId), baseItem, { merge: true });

                // 2. 詳細への保存
                if (currentTab === 'menus') {
                    const menuData = {
                        item_id: itemId,
                        sales_price: Number(document.getElementById('menu-sales-price').value) || 0,
                        dinii_id: document.getElementById('menu-dinii-id').value || "",
                        recipe: currentRecipe,
                        is_sub_recipe: false,
                        updated_at: new Date().toISOString()
                    };
                    await setDoc(doc(db, "m_menus", itemId), menuData, { merge: true });
                } else if (currentTab === 'sub_recipes') {
                    const subRecipeData = {
                        item_id: itemId,
                        sales_price: 0,
                        recipe: currentRecipe,
                        is_sub_recipe: true,
                        updated_at: new Date().toISOString()
                    };
                    await setDoc(doc(db, "m_menus", itemId), subRecipeData, { merge: true });
                } else {
                    const ingData = {
                        item_id: itemId,
                        purchase_price: Number(document.getElementById('ing-purchase-price').value) || 0,
                        yield_rate: Number(document.getElementById('ing-yield-rate').value) || 1.0,
                        vendor_id: document.getElementById('ing-vendor-id').value || "",
                        updated_at: new Date().toISOString()
                    };
                    await setDoc(doc(db, "m_ingredients", itemId), ingData, { merge: true });
                }

                modal.style.display = 'none';
                await reloadData();
                renderTable();
            } catch (err) {
                console.error(err);
            showAlert('保存に失敗しました。', e.message);
            } finally {
                btnSubmit.innerHTML = '<i class="fas fa-save"></i> 保存する';
                btnSubmit.disabled = false;
            }
        });
    }

    // 検索フィルタ
    const searchInput = document.getElementById('master-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1; // Reset to page 1 on search
            renderTable(searchInput.value);
        });
    }

    // タブ切り替え時もページリセット
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            currentPage = 1;
            // renderTable will be called by the existing tab logic
        });
    });
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

    const filteredItems = cachedItems.filter(item => {
        const isMatch = item.name.toLowerCase().includes(filter.toLowerCase()) || 
                      (item.category && item.category.toLowerCase().includes(filter.toLowerCase()));
        
        if (!isMatch) return false;

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
    const totalPages = Math.ceil(totalItems / pageSize);
    
    // Ensure currentPage is within bounds
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const itemsToShow = filteredItems.slice(startIndex, startIndex + pageSize);

    countLabel.textContent = `表示中: ${startIndex + 1}-${Math.min(startIndex + pageSize, totalItems)} / ${totalItems} 件`;
    tbody.innerHTML = '';

    renderPagination(totalPages, filter);

    if (itemsToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 4rem; color: var(--text-secondary);">該当するデータがありません</td></tr>';
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
                    ${item.name} ${notesIcon} <br>
                    <span class="badge ${currentTab === 'menus' ? 'badge-blue' : 'badge-orange'}" style="font-size: 0.65rem;">${item.category || '未分類'}</span>
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
                    ${item.name} ${notesIcon} <br>
                    <span class="badge badge-green" style="font-size: 0.65rem;">${item.category || '未分類'}</span>
                    <small style="color:var(--text-secondary); font-weight:400; font-size: 0.7rem; display: block;">単位: ${item.unit}</small>
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
            const docId = item.id;
            document.getElementById('item-doc-id').value = docId;
            document.getElementById('item-name').value = item.name;
            document.getElementById('item-category').value = item.category || '';
            document.getElementById('item-unit').value = item.unit || '';
            document.getElementById('item-content-amount').value = item.content_amount || 0;
            document.getElementById('item-notes').value = item.notes || '';
            
            // 状態（タブ）に合わせてフィールド表示/非表示をまず初期化
            toggleModalSections();

            const menuRecord = cachedMenus.find(m => m.item_id === docId);
            currentRecipe = menuRecord?.recipe || [];
            setupRecipeEditor();
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
                const ing = cachedIngredients.find(i => i.item_id === docId);
                document.getElementById('ing-purchase-price').value = ing?.purchase_price || 0;
                document.getElementById('ing-yield-rate').value = ing?.yield_rate || 1.0;
                
                const vendorSelect = document.getElementById('ing-vendor-id');
                vendorSelect.innerHTML = '<option value="">業者を選択...</option>';
                cachedVendors.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.vendor_id || v.id;
                    opt.textContent = v.vendor_name;
                    if (ing?.vendor_id === opt.value) opt.selected = true;
                    vendorSelect.appendChild(opt);
                });
            }

            document.getElementById('item-modal-title').textContent = 'アイテムの編集';
            document.getElementById('item-modal').style.display = 'flex';
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

function toggleModalSections() {
    const sMenu = document.getElementById('section-menu');
    const sRecipe = document.getElementById('section-recipe');
    const sIng = document.getElementById('section-ingredient');
    const header = document.getElementById('item-modal-header');
    const title = document.getElementById('item-modal-title');
    
    if (currentTab === 'menus') {
        header.style.background = '#fff';
        title.style.color = '#1e293b';
        sMenu.style.display = 'block';
        sRecipe.style.display = 'block';
        sIng.style.display = 'none';
        
        // メニュー用表示
        document.getElementById('menu-price-container').style.display = 'flex';
    } else if (currentTab === 'sub_recipes') {
        header.style.background = '#ecfdf5'; // Light green
        header.style.borderBottom = '1px solid #10b981';
        title.style.color = '#065f46';
        title.textContent = '自家製原材料・レシピ設定';
        sMenu.style.display = 'block'; // レシピ部分はこっちにある
        sRecipe.style.display = 'block';
        sIng.style.display = 'none';
        
        // 価格とDinii IDは隠す
        document.getElementById('menu-price-container').style.display = 'none';
        document.getElementById('section-menu-title').textContent = '基本設定';
        document.getElementById('section-menu-title').style.color = '#059669';
    } else {
        header.style.background = '#fff';
        header.style.borderBottom = '1px solid var(--border)';
        title.style.color = '#1e293b';
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

