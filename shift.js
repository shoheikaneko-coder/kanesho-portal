import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm } from './ui_utils.js';

/**
 * --- HTML Templates ---
 */

// スタッフ用：希望提出画面
export const shiftSubmissionPageHtml = `
    <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding-bottom: 3rem;">
        <!-- ステータス・募集期間案内 -->
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; border-left: 5px solid var(--primary);">
            <div>
                <h2 style="margin:0; font-size: 1.3rem; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-paper-plane" style="color: var(--primary);"></i>
                    シフト希望提出：<span id="shift-slot-title">----</span>
                </h2>
                <p style="margin: 0.4rem 0 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;" id="shift-deadline-info">
                    提出締切: ----
                </p>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button id="btn-save-as-template" class="btn btn-secondary" style="font-size: 0.85rem; padding: 0.6rem 1.2rem; border-radius: 20px; background: #f0fdf4; color: #166534; border-color: #bbf7d0;">
                    <i class="fas fa-save"></i> 現在の内容を基本型に保存
                </button>
                <button id="btn-apply-template" class="btn btn-secondary" style="font-size: 0.85rem; padding: 0.6rem 1.2rem; border-radius: 20px;">
                    <i class="fas fa-magic"></i> いつものパターンを反映
                </button>
                <button id="btn-submit-shifts" class="btn btn-primary" style="font-size: 0.9rem; padding: 0.6rem 2rem; font-weight: 800; border-radius: 30px; box-shadow: 0 4px 12px rgba(230,57,70,0.2);">
                    希望を提出する
                </button>
            </div>
        </div>

        <!-- メイングリッド -->
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <div style="padding: 1rem; background: #f8fafc; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-evenly; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">
                <span><i class="fas fa-info-circle"></i> 日付のマスをタップして時間を入力してください</span>
                <span style="display:flex; gap:1.5rem;">
                    <span style="display:flex; align-items:center; gap:0.4rem;"><span style="width:12px; height:12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:3px;"></span> 平日</span>
                    <span style="display:flex; align-items:center; gap:0.4rem;"><span style="width:12px; height:12px; background:#fef2f2; border:1px solid #fecaca; border-radius:3px;"></span> 祝日</span>
                    <span style="display:flex; align-items:center; gap:0.4rem;"><span style="width:12px; height:12px; background:#fffbeb; border:1px solid #fef3c7; border-radius:3px;"></span> 祝前日</span>
                </span>
            </div>
            
            <div style="overflow-x: auto;">
                <table id="shift-submission-table" style="width: 100%; border-collapse: collapse; min-width: 1000px;">
                    <thead>
                        <tr id="shift-table-header">
                            <th style="position: sticky; left: 0; z-index: 10; background: #f8fafc; width: 140px; padding: 1.2rem; border-right: 2px solid var(--border); border-bottom: 2px solid var(--border);">スタッフ</th>
                            <!-- 日付ヘッダーが動的に入る -->
                        </tr>
                    </thead>
                    <tbody id="shift-table-body">
                        <!-- シフト入力行が動的に入る -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 入力モーダル -->
    <div id="shift-input-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
        <div class="glass-panel animate-scale-in" style="width:100%; max-width:400px; padding:2rem;">
            <h4 id="modal-date-title" style="margin:0 0 1.5rem; font-size:1.1rem; color:var(--text-primary); border-bottom:1px solid var(--border); padding-bottom:1rem;">時刻入力</h4>
            
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label class="field-label">開始</label>
                        <input type="time" id="modal-start" class="form-input" style="font-size: 1.2rem; font-weight: 700; text-align: center;">
                    </div>
                    <div>
                        <label class="field-label">終了</label>
                        <input type="time" id="modal-end" class="form-input" style="font-size: 1.2rem; font-weight: 700; text-align: center;">
                    </div>
                </div>

                <div>
                    <label class="field-label">備考・特記事項</label>
                    <input type="text" id="modal-note" class="form-input" placeholder="例: 終電まで, テスト期間">
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button id="btn-modal-clear" class="btn btn-secondary" style="flex:1;">休み/削除</button>
                    <button id="btn-modal-save" class="btn btn-primary" style="flex:2;">保存</button>
                </div>
                <button onclick="document.getElementById('shift-input-modal').style.display='none'" class="btn" style="width:100%; font-size:0.8rem; color:var(--text-secondary);">キャンセル</button>
            </div>
        </div>
    </div>

    <style>
        #shift-submission-table th, #shift-submission-table td {
            border: 1px solid var(--border);
            text-align: center;
        }
        .date-hdr { font-size: 0.8rem; font-weight: 800; min-width: 60px; padding: 0.8rem 0.4rem; }
        .date-hdr.holiday { background: #fef2f2; color: #ef4444; }
        .date-hdr.day-before { background: #fffbeb; color: #d97706; }
        
        .staff-cell {
            position: sticky;
            left: 0;
            z-index: 5;
            background: white;
            padding: 1rem;
            font-weight: 700;
            border-right: 2px solid var(--border) !important;
            text-align: left;
            box-shadow: 4px 0 8px rgba(0,0,0,0.02);
            font-size: 0.9rem;
        }
        .staff-cell.pinned {
            background: #fff1f2;
            color: var(--primary);
        }
        .staff-cell.pinned::after {
            content: '📌 MY';
            font-size: 0.6rem;
            background: var(--primary);
            color: white;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            margin-left: 0.5rem;
            vertical-align: middle;
        }

        .shift-cell {
            min-height: 80px;
            cursor: pointer;
            transition: 0.2s;
            position: relative;
            padding: 0.5rem;
        }
        .shift-cell:hover { background: #f1f5f9; }
        .shift-box {
            background: var(--primary);
            color: white;
            border-radius: 8px;
            padding: 0.4rem;
            font-size: 0.75rem;
            font-weight: 800;
            line-height: 1.2;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-shadow: 0 4px 8px rgba(230,57,70,0.2);
        }
        .shift-box.applied { background: #94a3b8; box-shadow: none; }
        .shift-note { font-size: 0.6rem; margin-top: 0.2rem; opacity: 0.9; font-weight: 500; }
    </style>
`;

/**
 * --- Logic Phase 1: Shift Submission ---
 */

let currentSlot = {
    year: 0, month: 0, slot: 1, // 1: 1-15日, 2: 16-末日
    startDate: null, endDate: null,
    deadLine: null
};

let currentShifts = {}; // { user_id: { yyyy-mm-dd: { start, end, note, status } } }
let currentTargetUser = null;

export async function initShiftSubmissionPage() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    currentTargetUser = user;

    calculateSlot();
    renderSubmissionGrid();
    await loadShiftsForSlot();
    setupTemplateEvents();
    
    // 提出ボタンのイベント
    const submitBtn = document.getElementById('btn-submit-shifts');
    if (submitBtn) {
        submitBtn.onclick = async () => {
            const ok = await showConfirm('シフト提出', '入力した内容で希望を提出しますか？');
            if (ok) await saveShifts(true);
        };
    }
}

/**
 * テンプレート（基本型）関連のイベント設定
 */
function setupTemplateEvents() {
    // テンプレート反映
    document.getElementById('btn-apply-template').onclick = async () => {
        try {
            const snap = await getDoc(doc(db, "m_shift_templates", currentTargetUser.id));
            if (!snap.exists()) {
                return showAlert('案内', 'まだ基本パターンが登録されていません。「現在の内容を基本型に保存」ボタンで登録できます。');
            }
            
            const template = snap.data().patterns || {};
            const numDays = (currentSlot.endDate.getDate() - currentSlot.startDate.getDate()) + 1;
            
            for (let i = 0; i < numDays; i++) {
                const d = new Date(currentSlot.startDate);
                d.setDate(d.getDate() + i);
                const dow = d.getDay(); // 0-6
                const ymd = d.toISOString().split('T')[0];
                
                if (template[dow] && template[dow].start) {
                    const pattern = template[dow];
                    const newShift = {
                        userId: currentTargetUser.id,
                        userName: currentTargetUser.Name,
                        storeId: currentTargetUser.StoreID || currentTargetUser.StoreId || 'UNKNOWN',
                        date: ymd,
                        start: pattern.start,
                        end: pattern.end,
                        note: pattern.note || "",
                        status: 'applied',
                        updatedAt: new Date().toISOString()
                    };
                    currentShifts[currentTargetUser.id][ymd] = newShift;
                    renderShiftCell(currentTargetUser.id, ymd, newShift);
                }
            }
            showAlert('成功', 'いつものパターンを反映しました！内容を確認して提出してください。');
        } catch (e) {
            console.error(e);
            showAlert('エラー', 'テンプレートの反映に失敗しました。');
        }
    };

    // テンプレート保存
    document.getElementById('btn-save-as-template').onclick = async () => {
        const ok = await showConfirm('基本型の保存', '現在の入力内容（曜日ごとの時間）を、あなたの「基本パターン」として保存しますか？');
        if (!ok) return;

        try {
            const patterns = {};
            const userShifts = currentShifts[currentTargetUser.id] || {};
            
            // 現在のグリッドから曜日ごとのパターンを抽出
            for (const ymd in userShifts) {
                const s = userShifts[ymd];
                const d = new Date(ymd);
                const dow = d.getDay();
                if (s.start && s.end) {
                    patterns[dow] = { start: s.start, end: s.end, note: s.note };
                }
            }

            if (Object.keys(patterns).length === 0) {
                return showAlert('警告', '保存するシフトが入力されていません。');
            }

            await setDoc(doc(db, "m_shift_templates", currentTargetUser.id), {
                userId: currentTargetUser.id,
                patterns,
                updatedAt: new Date().toISOString()
            });
            showAlert('成功', '基本パターンを保存しました。次回から「いつものパターンを反映」ボタンで呼び出せます。');
        } catch (e) {
            console.error(e);
            showAlert('エラー', '保存に失敗しました。');
        }
    };
}

/**
 * 募集スロットの算出
 */
function calculateSlot() {
    const now = new Date();
    const day = now.getDate();
    
    // 現在の日付から、次に提出すべきスロットを決定
    // 1-10日は「今月後半(16-末日)」の提出期間
    // 11-25日は「翌月前半(1-15日)」の提出期間
    // 26-末日は「翌月後半(16-末日)」の提出期間（とする簡易ロジック）
    
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth() + 1; // 1-12
    let slot = 1;
    let deadlineStr = "";

    if (day <= 10) {
        // 今月後半
        slot = 2;
        deadlineStr = `${targetMonth}月10日`;
    } else if (day <= 25) {
        // 翌月前半
        targetMonth++;
        if (targetMonth > 12) { targetMonth = 1; targetYear++; }
        slot = 1;
        deadlineStr = `${now.getMonth() + 1}月25日`;
    } else {
        // 翌月後半
        targetMonth++;
        if (targetMonth > 12) { targetMonth = 1; targetYear++; }
        slot = 2;
        deadlineStr = `${targetMonth}月10日 (目安)`;
    }

    currentSlot.year = targetYear;
    currentSlot.month = targetMonth;
    currentSlot.slot = slot;
    
    const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
    currentSlot.startDate = new Date(targetYear, targetMonth - 1, slot === 1 ? 1 : 16);
    currentSlot.endDate = new Date(targetYear, targetMonth - 1, slot === 1 ? 15 : lastDayOfMonth);
    currentSlot.deadLine = deadlineStr;

    const slotTitle = `${targetYear}年${targetMonth}月${slot === 1 ? '前半 (1〜15日)' : '後半 (16〜末日)'}`;
    const slotEl = document.getElementById('shift-slot-title');
    const deadlineEl = document.getElementById('shift-deadline-info');
    if (slotEl) slotEl.textContent = slotTitle;
    if (deadlineEl) deadlineEl.textContent = `提出締切: ${deadlineStr}`;
}

/**
 * グリッド（テーブル）の描画
 */
async function renderSubmissionGrid() {
    const header = document.getElementById('shift-table-header');
    const body = document.getElementById('shift-table-body');
    if (!header || !body) return;

    // ヘッダー（日付）の生成
    header.innerHTML = '<th class="staff-cell">スタッフ</th>';
    const numDays = (currentSlot.endDate.getDate() - currentSlot.startDate.getDate()) + 1;
    
    // カレンダーマスタから祝日情報を取得
    const ym = `${currentSlot.year}-${String(currentSlot.month).padStart(2, '0')}`;
    const calSnap = await getDoc(doc(db, "m_calendars", `${ym}_common`));
    const holidays = calSnap.exists() ? (calSnap.data().days || []) : [];

    for (let i = 0; i < numDays; i++) {
        const d = new Date(currentSlot.startDate);
        d.setDate(d.getDate() + i);
        const dayNum = d.getDate();
        const dow = ['日','月','火','水','木','金','土'][d.getDay()];
        
        const isHoliday = holidays.find(h => h.day === dayNum)?.is_holiday;
        // 祝前日判定
        const nextDayNum = dayNum + 1;
        const isDayBeforeH = holidays.find(h => h.day === nextDayNum)?.is_holiday;

        let cls = 'date-hdr';
        if (isHoliday || d.getDay() === 0) cls += ' holiday';
        else if (isDayBeforeH || d.getDay() === 6) cls += ' day-before';

        header.innerHTML += `<th class="${cls}">${dayNum}<br><span style="font-size:0.65rem;">${dow}</span></th>`;
    }

    // ボディ（自分の行のみ、またはチーム全員の確定済みを表示）
    // 提出画面なので、自分の行をトップに固定
    body.innerHTML = `
        <tr id="row-${currentTargetUser.id}">
            <td class="staff-cell pinned">${currentTargetUser.Name}</td>
            ${Array.from({length: numDays}).map((_, i) => {
                const d = new Date(currentSlot.startDate);
                d.setDate(d.getDate() + i);
                const ymd = d.toISOString().split('T')[0];
                return `<td class="shift-cell" data-date="${ymd}" data-uid="${currentTargetUser.id}" id="cell-${currentTargetUser.id}-${ymd}"></td>`;
            }).join('')}
        </tr>
    `;

    // セルクリックイベント
    document.querySelectorAll('.shift-cell').forEach(cell => {
        cell.onclick = () => openInputModal(cell.dataset.date, cell.dataset.uid);
    });
}

async function loadShiftsForSlot() {
    const ymdStart = currentSlot.startDate.toISOString().split('T')[0];
    const ymdEnd = currentSlot.endDate.toISOString().split('T')[0];

    try {
        const q = query(collection(db, "t_shifts"), 
            where("userId", "==", currentTargetUser.id),
            where("date", ">=", ymdStart),
            where("date", "<=", ymdEnd));
        
        const snap = await getDocs(q);
        currentShifts[currentTargetUser.id] = {};
        
        snap.forEach(d => {
            const data = d.data();
            currentShifts[currentTargetUser.id][data.date] = data;
            renderShiftCell(currentTargetUser.id, data.date, data);
        });
    } catch (e) {
        console.error("Shift Load Error:", e);
    }
}

function renderShiftCell(uid, date, data) {
    const cell = document.getElementById(`cell-${uid}-${date}`);
    if (!cell) return;

    if (!data || !data.start) {
        cell.innerHTML = '';
        return;
    }

    const isConfirmed = data.status === 'confirmed';
    cell.innerHTML = `
        <div class="shift-box ${isConfirmed ? '' : 'applied'}">
            <div>${data.start} - ${data.end}</div>
            ${data.note ? `<div class="shift-note">${data.note}</div>` : ''}
        </div>
    `;
}

let activeDate = null;
function openInputModal(date, uid) {
    if (uid !== currentTargetUser.id) return; // 自分以外は編集不可

    activeDate = date;
    const data = currentShifts[uid][date] || {};
    
    document.getElementById('modal-date-title').textContent = `${date} の希望入力`;
    document.getElementById('modal-start').value = data.start || "";
    document.getElementById('modal-end').value = data.end || "";
    document.getElementById('modal-note').value = data.note || "";
    
    document.getElementById('shift-input-modal').style.display = 'flex';

    // 保存ボタン
    document.getElementById('btn-modal-save').onclick = async () => {
        const start = document.getElementById('modal-start').value;
        const end = document.getElementById('modal-end').value;
        const note = document.getElementById('modal-note').value;

        if (!start || !end) return showAlert('エラー', '時間を入力してください');

        const newShift = {
            userId: currentTargetUser.id,
            userName: currentTargetUser.Name,
            storeId: currentTargetUser.StoreID || currentTargetUser.StoreId || 'UNKNOWN',
            date: activeDate,
            start, end, note,
            status: 'applied',
            updatedAt: new Date().toISOString()
        };

        // ローカルに保存
        currentShifts[currentTargetUser.id][activeDate] = newShift;
        renderShiftCell(currentTargetUser.id, activeDate, newShift);
        
        document.getElementById('shift-input-modal').style.display = 'none';
        // 実際の保存は「提出する」ボタンで行う設計にするが、ここでは即時保存を検討
        // 今回の要件は「一気に流し込み」等も考慮し、個別の保存も許可する
        await saveShifts();
    };

    // 削除ボタン
    document.getElementById('btn-modal-clear').onclick = async () => {
        delete currentShifts[currentTargetUser.id][activeDate];
        renderShiftCell(currentTargetUser.id, activeDate, null);
        document.getElementById('shift-input-modal').style.display = 'none';
        await saveShifts();
    };
}

async function saveShifts() {
    // 現在のスロット内のデータを一括保存（または単発保存）
    // NOTE: 重複チェック(ダブルブッキング)はPhase 2/3で実装
    const btn = document.getElementById('btn-submit-shifts');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

    try {
        const userShifts = currentShifts[currentTargetUser.id] || {};
        for (const date in userShifts) {
            const s = userShifts[date];
            const docId = `${s.date}_${s.userId}`;
            await setDoc(doc(db, "t_shifts", docId), s);
        }
        // showAlert('成功', 'シフト希望を保存しました。');
    } catch (e) {
        console.error(e);
        showAlert('エラー', '保存に失敗しました。');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
