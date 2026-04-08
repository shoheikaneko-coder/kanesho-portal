import { db } from './firebase.js';
import {
    collection, getDocs, getDoc, doc, setDoc, deleteDoc,
    query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

// ─── HTML テンプレート ────────────────────────────────────────
export const attendancePageHtml = `
<div class="animate-fade-in" style="max-width:900px; margin:0 auto;">

    <!-- ヘッダー行 -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; align-items:center; gap:0.8rem;">
            <i class="fas fa-clock" style="color:var(--primary); font-size:1.4rem;"></i>
            <h2 style="margin:0; font-size:1.4rem;">勤怠・打刻</h2>
        </div>
        <div id="clock-display" style="font-size:2rem; font-weight:800; font-family:monospace; color:var(--text-primary);">00:00:00</div>
        <button id="btn-help-mode" class="btn" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:0.6rem 1.2rem; font-size:0.9rem; border-radius:10px;">
            <i class="fas fa-hands-helping"></i> ヘルプ出勤
        </button>
    </div>

    <!-- 未出勤者 プルダウン -->
    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
        <div id="current-store-label" style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.8rem; font-weight:600;">
            <i class="fas fa-store"></i> 読み込み中...
        </div>
        <div style="display:flex; gap:0.8rem; align-items:center; flex-wrap:wrap;">
            <select id="staff-select" style="flex:1; min-width:200px; padding:0.9rem 1rem; border:1px solid var(--border); border-radius:12px; background:white; font-size:1rem;">
                <option value="">スタッフを選択してください</option>
            </select>
            <button id="btn-checkin" class="btn" style="padding:0.9rem 2rem; background:var(--secondary); color:white; font-weight:700; border-radius:12px; font-size:1rem; white-space:nowrap;">
                <i class="fas fa-sign-in-alt"></i> 出勤
            </button>
        </div>
    </div>

    <!-- 出勤中ギャラリー -->
    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
        <h3 style="margin:0 0 1rem; font-size:1rem; color:var(--text-secondary); font-weight:600;">
            <i class="fas fa-users"></i> 出勤中スタッフ
        </h3>
        <div id="active-staff-gallery" style="display:flex; flex-wrap:wrap; gap:0.8rem;">
            <div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem;">読み込み中...</div>
        </div>
    </div>

    <!-- 本日の打刻履歴 -->
    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
        <h3 style="margin:0 0 1rem; font-size:1rem; color:var(--text-secondary); font-weight:600;">
            <i class="fas fa-history"></i> 本日の打刻履歴
        </h3>
        <div id="attendance-history" style="display:flex; flex-direction:column; gap:0.6rem; max-height:350px; overflow-y:auto;"></div>
    </div>

    <!-- Admin限定：打刻修正 -->
    <div id="admin-correction-section" style="display:none;">
        <div class="glass-panel" style="padding:1.5rem;">
            <h3 style="margin:0 0 1rem; font-size:1rem; color:var(--text-secondary); font-weight:600;">
                <i class="fas fa-edit" style="color:var(--primary);"></i> 打刻修正（管理者専用）
            </h3>
            <div style="display:flex; gap:0.8rem; align-items:center; margin-bottom:1rem; flex-wrap:wrap;">
                <input type="date" id="correction-date" style="padding:0.7rem 1rem; border:1px solid var(--border); border-radius:10px; font-size:0.95rem;">
                <button id="btn-load-correction" class="btn btn-primary" style="padding:0.7rem 1.2rem; font-size:0.9rem;">
                    <i class="fas fa-search"></i> 表示
                </button>
            </div>
            <div id="correction-list" style="display:flex; flex-direction:column; gap:0.5rem;"></div>
        </div>
    </div>
</div>

<!-- パスワード確認モーダル（休憩/退勤用） -->
<div id="punch-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:2000; align-items:center; justify-content:center; padding:1rem;">
    <div style="background:#fff; border-radius:16px; width:100%; max-width:360px; padding:2rem; position:relative;">
        <h3 id="punch-modal-title" style="margin:0 0 0.3rem; font-size:1.1rem; color:#1e293b;"></h3>
        <p id="punch-modal-name" style="font-size:0.85rem; color:#64748b; margin:0 0 1.2rem;"></p>
        <label style="font-size:0.8rem; color:#64748b; display:block; margin-bottom:0.4rem; font-weight:600;">打刻パスワード</label>
        <input type="password" id="punch-modal-pw" placeholder="••••" style="width:100%; padding:0.8rem 1rem; border:1px solid #cbd5e1; border-radius:10px; font-size:1.2rem; letter-spacing:0.3rem; text-align:center; box-sizing:border-box;" maxlength="8">
        <div id="punch-modal-actions" style="display:flex; flex-direction:column; gap:0.7rem; margin-top:1.2rem;"></div>
        <button id="punch-modal-cancel" style="margin-top:0.5rem; width:100%; padding:0.7rem; background:none; border:none; color:#94a3b8; cursor:pointer; font-size:0.9rem;">キャンセル</button>
    </div>
</div>

<!-- ヘルプ出勤モーダル -->
<div id="help-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:2000; align-items:center; justify-content:center; padding:1rem;">
    <div style="background:#fff; border-radius:16px; width:100%; max-width:380px; padding:2rem; position:relative;">
        <button id="close-help-modal" style="position:absolute; right:1.2rem; top:1.2rem; background:none; border:none; font-size:1.3rem; cursor:pointer; color:#94a3b8;"><i class="fas fa-times"></i></button>
        <h3 style="margin:0 0 0.5rem; font-size:1.1rem; color:#1e293b;"><i class="fas fa-hands-helping" style="color:var(--secondary);"></i> ヘルプ出勤</h3>
        <p style="font-size:0.8rem; color:#64748b; margin:0 0 1.2rem;">他店舗を選択すると、その店舗のスタッフをプルダウンに追加します。</p>
        <select id="help-store-select" style="width:100%; padding:0.8rem 1rem; border:1px solid #cbd5e1; border-radius:10px; font-size:1rem; margin-bottom:1rem;">
            <option value="">店舗を選択してください</option>
        </select>
        <button id="btn-apply-help" class="btn btn-primary" style="width:100%; padding:0.8rem;">適用する</button>
    </div>
</div>

<!-- 打刻修正 編集モーダル -->
<div id="correction-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:2000; align-items:center; justify-content:center; padding:1rem;">
    <div style="background:#fff; border-radius:16px; width:100%; max-width:380px; padding:2rem; position:relative;">
        <button id="close-correction-modal" style="position:absolute; right:1.2rem; top:1.2rem; background:none; border:none; font-size:1.3rem; cursor:pointer; color:#94a3b8;"><i class="fas fa-times"></i></button>
        <h3 style="margin:0 0 1.2rem; font-size:1.1rem; color:#1e293b;"><i class="fas fa-edit" style="color:var(--primary);"></i> 打刻修正</h3>
        <input type="hidden" id="correction-doc-id">
        <div style="display:flex; flex-direction:column; gap:1rem;">
            <div>
                <label style="font-size:0.78rem; color:#64748b; display:block; margin-bottom:0.3rem; font-weight:600;">スタッフ名</label>
                <input type="text" id="correction-staff-name" style="width:100%; padding:0.7rem 1rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.95rem; box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:0.78rem; color:#64748b; display:block; margin-bottom:0.3rem; font-weight:600;">打刻種別</label>
                <select id="correction-type" style="width:100%; padding:0.7rem 1rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.95rem;">
                    <option value="出勤">出勤</option>
                    <option value="退勤">退勤</option>
                    <option value="休憩開始">休憩開始</option>
                    <option value="休憩終了">休憩終了</option>
                </select>
            </div>
            <div>
                <label style="font-size:0.78rem; color:#64748b; display:block; margin-bottom:0.3rem; font-weight:600;">時刻</label>
                <input type="time" id="correction-time" style="width:100%; padding:0.7rem 1rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.95rem; box-sizing:border-box;">
            </div>
        </div>
        <div style="display:flex; gap:0.7rem; margin-top:1.5rem;">
            <button id="btn-correction-save" class="btn btn-primary" style="flex:1; padding:0.8rem;">保存</button>
            <button id="btn-correction-delete" class="btn" style="flex:0; padding:0.8rem 1rem; background:#fee2e2; color:#e53e3e; border:1px solid #fca5a5;">削除</button>
        </div>
    </div>
</div>
`;

// ─── 状態 ────────────────────────────────────────────────────
export let currentUser = null;
export let tabletStore = '';       // タブレットの所属店舗名
export let tabletStoreID = '';     // タブレットの所属店舗ID
export let tabletGroup = '';       // タブレットの所属グループ名
export let allStaff = [];          // m_users全件
export let cachedStoresData = [];  // 店舗マスタ全件
export let recentPunches = [];     // 直近24時間の打刻レコード（{id, ...data}[]）
export let clockTimer = null;

// ─── 初期化 ──────────────────────────────────────────────────
export async function initAttendancePage(user, forcedStoreID = null) {
    currentUser = user || {};
    // 引数でStoreIDが強制指定されている場合はそれを使用し、そうでなければユーザーマスタから取得
    tabletStoreID = forcedStoreID || currentUser.StoreID || currentUser.StoreId || currentUser.store_id || '';
    tabletStore = currentUser.Store || currentUser.store_name || '';

    // 診断用：画面にStore IDを小さく表示（Tabletモード時のみ）
    const debugEl = document.getElementById('current-store-label');
    if (debugEl) {
        debugEl.innerHTML = `<span style="opacity:0.6; font-size:0.75rem;">Store Context: ${tabletStoreID || 'UNKNOWN'}</span>`;
    }
    
    // 店舗マスタを先に取得して、タブレット店舗の詳細（ID, グループ）を特定する
    try {
        const storeSnap = await getDocs(collection(db, "m_stores"));
        cachedStoresData = storeSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // タブレット店舗の特定（ID / 名前 / ユーザーマスタのStoreフィールド等で多角的に検索）
        let myStore = cachedStoresData.find(s => s.id === tabletStoreID);
        if (!myStore && tabletStore) {
            myStore = cachedStoresData.find(s => s.store_name === tabletStore);
        }
        // さらに、所属グループ内の店舗である可能性も考慮してマッピングを強化
        if (!myStore && currentUser.Store) {
             myStore = cachedStoresData.find(s => s.store_name === currentUser.Store);
        }

        if (myStore) {
            tabletStore = myStore.store_name || '';
            tabletStoreID = myStore.id;
            tabletGroup = myStore.group_name || '';
        } else {
            console.warn("Could not determine store for current user:", currentUser);
        }

        // Admin用：店舗が未設定の場合は、最初の店舗をデフォルトにする
        const isAdmin = currentUser.Role === 'Admin' || currentUser.Role === '管理者';
        if (!tabletStoreID && isAdmin && cachedStoresData.length > 0) {
            const firstStore = cachedStoresData[0];
            tabletStore = firstStore.store_name || '';
            tabletStoreID = firstStore.id;
            tabletGroup = firstStore.group_name || '';
        }
    } catch (e) {
        console.error("Failed to load store metadata:", e);
    }

    startClock();
    await refreshData();
    setupEventListeners();

    // Admin のみ打刻修正セクション表示
    if (currentUser.Role === 'Admin') {
        const sec = document.getElementById('admin-correction-section');
        if (sec) sec.style.display = 'block';
        // デフォルト日付を今日にセット
        const dateInput = document.getElementById('correction-date');
        if (dateInput) dateInput.value = todayStr();
    }
}


// ─── 時計 ────────────────────────────────────────────────────
export function startClock(targetId = 'clock-display') {
    if (clockTimer) clearInterval(clockTimer);
    const tick = () => {
        const el = document.getElementById(targetId);
        if (!el) { clearInterval(clockTimer); return; }
        el.textContent = new Date().toTimeString().split(' ')[0];
    };
    tick();
    clockTimer = setInterval(tick, 1000);
}

// ─── ヘルパー ────────────────────────────────────────────────
function formatTime(isoStr) {
    if (!isoStr) return '-';
    try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' });
    } catch (e) { return '-'; }
}

function todayStr() {
    const d = new Date();
    const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toISOString().substring(0, 10);
}

// ─── データ読み込み＆UI更新 ─────────────────────────────────
export async function refreshData() {
    await Promise.all([loadAllStaff(), loadRecentPunches()]);
    renderUnclockedDropdown();
    renderGallery();
    renderTodayHistory();
}

async function loadAllStaff() {
    try {
        const snap = await getDocs(collection(db, 'm_users'));
        allStaff = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.Role === 'Tablet' || data.Role === '店舗タブレット') return;

            // ID紐付けの自動補完 (Lazy Migration)
            let sId = data.StoreID;
            if (!sId && data.Store) {
                const matched = cachedStoresData.find(s => s.store_name === data.Store);
                if (matched) sId = matched.id;
            }

            allStaff.push({ id: d.id, ...data, StoreID: sId });
        });
    } catch (e) { console.error(e); }
}

async function loadRecentPunches() {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const snap = await getDocs(
            query(collection(db, 't_attendance'),
                where('timestamp', '>=', twentyFourHoursAgo))
        );
        recentPunches = [];
        snap.forEach(d => recentPunches.push({ id: d.id, ...d.data() }));
        // メモリ内で時間順にソート (ASC)
        recentPunches.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    } catch (e) {
        console.error('打刻データの読み込みに失敗しました:', e);
    }
}

// ─── 現在の各スタッフの最終ステータスを計算 ─────────────────
function calcStaffStatuses() {
    const map = {};
    for (const p of recentPunches) {
        const sid = String(p.staff_id);
        // 最新の打刻情報で上書きしていく
        map[sid] = {
            name: p.staff_name,
            storeName: p.store_name,
            lastPunch: p.type,
            timestamp: p.timestamp
        };
    }
    const result = {};
    for (const [sid, info] of Object.entries(map)) {
        let status = 'off';
        if (info.lastPunch === 'check_in' || info.lastPunch === 'break_end') status = 'working';
        else if (info.lastPunch === 'break_start') status = 'break';
        result[sid] = { ...info, status };
    }
    return result;
}

// ─── 未出勤者プルダウン ──────────────────────────────────────
export function renderUnclockedDropdown(extraStoreFilter = null) {
    const sel = document.getElementById('staff-select');
    const label = document.getElementById('current-store-label');
    if (!sel) return;

    if (label) {
        const storeDisplayName = tabletStore || '店舗未設定';
        const groupBadge = tabletGroup ? `<span style="font-size:0.75rem; background:#f1f5f9; color:#475569; padding:0.1rem 0.4rem; border-radius:4px; margin-left:0.5rem; border:1px solid #e2e8f0;">${tabletGroup}グループ</span>` : '';
        
        let warning = '';
        const isAdmin = currentUser.Role === 'Admin' || currentUser.Role === '管理者';
        if (isAdmin && !tabletGroup && !extraStoreFilter) {
            warning = `<div style="font-size:0.7rem; color:var(--danger); margin-top:0.3rem;"><i class="fas fa-exclamation-triangle"></i> グループ未設定のためCK共有が無効です</div>`;
        }

        label.innerHTML = extraStoreFilter
            ? `<div><i class="fas fa-hands-helping" style="color:var(--secondary);"></i> ヘルプ出勤モード：${extraStoreFilter}</div>`
            : `<div><i class="fas fa-store"></i> ${storeDisplayName}${groupBadge}</div>${warning}`;
    }

    const statuses = calcStaffStatuses();
    const activeSids = new Set(
        Object.entries(statuses)
            .filter(([, v]) => v.status !== 'off')
            .map(([sid]) => sid)
    );

    // フィルタリングロジック：同一店舗 OR 同一グループのCK
    const unclocked = allStaff.filter(s => {
        const sid = String(s.EmployeeCode || s.id);
        if (activeSids.has(sid)) return false;

        // IDベースでの店舗一致（casing variants: StoreID, StoreId, store_id）
        const staffStoreID = s.StoreID || s.StoreId || s.store_id;
        
        if (extraStoreFilter) {
            // ヘルプモード時は店舗名での後方互換マッチ
            const sName = s.Store || '';
            if (sName === extraStoreFilter) return true;
        } else {
            // ID または店舗名での一致を許容（強固なフィルタリング）
            if (tabletStoreID && staffStoreID === tabletStoreID) return true;
            if (tabletStore && s.Store === tabletStore) return true;
        }

        // CK共有の判定
        if (!extraStoreFilter && tabletGroup) {
            const storeInfo = cachedStoresData.find(st => st.id === s.StoreID);
            if (storeInfo && storeInfo.store_type === 'CK' && storeInfo.group_name === tabletGroup) {
                return true;
            }
        }
        return false;
    });
 
    sel.innerHTML = '<option value="">スタッフを選択してください</option>';
    unclocked.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        
        // CK所属の場合は識別ラベルを付与
        const storeInfo = cachedStoresData.find(st => st.id === s.StoreID);
        const isCK = storeInfo?.store_type === 'CK';
        const ckLabel = isCK ? ' 🏢(CK)' : '';
        
        opt.textContent = `${s.Name || s.name || 'No Name'}${ckLabel}`;
        sel.appendChild(opt);
    });
}

// ─── 出勤中ギャラリー ────────────────────────────────────────
export function renderGallery() {
    const gallery = document.getElementById('active-staff-gallery');
    if (!gallery) return;

    const statuses = calcStaffStatuses();
    // 現タブレット店舗で勤務中（退勤済み除く）のスタッフのみ
    const active = Object.entries(statuses).filter(([, v]) =>
        v.status !== 'off' && v.storeName === tabletStore
    );

    if (active.length === 0) {
        gallery.innerHTML = '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem;">出勤中のスタッフはいません</div>';
        return;
    }

    gallery.innerHTML = '';
    active.forEach(([sid, info]) => {
        const isBreak = info.status === 'break';
        // 従業員マスタから「シフト表示名」を取得
        const staff = allStaff.find(s => (s.EmployeeCode || s.id) === sid || s.id === sid);
        const displayName = staff?.DisplayName || info.name;

        const badge = document.createElement('div');
        badge.style.cssText = `
            cursor:pointer; 
            background: ${isBreak ? 'linear-gradient(135deg, #f97316, #fb923c)' : 'linear-gradient(135deg, #3b82f6, #60a5fa)'};
            color:white;
            border-radius:12px; 
            padding: 0.7rem 1.2rem;
            display: flex;
            align-items: center;
            gap: 0.6rem;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            user-select:none;
        `;
        
        const statusIcon = isBreak ? '<i class="fas fa-coffee" style="font-size:0.8rem;"></i>' : '<i class="fas fa-circle" style="font-size:0.5rem; color:#bfffcb;"></i>';
        const statusLabel = isBreak ? '<span style="font-size:0.7rem; font-weight:800; background:rgba(0,0,0,0.15); padding:0.1rem 0.4rem; border-radius:6px; margin-left:2px;">休憩</span>' : '';

        badge.innerHTML = `
            ${statusIcon}
            <div style="font-size:1.05rem; font-weight:800; letter-spacing:0.02em;">${displayName}</div>
            ${statusLabel}
        `;

        badge.onmouseenter = () => { 
            badge.style.transform = 'translateY(-2px) scale(1.02)'; 
            badge.style.boxShadow = '0 6px 15px rgba(0,0,0,0.15)'; 
        };
        badge.onmouseleave = () => { 
            badge.style.transform = ''; 
            badge.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)'; 
        };
        
        badge.onclick = () => openPunchModal(sid, info);
        gallery.appendChild(badge);
    });
}

// ─── 本日の打刻履歴 ──────────────────────────────────────────
export function renderTodayHistory() {
    const list = document.getElementById('attendance-history');
    if (!list) return;

    const today = todayStr();
    const filteredPunches = recentPunches.filter(p => p.date === today);

    if (filteredPunches.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-secondary); font-size:0.85rem;">本日の打刻はありません</div>';
        return;
    }

    const colorMap = { 'check_in': '#3b82f6', 'check_out': 'var(--danger)', 'break_start': '#f97316', 'break_end': '#10b981' };
    list.innerHTML = '';
    [...filteredPunches].reverse().forEach(r => {
        const time = formatTime(r.timestamp);
        const color = colorMap[r.type] || '#64748b';
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; border-radius:8px; background:rgba(255,255,255,0.5); border:1px solid rgba(0,0,0,0.05);';
        div.innerHTML = `
            <div>
                <span style="font-weight:700; font-size:0.9rem;">${r.staff_name}</span>
                <span style="font-size:0.75rem; color:var(--text-secondary); margin-left:0.5rem;">${r.store_name}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.6rem;">
                <span style="font-size:0.8rem; color:var(--text-secondary);">${time}</span>
                <span style="background:${color}; color:white; padding:0.2rem 0.55rem; border-radius:4px; font-size:0.72rem; font-weight:700;">${r.type}</span>
            </div>
        `;
        list.appendChild(div);
    });
}

// ─── イベントリスナー ────────────────────────────────────────
export function setupEventListeners() {
    console.log("Setting up attendance event listeners (Clean Slate Mode)...");

    const rebind = (id, handler) => {
        const oldEl = document.getElementById(id);
        if (!oldEl) return null;
        const newEl = oldEl.cloneNode(true); // 全ての既存リスナーを物理的に消去
        oldEl.parentNode.replaceChild(newEl, oldEl);
        newEl.addEventListener('click', handler);
        return newEl;
    };

    // 出勤ボタン（最も汚染されやすい箇所をクリーンアップ）
    rebind('btn-checkin', handleCheckIn);

    // ヘルプ出勤関連
    rebind('btn-help-mode', openHelpModal);
    rebind('close-help-modal', closeHelpModal);
    rebind('btn-apply-help', applyHelpMode);
    
    // 背景クリックで閉じる処理
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        const newHelpModal = helpModal.cloneNode(true);
        helpModal.parentNode.replaceChild(newHelpModal, helpModal);
        newHelpModal.addEventListener('click', e => { if (e.target.id === 'help-modal') closeHelpModal(); });
    }

    // パスワードモーダル
    rebind('punch-modal-cancel', closePunchModal);
    const punchModal = document.getElementById('punch-modal');
    if (punchModal) {
        const newPunchModal = punchModal.cloneNode(true);
        punchModal.parentNode.replaceChild(newPunchModal, punchModal);
        newPunchModal.addEventListener('click', e => { if (e.target.id === 'punch-modal') closePunchModal(); });
    }

    // 詳細モーダルの閉じるボタン
    const closeDetailBtn = document.getElementById('close-check-modal');
    if (closeDetailBtn) {
        closeDetailBtn.onclick = null; // インラインを削除
        const newCloseBtn = closeDetailBtn.cloneNode(true);
        closeDetailBtn.parentNode.replaceChild(newCloseBtn, closeDetailBtn);
        newCloseBtn.addEventListener('click', () => {
            const modal = document.getElementById('check-detail-modal');
            if (modal) {
                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            }
        });
    }

    // 打刻修正（Admin）
    rebind('btn-load-correction', loadCorrectionList);
    const closeCorrectionBtn = document.getElementById('close-correction-modal');
    if (closeCorrectionBtn) {
        const newBtn = closeCorrectionBtn.cloneNode(true);
        closeCorrectionBtn.parentNode.replaceChild(newBtn, closeCorrectionBtn);
        newBtn.addEventListener('click', () => {
            const modal = document.getElementById('correction-modal');
            if (modal) modal.style.display = 'none';
        });
    }
    rebind('btn-correction-save', saveCorrectionRecord);
    rebind('btn-correction-delete', deleteCorrectionRecord);

    // ヘルプ出勤：店舗選択モーダルをロード
    loadHelpStores();
}

// ─── 出勤処理 ────────────────────────────────────────────────
async function handleCheckIn() {
    console.log("handleCheckIn triggered. Context:", { tabletStoreID, tabletStore });
    
    if (!tabletStoreID) {
        // カスタムUIが出るか怪しいため、ブラウザ標準のアラートを併用
        window.alert("エラー: ログイン店舗が特定できませんでした。\nStoreID: " + tabletStoreID);
        return;
    }

    const selectEl = document.getElementById('staff-select');
    if (!selectEl) {
        window.alert("エラー: スタッフ選択欄が見つかりません(ID collision?)");
        return;
    }
    const staffDocId = selectEl.value;
    if (!staffDocId) {
        return showAlert('お知らせ', '打刻するスタッフを選択してください。');
    }

    const staff = allStaff.find(s => s.id === staffDocId);
    if (!staff) {
        console.error("Staff not found in allStaff list:", staffDocId);
        return showAlert('エラー', '選択されたスタッフのデータが見つかりません。店舗IDが一致しているか確認してください。');
    }

    // パスワードモーダルを表示
    openPunchModal(staff.id, { name: staff.Name || staff.userName || 'スタッフ', status: 'off' });
}

// ─── ギャラリーカードタップ → パスワードモーダル ────────────
let pendingPunchTarget = null; // { staffDocId, actions[] }

function openPunchModal(staffId, info) {
    const staff = allStaff.find(s => (s.EmployeeCode || s.id) === staffId || s.id === staffId);
    if (!staff) return;

    const isBreak = info.status === 'break';
    const isOff = info.status === 'off';
    const actions = isBreak ? ['break_end'] : (isOff ? ['check_in'] : ['break_start', 'check_out']);

    pendingPunchTarget = { staff, actions };

    document.getElementById('punch-modal-title').textContent = `${info.name}`;
    document.getElementById('punch-modal-name').textContent = isBreak ? '休憩中です' : (isOff ? '出勤します' : '出勤中です');
    document.getElementById('punch-modal-pw').value = '';

    const actionsDiv = document.getElementById('punch-modal-actions');
    actionsDiv.innerHTML = '';
    actions.forEach(action => {
        const colorMap = { 'check_out': 'var(--danger)', 'break_start': '#f97316', 'break_end': '#10b981' };
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.cssText = `padding:0.9rem; background:${colorMap[action] || '#3b82f6'}; color:white; font-weight:700; border-radius:12px; font-size:1rem; width:100%;`;
        btn.textContent = action === 'break_end' ? '休憩終了' : action === 'break_start' ? '休憩開始' : action === 'check_in' ? '出勤' : '退勤';
        btn.onclick = () => confirmPunchFromModal(action);
        actionsDiv.appendChild(btn);
    });

    const modal = document.getElementById('punch-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
        const pwInput = document.getElementById('punch-modal-pw');
        if (pwInput) {
            pwInput.value = '';
            pwInput.focus();
        }
    }
}

function closePunchModal() {
    const modal = document.getElementById('punch-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 150);
    }
    pendingPunchTarget = null;
}

async function confirmPunchFromModal(action) {
    const pw = document.getElementById('punch-modal-pw').value;
    if (!pw) { document.getElementById('punch-modal-pw').focus(); return; }

    const { staff } = pendingPunchTarget;
    if (String(staff.ClockInPassword) !== String(pw)) {
        showAlert('エラー', 'パスワードが正しくありません。');
        document.getElementById('punch-modal-pw').value = '';
        document.getElementById('punch-modal-pw').focus();
        return;
    }
    closePunchModal();
    await punch(staff, action);
}

// ─── 打刻共通処理 ────────────────────────────────────────────
async function punch(staff, type) {
    const now = new Date();
    // JSTのISO文字列を生成 (YYYY-MM-DDTHH:mm:ss.sss+09:00)
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const jstIso = jstNow.toISOString().replace('Z', '+09:00');

    // CKスタッフ判定：所属店舗タイプがCKの場合、按分計算用に自店舗IDを使う
    // store_id/store_nameはUI（ギャラリー表示）のためにタブレット店舗のまま維持する
    const staffStoreInfo = cachedStoresData.find(s => s.id === staff.StoreID);
    const isCKStaff = !!(staffStoreInfo && staffStoreInfo.store_type === 'CK');

    const data = {
        timestamp: jstIso,
        date: todayStr(),
        year_month: todayStr().substring(0, 7),
        staff_id: staff.EmployeeCode || staff.id,
        staff_name: staff.Name,
        store_id: tabletStoreID,              // UI用（ギャラリー表示）
        store_name: tabletStore,              // UI用（ギャラリー表示）
        labor_store_id: isCKStaff ? staff.StoreID : tabletStoreID,  // CK按分計算用
        type
    };
    try {
        const docId = `${staff.id}_${now.getTime()}`;
        await setDoc(doc(db, 't_attendance', docId), data);
        await refreshData();
    } catch (e) { showAlert('システムエラー', e.message); }
}

// ─── ヘルプ出勤モーダル ──────────────────────────────────────
let allStores = [];

async function loadHelpStores() {
    try {
        const snap = await getDocs(query(collection(db, 'm_stores'), orderBy('store_id')));
        allStores = [];
        const sel = document.getElementById('help-store-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">店舗を選択してください</option>';
        snap.forEach(d => {
            const data = d.data();
            if (data.store_name && data.store_name !== tabletStore) {
                allStores.push(data);
                const opt = document.createElement('option');
                opt.value = data.store_name;
                opt.textContent = data.store_name;
                sel.appendChild(opt);
            }
        });
    } catch (e) { console.error(e); }
}

function openHelpModal() {
    document.getElementById('help-modal').style.display = 'flex';
}
function closeHelpModal() {
    document.getElementById('help-modal').style.display = 'none';
}

function applyHelpMode() {
    const sel = document.getElementById('help-store-select');
    const storeName = sel?.value;
    if (!storeName) {
        // 店舗未選択（リセット）の場合はヘルプモード解除
        renderUnclockedDropdown(null);
        closeHelpModal();
        return;
    }
    closeHelpModal();
    renderUnclockedDropdown(storeName);
}

// ─── 打刻修正（Admin限定） ───────────────────────────────────
async function loadCorrectionList() {
    const dateVal = document.getElementById('correction-date')?.value;
    if (!dateVal) return showAlert('通知', '日付を選択してください。');
    const listDiv = document.getElementById('correction-list');
    if (!listDiv) return;
    listDiv.innerHTML = '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem;">読み込み中...</div>';
    try {
        const snap = await getDocs(
            query(collection(db, 't_attendance'),
                where('date', '==', dateVal))
        );
        const results = [];
        snap.forEach(d => results.push({ id: d.id, ...d.data() }));
        results.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        if (results.length === 0) {
            listDiv.innerHTML = '<div style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem;">該当日のデータはありません</div>';
            return;
        }
        const colorMap = { 'check_in': '#3b82f6', 'check_out': '#e53e3e', 'break_start': '#f97316', 'break_end': '#10b981' };
        listDiv.innerHTML = '';
        results.forEach(record => {
            const r = record;
            const docId = record.id;
            const time = formatTime(r.timestamp);
            const color = colorMap[r.type] || '#64748b';
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.7rem 0.9rem; border-radius:8px; background:rgba(255,255,255,0.7); border:1px solid #e2e8f0; cursor:pointer; transition:background 0.15s;';
            row.innerHTML = `
                <div>
                    <span style="font-weight:700; font-size:0.9rem;">${r.staff_name}</span>
                    <span style="font-size:0.75rem; color:#64748b; margin-left:0.5rem;">${r.store_name}</span>
                </div>
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    <span style="font-size:0.85rem; color:#475569;">${time}</span>
                    <span style="background:${color}; color:white; padding:0.2rem 0.55rem; border-radius:4px; font-size:0.72rem; font-weight:700;">${r.type}</span>
                    <i class="fas fa-pen" style="color:#94a3b8; font-size:0.8rem;"></i>
                </div>
            `;
            row.onmouseenter = () => row.style.background = 'rgba(255,255,255,0.95)';
            row.onmouseleave = () => row.style.background = 'rgba(255,255,255,0.7)';
            row.onclick = () => openCorrectionModal(docId, r);
            listDiv.appendChild(row);
        });
    } catch (e) { listDiv.innerHTML = `<div style="color:red; font-size:0.85rem;">エラー: ${e.message}</div>`; }
}

function openCorrectionModal(docId, record) {
    document.getElementById('correction-doc-id').value = docId;
    document.getElementById('correction-staff-name').value = record.staff_name || '';
    document.getElementById('correction-type').value = record.type || '出勤';
    document.getElementById('correction-time').value = formatTime(record.timestamp);
    document.getElementById('correction-modal').style.display = 'flex';
}

async function saveCorrectionRecord() {
    const docId = document.getElementById('correction-doc-id').value;
    const staffName = document.getElementById('correction-staff-name').value;
    const type = document.getElementById('correction-type').value;
    const timeVal = document.getElementById('correction-time').value;
    const dateVal = document.getElementById('correction-date').value;
    if (!timeVal) return showAlert('通知', '時刻を入力してください。');

    // タイムスタンプ再構築
    const ts = `${dateVal}T${timeVal}:00+09:00`;
    try {
        await setDoc(doc(db, 't_attendance', docId), {
            staff_name: staffName,
            type,
            timestamp: new Date(ts).toISOString(),
            date: dateVal,
            year_month: dateVal.substring(0, 7)
        }, { merge: true });
        document.getElementById('correction-modal').style.display = 'none';
        showAlert('成功', '修正しました。');
        await loadCorrectionList();
        await refreshData();
    } catch (e) { showAlert('エラー', '保存エラー: ' + e.message); }
}

async function deleteCorrectionRecord() {
    const docId = document.getElementById('correction-doc-id').value;
    showConfirm('削除の確認', 'この打刻記録を削除しますか？', async () => {
        try {
            await deleteDoc(doc(db, 't_attendance', docId));
            document.getElementById('correction-modal').style.display = 'none';
            await loadCorrectionList();
            await refreshData();
            showAlert('成功', '削除しました。');
        } catch (e) {
            showAlert('エラー', '削除エラー: ' + e.message);
        }
    });
}
