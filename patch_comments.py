import re

with open('evaluation.js', 'r') as f:
    content = f.read()

# Replace the comment area logic
old_comment_logic = r"""        // コメント入力欄
        let commentAreaHtml = `<div style="display: flex; gap: 0\.5rem; align-items: center; flex-wrap: wrap;">`;
        
        let combinedTooltipHtml = '';
        let hasAnyComment = !!\(item\.self_comment \|\| item\.primary_comment \|\| item\.manager_comment\);
        
        combinedTooltipHtml \+= `<div style="margin-bottom:0\.4rem;"><strong style="color:\$\{item\.self_comment \? '#93c5fd' : '#94a3b8'\};"><i class="fas fa-user"></i> 自己理由:</strong><br><span style="color:\$\{item\.self_comment \? 'white' : '#cbd5e1'\};">\$\{item\.self_comment \|\| '未記入'\}</span></div>`;
        
        if \(hasPrimary\) \{
            combinedTooltipHtml \+= `<div style="margin-bottom:0\.4rem;"><strong style="color:\$\{item\.primary_comment \? '#a7f3d0' : '#94a3b8'\};"><i class="fas fa-user-tie"></i> 1次FB:</strong><br><span style="color:\$\{item\.primary_comment \? 'white' : '#cbd5e1'\};">\$\{item\.primary_comment \|\| '未記入'\}</span></div>`;
        \}
        
        combinedTooltipHtml \+= `<div><strong style="color:\$\{item\.manager_comment \? '#c4b5fd' : '#94a3b8'\};"><i class="fas fa-chess-king"></i> 最終FB:</strong><br><span style="color:\$\{item\.manager_comment \? 'white' : '#cbd5e1'\};">\$\{item\.manager_comment \|\| '未記入'\}</span></div>`;

        // 常に１つの統合された吹き出しアイコンを表示（閲覧モード、または過去のコメント履歴参照用）
        commentAreaHtml \+= `
            <div class="eval-score-cell" style="display:inline-block; cursor: help; margin-right: 0\.5rem;">
                <i class="fas \$\{hasAnyComment \? 'fa-comment-dots' : 'fa-comment'\}" style="color: \$\{hasAnyComment \? '#10b981' : '#cbd5e1'\}; font-size: 1\.3rem;"></i>
                <div class="eval-tooltip">
                    \$\{combinedTooltipHtml\}
                </div>
            </div>
        `;

        // 入力フィールド（権限がある場合のみ追加で表示）
        if \(isSelfMode\) \{
            commentAreaHtml \+= `
                <input type="text" value="\$\{item\.self_comment \|\| ''\}" placeholder="自己理由を記入" 
                       onchange="window\.updateComment\(\$\{idx\}, 'self', this\.value\)" 
                       style="flex: 1; min-width: 150px; padding: 0\.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0\.78rem;">
            `;
        \}
        if \(hasPrimary && canEditPrimary\) \{
            commentAreaHtml \+= `
                <input type="text" value="\$\{item\.primary_comment \|\| ''\}" placeholder="1次FBを記入" 
                       onchange="window\.updateComment\(\$\{idx\}, 'primary', this\.value\)" 
                       style="flex: 1; min-width: 150px; padding: 0\.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0\.78rem;">
            `;
        \}
        if \(canEditSecondary\) \{
            commentAreaHtml \+= `
                <input type="text" value="\$\{item\.manager_comment \|\| ''\}" placeholder="最終FBを記入" 
                       onchange="window\.updateComment\(\$\{idx\}, 'manager', this\.value\)" 
                       style="flex: 1; min-width: 150px; padding: 0\.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0\.78rem;">
            `;
        \}

        commentAreaHtml \+= `</div>`;"""

new_comment_logic = """        // コメント入力欄
        let commentAreaHtml = `<div style="display: flex; gap: 0.5rem; align-items: center; justify-content: center; width: 100%;">`;
        
        let editRole = null;
        if (isSelfMode) editRole = 'self';
        else if (canEditPrimary) editRole = 'primary';
        else if (canEditSecondary) editRole = 'manager';

        const isBlind = status === 'evaluating';
        
        let displaySelfComment = item.self_comment || '未記入';
        let displayPrimaryComment = item.primary_comment || '未記入';
        let displayManagerComment = item.manager_comment || '未記入';

        let mySelfColor = item.self_comment ? 'white' : '#cbd5e1';
        let myPrimaryColor = item.primary_comment ? 'white' : '#cbd5e1';
        let myManagerColor = item.manager_comment ? 'white' : '#cbd5e1';

        if (isBlind) {
            const maskedHtml = '<span style="color:#94a3b8;"><i class="fas fa-lock"></i> 非公開</span>';
            if (editRole !== 'self') { displaySelfComment = maskedHtml; mySelfColor = '#cbd5e1'; }
            if (editRole !== 'primary') { displayPrimaryComment = maskedHtml; myPrimaryColor = '#cbd5e1'; }
            if (editRole !== 'manager') { displayManagerComment = maskedHtml; myManagerColor = '#cbd5e1'; }
        }

        let combinedTooltipHtml = '';
        combinedTooltipHtml += `<div style="margin-bottom:0.4rem;"><strong style="color:${item.self_comment && (!isBlind || editRole === 'self') ? '#93c5fd' : '#94a3b8'};"><i class="fas fa-user"></i> 自己理由:</strong><br><span style="color:${mySelfColor};">${displaySelfComment}</span></div>`;
        
        if (hasPrimary) {
            combinedTooltipHtml += `<div style="margin-bottom:0.4rem;"><strong style="color:${item.primary_comment && (!isBlind || editRole === 'primary') ? '#a7f3d0' : '#94a3b8'};"><i class="fas fa-user-tie"></i> 1次FB:</strong><br><span style="color:${myPrimaryColor};">${displayPrimaryComment}</span></div>`;
        }
        
        combinedTooltipHtml += `<div><strong style="color:${item.manager_comment && (!isBlind || editRole === 'manager') ? '#c4b5fd' : '#94a3b8'};"><i class="fas fa-chess-king"></i> 最終FB:</strong><br><span style="color:${myManagerColor};">${displayManagerComment}</span></div>`;

        if (editRole) {
            let myCommentText = '';
            if (editRole === 'self') myCommentText = item.self_comment;
            else if (editRole === 'primary') myCommentText = item.primary_comment;
            else if (editRole === 'manager') myCommentText = item.manager_comment;
            
            const hasMyComment = !!(myCommentText && myCommentText.trim() !== '');
            const iconColor = hasMyComment ? '#10b981' : '#cbd5e1';
            
            commentAreaHtml += `
                <div class="eval-score-cell" style="display:inline-block; cursor: pointer;" onclick="window.openCommentModal(${idx}, '${editRole}')">
                    <i class="fas fa-pen" style="color: ${iconColor}; font-size: 1.2rem; transition: color 0.2s;" onmouseover="this.style.color='#059669'" onmouseout="this.style.color='${iconColor}'"></i>
                    <div class="eval-tooltip">
                        ${combinedTooltipHtml}
                    </div>
                </div>
            `;
        } else {
            const hasAnyComment = !!(item.self_comment || item.primary_comment || item.manager_comment);
            const iconColor = hasAnyComment ? '#3b82f6' : '#cbd5e1';
            
            commentAreaHtml += `
                <div class="eval-score-cell" style="display:inline-block; cursor: help;">
                    <i class="fas ${hasAnyComment ? 'fa-comment-dots' : 'fa-comment'}" style="color: ${iconColor}; font-size: 1.3rem;"></i>
                    <div class="eval-tooltip">
                        ${combinedTooltipHtml}
                    </div>
                </div>
            `;
        }

        commentAreaHtml += `</div>`;"""

new_content = re.sub(old_comment_logic, new_comment_logic, content)

if new_content == content:
    print("Failed to replace comment logic!")
else:
    content = new_content

# Now add window.openCommentModal after window.updateComment
old_update_logic = r"""    window\.updateComment = \(idx, role, val\) => \{
        selectedEvalDetail\.items\[idx\]\[`\$\{role\}_comment`\] = val;
        renderModalBody\(container, mode\); // 再描画
    \};"""

new_update_logic = """    window.updateComment = (idx, role, val) => {
        selectedEvalDetail.items[idx][`${role}_comment`] = val;
        renderModalBody(container, mode); // 再描画
    };

    window.openCommentModal = (idx, role) => {
        const item = selectedEvalDetail.items[idx];
        const currentVal = item[`${role}_comment`] || '';
        
        let roleName = 'フィードバック';
        if (role === 'self') roleName = '自己理由';
        else if (role === 'primary') roleName = '1次フィードバック';
        else if (role === 'manager') roleName = '最終フィードバック';
        
        Swal.fire({
            title: `${roleName}を入力`,
            html: `
                <div style="text-align: left; margin-bottom: 0.8rem;">
                    <div style="font-size: 0.85rem; color: #475569; margin-bottom: 0.4rem;"><strong>評価項目:</strong> ${item.title}</div>
                    <div style="font-size: 0.8rem; color: #64748b; background: #f8fafc; padding: 0.5rem; border-radius: 6px; border: 1px solid #e2e8f0;">${item.description}</div>
                </div>
                <textarea id="swal-input-comment" class="swal2-textarea" placeholder="${roleName}を詳しく入力してください" style="width: 100%; box-sizing: border-box; font-size: 0.9rem; min-height: 120px;">${currentVal}</textarea>
            `,
            showCancelButton: true,
            confirmButtonText: '保存',
            cancelButtonText: 'キャンセル',
            confirmButtonColor: '#7c3aed',
            preConfirm: () => {
                return document.getElementById('swal-input-comment').value;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                window.updateComment(idx, role, result.value);
            }
        });
    };"""

new_content2 = re.sub(old_update_logic, new_update_logic, content)

if new_content2 == content:
    print("Failed to replace update logic!")
else:
    content = new_content2

with open('evaluation.js', 'w') as f:
    f.write(content)

