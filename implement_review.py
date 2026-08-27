import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add window.openQuizReviewModal
new_modal_code = """
// ==========================================
// テスト誤答復習モーダル
// ==========================================
window.openQuizReviewModal = (quizDataStr) => {
    let qData;
    try {
        qData = JSON.parse(quizDataStr);
    } catch(e) { return; }
    
    let modal = document.getElementById('quiz-review-modal-dynamic');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quiz-review-modal-dynamic';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(15, 23, 42, 0.5)';
        modal.style.zIndex = '9999999';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.padding = '1rem';
        modal.style.boxSizing = 'border-box';
        document.body.appendChild(modal);
    }
    
    const wrongQuestions = qData.questions.filter(q => q.user_answer !== q.correct_index);
    
    let questionsHtml = '';
    wrongQuestions.forEach((q, i) => {
        const escapeHTML = str => String(str).replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));
        let choicesHtml = '';
        q.choices.forEach((c, cIdx) => {
            let badge = '';
            let border = '1px solid #e2e8f0';
            let bg = 'white';
            if (cIdx === q.correct_index) {
                badge = `<span style="margin-left:auto; background:#10b981; color:white; padding:0.2rem 0.5rem; font-size:0.75rem; border-radius:12px; font-weight:800; white-space:nowrap;"><i class="fas fa-check"></i> 正解</span>`;
                border = '2px solid #10b981';
                bg = '#ecfdf5';
            } else if (cIdx === q.user_answer) {
                badge = `<span style="margin-left:auto; background:#ef4444; color:white; padding:0.2rem 0.5rem; font-size:0.75rem; border-radius:12px; font-weight:800; white-space:nowrap;"><i class="fas fa-times"></i> あなたの回答</span>`;
                border = '2px solid #ef4444';
                bg = '#fef2f2';
            }
            
            choicesHtml += `
                <div style="padding:0.6rem; margin-bottom:0.4rem; border-radius:6px; border:${border}; background:${bg}; display:flex; align-items:center;">
                    <span style="font-weight:700; color:#334155;">${escapeHTML(c)}</span>
                    ${badge}
                </div>
            `;
        });
        
        questionsHtml += `
            <div style="background:white; border:1px solid #cbd5e1; border-radius:8px; padding:1.2rem; margin-bottom:1.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="font-weight:800; font-size:1.05rem; color:#1e293b; margin-bottom:1rem; display:flex; gap:0.5rem; align-items:flex-start;">
                    <span style="background:#ef4444; color:white; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-size:0.8rem; flex-shrink:0;">
                        <i class="fas fa-exclamation"></i>
                    </span>
                    <div>${escapeHTML(q.question)}</div>
                </div>
                <div style="margin-bottom:1rem;">
                    ${choicesHtml}
                </div>
                ${q.explanation ? `
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:1rem;">
                        <div style="font-weight:800; color:#475569; font-size:0.85rem; margin-bottom:0.5rem;"><i class="fas fa-lightbulb" style="color:#f59e0b;"></i> 解説</div>
                        <div style="font-size:0.9rem; color:#334155; line-height:1.5;">${escapeHTML(q.explanation)}</div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div class="glass-panel" style="background: #f1f5f9; width: 100%; max-width: 700px; max-height: 90vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);">
            <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid #cbd5e1; background: white; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #1e293b;"><i class="fas fa-search" style="color:#ef4444;"></i> 誤答の復習 (${wrongQuestions.length}問)</h3>
                <button type="button" onclick="document.getElementById('quiz-review-modal-dynamic').style.display='none';" style="background:transparent; border:none; font-size:1.4rem; cursor:pointer; color:#94a3b8;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem; overflow-y: auto; flex-grow: 1;">
                ${questionsHtml}
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
};
"""

content = content + "\n" + new_modal_code

# 2. Update renderEvalDetailInline (Location A)
old_inline = """            if (item.quiz_data.completed) {
                const badgeColor = item.quiz_data.passed ? '#10b981' : '#ef4444';
                const passText = item.quiz_data.passed ? '合格' : '不合格';
                selfRadioHtml = `
                    <div style="text-align: center; width: 100%;">
                        <div style="font-weight: 800; font-size: 1.1rem; color: #3b82f6;">${item.self_score || '-'}</div>
                        <div style="font-size: 0.7rem; color: ${badgeColor}; font-weight: 700; margin-top: 0.2rem;">
                            ${passText} (${item.quiz_data.score}点)
                        </div>
                    </div>
                `;
            } else if (isSelfMode) {"""

new_inline = """            if (item.quiz_data.completed) {
                const badgeColor = item.quiz_data.passed ? '#10b981' : '#ef4444';
                const passText = item.quiz_data.passed ? '合格' : '不合格';
                
                const wrongCount = item.quiz_data.questions ? item.quiz_data.questions.filter(q => q.user_answer !== q.correct_index).length : 0;
                let reviewBtn = '';
                if (wrongCount === 0) {
                    reviewBtn = `<div style="font-size: 0.65rem; color: #10b981; margin-top: 0.4rem; font-weight: 700;">全問正解！<br>(復習項目なし)</div>`;
                } else {
                    const quizDataStr = encodeURIComponent(JSON.stringify(item.quiz_data));
                    reviewBtn = `<div style="margin-top: 0.4rem;"><button type="button" onclick="window.openQuizReviewModal(decodeURIComponent('${quizDataStr}'))" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; font-weight: 700; background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; border-radius: 4px; cursor: pointer; transition: 0.2s;"><i class="fas fa-search"></i> 誤答を復習</button></div>`;
                }

                selfRadioHtml = `
                    <div style="text-align: center; width: 100%;">
                        <div style="font-weight: 800; font-size: 1.1rem; color: #3b82f6;">${item.self_score || '-'}</div>
                        <div style="font-size: 0.7rem; color: ${badgeColor}; font-weight: 700; margin-top: 0.2rem;">
                            ${passText} (${item.quiz_data.score}点)
                        </div>
                        ${reviewBtn}
                    </div>
                `;
            } else if (isSelfMode) {"""

if old_inline not in content:
    print("Error: Target inline not found")
    sys.exit(1)
content = content.replace(old_inline, new_inline)

# 3. Update viewHistoryDetail (Location B)
old_history = """    snapshotItems.forEach(item => {
        const scoreData = evalData[item.item_id] || {};
        const managerScore = scoreData.manager_score || scoreData.score || '-';
        
        itemsHtml += `
            <tr style="background:white; border-bottom:1px solid #e2e8f0;">
                <td style="padding: 0.8rem; font-size:0.85rem;">
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:0.2rem; font-weight:700;">${item.category}</div>
                    <div style="font-weight:800; color:#1e293b;">${item.title}</div>
                    ${scoreData.legacy_memo ? `<div style="font-size:0.75rem; color:#d97706; margin-top:0.4rem; background:#fffbeb; padding:0.5rem; border-radius:6px; border:1px solid #fde68a;"><i class="fas fa-info-circle"></i> <b>当時のメモ:</b> ${scoreData.legacy_memo}</div>` : ''}
                </td>
                <td style="padding: 0.8rem; text-align:center; font-weight:900; color:#7c3aed; font-size:1.2rem;">
                    ${managerScore}
                </td>
                <td style="padding: 0.8rem; font-size:0.85rem; color:#475569;">
                    ${scoreData.manager_comment || scoreData.comment || '-'}
                </td>
            </tr>
        `;
    });"""

new_history = """    snapshotItems.forEach(item => {
        const scoreData = evalData[item.item_id] || {};
        const managerScore = item.manager_score ?? scoreData.manager_score ?? scoreData.score ?? '-';
        
        let reviewBtn = '';
        if (item.quiz_data && item.quiz_data.completed) {
            const wrongCount = item.quiz_data.questions ? item.quiz_data.questions.filter(q => q.user_answer !== q.correct_index).length : 0;
            if (wrongCount === 0) {
                reviewBtn = `<div style="font-size: 0.65rem; color: #10b981; margin-top: 0.4rem; font-weight: 700;">全問正解！</div>`;
            } else {
                const quizDataStr = encodeURIComponent(JSON.stringify(item.quiz_data));
                reviewBtn = `<div style="margin-top: 0.4rem;"><button type="button" onclick="window.openQuizReviewModal(decodeURIComponent('${quizDataStr}'))" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; font-weight: 700; background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; border-radius: 4px; cursor: pointer; transition: 0.2s;"><i class="fas fa-search"></i> 誤答を復習</button></div>`;
            }
        }

        itemsHtml += `
            <tr style="background:white; border-bottom:1px solid #e2e8f0;">
                <td style="padding: 0.8rem; font-size:0.85rem;">
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:0.2rem; font-weight:700;">${item.category}</div>
                    <div style="font-weight:800; color:#1e293b;">${item.title}</div>
                    ${scoreData.legacy_memo ? `<div style="font-size:0.75rem; color:#d97706; margin-top:0.4rem; background:#fffbeb; padding:0.5rem; border-radius:6px; border:1px solid #fde68a;"><i class="fas fa-info-circle"></i> <b>当時のメモ:</b> ${scoreData.legacy_memo}</div>` : ''}
                </td>
                <td style="padding: 0.8rem; text-align:center; font-weight:900; color:#7c3aed; font-size:1.2rem;">
                    ${managerScore}
                    ${reviewBtn}
                </td>
                <td style="padding: 0.8rem; font-size:0.85rem; color:#475569;">
                    ${scoreData.manager_comment || item.manager_comment || scoreData.comment || '-'}
                </td>
            </tr>
        `;
    });"""

if old_history not in content:
    print("Error: Target history not found")
    sys.exit(1)
content = content.replace(old_history, new_history)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
