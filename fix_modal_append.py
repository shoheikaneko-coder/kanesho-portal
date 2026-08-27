import sys

with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """    const panel = document.getElementById('mob-quiz-review-panel');
    panel.style.display = 'flex';
    // Trigger reflow for transition
    void panel.offsetWidth;"""

new_logic = """    const panel = document.getElementById('mob-quiz-review-panel');
    // Ensure it's at the root body level to avoid stacking context issues
    if (panel.parentElement !== document.body) {
        document.body.appendChild(panel);
    }
    panel.style.display = 'flex';
    // Trigger reflow for transition
    void panel.offsetWidth;"""

content = content.replace(old_logic, new_logic)

with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated append logic.")
