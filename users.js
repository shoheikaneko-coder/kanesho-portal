import { db, storage, arrayUnion } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { showConfirm, showAlert } from './ui_utils.js';

let currentView = 'list';
let editingUserData = null;
let cachedUsers = [];
let currentPage = 1;
const pageSize = 30;
let activeScrollSpyListener = null;

let currentSortColumn = 'EmployeeCode';
let currentSortDirection = 'desc';

export const usersPageHtml = `
    <div id="users-page-container" class="animate-fade-in">
        <!-- Content swapped here -->
    </div>
    <style>
        .badge.parttimer { background: rgba(100, 116, 139, 0.1); color: #64748b; }
        .badge.tablet { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; }
        .badge.staff { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
        .badge.manager { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .badge.admin { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
        .badge.status-active { background: rgba(16, 185, 129, 0.1); color: #059669; }
        .badge.status-resigning { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .badge.status-retired { background: rgba(100, 116, 139, 0.1); color: #64748b; }
        
        .user-nav-link {
            padding: 0.75rem 1rem;
            border-radius: 8px;
            color: var(--text-secondary);
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.6rem;
            cursor: pointer;
            border-left: 3px solid transparent;
        }
        .user-nav-link:hover {
            background: #f1f5f9;
            color: var(--primary);
        }
        .user-nav-link.active {
            background: #eff6ff;
            color: var(--primary);
            font-weight: 800;
            border-left-color: var(--primary);
            border-radius: 0 8px 8px 0;
        }
    </style>

    <!-- ファイル追加モーダル -->
    <div id="file-upload-modal" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 500px; padding: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; color: #1e293b; font-size: 1.25rem;"><i class="fas fa-file-upload"></i> ファイルを追加</h3>
                <button type="button" class="btn" id="btn-close-file-modal" style="background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer; padding: 0;">&times;</button>
            </div>
            
            <div class="input-group">
                <label>書類種別</label>
                <select id="upload-doc-type" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                    <option value="id_cards">身分証 (住所確認用)</option>
                    <option value="bank_cards">通帳 / キャッシュカード</option>
                    <option value="residence_cards">在留カード</option>
                    <option value="designation_certs">指定書</option>
                </select>
            </div>

            <div class="input-group">
                <label>画像ファイル (表面)</label>
                <input type="file" id="upload-doc-file" accept="image/*" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px;">
            </div>

            <div id="upload-doc-extra-fields" style="display: none; background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1.2rem; border: 1px solid #e2e8f0;">
                <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 0.8rem 0; font-weight: bold;"><i class="fas fa-info-circle"></i> 在留カード用の追加情報</p>
                <div class="input-group" style="margin-bottom: 1rem;">
                    <label style="font-size: 0.85rem;">画像ファイル (裏面)</label>
                    <input type="file" id="upload-doc-file-back" accept="image/*" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px;">
                </div>
                <div class="input-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.85rem;">VISA期限</label>
                    <input type="date" id="upload-doc-expire" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
                </div>
            </div>

            <div class="input-group">
                <label>備考 (任意)</label>
                <input type="text" id="upload-doc-note" placeholder="例: 2026年更新分" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px;">
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                <button type="button" class="btn" id="btn-cancel-file-modal" style="flex: 1; padding: 0.8rem; background: white; border: 1px solid var(--border); border-radius: 8px; font-weight: 700; color: #64748b;">キャンセル</button>
                <button type="button" class="btn" id="btn-execute-upload" style="flex: 1; padding: 0.8rem; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: 700;">アップロードを実行</button>
            </div>
        </div>
    </div>
`;

function renderView() {
    // 既存のスクロールスパイリスナーがあればクリーンアップ
    const scrollContainer = document.querySelector('.page-content');
    if (scrollContainer && activeScrollSpyListener) {
        scrollContainer.removeEventListener('scroll', activeScrollSpyListener);
        activeScrollSpyListener = null;
    }

    const container = document.getElementById('users-page-container');
    if (!container) return;

    if (currentView === 'form') {
        renderFormView(container);
    } else {
        renderListView(container);
    }
}

function renderListView(container) {
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-users-cog" style="color: var(--primary);"></i>
                    ユーザー・従業員管理
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem;">スタッフのログイン権限、所属店舗、パスワード設定を管理します</p>
            </div>
            <button class="btn btn-primary" id="btn-add-user" style="padding: 0.8rem 1.5rem; font-weight: 700;">
                <i class="fas fa-plus"></i> 新規ユーザーを追加
            </button>
        </div>
        
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <div style="padding: 1.2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                    <div class="input-group" style="margin-bottom: 0; width: 300px;">
                        <i class="fas fa-search" style="top: 0.8rem;"></i>
                        <input type="text" id="user-search" placeholder="名前やコードで検索..." style="padding-top: 0.6rem; padding-bottom: 0.6rem; border-radius: 20px;">
                    </div>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: var(--text-secondary); font-weight: 600; font-size: 0.9rem;">
                        <input type="checkbox" id="user-include-retired" style="width: 1.2rem; height: 1.2rem; cursor: pointer;">
                        退職者を含める
                    </label>
                </div>
                <div id="users-count" style="color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                    読込中...
                </div>
            </div>

            <div style="overflow-x: auto;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr id="users-table-header" style="background: #10b981; color: white; font-size: 0.85rem; text-transform: uppercase;">
                            <th data-sort="EmployeeCode" style="padding: 0.8rem; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.2); cursor: pointer; user-select: none;">従業員コード <i class="fas fa-sort"></i></th>
                            <th data-sort="Name" style="padding: 0.8rem; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.2); cursor: pointer; user-select: none;">お名前 <i class="fas fa-sort"></i></th>
                            <th data-sort="Store" style="padding: 0.8rem; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.2); cursor: pointer; user-select: none;">所属店舗 <i class="fas fa-sort"></i></th>
                            <th data-sort="EmploymentType" style="padding: 0.8rem; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.2); cursor: pointer; user-select: none;">雇用形態 <i class="fas fa-sort"></i></th>
                            <th data-sort="GradeCode" style="padding: 0.8rem; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.2); cursor: pointer; user-select: none;">等級 <i class="fas fa-sort"></i></th>
                            <th data-sort="Role" style="padding: 0.8rem; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.2); cursor: pointer; user-select: none;">役職 <i class="fas fa-sort"></i></th>
                            <th data-sort="Status" style="padding: 0.8rem; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.2); cursor: pointer; user-select: none;">ステータス <i class="fas fa-sort"></i></th>
                            <th style="padding: 0.8rem; text-align: right; font-weight: 700;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body"></tbody>
                </table>
            </div>
            <div id="user-pagination" style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin: 1.5rem 0; clear: both;">
            </div>
        </div>
    `;

    const btnAdd = document.getElementById('btn-add-user');
    if (btnAdd) {
        btnAdd.onclick = () => {
            editingUserData = null;
            currentView = 'form';
            renderView();
        };
    }

    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        searchInput.oninput = (e) => {
            currentPage = 1;
            renderTable(e.target.value);
        };
    }

    const includeRetiredCheckbox = document.getElementById('user-include-retired');
    if (includeRetiredCheckbox) {
        includeRetiredCheckbox.onchange = () => {
            currentPage = 1;
            renderTable(document.getElementById('user-search')?.value || "");
        };
    }

    const headers = container.querySelectorAll('th[data-sort]');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (currentSortColumn === col) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = col;
                currentSortDirection = 'asc';
            }
            renderTable(document.getElementById('user-search')?.value || "");
        });
    });

    renderTable();
}

function renderFormView(container) {
    const isEdit = !!editingUserData;
    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="max-width: 1000px; margin: 0 auto; padding: 0; overflow: hidden;">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas ${isEdit ? 'fa-user-edit' : 'fa-user-plus'}" style="color: var(--primary);"></i>
                    ${isEdit ? 'ユーザー情報の編集' : '新規ユーザーの登録'}
                </h3>
                <button id="btn-form-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary);">
                    <i class="fas fa-times"></i> キャンセル
                </button>
            </div>
            
            <div style="padding: 2rem; background: #f8fafc;">
                <form id="user-form" style="display: grid; grid-template-columns: 240px 1fr; gap: 2.5rem; align-items: start;">
                    
                    <!-- 左ナビゲーション (Sticky) -->
                    <div style="position: sticky; top: 1.5rem; display: flex; flex-direction: column; gap: 0.4rem; border-right: 1px solid var(--border); padding-right: 1.5rem;">
                        <div class="user-nav-link active" data-target="sec-basic">
                            <i class="fas fa-id-card" style="width: 18px; text-align: center;"></i>基本情報
                        </div>
                        <div class="user-nav-link" data-target="sec-affiliation">
                            <i class="fas fa-briefcase" style="width: 18px; text-align: center;"></i>所属・権限
                        </div>
                        <div class="user-nav-link" data-target="sec-account">
                            <i class="fas fa-key" style="width: 18px; text-align: center;"></i>アカウント情報
                        </div>
                        <div class="user-nav-link" data-target="sec-visa">
                            <i class="fas fa-globe" style="width: 18px; text-align: center;"></i>外国人スタッフ
                        </div>
                        <div class="user-nav-link" data-target="sec-files">
                            <i class="fas fa-folder-open" style="width: 18px; text-align: center;"></i>各種ファイル
                        </div>
                        ${isEdit ? `
                        <div class="user-nav-link" data-target="sec-share">
                            <i class="fas fa-share-alt" style="width: 18px; text-align: center;"></i>設定情報の共有
                        </div>
                        ` : ''}
                    </div>

                    <!-- 右側フォームコンテンツ (縦並び) -->
                    <div style="display: flex; flex-direction: column; gap: 2rem;">
                        
                        <!-- 基本情報カード -->
                        <div id="sec-basic" class="glass-panel" style="padding: 1.5rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: var(--primary); border-bottom: 2px solid #f1f5f9; padding-bottom: 0.8rem; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-id-card"></i> 基本情報
                            </h4>
                            <div style="display: flex; flex-direction: column; gap: 1.2rem;">
                                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1.2rem;">
                                    <div class="input-group" style="margin: 0;">
                                        <label style="font-weight: 700; color: #475569;">従業員コード <span style="color: #ef4444;">*</span></label>
                                        <input type="text" id="user-code" placeholder="例: 135" required style="font-family: monospace; font-size: 1.1rem;">
                                    </div>
                                    <div class="input-group" style="margin: 0;">
                                        <label style="font-weight: 700; color: #475569;">お名前 <span style="color: #ef4444;">*</span></label>
                                        <input type="text" id="user-name" required placeholder="例: 山田 太郎" style="font-size: 1.1rem;">
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                                    <div class="input-group" style="margin: 0;">
                                        <label style="font-weight: 700; color: #475569;">姓 (給与連携用) <span style="color: #ef4444;">*</span></label>
                                        <input type="text" id="user-lastname" required placeholder="例: 山田" style="font-size: 1.1rem;">
                                    </div>
                                    <div class="input-group" style="margin: 0;">
                                        <label style="font-weight: 700; color: #475569;">名 (給与連携用) <span style="color: #ef4444;">*</span></label>
                                        <input type="text" id="user-firstname" required placeholder="例: 太郎" style="font-size: 1.1rem;">
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                                    <div class="input-group" style="margin: 0;">
                                        <label style="font-weight: 700; color: #475569;">シフト表示名 (ニックネーム)</label>
                                        <input type="text" id="user-display-name" placeholder="例: 太郎" style="font-size: 1.1rem; background: #fffdf0; border: 1px solid #fde68a;">
                                    </div>
                                    <div class="input-group" style="margin: 0;">
                                        <label style="font-weight: 700; color: #475569;">入社日</label>
                                        <input type="date" id="user-hire-date" style="font-size: 1.1rem; background: white;">
                                    </div>
                                </div>
                                <p style="font-size: 0.75rem; color: #b45309; margin-top: 0.3rem;">※シフト表示名は、シフト表に短く表示したい場合のみ入力。未設定時は「お名前」が表示されます。</p>
                            </div>
                        </div>

                        <!-- 所属・権限カード -->
                        <div id="sec-affiliation" class="glass-panel" style="padding: 1.5rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: var(--primary); border-bottom: 2px solid #f1f5f9; padding-bottom: 0.8rem; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-briefcase"></i> 所属・権限
                            </h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                                <div class="input-group" style="margin: 0;">
                                    <label style="font-weight: 700; color: #475569;">所属店舗 <span style="color: #ef4444;">*</span></label>
                                    <select id="user-store-select" required style="background: white; font-weight: 600;">
                                        <option value="">店舗を選択...</option>
                                    </select>
                                </div>
                                <div class="input-group" style="margin: 0;">
                                    <label style="font-weight: 700; color: #475569;">在職状況 <span style="color: #ef4444;">*</span></label>
                                    <select id="user-status" required style="background: white; font-weight: 600;">
                                        <option value="active">在職中</option>
                                        <option value="resigning">退職手続き中</option>
                                        <option value="retired">退職済</option>
                                    </select>
                                </div>
                                <div class="input-group" id="resignation-date-group" style="margin: 0; display: none;">
                                    <label style="font-weight: 700; color: #475569;">退職日</label>
                                    <input type="date" id="user-resignation-date" style="background: white;">
                                </div>
                                <div class="input-group" style="margin: 0;">
                                    <label style="font-weight: 700; color: #475569;">権限レベル <span style="color: #ef4444;">*</span></label>
                                    <select id="user-role" required style="background: white; font-weight: 600;">
                                        <option value="Staff">一般社員</option>
                                        <option value="PartTimer">アルバイトスタッフ</option>
                                        <option value="Tablet">店舗タブレット</option>
                                        <option value="Manager">店長</option>
                                        <option value="Admin">管理者</option>
                                    </select>
                                </div>
                                <div class="input-group" style="margin: 0;">
                                    <label style="font-weight: 700; color: #475569;">表示役職</label>
                                    <input type="text" id="user-job-title" placeholder="副店長等" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
                                </div>
                                <div class="input-group" style="margin: 0;">
                                    <label style="font-weight: 700; color: #475569;">雇用契約種別 <span style="color: #ef4444;">*</span></label>
                                    <select id="user-employment-type" required style="background: white; font-weight: 600;">
                                        <option value="" disabled selected>選択してください</option>
                                        <option value="Executive">役員</option>
                                        <option value="Full-time">正社員</option>
                                        <option value="Part-time">アルバイト</option>
                                    </select>
                                </div>
                                <div class="input-group" style="margin: 0;">
                                    <label style="font-weight: 700; color: #475569;">等級</label>
                                    <select id="user-grade-select" style="background: white; font-weight: 600;">
                                        <option value="">等級を選択...</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- アカウント・ログイン情報カード -->
                        <div id="sec-account" class="glass-panel" style="padding: 1.5rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: var(--primary); border-bottom: 2px solid #f1f5f9; padding-bottom: 0.8rem; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-key"></i> アカウント・ログイン情報
                            </h4>
                            <div style="display: flex; flex-direction: column; gap: 1.2rem;">
                                <div class="input-group" style="margin: 0;">
                                    <label style="font-weight: 700; color: #475569;">メールアドレス (ログイン用ID)</label>
                                    <input type="email" id="user-email" placeholder="example@kaneshow.jp">
                                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.3rem;">※ポータルへのログインに使用します</p>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; background: #f1f5f9; padding: 1.2rem; border-radius: 12px; margin-top: 0.5rem;">
                                    <div class="input-group" style="margin: 0;">
                                        <label style="font-weight: 700; color: #334155;">打刻パスワード</label>
                                        <input type="text" id="user-password" placeholder="例: 1234" maxlength="4" style="font-family: monospace; text-align: center; font-size: 1.25rem; letter-spacing: 0.2em;">
                                        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.3rem; text-align: center;">※数字4桁</p>
                                    </div>
                                    <div class="input-group" style="margin: 0;">
                                        <label style="font-weight: 700; color: #334155;">ログインパスワード</label>
                                        <input type="password" id="user-login-password" placeholder="••••••••" style="font-size: 1.1rem;">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 外国人スタッフ情報カード -->
                        <div id="sec-visa" class="glass-panel" style="padding: 1.5rem; background: #fffcf0; border: 1px solid #fde68a; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: #b45309; border-bottom: 1px solid #fde68a; padding-bottom: 0.8rem; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-globe"></i> 外国人スタッフ情報
                            </h4>
                            <div style="display: flex; flex-direction: column; gap: 1.2rem;">
                                <div class="input-group" style="margin: 0;">
                                    <label style="font-weight: 700; color: #92400e;">VISA期限</label>
                                    <input type="date" id="user-visa-expiry" style="background: white; font-weight: 600; border: 1px solid #fcd34d;">
                                </div>
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: 0.5rem;">
                                    <div style="flex: 1;">
                                        <label style="font-weight: 800; color: #92400e; display: block; margin-bottom: 0.2rem;">週28時間制限 (留学生など)</label>
                                        <p style="font-size: 0.75rem; color: #b45309; margin: 0;">チェックを入れるとシフト画面で超過アラートが有効になります</p>
                                    </div>
                                    <div class="switch-container">
                                        <input type="checkbox" id="user-28h-limit" style="width: 20px; height: 20px; cursor: pointer; accent-color: #d97706;">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 各種ファイル（提出書類）カード -->
                        <div id="sec-files" class="glass-panel" style="padding: 1.5rem; background: #f8fafc; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.8rem; margin-bottom: 1.2rem;">
                                <h4 style="margin: 0; color: #334155; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                                    <i class="fas fa-folder-open" style="color: #64748b;"></i> 各種ファイル（提出書類）
                                </h4>
                                ${isEdit ? `
                                <button type="button" class="btn" id="btn-open-file-modal" style="background: white; border: 1px solid #cbd5e1; color: #475569; padding: 0.4rem 0.8rem; font-size: 0.85rem; font-weight: 700;">
                                    <i class="fas fa-plus-circle" style="color: var(--primary);"></i> 追加する
                                </button>
                                ` : ''}
                            </div>
                            <div id="user-documents-container" style="display: flex; flex-direction: column; gap: 1rem;">
                                <p style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 1rem;">ファイルが存在しません</p>
                            </div>
                        </div>

                        <!-- 操作案内ツール (編集時のみ) -->
                        <div id="sec-share" style="display: ${isEdit ? 'block' : 'none'}; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 1.5rem; background: white;">
                            <p style="font-size: 0.9rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; color: #475569; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-share-alt"></i> 設定情報の共有</p>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <button type="button" id="btn-send-reset-email" class="btn" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.85rem; padding: 0.8rem;">
                                    <i class="fas fa-share-square"></i> ログイン情報をコピー
                                </button>
                                <button type="button" id="btn-show-clock-in-pw" class="btn" style="background: #fdf2f8; color: #db2777; border: 1px solid #fbcfe8; font-size: 0.85rem; padding: 0.8rem;">
                                    <i class="fas fa-key"></i> 打刻PWを案内
                                </button>
                            </div>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.8rem; text-align: center;">※クリックすると各案内文がクリップボードにコピーされます</p>
                        </div>

                        <!-- アクションボタンエリア -->
                        <div style="display: flex; gap: 1rem; margin-top: 1rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; justify-content: space-between; align-items: center;">
                            <div>
                                ${isEdit && window.appState?.currentUser?.Email === 'shohei.kaneko@kaneshow.jp' ? `
                                    <button type="button" id="btn-form-delete" class="btn" style="padding: 1rem 1.5rem; background: #fee2e2; border: 1px solid #fca5a5; color: #ef4444; font-weight: 700;">
                                        <i class="fas fa-trash-alt" style="margin-right: 0.5rem;"></i> この従業員を削除する
                                    </button>
                                ` : ''}
                            </div>
                            <div style="display: flex; gap: 1rem;">
                                <button type="button" id="btn-form-cancel" class="btn" style="padding: 1rem 2rem; background: white; border: 1px solid var(--border); color: var(--text-secondary); font-weight: 700;">
                                    キャンセル
                                </button>
                                <button type="submit" class="btn btn-primary" style="padding: 1rem 3rem; font-weight: 800; font-size: 1.1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                    <i class="fas fa-save" style="margin-right: 0.5rem;"></i>
                                    ユーザー情報を保存
                                </button>
                            </div>
                        </div>

                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('btn-form-back').onclick = document.getElementById('btn-form-cancel').onclick = () => {
        currentView = 'list';
        renderView();
    };

    Promise.all([fetchStoreOptions(), fetchGradeOptions()]).then(() => {
        if (isEdit) {
            document.getElementById('user-code').value = editingUserData.EmployeeCode || '';
            document.getElementById('user-name').value = editingUserData.Name || '';
            document.getElementById('user-lastname').value = editingUserData.LastName || '';
            document.getElementById('user-firstname').value = editingUserData.FirstName || '';
            document.getElementById('user-password').value = editingUserData.ClockInPassword || '';
            document.getElementById('user-login-password').value = editingUserData.LoginPassword || '';
            document.getElementById('user-email').value = editingUserData.Email || '';
            document.getElementById('user-role').value = editingUserData.Role || 'Staff';
            document.getElementById('user-status').value = editingUserData.Status || 'active';
            document.getElementById('user-store-select').value = editingUserData.StoreID || '';
            document.getElementById('user-employment-type').value = editingUserData.EmploymentType || '';
            document.getElementById('user-28h-limit').checked = !!editingUserData.Has28hLimit;
            document.getElementById('user-display-name').value = editingUserData.DisplayName || '';
            document.getElementById('user-job-title').value = editingUserData.JobTitle || '';
            document.getElementById('user-grade-select').value = editingUserData.GradeCode || '';
            document.getElementById('user-visa-expiry').value = editingUserData.visa_expiry_date || '';
            document.getElementById('user-resignation-date').value = editingUserData.ResignationDate || '';
            document.getElementById('user-hire-date').value = editingUserData.HireDate || '';
            
            // 各種ファイルのレンダリング
            if (editingUserData.documents) {
                renderUserDocuments(editingUserData.documents);
            }
        }

        const statusSel = document.getElementById('user-status');
        const resGroup = document.getElementById('resignation-date-group');
        if (statusSel && resGroup) {
            const toggleResDate = () => {
                if (statusSel.value === 'resigning' || statusSel.value === 'retired') {
                    resGroup.style.display = 'block';
                } else {
                    resGroup.style.display = 'none';
                    document.getElementById('user-resignation-date').value = '';
                }
            };
            statusSel.addEventListener('change', toggleResDate);
            toggleResDate(); // 初期表示用
        }
    });

    setupFormLogic();

    // スムーズスクロールとスクロールスパイの登録
    const navLinks = container.querySelectorAll('.user-nav-link');
    navLinks.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            const scrollContainer = document.querySelector('.page-content');
            if (targetEl && scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const targetRect = targetEl.getBoundingClientRect();
                const relativeTop = targetRect.top - containerRect.top + scrollContainer.scrollTop;
                
                scrollContainer.scrollTo({
                    top: relativeTop - 20,
                    behavior: 'smooth'
                });
            }
        };
    });

    const scrollContainer = document.querySelector('.page-content');
    if (scrollContainer) {
        const sections = ['sec-basic', 'sec-affiliation', 'sec-account', 'sec-visa', 'sec-files'];
        if (isEdit) sections.push('sec-share');
        
        const onScroll = () => {
            let activeSectionId = sections[0];
            const containerRect = scrollContainer.getBoundingClientRect();
            
            for (const id of sections) {
                const el = document.getElementById(id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const relativeTop = rect.top - containerRect.top;
                    // 要素の頭がスクロールコンテナの上部から100px以内、あるいは少し過ぎた位置にある場合
                    if (relativeTop <= 100) {
                        activeSectionId = id;
                    }
                }
            }
            
            navLinks.forEach(link => {
                if (link.getAttribute('data-target') === activeSectionId) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        };
        
        scrollContainer.addEventListener('scroll', onScroll);
        activeScrollSpyListener = onScroll; // グローバルで保持して破棄可能にする
    }
}

// ユーザーのドキュメント（各種ファイル）をレンダリングする関数
function renderUserDocuments(docs) {
    const container = document.getElementById('user-documents-container');
    if (!container) return;
    
    if (!docs || Object.keys(docs).length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 1rem;">ファイルが存在しません</p>';
        return;
    }

    let html = '';

    const renderFileLinks = (files, icon, label) => {
        if (!files || files.length === 0) return '';
        let sectionHtml = `<div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">`;
        sectionHtml += `<h5 style="margin: 0 0 0.8rem 0; font-size: 0.95rem; color: #475569; display: flex; align-items: center; gap: 0.5rem;"><i class="${icon}"></i> ${label}</h5>`;
        sectionHtml += `<div style="display: flex; flex-direction: column; gap: 0.5rem;">`;
        
        files.forEach((file, index) => {
            const dateStr = file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString('ja-JP') : '';
            const noteStr = file.note ? ` <span style="font-size: 0.8rem; color: #94a3b8; margin-left: 0.5rem;">(${file.note})</span>` : '';
            
            // 在留カード特有の項目
            let extraInfo = '';
            if (file.expire_date) {
                extraInfo = ` <span style="font-size: 0.8rem; font-weight: bold; color: #ef4444; margin-left: 0.5rem;">[期限: ${file.expire_date}]</span>`;
            }

            const url = file.url || file.front_url || file.back_url;
            if (!url) return;

            sectionHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem; background: #f8fafc; border-radius: 6px; border: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                        <i class="far fa-file-image" style="color: #cbd5e1;"></i>
                        <a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
                            画像を確認 <i class="fas fa-external-link-alt" style="font-size: 0.8rem;"></i>
                        </a>
                        ${extraInfo}${noteStr}
                    </div>
                    <div style="font-size: 0.8rem; color: #94a3b8;">${dateStr}</div>
                </div>
            `;
            
            // 裏面がある場合（在留カード等）
            if (file.back_url) {
                sectionHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem; background: #f8fafc; border-radius: 6px; border: 1px solid #f1f5f9;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                            <i class="far fa-file-image" style="color: #cbd5e1;"></i>
                            <a href="${file.back_url}" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
                                画像を確認 (裏面) <i class="fas fa-external-link-alt" style="font-size: 0.8rem;"></i>
                            </a>
                            ${noteStr}
                        </div>
                        <div style="font-size: 0.8rem; color: #94a3b8;">${dateStr}</div>
                    </div>
                `;
            }
        });
        sectionHtml += `</div></div>`;
        return sectionHtml;
    };

    html += renderFileLinks(docs.id_cards, 'fas fa-id-card', '身分証 (住所確認用)');
    html += renderFileLinks(docs.bank_cards, 'fas fa-money-check', '通帳 / キャッシュカード');
    html += renderFileLinks(docs.residence_cards, 'fas fa-passport', '在留カード');
    html += renderFileLinks(docs.designation_certs, 'fas fa-file-contract', '指定書');

    if (!html) {
        html = '<p style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 1rem;">表示できるファイルがありません</p>';
    }

    container.innerHTML = html;
}

function setupFormLogic() {
    setupUploadModalLogic();
    const form = document.getElementById('user-form');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector('button[type="submit"]');
        const originalHtml = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        btnSubmit.disabled = true;

        const docId = editingUserData ? editingUserData.id : null;
        const storeSelect = document.getElementById('user-store-select');
        const selectedOpt = storeSelect.options[storeSelect.selectedIndex];
        
        const newUser = {
            'EmployeeCode': document.getElementById('user-code').value,
            'Name': document.getElementById('user-name').value,
            'LastName': document.getElementById('user-lastname').value,
            'FirstName': document.getElementById('user-firstname').value,
            'ClockInPassword': document.getElementById('user-password').value,
            'LoginPassword': document.getElementById('user-login-password').value,
            'Email': document.getElementById('user-email').value,
            'Role': document.getElementById('user-role').value,
            'Store': selectedOpt ? selectedOpt.text : '',
            'StoreID': storeSelect.value || '', // StoreID is now primary
            'EmploymentType': document.getElementById('user-employment-type').value,
            'Has28hLimit': document.getElementById('user-28h-limit').checked,
            'DisplayName': document.getElementById('user-display-name').value,
            'JobTitle': document.getElementById('user-job-title').value,
            'GradeCode': document.getElementById('user-grade-select').value || '',
            'Status': document.getElementById('user-status').value,
            'ResignationDate': document.getElementById('user-resignation-date')?.value || '',
            'visa_expiry_date': document.getElementById('user-visa-expiry').value,
            'HireDate': document.getElementById('user-hire-date')?.value || '',
            'UpdatedAt': new Date().toISOString()
        };

        try {
            if (docId) { 
                await updateDoc(doc(db, "m_users", docId), newUser); 
                showAlert('成功', '保存しました。');
            } else { 
                await addDoc(collection(db, "m_users"), newUser);
                showAlert('成功', '登録しました。');
            }
            // 保存後に最新データを再取得してキャッシュを更新し、即座に一覧へ反映させる
            await fetchUsersData();
            currentView = 'list';
            renderView();
        } catch (err) { 
            console.error(err);
            showAlert('エラー', '保存に失敗しました。'); 
        } finally {
            btnSubmit.innerHTML = originalHtml;
            btnSubmit.disabled = false;
        }
    };

    // 削除ボタンのロジック
    const btnDelete = document.getElementById('btn-form-delete');
    if (btnDelete) {
        btnDelete.onclick = async () => {
            if (!confirm("本当にこの従業員データを削除しますか？")) return;
            if (!confirm("※警告※\nこの操作は取り消せません。本当によろしいですか？")) return;

            btnDelete.disabled = true;
            btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 削除中...';

            const docId = editingUserData?.id;
            if (!docId) return;

            try {
                await deleteDoc(doc(db, "m_users", docId));
                showAlert('成功', '従業員データを完全に削除しました。');
                await fetchUsersData();
                currentView = 'list';
                renderView();
            } catch (err) {
                console.error(err);
                showAlert('エラー', '削除に失敗しました。');
                btnDelete.disabled = false;
                btnDelete.innerHTML = '<i class="fas fa-trash-alt" style="margin-right: 0.5rem;"></i> この従業員を削除する';
            }
        };
    }

    // Password info buttons
    const btnCopyLogin = document.getElementById('btn-send-reset-email');
    if (btnCopyLogin) {
        btnCopyLogin.onclick = async () => {
            const email = document.getElementById('user-email').value;
            const name = document.getElementById('user-name').value;
            const loginPw = document.getElementById('user-login-password').value;
            if (!email) return showAlert('警告', 'メールアドレスが設定されていません。');
            if (!loginPw) return showAlert('警告', 'ログインパスワードが設定されていません。');
            
            const text = `【かね将ポータル ログイン情報のご案内】\n${name} 様\n\nログインURL: ${location.origin}\nID: ${email}\nPW: ${loginPw}\n\n上記の情報でログインしてください。`;
            try {
                await navigator.clipboard.writeText(text);
                showAlert('成功', 'ログイン情報をコピーしました。');
            } catch(e) { showAlert('エラー', 'コピーに失敗しました。'); }
        };
    }

    const btnShowClockIn = document.getElementById('btn-show-clock-in-pw');
    if (btnShowClockIn) {
        btnShowClockIn.onclick = () => {
            const pw = document.getElementById('user-password').value;
            const name = document.getElementById('user-name').value;
            if(!pw) return showAlert('警告', "打刻パスワードが設定されていません。");
            
            const msg = `【打刻パスワードの案内】\n${name} 様\n\nあなたの打刻パスワードは「 ${pw} 」です。\n店舗のタブレット端末で打刻する際にご使用ください。`;
            navigator.clipboard.writeText(msg).then(() => {
                showAlert('案内文のコピー', msg);
            });
        };
    }

    // 姓名自動入力アシスト
    const nameInput = document.getElementById('user-name');
    const lastNameInput = document.getElementById('user-lastname');
    const firstNameInput = document.getElementById('user-firstname');
    
    if (nameInput && lastNameInput && firstNameInput) {
        nameInput.addEventListener('input', () => {
            const val = nameInput.value.trim();
            if (!val) return;
            
            const parts = val.split(/[\s　]+/);
            if (parts.length >= 2) {
                lastNameInput.value = parts[0];
                firstNameInput.value = parts.slice(1).join(' ');
            } else {
                lastNameInput.value = val;
                firstNameInput.value = '';
            }
        });
    }
}

export async function initUsersPage() {
    const container = document.getElementById('users-page-container');
    if (container) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem; color: var(--primary);"></i>
                <p>ユーザーデータを読み込んでいます...</p>
            </div>
            <style>
                .badge.parttimer { background: rgba(100, 116, 139, 0.1); color: #64748b; }
                .badge.tablet { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; }
                .badge.staff { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
                .badge.manager { background: rgba(245, 158, 11, 0.1); color: #d97706; }
                .badge.admin { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
            </style>
        `;
    }

    try {
        await fetchUsersData();
        currentView = 'list';
        currentPage = 1;
        renderView();
    } catch (error) {
        console.error("Failed to load users data:", error);
        if (container) {
            container.innerHTML = `
                <div style="padding: 3rem; color: var(--danger); text-align: center; max-width: 600px; margin: 0 auto; background: #fef2f2; border-radius: 12px; margin-top: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3 style="margin-top: 0;">データの読み込みに失敗しました</h3>
                    <p style="font-weight: 600; font-size: 1.1rem;">Firebase APIまたはネットワークでエラーが発生しています。</p>
                    <p style="font-family: monospace; font-size: 0.9rem; background: rgba(0,0,0,0.05); padding: 1rem; border-radius: 8px; text-align: left; overflow-x: auto;">
                        ${error.message || error.toString()}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 1.5rem;">※ 詳細なログはブラウザのコンソール(F12)をご確認ください。</p>
                </div>
            `;
        }
    }
}

async function fetchUsersData() {
    const querySnapshot = await getDocs(collection(db, "m_users"));
    cachedUsers = [];
    querySnapshot.forEach((doc) => {
        cachedUsers.push({ id: doc.id, ...doc.data() });
    });
}

async function fetchStoreOptions() {
    const sel = document.getElementById('user-store-select');
    if(!sel) return;
    try {
        const snap = await getDocs(query(collection(db, "m_stores"), orderBy("store_id")));
        sel.innerHTML = '<option value="">店舗を選択してください</option>';
        snap.forEach(d => {
            const data = d.data();
            const opt = document.createElement('option');
            opt.value = data.store_id;
            opt.textContent = data.store_name;
            sel.appendChild(opt);
        });
    } catch(e) { console.error(e); }
}

async function fetchGradeOptions() {
    const sel = document.getElementById('user-grade-select');
    if(!sel) return;
    try {
        const snap = await getDocs(collection(db, "m_grades"));
        const grades = [];
        snap.forEach(d => {
            grades.push(d.data());
        });
        // display_order順にソート (未設定の場合は仮値 999)
        grades.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
        
        sel.innerHTML = '<option value="">等級を選択...</option>';
        grades.forEach(g => {
            if (g.grade_code) {
                const opt = document.createElement('option');
                opt.value = g.grade_code;
                opt.textContent = g.grade_code + (g.job_title ? ` (${g.job_title})` : '');
                sel.appendChild(opt);
            }
        });
    } catch(e) { console.error(e); }
}

function renderTable(filter = "") {
    const tbody = document.getElementById('users-table-body');
    const countLabel = document.getElementById('users-count');
    const includeRetired = document.getElementById('user-include-retired')?.checked || false;
    if (!tbody) return;

    try {
        const todayStr = new Date().toISOString().substring(0, 10);
        let filtered = cachedUsers.filter(u => {
            // 退職者の除外処理
            if (!includeRetired) {
                if (u.Status === 'retired' || u.Status === '退職済') return false;
                if ((u.Status === 'resigning' || u.Status === '退職手続き中') && u.ResignationDate && u.ResignationDate < todayStr) return false;
            }

            const f = filter.toLowerCase();
            return (u.Name || '').toLowerCase().includes(f) || 
                   (u.EmployeeCode || '').toLowerCase().includes(f);
        });

        // フィルタ後の配列に対してソートを適用
        filtered.sort((a, b) => {
            let valA = a[currentSortColumn] || '';
            let valB = b[currentSortColumn] || '';

            // roleなどは表示名ではなく内部値ベースでの比較になるが実用上問題なし
            let comparison = 0;
            if (valA < valB) comparison = -1;
            else if (valA > valB) comparison = 1;

            return currentSortDirection === 'asc' ? comparison : -comparison;
        });

        const totalItems = filtered.length;
        let totalPages = Math.ceil(totalItems / pageSize);
        if (totalPages === 0) totalPages = 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * pageSize;
        const itemsToShow = filtered.slice(startIndex, startIndex + pageSize);

        if (countLabel) {
            if (totalItems === 0) {
                countLabel.textContent = '表示中: 0 件';
            } else {
                countLabel.textContent = `表示中: ${startIndex + 1}-${Math.min(startIndex + pageSize, totalItems)} / ${totalItems} 件`;
            }
        }

        tbody.innerHTML = '';
        renderPagination(totalPages, filter);

        // ヘッダーアイコンの更新処理
        const headerCells = document.querySelectorAll('#users-table-header th[data-sort]');
        headerCells.forEach(th => {
            const icon = th.querySelector('i');
            if (!icon) return;
            if (th.getAttribute('data-sort') === currentSortColumn) {
                icon.className = currentSortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
                icon.style.opacity = '1';
            } else {
                icon.className = 'fas fa-sort';
                icon.style.opacity = '0.3';
            }
        });

        if (itemsToShow.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 4rem; color: var(--text-secondary);">該当するユーザーが見つかりません</td></tr>';
            return;
        }

        itemsToShow.forEach((item, index) => {
            const roleNameMap = {
                'Admin': '管理者', 'Manager': '店長', 'Staff': '一般社員', 'PartTimer': 'アルバイト', 'Tablet': '店舗タブレット'
            };
            const role = item['Role'] || 'Staff';
            const status = item['Status'] || 'active';
            const statusMap = { 'active': '在職', 'resigning': '退職手続中', 'retired': '退職' };
            const empType = item['EmploymentType'] || '';
            const empTypeLabel = empType === 'Full-time' ? '正社員' : (empType === 'Part-time' ? 'アルバイト' : (empType === 'Executive' ? '役員' : '未設定'));
            const empTypeColorBg = empType === 'Full-time' ? '#dcfce7' : (empType === 'Part-time' ? '#e0f2fe' : (empType === 'Executive' ? '#f3e8ff' : '#f1f5f9'));
            const empTypeColorText = empType === 'Full-time' ? '#166534' : (empType === 'Part-time' ? '#0369a1' : (empType === 'Executive' ? '#7e22ce' : '#64748b'));

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            if (index % 2 === 1) {
                tr.style.backgroundColor = '#f8fafc';
            }
            tr.onmouseover = () => tr.style.backgroundColor = '#f1f5f9';
            tr.onmouseout = () => tr.style.backgroundColor = index % 2 === 1 ? '#f8fafc' : 'white';
            tr.style.transition = 'background 0.2s';
            tr.innerHTML = `
                <td style="padding: 0.6rem 0.8rem; font-family: monospace; color: #475569;">${item['EmployeeCode'] || '-'}</td>
                <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: #1e293b;">
                    ${item['Name'] || '-'}
                    ${item['DisplayName'] ? `<span style="font-size:0.75rem; color:#94a3b8; font-weight:600; margin-left:0.4rem;">(${item['DisplayName']})</span>` : ''}
                </td>
                <td style="padding: 0.6rem 0.8rem; color: #475569; font-size: 0.85rem;">${item['Store'] || '-'}</td>
                <td style="padding: 0.6rem 0.8rem;">
                    <span style="background: ${empTypeColorBg}; color: ${empTypeColorText}; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; border: 1px solid rgba(0,0,0,0.05);">${empTypeLabel}</span>
                </td>
                <td style="padding: 0.6rem 0.8rem; font-family: monospace; font-weight: 800; color: #2563eb;">${item['GradeCode'] || '-'}</td>
                <td style="padding: 0.6rem 0.8rem;"><span class="badge ${role.toLowerCase()}" style="padding:0.2rem 0.5rem; font-size:0.75rem;">${roleNameMap[role] || role}</span></td>
                <td style="padding: 0.6rem 0.8rem;"><span class="badge status-${status}" style="padding:0.2rem 0.5rem; font-size:0.75rem;">${statusMap[status]}</span></td>
                <td style="padding: 0.6rem 0.8rem; text-align: right;">
                    <button class="btn btn-edit-user" style="padding: 0.4rem 0.8rem; background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; border-radius: 6px; font-weight: 600; font-size: 0.8rem;" title="編集">
                        <i class="fas fa-edit"></i> 編集
                    </button>
                </td>
            `;

            tr.querySelector('.btn-edit-user').onclick = () => {
                editingUserData = item;
                currentView = 'form';
                renderView();
            };
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Error rendering users:', e);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> エラーが発生しました</td></tr>';
    }
}

function renderPagination(totalPages, filter) {
    const container = document.getElementById('user-pagination');
    if (!container) return;
    container.innerHTML = '';
    
    if (totalPages <= 1) return;

    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn';
    btnPrev.style.padding = '0.4rem 0.8rem';
    btnPrev.style.background = 'var(--surface-darker)';
    btnPrev.disabled = currentPage === 1;
    btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnPrev.onclick = () => {
        currentPage--;
        renderTable(filter);
        document.querySelector('.page-content').scrollTop = 0;
    };
    container.appendChild(btnPrev);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.padding = '0.4rem 0.8rem';
        btn.style.minWidth = '36px';
        if (i === currentPage) {
            btn.classList.add('btn-primary');
        } else {
            btn.style.background = 'white';
            btn.style.border = '1px solid var(--border)';
            btn.onclick = () => {
                currentPage = i;
                renderTable(filter);
                document.querySelector('.page-content').scrollTop = 0;
            };
        }
        btn.textContent = i;
        container.appendChild(btn);
    }

    const btnNext = document.createElement('button');
    btnNext.className = 'btn';
    btnNext.style.padding = '0.4rem 0.8rem';
    btnNext.style.background = 'var(--surface-darker)';
    btnNext.disabled = currentPage === totalPages;
    btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnNext.onclick = () => {
        currentPage++;
        renderTable(filter);
        document.querySelector('.page-content').scrollTop = 0;
    };
    container.appendChild(btnNext);
}

// 外部から直接ユーザー編集画面を開くためのグローバル関数
window.openUserEditForm = async (userId) => {
    try {
        const userSnap = await getDoc(doc(db, "m_users", userId));
        if (userSnap.exists()) {
            editingUserData = { id: userSnap.id, ...userSnap.data() };
            currentView = 'form';
            if (!document.getElementById('users-page-container')) {
                if (window.navigateTo) window.navigateTo('users');
                setTimeout(renderView, 200); // 画面遷移後にレンダリング
            } else {
                renderView();
            }
        } else {
            showAlert('エラー', '該当ユーザーが見つかりません');
        }
    } catch (e) {
        console.error("Failed to load user form", e);
        showAlert('エラー', 'ユーザー情報の取得に失敗しました');
    }
};

async function compressImage(file, maxWidth = 1200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                    h = Math.round((h * maxWidth) / w);
                    w = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function setupUploadModalLogic() {
    const btnOpen = document.getElementById('btn-open-file-modal');
    const modal = document.getElementById('file-upload-modal');
    const btnClose = document.getElementById('btn-close-file-modal');
    const btnCancel = document.getElementById('btn-cancel-file-modal');
    const typeSelect = document.getElementById('upload-doc-type');
    const extraFields = document.getElementById('upload-doc-extra-fields');
    const btnExecute = document.getElementById('btn-execute-upload');
    
    if (!btnOpen || !modal) return;

    btnOpen.onclick = () => {
        document.getElementById('upload-doc-file').value = '';
        document.getElementById('upload-doc-file-back').value = '';
        document.getElementById('upload-doc-expire').value = '';
        document.getElementById('upload-doc-note').value = '';
        typeSelect.value = 'id_cards';
        extraFields.style.display = 'none';
        modal.style.display = 'flex';
    };

    const closeModal = () => modal.style.display = 'none';
    btnClose.onclick = closeModal;
    btnCancel.onclick = closeModal;

    typeSelect.onchange = (e) => {
        if (e.target.value === 'residence_cards') {
            extraFields.style.display = 'block';
        } else {
            extraFields.style.display = 'none';
        }
    };

    btnExecute.onclick = async () => {
        const fileInput = document.getElementById('upload-doc-file');
        if (!fileInput.files || fileInput.files.length === 0) {
            showAlert('エラー', '画像ファイルを選択してください');
            return;
        }

        const type = typeSelect.value;
        const note = document.getElementById('upload-doc-note').value;
        const docId = editingUserData?.id;
        
        if (!docId) {
            showAlert('エラー', 'ユーザー情報が保存されていません。先に全体の保存を行ってください。');
            return;
        }

        btnExecute.innerHTML = '<i class="fas fa-spinner fa-spin"></i> アップロード中...';
        btnExecute.disabled = true;

        try {
            const timestamp = Date.now();
            const safeName = (editingUserData.Name || 'unknown').replace(/\s+/g, '_');
            
            const fileFront = fileInput.files[0];
            const dataUrlFront = await compressImage(fileFront);
            const pathFront = `users/${docId}/${safeName}_${timestamp}_${type}_front.jpg`;
            const refFront = ref(storage, pathFront);
            await uploadString(refFront, dataUrlFront, 'data_url');
            const urlFront = await getDownloadURL(refFront);

            let newFileObj = {
                uploaded_at: new Date().toISOString(),
                note: note
            };

            if (type === 'residence_cards') {
                newFileObj.front_url = urlFront;
                newFileObj.expire_date = document.getElementById('upload-doc-expire').value;
                
                const fileInputBack = document.getElementById('upload-doc-file-back');
                if (fileInputBack.files && fileInputBack.files.length > 0) {
                    const dataUrlBack = await compressImage(fileInputBack.files[0]);
                    const pathBack = `users/${docId}/${safeName}_${timestamp}_${type}_back.jpg`;
                    const refBack = ref(storage, pathBack);
                    await uploadString(refBack, dataUrlBack, 'data_url');
                    newFileObj.back_url = await getDownloadURL(refBack);
                }
            } else {
                newFileObj.url = urlFront;
            }

            await updateDoc(doc(db, "m_users", docId), {
                [`documents.${type}`]: arrayUnion(newFileObj)
            });

            if (!editingUserData.documents) editingUserData.documents = {};
            if (!editingUserData.documents[type]) editingUserData.documents[type] = [];
            editingUserData.documents[type].push(newFileObj);
            
            renderUserDocuments(editingUserData.documents);
            
            showAlert('成功', 'ファイルをアップロードしました');
            closeModal();
            
        } catch (e) {
            console.error("Upload failed", e);
            showAlert('エラー', `アップロードに失敗しました: ${e.message}`);
        } finally {
            btnExecute.innerHTML = 'アップロードを実行';
            btnExecute.disabled = false;
        }
    };
}
