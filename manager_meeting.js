import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, getDoc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let currentMeetingView = 'archive'; // 'archive' | 'form'
let editingMeetingData = null;
let currentTargetMonth = '';
let currentTargetStore = '';

// 施策カテゴリの標準リスト
const ACTION_CATEGORIES = [
    '接客', 'メニュー', 'POP', 'SNS', '外観', 'オペレーション', '回転率', '教育', '予約導線', 'ドリンク導線'
];

export const managerMeetingPageHtml = `
    <div id="manager-meeting-container" class="manager-meeting-container animate-fade-in">
        <!-- JSで動的にビューが挿入されます -->
    </div>
`;

export async function initManagerMeetingPage() {
    renderMeetingView();
}

function renderMeetingView() {
    const container = document.getElementById('manager-meeting-container');
    if (!container) return;

    if (currentMeetingView === 'archive') {
        renderArchiveView(container);
    } else {
        renderFormView(container);
    }
}

// -------------------------------------------------------------
// アーカイブビュー (一覧表示)
// -------------------------------------------------------------
async function renderArchiveView(container) {
    container.innerHTML = `
        <div class="mm-header no-print">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem; font-weight: 900; color: var(--text-primary);">
                    <i class="fas fa-sync-alt" style="color: var(--primary);"></i>
                    店舗PDCA (旧店長会議)
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem; font-weight: 500;">
                    各KPIに基づく仮説・実行・検証のログと、次月への改善サイクル管理
                </p>
            </div>
            <button id="btn-create-meeting" class="btn btn-primary" style="padding: 0.8rem 1.8rem; font-weight: 900; border-radius: 12px; box-shadow: 0 4px 12px rgba(230,57,70,0.2);">
                <i class="fas fa-plus"></i> 新規PDCA作成
            </button>
        </div>

        <div class="mm-card no-print" style="margin-top: 1.5rem; border-radius: 6px;">
            <h3 style="margin-top:0; font-size:1.1rem; color:var(--text-primary); font-weight:800; margin-bottom:1.5rem;">提出履歴一覧</h3>
            <div id="mm-archive-list" style="display: flex; flex-direction: column; gap: 1rem;">
                <p style="text-align:center; padding: 3rem; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> 履歴をロード中...</p>
            </div>
        </div>

        <!-- 新規作成モーダル (丸み 6px) -->
        <div id="mm-create-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:10000; justify-content:center; align-items:center; backdrop-filter: blur(4px);">
            <div class="glass-panel animate-fade-in" style="background:white; padding:2rem; border-radius:6px; width:90%; max-width:420px; border: 1px solid var(--border); box-shadow: var(--shadow-lg);">
                <h3 style="margin-top:0; color:var(--text-primary); font-weight:900; font-size:1.2rem; border-bottom:1px solid var(--border); padding-bottom:0.8rem; margin-bottom:1.5rem;">新規店舗PDCAの作成</h3>
                <div class="input-group" style="margin-bottom: 1.2rem;">
                    <label style="display:block; margin-bottom:0.5rem; font-weight:700; font-size:0.8rem; color:var(--text-secondary);">対象店舗</label>
                    <select id="mm-select-store" class="mm-input" style="width:100%; padding:0.8rem; border-radius:10px; border:1px solid var(--border); font-weight:700;">
                        <option value="">ロード中...</option>
                    </select>
                </div>
                <div class="input-group" style="margin-bottom: 1.5rem;">
                    <label style="display:block; margin-bottom:0.5rem; font-weight:700; font-size:0.8rem; color:var(--text-secondary);">対象月</label>
                    <input type="month" id="mm-select-month" class="mm-input" style="width:100%; padding:0.8rem; border-radius:10px; border:1px solid var(--border); font-weight:700;">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:1rem; border-top:1px solid var(--border); padding-top:1.2rem;">
                    <button id="btn-cancel-modal" class="btn" style="background:#f1f5f9; color:#475569; font-weight:700; border-radius:10px;">キャンセル</button>
                    <button id="btn-confirm-create" class="btn btn-primary" style="font-weight:900; border-radius:10px;">作成開始</button>
                </div>
            </div>
        </div>
    `;

    const modal = document.getElementById('mm-create-modal');
    loadArchiveList();
    
    document.getElementById('btn-create-meeting').onclick = async () => {
        modal.style.display = 'flex';
        const now = new Date();
        document.getElementById('mm-select-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // 店舗リスト取得
        const storeSelect = document.getElementById('mm-select-store');
        if (storeSelect.options.length <= 1) {
            try {
                const snap = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
                storeSelect.innerHTML = '';
                snap.forEach(d => {
                    const data = d.data();
                    if (data.store_type === 'CK') return; // CKは除外
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = data.store_name || data.店舗名;
                    storeSelect.appendChild(opt);
                });
                
                if (window.appState && window.appState.currentUser) {
                    storeSelect.value = window.appState.currentUser.StoreID || 'honten';
                }
            } catch (e) {
                console.error("Failed to load stores:", e);
                storeSelect.innerHTML = '<option value="">店舗の読み込みに失敗</option>';
            }
        }
    };

    document.getElementById('btn-cancel-modal').onclick = () => {
        modal.style.display = 'none';
    };

    document.getElementById('btn-confirm-create').onclick = async () => {
        const store = document.getElementById('mm-select-store').value;
        const month = document.getElementById('mm-select-month').value;
        if (!store || !month) return alert("店舗と月を選択してください");
        
        currentTargetStore = store;
        currentTargetMonth = month;
        
        // 既存のドキュメントがあるか確認
        const docId = `${store}_${month}`;
        try {
            const docSnap = await getDoc(doc(db, "t_manager_meetings", docId));
            if (docSnap.exists()) {
                editingMeetingData = { id: docId, ...docSnap.data() };
            } else {
                // 新規作成＆自動引き継ぎ処理
                editingMeetingData = await generateNewPDCAData(store, month);
            }
            
            currentMeetingView = 'form';
            modal.style.display = 'none';
            renderMeetingView();
        } catch (e) {
            console.error("Error creating/loading PDCA:", e);
            alert("データの初期化に失敗しました。");
        }
    };
}

// -------------------------------------------------------------
// 新規作成時の前月からの自動引き継ぎロジック (コア機能)
// -------------------------------------------------------------
async function generateNewPDCAData(storeId, monthStr) {
    const user = window.appState ? window.appState.currentUser : null;
    const authorName = user ? (user.Name || '店舗スタッフ') : '店舗スタッフ';
    const authorId = user ? (user.id || 'unknown') : 'unknown';

    // 1. 基本オブジェクトの作成
    const newDoc = {
        store_id: storeId,
        store_name: '', // 初期読込でセット
        target_month: monthStr,
        author_id: authorId,
        author_name: authorName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: '下書き',
        actions: [],
        free_targets: {
            education: '',
            hospitality: '',
            operation: ''
        },
        hr_sharing: {
            recruitment_plan: '',
            retirement_concern: '',
            visa_check: '',
            training_status: ''
        }
    };

    // 店舗名取得
    try {
        const sSnap = await getDoc(doc(db, "m_stores", storeId));
        if (sSnap.exists()) {
            newDoc.store_name = sSnap.data().store_name || sSnap.data().店舗名;
        } else {
            newDoc.store_name = storeId;
        }
    } catch(e) {
        newDoc.store_name = storeId;
    }

    // 2. 前月年月を計算
    const [y, m] = monthStr.split('-').map(Number);
    let prevY = y;
    let prevM = m - 1;
    if (prevM === 0) { prevM = 12; prevY--; }
    const prevMonthStr = `${prevY}-${String(prevM).padStart(2, '0')}`;

    // 3. 前月ドキュメントを読み込み
    try {
        const prevDocId = `${storeId}_${prevMonthStr}`;
        const prevSnap = await getDoc(doc(db, "t_manager_meetings", prevDocId));
        if (prevSnap.exists()) {
            const prevData = prevSnap.data();
            
            // 4. アクションの自動引き継ぎ
            if (prevData.actions && Array.isArray(prevData.actions)) {
                prevData.actions.forEach(act => {
                    // 「実行中 (active)」であるか、または「次回改善案 (next_action)」が記入されているものを引き継ぐ
                    const hasNextAction = act.next_action && act.next_action.trim() !== '';
                    const isActive = act.status === 'active';

                    if (isActive || hasNextAction) {
                        // 前月の次回改善案（next_action）を今月の施策内容（details）に昇格させる
                        let detailsStr = act.details || '';
                        if (hasNextAction) {
                            detailsStr = `【前月改善策】${act.next_action}\n────────────────\n(前月実施内容: ${act.details || 'なし'})`;
                        }

                        newDoc.actions.push({
                            id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                            kpi_type: act.kpi_type,
                            category: act.category || '接客',
                            action_name: act.action_name || '無題の引き継ぎ施策',
                            details: detailsStr,
                            expected_effect: act.expected_effect || 0,
                            result_comment: '', // 今月振り返るためクリア
                            actual_effect: 0,   // 今月の実績
                            next_action: '',    // 次回改善用
                            status: 'active'    // 再びアクティブに
                        });
                    }
                });
            }

            // 5. 定性目標 & スタッフ情報の引き継ぎ (VISA確認や退職懸念などは継続的に確認する必要があるため)
            if (prevData.free_targets) {
                newDoc.free_targets = {
                    education: prevData.free_targets.education || '',
                    hospitality: prevData.free_targets.hospitality || '',
                    operation: prevData.free_targets.operation || ''
                };
            }
            if (prevData.hr_sharing) {
                newDoc.hr_sharing = {
                    recruitment_plan: prevData.hr_sharing.recruitment_plan || '',
                    retirement_concern: prevData.hr_sharing.retirement_concern || '',
                    visa_check: prevData.hr_sharing.visa_check || '',
                    training_status: prevData.hr_sharing.training_status || ''
                };
            }
        }
    } catch(e) {
        console.warn("Failed to carry over from previous month:", e);
    }

    return newDoc;
}

// -------------------------------------------------------------
// フォームビュー (PDCAボード・最重要画面)
// -------------------------------------------------------------
async function renderFormView(container) {
    container.innerHTML = `
        <div class="mm-header no-print" style="margin-bottom: 2rem;">
            <button id="btn-back-archive" class="btn" style="background: white; border: 1px solid var(--border); font-weight: 700; border-radius: 10px; padding: 0.6rem 1.2rem;">
                <i class="fas fa-arrow-left"></i> 戻る
            </button>
            <div style="display: flex; gap: 1rem;">
                <button id="btn-print-meeting" class="btn" style="background: white; border: 1px solid var(--primary); color: var(--primary); font-weight: 700; border-radius: 10px; padding: 0.6rem 1.2rem;">
                    <i class="fas fa-print"></i> 印刷 / PDF保存
                </button>
                <button id="btn-save-meeting" class="btn btn-primary" style="font-weight: 900; border-radius: 10px; padding: 0.6rem 1.8rem; box-shadow: 0 4px 12px rgba(230,57,70,0.2);">
                    <i class="fas fa-save"></i> 提出・保存
                </button>
            </div>
        </div>

        <div id="mm-printable-area">
            <!-- 上部タイトルカード (角丸を6px化、h1文字色を明示的白#ffffff化) -->
            <div class="glass-panel" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 2rem; border-radius: 6px; margin-bottom: 2rem; border: none; box-shadow: var(--shadow-md);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <h1 style="margin: 0; font-size: 1.6rem; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">
                            ${editingMeetingData.store_name}
                        </h1>
                        <p style="margin: 0.4rem 0 0; color: #94a3b8; font-weight: 600; font-size: 1rem;">
                            対象月度: <span id="display-target-month">${editingMeetingData.target_month}</span>
                        </p>
                    </div>
                    <div style="display: flex; gap: 1.5rem; background: rgba(255,255,255,0.05); padding: 0.8rem 1.5rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); font-size:0.85rem;">
                        <div><span style="color:#64748b; display:block; font-size:0.75rem; font-weight:700;">記入者</span><strong style="color:#f8fafc;" id="display-author">${editingMeetingData.author_name}</strong></div>
                        <div style="border-left: 1px solid rgba(255,255,255,0.1); padding-left: 1.5rem;"><span style="color:#64748b; display:block; font-size:0.75rem; font-weight:700;">状態</span><strong style="color:var(--primary);" id="display-status">${editingMeetingData.status || '下書き'}</strong></div>
                        <div style="border-left: 1px solid rgba(255,255,255,0.1); padding-left: 1.5rem;"><span style="color:#64748b; display:block; font-size:0.75rem; font-weight:700;">最終更新</span><strong style="color:#f8fafc;" id="display-date">-</strong></div>
                    </div>
                </div>
            </div>

            <!-- KPI PDCAボード (グリッド) -->
            <h2 style="font-size: 1.2rem; font-weight: 900; color: var(--text-primary); margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;" class="no-print">
                <i class="fas fa-chart-line" style="color:var(--primary);"></i> KPI改善ダッシュボード
            </h2>
            <div id="mm-kpi-boards-container" style="display: flex; flex-direction: column; gap: 2rem;">
                <p style="text-align:center; padding:3rem; color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> 実績値およびKPIボードの自動構築中...</p>
            </div>

            <!-- 定性・自由目標エリア (丸み 6pxへ) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem; margin-top: 3rem;">
                <div class="mm-card" style="border-radius:6px;">
                    <div class="mm-section-title" style="font-size:1.1rem; font-weight:900; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem; color:var(--text-primary);">
                        <i class="fas fa-bullseye" style="color:#f59e0b;"></i> 自由目標エリア (文化・教育・接客品質)
                    </div>
                    <div class="input-group" style="margin-bottom: 1.2rem;">
                        <label style="display:block; margin-bottom:0.4rem; font-weight:800; font-size:0.75rem; color:#64748b;">教育・チーム作り</label>
                        <textarea id="mm-input-edu" class="mm-input" rows="3" style="width:100%; border-radius:6px; border:1px solid var(--border); padding:0.8rem; font-size:0.85rem;" placeholder="スタッフの教育進捗、チームワーク、帰属意識の醸成について現状と対策"></textarea>
                    </div>
                    <div class="input-group" style="margin-bottom: 1.2rem;">
                        <label style="display:block; margin-bottom:0.4rem; font-weight:800; font-size:0.75rem; color:#64748b;">活気・接客品質</label>
                        <textarea id="mm-input-hos" class="mm-input" rows="3" style="width:100%; border-radius:6px; border:1px solid var(--border); padding:0.8rem; font-size:0.85rem;" placeholder="店舗の活気、サービスレベル、常連顧客づくりのための接客向上計画"></textarea>
                    </div>
                    <div class="input-group">
                        <label style="display:block; margin-bottom:0.4rem; font-weight:800; font-size:0.75rem; color:#64748b;">オペレーション改善</label>
                        <textarea id="mm-input-ope" class="mm-input" rows="3" style="width:100%; border-radius:6px; border:1px solid var(--border); padding:0.8rem; font-size:0.85rem;" placeholder="キッチンの回転率、オペレーションの無駄、クリンリネス向上などの改善案"></textarea>
                    </div>
                </div>

                <!-- 採用・共有事項エリア (丸み 6pxへ) -->
                <div class="mm-card" style="border-radius:6px;">
                    <div class="mm-section-title" style="font-size:1.1rem; font-weight:900; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem; color:var(--text-primary);">
                        <i class="fas fa-users" style="color:#3b82f6;"></i> スタッフ・採用共有エリア
                    </div>
                    <div class="input-group" style="margin-bottom: 1.2rem;">
                        <label style="display:block; margin-bottom:0.4rem; font-weight:800; font-size:0.75rem; color:#64748b;">採用予定・人員計画</label>
                        <textarea id="mm-input-rec" class="mm-input" rows="2" style="width:100%; border-radius:6px; border:1px solid var(--border); padding:0.8rem; font-size:0.85rem;" placeholder="今月・来月の採用目標、充足状況、シフト枠の埋まり具合"></textarea>
                    </div>
                    <div class="input-group" style="margin-bottom: 1.2rem;">
                        <label style="display:block; margin-bottom:0.4rem; font-weight:800; font-size:0.75rem; color:#64748b;">退職懸念・モチベーション</label>
                        <textarea id="mm-input-ret" class="mm-input" rows="2" style="width:100%; border-radius:6px; border:1px solid var(--border); padding:0.8rem; font-size:0.85rem;" placeholder="スタッフの不満、モチベーション低下、退職の予兆などの懸念事項"></textarea>
                    </div>
                    <div class="input-group" style="margin-bottom: 1.2rem;">
                        <label style="display:block; margin-bottom:0.4rem; font-weight:800; font-size:0.75rem; color:#64748b;">外国人スタッフ VISA期限確認</label>
                        <textarea id="mm-input-visa" class="mm-input" rows="2" style="width:100%; border-radius:6px; border:1px solid var(--border); padding:0.8rem; font-size:0.85rem;" placeholder="期限切れの近い留学生・就労スタッフがいないかのチェック結果"></textarea>
                    </div>
                    <div class="input-group">
                        <label style="display:block; margin-bottom:0.4rem; font-weight:800; font-size:0.75rem; color:#64748b;">教育進捗・昇格候補</label>
                        <textarea id="mm-input-train" class="mm-input" rows="2" style="width:100%; border-radius:6px; border:1px solid var(--border); padding:0.8rem; font-size:0.85rem;" placeholder="サブ店長昇格候補、新人の育成進捗、キーマン育成について"></textarea>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-back-archive').onclick = () => {
        currentMeetingView = 'archive';
        renderMeetingView();
    };

    document.getElementById('btn-print-meeting').onclick = () => {
        window.print();
    };

    document.getElementById('btn-save-meeting').onclick = async () => {
        await saveMeetingData();
    };

    // 定性目標などのフォーム復元
    if (editingMeetingData.free_targets) {
        document.getElementById('mm-input-edu').value = editingMeetingData.free_targets.education || '';
        document.getElementById('mm-input-hos').value = editingMeetingData.free_targets.hospitality || '';
        document.getElementById('mm-input-ope').value = editingMeetingData.free_targets.operation || '';
    }
    if (editingMeetingData.hr_sharing) {
        document.getElementById('mm-input-rec').value = editingMeetingData.hr_sharing.recruitment_plan || '';
        document.getElementById('mm-input-ret').value = editingMeetingData.hr_sharing.retirement_concern || '';
        document.getElementById('mm-input-visa').value = editingMeetingData.hr_sharing.visa_check || '';
        document.getElementById('mm-input-train').value = editingMeetingData.hr_sharing.training_status || '';
    }

    const today = new Date().toLocaleDateString('ja-JP');
    document.getElementById('display-date').textContent = editingMeetingData.updated_at ? new Date(editingMeetingData.updated_at).toLocaleDateString('ja-JP') : today;

    // KPI集計とPDCAボードの描画
    await buildKpiPdcaBoards();
}

// -------------------------------------------------------------
// KPI PDCAボードの自動構築 (集計とUIレンダリング - 売上日次平均メイン ＆ ロードマップ自動提示)
// -------------------------------------------------------------
const TAX_RATE = 1.1;

async function buildKpiPdcaBoards() {
    const container = document.getElementById('mm-kpi-boards-container');
    if (!container) return;

    const [year, monthStr] = editingMeetingData.target_month.split('-');
    const currentYear = parseInt(year);
    const currentMonth = parseInt(monthStr);

    const storeId = editingMeetingData.store_id;

    // --- 1. 年月算出 (当月、前月、前々月、前年同月) ---
    const getMonthString = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
    
    const targetYm = getMonthString(currentYear, currentMonth);
    
    let prevY = currentYear, prevM = currentMonth - 1;
    if (prevM === 0) { prevM = 12; prevY--; }
    const prevYm = getMonthString(prevY, prevM);

    let prev2Y = prevY, prev2M = prevM - 1;
    if (prev2M === 0) { prev2M = 12; prev2Y--; }
    const prev2Ym = getMonthString(prev2Y, prev2M);

    const prevYearY = currentYear - 1;
    const prevYearYm = getMonthString(prevYearY, currentMonth);

    // --- 2. 予定営業日数の取得 (カレンダーマスタ) ---
    let targetOpDays = 25; // デフォルト営業日数
    try {
        let calSnap = await getDoc(doc(db, "m_calendars", `${targetYm}_${storeId}`));
        if (!calSnap.exists()) {
            calSnap = await getDoc(doc(db, "m_calendars", `${targetYm}_common`));
        }
        if (calSnap.exists()) {
            const calData = calSnap.data();
            const daysArr = calData.days || [];
            const count = daysArr.filter(d => d.type === 'work').length;
            if (count > 0) targetOpDays = count;
        }
    } catch(e) {
        console.warn("Failed to fetch calendar days:", e);
    }

    // --- 3. 目標値の取得 (月次 & 年間マスタから逆算) ---
    let targetSales = 0;       // 売上目標 (税抜)
    let targetSphOp = 0;       // 営業人時売上目標 (生産性)
    let targetAvgSpend = 3050; // 客単価目標 (標準デフォルト ¥3,050)
    
    try {
        // 月次計画 (売上目標)
        const goalSnap = await getDoc(doc(db, "t_monthly_goals", `${targetYm}_${storeId}`));
        if (goalSnap.exists()) {
            targetSales = Number(String(goalSnap.data().sales_target || '0').replace(/,/g, '')) || 0;
        }
        
        // 年間マスタ (7月始まり会計年度)
        let fy = currentYear;
        if (currentMonth < 7) fy = currentYear - 1;
        const bSnap = await getDoc(doc(db, "m_annual_budgets", `${fy}_${storeId}`));
        if (bSnap.exists()) {
            const budData = bSnap.exists() ? bSnap.data() : {};
            targetSphOp = Number(String(budData.target_sales_per_hour_op || '0').replace(/,/g, '')) || 0;
            
            // 年間目標から想定客単価を逆算
            const annS = Number(budData.total_sales_target) || 0;
            const annC = Number(budData.total_cust_target) || 0;
            if (annS > 0 && annC > 0) {
                targetAvgSpend = Math.round(annS / annC);
            }
        }
    } catch(e) {
        console.error("Failed to load goals & budgets:", e);
    }

    const targetCustomers = targetAvgSpend > 0 ? Math.round(targetSales / targetAvgSpend) : 0;
    const targetLaborHours = targetSphOp > 0 ? targetSales / targetSphOp : 0;

    // --- 4. 実績値の集計 ---
    const performanceMap = { 
        [targetYm]: { sales: 0, cust: 0, days: 0 }, 
        [prevYm]: { sales: 0, cust: 0, days: 0 }, 
        [prev2Ym]: { sales: 0, cust: 0, days: 0 }, 
        [prevYearYm]: { sales: 0, cust: 0, days: 0 } 
    };
    const laborMap = { [targetYm]: 0, [prevYm]: 0, [prev2Ym]: 0, [prevYearYm]: 0 };

    try {
        // 営業実績集計
        const pSnap = await getDocs(query(collection(db, "t_performance"), where("store_id", "==", storeId)));
        pSnap.forEach(docSnap => {
            const d = docSnap.data();
            const normDate = (d.date || "").replace(/\//g, '-').replace(/\./g, '-');
            const ym = d.year_month || normDate.substring(0, 7);
            
            if (performanceMap[ym] !== undefined) {
                const salesTaxEx = d.amount_ex_tax !== undefined ? Number(d.amount_ex_tax) : ((Number(d.amount || d.Amount || 0) || 0) / TAX_RATE);
                const cust = Number(d.customer_count || d.customer_count_total || d.customer_count_total_ex_tax || d.customers || 0) || 0;
                
                performanceMap[ym].sales += salesTaxEx;
                performanceMap[ym].cust += cust;
                
                // 実際に売上が発生した日を営業日数としてカウント
                if (salesTaxEx > 0) {
                    performanceMap[ym].days++;
                }
            }
        });

        // 勤怠人時集計
        const aSnap = await getDocs(collection(db, "t_attendance"));
        aSnap.forEach(docSnap => {
            const d = docSnap.data();
            const sid = String(d.store_id || d.StoreID || "").trim();
            if (sid !== storeId) return;

            const isImported = (d.total_labor_hours !== undefined || d.TotalLaborHours !== undefined);
            if (!isImported) return;

            const rawYm = d.year_month || d.YearMonth || String(d.timestamp || d.date).substring(0, 7);
            const ym = String(rawYm).replace(/\//g, '-');

            if (laborMap[ym] !== undefined) {
                const h = Number(String(d.total_labor_hours || d.TotalLaborHours || '0').replace(/,/g, '')) || 0;
                laborMap[ym] += h;
            }
        });
    } catch(e) {
        console.error("Error aggregating performance data:", e);
    }

    // 各月の実営業日数 (0件の場合は予定/標準日数でフォールバック)
    const opDaysActual = performanceMap[targetYm].days || targetOpDays;
    const opDaysPrev = performanceMap[prevYm].days || 25;
    const opDaysPrev2 = performanceMap[prev2Ym].days || 25;
    const opDaysPrevYear = performanceMap[prevYearYm].days || 25;

    // 各KPIの数値定義 (売上は1日平均をメインとする)
    const kpis = {
        sales: {
            name: '売上 (日次平均 ＆ 月次合計)',
            unit: '円',
            isCurrency: true,
            target: targetSales / targetOpDays, // 1日平均目標
            actual: performanceMap[targetYm].sales / opDaysActual, // 1日平均実績
            prev: performanceMap[prevYm].sales / opDaysPrev,
            prev2: performanceMap[prev2Ym].sales / opDaysPrev2,
            prevYear: performanceMap[prevYearYm].sales / opDaysPrevYear,
            // 補正参照用の合計値
            totalTarget: targetSales,
            totalActual: performanceMap[targetYm].sales,
            opDays: opDaysActual,
            opDaysTarget: targetOpDays
        },
        customers: {
            name: '平均来客数 (月間合計)',
            unit: '人',
            isCurrency: false,
            target: targetCustomers,
            actual: performanceMap[targetYm].cust,
            prev: performanceMap[prevYm].cust,
            prev2: performanceMap[prev2Ym].cust,
            prevYear: performanceMap[prevYearYm].cust
        },
        spend: {
            name: '客単価 (税抜)',
            unit: '円',
            isCurrency: true,
            target: targetAvgSpend,
            actual: performanceMap[targetYm].cust > 0 ? performanceMap[targetYm].sales / performanceMap[targetYm].cust : 0,
            prev: performanceMap[prevYm].cust > 0 ? performanceMap[prevYm].sales / performanceMap[prevYm].cust : 0,
            prev2: performanceMap[prev2Ym].cust > 0 ? performanceMap[prev2Ym].sales / performanceMap[prev2Ym].cust : 0,
            prevYear: performanceMap[prevYearYm].cust > 0 ? performanceMap[prevYearYm].sales / performanceMap[prevYearYm].cust : 0
        },
        productivity: {
            name: '営業人時売上 (生産性)',
            unit: '円',
            isCurrency: true,
            target: targetSphOp,
            actual: laborMap[targetYm] > 0 ? performanceMap[targetYm].sales / laborMap[targetYm] : 0,
            prev: laborMap[prevYm] > 0 ? performanceMap[prevYm].sales / laborMap[prevYm] : 0,
            prev2: laborMap[prev2Ym] > 0 ? performanceMap[prev2Ym].sales / laborMap[prev2Ym] : 0,
            prevYear: laborMap[prevYearYm] > 0 ? performanceMap[prevYearYm].sales / laborMap[prevYearYm] : 0
        }
    };

    // HTML構築
    container.innerHTML = '';
    
    const kpiKeys = ['sales', 'customers', 'spend', 'productivity'];
    
    kpiKeys.forEach(key => {
        const kpi = kpis[key];
        const val = kpi.actual;
        const tgt = kpi.target;
        
        // 達成率
        const pct = tgt > 0 ? (val / tgt) * 100 : 0;
        const pctText = tgt > 0 ? `${Math.round(pct)}%` : '-';
        const pctClass = pct >= 100 ? 'text-success' : 'text-danger';
        
        // 前月比差分
        const diffPrev = val - kpi.prev;
        const diffPrevText = diffPrev >= 0 ? `+${formatKpiVal(diffPrev, kpi)}` : `-${formatKpiVal(Math.abs(diffPrev), kpi)}`;
        const diffPrevClass = diffPrev >= 0 ? 'mm-up' : 'mm-down';

        // 前年比差分
        const diffYear = val - kpi.prevYear;
        const diffYearText = diffYear >= 0 ? `+${formatKpiVal(diffYear, kpi)}` : `-${formatKpiVal(Math.abs(diffYear), kpi)}`;
        const diffYearClass = diffYear >= 0 ? 'mm-up' : 'mm-down';

        // 3ヶ月平均
        const avg3 = (val + kpi.prev + kpi.prev2) / 3;

        // KPI別アクションリスト
        const kpiActions = (editingMeetingData.actions || []).filter(a => a.kpi_type === key);

        const card = document.createElement('div');
        card.className = 'glass-panel mm-kpi-card';
        card.innerHTML = `
            <div class="mm-kpi-card-header">
                <div>
                    <h3 style="margin:0; font-size:1.15rem; font-weight:900; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                        <span class="mm-kpi-dot ${key}"></span>
                        ${kpi.name}
                    </h3>
                </div>
                <div class="${pctClass}" style="font-size:1.25rem; font-weight:950;">
                    達成率: ${pctText}
                </div>
            </div>

            <div class="mm-kpi-metrics-grid">
                <div class="metric-box">
                    <span class="metric-label">当月実績</span>
                    <strong class="metric-val primary">${formatKpiVal(val, kpi)}${key === 'sales' ? ' /日' : ''}</strong>
                    ${key === 'sales' ? `<span style="font-size:0.65rem; color:var(--text-secondary); margin-top:0.15rem; font-weight:600;">月間合計: ¥${Math.round(kpi.totalActual).toLocaleString()}<br>実営業日数: ${kpi.opDays}日</span>` : ''}
                </div>
                <div class="metric-box">
                    <span class="metric-label">定量目標</span>
                    <strong class="metric-val">${formatKpiVal(tgt, kpi)}${key === 'sales' ? ' /日' : ''}</strong>
                    ${key === 'sales' ? `<span style="font-size:0.65rem; color:var(--text-secondary); margin-top:0.15rem; font-weight:600;">月間合計: ¥${Math.round(kpi.totalTarget).toLocaleString()}<br>予定営業日数: ${kpi.opDaysTarget}日</span>` : ''}
                </div>
                <div class="metric-box">
                    <span class="metric-label">前月実績比</span>
                    <strong class="metric-val ${diffPrevClass}">${diffPrevText}${key === 'sales' ? ' /日' : ''}</strong>
                    <span style="font-size:0.65rem; color:var(--text-secondary);">前月: ${formatKpiVal(kpi.prev, kpi)}${key === 'sales' ? ' /日' : ''}</span>
                </div>
                <div class="metric-box">
                    <span class="metric-label">前年同月比</span>
                    <strong class="metric-val ${diffYearClass}">${diffYearText}${key === 'sales' ? ' /日' : ''}</strong>
                    <span style="font-size:0.65rem; color:var(--text-secondary);">前年: ${formatKpiVal(kpi.prevYear, kpi)}${key === 'sales' ? ' /日' : ''}</span>
                </div>
                <div class="metric-box">
                    <span class="metric-label">直近3ヶ月平均</span>
                    <strong class="metric-val" style="color:var(--text-primary);">${formatKpiVal(avg3, kpi)}${key === 'sales' ? ' /日' : ''}</strong>
                    <span style="font-size:0.65rem; color:var(--text-secondary);">前々月: ${formatKpiVal(kpi.prev2, kpi)}${key === 'sales' ? ' /日' : ''}</span>
                </div>
                
                <!-- トレンドグラフを描画するCanvas -->
                <div class="metric-box" style="justify-content: center; min-width: 140px;">
                    <span class="metric-label" style="margin-bottom:0.2rem;">3ヶ月推移トレンド</span>
                    <canvas id="canvas-trend-${key}" width="140" height="42" style="max-height:42px;"></canvas>
                </div>
            </div>

            <!-- 売上限定：目標達成のロードマップ表示 (1日ギャップ自動ブレイクダウン) -->
            ${key === 'sales' ? renderSalesRoadmap(kpi, kpis.spend.actual || targetAvgSpend, performanceMap[targetYm].cust / opDaysActual) : ''}

            <!-- アクションプランエリア -->
            <div class="mm-actions-area">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border); padding-bottom:0.8rem; margin-bottom:1rem;">
                    <h4 style="margin:0; font-size:0.9rem; font-weight:800; color:var(--text-secondary); display:flex; align-items:center; gap:0.4rem;">
                        <i class="fas fa-tasks"></i> 改善のための具体的な施策
                    </h4>
                    <button class="btn btn-secondary no-print" onclick="window.addNewActionClick('${key}')" style="font-size:0.75rem; padding:0.4rem 1rem; border-radius:20px; font-weight:700;">
                        <i class="fas fa-plus"></i> 施策を追加
                    </button>
                </div>

                <div id="mm-actions-list-${key}" style="display:flex; flex-direction:column; gap:1rem;">
                    ${kpiActions.length === 0 ? `
                        <div style="text-align:center; padding: 1.5rem; background:rgba(0,0,0,0.01); border-radius:10px; border:1px dashed var(--border); font-size:0.8rem; color:var(--text-secondary);">
                            登録されている実行施策はありません。新規施策を追加してください。
                        </div>
                    ` : kpiActions.map(act => renderActionRow(act)).join('')}
                </div>
            </div>
        `;
        container.appendChild(card);

        // canvasにトレンドグラフを描画
        drawTrendGraph(`canvas-trend-${key}`, [kpi.prev2, kpi.prev, val], tgt);
    });
}

function formatKpiVal(val, kpi) {
    if (kpi.isCurrency) {
        return `¥${Math.round(val).toLocaleString()}`;
    }
    return `${Math.round(val).toLocaleString()} ${kpi.unit}`;
}

// -------------------------------------------------------------
// 売上ロードマップレンダラー (売上カードの最下部アドバイス領域)
// -------------------------------------------------------------
function renderSalesRoadmap(salesKpi, currentSpend, currentDailyCust) {
    const gapDaily = salesKpi.target - salesKpi.actual;
    
    if (gapDaily <= 0) {
        return `
            <div class="mm-roadmap-box" style="margin-bottom: 1.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 1.2rem; font-size: 0.85rem; color: #1e293b; line-height: 1.6;">
                <div style="font-weight: 800; color: #15803d; font-size: 0.9rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
                    <i class="fas fa-check-circle"></i> 🎉 素晴らしい！目標を達成しました
                </div>
                <div>
                    今月は見事に営業目標をクリアしています。現在の「1日平均売上 ¥${Math.round(salesKpi.actual).toLocaleString()}」と素晴らしい営業の質を維持・継続し、成功要因を具体的な施策ログとして蓄積しましょう！
                </div>
            </div>
        `;
    }

    // ギャップ自動分析
    const activeDailyCust = currentDailyCust > 0 ? currentDailyCust : (salesKpi.totalActual / 3050 / (salesKpi.opDays || 25)) || 60;
    const activeSpend = currentSpend > 0 ? currentSpend : 3050;

    const spendGap = gapDaily / activeDailyCust;
    const custGap = gapDaily / activeSpend;

    return `
        <div class="mm-roadmap-box" style="margin-bottom: 1.5rem; background: #eff6ff; border: 1px solid rgba(59,130,246,0.15); border-radius: 6px; padding: 1.2rem; font-size: 0.85rem; color: #1e293b; line-height: 1.6;">
            <div style="font-weight: 800; color: #1e40af; font-size: 0.9rem; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
                <i class="fas fa-lightbulb"></i> 🎯 目標達成のロードマップ (日次ギャップ分析)
            </div>
            <div>
                月次目標売上を達成するためには、1日あたりあと <strong style="color:var(--primary); font-size:1.05rem; font-weight:900;">+¥${Math.round(gapDaily).toLocaleString()}円</strong> の売上改善が必要です。<br>
                これを分解すると、以下のいずれかの具体的な施策でクリアできます。
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-top:0.8rem; background:white; padding:0.8rem; border-radius:4px; border:1px solid #e2e8f0;">
                <div>
                    <span style="display:block; color:#64748b; font-size:0.72rem; font-weight:800;">💡 客単価で改善する場合</span>
                    <strong style="color:var(--primary); font-size:1rem; font-weight:900;">客単価を1人あたり あと +${Math.round(spendGap).toLocaleString()}円 向上させる</strong>
                    <span style="display:block; font-size:0.7rem; color:#94a3b8; margin-top:0.15rem;">(現在の1日平均来客数 ${Math.round(activeDailyCust)}名換算)</span>
                </div>
                <div style="border-left:1px solid #f1f5f9; padding-left:1rem;" class="roadmap-sep">
                    <span style="display:block; color:#64748b; font-size:0.72rem; font-weight:800;">💡 集客数で改善する場合</span>
                    <strong style="color:var(--primary); font-size:1rem; font-weight:900;">1日の来客数を あと +${Math.round(custGap * 10) / 10}名 増加させる</strong>
                    <span style="display:block; font-size:0.7rem; color:#94a3b8; margin-top:0.15rem;">(現在の客単価 ¥${Math.round(activeSpend).toLocaleString()}換算)</span>
                </div>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------
// トレンドグラフの描画 (Canvas API を用いた動的レンダリング)
// -------------------------------------------------------------
function drawTrendGraph(canvasId, dataPoints, targetVal) {
    setTimeout(() => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.clearRect(0, 0, w, h);

        const paddingLeft = 10;
        const paddingRight = 10;
        const paddingTop = 5;
        const paddingBottom = 5;

        // すべてが0の場合は直線を描く
        const maxVal = Math.max(...dataPoints, targetVal) || 1;
        const minVal = Math.min(...dataPoints, targetVal) || 0;
        const range = maxVal - minVal || 1;

        const getX = (index) => paddingLeft + (index / (dataPoints.length - 1)) * (w - paddingLeft - paddingRight);
        const getY = (value) => h - paddingBottom - ((value - minVal) / range) * (h - paddingTop - paddingBottom);

        // 1. 目標線の描画 (破線)
        ctx.strokeStyle = 'rgba(230, 57, 70, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, getY(targetVal));
        ctx.lineTo(w, getY(targetVal));
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. 推移線の描画
        ctx.strokeStyle = 'var(--secondary)';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(dataPoints[0]));
        for (let i = 1; i < dataPoints.length; i++) {
            ctx.lineTo(getX(i), getY(dataPoints[i]));
        }
        ctx.stroke();

        // 3. 各ポイントのドット描画
        ctx.fillStyle = 'var(--secondary)';
        for (let i = 0; i < dataPoints.length; i++) {
            ctx.beginPath();
            ctx.arc(getX(i), getY(dataPoints[i]), 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 最終月のドットを目立たせる
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(getX(dataPoints.length - 1), getY(dataPoints[dataPoints.length - 1]), 4.5, 0, Math.PI * 2);
        ctx.stroke();
    }, 100);
}

// -------------------------------------------------------------
// 個別のアクションカードのレンダリング (HTML)
// -------------------------------------------------------------
function renderActionRow(act) {
    const isCompleted = act.status === 'completed';
    return `
        <div class="mm-action-item-panel ${isCompleted ? 'completed' : ''}" id="action-panel-${act.id}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; border-bottom:1px solid #f1f5f9; padding-bottom:0.6rem; margin-bottom:0.8rem;">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    <span class="mm-badge" style="background:#eff6ff; color:#3b82f6; border:1px solid rgba(59,130,246,0.15);">${act.category}</span>
                    <strong style="font-size:0.95rem; color:var(--text-primary); font-weight:800;">${act.action_name}</strong>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;" class="no-print">
                    <button class="btn" onclick="window.toggleActionStatusClick('${act.id}')" style="background:${isCompleted ? '#f1f5f9' : '#ecfdf5'}; color:${isCompleted ? '#64748b' : '#10b981'}; font-size:0.7rem; padding:0.25rem 0.6rem; border-radius:6px; font-weight:800; border:none; display:flex; align-items:center; gap:0.2rem;">
                        <i class="fas ${isCompleted ? 'fa-undo' : 'fa-check'}"></i> ${isCompleted ? '振り返りを修正' : '完了・振り返る'}
                    </button>
                    <button class="btn" onclick="window.deleteActionClick('${act.id}')" style="background:#fff5f5; color:#f87171; font-size:0.7rem; padding:0.25rem 0.4rem; border-radius:6px; border:none;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>

            <!-- PDCA内容 -->
            <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:1.5rem; font-size:0.82rem; line-height:1.5; color:#475569;">
                <!-- 左側: Plan & Do (仮説 & 実行) -->
                <div style="border-right: 1px dashed #e2e8f0; padding-right:1rem;">
                    <div><span style="font-weight:800; color:#1e293b; display:block; margin-bottom:0.2rem;">[実行予定内容]</span> ${act.details ? act.details.replace(/\n/g, '<br>') : '未記入'}</div>
                    <div style="margin-top:0.6rem;"><span style="font-weight:800; color:#1e293b;">[想定効果]:</span> <strong>+${act.expected_effect || 0}</strong></div>
                </div>

                <!-- 右側: Check & Action (検証 & 改善案) -->
                <div>
                    ${isCompleted ? `
                        <div><span style="font-weight:800; color:#10b981; display:block; margin-bottom:0.2rem;">[結果・振り返り]</span> ${act.result_comment ? act.result_comment.replace(/\n/g, '<br>') : '未記入'}</div>
                        <div style="margin-top:0.4rem;"><span style="font-weight:800; color:#10b981;">[結果効果]:</span> <strong>+${act.actual_effect || 0}</strong></div>
                        <div style="margin-top:0.6rem;"><span style="font-weight:800; color:#3b82f6; display:block; margin-bottom:0.2rem;">[次回改善案]</span> ${act.next_action ? act.next_action.replace(/\n/g, '<br>') : '未記入'}</div>
                    ` : `
                        <div style="text-align:center; padding:1.2rem; background:#f8fafc; border-radius:8px; border:1px solid #f1f5f9; color:#94a3b8; font-weight:700;">
                            <i class="fas fa-clock" style="display:block; font-size:1.2rem; margin-bottom:0.3rem;"></i>
                            月末振り返り待ち
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------
// 施策のインタラクティブなイベント処理 (メモリ更新 ＆ 再描画)
// -------------------------------------------------------------

// 1. 施策の新規追加モーダル
window.addNewActionClick = (kpiKey) => {
    const modalId = 'mm-action-modal-new';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:10005; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(4px);';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="glass-panel animate-scale-in" style="background:white; padding:2rem; border-radius:6px; width:90%; max-width:480px; border: 1px solid var(--border); box-shadow: var(--shadow-lg);">
            <h3 style="margin-top:0; color:var(--text-primary); font-weight:900; font-size:1.15rem; border-bottom:1px solid var(--border); padding-bottom:0.6rem; margin-bottom:1.2rem;">新規実行施策の登録</h3>
            
            <div class="input-group" style="margin-bottom:1rem;">
                <label style="display:block; margin-bottom:0.3rem; font-weight:800; font-size:0.75rem; color:#64748b;">施策名 (仮説)</label>
                <input type="text" id="new-act-name" class="mm-input" style="width:100%; padding:0.7rem; border-radius:8px; border:1px solid var(--border); font-size:0.85rem;" placeholder="例: 日本酒おすすめPOP設置">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                <div class="input-group">
                    <label style="display:block; margin-bottom:0.3rem; font-weight:800; font-size:0.75rem; color:#64748b;">施策カテゴリ</label>
                    <select id="new-act-cat" class="mm-input" style="width:100%; padding:0.7rem; border-radius:8px; border:1px solid var(--border); font-size:0.85rem;">
                        ${ACTION_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label style="display:block; margin-bottom:0.3rem; font-weight:800; font-size:0.75rem; color:#64748b;">想定される効果 (数値)</label>
                    <input type="number" id="new-act-expect" class="mm-input" style="width:100%; padding:0.7rem; border-radius:8px; border:1px solid var(--border); font-size:0.85rem; text-align:right;" placeholder="50">
                </div>
            </div>

            <div class="input-group" style="margin-bottom:1.5rem;">
                <label style="display:block; margin-bottom:0.3rem; font-weight:800; font-size:0.75rem; color:#64748b;">実施内容</label>
                <textarea id="new-act-details" class="mm-input" rows="3" style="width:100%; border-radius:8px; border:1px solid var(--border); padding:0.7rem; font-size:0.85rem;" placeholder="誰が、いつまでに、何を、どのように取り組むか具体的に記載"></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:1rem; border-top:1px solid var(--border); padding-top:1rem;">
                <button class="btn" onclick="document.getElementById('${modalId}').style.display='none'" style="background:#f1f5f9; color:#475569; font-weight:700; border-radius:8px; font-size:0.8rem; padding:0.5rem 1rem;">キャンセル</button>
                <button id="btn-save-new-act" class="btn btn-primary" style="font-weight:900; border-radius:8px; font-size:0.8rem; padding:0.5rem 1.2rem;">施策を追加する</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    document.getElementById('btn-save-new-act').onclick = () => {
        const name = document.getElementById('new-act-name').value.trim();
        const cat = document.getElementById('new-act-cat').value;
        const expect = parseInt(document.getElementById('new-act-expect').value) || 0;
        const details = document.getElementById('new-act-details').value.trim();

        if (!name) return alert("施策名を入力してください");

        const newAction = {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            kpi_type: kpiKey,
            category: cat,
            action_name: name,
            details: details,
            expected_effect: expect,
            result_comment: '',
            actual_effect: 0,
            next_action: '',
            status: 'active'
        };

        if (!editingMeetingData.actions) editingMeetingData.actions = [];
        editingMeetingData.actions.push(newAction);

        modal.style.display = 'none';
        buildKpiPdcaBoards(); // 再描画
    };
};

// 2. 施策のステータス切り替え ＆ 振り返り入力
window.toggleActionStatusClick = (actionId) => {
    const actIdx = editingMeetingData.actions.findIndex(a => a.id === actionId);
    if (actIdx === -1) return;

    const act = editingMeetingData.actions[actIdx];

    if (act.status === 'completed') {
        // すでに完了している場合は、「下書き/実行中」に戻す確認
        if (confirm("この施策を『実行中 (振り返り待ち)』に戻しますか？")) {
            act.status = 'active';
            buildKpiPdcaBoards();
        }
        return;
    }

    // 振り返りの入力モーダルを立ち上げる
    const modalId = 'mm-action-modal-reflect';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:10005; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(4px);';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="glass-panel animate-scale-in" style="background:white; padding:2rem; border-radius:6px; width:90%; max-width:480px; border: 1px solid var(--border); box-shadow: var(--shadow-lg);">
            <h3 style="margin-top:0; color:var(--text-primary); font-weight:900; font-size:1.15rem; border-bottom:1px solid var(--border); padding-bottom:0.6rem; margin-bottom:1.2rem;">施策の振り返り (Check & Action)</h3>
            
            <div style="background:#eff6ff; border-radius:8px; padding:0.8rem; border:1px solid rgba(59,130,246,0.1); margin-bottom:1.2rem; font-size:0.82rem;">
                <span style="display:block; color:#94a3b8; font-weight:700; font-size:0.7rem; margin-bottom:0.2rem;">対象施策</span>
                <strong style="color:var(--text-primary); font-size:0.9rem;">${act.action_name}</strong>
                <p style="margin:0.4rem 0 0; color:#475569;">想定効果: <strong>+${act.expected_effect || 0}</strong></p>
            </div>

            <div class="input-group" style="margin-bottom:1rem;">
                <label style="display:block; margin-bottom:0.3rem; font-weight:800; font-size:0.75rem; color:#64748b;">実際の結果・定量効果 (数値)</label>
                <input type="number" id="reflect-act-actual" class="mm-input" style="width:100%; padding:0.7rem; border-radius:8px; border:1px solid var(--border); font-size:0.85rem; text-align:right;" value="${act.actual_effect || ''}" placeholder="35">
            </div>

            <div class="input-group" style="margin-bottom:1rem;">
                <label style="display:block; margin-bottom:0.3rem; font-weight:800; font-size:0.75rem; color:#64748b;">結果と要因の振り返り (定性)</label>
                <textarea id="reflect-act-comment" class="mm-input" rows="3" style="width:100%; border-radius:8px; border:1px solid var(--border); font-size:0.85rem;" placeholder="計画通りに進んだか、未達要因または成功要因は何だったか">${act.result_comment || ''}</textarea>
            </div>

            <div class="input-group" style="margin-bottom:1.5rem;">
                <label style="display:block; margin-bottom:0.3rem; font-weight:800; font-size:0.75rem; color:#64748b;">次回改善案 (翌月へ自動コピーされます)</label>
                <textarea id="reflect-act-next" class="mm-input" rows="2" style="width:100%; border-radius:8px; border:1px solid var(--border); padding:0.7rem; font-size:0.85rem;" placeholder="今回の学びを活かして、次はどこを改善・調整するか">${act.next_action || ''}</textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:1rem; border-top:1px solid var(--border); padding-top:1rem;">
                <button class="btn" onclick="document.getElementById('${modalId}').style.display='none'" style="background:#f1f5f9; color:#475569; font-weight:700; border-radius:8px; font-size:0.8rem; padding:0.5rem 1rem;">閉じる</button>
                <button id="btn-save-reflect" class="btn btn-primary" style="font-weight:900; border-radius:8px; font-size:0.8rem; padding:0.5rem 1.2rem; background:#10b981; border-color:#10b981;">振り返りを確定する</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    document.getElementById('btn-save-reflect').onclick = () => {
        const actual = parseInt(document.getElementById('reflect-act-actual').value) || 0;
        const comment = document.getElementById('reflect-act-comment').value.trim();
        const next = document.getElementById('reflect-act-next').value.trim();

        act.actual_effect = actual;
        act.result_comment = comment;
        act.next_action = next;
        act.status = 'completed'; // 完了ステータスへ

        modal.style.display = 'none';
        buildKpiPdcaBoards(); // 再描画
    };
};

// 3. 施策の削除
window.deleteActionClick = (actionId) => {
    if (confirm("この施策を削除してもよろしいですか？（※保存ボタンを押すまで最終確定はされません）")) {
        editingMeetingData.actions = editingMeetingData.actions.filter(a => a.id !== actionId);
        buildKpiPdcaBoards();
    }
};

// -------------------------------------------------------------
// 保存 ＆ データベース通信処理
// -------------------------------------------------------------

async function loadArchiveList() {
    const listContainer = document.getElementById('mm-archive-list');
    if (!listContainer) return;

    try {
        const snap = await getDocs(query(collection(db, "t_manager_meetings"), orderBy("target_month", "desc")));
        if (snap.empty) {
            listContainer.innerHTML = '<p style="text-align:center; padding:3rem; color:var(--text-secondary);">過去の提出データはありません</p>';
            return;
        }

        let html = '';
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const dateStr = d.updated_at ? new Date(d.updated_at).toLocaleDateString('ja-JP') : '-';
            const actionCount = d.actions ? d.actions.length : 0;
            const completedCount = d.actions ? d.actions.filter(a => a.status === 'completed').length : 0;

            html += `
                <div class="glass-panel" style="padding: 1.2rem 1.8rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; border-radius: 6px;"
                     onclick="window.openMeeting('${docSnap.id}')"
                     onmouseover="this.style.borderColor='var(--primary)'; this.style.boxShadow='var(--shadow-sm)';"
                     onmouseout="this.style.borderColor='var(--border)'; this.style.boxShadow='none';">
                    <div>
                        <h4 style="margin:0; font-size:1.15rem; color:var(--text-primary); font-weight:800; display:flex; align-items:center; gap:0.5rem;">
                            ${d.store_name} - ${d.target_month.split('-')[0]}年${parseInt(d.target_month.split('-')[1])}月度
                        </h4>
                        <p style="margin:0.3rem 0 0; font-size:0.8rem; color:var(--text-secondary); font-weight:500;">
                            記入者: ${d.author_name} | 最終更新: ${dateStr} | 登録施策数: ${actionCount}件 (振り返り済: ${completedCount}件)
                        </p>
                    </div>
                    <div>
                        <span style="background:${d.status === '提出済み' ? 'var(--primary)' : '#e2e8f0'}; color:${d.status === '提出済み' ? 'white' : '#475569'}; padding:0.4rem 1rem; border-radius:20px; font-size:0.78rem; font-weight:800; border:1px solid rgba(0,0,0,0.02);">
                            ${d.status || '下書き'}
                        </span>
                    </div>
                </div>
            `;
        });
        
        listContainer.innerHTML = html;
        
        window.openMeeting = async (docId) => {
            const docRef = await getDoc(doc(db, "t_manager_meetings", docId));
            if (docRef.exists()) {
                editingMeetingData = { id: docId, ...docRef.data() };
                currentTargetStore = editingMeetingData.store_id;
                currentTargetMonth = editingMeetingData.target_month;
                currentMeetingView = 'form';
                renderMeetingView();
            }
        };

    } catch (e) {
        console.error("Failed to load archive:", e);
        listContainer.innerHTML = '<p style="text-align:center; color:var(--danger); font-weight:700;">データの読み込みに失敗しました。</p>';
    }
}

async function saveMeetingData() {
    const btn = document.getElementById('btn-save-meeting');
    if (!btn) return;
    
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    btn.disabled = true;

    try {
        const user = window.appState ? window.appState.currentUser : null;
        
        // 定性フォームの取得
        const eduText = document.getElementById('mm-input-edu').value;
        const hosText = document.getElementById('mm-input-hos').value;
        const opeText = document.getElementById('mm-input-ope').value;

        const recText = document.getElementById('mm-input-rec').value;
        const retText = document.getElementById('mm-input-ret').value;
        const visaText = document.getElementById('mm-input-visa').value;
        const trainText = document.getElementById('mm-input-train').value;

        // メモリ内データをアップデート
        editingMeetingData.free_targets = {
            education: eduText,
            hospitality: hosText,
            operation: opeText
        };
        
        editingMeetingData.hr_sharing = {
            recruitment_plan: recText,
            retirement_concern: retText,
            visa_check: visaText,
            training_status: trainText
        };

        editingMeetingData.status = '提出済み'; // 保存時は自動で提出状態へ
        editingMeetingData.updated_at = new Date().toISOString();

        if (user) {
            editingMeetingData.author_id = user.id || editingMeetingData.author_id;
            editingMeetingData.author_name = user.Name || editingMeetingData.author_name;
        }

        const docId = `${editingMeetingData.store_id}_${editingMeetingData.target_month}`;
        
        // Firestore への保存実行
        await setDoc(doc(db, "t_manager_meetings", docId), editingMeetingData);
        
        showAlert("店舗PDCAボードを正常に保存・提出しました！", "success");
        
        currentMeetingView = 'archive';
        editingMeetingData = null;
        renderMeetingView();

    } catch (e) {
        console.error("Save failed:", e);
        showAlert("保存に失敗しました。接続状況を確認してください。", "danger");
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}
