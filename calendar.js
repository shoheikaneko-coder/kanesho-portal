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

    <style>
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
    </style>
`;

export const calendarViewerPageHtml = `
    <div class="animate-fade-in">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; display: flex; gap: 1.5rem; align-items: flex-end; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 250px;">
                <label class="field-label">表示月</label>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <button class="btn btn-secondary" style="padding:0.4rem 0.8rem; height: 38px;" onclick="window.changeCalMonth(-1)"><i class="fas fa-chevron-left"></i> 前月</button>
                    <span id="cal-view-ym-display" style="font-size: 1.3rem; font-weight: 800; min-width: 140px; text-align: center; color: var(--text-primary);">----年--月</span>
                    <button class="btn btn-secondary" style="padding:0.4rem 0.8rem; height: 38px;" onclick="window.changeCalMonth(1)">次月 <i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
            <div style="flex: 1; min-width: 200px;">
                <label class="field-label">店舗切り替え</label>
                <select id="cal-view-store" class="form-input"></select>
            </div>
            <div style="flex: 1; min-width: 150px; text-align: right;">
                <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">今月の営業日数</div>
                <div id="cal-view-counter" style="font-size: 1.8rem; font-weight: 800; color: var(--primary);">-- 日</div>
            </div>
        </div>

        <div class="glass-panel" style="padding: 2rem;">
            <div id="calendar-viewer-grid-container"></div>
            <div class="calendar-legend" style="margin-top: 1.5rem;">
                <div class="legend-item"><span class="box-work"></span> 通常営業</div>
                <div class="legend-item"><span class="box-holiday"></span> 祝日 (文字赤)</div>
                <div class="legend-item"><span class="box-market"></span> 市場休 (青マーク)</div>
                <div class="legend-item"><span class="box-off"></span> 店休 (背景赤)</div>
            </div>
        </div>
    </div>
`;

// --- Logic ---

let currentAdminState = {
    year: null,
    month: null,
    storeId: 'common',
    days: [] 
};

let currentViewState = {
    year: null,
    month: null,
    storeId: null,
    days: []
};

/**
 * 管理画面の初期化
 */
export async function initCalendarAdminPage() {
    setupSelectors('cal-admin-year', 'cal-admin-month');
    await loadStoreOptions('cal-admin-store', true);
    
    const yearSel = document.getElementById('cal-admin-year');
    const monthSel = document.getElementById('cal-admin-month');
    const storeSel = document.getElementById('cal-admin-store');
    
    // 現在の会計年度(7月〜6月)にあわせる
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

    window.toggleDayStatus = (day) => {
        const dayObj = currentAdminState.days.find(d => d.day === day);
        if (!dayObj) return;
        
        if (currentAdminState.storeId === 'common') {
            // 社長モード (全社): 営業(白) -> 祝日(文字赤) -> 市場休(青) -> 戻る
            if (dayObj.type === 'work' && !dayObj.is_holiday && !dayObj.is_market_off) {
                dayObj.type = 'off'; // 共通での祝日は基本的に休み
                dayObj.is_holiday = true;
            } else if (dayObj.is_holiday) {
                dayObj.type = 'work'; // 市場休は営業
                dayObj.is_holiday = false;
                dayObj.is_market_off = true;
            } else {
                dayObj.type = 'work';
                dayObj.is_holiday = false;
                dayObj.is_market_off = false;
            }
        } else {
            // 店長モード (個別): 営業(白) ↔ 店休(背景赤)
            dayObj.type = (dayObj.type === 'work') ? 'off' : 'work';
        }
        
        renderCalendarGrid('calendar-admin-grid-container', currentAdminState.days, true, currentAdminState.year, currentAdminState.month);
        updateCounter('cal-admin-counter', currentAdminState.days);
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
        document.getElementById('cal-view-ym-display').textContent = `${currentViewState.year}年${currentViewState.month}月`;
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
                type: sDay ? sDay.type : cDay.type, // 個別優先
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
    const endY = now.getFullYear() + 1;
    
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
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    
    const commonSnap = await getDoc(doc(db, "m_calendars", `${ym}_common`));
    const commonData = commonSnap.exists() ? commonSnap.data() : { days: [] };
    
    let storeData = { days: [] };
    if (storeId !== 'common') {
        const sSnap = await getDoc(doc(db, "m_calendars", `${ym}_${storeId}`));
        if (sSnap.exists()) storeData = sSnap.data();
    }

    const daysInMonth = new Date(year, month, 0).getDate();
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
    renderCalendarGrid('calendar-admin-grid-container', days, true, year, month);
    updateCounter('cal-admin-counter', days);
}

/**
 * グリッド描画
 */
function renderCalendarGrid(containerId, days, editable, year, month) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const firstDay = new Date(year, month - 1, 1).getDay();
    
    let html = '<div class="calendar-grid">';
    const headers = ['日', '月', '火', '水', '木', '金', '土'];
    headers.forEach(h => html += `<div class="calendar-day-header">${h}</div>`);
    
    for (let i = 0; i < firstDay; i++) html += '<div class="calendar-day-cell empty" style="background:#f1f5f9; cursor:default;"></div>';
    
    days.forEach(d => {
        const classes = ['calendar-day-cell'];
        if (d.type === 'off') classes.push('is-off'); // 背景赤
        if (d.is_holiday) classes.push('is-holiday'); // 文字赤
        
        html += `
            <div class="${classes.join(' ')}" data-day="${d.day}" ${editable ? 'onclick="window.toggleDayStatus('+d.day+')"' : ''}>
                <div class="day-num">${d.day}</div>
                ${d.is_holiday ? `<span class="holiday-label">${d.label || '祝日'}</span>` : ''}
                ${d.is_market_off ? `<span class="market-badge">市場休</span>` : ''}
                ${d.type === 'off' && !d.is_holiday ? `<div style="font-size:0.7rem; color:#e53e3e; font-weight:700; margin-top:auto;">店休</div>` : ''}
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
    const ym = `${year}-${String(month).padStart(2, '0')}`;
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
