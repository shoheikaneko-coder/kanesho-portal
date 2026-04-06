import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc, writeBatch, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm } from './ui_utils.js';

/**
 * --- Shared State & Slots ---
 */
let currentSlot = {
    year: 0, month: 0, slot: 1, 
    startDate: null, endDate: null,
    deadLine: null
};

function calculateSlot() {
    const now = new Date();
    const day = now.getDate();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth() + 1;
    let slot = 1;

    if (day <= 10) {
        slot = 2; // 今月後半
        targetYear = now.getFullYear();
        targetMonth = now.getMonth() + 1;
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
 * --- HTML Templates ---
 */
const sharedModalHtml = `
    <!-- モーダル (共通) -->
    <div id="shift-input-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
        <div class="glass-panel animate-scale-in" style="width:100%; max-width:400px; padding:2rem;">
            <h4 id="modal-date-title" style="margin:0 0 1.5rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">時刻入力</h4>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div><label class="field-label">開始</label><input type="time" id="modal-start" class="form-input"></div>
                    <div><label class="field-label">終了</label><input type="time" id="modal-end" class="form-input"></div>
                </div>
                <div><label class="field-label">休憩(分)</label><input type="number" id="modal-break" class="form-input" value="0"></div>
                <div><label class="field-label">備考</label><input type="text" id="modal-note" class="form-input"></div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button id="btn-modal-clear" class="btn btn-secondary" style="flex:1;">削除</button>
                    <button id="btn-modal-save" class="btn btn-primary" style="flex:2;">保存</button>
                </div>
                <button onclick="document.getElementById('shift-input-modal').style.display='none'" class="btn" style="width:100%; font-size:0.8rem; margin-top:0.5rem;">キャンセル</button>
            </div>
        </div>
    </div>
`;

export const shiftSubmissionPageHtml = `
    <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding-bottom: 3rem;">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; border-left: 5px solid var(--primary);">
            <div>
                <h2 style="margin:0; font-size: 1.3rem; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-paper-plane" style="color: var(--primary);"></i>
                    シフト希望提出：<span id="shift-slot-title">----</span>
                </h2>
                <p style="margin: 0.4rem 0 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;" id="shift-deadline-info"></p>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button id="btn-save-as-template" class="btn btn-secondary" style="font-size: 0.85rem;"><i class="fas fa-save"></i> 基本型に保存</button>
                <button id="btn-apply-template" class="btn btn-secondary" style="font-size: 0.85rem;"><i class="fas fa-magic"></i> いつものパターン</button>
                <button id="btn-submit-shifts" class="btn btn-primary" style="font-size: 0.9rem; padding: 0.6rem 2rem; font-weight: 800;">提出する</button>
            </div>
        </div>
        <div id="staff-memo-area" class="glass-panel" style="padding: 1rem 1.5rem; margin-bottom: 2rem; border-left: 5px solid #10b981; display: none;">
            <div style="font-size: 0.75rem; color: #059669; font-weight: 800; margin-bottom: 0.5rem;"><i class="fas fa-bullhorn"></i> 店長からの連絡事項</div>
            <div id="staff-memo-text" style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.6; white-space: pre-wrap;"></div>
        </div>
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <div style="overflow-x: auto;">
                <table id="shift-submission-table" style="width: 100%; border-collapse: collapse; min-width: 1000px;">
                    <thead><tr id="shift-table-header"><th class="staff-cell">スタッフ</th></tr></thead>
                    <tbody id="shift-table-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    ${sharedModalHtml}
`;

export const shiftAdminPageHtml = `
    <div class="animate-fade-in" id="shift-admin-container" style="max-width: 100%; padding-bottom: 5rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
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

        <div class="glass-panel" style="padding: 1rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <h3 style="margin:0; font-size: 1.1rem; white-space: nowrap;"><span id="admin-slot-title">----</span></h3>
                <select id="admin-store-select" class="form-input" style="width: auto; min-width: 200px; margin: 0; padding: 0.4rem 0.8rem; font-weight: 700; height: 38px; display: none;">
                    <option value="">店舗を選択してください</option>
                </select>
                <span id="admin-active-store-label" style="font-weight: 700; color: var(--text-primary);"></span>
            </div>
            <div style="display: flex; gap: 0.8rem;">
                <button id="btn-add-help-staff" class="btn btn-secondary" style="font-size:0.85rem;"><i class="fas fa-user-plus"></i> ヘルプ追加</button>
                <button id="btn-publish-shifts" class="btn btn-primary" style="font-size:0.85rem; font-weight:800;">一括確定・公開</button>
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
let dailyGoalSales = {};
let adminMode = false;

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
        .sph-badge { display: inline-block; padding: 0.2rem 0.4rem; border-radius: 4px; color: white; font-size: 0.65rem; font-weight: 800; }
        .sph-good { background: var(--secondary); }
        .sph-warn { background: var(--warning); }
        .sph-danger { background: var(--primary); }
    `;
    document.head.appendChild(s);
};

/**
 * --- Initialization ---
 */
export async function initShiftSubmissionPage() {
    console.log("Initializing Shift Submission Page...");
    injectStyles();
    adminMode = false;
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    currentTargetUser = user;
    calculateSlot();
    
    document.getElementById('shift-slot-title').textContent = `${currentSlot.year}/${currentSlot.month} ${currentSlot.slot === 1 ? '前半' : '後半'}`;
    document.getElementById('shift-deadline-info').textContent = `提出締切: ${currentSlot.deadLine}`;
    
    const sid = user.StoreID || user.StoreId || 'UNKNOWN';
    await loadShiftMemoForStaff(sid);
    await renderSubmissionGrid();
    setupSubmissionEvents();
    await loadShiftsBatch(null, user.id);
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

    const isAdmin = user.Role === 'Admin' || user.Role === '管理者';
    const storeSelect = document.getElementById('admin-store-select');
    const storeLabel = document.getElementById('admin-active-store-label');
    
    document.getElementById('admin-slot-title').textContent = `${currentSlot.year}/${currentSlot.month} ${currentSlot.slot === 1 ? '前半' : '後半'}`;

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
            
            await Promise.all([
                loadDailyGoalData(sid),
                loadStoreStaff(sid, storeName), 
                loadShiftsBatch(sid),
                loadShiftMemo(sid)
            ]);
            
            renderAdminGrid(); 
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
                await updateView(mySid);
            }
            storeSelect.onchange = (e) => {
                if (e.target.value) updateView(e.target.value);
            };
        }
    } else {
        const sid = user.StoreID || user.StoreId || 'UNKNOWN';
        await updateView(sid);
    }

    document.getElementById('btn-add-help-staff').onclick = openHelpStaffModal;
    document.getElementById('btn-publish-shifts').onclick = publishShifts;
    document.getElementById('btn-save-memo').onclick = saveShiftMemo;
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
    if (sid) helpUsers = [];

    snap.forEach(d => {
        const data = d.data();
        if (!data || !data.userId) return;
        if (sid && data.storeId != sid) return;
        if (uid && data.userId !== uid) return;

        if (!currentShifts[data.userId]) currentShifts[data.userId] = {};
        currentShifts[data.userId][data.date] = data;

        if (sid && !allStoreUsers.some(u => u.id === data.userId) && !helpUsers.some(u => u.id === data.userId)) {
            helpUsers.push({ id: data.userId, Name: data.userName, isHelp: true });
        }
        
        // 元の表示期間内のセルのみ描画
        if (data.date >= currentSlot.startDate.toISOString().split('T')[0] && data.date <= currentSlot.endDate.toISOString().split('T')[0]) {
            renderCellUI(data.userId, data.date, data);
        }
    });
}

function getExtendedRange(start, end) {
    const s = new Date(start);
    s.setDate(s.getDate() - s.getDay()); 
    const e = new Date(end);
    e.setDate(e.getDate() + (6 - e.getDay()));
    return { 
        start: s.toISOString().split('T')[0], 
        end: e.toISOString().split('T')[0] 
    };
}

async function loadDailyGoalData(sid) {
    if (!sid) return;
    dailyGoalSales = {};
    const ym = `${currentSlot.year}-${String(currentSlot.month).padStart(2, '0')}`;
    try {
        const q = query(collection(db, "monthly_goals"), where("month", "==", ym));
        const snap = await getDocs(q);
        snap.forEach(d => {
            const g = d.data();
            if (g.store_id == sid) {
                const lastD = new Date(currentSlot.year, currentSlot.month, 0).getDate();
                const unit = (g.sales_target || 0) / 30;
                for (let i = 0; i < 35; i++) {
                    const t = new Date(currentSlot.startDate); t.setDate(t.getDate() + i);
                    if (t > currentSlot.endDate) break;
                    dailyGoalSales[t.toISOString().split('T')[0]] = Math.round(unit);
                }
            }
        });
        
        // 互換性チェック
        const gSnap = await getDoc(doc(db, "t_monthly_goals", `${ym}_${sid}`));
        if (gSnap.exists()) {
            const g = gSnap.data();
            const unit = (g.sales_target || 0) / 30;
            const lastD = new Date(currentSlot.year, currentSlot.month, 0).getDate();
            for (let i = 0; i < 35; i++) {
                const t = new Date(currentSlot.startDate); t.setDate(t.getDate() + i);
                if (t > currentSlot.endDate) break;
                dailyGoalSales[t.toISOString().split('T')[0]] = Math.round(unit);
            }
        }
    } catch (e) { console.error("Goals load error:", e); }
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
            const ymd = d.toISOString().split('T')[0];
            header.innerHTML += `<th class="date-hdr" onclick="window.showHourlyGraph('${ymd}')">${d.getDate()}<br>${['日','月','火','水','木','金','土'][d.getDay()]}</th>`;
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
            tr.innerHTML = `<td class="staff-cell">
                <div style="display:flex; flex-direction:column; justify-content:center; text-align:left; line-height:1.2;">
                    <div style="display:flex; align-items:center; gap:0.3rem;">
                        ${u.isHelp ? '<span class="badge" style="background:#f5f3ff; color:#7c3aed; font-size:0.55rem; padding:0.1rem 0.2rem;">ヘルプ</span>' : ''}
                        <span style="font-weight:700;">${u.DisplayName || u.Name}</span>
                    </div>
                    ${roleName ? `<div style="font-size:0.6rem; color:var(--text-secondary); font-weight:500; margin-top:0.1rem;">${roleName}</div>` : ''}
                </div>
            </td>`;
            for (let i = 0; i < span; i++) {
                const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
                const ymd = d.toISOString().split('T')[0];
                tr.innerHTML += `<td class="shift-cell" id="cell-${u.id}-${ymd}" onclick="window.openTimeInput('${ymd}', '${u.id}')"></td>`;
            }
            body.appendChild(tr);
            for(let i=0; i<span; i++){
                const d = new Date(currentSlot.startDate); d.setDate(d.getDate()+i);
                const ymd = d.toISOString().split('T')[0];
                if(currentShifts[u.id]?.[ymd]) renderCellUI(u.id, ymd, currentShifts[u.id][ymd]);
            }
        });
    } catch (e) { console.error("Error in renderAdminGrid:", e); }
}

async function renderSubmissionGrid() {
    const header = document.getElementById('shift-table-header');
    const body = document.getElementById('shift-table-body');
    const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    header.innerHTML = '<th class="staff-cell">スタッフ</th>';
    for (let i = 0; i < span; i++) {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        header.innerHTML += `<th class="date-hdr">${d.getDate()}<br>${['日','月','火','水','木','金','土'][d.getDay()]}</th>`;
    }

    const roleMap = { 'Manager': '店長', 'Admin': '管理者', 'Staff': '一般社員', 'PartTimer': 'アルバイト' };
    const roleName = roleMap[currentTargetUser.Role] || currentTargetUser.Role || '';

    body.innerHTML = `<tr><td class="staff-cell">
        <div style="display:flex; flex-direction:column; justify-content:center; text-align:left; line-height:1.2;">
            <span style="font-weight:700;">${currentTargetUser.DisplayName || currentTargetUser.Name}</span>
            ${roleName ? `<div style="font-size:0.6rem; color:var(--text-secondary); font-weight:500; margin-top:0.1rem;">${roleName}</div>` : ''}
        </div>
    </td>${Array.from({length: span}).map((_, i) => {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = d.toISOString().split('T')[0];
        return `<td class="shift-cell" id="cell-${currentTargetUser.id}-${ymd}" onclick="window.openTimeInput('${ymd}', '${currentTargetUser.id}')"></td>`;
    }).join('')}</tr>`;
}

function renderCellUI(uid, date, data) {
    const cell = document.getElementById(`cell-${uid}-${date}`);
    if (!cell) return;
    if (!data || !data.start) { cell.innerHTML = ''; return; }
    cell.innerHTML = `<div class="shift-box ${data.status === 'confirmed' ? '' : 'applied'}"><div>${data.start}-${data.end}</div></div>`;
}

/**
 * --- Actions ---
 */
window.openTimeInput = (date, uid) => {
    const user = allStoreUsers.find(u => u.id === uid) || helpUsers.find(u => u.id === uid) || (uid === currentTargetUser?.id ? currentTargetUser : null);
    if (!user) return;
    const existing = (currentShifts[uid] && currentShifts[uid][date]) ? currentShifts[uid][date] : {};
    
    document.getElementById('modal-date-title').textContent = `${user.DisplayName || user.Name} (${date})`;
    document.getElementById('modal-start').value = existing.start || "";
    document.getElementById('modal-end').value = existing.end || "";
    document.getElementById('modal-break').value = existing.breakMin || 0;
    document.getElementById('modal-note').value = existing.note || "";
    document.getElementById('shift-input-modal').style.display = 'flex';

    document.getElementById('btn-modal-save').onclick = async () => {
        const s = document.getElementById('modal-start').value;
        const e = document.getElementById('modal-end').value;
        if (!s || !e) return;

        const me = JSON.parse(localStorage.getItem('currentUser'));
        const sid = adminMode ? (window.currentAdminStoreId || me.StoreID || me.StoreId) : (user.StoreID || user.StoreId || 'UNKNOWN');
        const sName = adminMode ? (window.currentAdminStoreName || '管理店舗') : (user.Store || '所属店舗');

        const conflict = await checkDoubleBooking(uid, date, s, e);
        if (conflict) return showAlert('⚠ 重複', `【${conflict.storeName}】ですでに確定済みのシフトと重なっています。`);

        const news = {
            userId: uid, userName: user.Name, date, start: s, end: e,
            breakMin: parseInt(document.getElementById('modal-break').value) || 0,
            note: document.getElementById('modal-note').value,
            status: adminMode ? 'confirmed' : 'applied',
            storeId: sid, storeName: sName, updatedAt: new Date().toISOString()
        };

        if (!currentShifts[uid]) currentShifts[uid] = {};
        currentShifts[uid][date] = news;
        renderCellUI(uid, date, news);
        document.getElementById('shift-input-modal').style.display = 'none';
        await setDoc(doc(db, "t_shifts", `${date}_${uid}`), news);
        if (adminMode) updateOverallKPIs();
    };

    document.getElementById('btn-modal-clear').onclick = async () => {
        if(currentShifts[uid]) delete currentShifts[uid][date];
        renderCellUI(uid, date, null);
        document.getElementById('shift-input-modal').style.display = 'none';
        await deleteDoc(doc(db, "t_shifts", `${date}_${uid}`));
        if (adminMode) updateOverallKPIs();
    };
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
    const startDateStr = currentSlot.startDate.toISOString().split('T')[0];
    const endDateStr = currentSlot.endDate.toISOString().split('T')[0];

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
    document.getElementById('admin-avg-sph').textContent = `¥ ${Math.round(hours > 0 ? target/hours : 0).toLocaleString()}`;
    
    // 28時間制限計算 (週次)
    const range = getExtendedRange(currentSlot.startDate, currentSlot.endDate);
    const alertsCont = document.getElementById('admin-28h-alerts');
    const violations = [];

    users.forEach(u => {
        if (!u.Has28hLimit) return;
        
        // 週ごとの集計
        let tempDate = new Date(range.start);
        const limitEnd = new Date(range.end);
        
        while (tempDate <= limitEnd) {
            let weekHours = 0;
            const weekStart = new Date(tempDate);
            const weekEnd = new Date(tempDate);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            // その週の時間を合計
            for (let j = 0; j < 7; j++) {
                const checkD = new Date(weekStart);
                checkD.setDate(checkD.getDate() + j);
                const iso = checkD.toISOString().split('T')[0];
                const s = currentShifts[u.id]?.[iso];
                if (s && s.start) {
                    const sA = s.start.split(':').map(Number); const eA = s.end.split(':').map(Number);
                    let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60); if (h < 0) h += 24;
                    weekHours += Math.max(0, h - (s.breakMin || 0)/60);
                }
            }
            
            if (weekHours > 28) {
                const weekLabel = `${weekStart.getMonth()+1}/${weekStart.getDate()}週`;
                violations.push(`${u.DisplayName || u.Name} (${weekLabel}: ${weekHours.toFixed(1)}h)`);
                break; // 1つでもあればこの人は違反者
            }
            tempDate.setDate(tempDate.getDate() + 7);
        }
    });

    if (alertsCont) {
        if (violations.length > 0) {
            alertsCont.innerHTML = violations.map(v => `<div style="color:#ef4444;"><i class="fas fa-times-circle"></i> ${v}</div>`).join('');
        } else {
            alertsCont.innerHTML = '<span style="color:#10b981;"><i class="fas fa-check-circle"></i> 超過なし</span>';
        }
    }

    renderAdminFooter();
}

function renderAdminFooter() {
    const foot = document.getElementById('admin-table-foot');
    if (!foot) return;
    foot.innerHTML = '';
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="staff-cell">人時売上</td>';
    const span = Math.round((currentSlot.endDate - currentSlot.startDate) / (1000 * 60 * 60 * 24)) + 1;
    for (let i = 0; i < span; i++) {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = d.toISOString().split('T')[0];
        let dayH = 0;
        [...allStoreUsers, ...helpUsers].forEach(u => {
            const s = currentShifts[u.id]?.[ymd];
            if (s && s.start) {
                const sA = s.start.split(':').map(Number); const eA = s.end.split(':').map(Number);
                let h = (eA[0]+eA[1]/60) - (sA[0]+sA[1]/60); if(h<0) h+=24;
                dayH += Math.max(0, h - (s.breakMin||0)/60);
            }
        });
        const sph = dayH > 0 ? (dailyGoalSales[ymd] / dayH) : 0;
        let cls = 'sph-good'; if(sph < 4000) cls = 'sph-danger'; else if(sph < 5000) cls = 'sph-warn';
        tr.innerHTML += `<td><span class="sph-badge ${cls}">¥${Math.round(sph).toLocaleString()}</span></td>`;
    }
    foot.appendChild(tr);
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
    const ok = await showConfirm('一括確定', 'この店舗の全ての未提出希望（グレー表示）を確定（赤表示）させ、公開しますか？');
    if (!ok) return;

    const btn = document.getElementById('btn-publish-shifts');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';

    const batch = writeBatch(db);
    let count = 0;
    for(const uid in currentShifts){
        for(const ymd in currentShifts[uid]){
            const s = currentShifts[uid][ymd];
            if(s.status === 'applied'){
                s.status = 'confirmed';
                batch.set(doc(db, "t_shifts", `${ymd}_${uid}`), s);
                count++;
            }
        }
    }
    
    try {
        if(count > 0) {
            await batch.commit();
            
            // --- Phase 3: 自動通知の生成 ---
            try {
                const me = JSON.parse(localStorage.getItem('currentUser'));
                const sid = window.currentAdminStoreId || me.StoreID || me.StoreId;
                const sName = window.currentAdminStoreName || '所属店舗';
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
            } catch (notifErr) {
                console.error("Failed to create notification:", notifErr);
                // 通知生成に失敗しても元のシフト確定は成功しているので続行
            }

            showAlert('成功', `${count}件のシフトを確定・公開し、スタッフへ通知を送信しました。`);
        } else {
            showAlert('案内', '新しく確定が必要な未処理の希望はありませんでした。');
        }
        renderAdminGrid();
        updateOverallKPIs();
    } catch (e) {
        console.error(e);
        showAlert('エラー', '一括確定中にエラーが発生しました。');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '一括確定・公開';
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
        item.onclick = () => { helpUsers.push({id: d.id, Name: u.Name, isHelp: true}); renderAdminGrid(); document.body.removeChild(modal); };
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
            const ymd = d.toISOString().split('T')[0];
            const dow = d.getDay();
            if(temp[dow]) {
                const s = { userId: currentTargetUser.id, userName: currentTargetUser.Name, date: ymd, start: temp[dow].start, end: temp[dow].end, status: 'applied', storeId: currentTargetUser.StoreID || 'UNKNOWN' };
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
