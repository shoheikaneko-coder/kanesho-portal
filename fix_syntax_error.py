import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the end of openTemplateEditor
marker1 = "    renderTemplateItems();\n}"
start_idx = content.find(marker1)

if start_idx != -1:
    start_idx += len(marker1)
    # Find the start of draggedTemplateItemIndex
    marker2 = "window.draggedTemplateItemIndex = null;"
    end_idx = content.find(marker2, start_idx)
    
    if end_idx != -1:
        # Check what we are removing to be safe
        removed_text = content[start_idx:end_idx]
        print("Removing:")
        print(removed_text)
        
        content = content[:start_idx] + "\n\n" + content[end_idx:]
        
        with open('evaluation.js', 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully cleaned up.")
    else:
        print("marker2 not found")
else:
    print("marker1 not found")

