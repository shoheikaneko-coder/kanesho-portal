import re

with open('evaluation.js', 'r') as f:
    content = f.read()

# Fix subordinateUsers condition
old_subordinate_condition = """                // 店長の場合は同じ店舗のスタッフ・アルバイト
                return u.StoreID === myStore && (u.Role === 'Staff' || u.Role === 'PartTimer' || u.Role === '一般社員' || u.Role === 'アルバイト');"""

new_subordinate_condition = """                // 店長の場合は同じ店舗のスタッフ・アルバイト・副店長を含める
                if (u.StoreID !== myStore) return false;
                const myJob = user.JobTitle || '';
                const uJob = u.JobTitle || '';
                
                // 自分が店長でない場合、上位役職者は部下として表示しない
                if (myJob !== '店長' && myJob !== '統括店長') {
                    if (uJob === '店長' || uJob === '統括店長') return false;
                }
                if (myJob === '一般社員' || myJob === 'アルバイト' || myJob === '社員') {
                    if (uJob === '店長' || uJob === '統括店長' || uJob === '副店長') return false;
                }
                
                return true;"""

content = content.replace(old_subordinate_condition, new_subordinate_condition)

# Fix section grouping logic in renderSubordinatesTab
old_grouping = """        if (evalData.status === 'evaluating') {
            let amISubmitted = false;
            if (isPrimary) amISubmitted = evalData.is_primary_submitted;
            else if (isSecondary) amISubmitted = evalData.is_manager_submitted;
            
            if (!amISubmitted || role === 'Admin') {
                sectionA.push(u);
            } else {
                sectionB.push(u);
            }
        }"""

new_grouping = """        if (evalData.status === 'evaluating') {
            const isEvaluator = isPrimary || isSecondary;
            if (isEvaluator || role === 'Admin') {
                let amISubmitted = false;
                if (isPrimary && isSecondary) {
                    amISubmitted = evalData.is_primary_submitted && evalData.is_manager_submitted;
                } else if (isPrimary) {
                    amISubmitted = evalData.is_primary_submitted;
                } else if (isSecondary) {
                    amISubmitted = evalData.is_manager_submitted;
                }
                
                if (!amISubmitted || role === 'Admin') {
                    sectionA.push(u);
                } else {
                    sectionB.push(u);
                }
            } else {
                // 自分が評価者ではない場合は「他者の入力待ち」セクション（閲覧用）に回す
                sectionB.push(u);
            }
        }"""

content = content.replace(old_grouping, new_grouping)

# Also update the action button in renderSubordinatesTab just in case!
old_action_btn = """            if (status === 'evaluating') {
                let amISubmitted = false;
                if (isPrimary) amISubmitted = evalData.is_primary_submitted;
                else if (isSecondary) amISubmitted = evalData.is_manager_submitted;
                
                if (!amISubmitted || role === 'Admin') {
                    actionBtn = `<button class="btn btn-primary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#7c3aed; border-color:#7c3aed; padding: 0.4rem 0.8rem;">評価を入力</button>`;
                } else {
                    actionBtn = `<button class="btn btn-secondary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-check"></i> 入力済（他者待ち）</button>`;
                }
            }"""

new_action_btn = """            if (status === 'evaluating') {
                const isEvaluator = isPrimary || isSecondary;
                if (isEvaluator || role === 'Admin') {
                    let amISubmitted = false;
                    if (isPrimary && isSecondary) {
                        amISubmitted = evalData.is_primary_submitted && evalData.is_manager_submitted;
                    } else if (isPrimary) {
                        amISubmitted = evalData.is_primary_submitted;
                    } else if (isSecondary) {
                        amISubmitted = evalData.is_manager_submitted;
                    }
                    
                    if (!amISubmitted || role === 'Admin') {
                        actionBtn = `<button class="btn btn-primary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#7c3aed; border-color:#7c3aed; padding: 0.4rem 0.8rem;">評価を入力</button>`;
                    } else {
                        actionBtn = `<button class="btn btn-secondary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-check"></i> 入力済（他者待ち）</button>`;
                    }
                } else {
                    actionBtn = `<button class="btn btn-secondary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>`;
                }
            }"""

content = content.replace(old_action_btn, new_action_btn)

with open('evaluation.js', 'w') as f:
    f.write(content)

