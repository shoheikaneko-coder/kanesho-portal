import re

with open('evaluation.js', 'r') as f:
    content = f.read()

old_logic = r"const isSelfMode = mode === 'self' && \(status === 'not_started' \|\| status === 'self_evaluating'\);"
new_logic = "const isSelfMode = mode === 'self' && (status === 'evaluating' || status === 'not_started' || status === 'self_evaluating');"

content = re.sub(old_logic, new_logic, content)

with open('evaluation.js', 'w') as f:
    f.write(content)

