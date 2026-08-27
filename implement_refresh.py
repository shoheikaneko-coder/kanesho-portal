import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Target 1: submitEvaluationQuiz replacement
old_quiz_render = "    // 画面再描画\n    window.renderEvalDetailInline(selectedEvalDetail);"
new_quiz_render = "    // 画面再描画\n    window.refreshCurrentEvalDetail();"

if old_quiz_render not in content:
    print("Error: Target 1 not found")
    sys.exit(1)

content = content.replace(old_quiz_render, new_quiz_render)

# Target 2: updateComment block
old_update_comment = """        // Re-render the table to reflect the new comment status
        const detailContainer = document.getElementById('subordinate-detail-container');
        const selfInlineContainer = document.getElementById('self-eval-inline-container');

        if (window.currentEvalMode === 'self' && selfInlineContainer) {
            renderEvalDetailInline(selfInlineContainer, selectedEvalDetail, 'self');
        } else if (detailContainer) {
            renderEvalDetailInline(detailContainer, selectedEvalDetail, window.currentEvalMode || 'manager');
        }
    };"""

new_update_comment = """        // Re-render the table to reflect the new comment status
        window.refreshCurrentEvalDetail();
    };

    window.refreshCurrentEvalDetail = () => {
        if (!selectedEvalDetail || !window.currentEvalMode) return;
        
        let container = null;
        const mode = window.currentEvalMode;
        
        if (mode === 'self') container = document.getElementById('self-eval-inline-container');
        else if (mode === 'interview') container = document.getElementById('interview-detail-container');
        else if (mode === 'president') container = document.getElementById('president-detail-container');
        else if (mode === 'admin') container = document.getElementById('admin-detail-inner');
        else container = document.getElementById('subordinate-detail-container');
        
        if (container) {
            renderEvalDetailInline(container, selectedEvalDetail, mode);
        }
    };"""

if old_update_comment not in content:
    print("Error: Target 2 not found")
    sys.exit(1)

content = content.replace(old_update_comment, new_update_comment)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
