const fs = require('fs');
let code = fs.readFileSync('evaluation_mobile.js', 'utf8');

const oldPrimary = "const isPrimary = wf.primary_evaluator === myJobTitle || (isAdmin && wf.primary_evaluator === '社長');";
const newPrimary = "const isPrimary = (myJobTitle && wf.primary_evaluator === myJobTitle) || (isAdmin && wf.primary_evaluator === '社長');";

const oldSecondary = "const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長')) || (isAdmin && wf.secondary_evaluator === '社長');";
const newSecondary = "const isSecondary = (myJobTitle && wf.secondary_evaluator === myJobTitle) || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長')) || (isAdmin && wf.secondary_evaluator === '社長');";

code = code.replace(oldPrimary, newPrimary);
code = code.replace(oldSecondary, newSecondary);
fs.writeFileSync('evaluation_mobile.js', code);
console.log("Fixed empty job title in evaluation_mobile.js render section");
