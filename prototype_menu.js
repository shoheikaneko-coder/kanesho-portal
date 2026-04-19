import { db } from './firebase.js';
import { 
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, 
    query, orderBy, where, serverTimestamp, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';
import { getEffectivePrice } from './cost_engine.js?v=9';

let currentView = 'list'; // 'list' or 'form'
let cachedPrototypes = [];
let cachedItems = [];       // 本番用アイテム
let cachedIngredients = []; // 本番用原材料
let cachedMenus = [];       // 本番用メニュー
let currentUser = null;
let editingPrototype = null;
let activeMobileTab = 'info'; // 'info', 'recipe', 'notes'

export const prototypeMenuPageHtml = `
    <div id="prototype-menu-container" class="animate-fade-in">
        <!-- Content injected here -->
    </div>
    <style>
        .proto-sticky-summary {
            position: sticky;
            top: -1.2rem; /* Slimmer header allowance */
            left: -1.2rem;
            right: -1.2rem;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid #e2e8f0;
            padding: 0.5rem 1rem; /* Reduced from 0.7/1.5 */
            margin: -1.2rem -1.2rem 1rem -1.2rem;
            z-index: 1100;
            display: flex;
            justify-content: space-around;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        ... (omitted summary items)
        /* Tabs UI (Mobile Only Style Content) */
        .proto-mobile-tabs {
            display: none;
            background: white;
            padding: 0.4rem;
            border-bottom: 1px solid #e2e8f0;
            margin: -0.5rem -1.2rem 1rem -1.2rem;
            position: sticky;
            top: 2.2rem; /* Keep roughly the same to clear summary bar */
            z-index: 1050;
        }

        @media (max-width: 1024px) {
            .proto-mobile-tabs {
                display: block;
            }
            .proto-section {
                display: none;
            }
            .proto-section.active {
                display: block;
            }
            .proto-basic-info-grid {
                display: flex !important;
                flex-direction: column !important;
                gap: 1.2rem !important;
            }
            .proto-basic-info-grid > div {
                width: 100% !important;
            }
            .proto-major-portion-row {
                display: flex !important;
                flex-direction: column !important;
                gap: 1rem !important;
                align-items: stretch !important;
            }
            .proto-sticky-summary {
                top: -1rem;
                padding: 0.5rem 1rem;
                justify-content: space-between;
                gap: 0.5rem;
            }
            .proto-summary-value {
                font-size: 0.95rem;
            }
            .proto-summary-label {
                font-size: 0.6rem;
            }
            .proto-form-card {
                flex-direction: column !important;
                align-items: center !important;
                text-align: center;
            }
            .proto-img-container {
                margin-bottom: 0.5rem;
            }
        }
    </style>
`;

export async function initPrototypeMenuPage() {
    currentUser = window.appState?.currentUser;
    await reloadData();
    renderView();
}

async function reloadData() {
    const [protoSnap, itemsSnap, ingSnap, menuSnap] = await Promise.all([
        getDocs(query(collection(db, "t_prototype_recipes"), orderBy("updated_at", "desc"))),
        getDocs(collection(db, "m_items")),
        getDocs(collection(db, "m_ingredients")),
        getDocs(collection(db, "m_menus"))
    ]);

    cachedPrototypes = protoSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedIngredients = ingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedMenus = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderView() {
    const container = document.getElementById('prototype-menu-container');
    if (!container) return;

    if (currentView === 'form') {
        renderFormView(container);
    } else {
        renderListView(container);
    }
}

function renderListView(container) {
    container.innerHTML = `
        <div style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="margin:0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-lightbulb" style="color: #f59e0b;"></i>
                    試作メニュー・自家製リスト
                </h2>
                <button id="btn-proto-new" class="btn btn-primary" style="padding: 0.8rem 1.5rem; border-radius: 30px; font-weight: 800;">
                    <i class="fas fa-plus-circle"></i> 新規試作を開始
                </button>
            </div>

            <div id="prototype-list">
                ${cachedPrototypes.length === 0 ? `
                    <div style="text-align:center; padding: 4rem; color: #94a3b8;">
                        <i class="fas fa-flask" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                        <p>まだ試作品がありません。新しいアイデアを形にしましょう！</p>
                    </div>
                ` : cachedPrototypes.map(p => {
                    const stats = calculatePrototypeStats(p);
                    return `
                        <div class="prototype-card" onclick="window.prototypeMenu.openEdit('${p.id}')">
                            <img src="${p.image_url || 'https://via.placeholder.com/150'}" class="proto-thumb" onerror="this.src='https://via.placeholder.com/150'">
                            <div style="flex:1;">
                                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.2rem;">
                                    <span class="badge ${p.type === 'sales_menu' ? 'badge-proto-menu' : 'badge-proto-homemade'}" style="font-size: 0.65rem;">
                                        ${p.type === 'sales_menu' ? '販売メニュー' : '自家製原材料'}
                                    </span>
                                    <h4 style="margin:0; font-weight:800; font-size:1rem;">${p.name}</h4>
                                </div>
                                <div style="font-size:0.75rem; color:#64748b; font-weight:600;">
                                    開発者: ${p.developer || '不明'} | 更新: ${p.updated_at ? new Date(p.updated_at.seconds * 1000).toLocaleDateString() : '-'}
                                </div>
                            </div>
                            <div style="text-align:right;">
                                ${p.type === 'sales_menu' ? `
                                    <div style="font-size:0.7rem; font-weight:800; color:#94a3b8;">販売想定 / 粗利</div>
                                    <div style="font-weight:900; color:#1e293b; font-size:1.1rem;">
                                        ¥${(p.selling_price || 0).toLocaleString()} <span style="color:#10b981; margin-left:0.3rem;">(¥${Math.round(stats.profit).toLocaleString()})</span>
                                    </div>
                                ` : `
                                    <div style="font-size:0.7rem; font-weight:800; color:#94a3b8;">仕込単価原価</div>
                                    <div style="font-weight:900; color:#1e293b; font-size:1.1rem;">¥${stats.unitCost.toFixed(2)} / ${p.unit || '単位'}</div>
                                `}
                            </div>
                            <button class="btn-icon copy-btn" data-id="${p.id}" style="color:#64748b; padding:0.5rem;" onclick="event.stopPropagation(); window.prototypeMenu.copyPrototype('${p.id}')">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.getElementById('btn-proto-new').onclick = () => {
        editingPrototype = null;
        activeMobileTab = 'info';
        currentView = 'form';
        renderView();
    };
}

function renderFormView(container) {
    const isEdit = !!editingPrototype;
    const isOwner = !isEdit || editingPrototype.created_by === currentUser?.uid || editingPrototype.created_by === currentUser?.id;

    container.innerHTML = `
        <div class="animate-fade-in" style="padding: 1.5rem; padding-bottom: 5rem; position:relative;">
            <!-- Sticky Summary Bar -->
            <div class="proto-sticky-summary">
                <div class="proto-summary-item">
                    <span class="proto-summary-label">総原価</span>
                    <span id="summary-total-cost" class="proto-summary-value">¥0</span>
                </div>
                <div class="proto-summary-item">
                    <span class="proto-summary-label">原価率</span>
                    <span id="summary-cost-ratio" class="proto-summary-value">0%</span>
                </div>
                <div class="proto-summary-item">
                    <span class="proto-summary-label">想定粗利</span>
                    <span id="summary-profit" class="proto-summary-value proto-profit-highlight">¥0</span>
                </div>
            </div>

            <!-- Mobile Tabs Toggle (Visible only on <= 1024px) -->
            <div class="proto-mobile-tabs">
                <div class="tabs-inner">
                    <button class="proto-tab-btn ${activeMobileTab === 'info' ? 'active' : ''}" data-tab="info">基本情報</button>
                    <button class="proto-tab-btn ${activeMobileTab === 'recipe' ? 'active' : ''}" data-tab="recipe">レシピ構成</button>
                    <button class="proto-tab-btn ${activeMobileTab === 'notes' ? 'active' : ''}" data-tab="notes">工程・メモ</button>
                </div>
            </div>

            <!-- Header Row -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <button id="btn-proto-back" class="btn" style="background:white; border:1px solid #e2e8f0; color:#64748b; font-weight:700;">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
                <div style="text-align:right;">
                    <span class="badge ${isOwner ? 'badge-active' : 'badge-pending'}" style="margin-bottom:0.2rem;">
                        ${isOwner ? (isEdit ? '自身の試作を編集' : '新規ドラフト') : '他人の試作をシミュレーション中'}
                    </span>
                    <div style="font-size:0.75rem; color:#64748b; font-weight:700;">開発者: ${isEdit ? editingPrototype.developer : (currentUser?.Name || '自分')}</div>
                </div>
            </div>

            <!-- Section 1: Basic Info -->
            <div id="proto-section-info" class="proto-section ${activeMobileTab === 'info' ? 'active' : ''}">
                <div style="background:white; border-radius:16px; border:1px solid #e2e8f0; padding:1.5rem; margin-bottom:1.5rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div class="proto-form-card" style="display:flex; gap:1.2rem; align-items:start;">
                        <div class="proto-img-container" style="position:relative;">
                            <img id="proto-img-preview" src="${isEdit && editingPrototype.image_url ? editingPrototype.image_url : 'https://via.placeholder.com/150'}" style="width:100px; height:100px; border-radius:12px; object-fit:cover; border:2px solid #f1f5f9;">
                            ${isOwner ? `
                                <label for="proto-file-input" style="position:absolute; bottom:-5px; right:-5px; width:32px; height:32px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                                    <i class="fas fa-camera" style="font-size:0.8rem;"></i>
                                    <input type="file" id="proto-file-input" accept="image/*" style="display:none;">
                                </label>
                            ` : ''}
                        </div>
                        <div class="proto-basic-info-grid" style="flex:1; display:grid; grid-template-columns:1fr 1.3fr; gap:1.2rem;">
                            <!-- Column 1 -->
                            <div style="display:flex; flex-direction:column; gap:1rem;">
                                <div class="input-group compact-input">
                                    <label>ふりがな</label>
                                    <input type="text" id="proto-furigana" class="recipe-pro-input" value="${isEdit ? (editingPrototype.furigana || '') : ''}" ${!isOwner ? 'readonly' : ''}>
                                </div>
                                <div class="input-group compact-input">
                                    <label>名称 <span style="color:var(--danger)">*</span></label>
                                    <input type="text" id="proto-name" class="recipe-pro-input" value="${isEdit ? editingPrototype.name : ''}" ${!isOwner ? 'readonly' : ''}>
                                </div>
                            </div>
                            <!-- Column 2 -->
                            <div style="display:flex; flex-direction:column; gap:1rem;">
                                <div class="proto-major-portion-row" style="display:flex; align-items:flex-end; gap:0.5rem;">
                                    <div class="input-group compact-input" style="flex:0.6;">
                                        <label>大分類 <span style="color:var(--danger)">*</span></label>
                                        <select id="proto-major-category" class="recipe-pro-input" style="padding:0.7rem;" ${!isOwner ? 'disabled' : ''}>
                                            <option value="">選択...</option>
                                            <option value="フード" ${isEdit && editingPrototype.major_category === 'フード' ? 'selected' : ''}>フード</option>
                                            <option value="ドリンク" ${isEdit && editingPrototype.major_category === 'ドリンク' ? 'selected' : ''}>ドリンク</option>
                                        </select>
                                    </div>
                                    <div class="input-group compact-input" style="flex:1;">
                                        <label>ポーション量 / 販売単位</label>
                                        <div style="display:flex; align-items:center; gap:0.4rem;">
                                            <input type="number" id="proto-portion" class="recipe-pro-input" style="padding:0.7rem;" value="${isEdit ? (editingPrototype.portion_amount || '') : ''}" ${!isOwner ? 'readonly' : ''} inputmode="decimal">
                                            <span id="proto-unit-display" style="font-weight:900; color:#64748b; font-size:1.1rem; min-width:30px;">
                                                ${isEdit ? (editingPrototype.unit || '') : ''}
                                            </span>
                                            <input type="hidden" id="proto-unit" value="${isEdit ? (editingPrototype.unit || '') : ''}">
                                        </div>
                                    </div>
                                </div>
                                <div class="input-group compact-input">
                                    <label>カテゴリー</label>
                                    <input type="text" id="proto-category" class="recipe-pro-input" value="${isEdit ? (editingPrototype.category || '') : ''}" ${!isOwner ? 'readonly' : ''}>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="proto-basic-info-grid" style="margin-top:1.5rem; padding-top:1.5rem; border-top:1px dashed #e2e8f0; display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
                        <div class="input-group compact-input">
                            <label style="color:var(--primary); font-weight:900;">販売想定価格 (自由入力)</label>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span style="font-weight:900; color:#94a3b8;">¥</span>
                                <input type="number" id="proto-selling-price" class="recipe-pro-input" style="font-size:1.5rem; font-weight:900; color:var(--primary); border-color:var(--primary)44;" value="${isEdit ? (editingPrototype.selling_price || 0) : 0}" inputmode="decimal">
                            </div>
                        </div>
                        <div class="input-group compact-input">
                            <label>仕上がり出来高 (自家製時のみ使用)</label>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <input type="number" id="proto-yield" class="recipe-pro-input" value="${isEdit ? (editingPrototype.yield_amount || 1) : 1}" ${!isOwner ? 'readonly' : ''} inputmode="decimal">
                                <input type="text" id="proto-yield-unit" class="recipe-pro-input" style="width:80px;" placeholder="g/ml" value="${isEdit ? (editingPrototype.yield_unit || '') : ''}" ${!isOwner ? 'readonly' : ''}>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section 2: Recipe Materials -->
            <div id="proto-section-recipe" class="proto-section ${activeMobileTab === 'recipe' ? 'active' : ''}">
                <div style="background:white; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:1.5rem; overflow:visible; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="padding:1rem 1.5rem; background:#f8fafc; border-bottom:1px solid #e2e8f0; border-radius:16px 16px 0 0; display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="margin:0; font-weight:800; color:#334155;"><i class="fas fa-layer-group"></i> レシピ構成</h4>
                        ${!isOwner ? '<span style="font-size:0.7rem; color:#ef4444; font-weight:800;"><i class="fas fa-lock"></i> 編集不可</span>' : ''}
                    </div>
                    <div style="padding:1.5rem;">
                        ${isOwner ? `
                            <div style="position:relative; margin-bottom:1.5rem;">
                                <i class="fas fa-search" style="position:absolute; left:1rem; top:50%; transform:translateY(-50%); color:#94a3b8;"></i>
                                <input type="text" id="recipe-search-input" class="recipe-pro-input" style="padding-left:2.8rem;" placeholder="マスタまたは試作品を検索...">
                                <div id="search-results-list" class="incremental-search-results" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:2000; background:white; border:1px solid #e2e8f0; border-radius:0 0 12px 12px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); max-height:300px; overflow-y:auto;"></div>
                            </div>
                        ` : ''}
                        <div id="recipe-items-container"></div>
                    </div>
                </div>
            </div>

            <!-- Section 3: Notes -->
            <div id="proto-section-notes" class="proto-section ${activeMobileTab === 'notes' ? 'active' : ''}">
                <div style="background:white; border-radius:16px; border:1px solid #e2e8f0; padding:1.5rem; margin-bottom:1.5rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                    <label style="display:block; font-size:0.85rem; font-weight:800; margin-bottom:0.5rem; color:#334155;">工程・盛り付け・試作メモ</label>
                    <textarea id="proto-instructions" class="recipe-pro-input" style="height:220px; resize:none;" placeholder="コツ、懸念点など..." ${!isOwner ? 'readonly' : ''}>${isEdit ? (editingPrototype.instructions || '') : ''}</textarea>
                </div>
            </div>

            <!-- Permanent Actions (Visible on all tabs or placed at bottom) -->
            <div style="margin-top:2rem; display:flex; gap:1rem;">
                ${isOwner ? `
                    <button id="btn-save-as-menu" class="btn" style="flex:1; height:54px; background:linear-gradient(135deg, #4f46e5, #6366f1); color:white; font-weight:900; border:none; border-radius:12px; box-shadow:0 4px 12px rgba(79, 70, 229, 0.3);">
                        メニューの試作品として保存
                    </button>
                    <button id="btn-save-as-homemade" class="btn" style="flex:1; height:54px; background:linear-gradient(135deg, #10b981, #34d399); color:white; font-weight:900; border:none; border-radius:12px; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3);">
                        自家製原材料の試作品として保存
                    </button>
                ` : `
                    <button id="btn-copy-to-me" class="btn btn-primary" style="flex:1; height:54px; font-weight:900; border-radius:12px;">
                        <i class="fas fa-copy"></i> 自身の試作としてコピー
                    </button>
                `}
            </div>
            
            ${isEdit && isOwner ? `
                <button id="btn-proto-delete" class="btn" style="width:100%; margin-top:1.5rem; background:transparent; color:#ef4444; border:none; font-weight:800;">
                    <i class="fas fa-trash-alt"></i> この試作品を破棄する
                </button>
            ` : ''}
        </div>
    `;

    // Events Setup
    const recipe = isEdit ? (editingPrototype.recipe || []) : [];
    renderRecipeRows(recipe, isOwner);
    updateSummary(recipe);

    document.getElementById('btn-proto-back').onclick = () => { currentView = 'list'; renderView(); };

    if (isOwner) {
        setupFormEvents(recipe);
        document.getElementById('btn-save-as-menu').onclick = () => savePrototype(recipe, 'sales_menu');
        document.getElementById('btn-save-as-homemade').onclick = () => savePrototype(recipe, 'homemade');
        if (document.getElementById('btn-proto-delete')) {
            document.getElementById('btn-proto-delete').onclick = () => deletePrototype();
        }
    } else {
        document.getElementById('btn-copy-to-me').onclick = () => copyPrototype(editingPrototype.id);
    }

    // Sync units
    const majorCat = document.getElementById('proto-major-category');
    const unitInput = document.getElementById('proto-unit');
    const unitDisplay = document.getElementById('proto-unit-display');
    const yieldUnitInput = document.getElementById('proto-yield-unit');
    if (majorCat && isOwner) {
        majorCat.onchange = () => {
            if (majorCat.value === 'フード') {
                unitInput.value = 'g';
                unitDisplay.textContent = 'g';
                if (!yieldUnitInput.value) yieldUnitInput.value = 'g';
            } else {
                unitInput.value = 'ml';
                unitDisplay.textContent = 'ml';
                if (!yieldUnitInput.value) yieldUnitInput.value = 'ml';
            }
        };
    }

    // Reactivity
    document.getElementById('proto-selling-price').addEventListener('input', () => updateSummary(recipe));
    document.getElementById('proto-yield').addEventListener('input', () => updateSummary(recipe));

    // Tab Logic
    const tabBtns = container.querySelectorAll('.proto-tab-btn');
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            const tab = btn.dataset.tab;
            activeMobileTab = tab;
            tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
            container.querySelectorAll('.proto-section').forEach(sec => {
                sec.classList.toggle('active', sec.id === `proto-section-${tab}`);
            });
            window.scrollTo({ top: 0, behavior: 'instant' });
        };
    });
}

function renderRecipeRows(recipe, isOwner) {
    const container = document.getElementById('recipe-items-container');
    if (!container) return;

    if (recipe.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:#94a3b8; font-size:0.85rem;">レシピが空です</div>`;
        return;
    }

    container.innerHTML = recipe.map((row, idx) => {
        const item = cachedItems.find(i => i.id === row.ingredient_id) || cachedPrototypes.find(p => p.id === row.ingredient_id);
        const unitPrice = getRecursivePrice(row.ingredient_id);
        const rowCost = unitPrice * (row.quantity || 0);

        return `
            <div style="display:flex; align-items:center; gap:0.5rem; padding:0.8rem 0; border-bottom:1px solid #f1f5f9;">
                <div style="flex:1;">
                    <div style="font-weight:800; font-size:0.9rem;">${item?.name || '不明'}</div>
                    <div style="font-size:0.7rem; color:#94a3b8;">¥${unitPrice.toFixed(2)} / ${item?.unit || '単位'}</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.2rem; width:100px;">
                    <input type="number" step="any" class="recipe-pro-input recipe-qty-input" data-index="${idx}" value="${row.quantity}" ${!isOwner ? 'readonly' : ''} style="text-align:right;" inputmode="decimal">
                    <span style="font-size:0.7rem; color:#64748b;">${item?.unit || ''}</span>
                </div>
                <div style="width:70px; text-align:right; font-weight:900;">¥${Math.round(rowCost).toLocaleString()}</div>
                ${isOwner ? `<button class="remove-row-btn" data-index="${idx}" style="color:#ef4444; border:none; background:none;"><i class="fas fa-times"></i></button>` : ''}
            </div>
        `;
    }).join('');

    container.querySelectorAll('.recipe-qty-input').forEach(el => {
        el.oninput = (e) => {
            const idx = e.target.dataset.index;
            recipe[idx].quantity = parseFloat(e.target.value) || 0;
            updateSummary(recipe);
            // Re-render specifically for row costs
            const unitPrice = getRecursivePrice(recipe[idx].ingredient_id);
            e.target.closest('div').nextElementSibling.textContent = `¥${Math.round(unitPrice * recipe[idx].quantity).toLocaleString()}`;
        };
    });

    container.querySelectorAll('.remove-row-btn').forEach(btn => {
        btn.onclick = () => {
            recipe.splice(btn.dataset.index, 1);
            renderRecipeRows(recipe, isOwner);
            updateSummary(recipe);
        };
    });
}

function getRecursivePrice(itemId, visiting = new Set()) {
    if (visiting.has(itemId)) return 0;
    visiting.add(itemId);
    
    // Check m_items
    const itm = cachedItems.find(i => i.id === itemId);
    if (itm) return getEffectivePrice(itemId, { items: cachedItems, ingredients: cachedIngredients, menus: cachedMenus });

    // Check prototypes
    const proto = cachedPrototypes.find(p => p.id === itemId);
    if (proto) {
        let total = 0;
        (proto.recipe || []).forEach(r => {
            total += getRecursivePrice(r.ingredient_id, visiting) * (r.quantity || 0);
        });
        const yieldAmt = Number(proto.yield_amount) || 1;
        return yieldAmt > 0 ? (total / yieldAmt) : 0;
    }
    return 0;
}

function updateSummary(recipe) {
    let total = 0;
    recipe.forEach(r => total += getRecursivePrice(r.ingredient_id) * (r.quantity || 0));

    const sell = parseFloat(document.getElementById('proto-selling-price')?.value) || 0;
    const profit = sell - total;
    const ratio = sell > 0 ? (total / sell) * 100 : 0;

    const costEl = document.getElementById('summary-total-cost');
    const ratioEl = document.getElementById('summary-cost-ratio');
    const profitEl = document.getElementById('summary-profit');

    if (costEl) costEl.textContent = `¥${Math.round(total).toLocaleString()}`;
    if (ratioEl) ratioEl.textContent = `${ratio.toFixed(1)}%`;
    if (profitEl) {
        profitEl.textContent = `¥${Math.round(profit).toLocaleString()}`;
        profitEl.className = `proto-summary-value ${profit >= 0 ? 'proto-profit-highlight' : 'text-danger'}`;
    }
}

function calculatePrototypeStats(p) {
    let total = 0;
    (p.recipe || []).forEach(r => total += getRecursivePrice(r.ingredient_id) * (r.quantity || 0));
    const yieldAmt = Number(p.yield_amount) || 1;
    return {
        unitCost: yieldAmt > 0 ? total / yieldAmt : total,
        profit: (p.selling_price || 0) - total
    };
}

function setupFormEvents(recipe) {
    const searchInput = document.getElementById('recipe-search-input');
    const results = document.getElementById('search-results-list');
    let selectedIndex = -1;
    let items = [];

    searchInput.addEventListener('input', () => {
        const queryStr = searchInput.value.trim().toLowerCase();
        if (!queryStr) { results.style.display = 'none'; return; }

        const combined = [
            ...cachedItems.map(i => ({...i, source: 'real'})),
            ...cachedPrototypes.filter(p => p.type === 'homemade').map(p => ({...p, source: 'proto'}))
        ];

        items = combined.filter(i => (i.name || '').toLowerCase().includes(queryStr) || (i.furigana || '').toLowerCase().includes(queryStr)).slice(0, 10);
        renderResults();
    });

    function renderResults() {
        if (items.length === 0) { results.style.display = 'none'; return; }
        results.style.display = 'block';
        results.innerHTML = items.map((i, idx) => `
            <div class="search-result-item ${idx === selectedIndex ? 'selected' : ''}" style="padding:0.8rem; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; justify-content:space-between;">
                <div>
                    <div style="font-size:0.6rem; color:#94a3b8;">${i.furigana || ''}</div>
                    <div style="font-weight:800; font-size:0.9rem;">
                        <i class="fas ${i.source === 'real' ? 'fa-box' : 'fa-flask'}" style="color:${i.source === 'real' ? '#64748b' : '#10b981'}; margin-right:0.3rem;"></i>
                        ${i.name}
                    </div>
                </div>
                <div style="text-align:right; font-size:0.75rem; font-weight:800; color:var(--primary);">¥${getRecursivePrice(i.id).toFixed(1)} / ${i.unit || '個'}</div>
            </div>
        `).join('');

        results.querySelectorAll('div[data-index]').forEach((el, idx) => {
            el.onclick = () => selectItem(items[idx]);
        });
        // Fixing the click event by adding indexes directly or use standard loop
        const rows = results.children;
        for(let i=0; i<rows.length; i++) {
            rows[i].onclick = () => selectItem(items[i]);
        }
    }

    function selectItem(item) {
        if (!recipe.some(r => r.ingredient_id === item.id)) {
            recipe.push({ ingredient_id: item.id, quantity: 1 });
            renderRecipeRows(recipe, true);
            updateSummary(recipe);
        }
        searchInput.value = '';
        results.style.display = 'none';
    }

    searchInput.addEventListener('keydown', (e) => {
        if (results.style.display === 'none') return;
        if (e.key === 'ArrowDown') { selectedIndex = Math.min(selectedIndex + 1, items.length - 1); renderResults(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { selectedIndex = Math.max(selectedIndex - 1, 0); renderResults(); e.preventDefault(); }
        else if (e.key === 'Enter') { if (selectedIndex >= 0) selectItem(items[selectedIndex]); e.preventDefault(); }
    });

    document.getElementById('proto-file-input').onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const dataUrl = await resizeImage(file, 600);
                document.getElementById('proto-img-preview').src = dataUrl;
            } catch (err) { showAlert("エラー", "読み込み失敗"); }
        }
    };
}

async function savePrototype(recipe, type) {
    const name = document.getElementById('proto-name').value.trim();
    if (!name) return showAlert("入力不備", "名称をいれてください");

    const data = {
        name,
        furigana: document.getElementById('proto-furigana').value.trim(),
        major_category: document.getElementById('proto-major-category').value,
        category: document.getElementById('proto-category').value.trim(),
        portion_amount: parseFloat(document.getElementById('proto-portion').value) || 0,
        unit: document.getElementById('proto-unit').value.trim(),
        selling_price: parseFloat(document.getElementById('proto-selling-price').value) || 0,
        yield_amount: parseFloat(document.getElementById('proto-yield').value) || 1,
        yield_unit: document.getElementById('proto-yield-unit').value.trim(),
        instructions: document.getElementById('proto-instructions').value.trim(),
        type: type,
        recipe: recipe,
        image_url: document.getElementById('proto-img-preview').src.startsWith('data:') ? document.getElementById('proto-img-preview').src : (editingPrototype?.image_url || ''),
        updated_at: serverTimestamp()
    };

    try {
        if (editingPrototype) await updateDoc(doc(db, "t_prototype_recipes", editingPrototype.id), data);
        else {
            data.created_at = serverTimestamp();
            data.created_by = currentUser?.uid || currentUser?.id;
            data.developer = currentUser?.Name || '自分';
            await addDoc(collection(db, "t_prototype_recipes"), data);
        }
        showAlert("成功", "保存しました");
        await reloadData();
        currentView = 'list';
        renderView();
    } catch (err) { showAlert("エラー", "保存失敗: " + err.message); }
}

async function deletePrototype() {
    showConfirm("削除", "完全に消しますか？", async () => {
        try {
            await deleteDoc(doc(db, "t_prototype_recipes", editingPrototype.id));
            showAlert("消しました");
            await reloadData();
            currentView = 'list';
            renderView();
        } catch(e) { showAlert("失敗"); }
    });
}

function resizeImage(file, maxWidth) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function copyPrototype(id) {
    const t = cachedPrototypes.find(p => p.id === id);
    if (!t) return;
    showConfirm("コピー", "自分用としてコピーしますか？", async () => {
        try {
            const data = { ...t, name: `${t.name} (コピー)`, created_at: serverTimestamp(), updated_at: serverTimestamp(), created_by: currentUser?.uid || currentUser?.id, developer: currentUser?.Name || '自分' };
            delete data.id;
            const res = await addDoc(collection(db, "t_prototype_recipes"), data);
            await reloadData();
            editingPrototype = {id: res.id, ...data};
            currentView = 'form';
            renderView();
            showAlert("コピー完了");
        } catch(e) { showAlert("失敗"); }
    });
}

window.prototypeMenu = {
    openEdit: (id) => { editingPrototype = cachedPrototypes.find(p => p.id === id); currentView = 'form'; renderView(); },
    copyPrototype
};
