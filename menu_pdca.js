/**
 * menu_pdca.js — メニューPDCA（料理長会議）ページ
 *
 * 料理長会議の5ステップ（経過確認・商品分析・改善方針・来月商品・宿題）を
 * タブ型ウィザード形式で管理する。
 *
 * Firestore コレクション:
 *   t_chef_meetings        — 月次会議マスタ  (docId: {store_id}_{YYYY-MM})
 *   t_chef_improvement_plans — 改善施策
 *   t_chef_observation_logs  — 経過観察記録
 *   t_chef_homework          — 宿題
 *   t_prototype_recipes      — 試作品（既存・参照のみ）
 *   t_monthly_sales          — Dinii出数データ（既存・参照のみ）
 */

import {
    db, collection, getDocs, query, where, getDoc, doc,
    addDoc, updateDoc, setDoc, deleteDoc, serverTimestamp, orderBy
} from './firebase.js';
import { getEffectivePrice } from './cost_engine.js?v=9';
// -------------------------------------------------------
// ページHTML（SPAの差し込みテンプレート）
// -------------------------------------------------------
export const menuPdcaPageHtml = `
<div id="menu-pdca-container">
    <div id="mp-app-root">
        <!-- ここにJSが動的にレンダリング -->
        <div class="mp-spinner-overlay">
            <div class="mp-spinner"></div>
            <span>読み込み中...</span>
        </div>
    </div>
</div>
`;

// -------------------------------------------------------
// モジュール内状態
// -------------------------------------------------------
let currentUser = null;
let currentStoreId = null;
let currentStoreName = null;
let availableStores = [];

// 会議一覧 or 詳細どちらを表示しているか
let currentView = 'list'; // 'list' | 'detail' | 'dashboard'

// 詳細表示中の会議
let activeMeeting = null;    // Firestore doc データ
let activeMeetingId = null;  // docId

// タブ状態
let activeStep = 1; // 1〜5

// Step2 の商品データキャッシュ
let step2Products = [];
// Step2 で追加した改善候補（セッション内一時保持、保存時にStep3のplanに変換）
let step2Candidates = new Set();

// Step3 の施策データ（Firestoreから取得 or 新規入力中）
let step3Plans = [];

// Step1 の観察中施策
let step1ObservingPlans = [];

// Step4 の試作品データ
let step4Prototypes = [];
let step4Judgements = {}; // { proto_id: 'adopt'|'retry'|'reject'|'hold' }

// Step5 の宿題データ
let step5Homework = [];

// -------------------------------------------------------
// 初期化
// -------------------------------------------------------
export async function initMenuPdcaPage() {
    currentUser = window.appState?.currentUser;
    currentView = 'list';
    activeStep = 1;

    try {
        await loadStores();
        renderListView();
    } catch (e) {
        console.error('[MenuPDCA] 初期化エラー:', e);
        getRoot().innerHTML = `<div class="mp-empty-state"><i class="fas fa-exclamation-triangle"></i><p>読み込みに失敗しました。</p></div>`;
    }
}

function getRoot() {
    return document.getElementById('mp-app-root');
}

// -------------------------------------------------------
// 店舗マスタ読み込み
// -------------------------------------------------------
async function loadStores() {
    const snap = await getDocs(collection(db, 'm_stores'));
    availableStores = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.store_type !== 'CK') {
            availableStores.push({ id: d.id, name: data.store_name || d.id });
        }
    });
    availableStores.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    // 初期状態は「未選択」にしてデータ読み込みの負荷を下げる
    currentStoreId   = '';
    currentStoreName = '';
}

// -------------------------------------------------------
// 会議一覧ビュー
// -------------------------------------------------------
// 現在アクティブなトップタブ ('meetings' | 'homework' | 'history')
let topTab = 'meetings';

async function renderListView() {
    currentView = 'list';
    getRoot().innerHTML = `<div class="mp-spinner-overlay"><div class="mp-spinner"></div><span>会議一覧を取得中...</span></div>`;

    let meetings = [];
    if (currentStoreId) {
        const q = query(
            collection(db, 't_chef_meetings'),
            where('store_id', '==', currentStoreId)
        );
        const snap = await getDocs(q);
        snap.forEach(d => meetings.push({ id: d.id, ...d.data() }));
        // JS側で降順ソート
        meetings.sort((a, b) => (b.year_month || '').localeCompare(a.year_month || ''));
    }

    const storeOptions = `<option value="">店舗を選択</option>` + availableStores.map(s =>
        `<option value="${s.id}" ${s.id === currentStoreId ? 'selected' : ''}>${s.name}</option>`
    ).join('');

    let rowsHtml = '';
    if (!currentStoreId) {
        rowsHtml = `<tr><td colspan="8"><div class="mp-empty-state"><i class="fas fa-store"></i><p>店舗を選択してください。</p></div></td></tr>`;
    } else if (meetings.length === 0) {
        rowsHtml = `<tr><td colspan="8"><div class="mp-empty-state"><i class="fas fa-utensils"></i><p>まだ会議が登録されていません。<br>「新規会議を作成」から始めてください。</p></div></td></tr>`;
    } else {
        rowsHtml = meetings.map(m => {
            const statusInfo = statusDisplay(m.status || '未作成');
            
            let actionBtnHtml = '';
            if (m.status === '完了') {
                actionBtnHtml = `<button class="mp-open-btn" onclick="window._mpOpenMeeting('${m.id}')" style="background:#10b981; color:white; border-color:#10b981;"><i class="fas fa-file-alt"></i> 議事録を見る</button>`;
            } else {
                actionBtnHtml = `<button class="mp-open-btn" onclick="window._mpOpenMeeting('${m.id}')">編集する</button>`;
            }
            
            return `
            <tr>
                <td class="year-month">${formatYearMonth(m.year_month)}</td>
                <td>${m.meeting_date ? formatDate(m.meeting_date) : '—'}</td>
                <td><span class="mp-status-badge ${statusInfo.cls}">${statusInfo.icon} ${statusInfo.label}</span></td>
                <td>${(m.improvement_candidate_count ?? 0)}件</td>
                <td>${(m.observing_count ?? 0)}件</td>
                <td>${(m.homework_count ?? 0)}件</td>
                <td>${(m.homework_pending_count ?? 0)}件</td>
                <td>
                    <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: flex-end;">
                        ${actionBtnHtml}
                        <button class="mp-delete-btn" onclick="window._mpDeleteMeeting('${m.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0.25rem; font-size: 1rem;" title="削除">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    getRoot().innerHTML = `
        <div class="mp-list-header">
            <div class="mp-list-title">
                <i class="fas fa-utensils"></i>
                メニューPDCA ／ 料理長会議
            </div>
            <div style="display:flex;gap:0.8rem;align-items:center;flex-wrap:wrap;">
                <div class="mp-store-filter">
                    <i class="fas fa-store" style="color:#94a3b8;"></i>
                    <select id="mp-store-select" onchange="window._mpChangeStore(this.value)">
                        ${storeOptions}
                    </select>
                </div>
                <button class="mp-new-btn" onclick="window._mpOpenNewMeetingModal()">
                    <i class="fas fa-plus"></i> 新規会議を作成
                </button>
            </div>
        </div>

        <div class="mp-top-nav">
            <button class="mp-top-nav-btn ${topTab === 'meetings' ? 'active' : ''}" onclick="window._mpSwitchTopTab('meetings')">
                <i class="fas fa-calendar-alt"></i> 会議一覧
            </button>
            <button class="mp-top-nav-btn ${topTab === 'homework' ? 'active' : ''}" onclick="window._mpSwitchTopTab('homework')">
                <i class="fas fa-tasks"></i> 宿題管理
            </button>
            <button class="mp-top-nav-btn ${topTab === 'history' ? 'active' : ''}" onclick="window._mpSwitchTopTab('history')">
                <i class="fas fa-history"></i> 改善履歴
            </button>
        </div>

        <div id="mp-top-tab-content">
            <div class="mp-list-table-wrap">
                <table class="mp-list-table">
                    <thead>
                        <tr>
                            <th>年月</th>
                            <th>開催日</th>
                            <th>状態</th>
                            <th>改善候補</th>
                            <th>経過観察中</th>
                            <th>宿題件数</th>
                            <th>未完了宿題</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;

    // グローバルコールバック登録
    window._mpChangeStore = async (storeId) => {
        const found = availableStores.find(s => s.id === storeId);
        currentStoreId   = storeId;
        currentStoreName = found ? found.name : storeId;
        await renderListView();
        // タブを維持して再描画
        if (topTab === 'homework') await renderHomeworkManagementView();
        else if (topTab === 'history') await renderHistoryView('improvement');
    };

    window._mpOpenMeeting = async (meetingId) => {
        await openMeetingDetail(meetingId);
    };

    window._mpDeleteMeeting = async (meetingId) => {
        if (!confirm('この資料（会議データ）を削除してもよろしいですか？')) return;
        try {
            const mDoc = await getDoc(doc(db, 't_chef_meetings', meetingId));
            if (mDoc.exists()) {
                const data = mDoc.data();
                const storeId = data.store_id;
                const yMonth = data.year_month;
                
                // 関連データの削除 (改善施策)
                if (storeId && yMonth) {
                    const qPlans = query(collection(db, 't_chef_improvement_plans'), where('store_id', '==', storeId), where('decided_in_year_month', '==', yMonth));
                    const plansSnap = await getDocs(qPlans);
                    plansSnap.forEach(async (d) => await deleteDoc(d.ref));
                    
                    // 関連データの削除 (宿題)
                    const qHw = query(collection(db, 't_chef_homework'), where('store_id', '==', storeId), where('year_month', '==', yMonth));
                    const hwSnap = await getDocs(qHw);
                    hwSnap.forEach(async (d) => await deleteDoc(d.ref));
                }
            }
            await deleteDoc(doc(db, 't_chef_meetings', meetingId));
            await renderListView();
        } catch (err) {
            console.error(err);
            alert('削除に失敗しました。');
        }
    };

    window._mpOpenNewMeetingModal = () => openNewMeetingModal();

    window._mpSwitchTopTab = async (tab) => {
        topTab = tab;
        // ナビボタンのアクティブ状態を更新
        document.querySelectorAll('.mp-top-nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.includes(
                tab === 'meetings' ? '会議一覧' : tab === 'homework' ? '宿題管理' : '改善履歴'
            ));
        });
        const contentArea = document.getElementById('mp-top-tab-content');
        if (!contentArea) return;
        contentArea.innerHTML = `<div class="mp-spinner-overlay"><div class="mp-spinner"></div><span>読み込み中...</span></div>`;
        if (tab === 'meetings') await renderListView();
        else if (tab === 'homework') await renderHomeworkManagementView();
        else if (tab === 'history') await renderHistoryView('improvement');
    };
}

// -------------------------------------------------------
// 新規会議作成モーダル
// -------------------------------------------------------
function openNewMeetingModal() {
    const today = new Date();
    const defaultYearMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    const defaultDate = today.toISOString().slice(0,10);

    const html = `
    <div class="mp-modal-overlay" id="mp-new-modal-overlay" onclick="window._mpCloseModal(event)">
        <div class="mp-modal">
            <div class="mp-modal-header">
                <span><i class="fas fa-plus-circle" style="color:#f59e0b;margin-right:0.5rem;"></i>新規会議を作成</span>
                <button class="mp-modal-close" onclick="window._mpCloseModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="mp-modal-body">
                <div class="mp-form-group">
                    <label>対象年月 <span style="color:#ef4444;">*</span></label>
                    <input type="month" id="mp-new-year-month" value="${defaultYearMonth}" required>
                </div>
                <div class="mp-form-group">
                    <label>対象店舗</label>
                    <select id="mp-new-store">
                        ${availableStores.map(s => `<option value="${s.id}" ${s.id === currentStoreId ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="mp-form-group">
                    <label>開催日</label>
                    <input type="date" id="mp-new-date" value="${defaultDate}">
                </div>

                <div class="mp-form-group">
                    <label>出席者（カンマ区切り）</label>
                    <input type="text" id="mp-new-attendees" placeholder="例: 社長、料理長、小山内">
                </div>
            </div>
            <div class="mp-modal-footer">
                <button class="mp-btn-cancel" onclick="window._mpCloseModal()">キャンセル</button>
                <button class="mp-btn-save" onclick="window._mpCreateMeeting()">
                    <i class="fas fa-check"></i> 作成する
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    window._mpCloseModal = (e) => {
        if (e && e.target !== document.getElementById('mp-new-modal-overlay')) return;
        document.getElementById('mp-new-modal-overlay')?.remove();
    };

    window._mpCreateMeeting = async () => {
        const yearMonth  = document.getElementById('mp-new-year-month').value;
        const storeId    = document.getElementById('mp-new-store').value;
        const date       = document.getElementById('mp-new-date').value;
        const attendeesRaw = document.getElementById('mp-new-attendees').value;
        const attendees  = attendeesRaw.split(/[,、，]/).map(s => s.trim()).filter(Boolean);

        if (!yearMonth || !storeId) {
            alert('年月と店舗は必須です。');
            return;
        }

        const docId = `${storeId}_${yearMonth}`;
        const found = availableStores.find(s => s.id === storeId);
        const storeName = found ? found.name : storeId;

        // 既存チェック
        const existing = await getDoc(doc(db, 't_chef_meetings', docId));
        if (existing.exists()) {
            alert(`${formatYearMonth(yearMonth)} の会議はすでに作成されています。`);
            return;
        }

        const data = {
            store_id: storeId,
            store_name: storeName,
            year_month: yearMonth,
            meeting_date: date,
            attendees: attendees,
            status: '作成中',
            step_progress: { step1_done: false, step2_done: false, step3_done: false, step4_done: false, step5_done: false },
            step2_improvement_candidates: [],
            step2_summary_note: '',
            main_decisions: '',
            supplementary_notes: '',
            next_meeting_notes: '',
            improvement_candidate_count: 0,
            observing_count: 0,
            homework_count: 0,
            homework_pending_count: 0,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            created_by: currentUser?.uid ?? '',
            last_updated_by: currentUser?.uid ?? '',
        };

        await setDoc(doc(db, 't_chef_meetings', docId), data);

        document.getElementById('mp-new-modal-overlay')?.remove();
        currentStoreId   = storeId;
        currentStoreName = storeName;
        await openMeetingDetail(docId);
    };
}

// -------------------------------------------------------
// 会議詳細を開く
// -------------------------------------------------------
async function openMeetingDetail(meetingId) {
    getRoot().innerHTML = `<div class="mp-spinner-overlay"><div class="mp-spinner"></div><span>会議データを取得中...</span></div>`;

    const snap = await getDoc(doc(db, 't_chef_meetings', meetingId));
    if (!snap.exists()) {
        alert('会議データが見つかりません。');
        await renderListView();
        return;
    }

    activeMeetingId = meetingId;
    activeMeeting   = { id: meetingId, ...snap.data() };
    currentStoreId   = activeMeeting.store_id;
    currentStoreName = activeMeeting.store_name;
    currentView = 'detail';
    activeStep = 1;
    step2Candidates = new Set(activeMeeting.step2_improvement_candidates || []);

    await renderDetailView();
}

// -------------------------------------------------------
// 会議詳細ビュー（タブ型ウィザード）
// -------------------------------------------------------
async function renderDetailView() {
    const m = activeMeeting;
    const statusInfo = statusDisplay(m.status || '作成中');

    const stepLabels = [
        { num: 1, label: '改善経過確認', icon: 'fa-search' },
        { num: 2, label: '商品分析',     icon: 'fa-chart-bar' },
        { num: 3, label: '改善方針',     icon: 'fa-lightbulb' },
        { num: 4, label: '来月の商品',   icon: 'fa-flask' },
        { num: 5, label: '担当者・宿題', icon: 'fa-tasks' },
    ];

    let actionButtonsHtml = '';
    let stepperHtml = '';
    
    if (m.status === '完了') {
        actionButtonsHtml = `
            <button class="mp-action-btn" onclick="window._mpCaptureDashboard()" style="background:#475569; color:white; border:none;"><i class="fas fa-camera"></i> 会議議事録をキャプチャ</button>
            <button class="mp-action-btn btn-edit" onclick="window._mpReopenMeeting()"><i class="fas fa-undo"></i> 編集を再開する</button>
        `;
        stepperHtml = '';
    } else {
        actionButtonsHtml = `
            <button class="mp-action-btn btn-edit" onclick="window._mpOpenEditModal()"><i class="fas fa-edit"></i> 基本情報編集</button>
        `;
        stepperHtml = `<div class="mp-stepper">${stepLabels.map((s, idx) => {
            const isDone    = m.step_progress?.[`step${s.num}_done`];
            const isActive  = activeStep === s.num;
            const cls = isActive ? 'active' : (isDone ? 'done' : '');
            const arrow = idx < stepLabels.length - 1 ? `<span class="mp-step-arrow">›</span>` : '';
            return `
                <div class="mp-step ${cls}" onclick="window._mpGoStep(${s.num})">
                    <span class="mp-step-num">
                        ${isDone && !isActive ? '<i class="fas fa-check" style="font-size:0.7rem;"></i>' : s.num}
                    </span>
                    <span class="mp-step-label"><i class="fas ${s.icon}" style="margin-right:0.3rem;"></i>${s.label}</span>
                </div>
                ${arrow}
            `;
        }).join('')}</div>`;
    }

    getRoot().innerHTML = `
        <button class="mp-back-btn" onclick="window._mpBackToList()">
            <i class="fas fa-arrow-left"></i> 会議一覧に戻る
        </button>

        <div class="mp-detail-header">
            <div class="mp-detail-header-top">
                <div>
                    <div class="mp-detail-title">
                        料理長会議（${formatYearMonth(m.year_month)}）
                        <span class="mp-status-badge ${statusInfo.cls}" style="font-size:0.8rem;margin-left:0.5rem;">${statusInfo.icon} ${statusInfo.label}</span>
                    </div>
                    <div class="mp-detail-subtitle">
                        <span><i class="fas fa-store" style="color:#f59e0b;"></i> ${m.store_name}</span>
                        <span><i class="fas fa-calendar" style="color:#64748b;"></i> 開催日: ${m.meeting_date ? formatDate(m.meeting_date) : '未設定'}</span>
                        <span><i class="fas fa-users" style="color:#64748b;"></i> ${(m.attendees || []).join('、') || '未設定'}</span>
                    </div>
                </div>
                <div class="mp-detail-actions">
                    ${actionButtonsHtml}
                </div>
            </div>
        </div>

        ${stepperHtml}

        <div id="mp-step-content-area">
            <div class="mp-spinner-overlay"><div class="mp-spinner"></div><span>データ取得中...</span></div>
        </div>
    `;

    // グローバルコールバック
    window._mpBackToList = () => renderListView();
    window._mpGoStep = async (n) => {
        if (activeMeeting.status === '完了') return;
        activeStep = n;
        await updateStepperUI();
        await renderStepContent(n);
    };
    window._mpOpenEditModal = () => openEditMeetingModal();
    window._mpReopenMeeting = async () => {
        if(!confirm('編集を再開しますか？（ステータスが「作成中」に戻ります）')) return;
        try {
            await updateDoc(doc(db, 't_chef_meetings', activeMeeting.id), { status: '作成中' });
            activeMeeting.status = '作成中';
            await renderDetailView();
        } catch (e) {
            console.error(e);
            alert('状態の更新に失敗しました。');
        }
    };
    window._mpCaptureDashboard = async () => {
        const btn = document.querySelector('[onclick*="_mpCaptureDashboard"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...'; }
        try {
            if (typeof html2canvas === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('html2canvasの読み込みに失敗しました。'));
                    document.head.appendChild(script);
                });
            }
            const target = document.getElementById('mp-step-content-area');
            if (!target) throw new Error('ダッシュボード要素が見つかりません。');
            const canvas = await html2canvas(target, {
                backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false, allowTaint: true
            });
            const ym = formatYearMonth(activeMeeting.year_month);
            const fileName = `議事録_${ym}_${activeMeeting.store_name}.png`;
            const dataUrl = canvas.toDataURL('image/png');
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], fileName, { type: 'image/png' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ title: fileName, files: [file] });
            } else {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = fileName;
                link.click();
            }
        } catch (e) {
            console.error('Capture error:', e);
            alert(`キャプチャに失敗しました: ${e.message}`);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-camera"></i> 会議議事録をキャプチャ'; }
        }
    };


    if (m.status === '完了') {
        const qPlans = query(collection(db, 't_chef_improvement_plans'), where('store_id', '==', m.store_id), where('decided_in_year_month', '==', m.year_month));
        const plansSnap = await getDocs(qPlans);
        const plans = [];
        plansSnap.forEach(d => plans.push({ id: d.id, ...d.data() }));

        const qHw = query(collection(db, 't_chef_homework'), where('store_id', '==', m.store_id), where('year_month', '==', m.year_month));
        const hwSnap = await getDocs(qHw);
        const homework = [];
        hwSnap.forEach(d => homework.push({ id: d.id, ...d.data() }));

        document.getElementById('mp-step-content-area').innerHTML = generateDashboardHtml(m, plans, homework);
    } else {
        await renderStepContent(activeStep);
    }
}

// ステッパーのUIだけ更新
function updateStepperUI() {
    const m = activeMeeting;
    const stepLabels = [
        { num: 1, icon: 'fa-search' }, { num: 2, icon: 'fa-chart-bar' },
        { num: 3, icon: 'fa-lightbulb' }, { num: 4, icon: 'fa-flask' },
        { num: 5, icon: 'fa-tasks' }
    ];
    const labels = ['改善経過確認', '商品分析', '改善方針', '来月の商品', '担当者・宿題'];
    const steps = document.querySelectorAll('.mp-step');
    steps.forEach((el, idx) => {
        const n = idx + 1;
        const isDone   = m.step_progress?.[`step${n}_done`];
        const isActive = activeStep === n;
        el.className = `mp-step ${isActive ? 'active' : (isDone ? 'done' : '')}`;
        el.querySelector('.mp-step-num').innerHTML =
            (isDone && !isActive) ? '<i class="fas fa-check" style="font-size:0.7rem;"></i>' : String(n);
    });
}

// -------------------------------------------------------
// ステップコンテンツのルーティング
// -------------------------------------------------------
async function renderStepContent(step) {
    const area = document.getElementById('mp-step-content-area');
    if (!area) return;
    area.innerHTML = `<div class="mp-spinner-overlay"><div class="mp-spinner"></div><span>読み込み中...</span></div>`;

    try {
        switch (step) {
            case 1: await renderStep1(area); break;
            case 2: await renderStep2(area); break;
            case 3: await renderStep3(area); break;
            case 4: await renderStep4(area); break;
            case 5: await renderStep5(area); break;
        }
    } catch (e) {
        console.error(`[MenuPDCA] Step${step}レンダリングエラー:`, e);
        area.innerHTML = `<div class="mp-step-content"><div class="mp-step-content-body"><div class="mp-empty-state"><i class="fas fa-exclamation-triangle"></i><p>データの取得中にエラーが発生しました。<br>${e.message}</p></div></div></div>`;
    }
}

// -------------------------------------------------------
// Step1 — 改善施策の経過確認
// -------------------------------------------------------
async function renderStep1(area) {
    // 観察中の施策を取得
    const q = query(
        collection(db, 't_chef_improvement_plans'),
        where('store_id', '==', currentStoreId),
        where('observation_status', 'in', ['observing', 'extended'])
    );
    const snap = await getDocs(q);
    step1ObservingPlans = [];
    snap.forEach(d => step1ObservingPlans.push({ id: d.id, ...d.data() }));

    const isEmpty = step1ObservingPlans.length === 0;

    const cardsHtml = isEmpty
        ? `<div class="mp-observation-empty">
                <i class="fas fa-check-circle"></i>
                <strong>現在、経過観察中の改善施策はありません</strong>
                <p style="margin:0.5rem 0 0;font-size:0.85rem;">初回会議、または前回までの施策が全て終了しています。</p>
                <p style="margin:0.3rem 0 0;font-size:0.85rem;">Step3で改善方針を決定した施策が、翌月のStep1に表示されます。</p>
           </div>`
        : step1ObservingPlans.map(plan => renderStep1Card(plan)).join('');

    area.innerHTML = `
    <div class="mp-step-content">
        <div class="mp-step-content-header">
            <span class="mp-step-content-title"><span style="background:#f59e0b;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:800;">1</span> 改善施策の経過確認</span>
            <span style="font-size:0.82rem;color:#92400e;">${step1ObservingPlans.length}件の施策を経過観察中</span>
        </div>
        <div class="mp-step-content-body">
            <div class="mp-section-note">
                <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:0.3rem;"></i>
                過去の会議で「改善する」と決定した施策の結果を確認します。今月の実績を入力し、会議での判断を記録してください。
            </div>
            <div id="mp-step1-cards">${cardsHtml}</div>
        </div>
        <div class="mp-step-nav">
            <div></div>
            <div style="display:flex;gap:0.6rem;">
                <button class="mp-nav-btn save" onclick="window._mpSaveStep1()">
                    <i class="fas fa-save"></i> 保存
                </button>
                <button class="mp-nav-btn next" onclick="window._mpGoStep(2)">
                    Step2へ <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    </div>`;

    window._mpSaveStep1 = async () => await saveStep1();
    window._mpCalcMom = (planId) => calcMomAutoStep1(planId);
}

function renderStep1Card(plan) {
    const monthNum = (plan.observation_month_count || 0) + 1;
    const monthLabel = `${monthNum}か月目`;

    return `
    <div class="mp-obs-card" data-plan-id="${plan.id}">
        <div class="mp-obs-card-header">
            <div>
                <div class="mp-obs-card-product">${escHtml(plan.product_name || '商品名未設定')}</div>
                <div style="font-size:0.78rem;color:#64748b;margin-top:0.2rem;">
                    改善実施: ${plan.planned_date || '—'} ／ 担当: ${escHtml(plan.assignee || '—')}
                </div>
            </div>
            <span class="mp-obs-month-badge">観察 ${monthLabel}</span>
        </div>
        <div class="mp-obs-card-body">
            <div class="mp-obs-info-grid">
                <div class="mp-obs-info-item">
                    <label>現状の問題</label>
                    <span>${escHtml(plan.current_issue || '—')}</span>
                </div>
                <div class="mp-obs-info-item">
                    <label>改善内容</label>
                    <span>${escHtml(plan.action_detail || '—')}</span>
                </div>
                <div class="mp-obs-info-item">
                    <label>改善の狙い</label>
                    <span>${escHtml(plan.improvement_goal || '—')}</span>
                </div>
                <div class="mp-obs-info-item">
                    <label>確認する指標</label>
                    <span>${(plan.target_metrics || []).join('・') || '—'}</span>
                </div>
                <div class="mp-obs-info-item">
                    <label>改善前の基準値</label>
                    <span>${escHtml(plan.baseline_value || '—')}</span>
                </div>
            </div>

            <div class="mp-obs-timeline">
                ${renderPastObsMonths(plan)}
                <div class="mp-obs-month-col current">
                    <h5>今月（${monthLabel}）の実績</h5>
                    <div class="mp-form-group" style="margin-bottom:0.5rem;">
                        <input type="number" id="mp-obs-val-${plan.id}" placeholder="数値（例: 42）" style="width:100%;box-sizing:border-box;"
                            oninput="window._mpCalcMom('${plan.id}')">
                        <input type="text" id="mp-obs-unit-${plan.id}" placeholder="単位（例: 食、%）" style="width:100%;box-sizing:border-box;margin-top:0.3rem;">
                    </div>
                    <div id="mp-obs-auto-${plan.id}" style="min-height:24px;"></div>
                </div>
            </div>

            <div class="mp-form-group" style="margin-bottom:0.8rem;">
                <label>会議コメント</label>
                <textarea id="mp-obs-comment-${plan.id}" rows="2" placeholder="会議での気づき・コメントを入力"></textarea>
            </div>

            <div class="mp-form-group">
                <label>会議判断 <span style="color:#ef4444;">*</span></label>
                <div class="mp-policy-group" id="mp-obs-judgement-${plan.id}">
                    ${['継続', '成功終了', '不成立終了', '再改善', '延長'].map(j =>
                        `<button class="mp-policy-btn" data-val="${j}" onclick="window._mpSelectJudgement('${plan.id}', '${j}')">${j}</button>`
                    ).join('')}
                </div>
            </div>
        </div>
    </div>`;
}

function renderPastObsMonths(plan) {
    const count = plan.observation_month_count || 0;
    if (count === 0) return '';

    // 過去のログは今後Step1保存後に蓄積される（今は空表示）
    return Array.from({ length: count }, (_, i) => `
        <div class="mp-obs-month-col">
            <h5>${i+1}か月目</h5>
            <p style="font-size:0.82rem;color:#94a3b8;">(記録あり)</p>
        </div>
    `).join('');
}

function calcMomAutoStep1(planId) {
    const plan = step1ObservingPlans.find(p => p.id === planId);
    if (!plan) return;

    const valInput = document.getElementById(`mp-obs-val-${planId}`);
    const autoArea = document.getElementById(`mp-obs-auto-${planId}`);
    if (!valInput || !autoArea) return;

    const currentVal = parseFloat(valInput.value);
    const baseVal = parseFloat(plan.baseline_value);

    let html = '';
    if (!isNaN(currentVal) && !isNaN(baseVal) && baseVal !== 0) {
        const vsBaseline = ((currentVal - baseVal) / baseVal * 100).toFixed(1);
        const cls = vsBaseline > 0 ? 'positive' : (vsBaseline < 0 ? 'negative' : 'neutral');
        const sign = vsBaseline > 0 ? '+' : '';
        html += `<span class="mp-auto-calc ${cls}"><i class="fas fa-calculator"></i> 基準比: ${sign}${vsBaseline}%</span> `;
    }
    autoArea.innerHTML = html;
}

// Step1 グローバル判断選択
window._mpSelectJudgement = (planId, val) => {
    const group = document.getElementById(`mp-obs-judgement-${planId}`);
    if (!group) return;
    group.querySelectorAll('.mp-policy-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.val === val);
        if (btn.dataset.val === val) btn.classList.add('defer');
    });
};

async function saveStep1() {
    const btn = document.querySelector('.mp-nav-btn.save');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...'; }

    try {
        for (const plan of step1ObservingPlans) {
            const valInput     = document.getElementById(`mp-obs-val-${plan.id}`);
            const unitInput    = document.getElementById(`mp-obs-unit-${plan.id}`);
            const commentInput = document.getElementById(`mp-obs-comment-${plan.id}`);
            const selectedBtn  = document.querySelector(`#mp-obs-judgement-${plan.id} .mp-policy-btn.selected`);

            if (!valInput) continue;

            const currentVal = parseFloat(valInput.value);
            const baseVal    = parseFloat(plan.baseline_value);
            let vsBl = null;
            if (!isNaN(currentVal) && !isNaN(baseVal) && baseVal !== 0) {
                vsBl = parseFloat(((currentVal - baseVal) / baseVal * 100).toFixed(1));
            }

            const judgement = selectedBtn?.dataset?.val || null;

            // t_chef_observation_logs に追記
            const logData = {
                plan_id: plan.id,
                store_id: currentStoreId,
                year_month: activeMeeting.year_month,
                observation_month_number: (plan.observation_month_count || 0) + 1,
                result_value: unitInput?.value ? `${currentVal} ${unitInput.value}` : String(currentVal || ''),
                result_numeric: isNaN(currentVal) ? null : currentVal,
                unit: unitInput?.value || '',
                mom_comparison_pct: null,
                vs_baseline_pct: vsBl,
                meeting_comment: commentInput?.value || '',
                judgement: judgement,
                logged_at: serverTimestamp(),
                logged_by: currentUser?.uid ?? '',
            };

            if (logData.result_value || logData.meeting_comment || judgement) {
                await addDoc(collection(db, 't_chef_observation_logs'), logData);
            }

            // 判断に応じて施策の状態を更新
            if (judgement) {
                const statusMap = {
                    '継続': 'observing',
                    '成功終了': 'success',
                    '不成立終了': 'failed',
                    '再改善': 're_improving',
                    '延長': 'extended',
                };
                const newStatus = statusMap[judgement] || 'observing';
                await updateDoc(doc(db, 't_chef_improvement_plans', plan.id), {
                    observation_status: newStatus,
                    observation_month_count: (plan.observation_month_count || 0) + 1,
                    updated_at: serverTimestamp(),
                });
            }
        }

        // Step1完了マーク
        await markStepDone(1);
        alert('Step1の内容を保存しました。');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 保存'; }

    } catch (e) {
        console.error('[MenuPDCA] Step1保存エラー:', e);
        alert('保存に失敗しました: ' + e.message);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 保存'; }
    }
}

// -------------------------------------------------------
// Step2 — 商品分析・改善候補の抽出
// -------------------------------------------------------
async function renderStep2(area) {
    // t_monthly_sales から最新月のデータを取得
    const latestMonth = activeMeeting.year_month;
    const prevMonth   = getPrevMonth(latestMonth);

    const [currentSnap, prevSnap, itemSnap, ingSnap, menuSnap, perfSnap] = await Promise.all([
        getDocs(query(collection(db, 't_monthly_sales'),
            where('store_id', '==', currentStoreId),
            where('year_month', '==', latestMonth))),
        getDocs(query(collection(db, 't_monthly_sales'),
            where('store_id', '==', currentStoreId),
            where('year_month', '==', prevMonth))),
        getDocs(collection(db, 'm_items')),
        getDocs(collection(db, 'm_ingredients')),
        getDocs(collection(db, 'm_menus')),
        getDocs(query(collection(db, 't_performance'),
            where('store_id', '==', currentStoreId),
            where('year_month', '==', latestMonth)))
    ]);

    const cache = {
        items: itemSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        ingredients: ingSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        menus: menuSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    };

    let totalCustomers = 0;
    perfSnap.forEach(d => totalCustomers += (d.data().customer_count || 0));

    // 観察中施策の対象商品セット
    const obsQ = query(collection(db, 't_chef_improvement_plans'),
        where('store_id', '==', currentStoreId),
        where('observation_status', 'in', ['observing', 'extended']));
    const obsSnap = await getDocs(obsQ);
    const obsProducts = new Set();
    obsSnap.forEach(d => obsProducts.add(d.data().product_name));

    const prevMap = {};
    prevSnap.forEach(d => {
        const data = d.data();
        // 合計データ (is_total: true) を対象とする
        if (data.is_total && data.menu_name) prevMap[data.menu_name] = data;
    });

    step2Products = [];
    currentSnap.forEach(d => {
        const data = d.data();
        // 合計データ (is_total: true) を対象とする
        if (!data.is_total || !data.menu_name) return;
        const prev = prevMap[data.menu_name];
        const momQty = prev && prev.quantity_sold > 0
            ? ((data.quantity_sold - prev.quantity_sold) / prev.quantity_sold * 100).toFixed(1)
            : null;
            
        const menu = cache.menus.find(m => m.dinii_id === data.dinii_id || m.menu_name === data.menu_name);
        const itemId = menu ? menu.item_id : null;
        const item = itemId ? cache.items.find(i => i.id === itemId) : null;
        const majorCategory = item ? (item.major_category || 'その他') : 'その他';
        const category = item ? (item.category || '未分類') : '未分類';
        
        const costPerUnit = itemId ? getEffectivePrice(itemId, cache) : 0;
        const qty = data.quantity_sold ?? 0;
        const sales = data.total_sales ?? 0;
        const totalCost = costPerUnit * qty;
        
        let costRate = null;
        let grossProfit = null;
        if (sales > 0) {
            costRate = (totalCost / sales) * 100;
            grossProfit = sales - totalCost;
        }

        const prob = totalCustomers > 0 ? (qty / totalCustomers) * 100 : 0;

        step2Products.push({
            id: d.id,
            name: data.menu_name,
            quantity: qty,
            sales: sales,
            unit_price: data.unit_price ?? 0,
            unit_cost: costPerUnit,
            cost_rate: costRate,
            gross_profit: grossProfit,
            major_category: majorCategory,
            category: category,
            order_prob: prob,
            mom_qty: momQty,
            is_observing: obsProducts.has(data.menu_name),
            dinii_id: data.dinii_id
        });
    });
    step2Products.sort((a, b) => b.quantity - a.quantity);

    const hasData = step2Products.length > 0;
    const uniqueCategories = [...new Set(step2Products.map(p => p.category))].filter(c => c).sort();
    const catOptionsHtml = uniqueCategories.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');

    area.innerHTML = `
    <div class="mp-step-content">
        <div class="mp-step-content-header">
            <span class="mp-step-content-title"><span style="background:#f59e0b;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:800;">2</span> 商品分析・改善候補の抽出</span>
            <span style="font-size:0.82rem;color:#92400e;">対象: ${formatYearMonth(latestMonth)} ／ ${step2Products.length}商品</span>
        </div>
        <div class="mp-step-content-body">
            <div class="mp-section-note">
                <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:0.3rem;"></i>
                この画面では課題発見に集中します。改善方法の議論はStep3で行います。
                問題のある商品を「改善候補へ」ボタンで追加してください。
            </div>

            <div class="mp-analysis-toolbar">
                <input type="text" class="mp-search-box" id="mp-search-box" placeholder="商品名で検索..." oninput="window._mpRenderTable()">
                <select id="mp-category-dropdown" style="padding: 0.4rem 1rem; border-radius: 8px; border: 1px solid var(--border); outline: none; font-size: 0.85rem;" onchange="window._mpSetCategoryFilter(this.value)">
                    <option value="all">すべてのカテゴリー</option>
                    ${catOptionsHtml}
                </select>
                <button class="mp-filter-chip active" data-filter="all" onclick="window._mpSetFilter('all', this)">全て</button>
                <button class="mp-filter-chip" data-filter="フード" onclick="window._mpSetFilter('フード', this)">フード</button>
                <button class="mp-filter-chip" data-filter="ドリンク" onclick="window._mpSetFilter('ドリンク', this)">ドリンク</button>
                <button class="mp-filter-chip" data-filter="お通し" onclick="window._mpSetFilter('お通し', this)">お通し</button>
                <button class="mp-filter-chip" data-filter="high_cost" onclick="window._mpSetFilter('high_cost', this)">原価率高</button>
            </div>

            <div class="mp-analysis-table-wrap">
                <table class="mp-analysis-table">
                    <thead>
                        <tr>
                            <th>商品名</th>
                            <th class="mp-sort-header" data-sort-key="quantity" data-label="販売数" onclick="window._mpSortProducts('quantity')" style="cursor:pointer; white-space:nowrap;">販売数</th>
                            <th class="mp-sort-header" data-sort-key="unit_price" data-label="売値" onclick="window._mpSortProducts('unit_price')" style="cursor:pointer; white-space:nowrap;">売値</th>
                            <th class="mp-sort-header" data-sort-key="unit_cost" data-label="原価" onclick="window._mpSortProducts('unit_cost')" style="cursor:pointer; white-space:nowrap;">原価</th>
                            <th class="mp-sort-header" data-sort-key="sales" data-label="売上" onclick="window._mpSortProducts('sales')" style="cursor:pointer; white-space:nowrap;">売上</th>
                            <th class="mp-sort-header" data-sort-key="cost_rate" data-label="原価率" onclick="window._mpSortProducts('cost_rate')" style="cursor:pointer; white-space:nowrap;">原価率</th>
                            <th class="mp-sort-header" data-sort-key="gross_profit" data-label="粗利額" onclick="window._mpSortProducts('gross_profit')" style="cursor:pointer; white-space:nowrap;">粗利額</th>
                            <th class="mp-sort-header" data-sort-key="order_prob" data-label="注文確率" onclick="window._mpSortProducts('order_prob')" style="cursor:pointer; white-space:nowrap;">注文確率</th>
                            <th class="mp-sort-header" data-sort-key="mom_qty" data-label="前月比" onclick="window._mpSortProducts('mom_qty')" style="cursor:pointer; white-space:nowrap;">前月比</th>
                            <th>アクション</th>
                        </tr>
                    </thead>
                    <tbody id="mp-products-tbody">
                        ${!hasData ? `<tr><td colspan="9"><div class="mp-empty-state"><i class="fas fa-database"></i><p>${formatYearMonth(latestMonth)}のDiniiデータが見つかりません。<br>CSVインポート画面からデータをインポートしてください。</p></div></td></tr>` : ''}
                    </tbody>
                </table>
            </div>

            <div style="margin-top:1.2rem;">
                <div class="mp-form-group">
                    <label>Step2 会議メモ・全体所感</label>
                    <textarea id="mp-step2-note" rows="3" placeholder="全体的な分析所感や気づきをメモしてください...">${escHtml(activeMeeting.step2_summary_note || '')}</textarea>
                </div>
            </div>
        </div>
        <div class="mp-step-nav">
            <button class="mp-nav-btn prev" onclick="window._mpGoStep(1)">
                <i class="fas fa-chevron-left"></i> Step1へ
            </button>
            <div style="display:flex;gap:0.6rem;">
                <button class="mp-nav-btn save" onclick="window._mpSaveStep2()">
                    <i class="fas fa-save"></i> 保存
                </button>
                <button class="mp-nav-btn next" onclick="window._mpGoStep(3)">
                    Step3へ <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    </div>`;

    // 状態変数
    let currentFilter = 'all';
    let currentCategoryFilter = 'all';
    let currentSortKey = 'quantity';
    let currentSortAsc = false;

    window._mpToggleCandidate = (productId, productName, btn) => {
        if (step2Candidates.has(productName)) {
            step2Candidates.delete(productName);
            btn.className = 'mp-add-candidate-btn';
            btn.innerHTML = '<i class="fas fa-plus"></i> 改善候補へ';
        } else {
            step2Candidates.add(productName);
            btn.className = 'mp-add-candidate-btn added';
            btn.innerHTML = '<i class="fas fa-check"></i> 追加済み';
        }
    };

    window._mpRenderTable = () => {
        const tbody = document.getElementById('mp-products-tbody');
        if (!tbody) return;

        // 1. ソート
        step2Products.sort((a, b) => {
            let valA = a[currentSortKey];
            let valB = b[currentSortKey];
            
            if (valA === null) valA = -99999999;
            if (valB === null) valB = -99999999;
            
            if (currentSortKey === 'mom_qty') {
                valA = a.mom_qty !== null ? parseFloat(a.mom_qty) : -99999999;
                valB = b.mom_qty !== null ? parseFloat(b.mom_qty) : -99999999;
            }

            if (valA < valB) return currentSortAsc ? -1 : 1;
            if (valA > valB) return currentSortAsc ? 1 : -1;
            return 0;
        });

        // 2. フィルタとHTML生成
        const keyword = document.getElementById('mp-search-box')?.value.toLowerCase() || '';
        const html = step2Products.map(p => {
            const matchKw = !keyword || p.name.toLowerCase().includes(keyword);
            let matchFilter = true;
            if (currentFilter === 'フード') matchFilter = p.major_category === 'フード';
            if (currentFilter === 'ドリンク') matchFilter = p.major_category === 'ドリンク';
            if (currentFilter === 'お通し') matchFilter = p.major_category === 'お通し';
            if (currentFilter === 'high_cost') matchFilter = p.cost_rate !== null && p.cost_rate > 35;
            
            let matchCat = true;
            if (currentCategoryFilter !== 'all') matchCat = p.category === currentCategoryFilter;

            if (!matchKw || !matchFilter || !matchCat) return '';

            const isAdded = step2Candidates.has(p.name);
            const momHtml = p.mom_qty !== null
                ? `<span class="${parseFloat(p.mom_qty) >= 0 ? 'mp-mom-positive' : 'mp-mom-negative'}">${parseFloat(p.mom_qty) >= 0 ? '+' : ''}${p.mom_qty}%</span>`
                : `<span class="mp-mom-neutral">—</span>`;
            const crHtml = p.cost_rate !== null
                ? `<span class="${p.cost_rate > 35 ? 'mp-cost-rate-high' : 'mp-cost-rate-ok'}">${p.cost_rate.toFixed(1)}%</span>`
                : '—';
            const grossHtml = p.gross_profit !== null ? '¥' + Math.round(p.gross_profit).toLocaleString() : '—';
            const probHtml = p.order_prob ? p.order_prob.toFixed(1) + '%' : '0.0%';
            const obsHtml = p.is_observing ? `<span class="mp-observing-badge"><i class="fas fa-eye"></i> 観察中</span>` : '';
            return `
            <tr>
                <td><strong>${escHtml(p.name)}</strong>${obsHtml}</td>
                <td>${p.quantity.toLocaleString()}</td>
                <td>¥${Math.round(p.unit_price).toLocaleString()}</td>
                <td>¥${Math.round(p.unit_cost).toLocaleString()}</td>
                <td>¥${Math.round(p.sales).toLocaleString()}</td>
                <td>${crHtml}</td>
                <td>${grossHtml}</td>
                <td>${probHtml}</td>
                <td>${momHtml}</td>
                <td>
                    <button class="mp-add-candidate-btn ${isAdded ? 'added' : ''}"
                        id="mp-cand-btn-${p.id}"
                        onclick="window._mpToggleCandidate('${p.id}', '${escHtml(p.name).replace(/'/g,"\\'")}', this)">
                        ${isAdded ? '<i class="fas fa-check"></i> 追加済み' : '<i class="fas fa-plus"></i> 改善候補へ'}
                    </button>
                </td>
            </tr>`;
        }).join('');

        tbody.innerHTML = html || `<tr><td colspan="9"><div class="mp-empty-state"><p>該当する商品が見つかりません。</p></div></td></tr>`;
        
        // ヘッダのUIを更新
        document.querySelectorAll('.mp-sort-header').forEach(th => {
            const key = th.dataset.sortKey;
            let icon = '';
            if (key === currentSortKey) {
                icon = currentSortAsc ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>';
            } else {
                icon = ' <i class="fas fa-sort" style="color: #cbd5e1;"></i>';
            }
            th.innerHTML = th.dataset.label + icon;
        });
    };

    window._mpSortProducts = (key) => {
        if (currentSortKey === key) {
            currentSortAsc = !currentSortAsc;
        } else {
            currentSortKey = key;
            currentSortAsc = false;
        }
        window._mpRenderTable();
    };

    window._mpSetFilter = (filter, el) => {
        currentFilter = filter;
        document.querySelectorAll('.mp-filter-chip').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        window._mpRenderTable();
    };

    window._mpSetCategoryFilter = (val) => {
        currentCategoryFilter = val;
        window._mpRenderTable();
    };

    // 初期描画
    if (hasData) {
        window._mpRenderTable();
    }

    window._mpSaveStep2 = async () => await saveStep2();
}

async function saveStep2() {
    const note = document.getElementById('mp-step2-note')?.value || '';
    const candidates = Array.from(step2Candidates);

    await updateDoc(doc(db, 't_chef_meetings', activeMeetingId), {
        step2_summary_note: note,
        step2_improvement_candidates: candidates,
        improvement_candidate_count: candidates.length,
        updated_at: serverTimestamp(),
        last_updated_by: currentUser?.uid ?? '',
    });

    activeMeeting.step2_summary_note = note;
    activeMeeting.step2_improvement_candidates = candidates;
    activeMeeting.improvement_candidate_count = candidates.length;

    await markStepDone(2);
    alert('Step2の内容を保存しました。');
}

// -------------------------------------------------------
// Step3 — 改善方針の決定
// -------------------------------------------------------
async function renderStep3(area) {
    // 既存の施策を取得
    const q = query(collection(db, 't_chef_improvement_plans'),
        where('store_id', '==', currentStoreId),
        where('decided_in_year_month', '==', activeMeeting.year_month));
    const snap = await getDocs(q);
    step3Plans = [];
    snap.forEach(d => step3Plans.push({ id: d.id, ...d.data() }));

    // Step2の候補で、まだStep3に存在しないものを補完
    const existingNames = new Set(step3Plans.map(p => p.product_name));
    const candidates = activeMeeting.step2_improvement_candidates || [];
    candidates.forEach(name => {
        if (!existingNames.has(name)) {
            step3Plans.push({ id: null, product_name: name, isNew: true });
        }
    });

    const isEmpty = step3Plans.length === 0;

    const cardsHtml = isEmpty
        ? `<div class="mp-empty-state"><i class="fas fa-lightbulb"></i><p>Step2で改善候補に追加した商品がここに表示されます。<br>まずStep2に戻って候補商品を追加してください。</p></div>`
        : step3Plans.map((plan, idx) => renderStep3Card(plan, idx)).join('');

    area.innerHTML = `
    <div class="mp-step-content">
        <div class="mp-step-content-header">
            <span class="mp-step-content-title"><span style="background:#f59e0b;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:800;">3</span> 改善方針の決定</span>
            <span style="font-size:0.82rem;color:#92400e;">${step3Plans.length}商品が改善候補</span>
        </div>
        <div class="mp-step-content-body">
            <div class="mp-section-note">
                <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:0.3rem;"></i>
                各商品について、今後の対応方針を決定してください。「改善する」を選んだ商品は、来月のStep1で経過を確認します。
            </div>
            <div id="mp-step3-cards">${cardsHtml}</div>
        </div>
        <div class="mp-step-nav">
            <button class="mp-nav-btn prev" onclick="window._mpGoStep(2)">
                <i class="fas fa-chevron-left"></i> Step2へ
            </button>
            <div style="display:flex;gap:0.6rem;">
                <button class="mp-nav-btn save" onclick="window._mpSaveStep3()">
                    <i class="fas fa-save"></i> 保存
                </button>
                <button class="mp-nav-btn next" onclick="window._mpGoStep(4)">
                    Step4へ <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    </div>`;

    window._mpSelectPolicy = (planIdx, val) => {
        const group = document.getElementById(`mp-policy-group-${planIdx}`);
        if (!group) return;
        group.querySelectorAll('.mp-policy-btn').forEach(btn => {
            btn.className = `mp-policy-btn`;
            if (btn.dataset.val === val) {
                btn.classList.add('selected');
                const clsMap = { '改善する': 'improve', '廃止する': 'discontinue', '継続検討する': 'defer', '今回は見送る': 'skip' };
                btn.classList.add(clsMap[val] || '');
            }
        });
    };

    window._mpSaveStep3 = async () => await saveStep3();
}

function renderStep3Card(plan, idx) {
    const policyOptions = ['改善する', '廃止する', '継続検討する', '今回は見送る'];
    const clsMap = { '改善する': 'improve', '廃止する': 'discontinue', '継続検討する': 'defer', '今回は見送る': 'skip' };

    const policyBtns = policyOptions.map(p => {
        const isSelected = plan.action_policy === p;
        return `<button class="mp-policy-btn ${isSelected ? 'selected ' + clsMap[p] : ''}"
                    data-val="${p}"
                    onclick="window._mpSelectPolicy(${idx}, '${p}')">
                    ${p}
                </button>`;
    }).join('');

    const metricsOptions = ['販売数', '売上', '原価率', '粗利額', '顧客反応', '現場評価'];
    const metricsHtml = metricsOptions.map(m => `
        <label style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.82rem;cursor:pointer;margin-right:0.6rem;">
            <input type="checkbox" value="${m}" ${(plan.target_metrics || []).includes(m) ? 'checked' : ''}>
            ${m}
        </label>
    `).join('');

    return `
    <div class="mp-plan-card" data-plan-idx="${idx}" data-plan-id="${plan.id || ''}">
        <div class="mp-plan-card-header">
            <span class="mp-plan-product-name">${escHtml(plan.product_name || '商品名未設定')}</span>
            ${plan.snapshot_abc_rank ? `<div class="mp-plan-snapshot">
                <span>ABC: <span class="mp-abc-badge rank-${plan.snapshot_abc_rank}">${plan.snapshot_abc_rank}</span></span>
                ${plan.snapshot_cost_rate ? `<span>原価率: <span class="mp-cost-rate-high">${plan.snapshot_cost_rate}%</span></span>` : ''}
                ${plan.snapshot_quantity_sold ? `<span>販売数: ${plan.snapshot_quantity_sold}食</span>` : ''}
            </div>` : ''}
        </div>
        <div class="mp-plan-form">
            <div class="mp-form-group full-width">
                <label>対応方針 <span style="color:#ef4444;">*</span></label>
                <div class="mp-policy-group" id="mp-policy-group-${idx}">${policyBtns}</div>
            </div>
            <div class="mp-form-group full-width">
                <label>現状の問題</label>
                <textarea id="mp-plan-issue-${idx}" rows="2" placeholder="何が問題か（例: 原価率が58%と高い、販売数が低迷している）">${escHtml(plan.current_issue || '')}</textarea>
            </div>
            <div class="mp-form-group full-width">
                <label>具体的な実施内容</label>
                <textarea id="mp-plan-action-${idx}" rows="2" placeholder="具体的に何をするか（例: 仕入先を変更し、原材料コストを下げる）">${escHtml(plan.action_detail || '')}</textarea>
            </div>
            <div class="mp-form-group full-width">
                <label>改善の狙い</label>
                <input type="text" id="mp-plan-goal-${idx}" value="${escHtml(plan.improvement_goal || '')}" placeholder="例: 原価率を35%以下に下げる、販売数を前月比+20%にする">
            </div>
            <div class="mp-form-group full-width">
                <label>確認する指標</label>
                <div id="mp-plan-metrics-${idx}" style="display:flex;flex-wrap:wrap;gap:0.3rem;padding:0.5rem 0;">${metricsHtml}</div>
            </div>
            <div class="mp-form-group">
                <label>改善前の基準値</label>
                <input type="text" id="mp-plan-baseline-${idx}" value="${escHtml(plan.baseline_value || '')}" placeholder="例: 販売数 24食/月、原価率 58%">
            </div>
            <div class="mp-form-group">
                <label>実施予定日</label>
                <input type="date" id="mp-plan-date-${idx}" value="${plan.planned_date || ''}">
            </div>
            <div class="mp-form-group">
                <label>担当者</label>
                <input type="text" id="mp-plan-assignee-${idx}" value="${escHtml(plan.assignee || '')}" placeholder="例: 料理長">
            </div>
            <div class="mp-form-group">
                <label>備考</label>
                <input type="text" id="mp-plan-notes-${idx}" value="${escHtml(plan.notes || '')}" placeholder="その他メモ">
            </div>
        </div>
    </div>`;
}

async function saveStep3() {
    const btn = document.querySelector('.mp-nav-btn.save');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...'; }

    try {
        const cards = document.querySelectorAll('.mp-plan-card');
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const planIdx  = parseInt(card.dataset.planIdx);
            const existingId = card.dataset.planId;

            const selectedPolicyBtn = card.querySelector(`#mp-policy-group-${planIdx} .mp-policy-btn.selected`);
            const policy   = selectedPolicyBtn?.dataset?.val || '';
            const metrics  = [...card.querySelectorAll(`#mp-plan-metrics-${planIdx} input[type=checkbox]:checked`)].map(c => c.value);

            const data = {
                store_id:    currentStoreId,
                store_name:  currentStoreName,
                decided_in_year_month: activeMeeting.year_month,
                product_name:   step3Plans[planIdx]?.product_name || '',
                current_issue:  document.getElementById(`mp-plan-issue-${planIdx}`)?.value || '',
                action_policy:  policy,
                action_detail:  document.getElementById(`mp-plan-action-${planIdx}`)?.value || '',
                improvement_goal: document.getElementById(`mp-plan-goal-${planIdx}`)?.value || '',
                target_metrics: metrics,
                baseline_value: document.getElementById(`mp-plan-baseline-${planIdx}`)?.value || '',
                planned_date:   document.getElementById(`mp-plan-date-${planIdx}`)?.value || '',
                assignee:       document.getElementById(`mp-plan-assignee-${planIdx}`)?.value || '',
                notes:          document.getElementById(`mp-plan-notes-${planIdx}`)?.value || '',
                observation_status: policy === '改善する' ? 'not_started' : 'not_applicable',
                observation_month_count: 0,
                updated_at: serverTimestamp(),
            };

            if (existingId) {
                await updateDoc(doc(db, 't_chef_improvement_plans', existingId), data);
            } else {
                data.created_at = serverTimestamp();
                await addDoc(collection(db, 't_chef_improvement_plans'), data);
            }
        }

        // 観察中施策数を更新
        const obsQ = query(collection(db, 't_chef_improvement_plans'),
            where('store_id', '==', currentStoreId),
            where('observation_status', 'in', ['observing', 'extended', 'not_started']));
        const obsSnap = await getDocs(obsQ);
        await updateDoc(doc(db, 't_chef_meetings', activeMeetingId), {
            observing_count: obsSnap.size,
            updated_at: serverTimestamp(),
        });

        await markStepDone(3);
        alert('Step3の内容を保存しました。');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 保存'; }

    } catch (e) {
        console.error('[MenuPDCA] Step3保存エラー:', e);
        alert('保存に失敗しました: ' + e.message);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 保存'; }
    }
}

// -------------------------------------------------------
// Step4 — 来月の商品決定
// -------------------------------------------------------
let step4AllPrototypes = [];
let isPrototypeListOpen = false;
let step4SearchKeyword = '';
let mpMasterCache = null;

function _mpCalculateProtoCost(proto) {
    if (!mpMasterCache || !proto.recipe || !Array.isArray(proto.recipe)) return 0;
    
    // 再帰的に原価を計算（無限ループ防止の visiting Set）
    function getRecursiveCost(itemId, visiting = new Set()) {
        if (visiting.has(itemId)) return 0;
        visiting.add(itemId);
        const itm = mpMasterCache.items.find(i => i.id === itemId);
        if (itm) return getEffectivePrice(itemId, mpMasterCache);
        
        const subProto = step4AllPrototypes.find(p => p.id === itemId);
        if (subProto && Array.isArray(subProto.recipe)) {
            let total = 0;
            subProto.recipe.forEach(r => total += getRecursiveCost(r.ingredient_id, visiting) * (r.quantity || 0));
            const yieldAmt = Number(subProto.yield_amount) || 1;
            return yieldAmt > 0 ? (total / yieldAmt) : 0;
        }
        
        return 0;
    }

    let total = 0;
    proto.recipe.forEach(r => {
        total += getRecursiveCost(r.ingredient_id) * (r.quantity || 0);
    });
    
    const yieldAmt = Number(proto.yield_amount) || 1;
    return yieldAmt > 0 ? (total / yieldAmt) : 0;
}

async function renderStep4(area) {
    // マスタキャッシュの準備 (初回のみ)
    if (!mpMasterCache) {
        const [iSnap, ingSnap, mSnap] = await Promise.all([
            getDocs(collection(db, 'm_items')),
            getDocs(collection(db, 'm_ingredients')),
            getDocs(collection(db, 'm_menus'))
        ]);
        mpMasterCache = {
            items: iSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            ingredients: ingSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            menus: mSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };
    }

    // 全試作品を取得
    const q = query(collection(db, 't_prototype_recipes'));
    const snap = await getDocs(q);
    step4AllPrototypes = [];
    snap.forEach(d => step4AllPrototypes.push({ id: d.id, ...d.data() }));
    // 降順ソート
    step4AllPrototypes.sort((a, b) => (b.updated_at?.seconds || 0) - (a.updated_at?.seconds || 0));

    // 現在の会議に紐づく試作品（すでに採用/保留などが判定されたもの）
    // （今回は店舗や年月の紐付けが曖昧だったため、meeting_year_month が一致するものを抽出）
    step4Prototypes = step4AllPrototypes.filter(p => 
        p.meeting_year_month === activeMeeting.year_month
    );

    window._mpUpdatePrototypeListTable = () => {
        const tbody = document.getElementById('mp-step4-prototype-tbody');
        if (!tbody) return;

        const kw = step4SearchKeyword.trim().toLowerCase();
        
        if (!kw) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#64748b;">検索キーワードを入力すると、試作品が表示されます。</td></tr>`;
            return;
        }

        const filtered = step4AllPrototypes.filter(p => 
            !step4Prototypes.find(sp => sp.id === p.id) && // 既に追加済みのものは除外
            ((p.name || '').toLowerCase().includes(kw) || 
             (p.furigana || '').toLowerCase().includes(kw) || 
             (p.developer || p.created_by_name || '').toLowerCase().includes(kw))
        );

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#64748b;">該当する試作品がありません。</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            // ここで動的に原価を計算（スナップショットがあればそれを使用、ただし0や空文字の場合は再計算）
            const savedCost = Number(p.total_cost);
            const cost = savedCost > 0 ? savedCost : _mpCalculateProtoCost(p);
            const calcRate = (cost > 0 && p.selling_price > 0) ? (cost / p.selling_price * 100) : null;
            const costRateHtml = calcRate !== null ? `${calcRate.toFixed(1)}%` : '—';
            const devName = escHtml(p.developer || p.created_by_name || p.assignee || '—');
            return `
            <tr>
                <td style="padding:0.6rem; border-bottom:1px solid #e2e8f0;">${escHtml(p.name || '名称未設定')}</td>
                <td style="padding:0.6rem; border-bottom:1px solid #e2e8f0;">${devName}</td>
                <td style="padding:0.6rem; border-bottom:1px solid #e2e8f0;">${costRateHtml}</td>
                <td style="padding:0.6rem; border-bottom:1px solid #e2e8f0;">
                    <button onclick="window._mpPreviewProtoImage('${p.image_url || ''}')" style="background:none;border:none;color:#3b82f6;cursor:pointer;font-size:0.85rem;" ${!p.image_url ? 'disabled' : ''}>
                        <i class="fas fa-image"></i> 画像
                    </button>
                </td>
                <td style="padding:0.6rem; border-bottom:1px solid #e2e8f0; text-align:right;">
                    <button onclick="window._mpAddPrototypeToMeeting('${p.id}')" style="padding:0.3rem 0.6rem;background:#f59e0b;color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.8rem;">
                        <i class="fas fa-plus"></i> 追加
                    </button>
                </td>
            </tr>`;
        }).join('');
    };

    window._mpUpdateStep4View = () => {
        const isEmpty = step4Prototypes.length === 0;
        const cardsHtml = isEmpty
            ? `<div class="mp-empty-state"><i class="fas fa-flask"></i><p>採用候補に登録されている試作品がありません。<br>上の「試作品から選択」ボタンから追加してください。</p></div>`
            : `<div style="display:flex; flex-direction:column; gap:1.5rem;">${step4Prototypes.map((p, i) => renderStep4Card(p, i)).join('')}</div>`;

        let listHtml = '';
        if (isPrototypeListOpen) {
            listHtml = `
            <div style="background:white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-top: 1rem; margin-bottom: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
                    <h4 style="margin:0; font-size:1rem; color:#1e293b;"><i class="fas fa-flask" style="color:#f59e0b;"></i> 試作品リストから選択</h4>
                    <input type="text" placeholder="商品名や開発者で検索..." value="${escHtml(step4SearchKeyword)}" oninput="window._mpSearchPrototypeList(this.value)" style="padding:0.4rem 0.8rem; border:1px solid #cbd5e1; border-radius:6px; width:220px; font-size:0.85rem; outline:none;" id="mp-step4-search-input">
                </div>
                <div style="max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:6px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead style="background:#f8fafc; position:sticky; top:0;">
                            <tr>
                                <th style="padding:0.6rem; text-align:left; border-bottom:1px solid #e2e8f0; color:#475569;">商品名</th>
                                <th style="padding:0.6rem; text-align:left; border-bottom:1px solid #e2e8f0; color:#475569;">開発者</th>
                                <th style="padding:0.6rem; text-align:left; border-bottom:1px solid #e2e8f0; color:#475569;">原価率</th>
                                <th style="padding:0.6rem; text-align:left; border-bottom:1px solid #e2e8f0; color:#475569;">画像</th>
                                <th style="padding:0.6rem; text-align:right; border-bottom:1px solid #e2e8f0; color:#475569;">操作</th>
                            </tr>
                        </thead>
                        <tbody id="mp-step4-prototype-tbody">
                        </tbody>
                    </table>
                </div>
            </div>`;
        }

        area.innerHTML = `
        <div class="mp-step-content">
            <div class="mp-step-content-header">
                <span class="mp-step-content-title"><span style="background:#f59e0b;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:800;">4</span> 来月の商品決定</span>
                <button onclick="window._mpTogglePrototypeList()" style="padding:0.4rem 0.9rem;border:1.5px solid #f59e0b;background:${isPrototypeListOpen ? '#f59e0b' : 'white'};color:${isPrototypeListOpen ? 'white' : '#d97706'};border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;">
                    <i class="fas ${isPrototypeListOpen ? 'fa-times' : 'fa-list'}"></i> ${isPrototypeListOpen ? 'リストを閉じる' : '試作品から選択'}
                </button>
            </div>
            <div class="mp-step-content-body">
                ${listHtml}
                <div class="mp-section-note">
                    <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:0.3rem;"></i>
                    採用候補の試作品を確認し、翌月の採用可否を決定してください。「採用」を選ぶと詳細情報の入力欄が表示されます。
                </div>
                ${cardsHtml}
            </div>
            <div class="mp-step-nav">
                <button class="mp-nav-btn prev" onclick="window._mpGoStep(3)">
                    <i class="fas fa-chevron-left"></i> Step3へ
                </button>
                <div style="display:flex;gap:0.6rem;">
                    <button class="mp-nav-btn save" onclick="window._mpSaveStep4()">
                        <i class="fas fa-save"></i> 保存
                    </button>
                    <button class="mp-nav-btn next" onclick="window._mpGoStep(5)">
                        Step5へ <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        </div>`;

        if (isPrototypeListOpen) {
            window._mpUpdatePrototypeListTable();
            // カーソルをインプットに戻す
            const input = document.getElementById('mp-step4-search-input');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }
    };

    window._mpUpdateStep4View();

    window._mpTogglePrototypeList = () => {
        isPrototypeListOpen = !isPrototypeListOpen;
        window._mpUpdateStep4View();
    };

    window._mpSearchPrototypeList = (kw) => {
        step4SearchKeyword = kw;
        window._mpUpdatePrototypeListTable();
    };

    // 原価率動的計算
    window._mpUpdateCostRate = (protoId, totalCost, inputVal) => {
        const rateEl = document.getElementById(`mp-adopt-rate-${protoId}`);
        if (!rateEl) return;
        const price = parseFloat(inputVal);
        if (price > 0 && totalCost > 0) {
            const rate = (totalCost / price) * 100;
            rateEl.innerText = rate.toFixed(1) + '%';
        } else {
            rateEl.innerText = '—';
        }
    };

    window._mpAutoResizeTextarea = (el) => {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    };

    window._mpSelectJudgement4 = (protoId, val, btn) => {
        // Obsolete (Buttons removed)
    };

    window._mpAddPrototypeToMeeting = (id) => {
        const p = step4AllPrototypes.find(x => x.id === id);
        if (p && !step4Prototypes.find(x => x.id === id)) {
            step4Prototypes.push(p);
            step4Judgements[p.id] = 'adopt'; // デフォルトで採用にする
        }
        window._mpUpdateStep4View();
    };

    window._mpRemovePrototypeFromMeeting = (id) => {
        step4Prototypes = step4Prototypes.filter(x => x.id !== id);
        delete step4Judgements[id];
        window._mpUpdateStep4View();
    };

    window._mpPreviewProtoImage = (url) => {
        if (!url) return;
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:99999;cursor:pointer;';
        div.innerHTML = `<div style="position:relative; max-width:90%; max-height:90%;">
            <button onclick="this.parentElement.parentElement.remove()" style="position:absolute;top:-30px;right:-30px;background:none;border:none;color:white;font-size:1.5rem;cursor:pointer;"><i class="fas fa-times"></i></button>
            <img src="${url}" style="max-width:100%;max-height:80vh;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.5); object-fit:contain;">
        </div>`;
        div.onclick = (e) => { if(e.target === div) div.remove(); };
        document.body.appendChild(div);
    };

    window._mpSaveStep4 = async () => await saveStep4();
}

function renderStep4Card(proto, idx) {
    const name = proto.name || proto.item_name || `試作品 #${idx+1}`;
    const devName = escHtml(proto.developer || proto.created_by_name || proto.assignee || '—');
    
    // スナップショットがあれば使用、ただし0や空文字の場合は再計算する
    const savedCost = Number(proto.total_cost);
    const totalCost = savedCost > 0 ? savedCost : _mpCalculateProtoCost(proto);
    const sellingPrice = proto.selling_price || '';
    
    let costRateHtml = '—';
    if (totalCost > 0 && sellingPrice > 0) {
        costRateHtml = (totalCost / sellingPrice * 100).toFixed(1) + '%';
    }
    
    // UIをスッキリさせるため、採用リスト追加時は自動的に adopt 状態とみなす。
    return `
    <div class="mp-proto-card" id="mp-proto-card-${proto.id}" style="display:flex; flex-direction:column; padding:1.2rem; position:relative;">
        <!-- ヘッダー -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:0.8rem; margin-bottom:1rem;">
            <div style="display:flex; align-items:center; gap:1rem;">
                <div style="font-weight:800; color:#1e293b; font-size:1.1rem;">${escHtml(name)}</div>
                <div style="font-size:0.8rem; color:#64748b;"><i class="fas fa-user"></i> ${devName}</div>
            </div>
            <button onclick="window._mpRemovePrototypeFromMeeting('${proto.id}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;" title="採用候補から外す"><i class="fas fa-times"></i></button>
        </div>
        <!-- ボディ（横に３列） -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 2fr; gap:1.5rem;">
            <!-- 左：予定日と原価 -->
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <div class="mp-form-group" style="margin:0;">
                    <label>提供予定日</label>
                    <input type="date" id="mp-adopt-date-${proto.id}" value="${proto.serve_date || ''}">
                </div>
                <div class="mp-form-group" style="margin:0;">
                    <label>商品原価</label>
                    <div style="padding:0.4rem 0; font-size:1.1rem; font-weight:700; color:#475569;">${totalCost ? '¥' + totalCost.toLocaleString() : '—'}</div>
                </div>
            </div>
            <!-- 中央：想定売価と原価率 -->
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <div class="mp-form-group" style="margin:0;">
                    <label>想定売価 (¥)</label>
                    <input type="number" id="mp-adopt-price-${proto.id}" value="${sellingPrice}" 
                        oninput="window._mpUpdateCostRate('${proto.id}', ${totalCost}, this.value)"
                        placeholder="例: 690">
                </div>
                <div class="mp-form-group" style="margin:0;">
                    <label>想定原価率</label>
                    <div id="mp-adopt-rate-${proto.id}" style="padding:0.4rem 0; font-size:1.1rem; font-weight:700; color:#475569;">${costRateHtml}</div>
                </div>
            </div>
            <!-- 右：コンセプト -->
            <div style="display:flex; flex-direction:column; gap:0.5rem; height:100%;">
                <div class="mp-form-group" style="margin:0; height:100%; display:flex; flex-direction:column;">
                    <label>商品の狙い・コンセプト</label>
                    <textarea id="mp-adopt-concept-${proto.id}" 
                              placeholder="例: 夏の定番・高客単価" 
                              style="flex-grow:1; resize:none; overflow:hidden; min-height:80px; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit; font-size:0.9rem;"
                              oninput="window._mpAutoResizeTextarea(this)">${escHtml(proto.concept || '')}</textarea>
                </div>
            </div>
        </div>
    </div>`;
}

async function saveStep4() {
    try {
        for (const proto of step4Prototypes) {
            // UIからボタンを消したため、リストにあるものは全て採用(adopt)として保存
            const judgement = 'adopt';
            
            // 原価の再計算（スナップショットとして保存するため）
            const cost = _mpCalculateProtoCost(proto);
            
            const updateData = {
                meeting_judgement: judgement,
                meeting_year_month: activeMeeting.year_month,
                updated_at: serverTimestamp(),
                serve_date: document.getElementById(`mp-adopt-date-${proto.id}`)?.value || '',
                concept: document.getElementById(`mp-adopt-concept-${proto.id}`)?.value || '',
                total_cost: cost // ★スナップショット保存
            };

            const priceInput = document.getElementById(`mp-adopt-price-${proto.id}`);
            if (priceInput && priceInput.value) {
                updateData.selling_price = parseFloat(priceInput.value);
            }

            await updateDoc(doc(db, 't_prototype_recipes', proto.id), updateData);
        }

        await markStepDone(4);
        alert('Step4の内容を保存しました。');
    } catch (e) {
        console.error('[MenuPDCA] Step4保存エラー:', e);
        alert('保存に失敗しました: ' + e.message);
    }
}

// -------------------------------------------------------
// Step5 — 担当者・宿題の決定
// -------------------------------------------------------
async function renderStep5(area) {
    const q = query(collection(db, 't_chef_homework'),
        where('store_id', '==', currentStoreId),
        where('year_month', '==', activeMeeting.year_month));
    const snap = await getDocs(q);
    step5Homework = [];
    snap.forEach(d => step5Homework.push({ id: d.id, ...d.data() }));
    // JS側で昇順ソート
    step5Homework.sort((a, b) => (a.created_at?.toMillis?.() || 0) - (b.created_at?.toMillis?.() || 0));

    area.innerHTML = `
    <div class="mp-step-content">
        <div class="mp-step-content-header">
            <span class="mp-step-content-title"><span style="background:#f59e0b;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:800;">5</span> 担当者・宿題の決定</span>
            <span style="font-size:0.82rem;color:#92400e;">${step5Homework.length}件の宿題</span>
        </div>
        <div class="mp-step-content-body">
            <div class="mp-section-note">
                <i class="fas fa-info-circle" style="color:#f59e0b;margin-right:0.3rem;"></i>
                決定事項を実行に移すため、誰が何をいつまでに行うかを登録してください。
            </div>
            <div id="mp-hw-list">${renderHomeworkList()}</div>
            <button class="mp-add-hw-btn" onclick="window._mpOpenHwModal()">
                <i class="fas fa-plus"></i> 宿題を追加する
            </button>

            <div style="margin-top:1.5rem;">
                <div class="mp-form-group">
                    <label>主な決定事項</label>
                    <textarea id="mp-decisions" rows="3" placeholder="今回の会議で決定した主なことをまとめてください...">${escHtml(activeMeeting.main_decisions || '')}</textarea>
                </div>
                <div class="mp-form-group" style="margin-top:0.8rem;">
                    <label>補足・メモ</label>
                    <textarea id="mp-notes" rows="2" placeholder="補足事項など...">${escHtml(activeMeeting.supplementary_notes || '')}</textarea>
                </div>
                <div class="mp-form-group" style="margin-top:0.8rem;">
                    <label>次回への申し送り</label>
                    <textarea id="mp-next-notes" rows="2" placeholder="次回の会議で確認すべきことなど...">${escHtml(activeMeeting.next_meeting_notes || '')}</textarea>
                </div>
            </div>
        </div>
        <div class="mp-step-nav">
            <button class="mp-nav-btn prev" onclick="window._mpGoStep(4)">
                <i class="fas fa-chevron-left"></i> Step4へ
            </button>
            <button class="mp-nav-btn save" onclick="window._mpSaveStep5()">
                <i class="fas fa-save"></i> 保存
            </button>
        </div>

        <div class="mp-complete-section">
            <p style="margin:0 0 1rem;font-size:0.9rem;color:#92400e;font-weight:600;">
                すべてのステップが完了したら会議を確定してください。
            </p>
            <button class="mp-complete-btn" onclick="window._mpCompleteMeeting()">
                <i class="fas fa-check-double"></i> 会議を完了する
            </button>
        </div>
    </div>`;

    window._mpSaveStep5   = async () => await saveStep5();
    window._mpOpenHwModal = () => openHomeworkModal();
    window._mpUpdateHwStatus = async (hwId, status) => {
        await updateDoc(doc(db, 't_chef_homework', hwId), { status, updated_at: serverTimestamp() });
        const hw = step5Homework.find(h => h.id === hwId);
        if (hw) hw.status = status;
    };
    window._mpCompleteMeeting = async () => await completeMeeting();
}

function renderHomeworkList() {
    if (step5Homework.length === 0) return '';

    const statusColors = { '未着手': '#94a3b8', '対応中': '#f59e0b', '完了': '#10b981', '中止': '#ef4444' };

    return `<div class="mp-homework-list">${step5Homework.map(hw => `
        <div class="mp-homework-card" data-hw-id="${hw.id}">
            <select class="mp-hw-status-select" onchange="window._mpUpdateHwStatus('${hw.id}', this.value)"
                style="border-color:${statusColors[hw.status] || '#e2e8f0'};color:${statusColors[hw.status] || '#64748b'};">
                ${['未着手','対応中','完了','中止'].map(s => `<option ${hw.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <div class="mp-hw-content">
                <div class="mp-hw-title">${escHtml(hw.content || '')}</div>
                <div class="mp-hw-meta">
                    <span><i class="fas fa-user"></i> ${escHtml(hw.assignee || '—')}</span>
                    <span><i class="fas fa-calendar"></i> 期限: ${hw.deadline || '—'}</span>
                    ${hw.related_product ? `<span><i class="fas fa-utensils"></i> ${escHtml(hw.related_product)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('')}</div>`;
}

function openHomeworkModal() {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth()+1, 28).toISOString().slice(0,10);

    const html = `
    <div class="mp-modal-overlay" id="mp-hw-modal" onclick="window._mpCloseHwModal(event)">
        <div class="mp-modal">
            <div class="mp-modal-header">
                <span><i class="fas fa-tasks" style="color:#f59e0b;margin-right:0.5rem;"></i>宿題を追加</span>
                <button class="mp-modal-close" onclick="window._mpCloseHwModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="mp-modal-body">
                <div class="mp-form-group">
                    <label>担当者 <span style="color:#ef4444;">*</span></label>
                    <input type="text" id="mp-hw-assignee" placeholder="例: 料理長、小山内">
                </div>
                <div class="mp-form-group">
                    <label>宿題内容 <span style="color:#ef4444;">*</span></label>
                    <textarea id="mp-hw-content" rows="3" placeholder="例: ポテトサラダの盛り付けを変更する"></textarea>
                </div>
                <div class="mp-form-group">
                    <label>期限</label>
                    <input type="date" id="mp-hw-deadline" value="${nextMonth}">
                </div>
                <div class="mp-form-group">
                    <label>関連商品（任意）</label>
                    <input type="text" id="mp-hw-product" placeholder="例: ポテトサラダ">
                </div>
                <div class="mp-form-group">
                    <label>備考</label>
                    <input type="text" id="mp-hw-notes" placeholder="">
                </div>
            </div>
            <div class="mp-modal-footer">
                <button class="mp-btn-cancel" onclick="window._mpCloseHwModal()">キャンセル</button>
                <button class="mp-btn-save" onclick="window._mpSaveHw()"><i class="fas fa-check"></i> 追加</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    window._mpCloseHwModal = (e) => {
        if (e && e.target !== document.getElementById('mp-hw-modal')) return;
        document.getElementById('mp-hw-modal')?.remove();
    };

    window._mpSaveHw = async () => {
        const assignee = document.getElementById('mp-hw-assignee').value.trim();
        const content  = document.getElementById('mp-hw-content').value.trim();
        const deadline = document.getElementById('mp-hw-deadline').value;
        const product  = document.getElementById('mp-hw-product').value.trim();
        const notes    = document.getElementById('mp-hw-notes').value.trim();

        if (!assignee || !content) { alert('担当者と宿題内容は必須です。'); return; }

        const data = {
            store_id:        currentStoreId,
            year_month:      activeMeeting.year_month,
            assignee,
            content,
            deadline,
            related_product: product,
            related_plan_id: '',
            notes,
            status: '未着手',
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
        };

        const ref = await addDoc(collection(db, 't_chef_homework'), data);
        step5Homework.push({ id: ref.id, ...data });

        document.getElementById('mp-hw-modal')?.remove();
        document.getElementById('mp-hw-list').innerHTML = renderHomeworkList();

        // グローバル再登録
        window._mpUpdateHwStatus = async (hwId, status) => {
            await updateDoc(doc(db, 't_chef_homework', hwId), { status, updated_at: serverTimestamp() });
            const hw = step5Homework.find(h => h.id === hwId);
            if (hw) hw.status = status;
        };
    };
}

async function saveStep5() {
    const decisions  = document.getElementById('mp-decisions')?.value || '';
    const notes      = document.getElementById('mp-notes')?.value || '';
    const nextNotes  = document.getElementById('mp-next-notes')?.value || '';

    const hwCount      = step5Homework.length;
    const hwPending    = step5Homework.filter(h => h.status !== '完了' && h.status !== '中止').length;

    await updateDoc(doc(db, 't_chef_meetings', activeMeetingId), {
        main_decisions:      decisions,
        supplementary_notes: notes,
        next_meeting_notes:  nextNotes,
        homework_count:      hwCount,
        homework_pending_count: hwPending,
        updated_at: serverTimestamp(),
        last_updated_by: currentUser?.uid ?? '',
    });

    activeMeeting.main_decisions      = decisions;
    activeMeeting.supplementary_notes = notes;
    activeMeeting.next_meeting_notes  = nextNotes;

    await markStepDone(5);
    alert('Step5の内容を保存しました。');
}

// -------------------------------------------------------
// 会議完了
// -------------------------------------------------------
async function completeMeeting() {
    const confirmed = confirm('会議を完了します。Step1〜5の内容がすべて保存されていることを確認してください。\n\nよろしいですか？');
    if (!confirmed) return;

    await updateDoc(doc(db, 't_chef_meetings', activeMeetingId), {
        status: '完了',
        step_progress: { step1_done: true, step2_done: true, step3_done: true, step4_done: true, step5_done: true },
        updated_at: serverTimestamp(),
        last_updated_by: currentUser?.uid ?? '',
    });

    activeMeeting.status = '完了';
    activeMeeting.step_progress = { step1_done: true, step2_done: true, step3_done: true, step4_done: true, step5_done: true };

    await renderDetailView();
    renderDashboardView();
}

// -------------------------------------------------------
// -------------------------------------------------------
// ダッシュボードHTML生成（画面表示用 & PDF出力用 共通）
// -------------------------------------------------------
function generateDashboardHtml(m, plans, homework) {
    // 改善施策のグループ化
    const policyGroups = {};
    plans.forEach(p => {
        const policy = p.action_policy || '未設定';
        if (!policyGroups[policy]) policyGroups[policy] = [];
        policyGroups[policy].push(p);
    });

    let plansHtml = '';
    if (plans.length === 0) {
        plansHtml = '<p style="color:#94a3b8;font-size:0.85rem;">なし</p>';
    } else {
        const policyOrder = { '改善する': 1, '廃止する': 2, '継続検討する': 3, '今回は見送る': 4, '未設定': 5 };
        const sortedPolicies = Object.keys(policyGroups).sort((a, b) => (policyOrder[a] || 99) - (policyOrder[b] || 99));

        for (const policy of sortedPolicies) {
            const policyPlans = policyGroups[policy];
            plansHtml += `
                <div style="margin-bottom: 1.2rem;">
                    <div style="font-weight:700; color:#0f172a; font-size:0.95rem; margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:2px solid #e2e8f0;">
                        ${escHtml(policy)}
                    </div>
                    ${policyPlans.map(p => {
                        let detailsHtml = '';
                        const rowStyle = 'margin-bottom:0.3rem; display:flex; gap:0.5rem;';
                        const labelStyle = 'font-size:0.75rem; color:#64748b; width:100px; flex-shrink:0; line-height:1.4;';
                        const valStyle = 'font-size:0.85rem; color:#1e293b; line-height:1.4; white-space:pre-wrap;';

                        if (p.current_issue) detailsHtml += `<div style="${rowStyle}"><span style="${labelStyle}">現状の問題</span><span style="${valStyle}">${escHtml(p.current_issue)}</span></div>`;
                        if (p.action_detail) detailsHtml += `<div style="${rowStyle}"><span style="${labelStyle}">具体的な実施内容</span><span style="${valStyle}">${escHtml(p.action_detail)}</span></div>`;
                        if (p.improvement_goal) detailsHtml += `<div style="${rowStyle}"><span style="${labelStyle}">改善の狙い</span><span style="${valStyle}">${escHtml(p.improvement_goal)}</span></div>`;
                        if (p.target_metrics && p.target_metrics.length > 0) detailsHtml += `<div style="${rowStyle}"><span style="${labelStyle}">確認する指標</span><span style="${valStyle}">${escHtml(p.target_metrics.join('、'))}</span></div>`;
                        if (p.baseline_value) detailsHtml += `<div style="${rowStyle}"><span style="${labelStyle}">改善前の基準値</span><span style="${valStyle}">${escHtml(p.baseline_value)}</span></div>`;
                        if (p.planned_date) detailsHtml += `<div style="${rowStyle}"><span style="${labelStyle}">実施予定日</span><span style="${valStyle}">${escHtml(p.planned_date)}</span></div>`;
                        if (p.assignee) detailsHtml += `<div style="${rowStyle}"><span style="${labelStyle}">担当者</span><span style="${valStyle}">${escHtml(p.assignee)}</span></div>`;
                        if (p.notes) detailsHtml += `<div style="${rowStyle}"><span style="${labelStyle}">備考</span><span style="${valStyle}">${escHtml(p.notes)}</span></div>`;

                        return `
                        <div style="border-bottom:1px dashed #e2e8f0; padding:0.6rem 0; margin-left:0.5rem;">
                            <div style="font-weight:bold; font-size:0.95rem; margin-bottom:${detailsHtml ? '0.4rem' : '0'}; color:#1e293b;">
                                ${escHtml(p.product_name || '')}
                            </div>
                            ${detailsHtml ? `<div style="padding-left:0.5rem;">${detailsHtml}</div>` : ''}
                        </div>`;
                    }).join('')}
                </div>
            `;
        }
    }

    // 宿題のグループ化
    const hwGroups = {};
    homework.forEach(hw => {
        const assignee = hw.assignee || '担当者未定';
        if (!hwGroups[assignee]) hwGroups[assignee] = [];
        hwGroups[assignee].push(hw);
    });

    let homeworkHtml = '';
    if (homework.length === 0) {
        homeworkHtml = '<p style="color:#94a3b8;font-size:0.85rem;">なし</p>';
    } else {
        for (const [assignee, hws] of Object.entries(hwGroups)) {
            homeworkHtml += `
                <div style="margin-bottom: 1.2rem;">
                    <div style="font-weight:700; color:#b45309; font-size:0.95rem; margin-bottom:0.5rem; padding-bottom:0.3rem; border-bottom:2px solid #fde68a;">
                        ${escHtml(assignee)}
                    </div>
                    ${hws.map(hw => `
                        <div style="border-bottom:1px dashed #e2e8f0; padding:0.5rem 0; margin-left:0.5rem; display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
                            <div style="font-size:0.9rem; font-weight:500; color:#1e293b;">${escHtml(hw.content || '')}</div>
                            <div style="font-size:0.8rem; color:#64748b; flex-shrink:0;">期限: ${hw.deadline || '—'}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    return `
    <div class="mp-step-content mp-pdf-target" style="background:#fff; min-height:100%; border:none; padding:1.5rem;">
        <div class="mp-step-content-header" style="background:linear-gradient(135deg,#fef9f0,#dcfce7); border-radius:8px; padding:1rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="mp-step-content-title" style="display:flex; flex-direction:column; gap:0.2rem;">
                <div style="display:flex; align-items:center; gap:0.5rem; font-size:1.2rem; font-weight:800; color:#065f46;">
                    <i class="fas fa-check-double" style="color:#10b981;"></i>
                    料理長会議 ダッシュボード
                </div>
                <div style="font-size:0.85rem; color:#065f46; font-weight:normal; display:flex; gap:1.2rem; margin-top:0.3rem; margin-left:1.8rem;">
                    <span><i class="fas fa-calendar-alt"></i> ${m.meeting_date ? formatDate(m.meeting_date) : '開催日未定'}</span>
                    <span><i class="fas fa-store"></i> ${escHtml(m.store_name || '—')}</span>
                    <span><i class="fas fa-users"></i> ${(m.attendees || []).join('、') || '—'}</span>
                </div>
            </div>
            <span style="font-size:0.85rem;color:#065f46;font-weight:bold;">対象年月: ${formatYearMonth(m.year_month)}</span>
        </div>
        <div class="mp-step-content-body">
            <div class="mp-dashboard-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">

                <div class="mp-dashboard-panel" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem;">
                    <div class="mp-dashboard-panel-header" style="font-weight:700; color:#1e293b; margin-bottom:1rem; border-bottom:2px solid #e2e8f0; padding-bottom:0.5rem;">
                        <i class="fas fa-lightbulb" style="color:#f59e0b;"></i> 主な決定事項
                    </div>
                    <div class="mp-dashboard-panel-body">
                        <p style="white-space:pre-wrap; font-size:0.9rem; line-height:1.5; color:#1e293b;">${escHtml(m.main_decisions || '（記録なし）')}</p>
                    </div>
                </div>

                <div class="mp-dashboard-panel" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem;">
                    <div class="mp-dashboard-panel-header" style="font-weight:700; color:#1e293b; margin-bottom:1rem; border-bottom:2px solid #e2e8f0; padding-bottom:0.5rem;">
                        <i class="fas fa-sticky-note" style="color:#8b5cf6;"></i> メモ・申し送り
                    </div>
                    <div class="mp-dashboard-panel-body">
                        <div style="display:flex; flex-direction:column; gap:1rem; font-size:0.9rem;">
                            <div><strong style="color:#475569;display:block;margin-bottom:0.3rem;font-size:0.8rem;">補足・メモ</strong><p style="white-space:pre-wrap;line-height:1.5;color:#1e293b;">${escHtml(m.supplementary_notes || '—')}</p></div>
                            <div><strong style="color:#475569;display:block;margin-bottom:0.3rem;font-size:0.8rem;">次回への申し送り</strong><p style="white-space:pre-wrap;line-height:1.5;color:#1e293b;">${escHtml(m.next_meeting_notes || '—')}</p></div>
                        </div>
                    </div>
                </div>

                <div class="mp-dashboard-panel" style="grid-column:1/-1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem;">
                    <div class="mp-dashboard-panel-header" style="font-weight:700; color:#1e293b; margin-bottom:1rem; border-bottom:2px solid #e2e8f0; padding-bottom:0.5rem;">
                        <i class="fas fa-search" style="color:#6366f1;"></i> 改善施策（${plans.length}件）
                    </div>
                    <div class="mp-dashboard-panel-body">
                        ${plansHtml}
                    </div>
                </div>

                <div class="mp-dashboard-panel" style="grid-column:1/-1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem;">
                    <div class="mp-dashboard-panel-header" style="font-weight:700; color:#1e293b; margin-bottom:1rem; border-bottom:2px solid #e2e8f0; padding-bottom:0.5rem;">
                        <i class="fas fa-tasks" style="color:#10b981;"></i> 宿題一覧（${homework.length}件）
                    </div>
                    <div class="mp-dashboard-panel-body">
                        ${homeworkHtml}
                    </div>
                </div>

            </div>
        </div>
    </div>`;
}

// -------------------------------------------------------
// ダッシュボード表示
// -------------------------------------------------------
function renderDashboardView() {
    const area = document.getElementById('mp-step-content-area');
    if (!area) return;
    area.innerHTML = generateDashboardHtml(activeMeeting, step3Plans, step5Homework);
}

// -------------------------------------------------------
// 基本情報編集モーダル
// -------------------------------------------------------
function openEditMeetingModal() {
    const m = activeMeeting;
    const html = `
    <div class="mp-modal-overlay" id="mp-edit-modal" onclick="window._mpCloseEditModal(event)">
        <div class="mp-modal">
            <div class="mp-modal-header">
                <span><i class="fas fa-edit" style="color:#6366f1;margin-right:0.5rem;"></i>基本情報を編集</span>
                <button class="mp-modal-close" onclick="window._mpCloseEditModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="mp-modal-body">
                <div class="mp-form-group">
                    <label>開催日</label>
                    <input type="date" id="mp-edit-date" value="${m.meeting_date || ''}">
                </div>
                <div class="mp-form-group">
                    <label>出席者（カンマ区切り）</label>
                    <input type="text" id="mp-edit-attendees" value="${(m.attendees || []).join('、')}">
                </div>
            </div>
            <div class="mp-modal-footer">
                <button class="mp-btn-cancel" onclick="window._mpCloseEditModal()">キャンセル</button>
                <button class="mp-btn-save" onclick="window._mpSaveEdit()"><i class="fas fa-check"></i> 保存</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    window._mpCloseEditModal = (e) => {
        if (e && e.target !== document.getElementById('mp-edit-modal')) return;
        document.getElementById('mp-edit-modal')?.remove();
    };

    window._mpSaveEdit = async () => {
        const date      = document.getElementById('mp-edit-date').value;
        const attendeesRaw = document.getElementById('mp-edit-attendees').value;
        const attendees = attendeesRaw.split(/[,、，]/).map(s => s.trim()).filter(Boolean);

        await updateDoc(doc(db, 't_chef_meetings', activeMeetingId), {
            meeting_date: date,
            attendees: attendees,
            updated_at: serverTimestamp(),
        });

        activeMeeting.meeting_date = date;
        activeMeeting.attendees = attendees;

        document.getElementById('mp-edit-modal')?.remove();
        await renderDetailView();
    };
}

// -------------------------------------------------------
// PDF出力
// -------------------------------------------------------
function exportPdf() {
    if (typeof html2pdf === 'undefined') {
        alert('PDFライブラリが読み込まれていません。');
        return;
    }
    
    // 裏側に専用のコンテナを作る
    const tempContainer = document.createElement('div');
    // html2canvasの真っ白バグを回避するため、完全に画面外に出さず、z-indexで背面に隠す
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '0';
    tempContainer.style.left = '0';
    tempContainer.style.width = '1000px';
    tempContainer.style.zIndex = '-9999';
    tempContainer.style.pointerEvents = 'none';
    
    // 現在の最新のステートを使ってダッシュボード形式のHTMLを生成
    tempContainer.innerHTML = generateDashboardHtml(activeMeeting, step3Plans, step5Homework);
    document.body.appendChild(tempContainer);

    const opt = {
        margin: 10,
        filename: `料理長会議_${activeMeeting.year_month}_${activeMeeting.store_name}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // DOMが描画されるのを少し待ってからPDF化する
    setTimeout(() => {
        html2pdf().set(opt).from(tempContainer).save().then(() => {
            document.body.removeChild(tempContainer);
        });
    }, 200);
}

// -------------------------------------------------------
// 一覧画面からのPDF出力（直接出力）
// -------------------------------------------------------
window._mpExportPdfFromList = async (meetingId) => {
    if (typeof html2pdf === 'undefined') {
        alert('PDFライブラリが読み込まれていません。');
        return;
    }

    const btn = document.getElementById(`mp-pdf-btn-${meetingId}`);
    try {
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        const mDoc = await getDoc(doc(db, 't_chef_meetings', meetingId));
        if (!mDoc.exists()) return;
        const meetingData = { id: meetingId, ...mDoc.data() };
        
        const qPlans = query(collection(db, 't_chef_improvement_plans'), where('store_id', '==', meetingData.store_id), where('decided_in_year_month', '==', meetingData.year_month));
        const plansSnap = await getDocs(qPlans);
        const plans = [];
        plansSnap.forEach(d => plans.push({ id: d.id, ...d.data() }));

        const qHw = query(collection(db, 't_chef_homework'), where('store_id', '==', meetingData.store_id), where('year_month', '==', meetingData.year_month));
        const hwSnap = await getDocs(qHw);
        const homework = [];
        hwSnap.forEach(d => homework.push({ id: d.id, ...d.data() }));

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.top = '0';
        tempContainer.style.left = '0';
        tempContainer.style.width = '1000px';
        tempContainer.style.zIndex = '-9999';
        tempContainer.style.pointerEvents = 'none';
        
        tempContainer.innerHTML = generateDashboardHtml(meetingData, plans, homework);
        document.body.appendChild(tempContainer);

        const opt = {
            margin: 10,
            filename: `料理長会議_${meetingData.year_month}_${meetingData.store_name}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // DOM描画待ち
        await new Promise(r => setTimeout(r, 200));

        await html2pdf().set(opt).from(tempContainer).save();
        document.body.removeChild(tempContainer);

    } catch (e) {
        console.error(e);
        alert('PDFの出力中にエラーが発生しました。');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-pdf" style="color:#ef4444;"></i>';
        }
    }
};

// -------------------------------------------------------
// ユーティリティ
// -------------------------------------------------------

async function markStepDone(stepNum) {
    const key = `step${stepNum}_done`;
    const progress = { ...(activeMeeting.step_progress || {}) };
    progress[key] = true;

    await updateDoc(doc(db, 't_chef_meetings', activeMeetingId), {
        [`step_progress.${key}`]: true,
        status: '作成中',
        updated_at: serverTimestamp(),
    });
    activeMeeting.step_progress = progress;
    updateStepperUI();
}

function statusDisplay(status) {
    const map = {
        '未作成':   { cls: 'status-not-started', icon: '○', label: '未作成' },
        '作成中':   { cls: 'status-in-progress', icon: '⚡', label: '作成中' },
        '会議中':   { cls: 'status-in-meeting',  icon: '▶', label: '会議中' },
        '完了':     { cls: 'status-done',         icon: '✓', label: '完了'   },
        '再編集':   { cls: 'status-re-edit',      icon: '✎', label: '再編集' },
    };
    return map[status] || { cls: 'status-not-started', icon: '?', label: status };
}

function formatYearMonth(ym) {
    if (!ym) return '—';
    const [y, m] = ym.split('-');
    return `${y}年${parseInt(m)}月`;
}

function formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    const weekDays = ['日','月','火','水','木','金','土'];
    return `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}(${weekDays[date.getDay()]})`;
}

function getPrevMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const prev = new Date(y, m-2, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
}

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// -------------------------------------------------------
// 宿題管理ビュー（会議外からのアクセス）
// -------------------------------------------------------
async function renderHomeworkManagementView() {
    const contentArea = document.getElementById('mp-top-tab-content');
    if (!contentArea) return;

    if (!currentStoreId) {
        contentArea.innerHTML = `<div class="mp-empty-state"><i class="fas fa-store"></i><p>店舗を選択してください。</p></div>`;
        return;
    }

    contentArea.innerHTML = `<div class="mp-spinner-overlay"><div class="mp-spinner"></div><span>宿題データを取得中...</span></div>`;

    // 全宿題を取得
    const q = query(
        collection(db, 't_chef_homework'),
        where('store_id', '==', currentStoreId)
    );
    const snap = await getDocs(q);
    let allHw = [];
    snap.forEach(d => allHw.push({ id: d.id, ...d.data() }));
    
    // JS側で期限の昇順にソート（未設定は末尾）
    allHw.sort((a, b) => {
        const da = a.deadline || '9999-99-99';
        const db = b.deadline || '9999-99-99';
        return da.localeCompare(db);
    });

    const today = new Date().toISOString().slice(0, 10);

    function renderHwRows(list) {
        if (list.length === 0) return `<div class="mp-empty-state" style="padding:2rem;"><i class="fas fa-check-circle" style="color:#10b981;"></i><p>該当する宿題はありません。</p></div>`;
        const statusColors = { '未着手': '#94a3b8', '対応中': '#f59e0b', '完了': '#10b981', '中止': '#ef4444' };
        return list.map(hw => {
            const isOverdue = hw.deadline && hw.deadline < today && hw.status !== '完了' && hw.status !== '中止';
            return `
            <div class="mp-homework-card ${isOverdue ? 'mp-hw-overdue' : ''}" data-hw-id="${hw.id}">
                <select class="mp-hw-status-select" onchange="window._mpHwUpdateStatus('${hw.id}', this.value)"
                    style="border-color:${statusColors[hw.status] || '#e2e8f0'};color:${statusColors[hw.status] || '#64748b'};">
                    ${['未着手','対応中','完了','中止'].map(s => `<option ${hw.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <div class="mp-hw-content">
                    <div class="mp-hw-title">${escHtml(hw.content || '')}</div>
                    <div class="mp-hw-meta">
                        <span><i class="fas fa-user"></i> ${escHtml(hw.assignee || '—')}</span>
                        <span ${isOverdue ? 'style="color:#ef4444;font-weight:700;"' : ''}><i class="fas fa-calendar"></i> 期限: ${hw.deadline || '—'}${isOverdue ? ' ⚠️超過中' : ''}</span>
                        <span><i class="fas fa-calendar-alt"></i> ${formatYearMonth(hw.year_month)}の会議</span>
                        ${hw.related_product ? `<span><i class="fas fa-utensils"></i> ${escHtml(hw.related_product)}</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // フィルタ・ソートの初期値
    let hwFilter = 'active'; // 'all' | 'active' | '未着手' | '対応中' | '完了' | '中止'
    let hwSearch = '';

    function getFiltered() {
        return allHw.filter(hw => {
            const matchSearch = !hwSearch || hw.content?.includes(hwSearch) || hw.assignee?.includes(hwSearch) || hw.related_product?.includes(hwSearch);
            let matchFilter = true;
            if (hwFilter === 'active') matchFilter = hw.status !== '完了' && hw.status !== '中止';
            else if (hwFilter !== 'all') matchFilter = hw.status === hwFilter;
            return matchSearch && matchFilter;
        });
    }

    function refreshRows() {
        const filtered = getFiltered();
        const overdue  = filtered.filter(h => h.deadline && h.deadline < today && h.status !== '完了' && h.status !== '中止');
        const upcoming = filtered.filter(h => !(h.deadline && h.deadline < today && h.status !== '完了' && h.status !== '中止'));

        const area = document.getElementById('mp-hw-rows-area');
        if (!area) return;
        let html = '';
        if (overdue.length > 0) {
            html += `<div class="mp-hw-section-label mp-hw-section-overdue"><i class="fas fa-exclamation-triangle"></i> 期限超過 ${overdue.length}件</div>`;
            html += renderHwRows(overdue);
        }
        if (upcoming.length > 0) {
            html += `<div class="mp-hw-section-label"><i class="fas fa-list"></i> ${hwFilter === 'active' ? '対応中・未着手' : '該当'} ${upcoming.length}件</div>`;
            html += renderHwRows(upcoming);
        }
        if (overdue.length === 0 && upcoming.length === 0) {
            html = renderHwRows([]);
        }
        area.innerHTML = html;

        // ステータス更新コールバック再登録
        window._mpHwUpdateStatus = async (hwId, status) => {
            await updateDoc(doc(db, 't_chef_homework', hwId), { status, updated_at: serverTimestamp() });
            const hw = allHw.find(h => h.id === hwId);
            if (hw) hw.status = status;
            refreshRows();
        };
    }

    const totalCount   = allHw.length;
    const activeCount  = allHw.filter(h => h.status !== '完了' && h.status !== '中止').length;
    const overdueCount = allHw.filter(h => h.deadline && h.deadline < today && h.status !== '完了' && h.status !== '中止').length;
    const doneCount    = allHw.filter(h => h.status === '完了').length;

    contentArea.innerHTML = `
    <div style="margin-bottom:1rem;">
        <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
            <div class="mp-hw-stat-card" style="background:#fef3c7;">
                <div class="mp-hw-stat-num" style="color:#92400e;">${activeCount}</div>
                <div class="mp-hw-stat-label">対応中・未着手</div>
            </div>
            <div class="mp-hw-stat-card" style="background:#fee2e2;">
                <div class="mp-hw-stat-num" style="color:#991b1b;">${overdueCount}</div>
                <div class="mp-hw-stat-label">期限超過</div>
            </div>
            <div class="mp-hw-stat-card" style="background:#dcfce7;">
                <div class="mp-hw-stat-num" style="color:#166534;">${doneCount}</div>
                <div class="mp-hw-stat-label">完了</div>
            </div>
            <div class="mp-hw-stat-card" style="background:#f1f5f9;">
                <div class="mp-hw-stat-num" style="color:#475569;">${totalCount}</div>
                <div class="mp-hw-stat-label">合計</div>
            </div>
        </div>

        <div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem;">
            <input type="text" id="mp-hw-search" class="mp-search-box" placeholder="担当者・内容・関連商品で検索..." style="flex:1;min-width:200px;"
                oninput="window._mpHwSearch(this.value)">
            ${['active','all','未着手','対応中','完了','中止'].map(f => {
                const labels = { all:'全て', active:'未完了', '未着手':'未着手', '対応中':'対応中', '完了':'完了', '中止':'中止' };
                return `<button class="mp-filter-chip ${hwFilter === f ? 'active' : ''}" data-filter="${f}"
                    onclick="window._mpHwFilter('${f}', this)">${labels[f]}</button>`;
            }).join('')}
        </div>
    </div>

    <div id="mp-hw-rows-area"></div>
    `;

    window._mpHwSearch = (val) => { hwSearch = val; refreshRows(); };
    window._mpHwFilter = (filter, el) => {
        hwFilter = filter;
        document.querySelectorAll('.mp-filter-chip').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        refreshRows();
    };
    window._mpHwUpdateStatus = async (hwId, status) => {
        await updateDoc(doc(db, 't_chef_homework', hwId), { status, updated_at: serverTimestamp() });
        const hw = allHw.find(h => h.id === hwId);
        if (hw) hw.status = status;
        refreshRows();
    };

    refreshRows();
}

// -------------------------------------------------------
// 改善履歴ビュー
// -------------------------------------------------------
let historySubTab = 'improvement'; // 'improvement' | 'discontinued' | 'prototype'

async function renderHistoryView(subTab) {
    historySubTab = subTab || 'improvement';
    const contentArea = document.getElementById('mp-top-tab-content');
    if (!contentArea) return;

    const subTabNav = `
    <div class="mp-history-subtab-nav">
        <button class="mp-history-subtab-btn ${historySubTab === 'improvement' ? 'active' : ''}"
            onclick="window._mpHistorySubTab('improvement')">
            <i class="fas fa-search"></i> 商品改善履歴
        </button>
        <button class="mp-history-subtab-btn ${historySubTab === 'discontinued' ? 'active' : ''}"
            onclick="window._mpHistorySubTab('discontinued')">
            <i class="fas fa-ban"></i> 廃止商品
        </button>
        <button class="mp-history-subtab-btn ${historySubTab === 'prototype' ? 'active' : ''}"
            onclick="window._mpHistorySubTab('prototype')">
            <i class="fas fa-flask"></i> 試作品履歴
        </button>
    </div>
    <div id="mp-history-body">
        <div class="mp-spinner-overlay"><div class="mp-spinner"></div><span>読み込み中...</span></div>
    </div>`;

    contentArea.innerHTML = subTabNav;

    window._mpHistorySubTab = async (tab) => {
        historySubTab = tab;
        document.querySelectorAll('.mp-history-subtab-btn').forEach(btn => {
            btn.classList.toggle('active',
                (tab === 'improvement' && btn.textContent.includes('商品改善')) ||
                (tab === 'discontinued' && btn.textContent.includes('廃止')) ||
                (tab === 'prototype' && btn.textContent.includes('試作品'))
            );
        });
        const body = document.getElementById('mp-history-body');
        if (body) body.innerHTML = `<div class="mp-spinner-overlay"><div class="mp-spinner"></div><span>読み込み中...</span></div>`;
        await renderHistoryBody(tab);
    };

    await renderHistoryBody(historySubTab);
}

async function renderHistoryBody(subTab) {
    const body = document.getElementById('mp-history-body');
    if (!body) return;

    try {
        if (subTab === 'improvement')  await renderImprovementHistory(body);
        else if (subTab === 'discontinued') await renderDiscontinuedHistory(body);
        else if (subTab === 'prototype')    await renderPrototypeHistory(body);
    } catch (e) {
        console.error('[MenuPDCA] 履歴取得エラー:', e);
        body.innerHTML = `<div class="mp-empty-state"><i class="fas fa-exclamation-triangle"></i><p>データの取得に失敗しました。<br>${e.message}</p></div>`;
    }
}

// ---- 商品改善履歴 ----
async function renderImprovementHistory(body) {
    if (!currentStoreId) {
        body.innerHTML = `<div class="mp-empty-state"><i class="fas fa-store"></i><p>店舗を選択してください。</p></div>`;
        return;
    }

    const q = query(
        collection(db, 't_chef_improvement_plans'),
        where('store_id', '==', currentStoreId),
        where('action_policy', '!=', '廃止する')
    );
    const snap = await getDocs(q);
    let plans = [];
    snap.forEach(d => plans.push({ id: d.id, ...d.data() }));

    // JS側で action_policy(asc) -> decided_in_year_month(desc) の順にソート
    plans.sort((a, b) => {
        const p1 = (a.action_policy || '').localeCompare(b.action_policy || '');
        if (p1 !== 0) return p1;
        return (b.decided_in_year_month || '').localeCompare(a.decided_in_year_month || '');
    });

    // 商品名でグルーピング
    const byProduct = {};
    plans.forEach(p => {
        const name = p.product_name || '商品名未設定';
        if (!byProduct[name]) byProduct[name] = [];
        byProduct[name].push(p);
    });

    const productNames = Object.keys(byProduct).sort((a, b) => a.localeCompare(b, 'ja'));

    const statusBadgeHtml = (status) => {
        const map = {
            'observing':     { cls: 'mp-hist-badge-observing', icon: '🔍', label: '観察中' },
            'not_started':   { cls: 'mp-hist-badge-observing', icon: '⏳', label: '実施前' },
            'success':       { cls: 'mp-hist-badge-success',   icon: '✅', label: '成功終了' },
            'failed':        { cls: 'mp-hist-badge-failed',    icon: '❌', label: '不成立終了' },
            're_improving':  { cls: 'mp-hist-badge-retry',     icon: '🔄', label: '再改善' },
            'extended':      { cls: 'mp-hist-badge-observing', icon: '📅', label: '観察延長' },
            'not_applicable':{ cls: 'mp-hist-badge-skip',      icon: '⏭',  label: '対象外' },
        };
        const info = map[status] || { cls: '', icon: '?', label: status || '—' };
        return `<span class="mp-hist-badge ${info.cls}">${info.icon} ${info.label}</span>`;
    };

    if (productNames.length === 0) {
        body.innerHTML = `<div class="mp-empty-state"><i class="fas fa-search"></i><p>改善施策の記録がまだありません。<br>会議のStep3で改善方針を決定すると、ここに記録が蓄積されます。</p></div>`;
        return;
    }

    let searchVal = '';

    function renderCards() {
        const filtered = productNames.filter(n => !searchVal || n.includes(searchVal));
        if (filtered.length === 0) {
            document.getElementById('mp-hist-cards').innerHTML = `<div class="mp-empty-state"><i class="fas fa-search"></i><p>「${escHtml(searchVal)}」に一致する商品が見つかりません。</p></div>`;
            return;
        }
        document.getElementById('mp-hist-cards').innerHTML = filtered.map(name => {
            const planList = byProduct[name];
            const latestStatus = planList[0]?.observation_status || '';
            const rows = planList.map(p => `
                <div class="mp-hist-plan-row">
                    <div class="mp-hist-plan-month">${formatYearMonth(p.decided_in_year_month)}</div>
                    <div class="mp-hist-plan-body">
                        <div class="mp-hist-plan-line">
                            <span class="mp-hist-label">課題</span>
                            <span>${escHtml(p.current_issue || '—')}</span>
                        </div>
                        <div class="mp-hist-plan-line">
                            <span class="mp-hist-label">対応</span>
                            <span>${escHtml(p.action_detail || '—')}</span>
                        </div>
                        <div class="mp-hist-plan-line">
                            <span class="mp-hist-label">狙い</span>
                            <span>${escHtml(p.improvement_goal || '—')}</span>
                        </div>
                        <div class="mp-hist-plan-line">
                            <span class="mp-hist-label">担当</span>
                            <span>${escHtml(p.assignee || '—')}</span>
                        </div>
                        <div style="margin-top:0.4rem;">${statusBadgeHtml(p.observation_status)}</div>
                    </div>
                </div>
            `).join('<div class="mp-hist-plan-divider"></div>');

            return `
            <div class="mp-hist-product-card">
                <div class="mp-hist-product-header">
                    <span class="mp-hist-product-name">${escHtml(name)}</span>
                    <span style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem;color:#64748b;">
                        改善履歴: ${planList.length}件
                        ${statusBadgeHtml(latestStatus)}
                    </span>
                </div>
                <div class="mp-hist-product-body">${rows}</div>
            </div>`;
        }).join('');
    }

    body.innerHTML = `
    <div style="margin-bottom:1rem;">
        <input type="text" class="mp-search-box" placeholder="商品名で検索..." style="width:100%;max-width:400px;"
            oninput="window._mpHistSearch(this.value)">
        <span style="margin-left:0.8rem;font-size:0.82rem;color:#64748b;">${productNames.length}商品の改善記録</span>
    </div>
    <div id="mp-hist-cards"></div>`;

    window._mpHistSearch = (val) => { searchVal = val; renderCards(); };
    renderCards();
}

// ---- 廃止商品履歴 ----
async function renderDiscontinuedHistory(body) {
    if (!currentStoreId) {
        body.innerHTML = `<div class="mp-empty-state"><i class="fas fa-store"></i><p>店舗を選択してください。</p></div>`;
        return;
    }

    const q = query(
        collection(db, 't_chef_improvement_plans'),
        where('store_id', '==', currentStoreId),
        where('action_policy', '==', '廃止する')
    );
    const snap = await getDocs(q);
    let plans = [];
    snap.forEach(d => plans.push({ id: d.id, ...d.data() }));
    // JS側で降順ソート
    plans.sort((a, b) => (b.decided_in_year_month || '').localeCompare(a.decided_in_year_month || ''));

    if (plans.length === 0) {
        body.innerHTML = `<div class="mp-empty-state"><i class="fas fa-ban"></i><p>廃止商品の記録がまだありません。<br>会議のStep3で「廃止する」と決定した商品がここに記録されます。</p></div>`;
        return;
    }

    body.innerHTML = `
    <div style="margin-bottom:0.5rem;font-size:0.82rem;color:#64748b;">${plans.length}件の廃止商品記録</div>
    <div class="mp-analysis-table-wrap">
        <table class="mp-analysis-table">
            <thead>
                <tr>
                    <th>商品名</th>
                    <th>廃止決定</th>
                    <th>廃止理由</th>
                    <th>担当者</th>
                    <th>ABCランク</th>
                    <th>原価率</th>
                    <th>備考</th>
                </tr>
            </thead>
            <tbody>
                ${plans.map(p => `
                <tr>
                    <td><strong>${escHtml(p.product_name || '—')}</strong></td>
                    <td>${formatYearMonth(p.decided_in_year_month)}</td>
                    <td>${escHtml(p.current_issue || '—')}</td>
                    <td>${escHtml(p.assignee || '—')}</td>
                    <td>${p.snapshot_abc_rank ? `<span class="mp-abc-badge rank-${p.snapshot_abc_rank}">${p.snapshot_abc_rank}</span>` : '—'}</td>
                    <td>${p.snapshot_cost_rate != null ? `${p.snapshot_cost_rate}%` : '—'}</td>
                    <td style="font-size:0.82rem;color:#64748b;">${escHtml(p.notes || '—')}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}

// ---- 試作品履歴 ----
async function renderPrototypeHistory(body) {
    if (!currentStoreId) {
        body.innerHTML = `<div class="mp-empty-state"><i class="fas fa-store"></i><p>店舗を選択してください。</p></div>`;
        return;
    }

    // meeting_judgement が設定されているものを取得
    const q = query(
        collection(db, 't_prototype_recipes'),
        where('store_id', '==', currentStoreId)
    );
    const snap = await getDocs(q);
    let protos = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.meeting_judgement) protos.push({ id: d.id, ...data });
    });
    protos.sort((a, b) => (b.meeting_year_month || '').localeCompare(a.meeting_year_month || ''));

    if (protos.length === 0) {
        body.innerHTML = `<div class="mp-empty-state"><i class="fas fa-flask"></i><p>試作品の会議判断記録がまだありません。<br>会議のStep4で試作品の採否を決定するとここに記録されます。</p></div>`;
        return;
    }

    const jMap = {
        adopt:  { label: '採用',       cls: 'mp-proto-hist-adopt',  icon: '✅' },
        retry:  { label: '修正して再試作', cls: 'mp-proto-hist-retry',  icon: '🔄' },
        reject: { label: '不採用',     cls: 'mp-proto-hist-reject', icon: '❌' },
        hold:   { label: '判断保留',   cls: 'mp-proto-hist-hold',   icon: '⏸' },
    };

    const adoptCount  = protos.filter(p => p.meeting_judgement === 'adopt').length;
    const retryCount  = protos.filter(p => p.meeting_judgement === 'retry').length;
    const rejectCount = protos.filter(p => p.meeting_judgement === 'reject').length;
    const holdCount   = protos.filter(p => p.meeting_judgement === 'hold').length;

    body.innerHTML = `
    <div style="display:flex;gap:0.8rem;flex-wrap:wrap;margin-bottom:1rem;">
        <div class="mp-hw-stat-card" style="background:#dcfce7;"><div class="mp-hw-stat-num" style="color:#166534;">${adoptCount}</div><div class="mp-hw-stat-label">採用</div></div>
        <div class="mp-hw-stat-card" style="background:#dbeafe;"><div class="mp-hw-stat-num" style="color:#1e40af;">${retryCount}</div><div class="mp-hw-stat-label">再試作</div></div>
        <div class="mp-hw-stat-card" style="background:#fee2e2;"><div class="mp-hw-stat-num" style="color:#991b1b;">${rejectCount}</div><div class="mp-hw-stat-label">不採用</div></div>
        <div class="mp-hw-stat-card" style="background:#f1f5f9;"><div class="mp-hw-stat-num" style="color:#475569;">${holdCount}</div><div class="mp-hw-stat-label">保留</div></div>
    </div>

    <div style="display:flex; flex-direction:column; gap:1.5rem;">
        ${protos.map(p => {
            const j = jMap[p.meeting_judgement] || { label: p.meeting_judgement, cls: '', icon: '?' };
            const name = p.name || p.item_name || '試作品';
            return `
            <div class="mp-proto-card">
                <div class="mp-proto-card-header">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div class="mp-proto-card-name">${escHtml(name)}</div>
                        <span class="mp-hist-badge ${j.cls}" style="flex-shrink:0;">${j.icon} ${j.label}</span>
                    </div>
                    <div class="mp-proto-card-meta">
                        <span><i class="fas fa-calendar-alt"></i> ${formatYearMonth(p.meeting_year_month || '')}会議</span>
                        ${p.created_by_name ? `<span><i class="fas fa-user"></i> ${escHtml(p.created_by_name)}</span>` : ''}
                    </div>
                </div>
                <div class="mp-proto-card-body">
                    <div class="mp-proto-cost-row">
                        <div class="mp-proto-cost-item"><label>商品原価</label><span>${p.total_cost ? '¥' + Number(p.total_cost).toLocaleString() : '—'}</span></div>
                        <div class="mp-proto-cost-item"><label>想定売価</label><span>${p.selling_price ? '¥' + Number(p.selling_price).toLocaleString() : '—'}</span></div>
                        <div class="mp-proto-cost-item"><label>原価率</label><span>${p.cost_rate ? p.cost_rate.toFixed(1) + '%' : '—'}</span></div>
                    </div>
                    ${p.meeting_judgement === 'adopt' && p.serve_date ? `
                    <div style="font-size:0.82rem;color:#065f46;background:#dcfce7;border-radius:6px;padding:0.5rem 0.7rem;margin-top:0.5rem;">
                        <i class="fas fa-calendar-check"></i> 提供予定: ${p.serve_date}
                        ${p.assignee ? ` ／ 担当: ${escHtml(p.assignee)}` : ''}
                        ${p.concept ? `<br><i class="fas fa-star"></i> ${escHtml(p.concept)}` : ''}
                    </div>` : ''}
                    ${p.comment ? `<p style="font-size:0.82rem;color:#64748b;margin-top:0.5rem;">${escHtml(p.comment)}</p>` : ''}
                </div>
            </div>`;
        }).join('')}
    </div>`;
}

