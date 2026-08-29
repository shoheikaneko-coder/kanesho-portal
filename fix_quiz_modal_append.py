import sys

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = "document.getElementById('quiz-execution-modal').style.display = 'flex';"
new_logic = """const modalEl = document.getElementById('quiz-execution-modal');
    if (modalEl && modalEl.parentElement !== document.body) {
        document.body.appendChild(modalEl);
    }
    if (modalEl) modalEl.style.display = 'flex';"""

content = content.replace(old_logic, new_logic)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Append logic injected.")
