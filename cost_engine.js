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

    // 1. 食材マスタ(m_ingredients)の価格を確認
    const ing = cache.ingredients.find(i => i.item_id === itemId);
    if (ing && ing.purchase_price > 0) {
        visiting.delete(itemId);
        // 正味単価 = 仕入れ値 / 歩留
        return (ing.purchase_price || 0) / Math.max(0.01, ing.yield_rate || 1.0);
    }

    // 2. メニューマスタ(m_menus)のレシピから算出（仕込み品/半成品のケース）
    const menu = cache.menus.find(m => m.item_id === itemId);
    if (menu && menu.recipe && menu.recipe.length > 0) {
        let totalCost = 0;
        menu.recipe.forEach(ri => {
            const rowPrice = getEffectivePrice(ri.ingredient_id, cache, visiting);
            totalCost += rowPrice * (ri.quantity || 0);
        });
        visiting.delete(itemId);
        // メニューの原価（1食/1バットあたり等）
        return totalCost;
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
