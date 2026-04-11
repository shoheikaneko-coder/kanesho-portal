import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- HTML Templates ---

export const calendarAdminPageHtml = `
    <div class="animate-fade-in">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: flex-end;">
                <div style="flex: 1; min-width: 150px;">
                    <label class="field-label">対象年度 (7月〜)</label>
                    <select id="cal-admin-year" class="form-input"></select>
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label class="field-label">対象月</label>
                    <select id="cal-admin-month" class="form-input"></select>
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <label class="field-label">設定対象</label>
                    <select id="cal-admin-store" class="form-input">
                        <option value="common">全社共通設定</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 150px; text-align: right;">
                    <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 0.3rem;">確定営業日数</div>
                    <div id="cal-admin-counter" style="font-size: 2rem; font-weight: 800; color: var(--primary);">-- 日</div>
                </div>
            </div>
        </div>

        <div class="glass-panel" style="padding: 2rem;">
            <div id="calendar-admin-grid-container"></div>
            
            <div style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center;">
                <div class="calendar-legend">
                    <div class="legend-item"><span class="box-work"></span> 通常営業</div>
                    <div class="legend-item"><span class="box-holiday"></span> 祝日 (文字赤)</div>
                    <div class="legend-item"><span class="box-market"></span> 市場休 (青マーク)</div>
                    <div class="legend-item"><span class="box-off"></span> 店休 (背景赤)</div>
                </div>
                <button id="cal-admin-save-btn" class="btn btn-primary" style="padding: 0.8rem 2.5rem;">
                    <i class="fas fa-save"></i> 設定を保存
                </button>
            </div>
        </div>
    </div>

    <!-- 個別日編集用ポップアップ -->
    <div id="day-editor-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
        <div class="glass-panel animate-scale-in" style="width:100%; max-width:320px; padding:1.5rem; position:relative;">
            <h4 id="editor-day-title" style="margin:0 0 1.2rem; font-size:1.1rem; color:var(--text-primary); border-bottom:1px solid var(--border); padding-bottom:0.8rem;">日付設定</h4>
            
            <div style="display:flex; flex-direction:column; gap:1.2rem;">
                <!-- 祝日設定 -->
                <div id="editor-holiday-row" style="display:flex; align-items:center; justify-content:space-between;">
                    <label style="font-weight:600; font-size:0.9rem; color:var(--text-primary); cursor:pointer;" for="opt-is-holiday">祝日として表示</label>
                    <input type="checkbox" id="opt-is-holiday" style="width:20px; height:20px; cursor:pointer;">
                </div>
                
                <!-- 祝日ラベル -->
                <div id="editor-label-row">
                    <label class="field-label" style="font-size:0.75rem;">祝日名・備考</label>
                    <input type="text" id="opt-day-label" class="form-input" placeholder="例：成人の日、振替休日" style="padding:0.5rem;">
                </div>

                <!-- 市場休設定 -->
                <div id="editor-market-row" style="display:flex; align-items:center; justify-content:space-between;">
                    <label style="font-weight:600; font-size:0.9rem; color:var(--text-primary); cursor:pointer;" for="opt-is-market">市場休業日</label>
                    <input type="checkbox" id="opt-is-market" style="width:20px; height:20px; cursor:pointer;">
                </div>

                <hr style="border:none; border-top:1px solid var(--border); margin:0;">

                <!-- 店休日設定 -->
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <label style="font-weight:700; font-size:0.9rem; color:var(--primary); cursor:pointer;" for="opt-is-off">店の休業日</label>
                    <input type="checkbox" id="opt-is-off" style="width:20px; height:20px; cursor:pointer;">
                </div>
            </div>

            <div style="margin-top:2rem; display:flex; gap:0.8rem;">
                <button class="btn btn-secondary" style="flex:1;" onclick="window.closeDayEditor()">キャンセル</button>
                <button class="btn btn-primary" style="flex:1;" onclick="window.saveDayEditor()">適用</button>
            </div>
        </div>
    </div>

    <style id="calendar-common-style">
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .calendar-day-header { background: #f8fafc; padding: 0.8rem; text-align: center; font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); }
        .calendar-day-cell { 
            background: white; 
            min-height: 100px; 
            padding: 0.5rem; 
            cursor: pointer; 
            transition: all 0.1s; 
            position: relative; 
            display: flex;
            flex-direction: column;
            border: 1px solid transparent;
        }
        .calendar-day-cell:hover { background: #f1f5f9; border-color: var(--primary); z-index: 1; }
        .calendar-day-cell.readonly { cursor: default; }
        .calendar-day-cell.readonly:hover { background: white; border-color: transparent; }
        .calendar-day-cell.is-off { background: #fee2e2; } /* 店休背景: 薄い赤 */
        .calendar-day-cell.is-holiday .day-num { color: #e53e3e; font-weight: 800; } /* 祝日文字赤 */
        .day-num { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); }
        .market-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: #3b82f6; color: white; font-size: 9px; padding: 2px 4px; border-radius: 4px; font-weight: bold; }
        .holiday-label { font-size: 0.7rem; color: #e53e3e; margin-top: 0.3rem; display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
        
        .calendar-legend { display: flex; gap: 1.5rem; font-size: 0.85rem; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-weight: 600; }
        .box-work { width: 16px; height: 16px; background: white; border: 1px solid var(--border); border-radius: 3px; }
        .box-off { width: 16px; height: 16px; background: #fee2e2; border: 1px solid #fecaca; border-radius: 3px; }
        .box-holiday { width: 16px; height: 16px; color: #e53e3e; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 3px; background: #fff; }
        .box-holiday::after { content: "1"; font-size: 10px; }
        .box-market { width: 16px; height: 16px; background: #3b82f6; border-radius: 3px; }

        /* モバイル専用プレミアムスタイル (PC版には影響しません) */
        @media (max-width: 1024px) {
            .calendar-grid { gap: 0; border: none; border-radius: 12px; background: var(--border); border: 1px solid var(--border); }
            .calendar-day-header { padding: 0.5rem; font-size: 0.75rem; border-bottom: 1px solid var(--border); }
            .calendar-day-cell { min-height: 70px; padding: 0.3rem; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); border-radius: 0 !important; }
            .calendar-day-cell:nth-child(7n) { border-right: none; }
            .day-num-container { display: flex; justify-content: center; align-items: center; height: 32px; }
            .day-num { font-size: 1rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s; }
            
            /* 祝日: 日付の赤丸塗り */
            .calendar-day-cell.is-holiday .day-num { background: #E63946 !important; color: white !important; font-weight: 800; }
            
            /* 市場休: 青ドット */
            .market-dot { width: 5px; height: 5px; background: #3b82f6; border-radius: 50%; margin: 2px auto 0; }
            
            /* 店休: セル背景を赤く */
            .calendar-day-cell.is-off { background: #fee2e2 !important; }
            
            /* PC用ラベルを隠す */
            .market-badge, .holiday-label, .off-text-pc { display: none !important; }
        }
    </style>
`;

export const calendarViewerPageHtml = `
    <div class="animate-fade-in">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; display: flex; gap: 2rem; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 250px;">
                <label class="field-label" style="margin-bottom: 0.5rem;">表示月</label>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <button class="btn btn-secondary" style="padding:0.5rem 1rem; height: 42px; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem;" onclick="window.changeCalMonth(-1)">
                        <i class="fas fa-chevron-left"></i> 前月
                    </button>
                    <span id="cal-view-ym-display" style="font-size: 1.1rem; font-weight: 800; min-width: 140px; text-align: center; color: var(--text-secondary); letter-spacing: 0.5px;">----年--月</span>
                    <button class="btn btn-secondary" style="padding:0.5rem 1rem; height: 42px; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem;" onclick="window.changeCalMonth(1)">
                        次月 <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            <div style="flex: 1; min-width: 250px;">
                <label class="field-label" style="margin-bottom: 0.5rem;">店舗切り替え</label>
                <select id="cal-view-store" class="form-input" style="height: 42px; border-radius: 12px; font-weight: 600;"></select>
            </div>
            <div style="flex: 0 0 150px; text-align: right;">
                <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 700; margin-bottom: 0.2rem;">今月の営業日数</div>
                <div id="cal-view-counter" style="font-size: 2.2rem; font-weight: 900; color: var(--primary);">-- 日</div>
            </div>
        </div>

        <div class="glass-panel" style="padding: 2rem;">
            <div id="calendar-viewer-grid-container"></div>
            <div style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1.5rem;">
                <div class="calendar-legend">
                    <div class="legend-item"><span class="box-work"></span> 通常営業</div>
                    <div class="legend-item"><span class="box-holiday"></span> 祝日 (文字赤)</div>
                    <div class="legend-item"><span class="box-market"></span> 市場休 (青マーク)</div>
                    <div class="legend-item"><span class="box-off"></span> 店休 (背景赤)</div>
                </div>
            </div>
        </div>
    </div>
    <!-- デザインを共通利用するためにstyleを再度含める -->
    <style>
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .calendar-day-header { background: #f8fafc; padding: 0.8rem; text-align: center; font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); }
        .calendar-day-cell { 
            background: white; 
            min-height: 100px; 
            padding: 0.5rem; 
            transition: all 0.1s; 
            position: relative; 
            display: flex;
            flex-direction: column;
            border: 1px solid transparent;
            cursor: default;
        }
        .calendar-day-cell.is-off { background: #fee2e2; }
        .calendar-day-cell.is-holiday .day-num { color: #e53e3e; font-weight: 800; }
        .day-num { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); }
        .market-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: #3b82f6; color: white; font-size: 9px; padding: 2px 4px; border-radius: 4px; font-weight: bold; }
        .holiday-label { font-size: 0.7rem; color: #e53e3e; margin-top: 0.3rem; display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
        .calendar-legend { display: flex; gap: 1.5rem; font-size: 0.85rem; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-weight: 600; }
        .box-work { width: 16px; height: 16px; background: white; border: 1px solid var(--border); border-radius: 3px; }
        .box-off { width: 16px; height: 16px; background: #fee2e2; border: 1px solid #fecaca; border-radius: 3px; }
        .box-holiday { width: 16px; height: 16px; color: #e53e3e; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 3px; background: #fff; }
        .box-holiday::after { content: "1"; font-size: 10px; }
        .box-market { width: 16px; height: 16px; background: #3b82f6; border-radius: 3px; }

        /* モバイル専用プレミアムスタイル (PC版には影響しません) */
        @media (max-width: 1024px) {
            .calendar-grid { gap: 0; border: none; border-radius: 12px; background: var(--border); border: 1px solid var(--border); }
            .calendar-day-header { padding: 0.5rem; font-size: 0.75rem; border-bottom: 1px solid var(--border); }
            .calendar-day-cell { min-height: 70px; padding: 0.3rem; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); border-radius: 0 !important; }
            .calendar-day-cell:nth-child(7n) { border-right: none; }
            .day-num-container { display: flex; justify-content: center; align-items: center; height: 32px; }
            .day-num { font-size: 1rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s; }
            
            /* 祝日: 日付の赤丸塗り */
            .calendar-day-cell.is-holiday .day-num { background: #E63946 !important; color: white !important; font-weight: 800; }
            
            /* 市場休: 青ドット */
            .market-dot { width: 5px; height: 5px; background: #3b82f6; border-radius: 50%; margin: 2px auto 0; }
            
            /* 店休: セル背景を赤く */
            .calendar-day-cell.is-off { background: #fee2e2 !important; }
            
            /* PC用ラベルを隠す */
            .market-badge, .holiday-label, .off-text-pc { display: none !important; }
        }
    </style>
`;

// --- Logic ---

let currentAdminState = {
    year: null,
    month: null,
    storeId: 'common',
    days: [] 
};

let editingDay = null;

let currentViewState = {
    year: null,
    month: null,
    storeId: null,
    days: []
};

// ヘルパー: 会計年度と月から実際の西暦を計算
function getActualYear(fy, month) {
    const fyear = parseInt(fy);
    const m = parseInt(month);
    return (m >= 7) ? fyear : fyear + 1;
}

/**
 * 管理画面の初期化
 */
export async function initCalendarAdminPage() {
    setupSelectors('cal-admin-year', 'cal-admin-month');
    await loadStoreOptions('cal-admin-store', true);
    
    const yearSel = document.getElementById('cal-admin-year');
    const monthSel = document.getElementById('cal-admin-month');
    const storeSel = document.getElementById('cal-admin-store');
    
    const now = new Date();
    let initialFY = now.getFullYear();
    if (now.getMonth() < 6) initialFY--; 
    
    yearSel.value = initialFY;
    monthSel.value = now.getMonth() + 1;
    
    const refresh = async () => {
        currentAdminState.year = parseInt(yearSel.value);
        currentAdminState.month = parseInt(monthSel.value);
        currentAdminState.storeId = storeSel.value;
        await refreshAdminCalendar();
    };

    yearSel.onchange = refresh;
    monthSel.onchange = refresh;
    storeSel.onchange = refresh;

    document.getElementById('cal-admin-save-btn').onclick = saveCalendar;

    // --- エディタ関数をグローバル展開 ---
    window.openDayEditor = (day) => {
        const dObj = currentAdminState.days.find(d => d.day === day);
        if (!dObj) return;
        editingDay = day;

        const modal = document.getElementById('day-editor-modal');
        const title = document.getElementById('editor-day-title');
        const cbHoliday = document.getElementById('opt-is-holiday');
        const cbMarket = document.getElementById('opt-is-market');
        const cbOff = document.getElementById('opt-is-off');
        const inputLabel = document.getElementById('opt-day-label');

        const actualYear = getActualYear(currentAdminState.year, currentAdminState.month);
        title.textContent = `${actualYear}年 ${currentAdminState.month}月${day}日の設定`;
        cbHoliday.checked = dObj.is_holiday || false;
        cbMarket.checked = dObj.is_market_off || false;
        cbOff.checked = dObj.type === 'off';
        inputLabel.value = dObj.label || "";

        // 全社共通設定ではない場合は、祝日・市場休の編集を制限
        const isCommon = currentAdminState.storeId === 'common';
        document.getElementById('editor-holiday-row').style.opacity = isCommon ? '1' : '0.4';
        document.getElementById('editor-holiday-row').style.pointerEvents = isCommon ? 'auto' : 'none';
        document.getElementById('editor-market-row').style.opacity = isCommon ? '1' : '0.4';
        document.getElementById('editor-market-row').style.pointerEvents = isCommon ? 'auto' : 'none';
        document.getElementById('editor-label-row').style.opacity = isCommon ? '1' : '0.4';
        document.getElementById('editor-label-row').style.pointerEvents = isCommon ? 'auto' : 'none';

        modal.style.display = 'flex';
    };

    window.closeDayEditor = () => {
        document.getElementById('day-editor-modal').style.display = 'none';
        editingDay = null;
    };

    window.saveDayEditor = () => {
        if (editingDay === null) return;
        const dObj = currentAdminState.days.find(d => d.day === editingDay);
        
        const isCommon = currentAdminState.storeId === 'common';
        const cbHoliday = document.getElementById('opt-is-holiday');
        const cbMarket = document.getElementById('opt-is-market');
        const cbOff = document.getElementById('opt-is-off');
        const inputLabel = document.getElementById('opt-day-label');

        // 共通設定モードの時のみ反映する項目
        if (isCommon) {
            dObj.is_holiday = cbHoliday.checked;
            dObj.is_market_off = cbMarket.checked;
            dObj.label = inputLabel.value;
        }

        // 店休日はどちらのモードでも設定可能（個別なら個別、共通なら一律店休）
        dObj.type = cbOff.checked ? 'off' : 'work';

        const actualYear = getActualYear(currentAdminState.year, currentAdminState.month);
        renderCalendarGrid('calendar-admin-grid-container', currentAdminState.days, true, actualYear, currentAdminState.month);
        updateCounter('cal-admin-counter', currentAdminState.days);
        window.closeDayEditor();
    };

    await refresh();
}

/**
 * 閲覧画面の初期化
 */
export async function initCalendarViewerPage() {
    const now = new Date();
    currentViewState.year = now.getFullYear();
    currentViewState.month = now.getMonth() + 1;
    
    await loadStoreOptions('cal-view-store', false); 
    const storeSel = document.getElementById('cal-view-store');
    
    if (!currentViewState.storeId && storeSel.options.length > 0) {
        currentViewState.storeId = storeSel.value;
    }

    currentViewState.refresh = async () => {
        const ymText = `${currentViewState.year}年${currentViewState.month}月`;
        document.getElementById('cal-view-ym-display').textContent = ymText;
        
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = `営業カレンダー (${ymText})`;
        const ym = `${currentViewState.year}-${String(currentViewState.month).padStart(2, '0')}`;
        
        const commonSnap = await getDoc(doc(db, "m_calendars", `${ym}_common`));
        const commonData = commonSnap.exists() ? commonSnap.data() : { days: [] };
        
        const sSnap = await getDoc(doc(db, "m_calendars", `${ym}_${currentViewState.storeId}`));
        const storeData = sSnap.exists() ? sSnap.data() : { days: [] };

        const daysInMonth = new Date(currentViewState.year, currentViewState.month, 0).getDate();
        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const cDay = commonData.days?.find(i => i.day === d) || { type: 'work' };
            const sDay = storeData.days?.find(i => i.day === d);
            days.push({
                day: d,
                type: sDay ? sDay.type : cDay.type, 
                is_holiday: cDay.is_holiday || false,
                is_market_off: cDay.is_market_off || false,
                label: sDay?.label || cDay.label || ""
            });
        }
        
        currentViewState.days = days;
        renderCalendarGrid('calendar-viewer-grid-container', days, false, currentViewState.year, currentViewState.month);
        updateCounter('cal-view-counter', days);
    };

    window.changeCalMonth = async (dir) => {
        let m = currentViewState.month + dir;
        let y = currentViewState.year;
        if (m > 12) { m = 1; y++; }
        if (m < 1) { m = 12; y--; }
        currentViewState.month = m;
        currentViewState.year = y;
        await currentViewState.refresh();
    };

    storeSel.onchange = () => {
        currentViewState.storeId = storeSel.value;
        currentViewState.refresh();
    };

    await currentViewState.refresh();
}

/**
 * ヘルパー: セレクタ初期化
 */
function setupSelectors(yearId, monthId) {
    const ySel = document.getElementById(yearId);
    const mSel = document.getElementById(monthId);
    
    const now = new Date();
    const startY = 2023; 
    const endY = now.getFullYear() + 2; // 少し未来まで
    
    ySel.innerHTML = '';
    for (let y = startY; y <= endY; y++) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = `${y}年度 (7月〜)`;
        ySel.appendChild(opt);
    }
    
    mSel.innerHTML = '';
    const months = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
    months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = `${m}月`;
        mSel.appendChild(opt);
    });
}

/**
 * 店舗一覧の読み込み
 */
async function loadStoreOptions(id, includeCommon) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = includeCommon ? '<option value="common">全社共通設定</option>' : '';
    try {
        const snap = await getDocs(collection(db, "m_stores"));
        snap.forEach(d => {
            const data = d.data();
            if (data.store_type === 'CK') return; 
            const opt = document.createElement('option');
            opt.value = d.id; opt.textContent = data.store_name || data.店舗名;
            sel.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

/**
 * 管理用カレンダーの更新
 */
async function refreshAdminCalendar() {
    const { year, month, storeId } = currentAdminState;
    const actualYear = getActualYear(year, month);
    const ym = `${actualYear}-${String(month).padStart(2, '0')}`;
    
    const commonSnap = await getDoc(doc(db, "m_calendars", `${ym}_common`));
    const commonData = commonSnap.exists() ? commonSnap.data() : { days: [] };
    
    let storeData = { days: [] };
    if (storeId !== 'common') {
        const sSnap = await getDoc(doc(db, "m_calendars", `${ym}_${storeId}`));
        if (sSnap.exists()) storeData = sSnap.data();
    }

    const daysInMonth = new Date(actualYear, month, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const cDay = commonData.days?.find(i => i.day === d) || { type: 'work' };
        const sDay = storeData.days?.find(i => i.day === d);
        days.push({
            day: d,
            type: sDay ? sDay.type : cDay.type,
            is_holiday: cDay.is_holiday || false,
            is_market_off: cDay.is_market_off || false,
            label: sDay?.label || cDay.label || ""
        });
    }
    
    currentAdminState.days = days;
    
    // UI上の実際の年月表示を更新
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = `営業カレンダー設定 (${actualYear}年${month}月)`;
    }

    renderCalendarGrid('calendar-admin-grid-container', days, true, actualYear, month);
    updateCounter('cal-admin-counter', days);
}

/**
 * グリッド描画
 */
function renderCalendarGrid(containerId, days, editable, actualYear, month) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const firstDay = new Date(actualYear, month - 1, 1).getDay();
    
    let html = '<div class="calendar-grid">';
    const headers = ['日', '月', '火', '水', '木', '金', '土'];
    headers.forEach(h => html += `<div class="calendar-day-header">${h}</div>`);
    
    for (let i = 0; i < firstDay; i++) html += '<div class="calendar-day-cell empty" style="background:#f1f5f9; cursor:default;"></div>';
    
    days.forEach(d => {
        const classes = ['calendar-day-cell'];
        if (!editable) classes.push('readonly');
        if (d.type === 'off') classes.push('is-off'); // 背景赤
        if (d.is_holiday) classes.push('is-holiday'); // 文字赤
        
        html += `
            <div class="${classes.join(' ')}" data-day="${d.day}" ${editable ? 'onclick="window.openDayEditor('+d.day+')"' : ''}>
                <div class="day-num-container">
                    <div class="day-num">${d.day}</div>
                </div>
                ${d.is_holiday ? `<span class="holiday-label">${d.label || '祝日'}</span>` : ''}
                ${d.is_market_off ? `<span class="market-badge">市場休</span>` : ''}
                ${d.is_market_off ? `<div class="market-dot mobile-only"></div>` : ''}
                ${d.type === 'off' && !d.is_holiday ? `<div class="off-text-pc" style="font-size:0.7rem; color:#e53e3e; font-weight:700; margin-top:auto;">店休</div>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function updateCounter(id, days) {
    const count = days.filter(d => d.type === 'work').length;
    const el = document.getElementById(id);
    if (el) el.textContent = `${count} 日`;
}

/**
 * 保存処理
 */
async function saveCalendar() {
    const { year, month, storeId, days } = currentAdminState;
    const actualYear = getActualYear(year, month);
    const ym = `${actualYear}-${String(month).padStart(2, '0')}`;
    const total = days.filter(d => d.type === 'work').length;
    
    const btn = document.getElementById('cal-admin-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    
    try {
        await setDoc(doc(db, "m_calendars", `${ym}_${storeId}`), {
            year_month: ym,
            store_id: storeId,
            days: days.map(d => ({
                day: d.day,
                type: d.type,
                is_holiday: d.is_holiday || false,
                is_market_off: d.is_market_off || false,
                label: d.label || ""
            })),
            total_operating_days: total,
            updated_at: new Date(),
            updated_by: JSON.parse(localStorage.getItem('currentUser'))?.Name || 'System'
        });
        alert('カレンダー設定を保存しました。');
    } catch (e) {
        console.error(e);
        alert('保存エラー: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> 設定を保存';
    }
}
