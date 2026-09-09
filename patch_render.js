const fs = require('fs');
let code = fs.readFileSync('grades.js', 'utf8');

const regex = /tr\.innerHTML = `([\s\S]*?)`;\s*tbody\.appendChild\(tr\);/m;
const match = code.match(regex);
if (match) {
    console.log("Found it. Length:", match[0].length);
} else {
    console.log("Not found.");
}
