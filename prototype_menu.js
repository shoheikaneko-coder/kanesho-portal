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

export const prototypeMenuPageHtml = `
    <div id="prototype-menu-container" class="animate-fade-in">
        <!-- Content injected here -->
    </div>
    <style>
        .prototype-floating-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-top: 1.5px solid #e2e8f0;
            padding: 1rem 1.5rem;
            z-index: 1000;
            display: flex;
            justify-content: space-around;
            box-shadow: 0 -10px 25px -5px rgba(0,0,0,0.1);
        }
        .proto-summary-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .proto-summary-label {
            font-size: 0.7rem;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .proto-summary-value {
            font-size: 1.2rem;
            font-weight: 900;
            color: #1e293b;
            font-family: 'Outfit', sans-serif;
        }
        .proto-profit-highlight {
            color: #10b981;
        }
        .prototype-card {
            background: white;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            padding: 1rem;
            margin-bottom: 1rem;
            transition: all 0.2s;
            cursor: pointer;
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        .prototype-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
            border-color: var(--primary);
        }
        .proto-thumb {
            width: 60px;
            height: 60px;
            border-radius: 12px;
            object-fit: cover;
            background: #f1f5f9;
        }
        .badge-proto-menu { background: #e0f2fe; color: #0369a1; }
        .badge-proto-homemade { background: #f0fdf4; color: #16a34a; }
        
        .sticky-summary {
            position: sticky;
            top: 0;
            z-index: 100;
            background: white;
            padding: 1rem;
            border-bottom: 1.5px solid #e2e8f0;
            margin: -1.5rem -1.5rem 1.5rem -1.5rem;
        }

        /* products.js から一部スタイルを継承 */
        .recipe-pro-input {
            width: 100%;
            padding: 0.8rem;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            font-size: 0.95rem;
            font-weight: 600;
            outline: none;
            transition: all 0.2s;
        }
        .recipe-pro-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        .recipe-pro-input:read-only {
            background-color: #f8fafc;
            color: #64748b;
            cursor: default;
        }

        .search-result-item.selected {
            background-color: #f0f9ff;
            border-left: 4px solid #0ea5e9;
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
        currentView = 'form';
        renderView();
    };
}

function renderFormView(container) {
    const isEdit = !!editingPrototype;
    const isOwner = !isEdit || editingPrototype.created_by === currentUser?.uid || editingPrototype.created_by === currentUser?.id;
    const primaryColor = '#4f46e5';

    container.innerHTML = `
        <div class="animate-fade-in" style="padding: 1.5rem; padding-bottom: 8rem;">
            <!-- Header -->
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

            <!-- Basic Info Card -->
            <div style="background:white; border-radius:16px; border:1px solid #e2e8f0; padding:1.5rem; margin-bottom:1.5rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                <div style="display:flex; gap:1.2rem; align-items:start;">
                    <div style="position:relative;">
                        <img id="proto-img-preview" src="${isEdit && editingPrototype.image_url ? editingPrototype.image_url : 'https://via.placeholder.com/150'}" style="width:100px; height:100px; border-radius:12px; object-fit:cover; border:2px solid #f1f5f9;">
                        ${isOwner ? `
                            <label for="proto-file-input" style="position:absolute; bottom:-5px; right:-5px; width:32px; height:32px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                                <i class="fas fa-camera" style="font-size:0.8rem;"></i>
                                <input type="file" id="proto-file-input" accept="image/*" style="display:none;">
                            </label>
                        ` : ''}
                    </div>
                    <div style="flex:1; display:grid; grid-template-columns:1fr 1.3fr; gap:1.2rem;">
                        <!-- Left Column: Furigana & Name (Stacked) -->
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

                        <!-- Right Column: Major Category & Portion Amount (Row 1), Category (Row 2) -->
                        <div style="display:flex; flex-direction:column; gap:1rem;">
                            <div style="display:flex; align-items:flex-end; gap:0.5rem;">
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
                                        <span id="proto-unit-display" style="font-weight:900; color:#64748b; font-size:1.1rem; min-width:30px; line-height:1; display:flex; align-items:center;">
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
                
                <div style="margin-top:1.5rem; padding-top:1.5rem; border-top:1px dashed #e2e8f0; display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
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

            <!-- Recipe Section -->
            <div style="background:white; border-radius:16px; border:1px solid #e2e8f0; overflow:hidden;">
                <div style="padding:1rem 1.5rem; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="margin:0; font-weight:800; color:#334155;"><i class="fas fa-layer-group"></i> レシピ構成</h4>
                    ${!isOwner ? '<span style="font-size:0.7rem; color:#ef4444; font-weight:800;"><i class="fas fa-lock"></i> 編集ロック中</span>' : ''}
                </div>
                
                <div style="padding:1.5rem;">
                    ${isOwner ? `
                        <div style="position:relative; margin-bottom:1.5rem;">
                            <i class="fas fa-search" style="position:absolute; left:1rem; top:50%; transform:translateY(-50%); color:#94a3b8;"></i>
                            <input type="text" id="recipe-search-input" class="recipe-pro-input" style="padding-left:2.8rem;" placeholder="本番マスタまたは試作品を検索...">
                            <div id="search-results-list" class="incremental-search-results" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:2000; background:white; border:1px solid #e2e8f0; border-radius:0 0 12px 12px; box-shadow:0 10px 15px -3px rgba(0, 0, 0, 0.1); max-height:300px; overflow-y:auto;"></div>
                        </div>
                    ` : ''}

                    <div id="recipe-items-container">
                        <!-- Rows injected here -->
                    </div>
                </div>
            </div>

            <!-- Notes -->
            <div style="margin-top:1.5rem;">
                <label style="display:block; font-size:0.85rem; font-weight:800; margin-bottom:0.5rem; color:#334155;">工程・盛り付け・試作メモ</label>
                <textarea id="proto-instructions" class="recipe-pro-input" style="height:120px; resize:none;" placeholder="コツ、懸念点、競合店での気づきなど..." ${!isOwner ? 'readonly' : ''}>${isEdit ? (editingPrototype.instructions || '') : ''}</textarea>
            </div>

            <!-- Actions -->
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
                        <i class="fas fa-copy"></i> 自身の試作としてコピーして編集
                    </button>
                `}
            </div>
            
            ${isEdit && isOwner ? `
                <button id="btn-proto-delete" class="btn" style="width:100%; margin-top:2rem; background:white; color:#ef4444; border:1.5px solid #fee2e2; font-weight:800; padding:0.8rem;">
                    <i class="fas fa-trash-alt"></i> この試作品を破棄する
                </button>
            ` : ''}
        </div>

        <!-- Floating Summary Bar -->
        <div class="prototype-floating-bar">
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
    `;

    // Events
    document.getElementById('btn-proto-back').onclick = () => { currentView = 'list'; renderView(); };
    
    const recipe = isEdit ? (editingPrototype.recipe || []) : [];
    renderRecipeRows(recipe, isOwner);

    if (isOwner) {
        setupFormEvents(recipe);
        document.getElementById('btn-save-as-menu').onclick = () => savePrototype(recipe, 'sales_menu');
        document.getElementById('btn-save-as-homemade').onclick = () => savePrototype(recipe, 'homemade');
    } else {
        document.getElementById('btn-copy-to-me').onclick = () => copyPrototype(editingPrototype.id);
    }

    if (document.getElementById('btn-proto-delete')) {
        document.getElementById('btn-proto-delete').onclick = () => deletePrototype();
    }

    // Major Category Unit Sync
    const majorCat = document.getElementById('proto-major-category');
    const unitInput = document.getElementById('proto-unit');
    const unitDisplay = document.getElementById('proto-unit-display');
    const yieldUnitInput = document.getElementById('proto-yield-unit');
    if (majorCat && isOwner) {
        majorCat.onchange = () => {
            if (majorCat.value === 'フード') {
                unitInput.value = 'g';
                unitDisplay.textContent = 'g';
                // Note: yield unit is free-text, so we don't force it, but can provide a hint
                if (!yieldUnitInput.value) yieldUnitInput.value = 'g';
            } else if (majorCat.value === 'ドリンク') {
                unitInput.value = 'ml';
                unitDisplay.textContent = 'ml';
                if (!yieldUnitInput.value) yieldUnitInput.value = 'ml';
            }
        };
    }

    // Sell Price Change (Anyone can do)
    document.getElementById('proto-selling-price').addEventListener('input', () => updateSummary(recipe));
    document.getElementById('proto-yield').addEventListener('input', () => updateSummary(recipe));
    
    // Initial Calc
    updateSummary(recipe);
}

function renderRecipeRows(recipe, isOwner) {
    const container = document.getElementById('recipe-items-container');
    if (!container) return;

    if (recipe.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:#94a3b8; font-size:0.85rem;">材料が登録されていません。上の検索バーから追加してください。</div>`;
        return;
    }

    container.innerHTML = recipe.map((row, idx) => {
        // Look up from items OR prototypes
        const item = cachedItems.find(i => i.id === row.ingredient_id) || cachedPrototypes.find(p => p.id === row.ingredient_id);
        const unitPrice = getRecursivePrice(row.ingredient_id);
        const rowCost = unitPrice * (row.quantity || 0);

        return `
            <div style="display:flex; align-items:center; gap:0.5rem; padding:0.8rem 0; border-bottom:1px solid #f1f5f9;">
                <div style="flex:1;">
                    <div style="font-weight:800; font-size:0.9rem; color:#1e293b;">${item?.name || '不明な食材'}</div>
                    <div style="font-size:0.75rem; color:#94a3b8; font-weight:700;">
                        単価: ¥${unitPrice.toFixed(2)} / ${item?.unit || '単位'}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.3rem; width:120px;">
                    <input type="number" step="any" class="recipe-pro-input recipe-qty-input" data-index="${idx}" value="${row.quantity || 0}" ${!isOwner ? 'readonly' : ''} style="text-align:right; font-weight:800;" inputmode="decimal">
                    <span style="font-size:0.75rem; font-weight:800; color:#64748b; width:30px;">${item?.unit || '個'}</span>
                </div>
                <div style="width:70px; text-align:right; font-weight:900; color:#475569; font-family:'Outfit';">
                    ¥${Math.round(rowCost).toLocaleString()}
                </div>
                ${isOwner ? `
                    <button class="btn-icon remove-row-btn" data-index="${idx}" style="color:#ef4444; padding:0.4rem;">
                        <i class="fas fa-times-circle"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');

    // Attach row events
    container.querySelectorAll('.recipe-qty-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.dataset.index;
            recipe[idx].quantity = parseFloat(e.target.value) || 0;
            updateSummary(recipe);
            // Partial rerender for row cost
            const unitPrice = getRecursivePrice(recipe[idx].ingredient_id);
            const rowCost = unitPrice * recipe[idx].quantity;
            e.target.closest('div').nextElementSibling.textContent = `¥${Math.round(rowCost).toLocaleString()}`;
        });
    });

    container.querySelectorAll('.remove-row-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = btn.dataset.index;
            recipe.splice(idx, 1);
            renderRecipeRows(recipe, isOwner);
            updateSummary(recipe);
        };
    });
}

function getRecursivePrice(itemId, visiting = new Set()) {
    if (visiting.has(itemId)) return 0;
    visiting.add(itemId);

    // 1. まずは本番マスタから価格を取得 (cost_engineのロジックを模倣または流用)
    // 実装の簡略化のため、自前で計算
    const cache = { items: cachedItems, ingredients: cachedIngredients, menus: cachedMenus };
    
    // 本番マスタに存在する場合
    if (cachedItems.find(i => i.id === itemId)) {
        return getEffectivePrice(itemId, cache);
    }

    // 2. 試作品マスタに存在する場合
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
    let totalCost = 0;
    recipe.forEach(r => {
        totalCost += getRecursivePrice(r.ingredient_id) * (r.quantity || 0);
    });

    const sellPrice = parseFloat(document.getElementById('proto-selling-price')?.value) || 0;
    const yieldAmt = parseFloat(document.getElementById('proto-yield')?.value) || 1;
    
    // 自家製の場合は出来高あたりの単価
    const unitCost = yieldAmt > 0 ? (totalCost / yieldAmt) : 0;
    
    const profit = sellPrice - totalCost;
    const ratio = sellPrice > 0 ? (totalCost / sellPrice) * 100 : 0;

    const costEl = document.getElementById('summary-total-cost');
    const ratioEl = document.getElementById('summary-cost-ratio');
    const profitEl = document.getElementById('summary-profit');

    if (costEl) costEl.textContent = `¥ ${Math.round(totalCost).toLocaleString()}`;
    if (ratioEl) ratioEl.textContent = `${ratio.toFixed(1)}%`;
    if (profitEl) {
        profitEl.textContent = `¥ ${Math.round(profit).toLocaleString()}`;
        profitEl.className = `proto-summary-value ${profit >= 0 ? 'proto-profit-highlight' : 'text-danger'}`;
    }
}

function calculatePrototypeStats(p) {
    let total = 0;
    (p.recipe || []).forEach(r => {
        total += getRecursivePrice(r.ingredient_id) * (r.quantity || 0);
    });
    const yieldAmt = Number(p.yield_amount) || 1;
    return {
        totalCost: total,
        unitCost: yieldAmt > 0 ? (total / yieldAmt) : 0,
        profit: (p.selling_price || 0) - total
    };
}

function setupFormEvents(recipe) {
    // Search
    const searchInput = document.getElementById('recipe-search-input');
    const results = document.getElementById('search-results-list');
    let selectedIndex = -1;
    let filteredResults = [];

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
            results.style.display = 'none';
            return;
        }

        // Search 本番アイテム + 試作品(自家製品)
        const combined = [
            ...cachedItems.map(i => ({...i, source: 'real'})),
            ...cachedPrototypes.filter(p => p.type === 'homemade').map(p => ({...p, source: 'proto'}))
        ];

        filteredResults = combined.filter(item => {
            return (item.name || '').toLowerCase().includes(query) || (item.furigana || '').toLowerCase().includes(query);
        }).slice(0, 10);

        selectedIndex = -1;
        renderSearchResults();
    });

    function renderSearchResults() {
        if (filteredResults.length === 0) {
            results.style.display = 'none';
            return;
        }
        results.style.display = 'block';
        results.innerHTML = filteredResults.map((item, idx) => `
            <div class="search-result-item ${idx === selectedIndex ? 'selected' : ''}" data-index="${idx}" style="padding:0.8rem; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="font-size:0.6rem; color:#94a3b8; font-weight:800;">${item.furigana || ''}</span>
                    <div style="font-weight:800; font-size:0.9rem;">
                        <i class="fas ${item.source === 'real' ? 'fa-box' : 'fa-flask'}" style="color:${item.source === 'real' ? '#64748b' : '#10b981'}; margin-right:0.4rem;"></i>
                        ${item.name}
                    </div>
                </div>
                <div style="text-align:right; font-size:0.75rem; font-weight:800; color:var(--primary);">
                    ¥${getRecursivePrice(item.id).toFixed(1)} / ${item.unit || '個'}
                </div>
            </div>
        `).join('');

        results.querySelectorAll('.search-result-item').forEach(el => {
            el.onclick = () => {
                const idx = el.dataset.index;
                const item = filteredResults[idx];
                if (!recipe.some(r => r.ingredient_id === item.id)) {
                    recipe.push({ ingredient_id: item.id, quantity: 1 });
                    renderRecipeRows(recipe, true);
                    updateSummary(recipe);
                }
                searchInput.value = '';
                results.style.display = 'none';
            };
        });
    }

    searchInput.addEventListener('keydown', (e) => {
        if (results.style.display === 'none') return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, filteredResults.length - 1);
            renderSearchResults();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            renderSearchResults();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0) {
                const item = filteredResults[selectedIndex];
                if (!recipe.some(r => r.ingredient_id === item.id)) {
                    recipe.push({ ingredient_id: item.id, quantity: 1 });
                    renderRecipeRows(recipe, true);
                    updateSummary(recipe);
                }
                searchInput.value = '';
                results.style.display = 'none';
            }
        }
    });

    // Image Upload
    const fileInput = document.getElementById('proto-file-input');
    if (fileInput) {
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const dataUrl = await resizeImage(file, 600);
                    document.getElementById('proto-img-preview').src = dataUrl;
                } catch (err) {
                    showAlert("エラー", "画像の読み込みに失敗しました");
                }
            }
        };
    }
}

async function savePrototype(recipe, type) {
    const name = document.getElementById('proto-name').value.trim();
    if (!name) return showAlert("入力不備", "名称を入力してください");

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
        if (editingPrototype) {
            await updateDoc(doc(db, "t_prototype_recipes", editingPrototype.id), data);
        } else {
            data.created_at = serverTimestamp();
            data.created_by = currentUser?.uid || currentUser?.id || 'unknown';
            data.developer = currentUser?.Name || '不明';
            await addDoc(collection(db, "t_prototype_recipes"), data);
        }
        showAlert("成功", "試作品を保存しました");
        await reloadData();
        currentView = 'list';
        renderView();
    } catch (err) {
        showAlert("エラー", "保存に失敗しました: " + err.message);
    }
}

async function deletePrototype() {
    showConfirm("破棄の確認", `「${editingPrototype.name}」を完全に削除しますか？`, async () => {
        try {
            await deleteDoc(doc(db, "t_prototype_recipes", editingPrototype.id));
            showAlert("成功", "削除しました");
            await reloadData();
            currentView = 'list';
            renderView();
        } catch (err) {
            showAlert("エラー", "削除に失敗しました");
        }
    });
}

async function copyPrototype(id) {
    const target = cachedPrototypes.find(p => p.id === id);
    if (!target) return;

    showConfirm("コピーの作成", `「${target.name}」をコピーして新しい試作を作成しますか？`, async () => {
        try {
            const data = {
                ...target,
                name: `${target.name} (コピー)`,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
                created_by: currentUser?.uid || currentUser?.id || 'unknown',
                developer: currentUser?.Name || '不明',
                parent_id: id
            };
            delete data.id; // Remove old ID

            const newDoc = await addDoc(collection(db, "t_prototype_recipes"), data);
            showAlert("成功", "コピーを作成しました");
            await reloadData();
            editingPrototype = { id: newDoc.id, ...data };
            currentView = 'form';
            renderView();
        } catch (err) {
            showAlert("エラー", "コピーに失敗しました");
        }
    });
}

// Helper: Resize Image
function resizeImage(file, maxWidth) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Global exposure for event handlers in HTML strings
window.prototypeMenu = {
    openEdit: (id) => {
        editingPrototype = cachedPrototypes.find(p => p.id === id);
        currentView = 'form';
        renderView();
    },
    copyPrototype: copyPrototype
};
