import sys

with open('firebase.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Revert imports
content = content.replace(
    'import { getPerformance } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-performance.js";\nimport { getAuth }',
    'import { getAuth }'
)

# Revert initialization
content = content.replace(
    'export const db = getFirestore(app);\nexport const perf = getPerformance(app);',
    'export const db = getFirestore(app);'
)

with open('firebase.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Reverted successfully")
