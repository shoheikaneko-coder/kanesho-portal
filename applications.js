import { db, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from './firebase.js';

/* ==========================================
   共通UI: 申請履歴表示コンポーネント
   ========================================== */
async function loadApplicationHistory(applicationType, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x text-primary"></i><p>履歴を読み込み中...</p></div>';

    const currentUser = window.appState?.currentUser;
    if (!currentUser || !currentUser.id) {
        container.innerHTML = '<p style="color: red;">ユーザー情報が取得できません。再ログインしてください。</p>';
        return;
    }

    try {
        // コンプライアンス要件: 自分自身の申請のみを取得する
        const q = query(
            collection(db, "t_applications"),
            where("applicantId", "==", currentUser.id),
            where("type", "==", applicationType),
            orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        if (snap.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; background: #f8fafc; border-radius: 12px; color: var(--text-secondary);">
                    <i class="fas fa-inbox fa-2x" style="margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>過去の申請履歴はありません。</p>
                </div>
            `;
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';
        snap.forEach(doc => {
            const data = doc.data();
            const dateStr = data.createdAt ? new Date(data.createdAt.toMillis()).toLocaleString('ja-JP') : '日時不明';
            
            let statusBadge = '';
            switch(data.status) {
                case '承認待ち': statusBadge = '<span style="background: #fef08a; color: #854d0e; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: bold;">承認待ち</span>'; break;
                case '承認済': statusBadge = '<span style="background: #bbf7d0; color: #166534; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: bold;">承認済</span>'; break;
                case '差戻し': statusBadge = '<span style="background: #fecaca; color: #991b1b; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: bold;">差戻し</span>'; break;
                default: statusBadge = `<span style="background: #e2e8f0; color: #475569; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: bold;">${data.status}</span>`;
            }

            // 申請内容のプレビュー文字列を生成
            const details = Object.entries(data.details || {})
                .map(([key, val]) => `<span style="display: inline-block; margin-right: 1rem;"><strong>${key}:</strong> ${val}</span>`)
                .join('');

            html += `
                <div style="background: white; border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; display: flex; flex-direction: column; gap: 0.5rem; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 0.85rem; color: var(--text-secondary);"><i class="far fa-clock"></i> 申請日時: ${dateStr}</div>
                        ${statusBadge}
                    </div>
                    <div style="font-size: 0.95rem; color: var(--text-primary); padding-top: 0.5rem; border-top: 1px dashed var(--border);">
                        ${details}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

    } catch (err) {
        console.error("Failed to load application history:", err);
        // Firestoreのインデックス不足エラーのキャッチ
        if (err.message.includes("index")) {
             container.innerHTML = `<div style="color: orange; padding: 1rem; border: 1px solid orange; border-radius: 8px;">データベースのインデックス構築中です。しばらくお待ちください。（${err.message}）</div>`;
        } else {
             container.innerHTML = '<div style="color: red;">履歴の読み込みに失敗しました。</div>';
        }
    }
}


/* ==========================================
   住所変更申請 (Address Change)
   ========================================== */
export const addressChangePageHtml = `
<div class="animate-fade-in" style="width: 100%; max-width: 750px; margin: 0 auto; box-sizing: border-box; overflow-x: hidden;">
    <style>
        #address-change-form * { box-sizing: border-box; }
        .grid-2col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.5rem; }
        #move-date { max-width: 200px !important; }
    </style>
    <div style="display: flex; flex-direction: column; gap: 2rem; box-sizing: border-box; width: 100%;">
        
        <!-- 申請フォーム -->
        <div class="glass-panel" style="padding: 2.5rem;">
            <h2 style="margin-top: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.8rem; color: var(--text-primary);">
                <i class="fas fa-map-marker-alt" style="color: #3b82f6;"></i>
                新しい住所情報の入力
            </h2>
            <form id="address-change-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div class="grid-2col">
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">郵便番号 <span style="color: red;">*</span></label>
                        <input type="text" id="postal-code" required placeholder="例: 123-4567" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">都道府県 <span style="color: red;">*</span></label>
                        <select id="pref" required class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                            <option value="">選択してください</option>
                            <option value="東京都">東京都</option>
                            <option value="神奈川県">神奈川県</option>
                            <option value="千葉県">千葉県</option>
                            <option value="埼玉県">埼玉県</option>
                            <option value="その他">その他（備考欄に記載）</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">市区町村・番地 <span style="color: red;">*</span></label>
                    <input type="text" id="address-line1" required placeholder="例: 渋谷区神南1-2-3" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                </div>

                <div>
                    <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">建物名・部屋番号</label>
                    <input type="text" id="address-line2" placeholder="例: かね将ビル 301号室" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                </div>

                <div>
                    <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">引越し予定日（または変更日） <span style="color: red;">*</span></label>
                    <input type="date" id="move-date" required class="form-input" style="width: 100%; max-width: 300px; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                </div>

                <div style="margin-top: 1rem; border-top: 1px dashed var(--border); padding-top: 1.5rem;">
                    <button type="submit" id="btn-submit-address" class="btn btn-primary" style="width: 100%; max-width: 300px; padding: 1rem; font-size: 1.1rem; border-radius: 8px; margin: 0 auto; display: block;">
                        <i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> 申請を送信する
                    </button>
                </div>
            </form>
        </div>

        <!-- 履歴表示 -->
        <div class="glass-panel" style="padding: 2.5rem; background: rgba(255,255,255,0.6);">
            <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-size: 1.1rem; color: var(--text-secondary);">
                <i class="fas fa-history" style="margin-right: 0.5rem;"></i> 過去の住所変更申請
            </h3>
            <div id="address-history-container"></div>
        </div>

    </div>
</div>
`;

export async function initAddressChangePage() {
    await loadApplicationHistory('address_change', 'address-history-container');

    const form = document.getElementById('address-change-form');
    const btnSubmit = document.getElementById('btn-submit-address');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const currentUser = window.appState?.currentUser;
        if (!currentUser) return alert("ユーザーエラー");

        const postal = document.getElementById('postal-code').value;
        const pref = document.getElementById('pref').value;
        const line1 = document.getElementById('address-line1').value;
        const line2 = document.getElementById('address-line2').value;
        const moveDate = document.getElementById('move-date').value;

        if(!confirm("この内容で住所変更申請を送信しますか？")) return;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

        try {
            await addDoc(collection(db, "t_applications"), {
                type: 'address_change',
                applicantId: currentUser.id,
                applicantName: currentUser.Name,
                status: '承認待ち',
                createdAt: serverTimestamp(),
                details: {
                    '郵便番号': postal,
                    '都道府県': pref,
                    '市区町村・番地': line1,
                    '建物名': line2 || '-',
                    '変更日': moveDate
                }
            });
            alert("住所変更申請を送信しました。");
            form.reset();
            await loadApplicationHistory('address_change', 'address-history-container');
        } catch (err) {
            console.error(err);
            alert("送信に失敗しました: " + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> 申請を送信する';
        }
    };
}


/* ==========================================
   新規アルバイト入社申請 (New Hire)
   ========================================== */
export const newHirePageHtml = `
<div class="animate-fade-in" style="width: 100%; max-width: 750px; margin: 0 auto; box-sizing: border-box; overflow-x: hidden;">
    <style>
        #new-hire-form * { box-sizing: border-box; }
        .grid-2col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.5rem; }
        #nh-clock-pw { max-width: 150px !important; }
        #nh-wage { max-width: 150px !important; }
        #nh-date { max-width: 200px !important; }
    </style>
    <div style="display: flex; flex-direction: column; gap: 2rem; box-sizing: border-box; width: 100%;">
        
        <!-- 申請フォーム -->
        <div class="glass-panel" style="padding: 2.5rem; border-top: 4px solid #10b981;">
            <h2 style="margin-top: 0; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.8rem; color: var(--text-primary);">
                <i class="fas fa-user-plus" style="color: #10b981;"></i>
                新規アルバイト入社申請
            </h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 2rem;">
                店舗に新しく入社するアルバイトスタッフの情報を本部に申請します。承認後、アカウントが発行可能になります。
            </p>

            <form id="new-hire-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <!-- 姓名 -->
                <div class="grid-2col">
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">姓（漢字） <span style="color: red;">*</span></label>
                        <input type="text" id="nh-lastname" required placeholder="例: 山田" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">名（漢字） <span style="color: red;">*</span></label>
                        <input type="text" id="nh-firstname" required placeholder="例: 太郎" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                </div>
                <!-- フリガナ -->
                <div class="grid-2col">
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">姓（フリガナ） <span style="color: red;">*</span></label>
                        <input type="text" id="nh-lastkana" required placeholder="例: ヤマダ" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">名（フリガナ） <span style="color: red;">*</span></label>
                        <input type="text" id="nh-firstkana" required placeholder="例: タロウ" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                </div>
                
                <!-- ニックネーム -->
                <div>
                    <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">シフト表示名 (ニックネーム) <span style="color: red;">*</span></label>
                    <input type="text" id="nh-nickname" required placeholder="例: ヤマダ" class="form-input" style="width: 100%; max-width: 300px; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                </div>

                <div class="grid-2col">
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">メールアドレス (ログインID兼用) <span style="color: red;">*</span></label>
                        <input type="email" id="nh-email" required placeholder="例: example@kaneshow.jp" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">電話番号 <span style="color: red;">*</span></label>
                        <input type="tel" id="nh-phone" required placeholder="例: 090-XXXX-XXXX" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                </div>

                <div class="grid-2col" style="background: #f8fafc; padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border);">
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">ログインパスワード <span style="color: red;">*</span></label>
                        <input type="text" id="nh-login-pw" required readonly placeholder="メールアドレスと同じ" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; background-color: #e2e8f0; cursor: not-allowed; color: #64748b;">
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; margin-bottom: 0;">※デフォルトはメールアドレス</p>
                    </div>
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">打刻パスワード (数字4桁) <span style="color: red;">*</span></label>
                        <input type="text" id="nh-clock-pw" required value="1111" maxlength="4" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-family: monospace; letter-spacing: 0.2em;">
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; margin-bottom: 0;">※デフォルトは 1111</p>
                    </div>
                </div>

                <div class="grid-2col">
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">所属予定店舗 <span style="color: red;">*</span></label>
                        <select id="nh-store" required class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                            <option value="">選択してください</option>
                            <option value="五反田本店">五反田本店</option>
                            <option value="その他の店舗">その他の店舗（備考へ）</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">入社予定日 <span style="color: red;">*</span></label>
                        <input type="date" id="nh-date" required class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    </div>
                </div>

                <!-- 外国人・留学生情報 -->
                <div class="grid-2col" style="background: #fffbeb; padding: 1.5rem; border-radius: 8px; border: 1px solid #fcd34d;">
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">VISA期限 (該当者のみ)</label>
                        <input type="date" id="nh-visa-date" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; margin-bottom: 0;">※外国籍スタッフの場合は必ず入力</p>
                    </div>
                    <div>
                        <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">週28時間制限 (留学生など)</label>
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 0;">
                            <input type="checkbox" id="nh-limit-28h" style="width: 1.2rem; height: 1.2rem; cursor: pointer;">
                            <label for="nh-limit-28h" style="cursor: pointer; font-size: 0.9rem;">制限あり</label>
                        </div>
                    </div>
                </div>

                <div>
                    <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">備考・特記事項</label>
                    <textarea id="nh-notes" rows="3" placeholder="週の希望シフト数や、特記事項があれば記入してください" class="form-input" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; resize: vertical;"></textarea>
                </div>

                <div style="margin-top: 1rem; border-top: 1px dashed var(--border); padding-top: 1.5rem;">
                    <button type="submit" id="btn-submit-nh" class="btn btn-primary" style="width: 100%; max-width: 300px; padding: 1rem; font-size: 1.1rem; border-radius: 8px; margin: 0 auto; display: block; background: #10b981; border-color: #10b981;">
                        <i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> 申請を送信する
                    </button>
                </div>
            </form>
        </div>

        <!-- 履歴表示 -->
        <div class="glass-panel" style="padding: 2.5rem; background: rgba(255,255,255,0.6);">
            <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-size: 1.1rem; color: var(--text-secondary);">
                <i class="fas fa-history" style="margin-right: 0.5rem;"></i> 過去の入社申請
            </h3>
            <div id="nh-history-container"></div>
        </div>

    </div>
</div>
`;

export async function initNewHirePage() {
    await loadApplicationHistory('new_hire', 'nh-history-container');

    const form = document.getElementById('new-hire-form');
    const btnSubmit = document.getElementById('btn-submit-nh');

    // 所属店舗のプルダウンをマスタから動的取得して上書きする（拡張性のため）
    try {
        const storeSnap = await getDocs(collection(db, "m_stores"));
        const storeSelect = document.getElementById('nh-store');
        if (!storeSnap.empty && storeSelect) {
            let options = '<option value="">選択してください</option>';
            storeSnap.forEach(doc => {
                options += `<option value="${doc.id}">${doc.data().store_name || doc.id}</option>`;
            });
            storeSelect.innerHTML = options;
        }
    } catch(e) {
        console.warn("Failed to load stores for dropdown", e);
    }

    // メールアドレス入力時にログインパスワードに自動セット
    const emailInput = document.getElementById('nh-email');
    const loginPwInput = document.getElementById('nh-login-pw');
    if (emailInput && loginPwInput) {
        emailInput.addEventListener('input', () => {
            loginPwInput.value = emailInput.value;
        });
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        const currentUser = window.appState?.currentUser;
        if (!currentUser) return alert("ユーザーエラー");

        const lastName = document.getElementById('nh-lastname').value;
        const firstName = document.getElementById('nh-firstname').value;
        const lastKana = document.getElementById('nh-lastkana').value;
        const firstKana = document.getElementById('nh-firstkana').value;
        const email = document.getElementById('nh-email').value;
        const phone = document.getElementById('nh-phone').value;
        const loginPw = document.getElementById('nh-login-pw').value;
        const clockPw = document.getElementById('nh-clock-pw').value;
        const store = document.getElementById('nh-store').value;
        const date = document.getElementById('nh-date').value;
        const wage = document.getElementById('nh-wage').value;
        const notes = document.getElementById('nh-notes').value;

        const fullName = `${lastName} ${firstName}`;

        if(!confirm(`${fullName} さんの入社申請を送信しますか？`)) return;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

        try {
            await addDoc(collection(db, "t_applications"), {
                type: 'new_hire',
                applicantId: currentUser.id,
                applicantName: currentUser.Name,
                status: '承認待ち',
                createdAt: serverTimestamp(),
                details: {
                    '氏名': fullName,
                    'フリガナ': `${lastKana} ${firstKana}`,
                    '姓': lastName,
                    '名': firstName,
                    'メールアドレス': email,
                    '電話番号': phone,
                    'ログインPW': loginPw,
                    '打刻PW': clockPw,
                    '所属予定店舗': store,
                    '入社予定日': date,
                    '初期時給': wage + '円',
                    '備考': notes || '-'
                }
            });
            alert("入社申請を送信しました。");
            form.reset();
            await loadApplicationHistory('new_hire', 'nh-history-container');
        } catch (err) {
            console.error(err);
            alert("送信に失敗しました: " + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> 申請を送信する';
        }
    };
}
