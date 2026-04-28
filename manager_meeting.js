import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, getDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let currentMeetingView = 'archive'; // 'archive' | 'form'
let editingMeetingData = null;
let currentTargetMonth = '';
let currentTargetStore = '';

export const managerMeetingPageHtml = `
    <div id="manager-meeting-container" class="manager-meeting-container animate-fade-in">
        <!-- Content will be injected here -->
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

async function renderArchiveView(container) {
    container.innerHTML = `
        <div class="mm-header no-print">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-file-signature" style="color: var(--primary);"></i>
                    店長会議資料アーカイブ
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem;">過去の会議資料の振り返りと新規作成</p>
            </div>
            <button id="btn-create-meeting" class="btn btn-primary" style="padding: 0.8rem 1.5rem; font-weight: 700;">
                <i class="fas fa-plus"></i> 新規資料作成
            </button>
        </div>

        <div class="mm-card no-print">
            <div id="mm-archive-list" class="mm-grid" style="gap: 1rem; display: flex; flex-direction: column;">
                <p style="text-align:center; padding: 2rem;">読込中...</p>
            </div>
        </div>

        <!-- 新規作成モーダル -->
        <div id="mm-create-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; justify-content:center; align-items:center;">
            <div class="glass-panel animate-fade-in" style="background:white; padding:2rem; border-radius:12px; width:90%; max-width:400px;">
                <h3 style="margin-top:0; color:var(--text-primary);">新規作成</h3>
                <div class="input-group">
                    <label>対象店舗</label>
                    <select id="mm-select-store" class="mm-input">
                        <option value="">読込中...</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>対象月</label>
                    <input type="month" id="mm-select-month" class="mm-input">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:1.5rem;">
                    <button id="btn-cancel-modal" class="btn" style="background:#f1f5f9;">キャンセル</button>
                    <button id="btn-confirm-create" class="btn btn-primary">作成開始</button>
                </div>
            </div>
        </div>
    `;

    const modal = document.getElementById('mm-create-modal');
    
    // 過去のデータを読み込み
    loadArchiveList();
    
    document.getElementById('btn-create-meeting').onclick = async () => {
        modal.style.display = 'flex';
        // 今月をデフォルトセット
        const now = new Date();
        document.getElementById('mm-select-month').value = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}\`;
        
        // 店舗リスト取得
        const storeSelect = document.getElementById('mm-select-store');
        if (storeSelect.options.length <= 1) {
            try {
                const snap = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
                storeSelect.innerHTML = '';
                snap.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.data().store_id;
                    opt.textContent = d.data().store_name;
                    storeSelect.appendChild(opt);
                });
                
                // ログインユーザーの店舗をデフォルト選択
                if (window.state && window.state.currentUser) {
                    storeSelect.value = window.state.currentUser.StoreID || window.state.currentUser.StoreId;
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

    document.getElementById('btn-confirm-create').onclick = () => {
        const store = document.getElementById('mm-select-store').value;
        const month = document.getElementById('mm-select-month').value;
        if (!store || !month) return alert("店舗と月を選択してください");
        
        currentTargetStore = store;
        currentTargetMonth = month;
        currentMeetingView = 'form';
        editingMeetingData = null;
        renderMeetingView();
    };

}

async function renderFormView(container) {
    container.innerHTML = `
        <div class="mm-header no-print">
            <button id="btn-back-archive" class="btn" style="background: white; border: 1px solid var(--border);">
                <i class="fas fa-arrow-left"></i> 戻る
            </button>
            <div style="display: flex; gap: 1rem;">
                <button id="btn-print-meeting" class="btn" style="background: white; border: 1px solid var(--primary); color: var(--primary); font-weight: 700;">
                    <i class="fas fa-print"></i> 印刷 / PDF保存
                </button>
                <button id="btn-save-meeting" class="btn btn-primary" style="font-weight: 700;">
                    <i class="fas fa-save"></i> 提出・保存
                </button>
            </div>
        </div>

        <div id="mm-printable-area">
            <h1 style="text-align: center; margin-bottom: 2rem; color: #1e293b; font-size: 1.5rem;">
                <span id="display-store-name">店舗名</span> 店長会議資料 (<span id="display-target-month">2026年4月度</span>)
            </h1>

            <div class="mm-card">
                <div class="mm-section-title"><i class="fas fa-info-circle"></i> 基本情報</div>
                <div class="mm-grid mm-grid-3">
                    <div><span class="mm-label">作成者</span><div class="mm-value" id="display-author">読込中...</div></div>
                    <div><span class="mm-label">作成日</span><div class="mm-value" id="display-date">読込中...</div></div>
                    <div><span class="mm-label">ステータス</span><div class="mm-value" id="display-status">下書き</div></div>
                </div>
            </div>

            <div class="mm-card">
                <div class="mm-section-title"><i class="fas fa-chart-bar"></i> KPI サマリー (自動集計)</div>
                <table class="mm-kpi-table">
                    <thead>
                        <tr>
                            <th>項目</th>
                            <th>目標</th>
                            <th>実績</th>
                            <th>達成率</th>
                            <th>前月実績</th>
                            <th>前月比</th>
                        </tr>
                    </thead>
                    <tbody id="mm-kpi-tbody">
                        <tr><td colspan="6" style="text-align:center;">読込中...</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- PDCA 入力セクション -->
            <div class="mm-card">
                <div class="mm-section-title"><i class="fas fa-sync-alt"></i> 今月の振り返り (PDCA)</div>
                <div class="input-group" style="margin-bottom: 1.5rem;">
                    <label>先月の課題に対する今月の取り組み結果 (Check & Action)</label>
                    <textarea id="mm-input-review" class="mm-input" rows="4" placeholder="先月立てた改善策がどうだったか、結果と要因を記載してください"></textarea>
                </div>
                <div class="input-group">
                    <label>今月の新たな課題と要因分析 (Plan)</label>
                    <textarea id="mm-input-issues" class="mm-input" rows="4" placeholder="今月目標未達だった項目や、新たに見つかった課題とその原因を記載してください"></textarea>
                </div>
            </div>

            <div class="mm-card">
                <div class="mm-section-title"><i class="fas fa-forward"></i> 次月への改善計画</div>
                <div class="input-group" style="margin-bottom: 1.5rem;">
                    <label>次月の具体的な改善アクション (Do)</label>
                    <textarea id="mm-input-action" class="mm-input" rows="4" placeholder="誰が、いつまでに、何をするか具体的に記載してください"></textarea>
                </div>
                <div class="input-group">
                    <label>本部に共有したい事項・要望事項等 (任意)</label>
                    <textarea id="mm-input-requests" class="mm-input" rows="3" placeholder="備品の不足、ルールの改善要望など"></textarea>
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

    // 初期データ投入
    await initializeFormBasicInfo();
    
    // 編集モードならデータ復元
    if (editingMeetingData) {
        document.getElementById('mm-input-review').value = editingMeetingData.review_text || '';
        document.getElementById('mm-input-issues').value = editingMeetingData.issues_text || '';
        document.getElementById('mm-input-action').value = editingMeetingData.action_text || '';
        document.getElementById('mm-input-requests').value = editingMeetingData.requests_text || '';
    }
}

async function initializeFormBasicInfo() {
    const user = window.state ? window.state.currentUser : null;
    const authorName = user ? (user.Name || '不明') : '不明';
    const today = new Date().toLocaleDateString('ja-JP');

    document.getElementById('display-author').textContent = authorName;
    document.getElementById('display-date').textContent = today;
    document.getElementById('display-status').textContent = '下書き';
    
    // YYYY-MM から YYYY年M月度 へ変換
    const [y, m] = currentTargetMonth.split('-');
    document.getElementById('display-target-month').textContent = \`\${y}年\${parseInt(m)}月度\`;

    // 店舗名取得
    try {
        const snap = await getDocs(query(collection(db, "m_stores"), where("store_id", "==", currentTargetStore)));
        if (!snap.empty) {
            document.getElementById('display-store-name').textContent = snap.docs[0].data().store_name;
        } else {
            document.getElementById('display-store-name').textContent = currentTargetStore;
        }
    } catch(e) {
        document.getElementById('display-store-name').textContent = currentTargetStore;
    }

    // KPIデータの取得処理を追加
    await fetchMeetingData(y, m);
}

// ==========================================
// アーカイブ・保存処理
// ==========================================

async function loadArchiveList() {
    const listContainer = document.getElementById('mm-archive-list');
    if (!listContainer) return;

    try {
        const snap = await getDocs(query(collection(db, "t_manager_meetings"), orderBy("target_month", "desc")));
        if (snap.empty) {
            listContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">過去の会議資料はありません</p>';
            return;
        }

        let html = '';
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const dateStr = new Date(d.created_at).toLocaleDateString('ja-JP');
            html += \`
                <div class="glass-panel" style="padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;"
                     onclick="window.openMeeting('\${docSnap.id}')"
                     onmouseover="this.style.borderColor='var(--primary)'"
                     onmouseout="this.style.borderColor='rgba(255,255,255,0.4)'">
                    <div>
                        <h4 style="margin:0; font-size:1.1rem; color:var(--text-primary);">\${d.store_name} - \${d.target_month}度</h4>
                        <p style="margin:0.2rem 0 0; font-size:0.8rem; color:var(--text-secondary);">作成者: \${d.author_name} | 最終更新: \${dateStr}</p>
                    </div>
                    <div>
                        <span style="background:var(--primary); color:white; padding:0.3rem 0.8rem; border-radius:20px; font-size:0.8rem; font-weight:600;">\${d.status || '下書き'}</span>
                    </div>
                </div>
            \`;
        });
        
        listContainer.innerHTML = html;
        
        // グローバルに関数を登録してクリックで開けるようにする
        window.openMeeting = async (docId) => {
            const docRef = await getDoc(doc(db, "t_manager_meetings", docId));
            if (docRef.exists()) {
                const data = docRef.data();
                editingMeetingData = { ...data, id: docId };
                currentTargetStore = data.store_id;
                currentTargetMonth = data.target_month;
                currentMeetingView = 'form';
                renderMeetingView();
            }
        };

    } catch (e) {
        console.error("Failed to load archive:", e);
        listContainer.innerHTML = '<p style="text-align:center; color:var(--danger);">データの読み込みに失敗しました</p>';
    }
}

async function saveMeetingData() {
    const btn = document.getElementById('btn-save-meeting');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    btn.disabled = true;

    try {
        const user = window.state ? window.state.currentUser : null;
        
        const storeName = document.getElementById('display-store-name').textContent;
        const authorName = document.getElementById('display-author').textContent;
        const reviewText = document.getElementById('mm-input-review').value;
        const issuesText = document.getElementById('mm-input-issues').value;
        const actionText = document.getElementById('mm-input-action').value;
        const requestsText = document.getElementById('mm-input-requests').value;
        
        // 保存するデータ
        const saveData = {
            store_id: currentTargetStore,
            store_name: storeName,
            target_month: currentTargetMonth,
            author_id: user ? user.id : 'unknown',
            author_name: authorName,
            review_text: reviewText,
            issues_text: issuesText,
            action_text: actionText,
            requests_text: requestsText,
            status: '提出済み', // とりあえず固定
            updated_at: new Date().toISOString()
        };

        if (!editingMeetingData) {
            saveData.created_at = new Date().toISOString();
        } else {
            saveData.created_at = editingMeetingData.created_at || new Date().toISOString();
        }

        // ドキュメントID: 店舗ID_年月 (一店舗一月に一つ)
        const docId = editingMeetingData ? editingMeetingData.id : \`\${currentTargetStore}_\${currentTargetMonth}\`;
        
        await setDoc(doc(db, "t_manager_meetings", docId), saveData);
        
        showAlert("会議資料を保存・提出しました！", "success");
        
        // アーカイブに戻る
        currentMeetingView = 'archive';
        renderMeetingView();

    } catch (e) {
        console.error("Save failed:", e);
        showAlert("保存に失敗しました", "danger");
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

const TAX_RATE = 1.1;

async function fetchMeetingData(year, monthStr) {
    const month = parseInt(monthStr);
    const targetYm = \`\${year}-\${String(month).padStart(2, '0')}\`;
    
    // 前月の計算
    let prevY = year;
    let prevM = month - 1;
    if (prevM === 0) { prevM = 12; prevY--; }
    const prevYm = \`\${prevY}-\${String(prevM).padStart(2, '0')}\`;

    const storeId = currentTargetStore;

    // ----- 1. 実績の集計 (売上, 客数) -----
    const pSnap = await getDocs(query(collection(db, "t_performance"), where("store_id", "==", storeId)));
    
    let currentSales = 0;
    let prevSales = 0;

    pSnap.forEach(doc => {
        const d = doc.data();
        const normDate = (d.date || "").replace(/\//g, '-').replace(/\./g, '-');
        const ym = d.year_month || normDate.substring(0, 7);
        const amount = (d.amount || d.Amount || d['売上税込'] || 0) / TAX_RATE; // 税抜換算

        if (ym === targetYm) currentSales += amount;
        if (ym === prevYm) prevSales += amount;
    });

    // ----- 2. 人時の集計 (勤怠) -----
    // 簡易版: t_attendance のインポート済 total_labor_hours を優先
    const aSnap = await getDocs(collection(db, "t_attendance"));
    let currentOpHours = 0;
    let prevOpHours = 0;

    aSnap.forEach(doc => {
        const d = doc.data();
        const isImported = (d.total_labor_hours !== undefined || d.TotalLaborHours !== undefined);
        if (!isImported) return; // 詳細な打刻の集計は重いため、いったんインポートされた合計値を使う

        const sid = String(d.store_id || d.StoreID || "").trim();
        if (sid !== storeId) return;

        const rawYm = d.year_month || d.YearMonth || String(d.timestamp || d.date).substring(0, 7);
        const ym = String(rawYm).replace(/\//g, '-');
        const h = Number(d.total_labor_hours || d.TotalLaborHours || 0);

        if (ym === targetYm) currentOpHours += h;
        if (ym === prevYm) prevOpHours += h;
    });

    // ----- 3. 目標の取得 -----
    let targetSales = 0;
    let targetSphOp = 0;
    
    try {
        const goalSnap = await getDoc(doc(db, "t_monthly_goals", \`\${targetYm}_\${storeId}\`));
        if (goalSnap.exists()) {
            targetSales = Number(goalSnap.data().sales_target || 0);
        }
        
        // 年間予算から人時目標
        let fy = year;
        if (month < 3) fy = year - 1; // かね将の会計年度が3月始まりと仮定 (ダッシュボードロジック準拠)
        const bSnap = await getDoc(doc(db, "m_annual_budgets", \`\${fy}_\${storeId}\`));
        if (bSnap.exists()) {
            targetSphOp = Number(bSnap.data().target_sales_per_hour_op || 0);
        }
    } catch(e) { console.error(e); }

    const targetOpHours = targetSphOp > 0 ? targetSales / targetSphOp : 0;

    // ----- 4. 人時売上の計算 -----
    const currentSph = currentOpHours > 0 ? currentSales / currentOpHours : 0;
    const prevSph = prevOpHours > 0 ? prevSales / prevOpHours : 0;

    // ----- テーブル描画 -----
    const tbody = document.getElementById('mm-kpi-tbody');
    tbody.innerHTML = \`
        <tr>
            <td>売上 (税抜)</td>
            <td>¥\${Math.round(targetSales).toLocaleString()}</td>
            <td>¥\${Math.round(currentSales).toLocaleString()}</td>
            <td>\${targetSales > 0 ? Math.round((currentSales / targetSales)*100) : '-'}%</td>
            <td>¥\${Math.round(prevSales).toLocaleString()}</td>
            <td>\${prevSales > 0 ? Math.round((currentSales / prevSales)*100) : '-'}%</td>
        </tr>
        <tr>
            <td>営業人時</td>
            <td>\${Math.round(targetOpHours).toLocaleString()} h</td>
            <td>\${Math.round(currentOpHours).toLocaleString()} h</td>
            <td>\${targetOpHours > 0 ? Math.round((currentOpHours / targetOpHours)*100) : '-'}%</td>
            <td>\${Math.round(prevOpHours).toLocaleString()} h</td>
            <td>\${prevOpHours > 0 ? Math.round((currentOpHours / prevOpHours)*100) : '-'}%</td>
        </tr>
        <tr>
            <td>人時売上</td>
            <td>¥\${Math.round(targetSphOp).toLocaleString()}</td>
            <td>¥\${Math.round(currentSph).toLocaleString()}</td>
            <td>\${targetSphOp > 0 ? Math.round((currentSph / targetSphOp)*100) : '-'}%</td>
            <td>¥\${Math.round(prevSph).toLocaleString()}</td>
            <td>\${prevSph > 0 ? Math.round((currentSph / prevSph)*100) : '-'}%</td>
        </tr>
    \`;
}
