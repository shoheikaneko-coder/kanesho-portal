const fs = require('fs');
const content = fs.readFileSync('attendance_management.js', 'utf8');

const startMatch = content.match(/<div id="attn-int-pane-paid_leave".*?>/);
const lines = content.split('\n');
let startIndex = lines.findIndex(l => l.includes('<div id="attn-int-pane-paid_leave"'));
let endIndex = lines.findIndex(l => l.includes('<!-- 7. 【CSVエクスポート設定】専用モーダルポップアップ -->'));

const paidLeaveHtml = lines.slice(startIndex, endIndex).join('\n');

let modalStartIndex = lines.findIndex(l => l.includes('<div id="attn-int-paid-modal"'));
let modalEndIndex = lines.findIndex(l => l.includes('</div>\n\n<style>')) || lines.findIndex(l => l.includes('<style>'));
// wait let's just grep the modal
console.log(modalStartIndex);
