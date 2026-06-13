import { db, collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, orderBy, limit } from './firebase.js';
import { showAlert, showConfirm, showLoader } from './ui_utils.js';
import { 
    currentSlot, currentShifts, currentTargetUser, allStoreUsers, helpUsers, 
    globalShiftMap, isBulkMode, selectedCells, dailyGoalSales, adminMode, 
    calendarData, loadShiftMemo, saveShiftMemo, loadStoreStaff, loadDailyMemos, 
    loadShiftsBatch, loadDailyGoalData, renderAdminGrid, updateOverallKPIs, 
    publishShifts, shareShiftToLine, formatDateJST, fetchCalendarData, 
    openHelpStaffModal, applyFixedSchedules, calculateSlot, getRollingSlots,
    setShiftState, showRejectedShifts, dailyMemos, getExtendedRange,
    applyShiftUpdate, checkDoubleBooking, saveDailyMemo
} from './shift.js';

export const shiftAdminMobilePageHtml = `
    <div class="animate-fade-in" id="shift-admin-container-mobile" style="max-width: 100%; margin: 0 auto; padding-bottom: 80px;">
        
        <!-- モバイル専用：操作バナー (3ボタン横並び、確定/超過を右端に) -->
        <div class="mobile-only" style="padding: 0.3rem 0.6rem; background: white; border-bottom: 1px solid var(--border); display: flex !important; flex-flow: row nowrap !important; align-items: center !important; justify-content: space-between !important; position: sticky; top: 0; z-index: 100; gap: 0.4rem; box-sizing: border-box; width: 100%;">
            <div style="display: flex !important; flex-flow: row nowrap !important; gap: 0.3rem !important; align-items: center !important; overflow-x: auto; -webkit-overflow-scrolling: touch; white-space: nowrap;">
                <button id="btn-open-action-menu-mobile" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.5rem; font-weight: 800; border-radius: 6px; font-size: 0.7rem; background: #e67e22 !important; color: white !important; border: none; height: 30px; display: inline-flex; align-items: center; gap: 0.2rem; cursor: pointer;"><i class="fas fa-cog"></i> メニュー</button>
                <button id="btn-landscape-preview-trigger-mobile" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.5rem; font-size: 0.7rem; font-weight: 800; background: #e74c3c !important; color: white !important; border: none; border-radius: 6px; height: 30px; display: inline-flex; align-items: center; gap: 0.2rem; cursor: pointer;"><i class="fas fa-search-plus"></i> プレビュー</button>
                <button id="btn-toggle-rejected-mobile" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.5rem; font-size: 0.7rem; font-weight: 800; background: white !important; color: #475569 !important; border: 1px solid #cbd5e1 !important; border-radius: 6px; height: 30px; display: inline-flex; align-items: center; gap: 0.2rem; cursor: pointer;"><i class="fas fa-eye-slash"></i> 削った希望を確認</button>
            </div>
            <div style="flex-shrink: 0; display: flex; align-items: center;">
                <button id="btn-publish-mobile" class="btn btn-primary btn-sm" style="padding: 0.35rem 0.6rem; font-size: 0.7rem; font-weight: 800; background: #10b981 !important; color: white !important; border: none; border-radius: 6px; height: 30px; display: inline-flex; align-items: center; gap: 0.2rem; cursor: pointer;"><i class="fas fa-check"></i> 確定</button>
                <div id="admin-28h-alerts-mobile" style="display: none; font-size: 0.65rem; color: #ef4444; font-weight: 700; background: #fee2e2; padding: 0.15rem 0.35rem; border-radius: 4px; cursor: pointer; white-space: nowrap;" onclick="window.show28hAlertDetailsMobile()">⚠️ 超過</div>
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
                    ${Array.from({length:24}).map((_,i) => '<div style="flex:1; text-align:center; font-size:0.6rem; color:var(--text-secondary);">' + i + '</div>').join('')}
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

        <!-- 【スマホ専用】下部フローティング固定バー (メニューを削除し、KPI情報を中央寄せ) -->
        <div id="admin-mobile-bottom-bar-mobile" class="bottom-bar-fixed-mobile" style="display: none;">
            <!-- 通常モード時のバー表示 -->
            <div id="bottom-bar-normal-content-mobile" class="bar-content-mobile-row" style="justify-content: center; text-align: center;">
                <div id="bottom-bar-kpi-info-mobile" style="line-height: 1.4; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
                    <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;" id="bottom-bar-active-date-label-mobile">日付選択なし</span>
                    <span style="font-size: 0.8rem; font-weight: 800; color: var(--primary);" id="bottom-bar-active-kpi-label-mobile">SPH: - / 目標: -</span>
                </div>
            </div>
            <!-- 一括選択モード時のバー表示 -->
            <div id="bottom-bar-bulk-content-mobile" class="bar-content-mobile-row" style="display: none;">
                <button id="btn-bulk-cancel-mobile" class="btn btn-secondary btn-sm" style="padding: 0.5rem 0.8rem; font-weight: 800; border-radius: 8px; font-size: 0.8rem; background: white; color: var(--text-primary); border: 1px solid var(--border);"><i class="fas fa-times"></i> 解除</button>
                <div id="bottom-bar-bulk-count-mobile" style="font-size: 0.85rem; font-weight: 800; color: #854d0e;">0件選択中</div>
                <button id="btn-bulk-set-mobile" class="btn btn-primary btn-sm" style="padding: 0.5rem 0.8rem; font-weight: 800; border-radius: 8px; font-size: 0.8rem; background: #eab308; border-color: #d4a017; color: #422006;"><i class="fas fa-edit"></i> 一括設定</button>
            </div>
        </div>

        <!-- 【スマホ専用】管理機能メニューシート（下からせり上がる） -->
        <div id="admin-mobile-action-menu-mobile" class="bottom-sheet">
            <div class="sheet-handle"></div>
            <div class="sheet-content" style="padding-bottom: 24px;">
                <div class="sheet-header" style="margin-bottom: 15px;">
                    <div class="staff-name" style="font-size: 1rem;"><i class="fas fa-cog"></i> 管理メニュー</div>
                    <div class="date-label" onclick="window.closeAdminActionMenuMobile()" style="cursor: pointer; color: var(--text-secondary);">閉じる</div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; width: 100%;">
                    <button id="btn-menu-bulk-mode-mobile" class="btn btn-secondary" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem; padding: 1rem 0.5rem; font-size: 0.8rem; height: auto;"><i class="fas fa-check-double" style="font-size: 1.2rem; color: #eab308;"></i> 一括入力モード</button>
                    <button id="btn-menu-apply-fixed-mobile" class="btn btn-secondary" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem; padding: 1rem 0.5rem; font-size: 0.8rem; height: auto;"><i class="fas fa-magic" style="font-size: 1.2rem; color: #7c3aed;"></i> 固定反映</button>
                    <button id="btn-menu-add-help-mobile" class="btn btn-secondary" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem; padding: 1rem 0.5rem; font-size: 0.8rem; height: auto;"><i class="fas fa-user-plus" style="font-size: 1.2rem; color: #3b82f6;"></i> ヘルプ追加</button>
                    <button id="btn-menu-manage-fixed-mobile" class="btn btn-secondary" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem; padding: 1rem 0.5rem; font-size: 0.8rem; height: auto;"><i class="fas fa-user-clock" style="font-size: 1.2rem; color: #64748b;"></i> 固定設定</button>
                    <button id="btn-menu-edit-memo-mobile" class="btn btn-secondary" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem; padding: 1rem 0.5rem; font-size: 0.8rem; height: auto;"><i class="fas fa-edit" style="font-size: 1.2rem; color: #10b981;"></i> 店長メモ編集</button>
                    <button id="btn-menu-share-line-mobile" class="btn btn-secondary" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem; padding: 1rem 0.5rem; font-size: 0.8rem; height: auto;"><i class="fab fa-line" style="font-size: 1.2rem; color: #06C755;"></i> LINE通知</button>
                </div>
                <div style="margin-top: 0.75rem; width: 100%;">
                    <button id="btn-menu-publish-mobile" class="btn btn-primary" style="width: 100%; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.85rem;"><i class="fas fa-paper-plane"></i> 一括確定・公開</button>
                </div>
            </div>
        </div>

        <!-- 【スマホ専用】イマーシブ全画面プレビューオーバーレイ (タップで閉じる) -->
        <div id="admin-mobile-landscape-preview-mobile" class="landscape-preview-overlay" style="display: none;">
            <!-- タップで閉じるヒント (自動フェードアウト) -->
            <div id="landscape-preview-tap-hint" class="landscape-preview-tap-hint">
                <i class="fas fa-hand-pointer"></i> タップして閉じる
            </div>
            <!-- スクロール可能なテーブルエリア (タップで閉じる) -->
            <div class="landscape-preview-body-container" id="landscape-preview-scroll-area-mobile">
                <div class="landscape-preview-body">
                    <table id="landscape-preview-table-mobile" style="border-collapse: collapse; min-width: 1000px; background: white;">
                        <thead><tr id="landscape-table-header-mobile"><th class="staff-cell">スタッフ</th></tr></thead>
                        <tbody id="landscape-table-body-mobile"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 【スマホ専用】クイック・エディター・モーダル -->
        <div id="admin-mobile-bottom-sheet-mobile" class="centered-modal" style="padding: 1.1rem 1rem;">
            <div class="sheet-content">
                <div class="sheet-header" style="border-bottom: 1px solid #cbd5e1; padding-bottom: 0.6rem; margin-bottom: 0.8rem;">
                    <div id="sheet-staff-name-mobile" class="staff-name" style="color: #ef4444; font-size: 1.15rem; font-weight: 800;">スタッフ名</div>
                    <div id="sheet-date-label-mobile" class="date-label" style="font-size: 0.95rem; font-weight: 700; color: #64748b;">04/01 (月)</div>
                </div>
                
                <div class="time-adjust-section" style="background: #f8fafc; padding: 0.9rem 0.6rem; border-radius: 14px; margin-top: 0.8rem; border: 1px solid #e2e8f0;">
                    <div class="time-input-row" style="display: flex; align-items: center; justify-content: space-around; gap: 0.4rem;">
                        <div class="time-group" style="text-align: center;">
                            <label style="font-size: 0.72rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 0.35rem;">開始時間</label>
                            <div class="select-pair" style="display: flex; align-items: center; gap: 0.25rem;">
                                <select id="sheet-start-h-mobile" class="time-select" style="font-size: 16px !important;"></select>
                                <span style="font-weight: 800; color: #64748b;">:</span>
                                <select id="sheet-start-m-mobile" class="time-select" style="font-size: 16px !important;"></select>
                            </div>
                        </div>
                        <div class="time-arrow" style="font-size: 1rem; color: #cbd5e1; margin-top: 1.1rem;"><i class="fas fa-arrow-right"></i></div>
                        <div class="time-group" style="text-align: center;">
                            <label style="font-size: 0.72rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 0.35rem;">終了時間</label>
                            <div class="select-pair" style="display: flex; align-items: center; gap: 0.25rem;">
                                <select id="sheet-end-h-mobile" class="time-select" style="font-size: 16px !important;"></select>
                                <span style="font-weight: 800; color: #64748b;">:</span>
                                <select id="sheet-end-m-mobile" class="time-select" style="font-size: 16px !important;"></select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="extra-input-row" style="display: flex; gap: 0.6rem; margin-top: 0.9rem; border-top: 1px solid #cbd5e1; padding-top: 0.9rem;">
                        <div class="input-item" style="flex: 1;">
                            <label style="font-size: 0.72rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 0.35rem;">休憩 (分)</label>
                            <input type="number" id="sheet-break-mobile" class="sheet-input" style="width: 100%; height: 40px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.4rem; font-size: 16px !important; font-weight: 700; text-align: center; color: #1e293b; box-sizing: border-box;" value="0">
                        </div>
                        <div class="input-item" style="flex: 2.2;">
                            <label style="font-size: 0.72rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 0.35rem;">メモ</label>
                            <input type="text" id="sheet-note-mobile" class="sheet-input" style="width: 100%; height: 40px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.4rem 0.6rem; font-size: 16px !important; font-weight: 600; color: #1e293b; box-sizing: border-box;" placeholder="特記事項...">
                        </div>
                    </div>
                </div>

                <div class="sheet-actions" style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%; margin-top: 1rem; box-sizing: border-box;">
                    <!-- 保存ボタン (最上段フル幅) -->
                    <button id="btn-save-sheet-mobile" class="btn btn-save-sheet" style="width: 100%; height: 44px; font-weight: 800; font-size: 0.95rem; border-radius: 10px; background: #10b981 !important; color: white !important; border: none; display: flex; align-items: center; justify-content: center; gap: 0.4rem; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.15);"><i class="fas fa-save"></i> 保存する</button>
                    
                    <div style="display: flex; gap: 0.5rem; width: 100%;">
                        <!-- キャンセルボタン -->
                        <button class="btn btn-cancel-sheet" onclick="window.closeAdminBottomSheetMobile()" style="flex: 1; height: 40px; font-weight: 700; font-size: 0.85rem; border-radius: 8px; background: white; color: #475569; border: 1px solid #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center;">キャンセル</button>
                        
                        <!-- 不採用ボタン (希望がある場合のみ表示) -->
                        <button id="btn-reject-sheet-mobile" class="btn" style="flex: 1; height: 40px; font-weight: 700; font-size: 0.85rem; border-radius: 8px; background: #fffbeb !important; color: #d97706 !important; border: 1px solid #fde68a !important; display: none; align-items: center; justify-content: center; gap: 0.25rem; cursor: pointer;"><i class="fas fa-user-slash"></i> 不採用</button>
                        
                        <!-- シフト削除ボタン (希望がない場合の通常削除) -->
                        <button id="btn-delete-sheet-mobile" class="btn" style="flex: 1; height: 40px; font-weight: 700; font-size: 0.85rem; border-radius: 8px; background: #fee2e2 !important; color: #ef4444 !important; border: 1px solid #fca5a5 !important; display: none; align-items: center; justify-content: center; gap: 0.25rem; cursor: pointer;"><i class="fas fa-trash-alt"></i> 削除する</button>
                    </div>

                    <!-- 完全に削除するボタン (希望があるが、希望ごと完全消去したい場合の下部フル幅ボタン) -->
                    <button id="btn-force-delete-sheet-mobile" class="btn" style="width: 100%; height: 34px; font-weight: 700; font-size: 0.75rem; border-radius: 6px; background: #f8fafc !important; color: #ef4444 !important; border: 1px solid #f1f5f9 !important; display: none; align-items: center; justify-content: center; gap: 0.25rem; cursor: pointer; margin-top: 0.2rem;"><i class="fas fa-times-circle"></i> 希望・シフトデータを完全に削除</button>
                </div>
            </div>
        </div>

        <!-- 【スマホ専用】日次メモ・カスタムモーダル -->
        <div id="admin-mobile-memo-modal-mobile" class="top-sheet">
            <div class="sheet-content">
                <div class="sheet-header">
                    <div id="memo-sheet-title-mobile" class="staff-name">04/01 (月) のメモ</div>
                    <div onclick="window.closeDailyMemoModalMobile()" style="cursor: pointer; color: var(--text-secondary); font-weight: 700; font-size: 0.9rem;">閉じる</div>
                </div>
                <div style="margin-bottom: 1.2rem;">
                    <textarea id="memo-sheet-textarea-mobile" class="sheet-input" placeholder="この日の連絡・注意事項、店長メモを入力..." style="width: 100%; height: 120px; resize: none; padding: 0.75rem; border-radius: 12px; border: 1px solid var(--border); font-size: 0.9rem; line-height: 1.5; font-family: inherit; box-sizing: border-box;"></textarea>
                </div>
                <div class="sheet-actions" style="display: flex; justify-content: space-between; gap: 0.5rem; width: 100%;">
                    <button id="btn-delete-memo-mobile" class="btn btn-secondary" style="background: var(--danger); color: white; border: none; padding: 0.75rem 0.8rem; font-size: 0.85rem;"><i class="fas fa-trash-alt"></i> 削除</button>
                    <div style="display: flex; gap: 0.4rem;">
                        <button class="btn btn-cancel-sheet" onclick="window.closeDailyMemoModalMobile()" style="font-size: 0.85rem; padding: 0.75rem 0.8rem;">キャンセル</button>
                        <button id="btn-save-memo-mobile" class="btn btn-save-sheet" style="font-size: 0.85rem; padding: 0.75rem 0.8rem;">保存する</button>
                    </div>
                </div>
                <div class="sheet-handle" style="margin: 15px auto -8px auto;"></div>
            </div>
        </div>

        <!-- ボトムシート・プレミアムバックドロップ (薄いダーク調のぼかし背景) -->
        <div id="bottom-sheet-backdrop-mobile" class="bottom-sheet-backdrop" onclick="window.closeAllBottomSheetsMobile()"></div>
    </div>
`;

export async function initShiftAdminMobilePage() {
    console.log("Initializing Shift Admin Mobile Independent View...");
    injectStylesMobile();
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
            <div class="mobile-title-container-custom" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0.1rem 0.5rem; background: white; gap: 0.5rem;">
                <div id="admin-active-store-mobile" style="font-weight: 800; color: var(--primary); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">📍 店舗読み込み中...</div>
                <select id="admin-slot-select-mobile" style="font-size: 0.85rem; padding: 0.2rem 0.4rem; border-radius: 6px; border: 1px solid var(--border); font-weight: 800; background: white; color: var(--primary);">
                    ${optionsHtml}
                </select>
            </div>
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
            loadShiftMemo(sid),
            loadDailyMemos(sid, currentSlot.startDate, currentSlot.endDate)
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
                btnToggleRejectedMobile.innerHTML = '<i class="fas fa-eye"></i> 削った希望を確認';
                btnToggleRejectedMobile.style.color = '#e74c3c';
                btnToggleRejectedMobile.style.borderColor = '#e74c3c';
                btnToggleRejectedMobile.style.background = 'rgba(231, 76, 60, 0.08)';
            } else {
                btnToggleRejectedMobile.innerHTML = '<i class="fas fa-eye-slash"></i> 削った希望を確認';
                btnToggleRejectedMobile.style.color = '#475569';
                btnToggleRejectedMobile.style.borderColor = '#cbd5e1';
                btnToggleRejectedMobile.style.background = 'white';
            }
            renderAdminGridMobile(); // スマホ用グリッドの再描画
        };
    }

    // 新設のモバイル確定ボタン
    const btnPublishMobile = document.getElementById('btn-publish-mobile');
    if (btnPublishMobile) {
        btnPublishMobile.onclick = () => publishShifts();
    }

    // 横画面プレビュー関連のイベントバインド (イマーシブ全画面・タップで閉じる・ピンチズーム)
    const btnPreview = document.getElementById('btn-landscape-preview-trigger-mobile');
    if (btnPreview) {
        btnPreview.onclick = () => window.openLandscapePreviewMobile();
    }

    // オーバーレイ自体：タップで閉じる + ピンチズーム
    const previewOverlay = document.getElementById('admin-mobile-landscape-preview-mobile');
    const previewScrollArea = document.getElementById('landscape-preview-scroll-area-mobile');
    if (previewOverlay && previewScrollArea) {
        // --- タップで閉じる (pointerup でスクロールと区別) ---
        let pointerStartX = 0, pointerStartY = 0;
        previewOverlay.addEventListener('pointerdown', (e) => {
            pointerStartX = e.clientX;
            pointerStartY = e.clientY;
        });
        previewOverlay.addEventListener('pointerup', (e) => {
            const dx = Math.abs(e.clientX - pointerStartX);
            const dy = Math.abs(e.clientY - pointerStartY);
            if (dx < 5 && dy < 5) {
                window.closeLandscapePreviewMobile();
            }
        });

        // --- ピンチズーム (touch events でスケール変換) ---
        let currentScale = 1;
        let lastTouchDist = 0;
        let isPinching = false;

        const getTouchDist = (t1, t2) => {
            const dx = t2.clientX - t1.clientX;
            const dy = t2.clientY - t1.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        previewScrollArea.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                isPinching = true;
                lastTouchDist = getTouchDist(e.touches[0], e.touches[1]);
                e.preventDefault();
            }
        }, { passive: false });

        previewScrollArea.addEventListener('touchmove', (e) => {
            if (isPinching && e.touches.length === 2) {
                const dist = getTouchDist(e.touches[0], e.touches[1]);
                const delta = dist / lastTouchDist;
                lastTouchDist = dist;
                currentScale = Math.min(4.0, Math.max(0.4, currentScale * delta));
                const table = document.getElementById('landscape-preview-table-mobile');
                if (table) {
                    table.style.transformOrigin = 'top left';
                    table.style.transform = `scale(${currentScale})`;
                }
                e.preventDefault();
            }
        }, { passive: false });

        previewScrollArea.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                isPinching = false;
            }
        });
    }

    const handleOrientationChange = () => {
        const isLandscape = window.innerWidth > window.innerHeight;
        const previewEl = document.getElementById('admin-mobile-landscape-preview-mobile');
        if (isLandscape) {
            window.openLandscapePreviewMobile();
        } else {
            if (previewEl && !previewEl.classList.contains('force-landscape')) {
                window.closeLandscapePreviewMobile();
            }
        }
    };
    window.addEventListener('resize', handleOrientationChange);

    // 管理メニューシート関連のイベントバインド
    window.openAdminActionMenuMobile = () => {
        const menu = document.getElementById('admin-mobile-action-menu-mobile');
        if (menu) menu.classList.add('show');
        const backdrop = document.getElementById('bottom-sheet-backdrop-mobile');
        if (backdrop) backdrop.classList.add('show');
    };
    window.closeAdminActionMenuMobile = () => {
        const menu = document.getElementById('admin-mobile-action-menu-mobile');
        if (menu) menu.classList.remove('show');
        const backdrop = document.getElementById('bottom-sheet-backdrop-mobile');
        if (backdrop) backdrop.classList.remove('show');
    };
    const btnOpenMenu = document.getElementById('btn-open-action-menu-mobile');
    if (btnOpenMenu) {
        btnOpenMenu.onclick = () => window.openAdminActionMenuMobile();
    }

    const bindMenuBtn = (id, action) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.onclick = () => {
                window.closeAdminActionMenuMobile();
                action();
            };
        }
    };

    bindMenuBtn('btn-menu-publish-mobile', () => publishShifts());
    bindMenuBtn('btn-menu-share-line-mobile', () => shareShiftToLine(window.currentAdminStoreId, window.currentAdminStoreName));
    bindMenuBtn('btn-menu-add-help-mobile', () => openHelpStaffModal());
    bindMenuBtn('btn-menu-apply-fixed-mobile', () => {
        showConfirm('定例反映', '定例シフトを反映しますか？', async () => {
            await applyFixedSchedules();
        });
    });
    bindMenuBtn('btn-menu-manage-fixed-mobile', () => {
        if (window.renderFixedShiftStaffList) window.renderFixedShiftStaffList();
        if (window.openSideDrawer) window.openSideDrawer();
    });
    bindMenuBtn('btn-menu-edit-memo-mobile', () => {
        const currentMemo = window.currentMobileMemo || "";
        const newMemo = prompt("店長メモを編集", currentMemo);
        if (newMemo !== null) {
            window.currentMobileMemo = newMemo;
            saveShiftMemo();
        }
    });

    const btnMenuBulkMode = document.getElementById('btn-menu-bulk-mode-mobile');
    if (btnMenuBulkMode) {
        btnMenuBulkMode.onclick = () => {
            window.closeAdminActionMenuMobile();
            if (!isBulkMode) {
                setShiftState('isBulkMode', true);
                setShiftState('selectedCells', []);
                
                const normalBar = document.getElementById('bottom-bar-normal-content-mobile');
                const bulkBar = document.getElementById('bottom-bar-bulk-content-mobile');
                const bottomBar = document.getElementById('admin-mobile-bottom-bar-mobile');
                
                if (normalBar) normalBar.style.display = 'none';
                if (bulkBar) bulkBar.style.display = 'flex';
                if (bottomBar) {
                    bottomBar.style.display = 'flex';
                    bottomBar.classList.add('bulk-active');
                }
                
                const bulkCount = document.getElementById('bottom-bar-bulk-count-mobile');
                if (bulkCount) bulkCount.textContent = "0件選択中";
                
                const cont = document.getElementById('shift-admin-container-mobile');
                if (cont) cont.classList.add('bulk-mode-active');
            }
        };
    }

    const btnBulkCancel = document.getElementById('btn-bulk-cancel-mobile');
    if (btnBulkCancel) {
        btnBulkCancel.onclick = () => {
            exitBulkModeMobile();
        };
    }

    const btnBulkSet = document.getElementById('btn-bulk-set-mobile');
    if (btnBulkSet) {
        btnBulkSet.onclick = () => {
            if (selectedCells.length > 0) {
                openBulkInputMobile();
            }
        };
    }

    // スタイルを注入する
    injectStylesMobile();

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
    window.closeDailyMemoModalMobile = closeDailyMemoModalMobile;
    window.closeAdminBottomSheetMobile = closeAdminBottomSheetMobile;
    window.closeAllBottomSheetsMobile = closeAllBottomSheetsMobile;
    
    // モバイル専用新規のグローバル登録
    window.selectActiveDateMobile = selectActiveDateMobile;
    window.show28hAlertDetailsMobile = show28hAlertDetailsMobile;
    window.openLandscapePreviewMobile = openLandscapePreviewMobile;
    window.closeLandscapePreviewMobile = closeLandscapePreviewMobile;
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
                    id="hdr-mobile-${ymd}"
                    onclick="window.selectActiveDateMobile('${ymd}'); window.showHelperTooltipMobile(event, '${ymd}')">
                    <div class="date-num">${d.getDate()}</div>
                    <div class="weekday">${['日','月','火','水','木','金','土'][d.getDay()]}</div>
                    ${isHoliday ? `<div class="holiday-name-hdr">${cal.label || '祝日'}</div>` : ''}
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
                    <span style="font-weight:800; font-size:0.8rem;">メモ</span>
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
                ? `<i class="fas fa-comment-dots" style="color: #10b981; font-size: 1.1rem; display: block; margin: 0 auto;" title="${memoText}"></i>` 
                : `<span class="daily-memo-preview empty" style="font-size: 0.85rem; color: #94a3b8; font-weight: 500; display: block; text-align: center;">＋</span>`;
                
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
                tr.innerHTML += `<td class="shift-cell ${isOff ? 'is-off-column' : ''}" id="cell-mobile-${u.id}-${ymd}" onclick="window.selectActiveDateMobile('${ymd}'); window.openTimeInputMobile('${ymd}', '${u.id}')"></td>`;
            }
            body.appendChild(tr);
            for(let i=0; i<span; i++){
                const d = new Date(currentSlot.startDate); d.setDate(d.getDate()+i);
                const ymd = formatDateJST(d);
                if(currentShifts[u.id]?.[ymd]) renderCellUIMobile(u.id, ymd, currentShifts[u.id][ymd]);
            }
        });

        // ページロード時に、デフォルト日付を選択する
        const todayStr = formatDateJST(new Date());
        const firstDateStr = formatDateJST(currentSlot.startDate);
        const defaultDate = (todayStr >= firstDateStr && todayStr <= formatDateJST(currentSlot.endDate)) ? todayStr : firstDateStr;
        setTimeout(() => {
            if (window.selectActiveDateMobile) window.selectActiveDateMobile(window.currentActiveDateMobile || defaultDate);
        }, 100);

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

    const btnPublishMobile = document.getElementById('btn-publish-mobile');
    const btnMenuPublishMobile = document.getElementById('btn-menu-publish-mobile');
    if (alertsContMobile) {
        if (violations.length > 0) {
            alertsContMobile.textContent = `⚠️ 超過`;
            alertsContMobile.style.display = 'block';
            if (btnPublishMobile) btnPublishMobile.style.display = 'none';
            if (btnMenuPublishMobile) {
                btnMenuPublishMobile.disabled = true;
                btnMenuPublishMobile.style.opacity = '0.5';
                btnMenuPublishMobile.style.cursor = 'not-allowed';
                btnMenuPublishMobile.innerHTML = '<i class="fas fa-ban"></i> 28h超過のため公開不可';
            }
        } else {
            alertsContMobile.style.display = 'none';
            if (btnPublishMobile) btnPublishMobile.style.display = 'inline-flex';
            if (btnMenuPublishMobile) {
                btnMenuPublishMobile.disabled = false;
                btnMenuPublishMobile.style.opacity = '1';
                btnMenuPublishMobile.style.cursor = 'pointer';
                btnMenuPublishMobile.innerHTML = '<i class="fas fa-paper-plane"></i> 一括確定・公開';
            }
        }
    }
    window.current28hViolations = violations;

    renderAdminFooterMobile();

    // アクティブな日付の固定バーを再描画
    if (window.currentActiveDateMobile && window.selectActiveDateMobile) {
        window.selectActiveDateMobile(window.currentActiveDateMobile);
    }
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
        const text = `📢【${storeName} シフト確定連絡】\n📅 対象日: ${date}(${dow})\n━━━━━━━━━━━━━━\n✨ 本日の出勤メンバー ✨\n━━━━━━━━━━━━━━\n\n${list.join('\n')}\n━━━━━━━━━━━━━━\n本日も元気に営業しましょう！🔥`;
        
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
        
        const btnBulkCountMobile = document.getElementById('bottom-bar-bulk-count-mobile');
        if (btnBulkCountMobile) {
            btnBulkCountMobile.textContent = `${selectedCells.length}件選択中`;
        }
        return;
    }

    const user = [...allStoreUsers, ...helpUsers].find(u => u.id === uid) || (uid === currentTargetUser?.id ? currentTargetUser : null);
    if (!user) return;
    
    const sData = currentShifts[uid]?.[date] || { start: '17:00', end: '22:00', breakMin: 0, note: '' };

    const sheet = document.getElementById('admin-mobile-bottom-sheet-mobile');
    if (sheet) {
        document.getElementById('sheet-staff-name-mobile').textContent = user.DisplayName || user.Name;
        const parts = date.split('-').map(Number);
        const editD = new Date(parts[0], parts[1] - 1, parts[2]);
        const editDow = ['日','月','火','水','木','金','土'][editD.getDay()];
        document.getElementById('sheet-date-label-mobile').textContent = `${date.replace(/-/g, '/')} (${editDow})`;
        
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
        const backdrop = document.getElementById('bottom-sheet-backdrop-mobile');
        if (backdrop) backdrop.classList.add('show');
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
            if (ok) window.closeAdminBottomSheetMobile();
            
            btnSave.disabled = false;
            btnSave.innerHTML = '保存する';
        };

        const btnDelete = document.getElementById('btn-delete-sheet-mobile');
        const btnReject = document.getElementById('btn-reject-sheet-mobile');
        const btnForceDelete = document.getElementById('btn-force-delete-sheet-mobile');

        if (btnDelete) btnDelete.style.display = 'none';
        if (btnReject) btnReject.style.display = 'none';
        if (btnForceDelete) btnForceDelete.style.display = 'none';

        const hasHope = !!(sData.hopeStart || sData.hopeEnd);
        const hasShift = !!sData.start;

        const rejectAction = async (btn) => {
            btn.disabled = true;
            const origHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            const loader = showLoader();
            
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
                window.closeAdminBottomSheetMobile();
            } catch (err) {
                console.error(err);
                showAlert('エラー', '不採用処理に失敗しました。');
            } finally {
                btn.disabled = false;
                btn.innerHTML = origHTML;
                if (loader) loader.remove();
            }
        };

        const deleteAction = async (btn) => {
            btn.disabled = true;
            const origHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            const loader = showLoader();
            
            try {
                await deleteDoc(doc(db, 't_shifts', `${date}_${uid}`));
                
                if (currentShifts[uid]) {
                    delete currentShifts[uid][date];
                }

                const currentMyStoreID = window.currentAdminStoreId || JSON.parse(localStorage.getItem('currentUser')).StoreID;
                if (globalShiftMap[uid] && globalShiftMap[uid][date]) {
                    globalShiftMap[uid][date] = globalShiftMap[uid][date].filter(s => s.storeId != currentMyStoreID && s.StoreID != currentMyStoreID);
                }

                renderCellUIMobile(uid, date, null);
                updateOverallKPIsMobile();
                window.closeAdminBottomSheetMobile();
            } catch (err) {
                console.error(err);
                showAlert('エラー', 'シフト削除に失敗しました。');
            } finally {
                btn.disabled = false;
                btn.innerHTML = origHTML;
                if (loader) loader.remove();
            }
        };

        if (hasHope) {
            if (btnReject) {
                btnReject.style.display = 'flex';
                btnReject.onclick = async () => {
                    const ok = await showConfirm('不採用確認', 'このシフト希望を不採用（削り）にしますか？');
                    if (ok) await rejectAction(btnReject);
                };
            }
            if (btnForceDelete) {
                btnForceDelete.style.display = 'flex';
                btnForceDelete.onclick = async () => {
                    const ok = await showConfirm('完全削除確認', 'このセルの希望およびシフトデータを完全に削除しますか？\n(削除すると空白のセルに戻ります)');
                    if (ok) await deleteAction(btnForceDelete);
                };
            }
        } else {
            if (hasShift && btnDelete) {
                btnDelete.style.display = 'flex';
                btnDelete.onclick = async () => {
                    const ok = await showConfirm('削除確認', 'この日のシフト設定を削除しますか？');
                    if (ok) await deleteAction(btnDelete);
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

export function openDailyMemoModalMobile(ymd) {
    const sheet = document.getElementById('admin-mobile-memo-modal-mobile');
    const textarea = document.getElementById('memo-sheet-textarea-mobile');
    const title = document.getElementById('memo-sheet-title-mobile');
    const saveBtn = document.getElementById('btn-save-memo-mobile');
    const deleteBtn = document.getElementById('btn-delete-memo-mobile');
    
    if (!sheet || !textarea || !title) return;
    
    const d = new Date(ymd);
    const dow = ['日','月','火','水','木','金','土'][d.getDay()];
    title.textContent = `${d.getMonth() + 1}/${d.getDate()} (${dow}) のメモ`;
    
    const existingMemo = dailyMemos[ymd]?.memo || '';
    textarea.value = existingMemo;
    
    // 自動高さ調整の初期化
    textarea.style.height = '120px';
    if (textarea.scrollHeight > 120) {
        textarea.style.height = textarea.scrollHeight + 'px';
    }
    
    // 文字入力に連動した高さ自動拡張
    textarea.oninput = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };
    
    deleteBtn.style.display = existingMemo ? 'block' : 'none';
    
    saveBtn.onclick = async () => {
        const text = textarea.value.trim();
        const me = JSON.parse(localStorage.getItem('currentUser'));
        const sid = window.currentAdminStoreId || me.StoreID || me.StoreId;
        const loader = showLoader();
        try {
            await saveDailyMemo(sid, ymd, text, me.Name);
            closeDailyMemoModalMobile();
            renderAdminGridMobile();
        } catch (e) {
            showAlert('エラー', 'メモの保存に失敗しました。');
        } finally {
            if (loader) loader.remove();
        }
    };
    
    deleteBtn.onclick = async () => {
        showConfirm('メモの削除', 'この日のメモを削除しますか？', async () => {
            const me = JSON.parse(localStorage.getItem('currentUser'));
            const sid = window.currentAdminStoreId || me.StoreID || me.StoreId;
            const loader = showLoader();
            try {
                await saveDailyMemo(sid, ymd, '', me.Name);
                closeDailyMemoModalMobile();
                renderAdminGridMobile();
            } catch (e) {
                showAlert('エラー', 'メモの削除に失敗しました。');
            } finally {
                if (loader) loader.remove();
            }
        });
    };
    
    sheet.classList.add('show');
    const backdrop = document.getElementById('bottom-sheet-backdrop-mobile');
    if (backdrop) backdrop.classList.add('show');
}

export function closeDailyMemoModalMobile() {
    const sheet = document.getElementById('admin-mobile-memo-modal-mobile');
    if (sheet) sheet.classList.remove('show');
    const backdrop = document.getElementById('bottom-sheet-backdrop-mobile');
    if (backdrop) backdrop.classList.remove('show');
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

    const normalBar = document.getElementById('bottom-bar-normal-content-mobile');
    const bulkBar = document.getElementById('bottom-bar-bulk-content-mobile');
    const bottomBar = document.getElementById('admin-mobile-bottom-bar-mobile');
    
    if (normalBar) normalBar.style.display = 'none';
    if (bulkBar) bulkBar.style.display = 'none';
    if (bottomBar) {
        bottomBar.style.display = 'none';
        bottomBar.classList.remove('bulk-active');
    }
}

export function closeAdminBottomSheetMobile() {
    const sheet = document.getElementById('admin-mobile-bottom-sheet-mobile');
    if (sheet) sheet.classList.remove('show');
    const backdrop = document.getElementById('bottom-sheet-backdrop-mobile');
    if (backdrop) backdrop.classList.remove('show');
    window.currentEditingUid = null;
    window.currentEditingDate = null;
}

export function closeAllBottomSheetsMobile() {
    window.closeAdminBottomSheetMobile();
    window.closeDailyMemoModalMobile();
    window.closeAdminActionMenuMobile();
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

// ==========================================
// モバイル専用新規の関数定義
// ==========================================

export function injectStylesMobile() {
    if (document.getElementById('shift-mobile-styles')) return;
    const s = document.createElement('style');
    s.id = 'shift-mobile-styles';
    s.innerHTML = `
        /* --- Mobile Custom Styles --- */
        .bottom-bar-fixed-mobile {
            position: fixed;
            bottom: 15px;
            left: 15px;
            right: 15px;
            height: 60px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(226, 232, 240, 0.9);
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
            z-index: 10001;
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 0 1.2rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .bottom-bar-fixed-mobile.bulk-active {
            display: flex !important;
            background: rgba(254, 243, 199, 0.98) !important;
            border: 1px solid rgba(245, 158, 11, 0.6) !important;
            box-shadow: 0 10px 30px rgba(245, 158, 11, 0.25) !important;
        }
        .bottom-sheet-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.25s ease, visibility 0.25s;
            z-index: 10000;
        }
        .bottom-sheet-backdrop.show {
            opacity: 1;
            visibility: visible;
        }
        .is-off-column { 
            background-color: #fef2f2 !important; 
            background-image: repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(239, 68, 68, 0.08) 5px, rgba(239, 68, 68, 0.08) 10px) !important;
            cursor: not-allowed;
        }
        .time-select {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            background: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            padding: 0.4rem 0.2rem !important;
            font-size: 16px !important;
            font-weight: 700 !important;
            color: #1e293b !important;
            text-align: center !important;
            width: 52px !important;
            height: 40px !important;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.02) !important;
            cursor: pointer !important;
            outline: none !important;
            transition: border-color 0.2s, background-color 0.2s !important;
        }
        .time-select:focus {
            border-color: #10b981 !important;
            background-color: white !important;
        }
        .bar-content-mobile-row {
            display: flex;
            width: 100%;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        }
        .bottom-sheet {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            border-radius: 24px 24px 0 0;
            box-shadow: 0 -10px 40px rgba(15, 23, 42, 0.15);
            transform: translateY(100%);
            visibility: hidden;
            transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.35s;
            z-index: 10002;
            padding: 1.5rem;
            padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
        }
        .bottom-sheet.show {
            transform: translateY(0);
            visibility: visible;
        }
        .top-sheet {
            position: fixed;
            left: 0;
            right: 0;
            top: 0;
            background: white;
            border-radius: 0 0 24px 24px;
            box-shadow: 0 10px 40px rgba(15, 23, 42, 0.15);
            transform: translateY(-100%);
            visibility: hidden;
            transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.35s;
            z-index: 10002;
            padding: 1.5rem;
            padding-top: calc(1.5rem + env(safe-area-inset-top));
        }
        .top-sheet.show {
            transform: translateY(0);
            visibility: visible;
        }
        .centered-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            z-index: 10002;
            width: calc(100% - 30px);
            max-width: 360px;
            padding: 1.5rem;
            visibility: hidden;
            opacity: 0;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s, visibility 0.3s;
        }
        .centered-modal.show {
            transform: translate(-50%, -50%) scale(1);
            visibility: visible;
            opacity: 1;
        }
        #shift-admin-table-mobile {
            border-collapse: separate !important;
            border-spacing: 0 !important;
        }
        #shift-admin-table-mobile th, #shift-admin-table-mobile td {
            border: 1px solid #e2e8f0 !important;
            text-align: center;
        }
        .sheet-handle {
            width: 40px;
            height: 5px;
            background: #e2e8f0;
            border-radius: 10px;
            margin: -8px auto 15px auto;
        }
        .sheet-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.2rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.8rem;
        }
        .sheet-header .staff-name {
            font-size: 1.1rem;
            font-weight: 800;
            color: var(--primary);
        }
        .sheet-header .date-label {
            font-size: 0.9rem;
            font-weight: 700;
            color: var(--text-secondary);
        }
        
        /* Landscape Preview Styles (イマーシブ全画面・タップで閉じる) */
        .landscape-preview-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #0f172a;
            z-index: 2147483647; /* CSS最大値: ヘッダー含む全要素の上に被せる */
            display: flex;
            flex-direction: column;
            overflow: hidden;
            color: white;
            cursor: pointer; /* タップで閉じることを示す */
        }
        /* タップで閉じるヒント */
        .landscape-preview-tap-hint {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 20010;
            text-align: center;
            padding: 0.6rem 1rem;
            background: rgba(15, 23, 42, 0.85);
            color: rgba(255,255,255,0.9);
            font-size: 0.8rem;
            font-weight: 700;
            letter-spacing: 0.05em;
            pointer-events: none;
            transition: opacity 0.6s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        .landscape-preview-tap-hint.hidden {
            opacity: 0;
        }
        .landscape-preview-body-container {
            flex: 1;
            overflow: auto;
            background: #0f172a;
            -webkit-overflow-scrolling: touch;
            cursor: pointer;
            /* ヒント分のパディング */
            padding-top: 38px;
        }
        .landscape-preview-body {
            padding: 0.5rem;
        }
        #landscape-preview-table-mobile {
            --preview-col-width: 60px;
            border-collapse: collapse;
            background: white;
            color: #1e293b;
            width: 100%;
            cursor: default; /* テーブル上はデフォルトカーソル */
        }
        #landscape-preview-table-mobile th, #landscape-preview-table-mobile td {
            border: 1px solid #e2e8f0;
            text-align: center;
            font-size: 0.75rem;
            padding: 0.3rem;
        }
        #landscape-preview-table-mobile th.date-hdr {
            min-width: var(--preview-col-width) !important;
            width: var(--preview-col-width) !important;
            padding: 0.4rem 0.1rem;
        }
        #landscape-preview-table-mobile td.shift-cell {
            height: 48px;
            min-width: var(--preview-col-width) !important;
            width: var(--preview-col-width) !important;
            padding: 2px;
        }
        #landscape-preview-table-mobile .staff-cell {
            position: sticky;
            left: 0;
            z-index: 10;
            background: #f8fafc;
            font-weight: 700;
            border-right: 2px solid #cbd5e1 !important;
            min-width: 90px;
            white-space: nowrap;
            box-shadow: 2px 0 5px rgba(0,0,0,0.1);
        }
        .landscape-preview-overlay.force-landscape {
            width: 100vh !important;
            height: 100vw !important;
            transform: rotate(90deg);
            transform-origin: top left;
            position: fixed;
            top: 0;
            left: 100vw;
        }
        
        /* Selected Date Highlights */
        .selected-date-column-mobile {
            background: rgba(59, 130, 246, 0.08) !important;
        }
        th.date-hdr.selected-date-column-mobile {
            background: rgba(59, 130, 246, 0.15) !important;
            border-bottom: 3px solid var(--primary) !important;
        }
    `;
    document.head.appendChild(s);
}

export function selectActiveDateMobile(ymd) {
    window.currentActiveDateMobile = ymd;
    
    // Clear previous selection highlights
    document.querySelectorAll('.selected-date-column-mobile').forEach(el => {
        el.classList.remove('selected-date-column-mobile');
    });
    
    // Add highlights to headers and cells for active date
    const hdr = document.getElementById(`hdr-mobile-${ymd}`);
    if (hdr) hdr.classList.add('selected-date-column-mobile');
    
    const users = [...allStoreUsers, ...helpUsers];
    users.forEach(u => {
        const cell = document.getElementById(`cell-mobile-${u.id}-${ymd}`);
        if (cell) cell.classList.add('selected-date-column-mobile');
    });
    
    const memoCell = document.getElementById(`memo-cell-mobile-${ymd}`);
    if (memoCell) memoCell.classList.add('selected-date-column-mobile');
    
    // Update JST label on fixed bottom bar
    const d = new Date(ymd);
    const dow = ['日','月','火','水','木','金','土'][d.getDay()];
    const dateLabel = document.getElementById('bottom-bar-active-date-label-mobile');
    if (dateLabel) {
        dateLabel.textContent = `${ymd.replace(/-/g,'/')} (${dow})`;
    }
    
    // Compute date KPIs
    let dayH = 0;
    users.forEach(u => {
        const s = currentShifts[u.id]?.[ymd];
        if (s && s.start && s.status !== 'rejected') {
            const sA = s.start.split(':').map(Number);
            const eA = s.end.split(':').map(Number);
            let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60);
            if (h < 0) h += 24;
            dayH += Math.max(0, h - (s.breakMin || 0)/60);
        }
    });
    
    const goalVal = dailyGoalSales[ymd] || 0;
    const sph = dayH > 0 ? Math.round(goalVal / dayH) : 0;
    
    const kpiLabel = document.getElementById('bottom-bar-active-kpi-label-mobile');
    if (kpiLabel) {
        kpiLabel.innerHTML = `SPH: <span style="font-size:0.85rem; font-weight:900; color:var(--primary);">¥${sph.toLocaleString()}</span> / 目標: <span style="font-weight:700; color:var(--text-primary);">¥${goalVal.toLocaleString()}</span>`;
    }
}

export function show28hAlertDetailsMobile() {
    const violations = window.current28hViolations || [];
    if (violations.length === 0) {
        showAlert("アラート詳細", "28時間制限を超過しているスタッフはいません。");
        return;
    }
    const content = violations.map(v => `・ ${v}`).join("\n");
    showAlert("⚠️ 28時間制限超過アラート", `以下のスタッフが週28時間を超過しています：\n\n${content}`);
}

export function openLandscapePreviewMobile() {
    const previewEl = document.getElementById('admin-mobile-landscape-preview-mobile');
    if (!previewEl) return;
    
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) {
        previewEl.classList.add('force-landscape');
    } else {
        previewEl.classList.remove('force-landscape');
    }
    
    previewEl.style.display = 'flex';
    renderLandscapeGridMobile();

    // ヘッダーを非表示にして真の全画面を実現
    const mobileHeader = document.querySelector('.mobile-app-header');
    if (mobileHeader) {
        mobileHeader.style.display = 'none';
    }
    // body のスクロールをロック
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    // 「タップして閉じる」ヒントを表示し、2.5秒後にフェードアウト
    const hint = document.getElementById('landscape-preview-tap-hint');
    if (hint) {
        hint.classList.remove('hidden');
        clearTimeout(window._previewHintTimer);
        window._previewHintTimer = setTimeout(() => {
            hint.classList.add('hidden');
        }, 2500);
    }
}

export function closeLandscapePreviewMobile() {
    const previewEl = document.getElementById('admin-mobile-landscape-preview-mobile');
    if (previewEl) {
        previewEl.style.display = 'none';
        previewEl.classList.remove('force-landscape');
    }
    // ヘッダーを元に戻す
    const mobileHeader = document.querySelector('.mobile-app-header');
    if (mobileHeader) {
        mobileHeader.style.display = '';
    }
    // body スクロールを解除
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    // ヒントタイマーをクリア
    clearTimeout(window._previewHintTimer);
}

export function renderLandscapeGridMobile() {
    const body = document.getElementById('landscape-table-body-mobile');
    const header = document.getElementById('landscape-table-header-mobile');
    if (!header || !body) return;
    
    const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
    header.innerHTML = '<th class="staff-cell">スタッフ</th>';
    for (let i = 0; i < span; i++) {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = formatDateJST(d);
        const cal = calendarData[ymd] || {};
        const isHoliday = cal.is_holiday;
        const isOff = cal.type === 'off';
        
        header.innerHTML += `
            <th class="date-hdr ${isHoliday ? 'is-holiday' : ''} ${isOff ? 'is-off-column' : ''}">
                <div class="date-num">${d.getDate()}</div>
                <div class="weekday">${['日','月','火','水','木','金','土'][d.getDay()]}</div>
                ${isHoliday ? `<div class="holiday-name-hdr">${cal.label || '祝日'}</div>` : ''}
            </th>`;
    }
    
    body.innerHTML = '';
    
    const roleOrder = { 'Manager': 0, '管理者': 1, 'Admin': 1, '一般社員': 2, 'Staff': 2, 'アルバイト': 3, 'PartTimer': 3 };
    const list = [...allStoreUsers, ...helpUsers].sort((a, b) => {
        const orderA = roleOrder[a.Role] ?? 99;
        const orderB = roleOrder[b.Role] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return (a.EmployeeCode || "").localeCompare(b.EmployeeCode || "");
    });
    
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
            
            const sData = currentShifts[u.id]?.[ymd];
            let cellHtml = '';
            
            if (sData && sData.start && sData.status !== 'rejected') {
                const isConfirmed = sData.status === 'confirmed';
                const stampHtml = isConfirmed ? `<div class="official-stamp"><i class="fas fa-check-circle"></i></div>` : '';
                cellHtml = `
                    <div class="shift-box ${isConfirmed ? '' : 'applied'}" style="font-size: 0.65rem; padding: 2px;">
                        ${stampHtml}
                        <div>${sData.start}-${sData.end}</div>
                    </div>
                `;
            } else if (sData && sData.status === 'rejected' && showRejectedShifts) {
                cellHtml = `
                    <div class="shift-box rejected-hope" style="font-size: 0.6rem; padding: 2px;">
                        <div style="opacity: 0.8;"><i class="fas fa-eye-slash"></i> 削り</div>
                        <div>${sData.hopeStart || '17:00'}-${sData.hopeEnd || '22:00'}</div>
                    </div>
                `;
            }
            
            tr.innerHTML += `<td class="shift-cell ${isOff ? 'is-off-column' : ''}" style="height: 48px; pointer-events: none;">${cellHtml}</td>`;
        }
        body.appendChild(tr);
    });

    // 【プレビュー用KPI行】人時売上・売上目標を追加（プレビューでは表示する）
    const trSPH = document.createElement('tr');
    trSPH.innerHTML = `<td class="staff-cell" style="background:#f1f5f9; font-size:0.7rem; font-weight:800; color:#1e293b;">人時売上</td>`;

    const trGoal = document.createElement('tr');
    trGoal.innerHTML = `<td class="staff-cell" style="background:#f8fafc; font-size:0.65rem; font-weight:700; color:#64748b;">売上目標</td>`;

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
        trSPH.innerHTML += `<td style="background:#f1f5f9; text-align:center; padding:2px;"><span style="background:${bg}; color:white; padding:1px 3px; border-radius:3px; font-size:0.6rem; font-weight:700;">¥${Math.round(sph).toLocaleString()}</span></td>`;

        const goalVal = dailyGoalSales[ymd] || 0;
        trGoal.innerHTML += `<td style="background:#f8fafc; font-size:0.6rem; color:#64748b; font-weight:700; text-align:center;">¥${Math.round(goalVal).toLocaleString()}</td>`;
    }
    body.appendChild(trSPH);
    body.appendChild(trGoal);
}
