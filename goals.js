import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * --- HTML Templates ---
 */

// 社長用：年間ターゲット設定画面
export const goalsAdminPageHtml = `
    <div class="animate-fade-in">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: flex-end;">
                <div style="flex: 1; min-width: 200px;">
                    <label class="field-label">対象年度 (7月開始)</label>
                    <select id="goal-admin-fy" class="form-input"></select>
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <label class="field-label">設定対象店舗</label>
                    <select id="goal-admin-store" class="form-input"></select>
                </div>
                <div style="flex: 1; min-width: 150px; text-align: right;">
                    <button id="goal-admin-load-btn" class="btn btn-secondary" style="height: 42px;">
                        <i class="fas fa-sync-alt"></i> 読み込み
                    </button>
                </div>
            </div>
        </div>

        <div id="goal-admin-form-container" class="glass-panel" style="padding: 2.5rem; display: none; max-width: 1000px; margin: 0 auto;">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 3rem;">
                <!-- 基本目標 -->
                <div class="form-section">
                    <h4 style="margin-bottom: 1.5rem; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.6rem;">
                        <i class="fas fa-chart-line" style="color: var(--primary);"></i> 売上・客数目標
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <div style="max-width: 380px;">
                            <label class="field-label">年間売上目標 (税抜)</label>
                            <div class="input-group">
                                <span class="input-group-text">¥</span>
                                <input type="text" id="goal-total-sales" class="form-input" style="font-weight: 800; font-size: 1.3rem; color: var(--primary);" placeholder="150,000,000">
                            </div>
                        </div>
                        <div style="max-width: 380px;">
                            <label class="field-label">年間客数目標</label>
                            <div class="input-group">
                                <input type="text" id="goal-total-cust" class="form-input" style="font-weight: 800; font-size: 1.3rem;" placeholder="45,000">
                                <span class="input-group-text">名</span>
                            </div>
                        </div>
                        <div style="max-width: 380px; padding: 0.5rem 0.8rem; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border: 1px dashed rgba(59, 130, 246, 0.3);">
                            <label class="field-label" style="font-size: 0.8rem; color: var(--text-secondary);">想定客単価 (自動計算)</label>
                            <div id="goal-avg-spend" style="font-size: 1.4rem; font-weight: 900; color: var(--secondary);">¥ 0</div>
                        </div>
                    </div>
                </div>

                <!-- 経営指標 KPI -->
                <div class="form-section">
                    <h4 style="margin-bottom: 1.5rem; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.6rem;">
                        <i class="fas fa-user-clock" style="color: var(--warning);"></i> 経営指標 (人時売上・比率)
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <div style="max-width: 300px;">
                            <label class="field-label">目標人件費率 (%)</label>
                            <div class="input-group">
                                <input type="number" id="goal-labor-rate" class="form-input" style="font-weight: 800; text-align: right;" placeholder="33.5" step="0.1">
                                <span class="input-group-text">%</span>
                            </div>
                        </div>
                        <div style="max-width: 380px;">
                            <label class="field-label">営業人時売上目標</label>
                            <div class="input-group">
                                <span class="input-group-text" style="color: var(--warning);">¥</span>
                                <input type="text" id="goal-sph-op" class="form-input" style="font-weight: 800; border-left: none;" placeholder="4,500">
                            </div>
                            <p style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.4rem; font-weight: 600;">※売上税抜 ÷ 営業労働h</p>
                        </div>
                        <div style="max-width: 380px;">
                            <label class="field-label">総人時売上目標</label>
                            <div class="input-group">
                                <span class="input-group-text" style="color: #8B5CF6;">¥</span>
                                <input type="text" id="goal-sph-total" class="form-input" style="font-weight: 800; border-left: none;" placeholder="3,800">
                            </div>
                            <p style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.4rem; font-weight: 600;">※売上税抜 ÷ (営業+CK按分h)</p>
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 4rem; text-align: center; border-top: 1px solid var(--border); padding-top: 2.5rem;">
                <button id="goal-admin-save-btn" class="btn btn-primary" style="padding: 1.2rem 5rem; font-size: 1.2rem; font-weight: 900; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); border-radius: 30px;">
                    <i class="fas fa-save"></i> 2026年度 年間マスタを保存
                </button>
            </div>
        </div>
    </div>

    <style>
        .input-group {
            display: flex;
            align-items: stretch;
            width: 100%;
            background: #fff;
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid var(--border);
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-group:focus-within {
            border-color: var(--primary);
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
        .input-group .form-input {
            flex: 1;
            border: none !important;
            border-radius: 0 !important;
            padding: 0.8rem 1rem !important;
            text-align: right;
            box-shadow: none !important;
        }
        .input-group-text {
            background: #f8fafc;
            color: var(--text-secondary);
            padding: 0 1.2rem;
            display: flex;
            align-items: center;
            font-size: 1rem;
            font-weight: 800;
            border-left: 1px solid var(--border);
            border-right: 1px solid var(--border);
        }
        .input-group-text:first-child { border-left: none; }
        .input-group-text:last-child { border-right: none; }
    </style>
`;

// 店長用：月次計画シミュレーター (Phase 2で詳細実装)
export const goalsStorePageHtml = `
    <div class="animate-fade-in">
        <!-- 選択バー -->
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: flex-end;">
                <div style="flex: 1; min-width: 150px;">
                    <label class="field-label">対象年度</label>
                    <select id="goal-store-fy" class="form-input"></select>
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label class="field-label">自店舗</label>
                    <select id="goal-store-sid" class="form-input"></select>
                </div>
                <div style="flex: 1; min-width: 150px; text-align: right;">
                    <button id="goal-store-load-btn" class="btn btn-secondary" style="height: 42px;">
                        <i class="fas fa-magic"></i> 計画を作成・読込
                    </button>
                </div>
            </div>
        </div>

        <div id="goal-store-container" class="animate-fade-in" style="display: none;">
            <!-- 年間予算サマリー -->
            <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem; background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; align-items: center;">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700;">社長設定：年間売上目標</div>
                        <div id="summary-annual-sales" style="font-size: 1.5rem; font-weight: 900; color: var(--primary);">¥ 0</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700;">現在の計画合計 (100%〜120%)</div>
                        <div id="summary-total-plan" style="font-size: 1.5rem; font-weight: 900; color: var(--secondary);">¥ 0</div>
                    </div>
                    <div style="text-align: right;">
                        <div id="summary-pct-label" style="font-size: 0.9rem; font-weight: 800; margin-bottom: 0.4rem;">現在の達成率: 0%</div>
                        <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; overflow: hidden;">
                            <div id="summary-pct-bar" style="width: 0%; height: 100%; background: var(--secondary); transition: width 0.3s;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- メインテーブル -->
            <div class="glass-panel" style="padding: 2rem; margin-bottom: 2rem;">
                <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 1.5rem;">
                    <button id="btn-open-weight-modal" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 1rem; border-radius: 20px;">
                        <i class="fas fa-sliders-h"></i> 売上傾斜（指数）設定
                    </button>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; min-width: 800px; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.85rem;">
                                <th style="padding: 0.8rem;">月</th>
                                <th style="padding: 0.8rem; text-align: center;">営業日数</th>
                                <th style="padding: 0.8rem; width: 250px;">按分比率</th>
                                <th style="padding: 0.8rem; text-align: right;">売上目標 (税抜)</th>
                                <th style="padding: 0.8rem; text-align: right;">指数の合計</th>
                            </tr>
                        </thead>
                        <tbody id="goal-simulator-body"></tbody>
                    </table>
                </div>

                <div id="goal-validation-msg" style="margin-top: 2rem; padding: 1rem; border-radius: 10px; text-align: center; font-weight: 700; font-size: 0.95rem;">
                    按分比率を調整してください（100%〜120%）
                </div>

                <div style="margin-top: 2rem; text-align: center;">
                    <button id="goal-store-save-btn" class="btn btn-primary" style="padding: 1rem 3rem; font-size: 1.1rem; font-weight: 800;" disabled>
                        <i class="fas fa-check-circle"></i> 計画を確定して保存
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- 傾斜設定モーダル -->
    <div id="weight-config-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
        <div class="glass-panel animate-scale-in" style="width:100%; max-width:400px; padding:2rem;">
            <h4 style="margin:0 0 1.5rem; font-size:1.1rem; color:var(--text-primary); border-bottom:1px solid var(--border); padding-bottom:1rem;">売上傾斜（指数）設定</h4>
            
            <div style="display: grid; grid-template-columns: 1fr 100px; gap: 1rem; align-items: center;">
                <label style="font-size:0.9rem; font-weight:600;">平日 (月〜木)</label>
                <input type="number" id="weight-mon-thu" class="form-input" style="text-align:center;" step="0.1" value="1.0">
                
                <label style="font-size:0.9rem; font-weight:600;">金曜日</label>
                <input type="number" id="weight-fri" class="form-input" style="text-align:center;" step="0.1" value="1.2">
                
                <label style="font-size:0.9rem; font-weight:600;">土曜日</label>
                <input type="number" id="weight-sat" class="form-input" style="text-align:center;" step="0.1" value="1.5">
                
                <label style="font-size:0.9rem; font-weight:600;">日曜日</label>
                <input type="number" id="weight-sun" class="form-input" style="text-align:center;" step="0.1" value="1.4">
                
                <hr style="grid-column: span 2; border: none; border-top: 1px solid var(--border); margin: 0.5rem 0;">
                
                <label style="font-size:0.9rem; font-weight:600; color: var(--danger);">祝日</label>
                <input type="number" id="weight-holiday" class="form-input" style="text-align:center;" step="0.1" value="1.5">
                
                <label style="font-size:0.9rem; font-weight:600; color: #3b82f6;">祝前日</label>
                <input type="number" id="weight-day-before" class="form-input" style="text-align:center;" step="0.1" value="1.6">
            </div>

            <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:1.5rem;">※重複時は数値の高い方が優先されます。<br>※一度設定すると全ての月に適用されます。</p>

            <div style="margin-top:2rem; display:flex; gap:1rem;">
                <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('weight-config-modal').style.display='none'">キャンセル</button>
                <button id="btn-save-weight" class="btn btn-primary" style="flex:1;">全体に適用</button>
            </div>
        </div>
    </div>

    <style id="goal-simulator-styles">
        .sim-row:hover { background: #f8fafc; }
        .sim-input-pct { width: 70px; padding: 0.3rem 0.5rem; text-align: right; font-weight: 700; border-radius: 6px; border: 1px solid var(--border); }
        .sim-pct-bar { height: 4px; background: var(--secondary); border-radius: 2px; margin-top: 4px; transition: width 0.3s; }
        .text-intent { color: #059669; }
        .text-error { color: #dc2626; }
    </style>
`;

/**
 * --- Logic Phase 1: Goals Admin ---
 */

let currentAdminGoal = null;

export async function initGoalsAdminPage() {
    setupFYSelector('goal-admin-fy');
    await loadStoreOptions('goal-admin-store');

    const fySel = document.getElementById('goal-admin-fy');
    const storeSel = document.getElementById('goal-admin-store');
    const loadBtn = document.getElementById('goal-admin-load-btn');
    const saveBtn = document.getElementById('goal-admin-save-btn');
    
    const salesIn = document.getElementById('goal-total-sales');
    const custIn = document.getElementById('goal-total-cust');
    const avgLabel = document.getElementById('goal-avg-spend');

    const sphOpIn = document.getElementById('goal-sph-op');
    const sphTotalIn = document.getElementById('goal-sph-total');

    const formatIn = (el) => {
        el.oninput = () => {
            let val = el.value.replace(/,/g, '').replace(/[^\d]/g, '');
            if (val === '') el.value = '';
            else el.value = parseInt(val).toLocaleString();
            updateAvg();
        };
    };

    [salesIn, custIn, sphOpIn, sphTotalIn].forEach(formatIn);

    const updateAvg = () => {
        const s = parseFloat(salesIn.value.replace(/,/g, '')) || 0;
        const c = parseFloat(custIn.value.replace(/,/g, '')) || 0;
        const avg = c > 0 ? Math.round(s / c) : 0;
        avgLabel.textContent = `¥ ${avg.toLocaleString()}`;
    };

    loadBtn.onclick = async () => {
        const fy = fySel.value;
        const sid = storeSel.value;
        if (!sid) return alert('店舗を選択してください');
        
        loadBtn.disabled = true;
        loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 読込中...';
        
        try {
            const docId = `${fy}_${sid}`;
            const snap = await getDoc(doc(db, "m_annual_budgets", docId));
            
            document.getElementById('goal-admin-form-container').style.display = 'block';
            
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.textContent = `年間ターゲット設定 (${fy}年度)`;
            
            document.getElementById('goal-admin-save-btn').textContent = `${fy}年度 年間マスタを保存`;
            
            if (snap.exists()) {
                const d = snap.data();
                currentAdminGoal = d;
                salesIn.value = (d.total_sales_target || 0).toLocaleString();
                custIn.value = (d.total_cust_target || 0).toLocaleString();
                document.getElementById('goal-labor-rate').value = d.target_labor_rate || 0;
                sphOpIn.value = (d.target_sales_per_hour_op || 0).toLocaleString();
                sphTotalIn.value = (d.target_sales_per_hour_total || 0).toLocaleString();
            } else {
                currentAdminGoal = null;
                salesIn.value = "";
                custIn.value = "";
                document.getElementById('goal-labor-rate').value = "";
                sphOpIn.value = "";
                sphTotalIn.value = "";
            }
            updateAvg();
        } catch (e) {
            console.error(e);
            alert('読込エラー');
        } finally {
            loadBtn.disabled = false;
            loadBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 読み込み';
        }
    };

    saveBtn.onclick = async () => {
        const fy = fySel.value;
        const sid = storeSel.value;
        const s = parseFloat(salesIn.value.replace(/,/g, '')) || 0;
        const c = parseFloat(custIn.value.replace(/,/g, '')) || 0;
        
        if (s <= 0) return alert('年間売上目標を入力してください');

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

        try {
            const docId = `${fy}_${sid}`;
            const data = {
                fy: parseInt(fy),
                store_id: sid,
                total_sales_target: s,
                total_cust_target: c,
                target_labor_rate: parseFloat(document.getElementById('goal-labor-rate').value) || 0,
                target_sales_per_hour_op: parseInt(sphOpIn.value.replace(/,/g, '')) || 0,
                target_sales_per_hour_total: parseInt(sphTotalIn.value.replace(/,/g, '')) || 0,
                updated_at: new Date(),
                updated_by: JSON.parse(localStorage.getItem('currentUser'))?.Name || 'Admin'
            };
            await setDoc(doc(db, "m_annual_budgets", docId), data);
            alert('年間ターゲットを保存しました！\n次は「店長モード（月次計画）」にて按分割合を設定してください。');
        } catch (e) {
            console.error(e);
            alert('保存エラー: ' + e.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> 2026年度 年間マスタを保存';
        }
    };
}

/**
 * --- Common Helpers ---
 */

function setupFYSelector(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const now = new Date();
    let initialFY = now.getFullYear();
    if (now.getMonth() < 6) initialFY--; 

    sel.innerHTML = '';
    for (let y = initialFY - 1; y <= initialFY + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y}年度 (7月-翌6月)`;
        sel.appendChild(opt);
    }
    sel.value = initialFY;
}

async function loadStoreOptions(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">店舗を選択...</option>';
    try {
        const snap = await getDocs(collection(db, "m_stores"));
        snap.forEach(d => {
            const data = d.data();
            if (data.store_type === 'CK') return;
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = data.store_name || data.店舗名;
            sel.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

/**
 * --- Phase 2: Goals Store (Simulator) ---
 */

let annualBudget = null;
let monthlyData = []; // 12ヶ月分のデータ
let storeWeights = {
    mon_thu: 1.0, fri: 1.2, sat: 1.5, sun: 1.4, holiday: 1.5, day_before_holiday: 1.6
};

export async function initGoalsStorePage() {
    setupFYSelector('goal-store-fy');
    await loadStoreOptions('goal-store-sid');

    const fySel = document.getElementById('goal-store-fy');
    const sidSel = document.getElementById('goal-store-sid');
    const loadBtn = document.getElementById('goal-store-load-btn');
    const saveBtn = document.getElementById('goal-store-save-btn');
    const weightModal = document.getElementById('weight-config-modal');

    document.getElementById('btn-open-weight-modal').onclick = () => {
        weightModal.style.display = 'flex';
        // モーダルに現在の指数を反映
        document.getElementById('weight-mon-thu').value = storeWeights.mon_thu;
        document.getElementById('weight-fri').value = storeWeights.fri;
        document.getElementById('weight-sat').value = storeWeights.sat;
        document.getElementById('weight-sun').value = storeWeights.sun;
        document.getElementById('weight-holiday').value = storeWeights.holiday;
        document.getElementById('weight-day-before').value = storeWeights.day_before_holiday;
    };

    document.getElementById('btn-save-weight').onclick = () => {
        storeWeights = {
            mon_thu: parseFloat(document.getElementById('weight-mon-thu').value) || 1.0,
            fri: parseFloat(document.getElementById('weight-fri').value) || 1.0,
            sat: parseFloat(document.getElementById('weight-sat').value) || 1.0,
            sun: parseFloat(document.getElementById('weight-sun').value) || 1.0,
            holiday: parseFloat(document.getElementById('weight-holiday').value) || 1.0,
            day_before_holiday: parseFloat(document.getElementById('weight-day-before').value) || 1.0,
        };
        weightModal.style.display = 'none';
        refreshSimulator();
    };

    loadBtn.onclick = async () => {
        const fy = fySel.value;
        const sid = sidSel.value;
        if (!sid) return alert('店舗を選択してください');

        loadBtn.disabled = true;
        loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 読込中...';

        try {
            // 1. 年間ターゲット取得
            const aSnap = await getDoc(doc(db, "m_annual_budgets", `${fy}_${sid}`));
            if (!aSnap.exists()) {
                alert('社長による年間ターゲット設定がまだ行われていません。');
                return;
            }
            annualBudget = aSnap.data();
            document.getElementById('summary-annual-sales').textContent = `¥ ${Math.round(annualBudget.total_sales_target).toLocaleString()}`;

            // 2. 12ヶ月分の営業日数と保存済み計画を取得
            const months = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
            monthlyData = [];

            for (const m of months) {
                const actualY = (m >= 7) ? parseInt(fy) : parseInt(fy) + 1;
                const ym = `${actualY}-${String(m).padStart(2, '0')}`;
                
                // カレンダーから営業日数取得
                let calSnap = await getDoc(doc(db, "m_calendars", `${ym}_${sid}`));
                if (!calSnap.exists()) {
                    calSnap = await getDoc(doc(db, "m_calendars", `${ym}_common`));
                }
                const calData = calSnap.exists() ? calSnap.data() : { days: [] };
                const opDays = calData.days?.filter(d => d.type === 'work').length || 0;

                // 保存済み計画取得
                const goalSnap = await getDoc(doc(db, "t_monthly_goals", `${ym}_${sid}`));
                const goalData = goalSnap.exists() ? goalSnap.data() : { allocation_pct: 8.33 }; // デフォルト 1/12

                monthlyData.push({
                    m, actualY, ym,
                    opDays,
                    pct: goalData.allocation_pct || 8.33,
                    calDays: calData.days || []
                });
            }

            document.getElementById('goal-store-container').style.display = 'block';
            
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.textContent = `売上按分シミュレーター (${fy}年度)`;
            
            refreshSimulator();

        } catch (e) {
            console.error(e);
            alert('読込エラー');
        } finally {
            loadBtn.disabled = false;
            loadBtn.innerHTML = '<i class="fas fa-magic"></i> 計画を作成・読込';
        }
    };

    saveBtn.onclick = async () => {
        const totalPct = monthlyData.reduce((sum, d) => sum + d.pct, 0);
        if (totalPct < 99.9 || totalPct > 120.1) return; // 微小な浮動小数点誤差を考慮

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

        try {
            for (const d of monthlyData) {
                const docId = `${d.ym}_${sidSel.value}`;
                await setDoc(doc(db, "t_monthly_goals", docId), {
                    year_month: d.ym,
                    store_id: sidSel.value,
                    allocation_pct: d.pct,
                    sales_target: Math.round(annualBudget.total_sales_target * (d.pct / 100)),
                    weights: storeWeights,
                    updated_at: new Date()
                });
            }
            alert('月次計画を保存しました！ダッシュボードに反映されます。');
        } catch (e) {
            console.error(e);
            alert('保存エラー');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-check-circle"></i> 計画を確定して保存';
        }
    };
}

function refreshSimulator() {
    const tbody = document.getElementById('goal-simulator-body');
    tbody.innerHTML = '';

    let totalPct = 0;
    monthlyData.forEach((d, idx) => {
        const sales = Math.round(annualBudget.total_sales_target * (d.pct / 100));
        
        // 指合計の算出
        let totalWeights = 0;
        d.calDays.forEach((day, di) => {
            if (day.type !== 'work') return;
            const date = new Date(d.actualY, d.m - 1, day.day);
            const dow = date.getDay(); // 0:Sun, 1:Mon...
            const nextDate = new Date(d.actualY, d.m - 1, day.day + 1);
            
            // 祝前日判定: カレンダーの翌日が祝日か?
            const nextDayObj = d.calDays.find(nd => nd.day === day.day + 1);
            const isDayBeforeH = nextDayObj ? nextDayObj.is_holiday : false;

            const indices = [];
            // 土日金の判定
            if (dow >= 1 && dow <= 4) indices.push(storeWeights.mon_thu);
            else if (dow === 5) indices.push(storeWeights.fri);
            else if (dow === 6) indices.push(storeWeights.sat);
            else if (dow === 0) indices.push(storeWeights.sun);

            if (day.is_holiday) indices.push(storeWeights.holiday);
            if (isDayBeforeH) indices.push(storeWeights.day_before_holiday);

            totalWeights += Math.max(...indices);
        });

        const tr = document.createElement('tr');
        tr.className = 'sim-row';
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
            <td style="padding: 1rem; font-weight: 800; color: var(--text-primary);">${d.m}月</td>
            <td style="text-align: center;">${d.opDays}日</td>
            <td style="padding: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <input type="range" style="flex: 1;" min="0" max="25" step="0.1" value="${d.pct}" oninput="window.updateGoalPct(${idx}, this.value)">
                    <div style="display: flex; align-items: center;">
                        <input type="number" class="sim-input-pct" value="${d.pct.toFixed(2)}" onchange="window.updateGoalPct(${idx}, this.value)">
                        <span style="font-size: 0.75rem; font-weight: 700; margin-left: 2px;">%</span>
                    </div>
                </div>
                <div class="sim-pct-bar" style="width: ${Math.min(100, d.pct * 5)}%;"></div>
            </td>
            <td style="text-align: right; font-weight: 700; color: var(--primary);">¥ ${sales.toLocaleString()}</td>
            <td style="text-align: right; font-weight: 600; color: var(--text-secondary);">${totalWeights.toFixed(1)} pt</td>
        `;
        tbody.appendChild(tr);
        totalPct += d.pct;
    });

    // サマリー更新
    const totalPlanSales = Math.round(annualBudget.total_sales_target * (totalPct / 100));
    document.getElementById('summary-total-plan').textContent = `¥ ${totalPlanSales.toLocaleString()}`;
    document.getElementById('summary-pct-label').textContent = `現在の達成率: ${totalPct.toFixed(1)}%`;
    document.getElementById('summary-pct-bar').style.width = `${Math.min(100, totalPct)}%`;

    // バリデーション
    const vMsg = document.getElementById('goal-validation-msg');
    const saveBtn = document.getElementById('goal-store-save-btn');
    
    if (totalPct >= 100 && totalPct <= 120) {
        vMsg.textContent = `目標達成に向けて、${totalPct.toFixed(1)}%の意欲的な計画が立てられています！この内容で確定できます。`;
        vMsg.className = 'text-intent';
        vMsg.style.background = '#ecfdf5';
        saveBtn.disabled = false;
    } else {
        vMsg.textContent = `目標達成に向けて、100%〜120%の範囲で意欲的な計画を立ててください。（現在: ${totalPct.toFixed(1)}%）`;
        vMsg.className = 'text-error';
        vMsg.style.background = '#fff1f2';
        saveBtn.disabled = true;
    }
}

window.updateGoalPct = (idx, val) => {
    monthlyData[idx].pct = parseFloat(val) || 0;
    refreshSimulator();
};
