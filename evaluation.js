import { db } from './firebase.js';
import { collection, getDocs, getDoc, setDoc, updateDoc, doc, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let localPeriodSettings = null; // 現在の評価期設定
let activeEvaluations = [];    // 人事・店長向けの今期の評価リスト
let myEvaluation = null;        // 自分自身の今期の評価データ
let subordinateUsers = [];      // 評価対象の部下リスト
let evaluationTemplates = {};   // ロードされたテンプレート
let activeTab = 'self';         // 表示中のタブ ('self', 'subordinates', 'admin', 'president')
let selectedEvalDetail = null;  // モーダル表示中の評価詳細オブジェクト

let editTemplates = {};        // 編集モーダル用のテンプレート一時保存バッファ
let activeEditTemplateId = ''; // 編集中のテンプレートID
let activeEditItems = [];      // 編集中の項目リスト
let allStaffUsersForAdmin = []; // 管理者タブの評価対象者選択用
let globalStoreMapForEval = {}; // 店舗ID -> 店舗名のマッピング

export const evaluationPageHtml = `
    <div id="evaluation-page-container" class="animate-fade-in" style="padding: 1rem 1.5rem; max-width: 1200px; margin: 0 auto; box-sizing: border-box; font-family: inherit;">
        
        <!-- ヘッダーエリア -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;" class="no-print">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem; font-size: 1.5rem; font-weight: 900; color: var(--text-primary);">
                    <i class="fas fa-star" style="color: #ec4899;"></i>
                    人事評価システム
                </h2>
                <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.3rem; font-weight: 600;">
                    年に4回の評価ワークフロー（仮評価・本評価）を一元管理し、成長と等級判定をサポートします
                </p>
            </div>
            <div style="display: flex; gap: 0.6rem; align-items: center;">
                <button class="btn" id="btn-eval-back" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); font-weight: 700; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem;">
                    <i class="fas fa-arrow-left"></i> 人事総務へ戻る
                </button>
            </div>
        </div>

        <!-- 評価期インフォバナー -->
        <div id="eval-period-banner" class="glass-panel" style="padding: 1rem 1.5rem; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                    <i class="fas fa-bullhorn"></i>
                </div>
                <div>
                    <h4 id="banner-period-title" style="margin: 0; color: #92400e; font-size: 0.95rem; font-weight: 800;">読み込み中...</h4>
                    <p id="banner-period-desc" style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: #b45309; font-weight: 600;">---</p>
                </div>
            </div>
            <div id="banner-status-badge">
                <span class="badge" style="background: #94a3b8; color: white;">読込中</span>
            </div>
        </div>

        <!-- タブ切替ナビゲーション -->
        <div class="tabs-container no-print" style="display: flex; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem; gap: 0.5rem; flex-wrap: wrap;">
            <button class="tab-btn active" id="tab-self" style="padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">
                <i class="fas fa-user"></i> 自分の自己評価入力
            </button>
            <button class="tab-btn" id="tab-subordinates" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">
                <i class="fas fa-users-rectangle"></i> 部下の評価を行う <span class="count-badge" id="subordinates-badge" style="display:none; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 10px; background: #ec4899; color: white;">0</span>
            </button>
            <button class="tab-btn" id="tab-president" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">
                <i class="fas fa-user-tie"></i> 社長査定・最終確定 <span class="count-badge" id="president-badge" style="display:none; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 10px; background: #8b5cf6; color: white;">0</span>
            </button>
            <button class="tab-btn" id="tab-admin" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">
                <i class="fas fa-sliders"></i> 全体管理ダッシュボード
            </button>
        </div>

        <!-- メインコンテンツ表示エリア -->
        <div id="eval-main-content">
            <!-- 各タブの中身がJSでレンダリングされます -->
        </div>

    </div>

    <!-- 評価入力・閲覧モーダル (PC全画面推奨サイズ) -->
    <div id="eval-detail-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 3000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-xl); width: 100%; max-width: 1100px; height: 92vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
            <!-- モーダルヘッダー -->
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div>
                    <h3 id="modal-eval-title" style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b;">人事考課詳細</h3>
                    <p id="modal-eval-subtitle" style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">---</p>
                </div>
                <button type="button" id="btn-close-eval-modal" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <!-- モーダルボディ (スクロール可能) -->
            <div id="modal-eval-body" style="padding: 2rem; overflow-y: auto; flex: 1; background: #f8fafc;">
                <!-- 評価シートの中身が動的に生成されます -->
            </div>

            <!-- モーダルフッター -->
            <div id="modal-eval-footer" style="padding: 1rem 1.8rem; border-top: 1px solid var(--border); background: white; display: flex; justify-content: flex-end; gap: 0.8rem; flex-shrink: 0;">
                <!-- アクションボタンが動的に挿入されます -->
            </div>
        </div>
    </div>

    <!-- 評価項目マスタ編集モーダル -->
    <div id="eval-template-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 3000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-xl); width: 100%; max-width: 1200px; height: 92vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
            <!-- モーダルヘッダー -->
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div>
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-edit" style="color: #ec4899;"></i>評価項目マスタ編集</h3>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">各職位・シートごとの評価項目をカスタマイズします</p>
                </div>
                <button type="button" id="btn-close-template-modal" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <!-- モーダルボディ (スクロール可能) -->
            <div id="modal-template-body" style="padding: 1.5rem; overflow-y: auto; flex: 1; background: #f8fafc;">
                <!-- テンプレート選択と操作エリア -->
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                        <label style="font-weight: 800; font-size: 0.85rem; color: #475569;">編集対象シート:</label>
                        <select id="select-template-type" style="background: white; padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.9rem; min-width: 250px;">
                            <!-- オプションは動的に読み込む -->
                        </select>
                    </div>
                    <div style="display: flex; gap: 0.6rem;">
                        <button class="btn btn-secondary" id="btn-template-add-new" style="font-weight: 700; padding: 0.5rem 1rem; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-size: 0.8rem;">
                            <i class="fas fa-plus"></i> 新規シートテンプレート作成
                        </button>
                    </div>
                </div>

                <!-- 警告メッセージ表示エリア -->
                <div id="template-validation-warning" style="display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 0.75rem 1rem; color: #991b1b; font-size: 0.82rem; font-weight: 700; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                    <i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>
                    <span id="validation-warning-text">現在の項目数は24個ではありません。自動等級判定（120点満点）の整合性が崩れる可能性があります。</span>
                </div>

                <!-- 項目編集テーブル -->
                <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; margin-bottom: 1rem;">
                    <div style="overflow-x: auto;">
                        <table class="eval-table" style="font-size: 0.82rem;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="width: 70px; text-align: center;">順序</th>
                                    <th style="width: 150px; text-align: left;">カテゴリ</th>
                                    <th style="text-align: left; width: 35%;">項目タイトル（基準・行動定義）</th>
                                    <th style="text-align: left; width: 45%;">詳細説明（評価のポイント）</th>
                                    <th style="width: 60px; text-align: center;">操作</th>
                                </tr>
                            </thead>
                            <tbody id="template-items-tbody">
                                <!-- 項目行が動的に生成されます -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 項目追加ボタン -->
                <div style="display: flex; justify-content: flex-start; padding: 0.5rem 0; margin-bottom: 1rem;">
                    <button class="btn btn-secondary" id="btn-template-add-item" style="font-weight: 700; font-size: 0.8rem; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary);">
                        <i class="fas fa-plus-circle"></i> 項目を追加する
                    </button>
                </div>
            </div>

            <!-- モーダルフッター -->
            <div style="padding: 1rem 1.8rem; border-top: 1px solid var(--border); background: white; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
                    合計項目数: <span id="template-total-items-count" style="font-weight: 900; color: #1e293b;">0</span> / 24
                </div>
                <div style="display: flex; gap: 0.8rem;">
                    <button class="btn btn-secondary" id="btn-close-template-modal-footer" style="font-weight: 700; padding: 0.6rem 1.2rem; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary);">閉じる</button>
                    <button class="btn btn-primary" id="btn-save-template" style="font-weight: 800; padding: 0.6rem 2rem; background: #2563eb; border-color: #2563eb; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.15);">保存する</button>
                </div>
            </div>
        </div>
    </div>

    <style>
        .tab-btn.active {
            color: var(--primary) !important;
            border-bottom-color: var(--primary) !important;
        }
        .tab-btn:hover:not(.active) {
            color: var(--text-primary);
            background: #f8fafc;
        }
        .eval-status-badge {
            font-size: 0.75rem;
            font-weight: 800;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            display: inline-block;
        }
        .status-not_started { background: #e2e8f0; color: #475569; }
        .status-self_evaluating { background: #fef3c7; color: #d97706; }
        .status-self_submitted { background: #dbeafe; color: #1d4ed8; }
        .status-manager_evaluating { background: #e0f2fe; color: #0369a1; }
        .status-interviewing { background: #fae8ff; color: #a21caf; }
        .status-president_pending { background: #ffe4e6; color: #be123c; }
        .status-approved { background: #dcfce7; color: #15803d; }
        .status-notified { background: #ede9fe; color: #6d28d9; }

        .eval-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }
        .eval-table th {
            padding: 0.8rem 1rem;
            font-weight: 800;
            color: #475569;
            background: #f8fafc;
            border-bottom: 2px solid var(--border);
        }
        .eval-table td {
            padding: 0.8rem 1rem;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }
        
        .score-btn {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 1px solid #cbd5e1;
            background: white;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
            font-size: 0.85rem;
            color: #475569;
        }
        .score-btn.selected-self {
            background: #2563eb;
            color: white;
            border-color: #2563eb;
            box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
        .score-btn.selected-manager {
            background: #7c3aed;
            color: white;
            border-color: #7c3aed;
            box-shadow: 0 2px 4px rgba(124, 58, 237, 0.2);
        }
        .score-btn:hover:not(.selected-self):not(.selected-manager) {
            background: #f1f5f9;
            border-color: #94a3b8;
        }
        .score-btn:disabled {
            cursor: not-allowed;
            opacity: 0.9;
        }
    </style>
`;

export async function initEvaluationPage() {
    // 戻るボタン
    const btnBack = document.getElementById('btn-eval-back');
    if (btnBack) {
        btnBack.onclick = () => window.navigateTo('hr_hub');
    }

    // モーダルクローズ
    const btnCloseModal = document.getElementById('btn-close-eval-modal');
    if (btnCloseModal) {
        btnCloseModal.onclick = () => {
            document.getElementById('eval-detail-modal').style.display = 'none';
        };
    }

    // タブクリックイベント
    setupTabs();

    // 評価項目マスタ編集モーダルのボタンイベント紐付け
    const btnCloseTemp = document.getElementById('btn-close-template-modal');
    if (btnCloseTemp) {
        btnCloseTemp.onclick = () => {
            closeTemplateEditorModal();
        };
    }
    const btnCloseTempFooter = document.getElementById('btn-close-template-modal-footer');
    if (btnCloseTempFooter) {
        btnCloseTempFooter.onclick = () => {
            closeTemplateEditorModal();
        };
    }
    const btnAddTempItem = document.getElementById('btn-template-add-item');
    if (btnAddTempItem) {
        btnAddTempItem.onclick = () => {
            addTemplateItem();
        };
    }
    const btnSaveTemp = document.getElementById('btn-save-template');
    if (btnSaveTemp) {
        btnSaveTemp.onclick = () => {
            window.saveActiveTemplate();
        };
    }
    const btnAddTempNew = document.getElementById('btn-template-add-new');
    if (btnAddTempNew) {
        btnAddTempNew.onclick = () => {
            window.createNewTemplate();
        };
    }

    // 読み込み初期化
    await loadInitialSettingsAndData();
}

function setupTabs() {
    const tabs = ['self', 'subordinates', 'president', 'admin'];
    tabs.forEach(tabId => {
        const btn = document.getElementById(`tab-${tabId}`);
        if (btn) {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                activeTab = tabId;
                renderActiveTabContent();
            };
        }
    });
}

// 初期設定とデータの取得
async function loadInitialSettingsAndData() {
    const user = window.appState.currentUser;
    if (!user) return;

    // 店舗マスタのロード（名称解決用）
    try {
        const storeSnap = await getDocs(collection(db, "m_stores"));
        globalStoreMapForEval = {};
        storeSnap.forEach(d => {
            const data = d.data();
            globalStoreMapForEval[d.id] = data.store_name || data.店舗名 || d.id;
        });
    } catch(e) { console.error("Failed to load stores for eval:", e); }

    // 1. シードデータの確認・投入
    await verifyAndSeedTemplates();

    // 2. 現在の評価期設定を取得
    try {
        const periodDoc = await getDoc(doc(db, "settings", "evaluation"));
        if (periodDoc.exists()) {
            localPeriodSettings = periodDoc.data();
            updatePeriodBanner();
        } else {
            // 初期状態（評価期未設定）
            localPeriodSettings = null;
            updatePeriodBannerEmpty();
        }
    } catch (e) {
        console.error("Failed to load evaluation period settings:", e);
    }

    // 3. 権限に基づくタブの表示制御
    const role = user.Role || 'Staff';
    const tabSubordinates = document.getElementById('tab-subordinates');
    const tabPresident = document.getElementById('tab-president');
    const tabAdmin = document.getElementById('tab-admin');

    if (role === 'Admin' || role === '管理者') {
        try {
            const usersSnap = await getDocs(collection(db, "m_users"));
            allStaffUsersForAdmin = [];
            usersSnap.forEach(d => {
                const data = d.data();
                const isRetired = data.Status === 'retired' || data.Status === '退職済';
                if (!isRetired && data.Role !== 'Tablet' && data.Role !== '店舗タブレット') {
                    allStaffUsersForAdmin.push({ id: d.id, ...data });
                }
            });
        } catch(e) { console.error("Failed to load users for admin:", e); }

        if (tabAdmin) tabAdmin.style.display = 'block';
        if (tabSubordinates) tabSubordinates.style.display = 'block';
        if (tabPresident) tabPresident.style.display = 'block';
        activeTab = 'admin'; // 管理者はダッシュボードをデフォルトに
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-admin')?.classList.add('active');
    } else if (role === 'Manager' || role === '店長') {
        if (tabSubordinates) tabSubordinates.style.display = 'block';
        activeTab = 'subordinates'; // 店長は部下評価をデフォルトに
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-subordinates')?.classList.add('active');
    } else {
        activeTab = 'self';
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-self')?.classList.add('active');
    }

    // 4. データロード
    await loadEvaluationData();
    renderActiveTabContent();
}

function updatePeriodBanner() {
    const titleEl = document.getElementById('banner-period-title');
    const descEl = document.getElementById('banner-period-desc');
    const badgeEl = document.getElementById('banner-status-badge');
    if (!titleEl || !descEl || !badgeEl) return;

    const periodStr = localPeriodSettings.active_period || '未設定';
    const isProvisional = localPeriodSettings.is_provisional;
    const typeStr = isProvisional ? '仮評価' : '本評価 (給与反映対象)';
    
    titleEl.textContent = `${periodStr}期 人事評価スケジュール進行中`;
    descEl.textContent = `今回の評価区分: ${typeStr} | 6月決算期の本評価は7月からの等級・基本給に反映されます。仮評価はレベル自覚用です。`;
    
    const isOpen = localPeriodSettings.status === 'open';
    badgeEl.innerHTML = isOpen 
        ? `<span class="badge" style="background: #10b981; color: white; font-weight: 800; padding: 0.4rem 1rem; border-radius: 20px;"><i class="fas fa-check-circle"></i> 評価受付中</span>`
        : `<span class="badge" style="background: #ef4444; color: white; font-weight: 800; padding: 0.4rem 1rem; border-radius: 20px;"><i class="fas fa-lock"></i> 評価締め切り</span>`;
}

function updatePeriodBannerEmpty() {
    const titleEl = document.getElementById('banner-period-title');
    const descEl = document.getElementById('banner-period-desc');
    const badgeEl = document.getElementById('banner-status-badge');
    if (!titleEl || !descEl || !badgeEl) return;

    titleEl.textContent = `評価スケジュール未開始`;
    descEl.textContent = `現在、アクティブな人事評価セッションはありません。人事総務または管理者による評価期の開始をお待ちください。`;
    badgeEl.innerHTML = `<span class="badge" style="background: #64748b; color: white; font-weight: 800; padding: 0.4rem 1rem; border-radius: 20px;"><i class="fas fa-pause-circle"></i> 未開始</span>`;
}

// データベースからの評価データ読み込み
async function loadEvaluationData() {
    const user = window.appState.currentUser;
    if (!user) return;

    activeEvaluations = [];
    myEvaluation = null;
    subordinateUsers = [];

    if (!localPeriodSettings || localPeriodSettings.status !== 'open') return;

    const period = localPeriodSettings.active_period;

    try {
        // 1. 全評価データのロード (Admin/社長用、店長用の範囲)
        const role = user.Role || 'Staff';
        const qEvals = query(collection(db, "t_evaluations"), where("period", "==", period));
        const snapEvals = await getDocs(qEvals);
        
        snapEvals.forEach(d => {
            const data = d.data();
            activeEvaluations.push({ id: d.id, ...data });
        });

        // 2. 自分の評価の抽出
        myEvaluation = activeEvaluations.find(e => e.user_id === user.id) || null;

        // 3. 店長の場合の部下のユーザーリストをロード
        if (role === 'Manager' || role === '店長' || role === 'Admin' || role === '管理者') {
            const qUsers = query(collection(db, "m_users"));
            const snapUsers = await getDocs(qUsers);
            const allUsers = [];
            snapUsers.forEach(d => {
                allUsers.push({ id: d.id, ...d.data() });
            });

            // 自身の所属店舗が一致する一般スタッフ、アルバイトを「部下」とする (Adminは全ユーザー)
            const myStore = user.StoreID || user.StoreId;
            subordinateUsers = allUsers.filter(u => {
                // 自分自身は除外（ただし管理者はテスト運用のため自分も表示する）
                if (u.id === user.id && role !== 'Admin' && role !== '管理者') return false;
                
                if (u.Status === 'retired' || u.Status === '退職済') return false; // 退職者は除外
                if (role === 'Admin' || role === '管理者') return true; // 管理者は全員
                
                // 店長の場合は同じ店舗のスタッフ・アルバイト
                return u.StoreID === myStore && (u.Role === 'Staff' || u.Role === 'PartTimer' || u.Role === '一般社員' || u.Role === 'アルバイト');
            });

            // バッジカウントの表示更新
            updateTabBadges();
        }
    } catch (e) {
        console.error("Failed to load evaluation data:", e);
    }
}

function updateTabBadges() {
    // 部下評価の残り件数をバッジに表示 (自己評価提出済・店長評価中の件数)
    const subordinatesBadge = document.getElementById('subordinates-badge');
    if (subordinatesBadge) {
        const pendingCount = activeEvaluations.filter(e => {
            // 被評価者が部下リストに含まれ、かつステータスが「自己評価提出済」「上長評価中」「面談待ち」のもの
            const isSub = subordinateUsers.some(u => u.id === e.user_id);
            return isSub && ['self_submitted', 'manager_evaluating', 'interviewing'].includes(e.status);
        }).length;

        if (pendingCount > 0) {
            subordinatesBadge.textContent = pendingCount;
            subordinatesBadge.style.display = 'inline-block';
        } else {
            subordinatesBadge.style.display = 'none';
        }
    }

    // 社長査定の残り件数 (社長確認待ちの件数)
    const presidentBadge = document.getElementById('president-badge');
    if (presidentBadge) {
        const pendingCount = activeEvaluations.filter(e => e.status === 'president_pending').length;
        if (pendingCount > 0) {
            presidentBadge.textContent = pendingCount;
            presidentBadge.style.display = 'inline-block';
        } else {
            presidentBadge.style.display = 'none';
        }
    }
}

// アクティブなタブの内容を描画
function renderActiveTabContent() {
    const container = document.getElementById('eval-main-content');
    if (!container) return;

    if (!localPeriodSettings && activeTab !== 'admin') {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-hourglass-start fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">評価期間は開始されていません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">人事担当者による評価開始のアナウンスをお待ちください。</p>
            </div>
        `;
        return;
    }

    switch (activeTab) {
        case 'self':
            renderSelfTab(container);
            break;
        case 'subordinates':
            renderSubordinatesTab(container);
            break;
        case 'president':
            renderPresidentTab(container);
            break;
        case 'admin':
            renderAdminTab(container);
            break;
    }
}

// ==========================================
// 1. 自己評価タブ (被評価者ビュー)
// ==========================================
function renderSelfTab(container) {
    if (!myEvaluation) {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-user-slash fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">あなたの今期の評価シートは作成されていません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">等級が設定されていないか、評価対象外の可能性があります。管理者に確認してください。</p>
            </div>
        `;
        return;
    }

    const statusLabels = {
        'self_evaluating': '自己評価を入力してください。入力後、上長へ提出してください。',
        'self_submitted': '自己評価は提出済みです。上長による評価・面談の設定をお待ちください。',
        'manager_evaluating': '上長による評価入力中です。',
        'interviewing': '面談待ちです。評価シートを見ながら上長と面談を行ってください。',
        'president_pending': '社長確認待ちです。評価確定までお待ちください。',
        'approved': '評価は確定しました。人事担当者による公開までお待ちください。',
        'notified': '確定した評価結果とフィードバックがマイページにて確認できます！'
    };

    const displayStatus = getStatusJpName(myEvaluation.status);
    const guideText = statusLabels[myEvaluation.status] || '';

    container.innerHTML = `
        <div class="glass-panel" style="padding: 1.5rem 2rem; background: white; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 1rem; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <span class="eval-status-badge status-${myEvaluation.status}" style="font-size: 0.85rem; padding: 0.35rem 1rem;">
                        ステータス: ${displayStatus}
                    </span>
                    <span style="font-size: 0.85rem; color: #475569; font-weight: 700; margin-left: 1rem;">
                        現在の等級: ${myEvaluation.current_grade || '-'} | 前年同期の等級: ${myEvaluation.yoy_grade || '-'}
                    </span>
                </div>
                <div>
                    ${myEvaluation.status === 'self_evaluating' ? `
                        <button class="btn btn-primary" id="btn-open-self-eval" style="padding: 0.7rem 1.8rem; font-weight: 800; background: #2563eb; border-color: #2563eb; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.15);">
                            <i class="fas fa-edit"></i> 自己評価を入力する
                        </button>
                    ` : `
                        <button class="btn btn-secondary" id="btn-open-self-eval" style="padding: 0.7rem 1.8rem; font-weight: 700; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary);">
                            <i class="fas fa-eye"></i> 評価シートを表示 (読み取り専用)
                        </button>
                    `}
                </div>
            </div>
            <p style="font-size: 0.9rem; color: #475569; font-weight: 600; margin: 0; line-height: 1.6;">
                <i class="fas fa-info-circle" style="color: #3b82f6; margin-right: 0.4rem;"></i>
                ${guideText}
            </p>
        </div>
    `;

    document.getElementById('btn-open-self-eval').onclick = () => {
        openEvaluationDetailModal(myEvaluation, 'self');
    };
}

// ==========================================
// 2. 部下評価タブ (上長・店長ビュー)
// ==========================================
function renderSubordinatesTab(container) {
    if (subordinateUsers.length === 0) {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-users-slash fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">評価対象の部下が見つかりません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">あなたの店舗所属スタッフが存在しないか、評価データが未初期化です。</p>
            </div>
        `;
        return;
    }

    let rowsHTML = '';
    subordinateUsers.forEach(u => {
        const evalData = activeEvaluations.find(e => e.user_id === u.id);
        const status = evalData ? evalData.status : 'not_started';
        const statusJp = getStatusJpName(status);
        const score = evalData ? (evalData.self_total_score || '-') : '-';
        const mgrScore = evalData ? (evalData.manager_total_score || '-') : '-';
        const resultGrade = evalData ? (evalData.new_grade || '-') : '-';

        let actionBtn = '';
        if (status === 'self_evaluating') {
            actionBtn = `<span style="font-size:0.78rem; color:#94a3b8; font-weight:600;"><i class="fas fa-clock"></i> スタッフ入力待ち</span>`;
        } else if (status === 'self_submitted' || status === 'manager_evaluating') {
            actionBtn = `<button class="btn btn-primary" onclick="window.openSubEvaluation('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#7c3aed; border-color:#7c3aed; padding: 0.4rem 0.8rem;">評価・コメント入力</button>`;
        } else if (status === 'interviewing') {
            actionBtn = `<button class="btn" onclick="window.openSubEvaluation('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#a21caf; border-color:#a21caf; color:white; padding: 0.4rem 0.8rem;">面談完了・社長提出</button>`;
        } else if (status === 'not_started') {
            actionBtn = `<span style="font-size:0.78rem; color:#94a3b8; font-weight:600;">未作成</span>`;
        } else {
            actionBtn = `<button class="btn btn-secondary" onclick="window.openSubEvaluation('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>`;
        }

        rowsHTML += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem; font-weight: 700; color: #1e293b;">${u.Name} ${u.DisplayName ? `<span style="font-size:0.75rem; color:#94a3b8; font-weight:400;">(${u.DisplayName})</span>` : ''}</td>
                <td style="padding: 1rem; font-weight: 600; color: var(--text-secondary);">${u.JobTitle || '一般'}</td>
                <td style="padding: 1rem; font-family: monospace; font-weight: 700; color: #1e3a8a;">${u.GradeCode || '-'}</td>
                <td style="padding: 1rem;"><span class="eval-status-badge status-${status}">${statusJp}</span></td>
                <td style="padding: 1rem; text-align: center; font-weight: 700;">${score}</td>
                <td style="padding: 1rem; text-align: center; font-weight: 700; color: #7c3aed;">${mgrScore}</td>
                <td style="padding: 1rem; text-align: center; font-family: monospace; font-weight: 900; color: #059669;">${resultGrade}</td>
                <td style="padding: 1rem; text-align: right;" class="no-print">${actionBtn}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
            <div style="padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); background: #f8fafc;">
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #1e293b;">
                    <i class="fas fa-users-rectangle" style="color: #7c3aed; margin-right: 0.4rem;"></i>
                    店舗スタッフ・部下の評価一覧
                </h4>
            </div>
            <div style="overflow-x: auto;">
                <table class="eval-table">
                    <thead>
                        <tr>
                            <th style="text-align: left;">お名前</th>
                            <th style="text-align: left;">表示役職</th>
                            <th style="text-align: left; width: 80px;">現在の等級</th>
                            <th style="text-align: left; width: 140px;">ステータス</th>
                            <th style="text-align: center; width: 80px;">自己評価点</th>
                            <th style="text-align: center; width: 80px;">上長評価点</th>
                            <th style="text-align: center; width: 80px;">判定等級</th>
                            <th style="text-align: right; width: 160px;" class="no-print">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // グローバル関数への登録
    window.openSubEvaluation = (userId) => {
        const evalData = activeEvaluations.find(e => e.user_id === userId);
        if (evalData) {
            openEvaluationDetailModal(evalData, 'manager');
        }
    };
}

// ==========================================
// 3. 社長査定タブ (社長ビュー)
// ==========================================
function renderPresidentTab(container) {
    const pendingEvals = activeEvaluations.filter(e => e.status === 'president_pending');

    let rowsHTML = '';
    activeEvaluations.forEach(e => {
        const isPending = e.status === 'president_pending';
        const statusJp = getStatusJpName(e.status);

        let actionBtn = '';
        if (isPending) {
            actionBtn = `<button class="btn btn-primary" onclick="window.openPresidentEvaluation('${e.id}')" style="font-size:0.75rem; font-weight:800; background:#be123c; border-color:#be123c; padding: 0.4rem 0.8rem;">査定・確定する</button>`;
        } else {
            actionBtn = `<button class="btn btn-secondary" onclick="window.openPresidentEvaluation('${e.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>`;
        }

        rowsHTML += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem; font-weight: 700; color: #1e293b;">${e.user_name || '一般'}</td>
                <td style="padding: 1rem; font-weight: 600; color: var(--text-secondary);">${e.department === 'sales' ? '営業部 (ホール)' : '製造部 (調理)'}</td>
                <td style="padding: 1rem; font-family: monospace; font-weight: 700; color: #64748b;">${e.current_grade || '-'}</td>
                <td style="padding: 1rem; text-align: center; font-weight: 600;">${e.self_total_score || '-'}</td>
                <td style="padding: 1rem; text-align: center; font-weight: 600; color: #7c3aed;">${e.manager_total_score || '-'}</td>
                <td style="padding: 1rem; text-align: center; font-weight: 800; color: #be123c;">${e.final_total_score || e.manager_total_score || '-'}</td>
                <td style="padding: 1rem; text-align: center; font-family: monospace; font-weight: 900; color: #059669;">${e.new_grade || '-'}</td>
                <td style="padding: 1rem;"><span class="eval-status-badge status-${e.status}">${statusJp}</span></td>
                <td style="padding: 1rem; text-align: right;" class="no-print">${actionBtn}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.2rem; flex-wrap:wrap; gap:1rem;" class="no-print">
            <h4 style="margin:0; font-size:1rem; font-weight:800; color:#1e293b;"><i class="fas fa-user-tie" style="color:#be123c; margin-right:0.4rem;"></i> 全社評価一覧・最終査定</h4>
            ${pendingEvals.length > 0 ? `
                <button class="btn btn-success" id="btn-president-approve-all" style="background:#059669; border-color:#059669; font-weight:800; padding:0.6rem 1.3rem;">
                    <i class="fas fa-check-double"></i> 申請中の全評価を一括確定する (${pendingEvals.length}件)
                </button>
            ` : ''}
        </div>
        
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
            <div style="overflow-x: auto;">
                <table class="eval-table">
                    <thead>
                        <tr>
                            <th style="text-align: left;">お名前</th>
                            <th style="text-align: left;">部門</th>
                            <th style="text-align: left; width: 80px;">現等級</th>
                            <th style="text-align: center; width: 90px;">自己点</th>
                            <th style="text-align: center; width: 90px;">上長点</th>
                            <th style="text-align: center; width: 90px; color: #be123c;">確定点</th>
                            <th style="text-align: center; width: 90px;">新等級(判定)</th>
                            <th style="text-align: left; width: 140px;">ステータス</th>
                            <th style="text-align: right; width: 140px;" class="no-print">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML.length > 0 ? rowsHTML : `<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-secondary);">今期の評価データはまだありません。</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 一括確定イベント
    const btnApproveAll = document.getElementById('btn-president-approve-all');
    if (btnApproveAll) {
        btnApproveAll.onclick = () => {
            showConfirm('一括評価確定', `現在「社長確認待ち」の評価シート (${pendingEvals.length}件) をすべて一括確定しますか？\n（確定後は等級マスタの基準に沿って等級が仮/確定判定されます）`, async () => {
                const batch = writeBatch(db);
                for (const ev of pendingEvals) {
                    const finalScore = ev.final_total_score || ev.manager_total_score || 0;
                    
                    // 自動等級判定のルックアップ
                    const newGrade = await lookupGradeByScore(finalScore);
                    
                    const docRef = doc(db, "t_evaluations", ev.id);
                    batch.update(docRef, {
                        status: 'approved',
                        final_total_score: finalScore,
                        new_grade: newGrade,
                        updated_at: new Date().toISOString()
                    });
                }
                try {
                    await batch.commit();
                    showAlert('一括確定成功', `${pendingEvals.length}件の評価を確定しました！「全体管理ダッシュボード」から本人通知を公開してください。`);
                    await loadEvaluationData();
                    renderActiveTabContent();
                } catch(e) {
                    console.error(e);
                    showAlert('エラー', '一括確定処理に失敗しました。');
                }
            });
        };
    }

    window.openPresidentEvaluation = (evalId) => {
        const evalData = activeEvaluations.find(e => e.id === evalId);
        if (evalData) {
            openEvaluationDetailModal(evalData, 'president');
        }
    };
}

// ==========================================
// 4. 全体管理タブ (人事管理者ビュー)
// ==========================================
function renderAdminTab(container) {
    const isOpen = localPeriodSettings && localPeriodSettings.status === 'open';

    let statsHTML = '';
    if (localPeriodSettings) {
        const totalCount = activeEvaluations.length;
        const selfEvaluating = activeEvaluations.filter(e => e.status === 'self_evaluating').length;
        const managerEvaluating = activeEvaluations.filter(e => ['self_submitted', 'manager_evaluating', 'interviewing'].includes(e.status)).length;
        const presidentPending = activeEvaluations.filter(e => e.status === 'president_pending').length;
        const approvedCount = activeEvaluations.filter(e => e.status === 'approved').length;
        const notifiedCount = activeEvaluations.filter(e => e.status === 'notified').length;

        statsHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div class="glass-panel" style="padding: 1rem; text-align: center; background: #f8fafc;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">評価対象者数</div>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #1e293b; margin-top: 0.3rem;">${totalCount}名</div>
                </div>
                <div class="glass-panel" style="padding: 1rem; text-align: center; background: #fffbeb;">
                    <div style="font-size: 0.75rem; color: #d97706; font-weight: 700;">自己評価入力中</div>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #d97706; margin-top: 0.3rem;">${selfEvaluating}名</div>
                </div>
                <div class="glass-panel" style="padding: 1rem; text-align: center; background: #eff6ff;">
                    <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700;">店長評価・面談中</div>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #2563eb; margin-top: 0.3rem;">${managerEvaluating}名</div>
                </div>
                <div class="glass-panel" style="padding: 1rem; text-align: center; background: #fff1f2;">
                    <div style="font-size: 0.75rem; color: #e11d48; font-weight: 700;">社長査定待ち</div>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #e11d48; margin-top: 0.3rem;">${presidentPending}名</div>
                </div>
                <div class="glass-panel" style="padding: 1rem; text-align: center; background: #ecfdf5;">
                    <div style="font-size: 0.75rem; color: #059669; font-weight: 700;">確定済(未公開)</div>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #059669; margin-top: 0.3rem;">${approvedCount}名</div>
                </div>
                <div class="glass-panel" style="padding: 1rem; text-align: center; background: #f5f3ff;">
                    <div style="font-size: 0.75rem; color: #7c3aed; font-weight: 700;">公開・通知済</div>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #7c3aed; margin-top: 0.3rem;">${notifiedCount}名</div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 350px 1fr; gap: 1.5rem; align-items: start;">
            
            <!-- 左カラム: 評価期運用管理コントローラ -->
            <div class="glass-panel" style="padding: 1.5rem; background: white; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: var(--text-primary); border-bottom: 2px solid #f1f5f9; padding-bottom: 0.8rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-sliders" style="color:var(--primary);"></i>
                    評価期（スケジュール）運用
                </h4>
                
                ${isOpen ? `
                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 1rem; margin-bottom: 1.2rem; display: flex; flex-direction: column; gap: 0.4rem;">
                        <span style="font-size: 0.82rem; color: #065f46; font-weight: 800;"><i class="fas fa-check-circle"></i> 現在稼働中の評価期</span>
                        <span style="font-size: 1.25rem; font-weight: 900; color: #047857;">${localPeriodSettings.active_period} 期 (${localPeriodSettings.is_provisional ? '仮評価' : '本評価'})</span>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:0.6rem;">
                        <button class="btn btn-success" id="btn-admin-notify-all" style="width: 100%; background: #7c3aed; border-color: #7c3aed; font-weight: 800; padding: 0.8rem;" ${activeEvaluations.filter(e => e.status === 'approved').length === 0 ? 'disabled title="確定済みのシートがありません"' : ''}>
                            <i class="fas fa-bullhorn"></i> 確定結果を全従業員に一括公開 (通知)
                        </button>
                        <p style="font-size:0.7rem; color:var(--text-secondary); margin: 0 0 0.8rem;">※ 確定済（未公開）状態のシートが、全スタッフのマイページに通知公開されます。</p>
                        
                        <button class="btn" id="btn-admin-close-period" style="width: 100%; background: #fee2e2; border-color: #fca5a5; color: #dc2626; font-weight: 800; padding: 0.8rem;">
                            <i class="fas fa-lock"></i> 今期の評価期を終了・ロックする
                        </button>
                        <button class="btn" id="btn-admin-cancel-period" style="width: 100%; background: #fff1f2; border-color: #fecdd3; color: #be123c; font-weight: 800; padding: 0.8rem; margin-top: 0.6rem;">
                            <i class="fas fa-trash-alt"></i> 今期の評価開始を取り消す (リセット)
                        </button>
                    </div>
                ` : `
                    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; text-align: center; color: #64748b;">
                        現在、評価期間はロックまたは未開始です。
                    </div>

                    <form id="form-start-period" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="input-group" style="margin: 0;">
                            <label style="font-weight: 700; color: #475569; font-size:0.8rem;">新規開始する評価期 (例: 2026-06)</label>
                            <input type="text" id="input-period-name" placeholder="YYYY-MM" required style="font-family: monospace; font-size:1.05rem; padding: 0.55rem 0.8rem;">
                        </div>
                        <div class="input-group" style="margin: 0;">
                            <label style="font-weight: 700; color: #475569; font-size:0.8rem;">評価の種類</label>
                            <select id="select-period-provisional" required style="background: white; font-weight: 600; font-size:0.95rem; padding: 0.55rem 0.8rem;">
                                <option value="true" selected>仮評価 (9月, 12月, 3月)</option>
                                <option value="false">本評価 (6月決算期・給与反映)</option>
                            </select>
                        </div>
                        
                        <div class="input-group" style="margin: 0; display: flex; flex-direction: column; gap: 0.5rem;">
                            <label style="font-weight: 700; color: #475569; font-size:0.8rem;">評価対象者の選択</label>
                            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.2rem; flex-wrap: wrap;">
                                <button type="button" class="btn btn-secondary" onclick="window.toggleAllEvalUsers(true)" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; border-color: #cbd5e1;"><i class="fas fa-check-square"></i> すべて選択</button>
                                <button type="button" class="btn btn-secondary" onclick="window.toggleAllEvalUsers(false)" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; border-color: #cbd5e1;"><i class="far fa-square"></i> すべて解除</button>
                                <button type="button" class="btn btn-secondary" onclick="window.selectOnlySelfForEval('${window.appState.currentUser.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.8rem; border-color: #3b82f6; color: #2563eb; background: #eff6ff;"><i class="fas fa-user-shield"></i> テスト用 (自分のみ)</button>
                            </div>
                            <div style="max-height: 180px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem; background: #f8fafc;">
                                ${allStaffUsersForAdmin.map(u => `
                                    <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem; border-bottom: 1px solid #e2e8f0; cursor: pointer;">
                                        <input type="checkbox" name="target_users" value="${u.id}" class="eval-user-checkbox" checked>
                                        <span style="font-size: 0.85rem; font-weight: 600; color: #1e293b;">${u.Name} (${u.Role === 'Manager' ? '店長' : 'スタッフ'} / ${u.StoreId || '本店'})</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 800; padding: 0.8rem; background: #10b981; border-color: #10b981; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.15);">
                            <i class="fas fa-play"></i> 評価期を新規開始する
                        </button>
                    </form>
                `}
                <div style="margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1.2rem;">
                    <button class="btn btn-secondary" id="btn-admin-edit-templates" style="width: 100%; font-weight: 800; padding: 0.8rem; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary);">
                        <i class="fas fa-edit"></i> 評価項目マスタの編集
                    </button>
                </div>
            </div>

            <!-- 右カラム: 進行チャート・一括一覧 -->
            <div>
                ${statsHTML}
                
                <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <div style="padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #1e293b;">
                            <i class="fas fa-list" style="color: var(--primary); margin-right: 0.4rem;"></i>
                            評価進行ステータス一覧
                        </h4>
                    </div>
                    <div style="overflow-x: auto; max-height: 400px;">
                        <table class="eval-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left;">お名前</th>
                                    <th style="text-align: left;">部署・店舗</th>
                                    <th style="text-align: left; width: 140px;">現在のステータス</th>
                                    <th style="text-align: center; width: 90px;">自己評価点</th>
                                    <th style="text-align: center; width: 90px;">上長評価点</th>
                                    <th style="text-align: right; width: 100px;" class="no-print">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activeEvaluations.map(e => `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem 1rem; font-weight: 700; color: #1e293b;">${e.user_name || '一般'}</td>
                                        <td style="padding: 0.75rem 1rem; color: var(--text-secondary); font-size: 0.8rem;">${e.department === 'sales' ? '営業部' : '製造部'} (${globalStoreMapForEval[e.store_id] || e.store_id || '本店'})</td>
                                        <td style="padding: 0.75rem 1rem;"><span class="eval-status-badge status-${e.status}">${getStatusJpName(e.status)}</span></td>
                                        <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 600;">${e.self_total_score || '-'}</td>
                                        <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 600; color: #7c3aed;">${e.manager_total_score || '-'}</td>
                                        <td style="padding: 0.75rem 1rem; text-align: right;" class="no-print">
                                            <button class="btn btn-secondary" onclick="window.viewAdminEvaluationDetail('${e.id}')" style="font-size: 0.7rem; padding: 0.3rem 0.6rem; border: 1px solid #cbd5e1; background: white; color: var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${activeEvaluations.length === 0 ? `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-secondary);">現在進行中の評価はありません。</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
        </div>
    `;

    // 評価期開始イベント
    const formStart = document.getElementById('form-start-period');
    if (formStart) {
        formStart.onsubmit = async (e) => {
            e.preventDefault();
            const periodName = document.getElementById('input-period-name').value.trim();
            const isProvisional = document.getElementById('select-period-provisional').value === 'true';

            // バリデーション (例: 2026-06)
            if (!/^\d{4}-\d{2}$/.test(periodName)) {
                return showAlert('入力エラー', '評価期は「YYYY-MM」形式で入力してください (例: 2026-06)。');
            }

            showConfirm('評価期の開始', `新評価期「${periodName}期 (${isProvisional ? '仮評価' : '本評価'})」を開始しますか？\n（在職中のすべての対象従業員の評価シートが自動作成されます）`, async () => {
                const btnSubmit = formStart.querySelector('button[type="submit"]');
                const originalHtml = btnSubmit.innerHTML;
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 初期化中...';
                btnSubmit.disabled = true;

                try {
                    // 1. 選択されたユーザーリストの取得
                    const checkboxes = document.querySelectorAll('.eval-user-checkbox:checked');
                    const selectedUserIds = Array.from(checkboxes).map(cb => cb.value);
                    if (selectedUserIds.length === 0) {
                        btnSubmit.innerHTML = originalHtml;
                        btnSubmit.disabled = false;
                        return showAlert('エラー', '評価対象者を1人以上選択してください。');
                    }
                    const activeUsers = allStaffUsersForAdmin.filter(u => selectedUserIds.includes(u.id));

                    // 2. 等級マスタの読込 (適用テンプレートの判定用)
                    const gradesSnap = await getDocs(collection(db, "m_grades"));
                    const gradeMap = {};
                    gradesSnap.forEach(d => {
                        const data = d.data();
                        if (data.grade_code) {
                            gradeMap[data.grade_code] = data;
                        }
                    });

                    // 3. 各自の評価ドキュメントをバッチ作成
                    const batch = writeBatch(db);
                    
                    // 設定情報の登録
                    const settingsRef = doc(db, "settings", "evaluation");
                    batch.set(settingsRef, {
                        active_period: periodName,
                        is_provisional: isProvisional,
                        status: 'open',
                        updated_at: new Date().toISOString()
                    });

                    // 各ユーザーの評価ドキュメント生成
                    for (const u of activeUsers) {
                        const gradeConfig = gradeMap[u.GradeCode] || {};
                        const templateId = gradeConfig.evaluation_template_id || 'general';
                        
                        // テンプレートアイテムのスナップショットをロード
                        const evalItems = await getSnapshotItemsForTemplate(templateId, u.id);

                        // 前回評価期 (YoY判定用の1年前の等級の読み込みを試みる)
                        const yoyPeriod = getYoYPeriod(periodName);
                        let yoyGrade = '-';
                        try {
                            const yoyDoc = await getDoc(doc(db, "t_evaluations", `${u.id}_${yoyPeriod}`));
                            if (yoyDoc.exists()) {
                                yoyGrade = yoyDoc.data().new_grade || '-';
                            }
                        } catch(e) { console.warn("Failed to fetch YoY grade:", e); }

                        const evalId = `${u.id}_${periodName}`;
                        const evalDocRef = doc(db, "t_evaluations", evalId);
                        
                        const evalRecord = {
                            user_id: u.id,
                            user_name: u.Name || '一般',
                            department: (u.Role === 'PartTimer' || u.StoreID === 'kitchen') ? 'manufacturing' : 'sales', // 簡易分割
                            store_id: u.StoreID || 'honten',
                            evaluator_id: '', // 空 (店長による評価開始時に設定または自動紐付け)
                            evaluator_name: '',
                            period: periodName,
                            status: 'self_evaluating',
                            is_provisional: isProvisional,
                            current_grade: u.GradeCode || '-',
                            yoy_grade: yoyGrade,
                            new_grade: '-',
                            self_total_score: 0,
                            manager_total_score: 0,
                            final_total_score: 0,
                            interview_date: '',
                            interview_notes: '',
                            president_comment: '',
                            items: evalItems,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };
                        
                        batch.set(evalDocRef, evalRecord);

                        // 4. 通知センターへの自動アラート挿入
                        const notifRef = doc(collection(db, "notifications"));
                        batch.set(notifRef, {
                            title: `【評価開始】${periodName}期 人事評価シート入力のお知らせ`,
                            message: `自己評価の入力期限となりました。マイページまたは評価システムより自己スコアの入力・提出をお願いいたします。`,
                            type: 'evaluation_alert',
                            status: 'pending',
                            store_id: u.StoreID || 'honten',
                            created_at: new Date().toISOString(),
                            readBy: []
                        });
                    }

                    await batch.commit();
                    showAlert('開始成功', `${periodName}期の評価セッションを開始しました！全スタッフ宛に入力依頼を通知しました。`);
                    await loadInitialSettingsAndData();
                } catch (err) {
                    console.error(err);
                    showAlert('エラー', '評価期の初期化に失敗しました。');
                } finally {
                    btnSubmit.innerHTML = originalHtml;
                    btnSubmit.disabled = false;
                }
            });
        };
    }

    // 確定結果の一括公開 (通知)
    const btnNotifyAll = document.getElementById('btn-admin-notify-all');
    if (btnNotifyAll) {
        btnNotifyAll.onclick = () => {
            const approvedEvals = activeEvaluations.filter(e => e.status === 'approved');
            showConfirm('確定結果の公開', `確定済み（未公開）状態の評価シート (${approvedEvals.length}件) をすべて公開・本人通知しますか？\n（スタッフのマイページから閲覧可能になり、新等級が反映されます）`, async () => {
                const batch = writeBatch(db);
                
                // 本評価の場合、ユーザーマスタ (m_users) の等級コードを一括で書き換えるためのバッチ用
                const userUpdates = [];

                for (const ev of approvedEvals) {
                    const evalRef = doc(db, "t_evaluations", ev.id);
                    batch.update(evalRef, {
                        status: 'notified',
                        updated_at: new Date().toISOString()
                    });

                    // 本評価（6月評価）の場合のみ、新等級を m_users に自動反映
                    if (localPeriodSettings.is_provisional === false && ev.new_grade && ev.new_grade !== '-') {
                        const userRef = doc(db, "m_users", ev.user_id);
                        batch.update(userRef, {
                            GradeCode: ev.new_grade
                        });
                    }

                    // 通知の作成
                    const notifRef = doc(collection(db, "notifications"));
                    batch.set(notifRef, {
                        title: `【評価公開】${ev.period}期の評価結果が公開されました`,
                        message: `社長査定が完了し、あなたの新しい等級（または仮等級）が確定しました。マイページよりフィードバックをご確認ください。`,
                        type: 'evaluation_published',
                        status: 'pending',
                        store_id: ev.store_id || 'honten',
                        created_at: new Date().toISOString(),
                        readBy: []
                    });
                }

                try {
                    await batch.commit();
                    showAlert('公開成功', `評価結果を公開し、対象従業員に通知を配信しました！`);
                    await loadEvaluationData();
                    renderActiveTabContent();
                } catch(e) {
                    console.error(e);
                    showAlert('エラー', '公開処理に失敗しました。');
                }
            });
        };
    }

    // 評価期のロック終了
    const btnClosePeriod = document.getElementById('btn-admin-close-period');
    if (btnClosePeriod) {
        btnClosePeriod.onclick = () => {
            showConfirm('評価期の締め切り', `現在稼働中の「${localPeriodSettings.active_period}期」を締め切り、終了しますか？\n（以降、点数の変更や再評価はロックされます）`, async () => {
                try {
                    const settingsRef = doc(db, "settings", "evaluation");
                    await updateDoc(settingsRef, {
                        status: 'closed',
                        updated_at: new Date().toISOString()
                    });
                    showAlert('締め切り成功', '今期の評価スケジュールをクローズ・ロックしました。');
                    await loadInitialSettingsAndData();
                } catch (e) {
                    console.error(e);
                    showAlert('エラー', '締め切り処理に失敗しました。');
                }
            });
        };
    }

    // 評価期の開始取消・リセット
    const btnCancelPeriod = document.getElementById('btn-admin-cancel-period');
    if (btnCancelPeriod) {
        btnCancelPeriod.onclick = () => {
            const period = localPeriodSettings.active_period;
            showConfirm('評価開始の取り消し', `現在開始されている「${period}期」の評価シートおよび通知データをすべて削除して初期状態にリセットしますか？\n(注意: すでに入力された自己評価データなどがある場合、それらもすべて消去されます。この操作は元に戻せません)`, async () => {
                const btn = btnCancelPeriod;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 取り消し中...';
                btn.disabled = true;

                try {
                    const batch = writeBatch(db);

                    // 1. 作成された評価ドキュメントの削除
                    activeEvaluations.forEach(ev => {
                        batch.delete(doc(db, "t_evaluations", ev.id));
                    });

                    // 2. 評価期設定ドキュメントの削除
                    batch.delete(doc(db, "settings", "evaluation"));

                    // 3. 関連通知の削除
                    const notifSnap = await getDocs(query(collection(db, "notifications"), where("type", "in", ["evaluation_alert", "evaluation_published"])));
                    notifSnap.forEach(d => {
                        batch.delete(doc(db, "notifications", d.id));
                    });

                    await batch.commit();
                    showAlert('取り消し完了', `${period}期の評価データをリセットし、通知を削除しました。`);
                    await loadInitialSettingsAndData();
                } catch(err) {
                    console.error("Failed to cancel evaluation period:", err);
                    showAlert('エラー', '評価期の取り消しに失敗しました。');
                } finally {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            });
        };
    }

    window.viewAdminEvaluationDetail = (evalId) => {
        const evalData = activeEvaluations.find(e => e.id === evalId);
        if (evalData) {
            openEvaluationDetailModal(evalData, 'admin');
        }
    };

    // 評価項目マスタ編集ボタンのバインド
    const btnEditTemplates = document.getElementById('btn-admin-edit-templates');
    if (btnEditTemplates) {
        btnEditTemplates.onclick = () => {
            openTemplateEditorModal();
        };
    }
}

// YoY (前年同期) のPeriod名を算出するヘルパー (例: 2026-06 -> 2025-06)
function getYoYPeriod(periodName) {
    const parts = periodName.split('-');
    if (parts.length !== 2) return '';
    const year = parseInt(parts[0]) - 1;
    return `${year}-${parts[1]}`;
}

// 評価テンプレートマスタのシード処理 (存在しない場合に初期4件を投入)
async function verifyAndSeedTemplates() {
    try {
        const snap = await getDocs(collection(db, "m_evaluation_templates"));
        if (!snap.empty) {
            // すでにテンプレートが存在するため何もしない
            return;
        }

        console.log("Seeding default evaluation templates...");
        
        // デフォルトの一般・研修項目
        const defaultGeneralItems = [
            { item_id: 'item_01', category: '労働管理', title: 'スタッフ・お客様に対して目を見て元気よく挨拶をしている', description: '朝の挨拶、接客時に目線とトーンを意識できているか。', display_order: 1 },
            { item_id: 'item_02', category: '労働管理', title: '丁寧な言葉遣いを心がけている', description: '乱暴な言葉遣いや、ふさわしくない敬語を避けているか。', display_order: 2 },
            { item_id: 'item_03', category: '労働管理', title: '時間・期日を守って仕事をしている', description: '遅刻をしない、シフト開始の準備、指示された期日を守る。', display_order: 3 },
            { item_id: 'item_04', category: '自主計画性', title: '問題が起きた時に上級者に報告している', description: 'ミス、異物混入、トラブル発生時の即時ホウレンソウ。', display_order: 4 },
            { item_id: 'item_05', category: '自主計画性', title: '必要なことは必ず連絡している', description: 'シフトの調整申請、業務連絡を怠らない。', display_order: 5 },
            { item_id: 'item_06', category: '自主計画性', title: '分からないことを上級者に確認・相談している', description: '勝手な自己判断をせず、確認作業を行える。', display_order: 6 },
            { item_id: 'item_07', category: '自主計画性', title: '業務上分からない事を積極的に質問している', description: '自ら疑問を解消しようとする成長意欲。', display_order: 7 },
            { item_id: 'item_08', category: '自主計画性', title: '業務を覚えるための努力をしている', description: 'マニュアルの読み込み、振り返り等の自主的姿勢。', display_order: 8 },
            { item_id: 'item_09', category: '自主計画性', title: '整理整頓を心がけている', description: '使用した器具、テーブル、自身のロッカーの清掃・配置。', display_order: 9 },
            { item_id: 'item_10', category: '自主計画性', title: '清潔さを意識した仕事をしている', description: '身だしなみ、爪、ユニフォームの清潔さ。', display_order: 10 },
            { item_id: 'item_11', category: '目標達成度', title: '馴染みのお客様は名前を呼んで接客している', description: 'リピーター顧客への「名前を呼んだ親身な接客」。', display_order: 11 },
            { item_id: 'item_12', category: '目標達成度', title: '馴染みのお客様から名前を覚えてもらっている', description: 'ネームプレート、自己紹介等のコミュニケーション成果。', display_order: 12 },
            { item_id: 'item_13', category: '目標達成度', title: 'お客様やスタッフが不快にならない言い方で仕事をしている', description: '否定的な表現や高圧的な態度を避けた対話。', display_order: 13 },
            { item_id: 'item_14', category: '目標達成度', title: 'スピードを重視しながらも安全に商品提供をしている', description: '提供スピードの遵守、かつ転倒や破損を起こさない。', display_order: 14 },
            { item_id: 'item_15', category: '店舗責任者', title: '商品の説明が正しくできている', description: '本日のおすすめ、メニュー詳細、アレルギー対応。', display_order: 15 },
            { item_id: 'item_16', category: '店舗責任者', title: 'その商品を頼みたくなるような魅力的な説明ができる', description: 'シズル感を交えたおすすめ商品の販売。', display_order: 16 },
            { item_id: 'item_17', category: '店舗責任者', title: '元気よく掛け声・復唱をしている', description: 'オーダー通し、いらっしゃいませ等の積極的発声。', display_order: 17 },
            { item_id: 'item_18', category: '店舗責任者', title: 'お客様の要望にすぐ気づき対応ができる', description: '視野を広く持ち、お冷、中間バッシング等の気配り。', display_order: 18 },
            { item_id: 'item_19', category: '店舗責任者', title: '衛生管理チェックテストを合格している', description: '社内テストでの基準クリア。', display_order: 19 },
            { item_id: 'item_20', category: '店舗責任者', title: '研修卒業テストに合格しテスト内容を実践している', description: '一般社員としての卒業判定。', display_order: 20 },
            { item_id: 'item_21', category: '教育者', title: 'レジ操作業務確認テストに合格し、正しい手順で行えている', description: 'ミスのない会計処理、レジ締め手順の正確性。', display_order: 21 },
            { item_id: 'item_22', category: '教育者', title: 'ドリンクを決められた方法で作成する事を徹底している', description: 'マニュアル通りのレシピ・分量の遵守。', display_order: 22 },
            { item_id: 'item_23', category: '教育者', title: 'ホールマニュアルを徹底している', description: '標準サービスの徹底と指導への応用。', display_order: 23 },
            { item_id: 'item_24', category: '教育者', title: '指導を受けながら焼き業務を行っている', description: '調理指導時の真摯な受け答えと習熟。', display_order: 24 }
        ];

        const batch = writeBatch(db);

        // 1. 一般・研修
        batch.set(doc(db, "m_evaluation_templates", "general"), {
            template_name: "一般・研修用評価シート",
            items: defaultGeneralItems
        });

        // 2. 調理師
        batch.set(doc(db, "m_evaluation_templates", "chef"), {
            template_name: "調理師用評価シート",
            items: defaultGeneralItems.map(item => {
                if (item.category === '教育者') {
                    return { ...item, title: `【調理専門】${item.title.replace('レジ', '調理・仕込み')}` };
                }
                return item;
            })
        });

        // 3. 副店長
        batch.set(doc(db, "m_evaluation_templates", "sub_manager"), {
            template_name: "副店長用評価シート",
            items: defaultGeneralItems.map((item, idx) => {
                if (idx >= 20) {
                    return { ...item, category: '管理者項目', title: `【マネジメント】シフト調整と新人スタッフの育成教育を主導している` };
                }
                return item;
            })
        });

        // 4. 店長
        batch.set(doc(db, "m_evaluation_templates", "manager"), {
            template_name: "店長用評価シート",
            items: defaultGeneralItems.map((item, idx) => {
                if (idx === 23) {
                    return { ...item, category: '管理者項目', title: `部下の等級が前回評価よりも上がっている（部下の育成責任）` };
                }
                if (idx >= 20) {
                    return { ...item, category: '管理者項目', title: `【数値責任】店舗の目標PL（売上・FLコスト）の計画を達成している` };
                }
                return item;
            })
        });

        await batch.commit();
        console.log("Seeding templates completed.");
    } catch(e) { console.error("Verify templates error:", e); }
}

// 評価初期化時に、指定したテンプレートの項目に「前回の評価値」を結合したスナップショット用配列を構築する
async function getSnapshotItemsForTemplate(templateId, userId) {
    let items = [];
    try {
        const tDoc = await getDoc(doc(db, "m_evaluation_templates", templateId));
        if (tDoc.exists()) {
            items = tDoc.data().items || [];
        }
    } catch(e) { console.error(e); }

    if (items.length === 0) {
        // フォールバック
        return [];
    }

    // ユーザーの「直近の過去確定評価」を検索
    let previousEval = null;
    try {
        const q = query(
            collection(db, "t_evaluations"),
            where("user_id", "==", userId),
            where("status", "in", ["notified", "approved"]),
            orderBy("period", "desc")
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            previousEval = snap.docs[0].data();
        }
    } catch(e) {
        console.warn("Could not find previous evaluation for user:", userId, e);
    }

    // 前回の各項目の点数をマッピングして初期配列を作成
    return items.map(item => {
        let prevScore = 0;
        if (previousEval && previousEval.items) {
            const prevItem = previousEval.items.find(pi => pi.item_id === item.item_id);
            if (prevItem) {
                prevScore = prevItem.manager_score || prevItem.self_score || 0;
            }
        }

        return {
            item_id: item.item_id,
            category: item.category,
            title: item.title,
            description: item.description || '',
            is_new: false, // マスタ変更検知用（将来拡張）
            self_score: 0,
            self_comment: '',
            manager_score: 0,
            manager_comment: '',
            previous_score: prevScore
        };
    });
}

// ==========================================
// 5. 評価詳細入力・閲覧モーダルの構築と制御
// ==========================================
function openEvaluationDetailModal(evalData, mode) {
    selectedEvalDetail = JSON.parse(JSON.stringify(evalData)); // シャローコピーで編集バッファにする
    
    const modal = document.getElementById('eval-detail-modal');
    const titleEl = document.getElementById('modal-eval-title');
    const subtitleEl = document.getElementById('modal-eval-subtitle');
    const bodyEl = document.getElementById('modal-eval-body');
    const footerEl = document.getElementById('modal-eval-footer');

    if (!modal || !bodyEl || !footerEl) return;

    const isProvisional = selectedEvalDetail.is_provisional;
    const typeStr = isProvisional ? '仮評価' : '本評価 (7月給与反映対象)';
    titleEl.textContent = `【${selectedEvalDetail.period}期 ${typeStr}】 ${selectedEvalDetail.user_name} さんの評価シート`;
    
    const statusJp = getStatusJpName(selectedEvalDetail.status);
    subtitleEl.textContent = `ステータス: ${statusJp} | 被評価者の現等級: ${selectedEvalDetail.current_grade} | 前年同期の等級: ${selectedEvalDetail.yoy_grade}`;

    // モーダルボディの構築
    renderModalBody(bodyEl, mode);

    // フッターアクションボタンの構築
    renderModalFooter(footerEl, mode);

    modal.style.display = 'flex';
}

function renderModalBody(container, mode) {
    const status = selectedEvalDetail.status;
    const isSelfMode = mode === 'self' && status === 'self_evaluating';
    const isManagerMode = mode === 'manager' && (status === 'self_submitted' || status === 'manager_evaluating' || status === 'interviewing');
    const isPresidentMode = mode === 'president' && status === 'president_pending';

    // 項目ごとの行を構築
    let itemsHtml = '';
    let currentCategory = '';
    
    // 集計用初期値
    let selfTotal = 0;
    let managerTotal = 0;

    // 店長が評価する際の「部下育成進捗」アシストウィジェットの構築
    let assistWidgetHtml = '';
    if (isManagerMode) {
        // もし店長の評価項目（例：「部下の等級が前回評価よりも上がっている」）がある場合、自動集計結果を挿入
        const targetItem = selectedEvalDetail.items.find(item => item.title.includes('部下の等級が前回評価よりも上がっている'));
        if (targetItem) {
            const hasRankedUpCount = activeEvaluations.filter(e => {
                const isSub = subordinateUsers.some(u => u.id === e.user_id);
                if (!isSub) return false;
                
                // 等級変化チェック (例: 現等級より新等級が数値的に高い、または昇格している)
                const cur = parseInt(e.current_grade) || 0;
                const nxt = parseInt(e.new_grade) || 0;
                return nxt > cur && e.status !== 'not_started';
            }).length;

            assistWidgetHtml = `
                <div class="glass-panel" style="padding: 1.2rem; background: #f0fdf4; border: 1px dashed #86efac; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h5 style="margin: 0 0 0.5rem; color: #166534; font-weight: 800;"><i class="fas fa-magic"></i> 部下育成責任・自動判定アシスト</h5>
                    <p style="margin: 0; font-size: 0.8rem; color: #15803d; line-height: 1.5;">
                        店長マスタ管理下のスタッフ等級推移を自動算出しました：<br>
                        <strong>今期等級が上昇した部下の人数: ${hasRankedUpCount}名</strong> (在職中の部下合計: ${subordinateUsers.length}名中)<br>
                        ※上記の成果を参考に、「部下の育成責任（項目24）」の評価点を入力してください。
                    </p>
                </div>
            `;
        }
    }

    selectedEvalDetail.items.forEach((item, idx) => {
        // カテゴリヘッダーの差し込み
        if (item.category !== currentCategory) {
            currentCategory = item.category;
            itemsHtml += `
                <tr style="background: #eff6ff;">
                    <td colspan="5" style="padding: 0.6rem 1rem; font-weight: 900; color: #1e3a8a; font-size: 0.82rem;">
                        <i class="fas fa-folder-open" style="margin-right: 0.4rem;"></i>
                        ${currentCategory}
                    </td>
                </tr>
            `;
        }

        selfTotal += item.self_score || 0;
        managerTotal += item.manager_score || 0;

        // 自己評価ラジオボタン
        let selfRadioHtml = '';
        for (let s = 5; s >= 1; s--) {
            const isSel = item.self_score === s;
            const disabledAttr = isSelfMode ? '' : 'disabled';
            selfRadioHtml += `
                <button type="button" class="score-btn ${isSel ? 'selected-self' : ''}" 
                        onclick="window.selectScore(${idx}, 'self', ${s})" ${disabledAttr}>
                    ${s}
                </button>
            `;
        }

        // 上長評価ラジオボタン
        let managerRadioHtml = '';
        for (let s = 5; s >= 1; s--) {
            const isSel = item.manager_score === s;
            const disabledAttr = isManagerMode ? '' : 'disabled';
            managerRadioHtml += `
                <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                        onclick="window.selectScore(${idx}, 'manager', ${s})" ${disabledAttr}>
                    ${s}
                </button>
            `;
        }

        // コメント入力欄
        let commentAreaHtml = '';
        if (isSelfMode) {
            commentAreaHtml = `
                <input type="text" value="${item.self_comment || ''}" placeholder="自己評価の理由を記入" 
                       onchange="window.updateComment(${idx}, 'self', this.value)" 
                       style="width: 100%; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.78rem;">
            `;
        } else {
            commentAreaHtml += `
                <div style="font-size:0.75rem; color:#475569; font-weight: 600; line-height: 1.4;">
                    ${item.self_comment ? `自己理由: ${item.self_comment}` : '<span style="color:#94a3b8;">自己理由: 未記入</span>'}
                </div>
            `;
        }

        if (isManagerMode) {
            commentAreaHtml += `
                <input type="text" value="${item.manager_comment || ''}" placeholder="フィードバック、上長評価の理由を記入" 
                       onchange="window.updateComment(${idx}, 'manager', this.value)" 
                       style="width: 100%; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.78rem; margin-top: 0.3rem;">
            `;
        } else {
            commentAreaHtml += `
                <div style="font-size:0.75rem; color:#6d28d9; font-weight: 700; line-height: 1.4; margin-top: 0.2rem;">
                    ${item.manager_comment ? `上長FB: ${item.manager_comment}` : '<span style="color:#94a3b8;">上長FB: 未記入</span>'}
                </div>
            `;
        }

        itemsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                <td style="padding: 0.8rem 1rem; width: 30%;">
                    <div style="font-weight: 700; color: #1e293b; line-height: 1.4;">
                        ${item.is_new ? '<span class="badge" style="background:#ef4444; color:white; font-size:0.65rem; padding:0.1rem 0.3rem; margin-right:0.3rem;">新</span>' : ''}
                        ${item.title}
                    </div>
                    <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.2rem;">${item.description}</div>
                </td>
                <td style="padding: 0.8rem 0.5rem; text-align: center; font-weight: 700; font-family: monospace; font-size: 0.9rem; color: #64748b; background: #f8fafc; width: 80px;">
                    ${item.previous_score || '-'}
                </td>
                <td style="padding: 0.8rem 1rem; width: 200px;">
                    <div style="display: flex; gap: 0.25rem; justify-content: center;">
                        ${selfRadioHtml}
                    </div>
                </td>
                <td style="padding: 0.8rem 1rem; width: 200px;">
                    <div style="display: flex; gap: 0.25rem; justify-content: center;">
                        ${managerRadioHtml}
                    </div>
                </td>
                <td style="padding: 0.8rem 1rem;">
                    ${commentAreaHtml}
                </td>
            </tr>
        `;
    });

    // 等級判定テーブルのプレビューウィジェット
    let gradeRulePreviewHtml = `
        <div class="glass-panel" style="padding: 1rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-top: 1.5rem;">
            <h5 style="margin: 0 0 0.5rem; color: #1e3a8a; font-weight: 800;"><i class="fas fa-info-circle"></i> 自動等級判定の条件目安 (給与基準表)</h5>
            <p style="margin: 0; font-size: 0.78rem; color: #1e40af; line-height: 1.5;">
                ・点数合計に応じた等級連動判定が行われます。<br>
                ・仮評価（9, 12, 3月）は結果公開と仮通知のみで給与には影響しません。<br>
                ・本評価（6月）のみ新等級が7月から本反映されます。
            </p>
        </div>
    `;

    // 面談メモ、社長総括の表示エリア
    let textFieldsHtml = '';
    if (status !== 'self_evaluating') {
        textFieldsHtml += `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
                <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border);">
                    <h5 style="margin: 0 0 0.6rem; color: #7c3aed; font-weight: 800;"><i class="fas fa-comments"></i> 上長面談時のメモ・記録</h5>
                    ${isManagerMode ? `
                        <textarea id="modal-interview-notes" rows="4" placeholder="面談で話し合った内容や育成方針を記入" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; font-family:inherit; resize:vertical;">${selectedEvalDetail.interview_notes || ''}</textarea>
                        <div style="margin-top: 0.5rem;">
                            <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.2rem;">面談実施日</label>
                            <input type="date" id="modal-interview-date" value="${selectedEvalDetail.interview_date || ''}" style="padding:0.4rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
                        </div>
                    ` : `
                        <p style="margin:0; font-size:0.82rem; line-height:1.5; color:#475569; white-space:pre-wrap;">${selectedEvalDetail.interview_notes || '（面談メモはまだ登録されていません）'}</p>
                        ${selectedEvalDetail.interview_date ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:0.5rem;"><i class="fas fa-calendar"></i> 面談日: ${selectedEvalDetail.interview_date}</div>` : ''}
                    `}
                </div>
                <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border);">
                    <h5 style="margin: 0 0 0.6rem; color: #be123c; font-weight: 800;"><i class="fas fa-user-tie"></i> 社長フィードバック・総括</h5>
                    ${isPresidentMode ? `
                        <textarea id="modal-president-comment" rows="4" placeholder="社長からのフィードバックコメントを入力" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; font-family:inherit; resize:vertical;">${selectedEvalDetail.president_comment || ''}</textarea>
                        <div style="margin-top: 0.5rem; display:flex; gap:1rem; align-items:center;">
                            <div>
                                <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.2rem;">社長査定・最終確定合計点</label>
                                <input type="number" id="modal-final-score" value="${selectedEvalDetail.final_total_score || selectedEvalDetail.manager_total_score || 0}" min="0" max="120" style="padding:0.4rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; width:100px; text-align:center; font-weight:800;" onchange="window.handleFinalScoreChange(this.value)">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.2rem;">査定に基づく等級判定</label>
                                <span id="modal-new-grade-preview" style="font-size:1.1rem; font-weight:900; color:#059669; font-family:monospace;">${selectedEvalDetail.new_grade || '-'}</span>
                            </div>
                        </div>
                    ` : `
                        <p style="margin:0; font-size:0.82rem; line-height:1.5; color:#475569; white-space:pre-wrap;">${selectedEvalDetail.president_comment || '（確定コメントはまだありません）'}</p>
                    `}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        ${assistWidgetHtml}

        <!-- 評価スコアテーブル -->
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
            <table class="eval-table">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="text-align: left;">評価項目・基準説明</th>
                        <th style="text-align: center; width: 80px;">前回評価</th>
                        <th style="text-align: center; width: 200px;">自己評価点</th>
                        <th style="text-align: center; width: 200px; color:#7c3aed;">上長評価点</th>
                        <th style="text-align: left;">評価理由・フィードバックコメント</th>
                    </tr>
                </thead>
                <tbody id="modal-eval-table-body">
                    ${itemsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid var(--border);">
                        <td style="padding: 1rem; text-align: right;">合計点 (120点満点)</td>
                        <td style="padding: 1rem; text-align: center; color: #64748b;">-</td>
                        <td style="padding: 1rem; text-align: center; font-size: 1.1rem; color: #2563eb;" id="sum-self-score">${selfTotal} 点</td>
                        <td style="padding: 1rem; text-align: center; font-size: 1.1rem; color: #7c3aed;" id="sum-manager-score">${managerTotal} 点</td>
                        <td style="padding: 1rem;">-</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        ${textFieldsHtml}
        ${gradeRulePreviewHtml}
    `;

    // グローバルにスコア選択ハンドラを公開
    window.selectScore = (itemIdx, type, score) => {
        const item = selectedEvalDetail.items[itemIdx];
        if (!item) return;

        if (type === 'self') {
            item.self_score = score;
        } else if (type === 'manager') {
            item.manager_score = score;
        }

        // DOM再レンダリングを介さず合計点のみ更新してパフォーマンスを稼ぐ
        let selfSum = 0;
        let managerSum = 0;
        selectedEvalDetail.items.forEach(it => {
            selfSum += it.self_score || 0;
            managerSum += it.manager_score || 0;
        });

        selectedEvalDetail.self_total_score = selfSum;
        selectedEvalDetail.manager_total_score = managerSum;

        const sumSelfEl = document.getElementById('sum-self-score');
        const sumMgrEl = document.getElementById('sum-manager-score');
        if (sumSelfEl) sumSelfEl.textContent = `${selfSum} 点`;
        if (sumMgrEl) sumMgrEl.textContent = `${managerSum} 点`;

        // クリックしたボタンのスタイルだけを即時切り替え
        const rowEl = document.getElementById('modal-eval-table-body').children;
        // カテゴリヘッダー等をまたぐため、インデックス補正ではなく正確に対象のtrを探す
        const targetTrs = Array.from(rowEl).filter(tr => tr.style.background === 'white');
        const tr = targetTrs[itemIdx];
        if (tr) {
            const btnCellIdx = (type === 'self') ? 2 : 3;
            const buttons = tr.cells[btnCellIdx].querySelectorAll('.score-btn');
            buttons.forEach(btn => {
                const btnScore = parseInt(btn.textContent.trim());
                if (btnScore === score) {
                    btn.classList.add(type === 'self' ? 'selected-self' : 'selected-manager');
                } else {
                    btn.classList.remove(type === 'self' ? 'selected-self' : 'selected-manager');
                }
            });
        }
    };

    window.updateComment = (itemIdx, type, val) => {
        const item = selectedEvalDetail.items[itemIdx];
        if (item) {
            if (type === 'self') item.self_comment = val;
            if (type === 'manager') item.manager_comment = val;
        }
    };

    window.handleFinalScoreChange = async (val) => {
        const score = parseInt(val) || 0;
        selectedEvalDetail.final_total_score = score;
        
        // 判定等級プレビューをリアルタイムで調べる
        const newGrade = await lookupGradeByScore(score);
        selectedEvalDetail.new_grade = newGrade;
        const prevEl = document.getElementById('modal-new-grade-preview');
        if (prevEl) prevEl.textContent = newGrade;
    };
}

function renderModalFooter(container, mode) {
    const status = selectedEvalDetail.status;
    
    // 一般・被評価者
    if (mode === 'self' && status === 'self_evaluating') {
        container.innerHTML = `
            <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('self')">下書き保存</button>
            <button class="btn btn-primary" style="background:#2563eb; border-color:#2563eb; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitSelfEvaluation()">自己評価を提出する</button>
        `;
    }
    // 店長・上長
    else if (mode === 'manager') {
        if (status === 'self_submitted' || status === 'manager_evaluating') {
            container.innerHTML = `
                <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('manager')">評価を下書き保存</button>
                <button class="btn btn-primary" style="background:#7c3aed; border-color:#7c3aed; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('interviewing')">評価を確定して面談待ちへ</button>
            `;
        } else if (status === 'interviewing') {
            container.innerHTML = `
                <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('manager')">面談メモを下書き保存</button>
                <button class="btn btn-primary" style="background:#a21caf; border-color:#a21caf; color:white; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('president_pending')">面談完了・社長へ最終提出</button>
            `;
        }
    }
    // 社長・承認者
    else if (mode === 'president' && status === 'president_pending') {
        container.innerHTML = `
            <button class="btn btn-primary" style="background:#be123c; border-color:#be123c; font-weight:800; padding:0.6rem 2rem;" onclick="window.approvePresidentEvaluation()">社長査定を確定する</button>
        `;
    }
    // 閲覧モード
    else {
        container.innerHTML = `
            <button class="btn btn-secondary" onclick="document.getElementById('eval-detail-modal').style.display='none'">閉じる</button>
        `;
    }

    // 1. 自己評価の下書き保存
    window.saveEvaluationDraft = async (type) => {
        try {
            // テキストフィールドの値を同期
            if (type === 'manager') {
                const notesEl = document.getElementById('modal-interview-notes');
                const dateEl = document.getElementById('modal-interview-date');
                if (notesEl) selectedEvalDetail.interview_notes = notesEl.value;
                if (dateEl) selectedEvalDetail.interview_date = dateEl.value;
            }

            const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
            await updateDoc(docRef, {
                items: selectedEvalDetail.items,
                self_total_score: selectedEvalDetail.self_total_score,
                manager_total_score: selectedEvalDetail.manager_total_score,
                interview_notes: selectedEvalDetail.interview_notes || '',
                interview_date: selectedEvalDetail.interview_date || '',
                updated_at: new Date().toISOString()
            });
            showAlert('下書き保存', '評価シートの内容を下書き保存しました！');
            await loadEvaluationData();
            renderActiveTabContent();
        } catch (e) {
            console.error(e);
            showAlert('エラー', '保存に失敗しました。');
        }
    };

    // 2. 自己評価の提出
    window.submitSelfEvaluation = () => {
        // 全項目に点数が入っているかバリデーション
        const incomplete = selectedEvalDetail.items.some(it => !it.self_score);
        if (incomplete) {
            return showAlert('入力未完了', 'すべての評価項目（24項目）の点数を入力してください。');
        }

        showConfirm('自己評価の提出', '自己評価を提出します。提出後は変更ができなくなりますが、よろしいですか？', async () => {
            try {
                const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
                await updateDoc(docRef, {
                    items: selectedEvalDetail.items,
                    self_total_score: selectedEvalDetail.self_total_score,
                    status: 'self_submitted', // 提出完了
                    updated_at: new Date().toISOString()
                });
                document.getElementById('eval-detail-modal').style.display = 'none';
                showAlert('提出完了', '自己評価の提出が完了しました！店長による評価と面談をお待ちください。');
                await loadInitialSettingsAndData();
            } catch(e) {
                console.error(e);
                showAlert('エラー', '提出処理に失敗しました。');
            }
        });
    };

    // 3. 上長評価の提出（面談待ちへ、または社長提出へ）
    window.submitManagerEvaluation = (nextStatus) => {
        // 点数バリデーション (面談待ちへ行く時点ですべて入力されている必要がある)
        const incomplete = selectedEvalDetail.items.some(it => !it.manager_score);
        if (incomplete) {
            return showAlert('入力未完了', 'すべての評価項目（24項目）に上長評価点を入力してください。');
        }

        const notesEl = document.getElementById('modal-interview-notes');
        const dateEl = document.getElementById('modal-interview-date');
        if (notesEl) selectedEvalDetail.interview_notes = notesEl.value;
        if (dateEl) selectedEvalDetail.interview_date = dateEl.value;

        // 社長へ提出する際は面談メモが必須
        if (nextStatus === 'president_pending' && (!selectedEvalDetail.interview_notes || !selectedEvalDetail.interview_date)) {
            return showAlert('入力未完了', '面談日および面談内容（記録）を記入してください。');
        }

        const title = nextStatus === 'interviewing' ? '面談待ちへ移行' : '社長への最終提出';
        const msg = nextStatus === 'interviewing' 
            ? '評価を入力完了し、面談待ち状態にしますか？（この後部下と評価シートを見ながら面談を行ってください）'
            : '面談記録を含めて評価を社長に提出します。提出後は変更できなくなりますが、よろしいですか？';

        showConfirm(title, msg, async () => {
            try {
                const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
                await updateDoc(docRef, {
                    items: selectedEvalDetail.items,
                    manager_total_score: selectedEvalDetail.manager_total_score,
                    interview_notes: selectedEvalDetail.interview_notes || '',
                    interview_date: selectedEvalDetail.interview_date || '',
                    status: nextStatus,
                    updated_at: new Date().toISOString()
                });
                document.getElementById('eval-detail-modal').style.display = 'none';
                showAlert('完了', nextStatus === 'interviewing' ? '評価を下書き保存し、面談待ちとしました。' : '社長への最終提出が完了しました！');
                await loadInitialSettingsAndData();
            } catch(e) {
                console.error(e);
                showAlert('エラー', '送信処理に失敗しました。');
            }
        });
    };

    // 4. 社長査定の確定
    window.approvePresidentEvaluation = () => {
        const commEl = document.getElementById('modal-president-comment');
        const scoreEl = document.getElementById('modal-final-score');
        if (commEl) selectedEvalDetail.president_comment = commEl.value;
        if (scoreEl) selectedEvalDetail.final_total_score = parseInt(scoreEl.value) || 0;

        showConfirm('社長査定の確定', `このスタッフの評価・等級（新等級: ${selectedEvalDetail.new_grade}）を最終確定しますか？`, async () => {
            try {
                const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
                await updateDoc(docRef, {
                    president_comment: selectedEvalDetail.president_comment || '',
                    final_total_score: selectedEvalDetail.final_total_score,
                    new_grade: selectedEvalDetail.new_grade || '-',
                    status: 'approved', // 確定済
                    updated_at: new Date().toISOString()
                });
                document.getElementById('eval-detail-modal').style.display = 'none';
                showAlert('確定完了', '社長査定を確定しました！「全体管理ダッシュボード」から一括公開が可能です。');
                await loadInitialSettingsAndData();
            } catch(e) {
                console.error(e);
                showAlert('エラー', '確定処理に失敗しました。');
            }
        });
    };
}

// 合計点数から自動的に等級マスタを参照して適用等級キーを算出するロジック
async function lookupGradeByScore(score) {
    try {
        const snap = await getDocs(collection(db, "m_grades"));
        const grades = [];
        snap.forEach(d => {
            grades.push(d.data());
        });

        // 査定最低点と最高点のレンジに含まれるものを検索
        const matched = grades.find(g => {
            const min = g.evaluation_min_score || 0;
            const max = g.evaluation_max_score || 999;
            return score >= min && score <= max;
        });

        return matched ? (matched.grade_code || '-') : '-';
    } catch(e) {
        console.error("Lookup grade error:", e);
        return '-';
    }
}

// 英語ステータスキーの日本語表示名マッピング
function getStatusJpName(status) {
    const map = {
        'not_started': '未開始',
        'self_evaluating': '自己評価中',
        'self_submitted': '自己評価提出済',
        'manager_evaluating': '上長評価中',
        'interviewing': '面談待ち',
        'president_pending': '社長確認待ち',
        'approved': '確定済 (未公開)',
        'notified': '本人通知済 (公開済)'
    };
    return map[status] || status;
}

// ==========================================
// 6. 評価項目マスタ編集（GUIエディタ）機能
// ==========================================

async function openTemplateEditorModal() {
    const modal = document.getElementById('eval-template-modal');
    if (!modal) return;
    
    // 全テンプレートをFirestoreからロード
    try {
        const snap = await getDocs(collection(db, "m_evaluation_templates"));
        editTemplates = {};
        snap.forEach(d => {
            editTemplates[d.id] = {
                id: d.id,
                ...d.data()
            };
        });
    } catch (e) {
        console.error("Failed to load templates for editor:", e);
        showAlert("エラー", "テンプレートデータの読み込みに失敗しました。");
        return;
    }
    
    // ドロップダウンを更新
    const select = document.getElementById('select-template-type');
    if (select) {
        select.innerHTML = '';
        Object.keys(editTemplates).forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = editTemplates[id].template_name || id;
            select.appendChild(opt);
        });
        
        // 切り替えイベント
        select.onchange = async (e) => {
            const nextValue = e.target.value;
            if (checkUnsavedChanges()) {
                const confirmSwitch = await showConfirm(
                    "未保存の変更", 
                    "現在のテンプレートに変更（未保存）があります。保存せずに切り替えますか？"
                );
                if (confirmSwitch) {
                    activeEditTemplateId = nextValue;
                    loadActiveEditTemplate();
                } else {
                    select.value = activeEditTemplateId;
                }
            } else {
                activeEditTemplateId = nextValue;
                loadActiveEditTemplate();
            }
        };

        // デフォルトで一般用テンプレートを選択
        if (editTemplates['general']) {
            select.value = 'general';
        } else if (Object.keys(editTemplates).length > 0) {
            select.value = Object.keys(editTemplates)[0];
        }
        activeEditTemplateId = select.value;
    }
    
    loadActiveEditTemplate();
    modal.style.display = 'flex';
}

function loadActiveEditTemplate() {
    if (!activeEditTemplateId || !editTemplates[activeEditTemplateId]) {
        activeEditItems = [];
        renderTemplateItems();
        return;
    }
    
    const template = editTemplates[activeEditTemplateId];
    activeEditItems = JSON.parse(JSON.stringify(template.items || []));
    activeEditItems.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
    
    renderTemplateItems();
}

function renderTemplateItems() {
    const tbody = document.getElementById('template-items-tbody');
    const totalCountEl = document.getElementById('template-total-items-count');
    const warningEl = document.getElementById('template-validation-warning');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (totalCountEl) {
        totalCountEl.textContent = activeEditItems.length;
    }
    
    // 24項目バリデーション警告
    if (warningEl) {
        if (activeEditItems.length !== 24) {
            warningEl.style.display = 'flex';
        } else {
            warningEl.style.display = 'none';
        }
    }
    
    if (activeEditItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-secondary);">項目がありません。「項目を追加する」を押して作成してください。</td></tr>`;
        return;
    }
    
    activeEditItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        
        tr.innerHTML = `
            <!-- 表示順序 -->
            <td style="padding: 0.6rem 0.4rem; text-align: center;">
                <input type="number" value="${item.display_order || (index + 1)}" min="1" 
                       onchange="window.updateTemplateItemField(${index}, 'display_order', this.value)" 
                       style="width: 60px; text-align: center; padding: 0.35rem 0.2rem; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 0.8rem;">
            </td>
            <!-- カテゴリ -->
            <td style="padding: 0.6rem 0.4rem;">
                <input type="text" value="${item.category || ''}" placeholder="例: 労働管理"
                       onchange="window.updateTemplateItemField(${index}, 'category', this.value)"
                       style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.8rem;">
            </td>
            <!-- 項目名 -->
            <td style="padding: 0.6rem 0.4rem;">
                <textarea rows="2" placeholder="評価項目の内容を入力"
                          onchange="window.updateTemplateItemField(${index}, 'title', this.value)"
                          style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: vertical;">${item.title || ''}</textarea>
            </td>
            <!-- 基準説明 -->
            <td style="padding: 0.6rem 0.4rem;">
                <textarea rows="2" placeholder="具体的な評価基準を記載"
                          onchange="window.updateTemplateItemField(${index}, 'description', this.value)"
                          style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: vertical;">${item.description || ''}</textarea>
            </td>
            <!-- 操作 (削除) -->
            <td style="padding: 0.6rem 0.4rem; text-align: center;">
                <button type="button" class="btn" onclick="window.deleteTemplateItem(${index})" 
                        style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 0.4rem; border-radius: 50%; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s;"
                        onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function checkUnsavedChanges() {
    if (!activeEditTemplateId || !editTemplates[activeEditTemplateId]) return false;
    
    const originalItems = editTemplates[activeEditTemplateId].items || [];
    
    const normalize = (items) => items.map((it, idx) => ({
        category: (it.category || '').trim(),
        title: (it.title || '').trim(),
        description: (it.description || '').trim(),
        display_order: parseInt(it.display_order) || (idx + 1)
    }));
    
    return JSON.stringify(normalize(activeEditItems)) !== JSON.stringify(normalize(originalItems));
}

async function closeTemplateEditorModal() {
    if (checkUnsavedChanges()) {
        const confirmClose = await showConfirm(
            "変更の破棄",
            "編集中の変更内容が保存されていません。変更を破棄して閉じますか？"
        );
        if (confirmClose) {
            document.getElementById('eval-template-modal').style.display = 'none';
        }
    } else {
        document.getElementById('eval-template-modal').style.display = 'none';
    }
}

function addTemplateItem() {
    const nextOrder = activeEditItems.reduce((max, it) => Math.max(max, it.display_order || 0), 0) + 1;
    const nextItemId = `item_${String(activeEditItems.length + 1).padStart(2, '0')}`;
    
    activeEditItems.push({
        item_id: nextItemId,
        category: activeEditItems.length > 0 ? activeEditItems[activeEditItems.length - 1].category : '労働管理',
        title: '',
        description: '',
        display_order: nextOrder
    });
    
    renderTemplateItems();
    
    setTimeout(() => {
        const tbody = document.getElementById('template-items-tbody');
        if (tbody && tbody.lastElementChild) {
            tbody.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            tbody.lastElementChild.querySelector('textarea')?.focus();
        }
    }, 50);
}

window.updateTemplateItemField = (idx, field, val) => {
    if (!activeEditItems[idx]) return;
    if (field === 'display_order') {
        activeEditItems[idx][field] = parseInt(val) || (idx + 1);
    } else {
        activeEditItems[idx][field] = val;
    }
    
    // 項目数および警告表示を更新
    const totalCountEl = document.getElementById('template-total-items-count');
    const warningEl = document.getElementById('template-validation-warning');
    if (totalCountEl) totalCountEl.textContent = activeEditItems.length;
    if (warningEl) {
        if (activeEditItems.length !== 24) {
            warningEl.style.display = 'flex';
        } else {
            warningEl.style.display = 'none';
        }
    }
};

window.deleteTemplateItem = (idx) => {
    showConfirm("項目の削除", "この評価項目をテンプレートから削除しますか？\n(「保存する」ボタンを押すまでデータベースには反映されません)", () => {
        activeEditItems.splice(idx, 1);
        renderTemplateItems();
    });
};

window.createNewTemplate = () => {
    const templateId = prompt("新しい評価シートのID（半角英数字）を入力してください。\n（例: leader）");
    if (templateId === null) return;
    
    const cleanId = templateId.trim().toLowerCase();
    if (!cleanId || !/^[a-z0-9_]+$/.test(cleanId)) {
        return showAlert("入力エラー", "テンプレートIDは半角英数字（小文字）およびアンダースコアのみで入力してください。");
    }
    
    if (editTemplates[cleanId]) {
        return showAlert("入力エラー", "入力されたテンプレートIDはすでに存在しています。");
    }
    
    const templateName = prompt("新しい評価シートの表示名称を入力してください。\n（例: リーダー用評価シート）");
    if (templateName === null) return;
    
    const cleanName = templateName.trim();
    if (!cleanName) {
        return showAlert("入力エラー", "表示名称を入力してください。");
    }
    
    let defaultItems = [];
    if (editTemplates['general']) {
        defaultItems = JSON.parse(JSON.stringify(editTemplates['general'].items || []));
    }
    
    editTemplates[cleanId] = {
        id: cleanId,
        template_name: cleanName,
        items: defaultItems
    };
    
    const select = document.getElementById('select-template-type');
    if (select) {
        const opt = document.createElement('option');
        opt.value = cleanId;
        opt.textContent = cleanName;
        select.appendChild(opt);
        select.value = cleanId;
        activeEditTemplateId = cleanId;
    }
    
    loadActiveEditTemplate();
    showAlert("作成成功", `新しいテンプレート「${cleanName}」を追加しました。項目を編集したあと、最後に「保存する」を押して確定させてください。`);
};

window.saveActiveTemplate = async () => {
    if (!activeEditTemplateId) return;
    
    const btnSave = document.getElementById('btn-save-template');
    if (!btnSave) return;
    
    const hasEmpty = activeEditItems.some(it => !it.category.trim() || !it.title.trim());
    if (hasEmpty) {
        return showAlert("入力エラー", "カテゴリおよび項目タイトルが空の項目があります。すべての項目を入力してください。");
    }
    
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    btnSave.disabled = true;
    
    try {
        const docRef = doc(db, "m_evaluation_templates", activeEditTemplateId);
        const templateName = editTemplates[activeEditTemplateId]?.template_name || activeEditTemplateId;
        
        await setDoc(docRef, {
            template_name: templateName,
            items: activeEditItems.map((item, idx) => ({
                item_id: item.item_id || `item_${String(idx + 1).padStart(2, '0')}`,
                category: item.category.trim(),
                title: item.title.trim(),
                description: (item.description || '').trim(),
                display_order: parseInt(item.display_order) || (idx + 1)
            }))
        });
        
        editTemplates[activeEditTemplateId].items = JSON.parse(JSON.stringify(activeEditItems));
        showAlert("保存成功", `評価項目マスタ「${templateName}」を保存しました！`);
        
    } catch (e) {
        console.error("Failed to save template:", e);
        showAlert("エラー", "評価項目の保存に失敗しました。");
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
};

window.toggleAllEvalUsers = function(checked) {
    document.querySelectorAll('.eval-user-checkbox').forEach(cb => cb.checked = checked);
};

window.selectOnlySelfForEval = function(myId) {
    document.querySelectorAll('.eval-user-checkbox').forEach(cb => {
        cb.checked = (cb.value === myId);
    });
};
