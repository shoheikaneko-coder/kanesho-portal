import { db } from './firebase.js';
import { collection, doc, setDoc, getDocs, getDoc, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * Dinii CSV インポートエンジン (v48)
 * 親メニュー(dinii_id)とチョイス(choice_id)を variants 配列に集約して保存します。
 */
export async function processDiniiCSV(text, filename, logFn) {
    const rows = text.split(/\r?\n/).filter(line => line.trim() !== "").map(line => line.split(','));
    const headers = rows[0].map(h => h.trim().replace(/^"/, '').replace(/"$/, ''));
    const dataRows = rows.slice(1).map(r => r.map(c => c.replace(/^"/, '').replace(/"$/, '')));

    // ヘッダーインデックスの取得
    const idx = {
        storeDiniiId: headers.indexOf('店舗ID'),
        diniiId: headers.indexOf('メニューID'),
        menuName: headers.indexOf('メニュー名称'),
        categoryName: headers.indexOf('分類名称'),
        choiceId: headers.indexOf('チョイスID'),
        choiceName: headers.indexOf('チョイス名称'),
        priceExclTax: headers.indexOf('売価(税抜)'),
        quantity: headers.indexOf('出数')
    };

    if (idx.diniiId === -1 || idx.storeDiniiId === -1) {
        logFn("Dinii CSVの形式が正しくありません（メニューIDまたは店舗IDが見つかりません）。", 'red');
        return;
    }

    logFn("Diniiマスタの解析を開始します...");

    // 店舗マスタのキャッシュ (dinii_store_id -> portal_store_id)
    const storeMap = {};
    const storesSnap = await getDocs(collection(db, "m_stores"));
    storesSnap.forEach(d => {
        const s = d.data();
        if (s.dinii_store_id) storeMap[s.dinii_store_id] = s.store_id;
    });

    // メニュー単位でグループ化
    const menuGroups = {}; // storeId_diniiId -> { name, category, storeId, diniiId, variants: [] }

    for (const row of dataRows) {
        const storeDiniiId = row[idx.storeDiniiId];
        const portalStoreId = storeMap[storeDiniiId];
        
        if (!portalStoreId) {
            continue; // 紐付いていない店舗のデータはスキップ
        }

        const diniiId = row[idx.diniiId];
        const key = `${portalStoreId}_${diniiId}`;

        if (!menuGroups[key]) {
            menuGroups[key] = {
                diniiId: diniiId,
                storeId: portalStoreId,
                name: row[idx.menuName],
                category: row[idx.categoryName],
                variants: []
            };
        }

        const choiceId = row[idx.choiceId] || "";
        const variant = {
            choice_id: choiceId,
            choice_name: row[idx.choiceName] || "",
            sales_price: Number(row[idx.priceExclTax]) || 0,
            last_month_sales: Number(row[idx.quantity]) || 0,
            is_primary: choiceId === ""
        };
        
        menuGroups[key].variants.push(variant);
    }

    let createdCount = 0;
    let updatedCount = 0;

    // Firestoreへの書き込み
    for (const key of Object.keys(menuGroups)) {
        const group = menuGroups[key];
        const docId = key; // storeId_diniiId
        
        const menuRef = doc(db, "m_menus", docId);
        const menuSnap = await getDoc(menuRef);
        
        if (menuSnap.exists()) {
            // 既存データの更新
            const existingData = menuSnap.data();
            const updatedVariants = [...(existingData.variants || [])];

            for (const newVar of group.variants) {
                const vIdx = updatedVariants.findIndex(v => v.choice_id === newVar.choice_id);
                if (vIdx > -1) {
                    // 名称、価格、販売数を更新
                    updatedVariants[vIdx].choice_name = newVar.choice_name;
                    updatedVariants[vIdx].sales_price = newVar.sales_price;
                    updatedVariants[vIdx].last_month_sales = newVar.last_month_sales;
                    // レシピは維持
                } else {
                    // 新規バリエーションの追加
                    updatedVariants.push({
                        ...newVar,
                        recipe: [],
                        recipe_status: "pending"
                    });
                }
            }

            await updateDoc(menuRef, {
                variants: updatedVariants,
                updated_at: new Date().toISOString()
            });

            // m_items 名も同期
            if (existingData.item_id) {
                await updateDoc(doc(db, "m_items", existingData.item_id), {
                    name: group.name,
                    category: group.category,
                    updated_at: new Date().toISOString()
                });
            }
            updatedCount++;
        } else {
            // 新規登録
            // 1. m_items 作成
            const itemId = `item_${Date.now()}_${Math.floor(Math.random()*1000)}`;
            const itemData = {
                id: itemId,
                name: group.name,
                category: group.category,
                store_id: group.storeId,
                unit: "個",
                content_amount: 0,
                is_sales_menu: true,
                furigana: "",
                notes: "Diniiインポートにより作成",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            await setDoc(doc(db, "m_items", itemId), itemData);

            // 2. m_menus 作ate
            const variants = group.variants.map(v => ({
                ...v,
                recipe: [],
                recipe_status: "pending"
            }));

            await setDoc(menuRef, {
                item_id: itemId,
                dinii_id: group.diniiId,
                store_id: group.storeId,
                variants: variants,
                is_sub_recipe: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            createdCount++;
        }
    }

    logFn(`インポート完了: 新規 ${createdCount} 件, 更新 ${updatedCount} 件`, 'green');
}
