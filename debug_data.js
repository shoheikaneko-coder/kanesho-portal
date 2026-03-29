import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function debugData() {
    const log = (msg) => {
        const div = document.createElement('div');
        div.textContent = msg;
        document.body.appendChild(div);
    };

    log('--- Firestore Debug Log ---');

    try {
        const menusSnap = await getDocs(collection(db, "m_menus"));
        log(`m_menus count: ${menusSnap.docs.length}`);
        
        menusSnap.docs.forEach(d => {
            const data = d.data();
            log(`ID: ${d.id} | Name: ${data.name || 'N/A'} | is_sub_recipe: ${data.is_sub_recipe} | sales_price: ${data.sales_price} | recipe: ${data.recipe ? 'YES' : 'NO'}`);
            if (data.recipe) log(`  -> recipe length: ${data.recipe.length}`);
        });
        
    } catch (err) {
        log(`Error: ${err.message}`);
    }
}

window.onload = debugData;
