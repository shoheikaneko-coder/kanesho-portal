import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm, showLoader } from './ui_utils.js';
import { 
    currentSlot, currentShifts, currentTargetUser, allStoreUsers, helpUsers, 
    globalShiftMap, isBulkMode, selectedCells, dailyGoalSales, adminMode, 
    calendarData, injectStyles, loadShiftMemo, saveShiftMemo, loadStoreStaff, 
    loadShiftsBatch, loadDailyGoalData, renderAdminGrid, updateOverallKPIs, 
    publishShifts, shareShiftToLine, formatDateJST, fetchCalendarData, 
    openHelpStaffModal, applyFixedSchedules, calculateSlot, getRollingSlots,
    setShiftState
} from './shift.js';

export const shiftAdminMobilePageHtml = `
    <div class="animate-fade-in" id="shift-admin-container" style="max-width: 100%; margin: 0 auto; padding-bottom: 80px;">
        
        <!-- モバイル専用：ヘッダー・店舗表示 -->
        <div class="mobile-only" style="padding: 1rem; background: white; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100;">
            <div id="admin-active-store-mobile" style="font-weight: 800; color: var(--primary); font-size: 0.9rem;">📍 店舗読み込み中...</div>
            <button id="btn-edit-memo-mobile" class="btn btn-secondary btn-sm" style="padding: 0.4rem 0.8rem;"><i class="fas fa-edit"></i> メモ</button>
        </div>

        <!-- PC/タブレット向けの既存KPIストリップ (モバイルでは非表示にするか調整) -->
        <div class="desktop-only">
             <!-- ここにPC版のKPIストリップがありましたが、独立版なので空にします -->
        </div>

        <div class="glass-panel" style="margin-top: 0.5rem; padding: 0;">
            <div id="hourly-graph-panel" style="display:none; padding:15px; background:#fff; border-bottom:2px solid var(--primary);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h4 id="graph-date-label" style="margin:0; color:var(--primary); font-weight:800;">04/01 人時グラフ</h4>
                    <div style="display:flex; gap:0.5rem;">
                        <button id="btn-copy-for-line" class="btn btn-secondary btn-sm" style="background:#06c755; color:white; border:none;"><i class="fab fa-line"></i> LINEコピー</button>
                        <button onclick="document.getElementById('hourly-graph-panel').style.display='none'" class="btn btn-secondary btn-sm">閉じる</button>
                    </div>
                </div>
                <div id="hourly-bars-container" style="display:flex; align-items:flex-end; gap:4px; height:120px; padding-bottom:10px; border-bottom:1px solid var(--border);"></div>
                <div style="display:flex; gap:4px; margin-top:5px;">
                    ${Array.from({length:24}).map((_,i) => `<div style="flex:1; text-align:center; font-size:0.6rem; color:var(--text-secondary);">${i}</div>`).join('')}
                </div>
            </div>
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <table id="shift-admin-table" style="width: 100%; border-collapse: collapse; min-width: 600px;">
                    <thead><tr id="admin-table-header"><th class="staff-cell">スタッフ</th></tr></thead>
                    <tbody id="admin-table-body"></tbody>
                    <tfoot id="admin-table-foot"></tfoot>
                </table>
            </div>
        </div>

        <!-- 【スマホ専用】管理者用アクション・コックピット -->
        <div id="admin-mobile-fab-hub" class="fab-container">
            <div id="admin-fab-overlay" class="admin-fab-overlay"></div>
            <div id="admin-fab-menu" class="fab-menu">
                <div class="fab-item" id="btn-publish-mobile">
                    <span class="fab-label">一括確定・公開</span>
                    <div class="fab-icon" style="color:var(--primary);"><i class="fas fa-paper-plane"></i></div>
                </div>
                <div class="fab-item" id="btn-share-line-mobile">
                    <span class="fab-label">LINE周知</span>
                    <div class="fab-icon" style="color:#06C755;"><i class="fab fa-line"></i></div>
                </div>
                <div class="fab-item" id="btn-add-help-mobile">
                    <span class="fab-label">ヘルプスタッフ追加</span>
                    <div class="fab-icon"><i class="fas fa-user-plus"></i></div>
                </div>
                <div class="fab-item" id="btn-apply-fixed-mobile">
                    <span class="fab-label">いつものパターン反映</span>
                    <div class="fab-icon"><i class="fas fa-magic"></i></div>
                </div>
                <div class="fab-item" id="btn-manage-fixed-mobile">
                    <span class="fab-label">固定シフト設定</span>
                    <div class="fab-icon"><i class="fas fa-user-clock"></i></div>
                </div>
                <div class="fab-item" id="btn-bulk-mode-mobile">
                    <span class="fab-label">一括入力モード</span>
                    <div class="fab-icon"><i class="fas fa-check-double"></i></div>
                </div>
            </div>
            <div class="fab-main" id="admin-fab-main-btn" onclick="window.toggleAdminFabHub()">
                <i class="fas fa-plus"></i>
            </div>
        </div>

        <!-- 【スマホ専用】クイック・ボトムシート・エディター -->
        <div id="admin-mobile-bottom-sheet" class="bottom-sheet">
            <div class="sheet-handle"></div>
            <div class="sheet-content">
                <div class="sheet-header">
                    <div id="sheet-staff-name" class="staff-name">スタッフ名</div>
                    <div id="sheet-date-label" class="date-label">04/01 (月)</div>
                </div>
                <div class="time-adjust-section">
                    <div class="time-input-row">
                        <div class="time-group">
                            <label>開始</label>
                            <div class="select-pair">
                                <select id="sheet-start-h" class="time-select"></select>
                                <span>:</span>
                                <select id="sheet-start-m" class="time-select"></select>
                            </div>
                        </div>
                        <div class="time-arrow"><i class="fas fa-arrow-right"></i></div>
                        <div class="time-group">
                            <label>終了</label>
                            <div class="select-pair">
                                <select id="sheet-end-h" class="time-select"></select>
                                <span>:</span>
                                <select id="sheet-end-m" class="time-select"></select>
                            </div>
                        </div>
                    </div>
                    <div class="extra-input-row">
                        <div class="input-item">
                            <label>休憩 (分)</label>
                            <input type="number" id="sheet-break" class="sheet-input" value="0">
                        </div>
                        <div class="input-item" style="flex:2;">
                            <label>メモ</label>
                            <input type="text" id="sheet-note" class="sheet-input" placeholder="特記事項...">
                        </div>
                    </div>
                </div>
                <div class="sheet-actions">
                    <button class="btn btn-cancel-sheet" onclick="window.closeAdminBottomSheet()">キャンセル</button>
                    <button id="btn-save-sheet" class="btn btn-save-sheet">保存する</button>
                </div>
            </div>
        </div>
    </div>
`;

export async function initShiftAdminMobilePage() {
    console.log("Initializing Shift Admin Mobile Independent View...");
    injectStyles();
    setShiftState('adminMode', true);
    
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    // スロットの計算
    if (!window.__shiftNavTarget) {
        calculateSlot();
    } else {
        const target = window.__shiftNavTarget;
        currentSlot.year = target.year;
        currentSlot.month = target.month;
        currentSlot.slot = target.slot;
        const lastDayOfMonth = new Date(target.year, target.month, 0).getDate();
        currentSlot.startDate = new Date(target.year, target.month - 1, target.slot === 1 ? 1 : 16);
        currentSlot.endDate = new Date(target.year, target.month - 1, target.slot === 1 ? 15 : lastDayOfMonth);
        if (target.storeId) window.currentAdminStoreId = target.storeId;
        window.__shiftNavTarget = null;
    }

    // ページタイトルの期間選択
    const pageTitleMobile = document.getElementById('page-title-mobile-central');
    if (pageTitleMobile) {
        const slots = getRollingSlots();
        let optionsHtml = '';
        slots.forEach(s => {
            const isSelected = (s.year === currentSlot.year && s.month === currentSlot.month && s.slot === currentSlot.slot);
            optionsHtml += `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${s.year}/${s.label}</option>`;
        });
        
        pageTitleMobile.innerHTML = `
            <select id="admin-slot-select-mobile" style="font-size: 0.9rem; padding: 0.2rem 0.5rem; border-radius: 6px; border: 1px solid var(--border); font-weight: 800; background: white; color: var(--primary);">
                ${optionsHtml}
            </select>
        `;

        const slotSelect = document.getElementById('admin-slot-select-mobile');
        if (slotSelect) {
            slotSelect.onchange = async (e) => {
                const [y, m, s] = e.target.value.split('-').map(Number);
                currentSlot.year = y;
                currentSlot.month = m;
                currentSlot.slot = s;
                const lastDayOfMonth = new Date(y, m, 0).getDate();
                currentSlot.startDate = new Date(y, m - 1, s === 1 ? 1 : 16);
                currentSlot.endDate = new Date(y, m - 1, s === 1 ? 15 : lastDayOfMonth);
                
                const loader = showLoader();
                try {
                    await updateView(window.currentAdminStoreId);
                } finally {
                    if (loader) loader.remove();
                }
            };
        }
    }

    async function updateView(sid) {
        if (!sid) return;
        const sSnap = await getDoc(doc(db, "m_stores", sid));
        const storeData = sSnap.exists() ? sSnap.data() : null;
        const storeName = storeData ? storeData.store_name : sid;
        
        window.currentAdminStoreId = sid;
        window.currentAdminStoreName = storeName;
        
        const mobileStoreLabel = document.getElementById('admin-active-store-mobile');
        if (mobileStoreLabel) mobileStoreLabel.textContent = `📍 ${storeName}`;
        
        await loadDailyGoalData(sid);
        await loadStoreStaff(sid, storeName);
        await Promise.all([
            loadShiftsBatch(sid),
            loadShiftMemo(sid)
        ]);
        
        await renderAdminGrid(); 
        updateOverallKPIs();
    }

    const sid = user.StoreID || user.StoreId || 'UNKNOWN';
    await fetchCalendarData(sid);
    await updateView(sid);

    // モバイル専用ボタンのバインド
    const btnPublishMobile = document.getElementById('btn-publish-mobile');
    if (btnPublishMobile) btnPublishMobile.onclick = () => { window.toggleAdminFabHub(false); publishShifts(); };

    const btnShareLineMobile = document.getElementById('btn-share-line-mobile');
    if (btnShareLineMobile) {
        btnShareLineMobile.onclick = () => {
            window.toggleAdminFabHub(false);
            shareShiftToLine(window.currentAdminStoreId, window.currentAdminStoreName);
        };
    }

    const btnAddHelpMobile = document.getElementById('btn-add-help-mobile');
    if (btnAddHelpMobile) btnAddHelpMobile.onclick = () => { window.toggleAdminFabHub(false); openHelpStaffModal(); };

    const btnApplyFixedMobile = document.getElementById('btn-apply-fixed-mobile');
    if (btnApplyFixedMobile) {
        btnApplyFixedMobile.onclick = () => {
            window.toggleAdminFabHub(false);
            showConfirm('定例反映', '定例シフトを反映しますか？', async () => {
                await applyFixedSchedules();
            });
        };
    }

    const btnManageFixedMobile = document.getElementById('btn-manage-fixed-mobile');
    if (btnManageFixedMobile) {
        btnManageFixedMobile.onclick = () => {
            window.toggleAdminFabHub(false);
            if(window.renderFixedShiftStaffList) window.renderFixedShiftStaffList();
            if(window.openSideDrawer) window.openSideDrawer();
        };
    }

    const btnEditMemoMobile = document.getElementById('btn-edit-memo-mobile');
    if (btnEditMemoMobile) {
        btnEditMemoMobile.onclick = () => {
            const memoEl = document.getElementById('admin-shift-memo');
            const currentMemo = memoEl ? memoEl.value : "";
            const newMemo = prompt("店長メモを編集", currentMemo);
            if (newMemo !== null) {
                if (memoEl) {
                    memoEl.value = newMemo;
                    saveShiftMemo();
                }
            }
        };
    }
}
