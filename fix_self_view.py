import sys

with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the self-view button
old_block = """            if (type === 'self-input') return openMobileInputView('self', mobileMyEvaluation);
            if (type === 'self-view') msg = '【自己評価確認画面】へ遷移します。\\n（※次回のステップで構築します）';
            if (type === 'history-view') {"""

new_block = """            if (type === 'self-input') return openMobileInputView('self', mobileMyEvaluation);
            if (type === 'self-view') return window.openMobileHistoryView(mobileMyEvaluation);
            if (type === 'history-view') {"""

content = content.replace(old_block, new_block)

# Remove the alert for self-view specifically, since we just fixed it
with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed self-view")
