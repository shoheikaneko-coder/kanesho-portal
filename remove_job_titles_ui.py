import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove HTML block
html_to_remove = """                    <!-- 対象役職の選択エリア -->
                    <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1rem;">
                        <div style="font-weight: 800; font-size: 0.9rem; color: #1e293b; margin-bottom: 0.5rem;"><i class="fas fa-users" style="color: #6366f1; margin-right: 0.4rem;"></i>このシートを適用する役職</div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.8rem;">チェックを入れた役職のスタッフに対して、次回の評価期開始時からこのシートが自動的に割り当てられます。（運用中の場合）</div>
                        <div id="editor-target-job-titles" style="display: flex; gap: 1rem; flex-wrap: wrap;">
                            <!-- ここにチェックボックスが動的に生成されます -->
                        </div>
                    </div>"""

if html_to_remove in content:
    content = content.replace(html_to_remove, "")
else:
    print("Warning: HTML block not found exactly as specified.")

# 2. Remove renderTargetJobTitles(); call
content = content.replace("    renderTargetJobTitles();\n", "")

# 3. Remove renderTargetJobTitles() function
func1_regex = re.compile(r"function renderTargetJobTitles\(\) \{.*?\}\n", re.DOTALL)
content = func1_regex.sub("", content)

# 4. Remove toggleTargetJobTitle() function
func2_regex = re.compile(r"window\.toggleTargetJobTitle = \(jobTitle, isChecked\) => \{.*?\}\n;", re.DOTALL)
content = func2_regex.sub("", content)

# just in case the above regex missed due to slightly different formatting:
func2_alt_regex = re.compile(r"window\.toggleTargetJobTitle = \(jobTitle, isChecked\) => \{.*?\};\n", re.DOTALL)
content = func2_alt_regex.sub("", content)

with open('evaluation.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
