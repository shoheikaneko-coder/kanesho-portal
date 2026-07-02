import re

with open('evaluation_mobile.js', 'r') as f:
    content = f.read()

# 1. Add bubble click handler
# Find the end of `mobileEditingEval.items.forEach((item, idx) => { ... });`
# Actually, I can just append the bubble event listener before the `btn-mob-save-draft` event listener.
old_save = r'''    // Save Draft
    document.getElementById\('btn-mob-save-draft'\).addEventListener\('click', async \(\) => \{'''
new_save = '''    // Bubble click (Interview mode)
    document.querySelectorAll('.eval-mob-comment-bubble-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            const item = mobileEditingEval.items[idx];
            let popupHtml = `
                <div id="mob-comment-popup" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem; box-sizing:border-box;">
                    <div style="background:white; border-radius:12px; width:100%; max-width:400px; padding:1.5rem; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                        <button class="btn" style="position:absolute; top:10px; right:10px; background:none; border:none; color:#64748b; font-size:1.2rem; padding:0.5rem;" onclick="document.getElementById('mob-comment-popup').remove()"><i class="fas fa-times"></i></button>
                        <h4 style="margin:0 0 1rem; color:#1e293b; font-size:1.1rem;"><i class="fas fa-comment-dots" style="color:#059669;"></i> コメント一覧</h4>
                        <div style="max-height:60vh; overflow-y:auto; padding-right:0.5rem;">
            `;
            if (item.self_comment) popupHtml += `<div style="margin-bottom:1rem;"><div style="font-size:0.75rem; color:#64748b; font-weight:700; margin-bottom:0.2rem;">本人:</div><div style="background:#f1f5f9; padding:0.8rem; border-radius:8px; font-size:0.9rem; line-height:1.5; color:#334155; white-space:pre-wrap;">${item.self_comment}</div></div>`;
            if (item.primary_comment) popupHtml += `<div style="margin-bottom:1rem;"><div style="font-size:0.75rem; color:#64748b; font-weight:700; margin-bottom:0.2rem;">1次:</div><div style="background:#f1f5f9; padding:0.8rem; border-radius:8px; font-size:0.9rem; line-height:1.5; color:#334155; white-space:pre-wrap;">${item.primary_comment}</div></div>`;
            if (item.manager_comment) popupHtml += `<div style="margin-bottom:1rem;"><div style="font-size:0.75rem; color:#64748b; font-weight:700; margin-bottom:0.2rem;">最終:</div><div style="background:#fef1f2; padding:0.8rem; border-radius:8px; font-size:0.9rem; line-height:1.5; color:#be123c; white-space:pre-wrap;">${item.manager_comment}</div></div>`;
            
            popupHtml += `
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', popupHtml);
        });
    });

    // Save Draft
    document.getElementById('btn-mob-save-draft').addEventListener('click', async () => {'''
content = re.sub(old_save, new_save, content)

# 2. Update Save Draft logic
old_save_logic = r'''            const docRef = doc\(db, "t_evaluations", mobileEditingEval.id\);
            await updateDoc\(docRef, \{
                items: mobileEditingEval.items,
                updated_at: new Date\(\).toISOString\(\)
            \}\);'''
new_save_logic = '''            const docRef = doc(db, "t_evaluations", mobileEditingEval.id);
            const updateData = {
                items: mobileEditingEval.items,
                updated_at: new Date().toISOString()
            };
            
            if (mode === 'interview') {
                const dateEl = document.getElementById('mob-interview-date');
                const notesEl = document.getElementById('mob-interview-notes');
                if (dateEl) {
                    mobileEditingEval.interview_date = dateEl.value;
                    updateData.interview_date = dateEl.value;
                }
                if (notesEl) {
                    mobileEditingEval.interview_notes = notesEl.value;
                    updateData.interview_notes = notesEl.value;
                }
            }
            
            await updateDoc(docRef, updateData);'''
content = re.sub(old_save_logic, new_save_logic, content)

# 3. Update Submit logic
old_submit_start = r'''        let incomplete = false;
        if \(mode === 'primary'\) incomplete = mobileEditingEval.items.some\(it => !it.primary_score\);
        else if \(mode === 'manager'\) incomplete = mobileEditingEval.items.some\(it => !it.manager_score\);
        else incomplete = mobileEditingEval.items.some\(it => !it.self_score\);
        
        if \(incomplete\) \{
            return showAlert\('入力が完了していません', '未入力の評価項目があります。<br>すべての項目に点数をつけてから提出してください。'\);
        \}
        
        let confirmMsg = '評価を提出します。提出後は変更ができなくなりますが、よろしいですか？';
        if \(mode === 'primary'\) confirmMsg = `1次評価を完了として提出しますか？
（全員の評価が完了するまでは面談待ちに進みません）`;
        else if \(mode === 'manager'\) confirmMsg = `最終評価を完了として提出しますか？
（全員の評価が完了するまでは面談待ちに進みません）`;
        else confirmMsg = '自己評価を提出します。提出後は変更ができなくなりますが、よろしいですか？';'''

new_submit_start = '''        let incomplete = false;
        let confirmMsg = '評価を提出します。提出後は変更ができなくなりますが、よろしいですか？';
        
        if (mode === 'interview') {
            const notesEl = document.getElementById('mob-interview-notes');
            const notesValue = notesEl ? notesEl.value : '';
            if (!notesValue.trim()) {
                return showAlert('入力未完了', '面談内容（記録）を記入してください。');
            }
            confirmMsg = '面談記録を提出し、社長確認待ちへ進めます。よろしいですか？';
        } else {
            if (mode === 'primary') incomplete = mobileEditingEval.items.some(it => !it.primary_score);
            else if (mode === 'manager') incomplete = mobileEditingEval.items.some(it => !it.manager_score);
            else incomplete = mobileEditingEval.items.some(it => !it.self_score);
            
            if (incomplete) {
                return showAlert('入力が完了していません', '未入力の評価項目があります。<br>すべての項目に点数をつけてから提出してください。');
            }
            
            if (mode === 'primary') confirmMsg = `1次評価を完了として提出しますか？\\n（全員の評価が完了するまでは面談待ちに進みません）`;
            else if (mode === 'manager') confirmMsg = `最終評価を完了として提出しますか？\\n（全員の評価が完了するまでは面談待ちに進みません）`;
            else confirmMsg = '自己評価を提出します。提出後は変更ができなくなりますが、よろしいですか？';
        }'''
content = re.sub(old_submit_start, new_submit_start, content)

# 4. Collect interview notes on submit
old_submit_status = r'''                // Collect comments before submitting
                mobileEditingEval.items.forEach\(\(it, idx\) => \{'''
new_submit_status = '''                // Collect interview date and notes
                if (mode === 'interview') {
                    const dateEl = document.getElementById('mob-interview-date');
                    const notesEl = document.getElementById('mob-interview-notes');
                    if (dateEl) {
                        updateData.interview_date = dateEl.value;
                        mobileEditingEval.interview_date = dateEl.value;
                    }
                    if (notesEl) {
                        updateData.interview_notes = notesEl.value;
                        mobileEditingEval.interview_notes = notesEl.value;
                    }
                }

                // Collect comments before submitting
                mobileEditingEval.items.forEach((it, idx) => {'''
content = re.sub(old_submit_status, new_submit_status, content)

# 5. Handle status change for interview
old_submit_calc = r'''                if \(mode === 'self'\) \{'''
new_submit_calc = '''                if (mode === 'interview') {
                    nextStatus = 'president_pending';
                } else if (mode === 'self') {'''
content = re.sub(old_submit_calc, new_submit_calc, content)

with open('evaluation_mobile.js', 'w') as f:
    f.write(content)
