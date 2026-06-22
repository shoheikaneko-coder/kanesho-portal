import { db } from './firebase.js';
import { collection, getDocs, getDoc, setDoc, updateDoc, doc, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let localPeriodSettings = null; // 現在の評価期設定
let activeEvaluations = [];    // 人事・店長向けの今期の評価リスト
let myEvaluation = null;        // 自分自身の今期の評価データ
let subordinateUsers = [];      // 評価対象の部下リスト
let evaluationTemplates = {};   // ロードされたテンプレート
let activeTab = 'self';         // 表示中のタブ ('self', 'subordinates', 'admin', 'president')
let selectedEvalDetail = null;  // モーダル表示中の評価詳細オブジェクト

let editTemplates = {};        // 編集モーダル用のテンプレート一時保存バッファ
let activeEditTemplateId = ''; // 編集中のテンプレートID
let activeEditItems = [];      // 編集中の項目リスト
let allStaffUsersForAdmin = []; // 管理者タブの評価対象者選択用
let globalStoreMapForEval = {}; // 店舗ID -> 店舗名のマッピング
let globalJobTitles = [];       // マスタからロードした一意な役職（job_title）リスト

export const evaluationPageHtml = `
    <style>
        .eval-score-cell { position: relative; }
        .eval-tooltip {
            display: none; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
            background: rgba(30, 41, 59, 0.95); color: white; padding: 0.6rem 0.8rem; border-radius: 6px;
            font-size: 0.72rem; line-height: 1.4; width: 260px; z-index: 1000; pointer-events: none;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 8px; text-align: left;
        }
        .eval-tooltip::after {
            content: ''; position: absolute; top: 100%; left: 50%; margin-left: -6px;
            border-width: 6px; border-style: solid; border-color: rgba(30, 41, 59, 0.95) transparent transparent transparent;
        }
        .eval-score-cell:hover .eval-tooltip {
            display: block; animation: fadeInTooltip 0.15s ease-out forwards;
        }
        @keyframes fadeInTooltip {
            from { opacity: 0; transform: translate(-50%, 5px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
    </style>
    <div id="evaluation-page-container" class="animate-fade-in" style="padding: 1rem 1.5rem; max-width: 1200px; margin: 0 auto; box-sizing: border-box; font-family: inherit;">
        
        <!-- ヘッダーエリア -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;" class="no-print">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem; font-size: 1.5rem; font-weight: 900; color: var(--text-primary);">
                    <i class="fas fa-star" style="color: #ec4899;"></i>
                    人事評価システム
                </h2>
                <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.3rem; font-weight: 600;">
                    年４回の評価を通じて成長をサポートします
                </p>
            </div>
            <div style="display: flex; gap: 0.6rem; align-items: center;">
                <button class="btn" id="btn-eval-back" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); font-weight: 700; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem;">
                    <i class="fas fa-arrow-left"></i> 人事総務へ戻る
                </button>
            </div>
        </div>

        <!-- 評価期インフォバナー -->
        <div id="eval-period-banner" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border); border-radius: 12px; display: flex; align-items: center; gap: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                    <i class="fas fa-tasks"></i>
                </div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; margin-bottom: 0.2rem;">評価プロセス</div>
                    <div id="banner-status-text" style="font-size: 1.05rem; font-weight: 800; color: #1e293b;">読込中...</div>
                </div>
            </div>
            
            <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border); border-radius: 12px; display: flex; align-items: center; gap: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; margin-bottom: 0.2rem;">現在の評価期</div>
                    <div id="banner-period-title" style="font-size: 1.05rem; font-weight: 800; color: #1e293b;">読込中...</div>
                </div>
            </div>

            <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border); border-radius: 12px; display: flex; align-items: center; gap: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                    <i class="fas fa-tags"></i>
                </div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; margin-bottom: 0.2rem;">評価区分</div>
                    <div id="banner-period-desc" style="font-size: 1.05rem; font-weight: 800; color: #1e293b;">読込中...</div>
                </div>
            </div>
        </div>

        <div class="tabs-container no-print" style="display: flex; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem; gap: 0.5rem; flex-wrap: wrap;">
            <button class="tab-btn" id="tab-admin" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">
                全体管理ダッシュボード
            </button>
            <button class="tab-btn active" id="tab-self" style="padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">
                ①自己評価を入力
            </button>
            <button class="tab-btn" id="tab-subordinates" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">
                ②部下の評価を入力 <span class="count-badge" id="subordinates-badge" style="display:none; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 10px; background: #ec4899; color: white;">0</span>
            </button>
            <button class="tab-btn" id="tab-president" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s;">
                ③社長承認 <span class="count-badge" id="president-badge" style="display:none; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 10px; background: #8b5cf6; color: white;">0</span>
            </button>
            
            <!-- 管理者用 特殊操作ボタン (右寄せ) -->
            <div style="margin-left: auto; display: flex; gap: 0.5rem; align-items: center; padding-bottom: 0.5rem;" id="admin-management-buttons">
                <button class="btn btn-secondary" id="btn-admin-edit-templates-tab" style="display: none; padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 700; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-edit"></i> 評価項目マスタ編集
                </button>
                <button class="btn btn-secondary" id="btn-admin-cancel-period-tab" style="display: none; padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 700; border: 1px solid #fecdd3; background: #fff1f2; color: #be123c; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-trash-alt"></i> 評価リセット
                </button>
                <button class="btn btn-primary" id="btn-admin-start-period-tab" style="display: none; padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 800; border: none; background: #10b981; color: white; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 4px rgba(16,185,129,0.2);">
                    <i class="fas fa-play"></i> 評価を新規開始する
                </button>
            </div>
        </div>

        <!-- メインコンテンツ表示エリア -->
        <div id="eval-main-content">
            <!-- 各タブの中身がJSでレンダリングされます -->
        </div>



    </div>

    <!-- 評価期新規開始画面 (インライン展開) -->
    <style>
        .eval-list-grid {
            display: grid;
            grid-template-columns: 30px 2.5fr 1.5fr 1fr 1fr;
            gap: 1rem;
            align-items: center;
            width: 100%;
            box-sizing: border-box;
        }
        @media (min-width: 1024px) {
            .eval-list-grid {
                grid-template-columns: 30px 3fr 2fr 1.5fr 1.5fr;
            }
        }
    </style>
    <div id="period-start-container" style="display: none; margin-bottom: 2rem;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-xl); width: 100%; padding: 0; overflow: hidden;">
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-play" style="color: #10b981;"></i>評価期を新規開始する</h3>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">対象者とスケジュールを設定し、新しい評価期をスタートします</p>
                </div>
                <button type="button" onclick="closePeriodStartForm()" class="btn" style="background: white; border: 1px solid #cbd5e1; font-size: 0.9rem; font-weight: 700; cursor: pointer; color: #475569; border-radius: 8px; padding: 0.5rem 1rem;">
                    <i class="fas fa-times"></i> 閉じる
                </button>
            </div>
            
            <div style="padding: 2rem; background: #ffffff;">
                <form id="form-start-period" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%;">
                    <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; max-width: 800px;">
                        <div class="input-group" style="flex: 1; margin: 0;">
                            <div style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">新規開始する評価期</div>
                            <div style="display: flex; gap: 0.5rem;">
                                <select id="input-period-year" required style="flex: 1; font-family: monospace; font-size: 1.05rem; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; background: white;">
                                    <option value="" disabled selected>年を選択</option>
                                    <option value="2025">2025年</option>
                                    <option value="2026">2026年</option>
                                    <option value="2027">2027年</option>
                                    <option value="2028">2028年</option>
                                    <option value="2029">2029年</option>
                                </select>
                                <select id="input-period-month" required style="flex: 1; font-family: monospace; font-size: 1.05rem; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; background: white;">
                                    <option value="" disabled selected>月を選択</option>
                                    <option value="01">01月</option>
                                    <option value="02">02月</option>
                                    <option value="03">03月</option>
                                    <option value="04">04月</option>
                                    <option value="05">05月</option>
                                    <option value="06">06月</option>
                                    <option value="07">07月</option>
                                    <option value="08">08月</option>
                                    <option value="09">09月</option>
                                    <option value="10">10月</option>
                                    <option value="11">11月</option>
                                    <option value="12">12月</option>
                                </select>
                            </div>
                        </div>
                        <div class="input-group" style="flex: 1; margin: 0;">
                            <div style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">評価の種類</div>
                            <select id="select-period-provisional" required style="width: 100%; background: white; font-weight: 600; font-size: 1.05rem; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box;">
                                <option value="" disabled selected>評価区分を選択してください</option>
                                <option value="true">仮評価 (仮等級が付与されます)</option>
                                <option value="false">本評価 (次期の等級が付与されます・給与反映)</option>
                            </select>
                        </div>
                        <div class="input-group" style="flex: 1; margin: 0;">
                            <div style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">対象の雇用形態</div>
                            <select id="select-period-employment" required style="width: 100%; background: white; font-weight: 600; font-size: 1.05rem; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box;" onchange="window.renderEvalUserList()">
                                <option value="Executive">役員</option>
                                <option value="Full-time" selected>正社員</option>
                                <option value="Part-time">アルバイト</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style="margin: 0; display: flex; flex-direction: column; gap: 0.8rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                            <div style="font-weight: 700; color: #475569; font-size: 0.85rem; margin: 0;">評価対象者の選択</div>
                            <div id="selection-counter-badge" style="font-size: 0.85rem; font-weight: 800; color: #10b981; background: #ecfdf5; padding: 0.4rem 1rem; border-radius: 20px; border: 1px solid #a7f3d0; box-shadow: 0 1px 2px rgba(16, 185, 129, 0.05);">
                                <i class="fas fa-users"></i> 選択中: -名 / 全-名
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button type="button" class="btn btn-secondary" onclick="window.toggleAllEvalUsers(true)" style="padding: 0.4rem 1rem; font-size: 0.85rem; border-color: #cbd5e1; font-weight: 600;"><i class="fas fa-check-square"></i> すべて選択</button>
                            <button type="button" class="btn btn-secondary" onclick="window.toggleAllEvalUsers(false)" style="padding: 0.4rem 1rem; font-size: 0.85rem; border-color: #cbd5e1; font-weight: 600;"><i class="far fa-square"></i> すべて解除</button>
                            <button type="button" class="btn btn-secondary" onclick="window.selectOnlySelfForEval()" style="padding: 0.4rem 1rem; font-size: 0.85rem; border-color: #3b82f6; color: #2563eb; background: #eff6ff; font-weight: 600;"><i class="fas fa-user-shield"></i> テスト用 (自分のみ)</button>
                        </div>
                        <div class="eval-list-grid" style="padding: 0.8rem 1.2rem; background: #e2e8f0; border-radius: 8px 8px 0 0; font-size: 0.85rem; font-weight: 700; color: #475569; margin-top: 0.5rem; border: 1px solid #cbd5e1; border-bottom: none; position: sticky; top: 0; z-index: 10;">
                            <div></div> <!-- チェックボックス用余白 -->
                            <div>従業員名</div>
                            <div>所属店舗</div>
                            <div>雇用形態</div>
                            <div>役職</div>
                        </div>
                        <div id="start-period-user-list" style="max-height: 500px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 0 0 8px 8px; background: white; display: flex; flex-direction: column;">
                            <!-- 対象者リストがJSで挿入されます -->
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; border-top: 1px solid #e2e8f0; padding-top: 1.5rem;">
                        <button type="button" onclick="closePeriodStartForm()" class="btn btn-secondary" style="font-weight: 700; padding: 0.8rem 1.5rem; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary);">
                            キャンセル
                        </button>
                        <button type="submit" class="btn btn-primary" style="font-weight: 800; padding: 0.8rem 2.5rem; background: #10b981; border-color: #10b981; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.15); font-size: 1rem;">
                            <i class="fas fa-play"></i> 新しい評価期を開始する
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- 評価項目マスタ編集画面 (インライン展開) -->
    <div id="template-editor-container" style="display: none; margin-bottom: 2rem;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-xl); width: 100%; height: 80vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
            <!-- モーダルヘッダー -->
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div>
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-edit" style="color: #ec4899;"></i>評価項目マスタ編集</h3>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">各職位・シートごとの評価項目をカスタマイズします</p>
                </div>
                <button type="button" id="btn-close-template-modal" class="btn" style="background: white; border: 1px solid #cbd5e1; font-size: 0.9rem; font-weight: 700; cursor: pointer; color: #475569; border-radius: 8px; padding: 0.5rem 1rem;">
                    <i class="fas fa-times"></i> 閉じる
                </button>
            </div>
            
            <!-- モーダルボディ (スクロール可能) -->
            <div id="modal-template-body" style="padding: 1.5rem; overflow-y: auto; flex: 1; background: #f8fafc;">
                
                <!-- ビュー1：テンプレート一覧画面 -->
                <div id="template-view-list">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0; color: #1e293b; font-size: 1.05rem;"><i class="fas fa-list"></i> 登録済みテンプレート一覧</h4>
                        <button class="btn btn-primary" onclick="window.createNewTemplate()" style="font-weight: 700; padding: 0.5rem 1rem; font-size: 0.8rem; background: #10b981; border: none; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                            <i class="fas fa-plus"></i> 新規作成
                        </button>
                    </div>
                    <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white;">
                        <table class="eval-table" style="font-size: 0.85rem;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="width: 250px; text-align: left;">テンプレート表示名称</th>
                                    <th style="text-align: left; color:#64748b;">システムID</th>
                                    <th style="width: 120px; text-align: center;">ステータス</th>
                                    <th style="width: 380px; text-align: center;">操作</th>
                                </tr>
                            </thead>
                            <tbody id="template-list-tbody">
                                <!-- 一覧行が動的に生成されます -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ビュー2：項目編集画面 -->
                <div id="template-view-editor" style="display: none;">
                    <!-- テンプレート選択と操作エリア (エディタのヘッダー) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.8rem;">
                            <button class="btn" onclick="window.backToTemplateList()" style="background: #f1f5f9; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700; color: #475569; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                                <i class="fas fa-arrow-left"></i> 一覧へ戻る
                            </button>
                            <div style="margin-left: 0.5rem;">
                                <label style="font-weight: 800; font-size: 0.8rem; color: #64748b; display: block; margin-bottom: 0.1rem;">編集中のテンプレート:</label>
                                <span id="editor-current-template-name" style="font-weight: 800; font-size: 1.05rem; color: #1e293b;"></span>
                                <span id="editor-current-template-id" style="font-size: 0.75rem; color: #94a3b8; font-family: monospace; margin-left: 0.5rem;"></span>
                            </div>
                        </div>
                    </div>

                    <!-- 対象役職の選択エリア -->
                    <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1rem;">
                        <div style="font-weight: 800; font-size: 0.9rem; color: #1e293b; margin-bottom: 0.5rem;"><i class="fas fa-users" style="color: #6366f1; margin-right: 0.4rem;"></i>このシートを適用する役職</div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.8rem;">チェックを入れた役職のスタッフに対して、次回の評価期開始時からこのシートが自動的に割り当てられます。（運用中の場合）</div>
                        <div id="editor-target-job-titles" style="display: flex; gap: 1rem; flex-wrap: wrap;">
                            <!-- ここにチェックボックスが動的に生成されます -->
                        </div>
                    </div>

                    <!-- 警告メッセージ表示エリア -->
                    <div id="template-validation-warning" style="display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 0.75rem 1rem; color: #991b1b; font-size: 0.82rem; font-weight: 700; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                        <i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>
                        <span id="validation-warning-text">現在の項目数は24個ではありません。自動等級判定（120点満点）の整合性が崩れる可能性があります。</span>
                    </div>

                    <!-- 項目編集テーブル -->
                    <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; margin-bottom: 1rem;">
                        <div style="overflow-x: auto;">
                            <table class="eval-table" style="font-size: 0.82rem;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="width: 70px; text-align: center;">順序</th>
                                        <th style="width: 150px; text-align: left;">カテゴリ</th>
                                        <th style="text-align: left; width: 35%;">項目タイトル（基準・行動定義）</th>
                                        <th style="text-align: left; width: 45%;">詳細説明（評価のポイント）</th>
                                        <th style="width: 60px; text-align: center;">操作</th>
                                    </tr>
                                </thead>
                                <tbody id="template-items-tbody">
                                    <!-- 項目行が動的に生成されます -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- 項目追加ボタン -->
                    <div style="display: flex; justify-content: flex-start; padding: 0.5rem 0; margin-bottom: 1rem;">
                        <button class="btn btn-secondary" id="btn-template-add-item" style="font-weight: 700; font-size: 0.8rem; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary);">
                            <i class="fas fa-plus-circle"></i> 項目を追加する
                        </button>
                    </div>
                </div>
            </div>

            <!-- モーダルフッター -->
            <!-- モーダルフッター -->
            <div id="template-view-editor-footer" style="display: none; padding: 1rem 1.8rem; border-top: 1px solid var(--border); background: white; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
                    合計項目数: <span id="template-total-items-count" style="font-weight: 900; color: #1e293b;">0</span> / 24
                </div>
                <div style="display: flex; gap: 0.8rem;">
                    <button class="btn btn-primary" id="btn-save-template" style="font-weight: 800; padding: 0.6rem 2rem; background: #2563eb; border-color: #2563eb; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.15);">変更を保存する</button>
                </div>
            </div>
        </div>
    </div>

    <!-- 過去データ入力モーダル -->
    <div id="legacy-import-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 3000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel" style="background: white; width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-file-import" style="color: #64748b;"></i>過去データのアーカイブ手入力</h3>
                <button type="button" id="btn-close-legacy-modal" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'"><i class="fas fa-times"></i></button>
            </div>
            
            <div style="padding: 1.5rem 1.8rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;">
                <!-- 基本設定 -->
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    <div class="input-group" style="flex: 1; margin: 0;">
                        <label style="font-weight: 700; color: #475569; font-size:0.8rem;">対象期 (例: 2025-12)</label>
                        <input type="text" id="legacy-period" placeholder="YYYY-MM" required style="font-family: monospace; font-size:1.05rem; padding: 0.55rem 0.8rem;">
                    </div>
                    <div class="input-group" style="flex: 1; margin: 0;">
                        <label style="font-weight: 700; color: #475569; font-size:0.8rem;">対象スタッフ</label>
                        <select id="legacy-user-select" style="padding: 0.55rem 0.8rem; background: white; font-weight: 600; font-size:0.95rem;"></select>
                    </div>
                    <div class="input-group" style="flex: 1; margin: 0;">
                        <label style="font-weight: 700; color: #475569; font-size:0.8rem;">適用テンプレート</label>
                        <select id="legacy-template-select" style="padding: 0.55rem 0.8rem; background: white; font-weight: 600; font-size:0.95rem;"></select>
                    </div>
                </div>

                <div class="input-group" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                    <div style="flex: 1;">
                        <label style="font-weight: 700; color: #475569; font-size:0.8rem;">当時の等級 (任意)</label>
                        <input type="text" id="legacy-grade" placeholder="例: J1" style="padding: 0.55rem 0.8rem; font-family: monospace;">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-weight: 700; color: #475569; font-size:0.8rem;">当時の総合点数</label>
                        <input type="number" id="legacy-total-score" placeholder="合計点" style="padding: 0.55rem 0.8rem; font-weight:800;">
                    </div>
                </div>

                <!-- 項目入力 -->
                <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; margin-bottom: 1rem;">
                    <div style="padding: 1rem; background: #f1f5f9; border-bottom: 1px solid var(--border); font-size: 0.8rem; color: #475569;">
                        各項目に対し、当時の点数を入力してください。<br>
                        <span style="color: #be123c; font-weight: 700;"><i class="fas fa-exclamation-circle"></i> 過去の項目構成（項目数・名称）が現在と異なる場合</span><br>
                        「評価項目マスタの編集」から現在のテンプレートを<b>「複製」</b>し、過去の評価フォーマットを作成した上でここから適用してください。
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="eval-table" style="font-size: 0.82rem;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="width: 250px; text-align: left;">対象の評価項目タイトル</th>
                                    <th style="text-align: left;">当時のメモ (任意)</th>
                                    <th style="width: 100px; text-align: center;">当時の点数</th>
                                </tr>
                            </thead>
                            <tbody id="legacy-items-tbody">
                                <!-- JSで動的生成 -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 総括コメント -->
                <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border);">
                    <h5 style="margin: 0 0 0.6rem; color: #475569; font-weight: 800;">面談メモ・総括コメント</h5>
                    <textarea id="legacy-memo" rows="4" placeholder="当時の所見やフィードバック内容を入力" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; font-family:inherit; resize:vertical;"></textarea>
                </div>
            </div>

            <!-- モーダルフッター -->
            <div style="padding: 1rem 1.8rem; border-top: 1px solid var(--border); background: white; display: flex; justify-content: flex-end; align-items: center; gap: 0.8rem; flex-shrink: 0;">
                <button class="btn btn-secondary" id="btn-close-legacy-modal-footer" style="font-weight: 700; padding: 0.6rem 1.2rem; background: white; border: 1px solid #cbd5e1; color: var(--text-secondary);">キャンセル</button>
                <button class="btn btn-primary" id="btn-save-legacy" style="font-weight: 800; padding: 0.6rem 2rem; background: #10b981; border-color: #10b981; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.15);">アーカイブ保存する</button>
            </div>
        </div>
    <!-- 評価履歴一覧モーダル -->
    <div id="eval-history-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 3000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel" style="background: white; width: 100%; max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-history" style="color: #64748b;"></i>過去の評価履歴</h3>
                <button type="button" id="btn-close-history-modal" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem 1.8rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;" id="history-content-area">
                <!-- JSで動的生成 -->
            </div>
        </div>
    </div>

    <!-- 評価履歴詳細モーダル -->
    <div id="eval-history-detail-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 3100; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel" style="background: white; width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;" id="history-detail-title">履歴詳細</h3>
                <button type="button" id="btn-close-history-detail-modal" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem 1.8rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;" id="history-detail-content">
            </div>
        </div>
    </div>

    <style>
        .tab-btn.active {
            color: var(--primary) !important;
            border-bottom-color: var(--primary) !important;
        }
        .tab-btn:hover:not(.active) {
            color: var(--text-primary);
            background: #f8fafc;
        }
        .eval-status-badge {
            font-size: 0.75rem;
            font-weight: 800;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            display: inline-block;
        }
        .status-not_started { background: #e2e8f0; color: #475569; }
        .status-self_evaluating { background: #fef3c7; color: #d97706; }
        .status-self_submitted { background: #dbeafe; color: #1d4ed8; }
        .status-manager_evaluating { background: #e0f2fe; color: #0369a1; }
        .status-interviewing { background: #fae8ff; color: #a21caf; }
        .status-president_pending { background: #ffe4e6; color: #be123c; }
        .status-approved { background: #dcfce7; color: #15803d; }
        .status-notified { background: #ede9fe; color: #6d28d9; }

        .eval-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }
        .eval-table th {
            padding: 0.8rem 1rem;
            font-weight: 800;
            color: #475569;
            background: #f8fafc;
            border-bottom: 2px solid var(--border);
        }
        .eval-table td {
            padding: 0.8rem 1rem;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }
        
        .score-btn {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 1px solid #cbd5e1;
            background: white;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
            font-size: 0.85rem;
            color: #475569;
        }
        .score-btn.selected-self {
            background: #2563eb;
            color: white;
            border-color: #2563eb;
            box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
        .score-btn.selected-manager {
            background: #7c3aed;
            color: white;
            border-color: #7c3aed;
            box-shadow: 0 2px 4px rgba(124, 58, 237, 0.2);
        }
        .score-btn:hover:not(.selected-self):not(.selected-manager) {
            background: #f1f5f9;
            border-color: #94a3b8;
        }
        .score-btn:disabled {
            cursor: not-allowed;
            opacity: 0.9;
        }
    </style>
`;

export async function initEvaluationPage() {
    // 戻るボタン
    const btnBack = document.getElementById('btn-eval-back');
    if (btnBack) {
        btnBack.onclick = () => window.navigateTo('hr_hub');
    }

    // モーダルクローズ
    const btnCloseModal = document.getElementById('btn-close-eval-modal');
    if (btnCloseModal) {
        btnCloseModal.onclick = () => {
            document.getElementById('eval-detail-modal').style.display = 'none';
        };
    }

    // 過去データモーダルクローズ＆保存
    const btnCloseLegacy = document.getElementById('btn-close-legacy-modal');
    if (btnCloseLegacy) btnCloseLegacy.onclick = window.closeLegacyImportModal;
    const btnCloseLegacyFooter = document.getElementById('btn-close-legacy-modal-footer');
    if (btnCloseLegacyFooter) btnCloseLegacyFooter.onclick = window.closeLegacyImportModal;
    const btnSaveLegacy = document.getElementById('btn-save-legacy');
    if (btnSaveLegacy) btnSaveLegacy.onclick = window.saveLegacyImportData;

    // 履歴モーダルクローズ
    const btnCloseHistory = document.getElementById('btn-close-history-modal');
    if (btnCloseHistory) btnCloseHistory.onclick = () => document.getElementById('eval-history-modal').style.display = 'none';
    const btnCloseHistoryDetail = document.getElementById('btn-close-history-detail-modal');
    if (btnCloseHistoryDetail) btnCloseHistoryDetail.onclick = () => document.getElementById('eval-history-detail-modal').style.display = 'none';

    // タブクリックイベント
    setupTabs();

    // 評価項目マスタ編集モーダルのボタンイベント紐付け
    const btnCloseTemp = document.getElementById('btn-close-template-modal');
    if (btnCloseTemp) {
        btnCloseTemp.onclick = () => {
            closeTemplateEditorModal();
        };
    }
    const btnCloseTempFooter = document.getElementById('btn-close-template-modal-footer');
    if (btnCloseTempFooter) {
        btnCloseTempFooter.onclick = () => {
            closeTemplateEditorModal();
        };
    }
    const btnAddTempItem = document.getElementById('btn-template-add-item');
    if (btnAddTempItem) {
        btnAddTempItem.onclick = () => {
            addTemplateItem();
        };
    }
    const btnSaveTemp = document.getElementById('btn-save-template');
    if (btnSaveTemp) {
        btnSaveTemp.onclick = () => {
            window.saveActiveTemplate();
        };
    }
    const btnDuplicateTemp = document.getElementById('btn-template-duplicate');
    if (btnDuplicateTemp) {
        btnDuplicateTemp.onclick = () => {
            window.duplicateTemplate();
        };
    }
    const btnAddTempNew = document.getElementById('btn-template-add-new');
    if (btnAddTempNew) {
        btnAddTempNew.onclick = () => {
            window.createNewTemplate();
        };
    }

    // トップタブの「評価を新規開始する」ボタンイベント
    const btnAdminStart = document.getElementById('btn-admin-start-period-tab');
    if (btnAdminStart) {
        btnAdminStart.onclick = window.openPeriodStartForm;
    }

    // 評価期開始イベント
    const formStart = document.getElementById('form-start-period');
    if (formStart) {
        formStart.onsubmit = async (e) => {
            e.preventDefault();
            const year = document.getElementById('input-period-year').value;
            const month = document.getElementById('input-period-month').value;
            
            if (!year || !month) {
                return showAlert('入力エラー', '評価開始の「年」と「月」を選択してください。');
            }
            
            const periodName = `${year}-${month}`;
            const provSelect = document.getElementById('select-period-provisional').value;
            
            if (!provSelect) {
                return showAlert('入力エラー', '評価区分（仮評価/本評価）を選択してください。');
            }
            
            const isProvisional = provSelect === 'true';

            showConfirm('評価期の開始', `新評価期「${periodName}期 (${isProvisional ? '仮評価' : '本評価'})」を開始しますか？\n（在職中のすべての対象従業員の評価シートが自動作成されます）`, async () => {
                const btnSubmit = formStart.querySelector('button[type="submit"]');
                const originalHtml = btnSubmit.innerHTML;
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 初期化中...';
                btnSubmit.disabled = true;

                try {
                    const checkboxes = document.querySelectorAll('.eval-user-checkbox:checked');
                    const selectedUserIds = Array.from(checkboxes).map(cb => cb.value);
                    if (selectedUserIds.length === 0) {
                        btnSubmit.innerHTML = originalHtml;
                        btnSubmit.disabled = false;
                        return showAlert('エラー', '評価対象者を1人以上選択してください。');
                    }
                    const activeUsers = allStaffUsersForAdmin.filter(u => selectedUserIds.includes(u.id));

                    const gradesSnap = await getDocs(collection(db, "m_grades"));
                    const gradeMap = {};
                    gradesSnap.forEach(d => {
                        const data = d.data();
                        if (data.grade_code) {
                            gradeMap[data.grade_code] = data;
                        }
                    });

                    const batch = writeBatch(db);
                    
                    const settingsRef = doc(db, "settings", "evaluation");
                    batch.set(settingsRef, {
                        active_period: periodName,
                        is_provisional: isProvisional,
                        status: 'open',
                        updated_at: new Date().toISOString()
                    });

                    for (const u of activeUsers) {
                        const gradeConfig = gradeMap[u.GradeCode] || {};
                        const userJobTitle = gradeConfig.job_title;
                        
                        let templateId = 'general'; // フォールバック
                        if (userJobTitle && Object.keys(editTemplates).length > 0) {
                            const templates = Object.values(editTemplates);
                            const matchedTemplate = templates.find(t => 
                                t.status !== 'archived' && 
                                Array.isArray(t.target_job_titles) && 
                                t.target_job_titles.includes(userJobTitle)
                            );
                            if (matchedTemplate) {
                                templateId = matchedTemplate.id;
                            }
                        }

                        const evalItems = await getSnapshotItemsForTemplate(templateId, u.id);

                        const yoyPeriod = getYoYPeriod(periodName);
                        let yoyGrade = '-';
                        try {
                            const yoyDoc = await getDoc(doc(db, "t_evaluations", `${u.id}_${yoyPeriod}`));
                            if (yoyDoc.exists()) {
                                yoyGrade = yoyDoc.data().new_grade || '-';
                            }
                        } catch(e) { console.warn("Failed to fetch YoY grade:", e); }

                        const evalId = `${u.id}_${periodName}`;
                        const evalDocRef = doc(db, "t_evaluations", evalId);
                        
                        const evalRecord = {
                            user_id: u.id,
                            user_name: u.Name || '一般',
                            department: (u.Role === 'PartTimer' || u.StoreID === 'kitchen') ? 'manufacturing' : 'sales',
                            store_id: u.StoreID || 'honten',
                            evaluator_id: '',
                            evaluator_name: '',
                            period: periodName,
                            status: 'self_evaluating',
                            is_provisional: isProvisional,
                            current_grade: u.GradeCode || '-',
                            yoy_grade: yoyGrade,
                            new_grade: '-',
                            self_total_score: 0,
                            manager_total_score: 0,
                            final_total_score: 0,
                            interview_date: '',
                            interview_notes: '',
                            president_comment: '',
                            items: evalItems,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };
                        
                        batch.set(evalDocRef, evalRecord);

                        const notifRef = doc(collection(db, "notifications"));
                        batch.set(notifRef, {
                            title: `【評価開始】${periodName}期 人事評価シート入力のお知らせ`,
                            message: `自己評価の入力期限となりました。マイページまたは評価システムより自己スコアの入力・提出をお願いいたします。`,
                            type: 'evaluation_alert',
                            status: 'pending',
                            store_id: u.StoreID || 'honten',
                            created_at: new Date().toISOString(),
                            readBy: []
                        });
                    }

                    await batch.commit();
                    window.closePeriodStartForm();
                    showAlert('開始成功', `${periodName}期の評価セッションを開始しました！全スタッフ宛に入力依頼を通知しました。`);
                    await loadInitialSettingsAndData();
                } catch (err) {
                    console.error(err);
                    showAlert('エラー', '評価期の初期化に失敗しました。');
                } finally {
                    btnSubmit.innerHTML = originalHtml;
                    btnSubmit.disabled = false;
                }
            });
        };
    }

    // 読み込み初期化
    await loadInitialSettingsAndData();
}

function setupTabs() {
    const tabs = ['self', 'subordinates', 'president', 'admin'];
    tabs.forEach(tabId => {
        const btn = document.getElementById(`tab-${tabId}`);
        if (btn) {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                activeTab = tabId;
                renderActiveTabContent();
            };
        }
    });
}

// 初期設定とデータの取得
async function loadInitialSettingsAndData() {
    let user = window.appState.currentUser;
    if (!user) {
        // SPAリロード時の認証遅延対策
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.appState.currentUser) {
                user = window.appState.currentUser;
                break;
            }
        }
        if (!user) {
            console.warn("User auth not found after waiting. Halting evaluation init.");
            return;
        }
    }

    // 店舗マスタのロード（名称解決用）
    try {
        const storeSnap = await getDocs(collection(db, "m_stores"));
        globalStoreMapForEval = {};
        storeSnap.forEach(d => {
            const data = d.data();
            globalStoreMapForEval[d.id] = data.store_name || data.店舗名 || d.id;
        });
    } catch(e) { console.error("Failed to load stores for eval:", e); }

    // 等級マスタから役職（job_title）のロード
    try {
        const gradesSnap = await getDocs(collection(db, "m_grades"));
        const jobTitlesSet = new Set();
        gradesSnap.forEach(d => {
            const jt = d.data().job_title;
            if (jt) jobTitlesSet.add(jt);
        });
        globalJobTitles = Array.from(jobTitlesSet).sort();
    } catch(e) { console.error("Failed to load job titles for eval:", e); }

    // 1. シードデータの確認・投入
    await verifyAndSeedTemplates();

    // 2. 現在の評価期設定を取得
    try {
        const periodDoc = await getDoc(doc(db, "settings", "evaluation"));
        if (periodDoc.exists()) {
            localPeriodSettings = periodDoc.data();
            updatePeriodBanner();
        } else {
            // 初期状態（評価期未設定）
            localPeriodSettings = null;
            updatePeriodBannerEmpty();
        }
    } catch (e) {
        console.error("Failed to load evaluation period settings:", e);
    }

    // 3. 権限に基づくタブの表示制御
    const role = user.Role || 'Staff';
    const tabSubordinates = document.getElementById('tab-subordinates');
    const tabPresident = document.getElementById('tab-president');
    const tabAdmin = document.getElementById('tab-admin');

    if (role === 'Admin' || role === '管理者') {
        try {
            const usersSnap = await getDocs(collection(db, "m_users"));
            allStaffUsersForAdmin = [];
            usersSnap.forEach(d => {
                const data = d.data();
                const isRetired = data.Status === 'retired' || data.Status === '退職済';
                if (!isRetired && data.Role !== 'Tablet' && data.Role !== '店舗タブレット') {
                    allStaffUsersForAdmin.push({ id: d.id, ...data });
                }
            });
        } catch(e) { console.error("Failed to load users for admin:", e); }

        if (tabAdmin) tabAdmin.style.display = 'block';
        if (tabSubordinates) tabSubordinates.style.display = 'block';
        if (tabPresident) tabPresident.style.display = 'block';
        
        const btnEditTemplatesTab = document.getElementById('btn-admin-edit-templates-tab');
        if (btnEditTemplatesTab) btnEditTemplatesTab.style.display = 'block';
        
        const isOpen = localPeriodSettings && localPeriodSettings.status === 'open';
        const btnCancelPeriodTab = document.getElementById('btn-admin-cancel-period-tab');
        const btnStartPeriodTab = document.getElementById('btn-admin-start-period-tab');
        
        if (isOpen) {
            if (btnCancelPeriodTab) btnCancelPeriodTab.style.display = 'block';
            if (btnStartPeriodTab) btnStartPeriodTab.style.display = 'none';
        } else {
            if (btnCancelPeriodTab) btnCancelPeriodTab.style.display = 'none';
            if (btnStartPeriodTab) btnStartPeriodTab.style.display = 'block';
        }
        
        activeTab = 'admin'; // 管理者はダッシュボードをデフォルトに
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-admin')?.classList.add('active');
    } else if (role === 'Manager' || role === '店長') {
        if (tabSubordinates) tabSubordinates.style.display = 'block';
        activeTab = 'subordinates'; // 店長は部下評価をデフォルトに
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-subordinates')?.classList.add('active');
    } else {
        activeTab = 'self';
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-self')?.classList.add('active');
    }

    // 4. データロード
    await loadEvaluationData();
    renderActiveTabContent();
}

function updatePeriodBanner() {
    const titleEl = document.getElementById('banner-period-title');
    const descEl = document.getElementById('banner-period-desc');
    const statusEl = document.getElementById('banner-status-text');
    if (!titleEl || !descEl || !statusEl) return;

    const periodStr = localPeriodSettings.active_period || '未設定';
    const isProvisional = localPeriodSettings.is_provisional;
    const typeStr = isProvisional ? '仮評価' : '本評価';
    
    titleEl.textContent = `${periodStr} 期`;
    descEl.textContent = typeStr;
    
    const isOpen = localPeriodSettings.status === 'open';
    if (isOpen) {
        statusEl.innerHTML = `<span style="color: #16a34a;"><i class="fas fa-play-circle"></i> 進行中 (評価受付中)</span>`;
    } else {
        statusEl.innerHTML = `<span style="color: #ef4444;"><i class="fas fa-lock"></i> 締め切り</span>`;
    }
}

function updatePeriodBannerEmpty() {
    const titleEl = document.getElementById('banner-period-title');
    const descEl = document.getElementById('banner-period-desc');
    const statusEl = document.getElementById('banner-status-text');
    if (!titleEl || !descEl || !statusEl) return;

    titleEl.textContent = `-`;
    descEl.textContent = `-`;
    statusEl.innerHTML = `<span style="color: #94a3b8;"><i class="fas fa-pause-circle"></i> 未開始</span>`;
}

// データベースからの評価データ読み込み
async function loadEvaluationData() {
    const user = window.appState.currentUser;
    if (!user) return;

    activeEvaluations = [];
    myEvaluation = null;
    subordinateUsers = [];

    if (!localPeriodSettings || localPeriodSettings.status !== 'open') return;

    const period = localPeriodSettings.active_period;

    try {
        // 1. 全評価データのロード (Admin/社長用、店長用の範囲)
        const role = user.Role || 'Staff';
        const qEvals = query(collection(db, "t_evaluations"), where("period", "==", period));
        const snapEvals = await getDocs(qEvals);
        
        snapEvals.forEach(d => {
            const data = d.data();
            activeEvaluations.push({ id: d.id, ...data });
        });

        // 2. 自分の評価の抽出
        myEvaluation = activeEvaluations.find(e => e.user_id === user.id) || null;

        // 3. 店長の場合の部下のユーザーリストをロード
        if (role === 'Manager' || role === '店長' || role === 'Admin' || role === '管理者') {
            const qUsers = query(collection(db, "m_users"));
            const snapUsers = await getDocs(qUsers);
            const allUsers = [];
            snapUsers.forEach(d => {
                allUsers.push({ id: d.id, ...d.data() });
            });

            // 自身の所属店舗が一致する一般スタッフ、アルバイトを「部下」とする (Adminは全ユーザー)
            const myStore = user.StoreID || user.StoreId;
            subordinateUsers = allUsers.filter(u => {
                // 自分自身は除外（ただし管理者はテスト運用のため自分も表示する）
                if (u.id === user.id && role !== 'Admin' && role !== '管理者') return false;
                
                if (u.Status === 'retired' || u.Status === '退職済') return false; // 退職者は除外
                if (role === 'Admin' || role === '管理者') return true; // 管理者は全員
                
                // 店長の場合は同じ店舗のスタッフ・アルバイト
                return u.StoreID === myStore && (u.Role === 'Staff' || u.Role === 'PartTimer' || u.Role === '一般社員' || u.Role === 'アルバイト');
            });

            // バッジカウントの表示更新
            updateTabBadges();
        }
    } catch (e) {
        console.error("Failed to load evaluation data:", e);
    }
}

function updateTabBadges() {
    // 部下評価の残り件数をバッジに表示 (自己評価提出済・店長評価中の件数)
    const subordinatesBadge = document.getElementById('subordinates-badge');
    if (subordinatesBadge) {
        const pendingCount = activeEvaluations.filter(e => {
            // 被評価者が部下リストに含まれ、かつステータスが「自己評価提出済」「上長評価中」「面談待ち」のもの
            const isSub = subordinateUsers.some(u => u.id === e.user_id);
            return isSub && ['self_submitted', 'manager_evaluating', 'interviewing'].includes(e.status);
        }).length;

        if (pendingCount > 0) {
            subordinatesBadge.textContent = pendingCount;
            subordinatesBadge.style.display = 'inline-block';
        } else {
            subordinatesBadge.style.display = 'none';
        }
    }

    // 社長査定の残り件数 (社長確認待ちの件数)
    const presidentBadge = document.getElementById('president-badge');
    if (presidentBadge) {
        const pendingCount = activeEvaluations.filter(e => e.status === 'president_pending').length;
        if (pendingCount > 0) {
            presidentBadge.textContent = pendingCount;
            presidentBadge.style.display = 'inline-block';
        } else {
            presidentBadge.style.display = 'none';
        }
    }
}

// アクティブなタブの内容を描画
function renderActiveTabContent() {
    const container = document.getElementById('eval-main-content');
    if (!container) return;

    if (!localPeriodSettings && activeTab !== 'admin') {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-hourglass-start fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">評価期間は開始されていません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">人事担当者による評価開始のアナウンスをお待ちください。</p>
            </div>
        `;
        return;
    }

    switch (activeTab) {
        case 'self':
            renderSelfTab(container);
            break;
        case 'subordinates':
            renderSubordinatesTab(container);
            break;
        case 'president':
            renderPresidentTab(container);
            break;
        case 'admin':
            renderAdminTab(container);
            break;
    }
}

// ==========================================
// 1. 自己評価タブ (被評価者ビュー)
// ==========================================
function renderSelfTab(container) {
    if (!myEvaluation) {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-user-slash fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">あなたの今期の評価シートは作成されていません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">等級が設定されていないか、評価対象外の可能性があります。管理者に確認してください。</p>
            </div>
        `;
        return;
    }

    const statusLabels = {
        'self_evaluating': '自己評価を入力してください。入力後、上長へ提出してください。',
        'self_submitted': '自己評価は提出済みです。上長による評価・面談の設定をお待ちください。',
        'manager_evaluating': '上長による評価入力中です。',
        'interviewing': '面談待ちです。評価シートを見ながら上長と面談を行ってください。',
        'president_pending': '社長確認待ちです。評価確定までお待ちください。',
        'approved': '評価は確定しました。人事担当者による公開までお待ちください。',
        'notified': '確定した評価結果とフィードバックがマイページにて確認できます！'
    };

    const displayStatus = getStatusJpName(myEvaluation.status);
    const guideText = statusLabels[myEvaluation.status] || '';

    container.innerHTML = `
        <div class="glass-panel" style="padding: 1.5rem 2rem; background: white; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 1rem; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <span class="eval-status-badge status-${myEvaluation.status}" style="font-size: 0.85rem; padding: 0.35rem 1rem;">
                        ステータス: ${displayStatus}
                    </span>
                    <span style="font-size: 0.85rem; color: #475569; font-weight: 700; margin-left: 1rem;">
                        現在の等級: ${myEvaluation.current_grade || '-'} | 前年同期の等級: ${myEvaluation.yoy_grade || '-'}
                    </span>
                </div>
                <div>
                    <span style="font-size: 0.9rem; color: #475569; font-weight: 600;">
                        <i class="fas fa-info-circle" style="color: #3b82f6; margin-right: 0.4rem;"></i>
                        ${guideText}
                    </span>
                </div>
            </div>
        </div>
        <div id="self-eval-inline-container"></div>
    `;

    // インラインで直接描画
    const inlineContainer = document.getElementById('self-eval-inline-container');
    renderEvalDetailInline(inlineContainer, myEvaluation, 'self');
}

// ==========================================
// 2. 部下評価タブ (上長・店長ビュー)
// ==========================================
function renderSubordinatesTab(container) {
    // 評価シートが作成されている（評価対象として選ばれた）スタッフのみを抽出し、
    // 上長タスクが完了したもの（社長決裁待ち以降）はリストから除外する
    const targetUsers = subordinateUsers.filter(u => {
        const evalData = activeEvaluations.find(e => e.user_id === u.id);
        if (!evalData) return false;
        
        // 店長のタスクが完了しているステータス
        if (evalData.status === 'president_pending' || evalData.status === 'approved' || evalData.status === 'notified') {
            return false;
        }
        return true;
    });

    if (targetUsers.length === 0) {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-check-circle fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">現在、進行中の評価対象スタッフはいません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">あなたが行うべき評価タスクはすべて完了しているか、対象者がいません。</p>
            </div>
        `;
        return;
    }

    // 店長が作業すべき優先順位でソート
    // 優先度高(1): 店長評価中 / 自己評価提出済
    // 優先度中(2): 面談完了
    // 優先度低(3): スタッフ入力待ち (自己評価中)
    const getSortPriority = (status) => {
        if (status === 'self_submitted' || status === 'manager_evaluating') return 1;
        if (status === 'interviewing') return 2;
        if (status === 'self_evaluating') return 3;
        return 4;
    };

    targetUsers.sort((a, b) => {
        const evalA = activeEvaluations.find(e => e.user_id === a.id);
        const evalB = activeEvaluations.find(e => e.user_id === b.id);
        const pA = evalA ? getSortPriority(evalA.status) : 4;
        const pB = evalB ? getSortPriority(evalB.status) : 4;
        return pA - pB;
    });

    let rowsHTML = '';
    targetUsers.forEach(u => {
        const evalData = activeEvaluations.find(e => e.user_id === u.id);
        const status = evalData ? evalData.status : 'not_started';
        const statusJp = getStatusJpName(status);
        const score = evalData ? (evalData.self_total_score || '-') : '-';
        const mgrScore = evalData ? (evalData.manager_total_score || '-') : '-';
        const resultGrade = evalData ? (evalData.new_grade || '-') : '-';

        let actionBtn = '';
        if (status === 'self_evaluating') {
            actionBtn = `<span style="font-size:0.78rem; color:#94a3b8; font-weight:600;"><i class="fas fa-clock"></i> スタッフ入力待ち</span>`;
        } else if (status === 'self_submitted' || status === 'manager_evaluating') {
            actionBtn = `<button class="btn btn-primary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#7c3aed; border-color:#7c3aed; padding: 0.4rem 0.8rem;">評価・コメント入力</button>`;
        } else if (status === 'interviewing') {
            actionBtn = `<button class="btn" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#a21caf; border-color:#a21caf; color:white; padding: 0.4rem 0.8rem;">面談結果入力・社長提出</button>`;
        } else {
            actionBtn = `<button class="btn btn-secondary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>`;
        }

        actionBtn += `<button class="btn btn-secondary" onclick="window.openEvaluationHistory('${u.id}', '${u.Name}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.6rem; border:1px solid #cbd5e1; background:#f8fafc; color:#475569; margin-left:0.4rem;" title="過去の履歴を見る"><i class="fas fa-history"></i></button>`;

        rowsHTML += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem; font-weight: 700; color: #1e293b;">${u.Name} ${u.DisplayName ? `<span style="font-size:0.75rem; color:#94a3b8; font-weight:400;">(${u.DisplayName})</span>` : ''}</td>
                <td style="padding: 1rem; font-weight: 600; color: var(--text-secondary);">${u.JobTitle || '一般'}</td>
                <td style="padding: 1rem; font-family: monospace; font-weight: 700; color: #1e3a8a;">${u.GradeCode || '-'}</td>
                <td style="padding: 1rem;"><span class="eval-status-badge status-${status}">${statusJp}</span></td>
                <td style="padding: 1rem; text-align: center; font-weight: 700;">${score}</td>
                <td style="padding: 1rem; text-align: center; font-weight: 700; color: #7c3aed;">${mgrScore}</td>
                <td style="padding: 1rem; text-align: center; font-family: monospace; font-weight: 900; color: #059669;">${resultGrade}</td>
                <td style="padding: 1rem; text-align: right;" class="no-print">${actionBtn}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div id="subordinate-list-container">
            <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                <div style="padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); background: #f8fafc;">
                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #1e293b;">
                        <i class="fas fa-users-rectangle" style="color: #7c3aed; margin-right: 0.4rem;"></i>
                        店舗スタッフ・部下の評価一覧
                    </h4>
                </div>
                <div style="overflow-x: auto;">
                    <table class="eval-table">
                        <thead>
                            <tr>
                                <th style="text-align: left;">お名前</th>
                                <th style="text-align: left;">表示役職</th>
                                <th style="text-align: left; width: 80px;">現在の等級</th>
                                <th style="text-align: left; width: 140px;">ステータス</th>
                                <th style="text-align: center; width: 80px;">自己評価点</th>
                                <th style="text-align: center; width: 80px;">上長評価点</th>
                                <th style="text-align: center; width: 80px;">判定等級</th>
                                <th style="text-align: right; width: 160px;" class="no-print">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div id="subordinate-detail-container" style="display: none;"></div>
    `;

    // 画面切り替え（ドリルダウン）関数
    window.showSubordinateDetail = (userId) => {
        const evalData = activeEvaluations.find(e => e.user_id === userId);
        if (evalData) {
            document.getElementById('subordinate-list-container').style.display = 'none';
            const detailContainer = document.getElementById('subordinate-detail-container');
            detailContainer.style.display = 'block';
            renderEvalDetailInline(detailContainer, evalData, 'manager');
        }
    };

    window.backToSubordinateList = () => {
        document.getElementById('subordinate-detail-container').style.display = 'none';
        document.getElementById('subordinate-detail-container').innerHTML = '';
        document.getElementById('subordinate-list-container').style.display = 'block';
    };
}

// ==========================================
// 3. 社長査定タブ (社長ビュー)
// ==========================================
function renderPresidentTab(container) {
    const pendingEvals = activeEvaluations.filter(e => e.status === 'president_pending');

    let rowsHTML = '';
    activeEvaluations.forEach(e => {
        const isPending = e.status === 'president_pending';
        const statusJp = getStatusJpName(e.status);

        let actionBtn = '';
        if (isPending) {
            actionBtn = `<button class="btn btn-primary" onclick="window.showPresidentDetail('${e.id}')" style="font-size:0.75rem; font-weight:800; background:#be123c; border-color:#be123c; padding: 0.4rem 0.8rem;">査定・確定する</button>`;
        } else {
            actionBtn = `<button class="btn btn-secondary" onclick="window.showPresidentDetail('${e.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>`;
        }

        rowsHTML += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem; font-weight: 700; color: #1e293b;">${e.user_name || '一般'}</td>
                <td style="padding: 1rem; font-weight: 600; color: var(--text-secondary);">${e.department === 'sales' ? '営業部 (ホール)' : '製造部 (調理)'}</td>
                <td style="padding: 1rem; font-family: monospace; font-weight: 700; color: #64748b;">${e.current_grade || '-'}</td>
                <td style="padding: 1rem; text-align: center; font-weight: 600;">${e.self_total_score || '-'}</td>
                <td style="padding: 1rem; text-align: center; font-weight: 600; color: #7c3aed;">${e.manager_total_score || '-'}</td>
                <td style="padding: 1rem; text-align: center; font-weight: 800; color: #be123c;">${e.final_total_score || e.manager_total_score || '-'}</td>
                <td style="padding: 1rem; text-align: center; font-family: monospace; font-weight: 900; color: #059669;">${e.new_grade || '-'}</td>
                <td style="padding: 1rem;"><span class="eval-status-badge status-${e.status}">${statusJp}</span></td>
                <td style="padding: 1rem; text-align: right;" class="no-print">${actionBtn}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div id="president-list-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.2rem; flex-wrap:wrap; gap:1rem;" class="no-print">
                <h4 style="margin:0; font-size:1rem; font-weight:800; color:#1e293b;"><i class="fas fa-user-tie" style="color:#be123c; margin-right:0.4rem;"></i> 全社評価一覧・最終査定</h4>
                ${pendingEvals.length > 0 ? `
                    <button class="btn btn-success" id="btn-president-approve-all" style="background:#059669; border-color:#059669; font-weight:800; padding:0.6rem 1.3rem;">
                        <i class="fas fa-check-double"></i> 申請中の全評価を一括確定する (${pendingEvals.length}件)
                    </button>
                ` : ''}
            </div>
            
            <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                <div style="overflow-x: auto;">
                    <table class="eval-table">
                        <thead>
                            <tr>
                                <th style="text-align: left;">お名前</th>
                                <th style="text-align: left;">部門</th>
                                <th style="text-align: left; width: 80px;">現等級</th>
                                <th style="text-align: center; width: 90px;">自己点</th>
                                <th style="text-align: center; width: 90px;">上長点</th>
                                <th style="text-align: center; width: 90px; color: #be123c;">確定点</th>
                                <th style="text-align: center; width: 90px;">新等級(判定)</th>
                                <th style="text-align: left; width: 140px;">ステータス</th>
                                <th style="text-align: right; width: 140px;" class="no-print">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML.length > 0 ? rowsHTML : `<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-secondary);">今期の評価データはまだありません。</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div id="president-detail-container" style="display: none;"></div>
    `;

    // 画面切り替え（ドリルダウン）関数
    window.showPresidentDetail = (evalId) => {
        const evalData = activeEvaluations.find(e => e.id === evalId);
        if (evalData) {
            document.getElementById('president-list-container').style.display = 'none';
            const detailContainer = document.getElementById('president-detail-container');
            detailContainer.style.display = 'block';
            renderEvalDetailInline(detailContainer, evalData, 'president');
        }
    };

    window.backToSubordinateList = () => { // 汎用的に使用（ヘッダーで呼ばれるため）
        const subContainer = document.getElementById('subordinate-list-container');
        if (subContainer) {
            document.getElementById('subordinate-detail-container').style.display = 'none';
            document.getElementById('subordinate-detail-container').innerHTML = '';
            subContainer.style.display = 'block';
        }
        const presContainer = document.getElementById('president-list-container');
        if (presContainer) {
            document.getElementById('president-detail-container').style.display = 'none';
            document.getElementById('president-detail-container').innerHTML = '';
            presContainer.style.display = 'block';
        }
    };

    // 一括確定イベント
    const btnApproveAll = document.getElementById('btn-president-approve-all');
    if (btnApproveAll) {
        btnApproveAll.onclick = () => {
            showConfirm('一括評価確定', `現在「社長確認待ち」の評価シート (${pendingEvals.length}件) をすべて一括確定しますか？\n（確定後は等級マスタの基準に沿って等級が仮/確定判定されます）`, async () => {
                const batch = writeBatch(db);
                for (const ev of pendingEvals) {
                    const finalScore = ev.final_total_score || ev.manager_total_score || 0;
                    
                    // 自動等級判定のルックアップ
                    const newGrade = await lookupGradeByScore(finalScore);
                    
                    const docRef = doc(db, "t_evaluations", ev.id);
                    batch.update(docRef, {
                        status: 'approved',
                        final_total_score: finalScore,
                        new_grade: newGrade,
                        updated_at: new Date().toISOString()
                    });
                }
                try {
                    await batch.commit();
                    
                    // 自動公開ロジックをフック
                    await loadEvaluationData();
                    const wasPublished = await window.autoPublishIfAllApproved();
                    
                    if (wasPublished) {
                        showAlert('一括確定＆自動公開成功', `${pendingEvals.length}件の評価を確定し、全対象者の評価結果が自動公開されました！`);
                    } else {
                        showAlert('一括確定成功', `${pendingEvals.length}件の評価を確定しました！`);
                    }
                    
                    renderActiveTabContent();
                } catch(e) {
                    console.error(e);
                    showAlert('エラー', '一括確定処理に失敗しました。');
                }
            });
        };
    }
}

// ==========================================
// 4. 全体管理タブ (人事管理者ビュー)
// ==========================================
function renderAdminTab(container) {
    const isOpen = localPeriodSettings && localPeriodSettings.status === 'open';

    let statsHTML = '';
    if (localPeriodSettings) {
        const totalCount = activeEvaluations.length;
        const selfEvaluating = activeEvaluations.filter(e => e.status === 'self_evaluating').length;
        const managerEvaluating = activeEvaluations.filter(e => ['self_submitted', 'manager_evaluating', 'interviewing'].includes(e.status)).length;
        const presidentPending = activeEvaluations.filter(e => e.status === 'president_pending').length;
        
        // 全員が完了(notified)しているか判定
        const isAllCompleted = totalCount > 0 && activeEvaluations.every(e => e.status === 'notified');

        if (isAllCompleted) {
            statsHTML = `
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 2rem; border-radius: 16px; margin-bottom: 2rem; text-align: center; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);">
                    <i class="fas fa-check-circle fa-3x" style="margin-bottom: 1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.2);"></i>
                    <h2 style="margin: 0; font-size: 1.8rem; font-weight: 900; letter-spacing: 0.05em;">🎉 今期の評価フローはすべて完了・公開済です</h2>
                    <p style="margin: 0.8rem 0 0 0; font-size: 1.05rem; opacity: 0.9; font-weight: 600;">全対象者の評価が確定し、自動公開されました。お疲れ様でした！</p>
                </div>
            `;
        } else {
            statsHTML = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.2rem; margin-bottom: 2.5rem;">
                    <div style="background: linear-gradient(to bottom right, #ffffff, #f8fafc); border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 15px -3px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.05)';">
                        <div style="font-size: 0.85rem; color: #64748b; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 0.5rem;">評価対象者</div>
                        <div style="font-size: 2.8rem; font-weight: 900; color: #1e293b; line-height: 1.2;">${totalCount}<span style="font-size: 1rem; color: #94a3b8; font-weight: 700; margin-left: 0.2rem;">名</span></div>
                    </div>
                    <div style="background: linear-gradient(to bottom right, #fffbeb, #fef3c7); border: 1px solid #fde68a; border-radius: 16px; padding: 1.5rem; text-align: center; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.08); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 15px -3px rgba(217, 119, 6, 0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(217, 119, 6, 0.08)';">
                        <div style="font-size: 0.85rem; color: #d97706; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 0.5rem;">自己評価入力中</div>
                        <div style="font-size: 2.8rem; font-weight: 900; color: #b45309; line-height: 1.2;">${selfEvaluating}<span style="font-size: 1rem; color: #d97706; font-weight: 700; margin-left: 0.2rem;">名</span></div>
                    </div>
                    <div style="background: linear-gradient(to bottom right, #eff6ff, #dbeafe); border: 1px solid #bfdbfe; border-radius: 16px; padding: 1.5rem; text-align: center; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.08); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 15px -3px rgba(37, 99, 235, 0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(37, 99, 235, 0.08)';">
                        <div style="font-size: 0.85rem; color: #2563eb; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 0.5rem;">上長評価・面談中</div>
                        <div style="font-size: 2.8rem; font-weight: 900; color: #1d4ed8; line-height: 1.2;">${managerEvaluating}<span style="font-size: 1rem; color: #3b82f6; font-weight: 700; margin-left: 0.2rem;">名</span></div>
                    </div>
                    <div style="background: linear-gradient(to bottom right, #fff1f2, #ffe4e6); border: 1px solid #fecdd3; border-radius: 16px; padding: 1.5rem; text-align: center; box-shadow: 0 4px 6px -1px rgba(225, 29, 72, 0.08); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 15px -3px rgba(225, 29, 72, 0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(225, 29, 72, 0.08)';">
                        <div style="font-size: 0.85rem; color: #e11d48; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 0.5rem;">最終承認待ち</div>
                        <div style="font-size: 2.8rem; font-weight: 900; color: #be123c; line-height: 1.2;">${presidentPending}<span style="font-size: 1rem; color: #f43f5e; font-weight: 700; margin-left: 0.2rem;">名</span></div>
                    </div>
                </div>
            `;
        }
    }

    if (!isOpen) {
        // 未開始時の1カラム・Empty State
        container.innerHTML = `
            <div style="background: white; border-radius: 16px; border: 1px solid #cbd5e1; padding: 4rem 2rem; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; margin-top: 1rem;">
                <div style="width: 80px; height: 80px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
                    <i class="fas fa-calendar-alt" style="font-size: 2.5rem; color: #94a3b8;"></i>
                </div>
                <h3 style="margin: 0 0 0.8rem 0; font-size: 1.4rem; font-weight: 800; color: #1e293b;">今期の評価スケジュールはまだ開始されていません</h3>
                <p style="margin: 0 0 2rem 0; font-size: 0.95rem; color: #64748b; max-width: 450px; line-height: 1.6;">
                    右上の「評価を新規開始する」ボタンから、対象者とスケジュールを設定して新しい評価期をスタートしてください。
                </p>
                <button class="btn btn-primary" onclick="openPeriodStartForm()" style="padding: 0.8rem 2rem; font-size: 1rem; font-weight: 800; border-radius: 8px; background: #10b981; border-color: #10b981; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">
                    <i class="fas fa-play"></i> 評価を新規開始する
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="display: block;">
            <div>
                ${statsHTML}
                
                <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <div style="padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #1e293b;">
                            評価進行ステータス
                        </h4>
                    </div>
                    <div style="overflow-x: auto; max-height: 400px;">
                        <table class="eval-table">
                            <thead>
                                <tr>
                                    <th style="text-align: left;">お名前</th>
                                    <th style="text-align: left;">部署・店舗</th>
                                    <th style="text-align: left; width: 140px;">現在のステータス</th>
                                    <th style="text-align: center; width: 90px;">自己評価点</th>
                                    <th style="text-align: center; width: 90px;">上長評価点</th>
                                    <th style="text-align: right; width: 100px;" class="no-print">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activeEvaluations.map(e => `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem 1rem; font-weight: 700; color: #1e293b;">${e.user_name || '一般'}</td>
                                        <td style="padding: 0.75rem 1rem; color: var(--text-secondary); font-size: 0.8rem;">${e.department === 'sales' ? '営業部' : '製造部'} (${globalStoreMapForEval[e.store_id] || e.store_id || '本店'})</td>
                                        <td style="padding: 0.75rem 1rem;"><span class="eval-status-badge status-${e.status}">${getStatusJpName(e.status)}</span></td>
                                        <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 600;">${e.self_total_score || '-'}</td>
                                        <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 600; color: #7c3aed;">${e.manager_total_score || '-'}</td>
                                        <td style="padding: 0.75rem 1rem; text-align: right;" class="no-print">
                                            <button class="btn btn-secondary" onclick="window.viewAdminEvaluationDetail('${e.id}')" style="font-size: 0.7rem; padding: 0.3rem 0.6rem; border: 1px solid #cbd5e1; background: white; color: var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>
                                            <button class="btn btn-secondary" onclick="window.openEvaluationHistory('${e.user_id}', '${e.user_name || '一般'}')" style="font-size:0.7rem; padding: 0.3rem 0.6rem; border:1px solid #cbd5e1; background:#f8fafc; color:#475569; margin-left:0.3rem;" title="過去の履歴を見る"><i class="fas fa-history"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${activeEvaluations.length === 0 ? `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-secondary);">現在進行中の評価はありません。</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
        </div>
    `;

    // 確定結果の一括公開 (通知)
    const btnNotifyAll = document.getElementById('btn-admin-notify-all');
    if (btnNotifyAll) {
        btnNotifyAll.onclick = () => {
            const approvedEvals = activeEvaluations.filter(e => e.status === 'approved');
            showConfirm('確定結果の公開', `確定済み（未公開）状態の評価シート (${approvedEvals.length}件) をすべて公開・本人通知しますか？\n（スタッフのマイページから閲覧可能になり、新等級が反映されます）`, async () => {
                const batch = writeBatch(db);
                
                // 本評価の場合、ユーザーマスタ (m_users) の等級コードを一括で書き換えるためのバッチ用
                const userUpdates = [];

                for (const ev of approvedEvals) {
                    const evalRef = doc(db, "t_evaluations", ev.id);
                    batch.update(evalRef, {
                        status: 'notified',
                        updated_at: new Date().toISOString()
                    });

                    // 本評価（6月評価）の場合のみ、新等級を m_users に自動反映
                    if (localPeriodSettings.is_provisional === false && ev.new_grade && ev.new_grade !== '-') {
                        const userRef = doc(db, "m_users", ev.user_id);
                        batch.update(userRef, {
                            GradeCode: ev.new_grade
                        });
                    }

                    // 通知の作成
                    const notifRef = doc(collection(db, "notifications"));
                    batch.set(notifRef, {
                        title: `【評価公開】${ev.period}期の評価結果が公開されました`,
                        message: `社長査定が完了し、あなたの新しい等級（または仮等級）が確定しました。マイページよりフィードバックをご確認ください。`,
                        type: 'evaluation_published',
                        status: 'pending',
                        store_id: ev.store_id || 'honten',
                        created_at: new Date().toISOString(),
                        readBy: []
                    });
                }

                try {
                    await batch.commit();
                    showAlert('公開成功', `評価結果を公開し、対象従業員に通知を配信しました！`);
                    await loadEvaluationData();
                    renderActiveTabContent();
                } catch(e) {
                    console.error(e);
                    showAlert('エラー', '公開処理に失敗しました。');
                }
            });
        };
    }

    // 評価期のロック終了
    const btnClosePeriod = document.getElementById('btn-admin-close-period');
    if (btnClosePeriod) {
        btnClosePeriod.onclick = () => {
            showConfirm('評価期の締め切り', `現在稼働中の「${localPeriodSettings.active_period}期」を締め切り、終了しますか？\n（以降、点数の変更や再評価はロックされます）`, async () => {
                try {
                    const settingsRef = doc(db, "settings", "evaluation");
                    await updateDoc(settingsRef, {
                        status: 'closed',
                        updated_at: new Date().toISOString()
                    });
                    showAlert('締め切り成功', '今期の評価スケジュールをクローズ・ロックしました。');
                    await loadInitialSettingsAndData();
                } catch (e) {
                    console.error(e);
                    showAlert('エラー', '締め切り処理に失敗しました。');
                }
            });
        };
    }

    // 評価期の開始取消・リセット
    const btnCancelPeriod = document.getElementById('btn-admin-cancel-period-tab');
    if (btnCancelPeriod) {
        btnCancelPeriod.onclick = () => {
            const period = localPeriodSettings.active_period;
            showConfirm('評価開始の取り消し', `現在開始されている「${period}期」の評価シートおよび通知データをすべて削除して初期状態にリセットしますか？\n(注意: すでに入力された自己評価データなどがある場合、それらもすべて消去されます。この操作は元に戻せません)`, async () => {
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
                    showAlert('取り消し完了', `${period}期の評価データをリセットし、通知を削除しました。`);
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

    window.viewAdminEvaluationDetail = (evalId) => {
        const evalData = activeEvaluations.find(e => e.id === evalId);
        if (evalData) {
            openEvaluationDetailModal(evalData, 'admin');
        }
    };

    // 評価項目マスタ編集ボタンのバインド
    const btnEditTemplates = document.getElementById('btn-admin-edit-templates-tab');
    if (btnEditTemplates) {
        btnEditTemplates.onclick = () => {
            openTemplateEditorModal();
        };
    }
    
    // 過去データ取り込みボタンのバインド
    const btnImportLegacy = document.getElementById('btn-admin-import-legacy');
    if (btnImportLegacy) {
        btnImportLegacy.onclick = () => {
            window.openLegacyImportModal();
        };
    }
}

// YoY (前年同期) のPeriod名を算出するヘルパー (例: 2026-06 -> 2025-06)
function getYoYPeriod(periodName) {
    const parts = periodName.split('-');
    if (parts.length !== 2) return '';
    const year = parseInt(parts[0]) - 1;
    return `${year}-${parts[1]}`;
}

// 評価テンプレートマスタのシード処理 (存在しない場合に初期4件を投入)
async function verifyAndSeedTemplates() {
    try {
        const snap = await getDocs(collection(db, "m_evaluation_templates"));
        if (!snap.empty) {
            // すでにテンプレートが存在するため何もしない
            return;
        }

        console.log("Seeding default evaluation templates...");
        
        // デフォルトの一般・研修項目
        const defaultGeneralItems = [
            { item_id: 'item_01', category: '労働管理', title: 'スタッフ・お客様に対して目を見て元気よく挨拶をしている', description: '朝の挨拶、接客時に目線とトーンを意識できているか。', display_order: 1 },
            { item_id: 'item_02', category: '労働管理', title: '丁寧な言葉遣いを心がけている', description: '乱暴な言葉遣いや、ふさわしくない敬語を避けているか。', display_order: 2 },
            { item_id: 'item_03', category: '労働管理', title: '時間・期日を守って仕事をしている', description: '遅刻をしない、シフト開始の準備、指示された期日を守る。', display_order: 3 },
            { item_id: 'item_04', category: '自主計画性', title: '問題が起きた時に上級者に報告している', description: 'ミス、異物混入、トラブル発生時の即時ホウレンソウ。', display_order: 4 },
            { item_id: 'item_05', category: '自主計画性', title: '必要なことは必ず連絡している', description: 'シフトの調整申請、業務連絡を怠らない。', display_order: 5 },
            { item_id: 'item_06', category: '自主計画性', title: '分からないことを上級者に確認・相談している', description: '勝手な自己判断をせず、確認作業を行える。', display_order: 6 },
            { item_id: 'item_07', category: '自主計画性', title: '業務上分からない事を積極的に質問している', description: '自ら疑問を解消しようとする成長意欲。', display_order: 7 },
            { item_id: 'item_08', category: '自主計画性', title: '業務を覚えるための努力をしている', description: 'マニュアルの読み込み、振り返り等の自主的姿勢。', display_order: 8 },
            { item_id: 'item_09', category: '自主計画性', title: '整理整頓を心がけている', description: '使用した器具、テーブル、自身のロッカーの清掃・配置。', display_order: 9 },
            { item_id: 'item_10', category: '自主計画性', title: '清潔さを意識した仕事をしている', description: '身だしなみ、爪、ユニフォームの清潔さ。', display_order: 10 },
            { item_id: 'item_11', category: '目標達成度', title: '馴染みのお客様は名前を呼んで接客している', description: 'リピーター顧客への「名前を呼んだ親身な接客」。', display_order: 11 },
            { item_id: 'item_12', category: '目標達成度', title: '馴染みのお客様から名前を覚えてもらっている', description: 'ネームプレート、自己紹介等のコミュニケーション成果。', display_order: 12 },
            { item_id: 'item_13', category: '目標達成度', title: 'お客様やスタッフが不快にならない言い方で仕事をしている', description: '否定的な表現や高圧的な態度を避けた対話。', display_order: 13 },
            { item_id: 'item_14', category: '目標達成度', title: 'スピードを重視しながらも安全に商品提供をしている', description: '提供スピードの遵守、かつ転倒や破損を起こさない。', display_order: 14 },
            { item_id: 'item_15', category: '店舗責任者', title: '商品の説明が正しくできている', description: '本日のおすすめ、メニュー詳細、アレルギー対応。', display_order: 15 },
            { item_id: 'item_16', category: '店舗責任者', title: 'その商品を頼みたくなるような魅力的な説明ができる', description: 'シズル感を交えたおすすめ商品の販売。', display_order: 16 },
            { item_id: 'item_17', category: '店舗責任者', title: '元気よく掛け声・復唱をしている', description: 'オーダー通し、いらっしゃいませ等の積極的発声。', display_order: 17 },
            { item_id: 'item_18', category: '店舗責任者', title: 'お客様の要望にすぐ気づき対応ができる', description: '視野を広く持ち、お冷、中間バッシング等の気配り。', display_order: 18 },
            { item_id: 'item_19', category: '店舗責任者', title: '衛生管理チェックテストを合格している', description: '社内テストでの基準クリア。', display_order: 19 },
            { item_id: 'item_20', category: '店舗責任者', title: '研修卒業テストに合格しテスト内容を実践している', description: '一般社員としての卒業判定。', display_order: 20 },
            { item_id: 'item_21', category: '教育者', title: 'レジ操作業務確認テストに合格し、正しい手順で行えている', description: 'ミスのない会計処理、レジ締め手順の正確性。', display_order: 21 },
            { item_id: 'item_22', category: '教育者', title: 'ドリンクを決められた方法で作成する事を徹底している', description: 'マニュアル通りのレシピ・分量の遵守。', display_order: 22 },
            { item_id: 'item_23', category: '教育者', title: 'ホールマニュアルを徹底している', description: '標準サービスの徹底と指導への応用。', display_order: 23 },
            { item_id: 'item_24', category: '教育者', title: '指導を受けながら焼き業務を行っている', description: '調理指導時の真摯な受け答えと習熟。', display_order: 24 }
        ];

        const batch = writeBatch(db);

        // 1. 一般・研修
        batch.set(doc(db, "m_evaluation_templates", "general"), {
            template_name: "一般・研修用評価シート",
            items: defaultGeneralItems
        });

        // 2. 調理師
        batch.set(doc(db, "m_evaluation_templates", "chef"), {
            template_name: "調理師用評価シート",
            items: defaultGeneralItems.map(item => {
                if (item.category === '教育者') {
                    return { ...item, title: `【調理専門】${item.title.replace('レジ', '調理・仕込み')}` };
                }
                return item;
            })
        });

        // 3. 副店長
        batch.set(doc(db, "m_evaluation_templates", "sub_manager"), {
            template_name: "副店長用評価シート",
            items: defaultGeneralItems.map((item, idx) => {
                if (idx >= 20) {
                    return { ...item, category: '管理者項目', title: `【マネジメント】シフト調整と新人スタッフの育成教育を主導している` };
                }
                return item;
            })
        });

        // 4. 店長
        batch.set(doc(db, "m_evaluation_templates", "manager"), {
            template_name: "店長用評価シート",
            items: defaultGeneralItems.map((item, idx) => {
                if (idx === 23) {
                    return { ...item, category: '管理者項目', title: `部下の等級が前回評価よりも上がっている（部下の育成責任）` };
                }
                if (idx >= 20) {
                    return { ...item, category: '管理者項目', title: `【数値責任】店舗の目標PL（売上・FLコスト）の計画を達成している` };
                }
                return item;
            })
        });

        await batch.commit();
        console.log("Seeding templates completed.");
    } catch(e) { console.error("Verify templates error:", e); }
}

// 評価初期化時に、指定したテンプレートの項目に「前回の評価値」を結合したスナップショット用配列を構築する
async function getSnapshotItemsForTemplate(templateId, userId) {
    let items = [];
    try {
        const tDoc = await getDoc(doc(db, "m_evaluation_templates", templateId));
        if (tDoc.exists()) {
            items = tDoc.data().items || [];
        }
    } catch(e) { console.error(e); }

    if (items.length === 0) {
        // フォールバック
        return [];
    }

    // ユーザーの「直近の過去確定評価」を検索
    let previousEval = null;
    try {
        const q = query(
            collection(db, "t_evaluations"),
            where("user_id", "==", userId),
            where("status", "in", ["notified", "approved"]),
            orderBy("period", "desc")
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            previousEval = snap.docs[0].data();
        }
    } catch(e) {
        console.warn("Could not find previous evaluation for user:", userId, e);
    }

    // 前回の各項目の点数をマッピングして初期配列を作成
    return items.map(item => {
        let prevScore = 0;
        if (previousEval && previousEval.items) {
            const prevItem = previousEval.items.find(pi => pi.item_id === item.item_id);
            if (prevItem) {
                prevScore = prevItem.manager_score || prevItem.self_score || 0;
            }
        }

        return {
            item_id: item.item_id,
            category: item.category,
            title: item.title,
            description: item.description || '',
            is_new: false, // マスタ変更検知用（将来拡張）
            self_score: 0,
            self_comment: '',
            manager_score: 0,
            manager_comment: '',
            previous_score: prevScore
        };
    });
}

// ==========================================
// 5. 評価詳細入力・閲覧モーダルの構築と制御
// ==========================================
let previousPeriodData = null;

async function renderEvalDetailInline(container, evalData, mode) {
    selectedEvalDetail = JSON.parse(JSON.stringify(evalData)); // シャローコピーで編集バッファにする
    
    container.innerHTML = '<div style="text-align:center; padding:4rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--text-secondary);"></i><div style="margin-top:1rem; font-weight:700; color:var(--text-secondary);">過去データと照合中...</div></div>';

    // === 直前期データの取得ロジック ===
    previousPeriodData = null;
    try {
        const userId = selectedEvalDetail.user_id;
        const q = query(collection(db, "t_evaluations"), where("user_id", "==", userId));
        const snap = await getDocs(q);
        
        let allPast = [];
        snap.forEach(d => {
            const data = d.data();
            if ((data.status === 'approved' || data.status === 'notified' || data.is_legacy_archive) && data.period !== selectedEvalDetail.period) {
                allPast.push({ id: d.id, ...data });
            }
        });
        
        if (allPast.length > 0) {
            allPast.sort((a, b) => b.period.localeCompare(a.period));
            previousPeriodData = allPast[0];
        }
    } catch(e) {
        console.warn("Failed to load previous period data for diff:", e);
    }

    container.innerHTML = ''; // クリア

    // インライン用のラッパーを作成
    const detailWrapper = document.createElement('div');
    detailWrapper.style.cssText = "background: white; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); padding: 0; overflow: hidden; margin-top: 1rem; position: relative;";
    
    // ヘッダー部分
    const isProvisional = selectedEvalDetail.is_provisional;
    const typeStr = isProvisional ? '仮評価' : '本評価 (7月給与反映対象)';
    const statusJp = getStatusJpName(selectedEvalDetail.status);
    
    const headerHtml = `
        <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b;">【${selectedEvalDetail.period}期 ${typeStr}】 ${selectedEvalDetail.user_name} さんの評価シート</h3>
                <p style="margin: 0.3rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">
                    ステータス: <span style="color:#2563eb;">${statusJp}</span> | 被評価者の現等級: ${selectedEvalDetail.current_grade || '-'} | 前年同期の等級: ${selectedEvalDetail.yoy_grade || '-'}
                </p>
            </div>
            ${mode !== 'self' ? `<button class="btn" onclick="window.backToSubordinateList()" style="background:#f1f5f9; color:#475569; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:700;"><i class="fas fa-arrow-left"></i> 一覧へ戻る</button>` : ''}
        </div>
    `;

    // ボディ部分（既存のrenderModalBodyの中身を使う）
    const bodyContainer = document.createElement('div');
    bodyContainer.style.cssText = "padding: 1.5rem 2rem; background: #f8fafc;";
    renderModalBody(bodyContainer, mode);

    // フッター部分（固定アクションバー）
    const footerContainer = document.createElement('div');
    footerContainer.style.cssText = "padding: 1rem 2rem; border-top: 1px solid var(--border); background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); display: flex; justify-content: flex-end; gap: 0.8rem; position: sticky; bottom: 0; z-index: 100; box-shadow: 0 -4px 6px -1px rgba(0,0,0,0.02);";
    renderModalFooter(footerContainer, mode);

    detailWrapper.innerHTML = headerHtml;
    detailWrapper.appendChild(bodyContainer);
    detailWrapper.appendChild(footerContainer);

    container.appendChild(detailWrapper);
}

function renderModalBody(container, mode) {
    const status = selectedEvalDetail.status;
    const isSelfMode = mode === 'self' && status === 'self_evaluating';
    const isManagerMode = mode === 'manager' && (status === 'self_submitted' || status === 'manager_evaluating' || status === 'interviewing');
    const isPresidentMode = mode === 'president' && status === 'president_pending';

    // 項目ごとの行を構築
    let itemsHtml = '';
    let currentCategory = '';
    
    // 集計用初期値
    let selfTotal = 0;
    let managerTotal = 0;

    // 店長が評価する際の「部下育成進捗」アシストウィジェットの構築
    let assistWidgetHtml = '';
    if (isManagerMode) {
        // もし店長の評価項目（例：「部下の等級が前回評価よりも上がっている」）がある場合、自動集計結果を挿入
        const targetItem = selectedEvalDetail.items.find(item => item.title.includes('部下の等級が前回評価よりも上がっている'));
        if (targetItem) {
            const hasRankedUpCount = activeEvaluations.filter(e => {
                const isSub = subordinateUsers.some(u => u.id === e.user_id);
                if (!isSub) return false;
                
                // 等級変化チェック (例: 現等級より新等級が数値的に高い、または昇格している)
                const cur = parseInt(e.current_grade) || 0;
                const nxt = parseInt(e.new_grade) || 0;
                return nxt > cur && e.status !== 'not_started';
            }).length;

            assistWidgetHtml = `
                <div class="glass-panel" style="padding: 1.2rem; background: #f0fdf4; border: 1px dashed #86efac; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h5 style="margin: 0 0 0.5rem; color: #166534; font-weight: 800;"><i class="fas fa-magic"></i> 部下育成責任・自動判定アシスト</h5>
                    <p style="margin: 0; font-size: 0.8rem; color: #15803d; line-height: 1.5;">
                        店長マスタ管理下のスタッフ等級推移を自動算出しました：<br>
                        <strong>今期等級が上昇した部下の人数: ${hasRankedUpCount}名</strong> (在職中の部下合計: ${subordinateUsers.length}名中)<br>
                        ※上記の成果を参考に、「部下の育成責任（項目24）」の評価点を入力してください。
                    </p>
                </div>
            `;
        }
    }

    selectedEvalDetail.items.forEach((item, idx) => {
        let titleSuffix = '';
        let diffHtml = '<span style="color:#cbd5e1;">-</span>';

        if (previousPeriodData && previousPeriodData.items) {
            const pastItem = previousPeriodData.items.find(pi => pi.item_id === item.item_id);
            if (!pastItem) {
                titleSuffix = `<span class="eval-status-badge status-not_started" style="margin-left:0.5rem; background:#fee2e2; color:#b91c1c; border:none; font-size:0.65rem; padding: 0.15rem 0.4rem;">（新）</span>`;
                diffHtml = '<span style="font-size:0.7rem; color:#94a3b8;">比較不可</span>';
            } else {
                const pastScore = pastItem.manager_score || 0;
                const currentScoreForDiff = (status === 'self_evaluating' || status === 'self_submitted') ? (item.self_score || 0) : (item.manager_score || 0);
                
                if (pastScore > 0 && currentScoreForDiff > 0) {
                    const diff = currentScoreForDiff - pastScore;
                    if (diff > 0) {
                        diffHtml = `<div><span style="font-size:0.9rem; color:#64748b;">${pastScore}</span><i class="fas fa-arrow-right" style="margin:0 0.2rem; font-size:0.6rem; color:#94a3b8;"></i><span style="font-size:0.75rem; color:#16a34a; font-weight:800;"><i class="fas fa-arrow-up"></i> +${diff}</span></div>`;
                    } else if (diff < 0) {
                        diffHtml = `<div><span style="font-size:0.9rem; color:#64748b;">${pastScore}</span><i class="fas fa-arrow-right" style="margin:0 0.2rem; font-size:0.6rem; color:#94a3b8;"></i><span style="font-size:0.75rem; color:#dc2626; font-weight:800;"><i class="fas fa-arrow-down"></i> ${diff}</span></div>`;
                    } else {
                        diffHtml = `<div><span style="font-size:0.9rem; color:#64748b;">${pastScore}</span><i class="fas fa-arrow-right" style="margin:0 0.2rem; font-size:0.6rem; color:#94a3b8;"></i><span style="font-size:0.75rem; color:#94a3b8; font-weight:800;"><i class="fas fa-minus"></i> ±0</span></div>`;
                    }
                } else if (pastScore > 0) {
                     diffHtml = `<div style="font-size:0.75rem; color:#64748b; font-weight:600;">前回: ${pastScore}点</div>`;
                }
            }
        } else {
            titleSuffix = `<span class="eval-status-badge status-not_started" style="margin-left:0.5rem; background:#fee2e2; color:#b91c1c; border:none; font-size:0.65rem; padding: 0.15rem 0.4rem;">（新）</span>`;
            diffHtml = '<span style="font-size:0.7rem; color:#94a3b8;">比較不可</span>';
        }
        // カテゴリヘッダーの差し込み
        if (item.category !== currentCategory) {
            currentCategory = item.category;
            itemsHtml += `
                <tr style="background: #eff6ff;">
                    <td colspan="5" style="padding: 0.6rem 1rem; font-weight: 900; color: #1e3a8a; font-size: 0.82rem;">
                        <i class="fas fa-folder-open" style="margin-right: 0.4rem;"></i>
                        ${currentCategory}
                    </td>
                </tr>
            `;
        }

        selfTotal += item.self_score || 0;
        managerTotal += item.manager_score || 0;

        // 自己評価ラジオボタン
        let selfRadioHtml = '';
        for (let s = 5; s >= 1; s--) {
            const isSel = item.self_score === s;
            const disabledAttr = isSelfMode ? '' : 'disabled';
            selfRadioHtml += `
                <button type="button" class="score-btn ${isSel ? 'selected-self' : ''}" 
                        onclick="window.selectScore(${idx}, 'self', ${s})" ${disabledAttr}>
                    ${s}
                </button>
            `;
        }

        // 上長評価ラジオボタン
        let managerRadioHtml = '';
        for (let s = 5; s >= 1; s--) {
            const isSel = item.manager_score === s;
            const disabledAttr = isManagerMode ? '' : 'disabled';
            managerRadioHtml += `
                <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                        onclick="window.selectScore(${idx}, 'manager', ${s})" ${disabledAttr}>
                    ${s}
                </button>
            `;
        }

        // コメント入力欄
        let commentAreaHtml = '';
        if (isSelfMode) {
            commentAreaHtml = `
                <input type="text" value="${item.self_comment || ''}" placeholder="自己評価の理由を記入" 
                       onchange="window.updateComment(${idx}, 'self', this.value)" 
                       style="width: 100%; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.78rem;">
            `;
        } else {
            commentAreaHtml += `
                <div style="font-size:0.75rem; color:#475569; font-weight: 600; line-height: 1.4;">
                    ${item.self_comment ? `自己理由: ${item.self_comment}` : '<span style="color:#94a3b8;">自己理由: 未記入</span>'}
                </div>
            `;
        }

        if (isManagerMode) {
            commentAreaHtml += `
                <input type="text" value="${item.manager_comment || ''}" placeholder="フィードバック、上長評価の理由を記入" 
                       onchange="window.updateComment(${idx}, 'manager', this.value)" 
                       style="width: 100%; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.78rem; margin-top: 0.3rem;">
            `;
        } else {
            commentAreaHtml += `
                <div style="font-size:0.75rem; color:#6d28d9; font-weight: 700; line-height: 1.4; margin-top: 0.2rem;">
                    ${item.manager_comment ? `上長FB: ${item.manager_comment}` : '<span style="color:#94a3b8;">上長FB: 未記入</span>'}
                </div>
            `;
        }

        itemsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                <td style="padding: 0.8rem 1rem; width: 30%; vertical-align: middle;">
                    <div style="font-weight: 700; color: #1e293b; line-height: 1.4; display: flex; align-items: center;">
                        ${item.title} ${titleSuffix}
                    </div>
                </td>
                <td style="padding: 0.8rem 0.5rem; text-align: center; font-family: monospace; background: #f8fafc; width: 100px; vertical-align: middle;">
                    ${diffHtml}
                </td>
                <td style="padding: 0.8rem 1rem; width: 200px; vertical-align: middle;" class="eval-score-cell">
                    <div style="display: flex; gap: 0.25rem; justify-content: center;">
                        ${selfRadioHtml}
                    </div>
                    <div class="eval-tooltip">
                        <strong style="color:#a7f3d0;"><i class="fas fa-info-circle"></i> 基準説明:</strong><br>${item.description}
                    </div>
                </td>
                <td style="padding: 0.8rem 1rem; width: 200px; vertical-align: middle;" class="eval-score-cell">
                    <div style="display: flex; gap: 0.25rem; justify-content: center;">
                        ${managerRadioHtml}
                    </div>
                    <div class="eval-tooltip">
                        <strong style="color:#a7f3d0;"><i class="fas fa-info-circle"></i> 基準説明:</strong><br>${item.description}
                    </div>
                </td>
                <td style="padding: 0.8rem 1rem; vertical-align: middle;">
                    ${commentAreaHtml}
                </td>
            </tr>
        `;
    });

    // 等級判定テーブルのプレビューウィジェット
    let gradeRulePreviewHtml = `
        <div class="glass-panel" style="padding: 1rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-top: 1.5rem;">
            <h5 style="margin: 0 0 0.5rem; color: #1e3a8a; font-weight: 800;"><i class="fas fa-info-circle"></i> 自動等級判定の条件目安 (給与基準表)</h5>
            <p style="margin: 0; font-size: 0.78rem; color: #1e40af; line-height: 1.5;">
                ・点数合計に応じた等級連動判定が行われます。<br>
                ・仮評価（9, 12, 3月）は結果公開と仮通知のみで給与には影響しません。<br>
                ・本評価（6月）のみ新等級が7月から本反映されます。
            </p>
        </div>
    `;

    // 面談メモ、社長総括の表示エリア
    let textFieldsHtml = '';
    if (status !== 'self_evaluating') {
        textFieldsHtml += `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
                <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border);">
                    <h5 style="margin: 0 0 0.6rem; color: #7c3aed; font-weight: 800;"><i class="fas fa-comments"></i> 上長面談時のメモ・記録</h5>
                    ${isManagerMode ? `
                        <textarea id="modal-interview-notes" rows="4" placeholder="面談で話し合った内容や育成方針を記入" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; font-family:inherit; resize:vertical;">${selectedEvalDetail.interview_notes || ''}</textarea>
                        <div style="margin-top: 0.5rem;">
                            <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.2rem;">面談実施日</label>
                            <input type="date" id="modal-interview-date" value="${selectedEvalDetail.interview_date || ''}" style="padding:0.4rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem;">
                        </div>
                    ` : `
                        <p style="margin:0; font-size:0.82rem; line-height:1.5; color:#475569; white-space:pre-wrap;">${selectedEvalDetail.interview_notes || '（面談メモはまだ登録されていません）'}</p>
                        ${selectedEvalDetail.interview_date ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:0.5rem;"><i class="fas fa-calendar"></i> 面談日: ${selectedEvalDetail.interview_date}</div>` : ''}
                    `}
                </div>
                <div class="glass-panel" style="padding: 1.2rem; background: white; border: 1px solid var(--border);">
                    <h5 style="margin: 0 0 0.6rem; color: #be123c; font-weight: 800;"><i class="fas fa-user-tie"></i> 社長フィードバック・総括</h5>
                    ${isPresidentMode ? `
                        <textarea id="modal-president-comment" rows="4" placeholder="社長からのフィードバックコメントを入力" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; font-family:inherit; resize:vertical;">${selectedEvalDetail.president_comment || ''}</textarea>
                        <div style="margin-top: 0.5rem; display:flex; gap:1rem; align-items:center;">
                            <div>
                                <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.2rem;">社長査定・最終確定合計点</label>
                                <input type="number" id="modal-final-score" value="${selectedEvalDetail.final_total_score || selectedEvalDetail.manager_total_score || 0}" min="0" max="120" style="padding:0.4rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; width:100px; text-align:center; font-weight:800;" onchange="window.handleFinalScoreChange(this.value)">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; font-weight:700; color:#475569; display:block; margin-bottom:0.2rem;">査定に基づく等級判定</label>
                                <span id="modal-new-grade-preview" style="font-size:1.1rem; font-weight:900; color:#059669; font-family:monospace;">${selectedEvalDetail.new_grade || '-'}</span>
                            </div>
                        </div>
                    ` : `
                        <p style="margin:0; font-size:0.82rem; line-height:1.5; color:#475569; white-space:pre-wrap;">${selectedEvalDetail.president_comment || '（確定コメントはまだありません）'}</p>
                    `}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        ${assistWidgetHtml}

        <!-- 評価スコアテーブル -->
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
            <table class="eval-table">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="text-align: left;">評価項目・基準説明</th>
                        <th style="text-align: center; width: 100px;">過去との差分</th>
                        <th style="text-align: center; width: 200px;">自己評価点</th>
                        <th style="text-align: center; width: 200px; color:#7c3aed;">上長評価点</th>
                        <th style="text-align: left;">評価理由・フィードバック</th>
                    </tr>
                </thead>
                <tbody id="modal-eval-table-body">
                    ${itemsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid var(--border);">
                        <td style="padding: 1rem; text-align: right;">合計点 (120点満点)</td>
                        <td style="padding: 1rem; text-align: center; color: #64748b;">-</td>
                        <td style="padding: 1rem; text-align: center; font-size: 1.1rem; color: #2563eb;" id="sum-self-score">${selfTotal} 点</td>
                        <td style="padding: 1rem; text-align: center; font-size: 1.1rem; color: #7c3aed;" id="sum-manager-score">${managerTotal} 点</td>
                        <td style="padding: 1rem;">-</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        ${textFieldsHtml}
        ${gradeRulePreviewHtml}
    `;

    // グローバルにスコア選択ハンドラを公開
    window.selectScore = (itemIdx, type, score) => {
        const item = selectedEvalDetail.items[itemIdx];
        if (!item) return;

        if (type === 'self') {
            item.self_score = score;
        } else if (type === 'manager') {
            item.manager_score = score;
        }

        // DOM再レンダリングを介さず合計点のみ更新してパフォーマンスを稼ぐ
        let selfSum = 0;
        let managerSum = 0;
        selectedEvalDetail.items.forEach(it => {
            selfSum += it.self_score || 0;
            managerSum += it.manager_score || 0;
        });

        selectedEvalDetail.self_total_score = selfSum;
        selectedEvalDetail.manager_total_score = managerSum;

        const sumSelfEl = document.getElementById('sum-self-score');
        const sumMgrEl = document.getElementById('sum-manager-score');
        if (sumSelfEl) sumSelfEl.textContent = `${selfSum} 点`;
        if (sumMgrEl) sumMgrEl.textContent = `${managerSum} 点`;

        // クリックしたボタンのスタイルだけを即時切り替え
        const rowEl = document.getElementById('modal-eval-table-body').children;
        // カテゴリヘッダー等をまたぐため、インデックス補正ではなく正確に対象のtrを探す
        const targetTrs = Array.from(rowEl).filter(tr => tr.style.background === 'white');
        const tr = targetTrs[itemIdx];
        if (tr) {
            const btnCellIdx = (type === 'self') ? 2 : 3;
            const buttons = tr.cells[btnCellIdx].querySelectorAll('.score-btn');
            buttons.forEach(btn => {
                const btnScore = parseInt(btn.textContent.trim());
                if (btnScore === score) {
                    btn.classList.add(type === 'self' ? 'selected-self' : 'selected-manager');
                } else {
                    btn.classList.remove(type === 'self' ? 'selected-self' : 'selected-manager');
                }
            });
        }
    };

    window.updateComment = (itemIdx, type, val) => {
        const item = selectedEvalDetail.items[itemIdx];
        if (item) {
            if (type === 'self') item.self_comment = val;
            if (type === 'manager') item.manager_comment = val;
        }
    };

    window.handleFinalScoreChange = async (val) => {
        const score = parseInt(val) || 0;
        selectedEvalDetail.final_total_score = score;
        
        // 判定等級プレビューをリアルタイムで調べる
        const newGrade = await lookupGradeByScore(score);
        selectedEvalDetail.new_grade = newGrade;
        const prevEl = document.getElementById('modal-new-grade-preview');
        if (prevEl) prevEl.textContent = newGrade;
    };
}

function renderModalFooter(container, mode) {
    const status = selectedEvalDetail.status;
    
    // 一般・被評価者
    if (mode === 'self' && status === 'self_evaluating') {
        container.innerHTML = `
            <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('self')">下書き保存</button>
            <button class="btn btn-primary" style="background:#2563eb; border-color:#2563eb; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitSelfEvaluation()">自己評価を提出する</button>
        `;
    }
    // 店長・上長
    else if (mode === 'manager') {
        if (status === 'self_submitted' || status === 'manager_evaluating') {
            container.innerHTML = `
                <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('manager')">評価を下書き保存</button>
                <button class="btn btn-primary" style="background:#7c3aed; border-color:#7c3aed; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('interviewing')">評価を確定して面談待ちへ</button>
            `;
        } else if (status === 'interviewing') {
            container.innerHTML = `
                <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('manager')">面談メモを下書き保存</button>
                <button class="btn btn-primary" style="background:#a21caf; border-color:#a21caf; color:white; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('president_pending')">面談完了・社長へ最終提出</button>
            `;
        }
    }
    // 社長・承認者
    else if (mode === 'president' && status === 'president_pending') {
        container.innerHTML = `
            <button class="btn btn-primary" style="background:#be123c; border-color:#be123c; font-weight:800; padding:0.6rem 2rem;" onclick="window.approvePresidentEvaluation()">社長査定を確定する</button>
        `;
    }
    // 閲覧モード
    else {
        container.innerHTML = `
            <button class="btn btn-secondary" onclick="document.getElementById('eval-detail-modal').style.display='none'">閉じる</button>
        `;
    }

    // 1. 自己評価の下書き保存
    window.saveEvaluationDraft = async (type) => {
        try {
            // テキストフィールドの値を同期
            if (type === 'manager') {
                const notesEl = document.getElementById('modal-interview-notes');
                const dateEl = document.getElementById('modal-interview-date');
                if (notesEl) selectedEvalDetail.interview_notes = notesEl.value;
                if (dateEl) selectedEvalDetail.interview_date = dateEl.value;
            }

            const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
            await updateDoc(docRef, {
                items: selectedEvalDetail.items,
                self_total_score: selectedEvalDetail.self_total_score,
                manager_total_score: selectedEvalDetail.manager_total_score,
                interview_notes: selectedEvalDetail.interview_notes || '',
                interview_date: selectedEvalDetail.interview_date || '',
                updated_at: new Date().toISOString()
            });
            showAlert('下書き保存', '評価シートの内容を下書き保存しました！');
            await loadEvaluationData();
            renderActiveTabContent();
        } catch (e) {
            console.error(e);
            showAlert('エラー', '保存に失敗しました。');
        }
    };

    // 2. 自己評価の提出
    window.submitSelfEvaluation = () => {
        // 全項目に点数が入っているかバリデーション
        const incomplete = selectedEvalDetail.items.some(it => !it.self_score);
        if (incomplete) {
            return showAlert('入力未完了', 'すべての評価項目（24項目）の点数を入力してください。');
        }

        showConfirm('自己評価の提出', '自己評価を提出します。提出後は変更ができなくなりますが、よろしいですか？', async () => {
            try {
                const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
                await updateDoc(docRef, {
                    items: selectedEvalDetail.items,
                    self_total_score: selectedEvalDetail.self_total_score,
                    status: 'self_submitted', // 提出完了
                    updated_at: new Date().toISOString()
                });
                document.getElementById('eval-detail-modal').style.display = 'none';
                showAlert('提出完了', '自己評価の提出が完了しました！店長による評価と面談をお待ちください。');
                await loadInitialSettingsAndData();
            } catch(e) {
                console.error(e);
                showAlert('エラー', '提出処理に失敗しました。');
            }
        });
    };

    // 3. 上長評価の提出（面談待ちへ、または社長提出へ）
    window.submitManagerEvaluation = (nextStatus) => {
        // 点数バリデーション (面談待ちへ行く時点ですべて入力されている必要がある)
        const incomplete = selectedEvalDetail.items.some(it => !it.manager_score);
        if (incomplete) {
            return showAlert('入力未完了', 'すべての評価項目（24項目）に上長評価点を入力してください。');
        }

        const notesEl = document.getElementById('modal-interview-notes');
        const dateEl = document.getElementById('modal-interview-date');
        if (notesEl) selectedEvalDetail.interview_notes = notesEl.value;
        if (dateEl) selectedEvalDetail.interview_date = dateEl.value;

        // 社長へ提出する際は面談メモが必須
        if (nextStatus === 'president_pending' && (!selectedEvalDetail.interview_notes || !selectedEvalDetail.interview_date)) {
            return showAlert('入力未完了', '面談日および面談内容（記録）を記入してください。');
        }

        const title = nextStatus === 'interviewing' ? '面談待ちへ移行' : '社長への最終提出';
        const msg = nextStatus === 'interviewing' 
            ? '評価を入力完了し、面談待ち状態にしますか？（この後部下と評価シートを見ながら面談を行ってください）'
            : '面談記録を含めて評価を社長に提出します。提出後は変更できなくなりますが、よろしいですか？';

        showConfirm(title, msg, async () => {
            try {
                const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
                await updateDoc(docRef, {
                    items: selectedEvalDetail.items,
                    manager_total_score: selectedEvalDetail.manager_total_score,
                    interview_notes: selectedEvalDetail.interview_notes || '',
                    interview_date: selectedEvalDetail.interview_date || '',
                    status: nextStatus,
                    updated_at: new Date().toISOString()
                });
                
                if (window.backToSubordinateList) window.backToSubordinateList();
                showAlert('完了', nextStatus === 'interviewing' ? '評価を下書き保存し、面談待ちとしました。' : '社長への最終提出が完了しました！');
                await loadInitialSettingsAndData();
            } catch(e) {
                console.error(e);
                showAlert('エラー', '送信処理に失敗しました。');
            }
        });
    };

    // 4. 社長査定の確定
    window.approvePresidentEvaluation = () => {
        const commEl = document.getElementById('modal-president-comment');
        const scoreEl = document.getElementById('modal-final-score');
        if (commEl) selectedEvalDetail.president_comment = commEl.value;
        if (scoreEl) selectedEvalDetail.final_total_score = parseInt(scoreEl.value) || 0;

        showConfirm('社長査定の確定', `このスタッフの評価・等級（新等級: ${selectedEvalDetail.new_grade}）を最終確定しますか？`, async () => {
            try {
                const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
                await updateDoc(docRef, {
                    president_comment: selectedEvalDetail.president_comment || '',
                    final_total_score: selectedEvalDetail.final_total_score,
                    new_grade: selectedEvalDetail.new_grade || '-',
                    status: 'approved', // 確定済
                    updated_at: new Date().toISOString()
                });
                
                if (window.backToSubordinateList) window.backToSubordinateList();
                
                await loadInitialSettingsAndData();
                const wasPublished = await window.autoPublishIfAllApproved();
                
                if (wasPublished) {
                    showAlert('確定＆自動公開完了', '社長査定を確定し、全対象者の評価結果が自動公開されました！');
                } else {
                    showAlert('確定完了', '社長査定を確定しました！');
                }
            } catch(e) {
                console.error(e);
                showAlert('エラー', '確定処理に失敗しました。');
            }
        });
    };
}

// 合計点数から自動的に等級マスタを参照して適用等級キーを算出するロジック
async function lookupGradeByScore(score) {
    try {
        const snap = await getDocs(collection(db, "m_grades"));
        const grades = [];
        snap.forEach(d => {
            grades.push(d.data());
        });

        // 査定最低点と最高点のレンジに含まれるものを検索
        const matched = grades.find(g => {
            const min = g.evaluation_min_score || 0;
            const max = g.evaluation_max_score || 999;
            return score >= min && score <= max;
        });

        return matched ? (matched.grade_code || '-') : '-';
    } catch(e) {
        console.error("Lookup grade error:", e);
        return '-';
    }
}

// 英語ステータスキーの日本語表示名マッピング
function getStatusJpName(status) {
    const map = {
        'not_started': '未開始',
        'self_evaluating': '自己評価中',
        'self_submitted': '自己評価提出済',
        'manager_evaluating': '上長評価中',
        'interviewing': '面談待ち',
        'president_pending': '社長確認待ち',
        'approved': '確定済 (未公開)',
        'notified': '本人通知済 (公開済)'
    };
    return map[status] || status;
}

// ==========================================
// 6. 評価項目マスタ編集（GUIエディタ）機能
// ==========================================

async function openTemplateEditorModal() {
    const container = document.getElementById('template-editor-container');
    if (!container) return;
    
    // 全テンプレートをFirestoreからロード
    try {
        const snap = await getDocs(collection(db, "m_evaluation_templates"));
        editTemplates = {};
        snap.forEach(d => {
            editTemplates[d.id] = {
                id: d.id,
                ...d.data()
            };
        });
    } catch (e) {
        console.error("Failed to load templates for editor:", e);
        showAlert("エラー", "テンプレートデータの読み込みに失敗しました。");
        return;
    }
    
    // 一覧画面に切り替え
    document.getElementById('template-view-list').style.display = 'block';
    document.getElementById('template-view-editor').style.display = 'none';
    document.getElementById('template-view-editor-footer').style.display = 'none';
    
    window.renderTemplateList();
    
    // インライン展開：ダッシュボードや他のコンテンツを隠し、エディタを表示する
    document.getElementById('eval-main-content').style.display = 'none';
    document.getElementById('eval-period-banner').style.display = 'none';
    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) tabsContainer.style.display = 'none';
    
    container.style.display = 'block';
}

window.renderTemplateList = () => {
    const tbody = document.getElementById('template-list-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const templates = Object.values(editTemplates);
    
    // 表示名称の昇順でソート（同じ場合はIDでソート）
    templates.sort((a, b) => {
        const nameA = a.template_name || a.id;
        const nameB = b.template_name || b.id;
        return nameA.localeCompare(nameB, 'ja');
    });

    if (templates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:3rem; color:#64748b;">テンプレートがありません。「新規作成」から作成してください。</td></tr>`;
        return;
    }
    
    templates.forEach(t => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        tr.innerHTML = `
            <td style="padding: 1rem; font-weight: 700; color: #1e293b;">
                ${t.template_name || t.id}
            </td>
            <td style="padding: 1rem; font-family: monospace; font-size: 0.8rem; color: #64748b;">
                ${t.id}
            </td>
            <td style="padding: 1rem; text-align: center;">
                <select onchange="window.updateTemplateStatus('${t.id}', this.value)" style="font-size: 0.75rem; padding: 0.3rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; background: ${t.status === 'archived' ? '#f1f5f9' : '#dcfce7'}; color: ${t.status === 'archived' ? '#475569' : '#166534'}; font-weight: 700; cursor: pointer; outline: none;">
                    <option value="active" ${t.status !== 'archived' ? 'selected' : ''}>運用中</option>
                    <option value="archived" ${t.status === 'archived' ? 'selected' : ''}>運用終了</option>
                </select>
            </td>
            <td style="padding: 1rem;">
                <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: nowrap;">
                    <button class="btn" onclick="window.openTemplateDetail('${t.id}')" style="background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-size:0.75rem; font-weight:700; padding:0.4rem 0.8rem; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'"><i class="fas fa-edit"></i> 編集</button>
                    <button class="btn" onclick="window.renameTemplate('${t.id}')" style="background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-size:0.75rem; font-weight:700; padding:0.4rem 0.8rem; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'"><i class="fas fa-font"></i> 名称変更</button>
                    <button class="btn" onclick="window.duplicateTemplateFromList('${t.id}')" style="background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-size:0.75rem; font-weight:700; padding:0.4rem 0.8rem; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'"><i class="fas fa-copy"></i> 複製</button>
                    <button class="btn" onclick="window.deleteTemplate('${t.id}')" style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:6px; font-size:0.75rem; font-weight:700; padding:0.4rem 0.8rem; transition: background 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'"><i class="fas fa-trash"></i> 削除</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.backToTemplateList = () => {
    document.getElementById('template-view-editor').style.display = 'none';
    document.getElementById('template-view-editor-footer').style.display = 'none';
    document.getElementById('template-view-list').style.display = 'block';
};

window.openTemplateDetail = (id) => {
    activeEditTemplateId = id;
    const t = editTemplates[id];
    document.getElementById('editor-current-template-name').textContent = t.template_name || id;
    document.getElementById('editor-current-template-id').textContent = id;
    
    loadActiveEditTemplate();
    
    document.getElementById('template-view-list').style.display = 'none';
    document.getElementById('template-view-editor').style.display = 'block';
    document.getElementById('template-view-editor-footer').style.display = 'flex';
};

function loadActiveEditTemplate() {
    if (!activeEditTemplateId || !editTemplates[activeEditTemplateId]) {
        activeEditItems = [];
        renderTemplateItems();
        return;
    }
    
    const template = editTemplates[activeEditTemplateId];
    activeEditItems = JSON.parse(JSON.stringify(template.items || []));
    activeEditItems.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
    
    renderTargetJobTitles();
    renderTemplateItems();
}

function renderTargetJobTitles() {
    const container = document.getElementById('editor-target-job-titles');
    if (!container) return;
    
    container.innerHTML = '';
    
    const template = editTemplates[activeEditTemplateId];
    if (!template) return;
    
    const targets = template.target_job_titles || [];
    
    if (globalJobTitles.length === 0) {
        container.innerHTML = '<span style="color:#94a3b8; font-size:0.75rem;">役職データが見つかりません</span>';
        return;
    }
    
    globalJobTitles.forEach(jt => {
        const isChecked = targets.includes(jt);
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '0.3rem';
        label.style.cursor = 'pointer';
        label.style.fontSize = '0.8rem';
        label.style.fontWeight = '600';
        label.style.color = isChecked ? '#1e293b' : '#64748b';
        label.style.background = isChecked ? '#e0e7ff' : '#f1f5f9';
        label.style.padding = '0.4rem 0.8rem';
        label.style.borderRadius = '20px';
        label.style.transition = 'all 0.2s';
        label.style.border = isChecked ? '1px solid #c7d2fe' : '1px solid transparent';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isChecked;
        checkbox.style.cursor = 'pointer';
        checkbox.onchange = () => {
            window.toggleTargetJobTitle(jt, checkbox.checked);
        };
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(jt));
        container.appendChild(label);
    });
}

window.toggleTargetJobTitle = (jobTitle, isChecked) => {
    const template = editTemplates[activeEditTemplateId];
    if (!template) return;
    
    if (!template.target_job_titles) template.target_job_titles = [];
    
    if (isChecked) {
        if (!template.target_job_titles.includes(jobTitle)) {
            template.target_job_titles.push(jobTitle);
        }
    } else {
        template.target_job_titles = template.target_job_titles.filter(jt => jt !== jobTitle);
    }
    renderTargetJobTitles();
};

function renderTemplateItems() {
    const tbody = document.getElementById('template-items-tbody');
    const totalCountEl = document.getElementById('template-total-items-count');
    const warningEl = document.getElementById('template-validation-warning');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (totalCountEl) {
        totalCountEl.textContent = activeEditItems.length;
    }
    
    // 24項目バリデーション警告
    if (warningEl) {
        if (activeEditItems.length !== 24) {
            warningEl.style.display = 'flex';
        } else {
            warningEl.style.display = 'none';
        }
    }
    
    if (activeEditItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-secondary);">項目がありません。「項目を追加する」を押して作成してください。</td></tr>`;
        return;
    }
    
    activeEditItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        
        tr.innerHTML = `
            <!-- 表示順序 -->
            <td style="padding: 0.6rem 0.4rem; text-align: center;">
                <input type="number" value="${item.display_order || (index + 1)}" min="1" 
                       onchange="window.updateTemplateItemField(${index}, 'display_order', this.value)" 
                       style="width: 60px; text-align: center; padding: 0.35rem 0.2rem; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 0.8rem;">
            </td>
            <!-- カテゴリ -->
            <td style="padding: 0.6rem 0.4rem;">
                <input type="text" value="${item.category || ''}" placeholder="例: 労働管理"
                       onchange="window.updateTemplateItemField(${index}, 'category', this.value)"
                       style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.8rem;">
            </td>
            <!-- 項目名 -->
            <td style="padding: 0.6rem 0.4rem;">
                <textarea rows="2" placeholder="評価項目の内容を入力"
                          onchange="window.updateTemplateItemField(${index}, 'title', this.value)"
                          style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: vertical;">${item.title || ''}</textarea>
            </td>
            <!-- 基準説明 -->
            <td style="padding: 0.6rem 0.4rem;">
                <textarea rows="2" placeholder="具体的な評価基準を記載"
                          onchange="window.updateTemplateItemField(${index}, 'description', this.value)"
                          style="width: 100%; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: vertical;">${item.description || ''}</textarea>
            </td>
            <!-- 操作 (削除) -->
            <td style="padding: 0.6rem 0.4rem; text-align: center;">
                <button type="button" class="btn" onclick="window.deleteTemplateItem(${index})" 
                        style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 0.4rem; border-radius: 50%; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s;"
                        onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function checkUnsavedChanges() {
    if (!activeEditTemplateId || !editTemplates[activeEditTemplateId]) return false;
    
    const originalItems = editTemplates[activeEditTemplateId].items || [];
    
    const normalize = (items) => items.map((it, idx) => ({
        category: (it.category || '').trim(),
        title: (it.title || '').trim(),
        description: (it.description || '').trim(),
        display_order: parseInt(it.display_order) || (idx + 1)
    }));
    
    return JSON.stringify(normalize(activeEditItems)) !== JSON.stringify(normalize(originalItems));
}

async function closeTemplateEditorModal() {
    const closeAction = () => {
        document.getElementById('template-editor-container').style.display = 'none';
        document.getElementById('eval-main-content').style.display = 'block';
        document.getElementById('eval-period-banner').style.display = 'flex';
        const tabsContainer = document.querySelector('.tabs-container');
        if (tabsContainer) tabsContainer.style.display = 'flex';
    };

    if (checkUnsavedChanges()) {
        const confirmClose = await showConfirm(
            "変更の破棄",
            "編集中の変更内容が保存されていません。変更を破棄して閉じますか？"
        );
        if (confirmClose) closeAction();
    } else {
        closeAction();
    }
}

function addTemplateItem() {
    const nextOrder = activeEditItems.reduce((max, it) => Math.max(max, it.display_order || 0), 0) + 1;
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nextItemId = '';
    for (let i = 0; i < 20; i++) {
        nextItemId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    activeEditItems.push({
        item_id: nextItemId,
        category: activeEditItems.length > 0 ? activeEditItems[activeEditItems.length - 1].category : '労働管理',
        title: '',
        description: '',
        display_order: nextOrder
    });
    
    renderTemplateItems();
    
    setTimeout(() => {
        const tbody = document.getElementById('template-items-tbody');
        if (tbody && tbody.lastElementChild) {
            tbody.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            tbody.lastElementChild.querySelector('textarea')?.focus();
        }
    }, 50);
}

window.updateTemplateItemField = (idx, field, val) => {
    if (!activeEditItems[idx]) return;
    if (field === 'display_order') {
        activeEditItems[idx][field] = parseInt(val) || (idx + 1);
    } else {
        activeEditItems[idx][field] = val;
    }
    
    // 項目数および警告表示を更新
    const totalCountEl = document.getElementById('template-total-items-count');
    const warningEl = document.getElementById('template-validation-warning');
    if (totalCountEl) totalCountEl.textContent = activeEditItems.length;
    if (warningEl) {
        if (activeEditItems.length !== 24) {
            warningEl.style.display = 'flex';
        } else {
            warningEl.style.display = 'none';
        }
    }
};

window.deleteTemplateItem = (idx) => {
    showConfirm("項目の削除", "この評価項目をテンプレートから削除しますか？\n(「保存する」ボタンを押すまでデータベースには反映されません)", () => {
        activeEditItems.splice(idx, 1);
        renderTemplateItems();
    });
};

window.duplicateTemplateFromList = async (sourceId) => {
    const sourceTemplate = editTemplates[sourceId];
    if (!sourceTemplate) return;

    const templateId = prompt(`「${sourceTemplate.template_name || sourceId}」を複製します。\n新しい評価シートのシステムID（半角英数字）を入力してください。\n（例: ${sourceId}_copy）`);
    if (templateId === null) return;
    
    const cleanId = templateId.trim().toLowerCase();
    if (!cleanId || !/^[a-z0-9_]+$/.test(cleanId)) {
        return showAlert("入力エラー", "テンプレートIDは半角英数字（小文字）およびアンダースコアのみで入力してください。");
    }
    
    if (editTemplates[cleanId]) {
        return showAlert("入力エラー", "入力されたテンプレートIDはすでに存在しています。");
    }
    
    const templateName = prompt("新しい評価シートの表示名称を入力してください。\n（例: 2026年1〜3月 店長用）");
    if (templateName === null) return;
    
    const cleanName = templateName.trim();
    if (!cleanName) {
        return showAlert("入力エラー", "表示名称を入力してください。");
    }
    
    // DBに即時保存
    try {
        const copiedItems = JSON.parse(JSON.stringify(sourceTemplate.items || []));
        const newData = {
            template_name: cleanName,
            items: copiedItems,
            updated_at: new Date().toISOString()
        };
        await setDoc(doc(db, "m_evaluation_templates", cleanId), newData);
        
        editTemplates[cleanId] = { id: cleanId, ...newData };
        window.renderTemplateList();
        showAlert("複製完了", `「${cleanName}」を作成しました。`);
    } catch(e) {
        console.error("Duplicate failed", e);
        showAlert("エラー", "複製の保存に失敗しました。");
    }
};

window.createNewTemplate = async () => {
    const templateId = prompt("新しい評価シートのシステムID（半角英数字）を入力してください。\n（例: new_template）");
    if (templateId === null) return;
    
    const cleanId = templateId.trim().toLowerCase();
    if (!cleanId || !/^[a-z0-9_]+$/.test(cleanId)) {
        return showAlert("入力エラー", "テンプレートIDは半角英数字（小文字）およびアンダースコアのみで入力してください。");
    }
    
    if (editTemplates[cleanId]) {
        return showAlert("入力エラー", "入力されたテンプレートIDはすでに存在しています。");
    }
    
    const templateName = prompt("新しい評価シートの表示名称を入力してください。\n（例: 新規評価シート）");
    if (templateName === null) return;
    
    const cleanName = templateName.trim();
    if (!cleanName) {
        return showAlert("入力エラー", "表示名称を入力してください。");
    }
    
    let defaultItems = [];
    if (editTemplates['general']) {
        defaultItems = JSON.parse(JSON.stringify(editTemplates['general'].items || []));
    }
    
    try {
        const newData = {
            template_name: cleanName,
            items: defaultItems,
            updated_at: new Date().toISOString()
        };
        await setDoc(doc(db, "m_evaluation_templates", cleanId), newData);
        
        editTemplates[cleanId] = { id: cleanId, ...newData };
        window.renderTemplateList();
        showAlert("作成完了", `新しいテンプレート「${cleanName}」を作成しました。`);
    } catch(e) {
        console.error("Create failed", e);
        showAlert("エラー", "新規作成に失敗しました。");
    }
};

window.renameTemplate = async (id) => {
    const template = editTemplates[id];
    if (!template) return;
    
    const newName = prompt("新しい表示名称を入力してください。", template.template_name || id);
    if (newName === null) return;
    
    const cleanName = newName.trim();
    if (!cleanName) {
        return showAlert("入力エラー", "表示名称は空にできません。");
    }
    
    try {
        await updateDoc(doc(db, "m_evaluation_templates", id), {
            template_name: cleanName,
            updated_at: new Date().toISOString()
        });
        
        editTemplates[id].template_name = cleanName;
        window.renderTemplateList();
    } catch(e) {
        console.error("Rename failed", e);
        showAlert("エラー", "名称変更に失敗しました。");
    }
};

window.updateTemplateStatus = async (id, newStatus) => {
    try {
        await updateDoc(doc(db, "m_evaluation_templates", id), {
            status: newStatus,
            updated_at: new Date().toISOString()
        });
        editTemplates[id].status = newStatus;
        window.renderTemplateList();
    } catch(e) {
        console.error("Update status failed", e);
        showAlert("エラー", "ステータスの変更に失敗しました。");
    }
};

window.deleteTemplate = async (id) => {
    const template = editTemplates[id];
    if (!template) return;
    
    const confirmDelete = await showConfirm(
        "本当に削除しますか？",
        `「${template.template_name || id}」を削除しますか？\n\n【警告】過去データには干渉しませんが、現在進行中の評価でこのシートが使われている場合はスタッフの評価画面が壊れる可能性があります。`
    );
    
    if (confirmDelete) {
        try {
            await deleteDoc(doc(db, "m_evaluation_templates", id));
            delete editTemplates[id];
            window.renderTemplateList();
        } catch(e) {
            console.error("Delete failed", e);
            showAlert("エラー", "削除に失敗しました。");
        }
    }
};

window.saveActiveTemplate = async () => {
    if (!activeEditTemplateId) return;
    
    const btnSave = document.getElementById('btn-save-template');
    if (!btnSave) return;
    
    if (activeEditItems.length !== 24) {
        return showAlert("保存エラー", `合計項目数が24項目ではありません（現在${activeEditItems.length}項目）。\n120点満点の整合性を保つため、24項目に調整するまで保存できません。`);
    }
    
    const hasEmpty = activeEditItems.some(it => !it.category.trim() || !it.title.trim());
    if (hasEmpty) {
        return showAlert("入力エラー", "カテゴリおよび項目タイトルが空の項目があります。すべての項目を入力してください。");
    }
    
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    btnSave.disabled = true;
    
    try {
        const docRef = doc(db, "m_evaluation_templates", activeEditTemplateId);
        const templateName = editTemplates[activeEditTemplateId]?.template_name || activeEditTemplateId;
        const targetJobTitles = editTemplates[activeEditTemplateId]?.target_job_titles || [];
        
        await setDoc(docRef, {
            template_name: templateName,
            target_job_titles: targetJobTitles,
            items: activeEditItems.map((item, idx) => {
                let fallbackId = '';
                if (!item.item_id) {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    for (let i = 0; i < 20; i++) fallbackId += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return {
                    item_id: item.item_id || fallbackId,
                    category: item.category.trim(),
                    title: item.title.trim(),
                    description: (item.description || '').trim(),
                    display_order: parseInt(item.display_order) || (idx + 1)
                };
            })
        }, { merge: true }); // Use merge to preserve status
        
        editTemplates[activeEditTemplateId].items = JSON.parse(JSON.stringify(activeEditItems));
        showAlert("保存成功", `評価項目マスタ「${templateName}」を保存しました！`);
        
    } catch (e) {
        console.error("Failed to save template:", e);
        showAlert("エラー", "評価項目の保存に失敗しました。");
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
};

window.updateSelectionCounter = function() {
    const checkboxes = document.querySelectorAll('.eval-user-checkbox');
    if (!checkboxes || checkboxes.length === 0) return;
    
    const total = checkboxes.length;
    const selected = Array.from(checkboxes).filter(cb => cb.checked).length;
    const badge = document.getElementById('selection-counter-badge');
    
    if (badge) {
        badge.innerHTML = `<i class="fas fa-users"></i> 選択中: ${selected}名 / 全${total}名`;
        if (selected === 0) {
            badge.style.background = '#fef2f2';
            badge.style.color = '#ef4444';
            badge.style.borderColor = '#fecaca';
        } else {
            badge.style.background = '#ecfdf5';
            badge.style.color = '#10b981';
            badge.style.borderColor = '#a7f3d0';
        }
    }
};

window.toggleAllEvalUsers = function(checked) {
    document.querySelectorAll('.eval-user-checkbox').forEach(cb => cb.checked = checked);
    window.updateSelectionCounter();
};

window.selectOnlySelfForEval = function() {
    const myId = window.appState?.currentUser?.id;
    if (!myId) return;
    document.querySelectorAll('.eval-user-checkbox').forEach(cb => {
        cb.checked = (cb.value === myId);
    });
    window.updateSelectionCounter();
};

// ==========================================
// 過去データのアーカイブ取り込みロジック (Phase 2)
// ==========================================
let legacyImportItems = [];

window.openLegacyImportModal = async () => {
    if (Object.keys(editTemplates).length === 0) {
        try {
            const snap = await getDocs(collection(db, "m_evaluation_templates"));
            editTemplates = {};
            snap.forEach(d => {
                editTemplates[d.id] = { id: d.id, ...d.data() };
            });
        } catch (e) {
            console.error("Failed to load templates:", e);
            return showAlert("エラー", "テンプレートの読み込みに失敗しました。");
        }
    }
    
    const userSelect = document.getElementById('legacy-user-select');
    userSelect.innerHTML = allStaffUsersForAdmin.map(u => 
        `<option value="${u.id}">${u.Name} (${u.StoreId || '本店'} / ${u.Role === 'Manager' ? '店長' : 'スタッフ'})</option>`
    ).join('');
    
    const templateSelect = document.getElementById('legacy-template-select');
    templateSelect.innerHTML = Object.values(editTemplates).map(t => 
        `<option value="${t.id}">${t.template_name}</option>`
    ).join('');
    
    templateSelect.onchange = () => loadLegacyTemplateItems(templateSelect.value);
    
    if (Object.keys(editTemplates).length > 0) {
        loadLegacyTemplateItems(templateSelect.value);
    }
    
    document.getElementById('legacy-period').value = '';
    document.getElementById('legacy-grade').value = '';
    document.getElementById('legacy-total-score').value = '';
    document.getElementById('legacy-memo').value = '';
    
    document.getElementById('legacy-import-modal').style.display = 'flex';
};

window.closeLegacyImportModal = () => {
    document.getElementById('legacy-import-modal').style.display = 'none';
};

function loadLegacyTemplateItems(templateId) {
    const template = editTemplates[templateId];
    if (!template) return;
    
    legacyImportItems = JSON.parse(JSON.stringify(template.items || []));
    
    const tbody = document.getElementById('legacy-items-tbody');
    tbody.innerHTML = legacyImportItems.map((item, idx) => `
        <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 0.5rem; font-weight: 700; color: #1e293b;">
                <div style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:0.2rem;">${item.category}</div>
                ${item.title}
            </td>
            <td style="padding: 0.5rem;">
                <input type="text" id="legacy-memo-${idx}" placeholder="当時の文言などメモ" style="width: 100%; padding: 0.4rem; font-size: 0.8rem; border: 1px solid #cbd5e1; border-radius: 4px;">
            </td>
            <td style="padding: 0.5rem; text-align: center;">
                <input type="number" id="legacy-score-${idx}" min="1" max="5" placeholder="点" style="width: 60px; padding: 0.4rem; font-weight: 800; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;">
            </td>
        </tr>
    `).join('');
}

window.saveLegacyImportData = async () => {
    const period = document.getElementById('legacy-period').value.trim();
    const userId = document.getElementById('legacy-user-select').value;
    const templateId = document.getElementById('legacy-template-select').value;
    const grade = document.getElementById('legacy-grade').value.trim();
    const totalScoreStr = document.getElementById('legacy-total-score').value.trim();
    const memo = document.getElementById('legacy-memo').value.trim();
    
    if (!period || !userId) {
        return showAlert('入力エラー', '対象期と対象スタッフは必須です。');
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
        return showAlert('入力エラー', '対象期は「YYYY-MM」形式で入力してください (例: 2025-12)。');
    }
    
    const user = allStaffUsersForAdmin.find(u => u.id === userId);
    
    const evalData = {};
    for (let i = 0; i < legacyImportItems.length; i++) {
        const item = legacyImportItems[i];
        const scoreVal = document.getElementById(`legacy-score-${i}`).value;
        const memoVal = document.getElementById(`legacy-memo-${i}`).value.trim();
        
        evalData[item.item_id] = {
            self_score: parseInt(scoreVal) || 0,
            manager_score: parseInt(scoreVal) || 0,
            legacy_memo: memoVal
        };
    }
    
    const docId = `${period}_${userId}_legacy`;
    const docRef = doc(db, "t_evaluations", docId);
    
    const btnSave = document.getElementById('btn-save-legacy');
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    btnSave.disabled = true;
    
    try {
        await setDoc(docRef, {
            id: docId,
            period: period,
            user_id: userId,
            user_name: user?.Name || '不明',
            store_id: user?.StoreId || '',
            department: user?.Department || '',
            status: 'approved',
            is_legacy_archive: true,
            template_id: templateId,
            template_snapshot: legacyImportItems,
            eval_data: evalData,
            self_total_score: parseFloat(totalScoreStr) || 0,
            manager_total_score: parseFloat(totalScoreStr) || 0,
            final_total_score: parseFloat(totalScoreStr) || 0,
            current_grade: grade,
            new_grade: grade,
            manager_comment: memo,
            president_comment: '',
            updated_at: new Date().toISOString()
        });
        
        showAlert('保存完了', `${period}期の ${user?.Name} さんのアーカイブデータを保存しました。`);
        window.closeLegacyImportModal();
        
        await loadEvaluationData();
        renderActiveTabContent();
        
    } catch (e) {
        console.error('Failed to save legacy data:', e);
        showAlert('エラー', '保存に失敗しました。');
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
};

window.cachedHistories = {};

window.openEvaluationHistory = async (userId, userName) => {
    const modal = document.getElementById('eval-history-modal');
    const content = document.getElementById('history-content-area');
    
    modal.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center; padding:3rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--text-secondary);"></i><div style="margin-top:1rem; color:var(--text-secondary); font-size:0.9rem; font-weight:700;">履歴を読み込んでいます...</div></div>';
    
    try {
        const q = query(collection(db, "t_evaluations"), where("user_id", "==", userId));
        const snap = await getDocs(q);
        
        let histories = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.status === 'approved' || data.status === 'notified' || data.is_legacy_archive) {
                histories.push({ id: d.id, ...data });
                window.cachedHistories[d.id] = { id: d.id, ...data };
            }
        });
        
        histories.sort((a, b) => b.period.localeCompare(a.period));
        
        if (histories.length === 0) {
            content.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-secondary); font-weight:700;">過去の確定済み評価履歴はありません。</div>';
            return;
        }
        
        let html = `
            <h4 style="margin:0 0 1rem; color:#1e293b;"><i class="fas fa-user-circle" style="color:var(--primary); margin-right:0.4rem;"></i>${userName} さんの評価履歴</h4>
            <div style="overflow-x:auto;">
                <table class="eval-table">
                    <thead>
                        <tr>
                            <th style="text-align:left;">対象期</th>
                            <th style="text-align:left;">データ種別</th>
                            <th style="text-align:center;">確定点数</th>
                            <th style="text-align:center;">等級判定</th>
                            <th style="text-align:right;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        histories.forEach(h => {
            const isLegacy = h.is_legacy_archive ? '<span style="font-size:0.7rem; background:#cbd5e1; color:white; padding:0.2rem 0.4rem; border-radius:4px; font-weight:800;"><i class="fas fa-archive"></i> 手入力アーカイブ</span>' : '<span style="font-size:0.7rem; background:#3b82f6; color:white; padding:0.2rem 0.4rem; border-radius:4px; font-weight:800;"><i class="fas fa-laptop"></i> システム判定</span>';
            const score = h.final_total_score || h.manager_total_score || h.self_total_score || '-';
            
            html += `
                <tr style="background:white; border-bottom:1px solid #e2e8f0;">
                    <td style="font-weight:800; color:#1e293b;">${h.period}期</td>
                    <td>${isLegacy}</td>
                    <td style="text-align:center; font-weight:800; color:#be123c;">${score}</td>
                    <td style="text-align:center; font-family:monospace; font-weight:800; color:#059669;">${h.new_grade || '-'}</td>
                    <td style="text-align:right;">
                        <button class="btn btn-secondary" onclick="window.viewHistoryDetail('${h.id}')" style="font-size:0.75rem; padding:0.4rem 0.8rem; background:white; border-color:#cbd5e1; font-weight:800;"><i class="fas fa-file-alt" style="color:var(--primary);"></i> 詳細を見る</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div>`;
        content.innerHTML = html;
        
    } catch(e) {
        console.error(e);
        content.innerHTML = '<div style="color:#ef4444; text-align:center; padding:2rem; font-weight:700;"><i class="fas fa-exclamation-triangle"></i> 読み込みエラーが発生しました。</div>';
    }
};

window.viewHistoryDetail = (evalId) => {
    const h = window.cachedHistories[evalId];
    if (!h) return;
    
    document.getElementById('history-detail-title').innerHTML = `<i class="fas fa-file-alt" style="color:var(--primary);"></i> ${h.period}期 ${h.user_name} さんの評価詳細`;
    
    let itemsHtml = '';
    const snapshotItems = h.template_snapshot || h.items || [];
    const evalData = h.eval_data || {};
    
    snapshotItems.forEach(item => {
        const scoreData = evalData[item.item_id] || {};
        const managerScore = scoreData.manager_score || scoreData.score || '-';
        
        itemsHtml += `
            <tr style="background:white; border-bottom:1px solid #e2e8f0;">
                <td style="padding: 0.8rem; font-size:0.85rem;">
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:0.2rem; font-weight:700;">${item.category}</div>
                    <div style="font-weight:800; color:#1e293b;">${item.title}</div>
                    ${scoreData.legacy_memo ? `<div style="font-size:0.75rem; color:#d97706; margin-top:0.4rem; background:#fffbeb; padding:0.5rem; border-radius:6px; border:1px solid #fde68a;"><i class="fas fa-info-circle"></i> <b>当時のメモ:</b> ${scoreData.legacy_memo}</div>` : ''}
                </td>
                <td style="padding: 0.8rem; text-align:center; font-weight:900; color:#7c3aed; font-size:1.2rem;">
                    ${managerScore}
                </td>
            </tr>
        `;
    });
    
    const content = `
        <div style="display:flex; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
            <div style="flex:1; background:white; padding:1.2rem; border-radius:12px; border:1px solid #cbd5e1; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-size:0.8rem; color:var(--text-secondary); font-weight:800;">最終総合点数</div>
                <div style="font-size:1.8rem; font-weight:900; color:#be123c; margin-top:0.4rem;">${h.final_total_score || h.manager_total_score || h.self_total_score || '-'}</div>
            </div>
            <div style="flex:1; background:white; padding:1.2rem; border-radius:12px; border:1px solid #cbd5e1; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-size:0.8rem; color:var(--text-secondary); font-weight:800;">決定等級</div>
                <div style="font-size:1.8rem; font-weight:900; font-family:monospace; color:#059669; margin-top:0.4rem;">${h.new_grade || '-'}</div>
            </div>
        </div>
        
        <div style="background:white; padding:1.2rem; border-radius:12px; border:1px solid #cbd5e1; margin-bottom:1.5rem; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <div style="font-size:0.85rem; color:var(--text-secondary); font-weight:800; margin-bottom:0.6rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.4rem;"><i class="fas fa-comment-dots" style="color:var(--primary);"></i> 総括コメント・面談メモ</div>
            <div style="font-size:0.95rem; color:#1e293b; white-space:pre-wrap; line-height:1.6;">${h.manager_comment || h.president_comment || '<span style="color:#94a3b8; font-size:0.85rem;">（コメントの記録はありません）</span>'}</div>
        </div>
        
        <div style="background:white; border-radius:12px; border:1px solid #cbd5e1; overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <table class="eval-table" style="margin:0;">
                <thead>
                    <tr>
                        <th style="text-align:left;">評価項目</th>
                        <th style="text-align:center; width:100px;">当時の点数</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml || '<tr><td colspan="2" style="text-align:center; padding:2rem;">詳細データがありません。</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
    
    document.getElementById('history-detail-content').innerHTML = content;
    document.getElementById('eval-history-detail-modal').style.display = 'flex';
};

// ==========================================
// 7. 全自動公開・ロック処理
// ==========================================
window.autoPublishIfAllApproved = async () => {
    try {
        const snap = await getDocs(query(collection(db, "t_evaluations"), where("period", "==", localPeriodSettings.active_period)));
        let total = 0;
        let approvedOrNotified = 0;
        let pendingEvals = [];

        snap.forEach(d => {
            total++;
            const st = d.data().status;
            if (st === 'approved' || st === 'notified') {
                approvedOrNotified++;
            }
            if (st === 'approved') {
                pendingEvals.push(d.ref);
            }
        });

        // もし全員の評価が承認済みであれば自動公開＆ロックを実行
        if (total > 0 && total === approvedOrNotified) {
            const batch = writeBatch(db);
            
            // 1. 各評価データを notified に更新
            pendingEvals.forEach(ref => {
                batch.update(ref, { status: 'notified', updated_at: new Date().toISOString() });
            });
            
            // 2. 評価期(settings)のステータスを closed に更新
            batch.update(doc(db, "settings", "evaluation"), {
                status: 'closed',
                updated_at: new Date().toISOString()
            });

            // 3. 通知 (Notification) を追加
            const notifRef = doc(collection(db, "notifications"));
            batch.set(notifRef, {
                title: `${localPeriodSettings.active_period}期の評価結果が公開されました`,
                message: `全対象者の評価が確定し、結果が公開されました。マイページから確認してください。`,
                type: 'evaluation_published',
                target: 'all',
                created_at: new Date().toISOString(),
                is_read: false
            });

            await batch.commit();
            return true;
        }
        return false;
    } catch(e) {
        console.error("Auto publish error:", e);
        return false;
    }
};

// ==========================================
// 8. 評価開始フォームのインライン展開
// ==========================================
window.renderEvalUserList = () => {
    const listContainer = document.getElementById('start-period-user-list');
    if (!listContainer) return;

    const escapeHTML = (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, function(match) {
            const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return escapeMap[match];
        });
    };

    const targetType = document.getElementById('select-period-employment')?.value || 'Full-time';

    // 雇用形態でフィルタリング。既存のデータで未入力のものは表示されない
    const filteredUsers = allStaffUsersForAdmin.filter(u => {
        return u.EmploymentType === targetType;
    });

    listContainer.innerHTML = filteredUsers.map(u => {
        const safeName = escapeHTML(u.Name);
        const safeStore = escapeHTML(globalStoreMapForEval[u.StoreId] || u.StoreId || '本店');
        const safeRole = u.Role === 'Manager' ? '店長' : 'スタッフ';
        const roleColorBg = u.Role === 'Manager' ? '#fef3c7' : '#f1f5f9';
        const roleColorText = u.Role === 'Manager' ? '#d97706' : '#64748b';
        const roleBorder = u.Role === 'Manager' ? '#fde68a' : '#e2e8f0';

        const safeEmpType = u.EmploymentType === 'Part-time' ? 'アルバイト' : '正社員';
        const empTypeColorBg = u.EmploymentType === 'Part-time' ? '#e0f2fe' : '#dcfce7';
        const empTypeColorText = u.EmploymentType === 'Part-time' ? '#0369a1' : '#166534';
        const empTypeBorder = u.EmploymentType === 'Part-time' ? '#bae6fd' : '#bbf7d0';

        return `
        <div class="eval-list-grid" style="padding: 0.8rem 1.2rem; border-bottom: 1px solid #e2e8f0; cursor: pointer; background: white; transition: background-color 0.2s; margin: 0;" 
             onmouseover="this.style.backgroundColor='#f8fafc'" 
             onmouseout="this.style.backgroundColor='white'"
             onclick="if(event.target.tagName !== 'INPUT') { const cb = this.querySelector('.eval-user-checkbox'); cb.checked = !cb.checked; window.updateSelectionCounter(); }">
            <input type="checkbox" name="target_users" value="${u.id}" class="eval-user-checkbox" checked onchange="window.updateSelectionCounter()" style="width: 1.25rem; height: 1.25rem; accent-color: #10b981; cursor: pointer; justify-self: center; margin: 0;">
            <div style="font-size: 1rem; font-weight: 800; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${safeName}">${safeName}</div>
            <div style="font-size: 0.9rem; color: #475569; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><i class="fas fa-store" style="font-size: 0.8rem; margin-right: 0.3rem; color: #94a3b8;"></i>${safeStore}</div>
            <div style="font-size: 0.9rem; color: #64748b; font-weight: 600;"><span style="background: ${empTypeColorBg}; color: ${empTypeColorText}; padding: 0.2rem 0.6rem; border-radius: 4px; border: 1px solid ${empTypeBorder}; white-space: nowrap;">${safeEmpType}</span></div>
            <div style="font-size: 0.9rem; color: #64748b; font-weight: 600;"><span style="background: ${roleColorBg}; color: ${roleColorText}; padding: 0.2rem 0.6rem; border-radius: 4px; border: 1px solid ${roleBorder}; white-space: nowrap;"><i class="fas fa-tag" style="font-size: 0.7rem; margin-right: 0.3rem;"></i>${safeRole}</span></div>
        </div>
        `;
    }).join('');
    
    // カウンターの初期表示を更新
    setTimeout(() => window.updateSelectionCounter(), 50);
};

window.openPeriodStartForm = () => {
    // 既存のメインコンテンツ（ダッシュボード等）を非表示
    document.getElementById('eval-main-content').style.display = 'none';
    // 新規開始フォームを表示
    document.getElementById('period-start-container').style.display = 'block';

    // 対象者リストを動的にレンダリング
    window.renderEvalUserList();
};

window.closePeriodStartForm = () => {
    document.getElementById('period-start-container').style.display = 'none';
    document.getElementById('eval-main-content').style.display = 'block';
};
