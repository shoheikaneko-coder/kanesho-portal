import sys

# 1. Expose mobileEditingEval to window in evaluation_mobile.js
with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content_mob = f.read()

old_mob_assign = "mobileEditingEval = JSON.parse(JSON.stringify(evalData));"
new_mob_assign = "mobileEditingEval = JSON.parse(JSON.stringify(evalData)); window.mobileEditingEval = mobileEditingEval;"

old_mob_clear = "mobileEditingEval = null;"
new_mob_clear = "mobileEditingEval = null; window.mobileEditingEval = null;"

content_mob = content_mob.replace(old_mob_assign, new_mob_assign).replace(old_mob_clear, new_mob_clear)

# Also expose openMobileInputView
old_mob_func = "function openMobileInputView(mode, evalData, isReadOnly = false) {"
new_mob_func = "window.openMobileInputView = function(mode, evalData, isReadOnly = false) {"
content_mob = content_mob.replace(old_mob_func, new_mob_func)

with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(content_mob)

# 2. Update evaluation.js to fallback to window.mobileEditingEval
with open('evaluation.js', 'r', encoding='utf-8') as f:
    content_eval = f.read()

old_start = """window.startEvaluationQuiz = (idx) => {
    const item = selectedEvalDetail.items[idx];"""

new_start = """window.startEvaluationQuiz = (idx) => {
    if (!selectedEvalDetail && window.mobileEditingEval) {
        selectedEvalDetail = window.mobileEditingEval;
    }
    const item = selectedEvalDetail.items[idx];"""

old_submit = """    window.refreshCurrentEvalDetail();
    
    // 自動保存
    try {
        await updateDoc(doc(db, "t_evaluations", selectedEvalDetail.id), {"""

new_submit = """    if (window.appState && window.appState.isMobileMode && window.openMobileInputView) {
        window.openMobileInputView(selectedEvalDetail.currentMode, selectedEvalDetail, selectedEvalDetail.isReadOnly);
    } else {
        window.refreshCurrentEvalDetail();
    }
    
    // 自動保存
    try {
        await updateDoc(doc(db, "t_evaluations", selectedEvalDetail.id), {"""

content_eval = content_eval.replace(old_start, new_start).replace(old_submit, new_submit)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content_eval)

print("Fix applied.")
