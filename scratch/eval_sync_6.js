import { db } from './firebase.js';
import { collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, where, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

// マスタデータキャッシュ（ページ滞在中は再取得しない）
let _masterCache = {
    stores: null,
    grades: null,
    routes: null,
    users: null,
    cacheTime: null
};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分間キャッシュ有効

export const evaluationPageHtml = `
    <style>
        .eval-score-cell { position: relative; }
        .eval-tooltip {
            display: none; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
            background: rgba(30, 41, 59, 0.95); color: white; padding: 0.8rem 1rem; border-radius: 8px;
            font-size: 0.75rem; line-height: 1.5; min-width: 260px; max-width: 400px; width: max-content; z-index: 1000; pointer-events: none;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); margin-bottom: 8px; text-align: left;
            white-space: pre-wrap; word-break: break-word;
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
        .eval-score-cell.comment-tooltip .eval-tooltip {
            left: auto;
            right: -30px;
            transform: translateY(5px);
        }
        .eval-score-cell.comment-tooltip:hover .eval-tooltip {
            animation: fadeInTooltipRight 0.15s ease-out forwards;
        }
        @keyframes fadeInTooltipRight {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .eval-score-cell.comment-tooltip .eval-tooltip::after {
            left: auto;
            right: 34px;
            margin-left: 0;
        }
        
        /* 下方向に開くツールチップ（上部の行用） */
        .eval-score-cell.tooltip-down .eval-tooltip {
            top: 100%;
            bottom: auto;
            margin-top: 8px;
            margin-bottom: 0;
            transform: translate(-50%, -5px);
        }
        .eval-score-cell.tooltip-down .eval-tooltip::after {
            top: -6px;
            bottom: auto;
            border-width: 0 6px 6px 6px;
            border-color: transparent transparent rgba(30, 41, 59, 0.95) transparent;
        }
        .eval-score-cell:hover.tooltip-down .eval-tooltip {
            animation: fadeInTooltipDown 0.15s ease-out forwards;
        }
        @keyframes fadeInTooltipDown {
            from { opacity: 0; transform: translate(-50%, -5px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }

        /* comment-tooltip と tooltip-down の複合 */
        .eval-score-cell.comment-tooltip.tooltip-down .eval-tooltip {
            top: 100%;
            bottom: auto;
            margin-top: 8px;
            margin-bottom: 0;
            transform: translateY(-5px);
        }
        .eval-score-cell.comment-tooltip.tooltip-down .eval-tooltip::after {
            top: -6px;
            bottom: auto;
            border-width: 0 6px 6px 6px;
            border-color: transparent transparent rgba(30, 41, 59, 0.95) transparent;
        }
        .eval-score-cell.comment-tooltip.tooltip-down:hover .eval-tooltip {
            animation: fadeInTooltipRightDown 0.15s ease-out forwards;
        }
        @keyframes fadeInTooltipRightDown {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .tab-ping-indicator {
            position: absolute;
            top: 6px;
            right: 6px;
            width: 8px;
            height: 8px;
            background-color: #ef4444;
            border-radius: 50%;
            z-index: 10;
        }
        .tab-ping-indicator::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 50%;
            background-color: #ef4444;
            animation: ping-anim 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes ping-anim {
            75%, 100% { transform: scale(2.5); opacity: 0; }
        }
        .tab-has-task {
            color: #ef4444 !important;
        }
        /* PC向け広々テーブルデザイン */
        .eval-table {
            width: 100%;
            border-collapse: collapse;
        }
        .eval-table thead th {
            background-color: #10b981;
            color: #ffffff;
            font-weight: 800;
            white-space: nowrap !important;
            padding: 0.8rem 1rem;
            border-bottom: none;
        }
        .eval-table tbody td {
            white-space: nowrap !important;
            vertical-align: middle;
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
        <div id="eval-period-banner" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <div class="glass-panel" style="padding: 1rem 1.5rem; background: white; border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 700; white-space: nowrap;">進行状況</div>
                <div id="banner-status-text" style="font-size: 1rem; font-weight: 800; color: #1e293b; white-space: nowrap;">読込中...</div>
            </div>
            
            <div class="glass-panel" style="padding: 1rem 1.5rem; background: white; border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 700; white-space: nowrap;">現在の評価期</div>
                <div id="banner-period-title" style="font-size: 1rem; font-weight: 800; color: #1e293b; white-space: nowrap;">読込中...</div>
            </div>

            <div class="glass-panel" style="padding: 1rem 1.5rem; background: white; border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 700; white-space: nowrap;">評価区分</div>
                <div id="banner-period-desc" style="font-size: 1rem; font-weight: 800; color: #1e293b; white-space: nowrap;">読込中...</div>
            </div>

            <div class="glass-panel" style="padding: 0.5rem 1.5rem; background: white; border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02); gap: 0;">
                <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 700; white-space: nowrap;">最終評価の締切日</div>
                <div id="banner-deadline-text" style="font-size: 1rem; font-weight: 800; color: #1e293b; white-space: nowrap;">読込中...</div>
            </div>
        </div>

        <div class="tabs-container no-print" style="display: flex; border-bottom: 2px solid var(--border); margin-bottom: 1.5rem; gap: 0.5rem; flex-wrap: wrap;">
            <button class="tab-btn" id="tab-admin" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; position: relative;">
                全体管理
            </button>
            <button class="tab-btn active" id="tab-self" style="padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; position: relative;">
                自己評価
            </button>
            <button class="tab-btn" id="tab-history" style="padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; position: relative;">
                過去の履歴
            </button>
            <button class="tab-btn" id="tab-subordinates" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; position: relative;">
                部下の評価 <span class="count-badge" id="subordinates-badge" style="display:none; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 10px; background: #ec4899; color: white;">0</span>
            </button>
            <button class="tab-btn" id="tab-interview" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; position: relative;">
                面談 <span class="count-badge" id="interview-badge" style="display:none; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 10px; background: #059669; color: white;">0</span>
            </button>
            <button class="tab-btn" id="tab-president" style="display: none; padding: 0.75rem 1.5rem; font-weight: 800; border: none; background: transparent; border-bottom: 3px solid transparent; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; position: relative;">
                社長承認 <span class="count-badge" id="president-badge" style="display:none; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 10px; background: #8b5cf6; color: white;">0</span>
            </button>
            
            <!-- 管理者用 特殊操作ボタン (右寄せ) -->
            <div style="margin-left: auto; display: none; gap: 0.5rem; align-items: center; padding-bottom: 0.5rem;" id="admin-management-buttons">
                <button class="btn btn-secondary" id="btn-admin-workflow-tab" title="評価ルート（ワークフロー）設定" style="display: none; padding: 0.5rem; width: 36px; height: 36px; align-items: center; justify-content: center; font-size: 1.1rem; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-route"></i>
                </button>
                <button class="btn btn-secondary" id="btn-admin-edit-templates-tab" title="評価項目マスタ編集" style="display: none; padding: 0.5rem; width: 36px; height: 36px; align-items: center; justify-content: center; font-size: 1.1rem; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-cog"></i>
                </button>
                <button class="btn btn-secondary" id="btn-admin-edit-quiz-tab" title="テスト(試験)マスタ管理" style="display: none; padding: 0.5rem; width: 36px; height: 36px; align-items: center; justify-content: center; font-size: 1.1rem; border: 1px solid #cbd5e1; background: #f8fafc; color: #8b5cf6; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-spell-check"></i>
                </button>
                <button class="btn btn-secondary" id="btn-admin-cancel-period-tab" title="評価リセット" style="display: none; padding: 0.5rem; width: 36px; height: 36px; align-items: center; justify-content: center; font-size: 1.1rem; border: 1px solid #fecdd3; background: #fff1f2; color: #be123c; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-trash-alt"></i>
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
                        <div class="input-group" style="flex: 1; margin: 0;">
                            <div style="font-weight: 700; color: #475569; font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">評価の締切日</div>
                            <input type="date" id="input-period-deadline" required style="width: 100%; background: white; font-weight: 600; font-size: 1.05rem; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box;">
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

    <!-- 評価ルート（ワークフロー）設定画面 -->
    <div id="workflow-editor-container" style="display: none; margin-bottom: 2rem;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-xl); width: 100%; height: 80vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
            <!-- モーダルヘッダー -->
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div>
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-route" style="color: #3b82f6;"></i>評価ルート（ワークフロー）設定</h3>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">各役職ごとの評価順序を設定します</p>
                </div>
                <button type="button" onclick="closeWorkflowEditor()" class="btn" style="background: white; border: 1px solid #cbd5e1; font-size: 0.9rem; font-weight: 700; cursor: pointer; color: #475569; border-radius: 8px; padding: 0.5rem 1rem;">
                    <i class="fas fa-times"></i> 閉じる
                </button>
            </div>
            <!-- モーダルボディ -->
            <div style="flex: 1; overflow-y: auto; padding: 1.5rem; background: #f1f5f9;">
                <div id="workflow-list-container" style="display: flex; flex-direction: column; gap: 1rem;">
                    <!-- JSでレンダリング -->
                </div>
            </div>
            <!-- モーダルフッター -->
            <div style="padding: 1rem 1.8rem; border-top: 1px solid var(--border); background: white; display: flex; justify-content: flex-end; gap: 1rem; flex-shrink: 0;">
                <button type="button" class="btn btn-primary" onclick="saveWorkflowSettings()" style="font-weight: 800; padding: 0.6rem 2rem; font-size: 1rem; border-radius: 8px;">
                    <i class="fas fa-save"></i> 設定を保存する
                </button>
            </div>
        </div>
    </div>

    <!-- テスト(試験)マスタ管理画面 (インライン展開) -->
    <div id="quiz-editor-container" style="display: none; margin-bottom: 2rem;">
        <div class="glass-panel animate-fade-in" style="background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-xl); width: 100%; padding: 0; overflow: hidden; display: flex; flex-direction: column; min-height: 80vh;">
            <div style="background: #f8fafc; padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-spell-check" style="color: #8b5cf6;"></i>テスト(試験)マスタ管理</h3>
                <button type="button" class="btn" onclick="window.closeQuizEditorModal()" style="background: white; border: 1px solid #cbd5e1; color: #64748b; font-weight: 700; border-radius: 8px; padding: 0.5rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);"><i class="fas fa-times"></i> 閉じる</button>
            </div>
            
            <div style="padding: 2rem; flex: 1; overflow-y: auto; background: #fafafa;" id="quiz-view-list">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h4 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #334155;">作成済みテスト一覧</h4>
                    <button class="btn btn-primary" onclick="window.createNewQuiz()" style="padding: 0.6rem 1.2rem; font-size: 0.9rem; font-weight: 800; border-radius: 8px; background: #8b5cf6; border: none;"><i class="fas fa-plus"></i> 新規テスト作成</button>
                </div>
                <div id="quiz-list-container" style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
                    <!-- JSで描画 -->
                </div>
            </div>

            <!-- 編集画面 -->
            <div style="display: none; flex-direction: column; flex: 1;" id="quiz-view-editor">
                <div style="padding: 1.5rem 2rem; background: white; border-bottom: 1px solid #e2e8f0;">
                    <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                        <button class="btn" onclick="window.backToQuizList()" style="background: #f1f5f9; color: #475569; border: none; border-radius: 8px; padding: 0.5rem 1rem; font-weight: 700;"><i class="fas fa-arrow-left"></i> 一覧へ戻る</button>
                        <h4 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b;">テスト編集: <span id="editor-current-quiz-name" style="color: #8b5cf6;">---</span></h4>
                    </div>
                    
                    <div style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h5 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #334155;"><i class="fas fa-sliders-h" style="color: #64748b; margin-right: 0.5rem;"></i>テストの基本設定（配点と合格基準）</h5>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 100px 1fr 1fr 120px 80px; gap: 1rem; align-items: center; margin-bottom: 0.8rem; padding: 0 0.5rem;">
                            <div style="font-weight: 700; font-size: 0.85rem; color: #64748b;">特性</div>
                            <div style="font-weight: 700; font-size: 0.85rem; color: #64748b;">ランダム出題数</div>
                            <div style="font-weight: 700; font-size: 0.85rem; color: #64748b;">1問あたりの配点</div>
                            <div style="font-weight: 700; font-size: 0.85rem; color: #64748b;">個別の合格基準点</div>
                            <div style="font-weight: 700; font-size: 0.85rem; color: #64748b; text-align: right;">最高得点</div>
                        </div>
                        
                        <!-- 必須問題 -->
                        <div style="display: grid; grid-template-columns: 100px 1fr 1fr 120px 80px; gap: 1rem; align-items: center; margin-bottom: 0.8rem; background: white; padding: 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 800; font-size: 0.85rem; color: #be123c;"><span style="background: #ffe4e6; padding: 0.3rem 0.6rem; border-radius: 4px;">必須問題</span></div>
                            <div><input type="number" id="quiz-editor-count-mandatory" value="0" min="0" oninput="window.updateQuizMaxScore()" style="width: 70px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold;"> 問</div>
                            <div><input type="number" id="quiz-editor-points-mandatory" value="3" min="0" oninput="window.updateQuizMaxScore()" style="width: 70px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold;"> 点</div>
                            <div><input type="number" id="quiz-editor-threshold-mandatory" placeholder="設定なし" min="0" style="width: 80px; padding: 0.4rem; border: 1px solid #f59e0b; border-radius: 6px; font-weight: bold; background: #fef3c7;"> <span style="font-size: 0.8rem; color: #64748b;">以上</span></div>
                            <div style="text-align: right; font-weight: 800; color: #334155;"><span id="quiz-editor-max-mandatory">0</span> 点</div>
                        </div>

                        <!-- 高難易度 -->
                        <div style="display: grid; grid-template-columns: 100px 1fr 1fr 120px 80px; gap: 1rem; align-items: center; margin-bottom: 0.8rem; background: white; padding: 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 800; font-size: 0.85rem; color: #a21caf;"><span style="background: #fae8ff; padding: 0.3rem 0.6rem; border-radius: 4px;">高難易度</span></div>
                            <div><input type="number" id="quiz-editor-count-hard" value="0" min="0" oninput="window.updateQuizMaxScore()" style="width: 70px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold;"> 問</div>
                            <div><input type="number" id="quiz-editor-points-hard" value="5" min="0" oninput="window.updateQuizMaxScore()" style="width: 70px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold;"> 点</div>
                            <div><input type="number" id="quiz-editor-threshold-hard" placeholder="設定なし" min="0" style="width: 80px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold;"> <span style="font-size: 0.8rem; color: #64748b;">以上</span></div>
                            <div style="text-align: right; font-weight: 800; color: #334155;"><span id="quiz-editor-max-hard">0</span> 点</div>
                        </div>

                        <!-- 一般問題 -->
                        <div style="display: grid; grid-template-columns: 100px 1fr 1fr 120px 80px; gap: 1rem; align-items: center; margin-bottom: 1.5rem; background: white; padding: 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 800; font-size: 0.85rem; color: #0369a1;"><span style="background: #e0f2fe; padding: 0.3rem 0.6rem; border-radius: 4px;">一般問題</span></div>
                            <div><input type="number" id="quiz-editor-count-general" value="10" min="0" oninput="window.updateQuizMaxScore()" style="width: 70px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold;"> 問</div>
                            <div><input type="number" id="quiz-editor-points-general" value="1" min="0" oninput="window.updateQuizMaxScore()" style="width: 70px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold;"> 点</div>
                            <div><input type="number" id="quiz-editor-threshold-general" placeholder="設定なし" min="0" style="width: 80px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold;"> <span style="font-size: 0.8rem; color: #64748b;">以上</span></div>
                            <div style="text-align: right; font-weight: 800; color: #334155;"><span id="quiz-editor-max-general">0</span> 点</div>
                        </div>
                        
                        <div style="border-top: 1px dashed #cbd5e1; padding-top: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="flex: 1; padding-right: 2rem;">
                                <div style="display: flex; gap: 2rem; margin-bottom: 1rem;">
                                    <div>
                                        <label style="font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.5rem; display: block;">評価点3 (合格) の全体基準点</label>
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <input type="number" id="quiz-editor-threshold-eval3" value="10" min="0" style="width: 90px; padding: 0.6rem; border: 2px solid #3b82f6; border-radius: 8px; font-weight: bold; font-size: 1.1rem;">
                                            <span style="font-size: 0.9rem; color: #334155; font-weight: bold;">点以上</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label style="font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.5rem; display: block;">評価点2 の全体基準点</label>
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <input type="number" id="quiz-editor-threshold-eval2" value="6" min="0" style="width: 90px; padding: 0.6rem; border: 2px solid #cbd5e1; border-radius: 8px; font-weight: bold; font-size: 1.1rem;">
                                            <span style="font-size: 0.9rem; color: #334155; font-weight: bold;">点以上</span>
                                        </div>
                                    </div>
                                </div>
                                <div style="font-size: 0.75rem; color: #64748b; line-height: 1.5; background: #f1f5f9; padding: 0.8rem; border-radius: 6px;">
                                    <i class="fas fa-exclamation-circle" style="color: #3b82f6;"></i> <b>合否および評価点の判定ルール</b><br>
                                    ・全体の合計点のみから「評価点（1〜3）」が自動算出されます（評価点2未満は自動的に1点）。<br>
                                    ・合計点が「評価点3の基準」を満たしていても、いずれかの特性で設定した「個別の合格基準点」を下回る場合は<b>テスト不合格</b>となり、上長による加点はできず基礎評価点（1〜3）で固定されます。
                                </div>
                            </div>
                            
                            <div style="background: white; border: 2px solid #334155; border-radius: 12px; padding: 1.5rem; text-align: center; min-width: 200px;">
                                <label style="font-size: 0.9rem; font-weight: 800; color: #334155; margin-bottom: 0.5rem; display: block;">テスト全体の満点</label>
                                <div style="font-size: 2.2rem; font-weight: 900; color: #0f172a;"><span id="quiz-editor-max-total">0</span> <span style="font-size: 1.2rem; font-weight: 700;">点</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="padding: 2rem; flex: 1; overflow-y: auto; background: #fafafa;">
                    <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 1.5rem; margin-bottom: 2rem;">
                        <label style="font-size: 0.95rem; font-weight: 800; color: #334155; margin-bottom: 0.5rem; display: block;"><i class="fas fa-book-open" style="color: #3b82f6; margin-right: 0.5rem;"></i>テストの意義・前書き（ステートメント）</label>
                        <p style="font-size: 0.8rem; color: #64748b; margin-top: 0; margin-bottom: 1rem;">※受験者が回答を開始する前に必ず読む文章です。</p>
                        <textarea id="quiz-editor-preface" rows="3" placeholder="（例）この衛生管理チェックテストは、「お客様ファーストを考える上で食中毒を起こさないことが長期的なお客様ファーストになる」という会社の理念に沿った内容です..." style="width: 100%; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; font-family: inherit; font-size: 0.95rem; resize: none; overflow: hidden;" oninput="this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px';"></textarea>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h5 style="margin: 0; font-size: 1rem; font-weight: 800; color: #334155;">問題プール一覧 <span id="quiz-total-questions-count" style="background: #e2e8f0; color: #475569; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.8rem;">0</span></h5>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <div style="display: flex; gap: 0.5rem;">
                                <button type="button" onclick="document.getElementById('quiz-csv-import-input').click()" style="background: white; border: 1px solid #cbd5e1; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; font-weight: 700; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 0.3rem;"><i class="fas fa-file-import"></i> インポート</button>
                                <input type="file" id="quiz-csv-import-input" accept=".csv" style="display: none;" onchange="window.importQuizCSV(event)">
                                <button type="button" onclick="window.exportQuizCSV()" style="background: white; border: 1px solid #cbd5e1; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; font-weight: 700; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 0.3rem;"><i class="fas fa-file-export"></i> エクスポート</button>
                            </div>
                            <div style="display: flex; background: #e2e8f0; border-radius: 8px; padding: 0.2rem;" id="quiz-filter-tabs">
                                <button type="button" onclick="window.setQuizFilter('all')" data-filter="all" style="border: none; background: white; padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 700; color: #3b82f6; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-right: 0.2rem;">全て</button>
                                <button type="button" onclick="window.setQuizFilter('mandatory')" data-filter="mandatory" style="border: none; background: transparent; padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 700; color: #64748b; cursor: pointer; margin-right: 0.2rem;">必須</button>
                                <button type="button" onclick="window.setQuizFilter('general')" data-filter="general" style="border: none; background: transparent; padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 700; color: #64748b; cursor: pointer; margin-right: 0.2rem;">一般</button>
                                <button type="button" onclick="window.setQuizFilter('hard')" data-filter="hard" style="border: none; background: transparent; padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 700; color: #64748b; cursor: pointer;">高難易度</button>
                            </div>
                        </div>
                    </div>
                    <div id="quiz-questions-container" style="display: flex; flex-direction: column; gap: 1rem;">
                        <!-- JSで描画 -->
                    </div>
                </div>
            </div>

            <!-- フッター (保存) -->
            <div style="background: white; border-top: 1px solid var(--border); padding: 1.2rem 2rem; display: none; justify-content: space-between; align-items: center;" id="quiz-view-editor-footer">
                <div>
                    <span id="quiz-validation-warning" style="display: none; color: #ef4444; font-size: 0.85rem; font-weight: 700;"><i class="fas fa-exclamation-triangle"></i> 出題数以上の問題プールを登録してください</span>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" type="button" onclick="window.addQuizQuestion()" style="padding: 0.8rem 2rem; font-weight: 800; font-size: 1rem; border-radius: 8px; background: #3b82f6; border: none; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);">
                        <i class="fas fa-plus"></i> 問題を追加する
                    </button>
                    <button type="button" class="btn btn-primary" onclick="window.saveActiveQuiz()" id="btn-save-quiz" style="padding: 0.8rem 2rem; font-weight: 800; font-size: 1rem; border-radius: 8px; background: #8b5cf6; border: none; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.2);">
                        <i class="fas fa-save"></i> テストを保存する
                    </button>
                </div>
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
                                    <th style="text-align: left; color:#64748b;">適用する役職</th>
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
                                        <th style="text-align: left; width: 45%; padding-left: 0.8rem;">カテゴリ・評価項目</th>
                                        <th style="text-align: left; width: 55%;">詳細説明（評価のポイント）</th>
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

                    <!-- 特記事項・昇格条件入力エリア -->
                    <div style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1rem;">
                        <div style="font-weight: 800; font-size: 0.95rem; color: #1e293b; margin-bottom: 0.5rem;"><i class="fas fa-exclamation-circle" style="color: #e11d48; margin-right: 0.4rem;"></i>特記事項・昇格条件</div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.8rem;">このシートの対象者が次の役職に昇格するための絶対条件や、評価における特記事項があれば入力してください。空欄の場合は評価画面に表示されません。</div>
                        <textarea id="editor-special-note" rows="3" placeholder="例：食品衛生管理試験に合格し、衛生管理資格を持たないものは料理長以上への昇格は不可とする。" style="width: 100%; box-sizing: border-box; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; line-height: 1.5; resize: vertical;"></textarea>
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

    <!-- テスト実施（回答）モーダル -->
    <div id="quiz-execution-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 4000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel" style="background: white; width: 100%; max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #8b5cf6; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: white; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-spell-check"></i> <span id="quiz-execution-title">テスト</span>
                </h3>
                <button type="button" onclick="window.closeEvaluationQuiz()" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: white; opacity: 0.8; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="fas fa-times"></i></button>
            </div>
            
            <div style="padding: 1.5rem 2rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;" id="quiz-execution-content">
                <!-- JSで問題を描画 -->
            </div>
            
            <div style="padding: 1rem 1.8rem; border-top: 1px solid var(--border); background: white; display: flex; justify-content: flex-end; align-items: center;">
                <button type="button" class="btn btn-primary" onclick="window.submitEvaluationQuiz()" id="btn-submit-quiz" style="font-weight: 800; padding: 0.8rem 2rem; background: #8b5cf6; border-color: #8b5cf6; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.2);">
                    <i class="fas fa-paper-plane"></i> 回答を提出する
                </button>
            </div>
        </div>
    </div>

    <!-- 評価詳細モーダル (部下評価・閲覧用) -->
    <div id="eval-detail-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 3000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel animate-fade-in" style="background: white; width: 100%; max-width: 1000px; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
            <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <div>
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;"><i class="fas fa-file-signature" style="color: #6366f1;"></i>評価シート詳細</h3>
                </div>
                <button type="button" onclick="const m=document.getElementById('eval-detail-modal');if(m)m.style.display='none';" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'"><i class="fas fa-times"></i></button>
            </div>
            
            <div id="modal-eval-content" style="padding: 1.5rem 1.8rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;">
                <!-- ここに詳細テーブルが動的に挿入される -->
            </div>

            <!-- モーダルフッター -->
            <div id="modal-eval-footer" style="padding: 1rem 1.8rem; border-top: 1px solid var(--border); background: white; display: flex; justify-content: flex-end; align-items: center; gap: 0.8rem; flex-shrink: 0;">
                <!-- 保存・提出ボタン等がJSで挿入される -->
            </div>
        </div>
    </div>

    <!-- 評価履歴一覧モーダル -->
    <div id="eval-history-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 25000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
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
    <div id="eval-history-detail-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 25100; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem; box-sizing: border-box;">
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
    // Bind history buttons dynamically
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.history-btn');
        if (btn) {
            // Alert removed
            try {
                window.openEvaluationHistory(btn.dataset.userid, btn.dataset.username);
            } catch(err) {
                alert("エラーが発生しました: " + err.message);
            }
        }
    });
    // 戻るボタン
    const btnBack = document.getElementById('btn-eval-back');
    if (btnBack) {
        btnBack.onclick = () => window.navigateTo('hr_hub');
    }

    // モーダルクローズ
    const btnCloseModal = document.getElementById('btn-close-eval-modal');
    if (btnCloseModal) {
        btnCloseModal.onclick = () => {
            const modal = document.getElementById('eval-detail-modal');
            if (modal) modal.style.display = 'none';
        };
    }

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

    // 評価項目マスタ編集ボタンのバインド
    const btnEditTemplates = document.getElementById('btn-admin-edit-templates-tab');
    if (btnEditTemplates) {
        btnEditTemplates.onclick = () => {
            openTemplateEditorModal();
        };
    }

    // テストマスタ管理ボタンのバインド
    const btnEditQuiz = document.getElementById('btn-admin-edit-quiz-tab');
    if (btnEditQuiz) {
        btnEditQuiz.onclick = () => {
            if(window.openQuizEditorModal) window.openQuizEditorModal();
        };
    }
    
    // 評価ルート（ワークフロー）設定ボタンのバインド
    const btnWorkflowTab = document.getElementById('btn-admin-workflow-tab');
    if (btnWorkflowTab) {
        btnWorkflowTab.onclick = () => {
            window.openWorkflowEditorModal();
        };
    }

    // 評価期開始イベント
    const formStart = document.getElementById('form-start-period');
    if (formStart) {
        formStart.onsubmit = async (e) => {
            e.preventDefault();
            const year = document.getElementById('input-period-year').value;
            const month = document.getElementById('input-period-month').value;
            const deadline = document.getElementById('input-period-deadline').value;
            
            if (!year || !month) {
                return showAlert('入力エラー', '評価開始の「年」と「月」を選択してください。');
            }
            if (!deadline) {
                return showAlert('入力エラー', '評価の締切日を入力してください。');
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

                    // ワークフロー設定の読み込み
                    const routesSnap = await getDocs(collection(db, "m_evaluation_routes"));
                    const routeMap = {};
                    routesSnap.forEach(d => {
                        routeMap[d.id] = d.data();
                    });

                    // 評価テンプレートの読み込み
                    const templatesSnap = await getDocs(collection(db, "m_evaluation_templates"));
                    editTemplates = {};
                    templatesSnap.forEach(d => {
                        editTemplates[d.id] = { id: d.id, ...d.data() };
                    });

                    const batch = writeBatch(db);
                    
                    const settingsRef = doc(db, "settings", "evaluation");
                    batch.set(settingsRef, {
                        active_period: periodName,
                        is_provisional: isProvisional,
                        status: 'open',
                        deadline: deadline,
                        updated_at: new Date().toISOString()
                    });

                    for (const u of activeUsers) {
                        const gradeConfig = gradeMap[u.GradeCode] || {};
                        const userJobTitle = gradeConfig.job_title || u.JobTitle || '';
                        
                        let templateId = 'general'; // フォールバック
                        let specialNote = '';
                        if (userJobTitle && Object.keys(editTemplates).length > 0) {
                            const templates = Object.values(editTemplates);
                            const matchedTemplate = templates.find(t => 
                                t.status !== 'archived' && 
                                Array.isArray(t.target_job_titles) && 
                                t.target_job_titles.includes(userJobTitle)
                            );
                            if (matchedTemplate) {
                                templateId = matchedTemplate.id;
                                specialNote = matchedTemplate.special_note || '';
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
                        
                        const defaultWorkflow = { primary_evaluator: '', secondary_evaluator: '店長' };
                        const workflowSettings = userJobTitle && routeMap[userJobTitle] ? routeMap[userJobTitle] : defaultWorkflow;
                        
                        const evalRecord = {
                            user_id: u.id,
                            user_name: u.Name || '一般',
                            department: (u.Role === 'PartTimer' || u.StoreID === 'kitchen') ? 'manufacturing' : 'sales',
                            store_id: u.StoreID || 'honten',
                            evaluator_id: '',
                            evaluator_name: '',
                            period: periodName,
                            status: 'evaluating',
                            is_self_submitted: false,
                            is_primary_submitted: false,
                            is_manager_submitted: false,
                            is_provisional: isProvisional,
                            current_grade: u.GradeCode || '-',
                            yoy_grade: yoyGrade,
                            new_grade: '-',
                            self_total_score: 0,
                            primary_total_score: 0,
                            manager_total_score: 0,
                            final_total_score: 0,
                            interview_date: '',
                            interview_notes: '',
                            president_comment: '',
                            items: evalItems,
                            special_note: specialNote,
                            workflow: workflowSettings,
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
    const tabs = ['self', 'history', 'subordinates', 'interview', 'president', 'admin'];
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
        for (let i = 0; i < 100; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.appState.currentUser) {
                user = window.appState.currentUser;
                break;
            }
        }
        if (!user) {
            console.warn("User auth not found after waiting. Halting evaluation init.");
            const container = document.getElementById('eval-main-content');
            if (container) {
                container.innerHTML = `
                    <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--danger);">
                        <i class="fas fa-exclamation-triangle fa-3x" style="color: #ef4444; margin-bottom: 1.5rem;"></i>
                        <h3 style="margin: 0; color: #1e293b;">認証タイムアウト</h3>
                        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #64748b;">ログイン情報の取得に時間がかかっています。<br>ネットワーク環境をご確認のうえ、ページを再読み込みしてください。</p>
                        <button class="btn" onclick="location.reload()" style="margin-top: 1.5rem; background: #3b82f6; color: white; border: none; padding: 0.6rem 1.5rem; border-radius: 8px; font-weight: 700; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">再読み込み</button>
                    </div>
                `;
                
                // バナーなども非表示にする
                const banner = document.getElementById('eval-period-banner');
                if (banner) banner.style.display = 'none';
                const tabs = document.querySelector('.tabs-container');
                if (tabs) tabs.style.display = 'none';
            }
            return;
        }
    }

    // --- キャッシュの確認 ---
    const now = Date.now();
    const isCacheValid = _masterCache.cacheTime && (now - _masterCache.cacheTime) < CACHE_TTL_MS;

    let gradeMap = {};
    let routeMap = {};
    let allUsers = [];

    if (isCacheValid) {
        // キャッシュから復元
        globalStoreMapForEval = _masterCache.stores;
        gradeMap = _masterCache.grades;
        routeMap = _masterCache.routes;
        allUsers = _masterCache.users;
        
        // 評価期設定のみ最新を取得 (並列)
        try {
            const [periodDoc] = await Promise.all([
                getDoc(doc(db, "settings", "evaluation"))
            ]);
            
            if (periodDoc.exists()) {
                localPeriodSettings = periodDoc.data();
                updatePeriodBanner();
            } else {
                localPeriodSettings = null;
                updatePeriodBannerEmpty();
            }
        } catch (e) {
            console.error("Failed to load evaluation period settings from cache path:", e);
        }
    } else {
        // キャッシュがない/古い場合は全て並列取得
        try {
            const [storeSnap, gradesSnap, routesSnap, periodDoc, snapUsers] = await Promise.all([
                getDocs(collection(db, "m_stores")),
                getDocs(collection(db, "m_grades")),
                getDocs(collection(db, "m_evaluation_routes")),
                getDoc(doc(db, "settings", "evaluation")),
                getDocs(query(collection(db, "m_users")))
            ]);

            globalStoreMapForEval = {};
            storeSnap.forEach(d => {
                const data = d.data();
                globalStoreMapForEval[d.id] = data.store_name || data.店舗名 || d.id;
            });

            gradesSnap.forEach(d => {
                const data = d.data();
                if (data.grade_code) gradeMap[data.grade_code] = data;
            });

            routesSnap.forEach(d => {
                routeMap[d.id] = d.data();
            });
            
            if (periodDoc.exists()) {
                localPeriodSettings = periodDoc.data();
                updatePeriodBanner();
            } else {
                localPeriodSettings = null;
                updatePeriodBannerEmpty();
            }

            snapUsers.forEach(d => {
                allUsers.push({ id: d.id, ...d.data() });
            });

            // キャッシュに保存
            _masterCache.stores = globalStoreMapForEval;
            _masterCache.grades = gradeMap;
            _masterCache.routes = routeMap;
            _masterCache.users = allUsers;
            _masterCache.cacheTime = now;

        } catch(e) {
            console.error("Failed to load initial data in parallel:", e);
        }
    }

    // 1. シードデータの確認・投入
    if (!window._templatesVerified) {
        await verifyAndSeedTemplates();
        window._templatesVerified = true;
    }

    const role = user.Role || 'Staff';
    const myStore = user.StoreID || user.StoreId;
    
    // 現在のユーザーの役職を等級マスタから判定
    let myJobTitle = '';
    window.appState.gradeMap = gradeMap;
    if (user.GradeCode && gradeMap[user.GradeCode]) {
        myJobTitle = gradeMap[user.GradeCode].job_title || '';
    }
    window.appState.myJobTitle = myJobTitle;

    subordinateUsers = [];
    let hasSubordinates = false;
    const isAdmin = role === 'Admin' || role === '管理者';

    if (myJobTitle || isAdmin) {
        // 同じ店舗の全従業員について判定
        subordinateUsers = allUsers.filter(u => {
            if (u.id === user.id) return false;
            if (u.Status === 'retired' || u.Status === '退職済') return false;
            
            // 相手の等級から役職を判定 (設定がない場合は完全除外)
            if (!u.GradeCode || !gradeMap[u.GradeCode]) return false;
            const uJobTitle = gradeMap[u.GradeCode].job_title;
            if (!uJobTitle) return false;
            
            // 相手の評価ルートを取得
            const uRoute = routeMap[uJobTitle];
            if (!uRoute) return false;
            
            // 自分が本来の評価者であるか
            const isEvaluator = uRoute.primary_evaluator === myJobTitle || uRoute.secondary_evaluator === myJobTitle;
            // 管理者が「社長」を代行しているか
            const isAdminEvaluator = isAdmin && (uRoute.primary_evaluator === '社長' || uRoute.secondary_evaluator === '社長');
            
            if (isEvaluator || isAdminEvaluator) {
                // 運用ルールに従い、他店舗のスタッフは評価対象外とする（自店舗のみ許可）
                if ((u.StoreID || u.StoreId) === myStore) return true;
            }
            
            // 【自店舗のフォールバック】店長・統括店長は評価ルート未設定の一般スタッフも強制表示
            if ((u.StoreID || u.StoreId) === myStore) {
                if (myJobTitle === '店長' || myJobTitle === '統括店長') {
                    if (uJobTitle !== '店長' && uJobTitle !== '統括店長' && uJobTitle !== '社長') return true;
                }
            }
            
            return false;
        });
        
        hasSubordinates = subordinateUsers.length > 0;
    }
    
    if (isAdmin) {
        hasSubordinates = true;
        if (!subordinateUsers.some(u => u.id === user.id)) {
            const me = allUsers.find(u => u.id === user.id);
            if (me) subordinateUsers.push(me);
        }
    }
    
    const tabSubordinates = document.getElementById('tab-subordinates');
    const tabInterview = document.getElementById('tab-interview');
    const tabPresident = document.getElementById('tab-president');
    const tabAdmin = document.getElementById('tab-admin');

    if (isAdmin) {
        allStaffUsersForAdmin = allUsers.filter(u => {
            return u.Status !== 'retired' && u.Status !== '退職済' && u.Role !== 'Tablet' && u.Role !== '店舗タブレット';
        });


        if (tabAdmin) tabAdmin.style.display = 'block';
        if (tabSubordinates) tabSubordinates.style.display = 'block';
        if (tabInterview) tabInterview.style.display = 'block';
        if (tabPresident) tabPresident.style.display = 'block';
        
        const adminManagementButtons = document.getElementById('admin-management-buttons');
        if (adminManagementButtons) adminManagementButtons.style.display = 'flex';
        
        const btnEditTemplatesTab = document.getElementById('btn-admin-edit-templates-tab');
        if (btnEditTemplatesTab) btnEditTemplatesTab.style.display = 'flex';
        
        const btnEditQuizTab = document.getElementById('btn-admin-edit-quiz-tab');
        if (btnEditQuizTab) btnEditQuizTab.style.display = 'flex';
        
        const btnWorkflowTab = document.getElementById('btn-admin-workflow-tab');
        if (btnWorkflowTab) btnWorkflowTab.style.display = 'flex';
        
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
    } else if (hasSubordinates) {
        if (tabSubordinates) tabSubordinates.style.display = 'block';
        if (tabInterview) tabInterview.style.display = 'block';
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
    const deadlineEl = document.getElementById('banner-deadline-text');
    if (!titleEl || !descEl || !statusEl) return;

    const periodStr = localPeriodSettings.active_period || '未設定';
    const isProvisional = localPeriodSettings.is_provisional;
    const typeStr = isProvisional ? '仮評価' : '本評価';
    
    titleEl.textContent = `${periodStr} 期`;
    descEl.textContent = typeStr;
    if (deadlineEl) {
        if (localPeriodSettings.deadline) {
            const d = localPeriodSettings.deadline.split('-');
            if (d.length === 3) {
                deadlineEl.innerHTML = `<span style="color: #ef4444; font-size: 1.15rem;">${d[0]}年${d[1]}月${d[2]}日</span>`;
            } else {
                deadlineEl.innerHTML = `<span style="color: #ef4444; font-size: 1.15rem;">${localPeriodSettings.deadline}</span>`;
            }
        } else {
            deadlineEl.textContent = '未設定';
        }
    }
    
    const isOpen = localPeriodSettings.status === 'open';
    if (isOpen) {
        statusEl.innerHTML = `<span style="color: #16a34a;">進行中</span>`;
    } else {
        statusEl.innerHTML = `<span style="color: #ef4444;">締め切り</span>`;
    }
}

function updatePeriodBannerEmpty() {
    const titleEl = document.getElementById('banner-period-title');
    const descEl = document.getElementById('banner-period-desc');
    const statusEl = document.getElementById('banner-status-text');
    const deadlineEl = document.getElementById('banner-deadline-text');
    if (!titleEl || !descEl || !statusEl) return;

    titleEl.textContent = `-`;
    descEl.textContent = `-`;
    if (deadlineEl) {
        deadlineEl.textContent = `-`;
    }
    statusEl.innerHTML = `<span style="color: #94a3b8;">未開始</span>`;
}

// データベースからの評価データ読み込み
async function loadEvaluationData() {
    const user = window.appState.currentUser;
    if (!user) return;

    activeEvaluations = [];
    myEvaluation = null;
    // subordinateUsers is populated in loadEvaluationApp

    if (!localPeriodSettings || localPeriodSettings.status !== 'open') return;

    const period = localPeriodSettings.active_period;

    try {
        // 1. 評価データのロード (権限に応じて最適化)
        const role = user.Role || 'Staff';
        const isAdmin = role === 'Admin' || role === '管理者';
        let qEvals;
        
        // 管理者、または部下を持つ評価者の場合は今期の全データを取得、一般スタッフは自分のデータのみ取得
        if (isAdmin || subordinateUsers.length > 0) {
            qEvals = query(collection(db, "t_evaluations"), where("period", "==", period));
        } else {
            qEvals = query(collection(db, "t_evaluations"), where("period", "==", period), where("user_id", "==", user.id));
        }
        
        const snapEvals = await getDocs(qEvals);
        
        snapEvals.forEach(d => {
            const data = d.data();
            activeEvaluations.push({ id: d.id, ...data });
        });

        // 2. 自分の評価の抽出
        myEvaluation = activeEvaluations.find(e => e.user_id === user.id) || null;

        // 3. 部下ユーザーのバッジ更新
        updateTabBadges();
    } catch (e) {
        console.error("Failed to load evaluation data:", e);
    }
}

function updateTabBadges() {
    const user = window.appState.currentUser;
    const role = user.Role || '';
    const myJobTitle = window.appState.myJobTitle || user.JobTitle || '';

    // タブのPingアニメーションと文字色ハイライトを制御するヘルパー関数
    const updatePing = (tabId, hasPending) => {
        const tab = document.getElementById(tabId);
        if (!tab) return;
        let ping = tab.querySelector('.tab-ping-indicator');
        if (hasPending) {
            if (!ping) {
                ping = document.createElement('div');
                ping.className = 'tab-ping-indicator';
                tab.appendChild(ping);
            }
            tab.classList.add('tab-has-task');
        } else {
            if (ping) ping.remove();
            tab.classList.remove('tab-has-task');
        }
    };

    // 自己評価タブの通知状態
    const selfPending = myEvaluation && ['evaluating', 'self_evaluating'].includes(myEvaluation.status) && !myEvaluation.is_self_submitted;
    updatePing('tab-self', selfPending);

    // 部下評価の残り件数をバッジに表示 (自己評価提出済・店長評価中の件数)
    const subordinatesBadge = document.getElementById('subordinates-badge');
    if (subordinatesBadge) {
        const pendingCount = activeEvaluations.filter(e => {
            const isSub = subordinateUsers.some(u => u.id === e.user_id);
            if (!isSub) return false;
            
            if (!['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(e.status)) return false;

            // 管理者の場合は全員分を通知
            if (role === 'Admin' || role === '管理者') return true;

            const wf = e.workflow || {};
            const isPrimary = wf.primary_evaluator === myJobTitle || (isAdmin && wf.primary_evaluator === '社長');
            const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長')) || (isAdmin && wf.secondary_evaluator === '社長');
            
            let amISubmitted = false;
            if (isPrimary) amISubmitted = e.is_primary_submitted;
            else if (isSecondary) amISubmitted = e.is_manager_submitted;
            
            return !amISubmitted;
        }).length;

        if (pendingCount > 0) {
            subordinatesBadge.textContent = pendingCount;
            subordinatesBadge.style.display = 'inline-block';
            updatePing('tab-subordinates', true);
        } else {
            subordinatesBadge.style.display = 'none';
            updatePing('tab-subordinates', false);
        }
    }

    // 面談待ちの残り件数をバッジに表示
    const interviewBadge = document.getElementById('interview-badge');
    if (interviewBadge) {
        const pendingCount = activeEvaluations.filter(e => {
            const isSub = subordinateUsers.some(u => u.id === e.user_id);
            return isSub && e.status === 'interviewing';
        }).length;

        if (pendingCount > 0) {
            interviewBadge.textContent = pendingCount;
            interviewBadge.style.display = 'inline-block';
            updatePing('tab-interview', true);
        } else {
            interviewBadge.style.display = 'none';
            updatePing('tab-interview', false);
        }
    }

    // 社長査定の残り件数 (社長確認待ちの件数)
    const presidentBadge = document.getElementById('president-badge');
    if (presidentBadge) {
        const pendingCount = activeEvaluations.filter(e => e.status === 'president_pending').length;
        if (pendingCount > 0) {
            presidentBadge.textContent = pendingCount;
            presidentBadge.style.display = 'inline-block';
            updatePing('tab-president', true);
        } else {
            presidentBadge.style.display = 'none';
            updatePing('tab-president', false);
        }
    }
}

// アクティブなタブの内容を描画
function renderActiveTabContent() {
    const container = document.getElementById('eval-main-content');
    if (!container) return;

    if (!localPeriodSettings && activeTab !== 'admin' && activeTab !== 'history') {
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
        case 'history':
            renderHistoryTab(container);
            break;
        case 'subordinates':
            renderSubordinatesTab(container);
            break;
        case 'interview':
            renderInterviewTab(container);
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
                <i class="fas fa-file-alt fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">現在、あなたの評価シートはありません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">評価期間が開始されるとお知らせします。</p>
            </div>
        `;
        return;
    }

    const e = myEvaluation;
    const statusJp = getStatusJpName(e.status, e);
    let alertHtml = '';

    if (['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(e.status)) {
        if (!e.is_self_submitted) {
            alertHtml = `
                <div style="background: #fef9c3; border-left: 4px solid #eab308; padding: 1rem; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                    <div><span style="color: #ca8a04; font-weight: 800; font-size: 0.9rem;">ステータス: 評価入力中</span> <span style="margin-left: 1rem; font-size: 0.85rem; color: #475569;">現在の等級: ${e.current_grade} | 前年同期の等級: ${e.yoy_grade}</span></div>
                    <div style="font-size: 0.85rem; color: #1e293b;"><i class="fas fa-info-circle" style="color:#3b82f6;"></i> 自己評価を入力してください。入力後、下部のボタンから提出してください。</div>
                </div>
            `;
        } else {
            alertHtml = `
                <div style="background: #f1f5f9; border-left: 4px solid #64748b; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem;">
                    <div style="color: #475569; font-weight: 800; font-size: 0.9rem; margin-bottom: 0.4rem;">ステータス: 自己評価提出済（他者待ち）</div>
                    <div style="font-size: 0.85rem; color: #64748b;">自己評価は提出済みです。他者の評価完了・面談をお待ちください。</div>
                </div>
            `;
        }
    } else {
        alertHtml = `
            <div style="background: #f1f5f9; border-left: 4px solid #64748b; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem;">
                <div style="color: #475569; font-weight: 800; font-size: 0.9rem; margin-bottom: 0.4rem;">ステータス: ${statusJp}</div>
                <div style="font-size: 0.85rem; color: #64748b;">現在のステータスです。評価結果の確定をお待ちください。</div>
            </div>
        `;
    }

    container.innerHTML = `
        ${alertHtml}
        <div id="self-eval-inline-container"></div>
    `;

    const inlineContainer = document.getElementById('self-eval-inline-container');
    renderEvalDetailInline(inlineContainer, myEvaluation, 'self');
}

// ==========================================
// 1.5. 過去の履歴タブ (本人の履歴閲覧ビュー)
// ==========================================
async function renderHistoryTab(container) {
    const user = window.appState.currentUser;
    if (!user) {
        container.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-secondary);">ユーザー情報が取得できません。</div>';
        return;
    }

    container.innerHTML = '<div style="text-align:center; padding:4rem;"><i class="fas fa-spinner fa-spin fa-3x" style="color:#cbd5e1;"></i><div style="margin-top:1.5rem; color:var(--text-secondary); font-size:1rem; font-weight:800;">過去の履歴を読み込んでいます...</div></div>';

    try {
        const q = query(collection(db, "t_evaluations"), where("user_id", "==", user.id));
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
            container.innerHTML = `
                <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                    <i class="fas fa-history fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                    <h3 style="margin: 0; color: #1e293b;">過去の評価履歴はありません</h3>
                    <p style="margin-top: 0.5rem; font-size: 0.9rem;">確定済みの評価データが存在しません。</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="glass-panel" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                <h3 style="margin: 0 0 1.5rem; display: flex; align-items: center; gap: 0.5rem; color: #1e293b;"><i class="fas fa-history" style="color: var(--primary);"></i> ${user.Name} さんの過去の評価履歴</h3>
                <div style="overflow-x:auto;">
                    <table class="eval-table">
                        <thead>
                            <tr>
                                <th style="text-align:left;">対象期</th>
                                
                                <th style="text-align:center;">確定点数</th>
                                <th style="text-align:center;">等級判定</th>
                                <th style="text-align:right;">操作</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        histories.forEach(h => {
                        const score = h.final_total_score || h.manager_total_score || h.self_total_score || '-';

            html += `
                <tr style="background:white; border-bottom:1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <td style="font-weight:900; color:#1e293b; padding:1.2rem;">${h.period}期</td>
                    
                    <td style="text-align:center; font-weight:900; color:#be123c; font-size:1.2rem; padding:1.2rem;">${score}</td>
                    <td style="text-align:center; font-family:monospace; font-weight:900; color:#059669; font-size:1.2rem; padding:1.2rem;">${h.new_grade || '-'}</td>
                    <td style="text-align:right; padding:1.2rem;">
                        <button class="btn btn-secondary" onclick="window.viewHistoryDetail('${h.id}'); document.getElementById('eval-history-detail-modal').style.display='flex';" style="font-size:0.85rem; padding:0.6rem 1.2rem; background:white; border-color:#cbd5e1; font-weight:800; color:var(--primary); transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'; this.style.backgroundColor='#eff6ff'" onmouseout="this.style.borderColor='#cbd5e1'; this.style.backgroundColor='white'"><i class="fas fa-file-alt"></i> 詳細を見る</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div></div>`;
        container.innerHTML = html;

    } catch(e) {
        console.error("Failed to load history tab:", e);
        container.innerHTML = '<div style="color:#ef4444; text-align:center; padding:3rem; font-weight:800; background:#fef2f2; border-radius:12px;"><i class="fas fa-exclamation-triangle fa-2x" style="margin-bottom:1rem;"></i><br>読み込みエラーが発生しました。<br>通信環境を確認して再度お試しください。</div>';
    }
}

// ==========================================
// 2. 部下評価タブ (上長・店長ビュー)
// ==========================================
function renderSubordinatesTab(container) {
    // データロード完了前に描画されることへの安全ガード
    if (!activeEvaluations || activeEvaluations.length === 0) {
        if (localPeriodSettings && localPeriodSettings.status === 'open') {
            container.innerHTML = '<div style="text-align:center; padding:4rem;"><i class="fas fa-spinner fa-spin fa-3x" style="color:#cbd5e1;"></i><div style="margin-top:1.5rem; color:#94a3b8; font-weight:700;">データを読み込んでいます...</div></div>';
            return;
        }
    }

    const targetUsers = subordinateUsers.filter(u => {
        const evalData = activeEvaluations.find(e => e.user_id === u.id);
        if (!evalData) return false;
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

    const user = window.appState.currentUser;
    const role = user.Role || '';
    const myJobTitle = window.appState.myJobTitle || user.JobTitle || '';
    const isAdmin = role === 'Admin' || role === '管理者';

    const sectionA = []; // あなたの評価待ち
    const sectionB = []; // 他者の入力待ち
    const sectionC = []; // 面談可能

    targetUsers.forEach(u => {
        const evalData = activeEvaluations.find(e => e.user_id === u.id);
        const wf = evalData.workflow || {};
        const isPrimary = wf.primary_evaluator === myJobTitle || (isAdmin && wf.primary_evaluator === '社長');
        const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長')) || (isAdmin && wf.secondary_evaluator === '社長');

        if (['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(evalData.status)) {
            const isEvaluator = isPrimary || isSecondary;
            if (isEvaluator || role === 'Admin') {
                let amISubmitted = false;
                if (isPrimary && isSecondary) {
                    amISubmitted = evalData.is_primary_submitted && evalData.is_manager_submitted;
                } else if (isPrimary) {
                    amISubmitted = evalData.is_primary_submitted;
                } else if (isSecondary) {
                    amISubmitted = evalData.is_manager_submitted;
                }
                
                if (!amISubmitted) {
                    sectionA.push(u);
                } else {
                    sectionB.push(u);
                }
            } else {
                // 自分が評価者ではない場合は「他者の入力待ち」セクション（閲覧用）に回す
                sectionB.push(u);
            }
        } else if (evalData.status === 'interviewing') {
            sectionC.push(u);
        }
    });

    const generateRows = (users) => {
        if (users.length === 0) return `<tr><td colspan="8" style="padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">該当するスタッフはいません</td></tr>`;
        
        let html = '';
        users.forEach(u => {
            const evalData = activeEvaluations.find(e => e.user_id === u.id);
            const status = evalData ? evalData.status : 'not_started';
            const statusJp = getStatusJpName(status, evalData);
            
            let score = '-';
            let mgrScore = '-';
            if (status === 'interviewing') {
                score = evalData.self_total_score || '-';
                mgrScore = evalData.manager_total_score || '-';
            } else if (['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(status)) {
                score = '<span style="font-size:0.75rem; color:#94a3b8;"><i class="fas fa-lock"></i> 非公開</span>';
                mgrScore = '<span style="font-size:0.75rem; color:#94a3b8;"><i class="fas fa-lock"></i> 非公開</span>';
            }
            
            const resultGrade = evalData ? (evalData.new_grade || '-') : '-';
            const wf = evalData && evalData.workflow ? evalData.workflow : {};
            
            const isPrimary = wf.primary_evaluator === myJobTitle || (isAdmin && wf.primary_evaluator === '社長');
            const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長')) || (isAdmin && wf.secondary_evaluator === '社長');

            let actionBtn = '';
            if (['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(status)) {
                let amISubmitted = false;
                if (isPrimary) amISubmitted = evalData.is_primary_submitted;
                else if (isSecondary) amISubmitted = evalData.is_manager_submitted;
                
                if (!amISubmitted) {
                    actionBtn = `<button class="btn btn-primary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#7c3aed; border-color:#7c3aed; padding: 0.4rem 0.8rem;">評価を入力</button>`;
                } else {
                    actionBtn = `<button class="btn btn-secondary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-check"></i> 入力済</button>`;
                }
            } else if (status === 'interviewing') {
                actionBtn = `<button class="btn" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#a21caf; border-color:#a21caf; color:white; padding: 0.4rem 0.8rem;">面談結果入力・社長提出</button>`;
            } else {
                actionBtn = `<button class="btn btn-secondary" onclick="window.showSubordinateDetail('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>`;
            }

            actionBtn += `<button class="btn btn-secondary history-btn" data-userid="${u.id}" data-username="${u.Name}" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.6rem; border:1px solid #cbd5e1; background:#f8fafc; color:#475569; margin-left:0.4rem;" title="過去の履歴を見る"><i class="fas fa-history"></i></button>`;

            html += `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 1rem; font-weight: 700; color: #1e293b;">${u.Name} ${u.DisplayName ? `<span style="font-size:0.75rem; color:#94a3b8; font-weight:400;">(${u.DisplayName})</span>` : ''}</td>
                    <td style="padding: 1rem; font-weight: 600; color: var(--text-secondary);">${u.JobTitle || '一般'}</td>
                    <td style="padding: 1rem; font-family: monospace; font-weight: 700; color: #1e3a8a;">${u.GradeCode || '-'}</td>
                    <td style="padding: 1rem;"><span class="eval-status-badge status-${status}">${statusJp}</span></td>
                    <td style="padding: 1rem; text-align: center; font-weight: 700;">${score}</td>
                    <td style="padding: 1rem; text-align: center; font-weight: 700; color: #7c3aed;">${mgrScore}</td>
                    <td style="padding: 1rem; text-align: center; font-family: monospace; font-weight: 900; color: #059669;">${resultGrade}</td>
                    <td style="padding: 1rem; text-align: right;" class="no-print">
                        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
                            ${actionBtn}
                        </div>
                    </td>
                </tr>
            `;
        });
        return html;
    };

    const tableHeader = `
        <div style="overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 2rem;">
            <table class="eval-table">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 0.8rem 1rem; text-align: left;">スタッフ名</th>
                        <th style="padding: 0.8rem 1rem; text-align: left;">役職</th>
                        <th style="padding: 0.8rem 1rem; text-align: left;">等級</th>
                        <th style="padding: 0.8rem 1rem; text-align: left;">進捗</th>
                        <th style="padding: 0.8rem 1rem; text-align: center;">自己評価点</th>
                        <th style="padding: 0.8rem 1rem; text-align: center;">最終評価点</th>
                        <th style="padding: 0.8rem 1rem; text-align: center;">新等級(仮)</th>
                        <th style="padding: 0.8rem 1rem; text-align: right;" class="no-print">操作</th>
                    </tr>
                </thead>
                <tbody>
    `;
    const tableFooter = `</tbody></table></div>`;

    container.innerHTML = `
        <div id="subordinate-list-container">
            <div style="margin-bottom: 2rem;">
                <h4 style="margin: 0 0 0.8rem; color: #1e293b; font-size: 1.1rem; border-left: 4px solid #ef4444; padding-left: 0.6rem;">
                    あなたの評価待ち（最優先）
                    <span style="font-size: 0.8rem; color: #64748b; font-weight: normal; margin-left: 0.5rem;">※あなたの入力が完了するまで面談に進めません。</span>
                </h4>
                ${tableHeader}${generateRows(sectionA)}${tableFooter}
            </div>

            <div style="margin-bottom: 2rem;">
                <h4 style="margin: 0 0 0.8rem; color: #1e293b; font-size: 1.1rem; border-left: 4px solid #3b82f6; padding-left: 0.6rem;">
                    他者の入力完了待ち
                    <span style="font-size: 0.8rem; color: #64748b; font-weight: normal; margin-left: 0.5rem;">※あなたの入力は完了しました。他者の入力を待っています。</span>
                </h4>
                ${tableHeader}${generateRows(sectionB)}${tableFooter}
            </div>
            
            <div style="margin-bottom: 2rem;">
                <h4 style="margin: 0 0 0.8rem; color: #1e293b; font-size: 1.1rem; border-left: 4px solid #a21caf; padding-left: 0.6rem;">
                    面談可能（全員入力完了）
                    <span style="font-size: 0.8rem; color: #64748b; font-weight: normal; margin-left: 0.5rem;">※全員の入力が完了しました。面談を実施し、結果を入力してください。</span>
                </h4>
                ${tableHeader}${generateRows(sectionC)}${tableFooter}
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
        renderSubordinatesTab(container);
    };
}

// ==========================================
// 2.5 面談タブ (上長・店長ビュー)
// ==========================================
function renderInterviewTab(container) {
    // 評価シートが作成されており、面談フェーズ以降のスタッフを抽出
    const targetUsers = subordinateUsers.filter(u => {
        const evalData = activeEvaluations.find(e => e.user_id === u.id);
        if (!evalData) return false;
        return ['interviewing', 'president_pending', 'approved', 'notified'].includes(evalData.status);
    });

    if (targetUsers.length === 0) {
        container.innerHTML = `
            <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                <i class="fas fa-comments fa-3x" style="color: #cbd5e1; margin-bottom: 1.5rem;"></i>
                <h3 style="margin: 0; color: #1e293b;">現在、面談が必要なスタッフはいません</h3>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">「部下の評価を入力」から評価を確定させると、こちらに面談対象者として表示されます。</p>
            </div>
        `;
        return;
    }

    targetUsers.sort((a, b) => {
        const evalA = activeEvaluations.find(e => e.user_id === a.id);
        const evalB = activeEvaluations.find(e => e.user_id === b.id);
        const isPendingA = evalA && evalA.status === 'interviewing' ? 0 : 1;
        const isPendingB = evalB && evalB.status === 'interviewing' ? 0 : 1;
        return isPendingA - isPendingB;
    });

    let rowsHTML = '';
    targetUsers.forEach(u => {
        const evalData = activeEvaluations.find(e => e.user_id === u.id);
        const status = evalData ? evalData.status : 'not_started';
        const statusJp = getStatusJpName(status, evalData);
        const resultGrade = evalData ? (evalData.new_grade || '-') : '-';
        const interviewDate = (evalData && evalData.interview_date) ? evalData.interview_date : '-';

        let actionBtn = '';
        if (status === 'interviewing') {
            actionBtn = `<button class="btn" onclick="window.showInterviewDetail('${u.id}')" style="font-size:0.75rem; font-weight:800; background:#059669; border-color:#059669; color:white; padding: 0.4rem 0.8rem;"><i class="fas fa-edit"></i> 面談記録を入力</button>`;
        } else {
            actionBtn = `<button class="btn btn-secondary" onclick="window.showInterviewDetail('${u.id}')" style="font-size:0.75rem; font-weight:700; padding: 0.4rem 0.8rem; border:1px solid #cbd5e1; background:white; color:var(--text-secondary);"><i class="fas fa-eye"></i> 面談記録を見る</button>`;
        }

        rowsHTML += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem; font-weight: 700; color: #1e293b;">${u.Name} ${u.DisplayName ? `<span style="font-size:0.75rem; color:#94a3b8; font-weight:400;">(${u.DisplayName})</span>` : ''}</td>
                <td style="padding: 1rem; font-weight: 600; color: var(--text-secondary);">${u.JobTitle || '一般'}</td>
                <td style="padding: 1rem;"><span class="eval-status-badge status-${status}">${statusJp}</span></td>
                <td style="padding: 1rem; text-align: center; font-weight: 700; color: #475569;">${interviewDate}</td>
                <td style="padding: 1rem; text-align: center; font-family: monospace; font-weight: 900; color: #059669;">${resultGrade}</td>
                <td style="padding: 1rem; text-align: right;" class="no-print">
                    <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
                        ${actionBtn}
                    </div>
                </td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div id="interview-list-container">
            <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                <div style="padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); background: #f8fafc;">
                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #1e293b;">
                        <i class="fas fa-comments" style="color: #059669; margin-right: 0.4rem;"></i>
                        面談対象者・面談履歴
                    </h4>
                </div>
                <div style="overflow-x: auto;">
                    <table class="eval-table">
                        <thead>
                            <tr>
                                <th style="text-align: left;">お名前</th>
                                <th style="text-align: left;">表示役職</th>
                                <th style="text-align: left;">ステータス</th>
                                <th style="text-align: center;">面談実施日</th>
                                <th style="text-align: center;">判定等級</th>
                                <th style="text-align: right;" class="no-print">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div id="interview-detail-container" style="display: none;"></div>
    `;

    // 画面切り替え（ドリルダウン）関数
    window.showInterviewDetail = (userId) => {
        const evalData = activeEvaluations.find(e => e.user_id === userId);
        if (evalData) {
            document.getElementById('interview-list-container').style.display = 'none';
            const detailContainer = document.getElementById('interview-detail-container');
            detailContainer.style.display = 'block';
            renderEvalDetailInline(detailContainer, evalData, 'interview');
        }
    };

    window.backToInterviewList = () => {
        renderInterviewTab(container);
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
        const statusJp = getStatusJpName(e.status, e);

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
                <td style="padding: 1rem; text-align: right;" class="no-print">
                    <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
                        ${actionBtn}
                    </div>
                </td>
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
                                <th style="text-align: left;">現等級</th>
                                <th style="text-align: center;">自己点</th>
                                <th style="text-align: center;">上長点</th>
                                <th style="text-align: center; color: #be123c;">確定点</th>
                                <th style="text-align: center;">新等級(判定)</th>
                                <th style="text-align: left;">ステータス</th>
                                <th style="text-align: right;" class="no-print">操作</th>
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
                                        <td style="padding: 0.75rem 1rem;"><span class="eval-status-badge status-${e.status}">${getStatusJpName(e.status, e)}</span></td>
                                        <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 600;">${e.self_total_score || '-'}</td>
                                        <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 600; color: #7c3aed;">${e.manager_total_score || '-'}</td>
                                        <td style="padding: 0.75rem 1rem; text-align: right;" class="no-print">
                                            <button class="btn btn-secondary" onclick="window.viewAdminEvaluationDetail('${e.id}')" style="font-size: 0.7rem; padding: 0.3rem 0.6rem; border: 1px solid #cbd5e1; background: white; color: var(--text-secondary);"><i class="fas fa-eye"></i> 閲覧</button>
                                            <button class="btn btn-secondary history-btn" data-userid="${e.user_id}" data-username="${e.user_name || '一般'}" style="font-size:0.7rem; padding: 0.3rem 0.6rem; border:1px solid #cbd5e1; background:#f8fafc; color:#475569; margin-left:0.3rem;" title="過去の履歴を見る"><i class="fas fa-history"></i></button>
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
            // Admin用のコンテナがない場合はリストのすぐ下、もしくはeval-main-contentに直接描画するか、既存のモーダルを模倣する
            // 全体管理タブでは、別の詳細画面用のコンテナを用意するか、subordinate-detail-containerを使い回す
            let container = document.getElementById('admin-detail-container');
            if (!container) {
                // admin-list-containerの親(全体管理タブのルート)に作成
                const adminList = document.querySelector('#eval-main-content > div > div');
                if (adminList) {
                    adminList.insertAdjacentHTML('afterend', '<div id="admin-detail-container"></div>');
                    container = document.getElementById('admin-detail-container');
                }
            }
            if (container) {
                const listContainer = container.previousElementSibling;
                if(listContainer) listContainer.style.display = 'none';
                container.style.display = 'block';
                
                // Add a back button wrapper
                container.innerHTML = '<div style="margin-bottom: 1rem;"><button class="btn" onclick="document.getElementById(\'admin-detail-container\').style.display=\'none\'; document.getElementById(\'admin-detail-container\').previousElementSibling.style.display=\'block\';" style="background: white; border: 1px solid #cbd5e1; color: #475569; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700;"><i class="fas fa-arrow-left"></i> 一覧へ戻る</button></div><div id="admin-detail-inner"></div>';
                
                renderEvalDetailInline(document.getElementById('admin-detail-inner'), evalData, 'admin');
                window.scrollTo(0, 0);
            }
        }
    };
    // イベントバインドはinitEvaluationに移動しました
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

    // テストマスタを全取得
    let quizBanks = {};
    try {
        const qs = await getDocs(collection(db, "m_quiz_banks"));
        qs.forEach(d => { quizBanks[d.id] = d.data(); });
    } catch(e) { console.warn("Failed to load quiz banks", e); }

    // 前回の各項目の点数をマッピングして初期配列を作成
    return items.map(item => {
        let prevScore = 0;
        if (previousEval && previousEval.items) {
            const prevItem = previousEval.items.find(pi => pi.item_id === item.item_id);
            if (prevItem) {
                prevScore = prevItem.manager_score || prevItem.self_score || 0;
            }
        }

        // テストデータが紐付いている場合はランダム出題データを生成
        let quiz_data = null;
        if (item.quiz_bank_id && quizBanks[item.quiz_bank_id]) {
            const bank = quizBanks[item.quiz_bank_id];
            
            let selectedQuestions = [];
            
            if (bank.settings) {
                const types = ['mandatory', 'hard', 'general'];
                types.forEach(type => {
                    const setting = bank.settings[type] || { count: 0, points: 0 };
                    const count = parseInt(setting.count) || 0;
                    const points = parseInt(setting.points) || 0;
                    
                    if (count > 0) {
                        const pool = (bank.questions || []).filter(q => q.type === type || (type === 'general' && !q.type));
                        const shuffled = [...pool].sort(() => 0.5 - Math.random());
                        const extracted = shuffled.slice(0, count).map(q => ({
                            id: q.id,
                            text: q.text,
                            explanation: q.explanation || '',
                            choices: q.choices,
                            points: points,
                            correct_index: q.correct_index,
                            user_answer: null,
                            type: type
                        }));
                        selectedQuestions.push(...extracted);
                    }
                });
                
                selectedQuestions.sort(() => 0.5 - Math.random());
            } else {
                const count = bank.questions_count || 10;
                const shuffled = [...(bank.questions || [])].sort(() => 0.5 - Math.random());
                selectedQuestions = shuffled.slice(0, count).map(q => ({
                    id: q.id,
                    text: q.text,
                    explanation: q.explanation || '',
                    choices: q.choices,
                    points: q.points || 10,
                    correct_index: q.correct_index,
                    user_answer: null,
                    type: q.type || 'general'
                }));
            }
            
            quiz_data = {
                quiz_bank_id: item.quiz_bank_id,
                quiz_title: bank.title,
                preface: bank.preface || '',
                pass_score: bank.pass_score || 80,
                threshold_eval3: bank.threshold_eval3 !== undefined ? bank.threshold_eval3 : (bank.pass_score || 80),
                threshold_eval2: bank.threshold_eval2 !== undefined ? bank.threshold_eval2 : Math.floor((bank.pass_score || 80) / 2),
                settings: bank.settings || {},
                questions: selectedQuestions,
                completed: false,
                score: 0,
                eval_score: 0,
                passed: false
            };
        }

        return {
            item_id: item.item_id,
            category: item.category,
            title: item.title,
            description: item.description || '',
            quiz_bank_id: item.quiz_bank_id || null, // 紐付きID
            quiz_data: quiz_data, // 出題データ
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
window.pastEvaluationsCache = window.pastEvaluationsCache || {}; // 過去データキャッシュ

async function renderEvalDetailInline(container, evalData, mode) {
    window.currentEvalMode = mode; // Save mode for updateComment to know which container to update
    selectedEvalDetail = JSON.parse(JSON.stringify(evalData)); // シャローコピーで編集バッファにする
    const userId = selectedEvalDetail.user_id;

    // キャッシュチェック（遅延ローディング）
    let isPastDataCached = false;
    if (window.pastEvaluationsCache[userId] !== undefined) {
        previousPeriodData = window.pastEvaluationsCache[userId];
        isPastDataCached = true;
    } else {
        previousPeriodData = null;
    }

    container.innerHTML = ''; // 即時描画のためクリア

    // インライン用のラッパーを作成
    const detailWrapper = document.createElement('div');
    detailWrapper.style.cssText = "background: white; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); padding: 0; overflow: hidden; margin-top: 1rem; position: relative;";
    
    // ヘッダー部分
    const isProvisional = selectedEvalDetail.is_provisional;
    const typeStr = isProvisional ? '仮評価' : '本評価 (7月給与反映対象)';
    const statusJp = getStatusJpName(selectedEvalDetail.status, selectedEvalDetail);
    
    // === 進捗ステータスバー (Stepper) の構築 ===
    const wf = selectedEvalDetail.workflow || {};
    const hasPrimary = !!wf.primary_evaluator;
    const currentStatus = selectedEvalDetail.status;

    const steps = [
        { id: 'self', label: '自己評価', activeStatuses: ['not_started', 'self_evaluating'], doneStatuses: ['self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating', 'interviewing', 'president_pending', 'approved', 'notified'] }
    ];
    if (hasPrimary) {
        steps.push({ id: 'primary', label: '1次評価', activeStatuses: ['self_submitted', 'primary_evaluating'], doneStatuses: ['primary_submitted', 'manager_evaluating', 'interviewing', 'president_pending', 'approved', 'notified'] });
        steps.push({ id: 'manager', label: '最終評価', activeStatuses: ['primary_submitted', 'manager_evaluating'], doneStatuses: ['interviewing', 'president_pending', 'approved', 'notified'] });
    } else {
        steps.push({ id: 'manager', label: '上長評価', activeStatuses: ['self_submitted', 'manager_evaluating'], doneStatuses: ['interviewing', 'president_pending', 'approved', 'notified'] });
    }
    steps.push({ id: 'interview', label: '面談', activeStatuses: ['interviewing'], doneStatuses: ['president_pending', 'approved', 'notified'] });
    steps.push({ id: 'president', label: '社長承認', activeStatuses: ['president_pending'], doneStatuses: ['approved', 'notified'] });

    let stepperHtml = '<div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 1rem; width: 100%; overflow-x: auto; padding-bottom: 0.2rem; scrollbar-width: none;">';
    steps.forEach((step, idx) => {
        let state = 'pending';
        if (step.doneStatuses.includes(currentStatus)) state = 'done';
        else if (step.activeStatuses.includes(currentStatus)) state = 'active';

        let icon = '<i class="fas fa-circle" style="font-size:0.5rem;"></i>';
        let textColor = '#94a3b8'; // gray
        let textWeight = '600';
        
        if (state === 'done') {
            icon = '<i class="fas fa-check-circle"></i>';
            textColor = '#10b981'; // green
        } else if (state === 'active') {
            icon = '<i class="fas fa-play-circle"></i>';
            textColor = '#3b82f6'; // blue
            textWeight = '800';
        }

        stepperHtml += `
            <div style="display: flex; align-items: center; gap: 0.3rem; color: ${textColor}; background: ${state === 'active' ? '#eff6ff' : 'transparent'}; padding: ${state === 'active' ? '0.2rem 0.6rem' : '0 0.2rem'}; border-radius: 12px; transition: all 0.2s;">
                <span style="font-size: 1.1rem;">${icon}</span>
                <span style="font-weight: ${textWeight}; font-size: 0.85rem; white-space: nowrap;">${step.label}</span>
            </div>
        `;

        if (idx < steps.length - 1) {
            let lineColor = state === 'done' ? '#10b981' : '#cbd5e1';
            stepperHtml += `<div style="height: 2px; width: 24px; background-color: ${lineColor}; border-radius: 1px;"></div>`;
        }
    });
    stepperHtml += '</div>';

    const headerHtml = `
        <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b;">【${selectedEvalDetail.period}期 ${typeStr}】 ${selectedEvalDetail.user_name} さんの評価シート</h3>
                    <p style="margin: 0.3rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">
                        ステータス: <span style="color:#2563eb; font-weight:800;">${statusJp}</span> | 被評価者の現等級: ${selectedEvalDetail.current_grade || '-'} | 前年同期の等級: ${selectedEvalDetail.yoy_grade || '-'}
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary history-btn" data-userid="${userId}" data-username="${selectedEvalDetail.user_name || '一般'}" style="background:#fff; color:#475569; border:1px solid #cbd5e1; padding:0.5rem 1rem; border-radius:6px; font-weight:700;"><i class="fas fa-history"></i> 過去の履歴を見る</button>
                    ${mode !== 'self' ? `<button class="btn" onclick="window.backToSubordinateList()" style="background:#f1f5f9; color:#475569; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:700;"><i class="fas fa-arrow-left"></i> 一覧へ戻る</button>` : ''}
                </div>
            </div>
            ${stepperHtml}
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

    // キャッシュがない場合は裏側で通信し、DOMを部分更新する
    if (!isPastDataCached) {
        fetchAndRenderPastData(userId, selectedEvalDetail.period);
    }
}

async function fetchAndRenderPastData(userId, currentPeriod) {
    try {
        const q = query(collection(db, "t_evaluations"), where("user_id", "==", userId));
        const snap = await getDocs(q);
        
        let allPast = [];
        snap.forEach(d => {
            const data = d.data();
            if ((data.status === 'approved' || data.status === 'notified' || data.is_legacy_archive) && data.period !== currentPeriod) {
                allPast.push({ id: d.id, ...data });
            }
        });
        
        if (allPast.length > 0) {
            allPast.sort((a, b) => b.period.localeCompare(a.period));
            window.pastEvaluationsCache[userId] = allPast[0];
        } else {
            window.pastEvaluationsCache[userId] = null;
        }
    } catch(e) {
        console.warn("Failed to load previous period data for diff:", e);
        window.pastEvaluationsCache[userId] = null;
    }
    
    // 取得完了後、UIを部分更新
    previousPeriodData = window.pastEvaluationsCache[userId];
    updateDiffUI();
}

function updateDiffUI() {
    if (!selectedEvalDetail || !selectedEvalDetail.items) return;
    const status = selectedEvalDetail.status;
    
    selectedEvalDetail.items.forEach((item, idx) => {
        const containerId = `diff-container-${item.item_id}`;
        const containerEl = document.getElementById(containerId);
        if (!containerEl) return;
        
        let diffHtml = '<span style="color:#cbd5e1;">-</span>';
        let titleSuffix = '';

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
        
        containerEl.innerHTML = diffHtml;
        
        // titleSuffix は別途更新（項目名部分）
        const titleSuffixContainerId = `title-suffix-container-${item.item_id}`;
        const titleSuffixEl = document.getElementById(titleSuffixContainerId);
        if (titleSuffixEl) {
            titleSuffixEl.innerHTML = titleSuffix;
        }
    });
}

function renderModalBody(container, mode) {
    const status = selectedEvalDetail.status;
    const isManagerMode = mode === 'manager';
    const isPresidentMode = mode === 'president' && status === 'president_pending';
    const isInterviewMode = mode === 'interview' && status === 'interviewing';
    const isSelfMode = mode === 'self' && ['not_started', 'evaluating', 'self_evaluating'].includes(status);

    const wf = selectedEvalDetail.workflow || {};
    const hasPrimary = !!wf.primary_evaluator;
    const myJobTitle = window.appState.myJobTitle || (window.appState.currentUser ? window.appState.currentUser.JobTitle : '');
    const role = window.appState.currentUser ? window.appState.currentUser.Role : '';
    const isAdmin = role === 'Admin' || role === '管理者';
    const isPrimary = wf.primary_evaluator === myJobTitle || (isAdmin && wf.primary_evaluator === '社長');
    const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長')) || (isAdmin && wf.secondary_evaluator === '社長');

    const canEditPrimary = isManagerMode && isPrimary && ['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted'].includes(status);
    const canEditSecondary = isManagerMode && isSecondary && ['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(status);

    // 全員が提出完了しているか、もしくは管理者かどうかの判定（ブラインド評価用）
    const allSubmitted = selectedEvalDetail.is_self_submitted && 
                         (!hasPrimary || selectedEvalDetail.is_primary_submitted) && 
                         selectedEvalDetail.is_manager_submitted;
    
    const hiddenIconHtml = `<div style="text-align: center; width: 100%;"><i class="fas fa-lock" style="color: #94a3b8; font-size: 0.9rem;" title="全員の評価が完了するまで非公開です"></i></div>`;

    // 項目ごとの行を構築
    let itemsHtml = '';
    let currentCategory = '';
    
    // 集計用初期値
    let selfTotal = 0;
    let primaryTotal = 0;
    let managerTotal = 0;

    // 特記事項・昇格条件の表示（上部配置）
    let specialNoteHtml = '';
    if (selectedEvalDetail.special_note && selectedEvalDetail.special_note.trim() !== '') {
        specialNoteHtml = `
            <div class="glass-panel" style="padding: 1.2rem; background: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; border-radius: 8px; margin-bottom: 1.5rem;">
                <h5 style="margin: 0 0 0.4rem; color: #be123c; font-weight: 800; font-size: 0.9rem;">
                    <i class="fas fa-exclamation-circle" style="margin-right: 0.4rem;"></i>特記事項・昇格条件
                </h5>
                <p style="margin: 0; font-size: 0.85rem; color: #9f1239; line-height: 1.6; white-space: pre-wrap;">${selectedEvalDetail.special_note}</p>
            </div>
        `;
    }

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

    // itemsHtmlの組み立て開始時に特記事項とアシストウィジェットを挿入
    itemsHtml += specialNoteHtml;
    itemsHtml += assistWidgetHtml;

    selectedEvalDetail.items.forEach((item, idx) => {
        let titleSuffix = '';
        let diffHtml = '';

        // キャッシュチェック（遅延ローディング対応）
        const isPastDataCached = window.pastEvaluationsCache[selectedEvalDetail.user_id] !== undefined;

        if (isPastDataCached) {
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
        } else {
            // 遅延ローディング中
            diffHtml = '<div style="font-size:0.8rem; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> 取得中</div>';
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
        primaryTotal += item.primary_score || 0;
        managerTotal += item.manager_score || 0;

        // 自己評価ラジオボタン（編集権限がない場合は数字のみ表示）
        let selfRadioHtml = '';
        
        if (item.quiz_data) {
            // テスト紐付け項目
            if (item.quiz_data.completed) {
                const badgeColor = item.quiz_data.passed ? '#10b981' : '#ef4444';
                const passText = item.quiz_data.passed ? '合格' : '不合格';
                
                const wrongCount = item.quiz_data.questions ? item.quiz_data.questions.filter(q => q.user_answer !== q.correct_index).length : 0;
                let reviewBtn = '';
                if (wrongCount === 0) {
                    reviewBtn = `<div style="font-size: 0.65rem; color: #10b981; margin-top: 0.4rem; font-weight: 700;">全問正解！<br>(復習項目なし)</div>`;
                } else {
                    const quizDataStr = encodeURIComponent(JSON.stringify(item.quiz_data));
                    reviewBtn = `<div style="margin-top: 0.4rem;"><button type="button" onclick="window.openQuizReviewModal(decodeURIComponent('${quizDataStr}'))" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; font-weight: 700; background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; border-radius: 4px; cursor: pointer; transition: 0.2s;"><i class="fas fa-search"></i> 誤答を復習</button></div>`;
                }

                selfRadioHtml = `
                    <div style="text-align: center; width: 100%;">
                        <div style="font-weight: 800; font-size: 1.1rem; color: #3b82f6;">${item.self_score || '-'}</div>
                        <div style="font-size: 0.7rem; color: ${badgeColor}; font-weight: 700; margin-top: 0.2rem;">
                            ${passText} (${item.quiz_data.score}点)
                        </div>
                        ${reviewBtn}
                    </div>
                `;
            } else if (isSelfMode) {
                selfRadioHtml = `
                    <button type="button" class="btn btn-primary" onclick="window.startEvaluationQuiz(${idx})"
                            style="padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 800; border-radius: 6px; background: #8b5cf6; border: none; width: 100%;">
                        <i class="fas fa-edit"></i> 試験を実施
                    </button>
                `;
            } else {
                selfRadioHtml = `<div style="font-size: 0.8rem; color: #94a3b8; text-align: center; width: 100%;">未受験</div>`;
            }
        } else {
            // 通常の評価項目
            if (isSelfMode) {
                for (let s = 5; s >= 1; s--) {
                    const isSel = item.self_score === s;
                    selfRadioHtml += `
                        <button type="button" class="score-btn ${isSel ? 'selected-self' : ''}" 
                                onclick="window.selectScore(${idx}, 'self', ${s})">
                            ${s}
                        </button>
                    `;
                }
            } else if (mode === 'self' || allSubmitted || isAdmin) {
                selfRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #3b82f6; text-align: center; width: 100%;">${item.self_score || '-'}</div>`;
            } else {
                selfRadioHtml = hiddenIconHtml;
            }
        }

        // 1次評価ラジオボタン
        let primaryRadioHtml = '';
        if (hasPrimary) {
            if (item.quiz_data) {
                if (!item.quiz_data.completed) {
                    primaryRadioHtml = `<div style="font-size: 0.8rem; color: #94a3b8; text-align: center; width: 100%;">未受験</div>`;
                } else {
                    if (canEditPrimary) {
                        let btns = '';
                        const minScore = item.quiz_data.eval_score || 3;
                        for (let s = 5; s >= 1; s--) {
                            let isDisabled = false;
                            let isSel = item.primary_score === s;
                            if (!item.quiz_data.passed) {
                                isDisabled = true; // 不合格時は全ロック
                                isSel = (s === (item.quiz_data.eval_score || 1));
                            } else {
                                isDisabled = s < minScore; // 合格時は下限未満をロック
                            }
                            
                            const btnStyle = isDisabled ? 'opacity:0.3; cursor:not-allowed;' : '';
                            const btnDisabled = isDisabled ? 'disabled' : '';
                            const onclick = isDisabled ? '' : `onclick="window.selectScore(${idx}, 'primary', ${s})"`;
                            btns += `<button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" style="${btnStyle}" ${btnDisabled} ${onclick}>${s}</button>`;
                        }
                        primaryRadioHtml = btns;
                    } else if (allSubmitted || isAdmin) {
                        primaryRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #10b981; text-align: center; width: 100%;">${item.primary_score || (item.quiz_data.passed ? '-' : (item.quiz_data.eval_score || 1))}</div>`;
                    } else {
                        primaryRadioHtml = hiddenIconHtml;
                    }
                }
            } else {
                if (canEditPrimary) {
                    for (let s = 5; s >= 1; s--) {
                        const isSel = item.primary_score === s;
                        primaryRadioHtml += `
                            <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                                    onclick="window.selectScore(${idx}, 'primary', ${s})">
                                ${s}
                            </button>
                        `;
                    }
                } else if (allSubmitted || isAdmin) {
                    primaryRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #10b981; text-align: center; width: 100%;">${item.primary_score || '-'}</div>`;
                } else {
                    primaryRadioHtml = hiddenIconHtml;
                }
            }
        }

        // 上長評価（2次評価/最終評価）ラジオボタン
        let managerRadioHtml = '';
        if (item.quiz_data) {
            if (!item.quiz_data.completed) {
                managerRadioHtml = `<div style="font-size: 0.8rem; color: #94a3b8; text-align: center; width: 100%;">未受験</div>`;
            } else {
                if (canEditSecondary || isInterviewMode) {
                    let btns = '';
                    const minScore = item.quiz_data.eval_score || 3;
                    for (let s = 5; s >= 1; s--) {
                        let isDisabled = false;
                        let isSel = item.manager_score === s;
                        if (!item.quiz_data.passed) {
                            isDisabled = true; // 不合格時は全ロック
                            isSel = (s === (item.quiz_data.eval_score || 1));
                        } else {
                            isDisabled = s < minScore; // 合格時は下限未満をロック
                        }
                        
                        const btnStyle = isDisabled ? 'opacity:0.3; cursor:not-allowed;' : '';
                        const btnDisabled = isDisabled ? 'disabled' : '';
                        const onclick = isDisabled ? '' : `onclick="window.selectScore(${idx}, 'manager', ${s})"`;
                        const popoverOnclick = isDisabled ? '' : `onclick="window.selectScore(${idx}, 'manager', ${s})"`;
                        
                        btns += `
                            <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                                    style="${isInterviewMode ? 'padding: 0.3rem 0.5rem;' : ''} ${btnStyle}"
                                    ${btnDisabled} ${isInterviewMode ? popoverOnclick : onclick}>
                                ${s}
                            </button>
                        `;
                    }
                    if (canEditSecondary) {
                        managerRadioHtml = btns;
                    } else {
                        managerRadioHtml = `
                            <div class="eval-popover-container" style="position: relative; display: inline-block; width: 100%; text-align: center;">
                                <div onclick="window.toggleScorePopover(${idx}, event)" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; padding: 0.2rem 0.5rem; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'" title="クリックして点数を変更">
                                    <span id="popover-score-text-${idx}" style="font-weight: 800; font-size: 1.1rem; color: #7c3aed;">${item.manager_score || (item.quiz_data.passed ? '-' : (item.quiz_data.eval_score || 1))}</span>
                                    <i class="fas fa-pencil-alt" style="font-size: 0.7rem; color: #a78bfa;"></i>
                                </div>
                                <div id="popover-score-${idx}" class="eval-popover-menu" style="display: none; position: absolute; top: calc(100% + 5px); left: 50%; transform: translateX(-50%); background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.4rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); z-index: 50; white-space: nowrap;">
                                    <div style="position: absolute; top: -5px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 10px; height: 10px; background: white; border-top: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0;"></div>
                                    <div style="display: flex; gap: 0.25rem; position: relative;">
                                        ${btns}
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                } else if (allSubmitted || isAdmin) {
                    managerRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #7c3aed; text-align: center; width: 100%;">${item.manager_score || (item.quiz_data.passed ? '-' : (item.quiz_data.eval_score || 1))}</div>`;
                } else {
                    managerRadioHtml = hiddenIconHtml;
                }
            }
        } else {
            if (canEditSecondary) {
                for (let s = 5; s >= 1; s--) {
                    const isSel = item.manager_score === s;
                    managerRadioHtml += `
                        <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                                onclick="window.selectScore(${idx}, 'manager', ${s})">
                            ${s}
                        </button>
                    `;
                }
            } else if (isInterviewMode) {
                let popoverBtns = '';
                for (let s = 5; s >= 1; s--) {
                    const isSel = item.manager_score === s;
                    popoverBtns += `
                        <button type="button" class="score-btn ${isSel ? 'selected-manager' : ''}" 
                                onclick="window.selectScore(${idx}, 'manager', ${s})" style="padding: 0.3rem 0.5rem;">
                            ${s}
                        </button>
                    `;
                }
                managerRadioHtml = `
                    <div class="eval-popover-container" style="position: relative; display: inline-block; width: 100%; text-align: center;">
                        <div onclick="window.toggleScorePopover(${idx}, event)" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; padding: 0.2rem 0.5rem; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'" title="クリックして点数を変更">
                            <span id="popover-score-text-${idx}" style="font-weight: 800; font-size: 1.1rem; color: #7c3aed;">${item.manager_score || '-'}</span>
                            <i class="fas fa-pencil-alt" style="font-size: 0.7rem; color: #a78bfa;"></i>
                        </div>
                        <div id="popover-score-${idx}" class="eval-popover-menu" style="display: none; position: absolute; top: calc(100% + 5px); left: 50%; transform: translateX(-50%); background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.4rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); z-index: 50; white-space: nowrap;">
                            <div style="position: absolute; top: -5px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 10px; height: 10px; background: white; border-top: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0;"></div>
                            <div style="display: flex; gap: 0.25rem; position: relative;">
                                ${popoverBtns}
                            </div>
                        </div>
                    </div>
                `;
            } else if (allSubmitted || isAdmin) {
                managerRadioHtml = `<div style="font-weight: 800; font-size: 1.1rem; color: #7c3aed; text-align: center; width: 100%;">${item.manager_score || '-'}</div>`;
            } else {
                managerRadioHtml = hiddenIconHtml;
            }
        }

        // コメント入力欄
        let commentAreaHtml = `<div style="display: flex; gap: 0.5rem; align-items: center; justify-content: center; width: 100%;">`;
        
        let editRole = null;
        if (isSelfMode) editRole = 'self';
        else if (canEditPrimary) editRole = 'primary';
        else if (canEditSecondary) editRole = 'manager';

        const isBlind = ['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(status);
        
        let displaySelfComment = item.self_comment || '未記入';
        let displayPrimaryComment = item.primary_comment || '未記入';
        let displayManagerComment = item.manager_comment || '未記入';

        let mySelfColor = item.self_comment ? 'white' : '#cbd5e1';
        let myPrimaryColor = item.primary_comment ? 'white' : '#cbd5e1';
        let myManagerColor = item.manager_comment ? 'white' : '#cbd5e1';

        if (isBlind) {
            const maskedHtml = '<span style="color:#94a3b8;"><i class="fas fa-lock"></i> 非公開</span>';
            if (editRole !== 'self') { displaySelfComment = maskedHtml; mySelfColor = '#cbd5e1'; }
            if (editRole !== 'primary') { displayPrimaryComment = maskedHtml; myPrimaryColor = '#cbd5e1'; }
            if (editRole !== 'manager') { displayManagerComment = maskedHtml; myManagerColor = '#cbd5e1'; }
        }

        let combinedTooltipHtml = '';
        combinedTooltipHtml += `<div style="margin-bottom:0.4rem;"><strong style="color:${item.self_comment && (!isBlind || editRole === 'self') ? '#93c5fd' : '#94a3b8'};"><i class="fas fa-user"></i> 自己理由:</strong><br><span style="color:${mySelfColor};">${displaySelfComment}</span></div>`;
        
        if (hasPrimary) {
            combinedTooltipHtml += `<div style="margin-bottom:0.4rem;"><strong style="color:${item.primary_comment && (!isBlind || editRole === 'primary') ? '#a7f3d0' : '#94a3b8'};"><i class="fas fa-user-tie"></i> 1次FB:</strong><br><span style="color:${myPrimaryColor};">${displayPrimaryComment}</span></div>`;
        }
        
        combinedTooltipHtml += `<div><strong style="color:${item.manager_comment && (!isBlind || editRole === 'manager') ? '#c4b5fd' : '#94a3b8'};"><i class="fas fa-chess-king"></i> 最終FB:</strong><br><span style="color:${myManagerColor};">${displayManagerComment}</span></div>`;

        if (editRole) {
            let myCommentText = '';
            if (editRole === 'self') myCommentText = item.self_comment;
            else if (editRole === 'primary') myCommentText = item.primary_comment;
            else if (editRole === 'manager') myCommentText = item.manager_comment;
            
            const hasMyComment = !!(myCommentText && myCommentText.trim() !== '');
            const iconColor = hasMyComment ? '#10b981' : '#cbd5e1';
            const downClass = idx < 12 ? ' tooltip-down' : '';
            
            commentAreaHtml += `
                <div class="eval-score-cell comment-tooltip${downClass}" style="display:inline-block; cursor: pointer;" onclick="window.openCommentModal(${idx}, '${editRole}')">
                    <i class="fas fa-pen" style="color: ${iconColor}; font-size: 1.2rem; transition: color 0.2s;" onmouseover="this.style.color='#059669'" onmouseout="this.style.color='${iconColor}'"></i>
                    <div class="eval-tooltip">
                        ${combinedTooltipHtml}
                    </div>
                </div>
            `;
        } else {
            const hasAnyComment = !!(item.self_comment || item.primary_comment || item.manager_comment);
            const iconColor = hasAnyComment ? '#3b82f6' : '#cbd5e1';
            const downClass = idx < 12 ? ' tooltip-down' : '';
            
            commentAreaHtml += `
                <div class="eval-score-cell comment-tooltip${downClass}" style="display:inline-block; cursor: help;">
                    <i class="fas ${hasAnyComment ? 'fa-comment-dots' : 'fa-comment'}" style="color: ${iconColor}; font-size: 1.3rem;"></i>
                    <div class="eval-tooltip">
                        ${combinedTooltipHtml}
                    </div>
                </div>
            `;
        }

        commentAreaHtml += `</div>`;
        
        let primaryColHtml = hasPrimary ? `
            <td style="padding: 0.8rem 1rem; width: 200px; vertical-align: middle;" class="eval-score-cell">
                <div style="display: flex; gap: 0.25rem; justify-content: center;">
                    ${primaryRadioHtml}
                </div>
                <div class="eval-tooltip">
                    <strong style="color:#a7f3d0;"><i class="fas fa-info-circle"></i> 基準説明:</strong><br>${item.description}
                </div>
            </td>
        ` : '';

        itemsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                <td style="padding: 0.8rem 1rem; width: 30%; vertical-align: middle;">
                    <div style="font-weight: 700; color: #1e293b; line-height: 1.4; display: flex; align-items: center;">
                        ${item.title} <span id="title-suffix-container-${item.item_id}">${titleSuffix}</span>
                    </div>
                </td>
                <td style="padding: 0.8rem 0.5rem; text-align: center; font-family: monospace; background: #f8fafc; width: 100px; vertical-align: middle;" id="diff-container-${item.item_id}">
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
                ${primaryColHtml}
                <td style="padding: 0.8rem 1rem; width: 200px; vertical-align: middle;" class="eval-score-cell">
                    <div style="display: flex; gap: 0.25rem; justify-content: center;">
                        ${managerRadioHtml}
                    </div>
                    <div class="eval-tooltip">
                        <strong style="color:#a7f3d0;"><i class="fas fa-info-circle"></i> 基準説明:</strong><br>${item.description}
                    </div>
                </td>
                <td style="padding: 0.8rem; text-align: center; width: 80px; vertical-align: middle;">
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
                ・仮評価は結果公開と仮通知のみで給与には影響しません。<br>
                ・本評価のみ新等級が月から本反映されます。
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
                    ${isInterviewMode ? `
                        <textarea id="modal-interview-notes" rows="4" placeholder="面談で話し合った内容や育成方針を記入" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; font-family:inherit; resize:none; overflow-y:hidden;" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'">${selectedEvalDetail.interview_notes || ''}</textarea>
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
                        <textarea id="modal-president-comment" rows="4" placeholder="社長からのフィードバックコメントを入力" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; font-family:inherit; resize:none; overflow-y:hidden;" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'">${selectedEvalDetail.president_comment || ''}</textarea>
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
                        <th style="text-align: center; width: 100px;">過去評価</th>
                        <th style="text-align: center; width: 200px;">自己</th>
                        ${hasPrimary ? `<th style="text-align: center; width: 200px; color:#2563eb;">１次</th>` : ''}
                        <th style="text-align: center; width: 200px; color:#7c3aed;">最終</th>
                        <th style="text-align: center; width: 80px;">評価理由</th>
                    </tr>
                </thead>
                <tbody id="modal-eval-table-body">
                    ${itemsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid var(--border);">
                        <td style="padding: 1rem; text-align: right;">合計点 (120点満点)</td>
                        <td style="padding: 1rem; text-align: center; color: #64748b;">-</td>
                        <td style="padding: 1rem; text-align: center; font-size: 1.1rem; color: #2563eb;" id="sum-self-score">${(mode === 'self' || isSelfMode || allSubmitted || isAdmin) ? selfTotal : hiddenIconHtml}</td>
                        ${hasPrimary ? `<td style="padding: 1rem; text-align: center; font-size: 1.1rem; color: #2563eb;" id="sum-primary-score">${(canEditPrimary || allSubmitted || isAdmin) ? primaryTotal : hiddenIconHtml}</td>` : ''}
                        <td style="padding: 1rem; text-align: center; font-size: 1.1rem; color: #7c3aed;" id="sum-manager-score">${(canEditSecondary || isInterviewMode || allSubmitted || isAdmin) ? managerTotal : hiddenIconHtml}</td>
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
        } else if (type === 'primary') {
            item.primary_score = score;
        } else if (type === 'manager') {
            item.manager_score = score;
        }

        // DOM再レンダリングを介さず合計点のみ更新してパフォーマンスを稼ぐ
        let selfSum = 0;
        let primarySum = 0;
        let managerSum = 0;
        selectedEvalDetail.items.forEach(it => {
            selfSum += it.self_score || 0;
            primarySum += it.primary_score || 0;
            managerSum += it.manager_score || 0;
        });

        selectedEvalDetail.self_total_score = selfSum;
        selectedEvalDetail.primary_total_score = primarySum;
        selectedEvalDetail.manager_total_score = managerSum;

        const sumSelfEl = document.getElementById('sum-self-score');
        const sumPrimEl = document.getElementById('sum-primary-score');
        const sumMgrEl = document.getElementById('sum-manager-score');
        if (type === 'self' && sumSelfEl) sumSelfEl.textContent = selfSum;
        if (type === 'primary' && sumPrimEl) sumPrimEl.textContent = primarySum;
        if (type === 'manager' && sumMgrEl) sumMgrEl.textContent = managerSum;

        // 面談用ポップオーバーのテキスト更新と閉じる処理
        const popoverTextEl = document.getElementById(`popover-score-text-${itemIdx}`);
        if (popoverTextEl && type === 'manager') {
            popoverTextEl.textContent = score;
            const popoverEl = document.getElementById(`popover-score-${itemIdx}`);
            if (popoverEl) popoverEl.style.display = 'none';
        }

        // クリックしたボタンのスタイルだけを即時切り替え
        const rowEl = document.getElementById('modal-eval-table-body').children;
        // カテゴリヘッダー等をまたぐため、インデックス補正ではなく正確に対象のtrを探す
        const targetTrs = Array.from(rowEl).filter(tr => tr.style.background === 'white');
        const tr = targetTrs[itemIdx];
        if (tr) {
            const hasPrimary = !!(selectedEvalDetail.workflow && selectedEvalDetail.workflow.primary_evaluator);
            let btnCellIdx = 2; // self
            if (type === 'primary') btnCellIdx = 3;
            else if (type === 'manager') btnCellIdx = hasPrimary ? 4 : 3;

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
            if (type === 'primary') item.primary_comment = val;
            if (type === 'manager') item.manager_comment = val;
        }
        
        // Re-render the table to reflect the new comment status
        window.refreshCurrentEvalDetail();
    };

    window.refreshCurrentEvalDetail = () => {
        if (!selectedEvalDetail || !window.currentEvalMode) return;
        
        let container = null;
        const mode = window.currentEvalMode;
        
        if (mode === 'self') container = document.getElementById('self-eval-inline-container');
        else if (mode === 'interview') container = document.getElementById('interview-detail-container');
        else if (mode === 'president') container = document.getElementById('president-detail-container');
        else if (mode === 'admin') container = document.getElementById('admin-detail-inner');
        else container = document.getElementById('subordinate-detail-container');
        
        if (container) {
            renderEvalDetailInline(container, selectedEvalDetail, mode);
        }
    };

    window.openCommentModal = (idx, role) => {
        const item = selectedEvalDetail.items[idx];
        const currentVal = item[`${role}_comment`] || '';
        
        let roleName = 'フィードバック';
        if (role === 'self') roleName = '自己理由';
        else if (role === 'primary') roleName = '1次FB';
        else if (role === 'manager') roleName = '最終FB';
        
        Swal.fire({
            title: `${roleName}を入力`,
            html: `
                <div style="text-align: left; margin-bottom: 0.8rem;">
                    <div style="font-size: 0.85rem; color: #475569; margin-bottom: 0.4rem;"><strong>評価項目:</strong> ${item.title}</div>
                    <div style="font-size: 0.8rem; color: #64748b; background: #f8fafc; padding: 0.5rem; border-radius: 6px; border: 1px solid #e2e8f0;">${item.description}</div>
                </div>
                <textarea id="swal-input-comment" placeholder="${roleName}を詳しく入力してください" style="width: 100%; box-sizing: border-box; font-size: 0.95rem; min-height: 120px; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; margin: 0; font-family: inherit; resize: vertical; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">${currentVal}</textarea>
            `,
            showCancelButton: true,
            confirmButtonText: '保存',
            cancelButtonText: 'キャンセル',
            confirmButtonColor: '#7c3aed',
            preConfirm: () => {
                return document.getElementById('swal-input-comment').value;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                window.updateComment(idx, role, result.value);
            }
        });
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

    // 面談用：ポップオーバー（吹き出し）の開閉ロジック
    window.toggleScorePopover = (idx, event) => {
        if (event) event.stopPropagation();
        const popover = document.getElementById(`popover-score-${idx}`);
        if (!popover) return;
        
        // 他のすべてのポップオーバーを閉じる
        document.querySelectorAll('.eval-popover-menu').forEach(el => {
            if (el.id !== `popover-score-${idx}`) el.style.display = 'none';
        });

        if (popover.style.display === 'none') {
            popover.style.display = 'block';
        } else {
            popover.style.display = 'none';
        }
    };

    // 領域外クリックでポップオーバーを閉じる
    if (!window._evalPopoverListenerAdded) {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.eval-popover-container')) {
                document.querySelectorAll('.eval-popover-menu').forEach(el => {
                    el.style.display = 'none';
                });
            }
        });
        window._evalPopoverListenerAdded = true;
    }
}

function renderModalFooter(container, mode) {
    const status = selectedEvalDetail.status;
    const role = window.appState.currentUser ? window.appState.currentUser.Role : '';
    const myJobTitle = window.appState.myJobTitle || (window.appState.currentUser ? window.appState.currentUser.JobTitle : '');
    const isAdmin = role === 'Admin' || role === '管理者';
    
    container.innerHTML = '';
    
    if (mode === 'self' && ['evaluating', 'self_evaluating'].includes(status) && !selectedEvalDetail.is_self_submitted) {
        container.innerHTML = `
            <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('self')">下書き保存</button>
            <button class="btn btn-primary" style="background:#2563eb; border-color:#2563eb; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitSelfEvaluation()">自己評価を提出する</button>
        `;
    }
    else if (mode === 'manager' && ['evaluating', 'self_evaluating', 'self_submitted', 'primary_evaluating', 'primary_submitted', 'manager_evaluating'].includes(status)) {
        const wf = selectedEvalDetail.workflow || {};
        const isPrimary = wf.primary_evaluator === myJobTitle || (isAdmin && wf.primary_evaluator === '社長');
        const isSecondary = wf.secondary_evaluator === myJobTitle || (!wf.secondary_evaluator && (role === 'Manager' || role === '店長')) || (isAdmin && wf.secondary_evaluator === '社長');

        let submitBtn = '';
        if (isPrimary && !selectedEvalDetail.is_primary_submitted) {
            submitBtn = `<button class="btn btn-primary" style="background:#7c3aed; border-color:#7c3aed; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('primary')">1次評価を提出</button>`;
        } 
        else if (isSecondary && !selectedEvalDetail.is_manager_submitted) {
            submitBtn = `<button class="btn btn-primary" style="background:#7c3aed; border-color:#7c3aed; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('manager')">最終評価を提出</button>`;
        }
        else if (isSecondary && selectedEvalDetail.is_manager_submitted && wf.primary_evaluator && !selectedEvalDetail.is_primary_submitted) {
            submitBtn = `<button class="btn btn-primary" style="background:#ef4444; border-color:#ef4444; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('skip_primary')">1次評価を強制スキップして面談に進む</button>`;
        }
        
        if (submitBtn || role === 'Admin') {
            container.innerHTML = `
                <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('manager')">評価を下書き保存</button>
                ${submitBtn}
            `;
        } else {
            container.innerHTML = `<button class="btn" onclick="window.backToSubordinateList()" style="background:#f1f5f9; color:#475569; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:700;"><i class="fas fa-times"></i> 閉じる</button>`;
        }
    }
    else if (mode === 'interview' && status === 'interviewing') {
        container.innerHTML = `
            <button class="btn" style="background: white; border: 1px solid #cbd5e1; color: var(--text-secondary); font-weight:700;" onclick="window.saveEvaluationDraft('interview')">下書き保存 (評価・面談メモ)</button>
            <button class="btn btn-primary" style="background:#059669; border-color:#059669; color:white; font-weight:800; padding:0.6rem 2rem;" onclick="window.submitManagerEvaluation('president_pending')">面談完了・社長へ最終提出</button>
        `;
    }
    else if (mode === 'president' && status === 'president_pending') {
        container.innerHTML = `
            <button class="btn btn-primary" style="background:#be123c; border-color:#be123c; font-weight:800; padding:0.6rem 2rem;" onclick="window.approvePresidentEvaluation()">社長査定を確定する</button>
        `;
    }
    else {
        container.innerHTML = `
            <button class="btn" onclick="window.closeEvaluationModal()" style="background:#f1f5f9; color:#475569; border:none; padding:0.5rem 1rem; border-radius:6px; font-weight:700;"><i class="fas fa-times"></i> 閉じる</button>
        `;
    }

    // 1. 下書き保存
    window.saveEvaluationDraft = async (type) => {
        try {
            // テキストフィールドの値を同期
            if (type === 'manager' || type === 'interview') {
                const notesEl = document.getElementById('modal-interview-notes');
                const dateEl = document.getElementById('modal-interview-date');
                if (notesEl) selectedEvalDetail.interview_notes = notesEl.value;
                if (dateEl) selectedEvalDetail.interview_date = dateEl.value;
            }

            const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
            const updates = {
                items: selectedEvalDetail.items,
                self_total_score: selectedEvalDetail.self_total_score || 0,
                primary_total_score: selectedEvalDetail.primary_total_score || 0,
                manager_total_score: selectedEvalDetail.manager_total_score || 0,
                interview_notes: selectedEvalDetail.interview_notes || '',
                interview_date: selectedEvalDetail.interview_date || '',
                updated_at: new Date().toISOString()
            };
            await updateDoc(docRef, updates);
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
                const wf = selectedEvalDetail.workflow || {};
                const hasPrimary = !!wf.primary_evaluator;
                const isPrimarySub = selectedEvalDetail.is_primary_submitted || false;
                const isManagerSub = selectedEvalDetail.is_manager_submitted || false;

                let nextStatus = 'self_submitted';
                if (hasPrimary && !isPrimarySub) {
                    nextStatus = 'self_submitted'; // 1次評価待ち
                } else if (!isManagerSub) {
                    nextStatus = hasPrimary ? 'primary_submitted' : 'self_submitted'; // 最終評価待ち または 上長評価待ち
                } else {
                    nextStatus = 'interviewing'; // 全員提出済み
                }

                const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
                await updateDoc(docRef, {
                    items: selectedEvalDetail.items,
                    self_total_score: selectedEvalDetail.self_total_score,
                    status: nextStatus,
                    is_self_submitted: true,
                    updated_at: new Date().toISOString()
                });
                
                // メモリ上のデータを更新
                selectedEvalDetail.status = nextStatus;
                selectedEvalDetail.is_self_submitted = true;
                
                const idx = activeEvaluations.findIndex(e => e.id === selectedEvalDetail.id);
                if (idx !== -1) {
                    activeEvaluations[idx].status = nextStatus;
                    activeEvaluations[idx].is_self_submitted = true;
                    activeEvaluations[idx].items = selectedEvalDetail.items;
                    activeEvaluations[idx].self_total_score = selectedEvalDetail.self_total_score;
                }

                const modal = document.getElementById('eval-detail-modal');
                if (modal && modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
                
                // リロードせずにUIを即時反映
                if (mode === 'self' && myEvaluation) {
                    myEvaluation.status = nextStatus;
                    myEvaluation.is_self_submitted = true;
                    myEvaluation.items = selectedEvalDetail.items;
                    myEvaluation.self_total_score = selectedEvalDetail.self_total_score;
                }
                renderActiveTabContent();

                showAlert('提出完了', '提出が完了しました。上長から面談日についての連絡が来るまでお待ちください。');
                
                if (window.mobileEditingEval && typeof window.closeMobileInputView === 'function') {
                    window.closeMobileInputView();
                }
            } catch(e) {
                console.error(e);
                showAlert('エラー', `提出処理に失敗しました。<br><br><span style="font-size:0.8rem;color:#ef4444;word-break:break-all;">【システムエラー詳細】<br>${e.message || e.toString()}</span>`);
            }
        });
    };

    // 3. 上長評価の提出（面談待ちへ、または社長提出へ）
    window.submitManagerEvaluation = (type) => {
        // テスト不合格で強制ロックされている項目は未入力チェックから除外し、提出時に自動セットする
        const incompletePrimary = selectedEvalDetail.items.some(it => {
            if (it.quiz_data && it.quiz_data.completed && !it.quiz_data.passed) return false;
            return !it.primary_score;
        });
        const incompleteManager = selectedEvalDetail.items.some(it => {
            if (it.quiz_data && it.quiz_data.completed && !it.quiz_data.passed) return false;
            return !it.manager_score;
        });
        
        if (type === 'primary' && incompletePrimary) {
            return showAlert('入力未完了', 'すべての評価項目（24項目）に1次評価点を入力してください。');
        }
        if (type === 'manager' && incompleteManager) {
            return showAlert('入力未完了', 'すべての評価項目（24項目）に最終評価点を入力してください。');
        }

        const notesEl = document.getElementById('modal-interview-notes');
        const dateEl = document.getElementById('modal-interview-date');
        if (notesEl) selectedEvalDetail.interview_notes = notesEl.value;
        if (dateEl) selectedEvalDetail.interview_date = dateEl.value;

        // 不合格でロックされた項目の点数を自動補完
        selectedEvalDetail.items.forEach(it => {
            if (it.quiz_data && it.quiz_data.completed && !it.quiz_data.passed) {
                const forcedScore = it.quiz_data.eval_score || 1;
                if (!it.primary_score) it.primary_score = forcedScore;
                if (!it.manager_score) it.manager_score = forcedScore;
            }
        });

        // 社長へ提出する際は面談メモが必須
        if (type === 'president_pending' && !selectedEvalDetail.interview_notes) {
            return showAlert('入力未完了', '面談内容（記録）を記入してください。');
        }

        let title = '提出の確認';
        let msg = '';
        
        const wf = selectedEvalDetail.workflow || {};
        const hasPrimary = !!wf.primary_evaluator;
        const isSelfSub = selectedEvalDetail.is_self_submitted || false;
        let isPrimarySub = selectedEvalDetail.is_primary_submitted || false;
        let isManagerSub = selectedEvalDetail.is_manager_submitted || false;
        let nextStatus = selectedEvalDetail.status;

        if (type === 'skip_primary') {
            showConfirm('1次評価の強制スキップ', '現在未提出の1次評価をスキップし、このスタッフの評価を全員完了（面談待ち）に進めます。よろしいですか？', async () => {
                try {
                    const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
                    const updates = {
                        is_primary_submitted: true,
                        status: 'interviewing',
                        updated_at: new Date().toISOString()
                    };
                    await updateDoc(docRef, updates);
                    
                    selectedEvalDetail.is_primary_submitted = true;
                    selectedEvalDetail.status = 'interviewing';
                    
                    const idx = activeEvaluations.findIndex(e => e.id === selectedEvalDetail.id);
                    if (idx !== -1) {
                        activeEvaluations[idx] = { ...activeEvaluations[idx], ...updates };
                    }
                    window.backToSubordinateList();
                    showAlert('スキップ完了', '1次評価をスキップして面談待ちに進めました。');
                } catch(e) {
                    showAlert('エラー', 'エラーが発生しました: ' + e.message);
                }
            });
            return;
        }

        if (type === 'primary') {
            title = '1次評価の提出';
            msg = '1次評価を完了として提出しますか？<br>（全員の評価が完了するまでは面談待ちに進みません）';
            isPrimarySub = true;
        } else if (type === 'manager') {
            title = '最終評価の提出';
            msg = '最終評価を完了として提出しますか？<br>（全員の評価が完了するまでは面談待ちに進みません）';
            isManagerSub = true;
        } else if (type === 'president_pending') {
            title = '社長への最終提出';
            msg = '面談記録を含めて評価を社長に提出します。提出後は変更できなくなりますが、よろしいですか？';
            nextStatus = 'president_pending';
        }

        showConfirm(title, msg, async () => {
            try {
                // 1次評価スキップの2段確認
                let finalType = type;
                if (type === 'manager' && hasPrimary && !isPrimarySub) {
                    const skipConfirmed = await showConfirm(
                        '1次評価スキップの確認',
                        '現在、1次評価（副店長等）が未完了です。<br><br>1次評価をスキップして全員完了（面談待ち）に進めますか？<br>※「待機する」を選ぶと、あなたの評価は保存された上で1次評価者の入力を待ちます。',
                        null,
                        '待機する',
                        'スキップして完了'
                    );
                    
                    if (skipConfirmed) {
                        isPrimarySub = true;
                        nextStatus = 'interviewing';
                    } else {
                        nextStatus = 'self_submitted';
                    }
                } else if (type === 'primary' || type === 'manager') {
                    if (!isSelfSub) {
                        nextStatus = 'evaluating';
                    } else if (hasPrimary && !isPrimarySub) {
                        nextStatus = 'self_submitted';
                    } else if (!isManagerSub) {
                        nextStatus = 'primary_submitted';
                    } else {
                        nextStatus = 'interviewing';
                    }
                }

                const docRef = doc(db, "t_evaluations", selectedEvalDetail.id);
                const updates = {
                    items: selectedEvalDetail.items,
                    primary_total_score: selectedEvalDetail.primary_total_score || 0,
                    manager_total_score: selectedEvalDetail.manager_total_score || 0,
                    interview_notes: selectedEvalDetail.interview_notes || '',
                    interview_date: selectedEvalDetail.interview_date || '',
                    status: nextStatus,
                    updated_at: new Date().toISOString()
                };
                
                if (type === 'primary' || isPrimarySub) updates.is_primary_submitted = true;
                if (type === 'manager') updates.is_manager_submitted = true;
                
                const currentUser = window.appState?.currentUser;
                if (type === 'manager' || type === 'president_pending') {
                    updates.evaluator_name = currentUser?.Name || '';
                    updates.evaluator_id = currentUser?.id || '';
                }

                await updateDoc(docRef, updates);
                
                // メモリ上のデータを即時更新
                selectedEvalDetail.status = nextStatus;
                if (type === 'primary' || isPrimarySub) selectedEvalDetail.is_primary_submitted = true;
                if (type === 'manager') selectedEvalDetail.is_manager_submitted = true;
                
                const idx = activeEvaluations.findIndex(e => e.id === selectedEvalDetail.id);
                if (idx !== -1) {
                    activeEvaluations[idx] = { ...activeEvaluations[idx], ...updates };
                }

                if (mode === 'interview' && window.backToInterviewList) window.backToInterviewList();
                else if (window.backToSubordinateList) window.backToSubordinateList();
                
                let successMsg = '処理が完了しました。';
                if (type === 'primary') {
                    successMsg = '1次評価の提出が完了しました。店長から面談日についての連絡が来るまでお待ちください。（面談には同席していただきます）';
                } else if (type === 'manager') {
                    successMsg = '最終評価の提出が完了しました。部下および副店長（対象の場合）と連絡を取り、面談日程の調整を行ってください。';
                } else if (type === 'president_pending') {
                    successMsg = '社長への最終提出が完了しました！';
                }
                
                // リロードせずにUIを即時反映
                renderActiveTabContent();

                showAlert('完了', successMsg);
                
                if (window.mobileEditingEval && typeof window.closeMobileInputView === 'function') {
                    window.closeMobileInputView();
                }
            } catch(e) {
                console.error(e);
                showAlert('エラー', `送信処理に失敗しました。<br><br><span style="font-size:0.8rem;color:#ef4444;word-break:break-all;">【システムエラー詳細】<br>${e.message || e.toString()}</span>`);
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

function getStatusJpName(status, evalData = null) {
    let hasPrimary = true;
    if (evalData && evalData.workflow) {
        hasPrimary = !!evalData.workflow.primary_evaluator;
    }

    if (!hasPrimary) {
        if (status === 'self_submitted' || status === 'primary_submitted') return '上長評価待ち';
        if (status === 'primary_evaluating' || status === 'manager_evaluating') return '上長評価中';
    }

    const map = {
        'not_started': '未開始',
        'evaluating': '評価入力中',
        'self_evaluating': '自己評価中',
        'self_submitted': '自己評価提出済',
        'primary_evaluating': '1次評価中',
        'primary_submitted': '1次評価完了',
        'manager_evaluating': '最終評価中',
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
        const [snap, quizSnap] = await Promise.all([
            getDocs(collection(db, "m_evaluation_templates")),
            getDocs(collection(db, "m_quiz_banks"))
        ]);
        
        editTemplates = {};
        snap.forEach(d => {
            editTemplates[d.id] = { id: d.id, ...d.data() };
        });
        
        window.availableQuizzes = {};
        quizSnap.forEach(d => {
            window.availableQuizzes[d.id] = d.data();
        });
    } catch (e) {
        console.error("Failed to load templates or quizzes for editor:", e);
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
    
    // ステータス（運用中を上）の優先ソート、同じ場合は表示名称でソート
    templates.sort((a, b) => {
        const isAArchived = a.status === 'archived';
        const isBArchived = b.status === 'archived';
        if (isAArchived !== isBArchived) {
            return isAArchived ? 1 : -1;
        }
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
        let jobTitlesHtml = '<span style="color:#94a3b8; font-size:0.75rem;">未設定</span>';
        if (t.target_job_titles && t.target_job_titles.length > 0) {
            jobTitlesHtml = '<div style="display: flex; gap: 0.3rem; flex-wrap: wrap;">' + 
                t.target_job_titles.map(jt => `<span style="background: #e0e7ff; color: #3730a3; font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700;">${jt}</span>`).join('') +
                '</div>';
        }

        tr.innerHTML = `
            <td style="padding: 1rem; font-weight: 700; color: #1e293b;">
                ${t.template_name || t.id}
            </td>
            <td style="padding: 1rem;">
                ${jobTitlesHtml}
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
    
    // 一覧画面に戻る際に最新の状態（設定した役職など）を再描画する
    window.renderTemplateList();
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
    
    const specialNoteEl = document.getElementById('editor-special-note');
    if (specialNoteEl) {
        specialNoteEl.value = template.special_note || '';
    }
    
    renderTemplateItems();
}

window.draggedTemplateItemIndex = null;
window.onTemplateItemDragStart = (e, index) => {
    window.draggedTemplateItemIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
};
window.onTemplateItemDragEnd = (e) => {
    e.target.style.opacity = '1';
    window.draggedTemplateItemIndex = null;
    
    // Remove drag-over styles from all rows
    const tbody = document.getElementById('template-items-tbody');
    if (tbody) {
        Array.from(tbody.children).forEach(tr => tr.style.borderTop = '');
    }
};
window.onTemplateItemDragOver = (e, tr) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    tr.style.borderTop = '2px solid #3b82f6';
};
window.onTemplateItemDragLeave = (e, tr) => {
    tr.style.borderTop = '';
};
window.onTemplateItemDrop = (e, targetIndex) => {
    e.preventDefault();
    if (window.draggedTemplateItemIndex === null || window.draggedTemplateItemIndex === targetIndex) return;
    
    const item = activeEditItems.splice(window.draggedTemplateItemIndex, 1)[0];
    activeEditItems.splice(targetIndex, 0, item);
    
    activeEditItems.forEach((it, idx) => {
        it.display_order = idx + 1;
    });
    
    renderTemplateItems();
    
    const totalCountEl = document.getElementById('template-total-items-count');
    if (totalCountEl) totalCountEl.textContent = activeEditItems.length;
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
        tr.style.transition = 'all 0.2s';
        
        // Drag and Drop settings
        tr.draggable = true;
        tr.style.cursor = 'grab';
        tr.ondragstart = (e) => window.onTemplateItemDragStart(e, index);
        tr.ondragend = (e) => window.onTemplateItemDragEnd(e);
        tr.ondragover = (e) => window.onTemplateItemDragOver(e, tr);
        tr.ondragleave = (e) => window.onTemplateItemDragLeave(e, tr);
        tr.ondrop = (e) => window.onTemplateItemDrop(e, index);
        
        tr.innerHTML = `
            <!-- 項目定義とテスト (カテゴリ / テスト / 評価項目 / ID) -->
            <td style="padding: 1rem 0.6rem 1rem 1rem; vertical-align: top; width: 45%;">
                <div style="display: flex; gap: 0.8rem; margin-bottom: 0.8rem;">
                    <!-- カテゴリ -->
                    <div style="flex: 1;">
                        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.2rem; font-weight: 700;">カテゴリ</div>
                        <textarea rows="1" placeholder="例: ビジネスマナー"
                                  oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'category', this.value)"
                                  style="width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.8rem; resize: none; overflow: hidden; display: block; min-height: 32px; background: #f8fafc;">${item.category || ''}</textarea>
                    </div>
                    <!-- テスト -->
                    <div style="flex: 1;">
                        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.2rem; font-weight: 700;">テスト</div>
                        <select onchange="window.updateTemplateItemField(${index}, 'quiz_bank_id', this.value)" 
                                style="width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.8rem; background: #f8fafc; min-height: 32px; height: 32px; cursor: pointer;">
                            <option value="">(紐付けなし)</option>
                            ${Object.keys(window.availableQuizzes || {}).map(qId => {
                                const q = window.availableQuizzes[qId];
                                return `<option value="${qId}" ${item.quiz_bank_id === qId ? 'selected' : ''}>${q.title || qId}</option>`;
                            }).join('')}
                        </select>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.2rem;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">評価項目</div>
                    <div style="font-size: 0.65rem; color: #94a3b8; font-family: monospace;" title="システムID (編集不可)">ID: ${item.item_id || '---'}</div>
                </div>
                <textarea rows="1" placeholder="評価項目の内容を入力"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'title', this.value)"
                          style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.9rem; resize: none; overflow: hidden; display: block; min-height: 40px;">${item.title || ''}</textarea>
            </td>
            <!-- 評価基準 (詳細説明) -->
            <td style="padding: 1rem 0.6rem; vertical-align: top; width: 55%;">
                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.2rem; font-weight: 700;">詳細説明（評価のポイント）</div>
                <textarea rows="1" placeholder="具体的な評価基準を記載"
                          oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; window.updateTemplateItemField(${index}, 'description', this.value)"
                          style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.85rem; resize: none; overflow: hidden; display: block; min-height: 120px; line-height: 1.5;">${item.description || ''}</textarea>
            </td>
            <!-- 操作 (並び替え / 削除) -->
            <td style="padding: 1rem 0.4rem; vertical-align: top; text-align: center;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.8rem;">
                    <div style="color: #94a3b8; padding: 0.4rem; cursor: grab;" title="ドラッグして並び替え">
                        <i class="fas fa-grip-vertical" style="font-size: 1.2rem;"></i>
                    </div>
                    <button type="button" class="btn" onclick="window.deleteTemplateItem(${index})" 
                            style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 0.4rem; border-radius: 50%; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s;"
                            onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'" title="この項目を削除">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    setTimeout(() => {
        const textareas = tbody.querySelectorAll('textarea');
        textareas.forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
    }, 10);
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
        const editorView = document.getElementById('template-view-editor');
        if (editorView && editorView.style.display !== 'none') {
            window.backToTemplateList();
            return;
        }

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

// ==========================================
// 評価ルート（ワークフロー）設定
// ==========================================
window.openWorkflowEditorModal = async () => {
    const container = document.getElementById('workflow-editor-container');
    if (!container) return;
    
    // 他のエリアを隠す
    document.getElementById('eval-main-content').style.display = 'none';
    document.getElementById('eval-period-banner').style.display = 'none';
    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) tabsContainer.style.display = 'none';
    
    container.style.display = 'block';
    
    await window.renderWorkflowSettings();
};

window.closeWorkflowEditor = () => {
    const container = document.getElementById('workflow-editor-container');
    if (container) {
        container.style.display = 'none';
        
        // メインエリアを再表示
        document.getElementById('eval-main-content').style.display = 'block';
        document.getElementById('eval-period-banner').style.display = 'flex';
        const tabsContainer = document.querySelector('.tabs-container');
        if (tabsContainer) tabsContainer.style.display = 'flex';
    }
};

window.renderWorkflowSettings = async () => {
    const listContainer = document.getElementById('workflow-list-container');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin fa-2x"></i><br>読み込み中...</div>';

    try {
        // 等級マスタの読み込み
        const gradesSnap = await getDocs(collection(db, "m_grades"));
        let localGradesForWorkflow = [];
        gradesSnap.forEach(doc => {
            const data = doc.data();
            if (data.job_title) {
                // 重複排除（同じ役職名が複数等級にある場合を考慮）
                if (!localGradesForWorkflow.find(g => g.job_title === data.job_title)) {
                    localGradesForWorkflow.push({ id: doc.id, job_title: data.job_title, display_order: data.display_order || 999 });
                }
            }
        });
        localGradesForWorkflow.sort((a, b) => a.display_order - b.display_order);

        // ルート設定の読み込み
        const routesSnap = await getDocs(collection(db, "m_evaluation_routes"));
        let localWorkflowSettings = {};
        routesSnap.forEach(doc => {
            localWorkflowSettings[doc.id] = doc.data();
        });

        // 役職の選択肢HTMLを生成
        const roleOptions = `<option value="">-- スキップ (なし) --</option>` + 
            localGradesForWorkflow.map(g => `<option value="${g.job_title}">${g.job_title}</option>`).join('');

        let html = '';
        localGradesForWorkflow.forEach(grade => {
            const targetJob = grade.job_title;
            const currentSetting = localWorkflowSettings[targetJob] || { primary_evaluator: '', secondary_evaluator: '店長' };
            
            html += `
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.2rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="width: 25%; font-weight: 800; color: #1e293b; font-size: 1.05rem;">
                        <i class="fas fa-user-tag" style="color: #64748b; margin-right: 0.5rem;"></i>${targetJob}
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 0.8rem; flex: 1;">
                        <!-- 本人 -->
                        <div style="background: #f8fafc; padding: 0.6rem 1rem; border-radius: 6px; border: 1px dashed #cbd5e1; font-size: 0.85rem; font-weight: 700; color: #64748b; text-align: center;">
                            本人<br><span style="font-size:0.7rem;">(自己評価)</span>
                        </div>
                        
                        <i class="fas fa-arrow-right" style="color: #cbd5e1;"></i>
                        
                        <!-- 1次評価 -->
                        <div style="flex: 1;">
                            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; margin-bottom: 0.3rem;">1次評価者 (任意)</div>
                            <select class="workflow-primary-select" data-job="${targetJob}" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: #1e293b;">
                                ${roleOptions.replace(`value="${currentSetting.primary_evaluator}"`, `value="${currentSetting.primary_evaluator}" selected`)}
                            </select>
                        </div>
                        
                        <i class="fas fa-arrow-right" style="color: #cbd5e1;"></i>
                        
                        <!-- 2次評価 -->
                        <div style="flex: 1;">
                            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; margin-bottom: 0.3rem;">最終評価者 (面談担当)</div>
                            <select class="workflow-secondary-select" data-job="${targetJob}" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: #1e293b; background: #eff6ff; border-color: #bfdbfe;">
                                ${roleOptions.replace(`value="${currentSetting.secondary_evaluator || '店長'}"`, `value="${currentSetting.secondary_evaluator || '店長'}" selected`)}
                            </select>
                        </div>
                    </div>
                </div>
            `;
        });
        
        listContainer.innerHTML = html;
        
    } catch (error) {
        console.error("Error loading workflow settings:", error);
        listContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--danger); font-weight: bold;">設定の読み込みに失敗しました。</div>';
    }
};

window.saveWorkflowSettings = async () => {
    const btn = document.querySelector('#workflow-editor-container .btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        
        const primarySelects = document.querySelectorAll('.workflow-primary-select');
        const secondarySelects = document.querySelectorAll('.workflow-secondary-select');
        
        for (let i = 0; i < primarySelects.length; i++) {
            const targetJob = primarySelects[i].getAttribute('data-job');
            const primary = primarySelects[i].value;
            const secondary = secondarySelects[i].value;
            
            const docRef = doc(db, "m_evaluation_routes", targetJob);
            batch.set(docRef, {
                target_job: targetJob,
                primary_evaluator: primary,
                secondary_evaluator: secondary,
                updated_at: new Date().toISOString()
            }, { merge: true });
        }
        
        await batch.commit();
        showAlert('保存完了', '評価ルート（ワークフロー）の設定を保存しました。次回開始される評価から適用されます。');
        window.closeWorkflowEditor();
        
    } catch (error) {
        console.error("Error saving workflow settings:", error);
        showAlert('エラー', '設定の保存に失敗しました。');
    } finally {
        if(btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

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
        
        const specialNoteEl = document.getElementById('editor-special-note');
        const specialNote = specialNoteEl ? specialNoteEl.value.trim() : '';
        
        await setDoc(docRef, {
            template_name: templateName,
            target_job_titles: targetJobTitles,
            special_note: specialNote,
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
                    display_order: parseInt(item.display_order) || (idx + 1),
                    quiz_bank_id: item.quiz_bank_id || null
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
    let modal = document.getElementById('eval-history-modal-dynamic');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'eval-history-modal-dynamic';
        modal.style.display = 'none';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(15, 23, 42, 0.4)';
        modal.style.zIndex = '999999';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.padding = '1rem';
        modal.style.boxSizing = 'border-box';
        
        modal.innerHTML = `
            <div class="glass-panel" style="background: white; width: 100%; max-width: 800px; max-height: 90vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.6rem;">
                        <i class="fas fa-history" style="color: var(--primary);"></i> 過去の評価履歴
                    </h3>
                    <button type="button" onclick="document.getElementById('eval-history-modal-dynamic').style.display='none';" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 1.5rem 1.8rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;" id="history-content-area-dynamic">
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const content = document.getElementById('history-content-area-dynamic');
    
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
            content.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-secondary); font-weight:700;"><i class="fas fa-info-circle fa-2x" style="margin-bottom: 1rem; color: #cbd5e1;"></i><br>確定済みの評価履歴がありません。<br><span style="font-size: 0.8rem; font-weight: 500;">※現在進行中、または途中で保存されただけの評価データはここには表示されません。</span></div>';
            return;
        }
        
        let html = `
            <h4 style="margin:0 0 1rem; color:#1e293b;"><i class="fas fa-user-circle" style="color:var(--primary); margin-right:0.4rem;"></i>${userName} さんの評価履歴</h4>
            <div style="overflow-x:auto;">
                <table class="eval-table">
                    <thead>
                        <tr>
                            <th style="text-align:left;">対象期</th>
                            
                            <th style="text-align:center;">確定点数</th>
                            <th style="text-align:center;">等級判定</th>
                            <th style="text-align:right;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        histories.forEach(h => {
                        const score = h.final_total_score || h.manager_total_score || h.self_total_score || '-';
            
            html += `
                <tr style="background:white; border-bottom:1px solid #e2e8f0;">
                    <td style="font-weight:800; color:#1e293b;">${h.period}期</td>
                    
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

    let detailModal = document.getElementById('eval-history-detail-modal-dynamic');
    if (!detailModal) {
        detailModal = document.createElement('div');
        detailModal.id = 'eval-history-detail-modal-dynamic';
        detailModal.style.display = 'none';
        detailModal.style.position = 'fixed';
        detailModal.style.inset = '0';
        detailModal.style.background = 'rgba(15, 23, 42, 0.4)';
        detailModal.style.zIndex = '9999999'; // Higher than history modal
        detailModal.style.alignItems = 'center';
        detailModal.style.justifyContent = 'center';
        detailModal.style.backdropFilter = 'blur(4px)';
        detailModal.style.padding = '1rem';
        detailModal.style.boxSizing = 'border-box';
        
        detailModal.innerHTML = `
            <div class="glass-panel" style="background: white; width: 100%; max-width: 900px; max-height: 95vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3);">
                <div style="padding: 1.2rem 1.8rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                    <h3 id="history-detail-title-dynamic" style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 0.6rem;">
                        評価詳細
                    </h3>
                    <button type="button" onclick="document.getElementById('eval-history-detail-modal-dynamic').style.display='none';" style="background: transparent; border: none; font-size: 1.4rem; cursor: pointer; color: #94a3b8; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 1.5rem 1.8rem; overflow-y: auto; flex-grow: 1; background: #f8fafc;">
                    <table class="eval-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 50%;">評価項目</th>
                                <th style="width: 15%; text-align: center;">確定点</th>
                                <th style="width: 35%;">コメント</th>
                            </tr>
                        </thead>
                        <tbody id="history-detail-body-dynamic">
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.body.appendChild(detailModal);
    }
    
    document.getElementById('history-detail-title-dynamic').innerHTML = `<i class="fas fa-file-alt" style="color:var(--primary);"></i> ${h.period}期 ${h.user_name} さんの評価詳細`;
    
    let itemsHtml = '';
    const snapshotItems = h.template_snapshot || h.items || [];
    const evalData = h.eval_data || {};
    
    snapshotItems.forEach(item => {
        const scoreData = evalData[item.item_id] || {};
        const managerScore = item.manager_score ?? scoreData.manager_score ?? scoreData.score ?? '-';
        
        let reviewBtn = '';
        if (item.quiz_data && item.quiz_data.completed) {
            const wrongCount = item.quiz_data.questions ? item.quiz_data.questions.filter(q => q.user_answer !== q.correct_index).length : 0;
            if (wrongCount === 0) {
                reviewBtn = `<div style="font-size: 0.65rem; color: #10b981; margin-top: 0.4rem; font-weight: 700;">全問正解！</div>`;
            } else {
                const quizDataStr = encodeURIComponent(JSON.stringify(item.quiz_data));
                reviewBtn = `<div style="margin-top: 0.4rem;"><button type="button" onclick="window.openQuizReviewModal(decodeURIComponent('${quizDataStr}'))" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; font-weight: 700; background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; border-radius: 4px; cursor: pointer; transition: 0.2s;"><i class="fas fa-search"></i> 誤答を復習</button></div>`;
            }
        }

        itemsHtml += `
            <tr style="background:white; border-bottom:1px solid #e2e8f0;">
                <td style="padding: 0.8rem; font-size:0.85rem;">
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:0.2rem; font-weight:700;">${item.category}</div>
                    <div style="font-weight:800; color:#1e293b;">${item.title}</div>
                    ${scoreData.legacy_memo ? `<div style="font-size:0.75rem; color:#d97706; margin-top:0.4rem; background:#fffbeb; padding:0.5rem; border-radius:6px; border:1px solid #fde68a;"><i class="fas fa-info-circle"></i> <b>当時のメモ:</b> ${scoreData.legacy_memo}</div>` : ''}
                </td>
                <td style="padding: 0.8rem; text-align:center; font-weight:900; color:#7c3aed; font-size:1.2rem;">
                    ${managerScore}
                    ${reviewBtn}
                </td>
                <td style="padding: 0.8rem; font-size:0.85rem; color:#475569;">
                    ${scoreData.manager_comment || item.manager_comment || scoreData.comment || '-'}
                </td>
            </tr>
        `;
    });
    
    if (snapshotItems.length === 0) {
        itemsHtml = '<tr><td colspan="3" style="text-align:center; padding:2rem; color:#94a3b8;">詳細データがありません</td></tr>';
    }
    
    document.getElementById('history-detail-body-dynamic').innerHTML = itemsHtml;
    detailModal.style.display = 'flex';
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

// ==========================================
// 9. テスト(試験)マスタ管理機能
// ==========================================
let editQuizzes = {};
let activeEditQuizId = '';
let activeQuizQuestions = [];

window.openQuizEditorModal = async () => {
    // メインコンテンツを非表示にする
    document.getElementById('eval-main-content').style.display = 'none';
    document.getElementById('eval-period-banner').style.display = 'none';
    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) tabsContainer.style.display = 'none';

    document.getElementById('quiz-editor-container').style.display = 'block';
    document.getElementById('quiz-view-list').style.display = 'block';
    document.getElementById('quiz-view-editor').style.display = 'none';
    document.getElementById('quiz-view-editor-footer').style.display = 'none';
    await window.loadQuizList();
};

window.closeQuizEditorModal = () => {
    document.getElementById('quiz-editor-container').style.display = 'none';
    document.getElementById('eval-main-content').style.display = 'block';
    document.getElementById('eval-period-banner').style.display = 'flex';
    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) tabsContainer.style.display = 'flex';
};

window.loadQuizList = async () => {
    try {
        const snap = await getDocs(collection(db, "m_quiz_banks"));
        editQuizzes = {};
        const listContainer = document.getElementById('quiz-list-container');
        listContainer.innerHTML = '';
        if(snap.empty) {
            listContainer.innerHTML = '<div style="color:#64748b;">作成済みのテストはありません。</div>';
            return;
        }
        
        let html = '';
        snap.forEach(d => {
            const data = d.data();
            editQuizzes[d.id] = { id: d.id, ...data };
            const qCount = data.questions ? data.questions.length : 0;
            
            let drawnCount = 0;
            if (data.settings) {
                drawnCount = (parseInt(data.settings.mandatory?.count) || 0) +
                             (parseInt(data.settings.hard?.count) || 0) +
                             (parseInt(data.settings.general?.count) || 0);
            } else {
                drawnCount = data.questions_count || 10;
            }
            
            html += `
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div>
                        <h5 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #1e293b;">${data.title || d.id}</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: #64748b;">問題プール数: ${qCount}問 / 出題数: ${drawnCount}問</p>
                        <p style="margin: 0; font-size: 0.8rem; color: #64748b;">合格基準: ${data.pass_score || 80}点</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" onclick="window.openQuizDetail('${d.id}')" style="flex: 1; padding: 0.5rem; background: #f1f5f9; color: #475569; border: none; border-radius: 6px; font-weight: 700; font-size: 0.85rem;"><i class="fas fa-edit"></i> 編集</button>
                        <button class="btn" onclick="window.deleteQuiz('${d.id}')" style="padding: 0.5rem; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 6px; font-weight: 700;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = html;
    } catch(e) {
        console.error(e);
        showAlert("エラー", "テスト一覧の取得に失敗しました。");
    }
};

window.createNewQuiz = async () => {
    const title = prompt("新しいテストのタイトルを入力してください");
    if(!title || !title.trim()) return;
    
    const newId = 'quiz_' + Date.now();
    const newData = {
        title: title.trim(),
        settings: {
            mandatory: { count: 0, points: 3 },
            hard: { count: 0, points: 5 },
            general: { count: 10, points: 1 }
        },
        pass_score: 80,
        questions: [],
        created_at: new Date().toISOString()
    };
    
    try {
        await setDoc(doc(db, "m_quiz_banks", newId), newData);
        await window.loadQuizList();
    } catch(e) {
        console.error(e);
        showAlert("エラー", "テストの作成に失敗しました。");
    }
};

window.deleteQuiz = async (id) => {
    const confirmDelete = await showConfirm("削除確認", "このテストを削除しますか？");
    if(confirmDelete) {
        try {
            await deleteDoc(doc(db, "m_quiz_banks", id));
            await window.loadQuizList();
        } catch(e) {
            console.error(e);
            showAlert("エラー", "テストの削除に失敗しました。");
        }
    }
};

window.openQuizDetail = (id) => {
    activeEditQuizId = id;
    const quiz = editQuizzes[id];
    document.getElementById('editor-current-quiz-name').textContent = quiz.title || id;
    
    const settings = quiz.settings || {
        mandatory: { count: 0, points: 3 },
        hard: { count: 0, points: 5 },
        general: { count: quiz.questions_count || 10, points: 1 }
    };
    
    document.getElementById('quiz-editor-count-mandatory').value = settings.mandatory.count;
    document.getElementById('quiz-editor-points-mandatory').value = settings.mandatory.points;
    document.getElementById('quiz-editor-threshold-mandatory').value = settings.mandatory.pass_score != null ? settings.mandatory.pass_score : (quiz.threshold_mandatory != null && quiz.threshold_mandatory > 0 ? quiz.threshold_mandatory : '');
    
    document.getElementById('quiz-editor-count-hard').value = settings.hard.count;
    document.getElementById('quiz-editor-points-hard').value = settings.hard.points;
    document.getElementById('quiz-editor-threshold-hard').value = settings.hard.pass_score != null ? settings.hard.pass_score : '';
    
    document.getElementById('quiz-editor-count-general').value = settings.general.count;
    document.getElementById('quiz-editor-points-general').value = settings.general.points;
    document.getElementById('quiz-editor-threshold-general').value = settings.general.pass_score != null ? settings.general.pass_score : '';
    
    document.getElementById('quiz-editor-threshold-eval3').value = quiz.threshold_eval3 !== undefined ? quiz.threshold_eval3 : (quiz.pass_score || 80);
    document.getElementById('quiz-editor-threshold-eval2').value = quiz.threshold_eval2 !== undefined ? quiz.threshold_eval2 : Math.floor((quiz.pass_score || 80) / 2);
    
    const prefaceEl = document.getElementById('quiz-editor-preface');
    if (prefaceEl) prefaceEl.value = quiz.preface || '';
    
    activeQuizQuestions = JSON.parse(JSON.stringify(quiz.questions || []));
    
    window.updateQuizMaxScore = () => {
        const cm = parseInt(document.getElementById('quiz-editor-count-mandatory').value) || 0;
        const pm = parseInt(document.getElementById('quiz-editor-points-mandatory').value) || 0;
        const ch = parseInt(document.getElementById('quiz-editor-count-hard').value) || 0;
        const ph = parseInt(document.getElementById('quiz-editor-points-hard').value) || 0;
        const cg = parseInt(document.getElementById('quiz-editor-count-general').value) || 0;
        const pg = parseInt(document.getElementById('quiz-editor-points-general').value) || 0;
        
        document.getElementById('quiz-editor-max-mandatory').textContent = cm * pm;
        document.getElementById('quiz-editor-max-hard').textContent = ch * ph;
        document.getElementById('quiz-editor-max-general').textContent = cg * pg;
        document.getElementById('quiz-editor-max-total').textContent = (cm * pm) + (ch * ph) + (cg * pg);
        
        const summaryMandatoryEl = document.getElementById('quiz-editor-max-mandatory-summary');
        if (summaryMandatoryEl) summaryMandatoryEl.textContent = cm * pm;
        
        // Trigger validation warning update
        window.renderQuizQuestions();
    };
    
    window.updateQuizMaxScore();
    
    document.getElementById('quiz-view-list').style.display = 'none';
    document.getElementById('quiz-view-editor').style.display = 'flex';
    document.getElementById('quiz-view-editor-footer').style.display = 'flex';
    
    // Auto-resize preface field now that it's visible
    if (prefaceEl) {
        prefaceEl.style.height = 'auto';
        prefaceEl.style.height = prefaceEl.scrollHeight + 'px';
    }
};

let currentQuizFilter = 'all';

window.setQuizFilter = (filterType) => {
    currentQuizFilter = filterType;
    window.renderQuizQuestions();
};

window.backToQuizList = () => {
    document.getElementById('quiz-view-editor').style.display = 'none';
    document.getElementById('quiz-view-editor-footer').style.display = 'none';
    document.getElementById('quiz-view-list').style.display = 'block';
    window.loadQuizList();
};

window.renderQuizQuestions = () => {
    const container = document.getElementById('quiz-questions-container');
    
    // バリデーション警告の制御
    const countMandatory = parseInt(document.getElementById('quiz-editor-count-mandatory')?.value) || 0;
    const countHard = parseInt(document.getElementById('quiz-editor-count-hard')?.value) || 0;
    const countGeneral = parseInt(document.getElementById('quiz-editor-count-general')?.value) || 0;
    
    const actualMandatory = activeQuizQuestions.filter(q => q.type === 'mandatory').length;
    const actualHard = activeQuizQuestions.filter(q => q.type === 'hard').length;
    const actualGeneral = activeQuizQuestions.filter(q => q.type === 'general' || !q.type).length;
    
    const totalCountEl = document.getElementById('quiz-total-questions-count');
    if (totalCountEl) {
        if (currentQuizFilter === 'mandatory') totalCountEl.textContent = actualMandatory;
        else if (currentQuizFilter === 'hard') totalCountEl.textContent = actualHard;
        else if (currentQuizFilter === 'general') totalCountEl.textContent = actualGeneral;
        else totalCountEl.textContent = activeQuizQuestions.length;
    }
    
    const warnEl = document.getElementById('quiz-validation-warning');
    if(warnEl) {
        if(actualMandatory < countMandatory || actualHard < countHard || actualGeneral < countGeneral) {
            warnEl.style.display = 'inline-block';
            warnEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 設定した出題数に対してプール問題数が不足しているカテゴリがあります（可能な最大数で出題されます）';
        } else {
            warnEl.style.display = 'none';
        }
    }
    
    // タブの表示状態を更新
    const tabs = document.querySelectorAll('#quiz-filter-tabs button');
    tabs.forEach(tab => {
        if (tab.dataset.filter === currentQuizFilter) {
            tab.style.background = 'white';
            tab.style.color = '#3b82f6';
            tab.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        } else {
            tab.style.background = 'transparent';
            tab.style.color = '#64748b';
            tab.style.boxShadow = 'none';
        }
    });
    
    if(activeQuizQuestions.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94a3b8;">問題がありません。「問題を追加する」を押してください。</div>';
        return;
    }
    
    let html = '';
    let renderedCount = 0;
    
    activeQuizQuestions.forEach((q, idx) => {
        const qType = q.type || 'general';
        if (currentQuizFilter !== 'all' && qType !== currentQuizFilter) return;
        
        renderedCount++;
        const choices = q.choices || ['', '', '', ''];
        html += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1; margin-right: 1rem;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 0.5rem; display: block;">問題 ${idx + 1} (問題文)</label>
                        <textarea rows="2" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.9rem;" onchange="window.updateQuizQuestion(${idx}, 'text', this.value)">${q.text || ''}</textarea>
                    </div>
                    <div>
                        <button class="btn" onclick="window.deleteQuizQuestion(${idx})" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 0.4rem; border-radius: 50%;"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                
                <div>
                    <label style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 0.5rem; display: block;">選択肢と正解</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        ${choices.map((c, cIdx) => `
                            <div style="display: flex; align-items: center; gap: 0.5rem; background: ${q.correct_index === cIdx ? '#ecfdf5' : '#f8fafc'}; border: 1px solid ${q.correct_index === cIdx ? '#10b981' : '#e2e8f0'}; border-radius: 6px; padding: 0.5rem;">
                                <input type="radio" name="correct_${idx}" ${q.correct_index === cIdx ? 'checked' : ''} onchange="window.updateQuizQuestion(${idx}, 'correct_index', ${cIdx})" style="cursor: pointer; accent-color: #10b981;">
                                <input type="text" value="${c}" placeholder="選択肢 ${cIdx + 1}" onchange="window.updateQuizQuestionChoice(${idx}, ${cIdx}, this.value)" style="flex: 1; border: none; background: transparent; outline: none; font-size: 0.9rem;">
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div>
                    <label style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 0.5rem; display: block;">問題の特性</label>
                    <select onchange="window.updateQuizQuestion(${idx}, 'type', this.value)" style="width: 150px; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold; color: #334155;">
                        <option value="general" ${qType === 'general' ? 'selected' : ''}>一般問題</option>
                        <option value="mandatory" ${qType === 'mandatory' ? 'selected' : ''}>必須問題</option>
                        <option value="hard" ${qType === 'hard' ? 'selected' : ''}>高難易度</option>
                    </select>
                </div>
                
                <div style="margin-top: 0.5rem;">
                    <label style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 0.5rem; display: block;">解説 (任意)</label>
                    <textarea rows="2" placeholder="問題の解説を入力してください" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 0.9rem;" onchange="window.updateQuizQuestion(${idx}, 'explanation', this.value)">${q.explanation || ''}</textarea>
                </div>
            </div>
        `;
    });
    
    if(renderedCount === 0) {
        html = '<div style="text-align:center; padding: 2rem; color: #94a3b8;">この特性に該当する問題はありません。</div>';
    }
    
    container.innerHTML = html;
};

window.addQuizQuestion = () => {
    currentQuizFilter = 'all';
    activeQuizQuestions.push({
        id: 'q_' + Date.now(),
        text: '',
        explanation: '',
        choices: ['', '', '', ''],
        correct_index: 0,
        type: 'general'
    });
    window.renderQuizQuestions();
    
    setTimeout(() => {
        const container = document.getElementById('quiz-questions-container');
        if(container && container.lastElementChild) {
            container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, 100);
};

window.deleteQuizQuestion = (idx) => {
    activeQuizQuestions.splice(idx, 1);
    window.renderQuizQuestions();
};

window.updateQuizQuestion = (idx, field, val) => {
    if(activeQuizQuestions[idx]) {
        activeQuizQuestions[idx][field] = val;
    }
    if(field === 'correct_index') {
        window.renderQuizQuestions();
    }
};

window.updateQuizQuestionChoice = (qIdx, cIdx, val) => {
    if(activeQuizQuestions[qIdx] && activeQuizQuestions[qIdx].choices) {
        activeQuizQuestions[qIdx].choices[cIdx] = val;
    }
};

// 質問数変更時にもバリデーションチェックを走らせるため
setTimeout(() => {
    document.getElementById('quiz-editor-questions-count')?.addEventListener('change', () => {
        if(activeEditQuizId) window.renderQuizQuestions();
    });
}, 1000);

window.saveActiveQuiz = async () => {
    if(!activeEditQuizId) return;
    const btnSave = document.getElementById('btn-save-quiz');
    
    const getThreshold = (id) => {
        const el = document.getElementById(id);
        if (!el || el.value === '') return null;
        return parseInt(el.value) || 0;
    };
    
    const settings = {
        mandatory: {
            count: parseInt(document.getElementById('quiz-editor-count-mandatory').value) || 0,
            points: parseInt(document.getElementById('quiz-editor-points-mandatory').value) || 0,
            pass_score: getThreshold('quiz-editor-threshold-mandatory')
        },
        hard: {
            count: parseInt(document.getElementById('quiz-editor-count-hard').value) || 0,
            points: parseInt(document.getElementById('quiz-editor-points-hard').value) || 0,
            pass_score: getThreshold('quiz-editor-threshold-hard')
        },
        general: {
            count: parseInt(document.getElementById('quiz-editor-count-general').value) || 0,
            points: parseInt(document.getElementById('quiz-editor-points-general').value) || 0,
            pass_score: getThreshold('quiz-editor-threshold-general')
        }
    };
    const thresholdEval3 = parseInt(document.getElementById('quiz-editor-threshold-eval3').value) || 0;
    const thresholdEval2 = parseInt(document.getElementById('quiz-editor-threshold-eval2').value) || 0;
    
    const hasEmpty = activeQuizQuestions.some(q => !q.text.trim() || q.choices.some(c => !c.trim()));
    if(hasEmpty) {
        return showAlert("入力エラー", "未入力の問題文や選択肢があります。すべて入力してください。");
    }
    
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    btnSave.disabled = true;
    const preface = document.getElementById('quiz-editor-preface') ? document.getElementById('quiz-editor-preface').value.trim() : '';
    
    try {
        await updateDoc(doc(db, "m_quiz_banks", activeEditQuizId), {
            settings: settings,
            threshold_eval3: thresholdEval3,
            threshold_eval2: thresholdEval2,
            preface: preface,
            questions: activeQuizQuestions,
            updated_at: new Date().toISOString()
        });
        showAlert("保存成功", "テストデータを保存しました！");
    } catch(e) {
        console.error(e);
        showAlert("エラー", "保存に失敗しました。");
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
};

window.exportQuizCSV = () => {
    if (!activeQuizQuestions || activeQuizQuestions.length === 0) {
        return showAlert("エラー", "エクスポートする問題がありません。");
    }
    
    const escapeCSV = (str) => {
        if (str == null) return '""';
        let s = String(str);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };
    
    const typeMap = { 'mandatory': '必須問題', 'hard': '高難易度', 'general': '一般問題' };
    
    // ヘッダ: 番号, 特性, 問題文, 選択肢1, 選択肢2, 選択肢3, 選択肢4, 正解番号, 解説文
    let csvContent = "\uFEFF"; // BOM for Excel
    csvContent += "番号,特性,問題文,選択肢1,選択肢2,選択肢3,選択肢4,正解番号,解説文\n";
    
    activeQuizQuestions.forEach((q, idx) => {
        const row = [
            idx + 1,
            typeMap[q.type || 'general'] || '一般問題',
            escapeCSV(q.text || ''),
            escapeCSV(q.choices[0] || ''),
            escapeCSV(q.choices[1] || ''),
            escapeCSV(q.choices[2] || ''),
            escapeCSV(q.choices[3] || ''),
            q.correct_index !== undefined ? q.correct_index + 1 : 1,
            escapeCSV(q.explanation || '')
        ];
        csvContent += row.join(",") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = document.getElementById('editor-current-quiz-name').textContent || 'quiz';
    a.download = `${filename}_問題データ.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.importQuizCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        
        const parseCSV = (str) => {
            const result = [];
            let row = [];
            let inQuotes = false;
            let val = '';
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                const nextChar = str[i+1];
                
                if (inQuotes) {
                    if (char === '"' && nextChar === '"') {
                        val += '"';
                        i++; 
                    } else if (char === '"') {
                        inQuotes = false;
                    } else {
                        val += char;
                    }
                } else {
                    if (char === '"') {
                        inQuotes = true;
                    } else if (char === ',') {
                        row.push(val);
                        val = '';
                    } else if (char === '\n' || char === '\r') {
                        if (char === '\r' && nextChar === '\n') i++;
                        row.push(val);
                        result.push(row);
                        row = [];
                        val = '';
                    } else {
                        val += char;
                    }
                }
            }
            if (val !== '' || row.length > 0) {
                row.push(val);
                result.push(row);
            }
            return result;
        };
        
        try {
            let rows = parseCSV(text);
            if (rows.length > 0 && rows[0].length > 0 && rows[0][0].charCodeAt(0) === 0xFEFF) {
                rows[0][0] = rows[0][0].substring(1);
            }
            
            if (rows.length < 2) {
                event.target.value = '';
                return showAlert("エラー", "CSVに有効なデータが含まれていません。");
            }
            
            const newQuestions = [];
            const reverseTypeMap = { '必須問題': 'mandatory', '高難易度': 'hard', '一般問題': 'general', '必須': 'mandatory', '一般': 'general' };
            
            for (let i = 1; i < rows.length; i++) {
                const r = rows[i];
                if (r.length < 2 || (r.length === 1 && !r[0].trim())) continue;
                
                const typeStr = (r[1] || '').trim();
                const qType = reverseTypeMap[typeStr] || 'general';
                const qText = (r[2] || '').trim();
                const choices = [
                    (r[3] || '').trim(),
                    (r[4] || '').trim(),
                    (r[5] || '').trim(),
                    (r[6] || '').trim()
                ];
                while(choices.length < 4) choices.push('');
                
                let correctIndex = parseInt(r[7]) - 1;
                if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
                    correctIndex = 0;
                }
                
                const explanation = (r[8] || '').trim();
                
                if (!qText) continue; 
                
                newQuestions.push({
                    id: 'q_' + Date.now() + '_' + Math.floor(Math.random()*1000) + '_' + i,
                    type: qType,
                    text: qText,
                    choices: choices,
                    correct_index: correctIndex,
                    explanation: explanation
                });
            }
            
            if (newQuestions.length === 0) {
                event.target.value = '';
                return showAlert("エラー", "読み込める問題データがありませんでした。");
            }
            
            activeQuizQuestions = newQuestions;
            window.setQuizFilter('all'); 
            window.updateQuizMaxScore();
            
            showAlert("インポート完了", `${newQuestions.length}問の問題データをインポートしました。\n（※必ず「テストを保存する」ボタンを押して確定してください）`);
            
        } catch (err) {
            console.error(err);
            showAlert("エラー", "CSVの読み込み中にエラーが発生しました。");
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
};

// ==========================================
// 10. テスト実施（受験）機能
// ==========================================
let currentQuizIdx = -1;

window.startEvaluationQuiz = (idx) => {
    if (window.mobileEditingEval) {
        selectedEvalDetail = window.mobileEditingEval;
    }
    const item = selectedEvalDetail.items[idx];
    if (!item || !item.quiz_data) return;
    
    currentQuizIdx = idx;
    const qData = item.quiz_data;
    
    document.getElementById('quiz-execution-title').textContent = qData.quiz_title || 'テスト';
    
    const container = document.getElementById('quiz-execution-content');
    let html = '';
    
    const hasPreface = qData.preface && qData.preface.trim() !== '';
    if (hasPreface) {
        html += `
            <div id="quiz-preface-section" style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
                <h4 style="margin: 0 0 1rem 0; color: #b45309; font-size: 1.1rem;"><i class="fas fa-info-circle"></i> テストの意義（必ずお読みください）</h4>
                <div style="font-size: 0.95rem; color: #334155; line-height: 1.6; white-space: pre-wrap; margin-bottom: 1.5rem;">${qData.preface}</div>
                
                <label style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: white; border: 2px solid #fbbf24; border-radius: 8px; cursor: pointer;">
                    <input type="checkbox" id="quiz-preface-agree" onchange="window.toggleQuizQuestionsVisibility(this.checked)" style="width: 1.5rem; height: 1.5rem; accent-color: #d97706;">
                    <span style="font-weight: 800; color: #b45309; font-size: 1rem;">内容を理解してテストを開始する</span>
                </label>
            </div>
        `;
    }
    
    html += `<div id="quiz-questions-section" style="display: ${hasPreface ? 'none' : 'block'};">`;
    
    const th_eval3 = qData.threshold_eval3 !== undefined ? qData.threshold_eval3 : (qData.pass_score || 80);
    let passText = `合計 ${th_eval3}点以上`;
    
    const settings = qData.settings || {};
    const th_mand = (settings.mandatory && settings.mandatory.pass_score != null) ? settings.mandatory.pass_score : (qData.threshold_mandatory || 0);
    const th_hard = (settings.hard && settings.hard.pass_score != null) ? settings.hard.pass_score : 0;
    const th_gen = (settings.general && settings.general.pass_score != null) ? settings.general.pass_score : 0;
    
    let subReqs = [];
    if (th_mand > 0) subReqs.push(`必須問題${th_mand}点以上`);
    if (th_hard > 0) subReqs.push(`高難易度${th_hard}点以上`);
    if (th_gen > 0) subReqs.push(`一般問題${th_gen}点以上`);
    
    if (subReqs.length > 0) {
        passText += `（かつ ${subReqs.join('、')}）`;
    }
    
    html += `<div style="margin-bottom: 1rem; color: #475569; font-size: 0.9rem; font-weight: bold;">
        全 ${qData.questions.length} 問 / 合格基準: ${passText}
    </div>`;
    
    qData.questions.forEach((q, qIdx) => {
        html += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.5rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 1rem 0; color: #1e293b; font-size: 1rem; line-height: 1.4;">問${qIdx + 1}. ${q.text} <span style="font-size:0.8rem; color:#94a3b8; font-weight:normal;">(${q.points}点)</span></h4>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        `;
        q.choices.forEach((choice, cIdx) => {
            html += `
                    <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <input type="radio" name="quiz_ans_${qIdx}" value="${cIdx}" onchange="window.selectQuizAnswer(${qIdx}, ${cIdx})" style="accent-color: #8b5cf6; width: 1.2rem; height: 1.2rem;">
                        <span style="font-size: 0.95rem; color: #334155;">${choice}</span>
                    </label>
            `;
        });
        html += `
                </div>
            </div>
        `;
    });
    
    html += `</div>`; // quiz-questions-section close
    
    container.innerHTML = html;
    const modalEl = document.getElementById('quiz-execution-modal');
    if (modalEl && modalEl.parentElement !== document.body) {
        document.body.appendChild(modalEl);
    }
    if (modalEl) modalEl.style.display = 'flex';
};

window.toggleQuizQuestionsVisibility = (isChecked) => {
    const section = document.getElementById('quiz-questions-section');
    if (section) {
        section.style.display = isChecked ? 'block' : 'none';
        if (isChecked) {
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }
};

window.closeEvaluationQuiz = () => {
    document.getElementById('quiz-execution-modal').style.display = 'none';
};

window.selectQuizAnswer = (qIdx, cIdx) => {
    const item = selectedEvalDetail.items[currentQuizIdx];
    if (item && item.quiz_data && item.quiz_data.questions[qIdx]) {
        item.quiz_data.questions[qIdx].user_answer = cIdx;
    }
};

window.submitEvaluationQuiz = async () => {
    const item = selectedEvalDetail.items[currentQuizIdx];
    if (!item || !item.quiz_data) return;
    
    const qData = item.quiz_data;
    
    // 未回答チェック
    const unanswered = qData.questions.findIndex(q => q.user_answer === null || q.user_answer === undefined);
    if (unanswered !== -1) {
        return showAlert('未回答あり', `問${unanswered + 1} が未回答です。すべての問題に回答してください。`);
    }
    
    // 採点
    let totalScore = 0;
    let maxScore = 0;
    let catScores = { mandatory: 0, hard: 0, general: 0 };
    qData.questions.forEach(q => {
        maxScore += q.points;
        if (q.user_answer === q.correct_index) {
            totalScore += q.points;
            if (q.type && catScores[q.type] !== undefined) {
                catScores[q.type] += q.points;
            } else {
                catScores.general += q.points; // fallback
            }
        }
    });
    
    const th_eval3 = qData.threshold_eval3 !== undefined ? qData.threshold_eval3 : (qData.pass_score || 80);
    const th_eval2 = qData.threshold_eval2 !== undefined ? qData.threshold_eval2 : Math.floor((qData.pass_score || 80) / 2);
    
    // 評価点の算出 (ボーダー基準)
    let evalScore = 1;
    if (totalScore >= th_eval3) {
        evalScore = 3;
    } else if (totalScore >= th_eval2) {
        evalScore = 2;
    }
    
    // 合否判定 (合計点数と各特性ボーダーをすべてクリアしているか)
    let passed = totalScore >= th_eval3;
    const settings = qData.settings || {};
    const th_mand = (settings.mandatory && settings.mandatory.pass_score != null) ? settings.mandatory.pass_score : (qData.threshold_mandatory || 0);
    const th_hard = (settings.hard && settings.hard.pass_score != null) ? settings.hard.pass_score : 0;
    const th_gen = (settings.general && settings.general.pass_score != null) ? settings.general.pass_score : 0;
    
    if (th_mand > 0 && catScores.mandatory < th_mand) passed = false;
    if (th_hard > 0 && catScores.hard < th_hard) passed = false;
    if (th_gen > 0 && catScores.general < th_gen) passed = false;
    
    qData.score = totalScore;
    qData.passed = passed;
    qData.eval_score = evalScore;
    qData.completed = true;
    
    // 自己評価スコアに反映
    item.self_score = evalScore;
    
    // UIを閉じる
    document.getElementById('quiz-execution-modal').style.display = 'none';
    
    // 画面再描画
    if (window.mobileEditingEval && typeof window.openMobileInputView === 'function') {
        window.openMobileInputView(selectedEvalDetail.currentMode, selectedEvalDetail, selectedEvalDetail.isReadOnly);
    } else if (typeof window.refreshCurrentEvalDetail === 'function') {
        window.refreshCurrentEvalDetail();
    }
    
    // 自動保存
    try {
        await updateDoc(doc(db, "t_evaluations", selectedEvalDetail.id), {
            items: selectedEvalDetail.items,
            updated_at: new Date().toISOString()
        });
        if (window.calculateTotals) window.calculateTotals();
        let alertMsg = `あなたの得点は ${totalScore}点 / ${maxScore}点 です。`;
        let subBreakdowns = [];
        if (th_mand > 0) subBreakdowns.push(`必須問題: ${catScores.mandatory}点`);
        if (th_hard > 0) subBreakdowns.push(`高難易度: ${catScores.hard}点`);
        if (th_gen > 0) subBreakdowns.push(`一般問題: ${catScores.general}点`);
        
        if (subBreakdowns.length > 0) {
            alertMsg += `\n（うち ${subBreakdowns.join('、')}）`;
        }
        alertMsg += `\n\n結果：${passed ? '合格' : '不合格'}\n評価点として ${evalScore}点 が付与されました。`;
        await showAlert('採点結果', alertMsg);
    } catch(e) {
        console.error("Auto save quiz error", e);
        showAlert('エラー', 'テスト結果の保存に失敗しました。');
    }
};


// ==========================================
// テスト誤答復習モーダル
// ==========================================
window.openQuizReviewModal = (quizDataStr) => {
    let qData;
    try {
        qData = JSON.parse(quizDataStr);
    } catch(e) { return; }
    
    let modal = document.getElementById('quiz-review-modal-dynamic');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quiz-review-modal-dynamic';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(15, 23, 42, 0.5)';
        modal.style.zIndex = '9999999';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.padding = '1rem';
        modal.style.boxSizing = 'border-box';
        document.body.appendChild(modal);
    }
    
    const wrongQuestions = qData.questions.filter(q => q.user_answer !== q.correct_index);
    
    let questionsHtml = '';
    wrongQuestions.forEach((q, i) => {
        const escapeHTML = str => String(str).replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));
        let choicesHtml = '';
        q.choices.forEach((c, cIdx) => {
            let badge = '';
            let border = '1px solid #e2e8f0';
            let bg = 'white';
            if (cIdx === q.correct_index) {
                badge = `<span style="margin-left:auto; background:#10b981; color:white; padding:0.2rem 0.5rem; font-size:0.75rem; border-radius:12px; font-weight:800; white-space:nowrap;"><i class="fas fa-check"></i> 正解</span>`;
                border = '2px solid #10b981';
                bg = '#ecfdf5';
            } else if (cIdx === q.user_answer) {
                badge = `<span style="margin-left:auto; background:#ef4444; color:white; padding:0.2rem 0.5rem; font-size:0.75rem; border-radius:12px; font-weight:800; white-space:nowrap;"><i class="fas fa-times"></i> あなたの回答</span>`;
                border = '2px solid #ef4444';
                bg = '#fef2f2';
            }
            
            choicesHtml += `
                <div style="padding:0.6rem; margin-bottom:0.4rem; border-radius:6px; border:${border}; background:${bg}; display:flex; align-items:center;">
                    <span style="font-weight:700; color:#334155;">${escapeHTML(c)}</span>
                    ${badge}
                </div>
            `;
        });
        
        questionsHtml += `
            <div style="background:white; border:1px solid #cbd5e1; border-radius:8px; padding:1.2rem; margin-bottom:1.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="font-weight:800; font-size:1.05rem; color:#1e293b; margin-bottom:1rem; display:flex; gap:0.5rem; align-items:flex-start;">
                    <span style="background:#ef4444; color:white; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-size:0.8rem; flex-shrink:0;">
                        <i class="fas fa-exclamation"></i>
                    </span>
                    <div>${escapeHTML(q.text)}</div>
                </div>
                <div style="margin-bottom:1rem;">
                    ${choicesHtml}
                </div>
                ${q.explanation ? `
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:1rem;">
                        <div style="font-weight:800; color:#475569; font-size:0.85rem; margin-bottom:0.5rem;"><i class="fas fa-lightbulb" style="color:#f59e0b;"></i> 解説</div>
                        <div style="font-size:0.9rem; color:#334155; line-height:1.5;">${escapeHTML(q.explanation)}</div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div class="glass-panel" style="background: #f1f5f9; width: 100%; max-width: 700px; max-height: 90vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);">
            <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid #cbd5e1; background: white; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #1e293b;"><i class="fas fa-search" style="color:#ef4444;"></i> 誤答の復習 (${wrongQuestions.length}問)</h3>
                <button type="button" onclick="document.getElementById('quiz-review-modal-dynamic').style.display='none';" style="background:transparent; border:none; font-size:1.4rem; cursor:pointer; color:#94a3b8;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding: 1.5rem; overflow-y: auto; flex-grow: 1;">
                ${questionsHtml}
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
};
