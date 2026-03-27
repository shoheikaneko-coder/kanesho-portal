import { db } from './firebase.js';
import {
    collection, getDocs, setDoc, doc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── コレクション名マッピング ────────────────────────────────
const COLLECTION_MAP = [
    { from: 'UserList',            to: 'm_users' },
    { from: 'M_Stores',            to: 'm_stores' },
    { from: 'M_Settings',          to: 'm_settings' },
    { from: 'M_RolePermissions',   to: 'm_role_permissions' },
    { from: 'M_Suppliers',         to: 'm_suppliers' },
    { from: 'Vendors',             to: 'm_suppliers' },
    { from: 'M_Products',          to: 'm_products' },
    { from: 'Products',            to: 'm_products' },
    { from: 'T_Performance',       to: 't_performance' },
    { from: 'T_WorkingHours',      to: 't_attendance' },
    { from: 'Inventory',           to: 'm_store_items' },
    { from: 'InventoryHistory',    to: 't_inventory_logs' },
    { from: 'T_ProcurementHistory',to: 't_procurement_history' },
    { from: 'M_確認タイミング',     to: 'm_check_timings' },
];

// ─── 打刻type値マッピング ─────────────────────────────────────
const TYPE_MAP = {
    '出勤': 'check_in',
    '退勤': 'check_out',
    '休憩開始': 'break_start',
    '休憩終了': 'break_end',
};

// ─── ログユーティリティ ───────────────────────────────────────
const logEl  = document.getElementById('log');
const progWrap = document.getElementById('progress-bar-wrap');
const progBar  = document.getElementById('progress-bar');
const progLabel = document.getElementById('progress-label');
const startBtn = document.getElementById('start-btn');
const confirmChk = document.getElementById('confirm-chk');

function log(msg, cls = 'log-info') {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
}

function setProgress(done, total, label) {
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    progBar.style.width = pct + '%';
    progLabel.textContent = label || `${done} / ${total} 件処理済み`;
}

// ─── メイン移行処理 ───────────────────────────────────────────
async function migrate() {
    startBtn.disabled = true;
    confirmChk.disabled = true;
    logEl.style.display = 'block';
    progWrap.style.display = 'block';
    progLabel.style.display = 'block';

    log('=== DB移行ツール 開始 ===', 'log-head');

    const writtenIds = {};
    let totalDone = 0;

    for (const mapping of COLLECTION_MAP) {
        log(`▶ ${mapping.from} → ${mapping.to} を処理中...`, 'log-head');

        let snap;
        try {
            snap = await getDocs(collection(db, mapping.from));
        } catch (e) {
            log(`  [スキップ] ${mapping.from} の読み込み失敗: ${e.message}`, 'log-warn');
            continue;
        }

        if (snap.empty) {
            log(`  [スキップ] ${mapping.from} にドキュメントなし`, 'log-warn');
            continue;
        }

        log(`  ${snap.size} 件を読み込みました`, 'log-info');

        const docs = [];
        snap.forEach(d => docs.push({ id: d.id, data: d.data() }));

        const BATCH_SIZE = 450;
        let written = 0;
        let skipped = 0;

        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + BATCH_SIZE);

            chunk.forEach(({ id, data }) => {
                const targetKey = `${mapping.to}__${id}`;
                if (writtenIds[targetKey]) {
                    skipped++;
                    return;
                }
                writtenIds[targetKey] = true;

                let finalData = { ...data };
                if (mapping.to === 't_attendance') {
                    if (finalData.type && TYPE_MAP[finalData.type]) {
                        finalData.type = TYPE_MAP[finalData.type];
                    }
                }

                const ref = doc(db, mapping.to, id);
                batch.set(ref, finalData, { merge: true });
                written++;
            });

            await batch.commit();
            totalDone += chunk.length;
            setProgress(totalDone, docs.length * COLLECTION_MAP.length,
                `${mapping.from}: ${Math.min(i + chunk.length, docs.length)}/${docs.length} 件`);
        }

        if (skipped > 0) {
            log(`  [マージ] ${skipped} 件は既存ドキュメントとして重複スキップ`, 'log-warn');
        }
        log(`  ✓ ${written} 件を ${mapping.to} に書き込み完了`, 'log-ok');
    }

    log('=== 全コレクションの移行が完了しました ===', 'log-head');
    log('完了後の手順:', 'log-info');
    log('  1. Firebase Console で新コレクションのデータを確認してください', 'log-info');
    log('  2. アプリ全体の動作確認を行ってください', 'log-info');

    setProgress(1, 1, '完了 ✓');
    startBtn.innerHTML = '<i class="fas fa-check"></i> 移行完了';
    startBtn.style.background = 'linear-gradient(135deg,#059669,#047857)';
}

// イベントリスナーの登録
if (confirmChk && startBtn) {
    confirmChk.addEventListener('change', () => {
        startBtn.disabled = !confirmChk.checked;
    });

    startBtn.addEventListener('click', () => {
        migrate().catch(e => {
            log('致命的エラー: ' + e.message, 'log-err');
            console.error(e);
        });
    });
}
// ─── アイテムマスタ統合 & 在庫データ紐付け直し (外科手術) ──────────────────
async function runSurgery() {
    const surgeryBtn = document.getElementById('surgery-btn');
    surgeryBtn.disabled = true;
    logEl.style.display = 'block';
    progWrap.style.display = 'block';
    progLabel.style.display = 'block';

    log('=== アイテムマスタ統合 & データ移植 (外科手術) 開始 ===', 'log-head');

    try {
        // 1. 各マスタの読み込み
        log('1/4: マスタデータを読み込み中...', 'log-info');
        const [ingSnap, prodSnap, itemSnap] = await Promise.all([
            getDocs(collection(db, "m_ingredients")),
            getDocs(collection(db, "m_products")),
            getDocs(collection(db, "m_items"))
        ]);

        const ings = ingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const prods = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const items = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const nameToItemId = {}; // name -> string item_id
        const oldProdIdToName = {}; // numeric id -> name (from m_products)

        prods.forEach(p => {
            const name = p['商品名'] || p['ProductName'] || p.id;
            oldProdIdToName[p.id] = name;
        });

        // 2. m_items の再構成と名寄せ
        log('2/4: アイテムマスタを再構成（名前・カテゴリ修復）中...', 'log-info');
        const batchItems = writeBatch(db);
        const consolidatedMap = {}; // name -> data

        // まず m_products から名前とカテゴリのマスターマップを作成
        const masterNameMap = {}; // old_numeric_id -> { name, category }
        prods.forEach(p => {
            const name = p['商品名'] || p['ProductName'] || p.name || p.Name;
            const cat = p['大分類'] || p['CategoryL'] || p.category || p.Category || '未分類';
            if (name && name !== p.id) {
                masterNameMap[p.id] = { name, category: cat };
            }
        });

        // m_ingredients をベースに、名寄せを行う
        ings.forEach(ing => {
            let name = null;
            let category = '未分類';

            // m_products または既存の m_items から正しい名前を探す
            // ing.item_id が数値IDの場合（旧仕様）
            if (masterNameMap[ing.item_id]) {
                name = masterNameMap[ing.item_id].name;
                category = masterNameMap[ing.item_id].category;
            } else {
                // すでに item_xxx になっている場合、既存の m_items から探す
                const item = items.find(it => it.id === ing.item_id);
                if (item && item.name && !item.name.startsWith('item_')) {
                    name = item.name;
                    category = item.category || '未分類';
                }
            }

            // それでも名前が見つからない場合、逆引き (prods 内に名前があればそれを使う)
            if (!name && ing.item_id) {
                // prods を全スキャンして名前を探す（もし numeric ID がプロパティに入っていれば）
                const matchByProp = prods.find(p => p.ProductID == ing.item_id || p.ID == ing.item_id);
                if (matchByProp) {
                    name = matchByProp['商品名'] || matchByProp['ProductName'];
                    category = matchByProp['大分類'] || matchByProp['CategoryL'];
                }
            }

            if (!name) return; // 名前が特定できないものはスキップ

            nameToItemId[name] = ing.item_id;
            consolidatedMap[name] = {
                id: ing.item_id,
                name: name,
                category: category,
                unit: (items.find(it => it.id === ing.item_id)?.unit) || '個',
                purchase_price: Number(ing.purchase_price) || 0,
                yield_rate: Number(ing.yield_rate) || 1.0,
                net_unit_price: (Number(ing.purchase_price) || 0) / (Number(ing.yield_rate) || 1.0),
                vendor_id: ing.vendor_id || "",
                content_amount: Number(ing.content_amount) || 0,
                updated_at: new Date().toISOString()
            };
        });

        // 重複しない m_products を追加 (販売メニュー対応)
        let newCount = 0;
        const batchMenus = writeBatch(db);
        prods.forEach(p => {
            const name = p['商品名'] || p['ProductName'] || p.name;
            const cat = p['大分類'] || p['CategoryL'] || '未分類';
            if (name && name !== p.id && !consolidatedMap[name]) {
                const newId = `item_${Date.now()}_${newCount++}`;
                nameToItemId[name] = newId;
                consolidatedMap[name] = {
                    id: newId,
                    name: name,
                    category: cat,
                    unit: '個',
                    purchase_price: Number(p['仕入原価'] || 0),
                    yield_rate: 1.0,
                    net_unit_price: Number(p['仕入原価'] || 0),
                    updated_at: new Date().toISOString()
                };

                const salesPrice = Number(p['提供価格'] || p['Price'] || 0);
                if (salesPrice > 0) {
                    const menuRef = doc(db, "m_menus", newId);
                    batchMenus.set(menuRef, {
                        item_id: newId,
                        sales_price: salesPrice,
                        updated_at: new Date().toISOString()
                    }, { merge: true });
                }
            }
        });

        // 書き込みバッチ (m_items)
        Object.values(consolidatedMap).forEach(data => {
            const ref = doc(db, "m_items", data.id);
            const { id, ...dataToSave } = data;
            batchItems.set(ref, dataToSave, { merge: true });
        });
        await batchItems.commit();
        await batchMenus.commit();
        log(`✓ アイテムマスタ修復（名前・カテゴリ）完了: ${Object.keys(consolidatedMap).length} 件`, 'log-ok');

        // 3. 関連データの紐付け直し (m_store_items, t_inventory_logs, t_procurement_history)
        log('3/4: 関連データの紐付けを更新中...', 'log-info');
        const collectionsToUpdate = [
            { coll: "m_store_items", idField: "ProductID" },
            { coll: "t_inventory_logs", idField: "ProductID" },
            { coll: "t_procurement_history", idField: "ProductID" }
        ];

        for (const target of collectionsToUpdate) {
            log(`  ${target.coll} を処理中...`, 'log-info');
            const snap = await getDocs(collection(db, target.coll));
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            let updateCount = 0;
            const BATCH_SIZE = 450;
            for (let i = 0; i < docs.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + BATCH_SIZE);

                chunk.forEach(d => {
                    const oldPid = d[target.idField];
                    const name = oldProdIdToName[oldPid];
                    const newItemId = nameToItemId[name];

                    if (newItemId) {
                        const ref = doc(db, target.coll, d.id);
                        const updates = { [target.idField]: newItemId, updated_at: new Date().toISOString() };
                        if (target.coll === 'm_store_items') {
                            updates.location_label = d.location_label || d.保管場所 || '未設定';
                        }
                        batch.update(ref, updates);
                        updateCount++;
                    }
                });
                await batch.commit();
                setProgress(i + chunk.length, docs.length, `${target.coll}: ${i + chunk.length}/${docs.length}`);
            }
            log(`  ✓ ${target.coll} 更新完了: ${updateCount} 件`, 'log-ok');
        }

        // 4. 完了
        log('4/4: 全ての手術が成功しました！', 'log-head');
        setProgress(1, 1, '手術完了 ✓');
        surgeryBtn.innerHTML = '<i class="fas fa-check"></i> 手術完了';
        surgeryBtn.style.background = '#10b981';

    } catch (err) {
        log(`❌ 手術失敗: ${err.message}`, 'log-err');
        console.error(err);
    } finally {
        surgeryBtn.disabled = false;
    }
}

// イベントリスナーの追加
const surgeryBtn = document.getElementById('surgery-btn');
if (surgeryBtn) {
    surgeryBtn.onclick = () => {
        if (confirm('アイテムマスタの統合と在庫データの紐付け直しを実行しますか？\n(注意：この操作は元に戻せません)')) {
            runSurgery();
        }
    };
}

log('初期化完了：チェックボックスをONにするとボタンが有効化されます。', 'log-info');

