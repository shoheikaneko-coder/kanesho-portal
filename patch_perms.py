import re

with open('evaluation.js', 'r') as f:
    content = f.read()

old_perms = """    const canEditPrimary = isManagerMode && isPrimary && (status === 'self_submitted' || status === 'primary_submitted');
    const canEditSecondary = isManagerMode && isSecondary && (status === 'primary_submitted' || (!hasPrimary && status === 'self_submitted') || status === 'manager_evaluating');"""

new_perms = """    const canEditPrimary = isManagerMode && isPrimary && (status === 'evaluating' || status === 'self_submitted' || status === 'primary_submitted');
    const canEditSecondary = isManagerMode && isSecondary && (status === 'evaluating' || status === 'primary_submitted' || (!hasPrimary && status === 'self_submitted') || status === 'manager_evaluating');"""

if old_perms in content:
    content = content.replace(old_perms, new_perms)
else:
    print("Could not find old_perms string to replace.")

with open('evaluation.js', 'w') as f:
    f.write(content)

