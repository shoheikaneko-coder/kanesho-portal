import re

with open('evaluation_mobile.js', 'r') as f:
    content = f.read()

old_block = r'''            if \(type === 'sub-input'\) \{
                const evalId = e.currentTarget.dataset.id;
                const role = e.currentTarget.dataset.role;
                const evData = mobileActiveEvaluations.find\(ev => ev.id === evalId\);
                if \(evData\) return openMobileInputView\(role, evData\);
                return;
            \}'''

new_block = '''            if (type === 'sub-input') {
                const evalId = e.currentTarget.dataset.id;
                const role = e.currentTarget.dataset.role;
                const evData = mobileActiveEvaluations.find(ev => ev.id === evalId);
                if (evData) return openMobileInputView(role, evData);
                return;
            }
            if (type === 'interview-input') {
                const evalId = e.currentTarget.dataset.id;
                const evData = mobileActiveEvaluations.find(ev => ev.id === evalId);
                if (evData) return openMobileInputView('interview', evData);
                return;
            }'''

content = re.sub(old_block, new_block, content)

with open('evaluation_mobile.js', 'w') as f:
    f.write(content)

