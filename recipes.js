import { db } from './firebase.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * Premium Recipe Viewer v2.0
 * Optimized for PC/Tablet with 2-Pane Layout
 */

export const recipesViewerPageHtml = `
    <div class="rv-container animate-fade-in">
        <style>
            :root {
                --rv-sidebar-width: 380px;
                --rv-primary: #e63946;
                --rv-secondary: #10b981;
                --rv-bg: #f8fafc;
                --rv-card-bg: #ffffff;
                --rv-border: #e2e8f0;
                --rv-text-main: #1e293b;
                --rv-text-muted: #64748b;
            }

            .rv-container {
                display: flex;
                height: calc(100vh - 100px);
                margin: -1rem; /* Adjust for parent padding */
                background: var(--rv-bg);
                overflow: hidden;
                font-family: 'Inter', 'Noto Sans JP', sans-serif;
            }

            /* --- Sidebar / Master List --- */
            .rv-sidebar {
                width: var(--rv-sidebar-width);
                background: white;
                border-right: 1px solid var(--rv-border);
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                z-index: 10;
                box-shadow: 4px 0 15px rgba(0,0,0,0.02);
            }

            .rv-sidebar-header {
                padding: 1.5rem;
                border-bottom: 1px solid var(--rv-border);
            }

            .rv-search-wrapper {
                position: relative;
                margin-top: 1rem;
            }

            .rv-search-wrapper i {
                position: absolute;
                left: 1rem;
                top: 50%;
                transform: translateY(-50%);
                color: var(--rv-text-muted);
            }

            .rv-search-input {
                width: 100%;
                padding: 0.8rem 1rem 0.8rem 2.8rem;
                border: 1.5px solid var(--rv-border);
                border-radius: 12px;
                font-size: 0.95rem;
                outline: none;
                transition: all 0.2s;
            }

            .rv-search-input:focus {
                border-color: var(--rv-primary);
                box-shadow: 0 0 0 4px rgba(230, 57, 70, 0.1);
            }

            .rv-tabs {
                display: flex;
                gap: 0.3rem;
                padding: 0.4rem;
                background: #f1f5f9;
                margin: 0 1rem 1rem;
                border-radius: 10px;
            }

            .rv-tab {
                flex: 1;
                padding: 0.5rem 0.2rem;
                border: none;
                background: transparent;
                font-size: 0.7rem;
                font-weight: 800;
                color: var(--rv-text-muted);
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.2s;
                white-space: nowrap;
            }

            .rv-tab.active {
                background: white;
                color: var(--rv-primary);
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            }

            .rv-list {
                flex: 1;
                overflow-y: auto;
                padding: 0.5rem;
            }

            .rv-item-card {
                padding: 1rem;
                margin-bottom: 0.5rem;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid transparent;
                display: flex;
                align-items: center;
                gap: 1rem;
            }

            .rv-item-card:hover {
                background: #f8fafc;
            }

            .rv-item-card.active {
                background: #fef2f2;
                border-color: #fee2e2;
                transform: translateX(4px);
            }

            .rv-item-icon {
                width: 44px;
                height: 44px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                flex-shrink: 0;
            }

            .rv-item-info {
                overflow: hidden;
            }

            .rv-item-name {
                font-weight: 700;
                font-size: 0.95rem;
                color: var(--rv-text-main);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .rv-item-meta {
                font-size: 0.75rem;
                color: var(--rv-text-muted);
                margin-top: 2px;
            }

            /* --- Main Detail Area --- */
            .rv-main {
                flex: 1;
                overflow-y: auto;
                background: var(--rv-bg);
                display: flex;
                flex-direction: column;
                position: relative;
            }

            .rv-detail-placeholder {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: var(--rv-text-muted);
                opacity: 0.5;
            }

            .rv-detail-header {
                padding: 3rem 4rem 2rem;
                background: white;
                border-bottom: 1px solid var(--rv-border);
            }

            .rv-category-badge {
                display: inline-block;
                padding: 0.3rem 0.8rem;
                border-radius: 20px;
                font-size: 0.7rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 1rem;
            }

            .rv-title {
                font-size: 2.5rem;
                font-weight: 900;
                color: var(--rv-text-main);
                margin: 0;
                line-height: 1.1;
            }

            .rv-content-grid {
                display: grid;
                grid-template-columns: 1fr 1.5fr;
                gap: 2rem;
                padding: 3rem 4rem;
            }

            .rv-section-card {
                background: white;
                border-radius: 20px;
                padding: 2rem;
                box-shadow: 0 4px 20px rgba(0,0,0,0.03);
                border: 1px solid var(--rv-border);
            }

            .rv-section-title {
                font-size: 1.1rem;
                font-weight: 800;
                margin-bottom: 1.5rem;
                display: flex;
                align-items: center;
                gap: 0.7rem;
            }

            .rv-ingredient-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .rv-ingredient-item {
                display: flex;
                justify-content: space-between;
                padding: 0.8rem 0;
                border-bottom: 1px dashed var(--rv-border);
            }

            .rv-ingredient-item:last-child {
                border-bottom: none;
            }

            .rv-step-list {
                list-style: none;
                padding: 0;
                margin: 0;
                counter-reset: rv-steps;
            }

            .rv-step-item {
                position: relative;
                padding-left: 3.5rem;
                margin-bottom: 2rem;
                line-height: 1.7;
                color: var(--rv-text-main);
                font-size: 1.05rem;
            }

            .rv-step-item::before {
                counter-increment: rv-steps;
                content: counter(rv-steps);
                position: absolute;
                left: 0;
                top: 0;
                width: 2.5rem;
                height: 2.5rem;
                background: var(--rv-bg);
                color: var(--rv-text-muted);
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                font-weight: 800;
                font-size: 0.9rem;
            }

            /* Responsive Tablet */
            @media (max-width: 1024px) {
                :root { --rv-sidebar-width: 300px; }
                .rv-content-grid { grid-template-columns: 1fr; padding: 2rem; }
                .rv-detail-header { padding: 2rem; }
                .rv-title { font-size: 1.8rem; }
            }
        </style>

        <div class="rv-sidebar">
            <div class="rv-sidebar-header">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-weight:900; color:var(--rv-text-main); letter-spacing:-0.02em;">RECIPE HUB</h3>
                    <span id="rv-count" style="font-size:0.7rem; background:#f1f5f9; padding:2px 8px; border-radius:10px; color:var(--rv-text-muted); font-weight:800;">0 ITEMS</span>
                </div>
                <div class="rv-search-wrapper">
                    <i class="fas fa-search"></i>
                    <input type="text" id="rv-search" class="rv-search-input" placeholder="レシピ名・ふりがな・材料で検索...">
                </div>
            </div>

            <div class="rv-tabs">
                <button class="rv-tab active" data-type="all">すべて</button>
                <button class="rv-tab" data-type="menu">販売メニュー</button>
                <button class="rv-tab" data-type="homemade">自家製原材料</button>
            </div>

            <div id="rv-list" class="rv-list">
                <div style="padding:2rem; text-align:center; color:var(--rv-text-muted); font-size:0.85rem;">
                    <i class="fas fa-spinner fa-spin" style="font-size:1.5rem; margin-bottom:1rem;"></i><br>
                    レシピを読み込み中...
                </div>
            </div>
        </div>

        <div id="rv-main" class="rv-main">
            <div class="rv-detail-placeholder">
                <i class="fas fa-book-open" style="font-size: 4rem; margin-bottom: 2rem;"></i>
                <p style="font-weight: 800; font-size: 1.2rem; color: var(--rv-text-main);">レシピを選択してください</p>
                <p style="font-size: 0.9rem;">左側のリストから閲覧したいレシピをクリックします</p>
            </div>
        </div>
    </div>
`;

let allRecipes = [];
let cachedItems = [];
let currentFilterType = 'all'; // 'all', 'menu', 'homemade'
let currentSearch = '';

export async function initRecipesViewerPage() {
    await fetchRecipes();

    const searchInput = document.getElementById('rv-search');
    const tabs = document.querySelectorAll('.rv-tab');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase();
            renderList();
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilterType = tab.dataset.type;
            renderList();
        });
    });
}

async function fetchRecipes() {
    const listEl = document.getElementById('rv-list');
    if (!listEl) return;

    try {
        const [itemSnap, menuSnap] = await Promise.all([
            getDocs(collection(db, "m_items")),
            getDocs(collection(db, "m_menus"))
        ]);

        cachedItems = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const itemMap = {};
        cachedItems.forEach(i => itemMap[i.id] = i);

        allRecipes = [];
        menuSnap.forEach(d => {
            const data = d.data();
            const item = itemMap[data.item_id];
            if (item) {
                allRecipes.push({
                    id: d.id,
                    item_id: data.item_id,
                    name: item.name,
                    furigana: item.furigana || '',
                    category: item.category || '未分類',
                    is_homemade: !!data.is_sub_recipe,
                    price: data.sales_price || 0,
                    recipe: data.recipe || [],
                    steps: data.instructions || data.steps || [],
                    yield_amount: data.yield_amount || 0,
                    unit: item.unit || '',
                    updated_at: data.updated_at || ''
                });
            }
        });

        // Sort: Homemade first, then alphabetical
        allRecipes.sort((a, b) => {
            if (a.is_homemade !== b.is_homemade) return b.is_homemade - a.is_homemade;
            return a.name.localeCompare(b.name, 'ja');
        });

        renderList();
    } catch (err) {
        console.error("Fetch Recipes Error:", err);
        listEl.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--rv-primary); font-weight:800;">データの取得に失敗しました</div>';
    }
}

function renderList() {
    const listEl = document.getElementById('rv-list');
    const countEl = document.getElementById('rv-count');
    if (!listEl) return;

    const filtered = allRecipes.filter(r => {
        const matchesType = 
            currentFilterType === 'all' || 
            (currentFilterType === 'menu' && !r.is_homemade) || 
            (currentFilterType === 'homemade' && r.is_homemade);
        
        const matchesSearch = 
            r.name.toLowerCase().includes(currentSearch) || 
            r.furigana.toLowerCase().includes(currentSearch) ||
            r.category.toLowerCase().includes(currentSearch);

        return matchesType && matchesSearch;
    });

    countEl.textContent = `${filtered.length} ITEMS`;

    if (filtered.length === 0) {
        listEl.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--rv-text-muted); font-size:0.85rem;">一致するレシピがありません</div>';
        return;
    }

    listEl.innerHTML = filtered.map(r => {
        const hue = r.is_homemade ? 160 : 10;
        const bg = `hsl(${hue}, 70%, 95%)`;
        const fg = `hsl(${hue}, 70%, 40%)`;
        
        return `
            <div class="rv-item-card" data-id="${r.id}">
                <div class="rv-item-icon" style="background: ${bg}; color: ${fg};">
                    <i class="fas ${r.is_homemade ? 'fa-mortar-pestle' : 'fa-utensils'}"></i>
                </div>
                <div class="rv-item-info">
                    <div class="rv-item-name">${r.name}</div>
                    <div class="rv-item-meta">${r.is_homemade ? '自家製原材料' : '販売メニュー'} • ${r.category}</div>
                </div>
            </div>
        `;
    }).join('');

    listEl.querySelectorAll('.rv-item-card').forEach(card => {
        card.onclick = () => {
            listEl.querySelectorAll('.rv-item-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            renderDetail(card.dataset.id);
        };
    });
}

function renderDetail(id) {
    const mainEl = document.getElementById('rv-main');
    const recipe = allRecipes.find(r => r.id === id);
    if (!mainEl || !recipe) return;

    const typeColor = recipe.is_homemade ? 'var(--rv-secondary)' : 'var(--rv-primary)';
    const typeBg = recipe.is_homemade ? '#ecfdf5' : '#fef2f2';

    const itemMap = {};
    cachedItems.forEach(i => itemMap[i.id] = i);

    const steps = Array.isArray(recipe.steps) ? recipe.steps : (recipe.steps ? [recipe.steps] : []);

    mainEl.innerHTML = `
        <div class="animate-fade-in" style="flex:1;">
            <div class="rv-detail-header">
                <span class="rv-category-badge" style="background: ${typeBg}; color: ${typeColor};">
                    <i class="fas ${recipe.is_homemade ? 'fa-mortar-pestle' : 'fa-utensils'}"></i> ${recipe.is_homemade ? 'Homemade Ingredient' : 'Sales Menu'}
                </span>
                <h1 class="rv-title">${recipe.name}</h1>
                <div style="margin-top: 1.5rem; display: flex; gap: 2rem; color: var(--rv-text-muted); font-size: 0.85rem; font-weight: 700;">
                    <span style="display:flex; align-items:center; gap:0.5rem;"><i class="fas fa-tag" style="color:var(--rv-primary);"></i> ${recipe.category}</span>
                    ${recipe.is_homemade ? `<span style="display:flex; align-items:center; gap:0.5rem;"><i class="fas fa-balance-scale" style="color:var(--rv-secondary);"></i> 仕上がり量: ${recipe.yield_amount} ${recipe.unit}</span>` : ''}
                    <span style="display:flex; align-items:center; gap:0.5rem;"><i class="fas fa-history"></i> 更新: ${recipe.updated_at ? new Date(recipe.updated_at).toLocaleDateString('ja-JP') : '-'}</span>
                </div>
            </div>

            <div class="rv-content-grid">
                <div class="rv-section-card">
                    <div class="rv-section-title" style="color: var(--rv-secondary);">
                        <i class="fas fa-shopping-basket"></i> 材料・分量
                    </div>
                    <ul class="rv-ingredient-list">
                        ${recipe.recipe.length > 0 ? recipe.recipe.map(ri => {
                            const master = itemMap[ri.ingredient_id];
                            return `
                                <li class="rv-ingredient-item">
                                    <span style="font-weight: 700; color:var(--rv-text-main);">${master?.name || '不明な食材'}</span>
                                    <span style="font-family: 'JetBrains Mono', 'Roboto Mono', monospace; font-weight: 900; color: var(--rv-primary); font-size:1.1rem;">
                                        ${ri.quantity} <span style="font-size: 0.75rem; color: var(--rv-text-muted);">${master?.unit || ''}</span>
                                    </span>
                                </li>
                            `;
                        }).join('') : '<li style="color:var(--rv-text-muted); font-size:0.85rem; padding:2rem; text-align:center;">材料は登録されていません</li>'}
                    </ul>
                </div>

                <div class="rv-section-card">
                    <div class="rv-section-title" style="color: var(--rv-primary);">
                        <i class="fas fa-list-ol"></i> 調理工程・ポイント
                    </div>
                    <div class="rv-step-list">
                        ${steps.length > 0 ? steps.map(step => `
                            <div class="rv-step-item">${step.replace(/\n/g, '<br>')}</div>
                        `).join('') : '<div style="color:var(--rv-text-muted); font-size:0.85rem; padding:2rem; text-align:center;">工程は登録されていません</div>'}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Auto-scroll to top of detail
    mainEl.scrollTop = 0;
}
