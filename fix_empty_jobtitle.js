const fs = require('fs');
let code = fs.readFileSync('evaluation.js', 'utf8');

const oldLogic = "const isEvaluator = uRoute.primary_evaluator === myJobTitle || uRoute.secondary_evaluator === myJobTitle;";
const newLogic = "const isEvaluator = myJobTitle && (uRoute.primary_evaluator === myJobTitle || uRoute.secondary_evaluator === myJobTitle);";

if (code.includes(oldLogic)) {
    code = code.replace(oldLogic, newLogic);
    fs.writeFileSync('evaluation.js', code);
    console.log("Fixed empty job title bug in evaluation.js");
}

let mobileCode = fs.readFileSync('evaluation_mobile.js', 'utf8');
if (mobileCode.includes(oldLogic)) {
    mobileCode = mobileCode.replace(oldLogic, newLogic);
    fs.writeFileSync('evaluation_mobile.js', mobileCode);
    console.log("Fixed empty job title bug in evaluation_mobile.js");
}
