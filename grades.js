import { db } from './firebase.js';
import { collection, getDocs, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let localGrades = []; // メモリ上の等級リスト
let originalGradesHash = ''; // 保存時の差分検知用ハッシュ値
let isEditMode = false; // 整理・削除モードフラグ

export const gradesPageHtml = `
    <div id="grades-page-container" class="animate-fade-in" style="padding: 1rem 1.5rem; max-width: 100%; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem; font-size: 1.5rem; font-weight: 900; color: var(--text-primary);">
                    <i class="fas fa-table" style="color: #f59e0b;"></i>
                    等級マスタ (給与テーブル) 設定
                </h2>
                <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.3rem; font-weight: 600;">
                    各等級ごとの基本給、各種手当、想定労働時間、時給基準、社保・人件費・賞与割合を一括管理します
                </p>
            </div>
            <div style="display: flex; gap: 0.6rem; align-items: center;" class="no-print">
                <button class="btn" id="btn-grades-back" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); font-weight: 700; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem;">
                    <i class="fas fa-arrow-left"></i> 人事総務へ戻る
                </button>
                <button class="btn" id="btn-toggle-edit-mode" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); font-weight: 700; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem; transition: all 0.2s;">
                    <i class="fas fa-cog"></i> 等級の整理・削除
                </button>
                <button class="btn btn-primary" id="btn-add-grade" style="padding: 0.6rem 1.3rem; font-weight: 800; border-radius: 8px; background: #f59e0b; border-color: #f59e0b; font-size: 0.85rem;">
                    <i class="fas fa-plus"></i> 新しい等級を追加
                </button>
                <button class="btn btn-success" id="btn-save-grades" style="padding: 0.6rem 1.6rem; font-weight: 900; border-radius: 8px; background: #10b981; border-color: #10b981; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2); font-size: 0.85rem;">
                    <i class="fas fa-save"></i> 変更をすべて保存
                </button>
            </div>
        </div>

        <div class="glass-panel" id="grades-table-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); transition: border 0.25s, box-shadow 0.25s;">
            <div style="padding: 0.8rem 1.2rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <span id="grades-count" style="color: var(--text-secondary); font-size: 0.82rem; font-weight: 800;">
                    読込中...
                </span>
                <span id="grades-guide-message" style="font-size: 0.75rem; color: #b45309; font-weight: 700; background: #fef3c7; padding: 0.25rem 0.75rem; border-radius: 15px; transition: all 0.2s;">
                    ※ 各セルを直接入力して編集できます。変更後は「変更をすべて保存」を押してください。
                </span>
            </div>

            <!-- スプレッドシートライクな一括編集テーブル (PC大画面にてスクロールなしに最適化) -->
            <div style="overflow-x: auto; max-width: 100%; border-radius: 0 0 12px 12px;">
                <table class="grades-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem; table-layout: fixed;">
                    <thead>
                        <tr style="background: #1e3a8a; border-bottom: 2px solid #0f172a; color: white;">
                            <th class="col-edit-action" style="width: 45px;">操作</th>
                            <th class="col-edit-action" style="width: 60px;">並び順</th>
                            <th style="width: 105px;">スキルレベル</th>
                            <th style="width: 95px;">役職</th>
                            <th style="width: 75px;">等級</th>
                            <th style="width: 82px;">基本給</th>
                            <th style="width: 78px;">役職<br>手当</th>
                            <th style="width: 52px;">総労働<br>時間</th>
                            <th style="width: 52px;">基本<br>時間</th>
                            <th style="width: 75px; background: #1e40af;">
                                時給<br>(基準)
                                <span class="tooltip-container">
                                    <i class="far fa-question-circle"></i>
                                    <span class="tooltip-text">【時給(基準)の計算式】<br>(基本給 ＋ 役職手当) ÷ 基本時間</span>
                                </span>
                            </th>
                            <th style="width: 80px; background: #1e40af;">
                                時給<br>(残業込)
                                <span class="tooltip-container">
                                    <i class="far fa-question-circle"></i>
                                    <span class="tooltip-text">【時給(残業込)の計算式】<br>時給(基準) × 1.0975</span>
                                </span>
                            </th>
                            <th style="width: 80px;">
                                時間外<br>労働
                                <span class="tooltip-container">
                                    <i class="far fa-question-circle"></i>
                                    <span class="tooltip-text">【時間外労働の計算式】<br>時給(残業込) × 42時間</span>
                                </span>
                            </th>
                            <th style="width: 80px;">深夜<br>割増</th>
                            <th style="width: 85px; background: #0f172a;">
                                想定<br>月給
                                <span class="tooltip-container">
                                    <i class="far fa-question-circle"></i>
                                    <span class="tooltip-text">【想定月給の計算式】<br>基本給 ＋ 役職手当 ＋ 時間外労働 ＋ 深夜割増</span>
                                </span>
                            </th>
                            <th style="width: 85px;">月給<br>(賞与按分)</th>
                            <th style="width: 80px;">社保<br>合計</th>
                            <th style="width: 100px; background: #0f172a;">
                                想定人件費<br>(社保込)
                                <span class="tooltip-container">
                                    <i class="far fa-question-circle"></i>
                                    <span class="tooltip-text">【想定人件費の計算式】<br>月給(賞与按分) ＋ 社保合計</span>
                                </span>
                            </th>
                            <th style="width: 52px;">賞与<br>割合</th>
                            <th style="width: 90px; background: #0f172a;">
                                賞与<br>基準額
                                <span class="tooltip-container">
                                    <i class="far fa-question-circle"></i>
                                    <span class="tooltip-text">【賞与基準額の計算式】<br>(基本給 ＋ 役職手当) × 賞与割合</span>
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody id="grades-table-body">
                        <!-- JSで動的に構築されます -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    
    <style>
        .grades-table th {
            padding: 0.4rem;
            font-weight: 800;
            text-align: center;
            vertical-align: middle;
        }
        .grades-table td {
            padding: 0.2rem 0.25rem;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }
        .grades-table input[type="text"],
        .grades-table input[type="number"] {
            width: 100%;
            padding: 0.2rem 0.25rem;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            font-size: 0.68rem;
            font-family: inherit;
            box-sizing: border-box;
            background: #ffffff;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        /* スキルレベル、役職、等級のテキスト文字サイズ統一＆パディング個別調整 */
        .grades-table input[type="text"] {
            font-size: 0.64rem;
            padding: 0.2rem 0.2rem;
        }
        
        /* スピンボタン (上下矢印) を完全に非表示化 */
        /* Chrome, Safari, Edge, Opera */
        .grades-table input::-webkit-outer-spin-button,
        .grades-table input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        /* Firefox */
        .grades-table input[type="number"] {
            -moz-appearance: textfield;
        }
        .grades-table input:focus {
            border-color: #f59e0b;
            box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
            outline: none;
            background: #fffdf0;
        }
        
        /* ツールチップ用のスタイル定義 */
        .tooltip-container {
            position: relative;
            display: inline-block;
            cursor: pointer;
            margin-left: 4px;
            color: #93c5fd;
            font-size: 0.72rem;
            vertical-align: middle;
            transition: color 0.15s;
        }
        .tooltip-container:hover {
            color: #ffffff;
        }
        .tooltip-container .tooltip-text {
            visibility: hidden;
            width: 230px;
            background-color: #0f172a;
            color: #ffffff;
            text-align: center;
            border-radius: 6px;
            padding: 8px 12px;
            position: absolute;
            z-index: 100;
            bottom: 130%;
            left: 50%;
            margin-left: -115px;
            opacity: 0;
            transition: opacity 0.25s ease, transform 0.25s ease;
            transform: translateY(5px);
            font-size: 0.68rem;
            font-weight: 500;
            line-height: 1.4;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            border: 1px solid #334155;
            white-space: normal;
        }
        .tooltip-container .tooltip-text::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: #0f172a transparent transparent transparent;
        }
        .tooltip-container:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
            transform: translateY(0);
        }
        .grades-table .col-readonly {
            background: rgba(241, 245, 249, 0.7) !important;
            font-weight: 800;
            color: #1e293b;
            text-align: right;
            padding: 0.3rem 0.4rem;
            border-radius: 4px;
            display: block;
            border: 1px solid #e2e8f0;
            font-family: monospace;
            font-variant-numeric: tabular-nums;
            box-sizing: border-box;
            font-size: 0.76rem;
        }
        .grades-table tr:hover {
            background: rgba(248, 250, 252, 0.6);
        }
        .grades-btn-sort {
            padding: 0.15rem 0.3rem;
            font-size: 0.65rem;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            color: #475569;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .grades-btn-sort:hover:not(:disabled) {
            background: #e2e8f0;
            color: #0f172a;
        }
        .grades-btn-sort:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }
        
        /* 整理モード切替制御用のCSS */
        .col-edit-action {
            display: none !important;
        }
        .edit-mode-active .col-edit-action {
            display: table-cell !important;
        }
        #grades-table-panel.edit-mode-active {
            border: 2px dashed #f59e0b !important;
            box-shadow: 0 10px 20px -3px rgba(245, 158, 11, 0.12) !important;
        }
    </style>
`;

export async function initGradesPage() {
    const container = document.getElementById('grades-page-container');
    
    // 戻るボタンの紐付け
    const btnBack = document.getElementById('btn-grades-back');
    if (btnBack) {
        btnBack.onclick = () => {
            window.navigateTo('hr_hub');
        };
    }

    // 整理・削除トグルボタンの紐付け
    const btnToggle = document.getElementById('btn-toggle-edit-mode');
    if (btnToggle) {
        btnToggle.onclick = () => {
            isEditMode = !isEditMode;
            syncEditModeUI();
        };
    }

    // 行追加ボタンの紐付け
    const btnAdd = document.getElementById('btn-add-grade');
    if (btnAdd) {
        btnAdd.onclick = () => {
            addNewGradeRow();
        };
    }

    // 保存ボタンの紐付け
    const btnSave = document.getElementById('btn-save-grades');
    if (btnSave) {
        btnSave.onclick = () => {
            saveAllGrades();
        };
    }

    // ページロード時は編集モードをデフォルトでOFFにする
    isEditMode = false;

    // 読み込み初期化
    await loadGradesData();
}

// 整理モードのUI表示同期
function syncEditModeUI() {
    const btn = document.getElementById('btn-toggle-edit-mode');
    const panel = document.getElementById('grades-table-panel');
    const msg = document.getElementById('grades-guide-message');
    if (!btn || !panel) return;

    if (isEditMode) {
        btn.innerHTML = '<i class="fas fa-check"></i> 整理モードを終了';
        btn.style.background = '#f59e0b';
        btn.style.borderColor = '#f59e0b';
        btn.style.color = '#ffffff';
        btn.style.boxShadow = '0 4px 6px -1px rgba(245, 158, 11, 0.2)';
        panel.classList.add('edit-mode-active');
        if (msg) {
            msg.textContent = '【整理モード実行中】 等級の並び替え (▲/▼) と不要な等級の削除が可能です。';
            msg.style.background = '#ffedd5';
            msg.style.color = '#c2410c';
        }
    } else {
        btn.innerHTML = '<i class="fas fa-cog"></i> 等級の整理・削除';
        btn.style.background = 'white';
        btn.style.borderColor = 'var(--border)';
        btn.style.color = 'var(--text-secondary)';
        btn.style.boxShadow = 'none';
        panel.classList.remove('edit-mode-active');
        if (msg) {
            msg.textContent = '※ 各セルを直接入力して編集できます。変更後は「変更をすべて保存」を押してください。';
            msg.style.background = '#fef3c7';
            msg.style.color = '#b45309';
        }
    }
}

// Firestoreから等級マスタデータをロード
async function loadGradesData() {
    const tbody = document.getElementById('grades-table-body');
    const countLabel = document.getElementById('grades-count');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="19" style="text-align: center; padding: 4rem; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem; color: #f59e0b; display: block; margin-left: auto; margin-right: auto;"></i>
                等級マスタを読み込んでいます...
            </td>
        </tr>
    `;

    try {
        const querySnapshot = await getDocs(collection(db, "m_grades"));
        localGrades = [];
        querySnapshot.forEach((doc) => {
            localGrades.push({ id: doc.id, ...doc.data() });
        });

        // display_order順にソート (未設定の場合は仮値)
        localGrades.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));

        // 初期ロード完了時のハッシュ保存 (未変更警告用)
        originalGradesHash = JSON.stringify(localGrades);

        renderGradesTable();
    } catch (e) {
        console.error("Failed to load grades data:", e);
        tbody.innerHTML = `
            <tr>
                <td colspan="19" style="text-align: center; padding: 3rem; color: var(--danger); font-weight: 700;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block; margin-left: auto; margin-right: auto;"></i>
                    等級データの読み込みに失敗しました。
                </td>
            </tr>
        `;
    }
}

// 等級テーブルの再描画
function renderGradesTable() {
    const tbody = document.getElementById('grades-table-body');
    const countLabel = document.getElementById('grades-count');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (countLabel) {
        countLabel.textContent = `登録済み等級: ${localGrades.length} 件`;
    }

    if (localGrades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="19" style="text-align: center; padding: 4rem; color: var(--text-secondary); font-weight: 600;">
                    登録されている等級はありません。「新しい等級を追加」ボタンから作成してください。
                </td>
            </tr>
        `;
        return;
    }

    localGrades.forEach((grade, index) => {
        const tr = document.createElement('tr');
        tr.id = `grade-row-${index}`;
        
        // 並び替えボタンの disabled 制御
        const isFirst = index === 0;
        const isLast = index === localGrades.length - 1;

        tr.innerHTML = `
            <!-- 操作 (削除) [整理モード時のみ出現] -->
            <td class="col-edit-action" style="text-align: center;">
                <button class="btn" onclick="window.deleteGradeRow(${index})" style="background: transparent; color: var(--danger); padding: 0.2rem; border: none; cursor: pointer;" title="この行を削除">
                    <i class="fas fa-trash-alt" style="font-size: 0.9rem;"></i>
                </button>
            </td>
            <!-- 並び順 (上下) [整理モード時のみ出現] -->
            <td class="col-edit-action" style="text-align: center;">
                <div style="display: flex; gap: 0.1rem; justify-content: center;">
                    <button class="grades-btn-sort" onclick="window.moveGradeRow(${index}, -1)" ${isFirst ? 'disabled' : ''} title="上へ移動">▲</button>
                    <button class="grades-btn-sort" onclick="window.moveGradeRow(${index}, 1)" ${isLast ? 'disabled' : ''} title="下へ移動">▼</button>
                </div>
            </td>
            <!-- スキルレベル -->
            <td>
                <input type="text" class="input-skill-level" value="${grade.skill_level || ''}" onchange="window.handleGradeChange(${index}, 'skill_level', this.value)">
            </td>
            <!-- 役職 -->
            <td>
                <input type="text" class="input-job-title" value="${grade.job_title || ''}" onchange="window.handleGradeChange(${index}, 'job_title', this.value)">
            </td>
            <!-- 等級コード -->
            <td>
                <input type="text" class="input-grade-code" value="${grade.grade_code || ''}" onchange="window.handleGradeChange(${index}, 'grade_code', this.value)">
            </td>
            <!-- 基本給 -->
            <td>
                <input type="text" class="input-basic-salary" value="${(grade.basic_salary || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(${index}, 'basic_salary', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">
            </td>
            <!-- 役職手当 -->
            <td>
                <input type="text" class="input-role-allowance" value="${(grade.role_allowance || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(${index}, 'role_allowance', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">
            </td>
            <!-- 総労働時間 -->
            <td>
                <input type="number" class="input-total-hours" value="${grade.total_hours || 215}" min="0" onchange="window.handleGradeChange(${index}, 'total_hours', this.value)" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">
            </td>
            <!-- 基本時間 -->
            <td>
                <input type="number" class="input-basic-hours" value="${grade.basic_hours || 173}" min="1" onchange="window.handleGradeChange(${index}, 'basic_hours', this.value)" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">
            </td>
            <!-- 時給(基準) -->
            <td>
                <input type="text" class="input-hourly-wage" value="${(grade.hourly_wage || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(${index}, 'hourly_wage', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums; background: #eff6ff;">
            </td>
            <!-- 時給(残業込) -->
            <td>
                <input type="text" class="input-hourly-wage-overtime" value="${(grade.hourly_wage_overtime || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(${index}, 'hourly_wage_overtime', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums; background: #eff6ff;">
            </td>
            <!-- 時間外労働 -->
            <td>
                <input type="text" class="input-overtime-allowance" value="${(grade.overtime_allowance || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(${index}, 'overtime_allowance', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">
            </td>
            <!-- 深夜割増 -->
            <td>
                <input type="text" class="input-late-allowance" value="${(grade.late_allowance || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(${index}, 'late_allowance', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">
            </td>
            <!-- 想定月給 [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-monthly-salary">${formatCurrency(grade.monthly_salary || 0)}</span>
            </td>
            <!-- 月給(賞与按分) -->
            <td>
                <input type="text" class="input-monthly-salary-bonus" value="${(grade.monthly_salary_bonus || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(${index}, 'monthly_salary_bonus', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">
            </td>
            <!-- 社保合計 -->
            <td>
                <input type="text" class="input-social-insurance" value="${(grade.social_insurance || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(${index}, 'social_insurance', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">
            </td>
            <!-- 想定人件費(社保込) [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-total-labor-cost" style="font-weight: 900; color: #1e3a8a;">${formatCurrency(grade.total_labor_cost || 0)}</span>
            </td>
            <!-- 賞与割合 -->
            <td>
                <input type="number" class="input-bonus-ratio" value="${grade.bonus_ratio || 0}" min="0" step="0.05" onchange="window.handleGradeChange(${index}, 'bonus_ratio', this.value)" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">
            </td>
            <!-- 賞与基準額 [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-bonus-base-amount">${formatCurrency(grade.bonus_base_amount || 0)}</span>
            </td>
        `;
        tbody.appendChild(tr);

        // 各ReadOnly列の初回計算
        recalculateReadOnlys(index, false);
    });

    // 編集モード状態のDOM同期 (再描画時にも状態を引き継ぎ)
    syncEditModeUI();
}

// 金額フォーマットユーティリティ (¥記号付き)
function formatCurrency(val) {
    return `¥${Math.round(val).toLocaleString()}`;
}

// 新しい等級行を追加する (メモリ上)
function addNewGradeRow() {
    const newGrade = {
        skill_level: '',
        job_title: '',
        grade_code: '',
        basic_salary: 0,
        role_allowance: 0,
        total_hours: 215,
        basic_hours: 173,
        hourly_wage: 0,
        hourly_wage_overtime: 0,
        overtime_allowance: 0,
        late_allowance: 0,
        monthly_salary_bonus: 0,
        social_insurance: 0,
        bonus_ratio: 0,
        display_order: localGrades.length + 1
    };

    localGrades.push(newGrade);
    renderGradesTable();
    
    // 追加した最下行にスクロール
    setTimeout(() => {
        const row = document.getElementById(`grade-row-${localGrades.length - 1}`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            row.querySelector('.input-skill-level')?.focus();
        }
    }, 50);
}

// 等級行の削除
window.deleteGradeRow = function(index) {
    const grade = localGrades[index];
    const desc = (grade.job_title || grade.grade_code) ? `「${grade.job_title || ''} (${grade.grade_code || ''})」` : 'この等級行';
    
    showConfirm('等級の削除', `${desc} を一覧から削除しますか？\n(「変更をすべて保存」を押すまでデータベースからは削除されません)`, () => {
        localGrades.splice(index, 1);
        renderGradesTable();
    });
};

// 行の並び順の変更 (index を diff 分上下にスライド)
window.moveGradeRow = function(index, diff) {
    const targetIndex = index + diff;
    if (targetIndex < 0 || targetIndex >= localGrades.length) return;

    // 配列要素の入れ替え
    const temp = localGrades[index];
    localGrades[index] = localGrades[targetIndex];
    localGrades[targetIndex] = temp;

    renderGradesTable();

    // 移動後の行を目立たせるためにスクロール
    setTimeout(() => {
        const row = document.getElementById(`grade-row-${targetIndex}`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
};

// 入力項目の値変更時のハンドラ
window.handleGradeChange = function(index, field, value) {
    const grade = localGrades[index];
    if (!grade) return;

    // 値を更新 (カンマがあれば除去してから数値型にパース)
    if (['basic_salary', 'role_allowance', 'total_hours', 'basic_hours', 'hourly_wage', 'hourly_wage_overtime', 'overtime_allowance', 'late_allowance', 'monthly_salary_bonus', 'social_insurance', 'bonus_ratio'].includes(field)) {
        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        grade[field] = Number(cleanVal) || 0;
    } else {
        grade[field] = value;
    }

    const rowEl = document.getElementById(`grade-row-${index}`);
    if (!rowEl) return;

    // --- ハイブリッド自動計算ルール ---
    
    // 1. 基本給 / 役職手当 / 基本h が変わった場合、時給基準を自動計算
    if (['basic_salary', 'role_allowance', 'basic_hours'].includes(field)) {
        const basicSalary = grade.basic_salary;
        const roleAllowance = grade.role_allowance;
        const basicHours = grade.basic_hours > 0 ? grade.basic_hours : 1;
        
        const calculatedHourly = Math.round((basicSalary + roleAllowance) / basicHours);
        
        grade.hourly_wage = calculatedHourly;
        rowEl.querySelector('.input-hourly-wage').value = calculatedHourly.toLocaleString();
        
        // 連鎖：残業込時給も自動計算
        const calculatedHourlyOvertime = Math.round(calculatedHourly * 1.0975);
        grade.hourly_wage_overtime = calculatedHourlyOvertime;
        rowEl.querySelector('.input-hourly-wage-overtime').value = calculatedHourlyOvertime.toLocaleString();

        // 連鎖：時間外労働も自動計算
        const calculatedOvertime = Math.round(calculatedHourlyOvertime * 42);
        grade.overtime_allowance = calculatedOvertime;
        rowEl.querySelector('.input-overtime-allowance').value = calculatedOvertime.toLocaleString();
    }
    // 2. 時給基準 が直接変わった場合、残業込時給を自動計算
    else if (field === 'hourly_wage') {
        const calculatedHourlyOvertime = Math.round(grade.hourly_wage * 1.0975);
        grade.hourly_wage_overtime = calculatedHourlyOvertime;
        rowEl.querySelector('.input-hourly-wage-overtime').value = calculatedHourlyOvertime.toLocaleString();

        // 連鎖：時間外労働
        const calculatedOvertime = Math.round(calculatedHourlyOvertime * 42);
        grade.overtime_allowance = calculatedOvertime;
        rowEl.querySelector('.input-overtime-allowance').value = calculatedOvertime.toLocaleString();
    }
    // 3. 時給残業込 が直接変わった場合、時間外労働を自動計算
    else if (field === 'hourly_wage_overtime') {
        const calculatedOvertime = Math.round(grade.hourly_wage_overtime * 42);
        grade.overtime_allowance = calculatedOvertime;
        rowEl.querySelector('.input-overtime-allowance').value = calculatedOvertime.toLocaleString();
    }

    // 計算列 (ReadOnly) の再計算とDOM反映
    recalculateReadOnlys(index, true);
};

// 計算列の再計算とDOM更新
function recalculateReadOnlys(index, shouldUpdateDOM = true) {
    const grade = localGrades[index];
    if (!grade) return;

    // 各論理フィールドの計算
    grade.monthly_salary = (grade.basic_salary || 0) + (grade.role_allowance || 0) + (grade.overtime_allowance || 0) + (grade.late_allowance || 0);
    grade.total_labor_cost = (grade.monthly_salary_bonus || 0) + (grade.social_insurance || 0);
    grade.bonus_base_amount = Math.round(((grade.basic_salary || 0) + (grade.role_allowance || 0)) * (grade.bonus_ratio || 0));

    if (shouldUpdateDOM) {
        const rowEl = document.getElementById(`grade-row-${index}`);
        if (rowEl) {
            rowEl.querySelector('.readonly-monthly-salary').textContent = formatCurrency(grade.monthly_salary);
            rowEl.querySelector('.readonly-total-labor-cost').textContent = formatCurrency(grade.total_labor_cost);
            rowEl.querySelector('.readonly-bonus-base-amount').textContent = formatCurrency(grade.bonus_base_amount);
        }
    }
}

// 変更のすべてを一括保存 (Firestoreへのバッチ保存 ＆ 既存の物理的削除)
async function saveAllGrades() {
    const btnSave = document.getElementById('btn-save-grades');
    if (!btnSave) return;

    // バリデーションチェック (等級コードの重複チェックなど)
    const codes = localGrades.map(g => (g.grade_code || '').trim()).filter(c => c !== '');
    const hasDuplicate = codes.some((code, idx) => codes.indexOf(code) !== idx);
    if (hasDuplicate) {
        return showAlert('保存エラー', '重複している等級コードが存在します。等級コードはそれぞれ一意である必要があります。');
    }

    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    btnSave.disabled = true;

    try {
        const batch = writeBatch(db);

        // 1. 等級マスタの古いデータをすべて削除するために、既存ドキュメントの一覧を取得
        const querySnapshot = await getDocs(collection(db, "m_grades"));
        const existingDocs = [];
        querySnapshot.forEach(d => existingDocs.push(d.id));

        // 2. 既存ドキュメントをすべてバッチ削除に登録
        existingDocs.forEach(id => {
            batch.delete(doc(db, "m_grades", id));
        });

        // 3. メモリ上の最新データを順序 display_order 付きで新規作成登録
        localGrades.forEach((grade, idx) => {
            const docRef = doc(collection(db, "m_grades"));
            const dataToSave = {
                skill_level: grade.skill_level || '',
                job_title: grade.job_title || '',
                grade_code: grade.grade_code || '',
                basic_salary: Number(grade.basic_salary) || 0,
                role_allowance: Number(grade.role_allowance) || 0,
                total_hours: Number(grade.total_hours) || 215,
                basic_hours: Number(grade.basic_hours) || 173,
                hourly_wage: Number(grade.hourly_wage) || 0,
                hourly_wage_overtime: Number(grade.hourly_wage_overtime) || 0,
                overtime_allowance: Number(grade.overtime_allowance) || 0,
                late_allowance: Number(grade.late_allowance) || 0,
                monthly_salary_bonus: Number(grade.monthly_salary_bonus) || 0,
                social_insurance: Number(grade.social_insurance) || 0,
                bonus_ratio: Number(grade.bonus_ratio) || 0,
                display_order: idx + 1 // 上から順に 1, 2, 3.. と並び順を付与
            };
            batch.set(docRef, dataToSave);
        });

        // バッチ処理の実行
        await batch.commit();

        showAlert('保存成功', '等級マスタ (給与テーブル) の変更を保存しました！');

        // 再リロードして最新ハッシュを更新
        await loadGradesData();

    } catch (error) {
        console.error("Failed to save grades:", error);
        showAlert('エラー', '等級マスタの保存に失敗しました。');
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
}
