import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * 原価計算エンジン
 * 仕分けされたアイテム、食材、メニューの情報から、
 * 正味の原価（1単位あたり）やメニュー全体の原価を算出します。
 */

/**
 * アイテムの「実効単価」を取得する（再帰対応）
 * @param {string} itemId 
 * @param {Object} cache {items, ingredients, menus}
 * @param {Set} visiting 再帰ループ検知用
 * @returns {number} 1単位あたりの原価
 */
export function getEffectivePrice(itemId, cache, visiting = new Set()) {
    if (visiting.has(itemId)) {
        console.warn("Recursive recipe detected for item:", itemId);
        return 0;
    }
    visiting.add(itemId);

    // 1. 自家製(sub_recipe)の場合：最新のレシピ構成から再帰計算を行う（最優先）
    const menu = cache.menus.find(m => m.item_id === itemId);
    if (menu && menu.is_sub_recipe && menu.recipe && menu.recipe.length > 0) {
        let totalCost = 0;
        menu.recipe.forEach(ri => {
            const rowPrice = getEffectivePrice(ri.ingredient_id, cache, visiting);
            totalCost += rowPrice * (ri.quantity || 0);
        });
        visiting.delete(itemId);
        // 出来高(yield_amount)で割った1単位あたりのコストを返す
        const yieldAmt = Number(menu.yield_amount) || 1;
        return yieldAmt > 0 ? (totalCost / yieldAmt) : 0;
    }

    // 2. 自家製でない場合：m_ingredients の正味単価(net_unit_price)を優先参照
    const ing = cache.ingredients.find(i => i.item_id === itemId);
    if (ing) {
        if (Number(ing.net_unit_price) > 0) {
            visiting.delete(itemId);
            return Number(ing.net_unit_price);
        }
        // 3. Fallback: 仕入単価 / 歩留 で算出
        if (Number(ing.purchase_price) > 0) {
            visiting.delete(itemId);
            return Number(ing.purchase_price) / Math.max(0.01, Number(ing.yield_rate) || 1.0);
        }
    }

    visiting.delete(itemId);
    return 0;
}

/**
 * メニュー全体の原価と原価率を計算
 * @param {string} menuId item_id または menu_id
 * @param {Object} cache 
 * @returns {Object} {totalCost, ratio}
 */
export function calculateMenuStats(itemId, cache) {
    const menu = cache.menus.find(m => m.item_id === itemId);
    if (!menu) return { totalCost: 0, ratio: 0 };

    const totalCost = getEffectivePrice(itemId, cache);
    const salesPrice = menu.sales_price || 0;
    const ratio = salesPrice > 0 ? (totalCost / salesPrice) * 100 : 0;

    return {
        totalCost,
        salesPrice,
        ratio: Math.round(ratio * 10) / 10
    };
}
