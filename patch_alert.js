const fs = require('fs');
let code = fs.readFileSync('evaluation.js', 'utf8');

code = code.replace(
    /document\.body\.addEventListener\('click', \(e\) => \{[\s\S]*?const btn = e\.target\.closest\('\.history-btn'\);[\s\S]*?if \(btn\) \{[\s\S]*?try \{[\s\S]*?window\.openEvaluationHistory\(btn\.dataset\.userid, btn\.dataset\.username\);[\s\S]*?\} catch\(err\) \{[\s\S]*?alert\("エラーが発生しました: " \+ err\.message\);[\s\S]*?\}[\s\S]*?\}[\s\S]*?\}\);/,
    `document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.history-btn');
        if (btn) {
            alert('Button clicked! UserID: ' + btn.dataset.userid + '\\nModal exists: ' + !!document.getElementById('eval-history-modal') + '\\nContent exists: ' + !!document.getElementById('history-content-area'));
            try {
                window.openEvaluationHistory(btn.dataset.userid, btn.dataset.username);
            } catch(err) {
                alert("エラーが発生しました: " + err.message);
            }
        }
    });`
);
fs.writeFileSync('evaluation.js', code);
