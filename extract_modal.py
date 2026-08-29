import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'(<!-- テスト実施用モーダル -->.*?</div>\n    </div>)', content, re.DOTALL)
if match:
    with open('modal_html.txt', 'w', encoding='utf-8') as f:
        f.write(match.group(1))
    print("Extracted modal html.")
else:
    print("Not found.")
