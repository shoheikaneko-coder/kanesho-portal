import sys

with open('evaluation_mobile.js', 'r', encoding='utf-8') as f:
    content = f.read()

modal_html = """
    <!-- モバイル用 フルスクリーン誤答復習パネル -->
    <div id="mob-quiz-review-panel" style="display: none; position: fixed; inset: 0; background: white; z-index: 100000; flex-direction: column; overflow: hidden; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
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

target = """        <div class="eval-mob-content" id="eval-mob-content-area">"""
if "mob-quiz-review-panel" not in content:
    content = content.replace(target, modal_html + "\n" + target)

with open('evaluation_mobile.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected modal HTML.")
