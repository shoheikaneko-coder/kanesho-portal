const fs = require('fs');
let content = fs.readFileSync('attendance_management.js', 'utf8');

const styleStart = content.indexOf('<style>');
const styleEnd = content.indexOf('</style>', styleStart) + '</style>'.length;
const styleContent = content.substring(styleStart, styleEnd);

// Remove it from the original HTML
content = content.substring(0, styleStart) + content.substring(styleEnd);

// Create the variable definition
const varDef = `\nconst attendanceManagementStyles = \`\n${styleContent}\n\`;\n`;

// Find where to insert it (after imports)
const htmlCommentIndex = content.indexOf('// ─── HTML テンプレート');
content = content.substring(0, htmlCommentIndex) + varDef + '\n' + content.substring(htmlCommentIndex);

// Append to attendanceManagementPageHtml (which ends at `;\n\n// ─── 状態`)
const stateCommentIndex = content.indexOf('// ─── 状態');
const htmlEndIndex = content.lastIndexOf('`;', stateCommentIndex);
content = content.substring(0, htmlEndIndex) + '${attendanceManagementStyles}\n' + content.substring(htmlEndIndex);

// storeManagerPaidLeavePageHtml already has ${attendanceManagementStyles} at the end from my previous script.

fs.writeFileSync('attendance_management.js', content);
