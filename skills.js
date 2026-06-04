import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let localCategories = []; // メモリ上のカテゴリリスト
let localSkills = [];     // メモリ上のスキルリスト
let localGrades = [];     // 等級マスタからロードした等級リスト

let selectedCategoryId = 'all'; // 現在選択中のカテゴリID ('all' はすべて表示)
let editingSkillData = null;    // 現在編集中のスキルオブジェクト (nullは新規)
let editingCategoryData = null; // 現在編集中のカテゴリオブジェクト (nullは新規)

const roleNameMap = {
    'Admin': '管理者', 
    'Manager': '店長', 
    'Staff': '一般社員', 
    'PartTimer': 'アルバイト', 
    'Tablet': '店舗タブレット'
};

export const skillsPageHtml = `
    <div id="skills-page-container" class="animate-fade-in" style="padding: 1rem 1.5rem; max-width: 100%; box-sizing: border-box; font-family: inherit;">
        <!-- ヘッダーエリア -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;" class="no-print">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem; font-size: 1.5rem; font-weight: 900; color: var(--text-primary);">
                    <i class="fas fa-graduation-cap" style="color: #8b5cf6;"></i>
                    スキルマスタ設定
                </h2>
                <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.3rem; font-weight: 600;">
                    従業員育成PDCAや人事評価に紐付ける、会社指定の習得スキルおよびカテゴリ分類を一括管理します
                </p>
            </div>
            <div style="display: flex; gap: 0.6rem; align-items: center;">
                <button class="btn" id="btn-skills-back" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); font-weight: 700; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem;">
                    <i class="fas fa-arrow-left"></i> 人事総務へ戻る
                </button>
                <button class="btn btn-primary" id="btn-add-category" style="padding: 0.6rem 1.1rem; font-weight: 800; border-radius: 8px; background: #10b981; border-color: #10b981; font-size: 0.85rem;">
                    <i class="fas fa-folder-plus"></i> カテゴリを追加
                </button>
                <button class="btn btn-primary" id="btn-add-skill" style="padding: 0.6rem 1.3rem; font-weight: 800; border-radius: 8px; background: #8b5cf6; border-color: #8b5cf6; font-size: 0.85rem; box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.2);">
                    <i class="fas fa-plus"></i> スキルを新規登録
                </button>
            </div>
        </div>

        <!-- 空のデータベース用セットアップシードバナー -->
        <div id="seed-setup-banner" class="glass-panel animate-fade-in" style="display: none; padding: 1.5rem; background: #f5f3ff; border: 1px dashed #c084fc; border-radius: 12px; margin-bottom: 1.5rem; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: #e9d5ff; color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                    <i class="fas fa-seedling"></i>
                </div>
                <div>
                    <h4 style="margin: 0; color: #6b21a8; font-size: 1rem; font-weight: 800;">初期スキルマスタがまだ登録されていません</h4>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: #7e22ce; font-weight: 500;">
                        仕様書に基づいた「初期カテゴリ（8種類）」と「初期スキル（18種類）」をワンクリックで一括セットアップできます。
                    </p>
                </div>
            </div>
            <button class="btn" id="btn-run-seed" style="background: #8b5cf6; color: white; border: none; padding: 0.7rem 1.5rem; font-weight: 800; border-radius: 8px; font-size: 0.85rem; transition: background 0.2s;">
                初期デモデータを登録する
            </button>
        </div>

        <!-- 左右スプリット 2カラムレイアウト -->
        <div style="display: grid; grid-template-columns: 300px 1fr; gap: 1.5rem; align-items: start; max-width: 100%;">
            
            <!-- 左ペイン: カテゴリリスト -->
            <div class="glass-panel" style="padding: 1.2rem; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);">
                <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.6rem;">
                    <i class="fas fa-folder-open" style="color: #64748b;"></i>
                    カテゴリ一覧
                </h3>
                <div id="category-list-container" style="display: flex; flex-direction: column; gap: 0.4rem;">
                    <!-- 動的に読み込まれます -->
                    <div style="text-align: center; padding: 2rem 0; color: var(--text-secondary);">
                        <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--primary);"></i>
                        <p style="font-size: 0.8rem; margin: 0;">読込中...</p>
                    </div>
                </div>
            </div>

            <!-- 右ペイン: スキル一覧テーブル -->
            <div class="glass-panel" style="padding: 0; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03); overflow: hidden;">
                <div style="padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-list-ul" style="color: #8b5cf6;"></i>
                        登録スキル一覧 (<span id="skills-count-label">0</span>)
                    </h3>
                    <div id="active-category-info-label" style="font-size: 0.75rem; color: #8b5cf6; font-weight: 700; background: #f5f3ff; padding: 0.25rem 0.75rem; border-radius: 15px;">
                        表示: すべてのカテゴリ
                    </div>
                </div>

                <div style="overflow-x: auto; min-height: 300px;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase;">
                                <th style="padding: 0.8rem 1rem; font-weight: 700; width: 140px;">スキル名</th>
                                <th style="padding: 0.8rem 1rem; font-weight: 700; width: 100px;">カテゴリ</th>
                                <th style="padding: 0.8rem 1rem; font-weight: 700; width: 100px;">対象職種</th>
                                <th style="padding: 0.8rem 1rem; font-weight: 700; width: 120px;">対象等級</th>
                                <th style="padding: 0.8rem 1rem; font-weight: 700;">習得条件 / 基準</th>
                                <th style="padding: 0.8rem 1.2rem; font-weight: 700; text-align: center; width: 85px;">会議表示</th>
                                <th style="padding: 0.8rem 0.8rem; font-weight: 700; text-align: center; width: 65px;">優先度</th>
                                <th style="padding: 0.8rem 0.8rem; font-weight: 700; text-align: center; width: 60px;">状態</th>
                                <th style="padding: 0.8rem 1rem; text-align: right; font-weight: 700; width: 80px;">操作</th>
                            </tr>
                        </thead>
                        <tbody id="skills-table-body">
                            <!-- 動的に構築されます -->
                            <tr>
                                <td colspan="9" style="text-align: center; padding: 4rem; color: var(--text-secondary);">
                                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #8b5cf6; margin-bottom: 1rem; display: block; margin-left: auto; margin-right: auto;"></i>
                                    スキルマスタをロードしています...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
        </div>
    </div>

    <!-- スキル追加・編集モーダル -->
    <div id="skill-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 2000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1.5rem; box-sizing: border-box;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-xl); width: 100%; max-width: 650px; max-height: 90vh; overflow-y: auto; padding: 0;">
            <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; border-radius: 16px 16px 0 0;">
                <h3 id="skill-modal-title" style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-graduation-cap" style="color: #8b5cf6;"></i>
                    スキルマスタの登録
                </h3>
                <button type="button" class="btn-close-skill-modal" style="background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: #94a3b8;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem;">
                <form id="skill-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                        <div class="input-group" style="margin: 0;">
                            <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">スキル名 <span style="color: #ef4444;">*</span></label>
                            <input type="text" id="skill-name" required placeholder="例: 電話予約対応" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box;">
                        </div>
                        <div class="input-group" style="margin: 0;">
                            <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">紐づくカテゴリ <span style="color: #ef4444;">*</span></label>
                            <select id="skill-category-select" required style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; background: white; font-weight: 600;">
                                <option value="">選択してください...</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">対象職種 (複数選択可)</label>
                        <div id="skill-roles-checkboxes" style="display: flex; flex-wrap: wrap; gap: 0.8rem; background: #f8fafc; padding: 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1;">
                            <!-- JSで動的に構築 -->
                        </div>
                    </div>

                    <div>
                        <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">対象等級 (複数選択可)</label>
                        <div id="skill-grades-checkboxes" style="display: flex; flex-wrap: wrap; gap: 0.5rem; background: #f8fafc; padding: 0.8rem; border-radius: 8px; border: 1px solid #cbd5e1; max-height: 120px; overflow-y: auto;">
                            <!-- JSで動的に構築 -->
                        </div>
                        <span style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-top: 0.2rem;">※将来、店長会議資料や評価で等級に合致したスキルを自動抽出する際に参照されます。</span>
                    </div>

                    <div class="input-group" style="margin: 0;">
                        <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">習得条件 / 合格基準 <span style="color: #ef4444;">*</span></label>
                        <textarea id="skill-requirements" required rows="3" placeholder="例: 電話予約を受け、日時・人数・名前・連絡先・注意事項を正確に確認できる" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; font-family: inherit; resize: vertical;"></textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                        <div class="input-group" style="margin: 0;">
                            <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">レベル上限 (段階)</label>
                            <input type="number" id="skill-max-level" value="5" min="1" max="5" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; text-align: center;">
                        </div>
                        <div class="input-group" style="margin: 0;">
                            <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">店長会議表示優先度</label>
                            <select id="skill-priority" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; background: white; font-weight: 600;">
                                <option value="low">低 (一般・ルーチン)</option>
                                <option value="medium" selected>中 (標準業務)</option>
                                <option value="high">高 (最優先・育成注力)</option>
                            </select>
                        </div>
                        <div class="input-group" style="margin: 0;">
                            <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">状態</label>
                            <select id="skill-status" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; background: white; font-weight: 600;">
                                <option value="active" selected>有効</option>
                                <option value="inactive">無効</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; background: #eff6ff; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #bfdbfe; margin-top: 0.3rem;">
                        <div style="flex: 1; padding-right: 1rem;">
                            <label style="font-weight: 800; color: #1e3a8a; font-size: 0.85rem; display: block; margin-bottom: 0.1rem;">店長会議表示対象</label>
                            <span style="font-size: 0.7rem; color: #3b82f6;">有効にすると、店長会議資料の「スタッフ育成枠」の選択肢として表示されます。</span>
                        </div>
                        <input type="checkbox" id="skill-show-meeting" checked style="width: 1.3rem; height: 1.3rem; cursor: pointer; accent-color: #8b5cf6;">
                    </div>

                    <div class="input-group" style="margin: 0;">
                        <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">説明・備考</label>
                        <input type="text" id="skill-desc" placeholder="補足や備考があれば入力" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box;">
                    </div>

                    <div style="display: flex; gap: 0.8rem; justify-content: flex-end; margin-top: 0.8rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                        <button type="button" class="btn btn-close-skill-modal" style="padding: 0.6rem 1.5rem; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight: 700; border-radius: 6px;">キャンセル</button>
                        <button type="submit" class="btn" style="padding: 0.6rem 2.2rem; background: #8b5cf6; border: none; color: white; font-weight: 800; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.1);">保存する</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- カテゴリ追加・編集モーダル -->
    <div id="category-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 2000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1.5rem; box-sizing: border-box;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-xl); width: 100%; max-width: 480px; padding: 0;">
            <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; border-radius: 16px 16px 0 0;">
                <h3 id="category-modal-title" style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-folder-plus" style="color: #10b981;"></i>
                    スキルカテゴリの登録
                </h3>
                <button type="button" class="btn-close-category-modal" style="background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: #94a3b8;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem;">
                <form id="category-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                    <div class="input-group" style="margin: 0;">
                        <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">カテゴリ名 <span style="color: #ef4444;">*</span></label>
                        <input type="text" id="category-name" required placeholder="例: ホール" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box;">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="input-group" style="margin: 0;">
                            <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">表示順 (並び順用数値)</label>
                            <input type="number" id="category-display-order" value="1" min="1" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; text-align: center;">
                        </div>
                        <div class="input-group" style="margin: 0;">
                            <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">状態</label>
                            <select id="category-status" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; background: white; font-weight: 600;">
                                <option value="active" selected>有効</option>
                                <option value="inactive">無効</option>
                            </select>
                        </div>
                    </div>

                    <div class="input-group" style="margin: 0;">
                        <label style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">説明</label>
                        <textarea id="category-desc" rows="2" placeholder="例: 接客、案内、注文、配膳、会計など" style="font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; font-family: inherit; resize: vertical;"></textarea>
                    </div>

                    <div style="display: flex; gap: 0.8rem; justify-content: flex-end; margin-top: 0.8rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                        <button type="button" class="btn btn-close-category-modal" style="padding: 0.6rem 1.5rem; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight: 700; border-radius: 6px;">キャンセル</button>
                        <button type="submit" class="btn" style="padding: 0.6rem 2.2rem; background: #10b981; border: none; color: white; font-weight: 800; border-radius: 6px;">保存する</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <style>
        .category-item {
            padding: 0.75rem 1rem;
            border-radius: 8px;
            color: var(--text-secondary);
            font-weight: 600;
            font-size: 0.88rem;
            transition: all 0.2s;
            cursor: pointer;
            border: 1px solid transparent;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .category-item:hover {
            background: #f8fafc;
            color: #1e293b;
            border-color: #e2e8f0;
        }
        .category-item.active {
            background: #f5f3ff;
            color: #8b5cf6;
            font-weight: 800;
            border-color: #ddd6fe;
        }
        .category-badge-inactive {
            background: #f1f5f9;
            color: #94a3b8;
            font-size: 0.65rem;
            padding: 0.1rem 0.4rem;
            border-radius: 4px;
            font-weight: 600;
            margin-left: 0.5rem;
        }
        
        .priority-high { background: rgba(239, 68, 68, 0.1); color: #dc2626; }
        .priority-medium { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .priority-low { background: rgba(59, 130, 246, 0.1); color: #2563eb; }
        
        .status-active { background: rgba(16, 185, 129, 0.1); color: #059669; }
        .status-inactive { background: rgba(100, 116, 139, 0.1); color: #64748b; }
        
        .badge-meeting-on { background: rgba(139, 92, 246, 0.1); color: #7c3aed; }
        .badge-meeting-off { background: #f1f5f9; color: #94a3b8; }
        
        .modal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 4 slate, 0.4);
            z-index: 2000;
            align-items: center;
            justify-content: center;
        }
    </style>
`;

export async function initSkillsPage() {
    // 戻るボタンのバインド
    const btnBack = document.getElementById('btn-skills-back');
    if (btnBack) {
        btnBack.onclick = () => {
            window.navigateTo('hr_hub');
        };
    }

    // 新規登録ボタンのバインド
    const btnAddSkill = document.getElementById('btn-add-skill');
    if (btnAddSkill) {
        btnAddSkill.onclick = () => openSkillModal(null);
    }
    
    const btnAddCategory = document.getElementById('btn-add-category');
    if (btnAddCategory) {
        btnAddCategory.onclick = () => openCategoryModal(null);
    }

    // モーダルクローズイベントの登録
    const skillModal = document.getElementById('skill-modal');
    if (skillModal) {
        skillModal.querySelectorAll('.btn-close-skill-modal').forEach(btn => {
            btn.onclick = () => { skillModal.style.display = 'none'; };
        });
    }
    
    const categoryModal = document.getElementById('category-modal');
    if (categoryModal) {
        categoryModal.querySelectorAll('.btn-close-category-modal').forEach(btn => {
            btn.onclick = () => { categoryModal.style.display = 'none'; };
        });
    }

    // 各フォーム送信のバインド
    setupForms();
    
    // データ初期ロード
    try {
        await Promise.all([fetchCategoriesData(), fetchGradesData(), fetchSkillsData()]);
        
        // 登録されているカテゴリがない場合はSeedバナーを表示
        const seedBanner = document.getElementById('seed-setup-banner');
        if (localCategories.length === 0 && seedBanner) {
            seedBanner.style.display = 'flex';
            const btnRunSeed = document.getElementById('btn-run-seed');
            if (btnRunSeed) {
                btnRunSeed.onclick = async () => {
                    const originalHtml = btnRunSeed.innerHTML;
                    btnRunSeed.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登録中...';
                    btnRunSeed.disabled = true;
                    try {
                        await runInitialDataSeed();
                        showAlert('成功', '初期カテゴリとスキルをインポートしました！');
                        seedBanner.style.display = 'none';
                        await Promise.all([fetchCategoriesData(), fetchSkillsData()]);
                        renderCategoryList();
                        renderSkillsTable();
                    } catch(e) {
                        console.error(e);
                        showAlert('エラー', '初期データの登録に失敗しました。');
                    } finally {
                        btnRunSeed.innerHTML = originalHtml;
                        btnRunSeed.disabled = false;
                    }
                };
            }
        }
        
        // UI構築
        buildRolesCheckboxes();
        buildGradesCheckboxes();
        renderCategoryList();
        renderSkillsTable();
    } catch (e) {
        console.error('Failed initialization on skills page:', e);
        showAlert('エラー', 'データのロードに失敗しました。ネットワークを確認してください。');
    }
}

// データベースからデータ読み込み
async function fetchCategoriesData() {
    const q = query(collection(db, "m_skill_categories"), orderBy("display_order"));
    const snap = await getDocs(q);
    localCategories = [];
    snap.forEach(d => {
        localCategories.push({ id: d.id, ...d.data() });
    });
    
    // カテゴリ選択肢selectのバインド
    const sel = document.getElementById('skill-category-select');
    if (sel) {
        sel.innerHTML = '<option value="">カテゴリを選択してください...</option>';
        localCategories.forEach(c => {
            if (c.is_active !== false) {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.category_name;
                sel.appendChild(opt);
            }
        });
    }
}

async function fetchGradesData() {
    try {
        const snap = await getDocs(query(collection(db, "m_grades"), orderBy("display_order")));
        localGrades = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.grade_code) {
                localGrades.push(data.grade_code);
            }
        });
        // 万が一空の場合はフォールバック
        if (localGrades.length === 0) {
            localGrades = ['H1', 'H2', 'H3', 'K1', 'K2', 'K3'];
        }
    } catch(e) {
        console.error('Failed to load grades:', e);
        localGrades = ['H1', 'H2', 'H3', 'K1', 'K2', 'K3'];
    }
}

async function fetchSkillsData() {
    const snap = await getDocs(collection(db, "m_skills"));
    localSkills = [];
    snap.forEach(d => {
        localSkills.push({ id: d.id, ...d.data() });
    });
}

// モーダル内の複数選択チェックボックスの動的生成
function buildRolesCheckboxes() {
    const container = document.getElementById('skill-roles-checkboxes');
    if (!container) return;
    container.innerHTML = '';
    
    Object.keys(roleNameMap).forEach(roleKey => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; color: #334155; margin-right: 0.8rem;';
        label.innerHTML = `
            <input type="checkbox" name="skill-role" value="${roleKey}" style="width:1.05rem; height:1.05rem; cursor:pointer;">
            ${roleNameMap[roleKey]}
        `;
        container.appendChild(label);
    });
}

function buildGradesCheckboxes() {
    const container = document.getElementById('skill-grades-checkboxes');
    if (!container) return;
    container.innerHTML = '';
    
    localGrades.forEach(grade => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; color: #475569; padding: 0.25rem 0.5rem; background:white; border:1px solid #cbd5e1; border-radius:4px;';
        label.innerHTML = `
            <input type="checkbox" name="skill-grade" value="${grade}" style="width:1rem; height:1rem; cursor:pointer;">
            ${grade}
        `;
        container.appendChild(label);
    });
}

// カテゴリ一覧のレンダリング (左ペイン)
function renderCategoryList() {
    const container = document.getElementById('category-list-container');
    if (!container) return;
    container.innerHTML = '';

    // 「すべて」の特別枠
    const allDiv = document.createElement('div');
    allDiv.className = `category-item ${selectedCategoryId === 'all' ? 'active' : ''}`;
    allDiv.innerHTML = `
        <span><i class="fas fa-border-all" style="margin-right: 0.4rem; font-size: 0.95rem;"></i> すべて表示</span>
        <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700;">${localSkills.length}</span>
    `;
    allDiv.onclick = () => {
        selectedCategoryId = 'all';
        renderCategoryList();
        renderSkillsTable();
    };
    container.appendChild(allDiv);

    localCategories.forEach(cat => {
        const skillsInCat = localSkills.filter(s => s.category_id === cat.id).length;
        const div = document.createElement('div');
        div.className = `category-item ${selectedCategoryId === cat.id ? 'active' : ''}`;
        
        let subText = cat.is_active === false ? '<span class="category-badge-inactive">無効</span>' : '';
        div.innerHTML = `
            <span style="display: flex; align-items: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">
                <i class="fas fa-folder" style="margin-right: 0.5rem; color: ${cat.is_active === false ? '#94a3b8' : '#3b82f6'};"></i> 
                ${cat.category_name} ${subText}
            </span>
            <div style="display: flex; align-items: center; gap: 0.35rem;" class="no-print">
                <span style="font-size: 0.72rem; color: ${selectedCategoryId === cat.id ? '#8b5cf6' : '#94a3b8'}; font-weight: 700;">${skillsInCat}</span>
                <button class="btn-edit-cat" style="background:transparent; border:none; padding: 0.15rem; color:#94a3b8; cursor:pointer;" title="編集"><i class="fas fa-edit"></i></button>
            </div>
        `;
        
        div.onclick = (e) => {
            // 編集アイコンがクリックされた場合は選択をトリガーしない
            if (e.target.closest('.btn-edit-cat')) {
                openCategoryModal(cat);
                return;
            }
            selectedCategoryId = cat.id;
            renderCategoryList();
            renderSkillsTable();
        };
        container.appendChild(div);
    });
}

// スキル一覧テーブルのレンダリング (右ペイン)
function renderSkillsTable() {
    const tbody = document.getElementById('skills-table-body');
    const countLabel = document.getElementById('skills-count-label');
    const activeLabel = document.getElementById('active-category-info-label');
    if (!tbody) return;

    // 現在のアクティブカテゴリに基づき絞り込み
    const filteredSkills = selectedCategoryId === 'all' 
        ? localSkills 
        : localSkills.filter(s => s.category_id === selectedCategoryId);
    
    // ソート (カテゴリ名、スキル名順など)
    filteredSkills.sort((a, b) => (a.skill_name || '').localeCompare(b.skill_name || '', 'ja'));

    if (countLabel) countLabel.textContent = filteredSkills.length;
    
    if (activeLabel) {
        if (selectedCategoryId === 'all') {
            activeLabel.textContent = '表示: すべてのカテゴリ';
            activeLabel.style.background = '#f5f3ff';
            activeLabel.style.color = '#8b5cf6';
        } else {
            const cat = localCategories.find(c => c.id === selectedCategoryId);
            activeLabel.textContent = `表示: ${cat ? cat.category_name : '未選択'}`;
            activeLabel.style.background = '#ecfdf5';
            activeLabel.style.color = '#059669';
        }
    }

    tbody.innerHTML = '';

    if (filteredSkills.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 4rem; color: var(--text-secondary); font-weight: 500;">このカテゴリにはまだスキルが登録されていません。<br>「スキルを新規登録」ボタンから作成してください。</td></tr>`;
        return;
    }

    filteredSkills.forEach(skill => {
        const cat = localCategories.find(c => c.id === skill.category_id);
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.style.transition = 'background 0.2s';
        
        // 対象職種の日本語化表示
        const rolesDisplay = (skill.target_roles || []).map(r => roleNameMap[r] || r).join(', ') || '-';
        // 対象等級の表示
        const gradesDisplay = (skill.target_grades || []).join(', ') || '-';
        
        // 優先度バッジ
        const priorityLabels = { 'high': '高', 'medium': '中', 'low': '低' };
        const priorityText = priorityLabels[skill.priority] || '中';
        
        // 会議表示バッジ
        const isShowMeeting = skill.show_in_meeting !== false;
        
        // 有効無効バッジ
        const isActive = skill.is_active !== false;

        tr.innerHTML = `
            <td style="padding: 0.9rem 1rem; font-weight: 700; color: #1e293b;">${skill.skill_name}</td>
            <td style="padding: 0.9rem 1rem; color: var(--text-secondary); font-weight: 600;">${cat ? cat.category_name : '<span style="color:#ef4444;">(カテゴリ未紐付け)</span>'}</td>
            <td style="padding: 0.9rem 1rem; color: var(--text-secondary); font-size: 0.8rem;">${rolesDisplay}</td>
            <td style="padding: 0.9rem 1rem; color: var(--text-secondary); font-weight: 700; font-size: 0.8rem; font-family: monospace;">${gradesDisplay}</td>
            <td style="padding: 0.9rem 1rem; color: var(--text-secondary); font-size: 0.8rem; line-height: 1.4; white-space: pre-wrap; max-width: 320px;">${skill.description || '-'}</td>
            <td style="padding: 0.9rem 1.2rem; text-align: center;">
                <span class="badge ${isShowMeeting ? 'badge-meeting-on' : 'badge-meeting-off'}" style="font-size: 0.72rem; padding: 0.15rem 0.5rem; font-weight: 700; border-radius: 4px;">
                    ${isShowMeeting ? '会議対象' : '非対象'}
                </span>
            </td>
            <td style="padding: 0.9rem 0.8rem; text-align: center;">
                <span class="badge priority-${skill.priority || 'medium'}" style="font-size: 0.72rem; padding: 0.15rem 0.5rem; font-weight: 700; border-radius: 4px;">
                    ${priorityText}
                </span>
            </td>
            <td style="padding: 0.9rem 0.8rem; text-align: center;">
                <span class="badge status-${isActive ? 'active' : 'inactive'}" style="font-size: 0.72rem; padding: 0.15rem 0.5rem; font-weight: 700; border-radius: 4px;">
                    ${isActive ? '有効' : '無効'}
                </span>
            </td>
            <td style="padding: 0.9rem 1rem; text-align: right;" class="no-print">
                <button class="btn btn-edit-skill" style="padding: 0.4rem; background: transparent; color: var(--text-secondary);" title="編集"><i class="fas fa-edit"></i></button>
                <button class="btn btn-delete-skill" style="padding: 0.4rem; background: transparent; color: var(--danger);" title="削除"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;

        tr.querySelector('.btn-edit-skill').onclick = () => {
            openSkillModal(skill);
        };

        tr.querySelector('.btn-delete-skill').onclick = () => {
            showConfirm('スキル削除', `スキル「${skill.skill_name}」を完全に削除しますか？`, async () => {
                try {
                    await deleteDoc(doc(db, "m_skills", skill.id));
                    await fetchSkillsData();
                    renderCategoryList();
                    renderSkillsTable();
                    showAlert('成功', 'スキルを削除しました。');
                } catch(e) {
                    console.error(e);
                    showAlert('エラー', 'スキルの削除に失敗しました。');
                }
            });
        };

        tbody.appendChild(tr);
    });
}

// モーダル展開処理
function openSkillModal(skill) {
    editingSkillData = skill;
    const modal = document.getElementById('skill-modal');
    const title = document.getElementById('skill-modal-title');
    const form = document.getElementById('skill-form');
    if (!modal || !form) return;

    // フォームリセット
    form.reset();
    
    // チェックボックスのリセット
    form.querySelectorAll('input[name="skill-role"]').forEach(cb => cb.checked = false);
    form.querySelectorAll('input[name="skill-grade"]').forEach(cb => cb.checked = false);

    if (skill) {
        title.innerHTML = `<i class="fas fa-edit" style="color: #8b5cf6;"></i> スキルの編集: ${skill.skill_name}`;
        
        document.getElementById('skill-name').value = skill.skill_name || '';
        document.getElementById('skill-category-select').value = skill.category_id || '';
        document.getElementById('skill-requirements').value = skill.description || '';
        document.getElementById('skill-max-level').value = skill.max_level || 5;
        document.getElementById('skill-priority').value = skill.priority || 'medium';
        document.getElementById('skill-status').value = skill.is_active !== false ? 'active' : 'inactive';
        document.getElementById('skill-show-meeting').checked = skill.show_in_meeting !== false;
        document.getElementById('skill-desc').value = skill.remarks || '';
        
        // 職種のバインド
        (skill.target_roles || []).forEach(r => {
            const cb = form.querySelector(`input[name="skill-role"][value="${r}"]`);
            if (cb) cb.checked = true;
        });
        
        // 等級のバインド
        (skill.target_grades || []).forEach(g => {
            const cb = form.querySelector(`input[name="skill-grade"][value="${g}"]`);
            if (cb) cb.checked = true;
        });
    } else {
        title.innerHTML = `<i class="fas fa-graduation-cap" style="color: #8b5cf6;"></i> 新しいスキルの登録`;
        document.getElementById('skill-max-level').value = 5;
        document.getElementById('skill-priority').value = 'medium';
        document.getElementById('skill-status').value = 'active';
        document.getElementById('skill-show-meeting').checked = true;
        
        // カテゴリが現在選択中なら、それをデフォルト選択する
        if (selectedCategoryId !== 'all') {
            document.getElementById('skill-category-select').value = selectedCategoryId;
        }
    }

    modal.style.display = 'flex';
}

function openCategoryModal(category) {
    editingCategoryData = category;
    const modal = document.getElementById('category-modal');
    const title = document.getElementById('category-modal-title');
    const form = document.getElementById('category-form');
    if (!modal || !form) return;

    form.reset();

    // 削除ボタンの配置・制御 (編集時のみ削除可能)
    let btnDeleteContainer = form.querySelector('.cat-delete-container');
    if (!btnDeleteContainer) {
        btnDeleteContainer = document.createElement('div');
        btnDeleteContainer.className = 'cat-delete-container';
        // キャンセルの左隣に挿入
        const footer = form.querySelector('div[style*="justify-content: flex-end"]');
        footer.insertBefore(btnDeleteContainer, footer.firstChild);
    }
    btnDeleteContainer.innerHTML = '';

    if (category) {
        title.innerHTML = `<i class="fas fa-edit" style="color: #10b981;"></i> カテゴリの編集: ${category.category_name}`;
        
        document.getElementById('category-name').value = category.category_name || '';
        document.getElementById('category-display-order').value = category.display_order || 1;
        document.getElementById('category-status').value = category.is_active !== false ? 'active' : 'inactive';
        document.getElementById('category-desc').value = category.description || '';

        // スキルがこのカテゴリに紐づいているかチェック
        const skillsInCatCount = localSkills.filter(s => s.category_id === category.id).length;
        
        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'btn';
        btnDelete.style.cssText = 'padding: 0.6rem 1.2rem; background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; font-weight: 700; border-radius: 6px; margin-right: auto;';
        
        if (skillsInCatCount > 0) {
            btnDelete.disabled = true;
            btnDelete.style.opacity = '0.5';
            btnDelete.style.cursor = 'not-allowed';
            btnDelete.title = `このカテゴリに紐づくスキルが ${skillsInCatCount} 件存在するため削除できません。不要な場合は状態を「無効」にしてください。`;
            btnDelete.innerHTML = `<i class="fas fa-ban"></i> 削除不可 (スキルあり)`;
        } else {
            btnDelete.title = 'カテゴリを削除します';
            btnDelete.innerHTML = `<i class="fas fa-trash-alt"></i> 削除`;
            btnDelete.onclick = () => {
                showConfirm('カテゴリ削除', `カテゴリ「${category.category_name}」を削除しますか？`, async () => {
                    try {
                        await deleteDoc(doc(db, "m_skill_categories", category.id));
                        modal.style.display = 'none';
                        selectedCategoryId = 'all';
                        await fetchCategoriesData();
                        renderCategoryList();
                        renderSkillsTable();
                        showAlert('成功', 'カテゴリを削除しました。');
                    } catch(e) {
                        console.error(e);
                        showAlert('エラー', 'カテゴリの削除に失敗しました。');
                    }
                });
            };
        }
        btnDeleteContainer.appendChild(btnDelete);
    } else {
        title.innerHTML = `<i class="fas fa-folder-plus" style="color: #10b981;"></i> 新しいカテゴリを追加`;
        
        // 次のdisplay_orderの割り当て
        const maxOrder = localCategories.reduce((max, c) => Math.max(max, c.display_order || 0), 0);
        document.getElementById('category-display-order').value = maxOrder + 1;
        document.getElementById('category-status').value = 'active';
    }

    modal.style.display = 'flex';
}

// フォームの送信処理
function setupForms() {
    // スキルフォーム
    const skillForm = document.getElementById('skill-form');
    if (skillForm) {
        skillForm.onsubmit = async (e) => {
            e.preventDefault();
            const btnSubmit = skillForm.querySelector('button[type="submit"]');
            const originalHtml = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            btnSubmit.disabled = true;

            // チェックされた職種の取得
            const selectedRoles = [];
            skillForm.querySelectorAll('input[name="skill-role"]:checked').forEach(cb => {
                selectedRoles.push(cb.value);
            });
            
            // チェックされた等級の取得
            const selectedGrades = [];
            skillForm.querySelectorAll('input[name="skill-grade"]:checked').forEach(cb => {
                selectedGrades.push(cb.value);
            });

            const skillData = {
                skill_name: document.getElementById('skill-name').value.trim(),
                category_id: document.getElementById('skill-category-select').value,
                description: document.getElementById('skill-requirements').value.trim(),
                target_roles: selectedRoles,
                target_grades: selectedGrades,
                max_level: Number(document.getElementById('skill-max-level').value) || 5,
                priority: document.getElementById('skill-priority').value,
                is_active: document.getElementById('skill-status').value === 'active',
                show_in_meeting: document.getElementById('skill-show-meeting').checked,
                remarks: document.getElementById('skill-desc').value.trim(),
                updated_at: new Date().toISOString()
            };

            try {
                if (editingSkillData) {
                    await updateDoc(doc(db, "m_skills", editingSkillData.id), skillData);
                    showAlert('成功', 'スキルを更新しました。');
                } else {
                    skillData.created_at = new Date().toISOString();
                    await addDoc(collection(db, "m_skills"), skillData);
                    showAlert('成功', 'スキルを新しく登録しました。');
                }
                
                document.getElementById('skill-modal').style.display = 'none';
                await fetchSkillsData();
                renderCategoryList();
                renderSkillsTable();
            } catch(e) {
                console.error(e);
                showAlert('エラー', '保存に失敗しました。');
            } finally {
                btnSubmit.innerHTML = originalHtml;
                btnSubmit.disabled = false;
            }
        };
    }

    // カテゴリフォーム
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
        categoryForm.onsubmit = async (e) => {
            e.preventDefault();
            const btnSubmit = categoryForm.querySelector('button[type="submit"]');
            const originalHtml = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            btnSubmit.disabled = true;

            const categoryData = {
                category_name: document.getElementById('category-name').value.trim(),
                display_order: Number(document.getElementById('category-display-order').value) || 1,
                is_active: document.getElementById('category-status').value === 'active',
                description: document.getElementById('category-desc').value.trim(),
                updated_at: new Date().toISOString()
            };

            try {
                if (editingCategoryData) {
                    await updateDoc(doc(db, "m_skill_categories", editingCategoryData.id), categoryData);
                    showAlert('成功', 'カテゴリを更新しました。');
                } else {
                    categoryData.created_at = new Date().toISOString();
                    await addDoc(collection(db, "m_skill_categories"), categoryData);
                    showAlert('成功', 'カテゴリを追加しました。');
                }
                
                document.getElementById('category-modal').style.display = 'none';
                await fetchCategoriesData();
                renderCategoryList();
                renderSkillsTable();
            } catch(e) {
                console.error(e);
                showAlert('エラー', 'カテゴリの保存に失敗しました。');
            } finally {
                btnSubmit.innerHTML = originalHtml;
                btnSubmit.disabled = false;
            }
        };
    }
}

// 仕様書に基づく初期推奨データのSeed処理
async function runInitialDataSeed() {
    const batch = writeBatch(db);
    const timeStr = new Date().toISOString();
    
    // 1. カテゴリマスタの定義
    const defaultCategories = [
        { key: 'hall', category_name: 'ホール', description: '接客、案内、注文、配膳、会計など', display_order: 1 },
        { key: 'drink', category_name: 'ドリ場', description: 'ドリンク作成、補充、提供管理など', display_order: 2 },
        { key: 'kitchen', category_name: 'キッチン', description: '調理補助、盛り付け、洗い場、仕込みなど', display_order: 3 },
        { key: 'yaki', category_name: '焼き場', description: '焼き台補助、焼き台独り立ちなど', display_order: 4 },
        { key: 'hygiene', category_name: '衛生', description: '清掃、食品衛生、温度管理など', display_order: 5 },
        { key: 'mgmt', category_name: '店舗管理', description: 'レジ締め、発注、棚卸、シフトなど', display_order: 6 },
        { key: 'education', category_name: '教育', description: '新人教育、指示出し、育成補助など', display_order: 7 },
        { key: 'kpi', category_name: '数値管理', description: '売上、人件費、原価、KPI理解など', display_order: 8 }
    ];
    
    // ドキュメント参照をあらかじめ作成
    const categoryRefs = {};
    defaultCategories.forEach(cat => {
        const ref = doc(collection(db, "m_skill_categories"));
        categoryRefs[cat.key] = ref.id;
        batch.set(ref, {
            category_name: cat.category_name,
            description: cat.description,
            display_order: cat.display_order,
            is_active: true,
            created_at: timeStr,
            updated_at: timeStr
        });
    });

    // 2. スキルマスタの定義
    const defaultSkills = [
        { category: 'hall', skill_name: 'お客様案内', description: 'ご来店のお客様を人数や状況に応じた適切なテーブルへご案内し、ファーストオーダーやおしぼりの提供までをスムーズに行える', roles: ['Staff', 'PartTimer'], grades: ['H1', 'H2'], priority: 'medium' },
        { category: 'hall', skill_name: 'オーダー対応', description: 'ハンディ端末の基本操作やおすすめ商品の説明ができ、お客様からの質問（アレルギーや量）に正しく答えながら注文を受けられる', roles: ['Staff', 'PartTimer'], grades: ['H1', 'H2'], priority: 'medium' },
        { category: 'hall', skill_name: '電話予約対応', description: '電話予約を受け、日時・人数・名前・連絡先・席の希望・注意事項（アレルギー等）を規定のフォーマットに沿って正確に受け答え・記録できる', roles: ['Staff', 'PartTimer', 'Manager'], grades: ['H1', 'H2', 'H3'], priority: 'medium' },
        { category: 'hall', skill_name: '会計対応', description: 'レジ操作（個別会計、カード、各種キャッシュレス決済対応など）を正確に行い、伝票管理、領収書発行、お見送りまでをミスなく完遂できる', roles: ['Staff', 'PartTimer'], grades: ['H2', 'H3'], priority: 'high' },
        
        { category: 'drink', skill_name: 'ドリンク作成補助', description: '基本ドリンク（ビール、サワー、ソフトドリンク等）の規定量を覚え、指示された通りにミスなく作成・提供用のトレイに準備できる', roles: ['Staff', 'PartTimer'], grades: ['H1', 'H2'], priority: 'low' },
        { category: 'drink', skill_name: 'ドリ場独り立ち', description: 'ピーク時（通常営業）においてドリンク作成、順番判断、グラス洗い、氷・アルコール等の在庫補充を自分一人で判断してコントロールできる', roles: ['Staff', 'PartTimer'], grades: ['H2', 'H3'], priority: 'high' },
        
        { category: 'kitchen', skill_name: '盛り付け補助', description: '一品料理やデザートの盛り付け基準（量、配置、薬味）を正しく理解し、スピーディーかつ綺麗に皿盛りを完成させてデシャップへ渡せる', roles: ['Staff', 'PartTimer'], grades: ['K1', 'K2'], priority: 'medium' },
        { category: 'kitchen', skill_name: '仕込み補助', description: '野菜のカット、ソースの計量、串刺しなどの基本仕込みをレシピ通りに安全かつ規定時間内に完了させることができる', roles: ['Staff', 'PartTimer'], grades: ['K1', 'K2'], priority: 'medium' },
        
        { category: 'yaki', skill_name: '焼き台補助', description: '焼き台担当者のアシストとして、必要な串（肉・野菜）の事前準備、焼き加減チェックのサポート、焼き上がった商品の提供補助を阿吽の呼吸でこなせる', roles: ['Staff', 'PartTimer'], grades: ['K1', 'K2'], priority: 'high' },
        { category: 'yaki', skill_name: '焼き台独り立ち', description: '通常営業時に、複数種類の串の焼き加減・提供順・時間管理を自分で行い、高いクオリティを維持しながら単独で焼き台を担当できる', roles: ['Staff', 'Manager'], grades: ['K2', 'K3'], priority: 'high' },
        
        { category: 'hygiene', skill_name: '清掃基準理解', description: '毎日の営業前後の清掃箇所（ダクト、フライヤー、グリスト、トイレ等）の手順と洗剤使用方法を理解し、衛生基準に沿ってチェックリスト通りに遂行できる', roles: ['Staff', 'PartTimer'], grades: ['H1', 'K1'], priority: 'low' },
        { category: 'hygiene', skill_name: '食品衛生ルール遵守', description: '手洗いの徹底、食材の保管温度管理、先入れ先出し、賞味期限切れの廃棄ルールを厳守し、二次汚染を起こさないように衛生的な管理を徹底できる', roles: ['Staff', 'PartTimer'], grades: ['H1', 'K1', 'H2', 'K2'], priority: 'medium' },
        
        { category: 'mgmt', skill_name: 'レジ締め', description: '営業終了後にレジ内の現金・金券類を集計し、売上データとの差異確認、レジ内残高調整、違算発生時の報告書の作成までを完遂できる', roles: ['Staff', 'Manager'], grades: ['H3', 'H4', 'K3'], priority: 'high' },
        { category: 'mgmt', skill_name: '発注補助', description: '各種食材、飲料、備品の現在の在庫状況を確認し、発注閾値に基づいてシステムまたは用紙を用いて適切に必要数量の発注登録を行える', roles: ['Staff', 'PartTimer'], grades: ['H2', 'K2'], priority: 'medium' },
        { category: 'mgmt', skill_name: '棚卸補助', description: '月末の在庫一斉棚卸しにおいて、指定されたエリア（冷凍庫、乾物庫等）のアイテム数を正確にカウントし、規定の記録シートへ記入・入力できる', roles: ['Staff', 'PartTimer'], grades: ['H2', 'K2'], priority: 'medium' },
        
        { category: 'education', skill_name: '新人への基本指導', description: '新人（アルバイト等）の指導担当として、言葉遣い、基本オペレーション、マニュアルの手順を根気強く、正しい手本を見せながら教育できる', roles: ['Staff', 'PartTimer', 'Manager'], grades: ['H2', 'K2', 'H3', 'K3'], priority: 'medium' },
        
        { category: 'kpi', skill_name: '売上・客単価の理解', description: '店舗の目標売上に対して、現在の実績、客数、客単価の関係性を理解し、朝礼やミーティングでメンバーへ実績報告と今夜の目標共有ができる', roles: ['Staff', 'Manager'], grades: ['H3', 'K3', 'H4'], priority: 'medium' },
        { category: 'kpi', skill_name: '人時売上の理解', description: 'シフトコントロールや店舗運営において、総労働時間に対する売上の比率（人時売上）を意識し、状況に応じたスタッフの早期退勤や配置調整を指示できる', roles: ['Staff', 'Manager'], grades: ['H3', 'K3', 'H4'], priority: 'high' }
    ];

    defaultSkills.forEach(skill => {
        const ref = doc(collection(db, "m_skills"));
        batch.set(ref, {
            skill_name: skill.skill_name,
            category_id: categoryRefs[skill.category] || '',
            description: skill.description,
            target_roles: skill.roles,
            target_grades: skill.grades,
            max_level: 5,
            priority: skill.priority,
            is_active: true,
            show_in_meeting: true,
            remarks: '',
            created_at: timeStr,
            updated_at: timeStr
        });
    });

    await batch.commit();
}
