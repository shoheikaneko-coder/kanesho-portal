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
 * 商品分析（4つの窓）をレンダリングする
 */
export async function renderProductAnalysis(containerId, filters) {
    injectComponentStyles();
    const container = document.getElementById(containerId);
    if (!container) return;
    const { storeId, dateFrom, dateTo } = filters;
    
    // UIのスケルトンを表示
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

        // 初期表示
        updateSortIcons();
        refreshAbcDisplay();

    } catch (e) {
        console.error("Product analysis logic error:", e);
        container.innerHTML = `<div class="glass-panel" style="padding: 3rem; text-align: center; color: var(--danger);">エラーが発生しました: ${e.message}</div>`;
    }
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
    const filtered = getFilteredResults();
    assignAbcRanks(filtered, abcMetric);
    renderCharts(filtered);
    renderTables(filtered);
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

function renderTables(displayData = null) {
    let dataToUse = displayData;
    if (!dataToUse) {
        dataToUse = getFilteredResults();
        assignAbcRanks(dataToUse, abcMetric);
    }
    const probData = [...dataToUse];
    const detailData = [...dataToUse];

    // 1. 注文確率テーブルのソート
    const pKey = sortStates.prob.key;
    const pAsc = sortStates.prob.asc;
    probData.sort((a, b) => {
        const valA = a[pKey];
        const valB = b[pKey];
        return pAsc ? valA - valB : valB - valA;
    });

    const probBody = document.getElementById('product-prob-body');
    if (probBody) {
        probBody.innerHTML = probData.slice(0, 50).map(r => `
            <tr>
                <td>${r.name}</td>
                <td style="text-align:right;">${r.qty.toLocaleString()}</td>
                <td style="text-align:right;">${r.prob.toFixed(1)}%</td>
            </tr>
        `).join('');
    }

    // 2. 詳細テーブルのソート
    const dKey = sortStates.detail.key;
    const dAsc = sortStates.detail.asc;
    detailData.sort((a, b) => {
        let valA = a[dKey];
        let valB = b[dKey];
        
        // ランクのソート（A < B < C）
        if (dKey === 'rank') {
            const ranks = { 'A': 1, 'B': 2, 'C': 3 };
            valA = ranks[valA] || 99;
            valB = ranks[valB] || 99;
        }

        if (valA === valB) return 0;
        if (dAsc) return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });

    const detailBody = document.getElementById('product-detail-body');
    if (detailBody) {
        // 合計の計算
        let totalQty = 0;
        let totalSales = 0;
        let totalProfit = 0;
        detailData.forEach(r => {
            totalQty += r.qty;
            totalSales += r.sales;
            totalProfit += r.profit;
        });

        const rowsHtml = detailData.map(r => `
            <tr>
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

        // 合計行の追加
        const footerHtml = `
            <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
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
