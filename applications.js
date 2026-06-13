import { db, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, storage, updateDoc, doc, getDoc, setDoc } from './firebase.js';
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";


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

    </div>
</div>
`;

export async function initAddressChangePage() {

    const form = document.getElementById('address-change-form');
    const btnSubmit = document.getElementById('btn-submit-address');

    // ===== 編集モード（差し戻しの再申請）のデータ流し込み =====
    const editId = window.currentEditApplicationId;
    if (editId) {
        try {
            const docSnap = await getDoc(doc(db, "t_applications", editId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('postal-code').value = data.details['郵便番号'] || '';
                document.getElementById('pref').value = data.details['都道府県'] || '';
                document.getElementById('address-line1').value = data.details['市区町村・番地'] || '';
                document.getElementById('address-line2').value = data.details['建物名'] !== '-' ? data.details['建物名'] : '';
                document.getElementById('move-date').value = data.details['変更日'] || '';
                
                btnSubmit.innerHTML = '<i class="fas fa-pencil-alt" style="margin-right: 0.5rem;"></i> 修正内容で再申請する';
                btnSubmit.style.background = '#ef4444';
                btnSubmit.style.borderColor = '#ef4444';
                
                const titleEl = document.querySelector('#address-change-form').previousElementSibling;
                if(titleEl) {
                    titleEl.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> 住所変更（差し戻しの再申請）';
                }
            }
        } catch(e) {
            console.error("Failed to load edit data", e);
        }
    }

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
            const newDetails = {
                '郵便番号': postal,
                '都道府県': pref,
                '市区町村・番地': line1,
                '建物名': line2 || '-',
                '変更日': moveDate
            };

            if (editId) {
                // 再申請（上書き更新）
                await updateDoc(doc(db, "t_applications", editId), {
                    status: '承認待ち',
                    updatedAt: serverTimestamp(),
                    details: newDetails
                });
                alert("修正内容で再申請を送信しました。");
                window.currentEditApplicationId = null;
                window.navigateTo('my_applications');
            } else {
                // 新規申請
                await addDoc(collection(db, "t_applications"), {
                    type: 'address_change',
                    applicantId: currentUser.id,
                    applicantName: currentUser.Name,
                    status: '承認待ち',
                    createdAt: serverTimestamp(),
                    details: newDetails
                });
                alert("住所変更申請を送信しました。");
                form.reset();
            }
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

            <!-- 共有ボタン -->
            <div style="margin-bottom: 2rem; padding: 1.5rem; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; text-align: center;">
                <p style="margin-top: 0; margin-bottom: 1rem; font-weight: bold; color: #166534; font-size: 0.95rem;">
                    まずは入社予定スタッフへ、必要な情報をヒアリングしましょう
                </p>
                <button type="button" id="btn-share-hearing" class="btn" style="background: #06c755; color: white; border: none; padding: 0.8rem 1.5rem; font-size: 1rem; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <i class="fas fa-comment-dots"></i> LINE等でヒアリング文章を送る
                </button>
            </div>

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

                <!-- 画像アップロード枠 -->
                <div style="margin-top: 1rem; border-top: 1px dashed var(--border); padding-top: 1.5rem;">
                    <h3 style="font-size: 1.05rem; color: var(--text-primary); margin-bottom: 1rem;">添付書類（写真アップロード）</h3>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">スマホ等で撮影した写真をそのまま選択してください。自動で圧縮して安全に送信されます。</p>

                    <div class="grid-2col" style="gap: 1.5rem;">
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">1. 住所のわかる身分証 <span style="color: red;">*</span></label>
                            <input type="file" id="nh-doc-id" accept="image/*" required class="form-input" style="width: 100%; padding: 0.5rem; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; font-size: 0.85rem;">
                        </div>
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">2. 給与振込先の通帳/キャッシュカード <span style="color: red;">*</span></label>
                            <input type="file" id="nh-doc-bank" accept="image/*" required class="form-input" style="width: 100%; padding: 0.5rem; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; font-size: 0.85rem;">
                        </div>
                    </div>

                    <div class="grid-2col" style="gap: 1.5rem; margin-top: 1.5rem; background: #fffbeb; padding: 1rem; border-radius: 8px; border: 1px solid #fcd34d;">
                        <div style="grid-column: span 2;">
                            <p style="font-size: 0.85rem; color: #b45309; font-weight: bold; margin: 0 0 0.5rem 0;">※外国籍スタッフの場合は以下も必ずアップロード</p>
                        </div>
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">3. 在留カード（表）</label>
                            <input type="file" id="nh-doc-residence-front" accept="image/*" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px dashed #cbd5e1; border-radius: 8px; background: white; font-size: 0.85rem;">
                        </div>
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">4. 在留カード（裏）</label>
                            <input type="file" id="nh-doc-residence-back" accept="image/*" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px dashed #cbd5e1; border-radius: 8px; background: white; font-size: 0.85rem;">
                        </div>
                        <div style="grid-column: span 2;">
                            <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">5. 指定書（就労許可の記載がない場合）</label>
                            <input type="file" id="nh-doc-designation" accept="image/*" class="form-input" style="width: 100%; max-width: 300px; padding: 0.5rem; border: 1px dashed #cbd5e1; border-radius: 8px; background: white; font-size: 0.85rem;">
                        </div>
                    </div>
                </div>

                <div style="margin-top: 1rem; border-top: 1px dashed var(--border); padding-top: 1.5rem;">
                    <button type="submit" id="btn-submit-nh" class="btn btn-primary" style="width: 100%; max-width: 300px; padding: 1rem; font-size: 1.1rem; border-radius: 8px; margin: 0 auto; display: block; background: #10b981; border-color: #10b981;">
                        <i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> 申請を送信する
                    </button>
                </div>
            </form>
        </div>

    </div>
</div>
`;

// 画像圧縮ヘルパー（Promise）
async function compressImage(file, maxWidth = 1200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

// ファイルアップロードヘルパー
async function uploadCompressedImage(fileInputId, typeName, applicantName) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        return null;
    }
    const file = fileInput.files[0];
    const dataUrl = await compressImage(file);
    const timestamp = Date.now();
    const safeName = applicantName.replace(/\\s+/g, '_');
    const path = `applications/new_hire/${safeName}_${timestamp}_${typeName}.jpg`;
    const storageRef = ref(storage, path);
    
    await uploadString(storageRef, dataUrl, 'data_url');
    return await getDownloadURL(storageRef);
}

export async function initNewHirePage() {

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

    // ===== 編集モード（差し戻しの再申請）のデータ流し込み =====
    const editId = window.currentEditApplicationId;
    if (editId) {
        try {
            const docSnap = await getDoc(doc(db, "t_applications", editId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('nh-lastname').value = data.details['姓'] || '';
                document.getElementById('nh-firstname').value = data.details['名'] || '';
                
                if (data.details['フリガナ']) {
                    const kanaParts = data.details['フリガナ'].split(' ');
                    document.getElementById('nh-lastkana').value = kanaParts[0] || '';
                    document.getElementById('nh-firstkana').value = kanaParts[1] || '';
                }

                document.getElementById('nh-nickname').value = data.details['ニックネーム'] || '';
                document.getElementById('nh-email').value = data.details['メールアドレス'] || '';
                document.getElementById('nh-phone').value = data.details['電話番号'] || '';
                document.getElementById('nh-login-pw').value = data.details['ログインPW'] || '';
                document.getElementById('nh-clock-pw').value = data.details['打刻PW'] || '1111';
                
                if (data.details['所属予定店舗']) {
                    const storeSelect = document.getElementById('nh-store');
                    // optionが存在するか確認して選択
                    for (let i = 0; i < storeSelect.options.length; i++) {
                        if (storeSelect.options[i].text === data.details['所属予定店舗'] || storeSelect.options[i].value === data.details['所属予定店舗']) {
                            storeSelect.selectedIndex = i;
                            break;
                        }
                    }
                }
                
                document.getElementById('nh-date').value = data.details['入社予定日'] || '';
                document.getElementById('nh-visa-date').value = data.details['VISA期限'] !== '-' ? data.details['VISA期限'] : '';
                document.getElementById('nh-limit-28h').checked = data.details['28時間制限'] === 'あり';
                document.getElementById('nh-notes').value = data.details['備考'] !== '-' ? data.details['備考'] : '';
                
                btnSubmit.innerHTML = '<i class="fas fa-pencil-alt" style="margin-right: 0.5rem;"></i> 修正内容で再申請する';
                btnSubmit.style.background = '#ef4444';
                btnSubmit.style.borderColor = '#ef4444';
                
                const titleEl = document.querySelector('#new-hire-form').previousElementSibling;
                if(titleEl && titleEl.tagName === 'P') {
                    const h2El = titleEl.previousElementSibling;
                    if (h2El) h2El.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> 新規アルバイト入社（差し戻しの再申請）';
                }
            }
        } catch(e) {
            console.error("Failed to load edit data", e);
        }
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
        const nickname = document.getElementById('nh-nickname')?.value || '';
        const visaDate = document.getElementById('nh-visa-date')?.value || '';
        const limit28h = document.getElementById('nh-limit-28h')?.checked ? 'あり' : 'なし';
        const notes = document.getElementById('nh-notes').value;

        const fullName = `${lastName} ${firstName}`;

        if(!confirm(`${fullName} さんの入社申請を送信しますか？`)) return;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中（写真圧縮・アップロード中...）';

        try {
            // 画像の圧縮とアップロード
            const idCardUrl = await uploadCompressedImage('nh-doc-id', 'id_card', fullName);
            const bankCardUrl = await uploadCompressedImage('nh-doc-bank', 'bank_card', fullName);
            const residenceFrontUrl = await uploadCompressedImage('nh-doc-residence-front', 'residence_front', fullName);
            const residenceBackUrl = await uploadCompressedImage('nh-doc-residence-back', 'residence_back', fullName);
            const designationUrl = await uploadCompressedImage('nh-doc-designation', 'designation', fullName);

            const documents = {};
            const uploadTime = new Date().toISOString();
            if (idCardUrl) documents.id_cards = [{ url: idCardUrl, uploaded_at: uploadTime, note: "入社申請時" }];
            if (bankCardUrl) documents.bank_cards = [{ url: bankCardUrl, uploaded_at: uploadTime, note: "入社申請時" }];
            
            // 在留カードは表裏とVISA期限をセットにする
            if (residenceFrontUrl || residenceBackUrl) {
                documents.residence_cards = [{
                    front_url: residenceFrontUrl || "",
                    back_url: residenceBackUrl || "",
                    expire_date: visaDate,
                    uploaded_at: uploadTime,
                    note: "入社申請時"
                }];
            }
            if (designationUrl) documents.designation_certs = [{ url: designationUrl, uploaded_at: uploadTime, note: "入社申請時" }];

            const newDetails = {
                '氏名': fullName,
                'フリガナ': `${lastKana} ${firstKana}`,
                'ニックネーム': nickname,
                '姓': lastName,
                '名': firstName,
                'メールアドレス': email,
                '電話番号': phone,
                'ログインPW': loginPw,
                '打刻PW': clockPw,
                '所属予定店舗': store,
                '入社予定日': date,
                'VISA期限': visaDate || '-',
                '28時間制限': limit28h,
                '備考': notes || '-'
            };

            if (editId) {
                // 編集モードの場合（再申請）
                // ※新しい書類がアップロードされた場合のみ上書き・マージする（簡易対応：既存のドキュメントに新しいものを追加するが、今回は完全上書きとしておく）
                // 既存のdocumentsを保持しつつ、新しく追加されたものだけをマージする処理が必要
                const appSnap = await getDoc(doc(db, "t_applications", editId));
                let mergedDocs = documents;
                if (appSnap.exists() && appSnap.data().documents) {
                    mergedDocs = { ...appSnap.data().documents, ...documents }; // 新しいキーで上書き
                }

                await updateDoc(doc(db, "t_applications", editId), {
                    status: '承認待ち',
                    updatedAt: serverTimestamp(),
                    documents: mergedDocs,
                    details: newDetails
                });
                alert("修正内容で再申請を送信しました。");
                window.currentEditApplicationId = null;
                window.navigateTo('my_applications');

            } else {
                // 新規申請
                await addDoc(collection(db, "t_applications"), {
                    type: 'new_hire',
                    applicantId: currentUser.id,
                    applicantName: currentUser.Name,
                    status: '承認待ち',
                    createdAt: serverTimestamp(),
                    documents: documents,
                    details: newDetails
                });
                alert("入社申請を送信しました。");
                form.reset();
            }
        } catch (err) {
            console.error(err);
            alert("送信に失敗しました: " + err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 0.5rem;"></i> 申請を送信する';
        }
    };

    // ヒアリング文章の共有機能
    const btnShare = document.getElementById('btn-share-hearing');
    if (btnShare) {
        btnShare.addEventListener('click', async () => {
            const storeSelect = document.getElementById('nh-store');
            let storeName = "〇〇";
            if (storeSelect && storeSelect.selectedIndex > 0) {
                storeName = storeSelect.options[storeSelect.selectedIndex].text;
            }

            const textToShare = `【株式会社かね将より入社手続きのお願い】

お疲れ様です！
入社手続きと、シフトシステム等のアカウント発行のため、以下の項目にご回答いただきご返信をお願いします。

■ 基本情報
・氏名（漢字）：
・氏名（フリガナ）：
・シフト表に表示する名前（ニックネーム）：
・電話番号：
・メールアドレス：

■ 給与振込先の口座情報
・銀行名：
・支店名：
・口座種別：普通or当座
・口座番号：
・名義人：

■ 写真で提出してください。
・住所のわかる身分証
・給与振込先の口座番号がわかるキャッシュカードや通帳

■ 外国籍の方のみご回答ください
・VISAの有効期限：
・週28時間制限の有無（はい・いいえ）：

■ 外国籍の方のみ写真で提出してください。
・在留カードの裏・表
・指定書（在留カードに就労許可の記載がない場合）

ご返信いただきましたら、ログイン情報などをお渡しいたします。
これからよろしくお願いします！`;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: '入社手続きのお願い',
                        text: textToShare
                    });
                } catch (err) {
                    console.log('共有がキャンセルされたか、失敗しました:', err);
                }
            } else {
                try {
                    await navigator.clipboard.writeText(textToShare);
                    alert("ヒアリング文章をクリップボードにコピーしました！\\nお使いのLINE等に貼り付けて送信してください。");
                } catch (err) {
                    alert("コピーに失敗しました。端末が対応していない可能性があります。");
                }
            }
        });
    }
}

/* ==========================================
   申請詳細・承認ページ (Application Detail)
   ========================================== */
export const applicationDetailPageHtml = `
<div class="animate-fade-in" style="width: 100%; max-width: 900px; margin: 0 auto; box-sizing: border-box; padding-bottom: 5rem;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
        <button class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); padding: 0.8rem 1.2rem; font-weight: bold;" onclick="window.navigateTo('notifications')">
            <i class="fas fa-arrow-left"></i> 通知一覧へ戻る
        </button>
    </div>

    <div id="application-detail-container" class="glass-panel" style="padding: 3rem; background: white;">
        <div style="text-align: center; padding: 3rem;">
            <i class="fas fa-spinner fa-spin fa-3x" style="color: var(--primary);"></i>
            <p style="margin-top: 1rem; color: var(--text-secondary);">データを読み込んでいます...</p>
        </div>
    </div>
</div>
`;

export async function initApplicationDetailPage() {
    const container = document.getElementById('application-detail-container');
    if (!container) return;

    const appId = window.currentApplicationId;
    if (!appId) {
        container.innerHTML = '<div style="color: red; text-align: center;">申請IDが指定されていません。</div>';
        return;
    }

    try {
        const appRef = doc(db, "t_applications", appId);
        const appSnap = await getDoc(appRef);
        if (!appSnap.exists()) {
            container.innerHTML = '<div style="color: red; text-align: center;">指定された申請データが見つかりません。</div>';
            return;
        }

        const data = appSnap.data();
        const details = data.details || {};
        const docs = data.documents || {};
        const dateStr = data.createdAt ? new Date(data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt.seconds * 1000).toLocaleString('ja-JP') : '日時不明';

        // 添付書類のリンク生成
        let docsHtml = '';
        if (Object.keys(docs).length > 0) {
            docsHtml += '<div style="margin-top: 2rem; padding: 1.5rem; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">';
            docsHtml += '<h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: #334155;"><i class="fas fa-folder-open" style="color: #3b82f6;"></i> 添付書類一覧</h3>';
            docsHtml += '<div style="display: flex; flex-direction: column; gap: 1rem;">';
            
            const createDocBtn = (url, label, icon) => `
                <a href="${url}" target="_blank" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; color: #1e293b; font-weight: bold; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <span><i class="${icon}" style="color: #3b82f6; margin-right: 0.8rem; font-size: 1.2rem;"></i> ${label}</span>
                    <i class="fas fa-external-link-alt" style="color: #94a3b8;"></i>
                </a>
            `;

            if (docs.id_cards && docs.id_cards[0]) docsHtml += createDocBtn(docs.id_cards[0].url, '身分証 (住所確認用)', 'far fa-id-badge');
            if (docs.bank_cards && docs.bank_cards[0]) docsHtml += createDocBtn(docs.bank_cards[0].url, '通帳 / キャッシュカード', 'fas fa-money-check');
            if (docs.residence_cards && docs.residence_cards[0]) {
                const rc = docs.residence_cards[0];
                if (rc.front_url) docsHtml += createDocBtn(rc.front_url, `在留カード (表) <span style="color: #ef4444; font-size: 0.9rem; margin-left: 0.5rem;">[期限: ${rc.expire_date || '未設定'}]</span>`, 'far fa-id-card');
                if (rc.back_url) docsHtml += createDocBtn(rc.back_url, '在留カード (裏)', 'far fa-id-card');
            }
            if (docs.designation_certs && docs.designation_certs[0]) docsHtml += createDocBtn(docs.designation_certs[0].url, '指定書', 'fas fa-file-contract');
            
            docsHtml += '</div></div>';
        }

        // 詳細情報のテーブル生成
        let detailsHtml = '<div style="background: white; border: 1px solid var(--border); border-radius: 12px; overflow: hidden;"><table style="width: 100%; border-collapse: collapse;">';
        Object.entries(details).forEach(([key, val], index) => {
            const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            detailsHtml += `
                <tr style="background: ${bg}; border-bottom: 1px solid var(--border);">
                    <th style="padding: 1.2rem; text-align: left; width: 30%; color: #64748b; font-weight: 600;">${key}</th>
                    <td style="padding: 1.2rem; font-weight: bold; color: #1e293b; font-size: 1.1rem;">${val}</td>
                </tr>
            `;
        });
        detailsHtml += '</table></div>';

        container.innerHTML = `
            <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 1.5rem; margin-bottom: 2rem;">
                <span style="background: #fef08a; color: #854d0e; padding: 0.4rem 1rem; border-radius: 999px; font-size: 0.9rem; font-weight: bold; margin-bottom: 1rem; display: inline-block;">新規アルバイト入社申請</span>
                <h2 style="font-size: 2rem; margin: 0; color: #0f172a;">${details['氏名'] || '名称不明'}</h2>
                <div style="margin-top: 1rem; color: #64748b; font-size: 0.95rem; display: flex; gap: 1.5rem;">
                    <span><i class="fas fa-store"></i> 配属予定店舗: <strong>${details['所属予定店舗'] || '-'}</strong></span>
                    <span><i class="fas fa-user-edit"></i> 申請者: <strong>${data.applicantName || '不明'}</strong></span>
                    <span><i class="far fa-clock"></i> 申請日時: ${dateStr}</span>
                </div>
            </div>

            ${detailsHtml}
            ${docsHtml}

            <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px dashed #cbd5e1;">
                <button class="btn btn-primary" onclick="window.approveNewHireFromDetail('${appId}')" style="width: 100%; padding: 1.5rem; background: #10b981; border-color: #10b981; font-size: 1.25rem; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4);">
                    <i class="fas fa-check-circle" style="margin-right: 0.8rem;"></i> この内容を承認し、従業員マスタに登録する
                </button>
                <p style="text-align: center; color: #94a3b8; font-size: 0.85rem; margin-top: 1rem;">※ 承認後、自動的に通知センターへ戻ります。</p>
            </div>
        `;

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="color: red; text-align: center;">読み込みエラーが発生しました: ${e.message}</div>`;
    }
}

// 承認処理（詳細画面から発火する）
window.approveNewHireFromDetail = async (appId) => {
    if (!confirm("この内容を承認し、従業員マスタに新規登録しますか？\\n※添付された書類も同時にマスタへ結合されます。")) return;

    try {
        const appRef = doc(db, "t_applications", appId);
        const appSnap = await getDoc(appRef);
        if (!appSnap.exists()) throw new Error("申請データが見つかりません");
        const data = appSnap.data();

        // m_users へ登録するデータ構造を作成
        const newUserData = {
            EmployeeCode: "", 
            Name: data.details['氏名'] || "",
            LastName: data.details['姓'] || "",
            FirstName: data.details['名'] || "",
            LastNameKana: data.details['フリガナ'] ? data.details['フリガナ'].split(' ')[0] : "",
            FirstNameKana: data.details['フリガナ'] ? data.details['フリガナ'].split(' ')[1] : "",
            Nickname: data.details['ニックネーム'] || "",
            Email: data.details['メールアドレス'] || "",
            LoginPassword: data.details['ログインPW'] || "",
            ClockInPassword: data.details['打刻PW'] || "",
            Role: "Staff", 
            StoreId: data.details['所属予定店舗'] || "",
            Status: "在職中",
            HireDate: data.details['入社予定日'] || "",
            Notes: data.details['備考'] || "",
            foreign_staff: {
                is_foreign: data.details['VISA期限'] && data.details['VISA期限'] !== '-',
                visa_expiry: data.details['VISA期限'] !== '-' ? data.details['VISA期限'] : "",
                limit_28h: data.details['28時間制限'] === 'あり'
            },
            documents: data.documents || {}, 
            createdAt: serverTimestamp()
        };

        const newUserId = `user_${Date.now()}`;
        await setDoc(doc(db, "m_users", newUserId), newUserData);

        // 申請のステータスを更新
        await updateDoc(appRef, {
            status: "承認済",
            processedAt: serverTimestamp(),
            processedBy: window.appState?.currentUser?.id || "system"
        });

        alert("承認とマスタへの登録が完了しました！");
        window.navigateTo('notifications'); // 自動的に一覧へ戻る

    } catch (e) {
        console.error(e);
        alert("エラーが発生しました: " + e.message);
    }
};

/* ==========================================
   マイ申請 (My Applications)
   ========================================== */
export const myApplicationsPageHtml = `
<div class="animate-fade-in" style="width: 100%; max-width: 900px; margin: 0 auto; box-sizing: border-box; padding-bottom: 5rem;">
    
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
            <h2 style="margin: 0 0 0.5rem 0; color: var(--text-primary); display: flex; align-items: center; gap: 0.8rem;">
                <i class="fas fa-history" style="color: #8b5cf6;"></i> マイ申請
            </h2>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">過去に行ったすべての申請履歴の確認と再申請ができます。</p>
        </div>
        
        <!-- 種別フィルター -->
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-filter" style="color: #94a3b8;"></i>
            <select id="my-apps-type-filter" class="form-input" style="padding: 0.5rem 1rem; border-radius: 999px; border: 1px solid var(--border); outline: none;">
                <option value="all">すべての申請種別</option>
                <option value="address_change">住所変更申請</option>
                <option value="new_hire">新規入社申請</option>
                <option value="attendance_correction_request">勤怠の修正申請</option>
            </select>
        </div>
    </div>

    <!-- タブ -->
    <div style="display: flex; border-bottom: 1px solid var(--border); margin-bottom: 2rem;">
        <button class="my-apps-tab active" data-status="申請中" style="flex: 1; padding: 1rem; border: none; background: none; font-weight: bold; font-size: 1rem; color: #10b981; border-bottom: 3px solid #10b981; cursor: pointer; transition: all 0.2s;">
            申請中
        </button>
        <button class="my-apps-tab" data-status="差戻し" style="flex: 1; padding: 1rem; border: none; background: none; font-weight: bold; font-size: 1rem; color: #64748b; border-bottom: 3px solid transparent; cursor: pointer; transition: all 0.2s;">
            差し戻し (要対応)
        </button>
        <button class="my-apps-tab" data-status="承認済" style="flex: 1; padding: 1rem; border: none; background: none; font-weight: bold; font-size: 1rem; color: #64748b; border-bottom: 3px solid transparent; cursor: pointer; transition: all 0.2s;">
            承認済み
        </button>
    </div>

    <div id="my-apps-container" style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="text-align: center; padding: 3rem;">
            <i class="fas fa-spinner fa-spin fa-2x" style="color: #8b5cf6;"></i>
            <p style="margin-top: 1rem; color: var(--text-secondary);">データを読み込んでいます...</p>
        </div>
    </div>

</div>
<style>
    .my-apps-tab:hover { background: #f8fafc; }
    .my-app-card:hover { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-color: #cbd5e1 !important; }
</style>
`;

export async function initMyApplicationsPage() {
    const container = document.getElementById('my-apps-container');
    const typeFilter = document.getElementById('my-apps-type-filter');
    const tabs = document.querySelectorAll('.my-apps-tab');
    if (!container || !typeFilter) return;

    let currentStatus = '申請中';
    let currentType = 'all';
    let allApplications = [];

    // ステータスのマッピング（DB上の値とタブの値を合わせる）
    // DB: "承認待ち", "承認済", "差戻し"
    const getDbStatusList = (tabStatus) => {
        if (tabStatus === '申請中') return ['承認待ち'];
        if (tabStatus === '承認済') return ['承認済'];
        if (tabStatus === '差戻し') return ['差戻し'];
        return [];
    };

    // タブ切り替えイベント
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.style.color = '#64748b';
                t.style.borderBottomColor = 'transparent';
                t.classList.remove('active');
            });
            tab.style.color = '#10b981';
            tab.style.borderBottomColor = '#10b981';
            tab.classList.add('active');
            
            currentStatus = tab.dataset.status;
            renderList();
        });
    });

    // プルダウン変更イベント
    typeFilter.addEventListener('change', (e) => {
        currentType = e.target.value;
        renderList();
    });

    // データフェッチ
    const fetchApplications = async () => {
        const currentUser = window.appState?.currentUser;
        if (!currentUser) {
            container.innerHTML = '<div style="color: red; text-align: center;">ログイン情報がありません。</div>';
            return;
        }

        try {
            // FirestoreではOR検索や複数inが制限されるため、シンプルに自分の全申請を取ってJS側でフィルタリングする
            const q = query(
                collection(db, "t_applications"),
                where("applicantId", "==", currentUser.id),
                orderBy("createdAt", "desc")
            );
            const snap = await getDocs(q);
            
            allApplications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderList();

        } catch (err) {
            console.error(err);
            if (err.message.includes("index")) {
                 container.innerHTML = \`<div style="color: orange; padding: 1rem; border: 1px solid orange; border-radius: 8px;">データベースのインデックス構築中です。しばらくお待ちください。（\${err.message}）</div>\`;
            } else {
                 container.innerHTML = '<div style="color: red; text-align: center;">データの取得に失敗しました。</div>';
            }
        }
    };

    // 描画ロジック
    const renderList = () => {
        const dbStatuses = getDbStatusList(currentStatus);
        
        let filtered = allApplications.filter(app => dbStatuses.includes(app.status));
        if (currentType !== 'all') {
            filtered = filtered.filter(app => app.type === currentType);
        }

        if (filtered.length === 0) {
            container.innerHTML = \`
                <div style="text-align: center; padding: 4rem 2rem; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
                    <i class="fas fa-folder-open fa-3x" style="color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p style="color: #64748b; margin: 0;">該当する申請データはありません。</p>
                </div>
            \`;
            return;
        }

        const getTypeInfo = (type) => {
            switch(type) {
                case 'address_change': return { label: '住所変更', color: '#3b82f6', bg: '#eff6ff', icon: 'fa-map-marker-alt' };
                case 'new_hire': return { label: '入社申請', color: '#10b981', bg: '#f0fdf4', icon: 'fa-user-plus' };
                case 'attendance_correction_request': return { label: '勤怠修正', color: '#f59e0b', bg: '#fffbeb', icon: 'fa-clock' };
                default: return { label: 'その他', color: '#64748b', bg: '#f8fafc', icon: 'fa-file-alt' };
            }
        };

        let html = '';
        filtered.forEach(app => {
            const dateStr = app.createdAt ? new Date(app.createdAt.toMillis ? app.createdAt.toMillis() : app.createdAt.seconds * 1000).toLocaleString('ja-JP') : '日時不明';
            const typeInfo = getTypeInfo(app.type);
            
            // 申請内容の要約を作成 (最初の2項目程度)
            const details = Object.entries(app.details || {}).slice(0, 2)
                .map(([k, v]) => \`<span style="margin-right: 1rem; color: #475569; font-size: 0.9rem;"><strong>\${k}:</strong> \${v}</span>\`)
                .join('');

            // クリック時の挙動: ステータスが「差戻し」なら編集モード、それ以外なら閲覧モード(ReadOnly)
            const onClickAttr = app.status === '差戻し' 
                ? \`onclick="window.editApplication('\${app.id}', '\${app.type}')"\`
                : \`onclick="window.viewApplicationReadOnly('\${app.id}')"\`;

            const actionLabel = app.status === '差戻し' 
                ? '<span style="color: #ef4444; font-size: 0.85rem; font-weight: bold;"><i class="fas fa-pencil-alt"></i> 修正して再申請</span>'
                : '<span style="color: #94a3b8; font-size: 0.85rem;"><i class="fas fa-chevron-right"></i> 詳細を見る</span>';

            html += \`
                <div class="my-app-card" \${onClickAttr} style="background: white; border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem 1.5rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s;">
                    <div style="display: flex; align-items: center; gap: 1.5rem;">
                        <div style="background: \${typeInfo.bg}; color: \${typeInfo.color}; padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; min-width: 120px; justify-content: center;">
                            <i class="fas \${typeInfo.icon}"></i> \${typeInfo.label}
                        </div>
                        <div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.3rem;"><i class="far fa-clock"></i> 申請日時: \${dateStr}</div>
                            <div>\${details}</div>
                        </div>
                    </div>
                    <div>
                        \${actionLabel}
                    </div>
                </div>
            \`;
        });
        container.innerHTML = html;
    };

    // グローバルに画面遷移関数を露出
    window.viewApplicationReadOnly = (appId) => {
        // スタッフ用閲覧モードのフラグを立てて詳細画面へ遷移
        window.currentApplicationId = appId;
        window.applicationViewMode = 'readonly';
        window.navigateTo('application_detail');
    };

    window.editApplication = (appId, type) => {
        // 差戻しデータの編集モード
        window.currentEditApplicationId = appId;
        if (type === 'address_change') window.navigateTo('address_change');
        if (type === 'new_hire') window.navigateTo('new_hire_application');
        // 他のタイプも必要に応じて追加
    };

    // 初期ロード実行
    await fetchApplications();
}
