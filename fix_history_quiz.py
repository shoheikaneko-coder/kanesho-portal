import sys

with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_anchor = """                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem; line-height: 1.5;">${(item.description || '').replace(/\\n/g, '<br>')}</div>"""

inject_code = """                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem; line-height: 1.5;">${(item.description || '').replace(/\\n/g, '<br>')}</div>
                
                ${item.quiz_data && item.quiz_data.completed ? `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.8rem; margin-bottom: 1rem; text-align: center;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: ${item.quiz_data.passed ? '#10b981' : '#ef4444'}; margin-bottom: 0.4rem;">
                            ${item.quiz_data.passed ? '合格' : '不合格'} (${item.quiz_data.score}点)
                        </div>
                        ${(() => {
                            const wrongCount = item.quiz_data.questions ? item.quiz_data.questions.filter(q => q.user_answer !== q.correct_index).length : 0;
                            if (wrongCount === 0) {
                                return '<div style="font-size: 0.75rem; color: #10b981; font-weight: 700;">全問正解！<br>(復習項目なし)</div>';
                            } else {
                                const quizDataStr = encodeURIComponent(JSON.stringify(item.quiz_data));
                                return `<button type="button" onclick="window.openMobileQuizReviewModal(decodeURIComponent('${quizDataStr}'))" style="padding: 0.4rem 1rem; font-size: 0.8rem; font-weight: 700; background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; border-radius: 8px; cursor: pointer;"><i class="fas fa-search"></i> 誤答を復習</button>`;
                            }
                        })()}
                    </div>
                ` : ''}"""

if "window.openMobileQuizReviewModal(decodeURIComponent" not in content.split("function generateHistoryHtml")[1]:
    content = content.replace(target_anchor, inject_code, 1)

with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected quiz badge and review button into history view.")
