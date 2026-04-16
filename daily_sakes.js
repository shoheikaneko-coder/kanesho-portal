import { db, storage } from './firebase.js';
import { 
    collection, getDocs, addDoc, updateDoc, doc, 
    query, where, orderBy, serverTimestamp, getDoc, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { showConfirm, showAlert, showLoader } from './ui_utils.js';

/**
 * Japanese Sake Management System (Architecturally Isolated)
 * Scoped to #daily-sakes-root
 */

window.sakeApp = {
    activeTab: 'lineup',
    masterSearchQuery: '',
    masterSakes: [],
    dailySnapshots: [],
    editingMasterId: null,
    pendingAddSakeId: null,

    switchTab: (tab) => {
        window.sakeApp.activeTab = tab;
        renderSakeAppTab();
    },
    init: async () => {
        cleanupSakeUI();
        renderSakeAppTab();
        setupSakeGlobalDelegation();
    }
};

export const dailySakesPageHtml = `
    <div id="daily-sakes-root">
        <!-- Scope Header -->
        <div class="sake-tab-nav">
            <button class="sake-tab-btn active" data-tab="lineup">
                <i class="fas fa-wine-glass-alt"></i> 現在のラインナップ
            </button>
            <button class="sake-tab-btn" data-tab="master">
                <i class="fas fa-search"></i> 銘柄を探す・登録
            </button>
        </div>

        <div id="sake-tab-content-area" style="padding-bottom: 5rem;">
            <!-- Content Injected Here -->
        </div>

        <!-- Scoped Modal Container -->
        <div id="sake-modal-portal"></div>

        <style>
            #daily-sakes-root {
                --sake-primary: #E63946;
                --sake-primary-rgb: 230, 57, 70;
                --sake-text-main: #1e293b;
                --sake-text-sub: #64748b;
                --sake-border: #e2e8f0;
                --sake-bg-card: #ffffff;
                --sake-z-modal: 10500;
            }

            #daily-sakes-root .sake-tab-nav { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--sake-border); background: #f8fafc; padding: 0.5rem 0.5rem 0; border-radius: 12px 12px 0 0; }
            #daily-sakes-root .sake-tab-btn { padding: 0.8rem 1.2rem; border: none; background: none; cursor: pointer; font-weight: 800; color: var(--sake-text-sub); border-bottom: 3px solid transparent; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
            #daily-sakes-root .sake-tab-btn.active { color: var(--sake-primary); border-bottom-color: var(--sake-primary); }

            /* Lineup UI */
            #daily-sakes-root .sake-card-current { background: white; border-radius: 20px; border: 2.5px solid var(--sake-primary); padding: 1.5rem; display: flex; gap: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 15px 35px -5px rgba(var(--sake-primary-rgb), 0.2); position: relative; overflow: hidden; align-items: center; }
            #daily-sakes-root .sake-card-current::before { content: '現在提供中'; position: absolute; top: 0; right: 0; background: var(--sake-primary); color: white; padding: 0.3rem 1.2rem; font-size: 0.75rem; font-weight: 900; border-bottom-left-radius: 12px; letter-spacing: 0.05em; }
            
            #daily-sakes-root .sake-card-queued { background: white; border-radius: 16px; border: 1px solid var(--sake-border); padding: 1.2rem; margin-bottom: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s; }
            #daily-sakes-root .sake-card-queued:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }

            #daily-sakes-root .sake-thumb-xl { width: 130px; height: 130px; border-radius: 16px; object-fit: cover; background: #f1f5f9; box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
            #daily-sakes-root .sake-thumb-md { width: 80px; height: 80px; border-radius: 12px; object-fit: cover; background: #f1f5f9; }

            #daily-sakes-root .sake-brand-title { font-size: 1.4rem; font-weight: 900; color: var(--sake-text-main); margin: 0; line-height: 1.2; }
            #daily-sakes-root .sake-brand-sm { font-size: 1.1rem; font-weight: 800; color: var(--sake-text-main); margin: 0; }
            
            #daily-sakes-root .sake-catch-copy-lg { font-size: 1rem; font-weight: 700; color: var(--sake-primary); margin: 0.6rem 0; padding: 0.4rem 0.8rem; background: rgba(var(--sake-primary-rgb), 0.05); border-radius: 8px; display: inline-block; }
            #daily-sakes-root .sake-catch-copy-sm { font-size: 0.85rem; font-weight: 600; color: var(--sake-text-sub); margin: 0.4rem 0; }

            #daily-sakes-root .sake-order-badge { background: #f1f5f9; color: #475569; padding: 0.3rem 0.7rem; border-radius: 8px; font-size: 0.75rem; font-weight: 900; display: inline-flex; align-items: center; gap: 0.3rem; }
            
            #daily-sakes-root .sake-btn-action { padding: 0.6rem 1rem; border-radius: 10px; font-size: 0.85rem; font-weight: 800; border: none; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.4rem; }
            #daily-sakes-root .sake-btn-primary { background: var(--sake-primary); color: white; }
            #daily-sakes-root .sake-btn-secondary { background: #f1f5f9; color: #64748b; }
            #daily-sakes-root .sake-btn-secondary:hover { background: #e2e8f0; color: #1e293b; }
            #daily-sakes-root .sake-btn-danger-outline { background: transparent; color: #ef4444; border: 1px solid #fee2e2; }

            #daily-sakes-root .sake-btn-order { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 1.5px solid var(--sake-border); background: white; color: var(--sake-text-sub); cursor: pointer; transition: all 0.2s; }
            #daily-sakes-root .sake-btn-order:disabled { opacity: 0.3; cursor: not-allowed; }
            #daily-sakes-root .sake-btn-order:not(:disabled):hover { border-color: var(--sake-primary); color: var(--sake-primary); background: rgba(var(--sake-primary-rgb), 0.02); }

            #daily-sakes-root .sake-section-header { display: flex; align-items: baseline; gap: 0.8rem; margin-bottom: 1.5rem; padding-left: 0.8rem; border-left: 6px solid var(--sake-primary); }

            /* Master Search Result UI */
            #daily-sakes-root .sake-master-card { display: flex; gap: 1rem; background: white; padding: 1.2rem; border-radius: 16px; border: 1px solid var(--sake-border); margin-bottom: 1rem; align-items: flex-start; }
            #daily-sakes-root .sake-taste-badge { padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
            #daily-sakes-root .sake-taste-dry { background: #fee2e2; color: #dc2626; }
            #daily-sakes-root .sake-taste-balanced { background: #f0fdf4; color: #16a34a; }
            #daily-sakes-root .sake-taste-fruity { background: #f0f9ff; color: #0369a1; }

            /* Form Styles */
            #daily-sakes-root .sake-form-section { margin-bottom: 2rem; }
            #daily-sakes-root .sake-form-section-title { font-size: 0.85rem; font-weight: 800; color: var(--sake-text-sub); margin-bottom: 1rem; text-transform: uppercase; display: flex; align-items: center; gap: 0.5rem; }
            #daily-sakes-root .sake-input-group { margin-bottom: 1.2rem; }
            #daily-sakes-root .sake-input-group label { display: block; font-size: 0.85rem; font-weight: 800; margin-bottom: 0.4rem; color: var(--sake-text-main); }
            #daily-sakes-root .sake-input-group input, 
            #daily-sakes-root .sake-input-group textarea, 
            #daily-sakes-root .sake-input-group select { width: 100%; padding: 0.8rem 1rem; border-radius: 12px; border: 1.5px solid var(--sake-border); font-size: 1rem; transition: all 0.2s; }
            #daily-sakes-root .sake-input-group input:focus { border-color: var(--sake-primary); outline: none; box-shadow: 0 0 0 3px rgba(var(--sake-primary-rgb), 0.1); }

            /* Scoped Modals */
            #daily-sakes-root .sake-modal-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                z-index: var(--sake-z-modal); display: flex; align-items: center; justify-content: center; padding: 1rem;
                backdrop-filter: blur(8px);
            }
        </style>
    </div>
`;

// --- Initialization ---
export async function initDailySakesPage() {
    await window.sakeApp.init();
}

function cleanupSakeUI() {
    const portal = document.getElementById('sake-modal-portal');
    if (portal) portal.innerHTML = '';
    const oldRoots = document.querySelectorAll('.sake-modal-overlay');
    oldRoots.forEach(r => r.remove());
}

async function renderSakeAppTab() {
    const area = document.getElementById('sake-tab-content-area');
    if (!area) return;

    document.querySelectorAll('.sake-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === window.sakeApp.activeTab);
    });

    if (window.sakeApp.activeTab === 'lineup') {
        await renderLineupTab(area);
    } else {
        await renderMasterTab(area);
    }
}

// --- LINEUP TAB ---
async function renderLineupTab(container) {
    container.innerHTML = `<div style="padding:4rem; text-align:center;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--sake-primary);"></i></div>`;
    try {
        const user = window.appState?.currentUser;
        const storeId = user?.StoreID || user?.StoreId ||'honten';
        
        if (!storeId || storeId === 'undefined') {
            console.warn("renderLineupTab: storeId is invalid for query.", storeId);
            container.innerHTML = `<div style="padding:2rem;color:var(--text-secondary);">店舗情報が取得できないため表示できません。</div>`;
            return;
        }

        const q = query(
            collection(db, "daily_sake_slots"), 
            where("store_id", "==", String(storeId)), 
            where("is_deleted", "==", false), 
            where("is_archived", "==", false), 
            orderBy("taste_type"), 
            orderBy("display_order")
        );
        const snap = await getDocs(q);
        window.sakeApp.dailySnapshots = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const mIds = [...new Set(window.sakeApp.dailySnapshots.map(s => s.sake_id))];
        const mMap = {};
        if (mIds.length > 0) {
            for (let i = 0; i < mIds.length; i += 10) {
                const chunk = mIds.slice(i, i+10);
                const mq = query(collection(db, "sake_master"), where("__name__", "in", chunk));
                const s = await getDocs(mq);
                s.forEach(d => mMap[d.id] = d.data());
            }
        }

        const groups = { dry: [], balanced: [], fruity: [] };
        window.sakeApp.dailySnapshots.forEach(s => {
            if (groups[s.taste_type]) {
                groups[s.taste_type].push({ ...s, master: mMap[s.sake_id] });
            }
        });

        container.innerHTML = `
            ${renderTasteSection('dry', '辛口 (Dry)', groups.dry)}
            ${renderTasteSection('balanced', 'バランス (Balanced)', groups.balanced)}
            ${renderTasteSection('fruity', 'フルーティ (Fruity)', groups.fruity)}
        `;
    } catch (e) {
        console.error("Lineup fetch error:", e);
        container.innerHTML = `<div style="padding:2rem; background:#fee2e2; color:#b91c1c; border-radius:12px; margin-top:1rem;">
            <strong>読み込みエラー:</strong><br>
            <small style="display:block; margin-top:0.5rem; word-break:break-all;">${e.message}</small>
            ${e.message.indexOf('index') > -1 ? '<p style="margin-top:0.8rem; font-size:0.8rem; font-weight:700;">※Firestoreのインデックス作成が必要です。</p>' : ''}
        </div>`;
    }
}

function renderTasteSection(type, label, items) {
    if (items.length === 0) {
        return `
            <div style="margin-bottom:2.5rem;">
                <div class="sake-section-header"><h3>${label}</h3></div>
                <div style="padding:3rem; text-align:center; border:2px dashed var(--sake-border); border-radius:20px; background:rgba(255,255,255,0.5);">
                    <p style="color:var(--sake-text-sub); font-size:0.9rem; font-weight:700;">この系統に銘柄が登録されていません</p>
                    <button class="sake-btn-action sake-btn-secondary" style="margin:1rem auto;" onclick="window.sakeApp.switchTab('master')">
                        <i class="fas fa-plus"></i> 銘柄を追加する
                    </button>
                </div>
            </div>
        `;
    }
    const cur = items.find(i => i.display_order === 1);
    const que = items.filter(i => i.display_order > 1).sort((a,b) => a.display_order - b.display_order);

    return `
        <div style="margin-bottom:4rem;">
            <div class="sake-section-header">
                <h3 style="margin:0;">${label}</h3>
                <span style="font-size:0.8rem; font-weight:800; background:white; padding:0.2rem 0.6rem; border-radius:10px; border:1px solid var(--sake-border);">${items.length} 銘柄</span>
            </div>
            
            <div style="margin-bottom:0.8rem; font-size:0.8rem; font-weight:900; color:var(--sake-primary); letter-spacing:0.05em; display:flex; align-items:center; gap:0.5rem;">
                <i class="fas fa-certificate"></i> 現在提供中の1本
            </div>
            ${cur ? `
                <div class="sake-card-current" style="border: 1px solid transparent; background: linear-gradient(white, white) padding-box, linear-gradient(135deg, var(--sake-primary) 0%, #ff6b6b 100%) border-box; box-shadow: 0 15px 35px -12px rgba(var(--sake-primary-rgb), 0.2);">
                    <img src="${cur.master?.image_url || 'https://via.placeholder.com/200'}" class="sake-thumb-xl" style="border: 3px solid white; box-shadow: 0 8px 16px -4px rgba(0,0,0,0.1);">
                    <div style="flex:1;">
                        <h4 class="sake-brand-title" style="font-size: 1.4rem; letter-spacing: -0.02em;">${cur.master?.brand_name}</h4>
                        <div style="font-size:0.9rem; color:var(--sake-text-sub); margin:0.4rem 0; font-weight:700;">
                            ${cur.master?.brewery_name} <span style="margin:0 0.4rem; opacity:0.3;">|</span> ${cur.master?.prefecture}
                        </div>
                        <div class="sake-catch-copy-lg" style="background: rgba(var(--sake-primary-rgb), 0.05); color: var(--sake-primary); border-radius: 12px; font-style: italic;">
                            “ ${cur.master?.catch_copy || '究極の味わいを、今。'} ”
                        </div>
                        <div style="margin-top:1.5rem; display:flex; gap:0.8rem;">
                            <button class="sake-btn-action sake-btn-danger-outline" style="flex:1; padding: 0.8rem;" data-action="archive" data-id="${cur.id}">
                                <i class="fas fa-box-archive"></i> 提供終了
                            </button>
                        </div>
                    </div>
                </div>
            ` : `<div style="padding:2.5rem; border:2px dashed #fee2e2; border-radius:24px; text-align:center; color:#ef4444; font-weight:800; background: #fff5f5;">現在、この系統の提供はありません</div>`}

            ${que.length > 0 ? `
                <div style="margin:2.5rem 0 1rem; font-size:0.8rem; font-weight:900; color:var(--sake-text-sub); letter-spacing:0.05em; display:flex; align-items:center; gap:0.5rem;">
                    <i class="fas fa-layer-group"></i> 次の提供候補（順番待ち）
                </div>
                ${que.map((item, idx) => `
                    <div class="sake-card-queued">
                        <div style="display:flex; gap:1.2rem; align-items:start;">
                            <img src="${item.master?.image_url || 'https://via.placeholder.com/150'}" class="sake-thumb-md">
                            <div style="flex:1;">
                                <div style="display:flex; justify-content:space-between; align-items:start;">
                                    <div style="flex:1;">
                                        <div style="display:flex; align-items:center; gap:0.5rem;">
                                            <span class="sake-order-badge">
                                                <i class="fas fa-sort-numeric-down"></i> ${item.display_order}番目
                                                ${idx === 0 ? '<span style="color:var(--sake-primary); margin-left:0.3rem;">(次候補)</span>' : ''}
                                            </span>
                                            <h5 class="sake-brand-sm">${item.master?.brand_name}</h5>
                                        </div>
                                        <div class="sake-catch-copy-sm">${item.master?.catch_copy || ''}</div>
                                    </div>
                                    <div style="display:flex; gap:0.5rem;">
                                        <button class="sake-btn-order" data-action="move" data-id="${item.id}" data-dir="up" ${idx === 0 ? 'disabled style="opacity:0.2; cursor:not-allowed;"' : ''}>
                                            <i class="fas fa-arrow-up"></i>
                                        </button>
                                        <button class="sake-btn-order" data-action="move" data-id="${item.id}" data-dir="down" ${idx === que.length - 1 ? 'disabled style="opacity:0.2; cursor:not-allowed;"' : ''}>
                                            <i class="fas fa-arrow-down"></i>
                                        </button>
                                    </div>
                                </div>
                                <div style="margin-top:1.2rem; display:grid; grid-template-columns: 2fr 1fr; gap:0.8rem;">
                                    <button class="sake-btn-action sake-btn-primary" data-action="promote" data-id="${item.id}" data-type="${item.taste_type}" data-name="${item.master?.brand_name}">
                                        <i class="fas fa-play"></i> 現在の提供中にする
                                    </button>
                                    <button class="sake-btn-action sake-btn-secondary" data-action="archive" data-id="${item.id}">
                                        <i class="fas fa-times"></i> 外す
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            ` : ''}
        </div>
    `;
}

// --- MASTER TAB ---
async function renderMasterTab(container) {
    container.innerHTML = `
        <div class="glass-panel" style="background:white; border-radius:20px; padding:1.5rem; border:1px solid var(--sake-border); margin-bottom:2.5rem; box-shadow:0 10px 25px -10px rgba(0,0,0,0.1);">
            <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center;">
                <div style="flex:1; position:relative;">
                    <i class="fas fa-search" style="position:absolute; left:1rem; top:50%; transform:translateY(-50%); color:var(--sake-text-sub);"></i>
                    <input type="text" id="sake-master-search" placeholder="銘柄名、酒蔵、かなで検索..." value="${window.sakeApp.masterSearchQuery}" style="padding:0.9rem 1rem 0.9rem 2.8rem; border-radius:30px; border:1.5px solid var(--sake-border); background:#f8fafc; width:100%; font-size:1rem; font-weight:600;">
                </div>
                <button class="sake-btn-action sake-btn-primary" id="btn-master-new" style="padding:0.9rem 1.8rem; border-radius:30px; box-shadow:0 10px 20px -5px rgba(var(--sake-primary-rgb), 0.3);">
                    <i class="fas fa-plus-circle"></i> 新規銘柄登録
                </button>
            </div>
        </div>
        <div id="sake-master-list-area">
            <div style="padding:4rem; text-align:center;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--sake-primary);"></i></div>
        </div>
    `;

    document.getElementById('btn-master-new').onclick = () => window.sakeApp.openMasterForm();

    const listArea = document.getElementById('sake-master-list-area');
    if (window.sakeApp.masterSakes.length === 0) {
        try {
            const q = query(collection(db, "sake_master"), where("is_deleted", "==", false), orderBy("brand_name"));
            const snap = await getDocs(q);
            window.sakeApp.masterSakes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("Master fetch error:", e);
            if (listArea) {
                listArea.innerHTML = `
                    <div style="padding:2rem; background:#fee2e2; color:#b91c1c; border-radius:12px; margin-top:1rem; text-align:left;">
                        <strong>銘柄マスタの取得に失敗しました:</strong><br>
                        <small style="display:block; margin-top:0.5rem; word-break:break-all;">${e.message}</small>
                        ${e.message.indexOf('index') > -1 ? '<p style="margin-top:0.8rem; font-size:0.8rem; border-top:1px solid #fecaca; padding-top:0.8rem;">※コンソールに表示されているURLからインデックスを作成してください。</p>' : ''}
                    </div>`;
            }
            return; // 描画処理を中断
        }
    }
    renderMasterListArea();
}

function renderMasterListArea() {
    const list = document.getElementById('sake-master-list-area');
    if (!list) return;

    const q = window.sakeApp.masterSearchQuery.toLowerCase();
    const filtered = window.sakeApp.masterSakes.filter(s => 
        (s.brand_name || '').toLowerCase().includes(q) || 
        (s.brewery_name || '').toLowerCase().includes(q) ||
        (s.brand_name_kana || '').toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
        list.innerHTML = `<div style="padding:5rem; text-align:center; color:var(--sake-text-sub); font-weight:700;">一致する銘柄がありません</div>`;
        return;
    }

    list.innerHTML = filtered.map(s => `
        <div class="sake-master-card">
            <img src="${s.image_url || 'https://via.placeholder.com/150'}" class="sake-thumb-md" style="width:100px; height:100px;">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.2rem;">
                            <h4 style="margin:0; font-weight:900; font-size:1.1rem;">${s.brand_name}</h4>
                            <span class="sake-taste-badge sake-taste-${s.default_taste_type || 'balanced'}">
                                ${s.default_taste_type === 'dry' ? '辛口' : s.default_taste_type === 'fruity' ? 'フルーティ' : 'バランス'}
                            </span>
                        </div>
                        <div style="font-size:0.8rem; font-weight:700; color:var(--sake-text-sub);">${s.brewery_name} (${s.prefecture})</div>
                    </div>
                </div>
                <div style="margin:0.8rem 0; font-size:0.85rem; font-weight:700; color:var(--sake-primary); background:rgba(var(--sake-primary-rgb), 0.05); padding:0.4rem 0.8rem; border-radius:8px;">
                    ${s.catch_copy || '（キャッチコピー未登録）'}
                </div>
                <div style="display:flex; gap:0.6rem; margin-top:1rem;">
                    <button class="sake-btn-action sake-btn-primary" style="flex:2;" data-action="add-to-lineup" data-id="${s.id}">
                        <i class="fas fa-layer-plus"></i> ラインナップに入れる
                    </button>
                    <button class="sake-btn-action sake-btn-secondary" style="flex:1;" data-action="edit-master" data-id="${s.id}">
                        <i class="fas fa-edit"></i> 編集
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// --- MODALS & FORMS ---
window.sakeApp.openMasterForm = async (id = null) => {
    window.sakeApp.editingMasterId = id;
    let d = { 
        brand_name:'', brand_name_kana:'', brewery_name:'', prefecture:'', default_taste_type:'balanced', 
        catch_copy:'', short_description:'', image_url:'', image_path:'',
        detail_description:'', rice_type:'', sake_meter_value:'', polishing_ratio:'', alcohol_percentage:'', pairing_notes:'', tags:'', is_published: true
    };
    
    if (id) {
        const s = await getDoc(doc(db, "sake_master", id));
        if (s.exists()) d = { ...d, ...s.data() };
    }

    const area = document.getElementById('sake-tab-content-area');
    area.innerHTML = `
        <div class="glass-panel" style="max-width:800px; margin:0 auto; padding:2rem; background:white; border-radius:24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; border-bottom:1px solid #f1f5f9; padding-bottom:1rem;">
                <h2 style="margin:0; font-weight:900;"><i class="fas fa-pen-nib"></i> ${id ? '銘柄を編集' : '新規銘柄を登録'}</h2>
                <button class="sake-btn-order" onclick="window.sakeApp.switchTab('master')"><i class="fas fa-times"></i></button>
            </div>
            
            <form id="sake-form-el">
                <!-- Section 1: Basic Information -->
                <div class="sake-form-section">
                    <div class="sake-form-section-title"><i class="fas fa-info-circle"></i> 基本プロファイル</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1.2rem;">
                        <div class="sake-input-group">
                            <label>銘柄名 (必須)</label>
                            <input type="text" id="fm-name" required value="${d.brand_name || ''}" placeholder="例：楯野川">
                        </div>
                        <div class="sake-input-group">
                            <label>銘柄名・かな</label>
                            <input type="text" id="fm-kana" value="${d.brand_name_kana || ''}" placeholder="たてのかわ">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:1.2rem;">
                        <div class="sake-input-group">
                            <label>酒蔵名</label>
                            <input type="text" id="fm-brewery" value="${d.brewery_name || ''}" placeholder="楯の川酒造">
                        </div>
                        <div class="sake-input-group">
                            <label>都道府県</label>
                            <input type="text" id="fm-pref" value="${d.prefecture || ''}" placeholder="山形県">
                        </div>
                    </div>
                </div>

                <!-- Section 2: Visual & Copy -->
                <div class="sake-form-section">
                    <div class="sake-form-section-title"><i class="fas fa-star"></i> キャッチコピー & 比率</div>
                    <div class="sake-input-group">
                        <label>一言キャッチコピー (20〜50文字程度)</label>
                        <input type="text" id="fm-copy" value="${d.catch_copy || ''}" placeholder="究極の透明感がある純米大吟醸。ワイングラスで。">
                    </div>
                    <div class="sake-input-group">
                        <label>簡易説明 (スタッフ説明用)</label>
                        <textarea id="fm-short-desc" rows="2" placeholder="スタッフがお客様に説明する際のポイント">${d.short_description || ''}</textarea>
                    </div>
                    <div style="display:flex; gap:1.5rem; align-items:center; background:#f8fafc; padding:1.2rem; border-radius:16px; border:1.5px dashed var(--sake-border); margin-top:1rem;">
                        <img id="fm-prev" src="${d.image_url || 'https://via.placeholder.com/200'}" style="width:100px; height:100px; object-fit:cover; border-radius:12px; border:2px solid white; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.8rem; font-weight:800; margin-bottom:0.5rem;">ラベル画像</label>
                            <input type="file" id="fm-file" accept="image/*" style="font-size:0.85rem;">
                        </div>
                    </div>
                </div>

                <!-- Section 3: Specs & Pairing -->
                <div class="sake-form-section">
                    <div class="sake-form-section-title"><i class="fas fa-vial"></i> 詳細スペック・ペアリング</div>
                    <div class="sake-input-group">
                        <label>推奨の系統</label>
                        <select id="fm-taste-def" required>
                            <option value="dry" ${d.default_taste_type==='dry'?'selected':''}>辛口 (Dry)</option>
                            <option value="balanced" ${d.default_taste_type==='balanced'?'selected':''}>バランス (Balanced)</option>
                            <option value="fruity" ${d.default_taste_type==='fruity'?'selected':''}>フルーティ (Fruity)</option>
                            <option value="rich" ${d.default_taste_type==='rich'?'selected':''}>芳醇・濃醇 (Rich)</option>
                        </select>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:1rem; margin-top:1rem;">
                        <div class="sake-input-group">
                            <label>酒米</label>
                            <input type="text" id="fm-rice" value="${d.rice_type || ''}" placeholder="山田錦">
                        </div>
                        <div class="sake-input-group">
                            <label>日本酒度</label>
                            <input type="number" step="0.5" id="fm-smv" value="${d.sake_meter_value || ''}">
                        </div>
                        <div class="sake-input-group">
                            <label>精米歩合(%)</label>
                            <input type="number" id="fm-polish" value="${d.polishing_ratio || ''}">
                        </div>
                        <div class="sake-input-group">
                            <label>Alc(%)</label>
                            <input type="number" step="0.1" id="fm-alc" value="${d.alcohol_percentage || ''}">
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-top:1rem;">
                         <div class="sake-input-group">
                            <label>酸度</label>
                            <input type="number" step="0.1" id="fm-acidity" value="${d.acidity || ''}">
                        </div>
                        <div class="sake-input-group">
                            <label>おすすめ温度</label>
                            <input type="text" id="fm-temp" value="${d.recommended_temp || ''}" placeholder="冷酒, ぬる燗">
                        </div>
                    </div>

                    <div class="sake-input-group" style="margin-top:1rem;">
                        <label>ペアリング (おすすめの料理)</label>
                        <textarea id="fm-pairs" rows="2" placeholder="お刺身、白身魚の西京焼きなど">${d.pairing_notes || ''}</textarea>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-top:1rem;">
                        <div class="sake-input-group">
                            <label>タグ (カンマ区切り)</label>
                            <input type="text" id="fm-tags" value="${d.tags || ''}" placeholder="スパークリング, 山廃, 生原酒">
                        </div>
                        <div class="sake-input-group">
                            <label>公開状態</label>
                            <select id="fm-pub">
                                <option value="true" ${d.is_published?'selected':''}>公開</option>
                                <option value="false" ${!d.is_published?'selected':''}>非公開</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="sake-input-group" style="margin-top:1rem;">
                        <label>詳細な味わいの解説 (長文)</label>
                        <textarea id="fm-detail-desc" rows="4" placeholder="香り、アタック、後半のキレなどより詳細な情報">${d.detail_description || ''}</textarea>
                    </div>
                </div>

                <div style="margin-top:3rem; display:flex; flex-direction:column; gap:1rem;">
                    <button type="submit" class="sake-btn-action sake-btn-primary" style="padding:1.2rem; font-size:1.1rem; border-radius:16px;">
                        <i class="fas fa-save"></i> マスタに保存する
                    </button>
                    ${id ? `
                        <button type="button" id="fm-delete-btn" class="sake-btn-action sake-btn-danger-outline" style="padding:0.8rem;">
                            <i class="fas fa-trash-alt"></i> この銘柄をマスタから削除
                        </button>
                    ` : ''}
                </div>
            </form>
        </div>
    `;

    // Local Listeners for Form
    const fIn = document.getElementById('fm-file');
    fIn.onchange = (e) => {
        const f = e.target.files[0];
        if (f) {
            const r = new FileReader();
            r.onload = (re) => document.getElementById('fm-prev').src = re.target.result;
            r.readAsDataURL(f);
        }
    };

    if (id) {
        document.getElementById('fm-delete-btn').onclick = () => window.sakeApp.deleteMaster(id);
    }

    document.getElementById('sake-form-el').onsubmit = async (e) => {
        e.preventDefault();
        const subBtn = e.target.querySelector('button[type="submit"]');
        subBtn.disabled = true; subBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        
        try {
            let u = d.image_url, p = d.image_path;
            const f = fIn.files[0];
            if (f) {
                try {
                    // 倉庫(Storage)ではなく、画像を圧縮してデータとして直接DBに保存する方式に変更
                    // これによりCORS等の複雑な設定が不要になります
                    const base64Data = await resizeImage(f, 600); 
                    u = base64Data;
                    p = null; // Storageは使わないためパスは不要
                } catch (imgErr) {
                    console.error("Image process error:", imgErr);
                    showAlert("画像エラー", "画像の処理に失敗しました: " + imgErr.message);
                    return; 
                }
            }

            const m = {
                brand_name: document.getElementById('fm-name').value.trim(),
                brand_name_kana: document.getElementById('fm-kana').value.trim(),
                brewery_name: document.getElementById('fm-brewery').value.trim(),
                prefecture: document.getElementById('fm-pref').value.trim(),
                default_taste_type: document.getElementById('fm-taste-def').value,
                catch_copy: document.getElementById('fm-copy').value.trim(),
                short_description: document.getElementById('fm-short-desc').value.trim(),
                
                detail_description: document.getElementById('fm-detail-desc').value.trim(),
                rice_type: document.getElementById('fm-rice').value.trim(),
                sake_meter_value: parseFloat(document.getElementById('fm-smv').value) || null,
                polishing_ratio: parseInt(document.getElementById('fm-polish').value) || null,
                alcohol_percentage: parseFloat(document.getElementById('fm-alc').value) || null,
                acidity: parseFloat(document.getElementById('fm-acidity').value) || null,
                recommended_temp: document.getElementById('fm-temp').value.trim(),
                pairing_notes: document.getElementById('fm-pairs').value.trim(),
                tags: document.getElementById('fm-tags').value.trim(),
                is_published: document.getElementById('fm-pub').value === 'true',
                
                image_url: u,
                image_path: p,
                updated_at: serverTimestamp()
            };

            if (id) {
                await updateDoc(doc(db, "sake_master", id), m);
            } else {
                m.created_at = serverTimestamp();
                m.is_deleted = false;
                await addDoc(collection(db, "sake_master"), m);
            }

            showAlert("成功", "マスタを更新しました");
            window.sakeApp.masterSakes = []; // Refresh cache
            window.sakeApp.switchTab('master');
        } catch (err) {
            showAlert("Error", err.message);
        } finally {
            subBtn.disabled = false; subBtn.innerHTML = '<i class="fas fa-save"></i> マスタに保存する';
        }
    };
};

window.sakeApp.deleteMaster = (id) => {
    showConfirm("削除確認", "マスタから完全に削除します（過去の履歴からも消えます）。よろしいですか？", async () => {
        try {
            await updateDoc(doc(db, "sake_master", id), { is_deleted: true, updated_at: serverTimestamp() });
            showAlert("成功", "削除しました");
            window.sakeApp.masterSakes = [];
            window.sakeApp.switchTab('master');
        } catch (e) { showAlert("Error", e.message); }
    });
};

// --- ACTIONS ---

async function setupSakeGlobalDelegation() {
    const root = document.getElementById('daily-sakes-root');
    if (!root) return;
    
    // Explicitly unbind old if any
    root.onclick = async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) {
            // Check for tab buttons
            const tabBtn = e.target.closest('.sake-tab-btn');
            if (tabBtn) window.sakeApp.switchTab(tabBtn.dataset.tab);
            return;
        }

        const action = target.dataset.action;
        const id = target.dataset.id;
        
        // Anti-double action
        if (target.disabled) return;
        
        if (action === 'archive') {
            handleArchiveSlot(id, target);
        } else if (action === 'move') {
            handleMoveOrder(id, target.dataset.dir, target);
        } else if (action === 'promote') {
            handlePromoteToCurrent(id, target.dataset.type, target.dataset.name, target);
        } else if (action === 'add-to-lineup') {
            handleOpenAddModal(id);
        } else if (action === 'edit-master') {
            window.sakeApp.openMasterForm(id);
        } else if (action === 'commit-add') {
            handleCommitAdd(id, target.dataset.taste);
        } else if (action === 'close-modal') {
            // 背景クリック（e.targetがtargetそのもの）か、ボタンのクリックであれば閉じる
            if (e.target === target || target.tagName === 'BUTTON') {
                document.getElementById('sake-modal-portal').innerHTML = '';
            }
        }
    };
}

async function handleMoveOrder(id, dir, btn) {
    btn.disabled = true;
    try {
        const item = window.sakeApp.dailySnapshots.find(s => s.id === id);
        if (!item) {
            console.warn("handleMoveOrder: item not found in state.", id);
            btn.disabled = false;
            return;
        }
        const group = window.sakeApp.dailySnapshots
            .filter(s => s.taste_type === item.taste_type)
            .sort((a,b) => a.display_order - b.display_order);
        
        const myIndex = group.findIndex(s => s.id === id);
        const targetIndex = dir === 'up' ? myIndex - 1 : myIndex + 1;
        
        if (targetIndex >= 0 && targetIndex < group.length) {
            const swap = group[targetIndex];
            const batch = writeBatch(db);
            batch.update(doc(db, "daily_sake_slots", id), { display_order: swap.display_order, updated_at: serverTimestamp() });
            batch.update(doc(db, "daily_sake_slots", swap.id), { display_order: item.display_order, updated_at: serverTimestamp() });
            await batch.commit();
            await renderSakeAppTab();
        }
    } catch (e) { 
        showAlert("順序変更エラー", e.message); 
    } finally { 
        btn.disabled = false; 
    }
}

async function handlePromoteToCurrent(id, type, name, btn) {
    showConfirm("提供の切替", `「${name}」を提供中にしますか？\n現在公開中の銘柄は、順番待ちの最後尾に送られます。`, async () => {
        btn.disabled = true;
        try {
            const batch = writeBatch(db);
            const storeId = window.appState?.currentUser?.StoreID || 'honten';
            if (!storeId || !type) {
                console.warn("handlePromoteToCurrent: missing parameters.", { storeId, type });
                btn.disabled = false;
                return;
            }
            const q = query(collection(db, "daily_sake_slots"), where("store_id","==",storeId), where("taste_type","==",type), where("is_deleted","==",false), where("is_archived","==",false), orderBy("display_order","desc"));
            const items = (await getDocs(q)).docs.map(d => ({id:d.id, ...d.data()}));
            
            if (items.length > 0) {
                const maxOrder = items[0].display_order;
                const oldCurrent = items.find(i => i.display_order === 1);
                
                if (oldCurrent && oldCurrent.id !== id) {
                    batch.update(doc(db, "daily_sake_slots", oldCurrent.id), { display_order: maxOrder + 1, updated_at: serverTimestamp() });
                }
                
                // Now, we need to shift others up to fill the gap of the promoted one
                const promotedItem = items.find(i => i.id === id);
                items.forEach(it => {
                    if (it.display_order > promotedItem.display_order) {
                        batch.update(doc(db, "daily_sake_slots", it.id), { display_order: it.display_order - 1 });
                    }
                });

                batch.update(doc(db, "daily_sake_slots", id), { display_order: 1, updated_at: serverTimestamp() });
                await batch.commit();
                await renderSakeAppTab();
            }
        } catch (e) { showAlert("切替エラー", e.message); }
        finally { btn.disabled = false; }
    });
}

async function handleArchiveSlot(id, btn) {
    showConfirm("提供終了", "この銘柄をラインナップから外します。後ろの順番は自動的に繰り上がります。よろしいですか？", async () => {
        btn.disabled = true;
        try {
            const item = window.sakeApp.dailySnapshots.find(s => s.id === id);
            if (!item) {
                console.warn("handleArchiveSlot: item not found in state.", id);
                btn.disabled = false;
                return;
            }
            const batch = writeBatch(db);
            
            // Re-order followers
            const followers = window.sakeApp.dailySnapshots.filter(s => s.taste_type === item.taste_type && s.display_order > item.display_order);
            followers.forEach(f => {
                batch.update(doc(db, "daily_sake_slots", f.id), { display_order: f.display_order - 1 });
            });
            
            batch.update(doc(db, "daily_sake_slots", id), { is_archived: true, updated_at: serverTimestamp() });
            await batch.commit();
            await renderSakeAppTab();
        } catch (e) { showAlert("アーカイブエラー", e.message); }
        finally { btn.disabled = false; }
    });
}

function handleOpenAddModal(sakeId) {
    const portal = document.getElementById('sake-modal-portal');
    portal.innerHTML = `
        <div class="sake-modal-overlay" data-action="close-modal">
            <div class="glass-panel" style="max-width:380px; width:100%; padding:2.5rem; text-align:center; background:white; border-radius:30px; box-shadow:0 30px 60px rgba(0,0,0,0.2);">
                <div style="font-size:2.5rem; color:var(--sake-primary); margin-bottom:1rem;"><i class="fas fa-plus-circle"></i></div>
                <h3 style="margin-bottom:0.5rem; font-weight:900;">追加先を選択</h3>
                <p style="font-size:0.85rem; color:var(--sake-text-sub); margin-bottom:2rem;">どの味わい系統の順番待ちに追加しますか？</p>
                <div style="display:flex; flex-direction:column; gap:0.8rem;">
                    <button class="sake-btn-action" style="background:#fee2e2; color:#dc2626; border:2px solid #fecaca;" data-action="commit-add" data-id="${sakeId}" data-taste="dry">辛口 (Dry)</button>
                    <button class="sake-btn-action" style="background:#f0fdf4; color:#16a34a; border:2px solid #dcfce7;" data-action="commit-add" data-id="${sakeId}" data-taste="balanced">バランス (Balanced)</button>
                    <button class="sake-btn-action" style="background:#f0f9ff; color:#0369a1; border:2px solid #e0f2fe;" data-action="commit-add" data-id="${sakeId}" data-taste="fruity">フルーティ (Fruity)</button>
                    <button class="sake-btn-action sake-btn-secondary" style="margin-top:0.5rem;" data-action="close-modal">キャンセル</button>
                </div>
            </div>
        </div>
    `;
}

async function handleCommitAdd(sakeId, taste) {
    const loader = showLoader();
    document.getElementById('sake-modal-portal').innerHTML = '';
    try {
        const storeId = window.appState?.currentUser?.StoreID || 'honten';
        if (!storeId || !sakeId || !taste) {
            console.warn("handleCommitAdd: missing parameters.", { storeId, sakeId, taste });
            return;
        }

        const q = query(
            collection(db, "daily_sake_slots"), 
            where("store_id","==",storeId), 
            where("taste_type","==",taste), 
            where("is_deleted","==",false), 
            where("is_archived","==",false), 
            orderBy("display_order","desc")
        );
        const snap = await getDocs(q);
        let nextOrder = 1;
        if (!snap.empty) {
            nextOrder = snap.docs[0].data().display_order + 1;
        }

        await addDoc(collection(db, "daily_sake_slots"), {
            sake_id: sakeId,
            store_id: storeId,
            taste_type: taste,
            display_order: nextOrder,
            is_active: true,
            is_archived: false,
            is_deleted: false,
            assigned_at: serverTimestamp(),
            assigned_by: window.appState?.currentUser?.id || 'unknown'
        });
        showAlert("成功", "ラインナップの最後尾に登録しました！");
        window.sakeApp.switchTab('lineup');
    } catch (e) { showAlert("追加エラー", e.message); }
    finally { loader.remove(); }
}

// --- UTILS ---
function resizeImage(file, maxWidth) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
        reader.onload = (event) => {
            const img = new Image();
            img.onerror = () => reject(new Error("画像の読み込みに失敗しました。ファイル形式が不正な可能性があります。"));
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Base64形式の文字列（DataURL）として書き出し
                // 画質を適度に落とす(0.7)ことでデータ量を節約しつつ美しさを維持
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}
