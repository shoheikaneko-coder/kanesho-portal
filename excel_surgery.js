import { db } from './firebase.js';
import { collection, doc, setDoc, getDocs, writeBatch, deleteDoc, query, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const logEl = document.getElementById('log');
const fileInput = document.getElementById('excel-file');
const runBtn = document.getElementById('run-btn');
const limitChk = document.getElementById('limit-chk');

function log(msg, className = '') {
    const div = document.createElement('div');
    if (className) div.className = className;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
}

// 店舗IDマッピング (旧 -> 新)
const STORE_ID_MAP = {
    'GTB1': 'ID001', // 本店
    'CTB1': 'ID002', // 地下
    // 必要に応じて追加。Excelの M_Stores シートがあればそこから自動取得も検討
};

let workbook = null;

fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('file-name').textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        workbook = XLSX.read(data, { type: 'array' });
        log(`Excelファイルを読み込みました: ${workbook.SheetNames.join(', ')}`, 'log-info');
        runBtn.disabled = false;
    };
    reader.readAsArrayBuffer(file);
};

const confirmModal = document.getElementById('confirm-modal');
const modalOk = document.getElementById('modal-ok');
const modalCancel = document.getElementById('modal-cancel');

if (runBtn) {
    runBtn.onclick = () => {
        log('--- 手順ボタンがクリックされました ---', 'log-info');
        if (confirmModal) confirmModal.style.display = 'flex';
    };
}

if (modalCancel) {
    modalCancel.onclick = () => {
        log('キャンセルされました', 'log-warn');
        if (confirmModal) confirmModal.style.display = 'none';
    };
}

if (modalOk) {
    modalOk.onclick = async () => {
        if (confirmModal) confirmModal.style.display = 'none';
        if (runBtn) runBtn.disabled = true;
        log('=== マスタ再構築 (外科手術) 開始 ===', 'log-head');

    try {
        const isLimited = limitChk.checked;
        if (isLimited) log('※ 5件のみのテスト実行モードです', 'log-warn');

        // 安全なシート取得関数
        const getSheetData = (names) => {
            for (const name of names) {
                if (workbook.Sheets[name]) {
                    log(`シート [${name}] を読み込みました`, 'log-info');
                    return XLSX.utils.sheet_to_json(workbook.Sheets[name]);
                }
            }
            log(`警告: シート [${names[0]}] 等が見つかりません`, 'log-warn');
            return [];
        };

        // 1. 各シートの取得
        const sheets = {
            ing: getSheetData(['m_ingredients']),
            prod: getSheetData(['Products']),
            inv: getSheetData(['Inventory']),
            loc: getSheetData(['M_保管場所']),
            timing: getSheetData(['M_確認タイミング']),
            stores: getSheetData(['M_Stores']),
        };

        if (sheets.ing.length === 0 && sheets.prod.length === 0) {
            throw new Error('マスタデータが見つかりません。シート名を確認してください。');
        }

        // 2. アイテムマスタ (m_items) の構築
        log('STEP 1: アイテムマスタの生成中...', 'log-info');
        const oldIdToNewId = {}; // 数値ID (ProductID/ingredient_id) -> 新しい文字列ID
        const nameToNewId = {};  // 名前 -> 新しい文字列ID
        const consolidatedItems = {}; // newId -> data

        // m_ingredients 処理
        sheets.ing.forEach(ing => {
            const name = ing['name'];
            const oldId = ing['ingredient_id'];
            if (!name) return;
            
            const newId = `item_${Math.random().toString(36).substr(2, 9)}`;
            if (oldId) oldIdToNewId[String(oldId)] = newId;
            nameToNewId[name] = newId;

            consolidatedItems[newId] = {
                name: name,
                category: ing['category'] || '未分類',
                unit: ing['unit'] || '個',
                purchase_price: Number(ing['purchase_price'] || 0),
                yield_rate: Number(ing['yield_rate'] || 1.0),
                net_unit_price: Number(ing['net_unit_price'] || 0),
                content_amount: Number(ing['amount'] || 0),
                supplier_id: String(ing['supplier_id'] || ''),
                notes: ing['notes'] || '',
                updated_at: new Date().toISOString()
            };
        });

        // Products 処理 (重複チェック)
        sheets.prod.forEach(p => {
            const name = p['品目'];
            const oldId = p['ProductID'];
            if (!name) return;

            let targetId = nameToNewId[name];
            if (!targetId) {
                targetId = `item_${Math.random().toString(36).substr(2, 9)}`;
                nameToNewId[name] = targetId;
                consolidatedItems[targetId] = {
                    name: name,
                    category: p['カテゴリ'] || '未分類',
                    unit: '個',
                    purchase_price: Number(p['原価'] || 0),
                    yield_rate: 1.0,
                    net_unit_price: Number(p['原価'] || 0),
                    updated_at: new Date().toISOString()
                };
            }
            if (oldId) oldIdToNewId[String(oldId)] = targetId;
        });

        // Firestore 書き込み (m_items & m_ingredients)
        const batchItems = writeBatch(db);
        const itemsList = Object.keys(consolidatedItems);
        const limitCount = isLimited ? Math.min(5, itemsList.length) : itemsList.length;

        log(`m_items & m_ingredients に ${limitCount} 件書き込みます...`, 'log-info');
        for (let i = 0; i < limitCount; i++) {
            const id = itemsList[i];
            const data = consolidatedItems[id];
            
            // m_items (共通マスタ)
            const refItem = doc(db, "m_items", id);
            batchItems.set(refItem, data);

            // m_ingredients (食材マスタ - products.js の表示に必要)
            const refIng = doc(db, "m_ingredients", id);
            batchItems.set(refIng, {
                item_id: id,
                purchase_price: data.purchase_price || 0,
                yield_rate: data.yield_rate || 1.0,
                vendor_id: data.supplier_id || '',
                updated_at: data.updated_at
            });
        }
        await batchItems.commit();
        log(`✓ m_items / m_ingredients を登録しました: ${limitCount} 件`, 'log-ok');

        // 3. 在庫設定 (m_store_items) の復元
        log('STEP 2: 在庫設定の紐付け直し中...', 'log-info');
        const batchInv = writeBatch(db);
        let invCount = 0;
        const invLimitCount = isLimited ? Math.min(5, sheets.inv.length) : sheets.inv.length;

        log(`m_store_items に ${invLimitCount} 件書き込みます... (旧ProductIDから紐付け保持)`, 'log-info');
        for (let i = 0; i < invLimitCount; i++) {
            const row = sheets.inv[i];
            const oldProdId = String(row['ProductID']);
            const newItemId = oldIdToNewId[oldProdId];
            const oldStoreId = String(row['StoreID']);
            const newStoreId = STORE_ID_MAP[oldStoreId] || oldStoreId;

            if (newItemId && newStoreId) {
                const docId = `${newStoreId}_${newItemId}`;
                const ref = doc(db, "m_store_items", docId);
                
                batchInv.set(ref, {
                    StoreID: newStoreId, // PascalCase に統一 (inventory.js の query と一致させる)
                    ProductID: newItemId,
                    location_label: row['保管場所'] || '未設定',
                    check_timing: row['確認タイミング'] || '',
                    category: row['仕入れカテゴリ'] || '',
                    unit: row['単位'] || '',
                    定数: Number(row['定数'] || 0),
                    is_confirmed: row['確認フラグ'] === true || row['確認フラグ'] === "TRUE",
                    updated_at: new Date().toISOString()
                }, { merge: true });
                invCount++;
            }
        }
        await batchInv.commit();
        log(`✓ m_store_items を登録しました: ${invCount} 件`, 'log-ok');

        log('=== 手術完了 ✓ ===', 'log-head');
        log('Firebaseコンソールでデータを確認してください。', 'log-info');

    } catch (err) {
        log(`❌ 手術エラー: ${err.message}`, 'log-err');
        console.error(err);
    } finally {
        if (runBtn) runBtn.disabled = false;
    }
    };
}

// クレンジング用 UI 要素
const cleanBtn = document.getElementById('clean-btn');
const cleanupModal = document.getElementById('cleanup-modal');
const cleanupOk = document.getElementById('cleanup-ok');
const cleanupCancel = document.getElementById('cleanup-cancel');

if (cleanBtn) {
    cleanBtn.onclick = () => {
        log('--- クレンジングボタンがクリックされました ---', 'log-info');
        cleanupModal.style.display = 'flex';
    };
}

if (cleanupCancel) {
    cleanupCancel.onclick = () => {
        log('キャンセルされました', 'log-warn');
        cleanupModal.style.display = 'none';
    };
}

if (cleanupOk) {
    cleanupOk.onclick = async () => {
        cleanupModal.style.display = 'none';
        cleanBtn.disabled = true;
        log('=== データベースクレンジング開始 ===', 'log-head');

        try {
            // 1. 全アイテムの取得
            log('m_items を読み込み中...', 'log-info');
            const snap = await getDocs(collection(db, "m_items"));
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            log(`全 ${items.length} 件を取得しました。`, 'log-info');

            const toDelete = [];
            const toUpdate = [];
            
            // Firestore ID のパターン (英数字 20文字前後)
            const idPattern = /^[a-zA-Z0-9]{15,25}$/;

            items.forEach(item => {
                const name = String(item.name || '');
                if (idPattern.test(name)) {
                    toDelete.push(item.id);
                } else {
                    toUpdate.push(item);
                }
            });

            log(`ゴミデータ (nameがID): ${toDelete.length} 件を削除します。`, 'log-warn');
            log(`正規データ: ${toUpdate.length} 件を構造化します。`, 'log-info');

            // 2. 削除実行 (バッチ 500件ずつ)
            for (let i = 0; i < toDelete.length; i += 500) {
                const batch = writeBatch(db);
                const chunk = toDelete.slice(i, i + 500);
                chunk.forEach(id => {
                    batch.delete(doc(db, "m_items", id));
                    // 関連データも念のため削除
                    batch.delete(doc(db, "m_ingredients", id));
                    batch.delete(doc(db, "m_menus", id));
                });
                await batch.commit();
                log(`削除進捗: ${i + chunk.length} / ${toDelete.length}`, 'log-info');
            }

            // 3. 構造化・補完実行
            for (let i = 0; i < toUpdate.length; i += 500) {
                const batch = writeBatch(db);
                const chunk = toUpdate.slice(i, i + 500);
                chunk.forEach(item => {
                    const id = item.id;
                    const normalized = {
                        name: item.name || '名称未設定',
                        category: item.category || '未分類',
                        unit: item.unit || '個',
                        content_amount: Number(item.content_amount || 0),
                        purchase_price: Number(item.purchase_price || 0),
                        yield_rate: Number(item.yield_rate || 1.0),
                        supplier_id: String(item.supplier_id || ''),
                        vendor_id: String(item.vendor_id || item.supplier_id || ''),
                        updated_at: item.updated_at || new Date().toISOString()
                    };
                    batch.set(doc(db, "m_items", id), normalized, { merge: true });

                    // m_ingredients の補完
                    batch.set(doc(db, "m_ingredients", id), {
                        item_id: id,
                        purchase_price: normalized.purchase_price,
                        yield_rate: normalized.yield_rate,
                        vendor_id: normalized.vendor_id,
                        updated_at: normalized.updated_at
                    }, { merge: true });
                });
                await batch.commit();
                log(`構造化進捗: ${i + chunk.length} / ${toUpdate.length}`, 'log-info');
            }

            log('=== クレンジング完了 ✓ ===', 'log-head');
            log('不要なデータが削除され、全アイテムの項目が初期化されました。', 'log-ok');

        } catch (err) {
            log(`❌ エラー: ${err.message}`, 'log-err');
            console.error(err);
        } finally {
            cleanBtn.disabled = false;
        }
    };
}
