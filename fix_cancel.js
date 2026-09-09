const fs = require('fs');
let code = fs.readFileSync('evaluation.js', 'utf8');

const cancelCode = `
    // 評価期の開始取消・リセット (ゴミ箱ボタン)
    const btnCancelPeriod = document.getElementById('btn-admin-cancel-period-tab');
    if (btnCancelPeriod) {
        btnCancelPeriod.onclick = () => {
            if (!localPeriodSettings) return;
            const period = localPeriodSettings.active_period;
            showConfirm('評価開始の取り消し', \`現在開始されている「\${period}期」の評価シートおよび通知データをすべて削除して初期状態にリセットしますか？\\n(注意: すでに入力された自己評価データなどがある場合、それらもすべて消去されます。この操作は元に戻せません)\`, async () => {
                const btn = btnCancelPeriod;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 取り消し中...';
                btn.disabled = true;

                try {
                    const batch = writeBatch(db);

                    // 1. 作成された評価ドキュメントの削除
                    activeEvaluations.forEach(ev => {
                        batch.delete(doc(db, "t_evaluations", ev.id));
                    });

                    // 2. 評価期設定ドキュメントの削除
                    batch.delete(doc(db, "settings", "evaluation"));

                    // 3. 関連通知の削除
                    const notifSnap = await getDocs(query(collection(db, "notifications"), where("type", "in", ["evaluation_alert", "evaluation_published"])));
                    notifSnap.forEach(d => {
                        batch.delete(doc(db, "notifications", d.id));
                    });

                    await batch.commit();
                    // Alertの非同期性を考慮してsetTimeoutで少し待ってからリロード
                    showAlert('取り消し完了', \`\${period}期の評価データをリセットし、通知を削除しました。\`);
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } catch(err) {
                    console.error("Failed to cancel evaluation period:", err);
                    showAlert('エラー', '評価期の取り消しに失敗しました。');
                } finally {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            });
        };
    }
`;

if (!code.includes("btnCancelPeriod.onclick = () => {")) {
    code = code.replace(
        "const btnAdminStart = document.getElementById('btn-admin-start-period-tab');",
        cancelCode + "\n    const btnAdminStart = document.getElementById('btn-admin-start-period-tab');"
    );
    fs.writeFileSync('evaluation.js', code);
    console.log("Injected cancel period listener successfully.");
} else {
    console.log("Listener already exists.");
}
