import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """        // 1次評価ラジオボタン
        let primaryRadioHtml = '';
        if (hasPrimary) {
            if (canEditPrimary) {
                for (let s = 5; s >= 1; s--) {
                    const isSel = item.primary_score === s;
                    primaryRadioHtml += `
                        <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                                onclick="window.selectScore(${idx}, 'primary', ${s})">
                            ${s}
                        </button>
                    `;
                }
            } else if (allSubmitted || isAdmin) {
                primaryRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #10b981; text-align: center; width: 100%;">${item.primary_score || '-'}</div>`;
            } else {
                primaryRadioHtml = hiddenIconHtml;
            }
        }

        // 上長評価（2次評価/最終評価）ラジオボタン
        let managerRadioHtml = '';
        if (item.quiz_data) {
            if (!item.quiz_data.completed) {
                managerRadioHtml = `<div style="font-size: 0.8rem; color: #94a3b8; text-align: center; width: 100%;">未受験</div>`;
            } else if (!item.quiz_data.passed) {
                managerRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #7c3aed; text-align: center; width: 100%;" title="不合格のため加点不可">${item.manager_score || '-'}</div>`;
            } else {
                if (canEditSecondary || isInterviewMode) {
                    let btns = '';
                    const minScore = item.quiz_data.eval_score || 3;
                    for (let s = 5; s >= 1; s--) {
                        const isSel = item.manager_score === s;
                        const isDisabled = s < minScore;
                        const btnStyle = isDisabled ? 'opacity:0.3; cursor:not-allowed;' : '';
                        const btnDisabled = isDisabled ? 'disabled' : '';
                        const onclick = isDisabled ? '' : `onclick="window.selectScore(${idx}, 'manager', ${s})"`;
                        const popoverOnclick = isDisabled ? '' : `onclick="window.selectScore(${idx}, 'manager', ${s})"`;
                        
                        btns += `
                            <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                                    style="${isInterviewMode ? 'padding: 0.3rem 0.5rem;' : ''} ${btnStyle}"
                                    ${btnDisabled} ${isInterviewMode ? popoverOnclick : onclick}>
                                ${s}
                            </button>
                        `;
                    }
                    if (canEditSecondary) {
                        managerRadioHtml = btns;
                    } else {
                        managerRadioHtml = `
                            <div class="eval-popover-container" style="position: relative; display: inline-block; width: 100%; text-align: center;">
                                <div onclick="window.toggleScorePopover(${idx}, event)" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; padding: 0.2rem 0.5rem; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'" title="クリックして点数を変更">
                                    <span id="popover-score-text-${idx}" style="font-weight: 800; font-size: 1.1rem; color: #7c3aed;">${item.manager_score || '-'}</span>
                                    <i class="fas fa-pencil-alt" style="font-size: 0.7rem; color: #a78bfa;"></i>
                                </div>
                                <div id="popover-score-${idx}" class="eval-popover-menu" style="display: none; position: absolute; top: calc(100% + 5px); left: 50%; transform: translateX(-50%); background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.4rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); z-index: 50; white-space: nowrap;">
                                    <div style="position: absolute; top: -5px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 10px; height: 10px; background: white; border-top: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0;"></div>
                                    <div style="display: flex; gap: 0.25rem; position: relative;">
                                        ${btns}
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                } else if (allSubmitted || isAdmin) {
                    managerRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #7c3aed; text-align: center; width: 100%;">${item.manager_score || '-'}</div>`;
                } else {
                    managerRadioHtml = hiddenIconHtml;
                }
            }
        } else {"""

new_block = """        // 1次評価ラジオボタン
        let primaryRadioHtml = '';
        if (hasPrimary) {
            if (item.quiz_data) {
                if (!item.quiz_data.completed) {
                    primaryRadioHtml = `<div style="font-size: 0.8rem; color: #94a3b8; text-align: center; width: 100%;">未受験</div>`;
                } else {
                    if (canEditPrimary) {
                        let btns = '';
                        const minScore = item.quiz_data.eval_score || 3;
                        for (let s = 5; s >= 1; s--) {
                            let isDisabled = false;
                            let isSel = item.primary_score === s;
                            if (!item.quiz_data.passed) {
                                isDisabled = True; // 不合格時は全ロック
                                isSel = (s === (item.quiz_data.eval_score || 1));
                            } else {
                                isDisabled = s < minScore; // 合格時は下限未満をロック
                            }
                            
                            const btnStyle = isDisabled ? 'opacity:0.3; cursor:not-allowed;' : '';
                            const btnDisabled = isDisabled ? 'disabled' : '';
                            const onclick = isDisabled ? '' : `onclick="window.selectScore(${idx}, 'primary', ${s})"`;
                            btns += `<button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" style="${btnStyle}" ${btnDisabled} ${onclick}>${s}</button>`;
                        }
                        primaryRadioHtml = btns;
                    } else if (allSubmitted || isAdmin) {
                        primaryRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #10b981; text-align: center; width: 100%;">${item.primary_score || (item.quiz_data.passed ? '-' : (item.quiz_data.eval_score || 1))}</div>`;
                    } else {
                        primaryRadioHtml = hiddenIconHtml;
                    }
                }
            } else {
                if (canEditPrimary) {
                    for (let s = 5; s >= 1; s--) {
                        const isSel = item.primary_score === s;
                        primaryRadioHtml += `
                            <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                                    onclick="window.selectScore(${idx}, 'primary', ${s})">
                                ${s}
                            </button>
                        `;
                    }
                } else if (allSubmitted || isAdmin) {
                    primaryRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #10b981; text-align: center; width: 100%;">${item.primary_score || '-'}</div>`;
                } else {
                    primaryRadioHtml = hiddenIconHtml;
                }
            }
        }

        // 上長評価（2次評価/最終評価）ラジオボタン
        let managerRadioHtml = '';
        if (item.quiz_data) {
            if (!item.quiz_data.completed) {
                managerRadioHtml = `<div style="font-size: 0.8rem; color: #94a3b8; text-align: center; width: 100%;">未受験</div>`;
            } else {
                if (canEditSecondary || isInterviewMode) {
                    let btns = '';
                    const minScore = item.quiz_data.eval_score || 3;
                    for (let s = 5; s >= 1; s--) {
                        let isDisabled = false;
                        let isSel = item.manager_score === s;
                        if (!item.quiz_data.passed) {
                            isDisabled = true; // 不合格時は全ロック
                            isSel = (s === (item.quiz_data.eval_score || 1));
                        } else {
                            isDisabled = s < minScore; // 合格時は下限未満をロック
                        }
                        
                        const btnStyle = isDisabled ? 'opacity:0.3; cursor:not-allowed;' : '';
                        const btnDisabled = isDisabled ? 'disabled' : '';
                        const onclick = isDisabled ? '' : `onclick="window.selectScore(${idx}, 'manager', ${s})"`;
                        const popoverOnclick = isDisabled ? '' : `onclick="window.selectScore(${idx}, 'manager', ${s})"`;
                        
                        btns += `
                            <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                                    style="${isInterviewMode ? 'padding: 0.3rem 0.5rem;' : ''} ${btnStyle}"
                                    ${btnDisabled} ${isInterviewMode ? popoverOnclick : onclick}>
                                ${s}
                            </button>
                        `;
                    }
                    if (canEditSecondary) {
                        managerRadioHtml = btns;
                    } else {
                        managerRadioHtml = `
                            <div class="eval-popover-container" style="position: relative; display: inline-block; width: 100%; text-align: center;">
                                <div onclick="window.toggleScorePopover(${idx}, event)" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; padding: 0.2rem 0.5rem; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'" title="クリックして点数を変更">
                                    <span id="popover-score-text-${idx}" style="font-weight: 800; font-size: 1.1rem; color: #7c3aed;">${item.manager_score || (item.quiz_data.passed ? '-' : (item.quiz_data.eval_score || 1))}</span>
                                    <i class="fas fa-pencil-alt" style="font-size: 0.7rem; color: #a78bfa;"></i>
                                </div>
                                <div id="popover-score-${idx}" class="eval-popover-menu" style="display: none; position: absolute; top: calc(100% + 5px); left: 50%; transform: translateX(-50%); background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.4rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); z-index: 50; white-space: nowrap;">
                                    <div style="position: absolute; top: -5px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 10px; height: 10px; background: white; border-top: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0;"></div>
                                    <div style="display: flex; gap: 0.25rem; position: relative;">
                                        ${btns}
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                } else if (allSubmitted || isAdmin) {
                    managerRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #7c3aed; text-align: center; width: 100%;">${item.manager_score || (item.quiz_data.passed ? '-' : (item.quiz_data.eval_score || 1))}</div>`;
                } else {
                    managerRadioHtml = hiddenIconHtml;
                }
            }
        } else {"""

# Bugfix: Python capitalization `True` -> `true` for JS output
new_block = new_block.replace("isDisabled = True;", "isDisabled = true;")

content = content.replace(old_block, new_block)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Render HTML replaced")
