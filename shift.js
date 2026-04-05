import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
    currentSlot.deadLine = (slot === 2) ? `${targetMonth}月10日` : `${now.getMonth() + 1}月25日`;
}

/**
 * --- HTML Templates ---
 */

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
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <div style="overflow-x: auto;">
                <table id="shift-submission-table" style="width: 100%; border-collapse: collapse; min-width: 1000px;">
                    <thead><tr id="shift-table-header"><th class="staff-cell">スタッフ</th></tr></thead>
                    <tbody id="shift-table-body"></tbody>
                </table>
            </div>
        </div>
    </div>

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

export const shiftAdminPageHtml = `
    <div class="animate-fade-in" style="max-width: 100%; padding-bottom: 5rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div class="glass-panel" style="padding: 1.2rem; border-left: 5px solid var(--primary);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">15日間の想定人件費</div>
                <div id="admin-total-labor-cost" style="font-size: 1.8rem; font-weight: 900; color: var(--primary);">¥ 0</div>
            </div>
            <div class="glass-panel" style="padding: 1.2rem; border-left: 5px solid var(--secondary);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">期間平均人時売上</div>
                <div id="admin-avg-sph" style="font-size: 1.8rem; font-weight: 900; color: var(--secondary);">¥ 0</div>
            </div>
            <div class="glass-panel" style="padding: 1.2rem; border-left: 5px solid #8b5cf6;">
                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">総人時</div>
                <div id="admin-total-hours" style="font-size: 1.8rem; font-weight: 900; color: #7c3aed;">0.0 h</div>
            </div>
        </div>

        <div class="glass-panel" style="padding: 1rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin:0; font-size: 1.1rem;"><span id="admin-slot-title">----</span> | <span id="admin-active-store">----</span></h3>
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
`;

/**
 * --- Common Styles ---
 */
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
        .shift-box { background: var(--primary); color: white; border-radius: 6px; padding: 0.3rem; font-size: 0.7rem; font-weight: 800; display: flex; flex-direction: column; justify-content: center; height: 100%; }
        .shift-box.applied { background: #94a3b8; }
        .sph-badge { display: inline-block; padding: 0.2rem 0.4rem; border-radius: 4px; color: white; font-size: 0.65rem; font-weight: 800; }
        .sph-good { background: var(--secondary); }
        .sph-warn { background: var(--warning); }
        .sph-danger { background: var(--primary); }
    `;
    document.head.appendChild(s);
};

/**
 * --- Logic Phase 1: Staff ---
 */
let currentShifts = {}; // { uid: { ymd: data } }
let currentTargetUser = null;

export async function initShiftSubmissionPage() {
    injectStyles();
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    currentTargetUser = user;
    calculateSlot();
    
    document.getElementById('shift-slot-title').textContent = `${currentSlot.year}/${currentSlot.month} ${currentSlot.slot === 1 ? '前半' : '後半'}`;
    document.getElementById('shift-deadline-info').textContent = `提出締切: ${currentSlot.deadLine}`;
    
    await renderSubmissionGrid();
    await loadShiftsBatch(null, user.id);
    setupTemplateEvents();
    
    document.getElementById('btn-submit-shifts').onclick = async () => {
        const ok = await showConfirm('シフト提出', '希望を反映させて提出しますか？');
        if (ok) showAlert('成功', '提出されました。店長の確定をお待ちください。');
    };
}

async function renderSubmissionGrid() {
    const header = document.getElementById('shift-table-header');
    const body = document.getElementById('shift-table-body');
    const span = (currentSlot.endDate.getDate() - currentSlot.startDate.getDate()) + 1;
    
    header.innerHTML = '<th class="staff-cell">スタッフ</th>';
    for (let i = 0; i < span; i++) {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        header.innerHTML += `<th class="date-hdr">${d.getDate()}<br>${['日','月','火','水','木','金','土'][d.getDay()]}</th>`;
    }

    body.innerHTML = `<tr><td class="staff-cell">${currentTargetUser.Name}</td>${Array.from({length: span}).map((_, i) => {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = d.toISOString().split('T')[0];
        return `<td class="shift-cell" id="cell-${currentTargetUser.id}-${ymd}" onclick="window.openTimeInput('${ymd}', '${currentTargetUser.id}')"></td>`;
    }).join('')}</tr>`;
}

/**
 * --- Logic Phase 2: Admin ---
 */
let allStoreUsers = [];
let helpUsers = [];
let dailyGoalSales = {};
let adminMode = false;

export async function initShiftAdminPage() {
    injectStyles();
    adminMode = true;
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    calculateSlot();
    const sid = user.StoreID || user.StoreId || 'UNKNOWN';

    document.getElementById('admin-slot-title').textContent = `${currentSlot.year}/${currentSlot.month} ${currentSlot.slot === 1 ? '前半' : '後半'}`;
    const sSnap = await getDoc(doc(db, "m_stores", sid));
    document.getElementById('admin-active-store').textContent = sSnap.exists() ? sSnap.data().store_name : sid;

    await loadDailyGoalData(sid);
    await loadStoreStaff(sid);
    await loadShiftsBatch(sid);
    renderAdminGrid();
    updateOverallKPIs();

    document.getElementById('btn-add-help-staff').onclick = openHelpStaffModal;
    document.getElementById('btn-publish-shifts').onclick = publishShifts;
}

async function loadStoreStaff(sid) {
    const q = query(collection(db, "m_users"), where("StoreID", "==", sid));
    const snap = await getDocs(q);
    allStoreUsers = [];
    snap.forEach(d => { allStoreUsers.push({ id: d.id, ...d.data() }); });
}

async function loadShiftsBatch(sid, uid = null) {
    const s = currentSlot.startDate.toISOString().split('T')[0];
    const e = currentSlot.endDate.toISOString().split('T')[0];
    let q;
    if (sid) q = query(collection(db, "t_shifts"), where("storeId", "==", sid), where("date", ">=", s), where("date", "<=", e));
    else q = query(collection(db, "t_shifts"), where("userId", "==", uid), where("date", ">=", s), where("date", "<=", e));
    
    const snap = await getDocs(q);
    currentShifts = {};
    if (sid) helpUsers = [];
    snap.forEach(d => {
        const data = d.data();
        if (!currentShifts[data.userId]) currentShifts[data.userId] = {};
        currentShifts[data.userId][data.date] = data;
        if (sid && !allStoreUsers.some(u => u.id === data.userId) && !helpUsers.some(u => u.id === data.userId)) {
            helpUsers.push({ id: data.userId, Name: data.userName, isHelp: true });
        }
        renderCellUI(data.userId, data.date, data);
    });
}

function renderCellUI(uid, date, data) {
    const cell = document.getElementById(`cell-${uid}-${date}`);
    if (!cell) return;
    if (!data || !data.start) { cell.innerHTML = ''; return; }
    cell.innerHTML = `<div class="shift-box ${data.status === 'confirmed' ? '' : 'applied'}"><div>${data.start}-${data.end}</div></div>`;
}

function renderAdminGrid() {
    const body = document.getElementById('admin-table-body');
    const header = document.getElementById('admin-table-header');
    const span = (currentSlot.endDate.getDate() - currentSlot.startDate.getDate()) + 1;
    
    header.innerHTML = '<th class="staff-cell">スタッフ</th>';
    for (let i = 0; i < span; i++) {
        const d = new Date(currentSlot.startDate); d.setDate(d.getDate() + i);
        const ymd = d.toISOString().split('T')[0];
        header.innerHTML += `<th class="date-hdr" onclick="window.showHourlyGraph('${ymd}')">${d.getDate()}<br>${['日','月','火','水','木','金','土'][d.getDay()]}</th>`;
    }

    body.innerHTML = '';
    const list = [...allStoreUsers, ...helpUsers];
    list.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="staff-cell">${u.isHelp ? '<span style="color:#8b5cf6;">⭐</span>' : ''}${u.Name}</td>`;
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
}

/**
 * --- Shared Actions ---
 */
window.openTimeInput = (date, uid) => {
    const user = allStoreUsers.find(u => u.id === uid) || helpUsers.find(u => u.id === uid) || (uid === currentTargetUser?.id ? currentTargetUser : null);
    if (!user) return;
    const existing = (currentShifts[uid] && currentShifts[uid][date]) ? currentShifts[uid][date] : {};
    
    document.getElementById('modal-date-title').textContent = `${user.Name} (${date})`;
    document.getElementById('modal-start').value = existing.start || "";
    document.getElementById('modal-end').value = existing.end || "";
    document.getElementById('modal-break').value = existing.breakMin || 0;
    document.getElementById('modal-note').value = existing.note || "";
    document.getElementById('shift-input-modal').style.display = 'flex';

    document.getElementById('btn-modal-save').onclick = async () => {
        const s = document.getElementById('modal-start').value;
        const e = document.getElementById('modal-end').value;
        if (!s || !e) return;

        const conflict = await checkDoubleBooking(uid, date, s, e);
        if (conflict) return showAlert('⚠ 重複', `【${conflict.storeName}】ですでに確定済みのシフトと重なっています。`);

        const me = JSON.parse(localStorage.getItem('currentUser'));
        const news = {
            userId: uid, userName: user.Name, date, start: s, end: e,
            breakMin: parseInt(document.getElementById('modal-break').value) || 0,
            note: document.getElementById('modal-note').value,
            status: adminMode ? 'confirmed' : 'applied',
            storeId: adminMode ? me.StoreID : (user.StoreID || 'UNKNOWN'),
            storeName: adminMode ? document.getElementById('admin-active-store').textContent : 'UNKNOWN',
            updatedAt: new Date().toISOString()
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
    const currentMyStoreID = JSON.parse(localStorage.getItem('currentUser')).StoreID;
    snap.forEach(d => {
        const data = d.data();
        if (data.storeId === currentMyStoreID) return;
        const s1 = parseInt(s.replace(':','')), e1 = parseInt(e.replace(':',''));
        const s2 = parseInt(data.start.replace(':','')), e2 = parseInt(data.end.replace(':',''));
        if (Math.max(s1, s2) < Math.min(e1, e2)) conflict = { storeName: data.storeName || data.storeId };
    });
    return conflict;
}

async function loadDailyGoalData(sid) {
    dailyGoalSales = {};
    const ym = `${currentSlot.year}-${String(currentSlot.month).padStart(2, '0')}`;
    const gSnap = await getDoc(doc(db, "t_monthly_goals", `${ym}_${sid}`));
    if (!gSnap.exists()) return;
    const g = gSnap.data();
    const lastD = new Date(currentSlot.year, currentSlot.month, 0).getDate();
    const unit = (g.sales_target || 0) / 30; // 簡易案。本来は指数計算
    for (let i = 0; i < 35; i++) {
        const t = new Date(currentSlot.startDate); t.setDate(t.getDate() + i);
        if (t > currentSlot.endDate) break;
        dailyGoalSales[t.toISOString().split('T')[0]] = Math.round(unit);
    }
}

function updateOverallKPIs() {
    let hours = 0; let target = 0; let cost = 0;
    const users = [...allStoreUsers, ...helpUsers];
    for (let ymd in dailyGoalSales) {
        target += dailyGoalSales[ymd];
        users.forEach(u => {
            const s = currentShifts[u.id]?.[ymd];
            if (s && s.start && s.end) {
                const sA = s.start.split(':').map(Number); const eA = s.end.split(':').map(Number);
                let h = (eA[0] + eA[1]/60) - (sA[0] + sA[1]/60);
                if (h < 0) h += 24;
                const net = Math.max(0, h - (s.breakMin || 0)/60);
                hours += net; cost += net * (u.Wage || 1200);
            }
        });
    }
    document.getElementById('admin-total-labor-cost').textContent = `¥ ${Math.round(cost).toLocaleString()}`;
    document.getElementById('admin-avg-sph').textContent = `¥ ${Math.round(hours > 0 ? target/hours : 0).toLocaleString()}`;
    document.getElementById('admin-total-hours').textContent = `${hours.toFixed(1)} h`;
    renderAdminFooter();
}

function renderAdminFooter() {
    const foot = document.getElementById('admin-table-foot');
    if (!foot) return;
    foot.innerHTML = '';
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="staff-cell">人時売上</td>';
    const span = (currentSlot.endDate.getDate() - currentSlot.startDate.getDate()) + 1;
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
    const btn = document.getElementById('btn-copy-for-line');
    panel.style.display = 'block';
    title.textContent = `${date} 人数グラフ`;
    btn.onclick = () => window.copyShiftForLine(date);
    
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
    const list = [...allStoreUsers, ...helpUsers].map(u => {
        const s = currentShifts[u.id]?.[date];
        return s ? `${u.isHelp?'[助]':''} ${u.Name.padEnd(5,' ')} ${s.start}-${s.end}` : null;
    }).filter(x => x);
    const text = `【シフト連絡】 ${date}\n----------------\n${list.join('\n')}\n----------------\n本日もお願いします！`;
    await navigator.clipboard.writeText(text);
    showAlert('完了', 'コピーしました。LINEへ貼り付けてください。');
};

async function publishShifts() {
    const batch = writeBatch(db);
    let count = 0;
    for(let uid in currentShifts){
        for(let ymd in currentShifts[uid]){
            const s = currentShifts[uid][ymd];
            if(s.status === 'applied'){
                s.status = 'confirmed';
                batch.set(doc(db, "t_shifts", `${ymd}_${uid}`), s);
                count++;
            }
        }
    }
    if(count > 0) {
        await batch.commit();
        showAlert('成功', `${count}件を確定しました。`);
        renderAdminGrid();
        updateOverallKPIs();
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

function setupTemplateEvents() {
    document.getElementById('btn-apply-template').onclick = async () => {
        const snap = await getDoc(doc(db, "m_shift_templates", currentTargetUser.id));
        if(!snap.exists()) return showAlert('案内', '先に基本型を保存してください');
        const temp = snap.data().patterns;
        const span = (currentSlot.endDate.getDate() - currentSlot.startDate.getDate()) + 1;
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
        for(let ymd in currentShifts[currentTargetUser.id]){
            const s = currentShifts[currentTargetUser.id][ymd];
            patterns[new Date(ymd).getDay()] = { start: s.start, end: s.end };
        }
        await setDoc(doc(db, "m_shift_templates", currentTargetUser.id), { patterns });
        showAlert('成功', '保存しました');
    };
}
