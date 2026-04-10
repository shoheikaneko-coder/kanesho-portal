import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm, showLoader } from './ui_utils.js';

/**
 * --- Date Utilities ---
 */
const formatDateJST = (d) => {
    if (!d) return "";
    const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toISOString().split("T")[0];
};

/**
 * --- Shared State & Slots ---
 */
let currentSlot = {
    year: 0, month: 0, slot: 1, 
    startDate: null, endDate: null,
    deadLine: null
};

export function calculateSlot() {
    const now = new Date();
    const day = now.getDate();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth() + 1;
    let slot = 1;

    if (day <= 10) {
        slot = 2; // 今月後半
    } else if (day <= 25) {
        targetMonth++; // 翌月前半
        if (targetMonth > 12) { targetMonth = 1; targetYear++; }
        slot = 1;
    } else {
        targetMonth++; // 翌月後半
        if (targetMonth > 12) { targetMonth = 1; targetYear++; }
        slot = 2;
    }

    currentSlot.year = targetYear;
    currentSlot.month = targetMonth;
    currentSlot.slot = slot;
    
    const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
    currentSlot.startDate = new Date(targetYear, targetMonth - 1, slot === 1 ? 1 : 16);
    currentSlot.endDate = new Date(targetYear, targetMonth - 1, slot === 1 ? 15 : lastDayOfMonth);
    
    const deadlineText = (slot === 2) ? `${targetYear}/${targetMonth}/10` : (day > 25 ? `${targetYear}/${targetMonth}/25` : `${now.getFullYear()}/${now.getMonth()+1}/25`);
    currentSlot.deadLine = deadlineText;
}

/**
 * 閲覧用のローリング6スロット（前月・今月・翌月 × 前半・後半）を取得する
 */
export function getRollingSlots() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const months = [
        { y: currentMonth === 1 ? currentYear - 1 : currentYear, m: currentMonth === 1 ? 12 : currentMonth - 1 },
        { y: currentYear, m: currentMonth },
        { y: currentMonth === 12 ? currentYear + 1 : currentYear, m: currentMonth === 12 ? 1 : currentMonth + 1 }
    ];

    const slots = [];
    months.forEach(item => {
        [1, 2].forEach(s => {
            const lastDay = new Date(item.y, item.m, 0).getDate();
            const start = new Date(item.y, item.m - 1, s === 1 ? 1 : 16);
            const end = new Date(item.y, item.m - 1, s === 1 ? 15 : lastDay);
            
            // 現在の時刻と比較
            const isPast = now > end;
            const isTodayInSlot = now >= start && now <= end;
            
            slots.push({
                id: `${item.y}-${item.m}-${s}`,
                year: item.y,
                month: item.m,
                slot: s,
                startDate: start,
                endDate: end,
                isPast,
                isCurrent: isTodayInSlot,
                label: `${item.m}月 ${s === 1 ? '前半' : '後半'}`
            });
        });
    });
    return slots;
}

/**
 * --- HTML Templates ---
 */
const sharedModalHtml = `
    <!-- モーダル (共通) -->
    <div id="shift-input-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
        <div class="glass-panel animate-scale-in" style="width:100%; max-width:420px; padding:2rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
                <h4 id="modal-date-title" style="margin:0;">時刻入力</h4>
                <button id="btn-modal-prev-copy" class="btn btn-secondary btn-sm" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;"><i class="fas fa-copy"></i> 前回分をコピー</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1.2rem;">
                <!-- 開始時間 -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <label class="field-label" style="margin:0;">開始</label>
                        <div style="display: flex; gap: 4px;">
                            <button onclick="quickSetTime('start','16:30')" class="btn btn-secondary btn-sm" style="font-size:0.6rem; padding:2px 5px;">16:30</button>
                            <button onclick="quickSetTime('start','17:00')" class="btn btn-secondary btn-sm" style="font-size:0.6rem; padding:2px 5px;">17:00</button>
                            <button onclick="quickSetTime('start','18:00')" class="btn btn-secondary btn-sm" style="font-size:0.6rem; padding:2px 5px;">18:00</button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <select id="modal-start-h" class="form-input" style="flex:1; font-size: 1.1rem; font-weight: 600; text-align: center;"></select>
                        <span style="font-weight: 800;">:</span>
                        <select id="modal-start-m" class="form-input" style="flex:1; font-size: 1.1rem; font-weight: 600; text-align: center;">
                            <option value="00">00</option>
                            <option value="15">15</option>
                            <option value="30">30</option>
                            <option value="45">45</option>
                        </select>
                    </div>
                </div>
                <!-- 終了時間 -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <label class="field-label" style="margin:0;">終了</label>
                        <div style="display: flex; gap: 4px;">
                            <button onclick="quickSetTime('end','23:30')" class="btn btn-secondary btn-sm" style="font-size:0.6rem; padding:2px 5px;">23:30</button>
                            <button onclick="quickSetTime('end','00:00')" class="btn btn-secondary btn-sm" style="font-size:0.6rem; padding:2px 5px;">24:00</button>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <select id="modal-end-h" class="form-input" style="flex:1; font-size: 1.1rem; font-weight: 600; text-align: center;"></select>
                        <span style="font-weight: 800;">:</span>
                        <select id="modal-end-m" class="form-input" style="flex:1; font-size: 1.1rem; font-weight: 600; text-align: center;">
                            <option value="00">00</option>
                            <option value="15">15</option>
                            <option value="30">30</option>
                            <option value="45">45</option>
                        </select>
                    </div>
                </div>
                
                <div><label class="field-label">休憩(分)</label><input type="number" id="modal-break" class="form-input" value="0" step="15"></div>
                <div><label class="field-label">備考</label><input type="text" id="modal-note" class="form-input"></div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button id="btn-modal-clear" class="btn btn-secondary" style="flex:1;">削除</button>
                    <button id="btn-modal-save" class="btn btn-primary" style="flex:2;">保存</button>
                </div>
                <button onclick="document.getElementById('shift-input-modal').style.display='none'" class="btn" style="width:100%; font-size:0.8rem; margin-top:0.5rem;">キャンセル</button>
            </div>
        </div>
    </div>

    <!-- 引き出し型パネル (サイドドロワー) -->
    <div id="drawer-overlay" class="drawer-overlay" onclick="closeSideDrawer()"></div>
    <div id="fixed-shift-drawer" class="side-drawer">
        <div style="padding:1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.8);">
            <h4 style="margin:0; font-weight:800; color:var(--primary);"><i class="fas fa-user-clock"></i> 定例シフト設定</h4>
            <button onclick="closeSideDrawer()" class="btn" style="padding:0.5rem; line-height:1;"><i class="fas fa-times" style="font-size:1.2rem;"></i></button>
        </div>
        <div id="fixed-shift-drawer-body" style="padding:1.5rem; overflow-y:auto; flex:1;">
            <!-- ここにスタッフ一覧または個別設定フォームが書き込まれる -->
        </div>
    </div>
`;

window.closeSideDrawer = () => {
    const drawer = document.getElementById('fixed-shift-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if(drawer) drawer.classList.remove('show');
    if(overlay) overlay.classList.remove('show');
    setTimeout(() => {
        if(overlay) overlay.style.display = 'none';
    }, 300);
};

window.openSideDrawer = () => {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('fixed-shift-drawer');
    if(!overlay || !drawer) return;
    overlay.style.display = 'block';
    setTimeout(() => {
        overlay.classList.add('show');
        drawer.classList.add('show');
    }, 10);
};

export const shiftSubmissionPageHtml = `
    <div class="animate-fade-in" id="shift-submission-container" style="max-width: 1400px; margin: 0 auto; padding-bottom: 3rem;">
        
        <!-- デスクトップ用アクションバー -->
        <div class="glass-panel desktop-only" style="padding: 1.2rem 1.5rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; border-left: 5px solid var(--primary);">
            <div>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 700;" id="shift-deadline-info"></p>
            </div>
            <div style="display: flex; gap: 1rem; align-items: center;">
                <button id="btn-bulk-mode-staff" class="btn btn-secondary" style="font-size: 0.85rem;"><i class="fas fa-check-double"></i> 一括入力</button>
                <button id="btn-save-as-template" class="btn btn-secondary" style="font-size: 0.85rem;"><i class="fas fa-save"></i> 基本型に保存</button>
                <button id="btn-apply-template" class="btn btn-secondary" style="font-size: 0.85rem;"><i class="fas fa-magic"></i> いつものパターン</button>
                <button id="btn-submit-shifts" class="btn btn-primary" style="font-size: 0.9rem; padding: 0.6rem 2rem; font-weight: 800;">提出する</button>
            </div>
        </div>

        <!-- モバイル用アクションバー (Sticky化) -->
        <div class="mobile-only" id="mobile-action-bar-container" style="position: sticky; top: 0; z-index: 100; margin: 0 -1.5rem 1.5rem -1.5rem; padding: 0.5rem 1rem 1rem 1.5rem; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border);">
            <!-- 通常時 -->
            <div id="mobile-standard-actions" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 0.8rem 1rem; border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <button onclick="window.toggleMobileActionHub(true)" class="btn" style="background: #f1f5f9; color: var(--text-primary); padding: 0.6rem 1rem; font-size: 0.85rem; font-weight: 700; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-folder-open" style="color:var(--primary);"></i> 機能
                </button>
                <button id="btn-submit-shifts-mobile" class="btn btn-primary" style="padding: 0.6rem 1.5rem; font-size: 0.9rem; font-weight: 800; border-radius: 12px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);">
                    提出する
                </button>
            </div>

            <!-- 一括選択モード時 -->
            <div id="mobile-bulk-actions" style="display: none; justify-content: space-between; align-items: center; background: #fef9c3; padding: 0.6rem 0.8rem; border-radius: 16px; border: 2px solid #eab308; box-shadow: 0 4px 12px rgba(234, 179, 8, 0.15);">
                <button id="btn-mobile-bulk-cancel" class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); padding: 0.5rem 0.8rem; font-size: 0.8rem; font-weight: 700; border-radius: 10px;">
                    <i class="fas fa-times"></i> 解除
                </button>
                <div style="font-size:0.85rem; font-weight:800; color:#854d0e;">
                    <span id="mobile-bulk-count">0</span>日分を選択中
                </div>
                <button id="btn-mobile-bulk-set" class="btn btn-primary" style="padding: 0.5rem 0.8rem; font-size: 0.8rem; font-weight: 800; border-radius: 10px; background: #eab308; border-color:#d4a017; color:#422006;">
                    時間を設定
                </button>
            </div>
            <p id="shift-deadline-info-mobile" style="margin: 0.6rem 0 0 0.5rem; font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;"></p>
        </div>

        <!-- 店長メモ -->
        <div id="staff-memo-area" class="glass-panel" style="padding: 1rem 1.5rem; margin-bottom: 2rem; border-left: 5px solid #10b981; display: none;">
            <div style="font-size: 0.75rem; color: #059669; font-weight: 800; margin-bottom: 0.5rem;"><i class="fas fa-bullhorn"></i> 店長からの連絡事項</div>
            <div id="staff-memo-text" style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.6; white-space: pre-wrap;"></div>
        </div>

        <!-- デスクトップ用テーブル -->
        <div class="glass-panel desktop-only" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <div style="overflow-x: auto;">
                <table id="shift-submission-table" style="width: 100%; border-collapse: collapse; min-width: 1000px;">
                    <thead><tr id="shift-table-header"><th class="staff-cell">スタッフ</th></tr></thead>
                    <tbody id="shift-table-body"></tbody>
                </table>
            </div>
        </div>

        <!-- モバイル用リスト -->
        <div id="shift-mobile-list-container" class="mobile-only">
            <!-- ここに縦リストが描画される -->
        </div>
    </div>

    <!-- モバイルアクションハブ (オーバーレイ) -->
    <div id="mobile-action-hub-overlay" class="mobile-action-hub-overlay mobile-only" onclick="window.toggleMobileActionHub(false)">
        <div class="mobile-action-hub-content" onclick="event.stopPropagation()">
            <div class="mobile-hub-title"><i class="fas fa-magic" style="color:var(--primary);"></i> シフト作成サポート</div>
            <div class="mobile-hub-grid">
                <button class="mobile-hub-btn" id="btn-bulk-mode-staff-mobile">
                    <i class="fas fa-check-double"></i>
                    <span>一括入力</span>
                </button>
                <button class="mobile-hub-btn" id="btn-apply-template-mobile">
                    <i class="fas fa-wand-magic-sparkles"></i>
                    <span>いつもの<br>パターン</span>
                </button>
                <button class="mobile-hub-btn" id="btn-save-as-template-mobile">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <span>基本型に<br>保存</span>
                </button>
            </div>
            <button class="btn mobile-only" style="width:100%; margin-top:2rem; padding: 1rem; font-weight: 700; background: #f1f5f9; color: var(--text-secondary); border-radius: 14px;" onclick="window.toggleMobileActionHub(false)">閉じる</button>
        </div>
    </div>

    ${sharedModalHtml}
`;

export const shiftAdminPageHtml = `
    <div class="animate-fade-in" id="shift-admin-container" style="max-width: 100%; padding-bottom: 5rem;">
        
        <!-- 【スマホ専用】イマーシブ・ライブ・ヘッダー ( Cockpit v2 ) -->
        <div id="admin-mobile-live-header" class="mobile-only">
            <div class="live-header-top">
                <div id="live-header-date" class="live-date">2024/04/01 (月)</div>
                <div class="live-sph-badge">予定SPH: <span id="live-header-sph">¥ 0</span></div>
                <div id="admin-28h-alerts-mobile" class="live-alert-badge">アラート: 0</div>
                <button id="btn-edit-memo-mobile" class="btn btn-memo-quick">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="live-graph-area">
                <div class="live-graph-label">人員充足状況 (1h点分)</div>
                <div id="live-hourly-graph-mobile" class="mini-graph-container">
                    <!-- JSで動的にバーが生成される -->
                </div>
            </div>
            <div id="admin-active-store-mobile" class="live-store-label"></div>
        </div>

        <div id="admin-mobile-kpi-bar-placeholder" class="mobile-only" style="height: 10px;"></div>

        <!-- 【PC専用】KPIグリッドエリア -->
        <div class="desktop-only admin-kpi-grid" style="margin-bottom: 1.5rem;">
            <div class="glass-panel" style="padding: 1.2rem; border-left: 5px solid var(--secondary);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">期間平均人時売上</div>
                <div id="admin-avg-sph" style="font-size: 1.8rem; font-weight: 900; color: var(--secondary);">¥ 0</div>
            </div>
            <div class="glass-panel" style="padding: 1.2rem; border-left: 5px solid #ef4444; min-height: 100px;">
                <div style="font-size: 0.75rem; color: #ef4444; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-exclamation-triangle"></i> 28h制限アラート
                </div>
                <div id="admin-28h-alerts" style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-primary); font-weight: 600;">
                    <span style="color: var(--text-secondary); font-weight: 400;">チェック中...</span>
                </div>
            </div>
            <div class="glass-panel" style="padding: 1rem; border-left: 5px solid #10b981; position: relative;">
                <div style="font-size: 0.75rem; color: #059669; font-weight: 700; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span><i class="fas fa-pen-nib"></i> 店長メモ・周知事項</span>
                    <button id="btn-save-memo" class="btn btn-secondary btn-sm" style="padding: 0.1rem 0.5rem; font-size: 0.65rem;"><i class="fas fa-save"></i> 保存</button>
                </div>
                <textarea id="admin-shift-memo" placeholder="新人の研修予定や行事など..." style="width: 100%; height: 50px; border: none; background: transparent; font-size: 0.8rem; resize: none; outline: none; margin: 0; padding: 0; color: var(--text-primary); line-height: 1.4;"></textarea>
            </div>
        </div>

        <!-- 【PC専用】アクションバー -->
        <div class="glass-panel desktop-only" style="padding: 1rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <select id="admin-store-select" class="form-input" style="width: auto; min-width: 200px; margin: 0; padding: 0.4rem 0.8rem; font-weight: 700; height: 38px; display: none;">
                    <option value="">店舗を選択してください</option>
                </select>
                <span id="admin-active-store-label" style="font-weight: 700; color: var(--text-primary); font-size: 1rem;"></span>
            </div>
            <div style="display: flex; gap: 0.8rem; justify-content: flex-end; flex: 1;">
                <button id="btn-manage-fixed-shift" class="btn btn-secondary" style="font-size:0.85rem; border: 1px solid var(--border);"><i class="fas fa-user-clock"></i> 固定設定</button>
                <button id="btn-bulk-mode" class="btn btn-secondary" style="font-size:0.85rem; border: 1px solid var(--border);"><i class="fas fa-check-double"></i> 一括入力</button>
                <button id="btn-apply-fixed-schedule" class="btn btn-secondary" style="font-size:0.85rem; border: 1px solid var(--secondary); color: var(--secondary); background: rgba(0,0,0,0);"><i class="fas fa-magic"></i> 固定反映</button>
                <button id="btn-add-help-staff" class="btn btn-secondary" style="font-size:0.85rem;"><i class="fas fa-user-plus"></i> ヘルプ追加</button>
                <button id="btn-share-line" class="btn btn-line" style="font-size:0.85rem; font-weight:800; padding: 0.6rem 1.2rem; background:#06C755; color:white; border:none;"><i class="fab fa-line"></i> LINE周知</button>
                <button id="btn-publish-shifts" class="btn btn-primary" style="font-size:0.85rem; font-weight:800; padding: 0.6rem 1.2rem;">一括確定・公開</button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); position: relative;">
            <div id="hourly-graph-panel" style="display:none; padding:1.5rem; background:#f8fafc; border-bottom:2px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h4 id="graph-date-title" style="margin:0; font-size:1rem; color:var(--primary);"></h4>
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
            <div style="overflow-x: auto;">
                <table id="shift-admin-table" style="width: 100%; border-collapse: collapse; min-width: 1000px;">
                    <thead><tr id="admin-table-header"><th class="staff-cell">スタッフ</th></tr></thead>
                    <tbody id="admin-table-body"></tbody>
                    <tfoot id="admin-table-foot"></tfoot>
                </table>
            </div>
        </div>

        <!-- 【スマホ専用】管理者用アクション・コックピット（公式FAB互換デザイン） -->
        <div id="admin-mobile-fab-hub" class="mobile-only fab-container">
            <!-- 没入型ボカシオーバーレイ -->
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
        <div id="admin-mobile-bottom-sheet" class="mobile-only bottom-sheet">
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

    ${sharedModalHtml}
`;

/**
 * --- Internal State & Styles ---
 */
let currentShifts = {}; 
let currentTargetUser = null;
let allStoreUsers = [];
let helpUsers = [];
let globalShiftMap = {}; // 28h判定用：全店舗・複数シフトを保持 { uid: { date: [shift1, shift2] } }

// 一括入力用
let isBulkMode = false;
let selectedCells = []; // [{uid, date}]
let dailyGoalSales = {};
let adminMode = false;
let calendarData = {}; // { YYYY-MM-DD: { type, is_holiday, label } }

const injectStyles = () => {
    if (document.getElementById('shift-styles')) return;
    const s = document.createElement('style');
    s.id = 'shift-styles';
    s.innerHTML = `
        #shift-submission-table th, #shift-submission-table td, #shift-admin-table th, #shift-admin-table td { border: 1px solid var(--border); text-align: center; }
        .staff-cell { position: sticky; left: 0; z-index: 5; background: white; padding: 1rem; font-weight: 700; border-right: 2px solid var(--border) !important; text-align: left; box-shadow: 2px 0 5px rgba(0,0,0,0.05); }
        .date-hdr { font-size: 0.8rem; font-weight: 800; min-width: 65px; padding: 0.8rem 0.2rem; cursor: pointer; }
        .shift-cell { height: 70px; cursor: pointer; padding: 0.4rem; }
        .shift-cell:hover { background: #f8fafc; }
        .shift-box { background: var(--primary); color: white; border-radius: 6px; padding: 0.3rem; font-size: 0.7rem; font-weight: 800; display: flex; flex-direction: column; justify-content: center; height: 100%; pointer-events: none; }
        .shift-box.applied { background: #94a3b8; }
        .shift-cell.selected-shift-cell { background: rgba(253, 224, 71, 0.2); border: 2px solid #eab308 !important; position: relative; z-index: 2; }
        .sph-badge { display: inline-block; padding: 0.2rem 0.4rem; border-radius: 4px; color: white; font-size: 0.65rem; font-weight: 800; }
        .sph-good { background: var(--secondary); }
        .sph-warn { background: var(--warning); }
        .sph-danger { background: var(--primary); }

        /* モバイル用表示切り替え */
        .mobile-only { display: none !important; }
        @media (max-width: 1024px) {
            .mobile-only { display: block !important; }
            .desktop-only { display: none !important; }

            /* モバイル用リストカード (Cockpit v2) */
            .mobile-shift-card {
                background: white; border-radius: 16px; padding: 1rem; margin-bottom: 0.8rem;
                display: flex; align-items: center; gap: 1rem; border: 1px solid var(--border);
                box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: background 0.2s;
            }
            .mobile-shift-card:active { background: #f8fafc; }
            .mobile-date-box {
                width: 50px; height: 50px; background: #f1f5f9; border-radius: 12px;
                display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;
            }
            .mobile-date-box.is-holiday { background: #fee2e2; }
            .mobile-date-box.is-sat { background: #e0f2fe; }
            .mobile-date-box .day { font-size: 1.1rem; font-weight: 800; color: var(--text-primary); line-height: 1; }
            .mobile-date-box .weekday { font-size: 0.6rem; font-weight: 700; color: var(--text-secondary); margin-top: 0.1rem; }
            
            .mobile-shift-content { flex: 1; min-width: 0; }
            .mobile-shift-time { font-size: 1rem; font-weight: 800; color: var(--primary); }
            .mobile-shift-status { font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; margin-top: 0.1rem; }
            .mobile-shift-empty { font-size: 0.9rem; color: #94a3b8; font-weight: 500; }
            .mobile-holiday-label { font-size: 0.6rem; color: #ef4444; font-weight: 800; margin-top: 0.2rem; white-space: nowrap; }

            /* モバイル専用 隔離レイアウト (Cockpit v2) */
            .mobile-action-hub-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.3);
                backdrop-filter: blur(4px); z-index: 9999;
                display: none; opacity: 0; transition: opacity 0.3s;
            }
            .mobile-action-hub-overlay.show { display: block; opacity: 1; }
            .mobile-action-hub-content {
                position: fixed; top: -100%; left: 0; right: 0; background: white;
                border-radius: 0 0 24px 24px; padding: 1.5rem 1.2rem; z-index: 10000;
                transition: top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .mobile-action-hub-content.show { top: 0; }

            body:has(#shift-admin-container) #fab-main-btn { display: none !important; }

            /* モバイル・ライブ・ヘッダー */
            #admin-mobile-live-header {
                position: sticky; top: 0; background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                border-bottom: 1px solid var(--border); padding: 0.8rem; z-index: 998;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            .live-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
            .live-sph-badge { background: var(--secondary); color: white; padding: 0.3rem 0.6rem; border-radius: 8px; font-size: 0.75rem; font-weight: 800; }
            .live-alert-badge { background: #ef4444; color: white; padding: 0.3rem 0.6rem; border-radius: 8px; font-size: 0.75rem; font-weight: 800; display: none; }
            .btn-memo-quick { width: 40px; height: 40px; background: white; border: 1px solid var(--border); border-radius: 10px; color: #10b981; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            
            .live-graph-area { background: #f8fafc; border-radius: 10px; padding: 0.5rem; }
            .mini-graph-container { display: flex; align-items: flex-end; gap: 2px; height: 36px; padding: 2px 0; }
            .mini-graph-bar { flex: 1; background: #e2e8f0; border-radius: 2px; min-height: 4px; }
            .mini-graph-bar.staffed { background: #fee2e2; }
            .mini-graph-bar.full { background: #ef4444; }

            /* FABハブ (Cockpit v2) */
            #admin-mobile-fab-hub {
                position: fixed; bottom: calc(80px + env(safe-area-inset-bottom));
                right: 20px; display: flex; flex-direction: column; align-items: flex-end; z-index: 10001;
            }
            .admin-fab-overlay {
                position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4);
                backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                opacity: 0; visibility: hidden; transition: all 0.3s ease;
            }
            .admin-fab-overlay.show { opacity: 1; visibility: visible; }
            #admin-fab-main-btn {
                width: 60px; height: 60px; background: linear-gradient(135deg, var(--primary), #FF5A5F);
                border-radius: 50%; display: flex; justify-content: center; align-items: center;
                color: white; font-size: 1.5rem; box-shadow: 0 4px 15px rgba(230, 57, 70, 0.4);
            }
            .bottom-sheet {
                position: fixed; left: 0; right: 0; bottom: 0; background: white;
                border-radius: 24px 24px 0 0; box-shadow: 0 -10px 40px rgba(15, 23, 42, 0.25);
                transform: translateY(100%); transition: transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                z-index: 10002; padding-bottom: env(safe-area-inset-bottom);
            }
            .bottom-sheet.show { transform: translateY(0); }

            /* シフト表のモバイル調整 */
            #shift-admin-table th.date-hdr { min-width: 50px !important; font-size: 0.7rem !important; }
            #shift-admin-table td.shift-cell { height: 60px !important; }
            .staff-cell { min-width: 100px !important; font-size: 0.85rem !important; }
        }
        `;
    document.head.appendChild(s);
};

/**
 * --- Initialization ---
 */
async function fetchCalendarData(sid) {
    if (!sid) return;
    calendarData = {};
    const startDate = currentSlot.startDate;
    const endDate = currentSlot.endDate;
    
    // 祝前日判定や月間目標の按分計算（1日〜末日）を正確に行うため、
    // 表示期間が含まれる月の「月初1日」から「翌月1日」までを網羅して取得する
    const fetchStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const fetchEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1);

    const months = [];
    let curr = new Date(fetchStart);
    while (curr <= fetchEnd) {
        months.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`);
        curr.setMonth(curr.getMonth() + 1);
    }

    try {
        for (const ym of months) {
            // 共通設定
            const commonSnap = await getDoc(doc(db, "m_calendars", `${ym}_common`));
            if (commonSnap.exists()) {
                const data = commonSnap.data();
                data.days?.forEach(d => {
                    const ymd = `${ym}-${String(d.day).padStart(2, '0')}`;
                    calendarData[ymd] = {
                        type: d.type || 'work',
                        is_holiday: d.is_holiday || false,
                        label: d.label || ""
                    };
                });
            }
            // 店舗個別設定 (店休日で上書き)
            const storeSnap = await getDoc(doc(db, "m_calendars", `${ym}_${sid}`));
            if (storeSnap.exists()) {
                const data = storeSnap.data();
                data.days?.forEach(d => {
                    const ymd = `${ym}-${String(d.day).padStart(2, '0')}`;
                    if (!calendarData[ymd]) {
                        calendarData[ymd] = { type: d.type, is_holiday: false, label: "" };
                    } else {
                        calendarData[ymd].type = d.type;
                        if (d.label) calendarData[ymd].label = d.label;
                    }
                });
            }
        }
    } catch (e) {
        console.error("Calendar fetch error:", e);
    }
}

export async function initShiftSubmissionPage() {
    console.log("Initializing Shift Submission Page...");
    injectStyles();
    adminMode = false;
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    currentTargetUser = user;
    calculateSlot();
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = `シフト希望提出 (${currentSlot.year}/${currentSlot.month} ${currentSlot.slot === 1 ? '前半' : '後半'})`;
    
    document.getElementById('shift-deadline-info').textContent = `提出締切: ${currentSlot.deadLine}`;
    
    const sid = user.StoreID || user.StoreId || 'UNKNOWN';
    await fetchCalendarData(sid);
    await loadShiftMemoForStaff(sid);
    await renderSubmissionGrid();
    setupSubmissionEvents();
    await loadShiftsBatch(null, user.id);

    // 一括入力ボタン (スタッフ用)
    const bulkBtnStaff = document.getElementById('btn-bulk-mode-staff');
    const bulkBtnMobile = document.getElementById('btn-bulk-mode-staff-mobile');
    const bulkAction = () => {
        if (!isBulkMode) {
            isBulkMode = true;
            selectedCells = [];
            
            // デスクトップUI更新
            if(bulkBtnStaff) {
                bulkBtnStaff.innerHTML = '<i class="fas fa-save"></i> 選択完了・設定';
                bulkBtnStaff.classList.add('btn-primary');
                bulkBtnStaff.classList.remove('btn-secondary');
            }
            
            // モバイルUI更新
            if(bulkBtnMobile) {
                bulkBtnMobile.innerHTML = '<i class="fas fa-save"></i> 選択完了・設定';
                bulkBtnMobile.style.background = 'var(--primary)';
                bulkBtnMobile.style.color = 'white';
            }

            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'btn-bulk-cancel-staff';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.style = 'font-size:0.85rem;';
            cancelBtn.innerHTML = '<i class="fas fa-times"></i> 解除';
            cancelBtn.onclick = (e) => { e.stopPropagation(); exitBulkMode(); };
            
            if(bulkBtnStaff) bulkBtnStaff.parentNode.insertBefore(cancelBtn, bulkBtnStaff);
            window.toggleMobileActionHub(false);
            updateBulkModeUI();
        } else {
            if (selectedCells.length > 0) openBulkInputModal();
            else exitBulkMode();
        }
    };

    if (bulkBtnStaff) bulkBtnStaff.onclick = bulkAction;
    if (bulkBtnMobile) bulkBtnMobile.onclick = bulkAction;

    // パターン系ボタンのバインド (モバイル)
    const btnApplyTplMobile = document.getElementById('btn-apply-template-mobile');
    if (btnApplyTplMobile) {
        btnApplyTplMobile.onclick = () => {
            window.toggleMobileActionHub(false);
            const btn = document.getElementById('btn-apply-template');
            if(btn) btn.click();
        };
    }
    const btnSaveTplMobile = document.getElementById('btn-save-as-template-mobile');
    if (btnSaveTplMobile) {
        btnSaveTplMobile.onclick = () => {
            window.toggleMobileActionHub(false);
            const btn = document.getElementById('btn-save-as-template');
            if(btn) btn.click();
        };
    }
    const btnSubmitMobile = document.getElementById('btn-submit-shifts-mobile');
    if (btnSubmitMobile) {
        btnSubmitMobile.onclick = () => {
            const btn = document.getElementById('btn-submit-shifts');
            if(btn) btn.click();
        };
    }

    // 一括選択モード用ボタン (モバイル)
    const btnBulkCancelMobile = document.getElementById('btn-mobile-bulk-cancel');
    if (btnBulkCancelMobile) {
        btnBulkCancelMobile.onclick = () => exitBulkMode();
    }
    const btnBulkSetMobile = document.getElementById('btn-mobile-bulk-set');
    if (btnBulkSetMobile) {
        btnBulkSetMobile.onclick = () => {
            if (selectedCells.length > 0) openBulkInputModal();
        };
    }
}

async function loadShiftMemoForStaff(sid) {
    if (!sid || sid === 'UNKNOWN') return;
    const memoId = `${sid}_${currentSlot.year}_${currentSlot.month}_${currentSlot.slot}`;
    const snap = await getDoc(doc(db, "t_shift_memos", memoId));
    if (snap.exists() && snap.data().memo) {
        const area = document.getElementById('staff-memo-area');
        const text = document.getElementById('staff-memo-text');
        if (area && text) {
            area.style.display = 'block';
            text.textContent = snap.data().memo;
        }
    }
}

export async function initShiftAdminPage() {
    console.log("Initializing Shift Admin Cockpit...");
    injectStyles();
    adminMode = true; 
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    currentTargetUser = user;
    calculateSlot();

    // --- [最優先] 固定シフト関連ボタンのバインド ---
    // データの読み込み待ち(await)によるボタンの不感化を防ぐため、最初に行います。
    const btnManageFS = document.getElementById('btn-manage-fixed-shift');
    if (btnManageFS) {
        btnManageFS.onclick = () => {
            if(window.renderFixedShiftStaffList) window.renderFixedShiftStaffList();
            if(window.openSideDrawer) window.openSideDrawer();
        };
    }
    const applyBtn = document.getElementById('btn-apply-fixed-schedule');
    if (applyBtn) {
        applyBtn.onclick = () => {
            showConfirm('定例シフトの反映', '設定済みの定例週間シフトを空欄の日付に一括反映します。よろしいですか？', async () => {
                await applyFixedSchedules();
            });
        };
    }

    const isAdmin = user.Role === 'Admin' || user.Role === '管理者';
    const storeSelect = document.getElementById('admin-store-select');
    const storeLabel = document.getElementById('admin-active-store-label');
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = `シフト作成 (${currentSlot.year}/${currentSlot.month} ${currentSlot.slot === 1 ? '前半' : '後半'})`;

    async function updateView(sid) {
        if (!sid) return;
        console.log("Updating Administration View for store ID:", sid);
        try {
            const sSnap = await getDoc(doc(db, "m_stores", sid));
            const storeData = sSnap.exists() ? sSnap.data() : null;
            const storeName = storeData ? storeData.store_name : sid;
            
            if(storeLabel) storeLabel.textContent = storeName;
            window.currentAdminStoreId = sid;
            window.currentAdminStoreName = storeName;
            
            await loadDailyGoalData(sid);
            await loadStoreStaff(sid, storeName);
            
            await Promise.all([
                loadShiftsBatch(sid),
                loadShiftMemo(sid)
            ]);
            
            // シフト描画の完了（ヘルプスタッフの特定）を待ってからKPI/アラート計算を行う
            await renderAdminGrid(); 
            updateOverallKPIs();
        } catch (e) {
            console.error("Critical error in updateView:", e);
            showAlert('エラー', 'データの読み込み中にエラーが発生しました。詳細はコンソールを確認してください。');
        }
    }

    if (isAdmin) {
        if(storeSelect) {
            storeSelect.style.display = 'block';
            if(storeLabel) storeLabel.style.display = 'none';
            const sSnap = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
            storeSelect.innerHTML = '<option value="">店舗を選択してください</option>';
            sSnap.forEach(d => {
                const data = d.data();
                const opt = document.createElement('option');
                opt.value = data.store_id || d.id;
                opt.textContent = data.store_name || d.id;
                storeSelect.appendChild(opt);
            });
            const mySid = user.StoreID || user.StoreId;
            if (mySid) {
                storeSelect.value = mySid;
                await fetchCalendarData(mySid);
                await updateView(mySid);
            }
            storeSelect.onchange = async (e) => {
                if (e.target.value) {
                    await fetchCalendarData(e.target.value);
                    updateView(e.target.value);
                }
            };
        }
    } else {
        const sid = user.StoreID || user.StoreId || 'UNKNOWN';
        await updateView(sid);
    }

    document.getElementById('btn-add-help-staff').onclick = openHelpStaffModal;
    const btnPublish = document.getElementById('btn-publish-shifts');
    if (btnPublish) btnPublish.onclick = publishShifts;

    const btnShareLine = document.getElementById('btn-share-line');
    if (btnShareLine) {
        btnShareLine.onclick = async () => {
            const me = JSON.parse(localStorage.getItem('currentUser'));
            if (!me) { showAlert('エラー', 'セッションがありません'); return; }
            const sid = window.currentAdminStoreId || me.StoreID || me.StoreId;
            const sName = window.currentAdminStoreName || '管理店舗';
            shareShiftToLine(sid, sName);
        };
    }
    document.getElementById('btn-save-memo').onclick = saveShiftMemo;

    // --- 【スマホ専用】機能・イベントのバインド ---
    const mobileStoreLabel = document.getElementById('admin-active-store-mobile');
    if (mobileStoreLabel) {
        // 現在の店舗を表示（Adminの場合は選択後に更新される）
        const updateMobileLabel = () => {
            const sid = window.currentAdminStoreId;
            const sname = window.currentAdminStoreName || sid;
            mobileStoreLabel.textContent = sname ? `📍 ${sname}` : "";
        };
        updateMobileLabel();
        
        // 店舗切替時の連動
        if (isAdmin && storeSelect) {
            const originalOnChange = storeSelect.onchange;
            storeSelect.onchange = async (e) => {
                await originalOnChange(e);
                updateMobileLabel();
            };
        }
    }

    // メモ編集ボタン (📝)
    const btnEditMemoMobile = document.getElementById('btn-edit-memo-mobile');
    if (btnEditMemoMobile) {
        btnEditMemoMobile.onclick = () => {
            const memoEl = document.getElementById('admin-shift-memo');
            const currentMemo = memoEl ? memoEl.value : "";
            
            // シンプルな入力プロンプトを表示 (将来的にはリッチなモーダルに変更も可能)
            const newMemo = prompt("【店長メモ・周知事項】を編集", currentMemo);
            if (newMemo !== null) {
                if (memoEl) {
                    memoEl.value = newMemo;
                    saveShiftMemo(); // Firestoreへの保存処理を呼び出し
                }
            }
        };
    }

    // モバイル下部FABのボタン連動
    const bindMobileBtn = (mobileId, desktopId) => {
        const mBtn = document.getElementById(mobileId);
        const dBtn = document.getElementById(desktopId);
        if (mBtn && dBtn) {
            mBtn.onclick = () => {
                window.toggleAdminFabHub(false); // メニューを閉じてから実行
                dBtn.click();
            };
        }
    };
    bindMobileBtn('btn-bulk-mode-mobile', 'btn-bulk-mode');
    bindMobileBtn('btn-apply-fixed-mobile', 'btn-apply-fixed-schedule');
    bindMobileBtn('btn-manage-fixed-mobile', 'btn-manage-fixed-shift');
    bindMobileBtn('btn-add-help-mobile', 'btn-add-help-staff');
    bindMobileBtn('btn-share-line-mobile', 'btn-share-line');
    bindMobileBtn('btn-publish-mobile', 'btn-publish-shifts');

    // オーバーレイクリックで閉じる
    document.getElementById('admin-fab-overlay')?.addEventListener('click', () => {
        window.toggleAdminFabHub(false);
    });

    // 一括入力ボタン
    const bulkBtn = document.getElementById('btn-bulk-mode');
    if (bulkBtn) {
        bulkBtn.onclick = () => {
            if (!isBulkMode) {
                isBulkMode = true;
                selectedCells = [];
                bulkBtn.innerHTML = '<i class="fas fa-save"></i> 選択完了・設定';
                bulkBtn.classList.add('btn-primary');
                bulkBtn.classList.remove('btn-secondary');
                // キャンセル用ボタンを一時的に生成
                const cancelBtn = document.createElement('button');
                cancelBtn.id = 'btn-bulk-cancel';
                cancelBtn.className = 'btn btn-secondary';
                cancelBtn.style = 'font-size:0.85rem;';
                cancelBtn.innerHTML = '<i class="fas fa-times"></i> 解除';
                cancelBtn.onclick = (e) => { e.stopPropagation(); exitBulkMode(); };
                bulkBtn.parentNode.insertBefore(cancelBtn, bulkBtn);

                const cont = document.getElementById('shift-admin-container') || document.getElementById('shift-submission-container');
                if (cont) cont.classList.add('bulk-mode-active');
            } else {
                if (selectedCells.length > 0) openBulkInputModal();
                else exitBulkMode();
            }
        };
    }
}

function exitBulkMode() {
    isBulkMode = false;
    selectedCells = [];
    const bulkBtn = document.getElementById('btn-bulk-mode') || document.getElementById('btn-bulk-mode-staff');
    if (bulkBtn) {
        bulkBtn.innerHTML = '<i class="fas fa-check-double"></i> 一括入力';
        bulkBtn.classList.remove('btn-primary');
        bulkBtn.classList.add('btn-secondary');
    }
    // キャンセルボタンを削除
    const cancelBtn = document.getElementById('btn-bulk-cancel') || document.getElementById('btn-bulk-cancel-staff');
    if (cancelBtn) cancelBtn.remove();

    const cont = document.getElementById('shift-admin-container') || document.getElementById('shift-submission-container');
    if (cont) cont.classList.remove('bulk-mode-active');
    document.querySelectorAll('.selected-shift-cell').forEach(el => el.classList.remove('selected-shift-cell'));
    document.querySelectorAll('.selected-shift-card').forEach(el => el.classList.remove('selected-shift-card'));
    
    // モバイルUIのリセット
    updateBulkModeUI();
}

function openBulkInputModal() {
    initModalTimeOptions();
    const first = selectedCells[0];
    const prev = currentShifts[first.uid]?.[first.date] || {};
    document.getElementById('modal-date-title').textContent = `一括設定 (${selectedCells.length}件)`;
    
    setTimeSelects('modal-start', prev.start || '17:00');
    setTimeSelects('modal-end', prev.end || '23:00');
    document.getElementById('modal-break').value = prev.breakMin || 0;
    document.getElementById('modal-note').value = prev.note || '';
    document.getElementById('shift-input-modal').style.display = 'flex';
    
    const saveBtn = document.getElementById('btn-modal-save');
    const clearBtn = document.getElementById('btn-modal-clear');
    if (clearBtn) clearBtn.style.display = 'none'; // 一括の時は削除ボタンは一旦隠す（または一括削除として機能させるかが検討事項）

    saveBtn.onclick = async () => {
        await saveShiftsBulk();
    };
}

function initModalTimeOptions() {
    const hSelects = [document.getElementById('modal-start-h'), document.getElementById('modal-end-h')];
    hSelects.forEach(sel => {
        if (sel && sel.options.length === 0) {
            const hourOrder = [];
            for (let i = 16; i <= 28; i++) hourOrder.push(i.toString().padStart(2, '0'));
            for (let i = 6; i <= 15; i++) hourOrder.push(i.toString().padStart(2, '0'));
            
            hourOrder.forEach(val => {
                const opt = `<option value="${val}">${val}</option>`;
                sel.innerHTML += opt;
            });
        }
    });
}

function setTimeSelects(prefix, val) {
    if (!val) {
        const hEl = document.getElementById(`${prefix}-h`);
        const mEl = document.getElementById(`${prefix}-m`);
        if (hEl) hEl.value = '17';
        if (mEl) mEl.value = '00';
        return;
    }
    const [h, m] = val.split(':');
    const hEl = document.getElementById(`${prefix}-h`);
    const mEl = document.getElementById(`${prefix}-m`);
    if (hEl) hEl.value = h.padStart(2, '0');
    if (mEl) mEl.value = m.padStart(2, '0');
}

async function saveShiftsBulk() {
    const sH = document.getElementById('modal-start-h').value;
    const sM = document.getElementById('modal-start-m').value;
    const eH = document.getElementById('modal-end-h').value;
    const eM = document.getElementById('modal-end-m').value;
    
    const start = `${sH}:${sM}`;
    const end = `${eH}:${eM}`;
    const brk = parseInt(document.getElementById('modal-break').value) || 0;
    const note = document.getElementById('modal-note').value;
    if (start === end) return showAlert('警告', '開始時間と終了時間が同じです。');
    const loader = showLoader();
    try {
        const batch = [];
        for (const cell of selectedCells) {
            const user = allStoreUsers.find(x => x.id === cell.uid) || 
                         helpUsers.find(x => x.id === cell.uid) || 
                         (cell.uid === currentTargetUser?.id ? currentTargetUser : null);
            if (!user) continue;
            
            const me = JSON.parse(localStorage.getItem('currentUser'));
            const sid = window.currentAdminStoreId || me.StoreID || me.StoreId;
            const sName = window.currentAdminStoreName || me.Store || '所属店舗';

            const shiftData = {
                userId: cell.uid, userName: user.Name, date: cell.date,
                start, end, breakMin: brk, note, 
                status: adminMode ? 'confirmed' : 'applied',
                storeId: String(sid),
                StoreID: String(sid),
                storeName: sName,
                StoreName: sName,
                updatedAt: new Date().toISOString()
            };
            batch.push(setDoc(doc(db, "t_shifts", `${cell.date}_${cell.uid}`), shiftData));
            if (!currentShifts[cell.uid]) currentShifts[cell.uid] = {};
            currentShifts[cell.uid][cell.date] = shiftData;
        }
        await Promise.all(batch);
        selectedCells.forEach(cell => renderCellUI(cell.uid, cell.date, currentShifts[cell.uid][cell.date]));
        document.getElementById('shift-input-modal').style.display = 'none';
        exitBulkMode();
        showAlert('成功', `${batch.length}件のシフトを一括設定しました。`);
    } catch (e) { console.error(e); showAlert('エラー', '一括保存に失敗しました。'); }
    finally { if(loader) loader.remove(); }
}

async function loadShiftMemo(sid) {
    if (!sid) return;
    const memoId = `${sid}_${currentSlot.year}_${currentSlot.month}_${currentSlot.slot}`;
    const snap = await getDoc(doc(db, "t_shift_memos", memoId));
    const memoText = snap.exists() ? snap.data().memo : "";
    const el = document.getElementById('admin-shift-memo');
    if (el) el.value = memoText;
}

async function saveShiftMemo() {
    const me = JSON.parse(localStorage.getItem('currentUser'));
    const sid = window.currentAdminStoreId || me.StoreID || me.StoreId;
    if (!sid) return;
    
    const el = document.getElementById('admin-shift-memo');
    const memo = el ? el.value : "";
    const memoId = `${sid}_${currentSlot.year}_${currentSlot.month}_${currentSlot.slot}`;
    
    const btn = document.getElementById('btn-save-memo');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        await setDoc(doc(db, "t_shift_memos", memoId), {
            memo,
            updatedAt: new Date().toISOString(),
            updatedBy: me.Name
        });
        showAlert('成功', '店長メモを保存しました。');
    } catch (e) {
        console.error(e);
        showAlert('エラー', 'メモの保存に失敗しました。');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> 保存';
    }
}

/**
 * --- Data Loading & Rendering ---
 */
async function loadStoreStaff(sid, sname) {
    if (!sid || sid === 'UNKNOWN') return;
    allStoreUsers = [];
    try {
        const q1 = query(collection(db, "m_users"), where("StoreID", "==", sid));
        const q2 = query(collection(db, "m_users"), where("StoreId", "==", sid));
        const q3 = query(collection(db, "m_users"), where("Store", "==", sname));
        
        const snaps = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
        const userMap = new Map();
        snaps.forEach(s => s.forEach(d => userMap.set(d.id, { id: d.id, ...d.data() })));
        allStoreUsers = Array.from(userMap.values()).filter(u => u.Role !== 'Tablet' && u.Role !== '店舗タブレット');
    } catch (e) { console.error("Error loading store staff:", e); }
}

async function loadShiftsBatch(sid, uid = null) {
    const range = getExtendedRange(currentSlot.startDate, currentSlot.endDate);
    const s = range.start;
    const e = range.end;
    
    let q = query(collection(db, "t_shifts"), where("date", ">=", s), where("date", "<=", e));
    const snap = await getDocs(q);
    
    currentShifts = {};
    globalShiftMap = {}; 
    if (sid) helpUsers = [];
    const helpIds = [];
    snap.forEach(d => {
        const data = d.data();
        if (!data || !data.userId) return;

        // --- 同一店舗内での分割シフト合算のため、フィルタ前にマップへ蓄積 ---
        if (!globalShiftMap[data.userId]) globalShiftMap[data.userId] = {};
        if (!globalShiftMap[data.userId][data.date]) globalShiftMap[data.userId][data.date] = [];
        globalShiftMap[data.userId][data.date].push(data);

        // --- 店舗フィルタ (ここから下は自店舗データのみ対象) ---
        if (sid && data.storeId != sid) return;
        if (uid && data.userId !== uid) return;

        if (!currentShifts[data.userId]) currentShifts[data.userId] = {};
        currentShifts[data.userId][data.date] = data;

        if (sid && !allStoreUsers.some(u => u.id === data.userId) && !helpUsers.some(u => u.id === data.userId)) {
            if (!helpIds.includes(data.userId)) helpIds.push(data.userId);
            helpUsers.push({ id: data.userId, Name: data.userName, isHelp: true });
        }
        
        // 元の表示期間内のセルのみ描画
        if (data.date >= formatDateJST(currentSlot.startDate) && data.date <= formatDateJST(currentSlot.endDate)) {
            renderCellUI(data.userId, data.date, data);
        }
    });

    // ヘルプスタッフの詳細プロフィールを補完
    if (helpIds.length > 0) {
        try {
            const fetchOps = helpIds.map(id => getDoc(doc(db, "m_users", id)));
            const userSnaps = await Promise.all(fetchOps);
            userSnaps.forEach(s => {
                if (s.exists()) {
                    const u = s.data();
                    const target = helpUsers.find(h => h.id === s.id);
                    if (target) {
                        target.DisplayName = u.DisplayName;
                        target.Role = u.Role;
                        target.JobTitle = u.JobTitle;
                        target.Store = u.Store;
                    }
                }
            });
            // プロフィール取得後に再描画が必要な場合（この時点では renderAdminGrid の前なので、ここではデータの更新のみ）
        } catch (e) {
            console.error("Help profiles fetch error:", e);
        }
    }
}

function getExtendedRange(start, end) {
    const s = new Date(start);
    s.setDate(s.getDate() - s.getDay()); 
    const e = new Date(end);
    e.setDate(e.getDate() + (6 - e.getDay()));
    return { 
        start: formatDateJST(s), 
        end: formatDateJST(e) 
    };
}

async function loadDailyGoalData(sid) {
    if (!sid) return;
    dailyGoalSales = {};
    const ym = `${currentSlot.year}-${String(currentSlot.month).padStart(2, '0')}`;
    try {
        const gSnap = await getDoc(doc(db, "t_monthly_goals", `${ym}_${sid}`));
        if (gSnap.exists()) {
            const g = gSnap.data();
            const monthlyTarget = g.sales_target || 0;
            // goals.js と共通のデフォルト値を使用
            const weights = g.weights || { 
                mon_thu: 1.0, fri: 1.2, sat: 1.5, sun: 1.4, holiday: 1.5, day_before_holiday: 1.6 
            };

            // その月の全日数を取得して総ポイントを計算
            const daysInMonth = new Date(currentSlot.year, currentSlot.month, 0).getDate();
            let totalMonthPoints = 0;
            const pointsByDay = {}; // 1〜月末までの各日のポイントを一時保持

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(currentSlot.year, currentSlot.month - 1, d);
                const ymd = formatDateJST(date);
                const cal = calendarData[ymd] || { type: 'work' };

                // 店休日はポイント0
                if (cal.type === 'off') {
                    pointsByDay[ymd] = 0;
                    continue;
                }

                const dow = date.getDay();
                // 祝前日判定
                const nextDate = new Date(currentSlot.year, currentSlot.month - 1, d + 1);
                const nextYmd = formatDateJST(nextDate);
                const nextCal = calendarData[nextYmd] || {};
                const isDayBeforeH = nextCal.is_holiday || false;

                const indices = [];
                // 曜日の基本指数
                if (dow >= 1 && dow <= 4) indices.push(weights.mon_thu);
                else if (dow === 5) indices.push(weights.fri);
                else if (dow === 6) indices.push(weights.sat);
                else if (dow === 0) indices.push(weights.sun);

                // 祝日・祝前日の加算/上書き判定（最高の数値を採用するロジック）
                if (cal.is_holiday) indices.push(weights.holiday);
                if (isDayBeforeH) indices.push(weights.day_before_holiday || 1.0);

                const dayPoint = Math.max(...indices);
                pointsByDay[ymd] = dayPoint;
                totalMonthPoints += dayPoint;
            }

            // 1ポイントあたりの単価
            const unitValue = totalMonthPoints > 0 ? (monthlyTarget / totalMonthPoints) : 0;
            
            // 表示期間（currentSlot）の範囲でdailyGoalSalesを確定
            const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
            for (let i = 0; i < span; i++) {
                const t = new Date(currentSlot.startDate); t.setDate(t.getDate() + i);
                const ymd = formatDateJST(t);
                const dp = pointsByDay[ymd] || 0;
                dailyGoalSales[ymd] = Math.round(unitValue * dp);
            }
        }
    } catch (e) { 
        console.error("Goals load error:", e); 
    }
}

function renderAdminGrid() {
    const body = document.getElementById('admin-table-body');
    const header = document.getElementById('admin-table-header');
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
                <th class="date-hdr ${isHoliday ? 'is-holiday' : ''} ${isOff ? 'is-off' : ''}" onclick="window.showHourlyGraph('${ymd}')">
                    ${d.getDate()}<br>${['日','月','火','水','木','金','土'][d.getDay()]}
                    ${isHoliday ? `<div class="holiday-name">${cal.label || '祝日'}</div>` : ''}
                </th>`;
        }

        // 【スマホ専用】横スクロール同期 (Cockpit v2)
        const scrollArea = document.getElementById('shift-admin-table')?.parentElement;
        if (scrollArea && window.innerWidth <= 1024) {
            scrollArea.onscroll = () => {
                const scrollLeft = scrollArea.scrollLeft;
                const colWidth = 60; // date-hdrの標準幅（要調整）
                const dayIdx = Math.max(0, Math.floor((scrollLeft - 40) / colWidth)); // 40はスタッフ名の固定幅分
                const targetD = new Date(currentSlot.startDate);
                targetD.setDate(targetD.getDate() + dayIdx);
                const ymd = formatDateJST(targetD);
                window.updateMobileLiveHeader(ymd);
            };
        }

        body.innerHTML = '';
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
                tr.innerHTML += `<td class="shift-cell ${isOff ? 'is-off' : ''}" id="cell-${u.id}-${ymd}" onclick="window.openTimeInput('${ymd}', '${u.id}')"></td>`;
            }
            body.appendChild(tr);
            for(let i=0; i<span; i++){
                const d = new Date(currentSlot.startDate); d.setDate(d.getDate()+i);
                const ymd = formatDateJST(d);
                if(currentShifts[u.id]?.[ymd]) renderCellUI(u.id, ymd, currentShifts[u.id][ymd]);
            }
        });
    } catch (e) { console.error("Error in renderAdminGrid:", e); }
}

async function renderSubmissionGrid() {
    const header = document.getElementById('shift-table-header');
    const body = document.getElementById('shift-table-body');
    const mobileContainer = document.getElementById('shift-mobile-list-container');
    const deadlineMobile = document.getElementById('shift-deadline-info-mobile');
    const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // 締切日の表示 (モバイル)
    if (deadlineMobile) deadlineMobile.textContent = `提出締切: ${currentSlot.deadLine}`;

    // デスクトップ用テーブルヘッダー
    header.innerHTML = '<th class="staff-cell">スタッフ</th>';
    for (let i = 0; i < span; i++) {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = formatDateJST(d);
        const cal = calendarData[ymd] || {};
        const isHoliday = cal.is_holiday;
        const isOff = cal.type === 'off';

        header.innerHTML += `
            <th class="date-hdr ${isHoliday ? 'is-holiday' : ''} ${isOff ? 'is-off' : ''}">
                ${d.getDate()}<br>${['日','月','火','水','木','金','土'][d.getDay()]}
                ${isHoliday ? `<div class="holiday-name">${cal.label || '祝日'}</div>` : ''}
            </th>`;
    }

    const roleMap = { 'Manager': '店長', 'Admin': '管理者', 'Staff': '一般社員', 'PartTimer': 'アルバイト' };
    const roleName = roleMap[currentTargetUser.Role] || currentTargetUser.Role || '';
    const displayRole = currentTargetUser.JobTitle || roleName;

    // デスクトップ用テーブルボディ
    body.innerHTML = `<tr><td class="staff-cell">
        <div style="display:flex; flex-direction:column; justify-content:center; text-align:left; line-height:1.2;">
            <span style="font-weight:700;">${currentTargetUser.DisplayName || currentTargetUser.Name}</span>
            ${displayRole ? `<div style="font-size:0.6rem; color:var(--text-secondary); font-weight:500; margin-top:0.1rem;">${displayRole}</div>` : ''}
        </div>
    </td>${Array.from({length: span}).map((_, i) => {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = formatDateJST(d);
        const cal = calendarData[ymd] || {};
        const isOff = cal.type === 'off';
        return `<td class="shift-cell ${isOff ? 'is-off' : ''}" id="cell-${currentTargetUser.id}-${ymd}" onclick="window.openTimeInput('${ymd}', '${currentTargetUser.id}')"></td>`;
    }).join('')}</tr>`;

    // モバイル用縦リストの描画
    if (mobileContainer) {
        let mobileHtml = '';
        for (let i = 0; i < span; i++) {
            const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
            const ymd = formatDateJST(d);
            const cal = calendarData[ymd] || {};
            const isHoliday = cal.is_holiday;
            const isSat = d.getDay() === 6;
            const isSun = d.getDay() === 0;
            const weekday = ['日','月','火','水','木','金','土'][d.getDay()];
            
            mobileHtml += `
                <div class="mobile-shift-card" id="card-mobile-${currentTargetUser.id}-${ymd}" onclick="window.openTimeInput('${ymd}', '${currentTargetUser.id}')">
                    <div class="mobile-date-box ${isHoliday || isSun ? 'is-holiday' : ''} ${isSat ? 'is-sat' : ''}">
                        <div class="day">${d.getDate()}</div>
                        <div class="weekday">${weekday}</div>
                        ${isHoliday ? `<div class="mobile-holiday-label">${cal.label || '祝日'}</div>` : ''}
                    </div>
                    <div class="mobile-shift-content" id="cell-mobile-${currentTargetUser.id}-${ymd}">
                        <div class="mobile-shift-empty">タップして入力</div>
                    </div>
                    <div><i class="fas fa-chevron-right" style="color:#cbd5e1; font-size:0.8rem;"></i></div>
                </div>
            `;
        }
        mobileContainer.innerHTML = mobileHtml;
    }

    // 既存シフトの描画
    for (let i = 0; i < span; i++) {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = formatDateJST(d);
        if (currentShifts[currentTargetUser.id]?.[ymd]) {
            renderCellUI(currentTargetUser.id, ymd, currentShifts[currentTargetUser.id][ymd]);
        }
    }
}

function renderCellUI(uid, date, data) {
    const cell = document.getElementById(`cell-${uid}-${date}`);
    const mobileCell = document.getElementById(`cell-mobile-${uid}-${date}`);
    
    const isConfirmed = data?.status === 'confirmed';
    const stampHtml = isConfirmed ? `<div class="official-stamp"><i class="fas fa-check-circle"></i></div>` : '';
    
    // デスクトップ用UI更新
    if (cell) {
        if (!data || !data.start) {
            cell.innerHTML = '';
        } else {
            cell.innerHTML = `
                <div class="shift-box ${isConfirmed ? '' : 'applied'}">
                    ${stampHtml}
                    <div>${data.start}-${data.end}</div>
                </div>
            `;
        }
    }

    // モバイル用UI更新
    if (mobileCell) {
        if (!data || !data.start) {
            mobileCell.innerHTML = '<div class="mobile-shift-empty">タップして入力</div>';
        } else {
            mobileCell.innerHTML = `
                <div class="mobile-shift-time">
                    <i class="fas fa-clock" style="font-size:0.8rem; margin-right:0.3rem;"></i>${data.start} - ${data.end}
                </div>
                <div class="mobile-shift-status">
                    <span style="color: ${isConfirmed ? '#059669' : '#D97706'}; background: ${isConfirmed ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'}; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.65rem;">
                        ${isConfirmed ? '確定済み' : '提出中'}
                    </span>
                </div>
            `;
        }
    }
}

/**
 * --- Actions ---
 */
/**
 * 管理者用モバイルFABハブのトグル制御
 */
/**
 * 【スマホ専用】ライブヘッダーの描画同期 (Cockpit v2)
 */
window.updateMobileLiveHeader = (ymd) => {
    const liveHeader = document.getElementById('admin-mobile-live-header');
    if (!liveHeader || window.innerWidth > 1024) return;

    // 日付ラベルの更新
    const dateLabel = document.getElementById('live-header-date');
    if (dateLabel) {
        const d = new Date(ymd);
        const dow = ['日','月','火','水','木','金','土'][d.getDay()];
        dateLabel.textContent = `${ymd.replace(/-/g,'/')} (${dow})`;
    }

    // SPHの計算 (その日限定)
    let dayHours = 0;
    const users = [...allStoreUsers, ...helpUsers];
    users.forEach(u => {
        // 現在編集中の仮データ（シート内）があればそれを優先
        let s = currentShifts[u.id]?.[ymd];
        const sheet = document.getElementById('admin-mobile-bottom-sheet');
        if (sheet && sheet.classList.contains('show') && window.currentEditingUid === u.id && window.currentEditingDate === ymd) {
            s = {
                start: `${document.getElementById('sheet-start-h').value}:${document.getElementById('sheet-start-m').value}`,
                end: `${document.getElementById('sheet-end-h').value}:${document.getElementById('sheet-end-m').value}`,
                breakMin: parseInt(document.getElementById('sheet-break').value) || 0
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

    // グラフの更新 (1h単位の簡易版)
    const graphCont = document.getElementById('live-hourly-graph-mobile');
    if (graphCont) {
        graphCont.innerHTML = '';
        const hourly = new Array(24).fill(0);
        users.forEach(u => {
            let s = currentShifts[u.id]?.[ymd];
            if (window.currentEditingUid === u.id && window.currentEditingDate === ymd) {
                s = {
                    start: `${document.getElementById('sheet-start-h').value}:${document.getElementById('sheet-start-m').value}`,
                    end: `${document.getElementById('sheet-end-h').value}:${document.getElementById('sheet-end-m').value}`,
                };
            }
            if (!s || !s.start || !s.end) return;
            const sH = parseInt(s.start.split(':')[0]), eH = parseInt(s.end.split(':')[0]);
            for(let h=0; h<24; h++) {
                let active = false;
                if (sH <= eH) { if (h >= sH && h < eH) active = true; }
                else { if (h >= sH || h < eH) active = true; }
                if (active) hourly[h]++;
            }
        });

        const maxStaff = Math.max(5, ...hourly);
        hourly.forEach((count, h) => {
            if (h < 10) return; // 10時以前は表示省略
            const bar = document.createElement('div');
            bar.className = 'mini-graph-bar' + (count > 0 ? ' staffed' : '') + (count >= 4 ? ' full' : '');
            bar.style.height = `${(count / maxStaff) * 100}%`;
            graphCont.appendChild(bar);
        });
    }
};

window.toggleAdminFabHub = (forceState) => {
    const menu = document.getElementById('admin-fab-menu');
    const mainBtn = document.getElementById('admin-fab-main-btn');
    const overlay = document.getElementById('admin-fab-overlay');
    if (!menu || !mainBtn || !overlay) return;

    const isShow = forceState !== undefined ? forceState : !menu.classList.contains('show');

    if (isShow) {
        menu.classList.add('show');
        mainBtn.classList.add('active');
        overlay.classList.add('show');
    } else {
        menu.classList.remove('show');
        mainBtn.classList.remove('active');
        overlay.classList.remove('show');
    }
};

window.toggleMobileActionHub = (show) => {
    const overlay = document.getElementById('mobile-action-hub-overlay');
    const content = document.querySelector('.mobile-action-hub-content');
    if (!overlay || !content) return;
    if (show) {
        overlay.classList.add('show');
        setTimeout(() => content.classList.add('show'), 10);
    } else {
        content.classList.remove('show');
        setTimeout(() => overlay.classList.remove('show'), 300);
    }
};

window.openTimeInput = async (date, uid) => {
    const isMobile = window.innerWidth <= 1024;
    window.currentEditingUid = uid;
    window.currentEditingDate = date;

    if (isBulkMode) {
        const cellId = `cell-${uid}-${date}`;
        const cardMobileId = `card-mobile-${uid}-${date}`;
        const el = document.getElementById(cellId);
        const cardEl = document.getElementById(cardMobileId);
        
        const idx = selectedCells.findIndex(x => x.uid === uid && x.date === date);
        if (idx > -1) {
            selectedCells.splice(idx, 1);
            if (el) el.classList.remove('selected-shift-cell');
            if (cardEl) cardEl.classList.remove('selected-shift-card');
        } else {
            selectedCells.push({ uid, date });
            if (el) el.classList.add('selected-shift-cell');
            if (cardEl) cardEl.classList.add('selected-shift-card');
        }
        
        // モバイルUIの更新
        updateBulkModeUI();

        const bulkBtn = document.getElementById('btn-bulk-mode') || document.getElementById('btn-bulk-mode-staff');
        if (bulkBtn) bulkBtn.innerHTML = `<i class="fas fa-save"></i> 選択完了 (${selectedCells.length}件)`;
        return;
    }

    const user = [...allStoreUsers, ...helpUsers].find(u => u.id === uid) || (uid === currentTargetUser?.id ? currentTargetUser : null);
    if (!user) return;
    
    const sData = currentShifts[uid]?.[date] || { start: '17:00', end: '22:00', breakMin: 0, note: '' };

    if (isMobile && document.getElementById('admin-table-body')) {
        // --- モバイル管理者：ボトムシート起動 ---
        const sheet = document.getElementById('admin-mobile-bottom-sheet');
        if (sheet) {
            document.getElementById('sheet-staff-name').textContent = user.DisplayName || user.Name;
            document.getElementById('sheet-date-label').textContent = date.replace(/-/g, '/');
            
            const [sH, sM] = (sData.start || '17:00').split(':');
            const [eH, eM] = (sData.end || '22:00').split(':');
            
            const sH_el = document.getElementById('sheet-start-h');
            const sM_el = document.getElementById('sheet-start-m');
            const eH_el = document.getElementById('sheet-end-h');
            const eM_el = document.getElementById('sheet-end-m');
            
            sH_el.innerHTML = generateHOptions(sH);
            sM_el.innerHTML = generateMOptions(sM);
            eH_el.innerHTML = generateHOptions(eH);
            eM_el.innerHTML = generateMOptions(eM);
            
            document.getElementById('sheet-break').value = sData.breakMin || 0;
            document.getElementById('sheet-note').value = sData.note || "";

            // ライブフィードバック登録
            [sH_el, sM_el, eH_el, eM_el, document.getElementById('sheet-break')].forEach(el => {
                el.onchange = () => updateMobileLiveHeader(date);
            });

            sheet.classList.add('show');
            updateMobileLiveHeader(date);

            document.getElementById('btn-save-sheet').onclick = async () => {
                const btnSave = document.getElementById('btn-save-sheet');
                btnSave.disabled = true;
                btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                const news = {
                    start: `${sH_el.value}:${sM_el.value}`,
                    end: `${eH_el.value}:${eM_el.value}`,
                    breakMin: parseInt(document.getElementById('sheet-break').value) || 0,
                    note: document.getElementById('sheet-note').value
                };
                const ok = await applyShiftUpdate(uid, date, news);
                if (ok) sheet.classList.remove('show');
                
                btnSave.disabled = false;
                btnSave.innerHTML = '保存する';
            };
            return;
        }
    }

    // --- PC/スタッフ画面: 従来通りのモーダル ---
    if (!adminMode && sData.status === 'confirmed') {
        showAlert('案内', 'すでに確定済みのシフトです。変更できません。');
        return;
    }

    const d = new Date(date);
    document.getElementById('modal-date-title').textContent = `${user.DisplayName || user.Name} (${date})`;
    initModalTimeOptions();
    const clearBtn = document.getElementById('btn-modal-clear');
    if (clearBtn) clearBtn.style.display = 'block';

    setTimeSelects('modal-start', sData.start);
    setTimeSelects('modal-end', sData.end);
    document.getElementById('modal-break').value = sData.breakMin || 0;
    document.getElementById('modal-note').value = sData.note || '';

    // 前回コピーボタンの設定
    const copyBtn = document.getElementById('btn-modal-prev-copy');
    if (copyBtn) {
        const prevD = new Date(d); prevD.setDate(prevD.getDate() - 1);
        const prevYmd = formatDateJST(prevD);
        const prevS = currentShifts[uid]?.[prevYmd];
        if (prevS && prevS.start) {
            copyBtn.style.display = 'block';
            copyBtn.onclick = () => {
                setTimeSelects('modal-start', prevS.start);
                setTimeSelects('modal-end', prevS.end);
                document.getElementById('modal-break').value = prevS.breakMin || 0;
                document.getElementById('modal-note').value = prevS.note || '';
                showAlert('案内', '前日の内容をコピーしました。');
            };
        } else {
            copyBtn.style.display = 'none';
        }
    }

    // ✅ 【バグ修正】保存ボタンのonclickハンドラーを設定（PC/スタッフ画面用）
    // ※ 一括入力モードは openBulkInputModal() 内で別途設定済みのため干渉しない
    const saveBtn = document.getElementById('btn-modal-save');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            await saveShift(uid, date, user.Name || user.DisplayName);
        };
    }

    // ✅ 【バグ修正】削除ボタンのonclickハンドラーを設定（PC/スタッフ画面用）
    if (clearBtn) {
        clearBtn.onclick = async () => {
            if (!currentShifts[uid]?.[date]?.start) {
                document.getElementById('shift-input-modal').style.display = 'none';
                return;
            }
            const ok = await showConfirm('削除確認', 'このシフト希望を削除してもよいですか？');
            if (!ok) return;
            try {
                await deleteDoc(doc(db, 't_shifts', `${date}_${uid}`));
                if (currentShifts[uid]) delete currentShifts[uid][date];
                renderCellUI(uid, date, null);
                document.getElementById('shift-input-modal').style.display = 'none';
            } catch (e) {
                console.error(e);
                showAlert('エラー', '削除に失敗しました。');
            }
        };
    }

    document.getElementById('shift-input-modal').style.display = 'flex';
};

window.closeAdminBottomSheet = () => {
    document.getElementById('admin-mobile-bottom-sheet').classList.remove('show');
    window.currentEditingUid = null;
    window.currentEditingDate = null;
};

async function applyShiftUpdate(uid, date, data) {
    const user = [...allStoreUsers, ...helpUsers].find(u => u.id === uid);
    const me = JSON.parse(localStorage.getItem('currentUser'));
    const adminMode = document.getElementById('admin-table-body') ? true : false;
    const sid = adminMode ? (window.currentAdminStoreId || me.StoreID || me.StoreId) : (me.StoreID || me.StoreId || 'UNKNOWN');
    const sName = adminMode ? (window.currentAdminStoreName || '管理店舗') : (me.Store || '所属店舗');

    const conflict = await checkDoubleBooking(uid, date, data.start, data.end);
    if (conflict) {
        showAlert('⚠ 重複', `【${conflict.storeName}】ですでに確定済みのシフトと重なっています。`);
        return false;
    }

    const news = {
        userId: uid, userName: user.Name, date, 
        start: data.start, end: data.end, 
        breakMin: data.breakMin, note: data.note,
        status: adminMode ? 'confirmed' : 'applied',
        storeId: String(sid),
        StoreID: String(sid),
        storeName: sName,
        StoreName: sName,
        updatedAt: new Date().toISOString(),
        Has28hLimit: !!user.Has28hLimit
    };

    if (!currentShifts[uid]) currentShifts[uid] = {};
    currentShifts[uid][date] = news;
    renderCellUI(uid, date, news);
    
    try {
        await setDoc(doc(db, "t_shifts", `${date}_${uid}`), news);
        updateOverallKPIs();
        return true;
    } catch (e) {
        console.error(e);
        showAlert('エラー', '保存に失敗しました。');
        return false;
    }
}

/**
 * モバイル用の一括選択モードUIを更新する
 */
function updateBulkModeUI() {
    const std = document.getElementById('mobile-standard-actions');
    const bulk = document.getElementById('mobile-bulk-actions');
    const countEl = document.getElementById('mobile-bulk-count');
    
    if (!std || !bulk) return;
    
    if (isBulkMode) {
        std.style.display = 'none';
        bulk.style.display = 'flex';
        if (countEl) countEl.textContent = selectedCells.length;
    } else {
        std.style.display = 'flex';
        bulk.style.display = 'none';
    }
}

async function saveShift(uid, date, userName) {
    const sH = document.getElementById('modal-start-h').value;
    const sM = document.getElementById('modal-start-m').value;
    const eH = document.getElementById('modal-end-h').value;
    const eM = document.getElementById('modal-end-m').value;
    
    const s = `${sH}:${sM}`;
    const e = `${eH}:${eM}`;
    
    if (s === e) return showAlert('エラー', '開始時間と終了時間が同じです');

    const me = JSON.parse(localStorage.getItem('currentUser'));
    const sid = adminMode ? (window.currentAdminStoreId || me.StoreID || me.StoreId) : (me.StoreID || me.StoreId || 'UNKNOWN');
    const sName = adminMode ? (window.currentAdminStoreName || '管理店舗') : (me.Store || '所属店舗');

    const conflict = await checkDoubleBooking(uid, date, s, e);
    if (conflict) return showAlert('⚠ 重複', `【${conflict.storeName}】ですでに確定済みのシフトと重なっています。`);

    const news = {
        userId: uid, userName, date, start: s, end: e,
        breakMin: parseInt(document.getElementById('modal-break').value) || 0,
        note: document.getElementById('modal-note').value,
        status: adminMode ? 'confirmed' : 'applied',
        storeId: sid, storeName: sName, updatedAt: new Date().toISOString(),
        // 28hフラグをデータ自体に焼き付ける（将来的な集計漏れ防止・他店参照用）
        Has28hLimit: !!([...allStoreUsers, ...helpUsers].find(u => u.id === uid)?.Has28hLimit)
    };

    if (!currentShifts[uid]) currentShifts[uid] = {};
    currentShifts[uid][date] = news;
    renderCellUI(uid, date, news);
    document.getElementById('shift-input-modal').style.display = 'none';
    await setDoc(doc(db, "t_shifts", `${date}_${uid}`), news);
    if (adminMode) updateOverallKPIs();
}

window.quickSetTime = (type, val) => {
    const [h, m] = val.split(':');
    const hEl = document.getElementById(`modal-${type}-h`);
    const mEl = document.getElementById(`modal-${type}-m`);
    if (hEl) hEl.value = h.padStart(2, '0');
    if (mEl) mEl.value = m.padStart(2, '0');
};

async function checkDoubleBooking(uid, date, s, e) {
    const q = query(collection(db, "t_shifts"), where("userId", "==", uid), where("date", "==", date), where("status", "==", "confirmed"));
    const snap = await getDocs(q);
    let conflict = null;
    const currentMyStoreID = window.currentAdminStoreId || JSON.parse(localStorage.getItem('currentUser')).StoreID;
    snap.forEach(d => {
        const data = d.data();
        if (String(data.storeId) === String(currentMyStoreID)) return;
        const s1 = parseInt(s.replace(':','')), e1 = parseInt(e.replace(':',''));
        const s2 = parseInt(data.start.replace(':','')), e2 = parseInt(data.end.replace(':',''));
        if (Math.max(s1, s2) < Math.min(e1, e2)) conflict = { storeName: data.storeName || data.storeId };
    });
    return conflict;
}

function updateOverallKPIs() {
    let hours = 0, target = 0;
    const users = [...allStoreUsers, ...helpUsers];
    const startDateStr = formatDateJST(currentSlot.startDate);
    const endDateStr = formatDateJST(currentSlot.endDate);

    // SPH計算 (表示期間内のみ)
    for (const ymd in dailyGoalSales) {
        target += dailyGoalSales[ymd];
        users.forEach(u => {
            const s = currentShifts[u.id]?.[ymd];
            if (s && s.start && s.end) {
                const sA = s.start.split(':').map(Number); const eA = s.end.split(':').map(Number);
                let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60); if (h < 0) h += 24;
                const net = Math.max(0, h - (s.breakMin || 0)/60);
                hours += net;
            }
        });
    }
    const avgSphText = `¥ ${Math.round(hours > 0 ? target/hours : 0).toLocaleString()}`;
    const sphEl = document.getElementById('admin-avg-sph');
    const sphElMobile = document.getElementById('live-header-sph');
    if (sphEl) sphEl.textContent = avgSphText;
    if (sphElMobile && window.innerWidth <= 1024) sphElMobile.textContent = avgSphText;
    
    // モバイル用ライブヘッダーの更新（今日の分）
    if (window.innerWidth <= 1024) {
        const today = formatDateJST(new Date());
        if (typeof updateMobileLiveHeader === 'function') {
            updateMobileLiveHeader(today);
        }
    }
    
    // 28時間制限計算 (週次・店舗横断対応)
    const range = getExtendedRange(currentSlot.startDate, currentSlot.endDate);
    const alertsCont = document.getElementById('admin-28h-alerts');
    const alertsContMobile = document.getElementById('admin-28h-alerts-mobile');
    const violations = [];

    // 高速判定：loadShiftsBatchで取得済みの全店舗データ(globalShiftMap)を活用
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
                checkD.setDate(checkD.getDate() + j);
                const iso = formatDateJST(checkD);
                
                // globalShiftMapから全店舗の勤務を取得 (loadShiftsBatchで同期済み)
                const dayShifts = globalShiftMap[u.id]?.[iso] || [];
                dayShifts.forEach(s => {
                    if (s && s.start && s.end) {
                        const sA = s.start.split(':').map(Number); 
                        const eA = s.end.split(':').map(Number);
                        let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60); if (h < 0) h += 24;
                        weekHours += Math.max(0, h - (Number(s.breakMin || 0))/60);
                    }
                });
            }
            
            if (weekHours > 28) {
                const weekLabel = `${weekStart.getMonth()+1}/${weekStart.getDate()}週`;
                violations.push(`${u.DisplayName || u.Name} (${weekLabel}: ${weekHours.toFixed(1)}h)`);
                break;
            }
            tempDate.setDate(tempDate.getDate() + 7);
        }
    });

    // UI表示の更新
    if (alertsCont) {
        if (violations.length > 0) {
            alertsCont.innerHTML = violations.map(v => `<div style="color:#ef4444;"><i class="fas fa-times-circle"></i> ${v}</div>`).join('');
            if (alertsContMobile) {
                alertsContMobile.textContent = `超過: ${violations.length}名`;
                alertsContMobile.style.display = 'block';
            }
        } else {
            alertsCont.innerHTML = '<span style="color:#10b981;"><i class="fas fa-check-circle"></i> 超過なし</span>';
            if (alertsContMobile) {
                alertsContMobile.style.display = 'none';
            }
        }
    }

    renderAdminFooter();
}

function renderAdminFooter() {
    const foot = document.getElementById('admin-table-foot');
    if (!foot) return;
    foot.innerHTML = '';

    // 1. 人時売上行
    const trSPH = document.createElement('tr');
    trSPH.innerHTML = '<td class="staff-cell">人時売上</td>';
    
    // 2. 売上目標行
    const trGoal = document.createElement('tr');
    trGoal.style.background = '#f8fafc';
    trGoal.innerHTML = '<td class="staff-cell" style="color: var(--text-secondary); font-size: 0.75rem;">売上目標</td>';

    const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
    for (let i = 0; i < span; i++) {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = formatDateJST(d);
        let dayH = 0;
        [...allStoreUsers, ...helpUsers].forEach(u => {
            const s = currentShifts[u.id]?.[ymd];
            if (s && s.start) {
                const sA = s.start.split(':').map(Number); const eA = s.end.split(':').map(Number);
                let h = (eA[0]+eA[1]/60) - (sA[0]+sA[1]/60); if(h<0) h+=24;
                dayH += Math.max(0, h - (s.breakMin||0)/60);
            }
        });
        
        // SPH計算
        const sph = dayH > 0 ? (dailyGoalSales[ymd] / dayH) : 0;
        let cls = 'sph-good'; if(sph < 4000) cls = 'sph-danger'; else if(sph < 5000) cls = 'sph-warn';
        trSPH.innerHTML += `<td><span class="sph-badge ${cls}">¥${Math.round(sph).toLocaleString()}</span></td>`;

        // 目標売上表示
        const goalVal = dailyGoalSales[ymd] || 0;
        trGoal.innerHTML += `<td style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">¥${Math.round(goalVal).toLocaleString()}</td>`;
    }
    foot.appendChild(trSPH);
    foot.appendChild(trGoal);
}

window.showHourlyGraph = (date) => {
    const panel = document.getElementById('hourly-graph-panel');
    const container = document.getElementById('hourly-bars-container');
    const title = document.getElementById('graph-date-title');
    panel.style.display = 'block';
    title.textContent = `${date} 人数グラフ`;
    const counts = new Array(24).fill(0);
    [...allStoreUsers, ...helpUsers].forEach(u => {
        const s = currentShifts[u.id]?.[date];
        if (s && s.start) {
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
};

window.copyShiftForLine = async (date) => {
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
        showAlert('完了', 'LINE用の綺麗なメッセージをコピーしました！');
    } catch (e) {
        console.error(e);
        showAlert('エラー', 'コピーに失敗しました。');
    }
};

async function publishShifts() {
    const btn = document.getElementById('btn-publish-shifts');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';
    }

    console.log("--- publishShifts Start ---");
    try {
        const ok = await showConfirm('一括確定', 'この店舗の全ての未提出希望（グレー表示）を確定（赤表示）させ、公開しますか？');
        if (!ok) {
            console.log("User cancelled confirmation.");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '一括確定・公開';
            }
            return;
        }

        const me = JSON.parse(localStorage.getItem('currentUser'));
        if (!me) throw new Error("ユーザーセッションが見つかりません。再ログインしてください。");

        const sid = String(window.currentAdminStoreId || me.StoreID || me.StoreId || "");
        const sName = window.currentAdminStoreName || '管理店舗';
        if (!sid) throw new Error("管理店舗のIDが特定できません。");

        console.log("Processing store:", sName, "(ID:", sid, ")");

        const batch = writeBatch(db);
        let count = 0;

        for (const uid in currentShifts) {
            const userShifts = currentShifts[uid];
            for (const ymd in userShifts) {
                const s = userShifts[ymd];
                // 確定（confirmed）以外で、時間が入っているものはすべて対象にする
                if (s && s.start && s.status !== 'confirmed') {
                    console.log(`Matching shift: User=${uid}, Date=${ymd}, Status=${s.status}`);
                    s.status = 'confirmed';
                    
                    // データ正規化
                    s.storeId = String(s.storeId || s.StoreID || sid);
                    s.StoreID = s.storeId;
                    s.storeName = s.storeName || s.StoreName || sName;
                    s.updatedAt = new Date().toISOString();

                    batch.set(doc(db, "t_shifts", `${ymd}_${uid}`), s);
                    count++;
                }
            }
        }

        console.log(`Prepared ${count} shifts for commit.`);

        if (count > 0) {
            await batch.commit();
            console.log("Firestore Batch Commit Success.");

            // --- 重要: DBから最新状態を再取得してローカルステートとUIを同期させる ---
            console.log("Re-fetching updated shifts from Firestore...");
            await loadShiftsBatch(sid); 
            console.log("Data sync complete.");

            // --- 通知の生成 (失敗してもシフト確定は成功扱いとする) ---
            try {
                const ymText = `${currentSlot.year}/${currentSlot.month} ${currentSlot.slot === 1 ? '前半' : '後半'}`;
                await setDoc(doc(collection(db, "notifications")), {
                    type: 'shift_published',
                    status: 'pending',
                    store_id: sid,
                    store_name: sName,
                    title: 'シフトが公開されました',
                    message: `${sName} の ${ymText} シフトが確定・公開されました。`,
                    created_at: new Date().toISOString(),
                    created_by_name: me.Name
                });
                console.log("Notification created.");
            } catch (notifErr) {
                console.warn("Notification creation failed:", notifErr);
            }

            showAlert('成功', `${count}件のシフトを確定・公開しました！\nスタッフの画面からも編集できなくなります。`);

            // --- 重要: LINE共有フローの起動 ---
            setTimeout(() => {
                showConfirm('LINE周知', '確定したシフト表を画像にして、スタッフにLINEで共有しますか？', () => {
                    shareShiftToLine(sid, sName);
                });
            }, 1500);
        } else {
            console.log("No applied shifts found.");
            showAlert('案内', '新しく確定が必要な未処理の希望はありませんでした。');
        }

        // 全体描画とKPI更新
        renderAdminGrid();
        updateOverallKPIs();

    } catch (e) {
        console.error("Critical error in publishShifts:", e);
        showAlert('エラー', `一括確定に失敗しました: ${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '一括確定・公開';
        }
        console.log("--- publishShifts End ---");
    }
}

/**
 * --- 周知・共有機能 ---
 */
async function shareShiftToLine(sid, sName) {
    showLoader();
    try {
        console.log("Preparing shift image for sharing...");
        
        // html2canvas の動的読み込み
        if (typeof html2canvas === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const table = document.getElementById('shift-admin-table');
        if (!table) throw new Error("シフト表が見つかりません。");

        // キャプチャ用に一時的にスタイルを調整（スクロールで見切れないようにする）
        const originalStyle = table.style.cssText;
        table.style.width = 'auto'; // 全幅を確保
        table.style.minWidth = '1200px';

        // 画像化の実行 (背景透過設定やスケールを調整)
        const canvas = await html2canvas(table, {
            backgroundColor: '#ffffff',
            scale: 2, // 高解像度
            useCORS: true,
            logging: false,
            allowTaint: true
        });

        // スタイルを元に戻す
        table.style.cssText = originalStyle;

        const dataUrl = canvas.toDataURL("image/png");
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `shift_${sid}_${new Date().getTime()}.png`, { type: "image/png" });

        // 周知テキストの生成
        const ymText = `${currentSlot.year}/${currentSlot.month} ${currentSlot.slot === 1 ? '前半' : '後半'}`;
        const portalUrl = `${window.location.origin}${window.location.pathname}?page=shift_viewer`;
        
        const text = `【シフト確定連絡】
店舗：${sName}
期間：${ymText}

上記のシフトを確定・公開しました！
画像を添付しますので、各自の出勤日を確認してください。

個人別の詳しい時間確認や、スマホカレンダーへの保存はこちらから！
${portalUrl}

※かね将ポータルにログインして「シフト表」アイコンをタップしてください。`;

        // Web Share API による共有
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'シフト表の共有',
                text: text,
                files: [file]
            });
            console.log("Sharing success via Web Share API.");
        } else {
            // PC等のフォールバック: 画像ダウンロードとテキストコピー
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `shift_${ymText.replace(/\//g,'-')}.png`;
            link.click();
            
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                showAlert('案内', 'ご使用の端末では自動共有が利用できなかったため、画像を保存し、メッセージをクリップボードにコピーしました。LINEに貼り付けて送信してください。');
            } else {
                showAlert('案内', '画像を保存しました。LINEに貼り付けて送信してください。');
            }
        }

    } catch (e) {
        console.error("Sharing failed:", e);
        showAlert('エラー', `画像の生成または共有に失敗しました: ${e.message}`);
    } finally {
        const loader = document.getElementById('ui-global-loader');
        if (loader) loader.style.display = 'none';
    }
}

async function openHelpStaffModal() {
    const modal = document.createElement('div');
    modal.className = "modal-overlay";
    modal.style = "display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:10001; align-items:center; justify-content:center;";
    modal.innerHTML = `<div class="glass-panel" style="width:400px; padding:2rem;"><h4>他店スタッフ追加</h4><div id="help-list-cont" style="max-height:300px; overflow-y:auto; margin:1rem 0;"></div><button class="btn btn-secondary" style="width:100%;">閉じる</button></div>`;
    document.body.appendChild(modal);
    const cont = modal.querySelector('#help-list-cont');
    const snap = await getDocs(collection(db, "m_users"));
    snap.forEach(d => {
        const u = d.data(); if(u.Role === 'Tablet' || allStoreUsers.some(x=>x.id===d.id)) return;
        const item = document.createElement('div');
        item.style = "padding:0.8rem; border-bottom:1px solid #eee; cursor:pointer;";
        item.innerHTML = `${u.Name} (${u.Store || '他'})`;
        item.onclick = () => { 
            helpUsers.push({
                id: d.id, 
                Name: u.Name, 
                DisplayName: u.DisplayName, 
                Role: u.Role, 
                JobTitle: u.JobTitle, 
                Store: u.Store,
                isHelp: true
            }); 
            renderAdminGrid(); 
            document.body.removeChild(modal); 
        };
        cont.appendChild(item);
    });
    modal.querySelector('button').onclick = () => document.body.removeChild(modal);
}

function setupSubmissionEvents() {
    const btnSubmit = document.getElementById('btn-submit-shifts');
    if (btnSubmit) {
        btnSubmit.onclick = async () => {
            const ok = await showConfirm('シフト提出', '表示されている全ての希望（グレーの枠）を反映させて提出しますか？');
            if (!ok) return;

            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

            try {
                const batch = writeBatch(db);
                const myShifts = currentShifts[currentTargetUser.id] || {};
                let count = 0;
                for (const ymd in myShifts) {
                    const s = myShifts[ymd];
                    // 既に確定済みのものはスキップ、未提出(applied)のものだけを対象に
                    if (s.status === 'applied') {
                        batch.set(doc(db, "t_shifts", `${ymd}_${currentTargetUser.id}`), s);
                        count++;
                    }
                }
                if (count > 0) {
                    await batch.commit();
                    showAlert('成功', `${count}日分のシフト希望を提出しました！店長が確定するまでお待ちください。`);
                } else {
                    showAlert('案内', '新しく提出するシフトデータがありません。既に提出済みか、入力されていません。');
                }
            } catch (e) {
                console.error(e);
                showAlert('エラー', '提出中にエラーが発生しました。');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '提出する';
            }
        };
    }

    document.getElementById('btn-apply-template').onclick = async () => {
        const snap = await getDoc(doc(db, "m_shift_templates", currentTargetUser.id));
        if(!snap.exists()) return showAlert('案内', '先に基本型を保存してください');
        const temp = snap.data().patterns;
        const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
        for(let i=0; i<span; i++){
            const d = new Date(currentSlot.startDate); d.setDate(d.getDate()+i);
            const ymd = formatDateJST(d);
            const dow = d.getDay();
            if(temp[dow]) {
                const sid = currentTargetUser.StoreID || currentTargetUser.StoreId || 'UNKNOWN';
                const sName = currentTargetUser.Store || '所属店舗';
                const s = { 
                    userId: currentTargetUser.id, 
                    userName: currentTargetUser.Name, 
                    date: ymd, 
                    start: temp[dow].start, 
                    end: temp[dow].end, 
                    status: 'applied', 
                    storeId: String(sid),
                    StoreID: String(sid),
                    storeName: sName,
                    StoreName: sName
                };
                if(!currentShifts[currentTargetUser.id]) currentShifts[currentTargetUser.id] = {};
                currentShifts[currentTargetUser.id][ymd] = s;
                renderCellUI(currentTargetUser.id, ymd, s);
                await setDoc(doc(db, "t_shifts", `${ymd}_${currentTargetUser.id}`), s);
            }
        }
        showAlert('成功', '適用しました');
    };
    document.getElementById('btn-save-as-template').onclick = async () => {
        const patterns = {};
        for(const ymd in currentShifts[currentTargetUser.id]){
            const s = currentShifts[currentTargetUser.id][ymd];
            patterns[new Date(ymd).getDay()] = { start: s.start, end: s.end };
        }
        await setDoc(doc(db, "m_shift_templates", currentTargetUser.id), { patterns });
        showAlert('成功', '保存しました');
    };
}

/**
 * --- Fixed Shift Management (Drawer Version) ---
 */

window.renderFixedShiftStaffList = function() {
    const body = document.getElementById('fixed-shift-drawer-body');
    if (!body) return;
    body.innerHTML = `
        <div style="margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.85rem; padding: 1rem; background: #f8fafc; border-radius: 12px; border: 1px solid var(--border); line-height:1.5;">
            <i class="fas fa-info-circle"></i> スタッフごとの基本パターンを設定します。<br>反映ボタンで空欄のシフトを一括で埋められます。
        </div>
        <div style="border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: white;">
            ${allStoreUsers.length === 0 ? '<div style="padding:3rem; text-align:center; color:var(--text-secondary);">スタッフが読み込まれていません</div>' : ''}
            ${allStoreUsers.map(u => {
                const fs = u.FixedSchedule || {};
                const activeDays = Object.keys(fs).filter(k => fs[k].active);
                const dayMap = { Mon:'月', Tue:'火', Wed:'水', Thu:'木', Fri:'金', Sat:'土', Sun:'日' };
                const summary = activeDays.length > 0 ? activeDays.map(k => dayMap[k]).join(', ') : '<span style="color:#94a3b8; font-weight:400;">未設定</span>';
                
                return `
                    <div class="fixed-shift-staff-item" onclick="window.editUserFixedShift('${u.id}')">
                        <div style="flex:1;">
                            <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-primary); text-align: left;">${u.DisplayName || u.Name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.3rem; text-align: left; display:flex; align-items:center; gap:0.5rem;">
                                <span class="badge" style="background:#f1f5f9; color:#475569; padding: 0.1rem 0.4rem; border-radius:4px;">${u.JobTitle || u.Role}</span>
                                <span style="font-weight: 700; color:var(--secondary);">出勤: ${summary}</span>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: #cbd5e1; font-size: 0.8rem;"></i>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

window.editUserFixedShift = (uid) => {
    const user = allStoreUsers.find(u => u.id === uid);
    if (!user) return;

    const fs = user.FixedSchedule || {};
    const weekdays = [
        { key: 'Mon', label: '月曜日' },
        { key: 'Tue', label: '火曜日' },
        { key: 'Wed', label: '水曜日' },
        { key: 'Thu', label: '木曜日' },
        { key: 'Fri', label: '金曜日' },
        { key: 'Sat', label: '土曜日' },
        { key: 'Sun', label: '日曜日' }
    ];

    const body = document.getElementById('fixed-shift-drawer-body');
    body.innerHTML = `
        <div style="margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; padding-bottom: 0.8rem; border-bottom: 2px solid var(--secondary);">
            <div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight:700;">STAFF SETTING</div>
                <h5 style="margin:0; font-size: 1.25rem; color: var(--text-primary); font-weight: 900;">${user.Name} 様</h5>
            </div>
            <button onclick="window.renderFixedShiftStaffList()" class="btn btn-secondary btn-sm" style="border-radius:20px; padding:0.4rem 1rem;">
                <i class="fas fa-arrow-left"></i> 戻る
            </button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
            <div style="display: grid; grid-template-columns: 85px 50px 1fr 70px; gap: 0.6rem; padding: 0.5rem; font-size: 0.7rem; color: var(--text-secondary); font-weight: 800; text-align: center; border-bottom: 1px solid var(--border);">
                <div>曜日</div><div>出勤</div><div>勤務時間</div><div>休憩</div>
            </div>
            ${weekdays.map(wd => {
                const config = fs[wd.key] || { active: false, start: '17:00', end: '23:00', breakMin: 0 };
                const [sH, sM] = (config.start || '17:00').split(':');
                const [eH, eM] = (config.end || '23:00').split(':');

                return `
                    <div class="weekday-row" id="row-${wd.key}">
                        <div class="weekday-name">${wd.label}</div>
                        <div style="display:flex; justify-content:center;">
                            <label class="toggle-switch">
                                <input type="checkbox" class="weekday-active" ${config.active ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div style="display:flex; align-items:center; justify-content: center; gap:3px;">
                            <select class="form-input start-h" style="padding:2px; font-size:0.85rem; width: 44px; height:32px;">${generateHOptions(sH)}</select>
                            <span style="font-weight:800;">:</span>
                            <select class="form-input start-m" style="padding:2px; font-size:0.85rem; width: 44px; height:32px;">${generateMOptions(sM)}</select>
                            <span style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; margin:0 2px;">〜</span>
                            <select class="form-input end-h" style="padding:2px; font-size:0.85rem; width: 44px; height:32px;">${generateHOptions(eH)}</select>
                            <span style="font-weight:800;">:</span>
                            <select class="form-input end-m" style="padding:2px; font-size:0.85rem; width: 44px; height:32px;">${generateMOptions(eM)}</select>
                        </div>
                        <div style="display:flex; align-items:center; justify-content: center; gap:2px;">
                            <input type="number" class="form-input break-min" value="${config.breakMin || 0}" style="padding:2px; font-size:0.85rem; width:40px; height:32px; text-align: center; border-radius:6px;">
                            <span style="font-size:0.7rem; font-weight:700;">分</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        
        <div style="margin-top: 2.5rem; position: sticky; bottom: 0; background: rgba(255,255,255,0.9); padding: 1rem 0; backdrop-filter: blur(5px);">
            <button onclick="window.saveUserFixedShift('${uid}')" id="btn-save-fixed-fs" class="btn btn-primary" style="width:100%; border-radius: 14px; padding: 1.2rem; font-weight: 900; font-size: 1.1rem; box-shadow: 0 10px 15px -3px rgba(230, 57, 70, 0.3);">
                <i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i> この設定で確定する
            </button>
        </div>
    `;
};

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

window.saveUserFixedShift = async (uid) => {
    const user = allStoreUsers.find(u => u.id === uid);
    if (!user) return;

    const btn = document.getElementById('btn-save-fixed-fs');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

    const fs = {};
    const keys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    keys.forEach(key => {
        const row = document.getElementById(`row-${key}`);
        fs[key] = {
            active: row.querySelector('.weekday-active').checked,
            start: `${row.querySelector('.start-h').value}:${row.querySelector('.start-m').value}`,
            end: `${row.querySelector('.end-h').value}:${row.querySelector('.end-m').value}`,
            breakMin: parseInt(row.querySelector('.break-min').value) || 0
        };
    });

    try {
        await updateDoc(doc(db, "m_users", uid), { FixedSchedule: fs });
        user.FixedSchedule = fs; 
        showAlert('成功', `${user.Name} 様の定例シフト設定を更新しました。`);
        renderFixedShiftStaffList();
    } catch (e) {
        console.error(e);
        showAlert('エラー', 'データの保存に失敗しました。');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
};

async function applyFixedSchedules() {
    const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
    const batchOps = [];
    let count = 0;

    const loader = showLoader();
    try {
        for (let i = 0; i < span; i++) {
            const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
            const ymd = formatDateJST(d);
            const dayOfWeekMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayKey = dayOfWeekMap[d.getDay()];

            allStoreUsers.forEach(u => {
                // すでにシフトがある場合はスキップ
                if (currentShifts[u.id]?.[ymd]) return;

                const fs = u.FixedSchedule?.[dayKey];
                if (fs && fs.active) {
                    const sid = window.currentAdminStoreId;
                    const sName = window.currentAdminStoreName;
                    const shiftData = {
                        userId: u.id, userName: u.Name, date: ymd,
                        start: fs.start, end: fs.end, breakMin: fs.breakMin,
                        status: 'confirmed',
                        storeId: String(sid),
                        StoreID: String(sid),
                        storeName: sName,
                        StoreName: sName,
                        updatedAt: new Date().toISOString()
                    };
                    batchOps.push(setDoc(doc(db, "t_shifts", `${ymd}_${u.id}`), shiftData));
                    if (!currentShifts[u.id]) currentShifts[u.id] = {};
                    currentShifts[u.id][ymd] = shiftData;
                    count++;
                }
            });
        }

        if (batchOps.length > 0) {
            await Promise.all(batchOps);
            renderAdminGrid();
            updateOverallKPIs();
            showAlert('成功', `${count}件の定例シフトを未入力枠に反映しました！`);
        } else {
            showAlert('完了', '反映が必要な（空欄の）定例枠は残っていませんでした。');
        }
    } catch (e) {
        console.error(e);
        showAlert('エラー', '定例シフトの一括反映に失敗しました。');
    } finally {
        if (loader) loader.remove();
    }
}

/**
 * --- Shift Viewer (Step 4) ---
 */

export const shiftViewerPageHtml = `
    <div class="animate-fade-in" id="shift-viewer-container" style="max-width: 900px; margin: 0 auto; padding-bottom: 5rem;">
        <!-- パーソナル・ヘッダー -->
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; border-left: 5px solid var(--primary); display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, white 0%, #fff5f5 100%);">
            <div>
                <h3 id="viewer-user-name" style="margin: 0; font-size: 1.4rem; font-weight: 900; color: var(--primary);">読み込み中...</h3>
                <p id="viewer-period-label" style="margin: 0.3rem 0 0 0; font-size: 0.9rem; color: var(--text-secondary); font-weight: 700;">確定シフト・ダッシュボード</p>
            </div>
            <div style="text-align: right; display: flex; align-items: center; gap: 1rem;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900;">
                    <i class="fas fa-calendar-check"></i>
                </div>
            </div>
        </div>

        <div id="viewer-timeline-container" style="display: flex; flex-direction: column; gap: 2rem;">
            <!-- 各スロット（前半・後半）がここに生成される -->
            <div style="text-align: center; padding: 4rem; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin fa-2x"></i><br><br>シフトデータを読み込んでいます...
            </div>
        </div>
    </div>
` + `
    <style>
        .slot-section {
            position: relative;
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            border: 1px solid var(--border);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        .slot-section.past {
            background: #f1f5f9;
            opacity: 0.8;
            filter: grayscale(0.5);
        }
        .slot-section.current {
            border: 2px solid var(--primary);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .slot-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.2rem;
            padding-bottom: 0.8rem;
            border-bottom: 1px dashed var(--border);
        }
        .slot-label {
            font-size: 1.1rem;
            font-weight: 900;
            color: var(--text-primary);
        }
        .slot-badge {
            font-size: 0.7rem;
            padding: 0.2rem 0.6rem;
            border-radius: 20px;
            font-weight: 800;
        }
        .badge-past { background: #e2e8f0; color: #64748b; }
        .badge-current { background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; }
        .badge-future { background: #f0f9ff; color: #0369a1; }
        
        .personal-shift-row {
            display: flex;
            align-items: center;
            padding: 0.8rem;
            border-radius: 12px;
            background: #f8fafc;
            margin-bottom: 0.6rem;
            gap: 1rem;
            border: 1px solid transparent;
        }
        .personal-shift-row.help {
            background: #f5f3ff;
            border-color: #ddd6fe;
        }
        
        .official-stamp {
            position: absolute;
            bottom: 15px;
            right: 25px;
            width: 75px;
            height: 75px;
            border: 4px solid #dc2626;
            border-radius: 50%;
            color: #dc2626;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 0.85rem;
            font-weight: 900;
            line-height: 1.1;
            transform: rotate(-15deg);
            opacity: 0.5;
            pointer-events: none;
            user-select: none;
            background: rgba(255,255,255,0.7);
            z-index: 5;
        }
        .official-stamp span { font-size: 0.5rem; letter-spacing: 1px; }

        .btn-ics {
            background: white;
            color: var(--text-primary);
            border: 1px solid var(--border);
            font-size: 0.75rem;
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }
        .btn-ics:hover {
            background: #f8fafc;
            border-color: var(--primary);
            color: var(--primary);
        }
    </style>
`;

export async function initShiftViewerPage() {
    console.log("Initializing Rolling Shift Dashboard...");
    const me = JSON.parse(localStorage.getItem('currentUser'));
    if (!me) return;

    document.getElementById('viewer-user-name').textContent = me.Name;
    const container = document.getElementById('viewer-timeline-container');
    if (!container) return;

    try {
        // 1. ローリング6スロットを取得
        const slots = getRollingSlots();
        
        // 2. 店舗リストを取得 (他店舗名の解決用)
        const storeMap = {};
        try {
            const storeSnap = await getDocs(collection(db, "m_stores"));
            storeSnap.forEach(doc => {
                const d = doc.data();
                storeMap[String(d.store_id || d.id)] = d.store_name || d.name || '不明な店舗';
            });
        } catch (e) { console.warn("Store map fetch error:", e); }

        // 3. 全期間の自分のシフトを一括取得
        // ※ 複合インデックス制限を避けるため、userIdのみで取得し、メモリ内で日付・ステータスをフィルタリングします
        const q = query(collection(db, "t_shifts"), 
            where("userId", "==", me.id)
        );
        const snap = await getDocs(q);
        const allUserShifts = snap.docs.map(d => d.data());
        
        // メモリ内で絞り込み
        const overallStart = formatDateJST(slots[0].startDate);
        const overallEnd = formatDateJST(slots[slots.length-1].endDate);
        const shiftData = allUserShifts.filter(s => 
            s.status === "confirmed" && 
            s.date >= overallStart && 
            s.date <= overallEnd
        );

        // 4. 各スロットの描画
        container.innerHTML = slots.map(slot => {
            const slotShifts = shiftData.filter(s => s.date >= formatDateJST(slot.startDate) && s.date <= formatDateJST(slot.endDate));
            slotShifts.sort((a,b) => a.date.localeCompare(b.date));

            const isFuture = !slot.isPast && !slot.isCurrent;
            const isConfirmed = slotShifts.length > 0;
            
            let statusBadge = `<span class="slot-badge badge-past">終了</span>`;
            if (slot.isCurrent) statusBadge = `<span class="slot-badge badge-current">現在</span>`;
            if (isFuture) statusBadge = `<span class="slot-badge badge-future">予定</span>`;

            let contentHtml = "";
            if (isConfirmed) {
                contentHtml = slotShifts.map(s => {
                    const dateObj = new Date(s.date);
                    const dayOfWeek = ['日','月','火','水','木','金','土'][dateObj.getDay()];
                    const dateColor = dateObj.getDay() === 0 ? '#ef4444' : (dateObj.getDay() === 6 ? '#2563eb' : 'var(--text-primary)');
                    
                    const shiftStoreId = String(s.storeId || s.StoreID || '');
                    const isHelp = shiftStoreId !== '' && shiftStoreId !== String(me.StoreID || me.StoreId);

                    return `
                        <div class="personal-shift-row ${isHelp ? 'help' : ''}">
                            <div style="flex: 0 0 45px; text-align: center; border-right: 1px solid var(--border); color: ${dateColor};">
                                <div style="font-size: 0.65rem; font-weight: 700;">${s.date.split('-')[2]}</div>
                                <div style="font-size: 0.8rem; font-weight: 900;">(${dayOfWeek})</div>
                            </div>
                            <div style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-weight: 800; font-size: 1rem;">
                                <span>${s.start}</span>
                                <span style="opacity:0.2;">-</span>
                                <span>${s.end}</span>
                            </div>
                            <div style="flex: 1; font-size: 0.75rem; font-weight: 700; color: ${isHelp ? '#7c3aed' : 'var(--text-secondary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${isHelp ? `<i class="fas fa-map-marker-alt"></i> ${s.storeName || storeMap[shiftStoreId] || '他店舗'}` : '<i class="fas fa-home"></i> 本店'}
                            </div>
                        </div>
                    `;
                }).join('');
                
                contentHtml += `
                    <div class="official-stamp">
                        <div style="font-size: 0.5rem; letter-spacing: 1px; opacity: 0.8;">KANESHO</div>
                        <div style="font-size: 1.1rem; line-height: 1; margin: 2px 0;">かね将</div>
                        <div style="font-size: 0.5rem; letter-spacing: 1px; opacity: 0.8;">OFFICIAL</div>
                    </div>
                `;
            } else {
                if (isFuture) {
                    contentHtml = `<div style="text-align:center; padding:1.5rem; color:var(--text-secondary); background:#f8fafc; border-radius:12px; border:2px dashed var(--border); font-size: 0.85rem;">
                        <i class="fas fa-tools" style="margin-right:5px;"></i> 調整中...
                    </div>`;
                } else {
                    contentHtml = `<div style="text-align:center; padding:1rem; color:var(--text-secondary); font-size:0.8rem; opacity: 0.6;">予定はありませんでした</div>`;
                }
            }

            return `
                <div class="slot-section ${slot.isPast ? 'past' : ''} ${slot.isCurrent ? 'current' : ''}" id="slot-${slot.id}">
                    <div class="slot-header">
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                            <span class="slot-label">${slot.label}</span>
                            ${statusBadge}
                        </div>
                        ${isConfirmed ? `<button class="btn-ics" onclick="window.downloadShiftIcs('${slot.id}')"><i class="fas fa-file-export"></i> カレンダー追加</button>` : ''}
                    </div>
                    <div class="slot-content" style="position: relative;">
                        ${contentHtml}
                    </div>
                </div>
            `;
        }).join('');

        // ICSダウンロード用に関数をグローバル公開
        window.downloadShiftIcs = (slotId) => {
            const slot = slots.find(s => s.id === slotId);
            if (!slot) return;
            const targetShifts = shiftData.filter(s => s.date >= formatDateJST(slot.startDate) && s.date <= formatDateJST(slot.endDate));
            if (targetShifts.length === 0) return;
            generateAndDownloadIcs(targetShifts, slot.label);
        };

    } catch (error) {
        console.error("Shift Viewer Loading Error:", error);
        container.innerHTML = `<div style="text-align:center; padding:3rem; color:#ef4444;">
            <i class="fas fa-exclamation-triangle fa-2x"></i><br><br>
            データの読み込み中にエラーが発生しました。<br>
            <span style="font-size:0.8rem; opacity:0.8;">${error.message}</span>
        </div>`;
    }
}

/**
 * ICSファイルの生成とダウンロード
 */
function generateAndDownloadIcs(shifts, label) {
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Kanesho Portal//NONSGML v1.0//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];

    shifts.forEach(s => {
        const dateStr = s.date.replace(/-/g, '');
        const sTime = s.start.replace(':', '') + '00';
        const eTime = s.end.replace(':', '') + '00';
        
        let endDateStr = dateStr;
        // 24時またぎなどの簡易判定
        if (parseInt(eTime.substring(0,4)) < parseInt(sTime.substring(0,4))) {
            const d = new Date(s.date);
            d.setDate(d.getDate() + 1);
            endDateStr = d.toISOString().split('T')[0].replace(/-/g, '');
        }

        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`SUMMARY:【かね将】${s.storeName || '出勤'}`);
        icsContent.push(`DTSTART;TZID=Asia/Tokyo:${dateStr}T${sTime}`);
        icsContent.push(`DTEND;TZID=Asia/Tokyo:${endDateStr}T${eTime}`);
        icsContent.push(`DESCRIPTION:シフト予定: ${s.start}-${s.end}${s.note ? '\\n備考: ' + s.note : ''}`);
        icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `kanesho_shift_${label.replace(' ', '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 公開状況チェック（他画面からの遷移制御用）
 */
export async function checkIfShiftPublished() {
    return true; // 閲覧画面は常にアクセス可能とする
}

