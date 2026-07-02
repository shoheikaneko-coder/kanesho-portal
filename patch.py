import re

with open('evaluation.js', 'r') as f:
    content = f.read()

# Replace the body of renderSubordinatesTab
target_func_start = "function renderSubordinatesTab(container) {"
target_func_end = "    const tableFooter = `</tbody></table></div>`;"

new_func = """function renderSubordinatesTab(container) {
    const targetUsers = subordinateUsers.filter(u => {
        const evalData = activeEvaluations.find(e => e.user_id === u.id);
        if (!evalData) return false;
        if (evalData.status === 'president_pending' || evalData.status === 'approved' || evalData.status === 'notified') {
            return false;
        }
        return true;
    });

    if (targetUsers.length === 0) {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-check-circle fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">現在、進行中の評価対象スタッフはいません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">あなたが行うべき評価タスクはすべて完了しているか、対象者がいません。</p>
            </div>
        `;
        return;
    }

    const user = window.appState.currentUser;
    const role = user.Role || '';
    const myJobTitle = user.JobTitle || '';

    const sectionA = []; // あなたの評価待ち
    const sectionB = []; // 他者の入力待ち
    const sectionC = []; // 面談可能

    targetUsers.forEach(u => {
        const evalData = activeEvaluations.find(e => e.user_id === u.id);
        const wf = evalData.workflow || {};
        const isPrimary = wf.primary_evaluator === myJobTitle;
        const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長'));

        if (evalData.status === 'evaluating') {
            let amISubmitted = false;
            if (isPrimary) amISubmitted = evalData.is_primary_submitted;
            else if (isSecondary) amISubmitted = evalData.is_manager_submitted;
            
            if (!amISubmitted || role === 'Admin') {
                sectionA.push(u);
            } else {
                sectionB.push(u);
            }
        } else if (evalData.status === 'interviewing') {
            sectionC.push(u);
        }
    });

    const generateRows = (users) => {
        if (users.length === 0) return `<tr><td colspan="8" style="padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">該当するスタッフはいません</td></tr>`;
        
        let html = '';
        users.forEach(u => {
            const evalData = activeEvaluations.find(e => e.user_id === u.id);
            const status = evalData ? evalData.status : 'not_started';
            const statusJp = getStatusJpName(status);
            
            let score = '-';
            let mgrScore = '-';
            if (status === 'interviewing') {
                score = evalData.self_total_score || '-';
                mgrScore = evalData.manager_total_score || '-';
            } else if (status === 'evaluating') {
                score = '<span style="font-size:0.75rem; color:#94a3b8;"><i class="fas fa-lock"></i> 非公開</span>';
                mgrScore = '<span style="font-size:0.75rem; color:#94a3b8;"><i class="fas fa-lock"></i> 非公開</span>';
            }
            
            const resultGrade = evalData ? (evalData.new_grade || '-') : '-';
            const wf = evalData && evalData.workflow ? evalData.workflow : {};
            
            const isPrimary = wf.primary_evaluator === myJobTitle;
            const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長'));

            let actionBtn = '';
            if (status === 'evaluating') {
                let amISubmitted = false;
                if (isPrimary) amISubmitted = evalData.is_primary_submitted;
                else if (isSecondary) amISubmitted = evalData.is_manager_submitted;
                
                if (!amISubmitted || role === 'Admin') {
                    actionBtn = `<button class="btn btn-primary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#7c3aed; border-color:#7c3aed; padding: 0.4rem 0.8rem;">評価を入力</button>`;
                } else {
                    actionBtn = `<button class="btn btn-secondary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-check"></i> 入力済</button>`;
                }
            } else if (status === 'interviewing') {
                actionBtn = `<button class="btn" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#a21caf; border-color:#a21caf; color:white; padding: 0.4rem 0.8rem;">面談結果入力・社長提出</button>`;
            } else {
                actionBtn = `<button class="btn btn-secondary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>`;
            }

            actionBtn += `<button class="btn btn-secondary" onclick="window.openEvaluationHistory('${u.id}', '${u.Name}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.6rem; border:1px solid #cbd5e1; background:#f8fafc; color:#475569; margin-left:0.4rem;" title="過去の履歴を見る"><i class="fas fa-history"></i></button>`;

            html += `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 1rem; font-weight: 700; color: #1e293b;">${u.Name} ${u.DisplayName ? `<span style="font-size:0.75rem; color:#94a3b8; font-weight:400;">(${u.DisplayName})</span>` : ''}</td>
                    <td style="padding: 1rem; font-weight: 600; color: var(--text-secondary);">${u.JobTitle || '一般'}</td>
                    <td style="padding: 1rem; font-family: monospace; font-weight: 700; color: #1e3a8a;">${u.GradeCode || '-'}</td>
                    <td style="padding: 1rem;"><span class="eval-status-badge status-${status}">${statusJp}</span></td>
                    <td style="padding: 1rem; text-align: center; font-weight: 700;">${score}</td>
                    <td style="padding: 1rem; text-align: center; font-weight: 700; color: #7c3aed;">${mgrScore}</td>
                    <td style="padding: 1rem; text-align: center; font-family: monospace; font-weight: 900; color: #059669;">${resultGrade}</td>
                    <td style="padding: 1rem; text-align: right;" class="no-print">
                        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
                            ${actionBtn}
                        </div>
                    </td>
                </tr>
            `;
        });
        return html;
    };

    const tableHeader = `
        <div style="overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 2rem;">
            <table class="eval-table">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 0.8rem 1rem; text-align: left;">スタッフ名</th>
                        <th style="padding: 0.8rem 1rem; text-align: left;">役職</th>
                        <th style="padding: 0.8rem 1rem; text-align: left;">等級</th>
                        <th style="padding: 0.8rem 1rem; text-align: left;">進捗</th>
                        <th style="padding: 0.8rem 1rem; text-align: center;">自己評価点</th>
                        <th style="padding: 0.8rem 1rem; text-align: center;">最終評価点</th>
                        <th style="padding: 0.8rem 1rem; text-align: center;">新等級(仮)</th>
                        <th style="padding: 0.8rem 1rem; text-align: right;" class="no-print">操作</th>
                    </tr>
                </thead>
                <tbody>
    `;
    const tableFooter = `</tbody></table></div>`;

    container.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <h4 style="margin: 0 0 0.8rem; color: #1e293b; font-size: 1.1rem; border-left: 4px solid #ef4444; padding-left: 0.6rem;">
                あなたの評価待ち（最優先）
                <span style="font-size: 0.8rem; color: #64748b; font-weight: normal; margin-left: 0.5rem;">※あなたの入力が完了するまで面談に進めません。</span>
            </h4>
            ${tableHeader}${generateRows(sectionA)}${tableFooter}
        </div>

        <div style="margin-bottom: 2rem;">
            <h4 style="margin: 0 0 0.8rem; color: #1e293b; font-size: 1.1rem; border-left: 4px solid #3b82f6; padding-left: 0.6rem;">
                他者の入力完了待ち
                <span style="font-size: 0.8rem; color: #64748b; font-weight: normal; margin-left: 0.5rem;">※あなたの入力は完了しました。他者の入力を待っています。</span>
            </h4>
            ${tableHeader}${generateRows(sectionB)}${tableFooter}
        </div>
        
        <div style="margin-bottom: 2rem;">
            <h4 style="margin: 0 0 0.8rem; color: #1e293b; font-size: 1.1rem; border-left: 4px solid #a21caf; padding-left: 0.6rem;">
                面談可能（全員入力完了）
                <span style="font-size: 0.8rem; color: #64748b; font-weight: normal; margin-left: 0.5rem;">※全員の入力が完了しました。面談を実施し、結果を入力してください。</span>
            </h4>
            ${tableHeader}${generateRows(sectionC)}${tableFooter}
        </div>
    `;
}"""

import re
pattern = re.compile(r'function renderSubordinatesTab\(container\) \{.*?\n\}', re.DOTALL)
new_content = pattern.sub(new_func, content)

with open('evaluation.js', 'w') as f:
    f.write(new_content)

