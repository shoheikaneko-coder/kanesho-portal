import { loadIntegratedData, lastLoadedIntData } from './attendance_management.js?v=20260910_01';
import { storeManagerPaidLeaveMobilePageHtml, initStoreManagerPaidLeaveMobilePage } from './paid_leave_mgmt_mobile.js?v=20260909_01';
import { showAlert } from './ui_utils.js';

let mobileActiveTab = 'monthly';

export const storeManagerAttendanceDashboardMobileHtml = `
<div id="attn-mgr-dashboard-mobile" class="animate-fade-in" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; background: #f8fafc;">
    
    <!-- 3 Tabs (Fixed at top) -->
    <div style="display: flex; background: white; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div class="attn-mob-tab active" data-tab="monthly" style="flex: 1; text-align: center; padding: 0.8rem 0; font-size: 0.9rem; font-weight: 700; color: var(--primary); border-bottom: 3px solid var(--primary); cursor: pointer;">
            期間集計
        </div>
        <div class="attn-mob-tab" data-tab="daily" style="flex: 1; text-align: center; padding: 0.8rem 0; font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); border-bottom: 3px solid transparent; cursor: pointer;">
            日別集計
        </div>
        <div class="attn-mob-tab" data-tab="paid_leave" style="flex: 1; text-align: center; padding: 0.8rem 0; font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); border-bottom: 3px solid transparent; cursor: pointer;">
            年間休日
        </div>
    </div>

    <!-- Scrollable Content Area -->
    <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
        
        <!-- Monthly Tab Pane -->
        <div id="attn-mob-pane-monthly" class="attn-mob-pane" style="display: block; flex: 1; overflow-y: auto;">
            <div style="padding: 0.8rem; background: white; border-bottom: 1px solid #e2e8f0; display: flex; gap: 0.5rem; align-items: flex-end;">
                <div class="input-group" style="margin: 0; flex: 1;">
                    <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary);">開始</label>
                    <input type="date" id="attn-int-period-start" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem;">
                </div>
                <div style="padding-bottom: 0.5rem; font-weight: bold; color: var(--text-secondary);">〜</div>
                <div class="input-group" style="margin: 0; flex: 1;">
                    <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary);">終了</label>
                    <input type="date" id="attn-int-period-end" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem;">
                </div>
                <button id="btn-attn-mob-search-monthly" class="btn btn-primary" style="padding: 0.6rem 1rem; border-radius: 6px;">表示</button>
            </div>
            
            <div id="attn-mob-monthly-body" style="padding: 0.8rem; display: flex; flex-direction: column; gap: 0.8rem;">
                <div style="padding: 3rem; text-align: center; color: var(--text-secondary);">
                    <i class="fas fa-search"></i> 期間を指定して「表示」を押してください
                </div>
            </div>
        </div>

        <!-- Daily Tab Pane -->
        <div id="attn-mob-pane-daily" class="attn-mob-pane" style="display: none; flex: 1; overflow-y: auto;">
            <div style="padding: 0.8rem; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <button id="btn-attn-mob-day-prev" class="btn" style="padding: 0.5rem 1rem; border-radius: 6px;">＜</button>
                <input type="date" id="attn-int-date-select" style="display: none;">
                <div id="attn-mob-day-label" style="font-weight: 800; font-size: 1.1rem; color: #1e293b; text-align: center; flex: 1;" onclick="const d = document.getElementById('attn-int-date-select'); if(d.showPicker) d.showPicker();">
                    --/--/--(-)
                </div>
                <button id="btn-attn-mob-day-next" class="btn" style="padding: 0.5rem 1rem; border-radius: 6px;">＞</button>
            </div>
            
            <div id="attn-mob-daily-body" style="padding: 0.8rem; display: flex; flex-direction: column; gap: 0.8rem;">
                <div style="padding: 3rem; text-align: center; color: var(--text-secondary);">
                    <i class="fas fa-search"></i> 日付を指定してください
                </div>
            </div>
        </div>

        <!-- Paid Leave Tab Pane -->
        <div id="attn-mob-pane-paid_leave" class="attn-mob-pane" style="display: none; flex: 1; overflow: hidden;">
            <!-- storeManagerPaidLeaveMobilePageHtml injected here dynamically -->
        </div>

    </div>
</div>
`;

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function initManagerAttendanceDashboardMobile() {
    window.__isStoreManagerAttendanceMode = true;
    window.__isStoreManagerPaidLeaveMode = true;
    
    // Register global callback for renderIntActiveTab
    window.__renderMobileAttendanceData = function() {
        console.log('[Mobile] __renderMobileAttendanceData called. lastLoadedIntData:', lastLoadedIntData);
        if (mobileActiveTab === 'monthly') renderMobileMonthly(lastLoadedIntData);
        else if (mobileActiveTab === 'daily') renderMobileDaily(lastLoadedIntData);
    };

    const today = new Date();
    document.getElementById('attn-int-date-select').value = today.toLocaleDateString('sv-SE');
    updateMobileDayLabel(today);
    
    document.getElementById('attn-int-date-select').addEventListener('change', (e) => {
        updateMobileDayLabel(new Date(e.target.value));
        triggerLoad();
    });
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    document.getElementById('attn-int-period-start').value = firstDay.toLocaleDateString('sv-SE');
    document.getElementById('attn-int-period-end').value = lastDay.toLocaleDateString('sv-SE');

    // Tab switching
    document.querySelectorAll('.attn-mob-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            mobileActiveTab = tabName;
            
            // Update styling
            document.querySelectorAll('.attn-mob-tab').forEach(b => {
                b.style.color = 'var(--text-secondary)';
                b.style.borderBottom = '3px solid transparent';
            });
            btn.style.color = 'var(--primary)';
            btn.style.borderBottom = '3px solid var(--primary)';
            
            // Toggle panes
            document.querySelectorAll('.attn-mob-pane').forEach(p => p.style.display = 'none');
            const targetPane = document.getElementById('attn-mob-pane-' + tabName);
            if (targetPane) targetPane.style.display = 'block';

            if (tabName === 'paid_leave') {
                const container = document.getElementById('attn-mob-pane-paid_leave');
                if (!container.querySelector('#attendance-mgmt-mobile-container')) {
                    container.innerHTML = storeManagerPaidLeaveMobilePageHtml;
                    if (typeof initStoreManagerPaidLeaveMobilePage === 'function') {
                        initStoreManagerPaidLeaveMobilePage();
                    }
                }
            } else {
                if (lastLoadedIntData) {
                    window.__renderMobileAttendanceData();
                }
            }
        });
    });

    const triggerLoad = async () => {
        const body = document.getElementById('attn-mob-monthly-body');
        const dailyBody = document.getElementById('attn-mob-daily-body');
        const loading = '<div style="padding: 3rem; text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> 計算中...</div>';
        if (body) body.innerHTML = loading;
        if (dailyBody) dailyBody.innerHTML = loading;
        
        await loadIntegratedData();
    };

    const searchBtn = document.getElementById('btn-attn-mob-search-monthly');
    if (searchBtn) {
        searchBtn.addEventListener('click', triggerLoad);
    }
    
    document.getElementById('btn-attn-mob-day-prev').onclick = () => shiftMobileIntDay(-1);
    document.getElementById('btn-attn-mob-day-next').onclick = () => shiftMobileIntDay(1);
    
    // Initial Load
    triggerLoad();
}

function shiftMobileIntDay(offset) {
    const ds = document.getElementById('attn-int-date-select');
    if (!ds) return;
    const d = new Date(ds.value);
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + offset);
    ds.value = d.toLocaleDateString('sv-SE');
    updateMobileDayLabel(d);
    
    const dailyBody = document.getElementById('attn-mob-daily-body');
    if (dailyBody) {
        dailyBody.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> 計算中...</div>';
    }
    loadIntegratedData();
}

function renderMobileMonthly(data) {
    const container = document.getElementById('attn-mob-monthly-body');
    if (!container) return;
    if (!data || !data.staffMap) {
        container.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--text-secondary);">データがありません</div>';
        return;
    }

    const storeId = data.storeId;
    const activeStaff = Object.values(data.staffMap).filter(s => {
        const matches = !storeId || String(s.storeId || s.store_id) === String(storeId);
        if (window.__isStoreManagerAttendanceMode) {
            const currentStoreId = window.appState?.currentUser?.StoreID;
            return matches && String(s.storeId || s.store_id) === String(currentStoreId);
        }
        return matches;
    });

    if (activeStaff.length === 0) {
        container.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--text-secondary);">データがありません</div>';
        return;
    }

    const absCountMap = data.absenceCountMap || {};
    let html = '';
    
    activeStaff.sort((a,b) => String(a.code).localeCompare(String(b.code))).forEach(s => {
        const stats = data.staffMonthlyStats[s.code];
        
        let daysCount = 0;
        let hoursCount = 0;
        let lateCount = 0;

        if (stats) {
            daysCount = stats.days.size;
            hoursCount = stats.totalHours;
            lateCount = stats.lateHours;
        }

        const absCount = absCountMap[String(s.code)] || 0;

        html += `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 0.6rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: 800; font-size: 1.1rem; color: #1e293b;">${escapeHTML(s.name)}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #f8fafc; padding: 0.8rem; border-radius: 8px;">
                <div>
                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">出勤日数</div>
                    <div style="font-size: 1rem; font-weight: 800; color: #334155;">${daysCount} <span style="font-size: 0.75rem; font-weight: 600;">日</span></div>
                </div>
                <div>
                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">実働時間</div>
                    <div style="font-size: 1rem; font-weight: 800; color: #334155;">${hoursCount.toFixed(2)} <span style="font-size: 0.75rem; font-weight: 600;">h</span></div>
                </div>
                <div>
                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">深夜時間</div>
                    <div style="font-size: 1rem; font-weight: 800; color: #334155;">${lateCount.toFixed(2)} <span style="font-size: 0.75rem; font-weight: 600;">h</span></div>
                </div>
                <div>
                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">欠勤数</div>
                    <div style="font-size: 1rem; font-weight: 800; color: #e53e3e;">${absCount} <span style="font-size: 0.75rem; font-weight: 600;">回</span></div>
                </div>
            </div>
            
            <div style="text-align: right; margin-top: 0.2rem;">
                <button class="btn btn-outline btn-mobile-view-daily" data-uid="${escapeHTML(s.uid)}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px; color: var(--primary); border-color: var(--primary);">
                    日別を見る <i class="fas fa-chevron-right" style="margin-left: 0.3rem;"></i>
                </button>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
    
    container.querySelectorAll('.btn-mobile-view-daily').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelector('.attn-mob-tab[data-tab="daily"]').click();
        });
    });
}

function renderMobileDaily(data) {
    const container = document.getElementById('attn-mob-daily-body');
    if (!container) return;
    if (!data || !data.staffMap) {
        container.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--text-secondary);">データがありません</div>';
        return;
    }

    const storeId = data.storeId;
    const dateStr = document.getElementById('attn-int-date-select').value;
    
    const activeStaff = Object.values(data.staffMap).filter(s => {
        const matches = !storeId || String(s.storeId || s.store_id) === String(storeId);
        if (window.__isStoreManagerAttendanceMode) {
            const currentStoreId = window.appState?.currentUser?.StoreID;
            return matches && String(s.storeId || s.store_id) === String(currentStoreId);
        }
        return matches;
    });

    let html = '';
    let count = 0;

    activeStaff.sort((a,b) => String(a.code).localeCompare(String(b.code))).forEach(s => {
        const mySessions = data.staffSessions[s.code] || [];
        const todaySession = mySessions.find(sess => sess.date === dateStr);
        
        if (!todaySession) return; // この日の記録がない場合はスキップ
        
        count++;
        
        const checkInStr = todaySession.checkIn.record.timestamp.substring(11, 16);
        const checkOutStr = todaySession.checkOut.record.timestamp.substring(11, 16);
        const laborStr = todaySession.netLabor.toFixed(2);
        const lateStr = todaySession.lateLabor.toFixed(2);
        
        const timeStr = `${checkInStr} → ${checkOutStr}`;
        
        html += `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 0.6rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: 800; font-size: 1.1rem; color: #1e293b;">${escapeHTML(s.name)}</div>
                <div style="font-size: 0.9rem; font-weight: 700; color: #0f172a;">${timeStr}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #f8fafc; padding: 0.6rem 0.8rem; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">実働</span>
                    <span style="font-size: 0.85rem; font-weight: 800; color: #334155;">${laborStr}h</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">深夜</span>
                    <span style="font-size: 0.85rem; font-weight: 800; color: #334155;">${lateStr}h</span>
                </div>
            </div>
        </div>
        `;
    });

    if (count === 0) {
        html = '<div style="padding: 3rem; text-align: center; color: var(--text-secondary);">この日の出勤記録はありません</div>';
    }

    container.innerHTML = html;
}

function updateMobileDayLabel(d) {
    const label = document.getElementById('attn-mob-day-label');
    if (label && !isNaN(d.getTime())) {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        label.textContent = `${yyyy}/${mm}/${dd}(${days[d.getDay()]})`;
    }
}
