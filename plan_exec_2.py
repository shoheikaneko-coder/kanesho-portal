import sys

with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 4. Assist widget inside renderMobileEditingEval
target_str_widget = "let html = '';"
if "アシストウィジェット" not in content:
    assist_logic = """
        let html = '';
        
        // 店長が評価する際の「部下育成進捗」アシストウィジェットの構築
        if (mode === 'manager') {
            const targetItem = mobileEditingEval.items.find(item => item.title.includes('部下の等級が前回評価よりも上がっている'));
            if (targetItem) {
                const hasRankedUpCount = mobileActiveEvaluations.filter(e => {
                    const isSub = mobileSubordinateUsers.some(u => u.id === e.user_id);
                    if (!isSub) return false;
                    const cur = parseInt(e.current_grade) || 0;
                    const nxt = parseInt(e.new_grade) || 0;
                    return nxt > cur && e.status !== 'not_started';
                }).length;
                
                html += `
                    <div style="background: #f0fdf4; border: 1px dashed #86efac; border-radius: 12px; padding: 1.2rem; margin: 1rem 0 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <h5 style="margin: 0 0 0.5rem; color: #166534; font-weight: 800; font-size: 0.9rem;"><i class="fas fa-magic"></i> 部下育成責任・自動判定アシスト</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: #15803d; line-height: 1.5;">
                            店長マスタ管理下のスタッフ等級推移を自動算出しました：<br>
                            <strong style="display:inline-block; margin-top:4px;">今期等級が上昇した部下の人数: ${hasRankedUpCount}名</strong> (在職中の部下合計: ${mobileSubordinateUsers.length}名中)<br>
                            <span style="font-size:0.75rem; display:inline-block; margin-top:4px;">※上記の成果を参考に、「部下の育成責任」の評価点を入力してください。</span>
                        </p>
                    </div>
                `;
            }
        }
"""
    content = content.replace("let html = '';", assist_logic, 1)

# 5. Quiz Score UI Rendering (Failed/Passed logic) & Add Quiz Review Button
old_ui_block = """            if (item.quiz_data) {
                if (item.quiz_data.completed) {
                    const badgeColor = item.quiz_data.passed ? '#10b981' : '#ef4444';
                    const passText = item.quiz_data.passed ? '合格' : '不合格';
                    
                    if (mode === 'manager') {
                        const minScore = item.quiz_data.eval_score || 3;
                        html += `
                            <div class="eval-mob-rating-group" data-idx="${idx}">
                                ${[1,2,3,4,5].map(score => {
                                    const isDisabled = !item.quiz_data.passed || score < minScore;
                                    const style = isDisabled ? 'opacity:0.3; pointer-events:none;' : '';
                                    return `<button class="eval-mob-rating-btn ${currentScore === score ? 'selected' : ''}" data-score="${score}" style="${style}">${score}</button>`;
                                }).join('')}
                            </div>
                            <textarea class="eval-mob-comment" id="mob-comment-${idx}" placeholder="評価理由などを入力（任意）">${currentComment}</textarea>
                        `;
                    } else if (mode === 'primary') {
                        const minScore = item.quiz_data.eval_score || 3;
                        html += `
                            <div class="eval-mob-rating-group" data-idx="${idx}">
                                ${[1,2,3,4,5].map(score => {
                                    const isDisabled = !item.quiz_data.passed || score < minScore;
                                    const style = isDisabled ? 'opacity:0.3; pointer-events:none;' : '';
                                    return `<button class="eval-mob-rating-btn ${currentScore === score ? 'selected' : ''}" data-score="${score}" style="${style}">${score}</button>`;
                                }).join('')}
                            </div>
                            <textarea class="eval-mob-comment" id="mob-comment-${idx}" placeholder="評価理由などを入力（任意）">${currentComment}</textarea>
                        `;
                    } else if (mode === 'self') {
                        html += `
                            <div style="text-align: center; width: 100%; margin: 1rem 0;">
                                <div style="font-weight: 800; font-size: 1.5rem; color: #3b82f6;">${item.self_score || '-'}</div>
                                <div style="font-size: 0.9rem; color: ${badgeColor}; font-weight: 700; margin-top: 0.2rem;">
                                    ${passText} (${item.quiz_data.score}点)
                                </div>
                            </div>
                            <textarea class="eval-mob-comment" id="mob-comment-${idx}" placeholder="評価理由などを入力（任意）">${currentComment}</textarea>
                        `;
                    } else {"""

new_ui_block = """            if (item.quiz_data) {
                if (item.quiz_data.completed) {
                    const badgeColor = item.quiz_data.passed ? '#10b981' : '#ef4444';
                    const passText = item.quiz_data.passed ? '合格' : '不合格';
                    
                    const wrongCount = item.quiz_data.questions ? item.quiz_data.questions.filter(q => q.user_answer !== q.correct_index).length : 0;
                    let reviewBtnHtml = '';
                    if (wrongCount === 0) {
                        reviewBtnHtml = `<div style="font-size: 0.75rem; color: #10b981; margin-top: 0.5rem; font-weight: 700;">全問正解！<br>(復習項目なし)</div>`;
                    } else {
                        const quizDataStr = encodeURIComponent(JSON.stringify(item.quiz_data));
                        reviewBtnHtml = `<div style="margin-top: 0.6rem;"><button type="button" onclick="window.openMobileQuizReviewModal(decodeURIComponent('${quizDataStr}'))" style="padding: 0.4rem 1rem; font-size: 0.8rem; font-weight: 700; background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; border-radius: 8px; cursor: pointer; transition: 0.2s;"><i class="fas fa-search"></i> 誤答を復習</button></div>`;
                    }
                    
                    if (mode === 'manager') {
                        const minScore = item.quiz_data.eval_score || 3;
                        html += `
                            <div class="eval-mob-rating-group" data-idx="${idx}">
                                ${[1,2,3,4,5].map(score => {
                                    let isDisabled = false;
                                    let isSel = currentScore === score;
                                    if (!item.quiz_data.passed) {
                                        isDisabled = true;
                                        isSel = (score === (item.quiz_data.eval_score || 1));
                                    } else {
                                        isDisabled = score < minScore;
                                    }
                                    const style = isDisabled ? 'opacity:0.3; pointer-events:none;' : '';
                                    return `<button class="eval-mob-rating-btn ${isSel ? 'selected' : ''}" data-score="${score}" style="${style}">${score}</button>`;
                                }).join('')}
                            </div>
                            <textarea class="eval-mob-comment" id="mob-comment-${idx}" placeholder="評価理由などを入力（任意）">${currentComment}</textarea>
                        `;
                    } else if (mode === 'primary') {
                        const minScore = item.quiz_data.eval_score || 3;
                        html += `
                            <div class="eval-mob-rating-group" data-idx="${idx}">
                                ${[1,2,3,4,5].map(score => {
                                    let isDisabled = false;
                                    let isSel = currentScore === score;
                                    if (!item.quiz_data.passed) {
                                        isDisabled = true;
                                        isSel = (score === (item.quiz_data.eval_score || 1));
                                    } else {
                                        isDisabled = score < minScore;
                                    }
                                    const style = isDisabled ? 'opacity:0.3; pointer-events:none;' : '';
                                    return `<button class="eval-mob-rating-btn ${isSel ? 'selected' : ''}" data-score="${score}" style="${style}">${score}</button>`;
                                }).join('')}
                            </div>
                            <textarea class="eval-mob-comment" id="mob-comment-${idx}" placeholder="評価理由などを入力（任意）">${currentComment}</textarea>
                        `;
                    } else if (mode === 'self') {
                        html += `
                            <div style="text-align: center; width: 100%; margin: 1rem 0;">
                                <div style="font-weight: 800; font-size: 1.5rem; color: #3b82f6;">${item.self_score || '-'}</div>
                                <div style="font-size: 0.9rem; color: ${badgeColor}; font-weight: 700; margin-top: 0.2rem;">
                                    ${passText} (${item.quiz_data.score}点)
                                </div>
                                ${reviewBtnHtml}
                            </div>
                            <textarea class="eval-mob-comment" id="mob-comment-${idx}" placeholder="評価理由などを入力（任意）">${currentComment}</textarea>
                        `;
                    } else {"""
content = content.replace(old_ui_block, new_ui_block)

# 6. Submission Logic Update (Bug fix)
sub_old_1 = """            if (mode === 'primary') incomplete = mobileEditingEval.items.some(it => !it.primary_score);
            else if (mode === 'manager') incomplete = mobileEditingEval.items.some(it => !it.manager_score);
            else incomplete = mobileEditingEval.items.some(it => !it.self_score);"""

sub_new_1 = """            if (mode === 'primary') {
                incomplete = mobileEditingEval.items.some(it => {
                    if (it.quiz_data && it.quiz_data.completed && !it.quiz_data.passed) return false;
                    return !it.primary_score;
                });
            } else if (mode === 'manager') {
                incomplete = mobileEditingEval.items.some(it => {
                    if (it.quiz_data && it.quiz_data.completed && !it.quiz_data.passed) return false;
                    return !it.manager_score;
                });
            } else {
                incomplete = mobileEditingEval.items.some(it => !it.self_score);
            }"""
content = content.replace(sub_old_1, sub_new_1)

sub_old_2 = """                let updateData = {
                    items: mobileEditingEval.items,
                    updated_at: new Date().toISOString()
                };"""

sub_new_2 = """                // 不合格でロックされた項目の点数を自動補完
                mobileEditingEval.items.forEach(it => {
                    if (it.quiz_data && it.quiz_data.completed && !it.quiz_data.passed) {
                        const forcedScore = it.quiz_data.eval_score || 1;
                        if (!it.primary_score) it.primary_score = forcedScore;
                        if (!it.manager_score) it.manager_score = forcedScore;
                    }
                });

                let updateData = {
                    items: mobileEditingEval.items,
                    updated_at: new Date().toISOString()
                };"""
content = content.replace(sub_old_2, sub_new_2)

with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Steps 4, 5, 6 ok")
