import { db } from './firebase.js';
import { collection, getDocs, setDoc, doc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getEffectivePrice } from './cost_engine.js';
import { showAlert, showConfirm } from './ui_utils.js';

/**
 * 棚卸し履歴 (stocktake.js)
 * 手動トリガーで現時点の在庫をスナップショット記録し、日次棚卸し額を管理する。
 * マスタ（m_items, m_ingredients, m_menus）は読み取りのみ。
 */

export const stocktakePageHtml = `
    <div id="stocktake-app" class="animate-fade-in" style="max-width: 1100px; margin: 0 auto; padding-bottom: 3rem;">

        <!-- Header -->
        <div class="glass-panel" style="padding: 1.2rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <select id="st-store-select" class="btn" style="background: white; border: 1px solid var(--border); min-width: 180px; font-size: 0.95rem;">
                    <option value="">拠点を選択...</option>
                </select>
            </div>
            <button id="btn-st-record" class="btn btn-primary" disabled style="padding: 0.7rem 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-camera"></i> 本日の棚卸しを記録する
            </button>
        </div>

        <!-- Summary Card -->
        <div id="st-summary-card" style="display:none; margin-bottom:1.5rem;">
            <div class="glass-panel" style="padding:1.5rem; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color:white; border:none;">
                <div style="font-size:0.85rem; opacity:0.85; margin-bottom:0.3rem;">本日の棚卸し総額（直近スナップショット）</div>
                <div id="st-today-amount" style="font-size: 2.2rem; font-weight: 800; font-family: monospace;">—</div>
                <div id="st-today-meta" style="font-size:0.75rem; opacity:0.75; margin-top:0.3rem;"></div>
            </div>
        </div>

        <!-- History Table -->
        <div class="glass-panel" style="padding:0; overflow:hidden;">
            <div style="padding:1.2rem 1.5rem; border-bottom:1px solid var(--border); font-weight:700; color:var(--text-secondary); font-size:0.85rem; display:flex; align-items:center; gap:0.5rem;">
                <i class="fas fa-history" style="color:var(--primary);"></i> 棚卸し履歴
            </div>
            <div id="st-history-content">
                <div style="padding:3rem; text-align:center; color:var(--text-secondary);">拠点を選択してください</div>
            </div>
        </div>

        <!-- Loading overlay -->
        <div id="st-loading" style="display:none; position:fixed; inset:0; background:rgba(255,255,255,0.75); z-index:9999; justify-content:center; align-items:center;">
            <div class="glass-panel" style="padding: 2rem; text-align:center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top: 1rem; font-weight: 600;">棚卸し計算中...</p>
            </div>
        </div>
    </div>
`;

// State
let selectedStoreId = null;
let allStores = [];
let masterCache = { items: [], ingredients: [], menus: [] };
let currentUser = null;

export async function initStocktakePage(user) {
    currentUser = user;
    selectedStoreId = null;
    await loadMasterData();
    setupStoreSelect();
}

async function loadMasterData() {
    const [itemSnap, storeSnap, ingSnap, menuSnap] = await Promise.all([
        getDocs(collection(db, "m_items")),
        getDocs(collection(db, "m_stores")),
        getDocs(collection(db, "m_ingredients")),
        getDocs(collection(db, "m_menus"))
    ]);
    masterCache.items = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allStores = storeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    masterCache.ingredients = ingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    masterCache.menus = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const sel = document.getElementById('st-store-select');
    if (sel) {
        allStores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.store_id || s.id;
            opt.textContent = s.store_name || s.Name || s.id;
            sel.appendChild(opt);
        });
    }
}

function setupStoreSelect() {
    const sel = document.getElementById('st-store-select');
    const recordBtn = document.getElementById('btn-st-record');
    if (!sel) return;

    sel.onchange = async (e) => {
        selectedStoreId = e.target.value;
        if (recordBtn) recordBtn.disabled = !selectedStoreId;
        if (selectedStoreId) await loadHistory();
    };

    if (recordBtn) {
        const canRecord = currentUser?.Role === 'Admin' || currentUser?.Role === '管理者' || currentUser?.Role === 'Manager';
        recordBtn.style.display = canRecord ? 'flex' : 'none';
        recordBtn.onclick = confirmAndRecord;
    }
}

async function confirmAndRecord() {
    if (!selectedStoreId) return;
    const ok = await showConfirm('棚卸し記録', `現在の在庫数で棚卸し額を記録します。\n同じ営業日のデータは上書きされます。\n続けますか？`);
    if (!ok) return;
    await recordStocktake();
}

function getBusinessDate() {
    const store = allStores.find(s => (s.store_id || s.id) === selectedStoreId);
    const resetTime = store?.reset_time || "05:00";
    const now = new Date();
    const [h, m] = resetTime.split(':').map(Number);
    let cutoff = new Date(now);
    cutoff.setHours(h, m, 0, 0);
    if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);
    return cutoff.toISOString().split('T')[0];
}

async function recordStocktake() {
    const loadEl = document.getElementById('st-loading');
    if (loadEl) loadEl.style.display = 'flex';

    try {
        // 対象拠点の全在庫を取得
        const snap = await getDocs(query(collection(db, "m_store_items"), where("StoreID", "==", selectedStoreId)));
        const storeItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const businessDate = getBusinessDate();
        const now = new Date().toISOString();
        const store = allStores.find(s => (s.store_id || s.id) === selectedStoreId);
        const storeName = store?.store_name || store?.Name || selectedStoreId;

        let totalAmount = 0;
        const itemSnapshots = [];

        for (const si of storeItems) {
            if (!si.ProductID) continue;
            const item = masterCache.items.find(i => i.id === si.ProductID);
            if (!item) continue;

            const qty = Number(si.個数 || 0);
            const convAmt = Number(si.unit_conversion_amount || 1);
            // マスタ基準単位の原価 × 換算量 = 表示単位の原価
            const masterUnitPrice = getEffectivePrice(si.ProductID, masterCache);
            const displayUnitPrice = masterUnitPrice * convAmt;
            const subtotal = displayUnitPrice * qty;
            totalAmount += subtotal;

            itemSnapshots.push({
                item_id: si.ProductID,
                item_name: item.name || si.ProductID,
                display_unit: si.display_unit || item.unit || '',
                qty: qty,
                unit_price: Math.round(displayUnitPrice * 100) / 100,
                subtotal: Math.round(subtotal)
            });
        }

        // 同日上書き（固定ドキュメントID）
        const docId = `${selectedStoreId}_${businessDate}`;
        await setDoc(doc(db, "t_stocktake_snapshots", docId), {
            business_date: businessDate,
            store_id: selectedStoreId,
            store_name: storeName,
            recorded_at: now,
            recorded_by: currentUser?.Name || currentUser?.Email || 'unknown',
            total_amount: Math.round(totalAmount),
            note: '',
            items: itemSnapshots
        });

        await showAlert('記録完了', `棚卸し総額: ¥${Math.round(totalAmount).toLocaleString()}\n(${itemSnapshots.length}品目)`);
        await loadHistory();
    } catch (err) {
        showAlert('エラー', err.message);
    } finally {
        if (loadEl) loadEl.style.display = 'none';
    }
}

async function loadHistory() {
    const content = document.getElementById('st-history-content');
    if (!content) return;
    content.innerHTML = '<div style="padding:2rem; text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const q = query(
            collection(db, "t_stocktake_snapshots"),
            where("store_id", "==", selectedStoreId),
            orderBy("business_date", "desc"),
            limit(30)
        );
        const snap = await getDocs(q);
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Summary card: 直近レコード
        const latest = records[0];
        const summaryCard = document.getElementById('st-summary-card');
        const todayAmount = document.getElementById('st-today-amount');
        const todayMeta = document.getElementById('st-today-meta');
        if (summaryCard && latest) {
            summaryCard.style.display = 'block';
            todayAmount.textContent = `¥${(latest.total_amount || 0).toLocaleString()}`;
            todayMeta.textContent = `${latest.business_date} / 記録者: ${latest.recorded_by} / ${new Date(latest.recorded_at).toLocaleString('ja-JP')}`;
        }

        if (records.length === 0) {
            content.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-secondary);">棚卸し記録がありません</div>';
            return;
        }

        // テーブル
        const rows = records.map((r, idx) => {
            const prev = records[idx + 1];
            const diff = prev ? (r.total_amount - prev.total_amount) : null;
            const diffStr = diff !== null
                ? `<span style="color:${diff >= 0 ? '#10b981' : '#ef4444'}; font-size:0.8rem; font-weight:700;">${diff >= 0 ? '+' : ''}¥${diff.toLocaleString()}</span>`
                : '<span style="color:var(--text-secondary); font-size:0.8rem;">—</span>';

            return `
            <tr style="border-bottom:1px solid var(--border);" class="st-row" data-idx="${idx}">
                <td style="padding:1rem; font-weight:700; font-family:monospace;">${r.business_date}</td>
                <td style="padding:1rem; font-size:0.85rem; color:var(--text-secondary);">${new Date(r.recorded_at).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})}</td>
                <td style="padding:1rem; font-weight:800; font-family:monospace; font-size:1.05rem;">¥${(r.total_amount||0).toLocaleString()}</td>
                <td style="padding:1rem;">${diffStr}</td>
                <td style="padding:1rem; color:var(--text-secondary); font-size:0.85rem;">${r.recorded_by || ''}</td>
                <td style="padding:1rem;">
                    <button class="btn btn-detail-expand" data-idx="${idx}" style="background:var(--surface-darker); border:1px solid var(--border); font-size:0.8rem; padding:0.3rem 0.8rem;">
                        <i class="fas fa-chevron-down"></i> 内訳
                    </button>
                </td>
            </tr>
            <tr class="st-detail-row" data-detail="${idx}" style="display:none; background:#f8fafc;">
                <td colspan="6" style="padding:0 1rem 1rem;">
                    ${renderDetailTable(r.items || [])}
                </td>
            </tr>`;
        }).join('');

        content.innerHTML = `
            <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                    <tr style="background:var(--surface-darker); border-bottom:2px solid var(--border); color:var(--text-secondary);">
                        <th style="padding:1rem;">営業日</th>
                        <th style="padding:1rem;">記録時刻</th>
                        <th style="padding:1rem;">棚卸し総額</th>
                        <th style="padding:1rem;">前回比</th>
                        <th style="padding:1rem;">記録者</th>
                        <th style="padding:1rem;"></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;

        content.querySelectorAll('.btn-detail-expand').forEach(btn => {
            btn.onclick = () => {
                const idx = btn.dataset.idx;
                const detailRow = content.querySelector(`.st-detail-row[data-detail="${idx}"]`);
                const isOpen = detailRow.style.display !== 'none';
                detailRow.style.display = isOpen ? 'none' : 'table-row';
                btn.innerHTML = isOpen ? '<i class="fas fa-chevron-down"></i> 内訳' : '<i class="fas fa-chevron-up"></i> 閉じる';
            };
        });
    } catch (err) {
        content.innerHTML = `<div style="padding:2rem; color:var(--danger);">読み込みエラー: ${err.message}</div>`;
    }
}

function renderDetailTable(items) {
    if (!items.length) return '<p style="padding:1rem; color:var(--text-secondary); font-size:0.85rem;">内訳データなし</p>';
    const rows = items.map(i => `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:0.5rem 0.8rem; font-size:0.85rem;">${i.item_name}</td>
            <td style="padding:0.5rem 0.8rem; font-size:0.85rem; color:var(--text-secondary); text-align:right;">${i.qty} ${i.display_unit}</td>
            <td style="padding:0.5rem 0.8rem; font-size:0.85rem; color:var(--text-secondary); text-align:right;">¥${(i.unit_price||0).toLocaleString()} / ${i.display_unit}</td>
            <td style="padding:0.5rem 0.8rem; font-size:0.85rem; font-weight:700; text-align:right;">¥${(i.subtotal||0).toLocaleString()}</td>
        </tr>`).join('');
    return `<table style="width:100%; border-collapse:collapse; margin-top:0.5rem; font-size:0.85rem;">
        <thead><tr style="background:#f1f5f9;">
            <th style="padding:0.5rem 0.8rem; text-align:left; color:var(--text-secondary);">品目</th>
            <th style="padding:0.5rem 0.8rem; text-align:right; color:var(--text-secondary);">数量</th>
            <th style="padding:0.5rem 0.8rem; text-align:right; color:var(--text-secondary);">単価</th>
            <th style="padding:0.5rem 0.8rem; text-align:right; color:var(--text-secondary);">小計</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}
