import sys

with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content = f.read()

# The incorrect code block to remove
wrong_block = """
        let html = '';
        
        // 店長が評価する際の「部下育成進捗」アシストウィジェットの構築
        if (mode === 'manager') {
            const targetItem = mobileEditingEval.items.find(item => item.title.includes('部下の等級が前回評価よりも上がっている'));
            if (targetItem) {
                const hasRankedUpCount = mobileActiveEvaluations.filter(e => {
                    const isSub = mobileSubordinateUsers.some(u => u.id === e.user_id);
                    if (!isSub) return false;
                    const cur = parseInt(e.current_grade) || 0;
                    const nxt = parseInt(e.new_grade) || 0;
                    return nxt > cur && e.status !== 'not_started';
                }).length;
                
                html += `
                    <div style="background: #f0fdf4; border: 1px dashed #86efac; border-radius: 12px; padding: 1.2rem; margin: 1rem 0 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <h5 style="margin: 0 0 0.5rem; color: #166534; font-weight: 800; font-size: 0.9rem;"><i class="fas fa-magic"></i> 部下育成責任・自動判定アシスト</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: #15803d; line-height: 1.5;">
                            店長マスタ管理下のスタッフ等級推移を自動算出しました：<br>
                            <strong style="display:inline-block; margin-top:4px;">今期等級が上昇した部下の人数: ${hasRankedUpCount}名</strong> (在職中の部下合計: ${mobileSubordinateUsers.length}名中)<br>
                            <span style="font-size:0.75rem; display:inline-block; margin-top:4px;">※上記の成果を参考に、「部下の育成責任」の評価点を入力してください。</span>
                        </p>
                    </div>
                `;
            }
        }
"""

if wrong_block in content:
    # Replace it with just '    let html = '';'
    content = content.replace(wrong_block, "    let html = '';\n", 1)

# Now inject it into the right place in generateInputHtml
target_anchor = "    mobileEditingEval.items.forEach((item, idx) => {"
if target_anchor in content:
    correct_block = """
    // 店長が評価する際の「部下育成進捗」アシストウィジェットの構築
    if (mode === 'manager') {
        const targetItem = mobileEditingEval.items.find(item => item.title.includes('部下の等級が前回評価よりも上がっている'));
        if (targetItem) {
            const hasRankedUpCount = mobileActiveEvaluations.filter(e => {
                const isSub = mobileSubordinateUsers.some(u => u.id === e.user_id);
                if (!isSub) return false;
                const cur = parseInt(e.current_grade) || 0;
                const nxt = parseInt(e.new_grade) || 0;
                return nxt > cur && e.status !== 'not_started';
            }).length;
            
            html += `
                <div style="background: #f0fdf4; border: 1px dashed #86efac; border-radius: 12px; padding: 1.2rem; margin: 0 1rem 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <h5 style="margin: 0 0 0.5rem; color: #166534; font-weight: 800; font-size: 0.9rem;"><i class="fas fa-magic"></i> 部下育成責任・自動判定アシスト</h5>
                    <p style="margin: 0; font-size: 0.8rem; color: #15803d; line-height: 1.5;">
                        店長マスタ管理下のスタッフ等級推移を自動算出しました：<br>
                        <strong style="display:inline-block; margin-top:4px;">今期等級が上昇した部下の人数: ${hasRankedUpCount}名</strong> (在職中の部下合計: ${mobileSubordinateUsers.length}名中)<br>
                        <span style="font-size:0.75rem; display:inline-block; margin-top:4px;">※上記の成果を参考に、「部下の育成責任」の評価点を入力してください。</span>
                    </p>
                </div>
            `;
        }
    }
    
    mobileEditingEval.items.forEach((item, idx) => {"""
    
    if "部下育成責任・自動判定アシスト" not in correct_block: # wait, the file doesn't have it anymore after the first replace? No, it might.
        pass # Actually we just replaced it, so it's gone.
    
    if "部下育成責任・自動判定アシスト" not in content:
        content = content.replace(target_anchor, correct_block, 1)

with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed logic.")
