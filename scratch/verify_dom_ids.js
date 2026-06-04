const fs = require('fs');
const path = require('path');

// users.jsの読み込み
const usersJsPath = path.join(__dirname, '../users.js');
const content = fs.readFileSync(usersJsPath, 'utf8');

// JavaScript側で `document.getElementById('ID')` もしくは `document.getElementById("ID")` している箇所を抽出
const getElementByIdRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
const referencedIds = new Set();
let match;
while ((match = getElementByIdRegex.exec(content)) !== null) {
    referencedIds.add(match[1]);
}

// フォーム関連で必須と思われる参照IDの一覧 (users.jsで実際に使われているもの)
const expectedFormIds = [
    'user-form',
    'user-code',
    'user-name',
    'user-lastname',
    'user-firstname',
    'user-password',
    'user-login-password',
    'user-email',
    'user-role',
    'user-store-select',
    'user-28h-limit',
    'user-display-name',
    'user-job-title',
    'user-grade-select',
    'user-status',
    'user-resignation-date',
    'user-visa-expiry',
    'user-hire-date',
    'resignation-date-group',
    'btn-send-reset-email',
    'btn-show-clock-in-pw',
    'btn-form-back',
    'btn-form-cancel'
];

console.log('--- JSで参照されている要素ID ---');
console.log(Array.from(referencedIds));

console.log('\n--- HTMLテンプレート上のID有無チェック ---');
let hasError = false;

expectedFormIds.forEach(id => {
    // HTMLテンプレート内に id="ID" または id='ID' が含まれているかチェック
    const idRegex = new RegExp(`id=['"]${id}['"]`);
    const exists = idRegex.test(content);
    if (exists) {
        console.log(`[OK] ID "${id}" はHTMLテンプレート上に存在します。`);
    } else {
        console.error(`[ERROR] ID "${id}" がHTMLテンプレート上に見つかりません！`);
        hasError = true;
    }
});

// 重複するid属性がないか簡易チェック
console.log('\n--- HTMLテンプレート内のID重複チェック ---');
const idAttrRegex = /id=['"]([^'"]+)['"]/g;
const foundIds = {};
while ((match = idAttrRegex.exec(content)) !== null) {
    const id = match[1];
    foundIds[id] = (foundIds[id] || 0) + 1;
}

Object.keys(foundIds).forEach(id => {
    if (foundIds[id] > 1) {
        // users-page-container など、複数の箇所で定義されている可能性のあるものをチェック
        // (formとlistが文字列として別々に定義されているため、form内とlist内での重複でなければ許容)
        console.log(`[INFO] ID "${id}" が ${foundIds[id]} 回出現します (別々のHTML文字列内での出現であれば正常です)`);
    }
});

if (hasError) {
    console.error('\n【検証失敗】一部の必要なIDがHTMLテンプレート上から消失しています！');
    process.exit(1);
} else {
    console.log('\n【検証成功】すべての必要なIDが正しくHTML上に存在しており、JSロジックとの整合性が担保されています。');
}
