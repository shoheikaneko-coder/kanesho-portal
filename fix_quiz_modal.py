import sys

with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content = f.read()

modal_html = """
    <!-- テスト実施用モーダル (Mobile) -->
    <div id="quiz-execution-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999999; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel" style="background: white; width: 100%; max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #8b5cf6; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: white; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-spell-check"></i> <span id="quiz-execution-title">テスト</span>
                </h3>
                <button type="button" onclick="window.closeEvaluationQuiz()" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: white; opacity: 0.8; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="fas fa-times"></i></button>
            </div>
            
            <div style="padding: 1.5rem 1rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;" id="quiz-execution-content">
                <!-- JSで問題を描画 -->
            </div>
            
            <div style="padding: 1rem; border-top: 1px solid var(--border); background: white; display: flex; justify-content: flex-end; align-items: center;">
                <button type="button" class="btn btn-primary" onclick="window.submitEvaluationQuiz()" id="btn-submit-quiz" style="font-weight: 800; padding: 0.8rem 2rem; background: #8b5cf6; border-color: #8b5cf6; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.2); width: 100%;">
                    <i class="fas fa-paper-plane"></i> 回答を提出する
                </button>
            </div>
        </div>
    </div>
"""

# Inject right after eval-mob-input-screen
if 'id="quiz-execution-modal"' not in content:
    target = '<div class="eval-mob-input-screen" id="eval-mob-input-screen" style="display: none;"></div>'
    content = content.replace(target, target + "\n" + modal_html)
    
    with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Modal injected.")
else:
    print("Already exists.")
