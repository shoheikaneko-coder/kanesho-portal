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
            <p>※ 過去の会議データ一覧（開発中）</p>
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

            <!-- More sections will be added here -->
        </div>
    `;

    document.getElementById('btn-back-archive').onclick = () => {
        currentMeetingView = 'archive';
        renderMeetingView();
    };

    document.getElementById('btn-print-meeting').onclick = () => {
        window.print();
    };

    // 初期データ投入
    initializeFormBasicInfo();
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

    // 今後ここにKPIデータの取得処理を追加
    document.getElementById('mm-kpi-tbody').innerHTML = \`
        <tr>
            <td>売上</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
        </tr>
    \`;
}
