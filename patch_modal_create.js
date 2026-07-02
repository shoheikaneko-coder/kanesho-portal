const fs = require('fs');
let code = fs.readFileSync('evaluation.js', 'utf8');

const dynamicModalLogic = `
window.openEvaluationHistory = async (userId, userName) => {
    let modal = document.getElementById('eval-history-modal-dynamic');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'eval-history-modal-dynamic';
        modal.style.display = 'none';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(15, 23, 42, 0.4)';
        modal.style.zIndex = '999999';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.padding = '1rem';
        modal.style.boxSizing = 'border-box';
        
        modal.innerHTML = \`
            <div class="glass-panel" style="background: white; width: 100%; max-width: 800px; max-height: 90vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.6rem;">
                        <i class="fas fa-history" style="color: var(--primary);"></i> 過去の評価履歴
                    </h3>
                    <button type="button" onclick="document.getElementById('eval-history-modal-dynamic').style.display='none';" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 1.5rem 1.8rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;" id="history-content-area-dynamic">
                </div>
            </div>
        \`;
        document.body.appendChild(modal);
    }
    
    const content = document.getElementById('history-content-area-dynamic');
    
    modal.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center; padding:3rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--text-secondary);"></i><div style="margin-top:1rem; color:var(--text-secondary); font-size:0.9rem; font-weight:700;">履歴を読み込んでいます...</div></div>';
`;

code = code.replace(
    /window\.openEvaluationHistory = async \(userId, userName\) => \{[\s\S]*?modal\.style\.display = 'flex';[\s\S]*?content\.innerHTML = '<div style="text-align:center; padding:3rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var\(--text-secondary\);">\<\/i><div style="margin-top:1rem; color:var\(--text-secondary\); font-size:0.9rem; font-weight:700;">履歴を読み込んでいます\.\.\.<\/div><\/div>';/,
    dynamicModalLogic
);

fs.writeFileSync('evaluation.js', code);
