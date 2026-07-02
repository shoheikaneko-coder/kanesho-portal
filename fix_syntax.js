const fs = require('fs');
let content = fs.readFileSync('evaluation_mobile.js', 'utf8');

// The problematic block is around line 586-630.
// Let's replace the whole targetUsers.forEach block.

const correctBlock = `    targetUsers.forEach(item => {
        const u = item.user;
        const ev = item.evaluation;
        let statusText = '未開始';
        let actionBtnHtml = '';
        
        if (ev) {
            const wf = ev.workflow || {};
            const isPrimary = wf.primary_evaluator === window.appState.currentUser.JobTitle;
            const isManager = wf.secondary_evaluator === window.appState.currentUser.JobTitle || (!wf.secondary_evaluator && (window.appState.currentUser.Role === 'Manager' || window.appState.currentUser.Role === '店長'));
            
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
        }
        
        html += \`
            <div class="eval-mob-list-card">
                <div class="eval-mob-list-info">
                    <h4>\${u.Name}</h4>
                    <p>\${u.StoreId || '所属なし'} / \${u.Department === 'sales' ? '営業' : '製造'}</p>
                    <p style="margin-top: 0.3rem; font-weight: 700;">状態: \${statusText}</p>
                </div>
                <div class="eval-mob-list-action">
                    \${actionBtnHtml}
                </div>
            </div>
        \`;
    });`;

// Remove the old buggy block
const startPattern = "    targetUsers.forEach(item => {";
const endPattern = "    });";

const startIndex = content.indexOf(startPattern);
const endIndex = content.indexOf(endPattern, startIndex) + endPattern.length;

if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + correctBlock + content.substring(endIndex);
    fs.writeFileSync('evaluation_mobile.js', content, 'utf8');
    console.log("Fixed syntax error.");
} else {
    console.error("Could not find the block to replace.");
}
