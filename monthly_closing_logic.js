import { db } from './firebase.js';
import { collection, getDocs, query, where, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let availableStores = [];

/**
 * 月次確定タブのUIを描画する
 */
export async function renderMonthlyCloseTab(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // タブ内にUIを生成（モーダル用のラッパーを廃止し、コンテンツだけを展開）
    container.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto; background: #ffffff; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.3rem; color: var(--text-primary);"><i class="fas fa-lock" style="color: #f59e0b;"></i> 月次確定処理（締め）</h3>
            </div>
            
            <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem; color: #92400e;">
                <p style="margin: 0 0 0.5rem 0;"><strong><i class="fas fa-info-circle"></i> 月次確定とは？</strong></p>
                <p style="margin: 0;">該当月の全店舗の営業実績（売上・客数・原価率等）を計算し、凍結保存します。確定後はマスタ変更の影響を受けなくなり、ダッシュボードの表示が超高速化されます。<br>※ 全店舗のDiniiデータインポートと、打刻エラーの解消が完了している月のみ確定可能です。</p>
            </div>

            <div style="display: flex; gap: 1rem; align-items: flex-end; margin-bottom: 1.5rem;">
                <div style="flex: 1;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.3rem; color: var(--text-secondary);">対象月</label>
                    <select id="dash-monthly-close-target" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 6px; font-size: 1rem;">
                        <option value="">読み込み中...</option>
                    </select>
                </div>
                <button id="dash-monthly-close-mode-btn" class="btn" style="height: 42px; padding: 0 1.5rem; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; white-space: nowrap;"><i class="fas fa-unlock"></i> 確定解除モードへ切替</button>
                <button id="dash-monthly-close-check-btn" class="btn btn-secondary" style="height: 42px; padding: 0 1.5rem; white-space: nowrap;"><i class="fas fa-search"></i> 状態をチェック</button>
            </div>

            <div id="dash-monthly-close-status-area" style="min-height: 200px; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; overflow-y: auto; max-height: 400px;">
                <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    対象月を選択して「状態をチェック」を押してください。
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                <button id="dash-monthly-close-exec-btn" class="btn btn-primary" style="opacity: 0.5; cursor: not-allowed;" disabled><i class="fas fa-check-double"></i> 全社一括で月次を確定する</button>
            </div>
        </div>
    `;

    // 初期化とイベント登録
    const select = document.getElementById('dash-monthly-close-target');
    
    document.getElementById('dash-monthly-close-check-btn').onclick = async () => {
        const ym = select.value;
        if (!ym) {
            alert('対象月を選択してください。');
            return;
        }
        await checkMonthlyStatus(ym);
    };

    let isUnlockMode = false;
    const modeBtn = document.getElementById('dash-monthly-close-mode-btn');
    const execBtn = document.getElementById('dash-monthly-close-exec-btn');

    modeBtn.onclick = async () => {
        isUnlockMode = !isUnlockMode;
        const checkBtn = document.getElementById('dash-monthly-close-check-btn');
        if (isUnlockMode) {
            modeBtn.innerHTML = '<i class="fas fa-lock"></i> 確定モードへ戻る';
            modeBtn.style.background = '#fee2e2';
            modeBtn.style.color = '#ef4444';
            execBtn.innerHTML = '<i class="fas fa-unlock"></i> 選択した月の解除を実行する';
            execBtn.className = 'btn';
            execBtn.style.background = '#94a3b8';
            execBtn.style.color = '#ffffff';
            checkBtn.style.display = 'none'; // 解除モードでは状態チェックは不要
        } else {
            modeBtn.innerHTML = '<i class="fas fa-unlock"></i> 確定解除モードへ切替';
            modeBtn.style.background = '#f1f5f9';
            modeBtn.style.color = '#475569';
            execBtn.innerHTML = '<i class="fas fa-check-double"></i> 全社一括で月次を確定する';
            execBtn.className = 'btn btn-primary';
            execBtn.style.background = '';
            execBtn.style.color = '';
            checkBtn.style.display = 'block';
        }
        await loadTargetMonths(select, isUnlockMode);
        execBtn.disabled = true;
        execBtn.style.opacity = '0.5';
        execBtn.style.cursor = 'not-allowed';
        if (isUnlockMode) {
            document.getElementById('dash-monthly-close-status-area').innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 2rem;">解除したい月をプルダウンから選択してください。<br>※解除モードでは状態チェックは不要です。対象月を選択するとすぐに解除ボタンが押せるようになります。</div>';
        } else {
            document.getElementById('dash-monthly-close-status-area').innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 2rem;">対象月を選択して「状態をチェック」を押してください。</div>';
        }
    };
    
    select.onchange = () => {
        if (isUnlockMode) {
            if (select.value) {
                execBtn.disabled = false;
                execBtn.style.opacity = '1';
                execBtn.style.cursor = 'pointer';
            } else {
                execBtn.disabled = true;
                execBtn.style.opacity = '0.5';
                execBtn.style.cursor = 'not-allowed';
            }
        }
    };

    execBtn.onclick = async () => {
        const ym = select.value;
        if (!ym) return;
        if (isUnlockMode) {
            await unlockMonthlyClose(ym);
        } else {
            await executeMonthlyClose(ym);
        }
    };

    // 店舗マスタ取得
    if (availableStores.length === 0) {
        const sSnap = await getDocs(collection(db, "m_stores"));
        sSnap.forEach(d => availableStores.push({ id: d.id, ...d.data() }));
    }

    await loadTargetMonths(select, isUnlockMode);
}

/**
 * 対象月をプルダウンにセットする
 */
async function loadTargetMonths(select, isUnlockMode) {
    try {
        const fixedSnap = await getDocs(collection(db, "t_fixed_monthly_records"));
        const fixedMonths = new Set();
        fixedSnap.forEach(d => {
            if (d.id.startsWith('store_all_month_')) {
                fixedMonths.add(d.id.replace('store_all_month_', ''));
            }
        });

        const today = new Date();
        const currentYear = today.getFullYear();

        let optionsHtml = '<option value="">-- 対象月を選択 --</option>';
        let count = 0;

        for (let i = 0; i <= 24; i++) {
            let d = new Date(currentYear, today.getMonth() - i, 1);
            let y = d.getFullYear();
            let m = String(d.getMonth() + 1).padStart(2, '0');
            let ym = `${y}-${m}`;

            if (isUnlockMode) {
                if (fixedMonths.has(ym)) {
                    optionsHtml += `<option value="${ym}">${y}年${m}月 (確定済み)</option>`;
                    count++;
                }
            } else {
                if (!fixedMonths.has(ym)) {
                    optionsHtml += `<option value="${ym}">${y}年${m}月 (未確定)</option>`;
                    count++;
                }
            }
        }

        if (count === 0) {
            select.innerHTML = isUnlockMode 
                ? '<option value="">解除可能な確定済みの月はありません</option>'
                : '<option value="">確定可能な過去の月はありません</option>';
            select.disabled = true;
        } else {
            select.innerHTML = optionsHtml;
            select.disabled = false;
        }
    } catch (e) {
        console.error("Failed to load target months:", e);
        select.innerHTML = '<option value="">エラーが発生しました</option>';
    }
}

/**
 * 全店舗のエラー状況をチェックする
 */
async function checkMonthlyStatus(ym) {
    const statusArea = document.getElementById('dash-monthly-close-status-area');
    const execBtn = document.getElementById('dash-monthly-close-exec-btn');
    
    statusArea.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem 0; color:var(--text-secondary);">
            <i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary); margin-bottom:1rem;"></i>
            <p style="margin:0; font-weight:700;">全店舗のステータスを自動チェック中...</p>
            <p style="margin-top:0.5rem; font-size:0.8rem;">Diniiデータインポート状況と勤怠エラーを確認しています。</p>
        </div>
    `;
    
    execBtn.disabled = true;
    execBtn.style.opacity = '0.5';
    execBtn.style.cursor = 'not-allowed';

    try {
        let allClear = true;
        let tableHtml = `
            <table class="dash-data-table" style="width:100%; border-collapse:collapse; margin-top:0;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:0.6rem; text-align:left; border-bottom:1px solid var(--border);">店舗</th>
                        <th style="padding:0.6rem; text-align:center; border-bottom:1px solid var(--border);">Diniiインポート</th>
                        <th style="padding:0.6rem; text-align:center; border-bottom:1px solid var(--border);">勤怠エラー</th>
                        <th style="padding:0.6rem; text-align:center; border-bottom:1px solid var(--border);">ステータス</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // 該当年月の全勤怠データを取得（店舗ごとに分けないで1回のクエリで取得）
        const attQuery = query(collection(db, "t_attendance"), where("month", "==", ym));
        const attSnap = await getDocs(attQuery);
        const attByStore = {};
        attSnap.forEach(d => {
            const data = d.data();
            const sid = data.store_id;
            if (!attByStore[sid]) attByStore[sid] = [];
            attByStore[sid].push(data);
        });

        // 該当年月の全売上データを取得（インポート確認用）
        const salesQuery = query(collection(db, "t_monthly_sales"), where("year_month", "==", ym));
        const salesSnap = await getDocs(salesQuery);
        const salesStores = new Set();
        salesSnap.forEach(d => {
            salesStores.add(d.data().store_id);
        });

        // 該当年月の全営業実績データを取得（売上報告の有無確認用）
        const perfQuery = query(collection(db, "t_performance"), where("year_month", "==", ym));
        const perfSnap = await getDocs(perfQuery);
        const perfStores = new Set();
        perfSnap.forEach(d => {
            perfStores.add(d.data().store_id);
        });

        for (const store of availableStores) {
            const sName = store.store_name || '';
            const sId = store.store_id || store.id;

            // 本部やテスト店舗などを除外する条件
            if (sName.includes("テスト") || sId === "admin") continue;

            // CK店舗かどうかの判定
            const isCK = store.store_type === 'CK';
            
            // 2. 勤怠・売上実績の存在チェック
            const attList = attByStore[sId] || [];
            const hasAtt = attList.length > 0;
            const hasPerf = perfStores.has(sId);

            // 売上報告も勤怠データもない場合は、未稼働店舗とみなして一覧から完全にスキップする
            if (!hasAtt && !hasPerf) {
                continue;
            }

            // Dinii運用開始月より過去の月かどうかの判定
            let isPreDinii = false;
            if (store.dinii_start_month) {
                // ym は "YYYY-MM" 形式なので直接文字列比較可能
                if (ym < store.dinii_start_month) {
                    isPreDinii = true;
                }
            }

            // 1. Diniiインポートチェック
            // CKまたはDinii運用開始前であれば、インポート不要（常にtrueとする）
            const hasSales = (isCK || isPreDinii) ? true : salesStores.has(sId);
            
            // 勤怠エラー数チェック
            let errorCount = 0;
            attList.forEach(a => {
                // 出勤があるのに退勤がない、または退勤があるのに出勤がない（打刻漏れ）
                if (a.clock_in_time && !a.clock_out_time) errorCount++;
                else if (!a.clock_in_time && a.clock_out_time) errorCount++;
            });

            const isStoreClear = hasSales && errorCount === 0;
            if (!isStoreClear) allClear = false;

            // Diniiインポート列の表示（CKまたは運用前は横線）
            let importDisplay = '';
            if (isCK) {
                importDisplay = '<span style="color:#10b981; font-weight:700;">ー</span>';
            } else if (isPreDinii) {
                importDisplay = '<span style="color:#10b981; font-weight:700;">運用前 (免除)</span>';
            } else {
                importDisplay = hasSales 
                    ? '<span style="color:#10b981;"><i class="fas fa-check-circle"></i> 完了</span>' 
                    : '<span style="color:#ef4444; font-weight:700;"><i class="fas fa-times-circle"></i> 未インポート</span>';
            }

            tableHtml += `
                <tr>
                    <td style="padding:0.6rem; border-bottom:1px solid #e2e8f0; font-weight:700;">${sName}</td>
                    <td style="padding:0.6rem; border-bottom:1px solid #e2e8f0; text-align:center;">
                        ${importDisplay}
                    </td>
                    <td style="padding:0.6rem; border-bottom:1px solid #e2e8f0; text-align:center;">
                        ${errorCount === 0 
                            ? '<span style="color:#10b981;"><i class="fas fa-check-circle"></i> エラーなし</span>' 
                            : '<span style="color:#ef4444; font-weight:700;"><i class="fas fa-exclamation-triangle"></i> ' + errorCount + '件のエラー</span>'}
                    </td>
                    <td style="padding:0.6rem; border-bottom:1px solid #e2e8f0; text-align:center;">
                        ${isStoreClear 
                            ? '<span style="background:#ecfdf5; color:#10b981; padding:2px 8px; border-radius:12px; font-size:0.75rem; border:1px solid #a7f3d0;">確定可能</span>'
                            : '<span style="background:#fef2f2; color:#ef4444; padding:2px 8px; border-radius:12px; font-size:0.75rem; border:1px solid #fecaca;">準備未完了</span>'}
                    </td>
                </tr>
            `;
        }

        tableHtml += '</tbody></table>';

        if (allClear) {
            tableHtml = `
                <div style="background:#ecfdf5; border:1px solid #34d399; padding:1rem; border-radius:8px; margin-bottom:1rem; color:#065f46; display:flex; align-items:center; gap:0.8rem;">
                    <i class="fas fa-check-circle fa-2x" style="color:#10b981;"></i>
                    <div>
                        <strong style="display:block; font-size:1.1rem;">すべての店舗で準備が完了しています！</strong>
                        <span style="font-size:0.85rem;">右下のボタンから「${ym}度」の全社一括確定を実行できます。</span>
                    </div>
                </div>
            ` + tableHtml;
            execBtn.disabled = false;
            execBtn.style.opacity = '1';
            execBtn.style.cursor = 'pointer';
        } else {
            tableHtml = `
                <div style="background:#fef2f2; border:1px solid #f87171; padding:1rem; border-radius:8px; margin-bottom:1rem; color:#991b1b; display:flex; align-items:center; gap:0.8rem;">
                    <i class="fas fa-exclamation-circle fa-2x" style="color:#ef4444;"></i>
                    <div>
                        <strong style="display:block; font-size:1.1rem;">準備が未完了の店舗があります。</strong>
                        <span style="font-size:0.85rem;">全店舗のDiniiインポートと勤怠エラー解消が完了するまで、確定は行えません。（完全ロック）</span>
                    </div>
                </div>
            ` + tableHtml;
        }

        statusArea.innerHTML = tableHtml;

    } catch (e) {
        console.error("Status check error:", e);
        statusArea.innerHTML = `<div style="color:var(--danger); padding:2rem; text-align:center;">エラーが発生しました: ${e.message}</div>`;
    }
}

/**
 * 確定処理を実行する
 */
async function executeMonthlyClose(ym) {
    if (!confirm(`${ym}度の営業実績を全社一括で確定します。\nよろしいですか？\n※確定後はダッシュボードにこの固定データが高速表示されます。`)) {
        return;
    }

    const execBtn = document.getElementById('dash-monthly-close-exec-btn');
    execBtn.disabled = true;
    execBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 確定処理を実行中...';

    try {
        const [yStr, mStr] = ym.split('-');
        const daysInMonth = new Date(yStr, mStr, 0).getDate();
        const dateFrom = `${ym}-01`;
        const dateTo = `${ym}-${String(daysInMonth).padStart(2, '0')}`;

        // 計算エンジンの呼び出し (全社一括)
        const { fetchAndCalculateDashboardData } = await import('./dashboard_calculator.js?v=2');
        const snapshot = await fetchAndCalculateDashboardData(db, dateFrom, dateTo, 'all', 'all');

        // t_fixed_monthly_records に「全社」として1つのドキュメントに保存
        const fixedDocId = `store_all_month_${ym}`;
        
        await setDoc(doc(db, "t_fixed_monthly_records", fixedDocId), {
            year_month: ym,
            store_id: 'all',
            dashboard_snapshot: snapshot,
            closed_at: new Date().toISOString(),
            closed_by: 'system'
        });

        alert(`${ym}度の月次確定が完了しました。\n今後はダッシュボードでこのデータが瞬時に表示されます。`);
        location.reload();

    } catch (e) {
        console.error("Monthly close execution error:", e);
        alert('確定処理中にエラーが発生しました: ' + e.message);
        execBtn.disabled = false;
        execBtn.innerHTML = '<i class="fas fa-check-double"></i> 全社一括で月次を確定する';
    }
}

async function unlockMonthlyClose(ym) {
    if (!confirm(`${ym}度の確定状態を解除し、未確定に戻しますか？\n※一時的に計算が重くなります。`)) return;

    try {
        const fixedDocId = `store_all_month_${ym}`;
        await deleteDoc(doc(db, "t_fixed_monthly_records", fixedDocId));

        alert(`${ym}度の確定を解除しました。`);
        location.reload();
    } catch (e) {
        console.error("Unlock error:", e);
        alert('解除に失敗しました: ' + e.message);
    }
}
