import { db } from './firebase.js';
import { collection, getDocs, doc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const startBtn = document.getElementById('start-btn');
const statusArea = document.getElementById('status-area');
const statusLog = document.getElementById('status-log');

function log(msg, color = '#d4d4d4') {
    const div = document.createElement('div');
    div.style.color = color;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    statusLog.appendChild(div);
    statusArea.scrollTop = statusArea.scrollHeight;
}

/**
 * 日付正規化関数
 */
function normalizeDate(val) {
    if (!val && val !== 0) return null;
    const num = Number(val);
    // Excelシリアル値 (2000年〜2050年頃: 36526〜54789)
    if (!isNaN(num) && num > 30000 && num < 60000) {
        const ms = (num - 25569) * 86400 * 1000;
        const d = new Date(ms);
        const yyyy = d.getUTCFullYear();
        const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd   = String(d.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    
    let str = String(val).replace(/\//g, '-').replace(/\./g, '-');
    const parts = str.split('-');
    if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return str;
}

startBtn.addEventListener('click', async () => {
    if (!confirm('【重要】日本語フィールドの廃止と英語名への名寄せ（および旧フィールド削除）を実行しますか？')) return;

    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 実行中...';
    statusArea.style.display = 'block';

    try {
        // 1. 店舗マスタのロード (ID->名称マップ作成)
        log('1. 店舗マスタの確認中...', '#569cd6');
        let storeSnap = await getDocs(collection(db, "m_stores"));
        if (storeSnap.empty) storeSnap = await getDocs(collection(db, "Stores"));
        
        const storeMap = {}; // ID -> StoreName
        storeSnap.forEach(sdoc => {
            const sd = sdoc.data();
            const sid = sd['店舗ID'] || sd['StoreID'] || sdoc.id;
            const snm = sd['店舗名'] || sd['StoreName'] || sd['Name'];
            if (sid && snm) storeMap[String(sid)] = snm;
        });
        log(`店舗マスタ ${Object.keys(storeMap).length} 件をロードしました。`);

        // 2. t_performance の読込
        log('2. t_performance の一括読み込み中...', '#569cd6');
        const snapshot = await getDocs(collection(db, "t_performance"));
        log(`計 ${snapshot.size} 件のドキュメントを処理対象に決定。`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const d of snapshot.docs) {
            const data = d.data();
            const updates = {};
            const keysToDelete = [];

            // --- A. 日付の英語化と正規化 ---
            const rawDate = data.Date || data['日付'];
            const normalizedDate = normalizeDate(rawDate);
            if (normalizedDate) {
                updates.Date = normalizedDate;
                updates.YearMonth = normalizedDate.substring(0, 7);
                if (data['日付'] !== undefined) keysToDelete.push('日付');
            }

            // --- B. 店舗名・StoreIDの補完 ---
            const rawStoreID = data.StoreID || data['店舗 ID'];
            if (rawStoreID !== undefined) {
                const sidStr = String(rawStoreID);
                updates.StoreID = sidStr;
                if (!data.StoreName && storeMap[sidStr]) {
                    updates.StoreName = storeMap[sidStr];
                }
                if (data['店舗 ID'] !== undefined) keysToDelete.push('店舗 ID');
            }
            // もしStoreNameがまだ無いが「店舗名」がある場合
            if (!updates.StoreName && data['店舗名']) {
                updates.StoreName = data['店舗名'];
                keysToDelete.push('店舗名');
            }

            // --- C. 数値フィールドの名寄せ ---
            const fieldMap = {
                '売上税込': 'Amount',
                '客数': 'CustomerCount',
                '現金過不足': 'CashDiff',
                '備考': 'Note'
            };

            for (const [ja, en] of Object.entries(fieldMap)) {
                if (data[ja] !== undefined) {
                    if (data[en] === undefined) {
                        updates[en] = (ja === '備考') ? data[ja] : Number(data[ja]);
                    }
                    keysToDelete.push(ja);
                }
            }

            // --- D. 旧フィールド削除用 ---
            keysToDelete.forEach(k => {
                updates[k] = deleteField();
            });

            // 更新実行
            if (Object.keys(updates).length > 0) {
                const docRef = doc(db, "t_performance", d.id);
                await updateDoc(docRef, updates);
                const changedKeys = Object.keys(updates).filter(k => updates[k] !== deleteField());
                log(`[${d.id.substring(0,6)}] ${changedKeys.join(', ')} 移行完了`, '#ce9178');
                updatedCount++;
            } else {
                skippedCount++;
            }
        }

        log('--------------------------------------');
        log(`🎉 名寄せ作業がすべて完了しました！`, '#4EC9B0');
        log(`更新件数: ${updatedCount} 件`);
        log(`スキップ: ${skippedCount} 件`);
        
        startBtn.innerHTML = '<i class="fas fa-check"></i> 完了';
        startBtn.style.background = '#059669';

    } catch (err) {
        console.error(err);
        log(`エラー発生: ${err.message}`, '#f44336');
        startBtn.disabled = false;
        startBtn.innerHTML = '再試行';
    }
});
