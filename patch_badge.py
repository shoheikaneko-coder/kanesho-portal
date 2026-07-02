import re

with open('evaluation.js', 'r') as f:
    content = f.read()

new_badge = """function getEvalActionBadge(e, wf, role, myJobTitle, isPrimary, isSecondary) {
    if (e.status === 'evaluating') {
        let amISubmitted = false;
        if (role === 'Admin') return true;
        if (isPrimary) amISubmitted = e.is_primary_submitted;
        else if (isSecondary) amISubmitted = e.is_manager_submitted;
        
        return !amISubmitted;
    }
    if (e.status === 'interviewing') {
        if (role === 'Admin' || isSecondary) return true;
    }
    if (e.status === 'president_pending' && role === 'President') {
        return true;
    }
    return false;
}"""

pattern = re.compile(r'function getEvalActionBadge\(e, wf, role, myJobTitle, isPrimary, isSecondary\) \{.*?\n\}', re.DOTALL)
if pattern.search(content):
    content = pattern.sub(new_badge, content)
else:
    print("Could not find getEvalActionBadge")

with open('evaluation.js', 'w') as f:
    f.write(content)

