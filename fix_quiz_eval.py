import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix submission validation logic
val_old = """    window.submitManagerEvaluation = (type) => {
        const incompletePrimary = selectedEvalDetail.items.some(it => !it.primary_score);
        const incompleteManager = selectedEvalDetail.items.some(it => !it.manager_score);"""
val_new = """    window.submitManagerEvaluation = (type) => {
        // テスト不合格で強制ロックされている項目は未入力チェックから除外し、提出時に自動セットする
        const incompletePrimary = selectedEvalDetail.items.some(it => {
            if (it.quiz_data && it.quiz_data.completed && !it.quiz_data.passed) return false;
            return !it.primary_score;
        });
        const incompleteManager = selectedEvalDetail.items.some(it => {
            if (it.quiz_data && it.quiz_data.completed && !it.quiz_data.passed) return false;
            return !it.manager_score;
        });"""
content = content.replace(val_old, val_new)

# Auto-set forced scores upon submission
save_old = """        const notesEl = document.getElementById('modal-interview-notes');
        const dateEl = document.getElementById('modal-interview-date');
        if (notesEl) selectedEvalDetail.interview_notes = notesEl.value;
        if (dateEl) selectedEvalDetail.interview_date = dateEl.value;"""
save_new = """        const notesEl = document.getElementById('modal-interview-notes');
        const dateEl = document.getElementById('modal-interview-date');
        if (notesEl) selectedEvalDetail.interview_notes = notesEl.value;
        if (dateEl) selectedEvalDetail.interview_date = dateEl.value;

        // 不合格でロックされた項目の点数を自動補完
        selectedEvalDetail.items.forEach(it => {
            if (it.quiz_data && it.quiz_data.completed && !it.quiz_data.passed) {
                const forcedScore = it.quiz_data.eval_score || 1;
                if (!it.primary_score) it.primary_score = forcedScore;
                if (!it.manager_score) it.manager_score = forcedScore;
            }
        });"""
content = content.replace(save_old, save_new)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Validation fixed")
