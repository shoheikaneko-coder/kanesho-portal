import re

with open('evaluation.js', 'r') as f:
    content = f.read()

new_badge_logic = """    const selfPending = myEvaluation && myEvaluation.status === 'evaluating' && !myEvaluation.is_self_submitted;
    updatePing('tab-self', selfPending);

    // 部下評価の残り件数をバッジに表示 (自己評価提出済・店長評価中の件数)
    const subordinatesBadge = document.getElementById('subordinates-badge');
    if (subordinatesBadge) {
        const pendingCount = activeEvaluations.filter(e => {
            const isSub = subordinateUsers.some(u => u.id === e.user_id);
            if (!isSub) return false;
            
            if (e.status !== 'evaluating') return false;

            // 管理者の場合は全員分を通知
            if (role === 'Admin' || role === '管理者') return true;

            const wf = e.workflow || {};
            const isPrimary = wf.primary_evaluator === myJobTitle;
            const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長'));
            
            let amISubmitted = false;
            if (isPrimary) amISubmitted = e.is_primary_submitted;
            else if (isSecondary) amISubmitted = e.is_manager_submitted;
            
            return !amISubmitted;
        }).length;"""

pattern = re.compile(r'    const selfPending = myEvaluation && myEvaluation\.status === \'self_evaluating\';\n    updatePing\(\'tab-self\', selfPending\);\n\n    // 部下評価の残り件数をバッジに表示 \(自己評価提出済・店長評価中の件数\)\n    const subordinatesBadge = document\.getElementById\(\'subordinates-badge\'\);\n    if \(subordinatesBadge\) \{.*?\}\)\.length;', re.DOTALL)

if pattern.search(content):
    content = pattern.sub(new_badge_logic, content)
else:
    print("Could not find badge logic")

with open('evaluation.js', 'w') as f:
    f.write(content)

