import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function findPonzu() {
    const log = (msg) => {
        const div = document.createElement('div');
        div.textContent = msg;
        document.body.appendChild(div);
    };

    log('--- Searching for "ポン酢" in m_items ---');

    try {
        const snap = await getDocs(collection(db, "m_items"));
        let found = false;
        snap.forEach(d => {
            const data = d.data();
            if (data.name && data.name.includes('ポン酢')) {
                log(`[FOUND] ID: ${d.id} | Name: ${data.name} | is_sub_recipe: ${data.is_sub_recipe} | UpdatedAt: ${data.updated_at}`);
                found = true;
            }
        });
        if (!found) log('ポン酢は見つかりませんでした。');
        
    } catch (err) {
        log(`Error: ${err.message}`);
    }
}

window.onload = findPonzu;
