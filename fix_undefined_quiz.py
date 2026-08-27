import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace q.question with q.text
old_str = "<div>${escapeHTML(q.question)}</div>"
new_str = "<div>${escapeHTML(q.text)}</div>"

if old_str not in content:
    print("Error: String not found")
    sys.exit(1)

content = content.replace(old_str, new_str)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
