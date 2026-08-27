import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Update Table Header
old_thead = "カテゴリ・項目タイトル"
new_thead = "カテゴリ・評価項目"
content = content.replace(old_thead, new_thead)

# Replace the inner HTML of row
old_col1_regex = re.compile(r"tr\.innerHTML = `\n            <!-- 項目定義とテスト \(カテゴリ / タイトル / テスト / ID\) -->\n            <td style=\"padding: 1rem 0\.6rem 1rem 1rem; vertical-align: top; width: 45%;\">.*?</td>\n            <!-- 評価基準 \(詳細説明\) -->", re.DOTALL)

new_col1 = """tr.innerHTML = `
            <!-- 項目定義とテスト (カテゴリ / テスト / 評価項目 / ID) -->
            <td style="padding: 1rem 0.6rem 1rem 1rem; vertical-align: top; width: 45%;">
                <div style="display: flex; gap: 0.8rem; margin-bottom: 0.8rem;">
                    <!-- カテゴリ -->
                    <div style="flex: 1;">
                        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.2rem; font-weight: 700;">カテゴリ</div>
                        <textarea rows="1" placeholder="例: ビジネスマナー"
                                  oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'category', this.value)"
                                  style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: none; overflow: hidden; display: block; min-height: 28px; background: #f8fafc;">${item.category || ''}</textarea>
                    </div>
                    <!-- テスト -->
                    <div style="flex: 1;">
                        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.2rem; font-weight: 700;">テスト</div>
                        <select onchange="window.updateTemplateItemField(${index}, 'quiz_bank_id', this.value)" 
                                style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.8rem; background: #f8fafc; min-height: 28px; height: 28px;">
                            <option value="">(紐付けなし)</option>
                            ${Object.keys(window.availableQuizzes || {}).map(qId => {
                                const q = window.availableQuizzes[qId];
                                return \`<option value="${qId}" ${item.quiz_bank_id === qId ? 'selected' : ''}>${q.title || qId}</option>\`;
                            }).join('')}
                        </select>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.2rem;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">評価項目</div>
                    <div style="font-size: 0.65rem; color: #94a3b8; font-family: monospace;" title="システムID (編集不可)">ID: ${item.item_id || '---'}</div>
                </div>
                <textarea rows="1" placeholder="評価項目の内容を入力"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'title', this.value)"
                          style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.9rem; resize: none; overflow: hidden; display: block; min-height: 40px;">${item.title || ''}</textarea>
            </td>
            <!-- 評価基準 (詳細説明) -->"""

# Perform replacement
if old_col1_regex.search(content):
    content = old_col1_regex.sub(new_col1.replace('\\', '\\\\'), content)
    with open('evaluation.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Target regex not found")
