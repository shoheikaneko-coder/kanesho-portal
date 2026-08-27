import sys

# 1. Update firebase.js
with open('firebase.js', 'r', encoding='utf-8') as f:
    firebase_content = f.read()

firebase_content = firebase_content.replace(
    'import { getAuth }',
    'import { getPerformance } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-performance.js";\nimport { getAuth }'
)

firebase_content = firebase_content.replace(
    'export const db = getFirestore(app);',
    'export const db = getFirestore(app);\nexport const perf = getPerformance(app);'
)

with open('firebase.js', 'w', encoding='utf-8') as f:
    f.write(firebase_content)

# 2. Update menu_definition.js
with open('menu_definition.js', 'r', encoding='utf-8') as f:
    menu_content = f.read()

menu_content = menu_content.replace(
    "{ id: 'product_analysis', name: '商品分析（4つの窓）', icon: 'fa-chart-pie', color: '#4b5563', desc: '売上データのABC分析（4つの窓）' }",
    "{ id: 'product_analysis', name: '商品分析（4つの窓）', icon: 'fa-chart-pie', color: '#4b5563', desc: '売上データのABC分析（4つの窓）' },\n            { id: 'performance_monitor', name: 'ポータルモニタリング', icon: 'fa-chart-line', color: '#f59e0b', desc: 'システムの動作速度やパフォーマンスを確認（Firebase Console）' }"
)

with open('menu_definition.js', 'w', encoding='utf-8') as f:
    f.write(menu_content)

# 3. Update app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app_content = f.read()

app_content = app_content.replace(
    'window.navigateTo = (target, pushToHistory = true) => {',
    "window.navigateTo = (target, pushToHistory = true) => {\n    if (target === 'performance_monitor') {\n        window.open('https://console.firebase.google.com/project/kaneshow-portal/performance/app/web/', '_blank');\n        return;\n    }"
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Success")
