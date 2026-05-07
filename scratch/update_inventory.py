
import sys

path = '/Users/shoheikaneko/Desktop/antigravity_かね将ポータル/inventory_mobile.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_func = """async function loadStoreInventory(internalCode) {
    if (!internalCode) {
        console.warn(\"loadStoreInventory called without internalCode\");
        return;
    }

    // 既存のリスナーがあれば解除（二重登録防止）
    if (inventoryUnsubscribe) {
        inventoryUnsubscribe();
        inventoryUnsubscribe = null;
    }

    const main = document.getElementById('inv-main-content');
    if (main) main.innerHTML = `<div style=\"text-align:center; padding: 4rem;\"><i class=\"fas fa-spinner fa-spin\" style=\"font-size: 2rem; color: var(--primary);\"></i><p style=\"margin-top:1rem; font-weight:600;\">データを取得中...</p></div>`;

    console.log(\"Setting up real-time listener for store:\", internalCode);
    
    return new Promise((resolve, reject) => {
        const q = query(collection(db, \"m_store_items\"), where(\"StoreID\", \"==\", internalCode));
        
        let isFirstLoad = true;

        inventoryUnsubscribe = onSnapshot(q, async (snap) => {
            console.log(\"Inventory snapshot received. Items:\", snap.size);
            
            const newData = [];
            snap.forEach(d => {
                newData.push({ id: d.id, ...d.data() });
            });
            
            // グローバル変数を更新
            inventoryData = newData;

            // 初回のみ理論在庫を計算（重い処理のため）
            if (isFirstLoad) {
                try {
                    await loadTheoreticalStocks(internalCode);
                } catch (stockErr) {
                    console.error(\"Theoretical stock calculation failed:\", stockErr);
                }
                isFirstLoad = false;
                resolve();
            }

            // 描画（リロードなしで最新状態にする）
            render();
            
        }, (err) => {
            console.error(\"Error in real-time listener:\", err);
            if (main && isFirstLoad) {
                main.innerHTML = `
                    <div style=\"text-align:center; padding: 3rem; color: #ef4444;\">
                        <i class=\"fas fa-exclamation-triangle\" style=\"font-size: 2rem; margin-bottom: 1rem;\"></i>
                        <p>リアルタイム同期の開始に失敗しました</p>
                        <p style=\"font-size: 0.7rem; color: #94a3b8; margin-top: 0.5rem;\">${err.message}</p>
                        <button onclick=\"location.reload()\" class=\"btn btn-secondary\" style=\"margin-top: 1rem;\">再読み込み</button>
                    </div>
                `;
            }
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
    lines[start_line:end_line+1] = [new_func + '\n']
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"Successfully updated loadStoreInventory at lines {start_line+1}-{end_line+1}")
else:
    print(f"Could not find function bounds: {start_line}-{end_line}")
    sys.exit(1)
