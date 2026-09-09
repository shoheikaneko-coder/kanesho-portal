
// =========================================================================
// ─── 【新機能】 年間休日管理 ────────────────────────────────────
// =========================================================================

let lastLoadedPaidLeaveData = null;

// 年度プルダウンの初期化
function initPaidLeaveYearSelect() {
    const sel = document.getElementById('attn-int-paid-year');
    if (!sel || sel.options.length > 0) return; // 既に生成済みならスキップ
    const now = new Date();
    // 7月始まりの年度
    let currentYear = now.getFullYear();
    if (now.getMonth() + 1 < 7) {
        currentYear -= 1;
    }
    
    // 過去2年〜未来1年を生成
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y}年度 (${y}/07/01〜${y+1}/06/30)`;
        if (y === currentYear) opt.selected = true;
        sel.appendChild(opt);
    }
    
    sel.addEventListener('change', loadIntPaidLeaveData);
}

// 会社基準休日数の保存
document.getElementById('btn-attn-int-paid-save-base')?.addEventListener('click', async () => {
    const year = document.getElementById('attn-int-paid-year').value;
    const baseInput = document.getElementById('attn-int-paid-base').value;
    if (!year || !baseInput) return;
    
    const btn = document.getElementById('btn-attn-int-paid-save-base');
    const origText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
        await setDoc(doc(db, "m_holiday_settings", `setting_${year}`), {
            year: parseInt(year),
            base_holidays: parseInt(baseInput),
            updated_at: new Date()
        });
        showAlert('成功', `${year}年度の会社基準休日数を保存しました。`);
        loadIntPaidLeaveData();
    } catch(e) {
        console.error(e);
        showAlert('エラー', '設定の保存に失敗しました。');
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
});

// 年間休日のメインデータ取得処理
async function loadIntPaidLeaveData() {
    initPaidLeaveYearSelect();
    
    const yearStr = document.getElementById('attn-int-paid-year').value;
    if (!yearStr) return;
    const year = parseInt(yearStr);
    const storeId = document.getElementById('attn-int-store-filter')?.value || '';
    
    // UI表示の初期化
    const tbody = document.getElementById('attn-int-paid-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="padding: 3rem; text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> 計算中...</td></tr>';
    
    try {
        // 1. 会社設定の取得
        const setSnap = await getDoc(doc(db, "m_holiday_settings", `setting_${year}`));
        let baseHolidays = 120; // デフォルト
        if (setSnap.exists() && setSnap.data().base_holidays) {
            baseHolidays = setSnap.data().base_holidays;
        }
        document.getElementById('attn-int-paid-base').value = baseHolidays;
        
        // 2. スタッフ一覧の取得
        const usersSnap = await getDocs(collection(db, 'm_users'));
        const staffMap = {};
        usersSnap.forEach(d => {
            const data = d.data();
            // 退職者は一旦除外するか、条件次第だが基本在籍者
            if (data.Status === 'retired') return;
            // 店舗フィルター
            if (storeId && data.StoreID !== storeId) return;
            
            staffMap[d.id] = {
                id: d.id,
                code: data.Code || d.id,
                name: data.DisplayName || data.Name || '名称未設定',
                store_id: data.StoreID,
                hire_date: data.HireDate || null,
                fixed_holidays: data.FixedHolidays || [],
                custom_bases: data.CustomBaseHolidays || {}
            };
        });
        
        const staffIds = Object.keys(staffMap);
        if (staffIds.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="padding: 3rem; text-align: center; color: var(--text-secondary);">該当するスタッフがいません</td></tr>';
            return;
        }
        
        // 3. カレンダーの取得 (12ヶ月分)
        const companyOffSet = new Set();
        let missingCalendar = false;
        
        for (let m = 0; m < 12; m++) {
            let mYear = year;
            let mMonth = 7 + m;
            if (mMonth > 12) {
                mYear++;
                mMonth -= 12;
            }
            const ym = `${mYear}-${String(mMonth).padStart(2, '0')}`;
            const calSnap = await getDoc(doc(db, "m_calendars", `${ym}_common`));
            if (!calSnap.exists()) {
                missingCalendar = true;
            } else {
                const days = calSnap.data().days || [];
                days.forEach(dayInfo => {
                    if (dayInfo.type === 'off') {
                        companyOffSet.add(`${ym}-${String(dayInfo.day).padStart(2, '0')}`);
                    }
                });
            }
        }
        
        const warnEl = document.getElementById('attn-int-paid-warning');
        if (warnEl) warnEl.style.display = missingCalendar ? 'block' : 'none';
        
        // 時間軸の設定
        const fyStart = new Date(`${year}-07-01T00:00:00`);
        const fyEnd = new Date(`${year+1}-06-30T23:59:59`);
        
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const today = new Date(`${todayStr}T00:00:00`);
        
        let pastStart = null, pastEnd = null;
        let futureStart = null, futureEnd = null;
        
        if (now >= fyEnd) {
            // 過去年度
            pastStart = fyStart;
            pastEnd = fyEnd;
        } else if (now < fyStart) {
            // 未来年度
            futureStart = fyStart;
            futureEnd = fyEnd;
        } else {
            // 現在年度
            pastStart = fyStart;
            pastEnd = new Date(today.getTime() - 86400000); // yesterday
            futureStart = today;
            futureEnd = fyEnd;
        }
        
        // 過去期間がある場合、t_attendanceを取得
        let attendanceSetByStaff = {};
        if (pastStart && pastEnd) {
            const psStr = `${pastStart.getFullYear()}-${String(pastStart.getMonth()+1).padStart(2,'0')}-${String(pastStart.getDate()).padStart(2,'0')}`;
            const peStr = `${pastEnd.getFullYear()}-${String(pastEnd.getMonth()+1).padStart(2,'0')}-${String(pastEnd.getDate()).padStart(2,'0')}`;
            
            // 全件取得だと重いので、この期間のレコードを取得
            const q = query(collection(db, 't_attendance'), 
                where('date', '>=', psStr),
                where('date', '<=', peStr)
            );
            const attSnap = await getDocs(q);
            attSnap.forEach(d => {
                const data = d.data();
                if (data.type === 'check_in' || data.type === '出勤') {
                    const sid = data.staff_id;
                    if (!attendanceSetByStaff[sid]) attendanceSetByStaff[sid] = new Set();
                    attendanceSetByStaff[sid].add(data.date);
                }
            });
        }
        
        // 4. 各スタッフの計算
        const results = [];
        
        for (let uid of staffIds) {
            const st = staffMap[uid];
            
            // 適用基準
            const applyBase = st.custom_bases[yearStr] !== undefined ? st.custom_bases[yearStr] : baseHolidays;
            
            // 入社日考慮
            const hDate = st.hire_date ? new Date(`${st.hire_date}T00:00:00`) : new Date('2000-01-01T00:00:00');
            
            // 過去の計算
            let achievedHolidays = 0;
            if (pastStart && pastEnd) {
                // そのスタッフの開始日は年度開始か入社日の遅い方
                let actualPastStart = pastStart > hDate ? pastStart : hDate;
                if (actualPastStart <= pastEnd) {
                    const elapsedDays = Math.round((pastEnd - actualPastStart) / 86400000) + 1;
                    const workDays = attendanceSetByStaff[st.code] ? attendanceSetByStaff[st.code].size : 0;
                    achievedHolidays = Math.max(0, elapsedDays - workDays);
                }
            }
            
            // 未来の計算
            let futureFixedCount = 0;
            let futureCompanyCount = 0;
            let overlapCount = 0;
            
            if (futureStart && futureEnd) {
                let actualFutureStart = futureStart > hDate ? futureStart : hDate;
                if (actualFutureStart <= futureEnd) {
                    let d = new Date(actualFutureStart);
                    while (d <= futureEnd) {
                        const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        const isFixed = st.fixed_holidays.includes(d.getDay());
                        const isCompany = companyOffSet.has(dStr);
                        
                        if (isFixed) futureFixedCount++;
                        if (isCompany) futureCompanyCount++;
                        if (isFixed && isCompany) overlapCount++;
                        
                        d.setDate(d.getDate() + 1);
                    }
                }
            }
            
            const estimated = achievedHolidays + futureFixedCount + futureCompanyCount - overlapCount;
            const required = Math.max(0, applyBase - estimated);
            
            results.push({
                ...st,
                applyBase,
                isCustomBase: st.custom_bases[yearStr] !== undefined,
                achievedHolidays,
                futureFixedCount,
                futureCompanyCount,
                overlapCount,
                estimated,
                required
            });
        }
        
        lastLoadedPaidLeaveData = { year, results };
        renderIntPaidLeave();
        
    } catch (err) {
        console.error(err);
        showAlert('エラー', '年間休日データの取得に失敗しました。');
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="padding: 3rem; text-align: center; color: var(--danger);">データ読み込みエラー</td></tr>';
    }
}

function renderIntPaidLeave() {
    const data = lastLoadedPaidLeaveData;
    const body = document.getElementById('attn-int-paid-body');
    if (!body || !data) return;
    
    if (data.results.length === 0) {
        body.innerHTML = '<tr><td colspan="9" style="padding: 3rem; text-align: center; color: var(--text-secondary);">データがありません</td></tr>';
        return;
    }
    
    // 休日の曜日表示用
    const dowNames = ['日','月','火','水','木','金','土'];
    
    let html = '';
    data.results.sort((a,b) => a.code.localeCompare(b.code)).forEach(st => {
        const fixedStr = st.fixed_holidays.map(d => dowNames[d]).join('・') || 'なし';
        
        let reqHtml = `${st.required}日`;
        if (st.required > 0) {
            reqHtml = `<span style="color:red; font-weight:bold;">${st.required}日</span>`;
        }
        
        const applyBaseHtml = st.isCustomBase 
            ? `<span style="color:var(--primary); font-weight:bold;">${st.applyBase}日 (個人)</span>`
            : `${st.applyBase}日`;
            
        html += `
            <tr>
                <td style="font-weight: 700;">${st.name} <span style="font-size:0.75rem; font-weight:normal; font-family:monospace; color:var(--text-secondary);">(${st.code})</span></td>
                <td>${applyBaseHtml}</td>
                <td>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>${fixedStr}</span>
                        <button class="btn btn-sm" style="background:#f1f5f9; padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="openIntPaidModal('${st.id}', '${st.name}', '${st.code}')"><i class="fas fa-edit"></i></button>
                    </div>
                </td>
                <td>${st.achievedHolidays}日</td>
                <td>${st.futureFixedCount}日</td>
                <td>${st.futureCompanyCount}日</td>
                <td>${st.overlapCount}日</td>
                <td style="font-weight:700;">${st.estimated}日</td>
                <td>${reqHtml}</td>
            </tr>
        `;
    });
    
    body.innerHTML = html;
}

// 個人設定モーダルのオープン
function openIntPaidModal(uid, name, code) {
    const data = lastLoadedPaidLeaveData;
    if (!data) return;
    
    const yearStr = document.getElementById('attn-int-paid-year').value;
    const st = data.results.find(r => r.id === uid);
    if (!st) return;
    
    document.getElementById('attn-int-paid-modal-name').textContent = name;
    document.getElementById('attn-int-paid-modal-uid').value = uid;
    document.getElementById('attn-int-paid-modal-year').value = yearStr;
    document.getElementById('attn-int-paid-modal-year-label').textContent = yearStr;
    
    // 固定休日のチェックボックス
    document.querySelectorAll('input[name="paid-fixed-dow"]').forEach(cb => {
        cb.checked = st.fixed_holidays.includes(parseInt(cb.value));
    });
    
    // 個人別基準日数
    const cbInput = document.getElementById('attn-int-paid-modal-custom-base');
    if (st.isCustomBase) {
        cbInput.value = st.applyBase;
    } else {
        cbInput.value = ''; // placeholderが見えるように
    }
    
    document.getElementById('attn-int-paid-modal').style.display = 'block';
}

// 個人設定の保存
document.getElementById('btn-attn-int-paid-modal-save')?.addEventListener('click', async () => {
    const uid = document.getElementById('attn-int-paid-modal-uid').value;
    const yearStr = document.getElementById('attn-int-paid-modal-year').value;
    if (!uid || !yearStr) return;
    
    const btn = document.getElementById('btn-attn-int-paid-modal-save');
    const origText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
        const newFixed = [];
        document.querySelectorAll('input[name="paid-fixed-dow"]:checked').forEach(cb => {
            newFixed.push(parseInt(cb.value));
        });
        
        const cbVal = document.getElementById('attn-int-paid-modal-custom-base').value;
        
        // 既存のユーザー情報を取得して部分更新
        const userRef = doc(db, 'm_users', uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) throw new Error('User not found');
        
        const userData = userSnap.data();
        const customBases = userData.CustomBaseHolidays || {};
        
        if (cbVal === '') {
            delete customBases[yearStr];
        } else {
            customBases[yearStr] = parseInt(cbVal);
        }
        
        await updateDoc(userRef, {
            FixedHolidays: newFixed,
            CustomBaseHolidays: customBases
        });
        
        document.getElementById('attn-int-paid-modal').style.display = 'none';
        showAlert('成功', '個人設定を保存しました。');
        
        // 再計算
        loadIntPaidLeaveData();
        
    } catch(e) {
        console.error(e);
        showAlert('エラー', '設定の保存に失敗しました: ' + e.message);
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
});

