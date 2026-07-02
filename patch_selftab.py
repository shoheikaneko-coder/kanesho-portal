import re

with open('evaluation.js', 'r') as f:
    content = f.read()

new_render_self = """function renderSelfTab(container) {
    if (!myEvaluation) {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-file-alt fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">現在、あなたの評価シートはありません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">評価期間が開始されるとお知らせします。</p>
            </div>
        `;
        return;
    }

    const e = myEvaluation;
    const statusJp = getStatusJpName(e.status);
    let alertHtml = '';
    let actionBtnHtml = '';

    if (e.status === 'evaluating') {
        if (!e.is_self_submitted) {
            alertHtml = `
                <div style="background: #fef9c3; border-left: 4px solid #eab308; padding: 1rem; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                    <div><span style="color: #ca8a04; font-weight: 800; font-size: 0.9rem;">ステータス: 自己評価中</span> <span style="margin-left: 1rem; font-size: 0.85rem; color: #475569;">現在の等級: ${e.current_grade} | 前年同期の等級: ${e.yoy_grade}</span></div>
                    <div style="font-size: 0.85rem; color: #1e293b;"><i class="fas fa-info-circle" style="color:#3b82f6;"></i> 自己評価を入力してください。入力後、上長へ提出してください。</div>
                </div>
            `;
            actionBtnHtml = `<button class="btn btn-primary" onclick="window.showEvaluationDetail('${e.id}', 'self')" style="background: #2563eb; border-color: #2563eb; font-weight: 800; padding: 0.8rem 2rem;">自己評価を入力する</button>`;
        } else {
            alertHtml = `
                <div style="background: #f1f5f9; border-left: 4px solid #64748b; padding: 1rem; border-radius: 4px; margin-bottom: 2rem;">
                    <div style="color: #475569; font-weight: 800; font-size: 0.9rem; margin-bottom: 0.4rem;">自己評価提出済</div>
                    <div style="font-size: 0.85rem; color: #64748b;">自己評価は提出済みです。他者の評価完了・面談をお待ちください。</div>
                </div>
            `;
            actionBtnHtml = `<button class="btn btn-secondary" onclick="window.showEvaluationDetail('${e.id}', 'self')" style="font-weight: 700; padding: 0.8rem 2rem;"><i class="fas fa-eye"></i> 提出した内容を確認する</button>`;
        }
    } else {
        alertHtml = `
            <div style="background: #f1f5f9; border-left: 4px solid #64748b; padding: 1rem; border-radius: 4px; margin-bottom: 2rem;">
                <div style="color: #475569; font-weight: 800; font-size: 0.9rem; margin-bottom: 0.4rem;">${statusJp}</div>
                <div style="font-size: 0.85rem; color: #64748b;">現在のステータスです。評価結果の確定をお待ちください。</div>
            </div>
        `;
        actionBtnHtml = `<button class="btn btn-secondary" onclick="window.showEvaluationDetail('${e.id}', 'self')" style="font-weight: 700; padding: 0.8rem 2rem;"><i class="fas fa-eye"></i> 評価シートを閲覧する</button>`;
    }

    container.innerHTML = `
        ${alertHtml}
        <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div style="font-size: 1.1rem; font-weight: 800; color: #1e293b; margin-bottom: 0.5rem;">【${e.period}】 ${e.user_name} さんの評価シート</div>
            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 2rem;">最終更新日: ${new Date(e.updated_at).toLocaleString('ja-JP')}</div>
            <div>
                ${actionBtnHtml}
            </div>
        </div>
        <div id="self-eval-inline-container"></div>
    `;

    const inlineContainer = document.getElementById('self-eval-inline-container');
    renderEvalDetailInline(inlineContainer, myEvaluation, 'self');
}"""

pattern = re.compile(r'function renderSelfTab\(container\) \{.*?\n    renderEvalDetailInline\(inlineContainer, myEvaluation, \'self\'\);\n\}', re.DOTALL)
if pattern.search(content):
    content = pattern.sub(new_render_self, content)
else:
    print("Could not find renderSelfTab")

with open('evaluation.js', 'w') as f:
    f.write(content)

