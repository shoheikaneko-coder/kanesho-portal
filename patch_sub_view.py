import re

with open('evaluation_mobile.js', 'r') as f:
    content = f.read()

old_block = r'''            if \(ev\.status === 'open' \|\| ev\.status === 'evaluating' \|\| ev\.status === 'self_evaluating'\) \{
                statusText = '本人入力待ち';
                actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="\$\{ev\.id\}">確認</button>`;
            \} else if \(role && !\['president_pending', 'approved', 'notified'\]\.includes\(ev\.status\)\) \{
                statusText = '<span style="color:#ef4444;">評価入力 待ち</span>';
                actionBtnHtml = `<button class="eval-mob-sub-btn action-mock-btn" data-type="sub-input" data-id="\$\{ev\.id\}" data-role="\$\{role\}">入力する</button>`;
            \} else \{
                statusText = '評価完了';
                actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="\$\{ev\.id\}">確認</button>`;
            \}'''

new_block = '''            if (role) {
                if (ev.status === 'open' || ev.status === 'evaluating' || ev.status === 'self_evaluating') {
                    statusText = '本人入力待ち';
                } else {
                    statusText = '<span style="color:#ef4444;">評価入力 待ち</span>';
                }
                actionBtnHtml = `<button class="eval-mob-sub-btn action-mock-btn" data-type="sub-input" data-id="${ev.id}" data-role="${role}">入力する</button>`;
            } else {
                if (ev.status === 'open' || ev.status === 'evaluating' || ev.status === 'self_evaluating') {
                    statusText = '本人入力待ち';
                } else if (!['president_pending', 'approved', 'notified'].includes(ev.status)) {
                    statusText = '他の評価者 入力待ち';
                } else {
                    statusText = '評価完了';
                }
                actionBtnHtml = `<button class="eval-mob-sub-btn done action-mock-btn" data-type="sub-view" data-id="${ev.id}">確認</button>`;
            }'''

content = re.sub(old_block, new_block, content)

with open('evaluation_mobile.js', 'w') as f:
    f.write(content)

