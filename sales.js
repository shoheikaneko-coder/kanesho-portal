import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, query, orderBy, limit, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert } from './ui_utils.js';
import { processFile } from './import-logic.js';

export const salesPageHtml = `
    <div class="animate-fade-in">
        <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 2rem;">
            <div class="glass" style="padding: 0.3rem; border-radius: 12px; display: flex; gap: 0.2rem;">
                <button id="view-import-btn" class="btn" style="padding: 0.5rem 1rem; font-size: 0.85rem;">インポート</button>
            </div>
        </div>

        <div id="sales-form-view">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem;">
                <!-- 報告フォーム -->
                <div class="glass-panel" style="padding: 2rem;">
                    <h3 id="form-title" style="margin-top: 0; margin-bottom: 1.5rem; font-size: 1.1rem; color: var(--text-primary);">新規レポート作成</h3>
                    <form id="sales-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <input type="hidden" id="sales-doc-id">
                        
                        <!-- 日付・店舗 -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label class="field-label">日付</label>
                                <input type="date" id="report-date" required class="form-input">
                            </div>
                            <div>
                                <label class="field-label">店舗</label>
                                <select id="report-store" required class="form-input">
                                    <option value="">選択してください</option>
                                </select>
                            </div>
                        </div>

                        <!-- 売上・客数 -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label class="field-label">売上金額 (税込)</label>
                                <input type="text" id="report-amount" required placeholder="0" class="form-input num-input" style="font-size: 1.2rem; font-weight: 700;">
                                <input type="hidden" id="raw-amount">
                            </div>
                            <div>
                                <label class="field-label">来客数</label>
                                <input type="text" id="report-customers" required placeholder="0" class="form-input num-input">
                                <input type="hidden" id="raw-customers">
                            </div>
                        </div>

                        <!-- 現金過不足 -->
                        <div>
                            <label class="field-label">現金過不足</label>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <select id="report-diff-sign" class="form-input" style="width: 70px; padding: 0.8rem 0.5rem; text-align: center;">
                                    <option value="1">+</option>
                                    <option value="-1">-</option>
                                </select>
                                <input type="text" id="report-diff" required value="0" class="form-input num-input" style="text-align: right; flex: 1;" placeholder="金額を入力">
                                <input type="hidden" id="raw-diff" value="0">
                            </div>
                        </div>

                        <!-- チップ・天気 -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                            <div>
                                <label class="field-label">受け取りチップ</label>
                                <input type="text" id="report-tip" placeholder="0" class="form-input num-input">
                                <input type="hidden" id="raw-tip">
                            </div>
                            <div>
                                <label class="field-label">天気１</label>
                                <select id="report-weather1" class="form-input">
                                    <option value="晴れ">☀️ 晴れ</option>
                                    <option value="曇り">☁️ 曇り</option>
                                    <option value="雨">☔ 雨</option>
                                    <option value="雪">❄️ 雪</option>
                                </select>
                            </div>
                            <div>
                                <label class="field-label">天気２</label>
                                <select id="report-weather2" class="form-input">
                                    <option value="-">-</option>
                                    <option value="晴れ">☀️ 晴れ</option>
                                    <option value="曇り">☁️ 曇り</option>
                                    <option value="雨">☔ 雨</option>
                                    <option value="雪">❄️ 雪</option>
                                </select>
                            </div>
                        </div>

                        <!-- 小口現金 -->
                        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
                            <div>
                                <label class="field-label">小口現金使用</label>
                                <input type="text" id="report-petty-cash" placeholder="0" class="form-input num-input">
                                <input type="hidden" id="raw-petty-cash" value="0">
                            </div>
                            <div id="petty-note-row" style="display: none;">
                                <label class="field-label">使用用途</label>
                                <input type="text" id="report-petty-note" placeholder="用途を入力してください" class="form-input">
                            </div>
                        </div>

                        <!-- 自動計算項目 -->
                        <div class="glass" style="padding: 1rem; border-radius: 12px; background: rgba(0,0,0,0.03); display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                            <div>
                                <label class="field-label" style="font-size: 0.7rem;">回転数</label>
                                <div id="calc-turnover" class="calc-val">-</div>
                            </div>
                            <div>
                                <label class="field-label" style="font-size: 0.7rem;">売上（税抜）</label>
                                <div id="calc-ex-tax" class="calc-val">-</div>
                            </div>
                            <div>
                                <label class="field-label" style="font-size: 0.7rem;">客単価</label>
                                <div id="calc-avg-spend" class="calc-val">-</div>
                            </div>
                        </div>

                        <!-- 備考・その他 -->
                        <div>
                            <label class="field-label">備考 (営業中に気づいたこと)</label>
                            <textarea id="report-note" class="form-input" style="min-height: 60px;" placeholder="気づいたことがあれば"></textarea>
                        </div>
                        <div>
                            <label class="field-label">その他連絡事項</label>
                            <textarea id="report-other-notes" class="form-input" style="min-height: 40px;"></textarea>
                        </div>

                        <!-- ボタン -->
                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <button type="submit" id="submit-share-btn" class="btn btn-primary" style="flex: 2; padding: 1rem; background: linear-gradient(135deg, #06C755 0%, #05B34C 100%); border: none;">
                                <i class="fab fa-line" style="font-size: 1.2rem; margin-right: 0.5rem;"></i> 保存してLINE報告
                            </button>
                            <button type="button" id="reset-btn" class="btn" style="flex: 1; background: #eee;">リセット</button>
                        </div>
                    </form>
                </div>

                <div class="glass-panel" style="padding: 1.5rem; display: flex; flex-direction: column;">
                    <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-size: 1.1rem; color: var(--text-primary);">最近の報告履歴</h3>
                    <div id="history-list" style="display: flex; flex-direction: column; gap: 1rem; flex: 1; overflow-y: auto; max-height: 800px;">
                        <!-- 履歴データ -->
                    </div>
                </div>
            </div>
        </div>

        <div id="import-view" style="display: none;">
            <div class="glass-panel" style="padding: 3rem; text-align: center; max-width: 700px; margin: 0 auto;">
                <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
                    <button id="close-import-btn" class="btn" style="padding: 0.5rem;"><i class="fas fa-times"></i> 閉じる</button>
                </div>
                <i class="fas fa-file-import" style="font-size: 3rem; color: var(--primary); margin-bottom: 1.5rem;"></i>
                <h3>データインポート</h3>
                <p style="margin-bottom: 2rem;">Excelファイルまたは勤怠CSVを選択してアップロードしてください。</p>
                
                <input type="file" id="import-file-input" style="display: none;" accept=".xlsx, .xls, .csv" multiple>
                <button class="btn btn-primary" onclick="document.getElementById('import-file-input').click()" style="padding: 1.5rem 2rem; width: 100%; font-size: 1.1rem; border: 2px dashed rgba(230,57,70,0.3); background: transparent; color: var(--primary);">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 1.5rem; display: block; margin-bottom: 0.5rem;"></i>
                    ファイルを選択（複数可）
                </button>

                <div id="import-log" style="margin-top: 2rem; background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 1rem; text-align: left; height: 300px; overflow-y: auto; font-family: monospace; font-size: 0.85rem; display: none;">
                    <!-- ログ出力 -->
                </div>
            </div>
        </div>
    </div>

    <style>
        .active-tab { background: var(--primary) !important; color: white !important; }
        .field-label { display: block; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.85rem; color: var(--text-secondary); }
        .form-input { width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 10px; background: white; transition: all 0.2s; }
        .form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(230,57,70,0.1); outline: none; }
        .diff-btn { padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; background: white; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.1s; }
        .diff-btn:active { transform: translateY(1px); background: #f0f0f0; }
        .calc-val { font-weight: 800; color: var(--text-primary); font-size: 1rem; }
        .num-input { text-align: right; font-family: 'Inter', sans-serif; }
    </style>
`;

let currentSeats = 0;

export async function initSalesPage() {
    await loadStoreOptions();
    await fetchHistory();

    const formView = document.getElementById('sales-form-view');
    const importView = document.getElementById('import-view');
    const importBtn = document.getElementById('view-import-btn');
    const closeImportBtn = document.getElementById('close-import-btn');

    if (importBtn) {
        importBtn.onclick = () => {
            formView.style.display = 'none';
            importView.style.display = 'block';
        };
    }
    if (closeImportBtn) {
        closeImportBtn.onclick = () => {
            importView.style.display = 'none';
            formView.style.display = 'block';
        };
    }

    // 数値入力のカンマ区切り設定
    const numInputs = ['report-amount', 'report-customers', 'report-diff', 'report-tip', 'report-petty-cash'];
    numInputs.forEach(id => {
        const el = document.getElementById(id);
        const rawEl = document.getElementById('raw-' + id.split('-')[1]);
        if (el) {
            el.oninput = (e) => {
                let val = e.target.value.replace(/[^0-9]/g, ''); // 符号はセレクトボックスで制御するので除去
                if (val === '') {
                    if (rawEl) rawEl.value = 0;
                    return;
                }
                const num = parseInt(val);
                e.target.value = num.toLocaleString();
                
                // raw-diff の場合は符号を考慮
                if (id === 'report-diff') {
                    const sign = parseInt(document.getElementById('report-diff-sign').value) || 1;
                    if (rawEl) rawEl.value = num * sign;
                } else {
                    if (rawEl) rawEl.value = num;
                }
                
                updateCalculations();
            };
            el.onblur = (e) => {
                if (e.target.value === '') {
                    e.target.value = '0';
                    if (rawEl) rawEl.value = 0;
                }
                updateCalculations();
            };
        }
    });

    // 符号変更時の計算更新
    const diffSign = document.getElementById('report-diff-sign');
    if (diffSign) {
        diffSign.onchange = () => {
            const val = parseInt(document.getElementById('report-diff').value.replace(/,/g, '')) || 0;
            const sign = parseInt(diffSign.value) || 1;
            document.getElementById('raw-diff').value = val * sign;
            updateCalculations();
        };
    }

    // 小口現金の表示切り替え
    const pettyInput = document.getElementById('report-petty-cash');
    const pettyNoteRow = document.getElementById('petty-note-row');
    if (pettyInput) {
        pettyInput.addEventListener('input', () => {
            const val = parseInt(pettyInput.value.replace(/,/g, '')) || 0;
            pettyNoteRow.style.display = val > 0 ? 'block' : 'none';
        });
    }

    // 店舗選択時の席数取得
    const storeSel = document.getElementById('report-store');
    if (storeSel) {
        storeSel.onchange = async () => {
            const sid = storeSel.value;
            if (sid) {
                const docSnap = await getDoc(doc(db, "m_stores", sid));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    currentSeats = data.seat_count || data.席数 || 0;
                    console.log(`Store ${sid} loaded. Seats:`, currentSeats);
                }
            } else {
                currentSeats = 0;
            }
            updateCalculations();
        };
    }

    // adjustDiff 関数は不要になったため削除（または後方互換性のために空にする）
    window.adjustDiff = () => {};

    function updateCalculations() {
        const amount = parseInt(document.getElementById('raw-amount').value) || 0;
        const customers = parseInt(document.getElementById('raw-customers').value) || 0;
        const diff = parseInt(document.getElementById('raw-diff').value) || 0;

        // 回転数: 客数 / 席数
        const turnover = currentSeats > 0 ? (customers / currentSeats).toFixed(2) : '-';
        console.log(`Calculating turnover: ${customers} / ${currentSeats} = ${turnover}`);
        
        // 売上（税抜）: (売上税込 + 現金過不足) / 1.1
        const exTax = Math.round((amount + diff) / 1.1);
        
        // 客単価: 売上税抜 / 客数
        const avgSpend = customers > 0 ? Math.round(exTax / customers) : '-';

        document.getElementById('calc-turnover').textContent = turnover;
        document.getElementById('calc-ex-tax').textContent = exTax.toLocaleString();
        document.getElementById('calc-avg-spend').textContent = avgSpend === '-' ? '-' : avgSpend.toLocaleString();
    }

    const form = document.getElementById('sales-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const sid = document.getElementById('report-store').value;
            const date = document.getElementById('report-date').value;

            // 重複チェック
            const docId = `${sid}_${date}`;
            try {
                const existingSnap = await getDoc(doc(db, "t_performance", docId));
                if (existingSnap.exists()) {
                    showAlert('通知', "この日付は既に報告されています");
                    return;
                }
            } catch (err) {
                console.error("Duplicate check error:", err);
            }

            const sSel = document.getElementById('report-store');
            const sName = sSel.options[sSel.selectedIndex].text;
            
            const amount = parseInt(document.getElementById('raw-amount').value) || 0;
            const customers = parseInt(document.getElementById('raw-customers').value) || 0;
            const diff = parseInt(document.getElementById('raw-diff').value) || 0;
            const exTax = Math.round((amount + diff) / 1.1);

            const data = {
                date: date,
                store_id: sid,
                store_name: sName,
                amount: amount,
                customer_count: customers,
                cash_diff: diff,
                tip: parseInt(document.getElementById('raw-tip').value) || 0,
                weather_1: document.getElementById('report-weather1').value,
                weather_2: document.getElementById('report-weather2').value,
                petty_cash: parseInt(document.getElementById('raw-petty-cash').value) || 0,
                petty_cash_note: document.getElementById('report-petty-note').value,
                note: document.getElementById('report-note').value,
                other_notes: document.getElementById('report-other-notes').value,
                year_month: date.substring(0, 7),
                amount_ex_tax: exTax,
                turnover_rate: currentSeats > 0 ? Number((customers / currentSeats).toFixed(2)) : 0,
                customer_unit_price: customers > 0 ? Math.round(exTax / customers) : 0
            };

            const d = new Date(date);
            const days = ['日','月','火','水','木','金','土'];
            data.day_of_week = days[d.getDay()];

            try {
                await setDoc(doc(db, "t_performance", docId), data);
                
                // LINE共有
                shareToLine(data);

                showAlert('送信完了', "報告を保存し、LINEを起動します");
                form.reset();
                document.getElementById('calc-turnover').textContent = '-';
                document.getElementById('calc-ex-tax').textContent = '-';
                document.getElementById('calc-avg-spend').textContent = '-';
                fetchHistory();
            } catch (err) { showAlert('エラー', err.message); }
        };
    }

    function shareToLine(data) {
        const text = `【営業実績報告】
日付：${data.date} (${data.day_of_week})
店舗：${data.store_name}
天気：${data.weather_1}${data.weather_2 !== '-' ? ' / ' + data.weather_2 : ''}

■実績
売上(税込)：¥${data.amount.toLocaleString()}
客数：${data.customer_count.toLocaleString()} 名
客単価：¥${data.customer_unit_price.toLocaleString()}
回転数：${data.turnover_rate} 回転
売上(税抜)：¥${data.amount_ex_tax.toLocaleString()}

■詳細
現金過不足：¥${data.cash_diff.toLocaleString()}
チップ：¥${data.tip.toLocaleString()}
小口使用：¥${data.petty_cash.toLocaleString()}
${data.petty_cash > 0 ? '用途：' + data.petty_cash_note : ''}

■備考
${data.note || '特になし'}

■その他連絡
${data.other_notes || 'なし'}`;

        const url = `line://msg/text/?${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    // インポート関連
    const fileInput = document.getElementById('import-file-input');
    const logArea = document.getElementById('import-log');

    if (fileInput) {
        fileInput.onchange = async (e) => {
            if (e.target.files.length === 0) return;
            if (logArea) {
                logArea.style.display = 'block';
                logArea.innerHTML = '';
            }
            
            const logFn = (msg, color = '#1e293b') => {
                const div = document.createElement('div');
                div.style.color = color;
                div.style.padding = '2px 0';
                div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
                if (logArea) {
                    logArea.appendChild(div);
                    logArea.scrollTop = logArea.scrollHeight;
                }
            };

            for (const file of e.target.files) {
                try {
                    logFn(`${file.name} を処理中...`);
                    await processFile(file, logFn);
                } catch (err) {
                    logFn(`エラー: ${err.message}`, 'red');
                }
            }
            logFn("すべての処理が完了しました", 'green');
        };
    }
}

async function loadStoreOptions() {
    const sSel = document.getElementById('report-store');
    if (!sSel) return;
    try {
        const snap = await getDocs(collection(db, "m_stores"));
        sSel.innerHTML = '<option value="">選択してください</option>';
        snap.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id; opt.textContent = d.data().店舗名 || d.data().store_name;
            sSel.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

async function fetchHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    try {
        const snap = await getDocs(query(collection(db, "t_performance"), orderBy("date", "desc"), limit(15)));
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = '<div style="text-align:center; padding: 2rem; color:var(--text-secondary);">履歴はありません</div>';
            return;
        }
        snap.forEach(d => {
            const r = d.data();
            const div = document.createElement('div');
            div.className = 'glass-panel';
            div.style.padding = '1rem';
            div.style.background = 'rgba(255,255,255,0.5)';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                    <div>
                        <div style="font-size:0.8rem; color:var(--text-secondary);">${r.date} (${r.day_of_week || ''})</div>
                        <div style="font-weight:700;">${r.store_name}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">${r.weather_1 || ''}${r.weather_1 && r.weather_2 && r.weather_2 !== '-' ? ' / ' + r.weather_2 : ''}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:800; color:var(--primary);">¥${(r.amount || 0).toLocaleString()}</div>
                        <div style="font-size:0.75rem;">${r.customer_count} 名 / 単価: ¥${(r.customer_unit_price || 0).toLocaleString()}</div>
                        <div style="font-size:0.75rem; color:${(r.cash_diff || 0) < 0 ? 'var(--primary)' : 'green'};">過不足: ¥${(r.cash_diff || 0).toLocaleString()}</div>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (e) { console.error(e); }
}
