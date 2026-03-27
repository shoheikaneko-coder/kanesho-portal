import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * 理論在庫計算ユーティリティ
 */

/**
 * 理論在庫計算ユーティリティ
 */

/**
 * 指定したアイテム（料理または食材）を一定量作った/売った際に消費される
 * 全ての素原材料（末端の食材）の合計を再帰的に計算する
 * @param {string} itemId 
 * @param {number} qty 
 * @param {Object} masterCache {items, ingredients, menus}
 * @returns {Object} { ingredientId: totalConsumedQty }
 */
function getRecursiveConsumption(itemId, qty, masterCache) {
    const consumed = {};
    const menu = masterCache.menus.find(m => m.item_id === itemId);
    
    if (menu && menu.recipe && menu.recipe.length > 0) {
        // レシピがある場合（料理または自家製食材）
        menu.recipe.forEach(ri => {
            const subConsumed = getRecursiveConsumption(ri.ingredient_id, ri.quantity * qty, masterCache);
            for (const [id, amount] of Object.entries(subConsumed)) {
                consumed[id] = (consumed[id] || 0) + amount;
            }
        });
    } else {
        // レシピがない場合（末端の原材料）
        consumed[itemId] = (consumed[itemId] || 0) + qty;
    }
    return consumed;
}

/**
 * 指定した店舗の全アイテムの理論在庫を算出する
 * @param {string} storeCode 
 * @param {Object} masterCache {items, ingredients, menus} 
 * @returns {Promise<Object>} { productId: qty }
 */
export async function calculateAllTheoreticalStocks(storeCode, masterCache) {
    const theoreticalStockCache = {};
    try {
        // 1. 全アイテムの直近の棚卸記録を取得
        const logSnap = await getDocs(query(collection(db, "t_inventory_logs"), where("StoreID", "==", storeCode), orderBy("InputAt", "desc")));
        
        const latestLogs = {};
        logSnap.forEach(d => {
            const data = d.data();
            if (!latestLogs[data.ProductID]) latestLogs[data.ProductID] = data;
        });

        // 2. 仕入れ履歴と売上実績を取得
        const [purchaseSnap, salesSnap] = await Promise.all([
            getDocs(query(collection(db, "t_procurement_history"), where("StoreID", "==", storeCode))),
            getDocs(query(collection(db, "t_monthly_sales"), where("store_id", "==", storeCode)))
        ]);

        const purchases = purchaseSnap.docs.map(d => d.data());
        const sales = salesSnap.docs.map(d => d.data());

        // 3. 各アイテムの理論在庫を計算
        masterCache.items.forEach(item => {
            const productId = item.id;
            const lastLog = latestLogs[productId];
            const startQty = lastLog ? lastLog.CountValue : 0;
            const startTime = lastLog ? lastLog.InputAt : "1970-01-01T00:00:00Z";
            const startYM = startTime.substring(0, 7);

            // A. 仕入れ加算 (Timestamp > startTime)
            const totalPurchased = purchases
                .filter(p => p.ProductID === productId && p.Timestamp > startTime)
                .reduce((sum, p) => sum + (p.PurchasedQty || 0), 0);

            // B. 消費減算 (Dinii monthly sales)
            // Note: Since t_monthly_sales is monthly, we can only filter by year_month >= startYM.
            // THIS IS AN APPROXIMATION because daily sales are not in t_monthly_sales.
            const totalConsumed = sales
                .filter(s => s.year_month >= startYM)
                .reduce((sum, s) => {
                    const menu = masterCache.menus.find(m => m.dinii_id === s.dinii_id);
                    if (menu) {
                        const consumptionMap = getRecursiveConsumption(menu.item_id, s.quantity_sold || 0, masterCache);
                        return sum + (consumptionMap[productId] || 0);
                    }
                    return sum;
                }, 0);

            theoreticalStockCache[productId] = startQty + totalPurchased - totalConsumed;
        });

        return theoreticalStockCache;
    } catch (e) {
        console.error("Theoretical stock calc error:", e);
        return {};
    }
}
