const fs = require('fs');
let code = fs.readFileSync('evaluation.js', 'utf8');

// Replace inline onclick with data attributes
code = code.replace(
    /onclick="window\.openEvaluationHistory\('\$\{userId\}', '\$\{selectedEvalDetail\.user_name \|\| '一般'\}'\)"/g,
    `class="btn btn-secondary history-btn" data-userid="\${userId}" data-username="\${selectedEvalDetail.user_name || '一般'}"`
);

code = code.replace(
    /onclick="window\.openEvaluationHistory\('\$\{e\.user_id\}', '\$\{e\.user_name \|\| '一般'\}'\)"/g,
    `class="btn btn-secondary history-btn" data-userid="\${e.user_id}" data-username="\${e.user_name || '一般'}"`
);

code = code.replace(
    /onclick="window\.openEvaluationHistory\('\$\{u\.id\}', '\$\{u\.Name\}'\)"/g,
    `class="btn btn-secondary history-btn" data-userid="\${u.id}" data-username="\${u.Name}"`
);

// Add event listener binding in initEvaluationPage
code = code.replace(
    /export async function initEvaluationPage\(\) \{/,
    `export async function initEvaluationPage() {\n    // Bind history buttons dynamically\n    document.body.addEventListener('click', (e) => {\n        const btn = e.target.closest('.history-btn');\n        if (btn) {\n            try {\n                window.openEvaluationHistory(btn.dataset.userid, btn.dataset.username);\n            } catch(err) {\n                alert("エラーが発生しました: " + err.message);\n            }\n        }\n    });`
);

fs.writeFileSync('evaluation.js', code);
