import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """    if (window.appState && window.appState.isMobileMode && window.openMobileInputView) {
        window.openMobileInputView(selectedEvalDetail.currentMode, selectedEvalDetail, selectedEvalDetail.isReadOnly);
    } else {
        window.refreshCurrentEvalDetail();
    }"""

new_logic = """    if (window.mobileEditingEval && typeof window.openMobileInputView === 'function') {
        window.openMobileInputView(selectedEvalDetail.currentMode, selectedEvalDetail, selectedEvalDetail.isReadOnly);
    } else if (typeof window.refreshCurrentEvalDetail === 'function') {
        window.refreshCurrentEvalDetail();
    }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open('evaluation.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Submit logic updated.")
else:
    print("Old logic not found. Trying flexible replacement.")
    # In case of slight formatting differences, use regex or replace parts
