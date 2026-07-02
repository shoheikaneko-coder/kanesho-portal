const fs = require('fs');

// --- 1. Fix evaluation.js ---
let pcCode = fs.readFileSync('evaluation.js', 'utf8');

// Export gradeMap and myJobTitle to window.appState inside loadEvaluationApp
pcCode = pcCode.replace(
    /    let myJobTitle = '';\n    if \(user\.GradeCode && gradeMap\[user\.GradeCode\]\) \{/,
    `    let myJobTitle = '';
    window.appState.gradeMap = gradeMap;
    if (user.GradeCode && gradeMap[user.GradeCode]) {`
);
pcCode = pcCode.replace(
    /        myJobTitle = gradeMap\[user\.GradeCode\]\.job_title \|\| '';\n    \}/,
    `        myJobTitle = gradeMap[user.GradeCode].job_title || '';
    }
    window.appState.myJobTitle = myJobTitle;`
);

// Fix updateTabBadges and HTML generation in PC
pcCode = pcCode.replace(
    /    const myJobTitle = user\.JobTitle \|\| '';/,
    `    const myJobTitle = window.appState.myJobTitle || user.JobTitle || '';`
);
// In generateEvaluationModalHtml in PC:
pcCode = pcCode.replace(
    /    const myJobTitle = window\.appState\.currentUser\.JobTitle \|\| '';/,
    `    const myJobTitle = window.appState.myJobTitle || window.appState.currentUser.JobTitle || '';`
);
fs.writeFileSync('evaluation.js', pcCode);

// --- 2. Fix evaluation_mobile.js ---
let mobCode = fs.readFileSync('evaluation_mobile.js', 'utf8');

// Export to window.appState
mobCode = mobCode.replace(
    /        let myJobTitle = '';\n        if \(currentUser\.GradeCode && gradeMap\[currentUser\.GradeCode\]\) \{/,
    `        let myJobTitle = '';
        window.appState.gradeMap = gradeMap;
        if (currentUser.GradeCode && gradeMap[currentUser.GradeCode]) {`
);
mobCode = mobCode.replace(
    /            myJobTitle = gradeMap\[currentUser\.GradeCode\]\.job_title \|\| '';\n        \}/,
    `            myJobTitle = gradeMap[currentUser.GradeCode].job_title || '';
        }
        window.appState.myJobTitle = myJobTitle;`
);

// Fix generateSubordinatesViewHtml in Mobile
mobCode = mobCode.replace(
    /            const isPrimary = wf\.primary_evaluator === window\.appState\.currentUser\.JobTitle;/,
    `            const myJobTitle = window.appState.myJobTitle || window.appState.currentUser.JobTitle;
            const isPrimary = wf.primary_evaluator === myJobTitle;`
);
mobCode = mobCode.replace(
    /            const isManager = wf\.secondary_evaluator === window\.appState\.currentUser\.JobTitle \|\| \(\!wf\.secondary_evaluator && \(window\.appState\.currentUser\.Role === 'Manager' \|\| window\.appState\.currentUser\.Role === '店長'\)\);/,
    `            const isManager = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (window.appState.currentUser.Role === 'Manager' || window.appState.currentUser.Role === '店長'));`
);

// Connect sub-view in bindMobileActionButtons
mobCode = mobCode.replace(
    /            if \(type === 'sub-view'\) msg = '【部下評価確認画面】へ遷移します。\\n（※次回のステップで構築します）';/,
    `            if (type === 'sub-view') {
                const evalId = e.currentTarget.dataset.id;
                const evData = mobileActiveEvaluations.find(ev => ev.id === evalId);
                if (evData) return openMobileInputView('interview', evData, true);
                return;
            }`
);

// Add isReadOnly parameter to openMobileInputView
mobCode = mobCode.replace(
    /function openMobileInputView\(mode, evalData\) \{/,
    `function openMobileInputView(mode, evalData, isReadOnly = false) {`
);
mobCode = mobCode.replace(
    /    mobileEditingEval\.currentMode = mode;/,
    `    mobileEditingEval.currentMode = mode;
    mobileEditingEval.isReadOnly = isReadOnly;`
);
mobCode = mobCode.replace(
    /    inputScreen\.innerHTML = generateInputHtml\(mode\);/,
    `    inputScreen.innerHTML = generateInputHtml(mode, isReadOnly);`
);

// Modify generateInputHtml to support isReadOnly and president_comment
mobCode = mobCode.replace(
    /function generateInputHtml\(mode\) \{/,
    `function generateInputHtml(mode, isReadOnly = false) {`
);

mobCode = mobCode.replace(
    /                <textarea id="mob-interview-notes" rows="5" placeholder="面談で話し合った内容や育成方針を記入" style="width:100%; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.95rem; font-family:inherit; resize:none;">\$\{mobileEditingEval\.interview_notes \|\| ''\}<\/textarea>\n            <\/div>\n        `;/,
    `                <textarea id="mob-interview-notes" rows="5" placeholder="面談で話し合った内容や育成方針を記入" style="width:100%; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.95rem; font-family:inherit; resize:none;" \${isReadOnly ? 'readonly' : ''}>\${mobileEditingEval.interview_notes || ''}</textarea>
            </div>
        \`;
        if (mobileEditingEval.president_comment) {
            html += \`
                <div class="eval-mob-input-card" style="border: 2px solid #be123c; margin-top: 1rem;">
                    <h4 style="color:#be123c; font-weight:800; margin-bottom:1rem;"><i class="fas fa-user-tie"></i> 社長フィードバック・総括</h4>
                    <p style="font-size:0.9rem; color:#334155; white-space:pre-wrap; margin:0;">\${mobileEditingEval.president_comment}</p>
                </div>
            \`;
        }
`
);

mobCode = mobCode.replace(
    /            <button class="eval-mob-btn-save" id="btn-mob-save-draft" style="flex:1;">下書き保存<\/button>\n            <button class="eval-mob-btn-submit" id="btn-mob-submit" style="flex:2; background:#059669; border-color:#059669;">面談完了・提出<\/button>/,
    `            \${isReadOnly ? \`<button class="eval-mob-btn-submit" id="btn-mob-close-only" style="flex:1; background:#64748b; border-color:#64748b;">閉じる</button>\` : \`<button class="eval-mob-btn-save" id="btn-mob-save-draft" style="flex:1;">下書き保存</button>
            <button class="eval-mob-btn-submit" id="btn-mob-submit" style="flex:2; background:#059669; border-color:#059669;">面談完了・提出</button>\`}`
);

// Add read-only checks for date
mobCode = mobCode.replace(
    /                <input type="date" id="mob-interview-date" value="\$\{mobileEditingEval\.interview_date \|\| ''\}" style="width:100%; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; margin-bottom:1.2rem; font-family:inherit;">/,
    `                <input type="date" id="mob-interview-date" value="\${mobileEditingEval.interview_date || ''}" style="width:100%; padding:0.8rem; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; margin-bottom:1.2rem; font-family:inherit;" \${isReadOnly ? 'readonly' : ''}>`
);

// In bindMobileInputEvents, disable saving if readonly
mobCode = mobCode.replace(
    /    \/\/ Save Draft\n    document\.getElementById\('btn-mob-save-draft'\)\.addEventListener\('click', async \(\) => \{/,
    `    // View Only Close
    const btnCloseOnly = document.getElementById('btn-mob-close-only');
    if (btnCloseOnly) {
        btnCloseOnly.addEventListener('click', () => closeMobileInputView());
    }

    // Save Draft
    const btnSaveDraft = document.getElementById('btn-mob-save-draft');
    if (btnSaveDraft) btnSaveDraft.addEventListener('click', async () => {`
);

mobCode = mobCode.replace(
    /    \/\/ Submit\n    document\.getElementById\('btn-mob-submit'\)\.addEventListener\('click', async \(\) => \{/,
    `    // Submit
    const btnSubmit = document.getElementById('btn-mob-submit');
    if (btnSubmit) btnSubmit.addEventListener('click', async () => {`
);

// When Interview mode submits, check date and notes
mobCode = mobCode.replace(
    /            let nextStatus = 'evaluating';\n            if \(mode === 'self'\)/,
    `            if (mode === 'interview') {
                const dateEl = document.getElementById('mob-interview-date');
                const notesEl = document.getElementById('mob-interview-notes');
                if (!dateEl || !dateEl.value || !notesEl || !notesEl.value) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    return showAlert('入力エラー', '面談実施日と面談メモ（内容）は必須です。');
                }
            }

            let nextStatus = 'evaluating';
            if (mode === 'self')`
);
fs.writeFileSync('evaluation_mobile.js', mobCode);
