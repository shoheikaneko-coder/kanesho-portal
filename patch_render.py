import re

with open('evaluation.js', 'r') as f:
    content = f.read()

# Update renderModalBody
pattern_modal_body = re.compile(r'function renderModalBody\(container, mode\) \{.*?\n\}', re.DOTALL)

# Since renderModalBody is huge, I will do targeted string replacements within it instead of the whole function.

def update_modal_body(content):
    # 1. Table headers
    orig_th = """                        <th style="width:10%; text-align:center; padding:0.8rem; background:#10b981; color:white; border-right:1px solid rgba(255,255,255,0.2);">自己</th>
                        <th style="width:10%; text-align:center; padding:0.8rem; background:#10b981; color:white; border-right:1px solid rgba(255,255,255,0.2);">1次</th>
                        <th style="width:10%; text-align:center; padding:0.8rem; background:#10b981; color:white; border-right:1px solid rgba(255,255,255,0.2);">最終</th>
                        <th style="width:30%; text-align:left; padding:0.8rem; background:#10b981; color:white; border-top-right-radius:8px;">理由・フィードバック</th>"""

    new_th = """                        ${(status === 'evaluating' && mode === 'self' && role !== 'Admin') ? '<th style="width:10%; text-align:center; padding:0.8rem; background:#10b981; color:white;">自己</th><th style="width:30%; text-align:left; padding:0.8rem; background:#10b981; color:white; border-top-right-radius:8px;">理由</th>' : ''}
                        ${(status === 'evaluating' && mode === 'manager' && isPrimary && role !== 'Admin') ? '<th style="width:10%; text-align:center; padding:0.8rem; background:#10b981; color:white;">1次</th><th style="width:30%; text-align:left; padding:0.8rem; background:#10b981; color:white; border-top-right-radius:8px;">理由</th>' : ''}
                        ${(status === 'evaluating' && mode === 'manager' && isSecondary && role !== 'Admin') ? '<th style="width:10%; text-align:center; padding:0.8rem; background:#10b981; color:white;">最終</th><th style="width:30%; text-align:left; padding:0.8rem; background:#10b981; color:white; border-top-right-radius:8px;">理由・フィードバック</th>' : ''}
                        ${(status !== 'evaluating' || role === 'Admin') ? '<th style="width:10%; text-align:center; padding:0.8rem; background:#10b981; color:white; border-right:1px solid rgba(255,255,255,0.2);">自己</th><th style="width:10%; text-align:center; padding:0.8rem; background:#10b981; color:white; border-right:1px solid rgba(255,255,255,0.2);">1次</th><th style="width:10%; text-align:center; padding:0.8rem; background:#10b981; color:white; border-right:1px solid rgba(255,255,255,0.2);">最終</th><th style="width:30%; text-align:left; padding:0.8rem; background:#10b981; color:white; border-top-right-radius:8px;">理由・フィードバック</th>' : ''}"""
    
    content = content.replace(orig_th, new_th)

    # 2. Table row columns
    orig_tds = """                    <td style="padding:0.8rem; text-align:center;">${selfScoreHtml}</td>
                    <td style="padding:0.8rem; text-align:center; background:#f8fafc;">${primaryScoreHtml}</td>
                    <td style="padding:0.8rem; text-align:center; background:#f1f5f9;">${managerScoreHtml}</td>
                    <td style="padding:0.8rem; background:#f8fafc;">${reasonHtml}</td>"""
                    
    new_tds = """                    ${(status === 'evaluating' && mode === 'self' && role !== 'Admin') ? `<td style="padding:0.8rem; text-align:center;">${selfScoreHtml}</td><td style="padding:0.8rem; background:#f8fafc;">${reasonHtml}</td>` : ''}
                    ${(status === 'evaluating' && mode === 'manager' && isPrimary && role !== 'Admin') ? `<td style="padding:0.8rem; text-align:center; background:#f8fafc;">${primaryScoreHtml}</td><td style="padding:0.8rem; background:#f8fafc;">${reasonHtml}</td>` : ''}
                    ${(status === 'evaluating' && mode === 'manager' && isSecondary && role !== 'Admin') ? `<td style="padding:0.8rem; text-align:center; background:#f1f5f9;">${managerScoreHtml}</td><td style="padding:0.8rem; background:#f8fafc;">${reasonHtml}</td>` : ''}
                    ${(status !== 'evaluating' || role === 'Admin') ? `<td style="padding:0.8rem; text-align:center;">${selfScoreHtml}</td><td style="padding:0.8rem; text-align:center; background:#f8fafc;">${primaryScoreHtml}</td><td style="padding:0.8rem; text-align:center; background:#f1f5f9;">${managerScoreHtml}</td><td style="padding:0.8rem; background:#f8fafc;">${reasonHtml}</td>` : ''}"""
                    
    content = content.replace(orig_tds, new_tds)

    # 3. Edit conditions
    orig_can_edit = """    const canEditSelf = mode === 'self' && status === 'self_evaluating';
    const canEditPrimary = isManagerMode && isPrimary && (status === 'self_submitted' || status === 'primary_submitted');
    const canEditSecondary = isManagerMode && isSecondary && (status === 'primary_submitted' || (!hasPrimary && status === 'self_submitted') || status === 'manager_evaluating');"""
    
    new_can_edit = """    const canEditSelf = mode === 'self' && status === 'evaluating' && !selectedEvalDetail.is_self_submitted;
    const canEditPrimary = mode === 'manager' && isPrimary && status === 'evaluating' && !selectedEvalDetail.is_primary_submitted;
    const canEditSecondary = mode === 'manager' && isSecondary && (status === 'evaluating' || status === 'interviewing'); // Interviewing modification allowed"""

    content = content.replace(orig_can_edit, new_can_edit)
    
    # 4. isManagerMode and header condition
    content = content.replace("const isManagerMode = mode === 'manager' && (status === 'self_submitted' || status === 'primary_submitted' || status === 'manager_evaluating');", 
                              "const isManagerMode = mode === 'manager';")
                              
    return content

# Update renderModalFooter
def update_modal_footer(content):
    orig_footer = """function renderModalFooter(container, mode) {
    const status = selectedEvalDetail.status;
    const role = window.appState.currentUser ? window.appState.currentUser.Role : '';
    
    container.innerHTML = '';
    
    // 自己評価
    if (mode === 'self' && status === 'self_evaluating') {
        container.innerHTML = `
            <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('self')">下書き保存</button>
            <button class="btn btn-primary" style="background:#2563eb; border-color:#2563eb; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitSelfEvaluation()">自己評価を提出する</button>
        `;
    }
    // 店長・上長 (評価入力)
    else if (mode === 'manager') {
        const wf = selectedEvalDetail.workflow || {};
        const myJobTitle = window.appState.currentUser ? window.appState.currentUser.JobTitle : '';
        const role = window.appState.currentUser ? window.appState.currentUser.Role : '';
        const isPrimary = wf.primary_evaluator === myJobTitle;
        const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長'));

        if (status === 'self_submitted' || status === 'primary_submitted' || status === 'manager_evaluating') {
            let submitBtn = '';
            
            // 1次評価者の提出
            if (status === 'self_submitted' && isPrimary) {
                submitBtn = `<button class="btn btn-primary" style="background:#7c3aed; border-color:#7c3aed; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('primary')">1次評価を完了して提出</button>`;
            } 
            // 2次評価者の提出
            else if ((status === 'primary_submitted' || (status === 'self_submitted' && !wf.primary_evaluator) || status === 'manager_evaluating') && isSecondary) {
                submitBtn = `<button class="btn btn-primary" style="background:#7c3aed; border-color:#7c3aed; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('manager')">評価を確定して面談待ちへ</button>`;
            }
            
            if (submitBtn || role === 'Admin') {
                container.innerHTML = `
                    <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('manager')">評価を下書き保存</button>
                    ${submitBtn}
                `;
            } else {
                container.innerHTML = `<button class="btn" onclick="window.backToSubordinateList()" style="background:#f1f5f9; color:#475569; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:700;"><i class="fas fa-times"></i> 閉じる</button>`;
            }
        }
    }
    // 店長・上長 (面談タブ)
    else if (mode === 'interview') {
        if (status === 'interviewing') {
            container.innerHTML = `
                <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('interview')">下書き保存 (評価・面談メモ)</button>
                <button class="btn btn-primary" style="background:#059669; border-color:#059669; color:white; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('president_pending')">面談完了・社長へ最終提出</button>
            `;
        }
    }
    // 社長・承認者
    else if (mode === 'president' && status === 'president_pending') {
        container.innerHTML = `
            <button class="btn btn-primary" style="background:#be123c; border-color:#be123c; font-weight:800; padding:0.6rem 2rem;" onclick="window.approvePresidentEvaluation()">社長査定を確定する</button>
        `;
    }
    // 閲覧モード
    else {
        container.innerHTML = `
            <button class="btn" onclick="window.closeEvaluationModal()" style="background:#f1f5f9; color:#475569; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:700;"><i class="fas fa-times"></i> 閉じる</button>
        `;
    }
}"""
    
    # Notice: In the previous patch I changed 'primary_submitted' / 'interviewing' to 'primary' and 'manager' for `submitManagerEvaluation`. I need to ensure it matches. 
    # Let's write the whole function replacement for renderModalFooter.
    
    new_footer = """function renderModalFooter(container, mode) {
    const status = selectedEvalDetail.status;
    const role = window.appState.currentUser ? window.appState.currentUser.Role : '';
    const myJobTitle = window.appState.currentUser ? window.appState.currentUser.JobTitle : '';
    
    container.innerHTML = '';
    
    if (mode === 'self' && status === 'evaluating' && !selectedEvalDetail.is_self_submitted) {
        container.innerHTML = `
            <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('self')">下書き保存</button>
            <button class="btn btn-primary" style="background:#2563eb; border-color:#2563eb; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitSelfEvaluation()">自己評価を提出する</button>
        `;
    }
    else if (mode === 'manager' && status === 'evaluating') {
        const wf = selectedEvalDetail.workflow || {};
        const isPrimary = wf.primary_evaluator === myJobTitle;
        const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長'));

        let submitBtn = '';
        if (isPrimary && !selectedEvalDetail.is_primary_submitted) {
            submitBtn = `<button class="btn btn-primary" style="background:#7c3aed; border-color:#7c3aed; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('primary')">1次評価を提出</button>`;
        } 
        else if (isSecondary && !selectedEvalDetail.is_manager_submitted) {
            submitBtn = `<button class="btn btn-primary" style="background:#7c3aed; border-color:#7c3aed; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('manager')">最終評価を提出</button>`;
        }
        
        if (submitBtn || role === 'Admin') {
            container.innerHTML = `
                <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('manager')">評価を下書き保存</button>
                ${submitBtn}
            `;
        } else {
            container.innerHTML = `<button class="btn" onclick="window.backToSubordinateList()" style="background:#f1f5f9; color:#475569; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:700;"><i class="fas fa-times"></i> 閉じる</button>`;
        }
    }
    else if (mode === 'interview' && status === 'interviewing') {
        container.innerHTML = `
            <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('interview')">下書き保存 (評価・面談メモ)</button>
            <button class="btn btn-primary" style="background:#059669; border-color:#059669; color:white; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('president_pending')">面談完了・社長へ最終提出</button>
        `;
    }
    else if (mode === 'president' && status === 'president_pending') {
        container.innerHTML = `
            <button class="btn btn-primary" style="background:#be123c; border-color:#be123c; font-weight:800; padding:0.6rem 2rem;" onclick="window.approvePresidentEvaluation()">社長査定を確定する</button>
        `;
    }
    else {
        container.innerHTML = `
            <button class="btn" onclick="window.closeEvaluationModal()" style="background:#f1f5f9; color:#475569; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:700;"><i class="fas fa-times"></i> 閉じる</button>
        `;
    }
}"""
    
    # Using regex to replace the function
    pattern_footer = re.compile(r'function renderModalFooter\(container, mode\) \{.*?\n\}', re.DOTALL)
    if pattern_footer.search(content):
        content = pattern_footer.sub(new_footer, content)
    else:
        print("Could not find renderModalFooter")

    return content

# Execute updates
content = update_modal_body(content)
content = update_modal_footer(content)

with open('evaluation.js', 'w') as f:
    f.write(content)

