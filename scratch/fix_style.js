const fs = require('fs');
let content = fs.readFileSync('attendance_management.js', 'utf8');

// The actual style definition starts right after </div>\n</div>\n\n<style> in the HTML string, but wait, the HTML string is gone?
// No, the HTML string is still there, but my script might have ruined the start.
