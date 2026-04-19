import { db } from './firebase.js';
import { 
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm, showLoader } from './ui_utils.js';

let currentUser = null;
let cachedBottles = [];
let cachedAreas = [];
let cachedBrands = [];
let bottleSettings = { expirationDays: 180 }; // Default
let expandedAreas = new Set();
let searchQuery = "";

export const bottleKeepPageHtml = `
    <div id="bottle-keep-container" class="animate-fade-in" style="display: flex; flex-direction: column; height: calc(100vh - 120px); overflow: hidden;">
        
        <!-- Top Toolbar -->
        <div class="glass-panel" style="padding: 1rem 1.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; z-index: 100;">
            <!-- Search Console -->
            <div style="flex: 1; min-width: 300px; position: relative;">
                <div class="input-group" style="margin-bottom: 0;">
                    <i class="fas fa-search" style="top: 0.8rem;"></i>
                    <input type="text" id="bottle-search-input" placeholder="ボトル名・ふりがな・銘柄で検索..." style="padding: 0.8rem 1rem 0.8rem 2.8rem; height: 44px;">
                </div>
                <!-- Continuous Search Results window -->
                <div id="bottle-search-results" class="glass" style="display: none; position: absolute; top: calc(100% + 8px); left: 0; right: 0; max-height: 400px; overflow-y: auto; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid var(--border); background: white;">
                    <!-- results dynamic -->
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; gap: 0.8rem;">
                <button id="btn-new-bottle" class="btn btn-primary" style="height: 44px; padding: 0 1.2rem;">
                    <i class="fas fa-plus-circle"></i> 新規登録
                </button>
                <button id="btn-brand-master" class="btn" style="height: 44px; padding: 0 1rem; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;">
                    <i class="fas fa-tags"></i> 銘柄
                </button>
                <button id="btn-area-settings" class="btn" style="height: 44px; width: 44px; padding: 0; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;" title="エリア・期限設定">
                    <i class="fas fa-cog"></i>
                </button>
            </div>
        </div>

        <!-- Main Grid View -->
        <div id="bottle-grid-scroll-area" style="flex: 1; overflow-x: auto; overflow-y: hidden; display: flex; padding-bottom: 1rem; gap: 1rem;">
            <!-- columns dynamic -->
            <div style="padding: 2rem; color: var(--text-secondary); font-weight: 600;">読み込み中...</div>
        </div>
    </div>

    <!-- Modals -->
    <div id="bottle-modal" class="modal-overlay"></div>
    <div id="brand-modal" class="modal-overlay"></div>
    <div id="area-modal" class="modal-overlay"></div>
`;

export async function initBottleKeepPage() {
    currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;
    const storeId = currentUser.StoreID || currentUser.StoreId;
    if (!storeId) {
        showAlert("エラー", "店舗情報が見つかりません。");
        return;
    }

    const loader = showLoader();

    // Listen to Areas (Order by order)
    onSnapshot(query(collection(db, "m_bottle_areas"), where("storeId", "==", storeId)), (snap) => {
        cachedAreas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        renderGrid();
        if (loader) loader.remove();
    }, (err) => {
        console.error("Areas Snapshot Error:", err);
        if (loader) loader.remove();
    });

    // Listen to Brands
    onSnapshot(query(collection(db, "m_bottle_brands"), where("storeId", "==", storeId)), (snap) => {
        cachedBrands = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", 'ja'));
        if (loader) loader.remove();
    }, (err) => {
        console.error("Brands Snapshot Error:", err);
        if (loader) loader.remove();
    });

    // Listen to Settings
    onSnapshot(doc(db, "m_bottle_settings", storeId), (docSnap) => {
        if (docSnap.exists()) {
            bottleSettings = docSnap.data();
        } else {
            bottleSettings = { expirationDays: 180 };
        }
        renderGrid();
        if (loader) loader.remove();
    }, (err) => {
        console.error("Settings Snapshot Error:", err);
        if (loader) loader.remove();
    });

    // Listen to Bottles
    onSnapshot(query(collection(db, "t_bottles"), where("storeId", "==", storeId)), (snap) => {
        cachedBottles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderGrid();
        if (loader) loader.remove();
    }, (err) => {
        console.error("Bottles Snapshot Error:", err);
        if (loader) loader.remove();
    });

    // Bind Events
    setupEventListeners();
}

function setupEventListeners() {
    const container = document.getElementById('bottle-keep-container');
    if (container) {
        container.onclick = (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            console.log("Toolbar button clicked:", btn.id);
            if (btn.id === 'btn-new-bottle') openBottleModal();
            else if (btn.id === 'btn-brand-master') openBrandModal();
            else if (btn.id === 'btn-area-settings') openAreaModal();
        };
    }

    const searchInput = document.getElementById('bottle-search-input');
    const searchResults = document.getElementById('bottle-search-results');

    searchInput.oninput = (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderSearchResults();
    };

    searchInput.onfocus = () => {
        if (searchQuery) searchResults.style.display = 'block';
    };

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

function renderGrid() {
    const container = document.getElementById('bottle-grid-scroll-area');
    if (!container) return;

    if (cachedAreas.length === 0) {
        container.innerHTML = `<div style="padding: 2rem; color: var(--text-secondary);">エリアが設定されていません。「設定」ボタンからエリアを作成してください。</div>`;
        return;
    }

    let html = "";
    cachedAreas.forEach(area => {
        const isExpanded = expandedAreas.has(area.id);
        const areaBottles = cachedBottles
            .filter(b => b.areaId === area.id)
            .sort((a, b) => (a.customerFurigana || "").localeCompare(b.customerFurigana || "", 'ja'));

        html += `
            <div class="area-column ${isExpanded ? 'expanded' : ''}" data-area-id="${area.id}" style="
                flex: 0 0 ${isExpanded ? '350px' : '65px'};
                background: white;
                border-radius: 16px;
                border: 1px solid var(--border);
                display: flex;
                flex-direction: column;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
            ">
                <!-- Column Header -->
                <div class="area-header" onclick="toggleArea('${area.id}')" style="
                    padding: 1rem 0.5rem;
                    background: ${isExpanded ? 'var(--primary)' : '#f8fafc'};
                    color: ${isExpanded ? 'white' : 'var(--text-primary)'};
                    cursor: pointer;
                    display: flex;
                    flex-direction: ${isExpanded ? 'row' : 'column'};
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    border-bottom: 1px solid var(--border);
                ">
                    <span style="font-weight: 800; font-size: 1.1rem; writing-mode: ${isExpanded ? 'horizontal-tb' : 'vertical-rl'}; text-orientation: upright;">
                        ${area.name}
                    </span>
                    <span style="font-size: 0.8rem; opacity: 0.8;">(${areaBottles.length})</span>
                    <i class="fas ${isExpanded ? 'fa-chevron-left' : 'fa-chevron-right'}" style="font-size: 0.7rem; margin-top: auto;"></i>
                </div>

                <!-- Column Content (only if expanded) -->
                ${isExpanded ? `
                <div class="area-content" style="flex: 1; overflow-y: auto; padding: 0.8rem;">
                    ${areaBottles.length === 0 ? `
                        <div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding-top: 2rem;">ボトルなし</div>
                    ` : areaBottles.map(b => renderBottleCard(b)).join('')}
                </div>
                ` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderBottleCard(bottle) {
    const brand = cachedBrands.find(br => br.id === bottle.brandId)?.name || '不明';
    const lastDate = bottle.lastServingDate ? (bottle.lastServingDate.toDate ? bottle.lastServingDate.toDate() : new Date(bottle.lastServingDate)) : null;
    const diffDays = lastDate ? Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24)) : 0;
    const isExpired = lastDate && diffDays >= bottleSettings.expirationDays;

    return `
        <div class="bottle-card ${isExpired ? 'expired' : ''}" onclick="openBottleModal('${bottle.id}')" style="
            background: ${isExpired ? '#fff1f2' : 'white'};
            border: 2px solid ${isExpired ? '#f43f5e' : 'var(--border)'};
            border-radius: 12px;
            padding: 0.8rem;
            margin-bottom: 0.8rem;
            cursor: pointer;
            transition: transform 0.2s;
            position: relative;
        ">
            ${bottle.memo ? `
                <div class="memo-indicator" onclick="event.stopPropagation(); showBottleMemo(event, '${bottle.id}')" title="メモを確認">
                    <i class="fas fa-comment-dots"></i>
                </div>
            ` : ''}
            ${isExpired ? `
                <div style="position: absolute; top: -8px; right: -8px; background: #f43f5e; color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 10px; font-weight: 900; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    期限切れ (${diffDays}日)
                </div>
            ` : ''}
            <div style="font-size: 0.7rem; color: #94a3b8; font-weight: 600;">${bottle.customerFurigana || ''}</div>
            <div style="font-weight: 800; font-size: 1rem; color: var(--text-primary); margin-bottom: 0.4rem;">${bottle.customerName}</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 0.7rem;">${brand}</span>
                <div style="text-align: right;">
                    <div style="font-size: 0.65rem; color: #94a3b8;">最終提供</div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: ${isExpired ? '#f43f5e' : 'var(--text-secondary)'};">
                        ${lastDate ? lastDate.toLocaleDateString() : '不明'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.toggleArea = (areaId) => {
    if (expandedAreas.has(areaId)) {
        expandedAreas.delete(areaId);
    } else {
        expandedAreas.add(areaId);
    }
    renderGrid();
};

window.showBottleMemo = (event, bottleId) => {
    const existing = document.querySelector('.memo-popover');
    if (existing) {
        existing.remove();
        if (existing.dataset.bottleId === bottleId) return; // Toggle off if clicking the same icon
    }

    const bottle = cachedBottles.find(b => b.id === bottleId);
    if (!bottle || !bottle.memo) return;

    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();

    const popover = document.createElement('div');
    popover.className = 'memo-popover';
    popover.dataset.bottleId = bottleId;
    popover.innerHTML = `
        <div class="memo-popover-content">
            ${bottle.memo.replace(/\n/g, '<br>')}
        </div>
        <div class="memo-popover-arrow"></div>
    `;

    document.body.appendChild(popover);

    // Position calc
    const popHeight = popover.offsetHeight;
    const popWidth = popover.offsetWidth;
    
    let left = rect.left + (rect.width / 2) - (popWidth / 2);
    let top = rect.top - popHeight - 12;

    // Boundary check
    if (left < 10) left = 10;
    if (left + popWidth > window.innerWidth - 10) left = window.innerWidth - popWidth - 10;
    if (top < 10) top = rect.bottom + 12; // Show below if no space above

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.classList.add('show');

    // Click outside to close
    const closeHandler = (e) => {
        if (!popover.contains(e.target) && !target.contains(e.target)) {
            popover.classList.remove('show');
            setTimeout(() => popover.remove(), 200);
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
};

function renderSearchResults() {
    const results = document.getElementById('bottle-search-results');
    if (!searchQuery) {
        results.style.display = 'none';
        return;
    }

    const filtered = cachedBottles.filter(b => {
        const brand = cachedBrands.find(br => br.id === b.brandId)?.name || '';
        return b.customerName.toLowerCase().includes(searchQuery) ||
               (b.customerFurigana || "").toLowerCase().includes(searchQuery) ||
               brand.toLowerCase().includes(searchQuery);
    }).slice(0, 20);

    if (filtered.length === 0) {
        results.innerHTML = `<div style="padding: 1rem; text-align: center; color: #94a3b8;">一致するボトルがありません</div>`;
    } else {
        results.innerHTML = filtered.map(b => {
            const area = cachedAreas.find(a => a.id === b.areaId)?.name || '未配置';
            const brand = cachedBrands.find(br => br.id === b.brandId)?.name || '不明';
            return `
                <div class="search-item" onclick="handleSearchResultClick('${b.id}', '${b.areaId}')" style="
                    padding: 0.8rem 1.2rem;
                    border-bottom: 1px solid #f1f5f9;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.7rem; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.customerFurigana || ''}</div>
                        <div style="font-weight: 800; font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.customerName}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${brand}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem; margin-left: 1rem;">
                        <span class="badge badge-blue" style="white-space: nowrap;">${area}</span>
                        <button class="btn btn-primary" onclick="event.stopPropagation(); openBottleModal('${b.id}')" style="padding: 6px 12px; font-size: 0.75rem;">
                            <i class="fas fa-edit"></i> 編集
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    results.style.display = 'block';
}

window.handleSearchResultClick = (bottleId, areaId) => {
    expandedAreas.add(areaId);
    renderGrid();
    
    // Scroll to the area column
    setTimeout(() => {
        const grid = document.getElementById('bottle-grid-scroll-area');
        const target = document.querySelector(`.area-column[data-area-id="${areaId}"]`);
        if (grid && target) {
            grid.scrollTo({
                left: target.offsetLeft - 20,
                behavior: 'smooth'
            });
        }
    }, 150);

    document.getElementById('bottle-search-results').style.display = 'none';
};

// --- Modals Implementation ---

async function openBottleModal(bottleId = null) {
    const modal = document.getElementById('bottle-modal');
    const bottle = bottleId ? cachedBottles.find(b => b.id === bottleId) : null;
    const isEdit = !!bottle;

    modal.innerHTML = `
        <div class="modal-content-box animate-zoom-fade" style="max-width: 500px;">
            <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0;">${isEdit ? 'ボトルの確認・編集' : 'ボトルの新規登録'}</h3>
                <button class="btn" style="background: transparent;" onclick="closeModal('bottle-modal')"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem; overflow-y: auto;">
                <form id="bottle-form">
                    <div class="input-group">
                        <label>ボトルの名前 <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="cust-name" required value="${bottle?.customerName || ''}" placeholder="例: 佐藤 啓一">
                    </div>
                    <div class="input-group">
                        <label>ふりがな</label>
                        <input type="text" id="cust-furigana" value="${bottle?.customerFurigana || ''}" placeholder="例: さとう けいいち">
                    </div>
                    <div class="bottle-modal-grid">
                        <div>
                            <div class="input-group" style="margin-bottom: 0.8rem;">
                                <label>配置エリア <span style="color:var(--danger)">*</span></label>
                                <select id="bottle-area" required>
                                    <option value="">選択してください</option>
                                    ${cachedAreas.map(a => `<option value="${a.id}" ${bottle?.areaId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="input-group" style="margin-bottom: 0;">
                                <label>銘柄 <span style="color:var(--danger)">*</span></label>
                                <select id="bottle-brand" required>
                                    <option value="">選択してください</option>
                                    ${cachedBrands.map(b => `<option value="${b.id}" ${bottle?.brandId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="input-group" style="margin-bottom: 0; display: flex; flex-direction: column;">
                            <label>メモ</label>
                            <textarea id="bottle-memo" placeholder="特徴・お好みなど..." style="flex: 1; min-height: 80px; resize: none; width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 0.8rem; font-size: 0.9rem;">${bottle?.memo || ''}</textarea>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="input-group">
                            <label>初回提供日</label>
                            <input type="date" id="first-date" value="${bottle?.firstServingDate ? (bottle.firstServingDate.toDate ? bottle.firstServingDate.toDate().toISOString().split('T')[0] : new Date(bottle.firstServingDate).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]}" readonly style="background:#f1f5f9; cursor:not-allowed;">
                        </div>
                        <div class="input-group">
                            <label>最終提供日</label>
                            <input type="date" id="last-date" value="${bottle?.lastServingDate ? (bottle.lastServingDate.toDate ? bottle.lastServingDate.toDate().toISOString().split('T')[0] : new Date(bottle.lastServingDate).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                </form>
            </div>
            <div style="padding: 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between;">
                ${isEdit ? `
                    <button class="btn" style="background: white; color: var(--danger); border: 1px solid #fee2e2;" onclick="deleteBottle('${bottle.id}')">
                        <i class="fas fa-trash"></i> 削除
                    </button>
                ` : '<div></div>'}
                <div style="display: flex; gap: 0.8rem;">
                    <button class="btn" onclick="closeModal('bottle-modal')">キャンセル</button>
                    <button class="btn btn-primary" id="btn-save-bottle">保存</button>
                </div>
            </div>
        </div>
    `;

    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.add('show');

    document.getElementById('btn-save-bottle').onclick = async () => {
        const form = document.getElementById('bottle-form');
        if (!form.checkValidity()) { form.reportValidity(); return; }

        const data = {
            customerName: document.getElementById('cust-name').value,
            customerFurigana: document.getElementById('cust-furigana').value,
            areaId: document.getElementById('bottle-area').value,
            brandId: document.getElementById('bottle-brand').value,
            memo: document.getElementById('bottle-memo').value.trim(),
            lastServingDate: new Date(document.getElementById('last-date').value),
            updatedAt: serverTimestamp()
        };

        if (!isEdit) {
            data.storeId = currentUser.StoreID || currentUser.StoreId;
            data.firstServingDate = new Date(document.getElementById('first-date').value);
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, "t_bottles"), data);
        } else {
            await updateDoc(doc(db, "t_bottles", bottleId), data);
        }

        closeModal('bottle-modal');
    };
}

async function openBrandModal() {
    const modal = document.getElementById('brand-modal');
    modal.innerHTML = `
        <div class="modal-content-box animate-zoom-fade" style="max-width: 450px;">
            <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0;">銘柄マスタ管理</h3>
                <button class="btn" style="background: transparent;" onclick="closeModal('brand-modal')"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem; overflow-y: auto; max-height: 400px;">
                <div style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem;">
                    <input type="text" id="new-brand-name" placeholder="新しい銘柄名..." style="flex: 1; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px;">
                    <button class="btn btn-primary" id="btn-add-brand"><i class="fas fa-plus"></i> 追加</button>
                </div>
                <div id="brand-list-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${cachedBrands.map(b => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <span style="font-weight: 600;">${b.name}</span>
                            <button class="btn" style="padding: 4px 8px; font-size: 0.8rem; color: var(--danger);" onclick="deleteBrand('${b.id}', '${b.name}')"><i class="fas fa-trash"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div style="padding: 1rem; text-align: right;">
                <button class="btn" onclick="closeModal('brand-modal')">閉じる</button>
            </div>
        </div>
    `;
    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.add('show');

    document.getElementById('btn-add-brand').onclick = async (e) => {
        const btn = e.currentTarget;
        const name = document.getElementById('new-brand-name').value.trim();
        if (!name) return;
        
        btn.disabled = true;
        try {
            console.log("Attempting to add brand:", name);
            await addDoc(collection(db, "m_bottle_brands"), {
                storeId: currentUser.StoreID || currentUser.StoreId,
                name: name,
                createdAt: serverTimestamp()
            });
            console.log("Brand added successfully");
            document.getElementById('new-brand-name').value = "";
            openBrandModal(); // Refresh view
        } catch (err) {
            console.error("Brand Save Error:", err);
            showAlert("エラー", "銘柄の保存に失敗しました。詳細な理由はブラウザのコンソールを確認してください。");
            btn.disabled = false;
        }
    };
}

async function openAreaModal() {
    const modal = document.getElementById('area-modal');
    modal.innerHTML = `
        <div class="modal-content-box animate-zoom-fade" style="max-width: 550px;">
            <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0;">エリア・保管設定</h3>
                <button class="btn" style="background: transparent;" onclick="closeModal('area-modal')"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem; overflow-y: auto;">
                <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; border-left: 4px solid var(--warning); padding-left: 0.8rem;">
                    共通設定
                </h4>
                <div class="input-group">
                    <label>ボトル保管期限 (日数)</label>
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                        <input type="number" id="setting-expiration" value="${bottleSettings.expirationDays}" style="flex: 1;">
                        <span style="font-weight: 700; color: var(--text-secondary);">日</span>
                    </div>
                    <p style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.4rem;">最終提供日からこの日数が経過すると画面で赤く強調されます。</p>
                </div>
                <button class="btn btn-primary" id="btn-save-settings" style="width: 100%; margin-bottom: 2rem;">設定を保存</button>

                <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; border-left: 4px solid var(--primary); padding-left: 0.8rem;">
                    エリア管理
                </h4>
                <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
                    <input type="text" id="new-area-name" placeholder="新しいエリア名 (例: あ行 / 棚A)..." style="flex: 1; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px;">
                    <button class="btn btn-primary" id="btn-add-area"><i class="fas fa-plus"></i> 追加</button>
                </div>
                <div id="area-list-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${cachedAreas.map((a, idx) => `
                        <div style="display: flex; align-items: center; gap: 0.8rem; padding: 0.6rem 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="width: 24px; color: #94a3b8; cursor: pointer; display: flex; flex-direction: column; gap: 2px;">
                                <i class="fas fa-chevron-up" onclick="moveArea('${a.id}', -1)" style="font-size: 0.7rem; display: ${idx === 0 ? 'none' : 'block'}"></i>
                                <i class="fas fa-chevron-down" onclick="moveArea('${a.id}', 1)" style="font-size: 0.7rem; display: ${idx === cachedAreas.length - 1 ? 'none' : 'block'}"></i>
                            </div>
                            <span style="font-weight: 800; flex: 1;">${a.name}</span>
                            <button class="btn" style="padding: 4px 8px; font-size: 0.8rem; color: var(--danger);" onclick="deleteArea('${a.id}', '${a.name}')"><i class="fas fa-trash"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div style="padding: 1.5rem; text-align: right; border-top: 1px solid var(--border);">
                <button class="btn" onclick="closeModal('area-modal')">閉じる</button>
            </div>
        </div>
    `;
    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.add('show');

    document.getElementById('btn-save-settings').onclick = async (e) => {
        const btn = e.currentTarget;
        const days = parseInt(document.getElementById('setting-expiration').value);
        if (isNaN(days) || days < 0) return;
        
        btn.disabled = true;
        try {
            await setDoc(doc(db, "m_bottle_settings", currentUser.StoreID || currentUser.StoreId), {
                expirationDays: days,
                updatedAt: serverTimestamp()
            });
            showAlert("成功", "設定を保存しました。");
        } catch (err) {
            console.error(err);
            showAlert("エラー", "設定の保存に失敗しました。");
        } finally {
            btn.disabled = false;
        }
    };

    document.getElementById('btn-add-area').onclick = async (e) => {
        const btn = e.currentTarget;
        const name = document.getElementById('new-area-name').value.trim();
        if (!name) return;
        
        btn.disabled = true;
        try {
            console.log("Attempting to add area:", name);
            await addDoc(collection(db, "m_bottle_areas"), {
                storeId: currentUser.StoreID || currentUser.StoreId,
                name: name,
                order: cachedAreas.length,
                createdAt: serverTimestamp()
            });
            console.log("Area added successfully");
            openAreaModal();
        } catch (err) {
            console.error("Area Save Error:", err);
            showAlert("エラー", "エリアの保存に失敗しました。詳細な理由はブラウザのコンソールを確認してください。");
            btn.disabled = false;
        }
    };
}

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('show');
    // Important: Clear inline styles added by ui_utils (important overrides)
    modal.style.display = '';
};

window.deleteBottle = (id) => {
    showConfirm("削除の確認", "このボトル情報を削除しますか？アーカイブは作成されません。", async () => {
        await deleteDoc(doc(db, "t_bottles", id));
        closeModal('bottle-modal');
    });
};

window.deleteBrand = (id, name) => {
    showConfirm("銘柄の削除", `「${name}」を削除しますか？`, async () => {
        await deleteDoc(doc(db, "m_bottle_brands", id));
        openBrandModal();
    });
};

window.deleteArea = (id, name) => {
    const hasBottles = cachedBottles.some(b => b.areaId === id);
    if (hasBottles) {
        showAlert("エラー", "このエリアにボトルが配置されているため削除できません。");
        return;
    }
    showConfirm("エリアの削除", `「${name}」を削除しますか？`, async () => {
        await deleteDoc(doc(db, "m_bottle_areas", id));
        openAreaModal();
    });
};

window.moveArea = async (id, direction) => {
    const idx = cachedAreas.findIndex(a => a.id === id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= cachedAreas.length) return;

    const currentArea = cachedAreas[idx];
    const targetArea = cachedAreas[newIdx];

    await updateDoc(doc(db, "m_bottle_areas", currentArea.id), { order: newIdx });
    await updateDoc(doc(db, "m_bottle_areas", targetArea.id), { order: idx });
    
    // Refresh the modal to show the new order
    openAreaModal();
};

// Expose modal functions to window for global access (from HTML onclick)
window.openBottleModal = openBottleModal;
window.openBrandModal = openBrandModal;
window.openAreaModal = openAreaModal;

// CSS Injection
const style = document.createElement('style');
style.textContent = `
    .area-column.expanded .area-header {
        writing-mode: horizontal-tb;
    }
    .area-column:not(.expanded) .area-header:hover {
        background: #f1f5f9;
    }
    .bottle-card:hover {
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .search-item:hover {
        background: #f8fafc;
    }
    .memo-indicator {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        width: 30px;
        height: 30px;
        background: var(--danger);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);
        z-index: 10;
        transition: all 0.2s;
        animation: pulse-memo 2s infinite;
    }
    .memo-indicator:hover {
        transform: scale(1.15);
        background: #ff5a5f;
    }
    @keyframes pulse-memo {
        0% { transform: scale(1); box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3); }
        50% { transform: scale(1.05); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.5); }
        100% { transform: scale(1); box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3); }
    }
    .memo-popover {
        position: fixed;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        padding: 0.8rem 1rem;
        z-index: 11000;
        max-width: 250px;
        min-width: 150px;
        font-size: 0.85rem;
        color: var(--text-primary);
        line-height: 1.5;
        opacity: 0;
        transform: translateY(5px);
        transition: opacity 0.2s, transform 0.2s;
        pointer-events: auto;
    }
    .memo-popover.show {
        opacity: 1;
        transform: translateY(0);
    }
    .memo-popover-content {
        word-break: break-all;
        font-weight: 500;
    }
    .memo-popover-arrow {
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        width: 12px;
        height: 12px;
        background: rgba(255, 255, 255, 0.95);
        border-right: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
    }
    .bottle-modal-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    @media (max-width: 600px) {
        .bottle-modal-grid {
            grid-template-columns: 1fr;
        }
    }
    @media (max-width: 768px) {
        .area-column.expanded {
            flex: 0 0 85vw !important;
        }
    }
`;
document.head.appendChild(style);
