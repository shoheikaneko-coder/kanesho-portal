import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = """    activeEditItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        
        tr.innerHTML = `
            <!-- 表示順序 -->
            <td style="padding: 0.6rem 0.4rem; text-align: center;">
                <input type="number" value="${item.display_order || (index + 1)}" min="1" 
                       onchange="window.updateTemplateItemField(${index}, 'display_order', this.value)" 
                       style="width: 60px; text-align: center; padding: 0.35rem 0.2rem; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 0.8rem;">
            </td>
            <!-- カテゴリ -->
            <td style="padding: 0.6rem 0.4rem;">
                <input type="text" value="${item.category || ''}" placeholder="例: 労働管理"
                       onchange="window.updateTemplateItemField(${index}, 'category', this.value)"
                       style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.8rem;">
            </td>
            <!-- 項目名 -->
            <td style="padding: 0.6rem 0.4rem;">
                <textarea rows="2" placeholder="評価項目の内容を入力"
                          onchange="window.updateTemplateItemField(${index}, 'title', this.value)"
                          style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: vertical;">${item.title || ''}</textarea>
            </td>
            <!-- 基準説明とテスト紐付け -->
            <td style="padding: 0.6rem 0.4rem;">
                <textarea rows="2" placeholder="具体的な評価基準を記載"
                          onchange="window.updateTemplateItemField(${index}, 'description', this.value)"
                          style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: vertical; margin-bottom: 0.5rem;">${item.description || ''}</textarea>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 0.75rem; color: #8b5cf6; font-weight: 700;"><i class="fas fa-spell-check"></i> テスト:</span>
                    <select onchange="window.updateTemplateItemField(${index}, 'quiz_bank_id', this.value)" style="flex: 1; padding: 0.2rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.75rem; background: #f8fafc;">
                        <option value="">(紐付けなし)</option>
                        ${Object.keys(window.availableQuizzes || {}).map(qId => {
                            const q = window.availableQuizzes[qId];
                            return `<option value="${qId}" ${item.quiz_bank_id === qId ? 'selected' : ''}>${q.title || qId}</option>`;
                        }).join('')}
                    </select>
                </div>
            </td>
            <!-- 操作 (削除) -->
            <td style="padding: 0.6rem 0.4rem; text-align: center;">
                <button type="button" class="btn" onclick="window.deleteTemplateItem(${index})" 
                        style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 0.4rem; border-radius: 50%; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s;"
                        onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}"""

replacement = """    activeEditItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        
        tr.innerHTML = `
            <!-- 基本情報 (順序 / ID) -->
            <td style="padding: 1rem 0.6rem; vertical-align: top; width: 80px; text-align: center;">
                <input type="number" value="${item.display_order || (index + 1)}" min="1" 
                       onchange="window.updateTemplateItemField(${index}, 'display_order', this.value)" 
                       style="width: 100%; text-align: center; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 0.85rem; box-sizing: border-box;">
                <div style="margin-top: 0.6rem; font-size: 0.65rem; color: #94a3b8; font-family: monospace; word-break: break-all;" title="システムID (編集不可)">
                    ID:<br>${item.item_id || '---'}
                </div>
            </td>
            <!-- 項目定義とテスト (カテゴリ / タイトル / テスト紐付け) -->
            <td style="padding: 1rem 0.6rem; vertical-align: top; width: 40%;">
                <input type="text" value="${item.category || ''}" placeholder="例: 労働管理"
                       onchange="window.updateTemplateItemField(${index}, 'category', this.value)"
                       style="width: 120px; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.8rem; margin-bottom: 0.6rem; display: block; background: #f8fafc;">
                
                <textarea rows="1" placeholder="評価項目の内容を入力"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'title', this.value)"
                          style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.9rem; resize: none; overflow: hidden; display: block; min-height: 40px; margin-bottom: 0.8rem;">${item.title || ''}</textarea>
                          
                <div style="display: flex; align-items: center; gap: 0.5rem; background: #f8fafc; padding: 0.5rem; border-radius: 6px; border: 1px dashed #cbd5e1;">
                    <span style="font-size: 0.75rem; color: #8b5cf6; font-weight: 700; white-space: nowrap;"><i class="fas fa-spell-check"></i> テスト:</span>
                    <select onchange="window.updateTemplateItemField(${index}, 'quiz_bank_id', this.value)" style="flex: 1; padding: 0.3rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem; background: white; width: 100%;">
                        <option value="">(紐付けなし)</option>
                        ${Object.keys(window.availableQuizzes || {}).map(qId => {
                            const q = window.availableQuizzes[qId];
                            return \`<option value="${qId}" ${item.quiz_bank_id === qId ? 'selected' : ''}>${q.title || qId}</option>\`;
                        }).join('')}
                    </select>
                </div>
            </td>
            <!-- 評価基準 (詳細説明) -->
            <td style="padding: 1rem 0.6rem; vertical-align: top; width: 50%;">
                <textarea rows="1" placeholder="具体的な評価基準を記載"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'description', this.value)"
                          style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.85rem; resize: none; overflow: hidden; display: block; min-height: 120px; line-height: 1.5;">${item.description || ''}</textarea>
            </td>
            <!-- 操作 (削除) -->
            <td style="padding: 1rem 0.4rem; vertical-align: top; text-align: center;">
                <button type="button" class="btn" onclick="window.deleteTemplateItem(${index})" 
                        style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 0.4rem; border-radius: 50%; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s;"
                        onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    setTimeout(() => {
        const textareas = tbody.querySelectorAll('textarea');
        textareas.forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
    }, 10);
}"""

if target in content:
    content = content.replace(target, replacement)
    with open('evaluation.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Target not found")
