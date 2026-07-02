import re

with open('evaluation_mobile.js', 'r') as f:
    content = f.read()

old_block = r'''        if \(mobileMyEvaluation\) \{
            const st = mobileMyEvaluation.status;
            if \(st === 'open' \|\| st === 'evaluating'\) \{
                statusText = '自己評価 入力待ち';
                badgeClass = 'badge-active';
                btnHtml = `<button class="eval-mob-btn-primary action-mock-btn" data-type="self-input">自己評価を入力する</button>`;
            \} else if \(st === 'manager_evaluating'\) \{
                statusText = '一次評価中';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            \} else if \(st === 'president_review'\) \{
                statusText = '社長査定中';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            \} else if \(st === 'approved' \|\| st === 'notified'\) \{
                statusText = '確定済';
                badgeClass = 'badge-done';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">結果を確認</button>`;
            \}
        \} else \{
            statusText = '対象外';
        \}'''

new_block = '''        if (mobileMyEvaluation) {
            const st = mobileMyEvaluation.status;
            if (st === 'approved' || st === 'notified') {
                statusText = '確定済';
                badgeClass = 'badge-done';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">結果を確認</button>`;
            } else if (st === 'president_review') {
                statusText = '社長査定中';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            } else if (st === 'interviewing') {
                statusText = '面談待ち';
                badgeClass = 'badge-active';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            } else if (mobileMyEvaluation.is_self_submitted || ['self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(st)) {
                statusText = '提出済';
                badgeClass = 'badge-done';
                btnHtml = `<button class="eval-mob-btn-secondary action-mock-btn" data-type="self-view">入力内容を確認</button>`;
            } else {
                statusText = '自己評価 入力待ち';
                badgeClass = 'badge-active';
                btnHtml = `<button class="eval-mob-btn-primary action-mock-btn" data-type="self-input">自己評価を入力する</button>`;
            }
        } else {
            statusText = '対象外';
        }'''

content = re.sub(old_block, new_block, content)

with open('evaluation_mobile.js', 'w') as f:
    f.write(content)
