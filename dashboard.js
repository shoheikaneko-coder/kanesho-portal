import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert } from './ui_utils.js';

export const dashboardPageHtml = `
        <!-- フィルターバー -->
        <div class="glass-panel" style="padding: 1.2rem 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;">
                <div id="dash-date-filter-group" style="display: flex; gap: 1rem; flex: 2;">
                    <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 130px;">
                        <label style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">開始日</label>
                        <input type="date" id="dash-date-from" style="padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 130px;">
                        <label style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">終了日</label>
                        <input type="date" id="dash-date-to" style="padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem;">
                    </div>
                </div>
                <div id="dash-month-filter-group" style="display: none; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 130px;">
                    <label style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">対象年月</label>
                    <select id="dash-month-filter" style="padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; background: white;">
                        <option value="">データ取得中...</option>
                    </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 130px;">
                    <label style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">店舗</label>
                    <select id="dash-store-filter" style="padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem;">
                        <option value="all">全店舗</option>
                    </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 130px;">
                    <label style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">グループ</label>
                    <select id="dash-group-filter" style="padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem;">
                        <option value="all">全社</option>
                    </select>
                </div>
                <button id="dash-apply-btn" class="btn btn-primary" style="padding: 0.5rem 1.2rem; font-size: 0.9rem; white-space: nowrap; height: 38px;">
                    <i class="fas fa-search"></i> 表示
                </button>
            </div>
        </div>

        <!-- タブナビゲーション -->
        <div class="dash-tabs-container">
            <button class="dash-tab-btn active" data-tab="tab-summary"><i class="fas fa-chart-pie"></i> サマリー</button>
            <button class="dash-tab-btn" data-tab="tab-daily"><i class="fas fa-list"></i> 日別詳細レポート</button>
            <button class="dash-tab-btn" data-tab="tab-monthly"><i class="fas fa-table"></i> 店舗別・月別集計</button>
            <button class="dash-tab-btn" data-tab="tab-analytics"><i class="fas fa-chart-bar"></i> 多角分析</button>
            <button class="dash-tab-btn" data-tab="tab-product-analysis"><i class="fas fa-utensils"></i> 商品分析</button>
        </div>

        <!-- コンテンツエリア -->
        <div id="dash-contents-area" style="position: relative;">
            <div id="dash-loading-overlay" style="display: none; position: absolute; inset: 0; background: rgba(255,255,255,0.7); z-index: 10; align-items: center; justify-content: center; backdrop-filter: blur(2px); border-radius: 12px;">
                <div style="text-align: center; color: var(--primary);">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <div style="font-weight: 800; margin-top: 0.5rem;">集計中...</div>
                </div>
            </div>

            <!-- タブ1: サマリー -->
            <div id="tab-summary" class="dash-tab-content active">
                <div class="dashboard-kpi-grid">
                    <!-- Sales Card -->
                    <div class="stylish-kpi">
                        <div class="kpi-header">
                            <div class="kpi-label"><i class="fas fa-yen-sign" style="color:var(--primary);"></i> 売上(税抜)</div>
                            <div class="kpi-circle-wrap">
                                <svg class="kpi-circle-svg" viewBox="0 0 36 36">
                                    <path class="kpi-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path class="kpi-circle-path" id="kpi-sales-circle" stroke-dasharray="0, 100" stroke="var(--primary)" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <div class="kpi-circle-text" id="kpi-sales-rate">--%</div>
                            </div>
                        </div>
                        <div class="kpi-actual" id="kpi-sales-actual">¥---</div>
                        <div class="kpi-target">目標: <span id="kpi-sales-target">未設定</span></div>
                        <div class="kpi-subtext">税込実績: <span id="kpi-sales-taxed">¥---</span></div>
                    </div>

                    <!-- Customers Card -->
                    <div class="stylish-kpi">
                        <div class="kpi-header">
                            <div class="kpi-label"><i class="fas fa-users" style="color:var(--secondary);"></i> 客数</div>
                            <div class="kpi-circle-wrap">
                                <svg class="kpi-circle-svg" viewBox="0 0 36 36">
                                    <path class="kpi-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path class="kpi-circle-path" id="kpi-cust-circle" stroke-dasharray="0, 100" stroke="var(--secondary)" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <div class="kpi-circle-text" id="kpi-cust-rate">--%</div>
                            </div>
                        </div>
                        <div class="kpi-actual" id="kpi-cust-actual">---名</div>
                        <div class="kpi-target">目標: <span id="kpi-cust-target">未設定</span></div>
                    </div>

                    <!-- Op Labor Productivity Card -->
                    <div class="stylish-kpi">
                        <div class="kpi-header">
                            <div class="kpi-label"><i class="fas fa-bolt" style="color:var(--warning);"></i> 営業人時売上</div>
                            <div class="kpi-circle-wrap">
                                <svg class="kpi-circle-svg" viewBox="0 0 36 36">
                                    <path class="kpi-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path class="kpi-circle-path" id="kpi-ophour-circle" stroke-dasharray="0, 100" stroke="var(--warning)" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <div class="kpi-circle-text" id="kpi-ophour-rate">--%</div>
                            </div>
                        </div>
                        <div class="kpi-actual" id="kpi-ophour-actual">¥---</div>
                        <div class="kpi-target">目標: <span id="kpi-ophour-target">未設定</span></div>
                        <div class="kpi-subtext">労働: <span id="kpi-ophour-labor">---h</span></div>
                    </div>

                    <!-- Total Labor Productivity Card -->
                    <div class="stylish-kpi">
                        <div class="kpi-header">
                            <div class="kpi-label"><i class="fas fa-chart-line" style="color:#8B5CF6;"></i> 総人時売上</div>
                            <div class="kpi-circle-wrap">
                                <svg class="kpi-circle-svg" viewBox="0 0 36 36">
                                    <path class="kpi-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path class="kpi-circle-path" id="kpi-totalhour-circle" stroke-dasharray="0, 100" stroke="#8B5CF6" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <div class="kpi-circle-text" id="kpi-totalhour-rate">--%</div>
                            </div>
                        </div>
                        <div class="kpi-actual" id="kpi-totalhour-actual">¥---</div>
                        <div class="kpi-target">目標: <span id="kpi-totalhour-target">未設定</span></div>
                        <div class="kpi-subtext">総労働: <span id="kpi-totalhour-labor">---h</span></div>
                    </div>
                </div>

                <div class="glass-panel" style="padding: 1.5rem;">
                    <h3 style="font-size: 1.1rem; margin: 0 0 1rem; color: var(--text-primary);"><i class="fas fa-chart-area" style="color: var(--primary);"></i> 売上・効率 日別推移</h3>
                    <div style="position: relative; height: 350px; width: 100%;">
                        <canvas id="chart-summary-trend"></canvas>
                    </div>
                </div>
            </div>

            <!-- タブ2: 日別詳細レポート -->
            <div id="tab-daily" class="dash-tab-content" style="display: none;">
                <div class="glass-panel" style="padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <h3 style="font-size: 1.1rem; margin: 0; color: var(--text-primary);"><i class="fas fa-list" style="color: var(--secondary);"></i> 日別詳細レポート</h3>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">
                            <span style="display: inline-block; width: 12px; height: 12px; background: #fffde7; border: 1px solid #fde047; margin-right: 4px;"></span>効率異常アラート
                        </div>
                    </div>
                    <div class="dash-table-wrapper">
                        <table class="dash-data-table">
                            <thead>
                                <tr>
                                    <th>日付</th>
                                    <th>曜日</th>
                                    <th>天気１・２</th>
                                    <th style="text-align: right;">売上(税抜)</th>
                                    <th style="text-align: right;">客数</th>
                                    <th style="text-align: right;">客単価</th>
                                    <th style="text-align: right;">営業人時売上</th>
                                    <th style="text-align: right;">総人時売上</th>
                                    <th style="text-align: right;">現金過不足</th>
                                    <th style="text-align: right;">営業労働h</th>
                                    <th style="text-align: right;">CK按分h</th>
                                    <th>備考</th>
                                    <th style="text-align: right;">小口支払</th>
                                </tr>
                            </thead>
                            <tbody id="daily-table-body">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- タブ3: 店舗別・月別集計 -->
            <div id="tab-monthly" class="dash-tab-content" style="display: none;">
                <div class="glass-panel" style="padding: 1.5rem;">
                    <h3 style="font-size: 1.1rem; margin: 0 0 1rem; color: var(--text-primary);"><i class="fas fa-table" style="color: #8B5CF6;"></i> 店舗別・月別集計</h3>
                    <div class="dash-table-wrapper">
                        <table class="dash-data-table">
                            <thead>
                                <tr>
                                    <th>年月</th>
                                    <th style="text-align: center;">営業日数</th>
                                    <th style="text-align: right;">売上(税抜)</th>
                                    <th style="text-align: right;">来客数</th>
                                    <th style="text-align: right;">客単価</th>
                                    <th style="text-align: right;">現金過不足計</th>
                                    <th style="text-align: right;">売上平均(税抜)</th>
                                    <th style="text-align: right;">来客平均</th>
                                    <th style="text-align: right;">営業人時売上</th>
                                    <th style="text-align: right;">総人時売上</th>
                                    <th style="text-align: right;">営業労働h</th>
                                    <th style="text-align: right;">CK按分h</th>
                                </tr>
                            </thead>
                            <tbody id="monthly-pivot-body">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- タブ4: 多角分析 -->
            <div id="tab-analytics" class="dash-tab-content" style="display: none;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 1.5rem;">
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 style="font-size: 1.1rem; margin: 0 0 1rem; color: var(--text-primary);"><i class="fas fa-calendar-day" style="color: var(--primary);"></i> 曜日別 平均比較</h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="chart-dow"></canvas>
                        </div>
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 style="font-size: 1.1rem; margin: 0 0 1rem; color: var(--text-primary);"><i class="fas fa-cloud-sun-rain" style="color: var(--secondary);"></i> 天候別 平均比較</h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="chart-weather"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- タブ5: 商品分析 (4つの窓) -->
            <div id="tab-product-analysis" class="dash-tab-content" style="display: none;">
                <div class="animate-fade-in">
                    <!-- 4 Windows Grid -->
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                        <!-- Window 1: ABC Analysis -->
                        <div class="glass-panel" style="padding: 1.5rem;">
                            <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">1. ABC分析 (粗利ベース)</h4>
                            <div id="dash-chart-abc" style="height: 300px; display: flex; align-items: flex-end; justify-content: center; background: rgba(0,0,0,0.02); border-radius: 8px; padding-bottom: 1rem;">
                                <span style="color: var(--text-secondary);">「表示」をクリックすると集計されます</span>
                            </div>
                        </div>

                        <!-- Window 2: Menu Engineering -->
                        <div class="glass-panel" style="padding: 1.5rem;">
                            <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">2. 粗利ミックス (Menu Engineering)</h4>
                            <div id="dash-chart-matrix" style="height: 300px; position: relative; border: 1px solid var(--border); background: white; border-radius: 8px;">
                                <div style="position: absolute; top:0; left:50%; bottom:0; border-left: 1px dashed #ccc;"></div>
                                <div style="position: absolute; left:0; top:50%; right:0; border-top: 1px dashed #ccc;"></div>
                                <div style="position: absolute; bottom: 5px; left: 5px; font-size: 0.7rem; color: #999;">収益性 →</div>
                                <div style="position: absolute; top: 5px; left: 5px; font-size: 0.7rem; color: #999; writing-mode: vertical-rl;">人気度 →</div>
                                <div id="dash-matrix-plot" style="width: 100%; height: 100%; position: relative;"></div>
                            </div>
                        </div>

                        <!-- Window 3: Order Probability -->
                        <div class="glass-panel" style="padding: 1.5rem;">
                            <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">3. 注文確率 (販売数 / 来客数)</h4>
                            <div id="dash-chart-probability" style="height: 300px; background: rgba(0,0,0,0.02); border-radius: 8px; overflow-y: auto;">
                                <table class="data-table" style="font-size: 0.8rem; width: 100%;">
                                    <thead><tr><th>商品名</th><th style="text-align:center;">数量</th><th style="text-align:center;">確率</th></tr></thead>
                                    <tbody id="dash-probability-body"></tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Window 4: Consumption Gap -->
                        <div class="glass-panel" style="padding: 1.5rem;">
                            <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">4. 実食量/ロス分析 (理論 vs 実)</h4>
                            <div id="dash-chart-loss" style="height: 300px; background: rgba(0,0,0,0.02); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
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
                            <button id="dash-btn-export-analysis" class="btn btn-sm" style="background: var(--surface-darker);"><i class="fas fa-file-excel"></i> CSV出力</button>
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
                                <tbody id="dash-analysis-results-body">
                                    <tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-secondary);">店舗と月を選択して表示をクリックしてください</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- モーダル -->
        <div id="drilldown-modal" class="modal-overlay">
            <div class="modal-content-box animate-scale-in" style="max-width: 800px;">
                <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <h4 id="drilldown-modal-title" style="margin: 0; color: var(--text-primary); font-size: 1.1rem;"></h4>
                    <button class="btn btn-close" onclick="closeDrilldown()"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding: 1.5rem; overflow-y: auto; flex: 1;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); color: var(--text-secondary);">
                                <th style="padding: 0.8rem;">日付</th>
                                <th style="padding: 0.8rem;">曜日</th>
                                <th style="padding: 0.8rem; text-align: right;">金額</th>
                                <th style="padding: 0.8rem; text-align: right;">客数</th>
                                <th style="padding: 0.8rem; text-align: right;">過不足</th>
                            </tr>
                        </thead>
                        <tbody id="drilldown-modal-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
`;

window.closeDrilldown = () => {
    const modal = document.getElementById('drilldown-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
};

function injectStyles() {
    if (document.getElementById('dash-fix-styles')) return;
    const style = document.createElement('style');
    style.id = 'dash-fix-styles';
    style.textContent = `
        .dashboard-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.2rem; margin-bottom: 2rem; }
        @media (max-width: 1000px) { .dashboard-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .dashboard-kpi-grid { grid-template-columns: 1fr; } }
        .stylish-kpi { 
            padding: 1.5rem; border-radius: 12px; background: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
            border: 1px solid rgba(0,0,0,0.04);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .stylish-kpi:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
        .kpi-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .kpi-label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; }
        .kpi-actual { font-size: 1.8rem; font-weight: 800; color: #0f172a; line-height: 1.1; margin-bottom: 0.4rem; font-family: 'Inter', monospace; }
        .kpi-target { font-size: 0.8rem; font-weight: 600; color: #64748b; }
        .kpi-subtext { font-size: 0.75rem; color: #94a3b8; margin-top: 0.2rem; }
        .kpi-circle-wrap { position: relative; width: 54px; height: 54px; }
        .kpi-circle-svg { transform: rotate(-90deg); width: 100%; height: 100%; }
        .kpi-circle-bg { fill: none; stroke: #f1f5f9; stroke-width: 3.5; }
        .kpi-circle-path { fill: none; stroke: var(--primary); stroke-width: 3.5; stroke-linecap: round; transition: stroke-dasharray 1s ease-out; }
        .kpi-circle-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.75rem; font-weight: 800; color: #334155; }
        .dash-tabs-container { display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem; overflow-x: auto; scrollbar-width: none; }
        .dash-tabs-container::-webkit-scrollbar { display: none; }
        .dash-tab-btn { background: none; border: none; padding: 0.8rem 1.2rem; font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: 0.2s; white-space: nowrap; }
        .dash-tab-btn:hover { color: var(--primary); }
        .dash-tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
        .dash-table-wrapper { overflow-x: auto; max-height: 600px; }
        .dash-data-table { width: 100%; min-width: 1200px; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .dash-data-table th { padding: 0.8rem; border-bottom: 2px solid var(--border); color: var(--text-secondary); position: sticky; top: 0; background: #fff; z-index: 1; font-weight: 700; }
        .dash-data-table td { padding: 0.7rem 0.8rem; border-bottom: 1px solid var(--border); }
        .row-weekend { background-color: #fafafa; }
        .row-alert { background-color: #fffde7; }
        .val-red { color: var(--danger); font-weight: 700; }
    `;
    document.head.appendChild(style);
}

const TAX_RATE = 1.1;

export async function initDashboardPage() {
    injectStyles();
    const now = new Date();
    const fromEl = document.getElementById('dash-date-from');
    const toEl = document.getElementById('dash-date-to');
    if (fromEl) fromEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    if (toEl) toEl.value = now.toISOString().substring(0, 10);

    const tabBtns = document.querySelectorAll('.dash-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.dash-tab-content').forEach(c => c.style.display = 'none');
            
            const targetTab = e.currentTarget.getAttribute('data-tab');
            e.currentTarget.classList.add('active');
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.style.display = 'block';

            const dateGroup = document.getElementById('dash-date-filter-group');
            const monthGroup = document.getElementById('dash-month-filter-group');
            if (targetTab === 'tab-product-analysis') {
                if (dateGroup) dateGroup.style.display = 'none';
                if (monthGroup) monthGroup.style.display = 'flex';
            } else {
                if (dateGroup) dateGroup.style.display = 'flex';
                if (monthGroup) monthGroup.style.display = 'none';
            }
        });
    });

    await loadFilterOptions();
    await initProductAnalysisTab();
    await refreshDashboard();
    
    const applyBtn = document.getElementById('dash-apply-btn');
    if (applyBtn) {
        applyBtn.onclick = () => {
            const activeTabBtn = document.querySelector('.dash-tab-btn.active');
            const activeTab = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : '';
            if (activeTab === 'tab-product-analysis') {
                runProductAnalysis();
            } else {
                refreshDashboard();
            }
        };
    }
}

async function loadFilterOptions() {
    const sSel = document.getElementById('dash-store-filter');
    const gSel = document.getElementById('dash-group-filter');
    if (!sSel || !gSel) return;
    try {
        const snap = await getDocs(collection(db, "m_stores"));
        const groups = new Set();
        sSel.innerHTML = '<option value="all">全店舗</option>';
        snap.forEach(doc => {
            const d = doc.data();
            if (d.store_type !== 'CK') {
                const opt = document.createElement('option');
                opt.value = d.store_id || d.id;
                opt.textContent = d.store_name;
                sSel.appendChild(opt);
            }
            if (d.group_name) groups.add(d.group_name);
        });
        gSel.innerHTML = '<option value="all">全社</option>';
        Array.from(groups).sort().forEach(g => {
            const opt = document.createElement('option');
            opt.value = g; opt.textContent = g;
            gSel.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function refreshDashboard() {
    const fromEl = document.getElementById('dash-date-from');
    const toEl = document.getElementById('dash-date-to');
    const sEl = document.getElementById('dash-store-filter');
    const gEl = document.getElementById('dash-group-filter');
    if (!fromEl || !toEl || !sEl || !gEl) return;

    const dateFrom = fromEl.value;
    const dateTo = toEl.value;
    const storeFilter = sEl.value;
    const groupFilter = gEl.value;

    const dtbody = document.getElementById('daily-table-body');
    const mtbody = document.getElementById('monthly-pivot-body');
    const loadingOverlay = document.getElementById('dash-loading-overlay');
    
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (dtbody) dtbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:2rem;">集計中...</td></tr>';
    if (mtbody) mtbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:2rem;">集計中...</td></tr>';

    try {
        const storeMap = {};
        const sSnap = await getDocs(collection(db, "m_stores"));
        sSnap.forEach(doc => {
            const data = doc.data();
            const fullData = { ...data, id: doc.id };
            storeMap[doc.id] = fullData;
            const sid = data.store_id || data.StoreID || data['店舗ID'];
            if (sid) storeMap[String(sid)] = fullData;
        });

        const pSnap = await getDocs(collection(db, "t_performance"));
        let daily = [];
        let groupDaily = [];
        pSnap.forEach(doc => {
            const d = doc.data();
            const normDate = (d.date || "").replace(/\//g, '-').replace(/\./g, '-');
            if (normDate >= dateFrom && normDate <= dateTo) {
                const si = storeMap[d.store_id];
                const ym = d.year_month || normDate.substring(0, 7);
                groupDaily.push({ ...d, date: normDate, ym: ym });
                if (storeFilter !== 'all' && d.store_id !== storeFilter) return;
                if (groupFilter !== 'all' && (!si || si.group_name !== groupFilter)) return;
                daily.push({ ...d, date: normDate, ym: ym });
            }
        });

        const groupSalesByYM = {};
        groupDaily.forEach(r => {
            const si = storeMap[r.store_id];
            const gn = si ? (si.group_name || si.GroupName || si['グループ名']) : "";
            if (gn) {
                const gkey = `${gn}__${r.ym}`;
                groupSalesByYM[gkey] = (groupSalesByYM[gkey] || 0) + (r.amount || r.sales || 0) / TAX_RATE;
            }
        });

        const grouped = {};
        daily.forEach(r => {
            const sid = r.store_id || "";
            const ym = r.ym || "";
            if (!sid || !ym) return;
            const key = `${ym}__${sid}`;
            if (!grouped[key]) {
                const si = storeMap[sid] || {};
                grouped[key] = {
                    ym: ym, store_id: sid, 
                    store_name: r.store_name || si.store_name,
                    group_name: si.group_name,
                    sales: 0, customers: 0, cash_diff: 0, days: 0, 
                    op_hours: 0, ck_alloc: 0
                };
            }
            const g = grouped[key];
            g.sales += (r.amount || 0);
            g.customers += (r.customer_count || 0);
            g.cash_diff += (r.cash_diff || 0);
            g.days += 1;
        });

        const lSnap = await getDocs(collection(db, "t_attendance"));
        const laborRaw = [];
        lSnap.forEach(doc => {
            const d = doc.data();
            const ts = d.timestamp || d.date || "";
            const normDate = (d.date || ts.substring(0, 10)).replace(/\//g, '-');
            if (normDate >= dateFrom && normDate <= dateTo) laborRaw.push(d);
        });

        const perStaff = {};
        laborRaw.forEach(r => {
            const staffId = String(r.staff_id || r.staff_name || "").trim();
            if (!staffId) return;
            if (!perStaff[staffId]) perStaff[staffId] = [];
            perStaff[staffId].push(r);
        });

        const uSnap = await getDocs(collection(db, "m_users"));
        const userMap = {};
        uSnap.forEach(d => { userMap[String(d.id)] = d.data(); if(d.data().EmployeeCode) userMap[String(d.data().EmployeeCode)] = d.data(); });

        const laborMap = {};
        const ckHoursPool = {};
        const dailyLaborMap = {};
        const dailyCkHoursPool = {};

        Object.values(perStaff).forEach(recs => {
            recs.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            let inT = null, totalBreakMs = 0, breakStartT = null, currentSid = "";
            recs.forEach(r => {
                const type = (r.type || "").toLowerCase();
                if (type.includes('in')) { inT = new Date(r.timestamp); totalBreakMs = 0; currentSid = r.store_id; }
                else if (type.includes('break_start')) { breakStartT = new Date(r.timestamp); }
                else if (type.includes('break_end') && breakStartT) { totalBreakMs += (new Date(r.timestamp) - breakStartT); breakStartT = null; }
                else if (type.includes('out') && inT) {
                    const h = (new Date(r.timestamp) - inT - totalBreakMs) / 3600000;
                    const d = r.date || new Date(inT.getTime() + 9*3600000).toISOString().substring(0,10);
                    const ym = d.substring(0,7);
                    const staff = userMap[String(r.staff_id)];
                    const homeStore = staff ? storeMap[staff.StoreID] : null;
                    if (homeStore && homeStore.store_type === 'CK') {
                        const gkey = `${homeStore.group_name}__${ym}`;
                        ckHoursPool[gkey] = (ckHoursPool[gkey] || 0) + h;
                        dailyCkHoursPool[`${homeStore.group_name}__${d}`] = (dailyCkHoursPool[`${homeStore.group_name}__${d}`] || 0) + h;
                    } else {
                        laborMap[`${ym}__${currentSid}`] = (laborMap[`${ym}__${currentSid}`] || 0) + h;
                        dailyLaborMap[`${d}__${currentSid}`] = (dailyLaborMap[`${d}__${currentSid}`] || 0) + h;
                    }
                    inT = null;
                }
            });
        });

        // 集計
        daily.forEach(r => {
            const sid = r.store_id;
            const si = storeMap[sid] || {};
            r.op_hours = dailyLaborMap[`${r.date}__${sid}`] || 0;
            const gSales = Object.values(storeMap).filter(s => s.group_name === si.group_name).reduce((sum, s) => sum + (daily.find(d => d.date === r.date && d.store_id === s.store_id)?.amount || 0), 0);
            if (gSales > 0) r.ck_alloc = (dailyCkHoursPool[`${si.group_name}__${r.date}`] || 0) * (r.amount / gSales);
        });

        Object.values(grouped).forEach(g => {
            g.op_hours = laborMap[`${g.ym}__${g.store_id}`] || 0;
            const gSales = groupSalesByYM[`${g.group_name}__${g.ym}`] || 0;
            if (gSales > 0) g.ck_alloc = (ckHoursPool[`${g.group_name}__${g.ym}`] || 0) * ((g.sales/TAX_RATE) / gSales);
        });

        const goals = await calculatePeriodGoals(storeFilter, groupFilter, storeMap, dateFrom, dateTo);
        renderAllTabs(Object.values(grouped), goals, daily, storeMap, dateFrom, dateTo);
    } catch (e) { console.error(e); showAlert("エラー", e.message); }
    finally { if (loadingOverlay) loadingOverlay.style.display = 'none'; }
}

async function calculatePeriodGoals(sid, gFilter, storeMap, from, to) {
    return { sales: 0, customers: 0, sph_op: 0, sph_total: 0 }; // Placeholder
}

function renderAllTabs(records, goals, daily, storeMap, dateFrom, dateTo) {
    renderKPIs(records, goals);
    renderSummaryChart(daily, goals, dateFrom, dateTo);
    renderDailyTab(daily);
    renderMonthlyPivotTab(records, daily);
    renderAnalyticsTab(daily);
}

function renderKPIs(recs, goals) {
    let s=0, c=0, opH=0, ckH=0;
    recs.forEach(r => { s+=r.sales; c+=r.customers; opH+=r.op_hours; ckH+=r.ck_alloc; });
    const exTax = s / TAX_RATE;
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    set('kpi-sales-actual', '¥' + Math.round(exTax).toLocaleString());
    set('kpi-sales-taxed', '¥' + Math.round(s).toLocaleString());
    set('kpi-cust-actual', Math.round(c).toLocaleString() + '名');
    set('kpi-ophour-actual', '¥' + (opH > 0 ? Math.round(exTax/opH) : 0).toLocaleString());
    set('kpi-totalhour-actual', '¥' + ((opH+ckH) > 0 ? Math.round(exTax/(opH+ckH)) : 0).toLocaleString());
}

function renderSummaryChart(daily, goals, from, to) {
    const canvas = document.getElementById('chart-summary-trend');
    if (!canvas) return;
    const sorted = [...daily].sort((a,b) => a.date.localeCompare(b.date));
    const labels = sorted.map(r => r.date.substring(5));
    const data = sorted.map(r => Math.round(r.amount/TAX_RATE));
    if (window.__chartSummary) window.__chartSummary.destroy();
    window.__chartSummary = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ label: '売上', data, backgroundColor: 'rgba(59, 130, 246, 0.6)' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderDailyTab(daily) {
    const tbody = document.getElementById('daily-table-body');
    if (!tbody) return;
    tbody.innerHTML = daily.sort((a,b) => b.date.localeCompare(a.date)).map(r => `
        <tr>
            <td>${r.date}</td><td>${r.day_of_week || '-'}</td><td>${r.weather_1 || '-'}</td>
            <td style="text-align:right;">¥${Math.round(r.amount/TAX_RATE).toLocaleString()}</td>
            <td style="text-align:right;">${(r.customer_count||0).toLocaleString()}</td>
            <td style="text-align:right;">¥${r.customer_count > 0 ? Math.round((r.amount/TAX_RATE)/r.customer_count).toLocaleString() : 0}</td>
            <td style="text-align:right;">¥${r.op_hours > 0 ? Math.round((r.amount/TAX_RATE)/r.op_hours).toLocaleString() : 0}</td>
            <td style="text-align:right;">¥${(r.op_hours+r.ck_alloc) > 0 ? Math.round((r.amount/TAX_RATE)/(r.op_hours+r.ck_alloc)).toLocaleString() : 0}</td>
            <td style="text-align:right;">${(r.cash_diff||0).toLocaleString()}</td>
            <td style="text-align:right;">${(r.op_hours||0).toFixed(1)}</td>
            <td style="text-align:right;">${(r.ck_alloc||0).toFixed(1)}</td>
            <td>${r.memo || ''}</td><td>¥${(r.petty_cash||0).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderMonthlyPivotTab(records, daily) {
    const tbody = document.getElementById('monthly-pivot-body');
    if (!tbody) return;
    tbody.innerHTML = records.map(r => `
        <tr>
            <td>${r.ym}</td><td style="text-align:center;">${r.days}</td>
            <td style="text-align:right;">¥${Math.round(r.sales/TAX_RATE).toLocaleString()}</td>
            <td style="text-align:right;">${r.customers.toLocaleString()}</td>
            <td style="text-align:right;">¥${r.customers > 0 ? Math.round((r.sales/TAX_RATE)/r.customers).toLocaleString() : 0}</td>
            <td style="text-align:right;">${r.cash_diff.toLocaleString()}</td>
            <td style="text-align:right;">¥${r.days > 0 ? Math.round((r.sales/TAX_RATE)/r.days).toLocaleString() : 0}</td>
            <td style="text-align:right;">${r.days > 0 ? (r.customers/r.days).toFixed(1) : 0}</td>
            <td style="text-align:right;">¥${r.op_hours > 0 ? Math.round((r.sales/TAX_RATE)/r.op_hours).toLocaleString() : 0}</td>
            <td style="text-align:right;">¥${(r.op_hours+r.ck_alloc) > 0 ? Math.round((r.sales/TAX_RATE)/(r.op_hours+r.ck_alloc)).toLocaleString() : 0}</td>
            <td style="text-align:right;">${r.op_hours.toFixed(1)}</td>
            <td style="text-align:right;">${(r.ck_alloc||0).toFixed(1)}</td>
        </tr>
    `).join('');
}

function renderAnalyticsTab(daily) {
    // Placeholder
}

// --- 商品分析 (Product Analysis) ---

async function initProductAnalysisTab() {
    const sel = document.getElementById('dash-month-filter');
    if (!sel) return;
    try {
        const snap = await getDocs(collection(db, "t_monthly_sales"));
        const months = new Set();
        snap.forEach(d => months.add(d.data().year_month));
        sel.innerHTML = Array.from(months).sort().reverse().map(m => `<option value="${m}">${m}</option>`).join('');
        
        const btn = document.getElementById('dash-btn-export-analysis');
        if (btn) btn.onclick = () => {
            if (!window.__cachedResults) return showAlert("エラー", "先に分析を実行してください");
            exportProductAnalysisCSV(window.__cachedResults);
        };
    } catch (e) { console.error(e); }
}

async function runProductAnalysis() {
    const sid = document.getElementById('dash-store-filter').value;
    const ym = document.getElementById('dash-month-filter').value;
    if (sid === 'all' || !ym) return showAlert("情報不足", "店舗と年月を選択してください");

    const overlay = document.getElementById('dash-loading-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        const perfSnap = await getDocs(query(collection(db, "t_performance"), where("store_id", "==", sid), where("year_month", "==", ym)));
        let totalCust = 0; perfSnap.forEach(d => totalCust += (d.data().customer_count || 0));

        const salesSnap = await getDocs(query(collection(db, "t_monthly_sales"), where("store_id", "==", sid), where("year_month", "==", ym)));
        const monthlySales = salesSnap.docs.map(d => d.data()).filter(ms => ms.is_total);

        const [itemSnap, ingSnap, menuSnap, costModule] = await Promise.all([
            getDocs(collection(db, "m_items")),
            getDocs(collection(db, "m_ingredients")),
            getDocs(collection(db, "m_menus")),
            import('./cost_engine.js?v=10')
        ]);
        const { getEffectivePrice } = costModule;
        const cache = { items: itemSnap.docs.map(d=>d.data()), ingredients: ingSnap.docs.map(d=>d.data()), menus: menuSnap.docs.map(d=>d.data()) };

        const results = monthlySales.map(ms => {
            const menu = cache.menus.find(m => m.dinii_id === ms.dinii_id);
            const cost = menu ? getEffectivePrice(menu.item_id, cache) : 0;
            const sales = ms.total_sales || (ms.unit_price * ms.quantity_sold);
            const profit = sales - (cost * ms.quantity_sold);
            return {
                name: ms.menu_name, qty: ms.quantity_sold, sales, cost: cost * ms.quantity_sold,
                profit, margin: sales > 0 ? Math.round((profit/sales)*100) : 0
            };
        });

        results.sort((a,b) => b.profit - a.profit);
        let sum = results.reduce((acc, r) => acc + r.profit, 0), cum = 0;
        results.forEach(r => {
            cum += r.profit;
            const pct = (cum / sum) * 100;
            r.rank = pct <= 70 ? 'A' : (pct <= 90 ? 'B' : 'C');
        });

        window.__cachedResults = results;
        renderProductResults(results, totalCust);
    } catch (e) { console.error(e); showAlert("エラー", e.message); }
    finally { if (overlay) overlay.style.display = 'none'; }
}

function renderProductResults(data, totalCust) {
    const tbody = document.getElementById('dash-analysis-results-body');
    if (tbody) tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.name}</td><td style="text-align:center;">${r.qty}</td>
            <td style="text-align:center;">¥${Math.round(r.sales).toLocaleString()}</td>
            <td style="text-align:center;">¥${Math.round(r.cost).toLocaleString()}</td>
            <td style="text-align:center; font-weight:700;">¥${Math.round(r.profit).toLocaleString()}</td>
            <td style="text-align:center;">${r.margin}%</td>
            <td style="text-align:center;">${r.rank}</td>
        </tr>
    `).join('');
    
    const probBody = document.getElementById('dash-probability-body');
    if (probBody) probBody.innerHTML = data.slice(0, 30).map(r => `
        <tr><td>${r.name}</td><td style="text-align:center;">${r.qty}</td><td style="text-align:center;">${totalCust > 0 ? (r.qty/totalCust*100).toFixed(1) : 0}%</td></tr>
    `).join('');
}

function exportProductAnalysisCSV(data) {
    let csv = "\uFEFF商品名,販売数,売上高,原価,粗利額,粗利率,ランク\n";
    data.forEach(r => { csv += `"${r.name}",${r.qty},${r.sales},${r.cost},${r.profit},${r.margin},${r.rank}\n`; });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `product_analysis.csv`;
    link.click();
}

export async function loadPersonalDashboard() {
    const section = document.getElementById('dash-personal-section');
    const label = document.getElementById('personal-info-label');
    const value = document.getElementById('personal-info-value');
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || !section) return;

    section.style.display = 'block';
    const isAdmin = user.Role === 'Admin' || user.Role === '管理者';

    try {
        if (isAdmin) {
            label.textContent = "本日の店舗状況";
            const today = new Date().toISOString().split('T')[0];
            const sid = user.StoreID || user.StoreId;
            let q = query(collection(db, "t_shifts"), where("date", "==", today), where("status", "==", "confirmed"));
            const snap = await getDocs(q);
            let count = 0;
            snap.forEach(d => { if (!sid || d.data().storeId == sid) count++; });
            value.textContent = `本日(${today}) は ${count} 名が出勤予定です`;
        } else {
            label.textContent = "次回の出勤予定";
            const today = new Date().toISOString().split('T')[0];
            const nextMonth = new Date();
            nextMonth.setDate(nextMonth.getDate() + 35);
            const eDate = nextMonth.toISOString().split('T')[0];
            const q = query(collection(db, "t_shifts"), where("date", ">=", today), where("date", "<=", eDate));
            const snap = await getDocs(q);
            let matchedShifts = [];
            snap.forEach(d => { if (d.data().userId === user.id && d.data().status === 'confirmed') matchedShifts.push(d.data()); });
            if (matchedShifts.length > 0) {
                matchedShifts.sort((a,b) => a.date.localeCompare(b.date));
                const s = matchedShifts[0];
                const d = new Date(s.date);
                const dow = ['日','月','火','水','木','金','土'][d.getDay()];
                value.textContent = `${s.date}(${dow})  ${s.start} 〜 ${s.end}`;
            } else {
                value.textContent = "確定済みの出勤予定はありません";
            }
        }
    } catch (e) {
        console.error("Personal dashboard load error:", e);
        if (value) value.textContent = "情報の取得に失敗しました";
    }
}
