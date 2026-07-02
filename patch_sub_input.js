const fs = require('fs');
let content = fs.readFileSync('evaluation_mobile.js', 'utf8');

// 1. Update generateSubordinatesViewHtml
content = content.replace(
    /        if \(ev\) {[\s\S]*?        }/,
    `        if (ev) {
            const wf = ev.workflow || {};
            const isPrimary = wf.primary_evaluator === mobileCurrentUser.JobTitle;
            const isManager = wf.secondary_evaluator === mobileCurrentUser.JobTitle || (!wf.secondary_evaluator && (mobileCurrentUser.Role === 'Manager' || mobileCurrentUser.Role === '店長'));
            
            let role = null;
            if (isPrimary && ['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted'].includes(ev.status)) role = 'primary';
            else if (isManager && ['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(ev.status)) role = 'manager';
            
            if (ev.status === 'open' || ev.status === 'evaluating' || ev.status === 'self_evaluating') {
                statusText = '本人入力待ち';
                actionBtnHtml = \`<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="\${ev.id}">確認</button>\`;
            } else if (role && !['president_pending', 'approved', 'notified'].includes(ev.status)) {
                statusText = '<span style="color:#ef4444;">評価入力 待ち</span>';
                actionBtnHtml = \`<button class="eval-mob-sub-btn action-mock-btn" data-type="sub-input" data-id="\${ev.id}" data-role="\${role}">入力する</button>\`;
            } else {
                statusText = '評価完了';
                actionBtnHtml = \`<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="\${ev.id}">確認</button>\`;
            }
        }`
);

// 2. Update bindMobileActionButtons
content = content.replace(
    /            if \(type === 'self-input'\) return openMobileInputView\('self', mobileMyEvaluation\);\n            if \(type === 'self-view'\) msg = '【自己評価確認画面】へ遷移します。\\n（※次回のステップで構築します）';\n            if \(type === 'history-view'\) msg = '【過去の履歴詳細画面】へ遷移します。\\n（※次回のステップで構築します）';\n            if \(type === 'sub-input'\) msg = '【一次評価（店長）入力画面】へ遷移します。\\n（※次回のステップで構築します）';\n            if \(type === 'sub-view'\) msg = '【部下評価確認画面】へ遷移します。\\n（※次回のステップで構築します）';/,
    `            if (type === 'self-input') return openMobileInputView('self', mobileMyEvaluation);
            if (type === 'self-view') msg = '【自己評価確認画面】へ遷移します。\\n（※次回のステップで構築します）';
            if (type === 'history-view') msg = '【過去の履歴詳細画面】へ遷移します。\\n（※次回のステップで構築します）';
            if (type === 'sub-input') {
                const evalId = e.currentTarget.dataset.id;
                const role = e.currentTarget.dataset.role;
                const evData = mobileActiveEvaluations.find(ev => ev.id === evalId);
                if (evData) return openMobileInputView(role, evData);
                return;
            }
            if (type === 'sub-view') msg = '【部下評価確認画面】へ遷移します。\\n（※次回のステップで構築します）';`
);

// 3. Update generateSelfInputHtml (rename concept)
content = content.replace(/function generateSelfInputHtml\(mode\) {/, 'function generateInputHtml(mode) {');
content = content.replace(/inputScreen.innerHTML = generateSelfInputHtml\(mode\);/, 'inputScreen.innerHTML = generateInputHtml(mode);');

// Inside generateInputHtml, update header and score rendering
let htmlReplaceFunc = `
function generateInputHtml(mode) {
    let titleText = mobilePeriodSettings.active_period + '自己評価入力';
    let subtitleText = '';
    
    if (mode === 'primary') {
        titleText = mobilePeriodSettings.active_period + ' 1次評価入力';
        subtitleText = \`<div style="font-size:0.85rem; color:#be123c; font-weight:700; margin-bottom:0.2rem;">対象者: \${mobileEditingEval.user_name || '一般'}</div>\`;
    } else if (mode === 'manager') {
        titleText = mobilePeriodSettings.active_period + ' 最終評価入力';
        subtitleText = \`<div style="font-size:0.85rem; color:#be123c; font-weight:700; margin-bottom:0.2rem;">対象者: \${mobileEditingEval.user_name || '一般'}</div>\`;
    }
    
    let html = \`
        <div class="eval-mob-input-header">
            <div style="flex:1;">
                <button class="btn" style="background:none; border:none; color:#64748b; font-size:1.2rem; padding:0;" id="btn-mob-input-close"><i class="fas fa-times"></i></button>
            </div>
            <div style="flex:4; text-align:center;">
                \${subtitleText}
                <div style="font-weight:900; color:#0f172a; font-size: 0.95rem;">\${titleText}</div>
                <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;" id="mob-progress-text">0 / \${mobileEditingEval.items.length} 項目完了</div>
                <div class="eval-mob-progress-container">
                    <div class="eval-mob-progress-fill" id="mob-progress-fill"></div>
                </div>
            </div>
            <div style="flex:1;"></div>
        </div>
        <div style="padding-top: 1rem;">
    \`;
    
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
        
        html += \`
            <div class="eval-mob-input-card" id="mob-card-\${idx}">
                <div class="eval-mob-cat-badge">\${item.category}</div>
                <div class="eval-mob-item-title">\${item.title || ''}</div>
                <div class="eval-mob-item-desc">\${(item.description || '').replace(/\\n/g, '<br>')}</div>
                
                <div class="eval-mob-rating-group" data-idx="\${idx}">
                    \${[1,2,3,4,5].map(score => \`
                        <button class="eval-mob-rating-btn \${currentScore === score ? 'selected' : ''}" data-score="\${score}">\${score}</button>
                    \`).join('')}
                </div>
                
                <textarea class="eval-mob-comment" id="mob-comment-\${idx}" placeholder="評価理由などを入力（任意）">\${currentComment}</textarea>
            </div>
        \`;
    });
    
    html += \`
        </div>
        <div class="eval-mob-bottom-bar">
            <button class="eval-mob-btn-save" id="btn-mob-save-draft">下書き保存</button>
            <button class="eval-mob-btn-submit" id="btn-mob-submit">入力を完了する</button>
        </div>
    \`;
    
    return html;
}
`;

content = content.replace(/function generateInputHtml\(mode\) \{[\s\S]*?return html;\n}/, htmlReplaceFunc);

// 4. Update progress calculator
content = content.replace(
    /const answered = mobileEditingEval\.items\.filter\(it => it\.self_score > 0\)\.length;/,
    `let answered = 0;
    if (mobileEditingEval.currentMode === 'primary') answered = mobileEditingEval.items.filter(it => it.primary_score > 0).length;
    else if (mobileEditingEval.currentMode === 'manager') answered = mobileEditingEval.items.filter(it => it.manager_score > 0).length;
    else answered = mobileEditingEval.items.filter(it => it.self_score > 0).length;`
);
// We need to inject currentMode into mobileEditingEval in openMobileInputView
content = content.replace(
    /mobileEditingEval = JSON\.parse\(JSON\.stringify\(evalData\)\); \/\/ Deep copy for editing/,
    `mobileEditingEval = JSON.parse(JSON.stringify(evalData)); // Deep copy for editing
    mobileEditingEval.currentMode = mode;`
);

// 5. Update bindMobileInputEvents rating update and submit
let eventReplacer = `
function bindMobileInputEvents(mode) {
    document.getElementById('btn-mob-input-close').addEventListener('click', () => {
        if (confirm('保存されていない内容は破棄されます。よろしいですか？')) {
            closeMobileInputView();
        }
    });
    
    // Rating Buttons
    document.querySelectorAll('.eval-mob-rating-group').forEach(group => {
        const idx = parseInt(group.dataset.idx);
        group.querySelectorAll('.eval-mob-rating-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const score = parseInt(e.currentTarget.dataset.score);
                
                group.querySelectorAll('.eval-mob-rating-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                
                if (mode === 'primary') mobileEditingEval.items[idx].primary_score = score;
                else if (mode === 'manager') mobileEditingEval.items[idx].manager_score = score;
                else mobileEditingEval.items[idx].self_score = score;
                
                updateMobileProgress();
            });
        });
    });
    
    // Comments
    mobileEditingEval.items.forEach((item, idx) => {
        const textarea = document.getElementById(\`mob-comment-\${idx}\`);
        if (textarea) {
            textarea.addEventListener('change', (e) => {
                if (mode === 'primary') mobileEditingEval.items[idx].primary_comment = e.target.value;
                else if (mode === 'manager') mobileEditingEval.items[idx].manager_comment = e.target.value;
                else mobileEditingEval.items[idx].self_comment = e.target.value;
            });
        }
    });
    
    // Save Draft
    document.getElementById('btn-mob-save-draft').addEventListener('click', async () => {
        try {
            const btn = document.getElementById('btn-mob-save-draft');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
            
            const docRef = doc(db, "t_evaluations", mobileEditingEval.id);
            await updateDoc(docRef, {
                items: mobileEditingEval.items,
                updated_at: new Date().toISOString()
            });
            
            // Sync to local memory if it's self eval
            if (mode === 'self' && mobileMyEvaluation) {
                mobileMyEvaluation.items = mobileEditingEval.items;
            }
            // Also sync back to mobileActiveEvaluations
            const aIdx = mobileActiveEvaluations.findIndex(e => e.id === mobileEditingEval.id);
            if (aIdx !== -1) {
                mobileActiveEvaluations[aIdx].items = mobileEditingEval.items;
            }
            
            btn.innerHTML = originalText;
            btn.disabled = false;
            showAlert('保存完了', '下書きを保存しました。');
        } catch (e) {
            console.error(e);
            showAlert('エラー', '保存に失敗しました。');
            document.getElementById('btn-mob-save-draft').disabled = false;
        }
    });
    
    // Submit
    document.getElementById('btn-mob-submit').addEventListener('click', async () => {
        let incomplete = false;
        if (mode === 'primary') incomplete = mobileEditingEval.items.some(it => !it.primary_score);
        else if (mode === 'manager') incomplete = mobileEditingEval.items.some(it => !it.manager_score);
        else incomplete = mobileEditingEval.items.some(it => !it.self_score);
        
        if (incomplete) {
            return showAlert('入力が完了していません', '未入力の評価項目があります。<br>すべての項目に点数をつけてから提出してください。');
        }
        
        let confirmMsg = '評価を提出します。提出後は変更ができなくなりますが、よろしいですか？';
        if (mode === 'primary') confirmMsg = '1次評価を完了として提出しますか？\\n（全員の評価が完了するまでは面談待ちに進みません）';
        else if (mode === 'manager') confirmMsg = '最終評価を完了として提出しますか？\\n（全員の評価が完了するまでは面談待ちに進みません）';
        else confirmMsg = '自己評価を提出します。提出後は変更ができなくなりますが、よろしいですか？';
        
        if (confirm(confirmMsg)) {
            try {
                const btn = document.getElementById('btn-mob-submit');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';
                btn.disabled = true;
                
                const wf = mobileEditingEval.workflow || {};
                const hasPrimary = !!wf.primary_evaluator;
                const isPrimarySub = mobileEditingEval.is_primary_submitted || false;
                const isManagerSub = mobileEditingEval.is_manager_submitted || false;
                const isSelfSub = mobileEditingEval.is_self_submitted || false;

                let nextStatus = mobileEditingEval.status;
                let updateData = {
                    items: mobileEditingEval.items,
                    updated_at: new Date().toISOString()
                };
                
                // Calculate total
                let sum = 0;
                
                if (mode === 'self') {
                    mobileEditingEval.items.forEach(it => sum += (it.self_score || 0));
                    updateData.self_total_score = sum;
                    updateData.is_self_submitted = true;
                    
                    if (hasPrimary && !isPrimarySub) nextStatus = 'self_submitted';
                    else if (!isManagerSub) nextStatus = hasPrimary ? 'primary_submitted' : 'self_submitted';
                    else nextStatus = 'interviewing';
                } else if (mode === 'primary') {
                    mobileEditingEval.items.forEach(it => sum += (it.primary_score || 0));
                    updateData.primary_total_score = sum;
                    updateData.is_primary_submitted = true;
                    
                    if (!isSelfSub) nextStatus = 'primary_evaluating'; // waiting for self
                    else if (!isManagerSub) nextStatus = 'primary_submitted';
                    else nextStatus = 'interviewing';
                } else if (mode === 'manager') {
                    mobileEditingEval.items.forEach(it => sum += (it.manager_score || 0));
                    updateData.manager_total_score = sum;
                    updateData.is_manager_submitted = true;
                    
                    if (!isSelfSub) nextStatus = 'manager_evaluating';
                    else if (hasPrimary && !isPrimarySub) nextStatus = 'manager_evaluating';
                    else nextStatus = 'interviewing';
                }
                
                updateData.status = nextStatus;
                
                const docRef = doc(db, "t_evaluations", mobileEditingEval.id);
                await updateDoc(docRef, updateData);
                
                // Sync to local memory
                if (mode === 'self' && mobileMyEvaluation) {
                    mobileMyEvaluation.status = nextStatus;
                    mobileMyEvaluation.is_self_submitted = true;
                    mobileMyEvaluation.items = mobileEditingEval.items;
                    mobileMyEvaluation.self_total_score = sum;
                }
                
                const idx = mobileActiveEvaluations.findIndex(e => e.id === mobileEditingEval.id);
                if (idx !== -1) {
                    mobileActiveEvaluations[idx] = { ...mobileActiveEvaluations[idx], ...updateData };
                }
                
                btn.innerHTML = originalText;
                btn.disabled = false;
                
                closeMobileInputView();
                
                // refresh views
                if (document.getElementById('mob-tab-self').classList.contains('active')) {
                    document.getElementById('eval-mob-content-area').innerHTML = generateSelfModeHtml();
                } else {
                    document.getElementById('eval-mob-content-area').innerHTML = generateSubordinatesViewHtml();
                }
                bindMobileActionButtons(document.getElementById('eval-mob-content-area'));
                
                let successMsg = '提出が完了しました。';
                if (mode === 'self') successMsg = '提出が完了しました。上長から面談日についての連絡が来るまでお待ちください。';
                else if (mode === 'primary') successMsg = '1次評価の提出が完了しました。';
                else if (mode === 'manager') successMsg = '最終評価の提出が完了しました。';
                
                showAlert('提出完了', successMsg);
            } catch (e) {
                console.error(e);
                showAlert('エラー', '提出処理に失敗しました。');
                document.getElementById('btn-mob-submit').disabled = false;
            }
        }
    });
}
`;

content = content.replace(/function bindMobileInputEvents\(mode\) \{[\s\S]*?\}\n\}\n/m, eventReplacer + '\n');

fs.writeFileSync('evaluation_mobile.js', content, 'utf8');
console.log('Patched evaluation_mobile.js successfully!');
