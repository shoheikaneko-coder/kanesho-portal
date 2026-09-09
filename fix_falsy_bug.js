const fs = require('fs');
let code = fs.readFileSync('evaluation.js', 'utf8');

// Replace in renderWorkflowSettings
const oldLine = '${roleOptions.replace(`value="${currentSetting.secondary_evaluator || \'店長\'}"`, `value="${currentSetting.secondary_evaluator || \'店長\'}" selected`)}';
const newLine = '${roleOptions.replace(`value="${currentSetting.secondary_evaluator !== undefined ? currentSetting.secondary_evaluator : \'店長\'}"`, `value="${currentSetting.secondary_evaluator !== undefined ? currentSetting.secondary_evaluator : \'店長\'}" selected`)}';

if (code.includes(oldLine)) {
    code = code.replace(oldLine, newLine);
    fs.writeFileSync('evaluation.js', code);
    console.log("Fixed falsy bug in evaluation.js");
} else {
    console.log("Could not find the target line in evaluation.js");
}
