const fs = require('fs');
let content = fs.readFileSync('evaluation_mobile.js', 'utf8');

// 1. z-index for input screen
content = content.replace(
    /\.eval-mob-input-screen \{\s*position: fixed;\s*top: 0; left: 0; right: 0; bottom: 0;\s*background: #f8fafc;\s*z-index: 1000;/g,
    '.eval-mob-input-screen {\n            position: fixed;\n            top: 0; left: 0; right: 0; bottom: 0;\n            background: #f8fafc;\n            z-index: 100000;'
);

// 2. padding-bottom for bottom bar
content = content.replace(
    /\.eval-mob-bottom-bar \{\s*position: fixed;\s*bottom: 0; left: 0; right: 0;\s*background: rgba\(255, 255, 255, 0\.95\);\s*backdrop-filter: blur\(10px\);\s*padding: 1rem;/g,
    '.eval-mob-bottom-bar {\n            position: fixed;\n            bottom: 0; left: 0; right: 0;\n            background: rgba(255, 255, 255, 0.95);\n            backdrop-filter: blur(10px);\n            padding: 1rem;\n            padding-bottom: calc(1rem + env(safe-area-inset-bottom, 20px));'
);

// 3. Hide/Show FAB button
content = content.replace(
    /function openMobileInputView\(mode, evalData\) \{/,
    "function openMobileInputView(mode, evalData) {\n    const globalFab = document.getElementById('fab-main-btn');\n    if (globalFab) globalFab.style.display = 'none';"
);
content = content.replace(
    /function closeMobileInputView\(\) \{/,
    "function closeMobileInputView() {\n    const globalFab = document.getElementById('fab-main-btn');\n    if (globalFab) globalFab.style.display = '';"
);

// 4. Remove auto-scroll
const scrollBlock = `                // Auto-scroll to next card
                const nextCard = document.getElementById(\`mob-card-\${idx + 1}\`);
                if (nextCard) {
                    setTimeout(() => {
                        nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300); // Slight delay for the button animation
                }`;
content = content.replace(scrollBlock, "");

// 5. Update placeholder text
content = content.replace(
    /自己評価のコメントを入力（任意）/g,
    '評価理由などを入力（任意）'
);

fs.writeFileSync('evaluation_mobile.js', content, 'utf8');
console.log('Successfully fixed mobile UI logic!');
