import sys
import re

# --- 1. Fix evaluation_mobile.js ---
with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    mob_content = f.read()

# Fix Bug 2: undefined in quiz review
old_quiz_line = '<p style="margin: 0 0 1rem; font-size: 0.95rem; font-weight: 800; color: #1e293b; line-height: 1.5;">${q.question}</p>'
new_quiz_line = """
                    <p style="margin: 0 0 1rem; font-size: 0.95rem; font-weight: 800; color: #1e293b; line-height: 1.5;">
                        ${String(q.text || '').replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]))}
                    </p>"""

if old_quiz_line in mob_content:
    mob_content = mob_content.replace(old_quiz_line, new_quiz_line.strip())
else:
    print("WARNING: old_quiz_line not found in evaluation_mobile.js")

# Expose closeMobileInputView
if 'window.closeMobileInputView = closeMobileInputView;' not in mob_content:
    mob_content += '\nwindow.closeMobileInputView = closeMobileInputView;\n'

with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(mob_content)
print("evaluation_mobile.js updated.")

# --- 2. Fix evaluation.js ---
with open('evaluation.js', 'r', encoding='utf-8') as f:
    eval_content = f.read()

# Fix Bug 1: Self evaluation submit
old_self_alert = "showAlert('提出完了', '提出が完了しました。上長から面談日についての連絡が来るまでお待ちください。');"
new_self_alert = """showAlert('提出完了', '提出が完了しました。上長から面談日についての連絡が来るまでお待ちください。');
                
                if (window.mobileEditingEval && typeof window.closeMobileInputView === 'function') {
                    window.closeMobileInputView();
                }"""

if old_self_alert in eval_content:
    eval_content = eval_content.replace(old_self_alert, new_self_alert)
else:
    print("WARNING: old_self_alert not found in evaluation.js")

# Fix Bug 1: Manager evaluation submit
old_manager_alert = "showAlert('提出完了', '評価の提出が完了しました。');"
new_manager_alert = """showAlert('提出完了', '評価の提出が完了しました。');
                    
                    if (window.mobileEditingEval && typeof window.closeMobileInputView === 'function') {
                        window.closeMobileInputView();
                    }"""

if old_manager_alert in eval_content:
    eval_content = eval_content.replace(old_manager_alert, new_manager_alert)
else:
    print("WARNING: old_manager_alert not found in evaluation.js")

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(eval_content)
print("evaluation.js updated.")
