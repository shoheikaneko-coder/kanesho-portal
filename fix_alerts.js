const fs = require('fs');
let uiContent = fs.readFileSync('ui_utils.js', 'utf8');

// Update z-indexes in ui_utils.js to be safely above 100000
uiContent = uiContent.replace(/z-index:10000/g, 'z-index:200000');
uiContent = uiContent.replace(/z-index:11000/g, 'z-index:210000');
fs.writeFileSync('ui_utils.js', uiContent, 'utf8');

let evalMobContent = fs.readFileSync('evaluation_mobile.js', 'utf8');
// Update the alert text to be friendlier
evalMobContent = evalMobContent.replace(
    /return showAlert\('入力未完了', 'すべての評価項目の点数を入力してください。'\);/,
    "return showAlert('入力が完了していません', '未入力の評価項目があります。<br>すべての項目に点数をつけてから提出してください。');"
);
fs.writeFileSync('evaluation_mobile.js', evalMobContent, 'utf8');

console.log('Fixed alert z-index and text!');
