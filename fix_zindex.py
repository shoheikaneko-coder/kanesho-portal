import sys

with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_str = '<div id="mob-quiz-review-panel" style="display: none; position: fixed; inset: 0; background: white; z-index: 100000; flex-direction: column; overflow: hidden; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);">'
new_str = '<div id="mob-quiz-review-panel" style="display: none; position: fixed; inset: 0; background: white; z-index: 9999999; flex-direction: column; overflow: hidden; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);">'

content = content.replace(old_str, new_str)

with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated z-index successfully.")
