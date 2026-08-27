import sys

with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Performance Optimization & Cache
# Add cache variable at the top
if 'window._masterCacheMobile' not in content:
    content = content.replace(
        'let mobileMyEvaluation = null;',
        'window._masterCacheMobile = { data: null, timestamp: 0 };\nlet mobileMyEvaluation = null;'
    )

# Replace the sequential fetch in loadEvaluationMobile
fetch_old = """        // マスタロード
        let gradeMap = {};
        let routeMap = {};
        try {
            const gradesSnap = await getDocs(collection(db, "m_grades"));
            gradesSnap.forEach(d => {
                const data = d.data();
                if (data.grade_code) gradeMap[data.grade_code] = data;
            });
            const routesSnap = await getDocs(collection(db, "m_evaluation_routes"));
            routesSnap.forEach(d => {
                routeMap[d.id] = d.data();
            });
        } catch(e) { console.error("Failed to load grades or routes for mobile:", e); }"""

fetch_new = """        // マスタロード（キャッシュと並列取得による高速化）
        let gradeMap = {};
        let routeMap = {};
        
        const now = Date.now();
        if (window._masterCacheMobile && window._masterCacheMobile.data && (now - window._masterCacheMobile.timestamp < 5 * 60 * 1000)) {
            gradeMap = window._masterCacheMobile.data.gradeMap;
            routeMap = window._masterCacheMobile.data.routeMap;
        } else {
            try {
                const [gradesSnap, routesSnap] = await Promise.all([
                    getDocs(collection(db, "m_grades")),
                    getDocs(collection(db, "m_evaluation_routes"))
                ]);
                gradesSnap.forEach(d => {
                    const data = d.data();
                    if (data.grade_code) gradeMap[data.grade_code] = data;
                });
                routesSnap.forEach(d => {
                    routeMap[d.id] = d.data();
                });
                
                window._masterCacheMobile = {
                    data: { gradeMap, routeMap },
                    timestamp: now
                };
            } catch(e) { console.error("Failed to load grades or routes for mobile:", e); }
        }"""
content = content.replace(fetch_old, fetch_new)

# 2. Add full screen modal HTML for Quiz Review
modal_html = """
    <!-- モバイル用 フルスクリーン誤答復習パネル -->
    <div id="mob-quiz-review-panel" style="display: none; position: fixed; inset: 0; background: white; z-index: 10000; flex-direction: column; overflow: hidden; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
        <div style="background: #f8fafc; padding: 1rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); flex-shrink: 0;">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #1e293b;"><i class="fas fa-search" style="color: #6366f1; margin-right: 0.5rem;"></i>誤答の復習</h3>
            <button onclick="document.getElementById('mob-quiz-review-panel').style.transform='translateY(100%)'; setTimeout(()=>document.getElementById('mob-quiz-review-panel').style.display='none',300);" style="background: white; border: 1px solid #cbd5e1; width: 36px; height: 36px; border-radius: 50%; font-size: 1.2rem; color: #64748b; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div id="mob-quiz-review-content" style="padding: 1.5rem; overflow-y: auto; flex-grow: 1; background: #fff; padding-bottom: 100px;">
        </div>
        <div style="padding: 1rem; border-top: 1px solid #e2e8f0; background: white; flex-shrink: 0;">
            <button onclick="document.getElementById('mob-quiz-review-panel').style.transform='translateY(100%)'; setTimeout(()=>document.getElementById('mob-quiz-review-panel').style.display='none',300);" style="width: 100%; padding: 1rem; border-radius: 12px; background: #f1f5f9; color: #475569; font-weight: 800; font-size: 1rem; border: none;">シートに戻る</button>
        </div>
    </div>
"""
if 'mob-quiz-review-panel' not in content:
    content = content.replace(
        '<div id="eval-mob-page" class="eval-mob-container animate-fade-in" style="display:none;">',
        '<div id="eval-mob-page" class="eval-mob-container animate-fade-in" style="display:none;">' + modal_html
    )

# 3. Add window.openMobileQuizReviewModal JS function
js_func = """
window.openMobileQuizReviewModal = function(quizDataStr) {
    const qData = JSON.parse(decodeURIComponent(quizDataStr));
    const container = document.getElementById('mob-quiz-review-content');
    container.innerHTML = '';
    
    const wrongs = qData.questions.filter(q => q.user_answer !== q.correct_index);
    if (wrongs.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#10b981; font-weight:800; padding:2rem 0;">全問正解です！<br>復習する項目はありません。</div>';
    } else {
        wrongs.forEach((q, idx) => {
            const isCorrect = q.user_answer === q.correct_index;
            const ansText = q.user_answer !== null && q.user_answer !== undefined ? q.options[q.user_answer] : '未回答';
            const correctText = q.options[q.correct_index];
            
            container.innerHTML += `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.2rem; margin-bottom: 1.5rem; position: relative; overflow: hidden;">
                    <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #ef4444;"></div>
                    <div style="font-size: 0.75rem; color: #ef4444; font-weight: 800; margin-bottom: 0.5rem;"><i class="fas fa-times-circle"></i> 不正解</div>
                    <p style="margin: 0 0 1rem; font-size: 0.95rem; font-weight: 800; color: #1e293b; line-height: 1.5;">${q.question}</p>
                    
                    <div style="background: white; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.8rem; border: 1px solid #fecaca;">
                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; margin-bottom: 0.2rem;">あなたの回答</div>
                        <div style="color: #ef4444; font-weight: 800; font-size: 0.9rem;">${ansText}</div>
                    </div>
                    
                    <div style="background: white; border-radius: 8px; padding: 0.8rem; margin-bottom: 1rem; border: 1px solid #a7f3d0;">
                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; margin-bottom: 0.2rem;">正解</div>
                        <div style="color: #10b981; font-weight: 800; font-size: 0.9rem;">${correctText}</div>
                    </div>
                    
                    ${q.explanation ? `
                        <div style="background: #eff6ff; border-radius: 8px; padding: 1rem; border-left: 3px solid #3b82f6;">
                            <div style="font-size: 0.75rem; color: #2563eb; font-weight: 800; margin-bottom: 0.4rem;"><i class="fas fa-lightbulb"></i> 解説</div>
                            <p style="margin: 0; font-size: 0.85rem; color: #1e3a8a; line-height: 1.6;">${q.explanation}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        });
    }
    
    const panel = document.getElementById('mob-quiz-review-panel');
    panel.style.display = 'flex';
    // Trigger reflow for transition
    void panel.offsetWidth;
    panel.style.transform = 'translateY(0)';
};
"""
if 'window.openMobileQuizReviewModal' not in content:
    content += js_func

with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Steps 1, 2, 3 ok")
