import { db } from './firebase.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getEffectivePrice } from './cost_engine.js?v=9';

// モジュールレベルでのデータ保持（再ソート用）
let lastResults = [];
let lastTotalCustomers = 0;
let abcMetric = 'profit'; // 'profit' or 'qty'
let selectedCategory = 'all'; // 'all', 'フード', 'ドリンク'
let includeOtoshi = true;
let sortStates = {
    prob: { key: 'qty', asc: false },
    detail: { key: 'profit', asc: false }
};
let lastFilteredResults = []; // モバイルタイル連動用

/**
 * セグメントコントロール用のCSSを注入
 */
function injectComponentStyles() {
    if (document.getElementById('product-analysis-styles')) return;
    const style = document.createElement('style');
    style.id = 'product-analysis-styles';
    style.textContent = `
        .abc-toggle-group {
            display: flex;
            background: #f1f5f9;
            padding: 2px;
            border-radius: 8px;
            gap: 2px;
        }
        .abc-toggle-btn {
            border: none;
            background: transparent;
            padding: 4px 12px;
            font-size: 0.75rem;
            font-weight: 700;
            color: #64748b;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s;
        }
        .abc-toggle-btn:hover {
            color: var(--primary);
        }
        .abc-toggle-btn.active {
            background: white;
            color: var(--primary);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .abc-global-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding: 0.8rem 1.5rem;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            border: 1px solid var(--border);
        }
        .abc-chip-group {
            display: flex;
            gap: 0.4rem;
        }
        .abc-chip {
            padding: 2px 10px;
            font-size: 0.7rem;
            font-weight: 700;
            border-radius: 20px;
            border: 1px solid var(--border);
            background: white;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
        }
        .abc-chip:hover {
            border-color: var(--primary);
            color: var(--primary);
        }
        .abc-chip.active {
            background: var(--primary);
            border-color: var(--primary);
            color: white;
        }
    `;
    document.head.appendChild(style);
}

/**
 * 商品分析（4つの窓）をレンダリングする (エントリポイント)
 */
export async function renderProductAnalysis(containerId, filters) {
    injectComponentStyles();
    const container = document.getElementById(containerId);
    if (!container) return;

    const { storeId, dateFrom, dateTo } = filters;
    const isMobile = window.innerWidth <= 1024;
    
    // UIのスケルトンを表示 (ローディング)
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem; color: var(--primary);"></i>
            <p>分析データを集計中...</p>
        </div>
    `;

    try {
        const months = getMonthsInRange(dateFrom, dateTo);
        let totalCustomers = 0;
        let monthlySales = [];

        const promises = months.map(async (ym) => {
            let qPerf = query(collection(db, "t_performance"), where("year_month", "==", ym));
            if (storeId !== 'all') qPerf = query(qPerf, where("store_id", "==", storeId));
            const snapPerf = await getDocs(qPerf);
            snapPerf.forEach(d => totalCustomers += (d.data().customer_count || 0));

            let qSales = query(collection(db, "t_monthly_sales"), where("year_month", "==", ym));
            if (storeId !== 'all') qSales = query(qSales, where("store_id", "==", storeId));
            const snapSales = await getDocs(qSales);
            snapSales.forEach(d => {
                const data = d.data();
                if (data.is_total) monthlySales.push(data);
            });
        });

        await Promise.all(promises);

        if (monthlySales.length === 0) {
            container.innerHTML = `<div class="glass-panel" style="padding: 3rem; text-align: center;">該当期間のメニュー別売上データが見つかりません。</div>`;
            return;
        }

        const [itemSnap, ingSnap, menuSnap] = await Promise.all([
            getDocs(collection(db, "m_items")),
            getDocs(collection(db, "m_ingredients")),
            getDocs(collection(db, "m_menus"))
        ]);
        const cache = {
            items: itemSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            ingredients: ingSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            menus: menuSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };

        const productMap = {};
        monthlySales.forEach(ms => {
            const key = ms.menu_name;
            if (!productMap[key]) {
                const menu = cache.menus.find(m => m.dinii_id === ms.dinii_id || m.menu_name === ms.menu_name);
                const itemId = menu ? menu.item_id : null;
                productMap[key] = {
                    name: ms.menu_name,
                    qty: 0,
                    sales: 0,
                    itemId: itemId,
                    costPerUnit: itemId ? getEffectivePrice(itemId, cache) : 0
                };
            }
            productMap[key].qty += (ms.quantity_sold || 0);
            productMap[key].sales += (ms.total_sales || 0);
        });

        const results = Object.values(productMap).map(p => {
            const totalCost = p.costPerUnit * p.qty;
            const profit = p.sales - totalCost;
            
            const item = cache.items.find(i => i.id === p.itemId);
            const category = item ? (item.major_category || item.category || 'その他') : 'その他';

            return {
                ...p,
                category: category,
                cost: totalCost,
                profit: profit,
                margin: p.sales > 0 ? Math.round((profit / p.sales) * 1000) / 10 : 0,
                prob: totalCustomers > 0 ? (p.qty / totalCustomers) * 100 : 0
            };
        });

        lastResults = results;
        lastTotalCustomers = totalCustomers;

        // デバイスに応じて描画を振り分け
        if (isMobile) {
            renderProductAnalysisMobile(container);
        } else {
            renderProductAnalysisPC(container);
        }

    } catch (e) {
        console.error("Product analysis logic error:", e);
        container.innerHTML = `<div class="glass-panel" style="padding: 3rem; text-align: center; color: var(--danger);">エラーが発生しました: ${e.message}</div>`;
    }
}

/**
 * PC版：商品分析ダッシュボードの描画
 */
function renderProductAnalysisPC(container) {
    container.innerHTML = `
        <!-- グローバル・コントロールバー -->
        <div class="abc-global-bar">
            <div class="abc-chip-group">
                <span class="abc-chip-label"><i class="fas fa-filter"></i> カテゴリー別:</span>
                <button class="abc-chip ${selectedCategory === 'all' ? 'active' : ''}" onclick="window._handleAbcFilterChange('category', 'all')">全商品</button>
                <button class="abc-chip ${selectedCategory === 'フード' ? 'active' : ''}" onclick="window._handleAbcFilterChange('category', 'フード')">フード</button>
                <button class="abc-chip ${selectedCategory === 'ドリンク' ? 'active' : ''}" onclick="window._handleAbcFilterChange('category', 'ドリンク')">ドリンク</button>
            </div>
            <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; color: var(--text-primary); cursor: pointer; font-weight: 700; background: #f8fafc; padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid var(--border);">
                <input type="checkbox" id="abc-include-otoshi" ${includeOtoshi ? 'checked' : ''} onchange="window._handleAbcFilterChange('otoshi', this.checked)" style="width: 1.1rem; height: 1.1rem; accent-color: var(--primary);"> お通しを含める
            </label>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
            <div class="glass-panel" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
                    <h4 style="margin: 0; font-size: 0.95rem;">
                        <i class="fas fa-chart-pie" style="color: var(--primary);"></i> 1. ABC分析 <span id="abc-metric-label" style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 400;">(${abcMetric === 'profit' ? '粗利' : '出数'}ベース)</span>
                    </h4>
                    <div class="abc-toggle-group">
                        <button class="abc-toggle-btn ${abcMetric === 'profit' ? 'active' : ''}" onclick="window._handleAbcMetricChange('profit')">粗利</button>
                        <button class="abc-toggle-btn ${abcMetric === 'qty' ? 'active' : ''}" onclick="window._handleAbcMetricChange('qty')">出数</button>
                    </div>
                </div>
                <div id="product-abc-chart" style="height: 250px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.01); border-radius: 8px;">
                    <i class="fas fa-spinner fa-spin" style="color: var(--primary);"></i>
                </div>
            </div>
            <div class="glass-panel" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; font-size: 0.95rem;">
                    <i class="fas fa-th-large" style="color: var(--secondary);"></i> 2. 粗利ミックス (Menu Engineering)
                </h4>
                <div id="product-matrix-chart" style="height: 250px; position: relative; border: 1px solid var(--border); background: white; border-radius: 8px; overflow: hidden;">
                    <div style="position: absolute; top:0; left:50%; bottom:0; border-left: 1px dashed #eee;"></div>
                    <div style="position: absolute; left:0; top:50%; right:0; border-top: 1px dashed #eee;"></div>
                    <div id="product-matrix-plot" style="width: 100%; height: 100%; position: relative;"></div>
                </div>
            </div>
            <div class="glass-panel" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; font-size: 0.95rem;">
                    <i class="fas fa-percentage" style="color: var(--warning);"></i> 3. 注文確率 (販売数 / 客数)
                </h4>
                <div style="height: 250px; overflow-y: auto;">
                    <table class="dash-data-table" style="min-width: 100%; font-size: 0.8rem;">
                        <thead style="position: sticky; top: 0; background: white; z-index: 2;">
                            <tr style="cursor: pointer;">
                                <th>商品名</th>
                                <th style="text-align:right;" onclick="window._handleProductSort('qty', 'prob')">数量 <span id="sort-icon-prob-qty"></span></th>
                                <th style="text-align:right;" onclick="window._handleProductSort('prob', 'prob')">確率 <span id="sort-icon-prob-prob"></span></th>
                            </tr>
                        </thead>
                        <tbody id="product-prob-body"></tbody>
                    </table>
                </div>
            </div>
            <div class="glass-panel" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; font-size: 0.95rem;">
                    <i class="fas fa-balance-scale" style="color: #8B5CF6;"></i> 4. 実食量/ロス分析
                </h4>
                <div style="height: 250px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.01); border-radius: 8px;">
                    <p style="font-size: 0.75rem; color: var(--text-secondary); text-align: center; padding: 1rem;">
                        棚卸しデータ(t_inventory_logs)と連携して、<br>理論消費と実消費の差異を可視化します（開発予定）
                    </p>
                </div>
            </div>
        </div>
        <div class="glass-panel" style="padding: 1.5rem;">
            <h4 style="margin: 0 0 1rem; font-size: 0.95rem;">分析データ詳細</h4>
            <div class="dash-table-wrapper" style="max-height: 400px;">
                <table class="dash-data-table" style="min-width: 100%;">
                    <thead style="position: sticky; top: 0; background: white; z-index: 2;">
                        <tr style="cursor: pointer;">
                            <th style="width: 40px; text-align: center;">#</th>
                            <th>商品名</th>
                            <th style="text-align:right;" onclick="window._handleProductSort('qty', 'detail')">販売数 <span id="sort-icon-detail-qty"></span></th>
                            <th style="text-align:right;" onclick="window._handleProductSort('sales', 'detail')">売上高(税抜) <span id="sort-icon-detail-sales"></span></th>
                            <th style="text-align:right;" onclick="window._handleProductSort('cost', 'detail')">原価 <span id="sort-icon-detail-cost"></span></th>
                            <th style="text-align:right;" onclick="window._handleProductSort('profit', 'detail')">粗利額(税抜) <span id="sort-icon-detail-profit"></span></th>
                            <th style="text-align:right;" onclick="window._handleProductSort('margin', 'detail')">粗利率 <span id="sort-icon-detail-margin"></span></th>
                            <th style="text-align:center;" onclick="window._handleProductSort('rank', 'detail')">ランク <span id="sort-icon-detail-rank"></span></th>
                        </tr>
                    </thead>
                    <tbody id="product-detail-body">
                        <tr><td colspan="7" style="text-align:center; padding: 2rem;">集計中...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // グローバルに関数を登録（HTMLのonclickから呼べるように）
    window._handleProductSort = (key, type) => {
        handleSort(key, type);
    };

    window._handleAbcMetricChange = (metric) => {
        abcMetric = metric;
        // UI状態の更新
        const btns = document.querySelectorAll('.abc-toggle-group .abc-toggle-btn');
        btns.forEach(b => {
            b.classList.toggle('active', b.textContent === (metric === 'profit' ? '粗利' : '出数'));
        });
        const label = document.getElementById('abc-metric-label');
        if (label) label.textContent = `(${metric === 'profit' ? '粗利' : '出数'}ベース)`;

        refreshAbcDisplay();
    };

    window._handleAbcFilterChange = (type, value) => {
        if (type === 'category') {
            selectedCategory = value;
            const chips = document.querySelectorAll('.abc-chip');
            const labels = { all: '全商品', フード: 'フード', ドリンク: 'ドリンク' };
            chips.forEach(c => {
                c.classList.toggle('active', c.textContent === labels[value]);
            });
        } else if (type === 'otoshi') {
            includeOtoshi = value;
        }
        refreshAbcDisplay();
    };

    // 初期表示
    updateSortIcons();
    refreshAbcDisplay();
}

/**
 * スマホ版：商品分析ダッシュボードの描画
 */
function renderProductAnalysisMobile(container) {
    container.innerHTML = `
        <style>
            .mobile-metric-card {
                background: white;
                border-radius: 16px;
                padding: 1.2rem;
                margin-bottom: 1rem;
                border: 1px solid var(--border);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }
            .mobile-grid-metric {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.8rem;
                margin-top: 0.8rem;
                padding-top: 0.8rem;
                border-top: 1px dashed #eee;
            }
            .metric-item {
                display: flex;
                flex-direction: column;
            }
            .metric-label { font-size: 0.7rem; color: #94a3b8; font-weight: 700; margin-bottom: 0.1rem; }
            .metric-value { font-size: 0.95rem; font-weight: 800; color: #1e293b; }
            
            .matrix-tile-container {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.6rem;
                margin-bottom: 1.5rem;
            }
            .matrix-tile {
                padding: 1.2rem 1rem;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                cursor: pointer;
                transition: transform 0.2s;
                border: 2.5px solid transparent;
            }
            .matrix-tile:active { transform: scale(0.95); }
            .matrix-tile.active { border-color: #1e293b; box-shadow: 0 0 0 2px white, 0 0 0 4px #cbd5e1; }
            .matrix-tile-name { font-size: 0.85rem; font-weight: 900; margin-bottom: 0.2rem; }
            .matrix-tile-count { font-size: 0.7rem; opacity: 0.8; font-weight: 700; }
            
            .sticky-filter-bar {
                position: sticky;
                top: 0;
                z-index: 100;
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(10px);
                padding: 0.8rem 1rem;
                border-bottom: 1px solid var(--border);
                margin: 0 -1rem 1.5rem -1rem;
                display: flex;
                gap: 0.6rem;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            .rank-badge {
                padding: 0.2rem 0.6rem;
                border-radius: 6px;
                font-size: 0.75rem;
                font-weight: 900;
            }
            .rank-A { background: #ecfdf5; color: #059669; }
            .rank-B { background: #fffbeb; color: #d97706; }
            .rank-C { background: #f1f5f9; color: #64748b; }
        </style>

        <div style="padding: 0 1rem 5rem 1rem;">
            <!-- 固定フィルターバー -->
            <div class="sticky-filter-bar">
                <button class="abc-chip ${selectedCategory === 'all' ? 'active' : ''}" onclick="window._handleAbcFilterChange('category', 'all')" style="white-space: nowrap;">全商品</button>
                <button class="abc-chip ${selectedCategory === 'フード' ? 'active' : ''}" onclick="window._handleAbcFilterChange('category', 'フード')" style="white-space: nowrap;">フード</button>
                <button class="abc-chip ${selectedCategory === 'ドリンク' ? 'active' : ''}" onclick="window._handleAbcFilterChange('category', 'ドリンク')" style="white-space: nowrap;">ドリンク</button>
                <div style="width: 1px; height: 1.5rem; background: #e2e8f0; margin: 0 0.4rem;"></div>
                <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 800; white-space: nowrap; color: #475569;">
                    <input type="checkbox" ${includeOtoshi ? 'checked' : ''} onchange="window._handleAbcFilterChange('otoshi', this.checked)"> お通し込
                </label>
            </div>

            <!-- 1. ABC分析分布 -->
            <div class="glass-panel" style="padding: 1.2rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h4 style="margin: 0; font-size: 0.95rem;"><i class="fas fa-chart-pie" style="color: var(--primary);"></i> 1. ABC分析</h4>
                    <div class="abc-toggle-group" style="scale: 0.85; transform-origin: right;">
                        <button class="abc-toggle-btn ${abcMetric === 'profit' ? 'active' : ''}" onclick="window._handleAbcMetricChange('profit')">粗利</button>
                        <button class="abc-toggle-btn ${abcMetric === 'qty' ? 'active' : ''}" onclick="window._handleAbcMetricChange('qty')">出数</button>
                    </div>
                </div>
                <div id="product-abc-chart" style="height: 180px;"></div>
            </div>

            <!-- 2. 粗利ミックスタイル -->
            <h4 style="margin: 0 0 1rem; font-size: 0.95rem;"><i class="fas fa-th-large" style="color: var(--secondary);"></i> 2. 粗利ミックス分析</h4>
            <div id="matrix-tile-container" class="matrix-tile-container">
                <!-- Tiles injected by JS -->
            </div>

            <!-- 3. 詳細カードリスト -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0; font-size: 0.95rem;"><i class="fas fa-list-ol" style="color: #6366f1;"></i> 3. 分析データ詳細</h4>
                <div style="display: flex; gap: 0.4rem;">
                    <button class="btn" onclick="window._handleProductSort('profit', 'detail')" style="padding: 6px 10px; font-size: 0.75rem; font-weight: 800; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px;">
                        粗利順 <i class="fas fa-sort-amount-down"></i>
                    </button>
                </div>
            </div>
            
            <div id="product-detail-body">
                <!-- Cards injected by JS -->
            </div>
        </div>

        <!-- ボトムステータスバー -->
        <div id="mobile-abc-bottom-bar" style="position: fixed; bottom: 0; left: 0; right: 0; background: #1e293b; color: white; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid rgba(255,255,255,0.1); z-index: 101; box-shadow: 0 -10px 15px -3px rgba(0,0,0,0.1);">
            <div>
                <div style="font-size: 0.7rem; opacity: 0.7; font-weight: 700;">合計粗利(期間内)</div>
                <div id="bottom-bar-profit" style="font-size: 1.1rem; font-weight: 900; color: #10b981;">¥0</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.7rem; opacity: 0.7; font-weight: 700;">表示中</div>
                <div id="bottom-bar-count" style="font-size: 1rem; font-weight: 900;">0 品目</div>
            </div>
        </div>
    `;

    refreshAbcDisplay();
}

function handleSort(key, type) {
    const state = sortStates[type];
    if (state.key === key) {
        state.asc = !state.asc;
    } else {
        state.key = key;
        state.asc = false;
    }

    updateSortIcons();
    renderTables();
}

function refreshAbcDisplay() {
    const isMobile = window.innerWidth <= 1024;
    const filtered = getFilteredResults();
    assignAbcRanks(filtered, abcMetric);
    
    // ソート処理
    const detailData = [...filtered];
    const dKey = sortStates.detail.key;
    const dAsc = sortStates.detail.asc;
    detailData.sort((a, b) => {
        let valA = a[dKey];
        let valB = b[dKey];
        if (dKey === 'rank') {
            const ranks = { 'A': 1, 'B': 2, 'C': 3 };
            valA = ranks[valA] || 99;
            valB = ranks[valB] || 99;
        }
        if (valA === valB) return 0;
        if (dAsc) return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });

    if (isMobile) {
        renderChartsMobile(filtered);
        renderTablesMobile(detailData);
    } else {
        renderCharts(filtered);
        renderTables(detailData);
        updateSortIcons();
    }
}

function getFilteredResults() {
    return lastResults.filter(r => {
        // お通し除外フィルタ
        if (!includeOtoshi && r.category === 'お通し') return false;
        
        // カテゴリフィルタ
        if (selectedCategory !== 'all') {
            if (r.category !== selectedCategory) return false;
        }
        
        return true;
    });
}

function assignAbcRanks(data, metric = 'profit') {
    data.sort((a, b) => b[metric] - a[metric]);
    let cumulative = 0;
    const total = data.reduce((sum, r) => sum + r[metric], 0);
    data.forEach(r => {
        cumulative += r[metric];
        const pct = (total > 0) ? (cumulative / total) * 100 : 100;
        if (pct <= 70) r.rank = 'A';
        else if (pct <= 90) r.rank = 'B';
        else r.rank = 'C';
    });
}

function updateSortIcons() {
    // 全てのアイコンをリセット
    const icons = document.querySelectorAll('[id^="sort-icon-"]');
    icons.forEach(i => i.innerHTML = '<i class="fas fa-sort" style="color: #ccc; font-size: 0.7rem; margin-left: 4px;"></i>');

    // アクティブなアイコンを更新
    Object.keys(sortStates).forEach(type => {
        const state = sortStates[type];
        const icon = document.getElementById(`sort-icon-${type}-${state.key}`);
        if (icon) {
            icon.innerHTML = `<i class="fas fa-sort-${state.asc ? 'up' : 'down'}" style="color: var(--primary); font-size: 0.7rem; margin-left: 4px;"></i>`;
        }
    });
}

function renderTables(detailData) {
    const probBody = document.getElementById('product-prob-body');
    const detailBody = document.getElementById('product-detail-body');

    if (probBody) {
        const probData = [...detailData];
        const pKey = sortStates.prob.key;
        const pAsc = sortStates.prob.asc;
        probData.sort((a, b) => {
            const valA = a[pKey];
            const valB = b[pKey];
            return pAsc ? valA - valB : valB - valA;
        });

        probBody.innerHTML = probData.slice(0, 50).map(r => `
            <tr>
                <td>${r.name}</td>
                <td style="text-align:right;">${r.qty.toLocaleString()}</td>
                <td style="text-align:right;">${r.prob.toFixed(1)}%</td>
            </tr>
        `).join('');
    }

    if (detailBody) {
        let totalQty = 0;
        let totalSales = 0;
        let totalProfit = 0;
        detailData.forEach(r => {
            totalQty += r.qty;
            totalSales += r.sales;
            totalProfit += r.profit;
        });

        const rowsHtml = detailData.map((r, index) => `
            <tr>
                <td style="text-align: center; color: var(--text-secondary); font-size: 0.75rem; font-weight: 700;">${index + 1}</td>
                <td>${r.name}</td>
                <td style="text-align:right;">${r.qty.toLocaleString()}</td>
                <td style="text-align:right;">¥${Math.round(r.sales).toLocaleString()}</td>
                <td style="text-align:right; color: var(--text-secondary);">¥${Math.round(r.cost).toLocaleString()}</td>
                <td style="text-align:right; font-weight:700;">¥${Math.round(r.profit).toLocaleString()}</td>
                <td style="text-align:right;">${r.margin}%</td>
                <td style="text-align:center;">
                    <span style="padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 800; background: ${r.rank === 'A' ? '#ecfdf5' : (r.rank === 'B' ? '#fffbeb' : '#f1f5f9')}; color: ${r.rank === 'A' ? '#059669' : (r.rank === 'B' ? '#d97706' : '#64748b')};">
                        ${r.rank}
                    </span>
                </td>
            </tr>
        `).join('');

        const footerHtml = `
            <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                <td style="padding: 1rem 0.5rem;"></td>
                <td style="padding: 1rem 0.5rem;">合計(税抜)</td>
                <td style="padding: 1rem 0.5rem; text-align:right;">${totalQty.toLocaleString()}</td>
                <td style="padding: 1rem 0.5rem; text-align:right;">¥${Math.round(totalSales).toLocaleString()}</td>
                <td style="padding: 1rem 0.5rem; text-align:right; color: var(--text-secondary);">-</td>
                <td style="padding: 1rem 0.5rem; text-align:right; color: var(--primary);">¥${Math.round(totalProfit).toLocaleString()}</td>
                <td style="padding: 1rem 0.5rem; text-align:right;">${totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0}%</td>
                <td style="padding: 1rem 0.5rem;"></td>
            </tr>
        `;
        detailBody.innerHTML = rowsHtml + footerHtml;
    }
}

/**
 * スマホ用：チャート描画（ABC分析のみ）
 */
function renderChartsMobile(data) {
    const abcChart = document.getElementById('product-abc-chart');
    if (!abcChart) return;

    const counts = { A: 0, B: 0, C: 0 };
    data.forEach(r => counts[r.rank]++);
    const total = data.length || 1;

    abcChart.innerHTML = `
        <div style="display: flex; align-items: flex-end; justify-content: space-around; gap: 0.5rem; width: 100%; height: 140px; padding-top: 20px;">
            <div style="flex:1; background: var(--primary); height: ${(counts.A/total)*100}%; min-height: 10px; border-radius: 6px; position: relative; max-width: 60px;">
                <div style="position: absolute; top: -22px; left: 0; right: 0; text-align: center; font-size: 0.75rem; font-weight: 900; color: var(--primary);">A(${counts.A})</div>
            </div>
            <div style="flex:1; background: var(--secondary); height: ${(counts.B/total)*100}%; min-height: 10px; border-radius: 6px; position: relative; max-width: 60px;">
                <div style="position: absolute; top: -22px; left: 0; right: 0; text-align: center; font-size: 0.75rem; font-weight: 900; color: var(--secondary);">B(${counts.B})</div>
            </div>
            <div style="flex:1; background: #94a3b8; height: ${(counts.C/total)*100}%; min-height: 10px; border-radius: 6px; position: relative; max-width: 60px;">
                <div style="position: absolute; top: -22px; left: 0; right: 0; text-align: center; font-size: 0.75rem; font-weight: 900; color: #64748b;">C(${counts.C})</div>
            </div>
        </div>
    `;

    renderMatrixTilesMobile(data);
}

function renderMatrixTilesMobile(data) {
    const container = document.getElementById('matrix-tile-container');
    if (!container) return;

    const avgQty = data.reduce((sum, r) => sum + r.qty, 0) / (data.length || 1);
    const avgMargin = data.reduce((sum, r) => sum + r.margin, 0) / (data.length || 1);

    const counts = { star: 0, workhorse: 0, puzzle: 0, dog: 0 };
    data.forEach(r => {
        if (r.qty >= avgQty && r.margin >= avgMargin) counts.star++;
        else if (r.qty >= avgQty && r.margin < avgMargin) counts.workhorse++;
        else if (r.qty < avgQty && r.margin >= avgMargin) counts.puzzle++;
        else counts.dog++;
    });

    const tiles = [
        { id: 'star', name: '稼ぎ頭', count: counts.star, color: '#eff6ff', textColor: '#1d4ed8', borderColor: '#bfdbfe' },
        { id: 'workhorse', name: '人気者', count: counts.workhorse, color: '#f0fdf4', textColor: '#15803d', borderColor: '#bbf7d0' },
        { id: 'puzzle', name: '隠れた逸品', count: counts.puzzle, color: '#fffbeb', textColor: '#b45309', borderColor: '#fef3c7' },
        { id: 'dog', name: '要検討', count: counts.dog, color: '#fef2f2', textColor: '#b91c1c', borderColor: '#fee2e2' }
    ];

    container.innerHTML = tiles.map(t => `
        <div class="matrix-tile" style="background: ${t.color}; color: ${t.textColor}; border-color: ${t.borderColor};">
            <div class="matrix-tile-name">${t.name}</div>
            <div class="matrix-tile-count">${t.count} 品目</div>
        </div>
    `).join('');
}

/**
 * スマホ用：高密度データカードの描画
 */
function renderTablesMobile(detailData) {
    const detailBody = document.getElementById('product-detail-body');
    if (!detailBody) return;

    let totalProfit = 0;
    detailData.forEach(r => totalProfit += r.profit);

    detailBody.innerHTML = detailData.map((r, index) => `
        <div class="mobile-metric-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem;">
                <div style="flex: 1;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 800; margin-bottom: 2px;">#${index + 1}</div>
                    <div style="font-size: 1.05rem; font-weight: 900; color: #1e293b; line-height: 1.2;">${r.name}</div>
                </div>
                <span class="rank-badge rank-${r.rank}">${r.rank}</span>
            </div>
            
            <div class="mobile-grid-metric">
                <div class="metric-item">
                    <span class="metric-label">売上高</span>
                    <span class="metric-value">¥${Math.round(r.sales).toLocaleString()}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">販売数</span>
                    <span class="metric-value">${r.qty.toLocaleString()}個</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">粗利額</span>
                    <span class="metric-value" style="color: #10b981;">¥${Math.round(r.profit).toLocaleString()}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">粗利率</span>
                    <span class="metric-value">${r.margin}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">注文確率</span>
                    <span class="metric-value" style="color: #6366f1;">${r.prob.toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">原価(単品)</span>
                    <span class="metric-value" style="font-size: 0.85rem; color: #64748b;">¥${Math.round(r.costPerUnit).toLocaleString()}</span>
                </div>
            </div>
        </div>
    `).join('');

    // ボトムバーの更新
    const barProfit = document.getElementById('bottom-bar-profit');
    const barCount = document.getElementById('bottom-bar-count');
    if (barProfit) barProfit.textContent = `¥${Math.round(totalProfit).toLocaleString()}`;
    if (barCount) barCount.textContent = `${detailData.length} 品目`;
}

function getMonthsInRange(start, end) {
    const months = [];
    let curr = new Date(start.substring(0, 7) + "-01");
    const last = new Date(end.substring(0, 7) + "-01");
    while (curr <= last) {
        months.push(curr.toISOString().substring(0, 7));
        curr.setMonth(curr.getMonth() + 1);
    }
    return months;
}

function renderCharts(data) {
    // ABCグラフ
    const abcChart = document.getElementById('product-abc-chart');
    if (abcChart) {
        const counts = { A: 0, B: 0, C: 0 };
        data.forEach(r => counts[r.rank]++);
        const total = data.length;
        abcChart.innerHTML = `
            <div style="display: flex; align-items: flex-end; gap: 1rem; width: 80%; height: 180px;">
                <div style="flex:1; background: var(--primary); height: ${(counts.A/total)*100}%; min-height: 10px; border-radius: 4px 4px 0 0; position: relative;">
                    <div style="position: absolute; top: -20px; left: 0; right: 0; text-align: center; font-size: 0.7rem; font-weight: 700;">A(${counts.A})</div>
                </div>
                <div style="flex:1; background: var(--secondary); height: ${(counts.B/total)*100}%; min-height: 10px; border-radius: 4px 4px 0 0; position: relative;">
                    <div style="position: absolute; top: -20px; left: 0; right: 0; text-align: center; font-size: 0.7rem; font-weight: 700;">B(${counts.B})</div>
                </div>
                <div style="flex:1; background: #94a3b8; height: ${(counts.C/total)*100}%; min-height: 10px; border-radius: 4px 4px 0 0; position: relative;">
                    <div style="position: absolute; top: -20px; left: 0; right: 0; text-align: center; font-size: 0.7rem; font-weight: 700;">C(${counts.C})</div>
                </div>
            </div>
        `;
    }

    // マトリックス
    const matrixPlot = document.getElementById('product-matrix-plot');
    if (matrixPlot) {
        matrixPlot.innerHTML = '';
        const avgQty = data.reduce((sum, r) => sum + r.qty, 0) / data.length;
        const avgMargin = data.reduce((sum, r) => sum + r.margin, 0) / data.length;

        data.forEach(r => {
            const dot = document.createElement('div');
            dot.style.position = 'absolute';
            const x = Math.min(95, Math.max(5, (r.margin / (avgMargin * 2)) * 50));
            const y = Math.min(95, Math.max(5, (r.qty / (avgQty * 2)) * 50));
            
            dot.style.left = `${x}%`;
            dot.style.bottom = `${y}%`;
            dot.style.width = '8px';
            dot.style.height = '8px';
            dot.style.borderRadius = '50%';
            dot.style.background = r.rank === 'A' ? 'var(--primary)' : 'var(--text-secondary)';
            dot.style.opacity = '0.6';
            dot.title = `${r.name}: ${r.qty}個 / ${r.margin}%`;
            matrixPlot.appendChild(dot);
        });
    }
}
