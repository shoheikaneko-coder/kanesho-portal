import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Table Header
old_thead = """                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="width: 140px; text-align: left; padding-left: 0.8rem;">属性情報</th>
                                        <th style="text-align: left; width: 40%;">項目タイトル と テスト紐付け</th>
                                        <th style="text-align: left; width: 50%;">詳細説明（評価のポイント）</th>
                                        <th style="width: 60px; text-align: center;">操作</th>
                                    </tr>
                                </thead>"""
new_thead = """                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="text-align: left; width: 45%; padding-left: 0.8rem;">カテゴリ・項目タイトル</th>
                                        <th style="text-align: left; width: 55%;">詳細説明（評価のポイント）</th>
                                        <th style="width: 60px; text-align: center;">操作</th>
                                    </tr>
                                </thead>"""
content = content.replace(old_thead, new_thead)

# 2. Update tr.innerHTML in renderTemplateItems
old_tr_innerhtml_regex = re.compile(r"tr\.innerHTML = `\n            <!-- 属性情報 \(ID/カテゴリ\) -->.*?<!-- 操作 \(並び替え / 削除\) -->.*?</td>\n        `;", re.DOTALL)

new_tr_innerhtml = """tr.innerHTML = `
            <!-- 項目定義とテスト (カテゴリ / タイトル / テスト / ID) -->
            <td style="padding: 1rem 0.6rem 1rem 1rem; vertical-align: top; width: 45%;">
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.2rem; font-weight: 700;">カテゴリ</div>
                <textarea rows="1" placeholder="例: ビジネスマナー"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'category', this.value)"
                          style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: none; overflow: hidden; display: block; min-height: 28px; background: #f8fafc; margin-bottom: 0.8rem;">${item.category || ''}</textarea>
                
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.2rem; font-weight: 700;">項目タイトル（基準・行動定義）</div>
                <textarea rows="1" placeholder="評価項目の内容を入力"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'title', this.value)"
                          style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.9rem; resize: none; overflow: hidden; display: block; min-height: 40px; margin-bottom: 0.8rem;">${item.title || ''}</textarea>
                          
                <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 0.5rem; border-radius: 6px; border: 1px dashed #cbd5e1; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                        <span style="font-size: 0.75rem; color: #64748b; font-weight: 700; white-space: nowrap;">テスト:</span>
                        <select onchange="window.updateTemplateItemField(${index}, 'quiz_bank_id', this.value)" style="width: 160px; max-width: 100%; padding: 0.3rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem; background: white;">
                            <option value="">(紐付けなし)</option>
                            ${Object.keys(window.availableQuizzes || {}).map(qId => {
                                const q = window.availableQuizzes[qId];
                                return \`<option value="${qId}" ${item.quiz_bank_id === qId ? 'selected' : ''}>${q.title || qId}</option>\`;
                            }).join('')}
                        </select>
                    </div>
                    <div style="font-size: 0.7rem; color: #94a3b8; font-family: monospace; white-space: nowrap;" title="システムID (編集不可)">
                        ID: ${item.item_id || '---'}
                    </div>
                </div>
            </td>
            <!-- 評価基準 (詳細説明) -->
            <td style="padding: 1rem 0.6rem; vertical-align: top; width: 55%;">
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.2rem; font-weight: 700;">詳細説明（評価のポイント）</div>
                <textarea rows="1" placeholder="具体的な評価基準を記載"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'description', this.value)"
                          style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.85rem; resize: none; overflow: hidden; display: block; min-height: 120px; line-height: 1.5;">${item.description || ''}</textarea>
            </td>
            <!-- 操作 (並び替え / 削除) -->
            <td style="padding: 1rem 0.4rem; vertical-align: top; text-align: center;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.8rem;">
                    <div style="color: #94a3b8; padding: 0.4rem; cursor: grab;" title="ドラッグして並び替え">
                        <i class="fas fa-grip-vertical" style="font-size: 1.2rem;"></i>
                    </div>
                    <button type="button" class="btn" onclick="window.deleteTemplateItem(${index})" 
                            style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 0.4rem; border-radius: 50%; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s;"
                            onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'" title="この項目を削除">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;"""

content = old_tr_innerhtml_regex.sub(new_tr_innerhtml.replace('\\', '\\\\'), content)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
