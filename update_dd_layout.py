import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Update Table Header
old_thead = """                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="width: 80px; text-align: center;">順序 / ID</th>
                                        <th style="text-align: left; width: 40%;">カテゴリ / 項目タイトル</th>
                                        <th style="text-align: left; width: 50%;">詳細説明（評価のポイント）</th>
                                        <th style="width: 60px; text-align: center;">操作</th>
                                    </tr>
                                </thead>"""
new_thead = """                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="width: 140px; text-align: left; padding-left: 0.8rem;">属性情報</th>
                                        <th style="text-align: left; width: 40%;">項目タイトル と テスト紐付け</th>
                                        <th style="text-align: left; width: 50%;">詳細説明（評価のポイント）</th>
                                        <th style="width: 60px; text-align: center;">操作</th>
                                    </tr>
                                </thead>"""
content = content.replace(old_thead, new_thead)

# Write D&D handlers at the end of the file or before renderTemplateItems
dd_handlers = """
window.draggedTemplateItemIndex = null;
window.onTemplateItemDragStart = (e, index) => {
    window.draggedTemplateItemIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
};
window.onTemplateItemDragEnd = (e) => {
    e.target.style.opacity = '1';
    window.draggedTemplateItemIndex = null;
    
    // Remove drag-over styles from all rows
    const tbody = document.getElementById('template-items-tbody');
    if (tbody) {
        Array.from(tbody.children).forEach(tr => tr.style.borderTop = '');
    }
};
window.onTemplateItemDragOver = (e, tr) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    tr.style.borderTop = '2px solid #3b82f6';
};
window.onTemplateItemDragLeave = (e, tr) => {
    tr.style.borderTop = '';
};
window.onTemplateItemDrop = (e, targetIndex) => {
    e.preventDefault();
    if (window.draggedTemplateItemIndex === null || window.draggedTemplateItemIndex === targetIndex) return;
    
    const item = activeEditItems.splice(window.draggedTemplateItemIndex, 1)[0];
    activeEditItems.splice(targetIndex, 0, item);
    
    activeEditItems.forEach((it, idx) => {
        it.display_order = idx + 1;
    });
    
    renderTemplateItems();
    
    const totalCountEl = document.getElementById('template-total-items-count');
    if (totalCountEl) totalCountEl.textContent = activeEditItems.length;
};

function renderTemplateItems() {"""

# Replace function renderTemplateItems
content = content.replace("function renderTemplateItems() {", dd_handlers)

# Now we need to update the forEach loop inside renderTemplateItems
old_foreach_regex = re.compile(r"activeEditItems\.forEach\(\(item, index\) => \{.*?\n    \}\);\n    \n    setTimeout\(\(\) => \{.*?\n    \}, 10\);\n\}", re.DOTALL)

new_foreach = """activeEditItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.style.transition = 'all 0.2s';
        
        // Drag and Drop settings
        tr.draggable = true;
        tr.ondragstart = (e) => window.onTemplateItemDragStart(e, index);
        tr.ondragend = (e) => window.onTemplateItemDragEnd(e);
        tr.ondragover = (e) => window.onTemplateItemDragOver(e, tr);
        tr.ondragleave = (e) => window.onTemplateItemDragLeave(e, tr);
        tr.ondrop = (e) => window.onTemplateItemDrop(e, index);
        
        tr.innerHTML = `
            <!-- 属性情報 (Drag/ID/カテゴリ) -->
            <td style="padding: 1rem 0.6rem; vertical-align: top; width: 140px; cursor: grab;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.8rem; color: #64748b; font-weight: 700;">
                    <i class="fas fa-grip-vertical"></i>
                    <span style="font-size: 0.9rem;">順序: ${item.display_order || (index + 1)}</span>
                </div>
                <div style="margin-bottom: 0.8rem; font-size: 0.65rem; color: #94a3b8; font-family: monospace; word-break: break-all;" title="システムID (編集不可)">
                    ID:<br>${item.item_id || '---'}
                </div>
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.2rem; font-weight: 700;">カテゴリ</div>
                <textarea rows="1" placeholder="例: 労働管理"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'category', this.value)"
                          style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: none; overflow: hidden; display: block; min-height: 28px; background: #f8fafc;">${item.category || ''}</textarea>
            </td>
            <!-- 項目定義とテスト (タイトル / テスト紐付け) -->
            <td style="padding: 1rem 0.6rem; vertical-align: top; width: 40%;">
                <textarea rows="1" placeholder="評価項目の内容を入力"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'title', this.value)"
                          style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.9rem; resize: none; overflow: hidden; display: block; min-height: 40px; margin-bottom: 0.8rem;">${item.title || ''}</textarea>
                          
                <div style="display: flex; align-items: center; gap: 0.5rem; background: #f8fafc; padding: 0.5rem; border-radius: 6px; border: 1px dashed #cbd5e1;">
                    <span style="font-size: 0.75rem; color: #8b5cf6; font-weight: 700; white-space: nowrap;"><i class="fas fa-spell-check"></i> テスト紐付け:</span>
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

content = old_foreach_regex.sub(new_foreach.replace('\\', '\\\\'), content)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
