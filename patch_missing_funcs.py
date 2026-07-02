import re

with open('evaluation.js', 'r') as f:
    content = f.read()

# I will replace the end of renderSubordinatesTab
old_end = """        <div style="margin-bottom: 2rem;">
            <h4 style="margin: 0 0 0.8rem; color: #1e293b; font-size: 1.1rem; border-left: 4px solid #a21caf; padding-left: 0.6rem;">
                面談可能（全員入力完了）
                <span style="font-size: 0.8rem; color: #64748b; font-weight: normal; margin-left: 0.5rem;">※全員の入力が完了しました。面談を実施し、結果を入力してください。</span>
            </h4>
            ${tableHeader}${generateRows(sectionC)}${tableFooter}
        </div>
    `;
}"""

new_end = """        <div id="subordinate-list-container">
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
        </div>
        <div id="subordinate-detail-container" style="display: none;"></div>
    `;

    // 画面切り替え（ドリルダウン）関数
    window.showSubordinateDetail = (userId) => {
        const evalData = activeEvaluations.find(e => e.user_id === userId);
        if (evalData) {
            document.getElementById('subordinate-list-container').style.display = 'none';
            const detailContainer = document.getElementById('subordinate-detail-container');
            detailContainer.style.display = 'block';
            renderEvalDetailInline(detailContainer, evalData, 'manager');
        }
    };

    window.backToSubordinateList = () => {
        document.getElementById('subordinate-detail-container').style.display = 'none';
        document.getElementById('subordinate-detail-container').innerHTML = '';
        document.getElementById('subordinate-list-container').style.display = 'block';
    };
}"""

# Since I just want to replace the container.innerHTML part:
pattern_end = re.compile(r'    container\.innerHTML = `\n        <div style="margin-bottom: 2rem;">.*?    `;\n\}', re.DOTALL)
if pattern_end.search(content):
    content = pattern_end.sub("    container.innerHTML = `" + new_end[28:], content)  # The 28: slices off the first part to match properly. Or I can just write it cleanly.

with open('evaluation.js', 'w') as f:
    f.write(content)

