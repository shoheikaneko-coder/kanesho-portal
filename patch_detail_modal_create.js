const fs = require('fs');
let code = fs.readFileSync('evaluation.js', 'utf8');

const dynamicDetailModalLogic = `
window.viewHistoryDetail = (evalId) => {
    const h = window.cachedHistories[evalId];
    if (!h) return;

    let detailModal = document.getElementById('eval-history-detail-modal-dynamic');
    if (!detailModal) {
        detailModal = document.createElement('div');
        detailModal.id = 'eval-history-detail-modal-dynamic';
        detailModal.style.display = 'none';
        detailModal.style.position = 'fixed';
        detailModal.style.inset = '0';
        detailModal.style.background = 'rgba(15, 23, 42, 0.4)';
        detailModal.style.zIndex = '9999999'; // Higher than history modal
        detailModal.style.alignItems = 'center';
        detailModal.style.justifyContent = 'center';
        detailModal.style.backdropFilter = 'blur(4px)';
        detailModal.style.padding = '1rem';
        detailModal.style.boxSizing = 'border-box';
        
        detailModal.innerHTML = \`
            <div class="glass-panel" style="background: white; width: 100%; max-width: 900px; max-height: 95vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3);">
                <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                    <h3 id="history-detail-title-dynamic" style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.6rem;">
                        評価詳細
                    </h3>
                    <button type="button" onclick="document.getElementById('eval-history-detail-modal-dynamic').style.display='none';" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 1.5rem 1.8rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;">
                    <table class="eval-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 50%;">評価項目</th>
                                <th style="width: 15%; text-align: center;">確定点</th>
                                <th style="width: 35%;">コメント</th>
                            </tr>
                        </thead>
                        <tbody id="history-detail-body-dynamic">
                        </tbody>
                    </table>
                </div>
            </div>
        \`;
        document.body.appendChild(detailModal);
    }
    
    document.getElementById('history-detail-title-dynamic').innerHTML = \`<i class="fas fa-file-alt" style="color:var(--primary);"></i> \${h.period}期 \${h.user_name} さんの評価詳細\`;
    
    let itemsHtml = '';
    const snapshotItems = h.template_snapshot || h.items || [];
    const evalData = h.eval_data || {};
    
    snapshotItems.forEach(item => {
        const scoreData = evalData[item.item_id] || {};
        const managerScore = scoreData.manager_score || scoreData.score || '-';
        
        itemsHtml += \`
            <tr style="background:white; border-bottom:1px solid #e2e8f0;">
                <td style="padding: 0.8rem; font-size:0.85rem;">
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:0.2rem; font-weight:700;">\${item.category}</div>
                    <div style="font-weight:800; color:#1e293b;">\${item.title}</div>
                    \${scoreData.legacy_memo ? \`<div style="font-size:0.75rem; color:#d97706; margin-top:0.4rem; background:#fffbeb; padding:0.5rem; border-radius:6px; border:1px solid #fde68a;"><i class="fas fa-info-circle"></i> <b>当時のメモ:</b> \${scoreData.legacy_memo}</div>\` : ''}
                </td>
                <td style="padding: 0.8rem; text-align:center; font-weight:900; color:#7c3aed; font-size:1.2rem;">
                    \${managerScore}
                </td>
                <td style="padding: 0.8rem; font-size:0.85rem; color:#475569;">
                    \${scoreData.manager_comment || scoreData.comment || '-'}
                </td>
            </tr>
        \`;
    });
    
    if (snapshotItems.length === 0) {
        itemsHtml = '<tr><td colspan="3" style="text-align:center; padding:2rem; color:#94a3b8;">詳細データがありません</td></tr>';
    }
    
    document.getElementById('history-detail-body-dynamic').innerHTML = itemsHtml;
    detailModal.style.display = 'flex';
};
`;

code = code.replace(
    /window\.viewHistoryDetail = \(evalId\) => \{[\s\S]*?document\.getElementById\('eval-history-detail-modal'\)\.style\.display = 'flex';\n\};/,
    dynamicDetailModalLogic
);

fs.writeFileSync('evaluation.js', code);
