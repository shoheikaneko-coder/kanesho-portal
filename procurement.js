import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { calculateAllTheoreticalStocks } from './stock_logic.js';

export const procurementPageHtml = `
    <div id="procurement-app" class="animate-fade-in" style="max-width: 1000px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h3 style="color: var(--text-secondary); margin: 0;">仕入れ（買い物リスト）</h3>
                <p style="font-size: 0.9rem; margin-top: 0.5rem; color: var(--text-secondary);">棚卸データとダイニー売上（出数）から算出された理論在庫に基づき、不足品を表示します。</p>
            </div>
            <button id="btn-refresh-procurement" class="btn btn-secondary"><i class="fas fa-sync-alt"></i> 更新</button>
        </div>
        
        <div class="glass-panel" style="padding: 1.5rem; overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border); text-align: left;">
                        <th style="padding: 1rem;">店舗</th>
                        <th style="padding: 1rem;">品目</th>
                        <th style="padding: 1rem; text-align: center;">現在庫</th>
                        <th style="padding: 1rem; text-align: center;">定数</th>
                        <th style="padding: 1rem; text-align: center;">不足数</th>
                        <th style="padding: 1rem; width: 150px;">購入数</th>
                        <th style="padding: 1rem;">操作</th>
                    </tr>
                </thead>
                <tbody id="procurement-list-body">
                    <tr>
                        <td colspan="7" style="text-align:center; padding: 3rem; color: var(--text-secondary);">
                            <i class="fas fa-spinner fa-spin"></i> データを読み込み中...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Purchase Loading Overlay -->
        <div id="proc-loading-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.7); z-index:1000; justify-content:center; align-items:center;">
             <div class="glass-panel" style="padding: 2rem; text-align:center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top:1rem; font-weight:600;">購入処理中...</p>
             </div>
        </div>
    </div>
`;

// Master data
let productMap = {};
let storeMapByCode = {};
let cachedMenusForProc = [];
let cachedItemsForProc = [];

export async function initProcurementPage() {
    console.log("Procurement page initialized");
    await loadMasterData();
    await fetchProcurementList();
    
    document.getElementById('btn-refresh-procurement').onclick = fetchProcurementList;
}

async function loadMasterData() {
    try {
        // 1. Items
        const itemSnap = await getDocs(collection(db, "m_items"));
        productMap = {};
        itemSnap.forEach(d => {
            const data = d.data();
            productMap[d.id] = data.name || data.Name || d.id;
        });

        // 2. Stores (Master source for names)
        const storeSnap = await getDocs(collection(db, "m_stores"));
        storeMapByCode = {};
        storeSnap.forEach(d => {
            const s = d.data();
            if (s.store_id) {
                storeMapByCode[s.store_id] = s.store_name || s.Name || s.store_id;
            }
        });

        // 3. Menus for stock calculation
        const menuSnap = await getDocs(collection(db, "m_menus"));
        cachedMenusForProc = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        cachedItemsForProc = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    } catch (err) {
        console.error("Error loading master data for procurement:", err);
    }
}

async function fetchProcurementList() {
    const tbody = document.getElementById('procurement-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 3rem;"><i class="fas fa-spinner fa-spin"></i> データを読み込み中...</td></tr>';

    try {
        const invSnap = await getDocs(collection(db, "m_store_items"));
        const invItems = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // 店舗ごとに理論在庫を算出
        const uniqueStoreCodes = [...new Set(invItems.map(i => i.StoreID))].filter(c => c);
        const theoryCacheByStore = {};
        
        const masterCache = { 
            items: cachedItemsForProc, 
            menus: cachedMenusForProc,
            ingredients: [] // Consistent with inventory.js
        };
        for (const sCode of uniqueStoreCodes) {
            theoryCacheByStore[sCode] = await calculateAllTheoreticalStocks(sCode, masterCache);
        }

        let shortfallItems = [];
        invItems.forEach(data => {
            const theoryStock = theoryCacheByStore[data.StoreID]?.[data.ProductID] ?? (data.個数 || 0);
            const target = data.定数 || 0;
            
            if (theoryStock < target) {
                shortfallItems.push({ 
                    ...data, 
                    currentTheory: theoryStock,
                    shortfall: Number(target) - Number(theoryStock) 
                });
            }
        });

        if (shortfallItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 4rem; color: var(--text-secondary);">現在、仕入れが必要な品目はありません。<br><i class="fas fa-check-circle" style="font-size: 2rem; color: #10B981; margin-top: 1rem;"></i></td></tr>';
            return;
        }

        // Sort by Store then Product
        shortfallItems.sort((a, b) => (a.StoreID || '').localeCompare(b.StoreID || ''));

        let html = '';
        shortfallItems.forEach(item => {
            const storeName = storeMapByCode[item.StoreID] || item.StoreID || '不明';
            const productName = productMap[item.ProductID] || `商品 (${item.ProductID})`;
            
            html += `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 1rem; font-weight: 500;">${storeName}</td>
                    <td style="padding: 1rem;">${productName}</td>
                    <td style="padding: 1rem; text-align: center;"><span style="color: var(--primary); font-weight: 600;">${item.currentTheory.toFixed(1)}</span></td>
                    <td style="padding: 1rem; text-align: center; color: var(--text-secondary);">${item.定数 || 0}</td>
                    <td style="padding: 1rem; text-align: center;"><span style="color: var(--danger); font-weight: 700;">${item.shortfall.toFixed(1)}</span></td>
                    <td style="padding: 1rem;">
                        <input type="number" class="purchase-qty-input" data-id="${item.id}" step="0.1" value="${item.shortfall.toFixed(1)}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                    </td>
                    <td style="padding: 1rem;">
                        <button class="btn btn-primary btn-sm btn-submit-purchase" data-id="${item.id}" style="padding: 0.5rem 1rem;">
                            <i class="fas fa-plus"></i> 購入
                        </button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // Attach listeners
        tbody.querySelectorAll('.btn-submit-purchase').forEach(btn => {
            btn.onclick = async () => {
                const docId = btn.dataset.id;
                const input = tbody.querySelector(`.purchase-qty-input[data-id="${docId}"]`);
                const qty = Number(input.value);
                if (qty > 0) {
                    await processPurchase(docId, qty);
                } else {
                    alert("購入数には0より大きい数値を入力してください。");
                }
            };
        });

    } catch (err) {
        console.error("Error fetching procurement list:", err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 3rem; color: var(--danger);">リストの取得に失敗しました。</td></tr>';
    }
}

async function processPurchase(invDocId, purchasedQty) {
    const overlay = document.getElementById('proc-loading-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        const docRef = doc(db, "m_store_items", invDocId);
        const currentDoc = await getDoc(docRef);
        const currentData = currentDoc.data();
        const oldQty = currentData.個数 || 0;
        const newQty = Number(oldQty) + Number(purchasedQty);

        // 2. Update Inventory
        await updateDoc(docRef, { 個数: newQty });

        // 3. Log Purchase
        await addDoc(collection(db, "t_procurement_history"), {
            InventoryID: invDocId,
            StoreID: currentData.StoreID,
            ProductID: currentData.ProductID,
            PurchasedQty: purchasedQty,
            OldStock: oldQty,
            NewStock: newQty,
            Timestamp: new Date().toISOString(),
            StaffEmail: 'admin@kaneshow.jp'
        });

        // 4. Update UI
        await fetchProcurementList();
        
    } catch (err) {
        console.error("Purchase error:", err);
        alert("購入処理中にエラーが発生しました。");
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}
