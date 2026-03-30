import { db } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function inspectDoc() {
    const id = 'item_tq1zrqpsd';
    const log = (msg) => {
        const div = document.createElement('div');
        div.textContent = msg;
        document.body.appendChild(div);
    };

    log(`--- Inspecting ID: ${id} ---`);

    try {
        const itemSnap = await getDoc(doc(db, "m_items", id));
        if (itemSnap.exists()) {
            const data = itemSnap.data();
            log(`[m_items] Name: ${data.name} | UpdatedAt: ${data.updated_at}`);
        } else {
            log(`[m_items] NOT FOUND`);
        }

        const menuSnap = await getDoc(doc(db, "m_menus", id));
        if (menuSnap.exists()) {
            const data = menuSnap.data();
            log(`[m_menus] IsSubRecipe: ${data.is_sub_recipe} | Instructions: ${data.instructions} | UpdatedAt: ${data.updated_at}`);
        } else {
            log(`[m_menus] NOT FOUND`);
        }

    } catch (err) {
        log(`Error: ${err.message}`);
    }
}

window.onload = inspectDoc;
