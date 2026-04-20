import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, query, orderBy, limit, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm } from './ui_utils.js';
import { processFile } from './import-logic.js';

export const salesPageHtml = `
    <div id="sales-page-container" class="animate-fade-in">
        <!-- JSで動的にデスクトップ用またはモバイル用HTMLが挿入されます -->
    </div>
`;

// デスクトップ用レイアウト
const salesPageHtmlDesktop = `
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
`;

// モバイル用レイアウト（入力に特化）
const salesPageHtmlMobile = `
    <div id="sales-form-view" class="mobile-sales-view" style="padding-bottom: 2rem;">
        <div class="glass-panel" style="padding: 1.2rem; border-radius: 20px;">
            <h3 style="margin-top: 0; margin-bottom: 1.2rem; font-size: 1.1rem; color: var(--text-primary); text-align:center;">実績報告入力</h3>
            <form id="sales-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                <input type="hidden" id="sales-doc-id">
                
                <!-- 日付・店舗 -->
                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 0.8rem;">
                    <div>
                        <label class="field-label">日付</label>
                        <input type="date" id="report-date" required class="form-input" style="padding: 0.7rem; font-size: 0.9rem;">
                    </div>
                    <div>
                        <label class="field-label">店舗</label>
                        <select id="report-store" required class="form-input" style="padding: 0.7rem; font-size: 0.9rem;">
                            <option value="">選択...</option>
                        </select>
                    </div>
                </div>

                <!-- 実績セクション -->
                <div style="background: rgba(230,57,70,0.03); border-radius: 16px; padding: 1rem; border: 1px solid rgba(230,57,70,0.1);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-bottom: 0.8rem;">
                        <div>
                            <label class="field-label" style="color: var(--primary);">売上金額 (税込)</label>
                            <div style="position: relative;">
                                <input type="text" id="report-amount" required placeholder="0" class="form-input num-input" style="font-size: 1.4rem; font-weight: 950; color: var(--primary); padding: 0.8rem 1.8rem 0.8rem 0.6rem;" inputmode="decimal">
                                <span style="position: absolute; right: 0.6rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: #94a3b8; font-size: 0.75rem;">円</span>
                            </div>
                            <input type="hidden" id="raw-amount">
                        </div>
                        <div>
                            <label class="field-label">来客数</label>
                            <div style="position: relative;">
                                <input type="text" id="report-customers" required placeholder="0" class="form-input num-input" style="font-size: 1.4rem; font-weight: 950; color: #1e293b; padding: 0.8rem 1.8rem 0.8rem 0.6rem;" inputmode="decimal">
                                <span style="position: absolute; right: 0.6rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: #94a3b8; font-size: 0.75rem;">名</span>
                            </div>
                            <input type="hidden" id="raw-customers">
                        </div>
                    </div>
                    
                    <!-- 自動計算ミニHUD -->
                    <div style="display: flex; justify-content: space-between; border-top: 1px dashed #e2e8f0; padding-top: 0.6rem;">
                        <div style="text-align:center; flex:1;">
                            <div style="font-size: 0.6rem; color: #64748b; font-weight: 700;">客単価</div>
                            <div id="calc-avg-spend" style="font-weight: 900; color: #1e293b; font-size: 0.9rem;">-</div>
                        </div>
                        <div style="text-align:center; flex:1; border-left: 1px solid #f1f5f9;">
                            <div style="font-size: 0.6rem; color: #64748b; font-weight: 700;">回転数</div>
                            <div id="calc-turnover" style="font-weight: 900; color: #1e293b; font-size: 0.9rem;">-</div>
                        </div>
                        <div style="border-left: 1px solid #f1f5f9; padding-left: 5px; min-width: 80px;">
                            <div style="font-size: 0.55rem; color: #64748b; font-weight: 700;">売上(税抜)</div>
                            <div id="calc-ex-tax" style="font-weight: 900; color: #1e293b; font-size: 0.85rem;">-</div>
                        </div>
                    </div>
                </div>

                <!-- 現金過不足 -->
                <div>
                    <label class="field-label">現金過不足</label>
                    <div style="display: flex; align-items: stretch; gap: 0.5rem; height: 50px;">
                        <div id="mobile-diff-sign-toggle" style="display: flex; background: #f1f5f9; border-radius: 12px; padding: 3px; min-width: 100px;">
                            <button type="button" class="sign-btn active" data-sign="1" style="flex:1; border:none; border-radius:9px; font-weight:900; font-size: 1.1rem; background:white; color: #10b981; transition: 0.2s;">+</button>
                            <button type="button" class="sign-btn" data-sign="-1" style="flex:1; border:none; border-radius:9px; font-weight:900; font-size: 1.1rem; background:transparent; color: #64748b; transition: 0.2s;">-</button>
                        </div>
                        <select id="report-diff-sign" style="display:none;">
                            <option value="1" selected>+</option>
                            <option value="-1">-</option>
                        </select>
                        <input type="text" id="report-diff" required value="0" class="form-input num-input" style="text-align: right; flex: 1; font-size: 1.3rem; font-weight: 950; background: white;" placeholder="金額" inputmode="decimal">
                        <input type="hidden" id="raw-diff" value="0">
                    </div>
                </div>

                <!-- チップ・天気 -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                    <div>
                        <label class="field-label">受け取りチップ</label>
                        <input type="text" id="report-tip" placeholder="0" class="form-input num-input" style="padding: 0.8rem; font-weight: 800; font-size: 1.1rem;" inputmode="decimal">
                        <input type="hidden" id="raw-tip">
                    </div>
                    <div style="display: flex; gap: 0.4rem;">
                        <div style="flex:1;">
                            <label class="field-label">天気1</label>
                            <select id="report-weather1" class="form-input" style="padding: 0.8rem; font-size: 0.8rem;">
                                <option value="晴れ">☀️ 晴</option>
                                <option value="曇り">☁️ 曇</option>
                                <option value="雨">☔ 雨</option>
                                <option value="雪">❄️ 雪</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label class="field-label">天気2</label>
                            <select id="report-weather2" class="form-input" style="padding: 0.8rem; font-size: 0.8rem;">
                                <option value="-">-</option>
                                <option value="晴れ">☀️ 晴</option>
                                <option value="曇り">☁️ 曇</option>
                                <option value="雨">☔ 雨</option>
                                <option value="雪">❄️ 雪</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 小口現金 -->
                <div style="background: #f8fafc; border-radius: 16px; padding: 0.8rem;">
                    <div style="margin-bottom: 0.6rem;">
                        <label class="field-label">小口現金使用</label>
                        <input type="text" id="report-petty-cash" placeholder="0" class="form-input num-input" style="font-weight: 800; font-size: 1.2rem; background: white;" inputmode="decimal">
                        <input type="hidden" id="raw-petty-cash" value="0">
                    </div>
                    <div id="petty-note-row" style="display: none;">
                        <label class="field-label">使用用途</label>
                        <input type="text" id="report-petty-note" placeholder="例: 消耗品購入" class="form-input" style="font-size: 0.9rem; padding: 0.8rem; background: white;">
                    </div>
                </div>

                <!-- 備考 -->
                <div>
                    <label class="field-label">備考 / 連絡事項</label>
                    <textarea id="report-note" class="form-input" style="min-height: 80px; font-size: 0.9rem; background: white;" placeholder="気づいたことがあれば記入してください"></textarea>
                </div>
                <div style="display: none;">
                    <textarea id="report-other-notes"></textarea>
                </div>

                <!-- ボタン -->
                <div style="margin-top: 1rem;">
                    <button type="submit" id="submit-share-btn" class="btn btn-primary" style="width: 100%; height: 60px; background: linear-gradient(135deg, #06C755 0%, #05B34C 100%); border: none; border-radius: 16px; font-weight: 950; font-size: 1.1rem; box-shadow: 0 8px 20px rgba(6, 199, 85, 0.2);">
                        <i class="fab fa-line" style="font-size: 1.4rem; margin-right: 0.6rem;"></i> 報告内容を確認する
                    </button>
                    <button type="button" id="reset-btn" class="btn" style="width: 100%; margin-top: 1rem; background: #f1f5f9; color: #94a3b8; font-weight: 800; border: none; border-radius: 12px; padding: 0.8rem;">リセット</button>
                </div>
            </form>
        </div>
    </div>
    
    <style>
        .active-tab { background: var(--primary) !important; color: white !important; }
        .field-label { display: block; margin-bottom: 0.4rem; font-weight: 800; font-size: 0.75rem; color: #64748b; }
        .form-input { width: 100%; padding: 0.8rem; border: 1px solid #e2e8f0; border-radius: 12px; background: white; transition: all 0.2s; box-sizing: border-box; }
        .form-input:focus { border-color: var(--primary); outline: none; }
        .num-input { text-align: right; font-family: 'Inter', sans-serif; }
    </style>
`;

let currentSeats = 0;

export async function initSalesPage() {
    const isMobile = window.innerWidth <= 768;
    const container = document.getElementById('sales-page-container');
    if (container) {
        container.innerHTML = isMobile ? salesPageHtmlMobile : salesPageHtmlDesktop;
    }

    await loadStoreOptions();
    // モバイル版では履歴読み込みをスキップ
    if (!isMobile) {
        await fetchHistory();
    }

    const formView = document.getElementById('sales-form-view');
    const importView = document.getElementById('import-view');
    const importBtn = document.getElementById('view-import-btn');
    const closeImportBtn = document.getElementById('close-import-btn');

    if (importBtn) {
        importBtn.onclick = () => {
            formView.style.display = 'none';
            if (importView) importView.style.display = 'block';
        };
    }
    if (closeImportBtn) {
        closeImportBtn.onclick = () => {
            if (importView) importView.style.display = 'none';
            formView.style.display = 'block';
        };
    }

    const numInputs = ['report-amount', 'report-customers', 'report-diff', 'report-tip', 'report-petty-cash'];
    numInputs.forEach(id => {
        const el = document.getElementById(id);
        const rawEl = document.getElementById(id.replace('report-', 'raw-'));
        if (el) {
            el.oninput = (e) => {
                let val = e.target.value.replace(/[^0-9]/g, ''); 
                if (val === '') {
                    if (rawEl) rawEl.value = 0;
                    return;
                }
                const num = parseInt(val);
                e.target.value = num.toLocaleString();
                
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

    const diffSign = document.getElementById('report-diff-sign');
    if (diffSign) {
        diffSign.onchange = () => {
            const val = parseInt(document.getElementById('report-diff').value.replace(/,/g, '')) || 0;
            const sign = parseInt(diffSign.value) || 1;
            document.getElementById('raw-diff').value = val * sign;
            updateCalculations();
        };
    }

    // モバイル用符号トグルUIの連動
    if (isMobile) {
        const toggleBtns = document.querySelectorAll('#mobile-diff-sign-toggle .sign-btn');
        const hiddenSign = document.getElementById('report-diff-sign');
        toggleBtns.forEach(btn => {
            btn.onclick = () => {
                toggleBtns.forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = '#64748b';
                    b.classList.remove('active');
                });
                const sign = btn.dataset.sign;
                btn.classList.add('active');
                btn.style.background = 'white';
                btn.style.color = sign === '1' ? '#10b981' : '#ef4444';
                
                if (hiddenSign) {
                    hiddenSign.value = sign;
                    // 同期
                    const val = parseInt(document.getElementById('report-diff').value.replace(/,/g, '')) || 0;
                    document.getElementById('raw-diff').value = val * parseInt(sign);
                    updateCalculations();
                }
            };
        });
    }

    const pettyInput = document.getElementById('report-petty-cash');
    const pettyNoteRow = document.getElementById('petty-note-row');
    if (pettyInput) {
        pettyInput.addEventListener('input', () => {
            const val = parseInt(pettyInput.value.replace(/,/g, '')) || 0;
            pettyNoteRow.style.display = val > 0 ? 'block' : 'none';
        });
    }

    const storeSel = document.getElementById('report-store');
    if (storeSel) {
        storeSel.onchange = async () => {
            const sid = storeSel.value;
            if (sid) {
                const docSnap = await getDoc(doc(db, "m_stores", sid));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    currentSeats = data.seat_count || data.席数 || 0;
                }
            } else {
                currentSeats = 0;
            }
            updateCalculations();
        };
    }

    window.adjustDiff = () => {};

    function updateCalculations() {
        const amount = parseInt(document.getElementById('raw-amount')?.value) || 0;
        const customers = parseInt(document.getElementById('raw-customers')?.value) || 0;
        const diff = parseInt(document.getElementById('raw-diff')?.value) || 0;

        const turnover = currentSeats > 0 ? (customers / currentSeats).toFixed(2) : '-';
        const exTax = Math.round((amount + diff) / 1.1);
        const avgSpend = customers > 0 ? Math.round(exTax / customers) : '-';

        const turnoverEl = document.getElementById('calc-turnover');
        const exTaxEl = document.getElementById('calc-ex-tax');
        const avgSpendEl = document.getElementById('calc-avg-spend');

        if (turnoverEl) turnoverEl.textContent = turnover;
        if (exTaxEl) exTaxEl.textContent = exTax.toLocaleString();
        if (avgSpendEl) avgSpendEl.textContent = avgSpend === '-' ? '-' : avgSpend.toLocaleString();
    }

    const form = document.getElementById('sales-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const sid = document.getElementById('report-store').value;
            const date = document.getElementById('report-date').value;

            if (!sid || !date) {
                showAlert('エラー', '日付と店舗を入力してください');
                return;
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
                petty_cash_note: document.getElementById('report-petty-note')?.value || '',
                note: document.getElementById('report-note').value,
                other_notes: document.getElementById('report-other-notes')?.value || '',
                year_month: date.substring(0, 7),
                amount_ex_tax: exTax,
                turnover_rate: currentSeats > 0 ? Number((customers / currentSeats).toFixed(2)) : 0,
                customer_unit_price: customers > 0 ? Math.round(exTax / customers) : 0
            };

            const d = new Date(date);
            const days = ['日','月','火','水','木','金','土'];
            data.day_of_week = days[d.getDay()];

            // LINE報告文面の作成
            const reportText = generateReportText(data);

            // 最終確認ダイアログ
            const confirmed = await showConfirm(
                "報告内容の確認", 
                `<div style="text-align:left; background:#f8fafc; padding:1.2rem; border-radius:12px; font-size:0.85rem; white-space:pre-wrap; max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; font-family: 'Inter', monospace; line-height:1.6; color:#334155;">${reportText}</div><div style="margin-top:1.2rem; text-align:center; font-weight:900; color:var(--primary); font-size:1rem;">この内容で報告を完了しますか？</div>`,
                null
            );
            if (!confirmed) return;

            const docId = `${sid}_${date}`;
            try {
                await setDoc(doc(db, "t_performance", docId), data);
                // LINE共有
                const url = `line://msg/text/?${encodeURIComponent(reportText)}`;
                window.open(url, '_blank');

                showAlert('報告完了', "実績を保存し、LINEを起動しました。");
                form.reset();
                updateCalculations();
                if (!isMobile) fetchHistory();
            } catch (err) { showAlert('エラー', err.message); }
        };
    }

    function generateReportText(data) {
        return `【営業実績報告】
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
${data.other_notes ? '\n■その他連絡\n' + data.other_notes : ''}`;
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.onclick = () => {
            if (confirm("入力内容をリセットしますか？")) {
                form.reset();
                updateCalculations();
            }
        };
    }
}

async function loadStoreOptions() {
    const sSel = document.getElementById('report-store');
    if (!sSel) return;
    try {
        const snap = await getDocs(collection(db, "m_stores"));
        sSel.innerHTML = '<option value="">選択...</option>';
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
            div.style.marginBottom = '0.8rem';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-size:0.8rem; color:var(--text-secondary);">${r.date} (${r.day_of_week || ''})</div>
                        <div style="font-weight:700;">${r.store_name}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:800; color:var(--primary);">¥${(r.amount || 0).toLocaleString()}</div>
                        <div style="font-size:0.75rem;">${r.customer_count} 名</div>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (e) { console.error(e); }
}
