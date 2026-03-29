import { db } from './firebase.js';
import { collection, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function performRescue() {
    const log = (msg) => {
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        document.body.appendChild(div);
    };

    log('データ救済スクリプトを開始します...');

    try {
        const menusSnap = await getDocs(collection(db, "m_menus"));
        let count = 0;
        
        for (const d of menusSnap.docs) {
            const data = d.data();
            // 条件: is_sub_recipe が undefined または false
            // かつ レシピ(recipe)が存在する 
            // かつ 販売価格が 0 である (自家製の特徴)
            if ((data.is_sub_recipe === undefined || data.is_sub_recipe === false) && 
                data.recipe && data.recipe.length > 0 && (data.sales_price || 0) === 0) {
                
                log(`救済対象を発見: ${d.id}`);
                await updateDoc(doc(db, "m_menus", d.id), {
                    is_sub_recipe: true,
                    updated_at: new Date().toISOString()
                });
                count++;
            }
        }
        
        log(`救済が完了しました。合計 ${count} 件を更新しました。`);
        log('このウィンドウを閉じて、商品マスタをリロードしてください。');
        
    } catch (err) {
        log(`エラーが発生しました: ${err.message}`);
        console.error(err);
    }
}

window.onload = performRescue;
