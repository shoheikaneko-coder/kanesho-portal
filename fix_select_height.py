import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Category textarea min-height (make it match select better)
old_category = """<textarea rows="1" placeholder="例: ビジネスマナー"
                                  oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'category', this.value)"
                                  style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: none; overflow: hidden; display: block; min-height: 28px; background: #f8fafc;">${item.category || ''}</textarea>"""

new_category = """<textarea rows="1" placeholder="例: ビジネスマナー"
                                  oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'category', this.value)"
                                  style="width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: none; overflow: hidden; display: block; min-height: 32px; background: #f8fafc;">${item.category || ''}</textarea>"""

content = content.replace(old_category, new_category)

# Fix Select height
old_select = """<select onchange="window.updateTemplateItemField(${index}, 'quiz_bank_id', this.value)" 
                                style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.8rem; background: #f8fafc; min-height: 28px; height: 28px;">"""

new_select = """<select onchange="window.updateTemplateItemField(${index}, 'quiz_bank_id', this.value)" 
                                style="width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.8rem; background: #f8fafc; min-height: 32px; height: 32px; cursor: pointer;">"""

content = content.replace(old_select, new_select)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
