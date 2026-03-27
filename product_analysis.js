import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getEffectivePrice } from './cost_engine.js?v=9';
import { showAlert } from './ui_utils.js';

export const productAnalysisPageHtml = `
    <div id="analysis-app" class="animate-fade-in" style="max-width: 1200px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h3 style="margin-bottom: 0.2rem;">商品分析（4つの窓）</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">売上・数量・利益・人気の多角的な分析</p>
            </div>
            <div style="display: flex; gap: 0.8rem;">
                <select id="analysis-store" class="btn" style="background: white; border: 1px solid var(--border);">
                    <option value="">店舗を選択...</option>
                </select>
                <select id="analysis-month" class="btn" style="background: white; border: 1px solid var(--border);">
                    <!-- Filter dynamic -->
                </select>
                <button id="btn-run-analysis" class="btn btn-primary">
                    <i class="fas fa-chart-pie"></i> 分析実行
                </button>
            </div>
        </div>

        <!-- 4 Windows Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
            <!-- Window 1: ABC Analysis -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">1. ABC分析 (粗利ベース)</h4>
                <div id="chart-abc" style="height: 300px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.02); border-radius: 8px;">
                    <span style="color: var(--text-secondary);">分析を実行すると表示されます</span>
                </div>
            </div>

            <!-- Window 2: Menu Engineering ( Popularity vs Profitability ) -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">2. 粗利ミックス (Menu Engineering)</h4>
                <div id="chart-matrix" style="height: 300px; position: relative; border: 1px solid var(--border); background: white; border-radius: 8px;">
                    <!-- 4 quadrants background -->
                    <div style="position: absolute; top:0; left:50%; bottom:0; border-left: 1px dashed #ccc;"></div>
                    <div style="position: absolute; left:0; top:50%; right:0; border-top: 1px dashed #ccc;"></div>
                    <div style="position: absolute; bottom: 5px; left: 5px; font-size: 0.7rem; color: #999;">収益性 →</div>
                    <div style="position: absolute; top: 5px; left: 5px; font-size: 0.7rem; color: #999; writing-mode: vertical-rl;">人気度 →</div>
                    <div id="matrix-plot" style="width: 100%; height: 100%; position: relative;"></div>
                </div>
            </div>

            <!-- Window 3: Order Probability -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">3. 注文確率 (販売数 / 来客数)</h4>
                <div id="chart-probability" style="height: 300px; background: rgba(0,0,0,0.02); border-radius: 8px; overflow-y: auto;">
                    <table class="data-table" style="font-size: 0.8rem; width: 100%;">
                        <thead><tr><th>商品名</th><th>数量</th><th>確率</th></tr></thead>
                        <tbody id="probability-body"></tbody>
                    </table>
                </div>
            </div>

            <!-- Window 4: Consumption Gap (Theoretical vs Actual) -->
            <div class="glass-panel" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">4. 実食量/ロス分析 (理論 vs 実)</h4>
                <div id="chart-loss" style="height: 300px; background: rgba(0,0,0,0.02); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <p style="font-size: 0.8rem; padding: 2rem; text-align: center; color: var(--text-secondary);">
                        棚卸しデータ(t_inventory_logs)と連携して、理論消費と実消費の差異を可視化します（開発予定）
                    </p>
                </div>
            </div>
        </div>

        <!-- Detail Data Table -->
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0;">分析データ詳細</h4>
                <button id="btn-export-analysis" class="btn btn-sm" style="background: var(--surface-darker);"><i class="fas fa-file-excel"></i> CSV出力</button>
            </div>
            <div style="overflow-x: auto;">
                <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border); text-align: left;">
                            <th style="padding: 0.8rem;">商品名</th>
                            <th style="padding: 0.8rem; text-align: center;">販売数</th>
                            <th style="padding: 0.8rem; text-align: center;">売上高</th>
                            <th style="padding: 0.8rem; text-align: center;">原価</th>
                            <th style="padding: 0.8rem; text-align: center;">粗利額</th>
                            <th style="padding: 0.8rem; text-align: center;">粗利率</th>
                            <th style="padding: 0.8rem; text-align: center;">ランク</th>
                        </tr>
                    </thead>
                    <tbody id="analysis-results-body">
                        <tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-secondary);">店舗と月を選択して分析を実行してください</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
`;

let cachedAnalysisData = [];

export async function initProductAnalysisPage() {
    if (!document.getElementById('analysis-app')) return;
    console.log("Product Analysis page initialized");
    await loadInitialFilters();

    const btnRun = document.getElementById('btn-run-analysis');
    if (btnRun) {
        btnRun.onclick = (e) => {
            e.preventDefault();
            runAnalysis();
        };
    }
}

async function loadInitialFilters() {
    try {
        // 1. Stores
        const storeSelect = document.getElementById('analysis-store');
        const storeSnap = await getDocs(collection(db, "m_stores"));
        storeSelect.innerHTML = '<option value="">店舗を選択...</option>';
        storeSnap.forEach(d => {
            const data = d.data();
            const opt = document.createElement('option');
            opt.value = data.store_id || d.id;
            opt.textContent = data.store_name || data.Name || d.id;
            storeSelect.appendChild(opt);
        });

        // 2. target months from t_monthly_sales
        const monthSelect = document.getElementById('analysis-month');
        const salesSnap = await getDocs(collection(db, "t_monthly_sales"));
        const months = new Set();
        salesSnap.forEach(d => months.add(d.data().year_month));
        
        const sortedMonths = Array.from(months).sort().reverse();
        monthSelect.innerHTML = sortedMonths.map(m => `<option value="${m}">${m}</option>`).join('') || '<option value="">データなし</option>';
        
    } catch (e) { console.error(e); }
}

async function runAnalysis() {
    const storeEl = document.getElementById('analysis-store');
    const monthEl = document.getElementById('analysis-month');
    if (!storeEl || !monthEl) return; // Silent return if elements missing

    const storeId = storeEl.value;
    const yearMonth = monthEl.value;
    if (!storeId || !yearMonth) {
        if (document.getElementById('analysis-app')) {
            showAlert('情報入力不足', '店舗と月を選択してください');
        }
        return;
    }

    const btn = document.getElementById('btn-run-analysis');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
    }

    try {
        // 1. Get Monthly Performance (Source of Truth for Totals)
        const perfSnap = await getDocs(query(collection(db, "t_performance"), where("store_id", "==", storeId), where("year_month", "==", yearMonth)));
        let totalCustomers = 0;
        let totalRevenueTPerf = 0;
        perfSnap.forEach(d => {
            const data = d.data();
            totalCustomers += (data.customer_count || 0);
            totalRevenueTPerf += (data.amount || 0); // Amount Inc Tax
        });

        // 2. Get Dinii Monthly Sales (Source for Item Breakdown)
        const q = query(collection(db, "t_monthly_sales"), where("store_id", "==", storeId), where("year_month", "==", yearMonth));
        const salesSnap = await getDocs(q);
        const monthlySales = salesSnap.docs.map(d => d.data());

        if (monthlySales.length === 0) {
            showAlert('通知', '該当月の売上データが見つかりません。Dinii CSVをインポートしてください。');
            return;
        }

        // 3. Get Masters & Cost Engine Cache
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

        // 4. Merge Data & Calculate Costs
        const results = monthlySales.map(ms => {
            // Find item by dinii_id or name
            const menu = cache.menus.find(m => m.dinii_id === ms.dinii_id);
            const itemId = menu ? menu.item_id : null;
            
            const costPerUnit = itemId ? getEffectivePrice(itemId, cache) : 0;
            const qty = ms.quantity_sold || 0;
            // Note: We use Dinii unit price for item-level revenue, but t_performance for total.
            const sales = ms.total_sales || (ms.unit_price * qty) || 0;
            const totalCost = costPerUnit * qty;
            const profit = sales - totalCost;
            const margin = sales > 0 ? (profit / sales) * 100 : 0;

            return {
                name: ms.menu_name,
                qty: qty,
                sales: sales,
                cost: totalCost,
                profit: profit,
                margin: Math.round(margin * 10) / 10,
                itemId: itemId
            };
        });

        // 5. ABC Analysis Ranking (by Profit)
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

        cachedAnalysisData = results;
        renderResults(results, totalCustomers);

    } catch (e) {
        console.error(e);
        showAlert('分析実行エラー', e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-chart-pie"></i> 分析実行';
    }
}

function renderResults(data, totalCustomers) {
    const tbody = document.getElementById('analysis-results-body');
    const probBody = document.getElementById('probability-body');
    if (!tbody || !probBody) return;

    // Window 3: Probability
    probBody.innerHTML = data.slice(0, 50).map(r => {
        const prob = totalCustomers > 0 ? (r.qty / totalCustomers) * 100 : 0;
        return `<tr><td>${r.name}</td><td style="text-align:center;">${r.qty}</td><td style="text-align:center;">${prob.toFixed(1)}%</td></tr>`;
    }).join('');

    // Detail Table
    tbody.innerHTML = data.map(r => `
        <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 0.8rem;">${r.name}</td>
            <td style="padding: 0.8rem; text-align: center;">${r.qty}</td>
            <td style="padding: 0.8rem; text-align: center;">¥${Math.round(r.sales).toLocaleString()}</td>
            <td style="padding: 0.8rem; text-align: center; color: var(--text-secondary);">¥${Math.round(r.cost).toLocaleString()}</td>
            <td style="padding: 0.8rem; text-align: center; font-weight: 700;">¥${Math.round(r.profit).toLocaleString()}</td>
            <td style="padding: 0.8rem; text-align: center;">${r.margin}%</td>
            <td style="padding: 0.8rem; text-align: center;">
                <span class="badge ${r.rank === 'A' ? 'badge-active' : (r.rank === 'B' ? 'badge-pending' : 'badge-inactive')}">${r.rank}</span>
            </td>
        </tr>
    `).join('');

    // Window 2: Menu Engineering Matrix (Simple CSS positioning)
    const matrixPlot = document.getElementById('matrix-plot');
    if (matrixPlot) {
        matrixPlot.innerHTML = '';
        const avgQty = data.reduce((sum, r) => sum + r.qty, 0) / data.length;
        const avgMargin = data.reduce((sum, r) => sum + r.margin, 0) / data.length;

        data.forEach(r => {
            const dot = document.createElement('div');
            dot.className = 'matrix-dot';
            dot.style.position = 'absolute';
            
            // Normalize for plot (roughly)
            const x = Math.min(95, Math.max(5, (r.margin / (avgMargin * 2)) * 50));
            const y = Math.min(95, Math.max(5, (r.qty / (avgQty * 2)) * 50));
            
            dot.style.left = `${x}%`;
            dot.style.bottom = `${y}%`;
            dot.style.width = '8px';
            dot.style.height = '8px';
            dot.style.borderRadius = '50%';
            dot.style.background = r.rank === 'A' ? 'var(--primary)' : 'var(--text-secondary)';
            dot.title = `${r.name}\n数量: ${r.qty}\n粗利率: ${r.margin}%`;
            matrixPlot.appendChild(dot);
        });
    }

    // Window 1: ABC Chart (Visual Placeholder)
    const abcChart = document.getElementById('chart-abc');
    if (abcChart) {
        const aCount = data.filter(r => r.rank === 'A').length;
        const bCount = data.filter(r => r.rank === 'B').length;
        const cCount = data.filter(r => r.rank === 'C').length;
        abcChart.innerHTML = `
            <div style="display: flex; align-items: flex-end; gap: 1rem; width: 80%; height: 150px;">
                <div style="flex:1; background: var(--primary); height: ${(aCount/data.length)*400}px; border-radius: 4px 4px 0 0; text-align: center; color: white; font-size: 0.7rem;">A (${aCount})</div>
                <div style="flex:1; background: var(--secondary); height: ${(bCount/data.length)*400}px; border-radius: 4px 4px 0 0; text-align: center; color: white; font-size: 0.7rem;">B (${bCount})</div>
                <div style="flex:1; background: #94a3b8; height: ${(cCount/data.length)*400}px; border-radius: 4px 4px 0 0; text-align: center; color: white; font-size: 0.7rem;">C (${cCount})</div>
            </div>
        `;
    }
}
