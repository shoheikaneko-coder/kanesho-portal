import { calculatePaidLeaveMetrics, saveStaffPaidLeaveSettings } from './attendance_management.js?v=20260907_08';
import { showAlert } from './ui_utils.js';

export const storeManagerPaidLeaveMobilePageHtml = `
<div id="attendance-mgmt-mobile-container" class="animate-fade-in" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; background: #f8fafc;">
    
    <!-- Filter Section (Sticky top) -->
    <div style="background: white; border-bottom: 1px solid #e2e8f0; padding: 0.8rem 1rem; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
            <h2 style="margin: 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem;"><i class="fas fa-umbrella-beach text-primary"></i> 年間休日管理</h2>
            <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">基準: <span id="attn-mobile-paid-base-display" style="color: var(--primary); font-size: 0.9rem;">120</span> 日</div>
        </div>
        
        <div id="attn-mobile-paid-warning" style="display: none; margin-bottom: 0.8rem; color: #e53e3e; font-size: 0.75rem; font-weight: 700;"><i class="fas fa-exclamation-circle"></i> 会社カレンダー未設定の月があるため、未来見込が正確でない可能性があります。</div>
        
        <div style="display: flex; gap: 0.4rem; align-items: flex-end;">
            <div class="input-group" style="flex: 1; min-width: 0; margin: 0;">
                <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary);">対象年度</label>
                <select id="attn-mobile-paid-year" style="width: 100%; padding: 0.5rem 0.2rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem;">
                    <!-- JSで動的生成 -->
                </select>
            </div>
            <div class="input-group" style="flex-shrink: 0; width: 5.5rem; margin: 0;">
                <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary);">雇用形態</label>
                <select id="attn-mobile-paid-emp-type" style="width: 100%; padding: 0.5rem 0.2rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem;">
                    <option value="">全件</option>
                    <option value="Executive">役員</option>
                    <option value="Full-time" selected>正社</option>
                    <option value="Part-time">バイト</option>
                </select>
            </div>
            <button id="btn-attn-mobile-search" class="btn btn-primary" style="flex-shrink: 0; padding: 0; width: 3.5rem; height: 35px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; margin-bottom: 1px;">
                表示
            </button>
        </div>
    </div>
    
    <!-- List Section (Scrollable) -->
    <div id="attn-mobile-paid-list" style="flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem;">
        <!-- Cards will be injected here -->
        <div style="text-align: center; color: var(--text-secondary); padding: 2rem 0; font-size: 0.9rem;">「検索・表示」を押してください</div>
    </div>
    
    <!-- Bottom Sheet Modal for Settings -->
    <div id="attn-mobile-bottom-sheet-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; opacity: 0; transition: opacity 0.3s ease;"></div>
    <div id="attn-mobile-bottom-sheet" style="position: fixed; bottom: -100%; left: 0; right: 0; background: white; border-radius: 20px 20px 0 0; z-index: 1001; transition: bottom 0.3s cubic-bezier(0.175, 0.885, 0.32, 1); box-shadow: 0 -4px 20px rgba(0,0,0,0.1); display: flex; flex-direction: column; max-height: 90vh;">
        <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 id="attn-mobile-modal-name" style="margin: 0; font-size: 1.1rem;">-</h3>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;"><span id="attn-mobile-modal-year-label"></span>年度の休日設定</div>
            </div>
            <button id="btn-attn-mobile-modal-close" style="background: none; border: none; font-size: 1.2rem; color: #94a3b8; padding: 0.5rem;"><i class="fas fa-times"></i></button>
        </div>
        <div style="padding: 1.5rem; overflow-y: auto; flex: 1;">
            <input type="hidden" id="attn-mobile-modal-uid" value="">
            <input type="hidden" id="attn-mobile-modal-year" value="">
            
            <div class="input-group" style="margin-bottom: 1.5rem;">
                <label style="font-weight: 700; color: var(--text-secondary); margin-bottom: 0.8rem; font-size: 0.85rem;">固定休日 (店長編集可能)</label>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem;">
                    <label style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem 0; border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" name="mobile-paid-fixed-dow" value="1" style="margin-bottom: 4px;">月
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem 0; border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" name="mobile-paid-fixed-dow" value="2" style="margin-bottom: 4px;">火
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem 0; border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" name="mobile-paid-fixed-dow" value="3" style="margin-bottom: 4px;">水
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem 0; border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" name="mobile-paid-fixed-dow" value="4" style="margin-bottom: 4px;">木
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem 0; border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" name="mobile-paid-fixed-dow" value="5" style="margin-bottom: 4px;">金
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem 0; border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" name="mobile-paid-fixed-dow" value="6" style="margin-bottom: 4px; accent-color: #3b82f6;">土
                    </label>
                    <label style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem 0; border-radius: 8px; cursor: pointer;">
                        <input type="checkbox" name="mobile-paid-fixed-dow" value="0" style="margin-bottom: 4px; accent-color: #ef4444;">日
                    </label>
                </div>
            </div>
            
            <div class="input-group">
                <label style="font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.85rem;">個人別休日基準 (閲覧のみ)</label>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="number" id="attn-mobile-modal-custom-base" class="form-control" style="width: 100px; background: #f1f5f9; color: #94a3b8;" disabled>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">日</span>
                </div>
                <p style="margin: 0.4rem 0 0; font-size: 0.75rem; color: var(--text-secondary);">※この設定は管理者のみ変更可能です。</p>
            </div>
        </div>
        <div style="padding: 1rem 1.5rem 2rem 1.5rem; border-top: 1px solid #f1f5f9;">
            <button id="btn-attn-mobile-modal-save" class="btn btn-primary" style="width: 100%; padding: 0.8rem; border-radius: 8px; font-weight: 700; font-size: 1rem;">
                保存する
            </button>
        </div>
    </div>
</div>
    <!-- Name Popover -->
    <div id="attn-mobile-name-popover" style="display: none; position: fixed; background: rgba(30, 41, 59, 0.95); color: white; padding: 0.8rem 1rem; border-radius: 8px; z-index: 2000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 0.85rem; max-width: 80%; pointer-events: none; opacity: 0; transition: opacity 0.2s;">
        <div id="attn-mobile-popover-name" style="font-weight: 800; font-size: 1rem; margin-bottom: 0.3rem;"></div>
        <div style="color: #cbd5e1;"><i class="fas fa-store"></i> <span id="attn-mobile-popover-store"></span></div>
    </div>
`;

let lastLoadedPaidLeaveMobileData = null;

// Initialize dropdown
function initMobilePaidLeaveYearSelect() {
    const sel = document.getElementById('attn-mobile-paid-year');
    if (!sel || sel.options.length > 0) return;
    const now = new Date();
    let currentYear = now.getFullYear();
    if (now.getMonth() + 1 < 7) {
        currentYear -= 1;
    }
    
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y}年度 (${y}/07/01〜${y+1}/06/30)`;
        if (y === currentYear) opt.selected = true;
        sel.appendChild(opt);
    }
    
    sel.addEventListener('change', loadPaidLeaveMobileData);
}

// Fetch data & calculate
async function loadPaidLeaveMobileData() {
    initMobilePaidLeaveYearSelect();
    
    const yearStr = document.getElementById('attn-mobile-paid-year').value;
    if (!yearStr) return;
    const year = parseInt(yearStr);
    
    const storeId = window.appState?.currentUser?.StoreID;
    if (!storeId) {
        showAlert('エラー', '所属店舗情報を取得できないため、一覧を表示できません。');
        document.getElementById('attn-mobile-paid-list').innerHTML = '<div style="padding: 2rem; color: var(--danger); text-align: center;">エラー: 所属店舗不明</div>';
        return;
    }
    
    const listEl = document.getElementById('attn-mobile-paid-list');
    listEl.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 3rem 0;"><i class="fas fa-spinner fa-spin fa-2x"></i><div style="margin-top:1rem;font-size:0.9rem;">計算中...</div></div>';
    
    try {
        const empTypeFilter = document.getElementById('attn-mobile-paid-emp-type').value;
        
        // 共通関数を呼び出し（DOM非依存・既存仕様）
        const data = await calculatePaidLeaveMetrics(year, storeId, empTypeFilter, true); // true = isStoreManagerMode
        
        document.getElementById('attn-mobile-paid-base-display').textContent = data.baseHolidays;
        const wNode = document.getElementById('attn-mobile-paid-warning');
        if (wNode) {
            wNode.style.display = data.missingCalendar ? 'block' : 'none';
        }
        
        lastLoadedPaidLeaveMobileData = data;
        renderMobilePaidLeaveCards();
        
    } catch (err) {
        console.error(err);
        showAlert('エラー', '年間休日データの取得に失敗しました。');
        listEl.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 3rem 0; font-size: 0.9rem;">データ読み込みエラー</div>';
    }
}

// Escape helper
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Render cards
function renderMobilePaidLeaveCards() {
    const data = lastLoadedPaidLeaveMobileData;
    const listEl = document.getElementById('attn-mobile-paid-list');
    if (!listEl || !data) return;
    
    if (data.results.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 3rem 0; font-size: 0.9rem;">該当するスタッフがいません</div>';
        return;
    }
    
    const dowNames = ['日','月','火','水','木','金','土'];
    let html = '';
    
    data.results.sort((a,b) => a.code.localeCompare(b.code)).forEach(st => {
        const fixedStr = st.fixed_holidays.map(d => dowNames[d]).join('・') || 'なし';
        
        let reqStyle = "color: #1e293b;";
        let reqVal = `${st.required}日`;
        if (st.required > 0) {
            reqStyle = "color: #ef4444;";
        }
        
        const applyBaseHtml = st.isCustomBase 
            ? `<span style="color:var(--primary); font-weight:bold;">${st.applyBase}日 (個人)</span>`
            : `${st.applyBase}日`;
            
        html += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <!-- Card Header (Name, Metrics, Edit) -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; gap: 0.4rem;">
                    <div class="mobile-name-popover" data-name="${escapeHTML(st.name)}" data-store="${escapeHTML(st.store_name)}" style="flex: 1; min-width: 0; font-weight: 800; font-size: 0.95rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; padding-right: 0.2rem;">
                        ${escapeHTML(st.name)}
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 700; flex-shrink: 0;">
                        <span style="color: #64748b;">休日見込 <span style="color: #1e293b; font-size: 0.95rem;">${st.estimated}</span></span>
                        <span style="color: ${st.required > 0 ? '#ef4444' : '#64748b'};">不足 <span style="font-size: 0.95rem;">${st.required}</span></span>
                    </div>
                    <button class="btn-mobile-edit" data-uid="${st.id}" data-name="${escapeHTML(st.name)}" data-code="${escapeHTML(st.code)}" style="background: #f1f5f9; border: none; width: 44px; height: 44px; border-radius: 8px; color: #475569; font-size: 1rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-left: 0.2rem;">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
                
                <!-- Details Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; border-top: 1px dashed #e2e8f0; padding-top: 0.6rem;">
                    <div>
                        <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">適用休日基準</div>
                        <div style="font-size: 0.8rem; font-weight: 600; color: #475569;">${applyBaseHtml}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">取得済休日</div>
                        <div style="font-size: 0.8rem; font-weight: 600; color: #475569;">${st.achievedHolidays}日</div>
                    </div>
                    <div>
                        <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">固定休日設定</div>
                        <div style="font-size: 0.8rem; font-weight: 600; color: #475569;">${fixedStr}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">今後の会社休・重複</div>
                        <div style="font-size: 0.8rem; font-weight: 600; color: #475569;">会:${st.futureCompanyCount}日 / 重:${st.overlapCount}日</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    listEl.innerHTML = html;
}

// Popover Logic
function showMobileNamePopover(el, name, store) {
    const popover = document.getElementById('attn-mobile-name-popover');
    if (!popover) return;
    document.getElementById('attn-mobile-popover-name').textContent = name;
    document.getElementById('attn-mobile-popover-store').textContent = store;
    
    const rect = el.getBoundingClientRect();
    popover.style.display = 'block';
    
    // Position below the element
    popover.style.top = (rect.bottom + 8) + 'px';
    popover.style.left = Math.max(10, rect.left) + 'px';
    
    void popover.offsetWidth; // Trigger reflow
    popover.style.opacity = '1';
}

function hideMobileNamePopover() {
    const popover = document.getElementById('attn-mobile-name-popover');
    if (!popover) return;
    popover.style.opacity = '0';
    setTimeout(() => {
        if(popover.style.opacity === '0') popover.style.display = 'none';
    }, 200);
}

// Bottom Sheet Handlers
function openMobileBottomSheet(uid, name, code) {
    const data = lastLoadedPaidLeaveMobileData;
    if (!data) return;
    
    const yearStr = document.getElementById('attn-mobile-paid-year').value;
    const st = data.results.find(r => r.id === uid);
    if (!st) return;
    
    document.getElementById('attn-mobile-modal-name').textContent = name;
    document.getElementById('attn-mobile-modal-uid').value = uid;
    document.getElementById('attn-mobile-modal-year').value = yearStr;
    document.getElementById('attn-mobile-modal-year-label').textContent = yearStr;
    
    // Checkboxes
    document.querySelectorAll('input[name="mobile-paid-fixed-dow"]').forEach(cb => {
        cb.checked = st.fixed_holidays.includes(parseInt(cb.value));
    });
    
    // Custom Base (disabled for store manager)
    const cbInput = document.getElementById('attn-mobile-modal-custom-base');
    if (st.isCustomBase) {
        cbInput.value = st.applyBase;
    } else {
        cbInput.value = '';
    }
    
    // Show overlay and sheet
    const overlay = document.getElementById('attn-mobile-bottom-sheet-overlay');
    const sheet = document.getElementById('attn-mobile-bottom-sheet');
    overlay.style.display = 'block';
    setTimeout(() => {
        overlay.style.opacity = '1';
        sheet.style.bottom = '0';
    }, 10);
}

function closeMobileBottomSheet() {
    const overlay = document.getElementById('attn-mobile-bottom-sheet-overlay');
    const sheet = document.getElementById('attn-mobile-bottom-sheet');
    overlay.style.opacity = '0';
    sheet.style.bottom = '-100%';
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
}

// Save from Bottom Sheet
async function saveMobilePaidLeaveSettings() {
    const uid = document.getElementById('attn-mobile-modal-uid').value;
    const yearStr = document.getElementById('attn-mobile-modal-year').value;
    if (!uid || !yearStr) return;
    
    const btn = document.getElementById('btn-attn-mobile-modal-save');
    const origText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    btn.disabled = true;
    
    try {
        const newFixed = [];
        document.querySelectorAll('input[name="mobile-paid-fixed-dow"]:checked').forEach(cb => {
            newFixed.push(parseInt(cb.value));
        });
        
        // disabled input values aren't strictly needed for store manager since they are ignored by backend,
        // but we pass them anyway as undefined or empty.
        const cbVal = document.getElementById('attn-mobile-modal-custom-base').value;
        
        const storeId = window.appState?.currentUser?.StoreID;
        if (!storeId) {
            showAlert('エラー', '所属店舗情報を取得できないため、設定を保存できません。');
            btn.innerHTML = origText;
            btn.disabled = false;
            return;
        }

        // 共通保存関数を呼び出し
        await saveStaffPaidLeaveSettings(
            uid,
            yearStr,
            cbVal,
            newFixed,
            true, // isStoreManagerMode is always true here
            storeId
        );
        
        closeMobileBottomSheet();
        showAlert('成功', '設定を保存しました。');
        
        // Re-calculate and render
        loadPaidLeaveMobileData();
        
    } catch(e) {
        console.error(e);
        showAlert('エラー', '設定の保存に失敗しました: ' + e.message);
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
}

// Main Initialization
export async function initStoreManagerPaidLeaveMobilePage(options = {}) {
    initMobilePaidLeaveYearSelect();
    
    // Bind Search Button
    document.getElementById('btn-attn-mobile-search').addEventListener('click', loadPaidLeaveMobileData);
    
    // Bind list events (delegation for edit buttons and popovers)
    document.getElementById('attn-mobile-paid-list').addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-mobile-edit');
        if (editBtn) {
            openMobileBottomSheet(editBtn.dataset.uid, editBtn.dataset.name, editBtn.dataset.code);
            return;
        }
        
        const nameEl = e.target.closest('.mobile-name-popover');
        if (nameEl) {
            e.stopPropagation(); // prevent document click from firing immediately
            showMobileNamePopover(nameEl, nameEl.dataset.name, nameEl.dataset.store);
            return;
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.mobile-name-popover') && !e.target.closest('#attn-mobile-name-popover')) {
            hideMobileNamePopover();
        }
    });
    
    // Bind modal close events
    document.getElementById('btn-attn-mobile-modal-close').addEventListener('click', closeMobileBottomSheet);
    document.getElementById('attn-mobile-bottom-sheet-overlay').addEventListener('click', closeMobileBottomSheet);
    
    // Bind modal save event
    document.getElementById('btn-attn-mobile-modal-save').addEventListener('click', saveMobilePaidLeaveSettings);
}
