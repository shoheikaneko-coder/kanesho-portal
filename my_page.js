import { db } from './firebase.js';
import { collection, getDocs, getDoc, doc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert } from './ui_utils.js';

let myPastEvaluations = [];  // 過去の自分の確定評価データリスト
let myGradeConfig = null;    // 現在等級のマスタ設定
let activeChartInstance = null; // Chart.jsのインスタンス保持用

export const myPageHtml = `
    <div id="mypage-page-container" class="animate-fade-in" style="padding: 1rem 1.5rem; max-width: 1200px; margin: 0 auto; box-sizing: border-box; font-family: inherit;">
        
        <!-- マイページトップ情報 -->
        <div class="glass-panel" style="padding: 2rem; background: white; border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.02); margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                <div id="mypage-avatar" style="width: 72px; height: 72px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; font-weight: 800; box-shadow: 0 8px 16px rgba(59, 130, 246, 0.2);">
                    U
                </div>
                <div>
                    <h2 id="mypage-user-name" style="margin: 0; font-size: 1.6rem; font-weight: 900; color: #1e293b;">---</h2>
                    <p id="mypage-user-meta" style="margin: 0.3rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">所属性 | 等級</p>
                </div>
            </div>
            
            <!-- キャリアサマリー -->
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                <div class="glass-panel" style="padding: 0.8rem 1.5rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; text-align: center; min-width: 110px;">
                    <div style="font-size: 0.75rem; color: #1e40af; font-weight: 700;">現在の等級</div>
                    <div id="mypage-card-grade" style="font-size: 1.6rem; font-weight: 900; color: #1e3a8a; font-family: monospace; margin-top: 0.2rem;">-</div>
                </div>
                <div class="glass-panel" style="padding: 0.8rem 1.5rem; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; text-align: center; min-width: 110px;">
                    <div style="font-size: 0.75rem; color: #065f46; font-weight: 700;">役職</div>
                    <div id="mypage-card-title" style="font-size: 1.3rem; font-weight: 800; color: #047857; margin-top: 0.25rem;">-</div>
                </div>
            </div>
        </div>

        <!-- 2カラムスプリット -->
        <div style="display: grid; grid-template-columns: 1fr 380px; gap: 1.5rem; align-items: start;">
            
            <!-- 左カラム: 等級・評価履歴、推移グラフ -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- 過去の評価履歴リスト -->
                <div class="glass-panel" style="padding: 1.5rem; background: white; border: 1px solid var(--border); border-radius: 16px;">
                    <h3 style="margin-top: 0; margin-bottom: 1.2rem; font-size: 1.05rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <i class="fas fa-history" style="color: #64748b;"></i>
                        過去の人事評価シート履歴
                    </h3>
                    <div id="mypage-eval-history-container" style="display: flex; flex-direction: column; gap: 0.8rem;">
                        <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                            履歴をロードしています...
                        </div>
                    </div>
                </div>

            </div>

            <!-- 右カラム: 個人情報と各種変更申請プレースホルダー -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- 登録情報カード -->
                <div class="glass-panel" style="padding: 1.5rem; background: white; border: 1px solid var(--border); border-radius: 16px;">
                    <h3 style="margin-top: 0; margin-bottom: 1.2rem; font-size: 1.05rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <i class="fas fa-id-card" style="color: #10b981;"></i>
                        ご登録情報
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 0.8rem; font-size: 0.85rem;">
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-weight: 600;">従業員コード</span>
                            <span id="info-emp-code" style="font-weight: 700; font-family: monospace;">---</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-weight: 600;">メールアドレス</span>
                            <span id="info-email" style="font-weight: 600;">---</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-weight: 600;">所属店舗</span>
                            <span id="info-store" style="font-weight: 700;">---</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">
                            <span style="color: var(--text-secondary); font-weight: 600;">入社日</span>
                            <span id="info-hire-date" style="font-weight: 600;">---</span>
                        </div>
                    </div>
                </div>

                <!-- 変更申請申請エリア (プレースホルダー) -->
                <div class="glass-panel" style="padding: 1.5rem; background: white; border: 1px solid var(--border); border-radius: 16px;">
                    <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.05rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.6rem;">
                        <i class="fas fa-paper-plane" style="color: #8b5cf6;"></i>
                        各種申請手続き (将来拡張)
                    </h3>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1.2rem; line-height: 1.4;">
                        住所変更、連絡先、メールアドレス変更申請などをオンライン上から申請できるようになります。現段階ではモックUIを配置しています。
                    </p>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                        <button class="btn" onclick="window.showMypageRequestModal('email')" style="width: 100%; font-size: 0.82rem; font-weight: 700; background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; padding: 0.7rem;">
                            <i class="fas fa-envelope"></i> メールアドレス変更の申請
                        </button>
                        <button class="btn" onclick="window.showMypageRequestModal('address')" style="width: 100%; font-size: 0.82rem; font-weight: 700; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 0.7rem;">
                            <i class="fas fa-home"></i> 住所変更の申請 (引越し等)
                        </button>
                    </div>
                </div>

            </div>

        </div>

    </div>

    <!-- 申請用ポップアップモーダル (モック) -->
    <div id="mypage-request-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 3000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 12px; max-width: 450px; width: 100%; padding: 1.5rem;">
            <h4 id="mypage-modal-title" style="margin-top: 0; color: #1e293b; font-size: 1.1rem; font-weight: 800;">---</h4>
            <div id="mypage-modal-body" style="margin: 1.2rem 0;">
                <!-- コンテンツ -->
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.6rem; border-top: 1px solid #e2e8f0; padding-top: 1rem; margin-top: 1rem;">
                <button class="btn btn-secondary" onclick="document.getElementById('mypage-request-modal').style.display='none'">キャンセル</button>
                <button class="btn btn-primary" id="btn-submit-mypage-request" style="background: var(--primary);">変更申請を送信</button>
            </div>
        </div>
    </div>

    <!-- 過去の評価シート詳細閲覧モーダル (マイページ専用・読取専用スナップショット表示) -->
    <div id="mypage-eval-detail-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 3000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-xl); width: 100%; max-width: 1000px; height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div>
                    <h3 id="mypage-modal-eval-title" style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b;">過去の評価シート閲覧</h3>
                    <p id="mypage-modal-eval-subtitle" style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">---</p>
                </div>
                <button type="button" onclick="document.getElementById('mypage-eval-detail-modal').style.display='none'" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="mypage-modal-eval-body" style="padding: 2rem; overflow-y: auto; flex: 1; background: #f8fafc;">
                <!-- 動的生成 -->
            </div>
            <div style="padding: 1rem 1.8rem; border-top: 1px solid var(--border); background: white; display: flex; justify-content: flex-end; flex-shrink: 0;">
                <button class="btn btn-secondary" onclick="document.getElementById('mypage-eval-detail-modal').style.display='none'">閉じる</button>
            </div>
        </div>
    </div>
`;

export async function initMyPage() {
    const user = window.appState.currentUser;
    if (!user) return;

    // 1. プロフィール基本情報のバインド
    document.getElementById('mypage-user-name').textContent = user.Name || '従業員';
    document.getElementById('mypage-user-meta').textContent = `${user.Store || '店舗未設定'} | ${user.JobTitle || '一般'}`;
    document.getElementById('mypage-avatar').textContent = (user.Name || 'U').substring(0, 1).toUpperCase();

    document.getElementById('mypage-card-grade').textContent = user.GradeCode || '-';
    document.getElementById('mypage-card-title').textContent = user.JobTitle || '一般';

    document.getElementById('info-emp-code').textContent = user.EmployeeCode || '-';
    document.getElementById('info-email').textContent = user.Email || '-';
    document.getElementById('info-store').textContent = user.Store || '-';
    document.getElementById('info-hire-date').textContent = user.HireDate || '未登録';

    // 2. 過去の評価データのロード
    await fetchPastEvaluations(user.id);
    
    // 3. グラフの描画 (削除済)

    // 4. 申請ボタンモーダルのバインド
    setupMockModalSubmit();
}

// 過去の確定評価（公開・通知済）レコードをロードする
async function fetchPastEvaluations(userId) {
    const container = document.getElementById('mypage-eval-history-container');
    if (!container) return;

    try {
        const q = query(
            collection(db, "t_evaluations"),
            where("user_id", "==", userId)
        );

        const snap = await getDocs(q);
        myPastEvaluations = [];
        snap.forEach(d => {
            const data = { id: d.id, ...d.data() };
            if (data.status === "notified") {
                myPastEvaluations.push(data);
            }
        });
        
        // JS側で降順に並び替え
        myPastEvaluations.sort((a, b) => b.period.localeCompare(a.period));

        container.innerHTML = '';

        if (myPastEvaluations.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-secondary); font-weight: 600;">
                    公開済みの人事評価履歴はまだ登録されていません。
                </div>
            `;
            return;
        }

        myPastEvaluations.forEach((e, idx) => {
            const isLegacy = e.is_legacy_archive ? '<span style="background: #cbd5e1; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 0.4rem;">手入力</span>' : '';
            const score = e.final_total_score || e.manager_total_score || e.self_total_score || '-';
            const grade = e.new_grade || '-';
            const evaluator = e.evaluator_name || '管理者(記録なし)';
            
            const card = document.createElement('div');
            card.className = "action-mock-btn"; // Added for hover effects if any
            card.style.cssText = "display: flex; flex-direction: column; padding: 1.2rem; align-items: stretch; gap: 0.8rem; background: white; border: 1px solid var(--border); border-radius: 12px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: all 0.2s;";
            card.onmouseover = () => { card.style.borderColor = "var(--primary)"; card.style.backgroundColor = "#f8fafc"; };
            card.onmouseout = () => { card.style.borderColor = "var(--border)"; card.style.backgroundColor = "white"; };
            card.onclick = () => window.viewPastEvaluationSnapshot(idx);
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.6rem;">
                    <div style="font-weight: 800; color: #1e293b; font-size: 1.05rem;"><i class="fas fa-clock" style="color:#94a3b8; margin-right:4px;"></i> ${e.period}期 ${isLegacy}</div>
                    <div style="font-family: monospace; font-size: 1.2rem; font-weight: 900; color: #059669;">${grade}</div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">
                        最終評価者: <span style="color:#1e293b;">${evaluator}</span>
                    </div>
                    <div style="font-size: 0.9rem; font-weight: 700; color: #be123c;">
                        <span style="font-size:0.75rem; color:#94a3b8; font-weight:600;">確定点数 </span>${score}点
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // 過去スナップショット詳細表示の紐付け
        window.viewPastEvaluationSnapshot = (idx) => {
            const e = myPastEvaluations[idx];
            if (e) openPastEvaluationSnapshotModal(e);
        };

    } catch (e) {
        console.error("Failed to load past evaluations:", e);
        if (container) container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--danger); font-weight:700;">評価履歴のロードに失敗しました。</div>`;
    }
}

// Chart.jsによる評価推移トレンドグラフの描画
function renderScoreTrendChart() {
    const canvas = document.getElementById('eval-trend-chart');
    if (!canvas) return;

    // グラフ描画前に既存のChartインスタンスがあれば破棄 (二重描画バグの解消)
    if (activeChartInstance) {
        activeChartInstance.destroy();
        activeChartInstance = null;
    }

    // 期間の古い順に並び替え (推移を左から右にする)
    const sortedEvals = [...myPastEvaluations].reverse();

    // 直近4回に切り出す
    const recentEvals = sortedEvals.slice(-4);

    const labels = recentEvals.map(e => `${e.period}\n(${e.is_provisional ? '仮' : '本'})`);
    const selfScores = recentEvals.map(e => e.self_total_score || 0);
    const finalScores = recentEvals.map(e => e.final_total_score || e.manager_total_score || 0);

    const ctx = canvas.getContext('2d');
    
    // データがない場合の表示プレースホルダー
    if (recentEvals.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.font = '14px sans-serif';
        ctx.fillText('確定済みの評価データがありません', canvas.width / 2, canvas.height / 2);
        return;
    }

    activeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '自己評価点',
                    data: selfScores,
                    borderColor: 'rgba(37, 99, 235, 0.4)',
                    backgroundColor: 'rgba(37, 99, 235, 0.05)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointBackgroundColor: '#2563eb',
                    tension: 0.15
                },
                {
                    label: '確定点数',
                    data: finalScores,
                    borderColor: '#be123c',
                    backgroundColor: 'rgba(190, 18, 60, 0.05)',
                    borderWidth: 3,
                    pointBackgroundColor: '#be123c',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.15,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            weight: 'bold'
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 120,
                    ticks: {
                        stepSize: 20
                    },
                    grid: {
                        color: '#f1f5f9'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// 過去の評価シートスナップショットをモーダル表示 (完全読み取り専用)
function openPastEvaluationSnapshotModal(e) {
    const modal = document.getElementById('mypage-eval-detail-modal');
    const titleEl = document.getElementById('mypage-modal-eval-title');
    const subtitleEl = document.getElementById('mypage-modal-eval-subtitle');
    const bodyEl = document.getElementById('mypage-modal-eval-body');

    if (!modal || !bodyEl) return;

    titleEl.textContent = `【過去履歴】${e.period}期 ${e.is_provisional ? '仮評価' : '本評価'}結果シート`;
    subtitleEl.textContent = `評価結果確定時の等級: 等級${e.new_grade} | 評価時の等級: ${e.current_grade} | 前年同期の等級: ${e.yoy_grade}`;

    let itemsHtml = '';
    let currentCategory = '';
    let selfTotal = 0;
    let managerTotal = 0;

    const items = e.items || [];
    items.forEach(item => {
        if (item.category !== currentCategory) {
            currentCategory = item.category;
            itemsHtml += `
                <tr style="background: #eff6ff;">
                    <td colspan="4" style="padding: 0.5rem 1rem; font-weight: 800; color: #1e3a8a; font-size:0.78rem;">
                        <i class="fas fa-folder-open" style="margin-right:0.3rem;"></i>
                        ${currentCategory}
                    </td>
                </tr>
            `;
        }

        selfTotal += item.self_score || 0;
        managerTotal += item.manager_score || 0;

        itemsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0; background: white; font-size: 0.8rem;">
                <td style="padding: 0.8rem; width: 45%;">
                    <div style="font-weight: 700; color: #334155;">${item.title}</div>
                    ${item.description ? `<div style="font-size: 0.7rem; color:#94a3b8; margin-top:0.15rem;">${item.description}</div>` : ''}
                </td>
                <td style="padding: 0.8rem; text-align: center; font-weight: 700; color: #2563eb; width: 90px; background:#f8fafc;">
                    ${item.self_score || '-'}点
                </td>
                <td style="padding: 0.8rem; text-align: center; font-weight: 700; color: #7c3aed; width: 90px; background:#f8fafc;">
                    ${item.manager_score || '-'}点
                </td>
                <td style="padding: 0.8rem; line-height: 1.4;">
                    ${item.self_comment ? `<div style="font-size:0.72rem; color:#64748b;">自己理由: ${item.self_comment}</div>` : ''}
                    ${item.manager_comment ? `<div style="font-size:0.72rem; color:#7c3aed; font-weight:600; margin-top:0.2rem;">上長FB: ${item.manager_comment}</div>` : ''}
                </td>
            </tr>
        `;
    });

    bodyEl.innerHTML = `
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); margin-bottom: 1.5rem;">
            <table class="eval-table" style="font-size: 0.8rem;">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="text-align: left; padding:0.6rem 0.8rem;">評価項目・基準説明</th>
                        <th style="text-align: center; width: 90px; padding:0.6rem 0.8rem;">自己評価</th>
                        <th style="text-align: center; width: 90px; padding:0.6rem 0.8rem;">上長評価</th>
                        <th style="text-align: left; padding:0.6rem 0.8rem;">理由・フィードバックコメント</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid var(--border);">
                        <td style="padding: 0.8rem; text-align: right;">合計点 (120点満点)</td>
                        <td style="padding: 0.8rem; text-align: center; font-size: 1rem; color: #2563eb;">${selfTotal} 点</td>
                        <td style="padding: 0.8rem; text-align: center; font-size: 1rem; color: #7c3aed;">${managerTotal} 点</td>
                        <td style="padding: 0.8rem;">確定スコア: <strong style="color:#be123c; font-size:1rem;">${e.final_total_score || e.manager_total_score || 0} 点</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border);">
                <h5 style="margin: 0 0 0.5rem; color: #7c3aed; font-weight: 800;"><i class="fas fa-comments"></i> 面談記録メモ</h5>
                <p style="margin: 0; font-size: 0.82rem; line-height: 1.5; color: #475569; white-space: pre-wrap;">${e.interview_notes || '（面談メモはありません）'}</p>
                ${e.interview_date ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:0.5rem;"><i class="fas fa-calendar"></i> 面談日: ${e.interview_date}</div>` : ''}
            </div>
            <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border);">
                <h5 style="margin: 0 0 0.5rem; color: #be123c; font-weight: 800;"><i class="fas fa-user-tie"></i> 社長フィードバック・総括コメント</h5>
                <p style="margin: 0; font-size: 0.82rem; line-height: 1.5; color: #475569; white-space: pre-wrap;">${e.president_comment || '（確定コメントはありません）'}</p>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

// 変更申請モーダルの表示（モック）
window.showMypageRequestModal = (type) => {
    const modal = document.getElementById('mypage-request-modal');
    const titleEl = document.getElementById('mypage-modal-title');
    const bodyEl = document.getElementById('mypage-modal-body');

    if (!modal || !bodyEl) return;

    if (type === 'email') {
        titleEl.textContent = 'メールアドレス変更申請 (個人情報)';
        bodyEl.innerHTML = `
            <div class="input-group" style="margin-bottom: 0;">
                <label style="font-weight: 700; color: #475569; font-size:0.85rem; margin-bottom: 0.4rem; display:block;">新メールアドレス</label>
                <input type="email" id="input-new-email" placeholder="example_new@kaneshow.jp" style="width: 100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem; box-sizing:border-box;">
            </div>
            <p style="font-size:0.72rem; color:var(--text-secondary); margin-top:0.5rem;">※ 送信後、管理者にて承認されるとポータルのログインIDが切り替わります。</p>
        `;
    } else if (type === 'address') {
        titleEl.textContent = '住所変更申請 (住民票・通勤費等反映用)';
        bodyEl.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                <div class="input-group" style="margin:0;">
                    <label style="font-weight: 700; color: #475569; font-size:0.82rem; margin-bottom: 0.3rem; display:block;">郵便番号</label>
                    <input type="text" placeholder="例: 123-4567" style="width: 100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem; box-sizing:border-box;">
                </div>
                <div class="input-group" style="margin:0;">
                    <label style="font-weight: 700; color: #475569; font-size:0.82rem; margin-bottom: 0.3rem; display:block;">新しいご住所</label>
                    <input type="text" placeholder="東京都世田谷区◯◯ 1-2-3" style="width: 100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem; box-sizing:border-box;">
                </div>
                <div class="input-group" style="margin:0;">
                    <label style="font-weight: 700; color: #475569; font-size:0.82rem; margin-bottom: 0.3rem; display:block;">アパート・ビル名</label>
                    <input type="text" placeholder="かね将コーポ 201号室" style="width: 100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem; box-sizing:border-box;">
                </div>
            </div>
        `;
    }

    modal.style.display = 'flex';
};

function setupMockModalSubmit() {
    const btnSubmit = document.getElementById('btn-submit-mypage-request');
    if (btnSubmit) {
        btnSubmit.onclick = () => {
            document.getElementById('mypage-request-modal').style.display = 'none';
            showAlert('申請送信完了', '個人情報の変更申請を管理者へ送信しました！承認までしばらくお待ちください。(※本モックアップでは実際のデータ書き換えは行いません)');
        };
    }
}
