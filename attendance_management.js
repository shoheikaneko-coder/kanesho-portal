import { 
    collection, getDocs, query, where, orderBy, doc, getDoc, 
    setDoc, addDoc, deleteDoc, writeBatch, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm } from './ui_utils.js';

// ─── HTML テンプレート ────────────────────────────────────────
export const attendanceManagementPageHtml = `
<div id="attendance-mgmt-container" class="animate-fade-in">
    
    <!-- 1. トップハブ画面 -->
    <div id="attn-hub-view" class="view-section">
        <div style="margin-bottom: 2rem;">
            <p style="color: var(--text-secondary);">勤怠状況の確認・編集およびデータの出力を行います。</p>
        </div>

        <div class="menu-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;">
            <div class="glass-panel menu-card" onclick="window.switchAttnView('monthly')">
                <i class="fas fa-calendar-alt"></i>
                <h3>月別データ</h3>
                <p>従業員の月間集計を確認します</p>
            </div>
            <div class="glass-panel menu-card" onclick="window.switchAttnView('daily')">
                <i class="fas fa-calendar-day"></i>
                <h3>日別データ</h3>
                <p>店舗ごとの日次実績を確認・編集します</p>
            </div>
            <div class="glass-panel menu-card" id="btn-attn-error-check">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>エラーチェック</h3>
                <p>打刻漏れや不整合を確認します (準備中)</p>
            </div>
            <div class="glass-panel menu-card" onclick="window.navigateTo('csv_export')">
                <i class="fas fa-file-export"></i>
                <h3>データ出力</h3>
                <p>外部給与ソフト用CSVを出力します</p>
            </div>
        </div>
    </div>

    <!-- 2. 月別実績画面 -->
    <div id="attn-monthly-view" class="view-section" style="display: none;">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
                <div class="input-group" style="margin-bottom: 0; min-width: 150px;">
                    <label>対象月</label>
                    <input type="month" id="attn-month-select" style="padding: 0.6rem;">
                </div>
                <div class="input-group" style="margin-bottom: 0; min-width: 180px;">
                    <label>店舗絞り込み</label>
                    <select id="attn-mon-store-filter" class="store-selector" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px;">
                        <option value="">全店舗</option>
                    </select>
                </div>
                <button id="btn-attn-monthly-refresh" class="btn btn-primary" style="padding: 0.65rem 1.5rem;">
                    <i class="fas fa-search"></i> 表示
                </button>
                <button onclick="window.switchAttnView('hub')" class="btn" style="padding: 0.65rem 1.2rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1px solid var(--border); color: var(--text-secondary);">
                            <th style="padding: 1rem;">コード</th>
                            <th style="padding: 1rem;">名前</th>
                            <th style="padding: 1rem;">所属店舗</th>
                            <th style="padding: 1rem; text-align: right;">出勤日数</th>
                            <th style="padding: 1rem; text-align: right;">総労働時間</th>
                            <th style="padding: 1rem; text-align: right;">深夜時間</th>
                            <th style="padding: 1rem; text-align: center;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="attn-monthly-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 3. 日別実績画面 -->
    <div id="attn-daily-view" class="view-section" style="display: none;">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
                <div class="input-group" style="margin-bottom: 0; min-width: 150px;">
                    <label>表示日</label>
                    <input type="date" id="attn-daily-date" style="padding: 0.6rem;">
                </div>
                <div class="input-group" style="margin-bottom: 0; min-width: 180px;">
                    <label>店舗</label>
                    <select id="attn-day-store-filter" class="store-selector" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px;">
                        <!-- JSで描画 -->
                    </select>
                </div>
                <button id="btn-attn-daily-refresh" class="btn btn-primary" style="padding: 0.65rem 1.5rem;">
                    <i class="fas fa-search"></i> 表示
                </button>
                <button onclick="window.switchAttnView('hub')" class="btn" style="padding: 0.65rem 1.2rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1px solid var(--border); color: var(--text-secondary);">
                            <th style="padding: 1rem;">コード</th>
                            <th style="padding: 1rem;">名前</th>
                            <th style="padding: 1rem;">出勤</th>
                            <th style="padding: 1rem;">退勤</th>
                            <th style="padding: 1rem; text-align: right;">労働h</th>
                            <th style="padding: 1rem; text-align: center;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="attn-daily-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 4. 実績編集画面 -->
    <div id="attn-edit-view" class="view-section" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
                <h2 id="attn-edit-title" style="margin: 0;">勤務データ編集</h2>
                <p id="attn-edit-subtitle" style="margin:0.2rem 0 0; font-size: 0.9rem; color: var(--text-secondary);"></p>
            </div>
            <div style="display: flex; gap: 0.7rem;">
                <button id="btn-attn-save" class="btn btn-primary">
                    <i class="fas fa-save"></i> 保存
                </button>
                <button onclick="window.switchAttnView('daily')" class="btn" style="background: #f1f5f9; color: #475569;">
                    キャンセル
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; color: var(--text-secondary);">打刻一覧</h4>
                <button id="btn-add-punch-row" class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border: 1px solid var(--primary); color: var(--primary);">
                    <i class="fas fa-plus"></i> 行追加
                </button>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border);">
                            <th style="padding: 0.8rem;">打刻種別</th>
                            <th style="padding: 0.8rem;">日付</th>
                            <th style="padding: 0.8rem;">時刻</th>
                            <th style="padding: 0.8rem;">所属店舗</th>
                            <th style="padding: 0.8rem; text-align: center;">削除</th>
                        </tr>
                    </thead>
                    <tbody id="attn-edit-body"></tbody>
                </table>
            </div>
            <div style="margin-top: 1.5rem; padding: 1rem; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px;">
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-user-clock" style="color: var(--primary);"></i>
                    勤怠管理 <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 400; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; margin-left: 0.5rem;">v1.4</span>
                </h2>
                <p style="margin: 0; font-size: 0.8rem; color: #92400e; line-height: 1.5;">
                    <i class="fas fa-info-circle"></i> <b>ご注意:</b><br>
                    深夜0時を過ぎた退勤などは、日付を翌日のものに設定してください。業務日の集計範囲（日替わり時刻）に基づき、自動的に前日の営業実績として処理されます。
                </p>
            </div>
        </div>
    </div>

</div>

<style>
    #attendance-mgmt-container .menu-card {
        padding: 2rem 1.5rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid var(--border);
        text-align: center;
        cursor: pointer;
    }
    #attendance-mgmt-container .menu-card:hover { transform: translateY(-5px); border-color: var(--primary); }
    #attendance-mgmt-container .menu-card i { font-size: 2.5rem; margin-bottom: 1rem; color: var(--primary); }
    
    .attn-row-input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 0.9rem;
    }
    
    #attn-daily-body tr:hover, #attn-monthly-body tr:hover { background: #fdf2f2; }
    #attn-daily-body td, #attn-monthly-body td { padding: 0.8rem 1rem; border-bottom: 1px solid #f1f5f9; }
</style>
`;

// ─── 状態 ────────────────────────────────────────────────────
let cachedStores = [];
let currentStaff = null;
let currentTargetDate = null; // YYYY-MM-DD (業務日)
let currentEditPunches = []; // 編集中の打刻リスト
let canDirectEdit = false;
let canRequestCorrection = false;

// ─── 初期化 ──────────────────────────────────────────────────
export async function initAttendanceManagementPage() {
    window.switchAttnView = switchView;
    window.openStaffEdit = openStaffEdit;

    // 権限取得
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
        const user = JSON.parse(userJson);
        const perms = window.appState?.permissions || [];
        // 管理者ロールまたは明示的な権限がある場合に許可
        canDirectEdit = (user.Role === 'Admin' || user.Role === '管理者' || perms.includes('attendance_direct_edit'));
        canRequestCorrection = (perms.includes('attendance_correction_request'));
    }

    await loadStoreList();

    // デフォルト日付セット
    const now = new Date();
    const todayYmd = now.toISOString().split('T')[0];
    const thisMonth = todayYmd.substring(0, 7);

    if (document.getElementById('attn-month-select')) document.getElementById('attn-month-select').value = thisMonth;
    if (document.getElementById('attn-daily-date')) document.getElementById('attn-daily-date').value = todayYmd;

    // イベント
    document.getElementById('btn-attn-monthly-refresh').onclick = () => loadMonthlyData();
    document.getElementById('btn-attn-daily-refresh').onclick = () => loadDailyData();
    document.getElementById('btn-add-punch-row').onclick = () => addPunchRow();
    document.getElementById('btn-attn-save').onclick = () => saveAttendanceEdits();

    const btnError = document.getElementById('btn-attn-error-check');
    if (btnError) btnError.onclick = () => showAlert('情報', 'エラーチェック機能は現在準備中です。');

    switchView('hub');
}

// ─── 表示切り替え ──────────────────────────────────────────
function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
    const target = document.getElementById(`attn-${viewName}-view`);
    if (target) target.style.display = 'block';

    if (viewName === 'monthly') loadMonthlyData();
    if (viewName === 'daily') loadDailyData();
}

// ─── マスタ関連 ──────────────────────────────────────────
async function loadStoreList() {
    try {
        const snap = await getDocs(collection(db, "m_stores"));
        cachedStores = [];
        snap.forEach(d => cachedStores.push({ id: d.id, ...d.data() }));
        
        document.querySelectorAll('.store-selector').forEach(sel => {
            const isMonthly = sel.id === 'attn-mon-store-filter';
            sel.innerHTML = isMonthly ? '<option value="">全店舗</option>' : '';
            cachedStores.forEach(s => {
                const sid = s.store_id || s.StoreID || s.id;
                const snm = s.store_name || s.StoreName || s.Store || '名称未設定';
                const opt = document.createElement('option');
                opt.value = sid;
                opt.textContent = snm;
                sel.appendChild(opt);
            });
        });
    } catch (e) { console.error(e); }
}

// ─── 日別データ表示 ────────────────────────────────────────
async function loadDailyData() {
    const date = document.getElementById('attn-daily-date').value;
    const storeName = document.getElementById('attn-day-store-filter').value;
    const body = document.getElementById('attn-daily-body');
    if (!body) return;
    if (!date || !storeName) return showAlert('通知', '店舗と日付を選択してください。');

    body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem;">読み込み中...</td></tr>';

    try {
        // 店舗取得（正規化されたID/名前で検索）
        const selectedSid = document.getElementById('attn-day-store-filter').value;
        const storeInfo = cachedStores.find(s => (s.store_id || s.id) === selectedSid);
        const storeNameForUserSearch = storeInfo?.store_name || storeInfo?.Store || "";
        const dayChangeTime = storeInfo?.day_change_time || 5;

        // 対象日のスタッフ取得（Storeフィールドで検索）
        const userSnap = await getDocs(query(collection(db, 'm_users'), where('Store', '==', storeNameForUserSearch)));
        const staffList = [];
        userSnap.forEach(d => {
            const data = d.data();
            // あらゆる可能性を網羅するスマート・マッピング
            const sId = data.EmployeeCode || data.staff_id || data.staff_code || data.UserId || data.id || d.id;
            const sName = data.Name || data.name || data.staff_name || data.DisplayName || data.name_kanji || '';
            
            // 文字列として確実に固定して保持
            staffList.push({ 
                id: sId ? String(sId).trim() : String(d.id), 
                name: (sName && String(sName).trim() !== 'undefined') ? String(sName).trim() : '(名前なし)',
                data: data 
            });
        });

        // デバッグ用ログ（ブラウザのコンソールで確認可能）
        console.log(`[v1.2] Loaded ${staffList.length} staff members for ${storeNameForUserSearch}`);
        if (staffList.length > 0) console.log("Sample staff data:", staffList[0]);
        
        if (staffList.length > 0) {
            console.log(`[Attendance] Found ${staffList.length} staff members for store ${storeNameForUserSearch}`);
        } else {
            console.warn(`[Attendance] No staff found for store: ${storeNameForUserSearch}`);
        }

        // 打刻データ取得（対象日 00:00 〜 翌日 05:00 などの範囲をカバー）
        const nextDay = getNextDateStr(date);
        const q = query(collection(db, 't_attendance'), 
            where('date', '>=', date), 
            where('date', '<=', nextDay));
        const punchSnap = await getDocs(q);
        const allPunches = [];
        punchSnap.forEach(d => allPunches.push({ id: d.id, ...d.data() }));

        // 業務日ベースでフィルタリング
        const startEdge = `${date}T${String(dayChangeTime).padStart(2, '0')}:00:00`;
        const nextDate = getNextDateStr(date);
        const endEdge = `${nextDate}T${String(dayChangeTime).padStart(2, '0')}:00:00`;

        const businessDayPunches = allPunches.filter(p => {
            const ts = p.timestamp;
            return ts >= startEdge && ts < endEdge;
        });

        body.innerHTML = '';
        staffList.sort((a,b) => (a.id || '').localeCompare(b.id || '')).forEach((s, rowIdx) => {
            const myPunches = businessDayPunches.filter(p => {
                // 打刻データ側のID取得も柔軟に
                const pid = p.staff_id || p.staff_code || p.EmployeeCode || p.UserId || "";
                return String(pid).trim() === String(s.id).trim();
            });
            myPunches.sort((a,b) => a.timestamp.localeCompare(b.timestamp));

            const checkIn = myPunches.find(p => p.type === 'check_in');
            const checkOut = [...myPunches].reverse().find(p => p.type === 'check_out');
            
            let hours = 0;
            if (checkIn && checkOut) {
                const diff = (new Date(checkOut.timestamp) - new Date(checkIn.timestamp)) / 3600000;
                let breaks = 0;
                let bStart = null;
                myPunches.forEach(p => {
                    if (p.type === 'break_start') bStart = new Date(p.timestamp);
                    else if (p.type === 'break_end' && bStart) {
                        breaks += (new Date(p.timestamp) - bStart) / 3600000;
                        bStart = null;
                    }
                });
                hours = Math.max(0, diff - breaks);
            }

            const tr = document.createElement('tr');
            const btnLabel = canDirectEdit ? '編集' : '修正依頼';
            const btnIcon = canDirectEdit ? 'fa-edit' : 'fa-paper-plane';
            
            tr.innerHTML = `
                <td style="font-family: monospace;">${s.id || '-'}</td>
                <td style="font-weight:600;">${s.name}</td>
                <td style="font-size:0.85rem;">${checkIn ? checkIn.timestamp.substring(11, 16) : '-'}</td>
                <td style="font-size:0.85rem;">${checkOut ? checkOut.timestamp.substring(11, 16) : '-'}</td>
                <td style="text-align:right; font-weight:700;">${hours > 0 ? hours.toFixed(2) + 'h' : '-'}</td>
                <td style="text-align:center;">
                    <button class="btn" style="padding:0.3rem 0.6rem; font-size:0.8rem; background:#e2e8f0;" onclick="window.openStaffEdit('${s.id}', '${s.name}', '${date}')">
                        <i class="fas ${btnIcon}"></i> ${btnLabel}
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        body.innerHTML = '<tr><td colspan="6" style="color:var(--danger); text-align:center;">読み込み失敗</td></tr>';
    }
}

// ─── 実績編集画面 ────────────────────────────────────────
async function openStaffEdit(staffId, staffName, date) {
    currentStaff = { id: staffId, name: staffName };
    currentTargetDate = date;
    
    const title = canDirectEdit ? '実績編集' : '修正依頼の作成';
    document.getElementById('attn-edit-title').textContent = `${staffName} さんの${title}`;
    document.getElementById('attn-edit-subtitle').textContent = `対象業務日: ${date}`;

    const saveBtn = document.getElementById('btn-attn-save');
    if (saveBtn) {
        saveBtn.innerHTML = canDirectEdit ? '<i class="fas fa-save"></i> 保存' : '<i class="fas fa-paper-plane"></i> 申請する';
    }
    
    const body = document.getElementById('attn-edit-body');
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem;">読み込み中...</td></tr>';
    
    switchView('edit');

    try {
        // インデックスエラー回避のため、日付範囲のみで取得し、JS側でスタッフIDをフィルタリング
        const nextDay = getNextDateStr(date);
        const q = query(collection(db, 't_attendance'), 
            where('date', '>=', date),
            where('date', '<=', nextDay));
        const snap = await getDocs(q);
        
        currentEditPunches = [];
        snap.forEach(d => {
            const data = d.data();
            // 保存済みデータのID特定ロジック
            const pid = data.staff_id || data.staff_code || data.EmployeeCode || data.UserId || "";
            if (String(pid).trim() === String(staffId).trim()) {
                // 正規化した状態で保持
                currentEditPunches.push({ 
                    docId: d.id, 
                    ...data,
                    staff_id: String(pid).trim(),
                    // Dashboardとの紐付け必須項目を確実に抽出
                    labor_store_id: data.labor_store_id || data.store_id || data.StoreID || "",
                    store_id: data.store_id || data.StoreID || ""
                });
            }
        });
        currentEditPunches.sort((a,b) => a.timestamp.localeCompare(b.timestamp));

        renderEditTable();
    } catch (e) {
        console.error(e);
        body.innerHTML = '<tr><td colspan="5" style="color:var(--danger);">取得失敗</td></tr>';
    }
}

function renderEditTable() {
    const body = document.getElementById('attn-edit-body');
    body.innerHTML = '';

    currentEditPunches.forEach((p, idx) => {
        const tr = document.createElement('tr');
        const timeVal = p.timestamp ? p.timestamp.substring(11, 16) : '';
        const dateVal = p.date || currentTargetDate;

        tr.innerHTML = `
            <td>
                <select class="attn-row-input type-select" onchange="window.updateLocalPunch(${idx}, 'type', this.value)">
                    <option value="check_in" ${p.type === 'check_in' ? 'selected' : ''}>出勤</option>
                    <option value="check_out" ${p.type === 'check_out' ? 'selected' : ''}>退勤</option>
                    <option value="break_start" ${p.type === 'break_start' ? 'selected' : ''}>休憩開始</option>
                    <option value="break_end" ${p.type === 'break_end' ? 'selected' : ''}>休憩終了</option>
                </select>
            </td>
            <td>
                <input type="date" class="attn-row-input date-input" value="${dateVal}" onchange="window.updateLocalPunch(${idx}, 'date', this.value)">
            </td>
            <td>
                <input type="time" class="attn-row-input time-input" value="${timeVal}" onchange="window.updateLocalPunch(${idx}, 'time', this.value)">
            </td>
            <td>
                <select class="attn-row-input store-select" style="width:100%;" onchange="window.updateLocalPunch(${idx}, 'store_id', this.value)">
                    ${cachedStores.map(s => `<option value="${s.store_id}" ${(s.store_id === p.store_id || s.id === p.store_id) ? 'selected' : ''}>${s.store_name}</option>`).join('')}
                </select>
            </td>
            <td style="text-align: center;">
                ${canDirectEdit ? `
                    <button class="btn" style="color:var(--danger); padding:0.4rem;" onclick="window.removePunchRow(${idx})">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                        <input type="checkbox" style="width:18px; height:18px; cursor:pointer;" 
                               ${p.deleteRequest ? 'checked' : ''} 
                               onchange="window.updateLocalPunch(${idx}, 'deleteRequest', this.checked)">
                        <span style="font-size:0.65rem; color:var(--danger); font-weight:bold;">削除依頼</span>
                    </div>
                `}
            </td>
        `;
        body.appendChild(tr);
    });

    if (currentEditPunches.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-secondary);">打刻実績がありません。「行追加」で新規作成できます。</td></tr>';
    }
}

window.updateLocalPunch = (idx, field, val) => {
    if (field === 'time') {
        const d = currentEditPunches[idx].date || currentTargetDate;
        currentEditPunches[idx].timestamp = `${d}T${val}:00`;
    } else if (field === 'date') {
        currentEditPunches[idx].date = val;
        const t = currentEditPunches[idx].timestamp ? currentEditPunches[idx].timestamp.substring(11, 16) : '00:00';
        currentEditPunches[idx].timestamp = `${val}T${t}:00`;
    } else {
        currentEditPunches[idx][field] = val;
        if (field === 'store_id') {
            const s = cachedStores.find(st => (st.store_id || st.id) === val);
            currentEditPunches[idx].store_name = s ? (s.store_name || s.Store) : '';
        }
    }
};

function addPunchRow() {
    const selectedSid = document.getElementById('attn-day-store-filter').value;
    const store = cachedStores.find(s => (s.store_id || s.id) === selectedSid) || cachedStores[0];
    currentEditPunches.push({
        type: 'check_in',
        date: currentTargetDate,
        timestamp: `${currentTargetDate}T12:00:00`,
        store_id: store.store_id || store.id,
        store_name: store.store_name || store.Store,
        staff_id: currentStaff.id,
        staff_name: currentStaff.name
    });
    renderEditTable();
}

window.removePunchRow = (idx) => {
    currentEditPunches.splice(idx, 1);
    renderEditTable();
};

async function saveAttendanceEdits() {
    const confirmMsg = canDirectEdit ? 
        '勤怠データを更新しますか？\nこの操作は給与集計に直接反映されます。' : 
        '勤怠の修正申請を送信しますか？\n管理者の承認後に反映されます。';
    if (!showConfirm('確認', confirmMsg)) return;

    const btn = document.getElementById('btn-attn-save');
    btn.disabled = true;
    const label = canDirectEdit ? '保存中...' : '申請中...';
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${label}`;

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const loginUser = currentUser?.Name || 'Unknown';
    const loginUserId = currentUser?.id || '';

    try {
        const sorted = [...currentEditPunches].sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        let lastInTs = null;
        let breakMs = 0;
        let bStartTs = null;

        sorted.forEach(p => {
            const ts = p.timestamp ? new Date(p.timestamp) : null;
            if (!ts || isNaN(ts.getTime())) return;

            if (p.type === 'check_in') {
                lastInTs = ts;
                breakMs = 0;
                bStartTs = null;
            } else if (p.type === 'break_start') {
                bStartTs = ts;
            } else if (p.type === 'break_end' && bStartTs) {
                breakMs += (ts - bStartTs);
                bStartTs = null;
            } else if (p.type === 'check_out' && lastInTs) {
                const grossMs = ts - lastInTs;
                const netMs = Math.max(0, grossMs - breakMs);
                p.total_labor_hours = netMs / 3600000;
                lastInTs = null;
                breakMs = 0;
                bStartTs = null;
            } else {
                p.total_labor_hours = 0;
            }
        });

        if (canDirectEdit) {
            // ─── 管理者用：直接反映 ──────────────────────────────
            const nextDay = getNextDateStr(currentTargetDate);
            const qSnap = await getDocs(query(collection(db, 't_attendance'), 
                where('date', '>=', currentTargetDate),
                where('date', '<=', nextDay)));
            
            const batch = writeBatch(db);
            qSnap.forEach(d => {
                const pid = d.data().staff_id || d.data().EmployeeCode || d.id;
                if (String(pid).trim() === String(currentStaff.id).trim()) {
                    batch.delete(d.ref);
                }
            });

            sorted.forEach(p => {
                let finalTs = p.timestamp;
                if (p.timestamp && p.timestamp.length === 16) {
                    finalTs = p.timestamp + ':00+09:00';
                }

                const docId = `${p.staff_id}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
                const docRef = doc(collection(db, 't_attendance'), docId);
                
                const data = {
                    ...p,
                    timestamp: finalTs,
                    store_id: String(p.store_id || "").trim(), 
                    labor_store_id: String(p.labor_store_id || p.store_id || "").trim(), 
                    staff_id: String(p.staff_id || "").trim(),
                    year_month: p.date.substring(0, 7),
                    modifiedBy: loginUser,
                    modifiedAt: serverTimestamp()
                };
                if (data.docId) delete data.docId;
                batch.set(docRef, data);
            });

            await batch.commit();
            showAlert('成功', '勤怠実績を更新しました。');
        } else {
            // ─── 店長用：修正申請を作成 ──────────────────────────
            const storeId = document.getElementById('attn-day-store-filter')?.value || '';
            const requestData = {
                staff_id: String(currentStaff.id).trim(),
                staff_name: currentStaff.name,
                date: currentTargetDate,
                store_id: storeId,
                requested_punches: sorted.map(p => {
                    let finalTs = p.timestamp;
                    if (p.timestamp && p.timestamp.length === 16) {
                        finalTs = p.timestamp + ':00+09:00';
                    }
                    const cleanP = { ...p };
                    if (cleanP.docId) delete cleanP.docId;

                    return {
                        ...cleanP,
                        timestamp: finalTs,
                        staff_id: String(p.staff_id || "").trim(),
                        store_id: String(p.store_id || "").trim(),
                        deleteRequest: !!p.deleteRequest
                    };
                }),
                requested_by_id: loginUserId,
                requested_by_name: loginUser,
                status: 'pending',
                created_at: serverTimestamp()
            };

            await addDoc(collection(db, 't_attendance_requests'), requestData);

            // 管理者への通知作成 (既存のnotificationsコレクションを使用)
            await addDoc(collection(db, 'notifications'), {
                type: 'attendance_correction_request',
                title: '勤怠修正申請',
                message: `${loginUser}さんから ${currentStaff.name}さんの勤怠修正申請（${currentTargetDate}）が届きました。`,
                status: 'pending',
                store_id: storeId,
                target_date: currentTargetDate,
                staff_id: currentStaff.id,
                created_at: serverTimestamp()
            });

            showAlert('申請完了', '管理者に修正申請を送信しました。');
        }

        switchView('daily');
        loadDailyData();
    } catch (e) {
        console.error(e);
        showAlert('エラー', '保存に失敗しました: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = canDirectEdit ? '<i class="fas fa-save"></i> 保存' : '<i class="fas fa-paper-plane"></i> 申請する';
    }
}

// ─── ヘルパー ──────────────────────────────────────────
function getNextDateStr(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

// ─── 月別実績 ──────────────────────────────────────────
async function loadMonthlyData() {
    const month = document.getElementById('attn-month-select')?.value;
    const storeId = document.getElementById('attn-mon-store-filter')?.value;
    const body = document.getElementById('attn-monthly-body');
    if (!body || !month) return;

    body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem;">計中...</td></tr>';

    try {
        const userSnap = await getDocs(collection(db, 'm_users'));
        const staffMap = {};
        userSnap.forEach(d => {
            const data = d.data();
            // 日別データ表示 (line 292) と同様のより堅牢なスタッフ特定ロジックを採用
            const sid = data.EmployeeCode || data.staff_id || data.staff_code || data.UserId || data.id || d.id;
            const name = data.Name || data.name || data.staff_name || data.DisplayName || data.name_kanji || '(名前なし)';
            
            // ユーザーに紐付く店舗情報を特定
            const sName = data.Store || data.store_name || "";
            const matchedStore = cachedStores.find(st => 
                st.store_name === sName || 
                st.id === data.StoreID || 
                st.store_id === data.StoreID
            );
            
            const sidStr = String(sid).trim();
            staffMap[sidStr] = { 
                code: sidStr, 
                name: String(name).trim(), 
                store_id: matchedStore ? (matchedStore.store_id || matchedStore.id) : (data.StoreID || ""),
                store_name: matchedStore ? matchedStore.store_name : (data.Store || "不明"),
                days: new Set(), 
                totalHours: 0, 
                lateHours: 0 
            };
        });

        const q = query(collection(db, 't_attendance'), where('year_month', '==', month));
        const punchSnap = await getDocs(q);
        const punches = [];
        punchSnap.forEach(d => punches.push(d.data()));

        // 集計
        const staffGroup = {};
        punches.forEach(p => {
            if (!staffGroup[p.staff_id]) staffGroup[p.staff_id] = [];
            staffGroup[p.staff_id].push(p);
        });

        Object.keys(staffGroup).forEach(sid => {
            if (!staffMap[sid]) return;
            const records = staffGroup[sid].sort((a,b) => a.timestamp.localeCompare(b.timestamp));
            let lastIn = null;
            let bStart = null;
            let currentBreaks = 0;

            records.forEach(r => {
                const ts = new Date(r.timestamp);
                if (r.type === 'check_in') {
                    lastIn = ts;
                    currentBreaks = 0;
                    staffMap[sid].days.add(r.date);
                } else if (r.type === 'break_start' && lastIn) bStart = ts;
                else if (r.type === 'break_end' && bStart) {
                    currentBreaks += (ts - bStart) / 3600000;
                    bStart = null;
                } else if (r.type === 'check_out' && lastIn) {
                    const dur = (ts - lastIn) / 3600000 - currentBreaks;
                    if (dur > 0) {
                        staffMap[sid].totalHours += dur;
                        staffMap[sid].lateHours += calculateLateNightHours(lastIn, ts, currentBreaks);
                    }
                    lastIn = null;
                }
            });
        });

        let filtered = Object.values(staffMap);
        if (storeId) {
            filtered = filtered.filter(s => String(s.store_id) === String(storeId));
        }

        body.innerHTML = '';
        filtered.sort((a,b) => a.code.localeCompare(b.code)).forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.code}</td>
                <td style="font-weight:600;">${s.name}</td>
                <td>${s.store_name}</td>
                <td style="text-align:right;">${s.days.size}日</td>
                <td style="text-align:right; font-weight:700;">${s.totalHours.toFixed(1)}h</td>
                <td style="text-align:right; color:var(--primary);">${s.lateHours.toFixed(1)}h</td>
                <td style="text-align:center;">
                    <button class="btn" style="padding:0.3rem 0.6rem; font-size:0.8rem; background:#e2e8f0;" onclick="window.switchToDailyFromMonthly('${s.store_name}', '${month}-01')">
                        <i class="fas fa-search"></i> 日別
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });
    } catch (e) { 
        console.error(e);
        body.innerHTML = '<tr><td colspan="7" style="color:var(--danger); text-align:center;">読み込み失敗: ' + e.message + '</td></tr>';
    }
}

window.switchToDailyFromMonthly = (store, date) => {
    document.getElementById('attn-day-store-filter').value = store;
    document.getElementById('attn-daily-date').value = date;
    switchView('daily');
};

function calculateLateNightHours(start, end, totalBreaks) {
    let late = 0;
    const s = new Date(start);
    const e = new Date(end);
    const l22 = new Date(s); l22.setHours(22, 0, 0, 0);
    const l05 = new Date(s); l05.setDate(l05.getDate() + 1); l05.setHours(5, 0, 0, 0);
    const overlapStart = s > l22 ? s : l22;
    const overlapEnd = e < l05 ? e : l05;
    if (overlapEnd > overlapStart) {
        late = (overlapEnd - overlapStart) / 3600000;
        const totalDuration = (e - s) / 3600000;
        if (totalDuration > 0) late -= (totalBreaks * (late / totalDuration));
    }
    return Math.max(0, late);
}
