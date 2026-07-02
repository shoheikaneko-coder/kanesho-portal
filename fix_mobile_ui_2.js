const fs = require('fs');
let content = fs.readFileSync('evaluation_mobile.js', 'utf8');

// Fix bottom padding
content = content.replace(
    /padding-bottom: calc\(1rem \+ env\(safe-area-inset-bottom, 20px\)\);/g,
    'padding-bottom: 35px;'
);

// Append to body and lock scroll on open
content = content.replace(
    /function openMobileInputView\(mode, evalData\) \{/,
    "function openMobileInputView(mode, evalData) {\n    document.body.style.overflow = 'hidden';\n    const inputScreen = document.getElementById('eval-mob-input-screen');\n    document.body.appendChild(inputScreen);"
);

// Restore scroll on close
content = content.replace(
    /function closeMobileInputView\(\) \{/,
    "function closeMobileInputView() {\n    document.body.style.overflow = '';"
);

fs.writeFileSync('evaluation_mobile.js', content, 'utf8');
console.log('Fixed padding and modal positioning!');
