import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update tr styles and remove cursor:grab from Col 1 td
old_tr_setup = """        // Drag and Drop settings
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
                </div>"""

new_tr_setup = """        // Drag and Drop settings
        tr.draggable = true;
        tr.style.cursor = 'grab';
        tr.ondragstart = (e) => window.onTemplateItemDragStart(e, index);
        tr.ondragend = (e) => window.onTemplateItemDragEnd(e);
        tr.ondragover = (e) => window.onTemplateItemDragOver(e, tr);
        tr.ondragleave = (e) => window.onTemplateItemDragLeave(e, tr);
        tr.ondrop = (e) => window.onTemplateItemDrop(e, index);
        
        tr.innerHTML = `
            <!-- 属性情報 (ID/カテゴリ) -->
            <td style="padding: 1rem 0.6rem; vertical-align: top; width: 140px;">"""

content = content.replace(old_tr_setup, new_tr_setup)

# 2. Update Col 4 to include the grip handle
old_col4 = """            <!-- 操作 (削除) -->
            <td style="padding: 1rem 0.4rem; vertical-align: top; text-align: center;">
                <button type="button" class="btn" onclick="window.deleteTemplateItem(${index})" 
                        style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 0.4rem; border-radius: 50%; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s;"
                        onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>"""

new_col4 = """            <!-- 操作 (並び替え / 削除) -->
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
            </td>"""

content = content.replace(old_col4, new_col4)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
