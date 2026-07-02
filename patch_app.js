const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Insert the new import
code = code.replace(
    /import \{ evaluationPageHtml, initEvaluationPage \} from '\.\/evaluation\.js';/,
    `import { evaluationPageHtml, initEvaluationPage } from './evaluation.js';\nimport { evaluationPageHtmlMobile, initEvaluationPageMobile } from './evaluation_mobile.js';`
);

// Modify the routing
code = code.replace(
    /case 'evaluation':\s*updateHeaderTitle\('スタッフ評価システム'\);\s*pageContent\.innerHTML = evaluationPageHtml;\s*initEvaluationPage\(\);\s*break;/,
    `case 'evaluation':
                updateHeaderTitle('スタッフ評価システム');
                if (window.innerWidth < 768) {
                    pageContent.innerHTML = evaluationPageHtmlMobile;
                    initEvaluationPageMobile();
                } else {
                    pageContent.innerHTML = evaluationPageHtml;
                    initEvaluationPage();
                }
                break;`
);

fs.writeFileSync('app.js', code);
