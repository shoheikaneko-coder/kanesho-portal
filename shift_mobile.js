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
    setShiftState, showRejectedShifts, dailyMemos, getExtendedRange,
    applyShiftUpdate, checkDoubleBooking, saveDailyMemo
} from './shift.js';

export const shiftAdminMobilePageHtml = `
    <div class="animate-fade-in" id="shift-admin-container-mobile" style="max-width: 100%; margin: 0 auto; padding-bottom: 80px;">
        
        <!-- モバイル専用：ヘッダー・店舗表示 -->
        <div class="mobile-only" style="padding: 1rem; background: white; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100;">
            <div id="admin-active-store-mobile" style="font-weight: 800; color: var(--primary); font-size: 0.9rem;">📍 店舗読み込み中...</div>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
                <button id="btn-toggle-rejected-mobile" class="btn btn-secondary btn-sm" style="padding: 0.4rem 0.6rem; background: transparent; color: var(--text-secondary); border: 1px solid var(--border);"><i class="fas fa-eye-slash"></i></button>
                <button id="btn-edit-memo-mobile" class="btn btn-secondary btn-sm" style="padding: 0.4rem 0.8rem;"><i class="fas fa-edit"></i> メモ</button>
            </div>
        </div>

        <!-- PC/タブレット向けの既存KPIストリップ (モバイルでは非表示にするか調整) -->
        <div class="desktop-only">
             <!-- ここにPC版のKPIストリップがありましたが、独立版なので空にします -->
        </div>

        <div class="glass-panel" style="margin-top: 0.5rem; padding: 0;">
            <div id="hourly-graph-panel-mobile" style="display:none; padding:15px; background:#fff; border-bottom:2px solid var(--primary);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h4 id="graph-date-label-mobile" style="margin:0; color:var(--primary); font-weight:800;">04/01 人時グラフ</h4>
                    <div style="display:flex; gap:0.5rem;">
                        <button id="btn-copy-for-line-mobile" class="btn btn-secondary btn-sm" style="background:#06c755; color:white; border:none;"><i class="fab fa-line"></i> LINEコピー</button>
                        <button onclick="document.getElementById('hourly-graph-panel-mobile').style.display='none'" class="btn btn-secondary btn-sm">閉じる</button>
                    </div>
                </div>
                <div id="hourly-bars-container-mobile" style="display:flex; align-items:flex-end; gap:4px; height:120px; padding-bottom:10px; border-bottom:1px solid var(--border);"></div>
                <div style="display:flex; gap:4px; margin-top:5px;">
                    ${Array.from({length:24}).map((_,i) => `<div style="flex:1; text-align:center; font-size:0.6rem; color:var(--text-secondary);">${i}</div>`).join('')}
                </div>
            </div>
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <table id="shift-admin-table-mobile" style="width: 100%; border-collapse: collapse; min-width: 600px;">
                    <thead><tr id="admin-table-header-mobile"><th class="staff-cell">スタッフ</th></tr></thead>
                    <tbody id="admin-table-body-mobile"></tbody>
                    <tfoot id="admin-table-foot-mobile"></tfoot>
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
        <div id="admin-mobile-bottom-sheet-mobile" class="bottom-sheet">
            <div class="sheet-handle"></div>
            <div class="sheet-content">
                <div class="sheet-header">
                    <div id="sheet-staff-name-mobile" class="staff-name">スタッフ名</div>
                    <div id="sheet-date-label-mobile" class="date-label">04/01 (月)</div>
                </div>
                <div class="time-adjust-section">
                    <div class="time-input-row">
                        <div class="time-group">
                            <label>開始</label>
                            <div class="select-pair">
                                <select id="sheet-start-h-mobile" class="time-select"></select>
                                <span>:</span>
                                <select id="sheet-start-m-mobile" class="time-select"></select>
                            </div>
                        </div>
                        <div class="time-arrow"><i class="fas fa-arrow-right"></i></div>
                        <div class="time-group">
                            <label>終了</label>
                            <div class="select-pair">
                                <select id="sheet-end-h-mobile" class="time-select"></select>
                                <span>:</span>
                                <select id="sheet-end-m-mobile" class="time-select"></select>
                            </div>
                        </div>
                    </div>
                    <div class="extra-input-row">
                        <div class="input-item">
                            <label>休憩 (分)</label>
                            <input type="number" id="sheet-break-mobile" class="sheet-input" value="0">
                        </div>
                        <div class="input-item" style="flex:2;">
                            <label>メモ</label>
                            <input type="text" id="sheet-note-mobile" class="sheet-input" placeholder="特記事項...">
                        </div>
                    </div>
                </div>
                <div class="sheet-actions" style="display: flex; justify-content: space-between; gap: 0.5rem; width: 100%;">
                    <button id="btn-delete-sheet-mobile" class="btn btn-secondary" style="background: var(--danger); color: white; border: none; padding: 0.75rem 0.8rem; font-size: 0.85rem;"><i class="fas fa-trash-alt"></i> 不採用</button>
                    <div style="display: flex; gap: 0.4rem;">
                        <button class="btn btn-cancel-sheet" onclick="window.closeAdminBottomSheetMobile()" style="font-size: 0.85rem; padding: 0.75rem 0.8rem;">キャンセル</button>
                        <button id="btn-save-sheet-mobile" class="btn btn-save-sheet" style="font-size: 0.85rem; padding: 0.75rem 0.8rem;">保存する</button>
                    </div>
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
        
        await renderAdminGridMobile(); 
        updateOverallKPIsMobile();
    }

    const sid = user.StoreID || user.StoreId || 'UNKNOWN';
    await fetchCalendarData(sid);
    await updateView(sid);

    // モバイル専用ボタンのバインド
    const btnToggleRejectedMobile = document.getElementById('btn-toggle-rejected-mobile');
    if (btnToggleRejectedMobile) {
        btnToggleRejectedMobile.onclick = () => {
            const nextState = !showRejectedShifts;
            setShiftState('showRejectedShifts', nextState);
            
            if (nextState) {
                btnToggleRejectedMobile.innerHTML = '<i class="fas fa-eye"></i>';
                btnToggleRejectedMobile.style.color = 'var(--primary)';
                btnToggleRejectedMobile.style.borderColor = 'var(--primary)';
                btnToggleRejectedMobile.style.background = 'rgba(230, 57, 70, 0.08)';
            } else {
                btnToggleRejectedMobile.innerHTML = '<i class="fas fa-eye-slash"></i>';
                btnToggleRejectedMobile.style.color = 'var(--text-secondary)';
                btnToggleRejectedMobile.style.borderColor = 'var(--border)';
                btnToggleRejectedMobile.style.background = 'transparent';
            }
            renderAdminGridMobile(); // スマホ用グリッドの再描画
        };
    }

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
            const currentMemo = window.currentMobileMemo || "";
            const newMemo = prompt("店長メモを編集", currentMemo);
            if (newMemo !== null) {
                window.currentMobileMemo = newMemo;
                saveShiftMemo();
            }
        };
    }

    // 一括入力モードボタンのモバイル固有バインド
    const btnBulkModeMobile = document.getElementById('btn-bulk-mode-mobile');
    if (btnBulkModeMobile) {
        btnBulkModeMobile.onclick = () => {
            window.toggleAdminFabHub(false);
            if (!isBulkMode) {
                setShiftState('isBulkMode', true);
                setShiftState('selectedCells', []);
                const labelSpan = btnBulkModeMobile.querySelector('.fab-label');
                if (labelSpan) labelSpan.textContent = "選択完了 (0件)";
                
                const cont = document.getElementById('shift-admin-container-mobile');
                if (cont) cont.classList.add('bulk-mode-active');
            } else {
                if (selectedCells.length > 0) {
                    openBulkInputMobile();
                } else {
                    exitBulkModeMobile();
                }
            }
        };
    }

    // グローバルオーバーライド関数の登録
    window.renderAdminGridMobile = renderAdminGridMobile;
    window.renderCellUIMobile = renderCellUIMobile;
    window.updateOverallKPIsMobile = updateOverallKPIsMobile;
    window.showHelperTooltipMobile = showHelperTooltipMobile;
    window.showHourlyGraphMobile = showHourlyGraphMobile;
    window.copyShiftForLineMobile = copyShiftForLineMobile;
    window.openTimeInputMobile = openTimeInputMobile;
    window.updateMobileLiveHeaderMobile = updateMobileLiveHeaderMobile;
    window.openDailyMemoModalMobile = openDailyMemoModalMobile;
    window.closeAdminBottomSheetMobile = closeAdminBottomSheetMobile;
}

// ==========================================
// モバイル専用プレゼンテーション関数群
// ==========================================

export function renderAdminGridMobile() {
    const body = document.getElementById('admin-table-body-mobile');
    const header = document.getElementById('admin-table-header-mobile');
    if (!header || !body) return;

    try {
        const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
        header.innerHTML = '<th class="staff-cell">スタッフ</th>';
        for (let i = 0; i < span; i++) {
            const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
            const ymd = formatDateJST(d);
            const cal = calendarData[ymd] || {};
            const isHoliday = cal.is_holiday;
            const isOff = cal.type === 'off';
            
            header.innerHTML += `
                <th class="date-hdr ${isHoliday ? 'is-holiday' : ''} ${isOff ? 'is-off-column' : ''}" 
                    onclick="window.showHelperTooltipMobile(event, '${ymd}')">
                    <div class="date-num">${d.getDate()}</div>
                    <div class="weekday">${['日','月','火','水','木','金','土'][d.getDay()]}</div>
                    ${isHoliday ? `<div class="holiday-name-hdr">${cal.label || '祝日'}</div>` : ''}
                    ${isOff ? `<div class="holiday-name-hdr">店休</div>` : ''}
                    ${cal.is_market_off ? `<div class="market-badge-hdr">市</div>` : ''}
                </th>`;
        }

        // 横スクロール同期
        const scrollArea = document.getElementById('shift-admin-table-mobile')?.parentElement;
        if (scrollArea) {
            scrollArea.onscroll = () => {
                const scrollLeft = scrollArea.scrollLeft;
                const colWidth = 60;
                const dayIdx = Math.max(0, Math.floor((scrollLeft - 40) / colWidth));
                const targetD = new Date(currentSlot.startDate);
                targetD.setDate(targetD.getDate() + dayIdx);
                const ymd = formatDateJST(targetD);
                window.updateMobileLiveHeaderMobile(ymd);
            };
        }

        body.innerHTML = '';

        // 日次メモ行
        const memoTr = document.createElement('tr');
        memoTr.className = 'daily-memo-row';
        memoTr.innerHTML = `
            <td class="staff-cell" style="background: #f1f5f9; color: var(--text-primary); vertical-align: middle;">
                <div style="display:flex; align-items:center; gap:0.4rem; justify-content:flex-start; line-height:1.2;">
                    <i class="fas fa-sticky-note" style="color: #10b981;"></i>
                    <span style="font-weight:800; font-size:0.8rem;">日次メモ</span>
                </div>
            </td>
        `;
        for (let i = 0; i < span; i++) {
            const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
            const ymd = formatDateJST(d);
            const memoData = dailyMemos[ymd] || {};
            const memoText = memoData.memo || '';
            const cal = calendarData[ymd] || {};
            const isOff = cal.type === 'off';
            
            const cellContent = memoText 
                ? `<span class="daily-memo-preview has-memo">📝 ${memoText}</span>` 
                : `<span class="daily-memo-preview empty">＋入力</span>`;
                
            memoTr.innerHTML += `
                <td class="daily-memo-cell ${isOff ? 'is-off-column' : ''}" 
                    id="memo-cell-mobile-${ymd}" 
                    onclick="window.openDailyMemoModalMobile('${ymd}')">
                    ${cellContent}
                </td>`;
        }
        body.appendChild(memoTr);

        const roleOrder = { 'Manager': 0, '管理者': 1, 'Admin': 1, '一般社員': 2, 'Staff': 2, 'アルバイト': 3, 'PartTimer': 3 };
        const list = [...allStoreUsers, ...helpUsers].sort((a, b) => {
            const orderA = roleOrder[a.Role] ?? 99;
            const orderB = roleOrder[b.Role] ?? 99;
            if (orderA !== orderB) return orderA - orderB;
            return (a.EmployeeCode || "").localeCompare(b.EmployeeCode || "");
        });

        if (list.length === 0) {
            body.innerHTML = `<tr><td colspan="${span + 1}" style="padding: 3rem; text-align: center; color: var(--text-secondary);"><i class="fas fa-info-circle"></i> スタッフ未登録、または読み込み中です</td></tr>`;
            return;
        }

        const roleMap = { 'Manager': '店長', 'Admin': '管理者', 'Staff': '一般社員', 'PartTimer': 'アルバイト' };

        list.forEach(u => {
            const tr = document.createElement('tr');
            const roleName = roleMap[u.Role] || u.Role || '';
            let displayRole = u.JobTitle || roleName;

            tr.innerHTML = `<td class="staff-cell">
                <div style="display:flex; flex-direction:column; justify-content:center; text-align:left; line-height:1.2;">
                    <div style="display:flex; align-items:center; gap:0.3rem;">
                        <span style="font-weight:700; color: ${u.isHelp ? '#7c3aed' : 'inherit'};">${u.DisplayName || u.Name}</span>
                    </div>
                    ${displayRole ? `<div style="font-size:0.6rem; color:var(--text-secondary); font-weight:500; margin-top:0.1rem;">${displayRole}</div>` : ''}
                </div>
            </td>`;
            for (let i = 0; i < span; i++) {
                const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
                const ymd = formatDateJST(d);
                const cal = calendarData[ymd] || {};
                const isOff = cal.type === 'off';
                tr.innerHTML += `<td class="shift-cell ${isOff ? 'is-off-column' : ''}" id="cell-mobile-${u.id}-${ymd}" onclick="window.openTimeInputMobile('${ymd}', '${u.id}')"></td>`;
            }
            body.appendChild(tr);
            for(let i=0; i<span; i++){
                const d = new Date(currentSlot.startDate); d.setDate(d.getDate()+i);
                const ymd = formatDateJST(d);
                if(currentShifts[u.id]?.[ymd]) renderCellUIMobile(u.id, ymd, currentShifts[u.id][ymd]);
            }
        });
    } catch (e) { console.error("Error in renderAdminGridMobile:", e); }
}

export function renderCellUIMobile(uid, date, data) {
    const cell = document.getElementById(`cell-mobile-${uid}-${date}`);
    
    const isConfirmed = data?.status === 'confirmed';
    const isRejected = data?.status === 'rejected';
    const stampHtml = isConfirmed ? `<div class="official-stamp"><i class="fas fa-check-circle"></i></div>` : '';
    
    if (cell) {
        if (!data || (!data.start && !isRejected)) {
            cell.innerHTML = '';
        } else if (isRejected) {
            if (adminMode && showRejectedShifts) {
                cell.innerHTML = `
                    <div class="shift-box rejected-hope">
                        <div style="font-size: 0.55rem; font-weight: bold; opacity: 0.8; margin-bottom: 2px;"><i class="fas fa-eye-slash"></i> 削り希望</div>
                        <div style="font-size: 0.7rem;">${data.hopeStart || '17:00'} - ${data.hopeEnd || '22:00'}</div>
                        ${data.note ? `<div style="font-size: 0.55rem; opacity: 0.7; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${data.note}</div>` : ''}
                    </div>
                `;
            } else {
                cell.innerHTML = '';
            }
        } else {
            cell.innerHTML = `
                <div class="shift-box ${isConfirmed ? '' : 'applied'}">
                    ${stampHtml}
                    <div style="font-size: 0.75rem;">${data.start} - ${data.end}</div>
                    ${data.note ? `<div style="font-size: 0.55rem; opacity: 0.7; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${data.note}</div>` : ''}
                </div>
            `;
        }
    }
}

export function updateOverallKPIsMobile() {
    let hours = 0, target = 0;
    const users = [...allStoreUsers, ...helpUsers];

    for (const ymd in dailyGoalSales) {
        target += dailyGoalSales[ymd];
        users.forEach(u => {
            const s = currentShifts[u.id]?.[ymd];
            if (s && s.start && s.end && s.status !== 'rejected') {
                const sA = s.start.split(':').map(Number); const eA = s.end.split(':').map(Number);
                let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60); if (h < 0) h += 24;
                const net = Math.max(0, h - (s.breakMin || 0)/60);
                hours += net;
            }
        });
    }
    const avgSphText = `¥ ${Math.round(hours > 0 ? target/hours : 0).toLocaleString()}`;
    const sphElMobile = document.getElementById('live-header-sph');
    if (sphElMobile) sphElMobile.textContent = avgSphText;
    
    const today = formatDateJST(new Date());
    if (typeof window.updateMobileLiveHeaderMobile === 'function') {
        window.updateMobileLiveHeaderMobile(today);
    }
    
    // 28時間制限計算 (週次・店舗横断対応)
    const range = getExtendedRange(currentSlot.startDate, currentSlot.endDate);
    const alertsContMobile = document.getElementById('admin-28h-alerts-mobile');
    const violations = [];

    users.forEach(u => {
        const isTarget = u.Has28hLimit === true || u.Has28hLimit === 'true' || u.Has28hLimit === 'on' || u.has28hLimit === true;
        if (!isTarget) return;

        let tempDate = new Date(range.start);
        const limitEnd = new Date(range.end);
        
        while (tempDate <= limitEnd) {
            let weekHours = 0;
            const weekStart = new Date(tempDate);
            
            for (let j = 0; j < 7; j++) {
                const checkD = new Date(weekStart);
                checkD.setUTCDate(checkD.getUTCDate() + j);
                const iso = checkD.toISOString().split("T")[0];
                
                const dayShifts = globalShiftMap[u.id]?.[iso] || [];
                dayShifts.forEach(s => {
                    if (s && s.start && s.end && s.status !== 'rejected') {
                        const sA = s.start.split(':').map(Number); 
                        const eA = s.end.split(':').map(Number);
                        let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60); if (h < 0) h += 24;
                        weekHours += Math.max(0, h - (Number(s.breakMin || 0))/60);
                    }
                });
            }
            
            if (weekHours > 28) {
                const weekLabel = `${weekStart.getUTCMonth()+1}/${weekStart.getUTCDate()}週`;
                violations.push(`${u.DisplayName || u.Name} (${weekLabel}: ${weekHours.toFixed(1)}h)`);
                break;
            }
            tempDate.setUTCDate(tempDate.getUTCDate() + 7);
        }
    });

    if (alertsContMobile) {
        if (violations.length > 0) {
            alertsContMobile.textContent = `超過: ${violations.length}名`;
            alertsContMobile.style.display = 'block';
        } else {
            alertsContMobile.style.display = 'none';
        }
    }

    renderAdminFooterMobile();
}

export function renderAdminFooterMobile() {
    const foot = document.getElementById('admin-table-foot-mobile');
    if (!foot) return;
    foot.innerHTML = '';

    const trSPH = document.createElement('tr');
    trSPH.className = 'foot-kpi-row';
    trSPH.innerHTML = '<td class="staff-cell" style="background:#f1f5f9;">人時売上</td>';
    
    const trGoal = document.createElement('tr');
    trGoal.className = 'foot-kpi-row';
    trGoal.innerHTML = '<td class="staff-cell" style="background:#f8fafc; color:var(--text-secondary); font-size:0.7rem;">売上目標</td>';

    const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
    for (let i = 0; i < span; i++) {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = formatDateJST(d);
        let dayH = 0;
        [...allStoreUsers, ...helpUsers].forEach(u => {
            const s = currentShifts[u.id]?.[ymd];
            if (s && s.start && s.status !== 'rejected') {
                const sA = s.start.split(':').map(Number); const eA = s.end.split(':').map(Number);
                let h = (eA[0]+eA[1]/60) - (sA[0]+sA[1]/60); if(h<0) h+=24;
                dayH += Math.max(0, h - (s.breakMin||0)/60);
            }
        });
        
        const sph = dayH > 0 ? (dailyGoalSales[ymd] / dayH) : 0;
        let bg = '#10b981'; if(sph < 4000) bg = '#ef4444'; else if(sph < 5000) bg = '#f59e0b';
        trSPH.innerHTML += `<td style="background:#f1f5f9;"><span class="badge-kpi" style="background:${bg};">¥${Math.round(sph).toLocaleString()}</span></td>`;

        const goalVal = dailyGoalSales[ymd] || 0;
        trGoal.innerHTML += `<td style="background:#f8fafc; font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">¥${Math.round(goalVal).toLocaleString()}</td>`;
    }
    foot.appendChild(trSPH);
    foot.appendChild(trGoal);
}

export function showHelperTooltipMobile(e, ymd) {
    e.stopPropagation();
    
    window.hideHelperTooltipMobile();

    const candidates = [];
    const users = [...allStoreUsers, ...helpUsers];
    
    users.forEach(u => {
        const s = currentShifts[u.id]?.[ymd];
        if (s && s.status === 'rejected') {
            candidates.push({
                name: u.DisplayName || u.Name,
                start: s.hopeStart || '17:00',
                end: s.hopeEnd || '22:00'
            });
        }
    });

    const tooltip = document.createElement('div');
    tooltip.id = 'daily-helper-tooltip-mobile';
    tooltip.className = 'daily-helper-tooltip';

    const d = new Date(ymd);
    const dow = ['日','月','火','水','木','金','土'][d.getDay()];

    const memoData = dailyMemos[ymd] || {};
    let memoHtml = '';
    if (memoData.memo) {
        memoHtml = `
            <div style="background: #f0fdf4; border-left: 3px solid #10b981; padding: 6px 10px; margin-bottom: 8px; font-size: 0.78rem; text-align: left; border-radius: 4px; color: #1e293b; font-weight: 600; line-height: 1.4; white-space: pre-wrap;">
                <div style="color: #059669; font-weight: 800; font-size: 0.7rem; margin-bottom: 2px;"><i class="fas fa-sticky-note"></i> 日次メモ:</div>
                ${memoData.memo}
            </div>
        `;
    }
    
    let listHtml = '';
    if (candidates.length > 0) {
        listHtml = `<ul class="daily-helper-tooltip-list">`;
        candidates.forEach(c => {
            listHtml += `
                <li class="daily-helper-tooltip-item">
                    <span class="daily-helper-name">👤 ${c.name}</span>
                    <span class="daily-helper-time">${c.start}〜${c.end}</span>
                </li>
            `;
        });
        listHtml += `</ul>`;
    } else {
        listHtml = `<div class="daily-helper-tooltip-empty">不採用の希望はありません</div>`;
    }

    tooltip.innerHTML = `
        <div class="daily-helper-tooltip-title">
            <i class="fas fa-user-check"></i> ${d.getMonth() + 1}/${d.getDate()} (${dow}) の状況・代打候補
        </div>
        ${memoHtml}
        ${listHtml}
        <div style="margin-top: 8px; text-align: center; border-top: 1px solid var(--border); padding-top: 6px; pointer-events: auto;">
            <button class="btn btn-secondary btn-sm" style="font-size: 0.65rem; padding: 2px 8px; width: 100%;" onclick="window.showHelperTooltipGraphMobile(event, '${ymd}')">
                <i class="fas fa-chart-bar"></i> 人数グラフを表示
            </button>
        </div>
    `;

    document.body.appendChild(tooltip);

    const rect = e.currentTarget.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 6;
    let left = rect.left + window.scrollX + (rect.width - tooltip.offsetWidth) / 2;
    
    if (left < 10) left = 10;
    if (left + tooltip.offsetWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltip.offsetWidth - 10;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    setTimeout(() => tooltip.classList.add('show'), 10);

    const closeHandler = () => {
        window.hideHelperTooltipMobile();
        document.removeEventListener('click', closeHandler);
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 100);
}

export function showHourlyGraphMobile(date) {
    const panel = document.getElementById('hourly-graph-panel-mobile');
    const container = document.getElementById('hourly-bars-container-mobile');
    const title = document.getElementById('graph-date-label-mobile');
    if (!panel || !container || !title) return;

    panel.style.display = 'block';
    title.textContent = `${date} 人数グラフ`;
    
    const counts = new Array(24).fill(0);
    const users = [...allStoreUsers, ...helpUsers];
    users.forEach(u => {
        const s = currentShifts[u.id]?.[date];
        if (s && s.start && s.status !== 'rejected') {
            let start = parseInt(s.start.replace(':','')), end = parseInt(s.end.replace(':',''));
            if(end < start) end += 2400;
            for(let h=0; h<24; h++){
                const t = h * 100;
                if(t >= start && t < end) counts[h]++;
            }
        }
    });
    
    const max = Math.max(...counts, 1);
    container.innerHTML = counts.map((c, i) => `<div style="flex:1; height:${(c/max)*100}%; background:#3b82f6; border-radius:3px 3px 0 0; position:relative;">${c>0?`<span style="position:absolute; top:-15px; width:100%; text-align:center; font-size:0.6rem;">${c}</span>`:''}</div>`).join('');

    const copyBtn = document.getElementById('btn-copy-for-line-mobile');
    if (copyBtn) {
        copyBtn.onclick = () => window.copyShiftForLineMobile(date);
    }
}

export async function copyShiftForLineMobile(date) {
    try {
        const d = new Date(date);
        const dow = ['日','月','火','水','木','金','土'][d.getDay()];
        const list = [...allStoreUsers, ...helpUsers].map(u => {
            const s = currentShifts[u.id]?.[date];
            if (!s || !s.start) return null;
            const prefix = u.isHelp ? '🌀 [ヘルプ] ' : '👤 ';
            const displayName = u.DisplayName || u.Name;
            return `${prefix}${displayName.padEnd(6,' ')} │ ${s.start} 〜 ${s.end}`;
        }).filter(x => x);

        if (list.length === 0) return showAlert('案内', 'この日のシフトはまだ登録されていません。');

        const storeName = window.currentAdminStoreName || 'かね将';
        const text = `📢【${storeName} シフト確定連絡】\n📅 対象日: ${date}(${dow})\n━━━━━━━━━━━━━━\n✨ 本日の出勤メンバー ✨\n━━━━━━━━━━━━━━\n${list.join('\n')}\n━━━━━━━━━━━━━━\n本日も元気に営業しましょう！🔥`;
        
        await navigator.clipboard.writeText(text);
        showAlert('完了', 'LINE用のメッセージをコピーしました！');
    } catch (e) {
        console.error(e);
        showAlert('エラー', 'コピーに失敗しました。');
    }
}

export async function openTimeInputMobile(date, uid) {
    window.currentEditingUid = uid;
    window.currentEditingDate = date;

    if (isBulkMode) {
        const cellId = `cell-mobile-${uid}-${date}`;
        const el = document.getElementById(cellId);
        
        const idx = selectedCells.findIndex(x => x.uid === uid && x.date === date);
        if (idx > -1) {
            selectedCells.splice(idx, 1);
            if (el) el.classList.remove('selected-shift-cell');
        } else {
            selectedCells.push({ uid, date });
            if (el) el.classList.add('selected-shift-cell');
        }
        
        const btnBulkModeMobile = document.getElementById('btn-bulk-mode-mobile');
        if (btnBulkModeMobile) {
            const labelSpan = btnBulkModeMobile.querySelector('.fab-label');
            if (labelSpan) labelSpan.textContent = `選択完了 (${selectedCells.length}件)`;
        }
        return;
    }

    const user = [...allStoreUsers, ...helpUsers].find(u => u.id === uid) || (uid === currentTargetUser?.id ? currentTargetUser : null);
    if (!user) return;
    
    const sData = currentShifts[uid]?.[date] || { start: '17:00', end: '22:00', breakMin: 0, note: '' };

    const sheet = document.getElementById('admin-mobile-bottom-sheet-mobile');
    if (sheet) {
        document.getElementById('sheet-staff-name-mobile').textContent = user.DisplayName || user.Name;
        document.getElementById('sheet-date-label-mobile').textContent = date.replace(/-/g, '/');
        
        const [sH, sM] = (sData.start || '17:00').split(':');
        const [eH, eM] = (sData.end || '22:00').split(':');
        
        const sH_el = document.getElementById('sheet-start-h-mobile');
        const sM_el = document.getElementById('sheet-start-m-mobile');
        const eH_el = document.getElementById('sheet-end-h-mobile');
        const eM_el = document.getElementById('sheet-end-m-mobile');
        
        sH_el.innerHTML = generateHOptions(sH);
        sM_el.innerHTML = generateMOptions(sM);
        eH_el.innerHTML = generateHOptions(eH);
        eM_el.innerHTML = generateMOptions(eM);
        
        document.getElementById('sheet-break-mobile').value = sData.breakMin || 0;
        document.getElementById('sheet-note-mobile').value = sData.note || "";

        [sH_el, sM_el, eH_el, eM_el, document.getElementById('sheet-break-mobile')].forEach(el => {
            el.onchange = () => window.updateMobileLiveHeaderMobile(date);
        });

        sheet.classList.add('show');
        window.updateMobileLiveHeaderMobile(date);

        document.getElementById('btn-save-sheet-mobile').onclick = async () => {
            const btnSave = document.getElementById('btn-save-sheet-mobile');
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            const news = {
                start: `${sH_el.value}:${sM_el.value}`,
                end: `${eH_el.value}:${eM_el.value}`,
                breakMin: parseInt(document.getElementById('sheet-break-mobile').value) || 0,
                note: document.getElementById('sheet-note-mobile').value
            };
            const ok = await applyShiftUpdate(uid, date, news);
            if (ok) sheet.classList.remove('show');
            
            btnSave.disabled = false;
            btnSave.innerHTML = '保存する';
        };

        const btnDeleteSheet = document.getElementById('btn-delete-sheet-mobile');
        if (btnDeleteSheet) {
            if (!sData.start && !sData.hopeStart) {
                btnDeleteSheet.style.display = 'none';
            } else {
                btnDeleteSheet.style.display = 'block';
                btnDeleteSheet.onclick = async () => {
                    const ok = await showConfirm('不採用確認', 'このシフト希望を不採用（削り）にしますか？');
                    if (!ok) return;
                    
                    btnDeleteSheet.disabled = true;
                    btnDeleteSheet.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';
                    
                    const news = {
                        userId: uid,
                        userName: user.Name || user.DisplayName,
                        date,
                        start: '',
                        end: '',
                        breakMin: 0,
                        note: document.getElementById('sheet-note-mobile')?.value || sData.note || '',
                        status: 'rejected',
                        hopeStart: sData.hopeStart || sData.start || '17:00',
                        hopeEnd: sData.hopeEnd || sData.end || '22:00',
                        storeId: String(window.currentAdminStoreId || sData.storeId || ''),
                        storeName: String(window.currentAdminStoreName || sData.storeName || ''),
                        updatedAt: new Date().toISOString()
                    };
                    
                    try {
                        await setDoc(doc(db, 't_shifts', `${date}_${uid}`), news);
                        if (!currentShifts[uid]) currentShifts[uid] = {};
                        currentShifts[uid][date] = news;

                        const currentMyStoreID = window.currentAdminStoreId || JSON.parse(localStorage.getItem('currentUser')).StoreID;
                        if (!globalShiftMap[uid]) globalShiftMap[uid] = {};
                        if (!globalShiftMap[uid][date]) globalShiftMap[uid][date] = [];
                        globalShiftMap[uid][date] = globalShiftMap[uid][date].filter(s => s.storeId != currentMyStoreID && s.StoreID != currentMyStoreID);
                        globalShiftMap[uid][date].push(news);

                        renderCellUIMobile(uid, date, news);
                        updateOverallKPIsMobile();
                        sheet.classList.remove('show');
                    } catch (err) {
                        console.error(err);
                        showAlert('エラー', '不採用処理に失敗しました。');
                    } finally {
                        btnDeleteSheet.disabled = false;
                        btnDeleteSheet.innerHTML = '<i class="fas fa-trash-alt"></i> 不採用';
                    }
                };
            }
        }
    }
}

export function updateMobileLiveHeaderMobile(ymd) {
    const liveHeader = document.getElementById('admin-mobile-live-header');
    if (!liveHeader) return;

    const dateLabel = document.getElementById('live-header-date');
    if (dateLabel) {
        const d = new Date(ymd);
        const dow = ['日','月','火','水','木','金','土'][d.getDay()];
        dateLabel.textContent = `${ymd.replace(/-/g,'/')} (${dow})`;
    }

    let dayHours = 0;
    const users = [...allStoreUsers, ...helpUsers];
    users.forEach(u => {
        let s = currentShifts[u.id]?.[ymd];
        const sheet = document.getElementById('admin-mobile-bottom-sheet-mobile');
        if (sheet && sheet.classList.contains('show') && window.currentEditingUid === u.id && window.currentEditingDate === ymd) {
            s = {
                start: `${document.getElementById('sheet-start-h-mobile').value}:${document.getElementById('sheet-start-m-mobile').value}`,
                end: `${document.getElementById('sheet-end-h-mobile').value}:${document.getElementById('sheet-end-m-mobile').value}`,
                breakMin: parseInt(document.getElementById('sheet-break-mobile').value) || 0
            };
        }

        if (s && s.start && s.end) {
            const sA = s.start.split(':').map(Number); const eA = s.end.split(':').map(Number);
            let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60); if (h < 0) h += 24;
            dayHours += Math.max(0, h - (s.breakMin || 0)/60);
        }
    });

    const target = dailyGoalSales[ymd] || 0;
    const sph = Math.round(dayHours > 0 ? target / dayHours : 0);
    const sphEl = document.getElementById('live-header-sph');
    if (sphEl) sphEl.textContent = `¥ ${sph.toLocaleString()}`;

    const graphCont = document.getElementById('live-hourly-graph-mobile');
    if (graphCont) {
        graphCont.innerHTML = '';
        const hourly = new Array(24).fill(0);
        users.forEach(u => {
            let s = currentShifts[u.id]?.[ymd];
            if (window.currentEditingUid === u.id && window.currentEditingDate === ymd) {
                s = {
                    start: `${document.getElementById('sheet-start-h-mobile').value}:${document.getElementById('sheet-start-m-mobile').value}`,
                    end: `${document.getElementById('sheet-end-h-mobile').value}:${document.getElementById('sheet-end-m-mobile').value}`,
                };
            }
            if (s && s.start && s.status !== 'rejected') {
                let start = parseInt(s.start.replace(':','')), end = parseInt(s.end.replace(':',''));
                if (end < start) end += 2400;
                for (let h = 0; h < 24; h++) {
                    const t = h * 100;
                    if (t >= start && t < end) hourly[h]++;
                }
            }
        });
        const max = Math.max(...hourly, 1);
        graphCont.innerHTML = hourly.map(c => `<div style="flex:1; height:${(c/max)*100}%; background:rgba(255,255,255,0.7); border-radius:1px 1px 0 0;"></div>`).join('');
    }
}

export async function openDailyMemoModalMobile(ymd) {
    const existingMemo = dailyMemos[ymd]?.memo || '';
    const text = prompt(`${ymd} の日次メモを入力してください（空にすると削除されます）：`, existingMemo);
    if (text === null) return;
    
    const me = JSON.parse(localStorage.getItem('currentUser'));
    const sid = window.currentAdminStoreId || me.StoreID || me.StoreId;
    const loader = showLoader();
    try {
        await saveDailyMemo(sid, ymd, text.trim(), me.Name);
        renderAdminGridMobile();
    } catch (e) {
        showAlert('エラー', 'メモの保存に失敗しました。');
    } finally {
        if (loader) loader.remove();
    }
}

export function openBulkInputMobile() {
    const sheet = document.getElementById('admin-mobile-bottom-sheet-mobile');
    if (!sheet) return;

    document.getElementById('sheet-staff-name-mobile').textContent = "一括設定";
    document.getElementById('sheet-date-label-mobile').textContent = `${selectedCells.length}件の選択中セル`;

    const sH_el = document.getElementById('sheet-start-h-mobile');
    const sM_el = document.getElementById('sheet-start-m-mobile');
    const eH_el = document.getElementById('sheet-end-h-mobile');
    const eM_el = document.getElementById('sheet-end-m-mobile');
    
    sH_el.innerHTML = generateHOptions('17');
    sM_el.innerHTML = generateMOptions('00');
    eH_el.innerHTML = generateHOptions('22');
    eM_el.innerHTML = generateMOptions('00');
    
    document.getElementById('sheet-break-mobile').value = 0;
    document.getElementById('sheet-note-mobile').value = "";

    const btnDeleteSheet = document.getElementById('btn-delete-sheet-mobile');
    if (btnDeleteSheet) btnDeleteSheet.style.display = 'none';

    sheet.classList.add('show');

    document.getElementById('btn-save-sheet-mobile').onclick = async () => {
        const btnSave = document.getElementById('btn-save-sheet-mobile');
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const newsTime = {
            start: `${sH_el.value}:${sM_el.value}`,
            end: `${eH_el.value}:${eM_el.value}`,
            breakMin: parseInt(document.getElementById('sheet-break-mobile').value) || 0,
            note: document.getElementById('sheet-note-mobile').value
        };

        const loader = showLoader();
        try {
            for (const item of selectedCells) {
                await applyShiftUpdate(item.uid, item.date, newsTime);
            }
            sheet.classList.remove('show');
            exitBulkModeMobile();
        } catch (e) {
            console.error(e);
            showAlert('エラー', '一括保存に失敗しました。');
        } finally {
            if (loader) loader.remove();
            btnSave.disabled = false;
            btnSave.innerHTML = '保存する';
        }
    };
}

export function exitBulkModeMobile() {
    setShiftState('isBulkMode', false);
    setShiftState('selectedCells', []);
    
    document.querySelectorAll('.selected-shift-cell').forEach(el => {
        el.classList.remove('selected-shift-cell');
    });

    const cont = document.getElementById('shift-admin-container-mobile');
    if (cont) cont.classList.remove('bulk-mode-active');

    const btnBulkModeMobile = document.getElementById('btn-bulk-mode-mobile');
    if (btnBulkModeMobile) {
        const labelSpan = btnBulkModeMobile.querySelector('.fab-label');
        if (labelSpan) labelSpan.textContent = "一括入力モード";
    }
}

export function closeAdminBottomSheetMobile() {
    const sheet = document.getElementById('admin-mobile-bottom-sheet-mobile');
    if (sheet) sheet.classList.remove('show');
    window.currentEditingUid = null;
    window.currentEditingDate = null;
}

// 時刻選択ヘルパー
function generateHOptions(selected) {
    let res = '';
    const preferredOrder = [];
    for (let i = 16; i <= 28; i++) preferredOrder.push(String(i).padStart(2, '0'));
    for (let i = 6; i <= 15; i++) preferredOrder.push(String(i).padStart(2, '0'));
    
    preferredOrder.forEach(v => {
        res += `<option value="${v}" ${v === String(selected).padStart(2, '0') ? 'selected' : ''}>${v}</option>`;
    });
    return res;
}

function generateMOptions(selected) {
    return ['00', '15', '30', '45'].map(v => `<option value="${v}" ${v === String(selected).padStart(2, '0') ? 'selected' : ''}>${v}</option>`).join('');
}

