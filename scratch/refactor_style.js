const fs = require('fs');
let content = fs.readFileSync('attendance_management.js', 'utf8');

const styleStart = content.indexOf('<style>');
const styleEnd = content.indexOf('</style>', styleStart) + '</style>'.length;
const styleStr = content.substring(styleStart, styleEnd);

const styleConstStr = `\nconst attendanceManagementStyles = \`\n${styleStr}\n\`;\n`;

// Insert the const definition right after the imports
const firstImport = content.indexOf('import ');
const importsEnd = content.indexOf('\n\n', firstImport);

content = content.substring(0, importsEnd) + '\n' + styleConstStr + content.substring(importsEnd);

// Find where attendanceManagementPageHtml ends
const htmlEnd = content.indexOf('</style>\n`;');
content = content.substring(0, content.indexOf('<style>', htmlEnd - 5000)) + `\n${"${attendanceManagementStyles}"}\n\`;` + content.substring(htmlEnd + '</style>\n`;'.length);

// Also append to storeManagerPaidLeavePageHtml
const storeHtmlEnd = content.lastIndexOf('</div>\n`;');
content = content.substring(0, storeHtmlEnd) + `</div>\n\n${"${attendanceManagementStyles}"}\n\`;` + content.substring(storeHtmlEnd + '</div>\n`;'.length);

fs.writeFileSync('attendance_management.js', content);
console.log('Done refactoring');
