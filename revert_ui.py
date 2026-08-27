import sys

# 1. Update menu_definition.js
with open('menu_definition.js', 'r', encoding='utf-8') as f:
    menu_content = f.read()

target_str = ",\n            { id: 'performance_monitor', name: 'ポータルモニタリング', icon: 'fa-chart-line', color: '#f59e0b', desc: 'システムの動作速度やパフォーマンスを確認（Firebase Console）' }"
menu_content = menu_content.replace(target_str, "")

with open('menu_definition.js', 'w', encoding='utf-8') as f:
    f.write(menu_content)

# 2. Update app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app_content = f.read()

target_str2 = """window.navigateTo = (target, pushToHistory = true) => {
    if (target === 'performance_monitor') {
        window.open('https://console.firebase.google.com/project/kaneshow-portal/performance/app/web/', '_blank');
        return;
    }"""
app_content = app_content.replace(
    target_str2, 
    "window.navigateTo = (target, pushToHistory = true) => {"
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_content)

print("UI Reverted successfully")
