import re

with open('evaluation_mobile.js', 'r') as f:
    content = f.read()

old_block = r'''            if \(role\) \{
                if \(ev.status === 'open' \|\| ev.status === 'evaluating' \|\| ev.status === 'self_evaluating'\) \{
                    statusText = '本人入力待ち';
                \} else \{
                    statusText = '<span style="color:#ef4444;">評価入力 待ち</span>';
                \}
                actionBtnHtml = `<button class="eval-mob-sub-btn action-mock-btn" data-type="sub-input" data-id="\$\{ev.id\}" data-role="\$\{role\}">入力する</button>`;
            \} else \{
                if \(ev.status === 'open' \|\| ev.status === 'evaluating' \|\| ev.status === 'self_evaluating'\) \{
                    statusText = '本人入力待ち';
                \} else if \(!\['president_pending', 'approved', 'notified'\].includes\(ev.status\)\) \{
                    statusText = '他の評価者 入力待ち';
                \} else \{
                    statusText = '評価完了';
                \}
                actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="\$\{ev.id\}">確認</button>`;
            \}'''

new_block = '''            const isMySub = role === 'primary' ? ev.is_primary_submitted : ev.is_manager_submitted;
            const hasPrimary = !!wf.primary_evaluator;
            
            if (role && !isMySub) {
                // I haven't submitted yet
                if (ev.status === 'open' || ev.status === 'evaluating' || ev.status === 'self_evaluating') {
                    statusText = '本人入力待ち';
                } else {
                    statusText = '<span style="color:#ef4444;">評価入力 待ち</span>';
                }
                actionBtnHtml = `<button class="eval-mob-sub-btn action-mock-btn" data-type="sub-input" data-id="${ev.id}" data-role="${role}">入力する</button>`;
            } else {
                // I have submitted or I don't have a role
                if (!ev.is_self_submitted) {
                    statusText = '本人入力待ち';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">自己評価未入力</button>`;
                } else if (hasPrimary && !ev.is_primary_submitted) {
                    statusText = '1次評価 入力待ち';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">他の評価者が未入力</button>`;
                } else if (ev.status === 'interviewing') {
                    if (role === 'manager') {
                        statusText = '面談待ち';
                        actionBtnHtml = `<button class="eval-mob-sub-btn action-mock-btn" style="background:#059669; color:white; border-color:#059669;" data-type="interview-input" data-id="${ev.id}">面談実施</button>`;
                    } else {
                        statusText = '面談待ち';
                        actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">面談待ち</button>`;
                    }
                } else if (ev.status === 'president_pending') {
                    statusText = '社長確認待ち';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">確認</button>`;
                } else if (ev.status === 'approved' || ev.status === 'notified') {
                    statusText = '評価完了';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">確認</button>`;
                } else {
                    // Fallback
                    statusText = '入力待ち';
                    actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">確認</button>`;
                }
            }'''

content = re.sub(old_block, new_block, content)

with open('evaluation_mobile.js', 'w') as f:
    f.write(content)
