import re

with open('evaluation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken renderEvalUserList map return
old_code = """        return `
        </div>
        `;
    }).join('');"""

new_code = """        return `
        <div class="eval-list-grid" style="padding: 0.8rem 1.2rem; border-bottom: 1px solid #e2e8f0; cursor: pointer; background: white; transition: background-color 0.2s; margin: 0;" 
             onmouseover="this.style.backgroundColor='#f8fafc'" 
             onmouseout="this.style.backgroundColor='white'"
             onclick="if(event.target.tagName !== 'INPUT') { const cb = this.querySelector('.eval-user-checkbox'); cb.checked = !cb.checked; window.updateSelectionCounter(); }">
            <input type="checkbox" name="target_users" value="${u.id}" class="eval-user-checkbox" checked onchange="window.updateSelectionCounter()" style="width: 1.25rem; height: 1.25rem; accent-color: #10b981; cursor: pointer; justify-self: center; margin: 0;">
            <div style="font-size: 1rem; font-weight: 800; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${safeName}">${safeName}</div>
            <div style="font-size: 0.9rem; color: #475569; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><i class="fas fa-store" style="font-size: 0.8rem; margin-right: 0.3rem; color: #94a3b8;"></i>${safeStore}</div>
            <div style="font-size: 0.9rem; color: #64748b; font-weight: 600;"><span style="background: ${empTypeColorBg}; color: ${empTypeColorText}; padding: 0.2rem 0.6rem; border-radius: 4px; border: 1px solid ${empTypeBorder}; white-space: nowrap;">${safeEmpType}</span></div>
            <div style="font-size: 0.9rem; color: #64748b; font-weight: 600;"><span style="background: ${roleColorBg}; color: ${roleColorText}; padding: 0.2rem 0.6rem; border-radius: 4px; border: 1px solid ${roleBorder}; white-space: nowrap;"><i class="fas fa-tag" style="font-size: 0.7rem; margin-right: 0.3rem;"></i>${safeRole}</span></div>
        </div>
        `;
    }).join('');"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('evaluation.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Old code not found.")
