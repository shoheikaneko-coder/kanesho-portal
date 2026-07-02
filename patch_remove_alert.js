const fs = require('fs');
let code = fs.readFileSync('evaluation.js', 'utf8');

code = code.replace(
    /alert\('Button clicked! UserID: ' \+ btn\.dataset\.userid \+ '\\nModal exists: ' \+ !!document\.getElementById\('eval-history-modal'\) \+ '\\nContent exists: ' \+ !!document\.getElementById\('history-content-area'\)\);/,
    `// Alert removed`
);

fs.writeFileSync('evaluation.js', code);
