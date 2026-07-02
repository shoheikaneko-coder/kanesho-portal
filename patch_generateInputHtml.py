import re

with open('evaluation_mobile.js', 'r') as f:
    content = f.read()

# We need to replace `generateInputHtml` entirely since it changes significantly for interview mode.
# We will use regex to find the start of `function generateInputHtml(mode) {` and the end `return html; \}`
old_func_pattern = re.compile(r'function generateInputHtml\(mode\) \{.*?\n\}', re.DOTALL)

new_func = '''function generateInputHtml(mode) {
    let titleText = mobilePeriodSettings.active_period + '自己評価入力';
    let subtitleText = '';
    
    if (mode === 'primary') {
        titleText = mobilePeriodSettings.active_period + ' 1次評価入力';
        subtitleText = `<div style="font-size:0.85rem; color:#be123c; font-weight:700; margin-bottom:0.2rem;">対象者: ${mobileEditingEval.user_name || '一般'}</div>`;
    } else if (mode === 'manager') {
        titleText = mobilePeriodSettings.active_period + ' 最終評価入力';
        subtitleText = `<div style="font-size:0.85rem; color:#be123c; font-weight:700; margin-bottom:0.2rem;">対象者: ${mobileEditingEval.user_name || '一般'}</div>`;
    } else if (mode === 'interview') {
        titleText = mobilePeriodSettings.active_period + ' 面談実施';
        subtitleText = `<div style="font-size:0.85rem; color:#be123c; font-weight:700; margin-bottom:0.2rem;">対象者: ${mobileEditingEval.user_name || '一般'}</div>`;
    }
    
    let html = `
        <div class="eval-mob-input-header">
            <div style="flex:1;">
                <button class="btn" style="background:none; border:none; color:#64748b; font-size:1.2rem; padding:0;" id="btn-mob-input-close"><i class="fas fa-times"></i></button>
            </div>
            <div style="flex:4; text-align:center;">
                ${subtitleText}
                <div style="font-weight:900; color:#0f172a; font-size: 0.95rem;">${titleText}</div>
                ${mode !== 'interview' ? `
                <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;" id="mob-progress-text">0 / ${mobileEditingEval.items.length} 項目完了</div>
                <div class="eval-mob-progress-container">
                    <div class="eval-mob-progress-fill" id="mob-progress-fill"></div>
                </div>
                ` : ''}
            </div>
            <div style="flex:1;"></div>
        </div>
        <div style="padding-top: 1rem;">
    `;
    
    mobileEditingEval.items.forEach((item, idx) => {
        let currentScore = item.self_score;
        let currentComment = item.self_comment || '';
        
        if (mode === 'primary') {
            currentScore = item.primary_score;
            currentComment = item.primary_comment || '';
        } else if (mode === 'manager') {
            currentScore = item.manager_score;
            currentComment = item.manager_comment || '';
        }
        
        html += `
            <div class="eval-mob-input-card" id="mob-card-${idx}">
                <div class="eval-mob-cat-badge">${item.category}</div>
                <div class="eval-mob-item-title">${item.title || ''}</div>
                <div class="eval-mob-item-desc">${(item.description || '').replace(/\\n/g, '<br>')}</div>
        `;
        
        if (mode === 'interview') {
            const hasPrimary = !!(mobileEditingEval.workflow && mobileEditingEval.workflow.primary_evaluator);
            const hasAnyComment = !!(item.self_comment || item.primary_comment || item.manager_comment);
            
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:0.8rem; border-radius:8px; margin-top:1rem; border:1px solid #e2e8f0;">
                    <div style="text-align:center; flex:1; border-right:1px solid #e2e8f0;">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:700;">本人</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#1e293b; margin-top:0.2rem;">${item.self_score || '-'} <span style="font-size:0.7rem;">点</span></div>
                    </div>
                    ${hasPrimary ? `
                    <div style="text-align:center; flex:1; border-right:1px solid #e2e8f0;">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:700;">1次</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#1e293b; margin-top:0.2rem;">${item.primary_score || '-'} <span style="font-size:0.7rem;">点</span></div>
                    </div>
                    ` : ''}
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:0.7rem; color:#64748b; font-weight:700;">最終</div>
                        <div style="font-size:1.1rem; font-weight:800; color:#be123c; margin-top:0.2rem;">${item.manager_score || '-'} <span style="font-size:0.7rem;">点</span></div>
                    </div>
                </div>
            `;
            
            if (hasAnyComment) {
                html += `
                <div style="margin-top:0.8rem; text-align:right;">
                    <button class="btn eval-mob-comment-bubble-btn" data-idx="${idx}" style="background:#059669; border:none; color:white; padding:0.4rem 0.8rem; border-radius:20px; font-size:0.8rem; font-weight:700; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <i class="fas fa-comment-dots"></i> コメントを確認
                    </button>
                </div>
                `;
            }
        } else {
            html += `
                <div class="eval-mob-rating-group" data-idx="${idx}">
                    ${[1,2,3,4,5].map(score => `
                        <button class="eval-mob-rating-btn ${currentScore === score ? 'selected' : ''}" data-score="${score}">${score}</button>
                    `).join('')}
                </div>
                <textarea class="eval-mob-comment" id="mob-comment-${idx}" placeholder="評価理由などを入力（任意）">${currentComment}</textarea>
            `;
        }
        
        html += `
            </div>
        `;
    });
    
    if (mode === 'interview') {
        html += `
            <div class="eval-mob-input-card" style="border: 2px solid #059669; padding-bottom: 2rem;">
                <h4 style="color:#059669; font-weight:800; margin-bottom:1rem;"><i class="fas fa-edit"></i> 面談記録</h4>
                <label style="font-size:0.8rem; font-weight:700; color:#475569; display:block; margin-bottom:0.3rem;">面談実施日</label>
                <input type="date" id="mob-interview-date" value="${mobileEditingEval.interview_date || ''}" style="width:100%; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; margin-bottom:1.2rem; font-family:inherit;">
                
                <label style="font-size:0.8rem; font-weight:700; color:#475569; display:block; margin-bottom:0.3rem;">面談メモ（話し合った内容など）</label>
                <textarea id="mob-interview-notes" rows="5" placeholder="面談で話し合った内容や育成方針を記入" style="width:100%; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.95rem; font-family:inherit; resize:none;">${mobileEditingEval.interview_notes || ''}</textarea>
            </div>
        `;
    }
    
    html += `
        </div>
        <div class="eval-mob-bottom-bar">
            ${mode === 'interview' ? `
            <button class="eval-mob-btn-save" id="btn-mob-save-draft" style="flex:1;">下書き保存</button>
            <button class="eval-mob-btn-submit" id="btn-mob-submit" style="flex:2; background:#059669; border-color:#059669;">面談完了・提出</button>
            ` : `
            <button class="eval-mob-btn-save" id="btn-mob-save-draft">下書き保存</button>
            <button class="eval-mob-btn-submit" id="btn-mob-submit">入力を完了する</button>
            `}
        </div>
    `;
    
    return html;
}'''

content = old_func_pattern.sub(new_func, content)

with open('evaluation_mobile.js', 'w') as f:
    f.write(content)
