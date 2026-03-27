import { db } from './firebase.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { processFile } from './import-logic.js';

export const csvImportPageHtml = `
    <div class="animate-fade-in">
        <div style="margin-bottom: 2rem;">
            <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                <i class="fas fa-file-import" style="color: var(--primary);"></i>
                CSVデータインポート
            </h2>
            <p style="color: var(--text-secondary); margin-top: 0.5rem;">外部システムのデータを一括取り込みし、マスタや実績を更新します。</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 2rem;">
            <!-- インポート設定 -->
            <div class="glass-panel" style="padding: 2rem;">
                <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-size: 1.1rem;">インポート設定</h3>
                
                <div class="input-group">
                    <label class="field-label">データ種類</label>
                    <select id="import-type" class="form-input">
                        <option value="dinii">出数データ (ダイニー)</option>
                        <option value="attendance" disabled>勤怠データ (準備中)</option>
                    </select>
                </div>

                <div class="input-group">
                    <label class="field-label">対象店舗</label>
                    <select id="import-store" class="form-input">
                        <option value="">店舗を選択してください</option>
                    </select>
                </div>

                <div class="input-group">
                    <label class="field-label">対象年月</label>
                    <input type="month" id="import-month" class="form-input">
                </div>

                <div id="drop-zone" style="margin-top: 2rem; border: 2px dashed var(--border); border-radius: 12px; padding: 3rem 1rem; text-align: center; cursor: pointer; transition: all 0.3s; background: rgba(0,0,0,0.02);">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 2.5rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                    <p style="margin: 0; font-weight: 600;">CSVファイルをドラッグ＆ドロップ</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">またはクリックしてファイルを選択</p>
                    <input type="file" id="file-input" style="display: none;" accept=".csv">
                </div>
            </div>

            <!-- 実行ログ -->
            <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column;">
                <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-size: 1.1rem;">実行ログ</h3>
                <div id="import-log" style="flex: 1; min-height: 300px; background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 8px; font-family: 'Cascadia Code', Consolas, monospace; font-size: 0.85rem; overflow-y: auto;">
                    <div style="color: #6a9955;">> インポートの待機中です...</div>
                </div>
                <div style="margin-top: 1rem; text-align: right;">
                    <button id="btn-clear-log" class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: transparent; color: var(--text-secondary);">ログをクリア</button>
                </div>
            </div>
        </div>
    </div>
`;

export async function initCsvImportPage() {
    const storeSelect = document.getElementById('import-store');
    const monthInput = document.getElementById('import-month');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const logContainer = document.getElementById('import-log');
    const btnClear = document.getElementById('btn-clear-log');

    // 1. 店舗リストの取得
    try {
        const snap = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
        snap.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.data().store_id;
            opt.textContent = d.data().store_name;
            storeSelect.appendChild(opt);
        });
    } catch (e) {
        addLog("店舗リストの取得に失敗しました", 'red');
    }

    // 2. 年月の初期値 (前月)
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    monthInput.value = d.toISOString().substring(0, 7);

    // 3. ドロップゾーン関連
    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; dropZone.style.background = 'rgba(37, 99, 235, 0.05)'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border)'; dropZone.style.background = 'rgba(0,0,0,0.02)'; };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.background = 'rgba(0,0,0,0.02)';
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    };

    btnClear.onclick = () => {
        logContainer.innerHTML = '<div style="color: #6a9955;">> インポートの待機中です...</div>';
    };

    async function handleFile(file) {
        const storeId = storeSelect.value;
        const yearMonth = monthInput.value;

        if (!storeId) {
            alert('対象店舗を選択してください');
            return;
        }
        if (!yearMonth) {
            alert('対象年月を入力してください');
            return;
        }

        if (!confirm(`店舗: ${storeSelect.selectedOptions[0].text}\n年月: ${yearMonth}\n\nこの設定でインポートを実行しますか？`)) {
            return;
        }

        addLog(`--- 処理開始: ${file.name} ---`, '#569cd6');
        
        // window オブジェクト等にマージするためのグローバルな値を一時的にセット (import-logic.js が prompt を回避できるように)
        // 今回は import-logic.js 側を少し修正して、引数で渡せるようにするか、
        // あるいは prompt が出た時にユーザーが答える形にする。
        // もしくは、import-logic.js の processDiniiCSV 等をリファクタリングして
        // 引数を受け取れるようにする。

        try {
            // import-logic.js の processFile は内部で processDiniiCSV を呼ぶ
            // storeId と yearMonth を渡せるように少し修正が必要かもしれない
            // 一旦、グローバル変数に一時保存して processDiniiCSV がそれを使うようにする (簡易的な方法)
            window._import_context = { storeId, yearMonth };
            
            await processFile(file, (msg, color) => {
                addLog(msg, color);
            });
            
            addLog(`--- 処理完了 ---`, '#569cd6');
            delete window._import_context;
        } catch (err) {
            addLog(`エラーが発生しました: ${err.message}`, 'red');
            console.error(err);
        }
    }

    function addLog(msg, color = '#d4d4d4') {
        const div = document.createElement('div');
        div.style.marginBottom = '0.3rem';
        div.style.color = color === 'green' ? '#6a9955' : (color === 'red' ? '#f44747' : (color === 'orange' ? '#ce9178' : color));
        div.textContent = `> ${msg}`;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}
