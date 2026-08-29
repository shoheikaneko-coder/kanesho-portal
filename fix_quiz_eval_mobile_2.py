import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content_eval = f.read()

old_start = """window.startEvaluationQuiz = (idx) => {
    if (!selectedEvalDetail && window.mobileEditingEval) {
        selectedEvalDetail = window.mobileEditingEval;
    }
    const item = selectedEvalDetail.items[idx];"""

new_start = """window.startEvaluationQuiz = (idx) => {
    if (window.mobileEditingEval) {
        selectedEvalDetail = window.mobileEditingEval;
    }
    const item = selectedEvalDetail.items[idx];"""

content_eval = content_eval.replace(old_start, new_start)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content_eval)

print("Fix applied.")
