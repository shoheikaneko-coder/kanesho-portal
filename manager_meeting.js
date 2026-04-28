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
    `;

    document.getElementById('btn-create-meeting').onclick = () => {
        // 仮で即作成画面へ遷移（後で店舗・月の選択モーダルを入れる）
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
}
