
import sys

path = '/Users/shoheikaneko/Desktop/antigravity_かね将ポータル/inventory.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Update Imports
for i, line in enumerate(lines):
    if 'import { collection, getDocs' in line:
        if 'onSnapshot' not in line:
            lines[i] = line.replace('getDocs,', 'getDocs, onSnapshot,')
        break

# 2. Add Global Variable
for i, line in enumerate(lines):
    if 'let currentUser = null;' in line:
        if 'let inventoryUnsubscribe = null;' not in lines[i+1]:
            lines.insert(i+1, 'let inventoryUnsubscribe = null;\n')
        break

# 3. Update initInventoryPage
for i, line in enumerate(lines):
    if 'export async function initInventoryPage(user) {' in line:
        if 'if (inventoryUnsubscribe)' not in lines[i+2]:
            lines.insert(i+1, '    // 既存のリスナーがあれば解除\n')
            lines.insert(i+2, '    if (inventoryUnsubscribe) {\n')
            lines.insert(i+3, '        inventoryUnsubscribe();\n')
            lines.insert(i+4, '        inventoryUnsubscribe = null;\n')
            lines.insert(i+5, '    }\n')
        break

# 4. Update loadStoreInventory
new_load_func = """async function loadStoreInventory(internalCode) {
    if (!internalCode) {
        console.warn(\"loadStoreInventory called without internalCode\");
        return;
    }

    // 既存のリスナーがあれば解除
    if (inventoryUnsubscribe) {
        inventoryUnsubscribe();
        inventoryUnsubscribe = null;
    }

    const main = document.getElementById('inv-main-content');
    if (main) main.innerHTML = `<div style=\"text-align:center; padding: 4rem;\"><i class=\"fas fa-spinner fa-spin\" style=\"font-size: 2rem; color: var(--primary);\"></i><p>読み込み中...</p></div>`;

    return new Promise((resolve, reject) => {
        const q = query(collection(db, \"m_store_items\"), where(\"StoreID\", \"==\", internalCode));
        
        let isFirstLoad = true;

        inventoryUnsubscribe = onSnapshot(q, async (snap) => {
            console.log(\"Inventory snapshot received (PC). Items:\", snap.size);
            
            const newData = [];
            snap.forEach(d => {
                newData.push({ id: d.id, ...d.data() });
            });
            
            inventoryData = newData;

            if (isFirstLoad) {
                try {
                    await loadTheoreticalStocks(internalCode);
                } catch (err) {
                    console.error(\"Theoretical stock error:\", err);
                }
                isFirstLoad = false;
                resolve();
            }

            render();
            
        }, (err) => {
            console.error(\"Error in real-time listener (PC):\", err);
            if (isFirstLoad) reject(err);
        });
    });
}
"""

start_line = -1
end_line = -1
for i, line in enumerate(lines):
    if 'async function loadStoreInventory(internalCode)' in line:
        start_line = i
    if start_line != -1 and line.strip() == '}':
        # Check if it's the end of loadStoreInventory (next line is empty or next func)
        if i + 1 < len(lines) and (lines[i+1].strip() == '' or 'function' in lines[i+1]):
             end_line = i
             break

if start_line != -1 and end_line != -1:
    lines[start_line:end_line+1] = [new_load_func + '\n']
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"Successfully updated inventory.js")
else:
    print(f"Could not find loadStoreInventory bounds in inventory.js")
    sys.exit(1)
