import { db } from './firebase.js';
import { collection, getDocs, doc, query, where, orderBy, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── HTML テンプレート ────────────────────────────────────────
export const salesCorrectionPageHtml = `
<div class="animate-fade-in">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
            <i class="fas fa-edit" style="color: var(--primary);"></i>
            営業実績修正
        </h2>
    </div>

    <!-- 検索フィルタ -->
    <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; align-items: flex-end;">
            <div class="input-group" style="margin:0;">
                <label style="font-size:0.75rem;">開始日</label>
                <input type="date" id="filter-start-date" style="padding:0.6rem;">
            </div>
            <div class="input-group" style="margin:0;">
                <label style="font-size:0.75rem;">終了日</label>
                <input type="date" id="filter-end-date" style="padding:0.6rem;">
            </div>
            <div class="input-group" style="margin:0;">
                <label style="font-size:0.75rem;">店舗</label>
                <select id="filter-store" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:8px;">
                    <option value="">全店舗</option>
                </select>
            </div>
            <button id="btn-search-performance" class="btn btn-primary" style="padding:0.65rem 1.5rem;">
                <i class="fas fa-search"></i> 表示
            </button>
        </div>
    </div>

    <!-- 結果リスト -->
    <div class="glass-panel" style="padding: 1.5rem;">
        <div style="overflow-x: auto;">
            <table style="width:100%; min-width:800px; border-collapse:collapse; text-align:left;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border); color: var(--text-secondary); font-size: 0.85rem;">
                        <th style="padding: 1rem;">日付</th>
                        <th style="padding: 1rem;">店舗名</th>
                        <th style="padding: 1rem; text-align: right;">売上(税込)</th>
                        <th style="padding: 1rem; text-align: right;">客数</th>
                        <th style="padding: 1rem; text-align: center;">天気</th>
                        <th style="padding: 1rem; text-align: right;">アクション</th>
                    </tr>
                </thead>
                <tbody id="performance-list-body">
                    <tr><td colspan="6" style="padding: 3rem; text-align:center; color:var(--text-secondary);">条件を指定して「表示」を押してください</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- 修正モーダル -->
<div id="performance-edit-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1100; align-items:center; justify-content:center; padding:1rem;">
    <div class="glass-panel" style="width:100%; max-width:600px; padding:2rem; max-height:90vh; overflow-y:auto; position:relative;">
        <button id="close-edit-modal" style="position:absolute; right:1.5rem; top:1.5rem; background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-secondary);"><i class="fas fa-times"></i></button>
        
        <h3 id="edit-modal-title" style="margin:0 0 1.5rem;">実績の修正</h3>
        
        <form id="perf-edit-form" style="display:flex; flex-direction:column; gap:1.2rem;">
            <input type="hidden" id="edit-doc-id">
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div>
                    <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">日付 (変更不可)</label>
                    <input type="text" id="edit-date" disabled style="width:100%; padding:0.6rem; border:1px solid #ddd; border-radius:6px; background:#f5f5f5;">
                </div>
                <div>
                    <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">店舗 (変更不可)</label>
                    <input type="text" id="edit-store-name" disabled style="width:100%; padding:0.6rem; border:1px solid #ddd; border-radius:6px; background:#f5f5f5;">
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div>
                    <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">売上金額 (税込)</label>
                    <input type="number" id="edit-amount" required style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:6px;">
                </div>
                <div>
                    <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">来客数</label>
                    <input type="number" id="edit-customers" required style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:6px;">
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem;">
                <div>
                    <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">現金過不足</label>
                    <input type="number" id="edit-diff" required style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:6px;">
                </div>
                <div>
                    <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">天気1</label>
                    <select id="edit-weather1" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:6px;">
                        <option value="晴れ">晴れ</option><option value="曇り">曇り</option><option value="雨">雨</option><option value="雪">雪</option>
                    </select>
                </div>
                <div>
                    <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">天気2</label>
                    <select id="edit-weather2" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:6px;">
                        <option value="-">-</option><option value="晴れ">晴れ</option><option value="曇り">曇り</option><option value="雨">雨</option><option value="雪">雪</option>
                    </select>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
               <div>
                   <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">チップ</label>
                   <input type="number" id="edit-tip" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:6px;">
               </div>
               <div>
                   <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">小口現金</label>
                   <input type="number" id="edit-petty" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:6px;">
               </div>
            </div>

            <div>
                <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.3rem;">備考 / 用途</label>
                <textarea id="edit-note" style="width:100%; padding:0.6rem; border:1px solid var(--border); border-radius:6px; min-height:60px;"></textarea>
            </div>

            <!-- 欠勤者管理（管理者専用） -->
            <div style="border-top:1px solid var(--border); padding-top:1rem; margin-top:0.5rem;">
                <label class="field-label" style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">
                    <i class="fas fa-user-times" style="color:var(--danger);"></i> 欠勤者（管理者専用）
                </label>
                <div id="edit-absence-list" style="display:flex; flex-direction:column; gap:0.4rem; margin-bottom:0.6rem;">
                    <div style="color:var(--text-secondary); font-size:0.82rem;">読み込み中...</div>
                </div>
                <!-- 欠勤追加フォーム -->
                <div id="edit-absence-add-btn-area" style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.4rem;">
                    <button type="button" id="btn-show-absence-add-form" class="btn" style="padding:0.35rem 0.8rem; font-size:0.8rem; border:1px dashed #94a3b8; color:#64748b; background:transparent;">
                        <i class="fas fa-plus"></i> 欠勤者を追加
                    </button>
                    <button type="button" id="btn-show-help-absence-add-form" class="btn" style="padding:0.35rem 0.8rem; font-size:0.8rem; border:1px dashed #6366f1; color:#6366f1; background:transparent;">
                        <i class="fas fa-exchange-alt"></i> ヘルプスタッフの欠勤
                    </button>
                </div>
                <!-- 自店舗スタッフ追加フォーム -->
                <div id="edit-absence-own-form" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.7rem; flex-direction:column; gap:0.4rem;">
                    <select id="edit-absence-staff-sel" style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; font-size:0.88rem;"><option value="">スタッフを選択...</option></select>
                    <input type="text" id="edit-absence-reason" placeholder="欠勤理由（任意）" style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; font-size:0.88rem; box-sizing:border-box;">
                    <div style="display:flex; gap:0.4rem;">
                        <button type="button" id="btn-confirm-edit-absence" class="btn btn-primary" style="padding:0.4rem 0.9rem; font-size:0.82rem;">登録</button>
                        <button type="button" id="btn-cancel-edit-absence" class="btn" style="padding:0.4rem 0.7rem; font-size:0.82rem; background:#e2e8f0;">キャンセル</button>
                    </div>
                </div>
                <!-- ヘルプスタッフ追加フォーム -->
                <div id="edit-absence-help-form" style="display:none; background:#f0f0ff; border:1px solid #c7d2fe; border-radius:8px; padding:0.7rem; flex-direction:column; gap:0.4rem;">
                    <label style="font-size:0.75rem; color:#6366f1; font-weight:700;">所属店舗を選択</label>
                    <select id="edit-help-store-sel" style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; font-size:0.88rem;"><option value="">店舗を選択...</option></select>
                    <label style="font-size:0.75rem; color:#6366f1; font-weight:700;">スタッフを選択</label>
                    <select id="edit-help-staff-sel" style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; font-size:0.88rem;"><option value="">先に店舗を選択...</option></select>
                    <input type="text" id="edit-help-absence-reason" placeholder="欠勤理由（任意）" style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; font-size:0.88rem; box-sizing:border-box;">
                    <div style="display:flex; gap:0.4rem;">
                        <button type="button" id="btn-confirm-edit-help-absence" class="btn btn-primary" style="padding:0.4rem 0.9rem; font-size:0.82rem; background:#6366f1; border:none;">登録</button>
                        <button type="button" id="btn-cancel-edit-help-absence" class="btn" style="padding:0.4rem 0.7rem; font-size:0.82rem; background:#e2e8f0;">キャンセル</button>
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:1rem; margin-top:1rem;">
                <button type="submit" class="btn btn-primary" style="flex:1; padding:1rem; font-weight:700;">変更を保存</button>
                <button type="button" id="btn-delete-perf" class="btn" style="padding:1rem; color:var(--danger); border:1px solid var(--danger); background:transparent;">削除</button>
            </div>
        </form>
    </div>
</div>
`;

let seatsCache = {};

// ─── 初期化 ──────────────────────────────────────────────────
export async function initSalesCorrectionPage() {
    const startInput = document.getElementById('filter-start-date');
    const endInput = document.getElementById('filter-end-date');
    const storeSelect = document.getElementById('filter-store');
    const btnSearch = document.getElementById('btn-search-performance');
    const tbody = document.getElementById('performance-list-body');

    // デフォルト期間（今月）
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);
    startInput.value = firstDay;
    endInput.value = lastDay;

    // 店舗と席数の読み込み
    try {
        const sSnap = await getDocs(collection(db, "m_stores"));
        sSnap.forEach(d => {
            const data = d.data();
            const sid = d.id;
            const snm = data.店舗名 || data.store_name || sid;
            seatsCache[sid] = data.席数 || 0;
            const opt = document.createElement('option');
            opt.value = sid; opt.textContent = snm;
            storeSelect.appendChild(opt);
        });
    } catch (e) { console.error(e); }

    btnSearch.onclick = async () => {
        const start = startInput.value;
        const end = endInput.value;
        const sid = storeSelect.value;
        if (!start || !end) return alert("期間を指定してください");

        tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem; text-align:center;"><i class="fas fa-spinner fa-spin"></i> 読込中...</td></tr>';

        try {
            const snap = await getDocs(collection(db, "t_performance"));
            const raw = [];
            snap.forEach(d => {
                const data = d.data();
                const normDate = (data.date || "").replace(/\//g, '-').replace(/\./g, '-');
                
                // 範囲内かチェック (JST/UTCの混同をさけるため単純文字列比較)
                if (normDate >= start && normDate <= end) {
                    if (!sid || data.store_id === sid) {
                        raw.push({ id: d.id, ...data, normDate });
                    }
                }
            });

            raw.sort((a,b) => b.normDate.localeCompare(a.normDate));

            tbody.innerHTML = '';
            if (raw.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem; text-align:center; color:var(--text-secondary);">該当する実績がありません</td></tr>';
                return;
            }

            raw.forEach(row => {
                const tr = document.createElement('tr');
                tr.style.cssText = 'border-bottom: 1px solid var(--border); cursor:pointer; transition:background 0.2s;';
                tr.onmouseover = () => tr.style.background = 'rgba(0,0,0,0.02)';
                tr.onmouseout = () => tr.style.background = 'transparent';
                
                // 不正な日付形式がある場合は警告表示
                const dateDisplay = row.date !== row.normDate ? `<span style="color:var(--danger);">${row.date} ⚠️</span>` : row.date;

                tr.innerHTML = `
                    <td style="padding: 1rem; font-family: monospace;">${dateDisplay}</td>
                    <td style="padding: 1rem; font-weight: 600;">${row.store_name}</td>
                    <td style="padding: 1rem; text-align: right; color: var(--primary); font-weight: 700;">¥${(row.amount || 0).toLocaleString()}</td>
                    <td style="padding: 1rem; text-align: right;">${row.customer_count || 0} 名</td>
                    <td style="padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.8rem;">${row.weather_1 || ''}</td>
                    <td style="padding: 1rem; text-align: right;">
                        <button class="btn" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:var(--surface-darker);">修正</button>
                    </td>
                `;
                tr.onclick = () => openEditModal(row);
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem; text-align:center; color:var(--danger);">読込エラーが発生しました</td></tr>';
        }
    };

    // モーダル制御
    const modal = document.getElementById('performance-edit-modal');
    document.getElementById('close-edit-modal').onclick = () => modal.style.display = 'none';

    document.getElementById('perf-edit-form').onsubmit = handleUpdate;
    document.getElementById('btn-delete-perf').onclick = handleDelete;
}

function openEditModal(row) {
    const modal = document.getElementById('performance-edit-modal');
    document.getElementById('edit-doc-id').value = row.id;
    document.getElementById('edit-date').value = row.date;
    document.getElementById('edit-store-name').value = row.store_name;
    document.getElementById('edit-amount').value = row.amount;
    document.getElementById('edit-customers').value = row.customer_count;
    document.getElementById('edit-diff').value = row.cash_diff;
    document.getElementById('edit-tip').value = row.tip || 0;
    document.getElementById('edit-weather1').value = row.weather_1 || '晴れ';
    document.getElementById('edit-weather2').value = row.weather_2 || '-';
    document.getElementById('edit-petty').value = row.petty_cash || 0;
    document.getElementById('edit-note').value = row.note || '';

    modal.style.display = 'flex';
}

async function handleUpdate(e) {
    e.preventDefault();
    if (!confirm("営業実績を変更しますか？")) return;

    const docId = document.getElementById('edit-doc-id').value;
    const dateInput = document.getElementById('edit-date').value;
    const normDate = dateInput.replace(/\//g, '-').replace(/\./g, '-');
    
    const amount = parseInt(document.getElementById('edit-amount').value) || 0;
    const customers = parseInt(document.getElementById('edit-customers').value) || 0;
    const diff = parseInt(document.getElementById('edit-diff').value) || 0;
    const tip = parseInt(document.getElementById('edit-tip').value) || 0;
    const petty = parseInt(document.getElementById('edit-petty').value) || 0;
    const note = document.getElementById('edit-note').value;
    const w1 = document.getElementById('edit-weather1').value;
    const w2 = document.getElementById('edit-weather2').value;

    const storeId = docId.split('_')[0];
    const seats = seatsCache[storeId] || 0;

    // 再計算
    const exTax = Math.round((amount + diff) / 1.1);
    const turnover = seats > 0 ? Number((customers / seats).toFixed(2)) : 0;
    const unitPrice = customers > 0 ? Math.round(exTax / customers) : 0;

    const data = {
        date: normDate, // 日付形式を正規化して保存
        year_month: normDate.substring(0, 7),
        amount,
        customer_count: customers,
        cash_diff: diff,
        tip,
        petty_cash: petty,
        note,
        weather_1: w1,
        weather_2: w2,
        amount_ex_tax: exTax,
        turnover_rate: turnover,
        customer_unit_price: unitPrice
    };

    try {
        await updateDoc(doc(db, "t_performance", docId), data);
        alert("変更を保存しました (日付形式も自動修正されました)");
        document.getElementById('performance-edit-modal').style.display = 'none';
        document.getElementById('btn-search-performance').click(); // リロード反映
    } catch (e) { alert("エラー: " + e.message); }
}

async function handleDelete() {
    if (!confirm("この営業実績を【削除】しますか？\n削除すると元に戻せません。")) return;

    const docId = document.getElementById('edit-doc-id').value;

    try {
        // 【既存】t_performance を削除
        await deleteDoc(doc(db, "t_performance", docId));

        // 【新規追加】紐づく t_absences をカスケード削除
        try {
            const absSnap = await getDocs(query(
                collection(db, 't_absences'),
                where('performance_doc_id', '==', docId)
            ));
            if (!absSnap.empty) {
                const batch = writeBatch(db);
                absSnap.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        } catch (abErr) {
            console.error('欠勤データのカスケード削除失敗（実績は削除済み）:', abErr);
        }

        alert("実績を削除しました");
        document.getElementById('performance-edit-modal').style.display = 'none';
        document.getElementById('btn-search-performance').click(); // リロード反映
    } catch (e) { alert("エラー: " + e.message); }
}

// ─── 欠勤管理（修正モーダル内、修正UIと完全に独立） ────────────

let editAbsenceStaffCache = [];
let editAbsenceStoresCache = [];

async function loadEditAbsences(perfDocId, storeId, storeName) {
    const listEl = document.getElementById('edit-absence-list');
    if (!listEl) return;
    listEl.innerHTML = '<div style="color:var(--text-secondary); font-size:0.82rem;"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';

    try {
        // 欠勤データを取得
        const absSnap = await getDocs(query(
            collection(db, 't_absences'),
            where('performance_doc_id', '==', perfDocId)
        ));
        const absences = [];
        absSnap.forEach(d => absences.push({ id: d.id, ...d.data() }));

        // スタッフ・店舗データを取得（追加UI用）
        const [uSnap, stSnap] = await Promise.all([
            getDocs(collection(db, 'm_users')),
            getDocs(collection(db, 'm_stores'))
        ]);
        editAbsenceStaffCache = [];
        uSnap.forEach(d => {
            const data = d.data();
            if (data.Role === 'Tablet' || data.Role === '店舗タブレット' || !data.EmployeeCode) return;
            editAbsenceStaffCache.push({ id: d.id, ...data });
        });
        editAbsenceStoresCache = [];
        stSnap.forEach(d => editAbsenceStoresCache.push({ id: d.id, ...d.data() }));

        // 登録済み欠勤を表示
        listEl.innerHTML = '';
        if (absences.length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-secondary); font-size:0.82rem; padding:0.3rem 0;">欠勤者の登録なし</div>';
        } else {
            absences.forEach(ab => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.6rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85rem;';
                const helpBadge = ab.is_help_absence ? `<span style="background:#eef2ff; color:#6366f1; font-size:0.72rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:4px; margin-left:0.3rem;">ヘルプ</span>` : '';
                const storeBadge = ab.is_help_absence ? `<span style="color:#94a3b8; font-size:0.78rem;"> (${ab.staff_store_name})</span>` : '';
                row.innerHTML = `
                    <div>
                        <span style="font-weight:700;">${ab.staff_name}</span>${helpBadge}${storeBadge}
                        ${ab.reason ? `<span style="color:#64748b; font-size:0.78rem; margin-left:0.4rem;">/ ${ab.reason}</span>` : ''}
                    </div>
                    <button type="button" data-abs-id="${ab.id}" style="background:#fee2e2; border:1px solid #fca5a5; color:#e53e3e; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; cursor:pointer; font-weight:700;">削除</button>
                `;
                row.querySelector('button').onclick = async (e) => {
                    const absId = e.target.dataset.absId;
                    if (!confirm('この欠勤記録を削除しますか？')) return;
                    try {
                        await deleteDoc(doc(db, 't_absences', absId));
                        await loadEditAbsences(perfDocId, storeId, storeName);
                    } catch (err) { alert('削除エラー: ' + err.message); }
                };
                listEl.appendChild(row);
            });
        }

        // 追加フォームのセットアップ
        setupEditAbsenceForm(perfDocId, storeId, storeName);
    } catch (e) {
        console.error(e);
        if (listEl) listEl.innerHTML = '<div style="color:var(--danger); font-size:0.82rem;">読み込み失敗</div>';
    }
}

function setupEditAbsenceForm(perfDocId, storeId, storeName) {
    const ownForm = document.getElementById('edit-absence-own-form');
    const helpForm = document.getElementById('edit-absence-help-form');
    const staffSel = document.getElementById('edit-absence-staff-sel');
    const reasonInput = document.getElementById('edit-absence-reason');
    const helpStoreSel = document.getElementById('edit-help-store-sel');
    const helpStaffSel = document.getElementById('edit-help-staff-sel');
    const helpReasonInput = document.getElementById('edit-help-absence-reason');

    // ボタンイベントのリバインド（クローンで重複防止）
    const rebind = (id, handler) => {
        const el = document.getElementById(id);
        if (!el) return;
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener('click', handler);
    };

    rebind('btn-show-absence-add-form', () => {
        if (ownForm) {
            ownForm.style.display = 'flex';
            // 報告店舗のスタッフをプルダウンにセット
            const staffSel2 = document.getElementById('edit-absence-staff-sel');
            if (staffSel2) {
                staffSel2.innerHTML = '<option value="">スタッフを選択...</option>';
                editAbsenceStaffCache.filter(s => {
                    const sStoreId = s.StoreID || s.StoreId || s.store_id;
                    return sStoreId === storeId || s.Store === storeName;
                }).forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.dataset.code = s.EmployeeCode || s.id;
                    opt.dataset.name = s.Name || s.name || '';
                    opt.dataset.storeId = s.StoreID || '';
                    opt.dataset.storeName = s.Store || '';
                    opt.textContent = s.Name || s.name || '';
                    staffSel2.appendChild(opt);
                });
            }
        }
        if (helpForm) helpForm.style.display = 'none';
    });

    rebind('btn-cancel-edit-absence', () => { if (ownForm) ownForm.style.display = 'none'; });

    rebind('btn-show-help-absence-add-form', () => {
        if (helpForm) {
            helpForm.style.display = 'flex';
            const helpStoreSel2 = document.getElementById('edit-help-store-sel');
            const helpStaffSel2 = document.getElementById('edit-help-staff-sel');
            if (helpStoreSel2) {
                helpStoreSel2.innerHTML = '<option value="">所属店舗を選択...</option>';
                editAbsenceStoresCache.filter(st => st.id !== storeId).forEach(st => {
                    const opt = document.createElement('option');
                    opt.value = st.id;
                    opt.textContent = st.store_name || st.id;
                    helpStoreSel2.appendChild(opt);
                });
                if (helpStaffSel2) helpStaffSel2.innerHTML = '<option value="">先に店舗を選択...</option>';
            }
        }
        if (ownForm) ownForm.style.display = 'none';
    });

    rebind('btn-cancel-edit-help-absence', () => { if (helpForm) helpForm.style.display = 'none'; });

    // ヘルプ: 店舗選択→スタッフ
    const helpStoreSelEl = document.getElementById('edit-help-store-sel');
    if (helpStoreSelEl) {
        helpStoreSelEl.onchange = () => {
            const selStoreId = helpStoreSelEl.value;
            const selStore = editAbsenceStoresCache.find(st => st.id === selStoreId);
            const helpStaffSel2 = document.getElementById('edit-help-staff-sel');
            if (!helpStaffSel2) return;
            helpStaffSel2.innerHTML = '<option value="">スタッフを選択...</option>';
            if (!selStoreId) return;
            editAbsenceStaffCache.filter(s => {
                const sStoreId = s.StoreID || s.StoreId || s.store_id;
                return sStoreId === selStoreId || (selStore && s.Store === selStore.store_name);
            }).forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.dataset.code = s.EmployeeCode || s.id;
                opt.dataset.name = s.Name || s.name || '';
                opt.dataset.storeId = selStoreId;
                opt.dataset.storeName = selStore ? (selStore.store_name || '') : '';
                opt.textContent = s.Name || s.name || '';
                helpStaffSel2.appendChild(opt);
            });
        };
    }

    // 自店舗: 登録
    rebind('btn-confirm-edit-absence', async () => {
        const staffSel2 = document.getElementById('edit-absence-staff-sel');
        const reason2 = document.getElementById('edit-absence-reason');
        const opt = staffSel2?.options[staffSel2?.selectedIndex];
        if (!opt || !opt.value) return;
        const dateVal = document.getElementById('edit-date').value;
        try {
            const dupCheck = await getDocs(query(
                collection(db, 't_absences'),
                where('date', '==', dateVal),
                where('staff_id', '==', opt.dataset.code)
            ));
            if (!dupCheck.empty) { alert('この日付にこのスタッフの欠勤は既に登録されています。'); return; }
            await addDoc(collection(db, 't_absences'), {
                date: dateVal,
                year_month: dateVal.substring(0, 7),
                staff_id: opt.dataset.code,
                staff_name: opt.dataset.name,
                staff_store_id: opt.dataset.storeId || '',
                staff_store_name: opt.dataset.storeName || '',
                reported_store_id: storeId,
                reported_store_name: storeName,
                is_help_absence: false,
                reason: reason2?.value.trim() || '',
                performance_doc_id: perfDocId,
                created_at: serverTimestamp()
            });
            if (ownForm) ownForm.style.display = 'none';
            await loadEditAbsences(perfDocId, storeId, storeName);
        } catch (err) { alert('登録エラー: ' + err.message); }
    });

    // ヘルプ: 登録
    rebind('btn-confirm-edit-help-absence', async () => {
        const helpStaffSel2 = document.getElementById('edit-help-staff-sel');
        const helpReason2 = document.getElementById('edit-help-absence-reason');
        const opt = helpStaffSel2?.options[helpStaffSel2?.selectedIndex];
        if (!opt || !opt.value) return;
        const dateVal = document.getElementById('edit-date').value;
        try {
            const dupCheck = await getDocs(query(
                collection(db, 't_absences'),
                where('date', '==', dateVal),
                where('staff_id', '==', opt.dataset.code)
            ));
            if (!dupCheck.empty) { alert('この日付にこのスタッフの欠勤は既に登録されています。'); return; }
            await addDoc(collection(db, 't_absences'), {
                date: dateVal,
                year_month: dateVal.substring(0, 7),
                staff_id: opt.dataset.code,
                staff_name: opt.dataset.name,
                staff_store_id: opt.dataset.storeId || '',
                staff_store_name: opt.dataset.storeName || '',
                reported_store_id: storeId,
                reported_store_name: storeName,
                is_help_absence: true,
                reason: helpReason2?.value.trim() || '',
                performance_doc_id: perfDocId,
                created_at: serverTimestamp()
            });
            if (helpForm) helpForm.style.display = 'none';
            await loadEditAbsences(perfDocId, storeId, storeName);
        } catch (err) { alert('登録エラー: ' + err.message); }
    });
}
