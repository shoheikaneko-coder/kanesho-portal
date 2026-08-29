import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_manager_alert = "showAlert('完了', successMsg);"
new_manager_alert = """showAlert('完了', successMsg);
                
                if (window.mobileEditingEval && typeof window.closeMobileInputView === 'function') {
                    window.closeMobileInputView();
                }"""

if old_manager_alert in content:
    content = content.replace(old_manager_alert, new_manager_alert)
    with open('evaluation.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Manager alert updated.")
else:
    print("WARNING: old_manager_alert not found.")
