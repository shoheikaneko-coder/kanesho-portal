import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Table Columns (Location 1: renderHistoryTab)
content = re.sub(
    r'<th style="text-align:left;">データ種別</th>',
    '', content
)

content = re.sub(
    r'const isLegacy = h\.is_legacy_archive \? .*? システム判定</span>\';\n',
    '', content
)

content = re.sub(
    r'<td style="padding:1.2rem;">\$\{isLegacy\}</td>',
    '', content
)

content = re.sub(
    r'<td>\$\{isLegacy\}</td>',
    '', content
)

# 2. Remove Legacy Modal HTML
modal_pattern = r'    <!-- 過去データ入力モーダル -->.*?<!-- 評価詳細モーダル \(部下評価・閲覧用\) -->'
content = re.sub(modal_pattern, '    <!-- 評価詳細モーダル (部下評価・閲覧用) -->', content, flags=re.DOTALL)

# 3. Remove event listeners in initEvaluationPage
listeners_pattern = r'    // 過去データモーダルクローズ＆保存.*?// 履歴モーダルクローズ'
content = re.sub(listeners_pattern, '    // 履歴モーダルクローズ', content, flags=re.DOTALL)

# 4. Remove the legacy functions block
funcs_pattern = r'// ==========================================\n// 6\. 過去データのアーカイブ手入力\n// ==========================================.*?(?=// ==========================================\n// 7\. 全自動公開・ロック処理)'
content = re.sub(funcs_pattern, '', content, flags=re.DOTALL)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
