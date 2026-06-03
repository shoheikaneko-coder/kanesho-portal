import { db } from './firebase.js';
import { collection, getDocs, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let localGrades = []; // メモリ上の等級リスト
let originalGradesHash = ''; // 保存時の差分検知用ハッシュ値

export const gradesPageHtml = `
    <div id="grades-page-container" class="animate-fade-in" style="padding: 1.5rem; max-width: 100%; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem; font-size: 1.6rem; font-weight: 900; color: var(--text-primary);">
                    <i class="fas fa-table" style="color: #f59e0b;"></i>
                    等級マスタ (給与テーブル) 設定
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem; font-weight: 600;">
                    各等級ごとの基本給、各種手当、想定労働時間、時給基準、社保・人件費・賞与割合を一括管理します
                </p>
            </div>
            <div style="display: flex; gap: 0.8rem; align-items: center;" class="no-print">
                <button class="btn" id="btn-grades-back" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); font-weight: 700; padding: 0.7rem 1.2rem; border-radius: 8px;">
                    <i class="fas fa-arrow-left"></i> 人事総務へ戻る
                </button>
                <button class="btn btn-primary" id="btn-add-grade" style="padding: 0.7rem 1.5rem; font-weight: 800; border-radius: 8px; background: #f59e0b; border-color: #f59e0b;">
                    <i class="fas fa-plus"></i> 新しい等級を追加
                </button>
                <button class="btn btn-success" id="btn-save-grades" style="padding: 0.7rem 1.8rem; font-weight: 900; border-radius: 8px; background: #10b981; border-color: #10b981; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                    <i class="fas fa-save"></i> 変更をすべて保存
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
            <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                <span id="grades-count" style="color: var(--text-secondary); font-size: 0.85rem; font-weight: 800;">
                    読込中...
                </span>
                <span style="font-size: 0.75rem; color: #b45309; font-weight: 700; background: #fef3c7; padding: 0.25rem 0.75rem; border-radius: 15px;">
                    ※ 各セルを直接入力して編集できます。変更後は「変更をすべて保存」を押してください。
                </span>
            </div>

            <!-- スプレッドシートライクな横スクロールテーブル -->
            <div style="overflow-x: auto; max-width: 100%; border-radius: 0 0 12px 12px;">
                <table class="grades-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.82rem; min-width: 1800px;">
                    <thead>
                        <tr style="background: #1e3a8a; border-bottom: 2px solid #0f172a; color: white;">
                            <th style="padding: 0.75rem; font-weight: 800; text-align: center; width: 60px;">操作</th>
                            <th style="padding: 0.75rem; font-weight: 800; text-align: center; width: 70px;">並び順</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 120px;">スキルレベル</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 120px;">役職</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 100px;">等級</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 110px; text-align: right;">基本給 (A)</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 110px; text-align: right;">役職手当 (B)</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 85px; text-align: right;">総労働 h</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 85px; text-align: right;">基本 h</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 100px; text-align: right; background: #1e40af;">時給(甲)</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 110px; text-align: right; background: #1e40af;">時給残業込</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 120px; text-align: right;">時間外労働(C)</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 100px; text-align: right;">深夜割増(D)</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 120px; text-align: right; background: #0f172a;">月給 (A-D)</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 120px; text-align: right;">月給賞与按分</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 110px; text-align: right;">社保合計</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 130px; text-align: right; background: #0f172a;">人件費(社保込)</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 90px; text-align: right;">賞与割合</th>
                            <th style="padding: 0.75rem; font-weight: 800; width: 120px; text-align: right; background: #0f172a;">賞与基準額</th>
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
        .grades-table td {
            padding: 0.35rem 0.5rem;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }
        .grades-table input[type="text"],
        .grades-table input[type="number"] {
            width: 100%;
            padding: 0.4rem 0.5rem;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            font-size: 0.8rem;
            font-family: inherit;
            box-sizing: border-box;
            background: #ffffff;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .grades-table input:focus {
            border-color: #f59e0b;
            box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
            outline: none;
            background: #fffdf0;
        }
        .grades-table .col-readonly {
            background: rgba(241, 245, 249, 0.7) !important;
            font-weight: 800;
            color: #1e293b;
            text-align: right;
            padding: 0.6rem 0.8rem;
            border-radius: 4px;
            display: block;
            border: 1px solid #e2e8f0;
            font-family: monospace;
            box-sizing: border-box;
            font-size: 0.8rem;
        }
        .grades-table tr:hover {
            background: rgba(248, 250, 252, 0.6);
        }
        .grades-btn-sort {
            padding: 0.2rem 0.4rem;
            font-size: 0.7rem;
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

    // 読み込み初期化
    await loadGradesData();
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
            <!-- 操作 (削除) -->
            <td style="text-align: center;">
                <button class="btn" onclick="window.deleteGradeRow(${index})" style="background: transparent; color: var(--danger); padding: 0.4rem; border: none; cursor: pointer;" title="この行を削除">
                    <i class="fas fa-trash-alt" style="font-size: 0.95rem;"></i>
                </button>
            </td>
            <!-- 並び順 (上下) -->
            <td style="text-align: center;">
                <div style="display: flex; gap: 0.15rem; justify-content: center;">
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
                <input type="text" class="input-grade-code" value="${grade.grade_code || ''}" onchange="window.handleGradeChange(${index}, 'grade_code', this.value)" style="font-weight: 800; font-family: monospace;">
            </td>
            <!-- 基本給 (A) -->
            <td>
                <input type="number" class="input-basic-salary" value="${grade.basic_salary || 0}" min="0" onchange="window.handleGradeChange(${index}, 'basic_salary', this.value)" style="text-align: right; font-family: monospace;">
            </td>
            <!-- 役職手当 (B) -->
            <td>
                <input type="number" class="input-role-allowance" value="${grade.role_allowance || 0}" min="0" onchange="window.handleGradeChange(${index}, 'role_allowance', this.value)" style="text-align: right; font-family: monospace;">
            </td>
            <!-- 総労働 h -->
            <td>
                <input type="number" class="input-total-hours" value="${grade.total_hours || 215}" min="0" onchange="window.handleGradeChange(${index}, 'total_hours', this.value)" style="text-align: right; font-family: monospace;">
            </td>
            <!-- 基本 h -->
            <td>
                <input type="number" class="input-basic-hours" value="${grade.basic_hours || 173}" min="1" onchange="window.handleGradeChange(${index}, 'basic_hours', this.value)" style="text-align: right; font-family: monospace;">
            </td>
            <!-- 時給(甲) -->
            <td>
                <input type="number" class="input-hourly-wage" value="${grade.hourly_wage || 0}" min="0" onchange="window.handleGradeChange(${index}, 'hourly_wage', this.value)" style="text-align: right; font-family: monospace; font-weight: 700; background: #eff6ff;">
            </td>
            <!-- 時給残業込 -->
            <td>
                <input type="number" class="input-hourly-wage-overtime" value="${grade.hourly_wage_overtime || 0}" min="0" onchange="window.handleGradeChange(${index}, 'hourly_wage_overtime', this.value)" style="text-align: right; font-family: monospace; font-weight: 700; background: #eff6ff;">
            </td>
            <!-- 時間外労働 (C) -->
            <td>
                <input type="number" class="input-overtime-allowance" value="${grade.overtime_allowance || 0}" min="0" onchange="window.handleGradeChange(${index}, 'overtime_allowance', this.value)" style="text-align: right; font-family: monospace;">
            </td>
            <!-- 深夜割増 (D) -->
            <td>
                <input type="number" class="input-late-allowance" value="${grade.late_allowance || 0}" min="0" onchange="window.handleGradeChange(${index}, 'late_allowance', this.value)" style="text-align: right; font-family: monospace;">
            </td>
            <!-- 月給 (A-D) [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-monthly-salary">${formatCurrency(grade.monthly_salary || 0)}</span>
            </td>
            <!-- 月給賞与按分 -->
            <td>
                <input type="number" class="input-monthly-salary-bonus" value="${grade.monthly_salary_bonus || 0}" min="0" onchange="window.handleGradeChange(${index}, 'monthly_salary_bonus', this.value)" style="text-align: right; font-family: monospace;">
            </td>
            <!-- 社保合計 -->
            <td>
                <input type="number" class="input-social-insurance" value="${grade.social_insurance || 0}" min="0" onchange="window.handleGradeChange(${index}, 'social_insurance', this.value)" style="text-align: right; font-family: monospace;">
            </td>
            <!-- 人件費社保込 [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-total-labor-cost" style="font-weight: 900; color: #1e3a8a;">${formatCurrency(grade.total_labor_cost || 0)}</span>
            </td>
            <!-- 賞与割合 -->
            <td>
                <input type="number" class="input-bonus-ratio" value="${grade.bonus_ratio || 0}" min="0" step="0.05" onchange="window.handleGradeChange(${index}, 'bonus_ratio', this.value)" style="text-align: right; font-family: monospace;">
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
            // 最初に入力してほしい「スキルレベル」の枠にフォーカスをあてる
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

    // 値を更新
    if (['basic_salary', 'role_allowance', 'total_hours', 'basic_hours', 'hourly_wage', 'hourly_wage_overtime', 'overtime_allowance', 'late_allowance', 'monthly_salary_bonus', 'social_insurance', 'bonus_ratio'].includes(field)) {
        grade[field] = Number(value) || 0;
    } else {
        grade[field] = value;
    }

    const rowEl = document.getElementById(`grade-row-${index}`);
    if (!rowEl) return;

    // --- ハイブリッド自動計算ルール ---
    
    // 1. 基本給(A) / 役職手当(B) / 基本h が変わった場合、時給(甲)を自動計算
    if (['basic_salary', 'role_allowance', 'basic_hours'].includes(field)) {
        const basicSalary = grade.basic_salary;
        const roleAllowance = grade.role_allowance;
        const basicHours = grade.basic_hours > 0 ? grade.basic_hours : 1;
        
        const calculatedHourly = Math.round((basicSalary + roleAllowance) / basicHours);
        
        grade.hourly_wage = calculatedHourly;
        rowEl.querySelector('.input-hourly-wage').value = calculatedHourly;
        
        // 連鎖：残業込時給も自動計算
        const calculatedHourlyOvertime = Math.round(calculatedHourly * 1.0975);
        grade.hourly_wage_overtime = calculatedHourlyOvertime;
        rowEl.querySelector('.input-hourly-wage-overtime').value = calculatedHourlyOvertime;

        // 連鎖：時間外(C)も自動計算
        const calculatedOvertime = Math.round(calculatedHourlyOvertime * 42);
        grade.overtime_allowance = calculatedOvertime;
        rowEl.querySelector('.input-overtime-allowance').value = calculatedOvertime;
    }
    // 2. 時給(甲) が直接変わった場合、残業込時給を自動計算
    else if (field === 'hourly_wage') {
        const calculatedHourlyOvertime = Math.round(grade.hourly_wage * 1.0975);
        grade.hourly_wage_overtime = calculatedHourlyOvertime;
        rowEl.querySelector('.input-hourly-wage-overtime').value = calculatedHourlyOvertime;

        // 連鎖：時間外(C)
        const calculatedOvertime = Math.round(calculatedHourlyOvertime * 42);
        grade.overtime_allowance = calculatedOvertime;
        rowEl.querySelector('.input-overtime-allowance').value = calculatedOvertime;
    }
    // 3. 時給残業込 が直接変わった場合、時間外(C)を自動計算
    else if (field === 'hourly_wage_overtime') {
        const calculatedOvertime = Math.round(grade.hourly_wage_overtime * 42);
        grade.overtime_allowance = calculatedOvertime;
        rowEl.querySelector('.input-overtime-allowance').value = calculatedOvertime;
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
    grade.bonus_base_amount = Math.round((grade.basic_salary || 0) * (grade.bonus_ratio || 0));

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
