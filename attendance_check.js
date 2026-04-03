import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert } from './ui_utils.js';

export const attendanceCheckPageHtml = `
    <div class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h3 style="color: var(--text-secondary);">勤怠状況確認</h3>
        </div>

        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: flex-end;">
                <div class="input-group" style="margin-bottom: 0;">
                    <label>対象月</label>
                    <input type="month" id="check-month" style="padding: 0.6rem;">
                </div>
                <div class="input-group" style="margin-bottom: 0;">
                    <label>店舗</label>
                    <select id="check-store" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px;">
                        <option value="">全店舗</option>
                    </select>
                </div>
                <button id="btn-refresh-check" class="btn btn-primary" style="padding: 0.6rem 1.5rem;">
                    <i class="fas fa-sync-alt"></i> 表示
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; min-width: 800px; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border); color: var(--text-secondary); font-size: 0.85rem;">
                            <th style="padding: 1rem;">従業員コード</th>
                            <th style="padding: 1rem;">名前</th>
                            <th style="padding: 1rem;">主所属店舗</th>
                            <th style="padding: 1rem; text-align: right;">労働日数</th>
                            <th style="padding: 1rem; text-align: right;">総労働時間</th>
                            <th style="padding: 1rem; text-align: right;">アクション</th>
                        </tr>
                    </thead>
                    <tbody id="attendance-check-body">
                        <tr><td colspan="6" style="padding: 2rem; text-align: center;">条件を指定して「表示」を押してください</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 詳細モーダル -->
    <div id="check-detail-modal" class="sidebar-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; align-items: center; justify-content: center;">
        <div class="glass-panel" style="width: 90%; max-width: 700px; padding: 2rem; max-height: 85vh; overflow-y: auto; position: relative;">
            <button id="close-check-modal" style="position: absolute; right: 1.5rem; top: 1.5rem; background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-secondary);"><i class="fas fa-times"></i></button>
            <h3 id="detail-staff-name" style="margin-bottom: 0.5rem;">---</h3>
            <p id="detail-period" style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-secondary);">---</p>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border); text-align: left;">
                        <th style="padding: 0.75rem 0.5rem;">日付</th>
                        <th style="padding: 0.75rem 0.5rem;">店舗</th>
                        <th style="padding: 0.75rem 0.5rem;">出勤</th>
                        <th style="padding: 0.75rem 0.5rem;">退勤</th>
                        <th style="padding: 0.75rem 0.5rem; text-align: right;">休憩</th>
                        <th style="padding: 0.75rem 0.5rem; text-align: right;">労働時間</th>
                    </tr>
                </thead>
                <tbody id="detail-table-body"></tbody>
            </table>
        </div>
    </div>
`;

export async function initAttendanceCheckPage() {
    const monthInput = document.getElementById('check-month');
    const storeSelect = document.getElementById('check-store');
    const btnRefresh = document.getElementById('btn-refresh-check');
    const tbody = document.getElementById('attendance-check-body');

    // 初期値セット（今月）
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 店舗選択肢の読み込み
    try {
        const sSnap = await getDocs(collection(db, "m_stores"));
        sSnap.forEach(d => {
            const data = d.data();
            const sid = data.store_id || data.StoreID || d.id;
            const snm = data.store_name || data.StoreName || data['店舗名'] || '名称未設定';
            const opt = document.createElement('option');
            opt.value = sid;
            opt.textContent = snm;
            storeSelect.appendChild(opt);
        });
    } catch (e) { console.error(e); }

    btnRefresh.onclick = async () => {
        const month = monthInput.value;
        const selectedStoreId = storeSelect.value;
        if (!month) return showAlert('通知', "月を選択してください");

        tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center;"><i class="fas fa-spinner fa-spin"></i> 読込中...</td></tr>';

        try {
            // t_attendanceから対象月のデータを取得
            const q = query(collection(db, "t_attendance"), 
                where("year_month", "==", month)
            );
            
            const snap = await getDocs(q);
            const rawData = [];
            snap.forEach(d => {
                const data = d.data();
                const sid = data.store_id || data.StoreID || "";
                if (!selectedStoreId || String(sid) === String(selectedStoreId)) {
                    rawData.push({ id: d.id, ...data });
                }
            });

            // スタッフごとにグループ化
            const staffGroup = {};
            rawData.forEach(r => {
                const sid = r.staff_id || r.staff_code || r.EmployeeCode || "unknown";
                if (!staffGroup[sid]) {
                    staffGroup[sid] = {
                        id: sid,
                        code: r.EmployeeCode || r.staff_code || r.staff_id || '-',
                        name: r.staff_name || r.Name || r['名前'] || '不明',
                        store: r.store_name || r.StoreName || r['所属名'] || '-',
                        records: []
                    };
                }
                staffGroup[sid].records.push(r);
            });

            const results = Object.values(staffGroup).map(staff => {
                let totalHours = 0;
                let workDays = new Set();
                
                // インポートデータ（total_labor_hoursがある）か打刻データかを判定
                const imported = staff.records.find(r => r.total_labor_hours !== undefined);
                
                if (imported) {
                    staff.records.forEach(r => {
                        totalHours += (Number(r.total_labor_hours) || 0);
                        if (r.date) workDays.add(r.date.substring(0, 10));
                        else if (r.timestamp) workDays.add(r.timestamp.substring(0, 10));
                    });
                } else {
                    // 打刻データペアリングロジック
                    const recs = staff.records.sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
                    let lastIn = null;
                    let breakStartT = null;
                    let totalBreakMs = 0;
                    recs.forEach(r => {
                        if (!r.timestamp) return;
                        const type = String(r.type || '').toLowerCase();
                        const ts = new Date(r.timestamp);
                        workDays.add(r.timestamp.substring(0, 10));

                        if (type === 'check_in' || type === 'in' || type.includes('出勤')) {
                            lastIn = ts;
                            totalBreakMs = 0;
                            breakStartT = null;
                        } else if (type === 'break_start' || type.includes('休憩開始')) {
                            breakStartT = ts;
                        } else if ((type === 'break_end' || type.includes('休憩終了')) && breakStartT) {
                            totalBreakMs += (ts - breakStartT);
                            breakStartT = null;
                        } else if ((type === 'check_out' || type === 'out' || type.includes('退勤')) && lastIn) {
                            const grossMs = ts - lastIn;
                            const netMs = Math.max(0, grossMs - totalBreakMs);
                            if (netMs > 0) totalHours += netMs / 3600000;
                            lastIn = null;
                            totalBreakMs = 0;
                            breakStartT = null;
                        }
                    });
                }

                return { ...staff, totalHours, days: workDays.size || staff.records.length };
            });

            // 描画
            tbody.innerHTML = '';
            if (results.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center;">該当日付のデータがありません</td></tr>';
                return;
            }

            results.sort((a,b) => a.code.localeCompare(b.code)).forEach(res => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border)';
                tr.innerHTML = `
                    <td style="padding: 1rem; font-family: monospace;">${res.code}</td>
                    <td style="padding: 1rem; font-weight: 600;">${res.name}</td>
                    <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.9rem;">${res.store}</td>
                    <td style="padding: 1rem; text-align: right;">${res.days}日</td>
                    <td style="padding: 1rem; text-align: right; font-weight: 700;">${res.totalHours.toFixed(1)}h</td>
                    <td style="padding: 1rem; text-align: right;">
                        <button class="btn-detail btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; background: var(--surface-darker);">
                            <i class="fas fa-list-ul"></i> 詳細
                        </button>
                    </td>
                `;
                tr.querySelector('.btn-detail').onclick = () => showDetail(res, month);
                tbody.appendChild(tr);
            });

        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="6" style="color:red; padding:2rem; text-align:center;">エラーが発生しました</td></tr>';
        }
    };

    // モーダル制御
    const modal = document.getElementById('check-detail-modal');
    const btnClose = document.getElementById('close-check-modal');
    if (btnClose) btnClose.onclick = () => modal.style.display = 'none';
}

function formatTime(isoStr) {
    if (!isoStr) return '-';
    try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' });
    } catch (e) { return '-'; }
}

function showDetail(staff, month) {
    const modal = document.getElementById('check-detail-modal');
    const title = document.getElementById('detail-staff-name');
    const period = document.getElementById('detail-period');
    const tbody = document.getElementById('detail-table-body');

    title.textContent = staff.name;
    period.textContent = `${month} の打刻記録`;
    tbody.innerHTML = '';

    const recs = staff.records.sort((a,b) => {
        const t1 = a.timestamp || a.date || '';
        const t2 = b.timestamp || b.date || '';
        return t1.localeCompare(t2);
    });

    // ─ 出勤日基準で日次データを構築（日またぎシフト対応） ─
    // check_out が日付をまたいでも、出勤した日の行に正しく表示する
    const dayData = {}; // { [YYYY-MM-DD]: { inTime, outTime, breakMs, hours, storeName, isImported } }

    let activeIn = null;        // check_in の Date オブジェクト
    let activeInDate = null;    // check_in 日付 (YYYY-MM-DD)
    let activeInTime = null;    // check_in 表示時刻
    let activeStoreName = null;
    let breakStartT = null;
    let totalBreakMs = 0;

    recs.forEach(r => {
        const storeName = r.store_name || '-';

        if (r.total_labor_hours !== undefined) {
            // KOTインポートデータ
            const d = (r.timestamp || r.date || '').substring(0, 10);
            if (!dayData[d]) dayData[d] = { inTime: '(インポート)', outTime: '-', breakMs: 0, hours: 0, storeName, isImported: true };
            dayData[d].hours += Number(r.total_labor_hours) || 0;

        } else if (r.timestamp) {
            const type = String(r.type || '').toLowerCase();
            const timeStr = formatTime(r.timestamp);
            const date = r.timestamp.substring(0, 10);

            if (type === 'check_in' || type === 'in' || type.includes('出勤')) {
                activeIn = new Date(r.timestamp);
                activeInDate = date;
                activeInTime = timeStr;
                activeStoreName = storeName;
                totalBreakMs = 0;
                breakStartT = null;
                if (!dayData[date]) {
                    dayData[date] = { inTime: timeStr, outTime: '-', breakMs: 0, hours: 0, storeName, isImported: false };
                } else {
                    dayData[date].inTime = timeStr;
                    dayData[date].storeName = storeName;
                }

            } else if (type === 'break_start' || type.includes('休憩開始')) {
                breakStartT = new Date(r.timestamp);

            } else if ((type === 'break_end' || type.includes('休憩終了')) && breakStartT) {
                totalBreakMs += (new Date(r.timestamp) - breakStartT);
                breakStartT = null;

            } else if (type === 'check_out' || type === 'out' || type.includes('退勤')) {
                if (activeIn) {
                    // ペアになった退勤：出勤日を基準キーにして集計
                    const grossMs = new Date(r.timestamp) - activeIn;
                    const netMs = Math.max(0, grossMs - totalBreakMs);
                    const key = activeInDate;
                    if (!dayData[key]) {
                        dayData[key] = { inTime: activeInTime || '-', outTime: '-', breakMs: 0, hours: 0, storeName: activeStoreName || storeName, isImported: false };
                    }
                    dayData[key].outTime = timeStr;
                    dayData[key].breakMs = totalBreakMs;
                    dayData[key].hours += netMs / 3600000;
                    activeIn = null; activeInDate = null; activeInTime = null;
                    totalBreakMs = 0; breakStartT = null;
                } else {
                    // 対応する check_in がない孤立退勤：退勤時刻だけ記録
                    if (!dayData[date]) {
                        dayData[date] = { inTime: '-', outTime: timeStr, breakMs: 0, hours: 0, storeName, isImported: false };
                    } else {
                        dayData[date].outTime = timeStr;
                    }
                }
            }
        }
    });

    // ─ 描画 ─
    Object.keys(dayData).sort().forEach(d => {
        const day = dayData[d];
        const breakMin = Math.round(day.breakMs / 60000);
        const breakStr = breakMin > 0 ? `${breakMin}分` : '-';

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
            <td style="padding: 0.75rem 0.5rem;">${d}</td>
            <td style="padding: 0.75rem 0.5rem;">${day.storeName}</td>
            <td style="padding: 0.75rem 0.5rem; font-weight: 500;">${day.isImported ? '(インポート)' : day.inTime}</td>
            <td style="padding: 0.75rem 0.5rem; font-weight: 500;">${day.isImported ? '-' : day.outTime}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: right;">${day.isImported ? '-' : breakStr}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: right; font-weight: 600;">${day.hours.toFixed(1)}h</td>
        `;
        tbody.appendChild(tr);
    });

    modal.style.display = 'flex';
}
