import { db } from './firebase.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 管理する個別メニューの定義
const SPECIAL_FEATURES = [
    { id: 'daily_sakes', name: '日本酒管理', desc: 'その日の日本酒のラインナップや残量を管理する機能' },
    { id: 'bottle_keep', name: 'ボトルキープ', desc: 'お客様のキープボトル配置・期限を管理する機能' }
    // 将来ここに新しい機能を追加するだけでUIが自動対応します
];

export const storeFeaturesAdminPageHtml = `
    <div class="animate-fade-in app-container-fill" style="max-width: 1200px; margin: 0 auto; padding-bottom: 3rem; display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-shrink: 0;">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-store-slash" style="color: var(--primary);"></i>
                    店舗別メニュー設定 (PC専用)
                </h2>
                <p style="margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                    各店舗において有効化する「店舗個別メニュー」をオン・オフで設定します。
                </p>
            </div>
            <button id="save-store-features-btn" class="btn btn-primary" style="padding: 0.8rem 2rem;">
                <i class="fas fa-save" style="margin-right: 0.5rem;"></i> 一括保存
            </button>
        </div>

        <!-- Master-Detail Layout -->
        <div style="display: flex; gap: 1.5rem; flex-grow: 1; min-height: 0;">
            
            <!-- Master: Store List -->
            <div class="glass-panel" style="flex: 0 0 350px; padding: 0; display: flex; flex-direction: column; border: 1px solid var(--border); overflow: hidden;">
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: #f8fafc;">
                    <div class="input-group" style="margin: 0;">
                        <i class="fas fa-search" style="top: 0.8rem;"></i>
                        <input type="text" id="store-search-input" placeholder="店舗名で検索..." style="padding-top: 0.6rem; padding-bottom: 0.6rem; border-radius: 20px;">
                    </div>
                </div>
                <div id="store-list-container" style="flex-grow: 1; overflow-y: auto; background: white;">
                    <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">読み込み中...</div>
                </div>
            </div>

            <!-- Detail: Feature Settings -->
            <div class="glass-panel" style="flex: 1; padding: 0; display: flex; flex-direction: column; border: 1px solid var(--border); overflow: hidden;">
                <div id="feature-detail-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: white; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: var(--primary);">
                        <i class="fas fa-store"></i>
                    </div>
                    <div>
                        <h3 id="detail-store-name" style="margin: 0; font-size: 1.2rem; color: var(--text-primary);">店舗を選択してください</h3>
                        <p id="detail-store-id" style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-secondary);"></p>
                    </div>
                </div>
                
                <div id="feature-detail-container" style="flex-grow: 1; overflow-y: auto; padding: 1.5rem; background: white;">
                    <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); flex-direction: column; gap: 1rem;">
                        <i class="fas fa-hand-point-left" style="font-size: 2rem; color: #cbd5e1;"></i>
                        左のリストから設定を行う店舗を選択してください。
                    </div>
                </div>
            </div>
        </div>
    </div>

    <style>
        .store-list-item {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #f1f5f9;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .store-list-item:hover {
            background: #f8fafc;
        }
        .store-list-item.active {
            background: #eff6ff;
            border-left: 4px solid var(--primary);
        }
        .store-list-item.active .store-name {
            color: var(--primary);
            font-weight: 700;
        }
        
        .feature-setting-item {
            padding: 1.2rem;
            border: 1px solid var(--border);
            border-radius: 12px;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: all 0.2s;
        }
        .feature-setting-item:hover {
            border-color: #cbd5e1;
            box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }

        .feature-toggle {
            appearance: none;
            width: 50px;
            height: 26px;
            background: #cbd5e1;
            border-radius: 13px;
            position: relative;
            cursor: pointer;
            outline: none;
            transition: all 0.3s ease;
        }
        .feature-toggle::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 22px;
            height: 22px;
            background: white;
            border-radius: 50%;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .feature-toggle:checked {
            background: var(--primary);
        }
        .feature-toggle:checked::after {
            transform: translateX(24px);
        }
    </style>
`;

let storesData = [];
let activeStoreId = null;

export async function initStoreFeaturesAdminPage() {
    await loadStoreData();

    const saveBtn = document.getElementById('save-store-features-btn');
    if (saveBtn) {
        saveBtn.onclick = handleSave;
    }
    
    const searchInput = document.getElementById('store-search-input');
    if (searchInput) {
        searchInput.oninput = (e) => {
            renderStoreList(e.target.value);
        };
    }
}

async function loadStoreData() {
    try {
        const querySnapshot = await getDocs(collection(db, "m_stores"));
        storesData = [];
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            storesData.push({
                id: docSnap.id,
                name: data.store_name || data.name || data.Name || docSnap.id,
                features: data.store_features || {}
            });
        });
        
        // 名前でソート
        storesData.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        
        renderStoreList();
    } catch (err) {
        console.error("Error loading stores:", err);
        const container = document.getElementById('store-list-container');
        if(container) container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--danger);">店舗データの読み込みに失敗しました</div>`;
    }
}

function renderStoreList(filterText = "") {
    const container = document.getElementById('store-list-container');
    if (!container) return;

    const filteredStores = storesData.filter(store => 
        store.name.toLowerCase().includes(filterText.toLowerCase()) || 
        store.id.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filteredStores.length === 0) {
        container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">該当する店舗が見つかりません</div>`;
        return;
    }

    let html = '';
    filteredStores.forEach(store => {
        const isActive = store.id === activeStoreId;
        html += `
            <div class="store-list-item ${isActive ? 'active' : ''}" data-id="${store.id}">
                <div>
                    <div class="store-name" style="font-size: 0.95rem; margin-bottom: 0.2rem; color: var(--text-primary);">${store.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-family: monospace;">ID: ${store.id}</div>
                </div>
                <i class="fas fa-chevron-right" style="color: ${isActive ? 'var(--primary)' : '#cbd5e1'}; font-size: 0.8rem;"></i>
            </div>
        `;
    });

    container.innerHTML = html;

    // クリックイベントの付与
    container.querySelectorAll('.store-list-item').forEach(item => {
        item.onclick = () => {
            activeStoreId = item.dataset.id;
            renderStoreList(filterText); // アクティブ状態を更新するため再描画
            renderFeatureDetail();
        };
    });
}

function renderFeatureDetail() {
    const store = storesData.find(s => s.id === activeStoreId);
    if (!store) return;

    document.getElementById('detail-store-name').textContent = store.name;
    document.getElementById('detail-store-id').textContent = `店舗ID: ${store.id}`;

    const container = document.getElementById('feature-detail-container');
    
    let html = `
        <h4 style="margin: 0 0 1.5rem 0; color: var(--text-secondary); font-size: 0.9rem;">
            この店舗で利用可能なメニューのオン/オフを設定します
        </h4>
    `;

    SPECIAL_FEATURES.forEach(feature => {
        const isEnabled = store.features[feature.id] === true;
        html += `
            <div class="feature-setting-item">
                <div>
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 1.05rem; margin-bottom: 0.3rem;">${feature.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${feature.desc}</div>
                </div>
                <div>
                    <input type="checkbox" class="feature-toggle" data-feature="${feature.id}" ${isEnabled ? 'checked' : ''}>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // トグルスイッチのイベント付与
    container.querySelectorAll('.feature-toggle').forEach(toggle => {
        toggle.onchange = (e) => {
            const featureId = e.target.dataset.feature;
            const isChecked = e.target.checked;
            
            // メモリ上の storesData を即座に更新
            if (!store.features) store.features = {};
            store.features[featureId] = isChecked;
        };
    });
}

async function handleSave() {
    const saveBtn = document.getElementById('save-store-features-btn');
    const originalHtml = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    saveBtn.disabled = true;

    try {
        const updates = [];
        
        // メモリ上の storesData はすでにトグル操作で最新化されているため、そのまま全店舗分更新する
        for (const store of storesData) {
            const storeRef = doc(db, "m_stores", store.id);
            updates.push(updateDoc(storeRef, {
                store_features: store.features
            }));
        }

        await Promise.all(updates);
        alert("設定を一括保存しました。");
        
        // アプリケーション全体の状態（appState）も更新し、再読み込みなしで即座にサイドメニュー等へ反映させる
        if (window.appState && activeStoreId === (window.appState.currentUser ? window.appState.currentUser.StoreID : null)) {
             window.appState.storeFeatures = storesData.find(s => s.id === activeStoreId)?.features || {};
             // サイドバー等の再描画が必要であれば、app.js側のグローバル関数を呼ぶなどの設計もあるが、
             // 今回は次回リロードまたは画面遷移時に反映されるため良しとする。
        }

    } catch (err) {
        console.error("Save error:", err);
        alert("保存に失敗しました: " + err.message);
    } finally {
        saveBtn.innerHTML = originalHtml;
        saveBtn.disabled = false;
    }
}
