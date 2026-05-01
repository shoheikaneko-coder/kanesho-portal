import { db } from './firebase.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getEffectivePrice } from './cost_engine.js?v=9';

/**
 * 商品分析（4つの窓）をレンダリングする
 */
export async function renderProductAnalysis(containerId, filters) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { storeId, dateFrom, dateTo } = filters;
    
    // UIのスケルトンを表示
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
            <div class="glass-panel" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; font-size: 0.95rem;">
                    <i class="fas fa-chart-pie" style="color: var(--primary);"></i> 1. ABC分析 (粗利ベース)
                </h4>
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
                            <tr><th>商品名</th><th style="text-align:right;">数量</th><th style="text-align:right;">確率</th></tr>
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
                        <tr>
                            <th>商品名</th>
                            <th style="text-align:right;">販売数</th>
                            <th style="text-align:right;">売上高</th>
                            <th style="text-align:right;">原価</th>
                            <th style="text-align:right;">粗利額</th>
                            <th style="text-align:right;">粗利率</th>
                            <th style="text-align:center;">ランク</th>
                        </tr>
                    </thead>
                    <tbody id="product-detail-body">
                        <tr><td colspan="7" style="text-align:center; padding: 2rem;">集計中...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    try {
        // 1. データの取得 (t_performance から客数、t_monthly_sales から商品別売上)
        // 期間内の月をリスト化
        const months = getMonthsInRange(dateFrom, dateTo);
        
        let totalCustomers = 0;
        let monthlySales = [];

        // 並列で取得
        const promises = months.map(async (ym) => {
            // 客数
            let qPerf = query(collection(db, "t_performance"), where("year_month", "==", ym));
            if (storeId !== 'all') qPerf = query(qPerf, where("store_id", "==", storeId));
            const snapPerf = await getDocs(qPerf);
            snapPerf.forEach(d => totalCustomers += (d.data().customer_count || 0));

            // 商品別売上
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

        // 2. マスタと原価計算エンジンの準備
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

        // 3. 商品ごとの集計
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
            return {
                ...p,
                cost: totalCost,
                profit: profit,
                margin: p.sales > 0 ? Math.round((profit / p.sales) * 1000) / 10 : 0
            };
        });

        // 4. ABC分析ランキング (粗利額ベース)
        results.sort((a, b) => b.profit - a.profit);
        let cumulativeProfit = 0;
        const totalProfitSum = results.reduce((sum, r) => sum + r.profit, 0);
        results.forEach(r => {
            cumulativeProfit += r.profit;
            const pct = (cumulativeProfit / totalProfitSum) * 100;
            if (pct <= 70) r.rank = 'A';
            else if (pct <= 90) r.rank = 'B';
            else r.rank = 'C';
        });

        // 5. レンダリング
        renderCharts(results, totalCustomers);

    } catch (e) {
        console.error("Product analysis logic error:", e);
        container.innerHTML = `<div class="glass-panel" style="padding: 3rem; text-align: center; color: var(--danger);">エラーが発生しました: ${e.message}</div>`;
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

function renderCharts(data, totalCustomers) {
    // 注文確率
    const probBody = document.getElementById('product-prob-body');
    if (probBody) {
        probBody.innerHTML = data.slice(0, 50).map(r => {
            const prob = totalCustomers > 0 ? (r.qty / totalCustomers) * 100 : 0;
            return `<tr><td>${r.name}</td><td style="text-align:right;">${r.qty.toLocaleString()}</td><td style="text-align:right;">${prob.toFixed(1)}%</td></tr>`;
        }).join('');
    }

    // 詳細テーブル
    const detailBody = document.getElementById('product-detail-body');
    if (detailBody) {
        detailBody.innerHTML = data.map(r => `
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
    }

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
