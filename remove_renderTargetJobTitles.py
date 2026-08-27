import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find the start and end of renderTargetJobTitles
start_idx = content.find("function renderTargetJobTitles() {")
if start_idx != -1:
    # Find the end of this function. It ends right before window.draggedTemplateItemIndex = null;
    end_idx = content.find("window.draggedTemplateItemIndex = null;", start_idx)
    if end_idx != -1:
        content = content[:start_idx] + content[end_idx:]

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
