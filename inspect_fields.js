import { db } from './firebase.js';
import { collection, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function inspect() {
    const targets = ['m_products', 'm_ingredients', 'M_Ingredients', 'Products', 'm_items'];
    for (const coll of targets) {
        try {
            const snap = await getDocs(query(collection(db, coll), limit(1)));
            if (snap.empty) {
                console.log(`[${coll}] is empty or does not exist.`);
                continue;
            }
            console.log(`--- ${coll} Sample ---`);
            snap.forEach(d => console.log(JSON.stringify({ id: d.id, ...d.data() }, null, 2)));
        } catch (e) {
            console.log(`[${coll}] Error: ${e.message}`);
        }
    }
}
inspect();
