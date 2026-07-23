import { db } from './firebase.js';
import { collection, getDocs, getDoc, doc, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert } from './ui_utils.js';

// --- State Variables for Mobile ---
let mobilePeriodSettings = null;
let mobileActiveEvaluations = [];
let mobileMyEvaluation = null;
let mobileSubordinateUsers = [];
let mobileActiveTab = 'self'; // 'self' or 'subordinates'
let mobileAllPastHistory = [];
let mobileEditingEval = null;

export const evaluationPageHtmlMobile = `
    <style>
        .eval-mob-container {
            background-color: #f8fafc;
            min-height: calc(100dvh - 60px);
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
        
        
        /* Input Screen Styles */
        .eval-mob-input-screen {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: #f8fafc;
            z-index: 100000;
            overflow-y: auto;
            padding-bottom: 100px;
        }
        .eval-mob-input-header {
            position: sticky;
            top: 0;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            padding: 1rem;
            z-index: 1010;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .eval-mob-progress-container {
            background: #e2e8f0;
            height: 6px;
            border-radius: 3px;
            margin-top: 0.5rem;
            width: 100%;
            overflow: hidden;
        }
        .eval-mob-progress-fill {
            background: #2563eb;
            height: 100%;
            width: 0%;
            transition: width 0.3s ease;
        }
        .eval-mob-input-card {
            background: white;
            margin: 1rem;
            border-radius: 16px;
            padding: 1.2rem;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
        }
        .eval-mob-cat-badge {
            display: inline-block;
            background: #e0f2fe;
            color: #0284c7;
            font-size: 0.75rem;
            font-weight: 800;
            padding: 0.3rem 0.6rem;
            border-radius: 99px;
            margin-bottom: 0.8rem;
        }
        .eval-mob-item-title {
            font-size: 1.1rem;
            font-weight: 900;
            color: #0f172a;
            margin-bottom: 0.5rem;
        }
        .eval-mob-item-desc {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 0.8rem;
            border-radius: 8px;
            font-size: 0.85rem;
            color: #475569;
            line-height: 1.5;
            margin-bottom: 1.2rem;
        }
        .eval-mob-rating-group {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1.2rem;
        }
        .eval-mob-rating-btn {
            width: 45px;
            height: 45px;
            border-radius: 50%;
            border: 1px solid #cbd5e1;
            background: white;
            color: #475569;
            font-size: 1.1rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .eval-mob-rating-btn.selected {
            background: #2563eb;
            border-color: #2563eb;
            color: white;
            transform: scale(1.1);
            box-shadow: 0 4px 10px rgba(37,99,235,0.3);
        }
        .eval-mob-comment {
            width: 100%;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 0.8rem;
            font-size: 0.9rem;
            font-family: inherit;
            resize: vertical;
            min-height: 80px;
        }
        .eval-mob-bottom-bar {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 1rem;
            padding-bottom: 35px;
            box-shadow: 0 -4px 6px -1px rgba(0,0,0,0.05);
            display: flex;
            gap: 1rem;
            z-index: 1010;
        }
        .eval-mob-btn-save {
            flex: 1;
            background: white;
            border: 1px solid #cbd5e1;
            color: #475569;
            font-weight: 800;
            padding: 0.8rem;
            border-radius: 12px;
        }
        .eval-mob-btn-submit {
            flex: 2;
            background: #2563eb;
            border: none;
            color: white;
            font-weight: 800;
            padding: 0.8rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(37,99,235,0.2);
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
        <div class="eval-mob-input-screen" id="eval-mob-input-screen" style="display: none;"></div>
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
        
        // マスタロード
        let gradeMap = {};
        let routeMap = {};
        try {
            const gradesSnap = await getDocs(collection(db, "m_grades"));
            gradesSnap.forEach(d => {
                const data = d.data();
                if (data.grade_code) gradeMap[data.grade_code] = data;
            });
            const routesSnap = await getDocs(collection(db, "m_evaluation_routes"));
            routesSnap.forEach(d => {
                routeMap[d.id] = d.data();
            });
        } catch(e) { console.error("Failed to load grades or routes for mobile:", e); }

        const uSnap = await getDocs(collection(db, "m_users"));
        const allUsers = [];
        uSnap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
        
        const role = currentUser.Role || 'Staff';
        const myStore = currentUser.StoreID || currentUser.StoreId;
        
        let myJobTitle = '';
        window.appState.gradeMap = gradeMap;
        if (currentUser.GradeCode && gradeMap[currentUser.GradeCode]) {
            myJobTitle = gradeMap[currentUser.GradeCode].job_title || '';
        }
        window.appState.myJobTitle = myJobTitle;
        
        const isAdmin = role === 'Admin' || role === '管理者';
        
        if (isAdmin) {
            mobileSubordinateUsers = allUsers.filter(u => {
                if (u.id === currentUser.id) return true; // 管理者はテストのため自身も表示可能
                if (u.Status === 'retired' || u.Status === '退職済') return false;
                return true;
            });
        } else if (myJobTitle) {
            mobileSubordinateUsers = allUsers.filter(u => {
                if (u.id === currentUser.id) return false;
                if (u.Status === 'retired' || u.Status === '退職済') return false;
                if ((u.StoreID || u.StoreId) !== myStore) return false;
                
                if (!u.GradeCode || !gradeMap[u.GradeCode]) return false;
                const uJobTitle = gradeMap[u.GradeCode].job_title;
                if (!uJobTitle) return false;
                
                const uRoute = routeMap[uJobTitle];
                if (!uRoute) return false;
                
                const isEvaluator = uRoute.primary_evaluator === myJobTitle || uRoute.secondary_evaluator === myJobTitle;
                
                if (myJobTitle === '店長' || myJobTitle === '統括店長') {
                    if (uJobTitle === '店長' || uJobTitle === '統括店長') return false;
                    return true;
                }
                
                return isEvaluator;
            });
        }

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
                // If the period is not closed, the active period is shown at the top, so exclude it from history
                const isCurrentActive = mobilePeriodSettings && mobilePeriodSettings.status !== 'closed' && hData.period === mobilePeriodSettings.active_period;
                if (!isCurrentActive) {
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
            const isSelfSub = mobileMyEvaluation.is_self_submitted || (mobileMyEvaluation.self_total_score > 0);
            
            if (st === 'approved' || st === 'notified') {
                statusText = '確定済';
                badgeClass = 'badge-done';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">結果を確認</button>`;
            } else if (st === 'president_review' || st === 'president_pending') {
                statusText = '社長査定中';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            } else if (st === 'interviewing') {
                statusText = '面談待ち';
                badgeClass = 'badge-active';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            } else if (isSelfSub) {
                statusText = '提出済';
                badgeClass = 'badge-done';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            } else {
                statusText = '自己評価 入力待ち';
                badgeClass = 'badge-active';
                btnHtml = `<button class="eval-mob-btn-primary action-mock-btn" data-type="self-input">自己評価を入力する</button>`;
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
            const evaluator = h.evaluator_name || '管理者(記録なし)';
            
            html += `
                <div class="eval-mob-list-card action-mock-btn" data-type="history-view" style="display: flex; flex-direction: column; padding: 1.2rem; align-items: stretch; gap: 0.8rem; background: white; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 0.8rem; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <div style="font-weight: 800; color: #1e293b; font-size: 1.05rem;"><i class="fas fa-clock" style="color:#94a3b8; margin-right:4px;"></i> ${h.period}期 ${isLegacy}</div>
                        <div style="font-family: monospace; font-size: 1.2rem; font-weight: 900; color: #059669;">${grade}</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">
                            最終評価者: <span style="color:#1e293b;">${evaluator}</span>
                        </div>
                        <div style="font-size: 0.9rem; font-weight: 700; color: #be123c;">
                            <span style="font-size:0.75rem; color:#94a3b8; font-weight:600;">確定点数 </span>${score}点
                        </div>
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
    
    // Extract relevant active evaluations for subordinates and filter out non-targets
    const targetUsers = [];
    mobileSubordinateUsers.forEach(u => {
        const ev = mobileActiveEvaluations.find(e => e.user_id === u.id);
        if (!ev) return; // Exclude users without active evaluation document
        if (ev.status === 'president_pending' || ev.status === 'approved' || ev.status === 'notified') {
            return; // Exclude users who are already past the manager evaluation phase
        }
        targetUsers.push({ user: u, evaluation: ev });
    });
    
    if (targetUsers.length === 0) {
        return html + `<div style="text-align:center; padding: 2rem; color: #94a3b8; font-size: 0.9rem;">現在、進行中の評価対象スタッフはいません</div>`;
    }
    
    targetUsers.forEach(item => {
        const u = item.user;
        const ev = item.evaluation;
        let statusText = '未開始';
        let actionBtnHtml = '';
        
        if (ev) {
            const wf = ev.workflow || {};
            const myJobTitle = window.appState.myJobTitle || window.appState.currentUser.JobTitle;
            const isPrimary = wf.primary_evaluator === myJobTitle;
            const isManager = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (window.appState.currentUser.Role === 'Manager' || window.appState.currentUser.Role === '店長'));
            
            let role = null;
            if (isPrimary && ['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted'].includes(ev.status)) role = 'primary';
            else if (isManager && ['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating', 'interviewing'].includes(ev.status)) role = 'manager';

            
            const isMySub = role === 'primary' ? ev.is_primary_submitted : ev.is_manager_submitted;
            const hasPrimary = !!wf.primary_evaluator;
            
            if (role && !isMySub) {
                // I haven't submitted yet
                if (ev.status === 'open' || ev.status === 'evaluating' || ev.status === 'self_evaluating') {
                    statusText = '本人入力待ち';
                } else {
                    statusText = '<span style="color:#ef4444;">評価入力 待ち</span>';
                }
                actionBtnHtml = `<button class="eval-mob-sub-btn action-mock-btn" data-type="sub-input" data-id="${ev.id}" data-role="${role}">入力する</button>`;
            } else {
                // I have submitted or I don't have a role
                if (!ev.is_self_submitted) {
                    statusText = '本人入力待ち';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">自己評価未入力</button>`;
                } else if (hasPrimary && !ev.is_primary_submitted) {
                    statusText = '1次評価 入力待ち';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">他の評価者が未入力</button>`;
                } else if (ev.status === 'interviewing') {
                    if (role === 'manager') {
                        statusText = '面談待ち';
                        actionBtnHtml = `<button class="eval-mob-sub-btn action-mock-btn" style="background:#059669; color:white; border-color:#059669;" data-type="interview-input" data-id="${ev.id}">面談実施</button>`;
                    } else {
                        statusText = '面談待ち';
                        actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">面談待ち</button>`;
                    }
                } else if (ev.status === 'president_pending') {
                    statusText = '社長確認待ち';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">確認</button>`;
                } else if (ev.status === 'approved' || ev.status === 'notified') {
                    statusText = '評価完了';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">確認</button>`;
                } else {
                    // Fallback
                    statusText = '入力待ち';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">確認</button>`;
                }
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
            if (type === 'self-input') return openMobileInputView('self', mobileMyEvaluation);
            if (type === 'self-view') msg = '【自己評価確認画面】へ遷移します。\n（※次回のステップで構築します）';
            if (type === 'history-view') msg = '【過去の履歴詳細画面】へ遷移します。\n（※次回のステップで構築します）';
            if (type === 'sub-input') {
                const evalId = e.currentTarget.dataset.id;
                const role = e.currentTarget.dataset.role;
                const evData = mobileActiveEvaluations.find(ev => ev.id === evalId);
                if (evData) return openMobileInputView(role, evData);
                return;
            }
            if (type === 'interview-input') {
                const evalId = e.currentTarget.dataset.id;
                const evData = mobileActiveEvaluations.find(ev => ev.id === evalId);
                if (evData) return openMobileInputView('interview', evData);
                return;
            }
            if (type === 'sub-view') {
                const evalId = e.currentTarget.dataset.id;
                const evData = mobileActiveEvaluations.find(ev => ev.id === evalId);
                if (evData) return openMobileInputView('interview', evData, true);
                return;
            }
            
            showAlert('開発中', msg);
        });
    });
}


// ==========================================
// Mobile Input View Logic
// ==========================================

function openMobileInputView(mode, evalData, isReadOnly = false) {
    document.body.style.overflow = 'hidden';
    const inputScreen = document.getElementById('eval-mob-input-screen');
    document.body.appendChild(inputScreen);
    const globalFab = document.getElementById('fab-main-btn');
    if (globalFab) globalFab.style.display = 'none';
    mobileEditingEval = JSON.parse(JSON.stringify(evalData)); // Deep copy for editing
    mobileEditingEval.currentMode = mode;
    mobileEditingEval.isReadOnly = isReadOnly;
    const contentArea = document.getElementById('eval-mob-content-area');
    const headerArea = document.getElementById('eval-mob-header-wrapper');
    
    inputScreen.innerHTML = generateInputHtml(mode, isReadOnly);
    inputScreen.style.display = 'block';
    contentArea.style.display = 'none';
    headerArea.style.display = 'none';
    
    bindMobileInputEvents(mode);
    updateMobileProgress();
    window.scrollTo(0, 0);
}

function closeMobileInputView() {
    document.body.style.overflow = '';
    const globalFab = document.getElementById('fab-main-btn');
    if (globalFab) globalFab.style.display = '';
    const inputScreen = document.getElementById('eval-mob-input-screen');
    const contentArea = document.getElementById('eval-mob-content-area');
    const headerArea = document.getElementById('eval-mob-header-wrapper');
    
    inputScreen.style.display = 'none';
    contentArea.style.display = 'block';
    headerArea.style.display = 'block';
    mobileEditingEval = null;
}


function generateInputHtml(mode, isReadOnly = false) {
    let titleText = mobilePeriodSettings.active_period + '自己評価入力';
    let subtitleText = '';
    
    if (mode === 'primary') {
        titleText = mobilePeriodSettings.active_period + ' 1次評価入力';
        subtitleText = `<div style="font-size:0.85rem; color:#be123c; font-weight:700; margin-bottom:0.2rem;">対象者: ${mobileEditingEval.user_name || '一般'}</div>`;
    } else if (mode === 'manager') {
        titleText = mobilePeriodSettings.active_period + ' 最終評価入力';
        subtitleText = `<div style="font-size:0.85rem; color:#be123c; font-weight:700; margin-bottom:0.2rem;">対象者: ${mobileEditingEval.user_name || '一般'}</div>`;
    } else if (mode === 'interview') {
        titleText = mobilePeriodSettings.active_period + ' 面談実施';
        subtitleText = `<div style="font-size:0.85rem; color:#be123c; font-weight:700; margin-bottom:0.2rem;">対象者: ${mobileEditingEval.user_name || '一般'}</div>`;
    }
    
    let html = `
        <div class="eval-mob-input-header">
            <div style="flex:1;">
                <button class="btn" style="background:none; border:none; color:#64748b; font-size:1.2rem; padding:0;" id="btn-mob-input-close"><i class="fas fa-times"></i></button>
            </div>
            <div style="flex:4; text-align:center;">
                ${subtitleText}
                <div style="font-weight:900; color:#0f172a; font-size: 0.95rem;">${titleText}</div>
                ${mode !== 'interview' ? `
                <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;" id="mob-progress-text">0 / ${mobileEditingEval.items.length} 項目完了</div>
                <div class="eval-mob-progress-container">
                    <div class="eval-mob-progress-fill" id="mob-progress-fill"></div>
                </div>
                ` : ''}
            </div>
            <div style="flex:1;"></div>
        </div>
        <div style="padding-top: 1rem;">
    `;
    
    mobileEditingEval.items.forEach((item, idx) => {
        let currentScore = item.self_score;
        let currentComment = item.self_comment || '';
        
        if (mode === 'primary') {
            currentScore = item.primary_score;
            currentComment = item.primary_comment || '';
        } else if (mode === 'manager') {
            currentScore = item.manager_score;
            currentComment = item.manager_comment || '';
        }
        
        html += `
            <div class="eval-mob-input-card" id="mob-card-${idx}">
                <div class="eval-mob-cat-badge">${item.category}</div>
                <div class="eval-mob-item-title">${item.title || ''}</div>
                <div class="eval-mob-item-desc">${(item.description || '').replace(/\n/g, '<br>')}</div>
        `;
        
        if (mode === 'interview') {
            const hasPrimary = !!(mobileEditingEval.workflow && mobileEditingEval.workflow.primary_evaluator);
            const hasAnyComment = !!(item.self_comment || item.primary_comment || item.manager_comment);
            
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:0.8rem; border-radius:8px; margin-top:1rem; border:1px solid #e2e8f0;">
                    <div style="text-align:center; flex:1; border-right:1px solid #e2e8f0;">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:700;">本人</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#1e293b; margin-top:0.2rem;">${item.self_score || '-'} <span style="font-size:0.7rem;">点</span></div>
                    </div>
                    ${hasPrimary ? `
                    <div style="text-align:center; flex:1; border-right:1px solid #e2e8f0;">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:700;">1次</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#1e293b; margin-top:0.2rem;">${item.primary_score || '-'} <span style="font-size:0.7rem;">点</span></div>
                    </div>
                    ` : ''}
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:700;">最終</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#be123c; margin-top:0.2rem;">${item.manager_score || '-'} <span style="font-size:0.7rem;">点</span></div>
                    </div>
                </div>
            `;
            
            if (hasAnyComment) {
                html += `
                <div style="margin-top:0.8rem; text-align:right;">
                    <button class="btn eval-mob-comment-bubble-btn" data-idx="${idx}" style="background:#059669; border:none; color:white; padding:0.4rem 0.8rem; border-radius:20px; font-size:0.8rem; font-weight:700; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <i class="fas fa-comment-dots"></i> コメントを確認
                    </button>
                </div>
                `;
            }
        } else {
            html += `
                <div class="eval-mob-rating-group" data-idx="${idx}">
                    ${[1,2,3,4,5].map(score => `
                        <button class="eval-mob-rating-btn ${currentScore === score ? 'selected' : ''}" data-score="${score}">${score}</button>
                    `).join('')}
                </div>
                <textarea class="eval-mob-comment" id="mob-comment-${idx}" placeholder="評価理由などを入力（任意）">${currentComment}</textarea>
            `;
        }
        
        html += `
            </div>
        `;
    });
    
    if (mode === 'interview') {
        html += `
            <div class="eval-mob-input-card" style="border: 2px solid #059669; padding-bottom: 2rem;">
                <h4 style="color:#059669; font-weight:800; margin-bottom:1rem;"><i class="fas fa-edit"></i> 面談記録</h4>
                <label style="font-size:0.8rem; font-weight:700; color:#475569; display:block; margin-bottom:0.3rem;">面談実施日</label>
                <input type="date" id="mob-interview-date" value="${mobileEditingEval.interview_date || ''}" style="width:100%; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; margin-bottom:1.2rem; font-family:inherit;" ${isReadOnly ? 'readonly' : ''}>
                
                <label style="font-size:0.8rem; font-weight:700; color:#475569; display:block; margin-bottom:0.3rem;">面談メモ（話し合った内容など）</label>
                <textarea id="mob-interview-notes" rows="5" placeholder="面談で話し合った内容や育成方針を記入" style="width:100%; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.95rem; font-family:inherit; resize:none;" ${isReadOnly ? 'readonly' : ''}>${mobileEditingEval.interview_notes || ''}</textarea>
            </div>
        `;
        if (mobileEditingEval.president_comment) {
            html += `
                <div class="eval-mob-input-card" style="border: 2px solid #be123c; margin-top: 1rem;">
                    <h4 style="color:#be123c; font-weight:800; margin-bottom:1rem;"><i class="fas fa-user-tie"></i> 社長フィードバック・総括</h4>
                    <p style="font-size:0.9rem; color:#334155; white-space:pre-wrap; margin:0;">${mobileEditingEval.president_comment}</p>
                </div>
            `;
        }

    }
    
    html += `
        </div>
        <div class="eval-mob-bottom-bar">
            ${mode === 'interview' ? `
            ${isReadOnly ? `<button class="eval-mob-btn-submit" id="btn-mob-close-only" style="flex:1; background:#64748b; border-color:#64748b;">閉じる</button>` : `<button class="eval-mob-btn-save" id="btn-mob-save-draft" style="flex:1;">下書き保存</button>
            <button class="eval-mob-btn-submit" id="btn-mob-submit" style="flex:2; background:#059669; border-color:#059669;">面談完了・提出</button>`}
            ` : `
            <button class="eval-mob-btn-save" id="btn-mob-save-draft">下書き保存</button>
            <button class="eval-mob-btn-submit" id="btn-mob-submit">入力を完了する</button>
            `}
        </div>
    `;
    
    return html;
}


function updateMobileProgress() {
    if (!mobileEditingEval || !mobileEditingEval.items) return;
    const total = mobileEditingEval.items.length;
    let answered = 0;
    if (mobileEditingEval.currentMode === 'primary') answered = mobileEditingEval.items.filter(it => it.primary_score > 0).length;
    else if (mobileEditingEval.currentMode === 'manager') answered = mobileEditingEval.items.filter(it => it.manager_score > 0).length;
    else answered = mobileEditingEval.items.filter(it => it.self_score > 0).length;
    
    const textEl = document.getElementById('mob-progress-text');
    const fillEl = document.getElementById('mob-progress-fill');
    
    if (textEl) textEl.textContent = `${answered} / ${total} 項目完了`;
    if (fillEl) fillEl.style.width = `${(answered / total) * 100}%`;
}

function bindMobileInputEvents(mode) {
    document.getElementById('btn-mob-input-close').addEventListener('click', () => {
        if (confirm('保存されていない内容は破棄されます。よろしいですか？')) {
            closeMobileInputView();
        }
    });
    
    // Rating Buttons
    document.querySelectorAll('.eval-mob-rating-group').forEach(group => {
        const idx = parseInt(group.dataset.idx);
        group.querySelectorAll('.eval-mob-rating-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const score = parseInt(e.currentTarget.dataset.score);
                
                group.querySelectorAll('.eval-mob-rating-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                
                if (mode === 'primary') mobileEditingEval.items[idx].primary_score = score;
                else if (mode === 'manager') mobileEditingEval.items[idx].manager_score = score;
                else mobileEditingEval.items[idx].self_score = score;
                
                updateMobileProgress();
            });
        });
    });
    
    // Comments
    mobileEditingEval.items.forEach((item, idx) => {
        const textarea = document.getElementById(`mob-comment-${idx}`);
        if (textarea) {
            textarea.addEventListener('change', (e) => {
                if (mode === 'primary') mobileEditingEval.items[idx].primary_comment = e.target.value;
                else if (mode === 'manager') mobileEditingEval.items[idx].manager_comment = e.target.value;
                else mobileEditingEval.items[idx].self_comment = e.target.value;
            });
        }
    });
    
    // Bubble click (Interview mode)
    document.querySelectorAll('.eval-mob-comment-bubble-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            const item = mobileEditingEval.items[idx];
            let popupHtml = `
                <div id="mob-comment-popup" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem; box-sizing:border-box;">
                    <div style="background:white; border-radius:12px; width:100%; max-width:400px; padding:1.5rem; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                        <button class="btn" style="position:absolute; top:10px; right:10px; background:none; border:none; color:#64748b; font-size:1.2rem; padding:0.5rem;" onclick="document.getElementById('mob-comment-popup').remove()"><i class="fas fa-times"></i></button>
                        <h4 style="margin:0 0 1rem; color:#1e293b; font-size:1.1rem;"><i class="fas fa-comment-dots" style="color:#059669;"></i> コメント一覧</h4>
                        <div style="max-height:60vh; overflow-y:auto; padding-right:0.5rem;">
            `;
            if (item.self_comment) popupHtml += `<div style="margin-bottom:1rem;"><div style="font-size:0.75rem; color:#64748b; font-weight:700; margin-bottom:0.2rem;">本人:</div><div style="background:#f1f5f9; padding:0.8rem; border-radius:8px; font-size:0.9rem; line-height:1.5; color:#334155; white-space:pre-wrap;">${item.self_comment}</div></div>`;
            if (item.primary_comment) popupHtml += `<div style="margin-bottom:1rem;"><div style="font-size:0.75rem; color:#64748b; font-weight:700; margin-bottom:0.2rem;">1次:</div><div style="background:#f1f5f9; padding:0.8rem; border-radius:8px; font-size:0.9rem; line-height:1.5; color:#334155; white-space:pre-wrap;">${item.primary_comment}</div></div>`;
            if (item.manager_comment) popupHtml += `<div style="margin-bottom:1rem;"><div style="font-size:0.75rem; color:#64748b; font-weight:700; margin-bottom:0.2rem;">最終:</div><div style="background:#fef1f2; padding:0.8rem; border-radius:8px; font-size:0.9rem; line-height:1.5; color:#be123c; white-space:pre-wrap;">${item.manager_comment}</div></div>`;
            
            popupHtml += `
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', popupHtml);
        });
    });

    // View Only Close
    const btnCloseOnly = document.getElementById('btn-mob-close-only');
    if (btnCloseOnly) {
        btnCloseOnly.addEventListener('click', () => closeMobileInputView());
    }

    // Save Draft
    const btnSaveDraft = document.getElementById('btn-mob-save-draft');
    if (btnSaveDraft) btnSaveDraft.addEventListener('click', async () => {
        try {
            const btn = document.getElementById('btn-mob-save-draft');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
            
            const docRef = doc(db, "t_evaluations", mobileEditingEval.id);
            const updateData = {
                items: mobileEditingEval.items,
                updated_at: new Date().toISOString()
            };
            
            if (mode === 'interview') {
                const dateEl = document.getElementById('mob-interview-date');
                const notesEl = document.getElementById('mob-interview-notes');
                if (dateEl) {
                    mobileEditingEval.interview_date = dateEl.value;
                    updateData.interview_date = dateEl.value;
                }
                if (notesEl) {
                    mobileEditingEval.interview_notes = notesEl.value;
                    updateData.interview_notes = notesEl.value;
                }
            }
            
            await updateDoc(docRef, updateData);
            
            // Sync to local memory if it's self eval
            if (mode === 'self' && mobileMyEvaluation) {
                mobileMyEvaluation.items = mobileEditingEval.items;
            }
            // Also sync back to mobileActiveEvaluations
            const aIdx = mobileActiveEvaluations.findIndex(e => e.id === mobileEditingEval.id);
            if (aIdx !== -1) {
                mobileActiveEvaluations[aIdx].items = mobileEditingEval.items;
            }
            
            btn.innerHTML = originalText;
            btn.disabled = false;
            showAlert('保存完了', '下書きを保存しました。');
        } catch (e) {
            console.error(e);
            showAlert('エラー', '保存に失敗しました。');
            document.getElementById('btn-mob-save-draft').disabled = false;
        }
    });
    
    // Submit
    const btnSubmit = document.getElementById('btn-mob-submit');
    if (btnSubmit) btnSubmit.addEventListener('click', async () => {
        let incomplete = false;
        let confirmMsg = '評価を提出します。提出後は変更ができなくなりますが、よろしいですか？';
        
        if (mode === 'interview') {
            const notesEl = document.getElementById('mob-interview-notes');
            const notesValue = notesEl ? notesEl.value : '';
            if (!notesValue.trim()) {
                return showAlert('入力未完了', '面談内容（記録）を記入してください。');
            }
            confirmMsg = '面談記録を提出し、社長確認待ちへ進めます。よろしいですか？';
        } else {
            if (mode === 'primary') incomplete = mobileEditingEval.items.some(it => !it.primary_score);
            else if (mode === 'manager') incomplete = mobileEditingEval.items.some(it => !it.manager_score);
            else incomplete = mobileEditingEval.items.some(it => !it.self_score);
            
            if (incomplete) {
                return showAlert('入力が完了していません', '未入力の評価項目があります。<br>すべての項目に点数をつけてから提出してください。');
            }
            
            if (mode === 'primary') confirmMsg = `1次評価を完了として提出しますか？
（全員の評価が完了するまでは面談待ちに進みません）`;
            else if (mode === 'manager') confirmMsg = `最終評価を完了として提出しますか？
（全員の評価が完了するまでは面談待ちに進みません）`;
            else confirmMsg = '自己評価を提出します。提出後は変更ができなくなりますが、よろしいですか？';
        }
        
        if (confirm(confirmMsg)) {
            try {
                const btn = document.getElementById('btn-mob-submit');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';
                btn.disabled = true;
                
                const wf = mobileEditingEval.workflow || {};
                const hasPrimary = !!wf.primary_evaluator;
                const isPrimarySub = mobileEditingEval.is_primary_submitted || false;
                const isManagerSub = mobileEditingEval.is_manager_submitted || false;
                const isSelfSub = mobileEditingEval.is_self_submitted || false;

                let nextStatus = mobileEditingEval.status;
                let updateData = {
                    items: mobileEditingEval.items,
                    updated_at: new Date().toISOString()
                };
                
                // Collect interview date and notes
                if (mode === 'interview') {
                    const dateEl = document.getElementById('mob-interview-date');
                    const notesEl = document.getElementById('mob-interview-notes');
                    if (dateEl) {
                        updateData.interview_date = dateEl.value;
                        mobileEditingEval.interview_date = dateEl.value;
                    }
                    if (notesEl) {
                        updateData.interview_notes = notesEl.value;
                        mobileEditingEval.interview_notes = notesEl.value;
                    }
                }

                // Collect comments before submitting
                mobileEditingEval.items.forEach((it, idx) => {
                    const ta = document.getElementById(`mob-comment-${idx}`);
                    if (ta) {
                        if (mode === 'primary') it.primary_comment = ta.value;
                        else if (mode === 'manager') it.manager_comment = ta.value;
                        else it.self_comment = ta.value;
                    }
                });

                // Calculate total
                let sum = 0;
                
                if (mode === 'interview') {
                    nextStatus = 'president_pending';
                } else if (mode === 'self') {
                    mobileEditingEval.items.forEach(it => sum += (it.self_score || 0));
                    updateData.self_total_score = sum;
                    updateData.is_self_submitted = true;
                    
                    if (hasPrimary && !isPrimarySub) nextStatus = 'self_submitted';
                    else if (!isManagerSub) nextStatus = hasPrimary ? 'primary_submitted' : 'self_submitted';
                    else nextStatus = 'interviewing';
                } else if (mode === 'primary') {
                    mobileEditingEval.items.forEach(it => sum += (it.primary_score || 0));
                    updateData.primary_total_score = sum;
                    updateData.is_primary_submitted = true;
                    
                    if (!isSelfSub) nextStatus = 'primary_evaluating'; // waiting for self
                    else if (!isManagerSub) nextStatus = 'primary_submitted';
                    else nextStatus = 'interviewing';
                } else if (mode === 'manager') {
                    mobileEditingEval.items.forEach(it => sum += (it.manager_score || 0));
                    updateData.manager_total_score = sum;
                    updateData.is_manager_submitted = true;
                    
                    if (!isSelfSub) nextStatus = 'manager_evaluating';
                    else if (hasPrimary && !isPrimarySub) nextStatus = 'manager_evaluating';
                    else nextStatus = 'interviewing';
                }
                
                updateData.status = nextStatus;
                
                const docRef = doc(db, "t_evaluations", mobileEditingEval.id);
                await updateDoc(docRef, updateData);
                
                // Sync to local memory
                if (mode === 'self' && mobileMyEvaluation) {
                    mobileMyEvaluation.status = nextStatus;
                    mobileMyEvaluation.is_self_submitted = true;
                    mobileMyEvaluation.items = mobileEditingEval.items;
                    mobileMyEvaluation.self_total_score = sum;
                }
                
                const idx = mobileActiveEvaluations.findIndex(e => e.id === mobileEditingEval.id);
                if (idx !== -1) {
                    mobileActiveEvaluations[idx] = { ...mobileActiveEvaluations[idx], ...updateData };
                }
                
                btn.innerHTML = originalText;
                btn.disabled = false;
                
                closeMobileInputView();
                
                // refresh views
                if (mobileActiveTab === 'self') {
                    const contentArea = document.getElementById('eval-mob-content-area');
                    if (contentArea && typeof generateSelfModeHtml === 'function') {
                       contentArea.innerHTML = generateSelfModeHtml();
                       bindMobileActionButtons(contentArea);
                    }
                } else {
                    const contentArea = document.getElementById('eval-mob-content-area');
                    if (contentArea && typeof generateSubordinatesViewHtml === 'function') {
                       contentArea.innerHTML = generateSubordinatesViewHtml();
                       bindMobileActionButtons(contentArea);
                    }
                }
                
                let successMsg = '提出が完了しました。';
                if (mode === 'self') successMsg = '提出が完了しました。上長から面談日についての連絡が来るまでお待ちください。';
                else if (mode === 'primary') successMsg = '1次評価の提出が完了しました。';
                else if (mode === 'manager') successMsg = '最終評価の提出が完了しました。';
                
                showAlert('提出完了', successMsg);
            } catch (e) {
                console.error(e);
                showAlert('エラー', '提出処理に失敗しました。');
                if(document.getElementById('btn-mob-submit')) document.getElementById('btn-mob-submit').disabled = false;
            }
        }
    });
}
