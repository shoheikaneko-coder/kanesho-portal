import { db } from './firebase.js';
import { collection, getDocs, getDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert } from './ui_utils.js';

// --- State Variables for Mobile ---
let mobilePeriodSettings = null;
let mobileActiveEvaluations = [];
let mobileMyEvaluation = null;
let mobileSubordinateUsers = [];
let mobileActiveTab = 'self'; // 'self' or 'subordinates'
let mobileAllPastHistory = [];

export const evaluationPageHtmlMobile = `
    <style>
        .eval-mob-container {
            background-color: #f8fafc;
            min-height: calc(100vh - 60px);
            padding-bottom: 80px; /* Space for bottom nav if any */
            font-family: 'Inter', sans-serif;
        }
        .eval-mob-header {
            background: white;
            padding: 1rem;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 10px rgba(0,0,0,0.03);
        }
        /* Segmented Control */
        .eval-mob-segmented-control {
            display: flex;
            background: #f1f5f9;
            border-radius: 12px;
            padding: 4px;
        }
        .eval-mob-segment {
            flex: 1;
            text-align: center;
            padding: 0.6rem 0;
            font-size: 0.9rem;
            font-weight: 700;
            color: #64748b;
            border-radius: 10px;
            transition: all 0.2s;
        }
        .eval-mob-segment.active {
            background: white;
            color: #1e293b;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .eval-mob-content {
            padding: 1rem;
        }
        
        /* Hero Card */
        .eval-mob-hero-card {
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.04);
            margin-bottom: 1.5rem;
            border: 1px solid #f1f5f9;
        }
        .eval-mob-hero-title {
            font-size: 1.1rem;
            font-weight: 800;
            color: #1e293b;
            margin-bottom: 0.5rem;
        }
        .eval-mob-badge {
            display: inline-block;
            padding: 0.3rem 0.6rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            margin-bottom: 1rem;
        }
        .badge-waiting { background: #fee2e2; color: #b91c1c; }
        .badge-active { background: #dbeafe; color: #1d4ed8; }
        .badge-done { background: #dcfce7; color: #15803d; }
        
        .eval-mob-hero-info {
            font-size: 0.85rem;
            color: #64748b;
            margin-bottom: 1.2rem;
            line-height: 1.5;
        }
        
        .eval-mob-btn-primary {
            display: block;
            width: 100%;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 1rem;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 700;
            text-align: center;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            transition: opacity 0.2s;
        }
        .eval-mob-btn-primary:active { opacity: 0.8; }
        
        .eval-mob-btn-secondary {
            display: block;
            width: 100%;
            background: white;
            color: #3b82f6;
            border: 2px solid #e2e8f0;
            padding: 1rem;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 700;
            text-align: center;
            transition: background 0.2s;
        }
        .eval-mob-btn-secondary:active { background: #f8fafc; }
        
        /* Section Title */
        .eval-mob-section-title {
            font-size: 1.1rem;
            font-weight: 800;
            color: #1e293b;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        /* History / Subordinate List Cards */
        .eval-mob-list-card {
            background: white;
            border-radius: 12px;
            padding: 1.2rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.03);
            margin-bottom: 0.8rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid #f1f5f9;
        }
        .eval-mob-list-info h4 {
            margin: 0 0 0.3rem 0;
            font-size: 1rem;
            font-weight: 700;
            color: #1e293b;
        }
        .eval-mob-list-info p {
            margin: 0;
            font-size: 0.8rem;
            color: #64748b;
        }
        .eval-mob-list-action {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 0.4rem;
        }
        .eval-mob-score {
            font-size: 1.1rem;
            font-weight: 800;
            color: #0f172a;
        }
        .eval-mob-grade {
            font-size: 1.2rem;
            font-weight: 900;
            color: #10b981;
        }
        .eval-mob-chevron {
            color: #cbd5e1;
            font-size: 1.2rem;
        }
        .eval-mob-sub-btn {
            background: #eff6ff;
            color: #3b82f6;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 700;
        }
        .eval-mob-sub-btn.done {
            background: #f1f5f9;
            color: #64748b;
        }
        
        /* Loading */
        .eval-mob-loading {
            text-align: center;
            padding: 3rem 1rem;
            color: #94a3b8;
        }
        
        /* Utilities */
        .d-none { display: none !important; }
    </style>
    
    <div class="eval-mob-container">
        <!-- Header (Segmented Control) -->
        <div class="eval-mob-header" id="eval-mob-header-wrapper" style="display: none;">
            <div class="eval-mob-segmented-control" id="eval-mob-segmented-control">
                <div class="eval-mob-segment active" data-tab="self">自分の評価</div>
                <div class="eval-mob-segment" data-tab="subordinates">部下の評価</div>
            </div>
        </div>
        
        <!-- Content Area -->
        <div class="eval-mob-content" id="eval-mob-content-area">
            <div class="eval-mob-loading">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <div style="margin-top: 1rem; font-size: 0.9rem; font-weight: 700;">データを読み込んでいます...</div>
            </div>
        </div>
    </div>
`;

export async function initEvaluationPageMobile() {
    console.log("Mobile Evaluation Page Initialized.");
    
    // Bind Tab Switching
    document.getElementById('eval-mob-header-wrapper').addEventListener('click', (e) => {
        if (e.target.classList.contains('eval-mob-segment')) {
            document.querySelectorAll('.eval-mob-segment').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            mobileActiveTab = e.target.dataset.tab;
            renderMobileView();
        }
    });
    
    // Load Data
    await loadInitialDataMobile();
    
    // Render initial view
    renderMobileView();
}

async function loadInitialDataMobile() {
    const user = window.appState.currentUser;
    if (!user) {
        // Retry logic for SPA
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 200));
            if (window.appState.currentUser) break;
        }
        if (!window.appState.currentUser) return;
    }
    const currentUser = window.appState.currentUser;
    
    try {
        // 1. Fetch current settings
        const setSnap = await getDoc(doc(db, "settings", "evaluation"));
        if (setSnap.exists()) {
            mobilePeriodSettings = setSnap.data();
        }
        
        // 2. Fetch subordinate users (same logic as PC)
        mobileSubordinateUsers = [];
        const uSnap = await getDocs(collection(db, "users"));
        const allUsers = [];
        uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
        
        const role = currentUser.Role || 'Staff';
        const myStore = currentUser.StoreID || currentUser.StoreId;
        const myJob = currentUser.JobTitle || '';
        
        mobileSubordinateUsers = allUsers.filter(u => {
            if (u.id === currentUser.id && role !== 'Admin' && role !== '管理者') return false;
            if (u.Status === 'retired' || u.Status === '退職済') return false;
            if (role === 'Admin' || role === '管理者') return true;
            
            if ((u.StoreID || u.StoreId) !== myStore) return false;
            
            const uJob = u.JobTitle || '';
            if (myJob !== '店長' && myJob !== '統括店長') {
                if (uJob === '店長' || uJob === '統括店長') return false;
            }
            if (myJob === '一般社員' || myJob === 'アルバイト' || myJob === '社員') {
                if (uJob === '店長' || uJob === '統括店長' || uJob === '副店長') return false;
            }
            
            return true;
        });
        
        // Show segmented control if has subordinates (Admin/Managers)
        if (mobileSubordinateUsers.length > 0) {
            document.getElementById('eval-mob-header-wrapper').style.display = 'block';
        }
        
        // 3. Fetch active evaluations for the current period
        mobileActiveEvaluations = [];
        mobileMyEvaluation = null;
        if (mobilePeriodSettings && mobilePeriodSettings.status !== 'closed' && mobilePeriodSettings.active_period) {
            const eSnap = await getDocs(query(collection(db, "t_evaluations"), where("period", "==", mobilePeriodSettings.active_period)));
            eSnap.forEach(d => {
                const eData = { id: d.id, ...d.data() };
                mobileActiveEvaluations.push(eData);
                if (eData.user_id === currentUser.id) {
                    mobileMyEvaluation = eData;
                }
            });
        }
        
        // 4. Fetch past history for current user
        mobileAllPastHistory = [];
        const histSnap = await getDocs(query(collection(db, "t_evaluations"), where("user_id", "==", currentUser.id)));
        histSnap.forEach(d => {
            const hData = { id: d.id, ...d.data() };
            if (hData.status === 'approved' || hData.status === 'notified' || hData.is_legacy_archive) {
                // If it's not the current period, add to history
                if (!mobilePeriodSettings || hData.period !== mobilePeriodSettings.active_period) {
                    mobileAllPastHistory.push(hData);
                }
            }
        });
        mobileAllPastHistory.sort((a, b) => b.period.localeCompare(a.period));
        
    } catch (error) {
        console.error("Error loading mobile evaluation data:", error);
        document.getElementById('eval-mob-content-area').innerHTML = '<div style="padding: 2rem; color: #ef4444; text-align: center;">エラーが発生しました。</div>';
    }
}

function renderMobileView() {
    const container = document.getElementById('eval-mob-content-area');
    
    if (mobileActiveTab === 'self') {
        container.innerHTML = generateSelfViewHtml();
    } else if (mobileActiveTab === 'subordinates') {
        container.innerHTML = generateSubordinatesViewHtml();
    }
    
    // Bind Action Buttons
    bindMobileActionButtons(container);
}

function generateSelfViewHtml() {
    let html = '';
    
    // --- Hero Card (Current Evaluation) ---
    if (!mobilePeriodSettings || mobilePeriodSettings.status === 'closed') {
        html += `
            <div class="eval-mob-hero-card">
                <div style="text-align: center; padding: 1rem 0;">
                    <i class="fas fa-check-circle fa-2x" style="color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <div class="eval-mob-hero-title">現在実施中の評価はありません</div>
                </div>
            </div>
        `;
    } else {
        let badgeClass = 'badge-waiting';
        let statusText = '未開始';
        let btnHtml = '';
        
        if (mobileMyEvaluation) {
            const st = mobileMyEvaluation.status;
            if (st === 'open' || st === 'evaluating') {
                statusText = '自己評価 入力待ち';
                badgeClass = 'badge-active';
                btnHtml = `<button class="eval-mob-btn-primary action-mock-btn" data-type="self-input">自己評価を入力する</button>`;
            } else if (st === 'manager_evaluating') {
                statusText = '一次評価中';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            } else if (st === 'president_review') {
                statusText = '社長査定中';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            } else if (st === 'approved' || st === 'notified') {
                statusText = '確定済';
                badgeClass = 'badge-done';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">結果を確認</button>`;
            }
        } else {
            statusText = '対象外';
        }
        
        html += `
            <div class="eval-mob-hero-card">
                <div class="eval-mob-badge ${badgeClass}">${statusText}</div>
                <div class="eval-mob-hero-title">${mobilePeriodSettings.active_period} 評価</div>
                <div class="eval-mob-hero-info">
                    提出期限: ${mobilePeriodSettings.deadline || '未定'}<br>
                </div>
                ${btnHtml}
            </div>
        `;
    }
    
    // --- Past History ---
    html += `
        <div class="eval-mob-section-title">
            <i class="fas fa-history" style="color: #64748b;"></i> 過去の履歴
        </div>
    `;
    
    if (mobileAllPastHistory.length === 0) {
        html += `<div style="text-align:center; padding: 2rem; color: #94a3b8; font-size: 0.9rem;">過去の評価履歴はありません</div>`;
    } else {
        mobileAllPastHistory.forEach(h => {
            const isLegacy = h.is_legacy_archive ? '<span style="background: #cbd5e1; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 0.4rem;">手入力</span>' : '';
            const score = h.final_total_score || h.manager_total_score || h.self_total_score || '-';
            const grade = h.new_grade || '-';
            
            html += `
                <div class="eval-mob-list-card action-mock-btn" data-type="history-view">
                    <div class="eval-mob-list-info">
                        <h4>${h.period}期 ${isLegacy}</h4>
                        <p>スコア: ${score}点</p>
                    </div>
                    <div class="eval-mob-list-action" style="flex-direction: row; align-items: center; gap: 1rem;">
                        <div class="eval-mob-grade">${grade}</div>
                        <i class="fas fa-chevron-right eval-mob-chevron"></i>
                    </div>
                </div>
            `;
        });
    }
    
    return html;
}

function generateSubordinatesViewHtml() {
    let html = `
        <div class="eval-mob-section-title" style="justify-content: space-between;">
            <div><i class="fas fa-users" style="color: #64748b;"></i> 部下の評価</div>
        </div>
    `;
    
    if (mobileSubordinateUsers.length === 0) {
        return html + `<div style="text-align:center; padding: 2rem; color: #94a3b8; font-size: 0.9rem;">対象の部下がいません</div>`;
    }
    
    // Extract relevant active evaluations for subordinates
    const subEvals = mobileSubordinateUsers.map(u => {
        const ev = mobileActiveEvaluations.find(e => e.user_id === u.id);
        return { user: u, evaluation: ev };
    });
    
    subEvals.forEach(item => {
        const u = item.user;
        const ev = item.evaluation;
        let statusText = '未開始';
        let actionBtnHtml = '';
        
        if (ev) {
            if (ev.status === 'open' || ev.status === 'evaluating') {
                statusText = '本人入力待ち';
                actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view">確認</button>`;
            } else if (ev.status === 'manager_evaluating') {
                statusText = '<span style="color:#ef4444;">店長評価 待ち</span>';
                actionBtnHtml = `<button class="eval-mob-sub-btn action-mock-btn" data-type="sub-input">入力する</button>`;
            } else {
                statusText = '店長評価 完了';
                actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view">確認</button>`;
            }
        }
        
        html += `
            <div class="eval-mob-list-card">
                <div class="eval-mob-list-info">
                    <h4>${u.Name}</h4>
                    <p>${u.StoreId || '所属なし'} / ${u.Department === 'sales' ? '営業' : '製造'}</p>
                    <p style="margin-top: 0.3rem; font-weight: 700;">状態: ${statusText}</p>
                </div>
                <div class="eval-mob-list-action">
                    ${actionBtnHtml}
                </div>
            </div>
        `;
    });
    
    return html;
}

function bindMobileActionButtons(container) {
    container.querySelectorAll('.action-mock-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = e.currentTarget.dataset.type;
            
            let msg = 'この画面は現在準備中です。PC版をご利用ください。';
            if (type === 'self-input') msg = '【自己評価入力画面】へ遷移します。\n（※次回のステップで構築します）';
            if (type === 'self-view') msg = '【自己評価確認画面】へ遷移します。\n（※次回のステップで構築します）';
            if (type === 'history-view') msg = '【過去の履歴詳細画面】へ遷移します。\n（※次回のステップで構築します）';
            if (type === 'sub-input') msg = '【一次評価（店長）入力画面】へ遷移します。\n（※次回のステップで構築します）';
            if (type === 'sub-view') msg = '【部下評価確認画面】へ遷移します。\n（※次回のステップで構築します）';
            
            showAlert('開発中', msg);
        });
    });
}
