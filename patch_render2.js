const fs = require('fs');
let code = fs.readFileSync('grades.js', 'utf8');

const regex = /tr\.innerHTML = `([\s\S]*?)`;/m;
const match = code.match(regex);
if (!match) return;

let inner = match[1];

// Function to replace inputs with conditional logic
const newLogic = `
        const renderText = (val, isNum = false) => \`<span style="display:block; padding: 0.4rem; text-align: \${isNum ? 'right' : 'left'}; font-family: \${isNum ? 'monospace' : 'inherit'}; font-weight: 600; color: #1e293b;">\${val}</span>\`;
        
        tr.innerHTML = \`
            <!-- 等級コード -->
            <td class="sticky-col">
                \${isEditMode ? \`<input type="text" class="input-grade-code" value="\${grade.grade_code || ''}" onchange="window.handleGradeChange(\${index}, 'grade_code', this.value)">\` : renderText(grade.grade_code || '')}
            </td>
            <!-- 操作 (削除) [整理モード時のみ出現] -->
            <td class="col-edit-action" style="text-align: center;">
                \${isEditMode ? \`<button class="btn" onclick="window.deleteGradeRow(\${index})" style="background: transparent; color: var(--danger); padding: 0.2rem; border: none; cursor: pointer;" title="この行を削除"><i class="fas fa-trash-alt" style="font-size: 0.9rem;"></i></button>\` : ''}
            </td>
            <!-- 並び順 (上下) [整理モード時のみ出現] -->
            <td class="col-edit-action" style="text-align: center;">
                \${isEditMode ? \`<div style="display: flex; gap: 0.1rem; justify-content: center;">
                    <button class="grades-btn-sort" onclick="window.moveGradeRow(\${index}, -1)" \${isFirst ? 'disabled' : ''} title="上へ移動">▲</button>
                    <button class="grades-btn-sort" onclick="window.moveGradeRow(\${index}, 1)" \${isLast ? 'disabled' : ''} title="下へ移動">▼</button>
                </div>\` : ''}
            </td>
            <!-- スキルレベル -->
            <td>
                \${isEditMode ? \`<input type="text" class="input-skill-level" value="\${grade.skill_level || ''}" onchange="window.handleGradeChange(\${index}, 'skill_level', this.value)">\` : renderText(grade.skill_level || '')}
            </td>
            <!-- 役職 -->
            <td>
                \${isEditMode ? \`<input type="text" class="input-job-title" value="\${grade.job_title || ''}" onchange="window.handleGradeChange(\${index}, 'job_title', this.value)">\` : renderText(grade.job_title || '')}
            </td>
            <!-- 基本給 -->
            <td>
                \${isEditMode ? \`<input type="text" class="input-basic-salary" value="\${(grade.basic_salary || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(\${index}, 'basic_salary', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">\` : renderText((grade.basic_salary || 0).toLocaleString(), true)}
            </td>
            <!-- 役職手当 -->
            <td>
                \${isEditMode ? \`<input type="text" class="input-role-allowance" value="\${(grade.role_allowance || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(\${index}, 'role_allowance', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">\` : renderText((grade.role_allowance || 0).toLocaleString(), true)}
            </td>
            <!-- 総労働時間 -->
            <td>
                \${isEditMode ? \`<input type="number" class="input-total-hours" value="\${grade.total_hours || 215}" min="0" onchange="window.handleGradeChange(\${index}, 'total_hours', this.value)" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">\` : renderText(grade.total_hours || 215, true)}
            </td>
            <!-- 基本時間 -->
            <td>
                \${isEditMode ? \`<input type="number" class="input-basic-hours" value="\${grade.basic_hours || 173}" min="1" onchange="window.handleGradeChange(\${index}, 'basic_hours', this.value)" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">\` : renderText(grade.basic_hours || 173, true)}
            </td>
            <!-- 時給(基準) -->
            <td>
                \${isEditMode ? \`<input type="text" class="input-hourly-wage" value="\${(grade.hourly_wage || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(\${index}, 'hourly_wage', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums; background: #eff6ff;">\` : renderText((grade.hourly_wage || 0).toLocaleString(), true)}
            </td>
            <!-- 時給(残業込) -->
            <td>
                \${isEditMode ? \`<input type="text" class="input-hourly-wage-overtime" value="\${(grade.hourly_wage_overtime || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(\${index}, 'hourly_wage_overtime', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums; background: #eff6ff;">\` : renderText((grade.hourly_wage_overtime || 0).toLocaleString(), true)}
            </td>
            <!-- 時間外労働 [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-overtime-allowance">\${formatCurrency(grade.overtime_allowance || 0)}</span>
            </td>
            <!-- 深夜割増 [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-late-allowance">\${formatCurrency(grade.late_allowance || 0)}</span>
            </td>
            <!-- 月給 [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-monthly-salary">\${formatCurrency(grade.monthly_salary || 0)}</span>
            </td>
            <!-- 想定月給賞与按分込 [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-monthly-salary-bonus">\${formatCurrency(grade.monthly_salary_bonus || 0)}</span>
            </td>
            <!-- 社保合計 -->
            <td>
                \${isEditMode ? \`<input type="text" class="input-social-insurance" value="\${(grade.social_insurance || 0).toLocaleString()}" onfocus="this.value = this.value.replace(/,/g, ''); this.select();" oninput="this.value = this.value.replace(/[^0-9]/g, '');" onblur="const val = Number(this.value) || 0; this.value = val.toLocaleString(); window.handleGradeChange(\${index}, 'social_insurance', val);" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">\` : renderText((grade.social_insurance || 0).toLocaleString(), true)}
            </td>
            <!-- 想定人件費(社保込) [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-total-labor-cost" style="font-weight: 900; color: #1e3a8a;">\${formatCurrency(grade.total_labor_cost || 0)}</span>
            </td>
            <!-- 賞与割合 -->
            <td>
                \${isEditMode ? \`<input type="number" class="input-bonus-ratio" value="\${grade.bonus_ratio || 0}" min="0" step="0.05" onchange="window.handleGradeChange(\${index}, 'bonus_ratio', this.value)" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">\` : renderText(grade.bonus_ratio || 0, true)}
            </td>
            <!-- 賞与基準額 [ReadOnly] -->
            <td>
                <span class="col-readonly readonly-bonus-base-amount">\${formatCurrency(grade.bonus_base_amount || 0)}</span>
            </td>
            <!-- 賞与回数 -->
            <td>
                \${isEditMode ? \`<input type="number" class="input-bonus-count" value="\${grade.bonus_count || 0}" min="0" step="1" onchange="window.handleGradeChange(\${index}, 'bonus_count', this.value)" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums;">\` : renderText(grade.bonus_count || 0, true)}
            </td>
            <!-- 査定最低点 -->
            <td>
                \${isEditMode ? \`<input type="number" class="input-evaluation-min-score" value="\${grade.evaluation_min_score || 0}" min="0" onchange="window.handleGradeChange(\${index}, 'evaluation_min_score', this.value)" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums; width: 100%; box-sizing: border-box;">\` : renderText(grade.evaluation_min_score || 0, true)}
            </td>
            <!-- 査定最高点 -->
            <td>
                \${isEditMode ? \`<input type="number" class="input-evaluation-max-score" value="\${grade.evaluation_max_score || 0}" min="0" onchange="window.handleGradeChange(\${index}, 'evaluation_max_score', this.value)" style="text-align: right; font-family: monospace; font-variant-numeric: tabular-nums; width: 100%; box-sizing: border-box;">\` : renderText(grade.evaluation_max_score || 0, true)}
            </td>
        \`;`;

const newCode = code.replace(match[0], newLogic);
fs.writeFileSync('grades.js', newCode);
console.log("Successfully patched grades.js");
