import { db, collection, getDocs, query, where, updateDoc, doc, writeBatch } from "./firebase.js";

const mappings = [
    { oldId: 'x001', newId: '0000007', name: 'ケシュ' },
    { oldId: 'x002', newId: '0000008', name: 'プラティック' },
    { oldId: 'user_1781339400283', newId: '0000171', name: 'ウインイイソー' }
];

const logArea = document.getElementById('logArea');
const btnDryRun = document.getElementById('btnDryRun');
const btnExecute = document.getElementById('btnExecute');

let targetDocs = [];

function log(msg) {
    console.log(msg);
    logArea.innerHTML += msg + '\n';
    logArea.scrollTop = logArea.scrollHeight;
}

function clearLog() {
    logArea.innerHTML = '';
}

async function runDryRun() {
    clearLog();
    log("=== シミュレーション（ドライラン）開始 ===\n");
    targetDocs = [];
    btnExecute.disabled = true;

    try {
        for (const mapping of mappings) {
            log(`[${mapping.name}] 旧ID: ${mapping.oldId} を検索中...`);
            const q = query(collection(db, 't_attendance'), where('staff_id', '==', mapping.oldId));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                log(`  -> データが0件でした。（既に移行済み、またはデータなし）\n`);
                continue;
            }

            log(`  -> ${snap.size} 件の打刻データが見つかりました！`);
            snap.forEach(d => {
                targetDocs.push({
                    docId: d.id,
                    oldId: mapping.oldId,
                    newId: mapping.newId,
                    name: mapping.name,
                    date: d.data().date,
                    type: d.data().type
                });
            });
            log(`  -> これらのデータを新ID: ${mapping.newId} に移行する予定です。\n`);
        }

        if (targetDocs.length > 0) {
            log(`=== シミュレーション完了 ===`);
            log(`合計 ${targetDocs.length} 件のデータが移行対象として検出されました。`);
            log(`問題なければ、下の「本番移行を実行する」ボタンを押してください。`);
            btnExecute.disabled = false;
        } else {
            log(`=== シミュレーション完了 ===`);
            log(`移行対象のデータはありませんでした。`);
        }
    } catch (e) {
        log(`エラーが発生しました: ${e.message}`);
    }
}

async function executeMigration() {
    if (!confirm(`合計 ${targetDocs.length} 件のデータを本番環境で書き換えます。\n元には戻せませんが、実行してよろしいですか？`)) {
        return;
    }

    clearLog();
    log("=== 本番移行を開始しました ===\n");
    btnDryRun.disabled = true;
    btnExecute.disabled = true;

    try {
        // Firestore batch is limited to 500 operations per batch
        let batch = writeBatch(db);
        let count = 0;
        let totalCount = 0;

        for (const target of targetDocs) {
            const docRef = doc(db, 't_attendance', target.docId);
            batch.update(docRef, { staff_id: target.newId });
            count++;
            totalCount++;

            if (count === 400) {
                await batch.commit();
                log(`... ${totalCount}件完了`);
                batch = writeBatch(db);
                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
        }

        log(`\n=== 本番移行が完了しました！ ===`);
        log(`合計 ${totalCount} 件の打刻データの内部IDを安全に書き換えました。`);
        log(`これでCSV出力やダッシュボードの表示が完全に統合されます。`);
        log(`ダッシュボードに戻り、古い従業員マスタ（x001等）を削除してください。`);

    } catch (e) {
        log(`エラーが発生しました: ${e.message}`);
    } finally {
        btnDryRun.disabled = false;
    }
}

btnDryRun.addEventListener('click', runDryRun);
btnExecute.addEventListener('click', executeMigration);

// 初期ロード時に自動実行
runDryRun();
