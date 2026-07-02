const fs = require('fs');
let code = fs.readFileSync('evaluation.js', 'utf8');

code = code.replace(
    /window\.viewAdminEvaluationDetail = \(evalId\) => \{[\s\S]*?const evalData = activeEvaluations\.find\(e => e\.id === evalId\);[\s\S]*?if \(evalData\) \{[\s\S]*?openEvaluationDetailModal\(evalData, 'admin'\);[\s\S]*?\}[\s\S]*?\};/,
    `window.viewAdminEvaluationDetail = (evalId) => {
        const evalData = activeEvaluations.find(e => e.id === evalId);
        if (evalData) {
            // Admin用のコンテナがない場合はリストのすぐ下、もしくはeval-main-contentに直接描画するか、既存のモーダルを模倣する
            // 全体管理タブでは、別の詳細画面用のコンテナを用意するか、subordinate-detail-containerを使い回す
            let container = document.getElementById('admin-detail-container');
            if (!container) {
                // admin-list-containerの親(全体管理タブのルート)に作成
                const adminList = document.querySelector('#eval-main-content > div > div');
                if (adminList) {
                    adminList.insertAdjacentHTML('afterend', '<div id="admin-detail-container"></div>');
                    container = document.getElementById('admin-detail-container');
                }
            }
            if (container) {
                const listContainer = container.previousElementSibling;
                if(listContainer) listContainer.style.display = 'none';
                container.style.display = 'block';
                
                // Add a back button wrapper
                container.innerHTML = '<div style="margin-bottom: 1rem;"><button class="btn" onclick="document.getElementById(\\'admin-detail-container\\').style.display=\\'none\\'; document.getElementById(\\'admin-detail-container\\').previousElementSibling.style.display=\\'block\\';" style="background: white; border: 1px solid #cbd5e1; color: #475569; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700;"><i class="fas fa-arrow-left"></i> 一覧へ戻る</button></div><div id="admin-detail-inner"></div>';
                
                renderEvalDetailInline(document.getElementById('admin-detail-inner'), evalData, 'admin');
                window.scrollTo(0, 0);
            }
        }
    };`
);

fs.writeFileSync('evaluation.js', code);
