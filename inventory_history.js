import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * 在庫履歴 (inventory_history.js)
 * t_inventory_history コレクションの閲覧・フィルタリング。
 * 読み取り専用 - マスタや在庫データへの書き込みは一切行わない。
 */

const REASON_LABELS = {
    stock_check:          { label: '在庫チェック', color: '#6366f1', bg: '#eff6ff' },
    purchase:             { label: '仕入れ',       color: '#10b981', bg: '#f0fdf4' },
    prep_complete:        { label: '仕込み完了',   color: '#8b5cf6', bg: '#f5f3ff' },
    transfer_in:          { label: '移動(受取)',   color: '#3b82f6', bg: '#eff6ff' },
    transfer_out:         { label: '移動(送出)',   color: '#f59e0b', bg: '#fffbeb' },
    manual:               { label: '手動調整',     color: '#64748b', bg: '#f8fafc' },
    stocktake_correction: { label: '棚卸補正',     color: '#ef4444', bg: '#fef2f2' },
};

const ROUTE_LABELS = {
    direct_buy:    '買付先',
    from_warehouse:'倉庫から',
    delivery:      '業者納品',
};

export const inventoryHistoryPageHtml = `
    <div id="inv-history-app" class="animate-fade-in" style="max-width: 1100px; margin: 0 auto; padding-bottom: 3rem;">

        <!-- Filters -->
        <div class="glass-panel" style="padding: 1.2rem 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
                <div>
                    <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.4rem;">拠点</label>
                    <select id="ih-store-select" class="btn" style="background:white; border:1px solid var(--border); min-width:160px;">
                        <option value="">全拠点</option>
                    </select>
                </div>
                <div>
                    <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.4rem;">理由</label>
                    <select id="ih-reason-select" class="btn" style="background:white; border:1px solid var(--border); min-width:140px;">
                        <option value="">すべて</option>
                        ${Object.entries(REASON_LABELS).map(([k,v]) =>
                            `<option value="${k}">${v.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.4rem;">品目名</label>
                    <input type="text" id="ih-item-search" placeholder="キーワード..." style="padding:0.6rem 0.8rem; border:1px solid var(--border); border-radius:8px; font-size:0.9rem; width:160px;">
                </div>
                <div>
                    <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.4rem;">営業日（from）</label>
                    <input type="date" id="ih-date-from" style="padding:0.6rem; border:1px solid var(--border); border-radius:8px; font-size:0.9rem;">
                </div>
                <div>
                    <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.4rem;">営業日（to）</label>
                    <input type="date" id="ih-date-to" style="padding:0.6rem; border:1px solid var(--border); border-radius:8px; font-size:0.9rem;">
                </div>
                <button id="btn-ih-search" class="btn btn-primary" style="padding:0.6rem 1.2rem;">
                    <i class="fas fa-search"></i> 検索
                </button>
            </div>
        </div>

        <!-- Results -->
        <div class="glass-panel" style="padding:0; overflow:hidden;">
            <div style="padding:1rem 1.5rem; border-bottom:1px solid var(--border); font-weight:700; font-size:0.85rem; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center;">
                <span><i class="fas fa-list-alt" style="color:var(--primary);"></i> 在庫増減履歴</span>
                <span id="ih-count-label" style="font-size:0.8rem;"></span>
            </div>
            <div id="ih-table-content">
                <div style="padding:4rem; text-align:center; color:var(--text-secondary);">検索条件を設定して「検索」ボタンを押してください</div>
            </div>
        </div>
    </div>
`;

let cachedItems = [];
let allStores = [];

export async function initInventoryHistoryPage(user) {
    cachedItems = [];
    allStores = [];

    const [itemSnap, storeSnap] = await Promise.all([
        getDocs(collection(db, "m_items")),
        getDocs(collection(db, "m_stores"))
    ]);
    cachedItems = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allStores = storeSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const storeSel = document.getElementById('ih-store-select');
    if (storeSel) {
        allStores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.store_id || s.id;
            opt.textContent = s.store_name || s.Name || s.id;
            storeSel.appendChild(opt);
        });
    }

    // デフォルト: 直近7日
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const fromEl = document.getElementById('ih-date-from');
    const toEl = document.getElementById('ih-date-to');
    if (fromEl) fromEl.value = weekAgo;
    if (toEl) toEl.value = today;

    const searchBtn = document.getElementById('btn-ih-search');
    if (searchBtn) searchBtn.onclick = performSearch;
}

async function performSearch() {
    const content = document.getElementById('ih-table-content');
    const countLabel = document.getElementById('ih-count-label');
    if (!content) return;

    content.innerHTML = '<div style="padding:2rem; text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>';

    const storeId = document.getElementById('ih-store-select')?.value || '';
    const reason = document.getElementById('ih-reason-select')?.value || '';
    const keyword = (document.getElementById('ih-item-search')?.value || '').toLowerCase();
    const dateFrom = document.getElementById('ih-date-from')?.value || '';
    const dateTo = document.getElementById('ih-date-to')?.value || '';

    try {
        let q = query(collection(db, "t_inventory_history"), orderBy("executed_at", "desc"), limit(300));
        if (storeId) q = query(collection(db, "t_inventory_history"), where("store_id", "==", storeId), orderBy("executed_at", "desc"), limit(300));

        const snap = await getDocs(q);
        let records = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // クライアント側フィルタ
        if (reason) records = records.filter(r => r.reason_type === reason);
        if (dateFrom) records = records.filter(r => (r.business_date || '') >= dateFrom);
        if (dateTo) records = records.filter(r => (r.business_date || '') <= dateTo);
        if (keyword) {
            records = records.filter(r => {
                const itemName = (cachedItems.find(i => i.id === r.item_id)?.name || r.item_id).toLowerCase();
                return itemName.includes(keyword);
            });
        }

        if (countLabel) countLabel.textContent = `${records.length} 件`;

        if (records.length === 0) {
            content.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-secondary);">該当する履歴がありません</div>';
            return;
        }

        const rows = records.map(r => {
            const reasonInfo = REASON_LABELS[r.reason_type] || { label: r.reason_type, color: '#64748b', bg: '#f8fafc' };
            const itemName = cachedItems.find(i => i.id === r.item_id)?.name || r.item_id;
            const store = allStores.find(s => (s.store_id || s.id) === r.store_id);
            const storeName = store?.store_name || store?.Name || r.store_id;
            const changeStr = r.change_qty >= 0
                ? `<span style="color:#10b981; font-weight:700;">+${r.change_qty}</span>`
                : `<span style="color:#ef4444; font-weight:700;">${r.change_qty}</span>`;
            const routeStr = r.source_route ? `<span style="font-size:0.75rem; color:var(--text-secondary);"> (${ROUTE_LABELS[r.source_route] || r.source_route})</span>` : '';
            const execTime = r.executed_at ? new Date(r.executed_at).toLocaleString('ja-JP', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';

            return `<tr style="border-bottom:1px solid var(--border);">
                <td style="padding:0.8rem 1rem; font-size:0.85rem; color:var(--text-secondary); font-family:monospace;">${r.business_date || '-'}</td>
                <td style="padding:0.8rem 1rem; font-size:0.85rem; color:var(--text-secondary);">${execTime}</td>
                <td style="padding:0.8rem 1rem; font-weight:600; font-size:0.9rem;">${itemName}</td>
                <td style="padding:0.8rem 1rem; font-size:0.8rem; color:var(--text-secondary);">${storeName}</td>
                <td style="padding:0.8rem 1rem; text-align:right; font-family:monospace; font-size:0.95rem;">${changeStr}</td>
                <td style="padding:0.8rem 1rem; font-family:monospace; font-size:0.85rem; color:var(--text-secondary);">${r.qty_after ?? '-'}</td>
                <td style="padding:0.8rem 1rem;">
                    <span style="background:${reasonInfo.bg}; color:${reasonInfo.color}; border:1px solid ${reasonInfo.color}40; border-radius:6px; padding:0.2rem 0.5rem; font-size:0.75rem; font-weight:700; white-space:nowrap;">
                        ${reasonInfo.label}${routeStr}
                    </span>
                </td>
                <td style="padding:0.8rem 1rem; font-size:0.8rem; color:var(--text-secondary);">${r.executed_by || '-'}</td>
                <td style="padding:0.8rem 1rem; font-size:0.8rem; color:var(--text-secondary); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.note || ''}</td>
            </tr>`;
        }).join('');

        content.innerHTML = `
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; text-align:left; min-width:900px;">
                    <thead>
                        <tr style="background:var(--surface-darker); border-bottom:2px solid var(--border); color:var(--text-secondary);">
                            <th style="padding:0.8rem 1rem; font-size:0.8rem;">営業日</th>
                            <th style="padding:0.8rem 1rem; font-size:0.8rem;">時刻</th>
                            <th style="padding:0.8rem 1rem; font-size:0.8rem;">品目</th>
                            <th style="padding:0.8rem 1rem; font-size:0.8rem;">拠点</th>
                            <th style="padding:0.8rem 1rem; font-size:0.8rem; text-align:right;">増減</th>
                            <th style="padding:0.8rem 1rem; font-size:0.8rem;">操作後</th>
                            <th style="padding:0.8rem 1rem; font-size:0.8rem;">理由</th>
                            <th style="padding:0.8rem 1rem; font-size:0.8rem;">実行者</th>
                            <th style="padding:0.8rem 1rem; font-size:0.8rem;">メモ</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    } catch (err) {
        content.innerHTML = `<div style="padding:2rem; color:var(--danger);">読み込みエラー: ${err.message}</div>`;
    }
}
