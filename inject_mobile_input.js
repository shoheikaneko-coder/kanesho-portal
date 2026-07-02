const fs = require('fs');
let content = fs.readFileSync('evaluation_mobile.js', 'utf8');

// 1. Add mobileEditingEval
content = content.replace(
    "let mobileAllPastHistory = [];",
    "let mobileAllPastHistory = [];\nlet mobileEditingEval = null;"
);

// 2. Add CSS
const cssToAdd = `
        /* Input Screen Styles */
        .eval-mob-input-screen {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: #f8fafc;
            z-index: 1000;
            overflow-y: auto;
            padding-bottom: 100px;
        }
        .eval-mob-input-header {
            position: sticky;
            top: 0;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            padding: 1rem;
            z-index: 1010;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .eval-mob-progress-container {
            background: #e2e8f0;
            height: 6px;
            border-radius: 3px;
            margin-top: 0.5rem;
            width: 100%;
            overflow: hidden;
        }
        .eval-mob-progress-fill {
            background: #2563eb;
            height: 100%;
            width: 0%;
            transition: width 0.3s ease;
        }
        .eval-mob-input-card {
            background: white;
            margin: 1rem;
            border-radius: 16px;
            padding: 1.2rem;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
        }
        .eval-mob-cat-badge {
            display: inline-block;
            background: #e0f2fe;
            color: #0284c7;
            font-size: 0.75rem;
            font-weight: 800;
            padding: 0.3rem 0.6rem;
            border-radius: 99px;
            margin-bottom: 0.8rem;
        }
        .eval-mob-item-title {
            font-size: 1.1rem;
            font-weight: 900;
            color: #0f172a;
            margin-bottom: 0.5rem;
        }
        .eval-mob-item-desc {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 0.8rem;
            border-radius: 8px;
            font-size: 0.85rem;
            color: #475569;
            line-height: 1.5;
            margin-bottom: 1.2rem;
        }
        .eval-mob-rating-group {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1.2rem;
        }
        .eval-mob-rating-btn {
            width: 45px;
            height: 45px;
            border-radius: 50%;
            border: 1px solid #cbd5e1;
            background: white;
            color: #475569;
            font-size: 1.1rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .eval-mob-rating-btn.selected {
            background: #2563eb;
            border-color: #2563eb;
            color: white;
            transform: scale(1.1);
            box-shadow: 0 4px 10px rgba(37,99,235,0.3);
        }
        .eval-mob-comment {
            width: 100%;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 0.8rem;
            font-size: 0.9rem;
            font-family: inherit;
            resize: vertical;
            min-height: 80px;
        }
        .eval-mob-bottom-bar {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 1rem;
            box-shadow: 0 -4px 6px -1px rgba(0,0,0,0.05);
            display: flex;
            gap: 1rem;
            z-index: 1010;
        }
        .eval-mob-btn-save {
            flex: 1;
            background: white;
            border: 1px solid #cbd5e1;
            color: #475569;
            font-weight: 800;
            padding: 0.8rem;
            border-radius: 12px;
        }
        .eval-mob-btn-submit {
            flex: 2;
            background: #2563eb;
            border: none;
            color: white;
            font-weight: 800;
            padding: 0.8rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(37,99,235,0.2);
        }
`;
content = content.replace("/* Utilities */", cssToAdd + "\n        /* Utilities */");

// 3. Add Input Screen Container
content = content.replace(
    '<div class="eval-mob-content" id="eval-mob-content-area">',
    '<div class="eval-mob-input-screen" id="eval-mob-input-screen" style="display: none;"></div>\n        <div class="eval-mob-content" id="eval-mob-content-area">'
);

// 4. Update bindMobileActionButtons
content = content.replace(
    "if (type === 'self-input') msg = '【自己評価入力画面】へ遷移します。\\n（※次回のステップで構築します）';",
    "if (type === 'self-input') return openMobileInputView('self', mobileMyEvaluation);"
);

// 5. Append New Functions
const newFunctions = `
// ==========================================
// Mobile Input View Logic
// ==========================================

function openMobileInputView(mode, evalData) {
    mobileEditingEval = JSON.parse(JSON.stringify(evalData)); // Deep copy for editing
    const inputScreen = document.getElementById('eval-mob-input-screen');
    const contentArea = document.getElementById('eval-mob-content-area');
    const headerArea = document.getElementById('eval-mob-header-wrapper');
    
    inputScreen.innerHTML = generateSelfInputHtml(mode);
    inputScreen.style.display = 'block';
    contentArea.style.display = 'none';
    headerArea.style.display = 'none';
    
    bindMobileInputEvents(mode);
    updateMobileProgress();
    window.scrollTo(0, 0);
}

function closeMobileInputView() {
    const inputScreen = document.getElementById('eval-mob-input-screen');
    const contentArea = document.getElementById('eval-mob-content-area');
    const headerArea = document.getElementById('eval-mob-header-wrapper');
    
    inputScreen.style.display = 'none';
    contentArea.style.display = 'block';
    headerArea.style.display = 'block';
    mobileEditingEval = null;
}

function generateSelfInputHtml(mode) {
    let html = \`
        <div class="eval-mob-input-header">
            <div style="flex:1;">
                <button class="btn" style="background:none; border:none; color:#64748b; font-size:1.2rem; padding:0;" id="btn-mob-input-close"><i class="fas fa-times"></i></button>
            </div>
            <div style="flex:4; text-align:center;">
                <div style="font-weight:900; color:#0f172a;">\${mobilePeriodSettings.active_period} 自己評価入力</div>
                <div style="font-size:0.75rem; color:#64748b;" id="mob-progress-text">0 / 24 項目完了</div>
                <div class="eval-mob-progress-container">
                    <div class="eval-mob-progress-fill" id="mob-progress-fill"></div>
                </div>
            </div>
            <div style="flex:1;"></div>
        </div>
        <div style="padding-top: 1rem;">
    \`;
    
    mobileEditingEval.items.forEach((item, idx) => {
        html += \`
            <div class="eval-mob-input-card" id="mob-card-\${idx}">
                <div class="eval-mob-cat-badge">\${item.category}</div>
                <div class="eval-mob-item-title">\${item.sub_category}</div>
                <div class="eval-mob-item-desc">\${item.content.replace(/\\n/g, '<br>')}</div>
                
                <div class="eval-mob-rating-group" data-idx="\${idx}">
                    \${[1,2,3,4,5].map(score => \`
                        <button class="eval-mob-rating-btn \${item.self_score === score ? 'selected' : ''}" data-score="\${score}">\${score}</button>
                    \`).join('')}
                </div>
                
                <textarea class="eval-mob-comment" id="mob-comment-\${idx}" placeholder="自己評価のコメントを入力（任意）">\${item.self_comment || ''}</textarea>
            </div>
        \`;
    });
    
    html += \`
        </div>
        <div class="eval-mob-bottom-bar">
            <button class="eval-mob-btn-save" id="btn-mob-save-draft">下書き保存</button>
            <button class="eval-mob-btn-submit" id="btn-mob-submit">入力を完了する</button>
        </div>
    \`;
    
    return html;
}

function updateMobileProgress() {
    if (!mobileEditingEval || !mobileEditingEval.items) return;
    const total = mobileEditingEval.items.length;
    const answered = mobileEditingEval.items.filter(it => it.self_score > 0).length;
    
    const textEl = document.getElementById('mob-progress-text');
    const fillEl = document.getElementById('mob-progress-fill');
    
    if (textEl) textEl.textContent = \`\${answered} / \${total} 項目完了\`;
    if (fillEl) fillEl.style.width = \`\${(answered / total) * 100}%\`;
}

function bindMobileInputEvents(mode) {
    document.getElementById('btn-mob-input-close').addEventListener('click', () => {
        if (confirm('保存されていない内容は破棄されます。よろしいですか？')) {
            closeMobileInputView();
        }
    });
    
    // Rating Buttons
    document.querySelectorAll('.eval-mob-rating-group').forEach(group => {
        const idx = parseInt(group.dataset.idx);
        group.querySelectorAll('.eval-mob-rating-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const score = parseInt(e.currentTarget.dataset.score);
                
                // Update UI visually
                group.querySelectorAll('.eval-mob-rating-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                
                // Update state
                mobileEditingEval.items[idx].self_score = score;
                updateMobileProgress();
                
                // Auto-scroll to next card
                const nextCard = document.getElementById(\`mob-card-\${idx + 1}\`);
                if (nextCard) {
                    setTimeout(() => {
                        nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300); // Slight delay for the button animation
                }
            });
        });
    });
    
    // Comments
    mobileEditingEval.items.forEach((item, idx) => {
        const textarea = document.getElementById(\`mob-comment-\${idx}\`);
        if (textarea) {
            textarea.addEventListener('change', (e) => {
                mobileEditingEval.items[idx].self_comment = e.target.value;
            });
        }
    });
    
    // Save Draft
    document.getElementById('btn-mob-save-draft').addEventListener('click', async () => {
        try {
            const btn = document.getElementById('btn-mob-save-draft');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
            
            const docRef = doc(db, "t_evaluations", mobileEditingEval.id);
            await window.firebaseUpdateDoc(docRef, {
                items: mobileEditingEval.items,
                updated_at: new Date().toISOString()
            });
            
            // Sync to local memory
            mobileMyEvaluation.items = mobileEditingEval.items;
            
            btn.innerHTML = originalText;
            btn.disabled = false;
            showAlert('保存完了', '下書きを保存しました。');
        } catch (e) {
            console.error(e);
            showAlert('エラー', '保存に失敗しました。');
            document.getElementById('btn-mob-save-draft').disabled = false;
        }
    });
    
    // Submit
    document.getElementById('btn-mob-submit').addEventListener('click', async () => {
        const incomplete = mobileEditingEval.items.some(it => !it.self_score);
        if (incomplete) {
            return showAlert('入力未完了', 'すべての評価項目の点数を入力してください。');
        }
        
        if (confirm('自己評価を提出します。提出後は変更ができなくなりますが、よろしいですか？')) {
            try {
                const btn = document.getElementById('btn-mob-submit');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';
                btn.disabled = true;
                
                const wf = mobileEditingEval.workflow || {};
                const hasPrimary = !!wf.primary_evaluator;
                const isPrimarySub = mobileEditingEval.is_primary_submitted || false;
                const isManagerSub = mobileEditingEval.is_manager_submitted || false;

                let nextStatus = 'self_submitted';
                if (hasPrimary && !isPrimarySub) {
                    nextStatus = 'self_submitted'; // 1次評価待ち
                } else if (!isManagerSub) {
                    nextStatus = hasPrimary ? 'primary_submitted' : 'self_submitted'; // 最終評価待ち または 上長評価待ち
                } else {
                    nextStatus = 'interviewing'; // 全員提出済み
                }
                
                // Calculate total
                let selfSum = 0;
                mobileEditingEval.items.forEach(it => selfSum += (it.self_score || 0));
                
                const docRef = doc(db, "t_evaluations", mobileEditingEval.id);
                await window.firebaseUpdateDoc(docRef, {
                    items: mobileEditingEval.items,
                    self_total_score: selfSum,
                    status: nextStatus,
                    is_self_submitted: true,
                    updated_at: new Date().toISOString()
                });
                
                // Sync to local memory
                mobileMyEvaluation.status = nextStatus;
                mobileMyEvaluation.is_self_submitted = true;
                mobileMyEvaluation.items = mobileEditingEval.items;
                mobileMyEvaluation.self_total_score = selfSum;
                
                const idx = mobileActiveEvaluations.findIndex(e => e.id === mobileMyEvaluation.id);
                if (idx !== -1) {
                    mobileActiveEvaluations[idx] = JSON.parse(JSON.stringify(mobileMyEvaluation));
                }
                
                showAlert('提出完了', '提出が完了しました。');
                closeMobileInputView();
                renderMobileView(); // Re-render to show updated status
                
            } catch (e) {
                console.error(e);
                showAlert('エラー', '提出に失敗しました。');
                document.getElementById('btn-mob-submit').disabled = false;
            }
        }
    });
}

// Since updateDoc from imported firebase is not globally available, we map it on window during init
window.firebaseUpdateDoc = async (ref, data) => {
    // Actually we need to import updateDoc or use it from the module.
    // wait, we can just import updateDoc at the top.
};
`;

content = content + "\n" + newFunctions;

// Fix updateDoc import
content = content.replace(
    'import { collection, getDocs, getDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";',
    'import { collection, getDocs, getDoc, doc, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";'
);
content = content.replace('window.firebaseUpdateDoc(docRef', 'updateDoc(docRef');
content = content.replace('window.firebaseUpdateDoc(docRef', 'updateDoc(docRef');

fs.writeFileSync('evaluation_mobile.js', content, 'utf8');
console.log('Successfully injected mobile input logic!');
