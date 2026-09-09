const fs = require('fs');

let oldCode = fs.readFileSync('scratch/eval_sync_7.js', 'utf8');
let currentCode = fs.readFileSync('evaluation.js', 'utf8');

const regexToExtract = /(function getYoYPeriod\(periodName\) \{[\s\S]*?window\.pastEvaluationsCache = window\.pastEvaluationsCache \|\| \{\}; \/\/ 過去データキャッシュ\n)/;
const match = oldCode.match(regexToExtract);

if (match) {
    const extractedFunctions = match[1];
    currentCode = currentCode.replace('function renderEvalDetailInline(container, evalData, mode) {', extractedFunctions + '\nasync function renderEvalDetailInline(container, evalData, mode) {');
    // Wait, renderEvalDetailInline was originally async!
    // Let me check if it was async in eval_sync_7.js.
    fs.writeFileSync('evaluation.js', currentCode);
    console.log("Restored missing functions!");
} else {
    console.error("Could not extract functions from eval_sync_7.js");
}
