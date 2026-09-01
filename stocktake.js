import { db } from './firebase.js';
import { collection, getDocs, setDoc, doc, query, where, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm } from './ui_utils.js';

/**
 * 棚卸管理 (stocktake.js)
 * 「棚卸確定」ボタンを押した時点でのみ計算を実行してスナップショットをFirestoreに保存。
 * 表示時は保存済みデータを呼び出すだけなので読み込み速度を最速に維持。
 * 単位換算: 店舗の display_unit / unit_conversion_amount を使いマスタ単価に変換。
 *
 * 画面構成:
 *   [A] リスト画面 — 棚卸確定ボタン + 過去の棚卸表タイトル一覧
 *   [B] 詳細画面  — 選択した棚卸表の明細 + PDF出力 + 閉じるボタン
 */

export const stocktakePageHtml = `
    <div id="stocktake-app" class="animate-fade-in" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">

        <!-- ===== [A] リスト画面 ===== -->
        <div id="st-list-view" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">

            <!-- ヘッダー -->
            <div style="padding: 1rem 1.5rem; background: var(--surface-darker); border-bottom: 2px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <i class="fas fa-clipboard-list" style="color: var(--primary); font-size: 1.1rem;"></i>
                        <h3 style="margin: 0; font-size: 1rem; font-weight: 800;">棚卸管理</h3>
                    </div>
                    <div id="st-store-selector-container"></div>
                </div>
                <button id="btn-st-commit" class="btn btn-primary" disabled
                    style="display: none; align-items: center; gap: 0.5rem; padding: 0.6rem 1.4rem; font-weight: 800; font-size: 0.9rem; border-radius: 10px; box-shadow: 0 4px 12px rgba(230,57,70,0.2); white-space: nowrap;">
                    <i class="fas fa-check-double"></i> 棚卸確定
                </button>
            </div>

            <!-- コンテンツ -->
            <div id="st-list-content" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                <div style="text-align: center; padding: 5rem 2rem; color: var(--text-secondary);">
                    <i class="fas fa-store" style="font-size: 3rem; opacity: 0.1; display: block; margin-bottom: 1.5rem;"></i>
                    <p style="font-weight: 600;">拠点を選択してください</p>
                </div>
            </div>
        </div>

        <!-- ===== [B] 詳細画面 ===== -->
        <div id="st-detail-view" style="display: none; flex-direction: column; height: 100%; overflow: hidden;">

            <!-- ヘッダー -->
            <div style="padding: 1rem 1.5rem; background: var(--surface-darker); border-bottom: 2px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.8rem; min-width: 0;">
                    <i class="fas fa-file-invoice" style="color: var(--primary); font-size: 1.1rem; flex-shrink: 0;"></i>
                    <h3 id="st-detail-title" style="margin: 0; font-size: 1rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">棚卸表</h3>
                    <span id="st-detail-meta" style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; background: #f1f5f9; padding: 0.2rem 0.7rem; border-radius: 20px; white-space: nowrap; flex-shrink: 0;"></span>
                </div>
                <div style="display: flex; gap: 0.7rem; flex-shrink: 0;">
                    <button id="btn-st-pdf" class="btn"
                        style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.2rem; font-weight: 800; font-size: 0.85rem; background: #4f46e5; color: white; border: none; border-radius: 10px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">
                        <i class="fas fa-file-pdf"></i> PDF出力
                    </button>
                    <button id="btn-st-close" class="btn"
                        style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.2rem; font-weight: 800; font-size: 0.85rem; background: white; border: 1.5px solid var(--border); color: var(--text-secondary); border-radius: 10px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">
                        <i class="fas fa-arrow-left"></i> 閉じる
                    </button>
                </div>
            </div>

            <!-- 明細コンテンツ（PDF出力対象） -->
            <div style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                <div id="st-printable-area">
                    <div id="st-detail-content"></div>
                </div>
            </div>
        </div>

        <!-- ローディングオーバーレイ -->
        <div id="st-loading" style="display:none; position:fixed; inset:0; background:rgba(255,255,255,0.85); z-index:9999; justify-content:center; align-items:center;">
            <div class="glass-panel" style="padding: 2rem 3rem; text-align:center; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
                <i class="fas fa-calculator" style="font-size: 2.2rem; color: var(--primary); animation: st-spin 1s linear infinite;"></i>
                <p style="margin-top: 1rem; font-weight: 800; color: var(--text-primary); font-size: 1rem;">棚卸額を計算中...</p>
                <p style="margin-top: 0.3rem; font-size: 0.8rem; color: var(--text-secondary);">品目数が多い場合は少々お待ちください</p>
            </div>
        </div>

        <style>
            @keyframes st-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .st-record-row { transition: background 0.2s; }
            .st-record-row:hover { background: #f8fafc !important; }
            .st-record-row td:first-child { cursor: pointer; }
            #btn-st-pdf:hover { background: #4338ca !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,0.3); }
            #btn-st-close:hover { background: #f1f5f9 !important; }
            @media print {
                #st-list-header, #btn-st-pdf, #btn-st-close { display: none !important; }
            }
        </style>
    </div>
`;

// =========================================
// State
// =========================================
let selectedStoreId = null;
let allStores = [];
let masterCache = { items: [], ingredients: [], menus: [] };
let currentUser = null;
let allRecords = [];

// =========================================
// 初期化
// =========================================
export async function initStocktakePage(user) {
    currentUser = user;
    selectedStoreId = null;
    allRecords = [];

    // 詳細画面が残っていればリストに戻す
    switchToListView();

    await loadMasterData();
    populateStoreSelector();
    setupCommitButton();
    setupDetailButtons();
}

// =========================================
// マスタデータ読み込み
// =========================================
async function loadMasterData() {
    try {
        const [itemSnap, storeSnap, ingSnap] = await Promise.all([
            getDocs(collection(db, 'm_items')),
            getDocs(collection(db, 'm_stores')),
            getDocs(collection(db, 'm_ingredients'))
        ]);
        masterCache.items       = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allStores               = storeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        masterCache.ingredients = ingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('[Stocktake] Master data load error:', err);
    }
}

// =========================================
// 店舗セレクター
// =========================================
function populateStoreSelector() {
    const container = document.getElementById('st-store-selector-container');
    if (!container) return;

    const sortedStores = [...allStores].sort((a, b) =>
        (a.store_name || '').localeCompare(b.store_name || '')
    );

    container.innerHTML = `
        <select id="st-store-select"
            style="padding: 0.35rem 0.8rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.85rem; font-weight: 700; background: white; outline: none; cursor: pointer; color: var(--text-primary);">
            <option value="">拠点を選択...</option>
            ${sortedStores.map(s => {
                const sid  = s.store_id || s.id;
                const name = s.store_name || s.Name || s.id;
                return `<option value="${sid}">${name}</option>`;
            }).join('')}
        </select>
    `;

    const sel = document.getElementById('st-store-select');
    if (sel) {
        sel.onchange = async (e) => {
            selectedStoreId = e.target.value || null;
            const commitBtn = document.getElementById('btn-st-commit');
            if (commitBtn) commitBtn.disabled = !selectedStoreId;
            if (selectedStoreId) {
                await loadHistory();
            } else {
                renderEmptyState('拠点を選択してください');
            }
        };
    }
}

// =========================================
// 棚卸確定ボタンのセットアップ
// =========================================
function setupCommitButton() {
    const btn = document.getElementById('btn-st-commit');
    if (!btn) return;

    const canCommit = ['Admin', '管理者', 'Manager', '店長'].includes(currentUser?.Role);
    btn.style.display = canCommit ? 'flex' : 'none';
    btn.onclick = confirmAndRecord;
}

// =========================================
// 詳細画面ボタンのセットアップ
// =========================================
function setupDetailButtons() {
    const closeBtn = document.getElementById('btn-st-close');
    if (closeBtn) closeBtn.onclick = () => switchToListView();

    const pdfBtn = document.getElementById('btn-st-pdf');
    if (pdfBtn) pdfBtn.onclick = exportToPDF;
}

// =========================================
// 画面切り替え（リスト ⇔ 詳細）
// =========================================
function switchToListView() {
    const lv = document.getElementById('st-list-view');
    const dv = document.getElementById('st-detail-view');
    if (lv) lv.style.display = 'flex';
    if (dv) dv.style.display = 'none';
}

function switchToDetailView() {
    const lv = document.getElementById('st-list-view');
    const dv = document.getElementById('st-detail-view');
    if (lv) lv.style.display = 'none';
    if (dv) dv.style.display = 'flex';
}

// =========================================
// 棚卸履歴の読み込み
// =========================================
async function loadHistory() {
    const content = document.getElementById('st-list-content');
    if (!content) return;

    content.innerHTML = '<div style="padding: 3rem; text-align: center;"><i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--primary);"></i></div>';

    try {
        const q = query(
            collection(db, 't_stocktake_snapshots'),
            where('store_id', '==', selectedStoreId),
            limit(50)
        );
        const snap = await getDocs(q);
        allRecords = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.business_date || '').localeCompare(a.business_date || ''));
        renderListView(allRecords);
    } catch (err) {
        content.innerHTML = `<div style="padding: 2rem; color: var(--danger); font-weight: 600;"><i class="fas fa-exclamation-triangle"></i> 読み込みエラー: ${err.message}</div>`;
    }
}

// =========================================
// ヘルパー：日付フォーマット
// =========================================
function formatDateTitle(businessDate) {
    // "2026-07-31" → "20260731"
    return businessDate ? businessDate.replace(/-/g, '') : '';
}

// =========================================
// [A] リスト画面の描画
// =========================================
function renderEmptyState(msg) {
    const content = document.getElementById('st-list-content');
    if (!content) return;
    content.innerHTML = `
        <div style="text-align: center; padding: 5rem 2rem; color: var(--text-secondary);">
            <i class="fas fa-store" style="font-size: 3rem; opacity: 0.1; display: block; margin-bottom: 1.5rem;"></i>
            <p style="font-weight: 600;">${msg}</p>
        </div>
    `;
}

function renderListView(records) {
    const content = document.getElementById('st-list-content');
    if (!content) return;

    if (records.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 5rem 2rem; color: var(--text-secondary);">
                <i class="fas fa-clipboard" style="font-size: 3rem; opacity: 0.1; display: block; margin-bottom: 1.5rem;"></i>
                <p style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">棚卸記録がまだありません</p>
                <p style="font-size: 0.85rem;">右上の「棚卸確定」ボタンを押すと棚卸表が生成されます</p>
            </div>
        `;
        return;
    }

    // サマリーカード（最新レコード）
    const latest = records[0];
    const summaryHtml = `
        <div class="glass-panel" style="padding: 1.5rem 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; box-shadow: 0 8px 24px rgba(102,126,234,0.3);">
            <div>
                <div style="font-size: 0.75rem; opacity: 0.85; margin-bottom: 0.4rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">最新の棚卸総額</div>
                <div style="font-size: 2.4rem; font-weight: 900; font-family: monospace; letter-spacing: -0.02em; line-height: 1;">¥${(latest.total_amount || 0).toLocaleString()}</div>
                <div style="font-size: 0.72rem; opacity: 0.75; margin-top: 0.5rem;">棚卸表：${formatDateTitle(latest.business_date)} ／ 記録者: ${latest.recorded_by || '-'}</div>
            </div>
            <div style="opacity: 0.15; font-size: 5rem;"><i class="fas fa-calculator"></i></div>
        </div>
    `;

    // 棚卸表リスト
    const rows = records.map((r, idx) => {
        const prev    = records[idx + 1];
        const diff    = prev != null ? (r.total_amount - prev.total_amount) : null;
        const diffHtml = diff !== null
            ? `<span style="color:${diff >= 0 ? '#059669' : '#dc2626'}; font-size:0.78rem; font-weight:800; background:${diff >= 0 ? '#ecfdf5' : '#fef2f2'}; padding:0.15rem 0.5rem; border-radius:20px;">${diff >= 0 ? '+' : ''}¥${diff.toLocaleString()}</span>`
            : '<span style="color:var(--text-secondary); font-size:0.8rem;">—</span>';

        return `
        <tr class="st-record-row" data-idx="${idx}" style="border-bottom: 1px solid var(--border);">
            <td style="padding: 1rem 1.5rem; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <i class="fas fa-file-alt" style="color: var(--primary); font-size: 0.85rem; flex-shrink: 0;"></i>
                    <span style="font-weight: 800; color: var(--text-primary); font-size: 0.95rem;">棚卸表：${formatDateTitle(r.business_date)}</span>
                </div>
            </td>
            <td style="padding: 1rem; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">
                ${new Date(r.recorded_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </td>
            <td style="padding: 1rem; font-weight: 900; font-family: monospace; font-size: 1.1rem; color: var(--primary);">
                ¥${(r.total_amount || 0).toLocaleString()}
            </td>
            <td style="padding: 1rem;">${diffHtml}</td>
            <td style="padding: 1rem; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">${r.recorded_by || ''}</td>
            <td style="padding: 1rem 1.5rem; text-align: right;">
                <button class="btn-st-open" data-idx="${idx}"
                    style="background: white; border: 1.5px solid var(--primary); color: var(--primary); font-size: 0.75rem; padding: 0.35rem 0.9rem; border-radius: 8px; font-weight: 800; cursor: pointer; transition: all 0.2s;"
                    onmouseover="this.style.background='var(--primary)';this.style.color='white';"
                    onmouseout="this.style.background='white';this.style.color='var(--primary)';">
                    <i class="fas fa-external-link-alt"></i> 開く
                </button>
            </td>
        </tr>`;
    }).join('');

    content.innerHTML = `
        ${summaryHtml}
        <div class="glass-panel" style="padding: 0; overflow: hidden; border-radius: 12px;">
            <div style="padding: 0.8rem 1.5rem; background: #f8fafc; border-bottom: 1px solid var(--border); font-size: 0.72rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-history" style="color: var(--primary);"></i> 棚卸記録一覧（直近50件）
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid var(--border); background: white;">
                            <th style="padding: 0.75rem 1.5rem; font-weight: 800;">棚卸表</th>
                            <th style="padding: 0.75rem 1rem; font-weight: 800;">記録日時</th>
                            <th style="padding: 0.75rem 1rem; font-weight: 800;">棚卸総額</th>
                            <th style="padding: 0.75rem 1rem; font-weight: 800;">前回比</th>
                            <th style="padding: 0.75rem 1rem; font-weight: 800;">記録者</th>
                            <th style="padding: 0.75rem 1.5rem;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;

    // 行クリック と「開く」ボタン の両方から詳細画面に遷移
    content.querySelectorAll('.st-record-row td:first-child, .btn-st-open').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const row = el.closest('[data-idx]') || el;
            const idx = parseInt(row.dataset.idx);
            if (!isNaN(idx) && allRecords[idx]) {
                showDetailView(allRecords[idx]);
            }
        };
    });
}

// =========================================
// [B] 詳細画面の表示
// =========================================
function showDetailView(record) {
    const titleEl = document.getElementById('st-detail-title');
    const metaEl  = document.getElementById('st-detail-meta');

    if (titleEl) titleEl.textContent = `棚卸表：${formatDateTitle(record.business_date)}`;
    if (metaEl)  metaEl.textContent  = `${record.store_name || record.store_id} ／ ${new Date(record.recorded_at).toLocaleString('ja-JP')} ／ ${record.recorded_by || ''}`;

    const detailContent = document.getElementById('st-detail-content');
    if (detailContent) detailContent.innerHTML = renderDetailTable(record);

    switchToDetailView();
}

// =========================================
// 詳細テーブルのHTML生成
// =========================================
function renderDetailTable(record) {
    const items     = record.items || [];
    const storeName = record.store_name || record.store_id || '';
    const dateTitle = formatDateTitle(record.business_date);

    if (items.length === 0) {
        return '<div style="text-align:center; padding: 3rem; color: var(--text-secondary);">内訳データがありません</div>';
    }

    const rows = items.map((item, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9;"
            onmouseover="this.style.background='#fafbff'" onmouseout="this.style.background='white'">
            <td style="padding: 0.7rem 1.2rem; font-size: 0.88rem; font-weight: 700; color: #1e293b;">
                <span style="color: #94a3b8; font-size: 0.75rem; margin-right: 0.4rem;">${idx + 1}</span>${item.item_name || '-'}
            </td>
            <td style="padding: 0.7rem 1rem; text-align: right; font-family: monospace; font-size: 0.95rem; font-weight: 800; color: #334155;">${item.qty != null ? item.qty : '-'}</td>
            <td style="padding: 0.7rem 1rem; text-align: center; font-size: 0.85rem; color: #64748b; font-weight: 600;">${item.display_unit || '-'}</td>
            <td style="padding: 0.7rem 1rem; text-align: right; font-family: monospace; font-size: 0.85rem; color: #475569; font-weight: 600;">¥${(item.unit_price || 0).toLocaleString()}</td>
            <td style="padding: 0.7rem 1.2rem; text-align: right; font-family: monospace; font-size: 0.95rem; font-weight: 900; color: var(--primary);">¥${(item.subtotal || 0).toLocaleString()}</td>
        </tr>
    `).join('');

    return `
        <!-- PDF印刷用ヘッダー情報 -->
        <div style="margin-bottom: 1.5rem; padding: 1.5rem 2rem; background: white; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.2rem;">
                <div>
                    <div style="font-size: 0.65rem; font-weight: 900; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.4rem;">INVENTORY REPORT</div>
                    <h2 style="margin: 0; font-size: 1.9rem; font-weight: 900; color: var(--text-primary); letter-spacing: -0.02em;">棚卸表：${dateTitle}</h2>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 700; margin-bottom: 0.2rem;">拠点</div>
                    <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-primary);">${storeName}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                <div>
                    <div style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">確認日</div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary);">${record.business_date || '-'}</div>
                </div>
                <div>
                    <div style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">記録者</div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary);">${record.recorded_by || '-'}</div>
                </div>
                <div>
                    <div style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">品目数</div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary);">${items.length} 品目</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding-top: 1rem; margin-top: 1rem; border-top: 1px dashed var(--border);">
                <div>
                    <div style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">ドリンク棚卸額</div>
                    <div style="font-weight: 900; font-size: 1.1rem; color: #1d4ed8;">¥${(record.total_drink || 0).toLocaleString()}</div>
                </div>
                <div>
                    <div style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">フード棚卸額</div>
                    <div style="font-weight: 900; font-size: 1.1rem; color: #c2410c;">¥${(record.total_food || 0).toLocaleString()}</div>
                </div>
                <div>
                    <div style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">その他・未分類</div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: #475569;">¥${(record.total_other || 0).toLocaleString()}</div>
                </div>
            </div>
        </div>

        <!-- 明細テーブル -->
        <div class="glass-panel" style="padding: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 0.85rem 1.2rem; text-align: left;   font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800;">品目</th>
                        <th style="padding: 0.85rem 1rem;  text-align: right;  font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800;">在庫数</th>
                        <th style="padding: 0.85rem 1rem;  text-align: center; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800;">単位</th>
                        <th style="padding: 0.85rem 1rem;  text-align: right;  font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800;">単価</th>
                        <th style="padding: 0.85rem 1.2rem; text-align: right; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 800;">合計金額</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr style="background: linear-gradient(135deg, #f8fafc 0%, #f0f4ff 100%); border-top: 2px solid #e2e8f0;">
                        <td colspan="4" style="padding: 1.1rem 1.2rem; font-weight: 900; font-size: 1rem; color: var(--text-primary);">
                            <i class="fas fa-calculator" style="color: var(--primary); margin-right: 0.4rem;"></i>棚卸総額
                        </td>
                        <td style="padding: 1.1rem 1.2rem; text-align: right; font-family: monospace; font-size: 1.4rem; font-weight: 900; color: var(--primary);">
                            ¥${(record.total_amount || 0).toLocaleString()}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// =========================================
// 棚卸確定フロー
// =========================================
async function confirmAndRecord() {
    if (!selectedStoreId) return;

    const store     = allStores.find(s => (s.store_id || s.id) === selectedStoreId);
    const storeName = store?.store_name || store?.Name || selectedStoreId;

    const ok = await showConfirm(
        '棚卸確定',
        `【${storeName}】の現在の在庫数で棚卸額を確定します。\n同じ営業日のデータは上書きされます。\n\n続けますか？`
    );
    if (!ok) return;

    await recordStocktake();
}

function getBusinessDate() {
    const store     = allStores.find(s => (s.store_id || s.id) === selectedStoreId);
    const resetTime = store?.reset_time || '05:00';
    const now       = new Date();
    const [h, m]    = resetTime.split(':').map(Number);
    let cutoff      = new Date(now);
    cutoff.setHours(h, m, 0, 0);
    if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);
    return cutoff.toISOString().split('T')[0];
}

// =========================================
// 棚卸スナップショット記録（計算コア）
// 単位換算: qty × (masterUnitPrice × unit_conversion_amount) = 棚卸額
// =========================================
async function recordStocktake() {
    const loadEl = document.getElementById('st-loading');
    if (loadEl) loadEl.style.display = 'flex';

    try {
        // 対象拠点の全在庫品目を取得
        const snap       = await getDocs(query(collection(db, 'm_store_items'), where('StoreID', '==', selectedStoreId)));
        const storeItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const businessDate = getBusinessDate();
        const now          = new Date().toISOString();
        const store        = allStores.find(s => (s.store_id || s.id) === selectedStoreId);
        const storeName    = store?.store_name || store?.Name || selectedStoreId;

        let totalAmount    = 0;
        let totalDrink     = 0;
        let totalFood      = 0;
        let totalOther     = 0;
        const itemSnapshots = [];

        for (const si of storeItems) {
            if (!si.ProductID) continue;
            const item = masterCache.items.find(i => i.id === si.ProductID);
            if (!item) continue;

            // 備品は棚卸対象から除外（計算にも明細にも含めない）
            if (item.major_category === '備品') continue;

            const qty      = Number(si.個数 || 0);
            const convAmt  = Number(si.unit_conversion_amount || 1); // 例: 1箱=500g → 500

            // m_ingredientsから仕入れ単価・内容量を取得
            const ing = masterCache.ingredients.find(i => i.item_id === si.ProductID);

            // 棚卸単価 = 仕入れ単価 ÷ 内容量 × 換算係数
            // （歩留率は棚卸では考慮しない。あくまで「仕入れた金額」が棚卸額となる）
            // 例: とさか ¥950/500g, 1パック=500g → ¥950/500×500 = ¥950/パック
            const purchasePrice  = Number(ing.purchase_price  || 0);
            const contentAmount  = Number(ing.content_amount  || 0);
            const netUnitPrice   = Number(ing.net_unit_price  || 0);

            let displayUnitPrice = 0;
            if (purchasePrice > 0 && contentAmount > 0) {
                // 1マスタ単位あたりの仕入れ単価 × 換算係数 = 1表示単位あたりの仕入れ単価
                const pricePerMasterUnit = purchasePrice / contentAmount;
                displayUnitPrice = pricePerMasterUnit * convAmt;
            } else if (purchasePrice > 0 && contentAmount === 0) {
                // content_amountが未設定の場合: 仕入れ単価をそのまま使用
                displayUnitPrice = purchasePrice;
            } else if (netUnitPrice > 0) {
                // 自家製原材料の場合（仕入単価がなく、正味仕込単価が存在する）
                displayUnitPrice = netUnitPrice * convAmt;
            }
            // ※ purchasePrice が 0 の場合は ¥0 として記録（マスタ未設定）

            const subtotal = displayUnitPrice * qty;
            totalAmount   += subtotal;

            const category = item.major_category || 'その他';
            if (category === 'ドリンク') totalDrink += subtotal;
            else if (category === 'フード') totalFood += subtotal;
            else totalOther += subtotal;

            itemSnapshots.push({
                item_id:      si.ProductID,
                item_name:    item.name || si.ProductID,
                major_category: category,
                display_unit: si.display_unit || item.unit || '',
                qty:          qty,
                unit_price:   Math.round(displayUnitPrice * 100) / 100,
                subtotal:     Math.round(subtotal)
            });
        }

        // 同じ営業日のデータは上書き（ドキュメントID: 店舗ID_YYYY-MM-DD）
        const docId = `${selectedStoreId}_${businessDate}`;
        await setDoc(doc(db, 't_stocktake_snapshots', docId), {
            business_date: businessDate,
            store_id:      selectedStoreId,
            store_name:    storeName,
            recorded_at:   now,
            recorded_by:   currentUser?.Name || currentUser?.Email || 'unknown',
            total_amount:  Math.round(totalAmount),
            total_drink:   Math.round(totalDrink),
            total_food:    Math.round(totalFood),
            total_other:   Math.round(totalOther),
            note:          '',
            items:         itemSnapshots
        });

        await showAlert(
            '棚卸確定完了',
            `棚卸総額: ¥${Math.round(totalAmount).toLocaleString()}\n（${itemSnapshots.length} 品目）`
        );
        await loadHistory();

    } catch (err) {
        console.error('[Stocktake] recordStocktake error:', err);
        await showAlert('エラー', err.message);
    } finally {
        if (loadEl) loadEl.style.display = 'none';
    }
}

// =========================================
// PDF出力（html2pdf.js を使用）
// =========================================
async function exportToPDF() {
    const printArea = document.getElementById('st-printable-area');
    if (!printArea) return;

    if (typeof window.html2pdf === 'undefined') {
        await showAlert('PDF出力エラー', 'PDFライブラリが読み込まれていません。\nページを再読み込みしてから再度お試しください。');
        return;
    }

    const titleEl = document.getElementById('st-detail-title');
    const filename = (titleEl?.textContent || '棚卸表').replace(/[\/\\:*?"<>|]/g, '_') + '.pdf';

    const pdfBtn = document.getElementById('btn-st-pdf');
    if (pdfBtn) {
        pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
        pdfBtn.disabled  = true;
    }

    try {
        const opt = {
            margin:     [12, 12, 12, 12],
            filename:   filename,
            image:      { type: 'jpeg', quality: 0.96 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF:      { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await window.html2pdf().set(opt).from(printArea).save();
    } catch (err) {
        console.error('[Stocktake] PDF export error:', err);
        await showAlert('PDF出力エラー', err.message);
    } finally {
        if (pdfBtn) {
            pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF出力';
            pdfBtn.disabled  = false;
        }
    }
}
