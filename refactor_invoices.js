const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'invoices.js');
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Imports
code = code.replace(
    "import { showAlert, showConfirm } from './ui_utils.js';",
    "import { showAlert, showConfirm } from './ui_utils.js';\nimport { collection, getDocs } from \"https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js\";\nimport { roleMasterService } from './role_master_service.js';"
);

// 2. Constants
code = code.replace(
    /const AVAILABLE_ROLES = \[\s+.*?\];/s,
    "let AVAILABLE_ROLES = [];\nlet ALL_USERS = [];"
);

// 3. Config
code = code.replace(
    /let workflowConfig = \{[\s\S]*?\};/,
    `let workflowConfig = {
    pending_approval: { roles: ['President', '社長'], userIds: [] },
    pending_transfer: { roles: ['Accounting', '経理', 'Admin', '管理者'], userIds: [] },
    pending_mf: { roles: ['Accounting', '経理', 'Admin', '管理者'], userIds: [] }
};`
);

// 4. initInvoicesPage
code = code.replace(
    /export async function initInvoicesPage\(\) \{[\s\S]*?loadWorkflows\(\);\n\}/,
    `export async function initInvoicesPage() {
    bindEvents();
    
    // 役職とユーザーリストをロード
    AVAILABLE_ROLES = await roleMasterService.getRoles();
    const usersSnap = await getDocs(collection(db, 'm_users'));
    ALL_USERS = [];
    usersSnap.forEach(d => {
        const u = d.data();
        ALL_USERS.push({ id: d.id, name: \`\${u.LastName || ''} \${u.FirstName || ''}\`.trim() || u.Name || '名称未設定' });
    });

    await loadSettings();
    loadWorkflows();
}`
);

// 5. loadSettings
code = code.replace(
    /async function loadSettings\(\) \{\s+try \{\s+const docSnap = await getDoc\(doc\(db, 'workflow_settings', 'invoice_assignees'\)\);\s+if \(docSnap\.exists\(\)\) \{\s+workflowConfig = docSnap\.data\(\);\s+\}\s+\} catch \(e\) \{/,
    `async function loadSettings() {
    try {
        const docSnap = await getDoc(doc(db, 'workflow_settings', 'invoice_assignees'));
        if (docSnap.exists()) {
            const data = docSnap.data();
            ['pending_approval', 'pending_transfer', 'pending_mf'].forEach(step => {
                if (data[step]) {
                    if (Array.isArray(data[step])) {
                        workflowConfig[step] = { roles: data[step], userIds: [] };
                    } else {
                        workflowConfig[step] = data[step];
                    }
                }
            });
        }
    } catch (e) {`
);

// 6. renderSettingsModal
code = code.replace(
    /const currentRoles = workflowConfig\[step\.key\] \|\| \[\];[\s\S]*?html \+= \`\s+<div class="setting-row">\s+<label>\$\{step\.name\} の担当役職<\/label>\s+<div class="checkbox-group">\s+\$\{checkboxes\}\s+<\/div>\s+<\/div>\s+\`;\s+\}\);/,
    `const config = workflowConfig[step.key] || { roles: [], userIds: [] };
        const currentRoles = config.roles || [];
        const currentUserIds = config.userIds || [];
        
        let checkboxes = AVAILABLE_ROLES.map(r => {
            const isChecked = currentRoles.includes(r.id) || currentRoles.includes(r.label);
            return \`
                <label class="checkbox-item">
                    <input type="checkbox" data-step="\${step.key}" value="\${r.id}" data-label="\${r.label}" \${isChecked ? 'checked' : ''}>
                    \${r.label}
                </label>
            \`;
        }).join('');

        let userOptions = ALL_USERS.map(u => {
            const isSelected = currentUserIds.includes(u.id);
            return \`
                <label class="checkbox-item" style="display:inline-flex; width: 48%; margin-bottom: 0.5rem;">
                    <input type="checkbox" data-step-user="\${step.key}" value="\${u.id}" \${isSelected ? 'checked' : ''}>
                    \${u.name}
                </label>
            \`;
        }).join('');

        html += \`
            <div class="setting-row" style="margin-bottom: 2rem;">
                <label style="font-weight: 800; font-size: 1.1rem; color: #1e293b; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; display: block; margin-bottom: 1rem;">\${step.name}</label>
                <div style="margin-bottom: 1rem;">
                    <div style="font-weight: 700; color: #475569; margin-bottom: 0.5rem;">担当役職（グループ指定）</div>
                    <div class="checkbox-group">
                        \${checkboxes}
                    </div>
                </div>
                <div>
                    <div style="font-weight: 700; color: #475569; margin-bottom: 0.5rem;">特定の担当者（個人指定・オプション）</div>
                    <div class="checkbox-group" style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border); padding: 0.8rem; border-radius: 6px;">
                        \${userOptions}
                    </div>
                </div>
            </div>
        \`;
    });`
);

// 7. bindEvents
code = code.replace(
    /\['pending_approval', 'pending_transfer', 'pending_mf'\]\.forEach\(step => \{\s+const checked = Array\.from\(document\.querySelectorAll\(\`input\[data-step="\$\{step\}"\]:checked\`\)\);\s+const roles = \[\];\s+checked\.forEach\(cb => \{\s+roles\.push\(cb\.value\);\s+if \(cb\.dataset\.label\) roles\.push\(cb\.dataset\.label\);\s+\}\);\s+workflowConfig\[step\] = roles;\s+\}\);/,
    `['pending_approval', 'pending_transfer', 'pending_mf'].forEach(step => {
            const checkedRoles = Array.from(document.querySelectorAll(\`input[data-step="\${step}"]:checked\`));
            const roles = [];
            checkedRoles.forEach(cb => {
                roles.push(cb.value);
                if (cb.dataset.label) roles.push(cb.dataset.label);
            });
            
            const checkedUsers = Array.from(document.querySelectorAll(\`input[data-step-user="\${step}"]:checked\`));
            const userIds = checkedUsers.map(cb => cb.value);
            
            workflowConfig[step] = { roles, userIds };
        });`
);

// 8. isMyTask
code = code.replace(
    /const requiredRoles = workflowConfig\[wf\.status\] \|\| \[\];\s+const hasFallbackRole = requiredRoles\.includes\(user\.Role\) \|\| requiredRoles\.includes\(user\.JobTitle\) \|\| \(\(user\.Role === 'Admin' \|\| user\.Role === '管理者'\) && requiredRoles\.includes\('Admin'\)\);\s+return hasRole \|\| hasUserId \|\| hasFallbackRole;/,
    `const config = workflowConfig[wf.status] || { roles: [], userIds: [] };
    const requiredRoles = Array.isArray(config) ? config : config.roles || [];
    const requiredUserIds = config.userIds || [];
    const hasFallbackRole = requiredRoles.includes(user.Role) || requiredRoles.includes(user.JobTitle) || ((user.Role === 'Admin' || user.Role === '管理者') && requiredRoles.includes('Admin'));
    const hasFallbackUserId = requiredUserIds.includes(user.id);

    return hasRole || hasUserId || hasFallbackRole || hasFallbackUserId;`
);

// 9. Assignees config uses
code = code.replace(
    /\{ roles: workflowConfig\['pending_approval'\] \|\| \[\], userIds: \[\] \}/g,
    "(workflowConfig['pending_approval'] || { roles: [], userIds: [] })"
);
code = code.replace(
    /\{ roles: workflowConfig\['pending_transfer'\] \|\| \[\], userIds: \[\] \}/g,
    "(workflowConfig['pending_transfer'] || { roles: [], userIds: [] })"
);
code = code.replace(
    /\{ roles: workflowConfig\['pending_mf'\] \|\| \[\], userIds: \[\] \}/g,
    "(workflowConfig['pending_mf'] || { roles: [], userIds: [] })"
);


fs.writeFileSync(filePath, code);
console.log("Refactoring complete");
