import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const recipesViewerPageHtml = `
    <div class="animate-fade-in" style="max-width: 800px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h3 style="color: var(--text-secondary);">レシピ閲覧</h3>
        </div>
        
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; position: sticky; top: 80px; z-index: 10;">
            <div class="input-group" style="margin-bottom: 0;">
                <i class="fas fa-search" style="top: 0.8rem;"></i>
                <input type="text" id="recipe-search" placeholder="商品名でレシピを検索..." style="padding-top: 0.8rem; padding-bottom: 0.8rem; font-size: 1.1rem; border-radius: 50px; padding-left: 2.5rem;">
            </div>
        </div>

        <div id="recipe-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
            <div style="text-align: center; padding: 2rem; grid-column: 1 / -1; color: var(--text-secondary);">レシピデータを読み込んでいます...</div>
        </div>

        <!-- Recipe Detail Modal -->
        <div id="recipe-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; align-items: flex-end; justify-content: center; padding-top: 4rem;">
            <div class="glass-panel animate-fade-in" style="width: 100%; max-width: 600px; height: 90vh; border-radius: 20px 20px 0 0; padding: 0; position: relative; display: flex; flex-direction: column;">
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.9); border-radius: 20px 20px 0 0;">
                    <h3 id="recipe-modal-title" style="margin: 0; font-size: 1.2rem;">レシピ詳細</h3>
                    <button id="close-recipe-modal" style="background: rgba(0,0,0,0.05); border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; color: var(--text-secondary);"><i class="fas fa-times"></i></button>
                </div>
                
                <div id="recipe-modal-content" style="padding: 1.5rem; overflow-y: auto; flex: 1; background: #fff;">
                    <!-- Content populated by JS -->
                </div>
            </div>
        </div>
    </div>
`;

let allRecipes = [];

export async function initRecipesViewerPage() {
    await fetchRecipes();

    const searchInput = document.getElementById('recipe-search');
    const modal = document.getElementById('recipe-modal');
    const btnClose = document.getElementById('close-recipe-modal');

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderRecipes(e.target.value);
        });
    }

    if(btnClose && modal) {
        btnClose.addEventListener('click', () => modal.style.display = 'none');
        modal.addEventListener('click', (e) => {
            if(e.target === modal) modal.style.display = 'none';
        });
    }
}

async function fetchRecipes() {
    const listEl = document.getElementById('recipe-list');
    if(!listEl) return;

    try {
        const [itemSnap, menuSnap] = await Promise.all([
            getDocs(collection(db, "m_items")),
            getDocs(collection(db, "m_menus"))
        ]);

        const itemMap = {};
        itemSnap.forEach(d => itemMap[d.id] = d.data());

        allRecipes = [];
        menuSnap.forEach(d => {
            const data = d.data();
            const item = itemMap[data.item_id];
            if (item) {
                allRecipes.push({
                    id: d.id,
                    item_id: data.item_id,
                    name: item.name,
                    category: item.category || '未分類',
                    price: data.sales_price || 0,
                    recipe: data.recipe || [],
                    // Stepなどの追加情報が必要なら将来的に m_menus に持たせる
                    steps: data.steps || ['(手順は未登録です)']
                });
            }
        });

        renderRecipes('');
    } catch(err) {
        console.error(err);
        listEl.innerHTML = '<div style="color:var(--danger); grid-column: 1 / -1; text-align: center;">読み込みエラー</div>';
    }
}

function renderRecipes(searchQuery) {
    const listEl = document.getElementById('recipe-list');
    if(!listEl) return;

    const query = searchQuery.toLowerCase();
    const filtered = allRecipes.filter(r => r.name.toLowerCase().includes(query) || r.category.toLowerCase().includes(query));

    if(filtered.length === 0) {
        listEl.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 2rem;">見つかりませんでした</div>';
        return;
    }

    let html = '';
    filtered.forEach((r, idx) => {
        // Generating random nice pastel colors for dummy images
        const hue = (idx * 137.5) % 360;
        const bg = `hsl(${hue}, 70%, 90%)`;
        const fg = `hsl(${hue}, 70%, 30%)`;

        html += `
            <div class="glass-panel recipe-card" style="cursor: pointer; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s;" data-id="${r.id}">
                <div style="height: 120px; background: ${bg}; display: flex; align-items: center; justify-content: center; color: ${fg}; font-size: 2rem;">
                    <i class="fas fa-utensils"></i>
                </div>
                <div style="padding: 1rem;">
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.3rem;">${r.category}</div>
                    <div style="font-weight: 600; font-size: 1.1rem; line-height: 1.4;">${r.name}</div>
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;

    // Attach events
    document.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', () => openRecipeDetail(card.dataset.id));
        // Hover effect via JS since it's inline logic
        card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-4px)');
        card.addEventListener('mouseleave', () => card.style.transform = 'translateY(0)');
    });
}

function openRecipeDetail(id) {
    const recipe = allRecipes.find(r => r.id === id);
    if(!recipe) return;

    document.getElementById('recipe-modal-title').textContent = recipe.name;
    
    // アイテム情報を再取得（単位などのため）
    getDocs(collection(db, "m_items")).then(itemSnap => {
        const itemMap = {};
        itemSnap.forEach(d => itemMap[d.id] = d.data());

        let ingHtml = '<ul style="padding-left: 1.2rem; margin-bottom: 2rem;">';
        if (recipe.recipe && recipe.recipe.length > 0) {
            recipe.recipe.forEach(ri => {
                const ingItem = itemMap[ri.ingredient_id];
                const name = ingItem ? ingItem.name : '不明な食材';
                const unit = ingItem ? ingItem.unit : '';
                ingHtml += `<li style="margin-bottom: 0.5rem; display: flex; justify-content: space-between;"><span style="color: var(--text-secondary);">${name}</span> <span style="font-weight: 600;">${ri.quantity} ${unit}</span></li>`;
            });
        } else {
            ingHtml += '<li style="color:var(--text-secondary);">レシピが登録されていません</li>';
        }
        ingHtml += '</ul>';

        let stepsHtml = '<ol style="padding-left: 1.2rem;">';
        recipe.steps.forEach(s => {
            stepsHtml += `<li style="margin-bottom: 1rem; line-height: 1.6;">${s}</li>`;
        });
        stepsHtml += '</ol>';

        document.getElementById('recipe-modal-content').innerHTML = `
            <h4 style="color: var(--primary); margin-bottom: 1rem; border-bottom: 2px solid rgba(230,57,70,0.1); padding-bottom: 0.5rem;"><i class="fas fa-shopping-basket"></i> 材料・仕込み</h4>
            ${ingHtml}
            
            <h4 style="color: var(--secondary); margin-bottom: 1rem; border-bottom: 2px solid rgba(16,185,129,0.1); padding-bottom: 0.5rem;"><i class="fas fa-list-ol"></i> 調理手順</h4>
            ${stepsHtml}
        `;
    });

    document.getElementById('recipe-modal').style.display = 'flex';

    document.getElementById('recipe-modal').style.display = 'flex';
}
