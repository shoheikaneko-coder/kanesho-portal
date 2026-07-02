import re

with open('evaluation_mobile.js', 'r') as f:
    content = f.read()

old_block = r'''                // Calculate total
                let sum = 0;
                
                if \(mode === 'self'\) \{
                    mobileEditingEval.items.forEach\(it => sum \+= \(it.self_score \|\| 0\)\);
                    updateData.self_total_score = sum;
                    updateData.is_self_submitted = true;
                    
                    if \(hasPrimary && !isPrimarySub\) nextStatus = 'self_submitted';
                    else if \(!isManagerSub\) nextStatus = hasPrimary \? 'primary_submitted' : 'self_submitted';
                    else nextStatus = 'interviewing';
                \} else if \(mode === 'primary'\) \{
                    mobileEditingEval.items.forEach\(it => sum \+= \(it.primary_score \|\| 0\)\);
                    updateData.primary_total_score = sum;
                    updateData.is_primary_submitted = true;
                    
                    if \(!isSelfSub\) nextStatus = 'primary_evaluating'; // waiting for self
                    else if \(!isManagerSub\) nextStatus = 'primary_submitted';
                    else nextStatus = 'interviewing';
                \} else if \(mode === 'manager'\) \{
                    mobileEditingEval.items.forEach\(it => sum \+= \(it.manager_score \|\| 0\)\);
                    updateData.manager_total_score = sum;
                    updateData.is_manager_submitted = true;
                    
                    if \(!isSelfSub\) nextStatus = 'manager_evaluating';
                    else if \(hasPrimary && !isPrimarySub\) nextStatus = 'manager_evaluating';
                    else nextStatus = 'interviewing';
                \}
                
                updateData.status = nextStatus;
                
                const docRef = doc\(db, "t_evaluations", mobileEditingEval.id\);
                await updateDoc\(docRef, updateData\);
                
                // Sync to local memory
                if \(mode === 'self' && mobileMyEvaluation\) \{
                    mobileMyEvaluation.status = nextStatus;
                    mobileMyEvaluation.is_self_submitted = true;
                    mobileMyEvaluation.items = mobileEditingEval.items;
                    mobileMyEvaluation.self_total_score = sum;
                \}
                
                const idx = mobileActiveEvaluations.findIndex\(e => e.id === mobileEditingEval.id\);
                if \(idx !== -1\) \{
                    mobileActiveEvaluations\[idx\] = \{ ...mobileActiveEvaluations\[idx\], ...updateData \};
                \}
                
                btn.innerHTML = originalText;
                btn.disabled = false;
                
                closeMobileInputView\(\);
                
                // refresh views
                if \(document.getElementById\('mob-tab-self'\).classList.contains\('active'\)\) \{
                    const contentArea = document.getElementById\('eval-mob-content-area'\);
                    if\(contentArea && window.generateSelfModeHtml\) \{
                       contentArea.innerHTML = window.generateSelfModeHtml\(\);
                       bindMobileActionButtons\(contentArea\);
                    \}
                \} else \{
                    const contentArea = document.getElementById\('eval-mob-content-area'\);
                    if\(contentArea && window.generateSubordinatesViewHtml\) \{
                       contentArea.innerHTML = window.generateSubordinatesViewHtml\(\);
                       bindMobileActionButtons\(contentArea\);
                    \}
                \}'''

new_block = '''                // Collect comments before submitting
                mobileEditingEval.items.forEach((it, idx) => {
                    const ta = document.getElementById(`mob-comment-${idx}`);
                    if (ta) {
                        if (mode === 'primary') it.primary_comment = ta.value;
                        else if (mode === 'manager') it.manager_comment = ta.value;
                        else it.self_comment = ta.value;
                    }
                });

                // Calculate total
                let sum = 0;
                
                if (mode === 'self') {
                    mobileEditingEval.items.forEach(it => sum += (it.self_score || 0));
                    updateData.self_total_score = sum;
                    updateData.is_self_submitted = true;
                    
                    if (hasPrimary && !isPrimarySub) nextStatus = 'self_submitted';
                    else if (!isManagerSub) nextStatus = hasPrimary ? 'primary_submitted' : 'self_submitted';
                    else nextStatus = 'interviewing';
                } else if (mode === 'primary') {
                    mobileEditingEval.items.forEach(it => sum += (it.primary_score || 0));
                    updateData.primary_total_score = sum;
                    updateData.is_primary_submitted = true;
                    
                    if (!isSelfSub) nextStatus = 'primary_evaluating'; // waiting for self
                    else if (!isManagerSub) nextStatus = 'primary_submitted';
                    else nextStatus = 'interviewing';
                } else if (mode === 'manager') {
                    mobileEditingEval.items.forEach(it => sum += (it.manager_score || 0));
                    updateData.manager_total_score = sum;
                    updateData.is_manager_submitted = true;
                    
                    if (!isSelfSub) nextStatus = 'manager_evaluating';
                    else if (hasPrimary && !isPrimarySub) nextStatus = 'manager_evaluating';
                    else nextStatus = 'interviewing';
                }
                
                updateData.status = nextStatus;
                
                const docRef = doc(db, "t_evaluations", mobileEditingEval.id);
                await updateDoc(docRef, updateData);
                
                // Sync to local memory
                if (mode === 'self' && mobileMyEvaluation) {
                    mobileMyEvaluation.status = nextStatus;
                    mobileMyEvaluation.is_self_submitted = true;
                    mobileMyEvaluation.items = mobileEditingEval.items;
                    mobileMyEvaluation.self_total_score = sum;
                }
                
                const idx = mobileActiveEvaluations.findIndex(e => e.id === mobileEditingEval.id);
                if (idx !== -1) {
                    mobileActiveEvaluations[idx] = { ...mobileActiveEvaluations[idx], ...updateData };
                }
                
                btn.innerHTML = originalText;
                btn.disabled = false;
                
                closeMobileInputView();
                
                // refresh views
                if (mobileActiveTab === 'self') {
                    const contentArea = document.getElementById('eval-mob-content-area');
                    if (contentArea && typeof generateSelfModeHtml === 'function') {
                       contentArea.innerHTML = generateSelfModeHtml();
                       bindMobileActionButtons(contentArea);
                    }
                } else {
                    const contentArea = document.getElementById('eval-mob-content-area');
                    if (contentArea && typeof generateSubordinatesViewHtml === 'function') {
                       contentArea.innerHTML = generateSubordinatesViewHtml();
                       bindMobileActionButtons(contentArea);
                    }
                }'''

content = re.sub(old_block, new_block, content)

with open('evaluation_mobile.js', 'w') as f:
    f.write(content)
