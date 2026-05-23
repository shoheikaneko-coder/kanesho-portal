import { db } from './firebase.js';
import { 
    collection, getDocs, query, where, orderBy, doc, getDoc, 
    setDoc, addDoc, deleteDoc, writeBatch, serverTimestamp, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert, showConfirm } from './ui_utils.js';

// ─── HTML テンプレート ────────────────────────────────────────
export const attendanceManagementPageHtml = `
<div id="attendance-mgmt-container" class="animate-fade-in">
    
    <!-- 1. トップハブ画面 -->
    <div id="attn-hub-view" class="view-section">
        <!-- 新UI案内バナー -->
        <div class="glass-panel animate-fade-in" style="padding: 1.2rem; margin-bottom: 2rem; background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(244, 63, 94, 0.08)); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.05);">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 45px; height: 45px; border-radius: 10px; background: rgba(99, 102, 241, 0.15); color: #6366f1; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                    <i class="fas fa-desktop"></i>
                </div>
                <div>
                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">【新機能】統合勤怠管理ダッシュボード (PC特化版) が公開されました</h4>
                    <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--text-secondary);">日別・月別・承認・データ出力の5つの画面遷移を1つに統合し、PCでの作業効率を劇的に向上します。</p>
                </div>
            </div>
            <button onclick="window.switchToIntegratedDashboard()" class="btn btn-primary" style="padding: 0.5rem 1.2rem; font-size: 0.85rem; font-weight: 700; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3); border-radius: 8px; background: linear-gradient(135deg, #6366f1, #4f46e5); border: none;">
                新ダッシュボードを開く <i class="fas fa-chevron-right" style="margin-left:0.3rem;"></i>
            </button>
        </div>

        <div style="margin-bottom: 2rem;">
            <p style="color: var(--text-secondary);">勤怠状況の確認・編集およびデータの出力を行います。</p>
        </div>

        <div class="menu-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;">
            <div class="glass-panel menu-card" onclick="window.switchAttnView('monthly')">
                <i class="fas fa-calendar-alt"></i>
                <h3>月別データ</h3>
                <p>従業員の月間集計を確認します</p>
            </div>
            <div class="glass-panel menu-card" onclick="window.switchAttnView('daily')">
                <i class="fas fa-calendar-day"></i>
                <h3>日別データ</h3>
                <p>店舗ごとの日次実績を確認・編集します</p>
            </div>
            <div class="glass-panel menu-card" id="btn-attn-error-check">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>エラーチェック</h3>
                <p>打刻漏れや不整合を確認します (準備中)</p>
            </div>
            <div class="glass-panel menu-card" onclick="window.navigateTo('csv_export')">
                <i class="fas fa-file-export"></i>
                <h3>データ出力</h3>
                <p>外部給与ソフト用CSVを出力します</p>
            </div>
            <div id="card-attn-approvals" class="glass-panel menu-card" onclick="window.switchAttnView('approvals')" style="position:relative; border: 1px solid var(--secondary);">
                <i class="fas fa-check-double" style="color: var(--secondary);"></i>
                <h3>修正申請の承認</h3>
                <p>店長から届いた勤怠修正申請を確認・承認します</p>
                <span id="badge-attn-approvals" style="position:absolute; top:1rem; right:1rem; background:var(--danger); color:white; padding:2px 8px; border-radius:10px; font-size:0.8rem; font-weight:700; display:none;">0</span>
            </div>
        </div>
    </div>

    <!-- 2. 月別実績画面 -->
    <div id="attn-monthly-view" class="view-section" style="display: none;">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
                <div class="input-group" style="margin-bottom: 0; min-width: 150px;">
                    <label>対象月</label>
                    <input type="month" id="attn-month-select" style="padding: 0.6rem;">
                </div>
                <div class="input-group" style="margin-bottom: 0; min-width: 180px;">
                    <label>店舗絞り込み</label>
                    <select id="attn-mon-store-filter" class="store-selector" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px;">
                        <option value="">全店舗</option>
                    </select>
                </div>
                <button id="btn-attn-monthly-refresh" class="btn btn-primary" style="padding: 0.65rem 1.5rem;">
                    <i class="fas fa-search"></i> 表示
                </button>
                <button onclick="window.backToAttnHub()" class="btn" style="padding: 0.65rem 1.2rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1px solid var(--border); color: var(--text-secondary);">
                            <th style="padding: 1rem;">コード</th>
                            <th style="padding: 1rem;">名前</th>
                            <th style="padding: 1rem;">所属店舗</th>
                            <th style="padding: 1rem; text-align: right;">出勤日数</th>
                            <th style="padding: 1rem; text-align: right;">総労働時間</th>
                            <th style="padding: 1rem; text-align: right;">深夜時間</th>
                            <th style="padding: 1rem; text-align: center;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="attn-monthly-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 3. 日別実績画面 -->
    <div id="attn-daily-view" class="view-section" style="display: none;">
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
                <div class="input-group" style="margin-bottom: 0; min-width: 150px;">
                    <label>表示日</label>
                    <input type="date" id="attn-daily-date" style="padding: 0.6rem;">
                </div>
                <div class="input-group" style="margin-bottom: 0; min-width: 180px;">
                    <label>店舗</label>
                    <select id="attn-day-store-filter" class="store-selector" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px;">
                        <!-- JSで描画 -->
                    </select>
                </div>
                <button id="btn-attn-daily-refresh" class="btn btn-primary" style="padding: 0.65rem 1.5rem;">
                    <i class="fas fa-search"></i> 表示
                </button>
                <button onclick="window.backToAttnHub()" class="btn" style="padding: 0.65rem 1.2rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
                    <i class="fas fa-arrow-left"></i> 戻る
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 0; overflow: hidden;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1px solid var(--border); color: var(--text-secondary);">
                            <th style="padding: 1rem;">コード</th>
                            <th style="padding: 1rem;">名前</th>
                            <th style="padding: 1rem;">出勤</th>
                            <th style="padding: 1rem;">退勤</th>
                            <th style="padding: 1rem; text-align: right;">労働h</th>
                            <th style="padding: 1rem; text-align: center;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="attn-daily-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 4. 実績編集画面 -->
    <div id="attn-edit-view" class="view-section" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
                <h2 id="attn-edit-title" style="margin: 0;">勤務データ編集</h2>
                <p id="attn-edit-subtitle" style="margin:0.2rem 0 0; font-size: 0.9rem; color: var(--text-secondary);"></p>
            </div>
            <div style="display: flex; gap: 0.7rem;">
                <button id="btn-attn-save" class="btn btn-primary">
                    <i class="fas fa-save"></i> 保存
                </button>
                <button onclick="window.switchAttnView('daily')" class="btn" style="background: #f1f5f9; color: #475569;">
                    キャンセル
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; color: var(--text-secondary);">打刻一覧</h4>
                <button id="btn-add-punch-row" class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border: 1px solid var(--primary); color: var(--primary);">
                    <i class="fas fa-plus"></i> 行追加
                </button>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border);">
                            <th style="padding: 0.8rem;">打刻種別</th>
                            <th style="padding: 0.8rem;">日付</th>
                            <th style="padding: 0.8rem;">時刻</th>
                            <th style="padding: 0.8rem;">所属店舗</th>
                            <th style="padding: 0.8rem; text-align: center;">削除</th>
                        </tr>
                    </thead>
                    <tbody id="attn-edit-body"></tbody>
                </table>
            </div>
            <div style="margin-top: 1.5rem; padding: 1rem; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px;">
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-user-clock" style="color: var(--primary);"></i>
                    勤怠管理 <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 400; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; margin-left: 0.5rem;">v1.4</span>
                </h2>
                <p style="margin: 0; font-size: 0.8rem; color: #92400e; line-height: 1.5;">
                    <i class="fas fa-info-circle"></i> <b>ご注意:</b><br>
                    深夜0時を過ぎた退勤などは、日付を翌日のものに設定してください。業務日の集計範囲（日替わり時刻）に基づき、自動的に前日の営業実績として処理されます。
                </p>
            </div>
        </div>
    </div>

    <!-- 5. 修正申請承認画面 -->
    <div id="attn-approvals-view" class="view-section" style="display: none;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h2 style="margin:0;"><i class="fas fa-check-double" style="color:var(--secondary);"></i> 修正申請の承認待ちリスト</h2>
            <button onclick="window.backToAttnHub()" class="btn" style="padding: 0.65rem 1.2rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
                <i class="fas fa-arrow-left"></i> 戻る
            </button>
        </div>
        
        <div class="glass-panel" style="padding:0; overflow:hidden;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; border-spacing: 0;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:1px solid var(--border); color:var(--text-secondary); font-size:0.85rem;">
                            <th style="padding:1rem; width:150px;">操作</th>
                            <th style="padding:1rem; width:120px;">対象日</th>
                            <th style="padding:1rem; width:180px;">対象従業員</th>
                            <th style="padding:1rem;">申請内容（打刻）</th>
                        </tr>
                    </thead>
                    <tbody id="attn-approvals-body">
                        <!-- JSで描画 -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 6. 【新UI】 King of TIME風 PC特化型 統合ダッシュボード画面 -->
    <div id="attn-integrated-dashboard-view" class="view-section" style="display: none;">
        <!-- ヘッダー -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: rgba(255, 255, 255, 0.4); padding: 1.2rem; border-radius: 12px; border: 1px solid var(--border); backdrop-filter: blur(10px);">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <h2 style="margin: 0; font-size: 1.3rem; display: flex; align-items: center; gap: 0.6rem; color: var(--text-primary); font-weight: 800;">
                    <i class="fas fa-desktop" style="color: var(--primary);"></i>
                    統合勤怠管理ダッシュボード
                    <span style="font-size: 0.75rem; color: #6366f1; font-weight: bold; background: rgba(99, 102, 241, 0.1); padding: 2px 10px; border-radius: 20px; border: 1px solid rgba(99, 102, 241, 0.2);">新版（PC特化）</span>
                </h2>
            </div>
            <!-- 旧メニューは廃止されるため、元の「人事総務」メインメニューに戻るように変更 -->
            <button onclick="window.navigateTo('hr_hub')" class="btn" style="padding: 0.55rem 1.2rem; font-size: 0.85rem; font-weight: 700; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px;">
                <i class="fas fa-arrow-left"></i> 人事総務Hubに戻る
            </button>
        </div>

        <!-- 共通フィルターエリア -->
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid var(--border);">
            <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-end;">
                <div class="input-group" style="margin-bottom: 0; min-width: 220px;">
                    <label style="font-weight: 800; color: var(--text-secondary); margin-bottom: 0.4rem; font-size: 0.8rem;">対象店舗</label>
                    <select id="attn-int-store-filter" class="store-selector" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border); border-radius: 8px; font-weight: 600; background: white;">
                        <option value="">全店舗</option>
                    </select>
                </div>
                <div class="input-group" style="margin-bottom: 0; min-width: 180px;">
                    <label style="font-weight: 800; color: var(--text-secondary); margin-bottom: 0.4rem; font-size: 0.8rem;">対象月</label>
                    <input type="month" id="attn-int-month-select" style="padding: 0.65rem; border: 1px solid var(--border); border-radius: 8px; font-weight: 600; background: white;">
                </div>
                <div class="input-group" style="margin-bottom: 0; min-width: 180px;" id="attn-int-date-filter-group">
                    <label style="font-weight: 800; color: var(--text-secondary); margin-bottom: 0.4rem; font-size: 0.8rem;">表示日 (日別用)</label>
                    <input type="date" id="attn-int-date-select" style="padding: 0.65rem; border: 1px solid var(--border); border-radius: 8px; font-weight: 600; background: white;">
                </div>
                <button id="btn-attn-int-search" class="btn btn-primary" style="padding: 0.68rem 2.2rem; font-weight: 700; border-radius: 8px; display: flex; align-items: center; gap: 0.6rem; background: linear-gradient(135deg, var(--primary), var(--primary-dark, #e04f53)); border: none; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);">
                    <i class="fas fa-search"></i> 検索・表示
                </button>
            </div>
        </div>

        <!-- タブナビゲーション -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0px;">
            <button class="attn-int-tab active" data-tab="daily">
                <i class="fas fa-calendar-day"></i> 日別データ
            </button>
            <button class="attn-int-tab" data-tab="monthly">
                <i class="fas fa-calendar-alt"></i> 月別集計
            </button>
            <button class="attn-int-tab" data-tab="approvals" style="position: relative;">
                <i class="fas fa-check-double"></i> 修正申請の承認
                <span id="badge-attn-int-approvals" class="badge-attn-int">0</span>
            </button>
            <button class="attn-int-tab" data-tab="errors">
                <i class="fas fa-exclamation-triangle"></i> エラーチェック
            </button>
        </div>

        <!-- 各種タブコンテンツエリア -->
        <div id="attn-int-tab-content">
            <!-- 6-1. 日別データコンテンツ -->
            <div id="attn-int-pane-daily" class="attn-int-pane animate-fade-in">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem;">
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                        <button id="btn-attn-int-day-prev" class="btn" style="padding: 0.45rem 1rem; background: white; border: 1px solid var(--border); border-radius: 6px; font-weight: 700; color: var(--text-secondary);"><i class="fas fa-chevron-left"></i> 前日</button>
                        <span id="attn-int-day-label" style="font-weight: 800; font-size: 1.2rem; color: var(--text-primary);">2026/05/23</span>
                        <button id="btn-attn-int-day-next" class="btn" style="padding: 0.45rem 1rem; background: white; border: 1px solid var(--border); border-radius: 6px; font-weight: 700; color: var(--text-secondary);">翌日 <i class="fas fa-chevron-right"></i></button>
                    </div>
                    <div>
                        <!-- CSVエクスポートを設置 -->
                        <button onclick="window.openIntCsvModal()" class="btn btn-primary" style="padding: 0.55rem 1.2rem; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; background: #10b981; border: none; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);">
                            <i class="fas fa-file-csv"></i> TKC形式CSV出力
                        </button>
                    </div>
                </div>

                <div class="glass-panel" style="padding: 0; border: 1px solid var(--border); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                    <div style="overflow-x: auto;">
                        <table class="attn-int-table">
                            <thead>
                                <tr>
                                    <th style="width: 120px;">コード</th>
                                    <th style="width: 180px;">従業員名</th>
                                    <th style="width: 200px;">所属店舗</th>
                                    <th style="width: 130px;">出勤時刻</th>
                                    <th style="width: 130px;">退勤時刻</th>
                                    <th style="width: 150px; text-align: right;">実労働時間</th>
                                    <th style="width: 150px; text-align: right;">深夜労働h</th>
                                    <th style="text-align: center;">操作</th>
                                </tr>
                            </thead>
                            <tbody id="attn-int-daily-body">
                                <tr><td colspan="8" style="padding: 3rem; text-align: center; color: var(--text-secondary);"><i class="fas fa-search"></i> 共通フィルターを指定して「検索・表示」を押してください</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 6-2. 月別集計コンテンツ -->
            <div id="attn-int-pane-monthly" class="attn-int-pane animate-fade-in" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem;">
                    <span id="attn-int-month-label" style="font-weight: 800; font-size: 1.2rem; color: var(--text-primary);">2026年05月度 集計</span>
                    <button onclick="window.openIntCsvModal()" class="btn btn-primary" style="padding: 0.55rem 1.2rem; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; background: #10b981; border: none; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);">
                        <i class="fas fa-file-csv"></i> TKC形式CSV出力
                    </button>
                </div>

                <div class="glass-panel" style="padding: 0; border: 1px solid var(--border); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                    <div style="overflow-x: auto;">
                        <table class="attn-int-table">
                            <thead>
                                <tr>
                                    <th style="width: 120px;">コード</th>
                                    <th style="width: 200px;">従業員名</th>
                                    <th style="width: 220px;">所属店舗</th>
                                    <th style="width: 150px; text-align: right;">出勤日数</th>
                                    <th style="width: 180px; text-align: right;">総実労働時間</th>
                                    <th style="width: 180px; text-align: right;">総深夜時間</th>
                                    <th style="text-align: center;">操作</th>
                                </tr>
                            </thead>
                            <tbody id="attn-int-monthly-body">
                                <tr><td colspan="7" style="padding: 3rem; text-align: center; color: var(--text-secondary);"><i class="fas fa-search"></i> 共通フィルターを指定して「検索・表示」を押してください</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 6-3. 修正承認待ちコンテンツ -->
            <div id="attn-int-pane-approvals" class="attn-int-pane animate-fade-in" style="display: none;">
                <div style="margin-bottom: 1.2rem;">
                    <span style="font-weight: 800; font-size: 1.2rem; color: var(--text-primary);"><i class="fas fa-check-double" style="color: var(--secondary);"></i> 修正申請の承認待ちリスト</span>
                </div>

                <div class="glass-panel" style="padding: 0; border: 1px solid var(--border); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                    <div style="overflow-x: auto;">
                        <table class="attn-int-table" style="border-spacing: 0;">
                            <thead>
                                <tr>
                                    <th style="width: 150px; padding: 1rem 0.8rem;">操作</th>
                                    <th style="width: 130px;">対象日</th>
                                    <th style="width: 180px;">従業員情報</th>
                                    <th>申請内容（打刻）</th>
                                </tr>
                            </thead>
                            <tbody id="attn-int-approvals-body">
                                <tr><td colspan="4" style="padding: 3rem; text-align: center; color: var(--text-secondary);">現在、承認待ちの申請はありません。</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- 6-4. エラーチェックコンテンツ -->
            <div id="attn-int-pane-errors" class="attn-int-pane animate-fade-in" style="display: none;">
                <div style="margin-bottom: 1.2rem;">
                    <span style="font-weight: 800; font-size: 1.2rem; color: var(--text-primary);"><i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i> 打刻エラー・不整合リスト</span>
                    <p style="margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">出勤があって退勤がない、または退勤があって出勤がないなどの整合性エラーを自動検出します。(※当日の進行中データは除外されます)</p>
                </div>

                <div class="glass-panel" style="padding: 0; border: 1px solid var(--border); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                    <div style="overflow-x: auto;">
                        <table class="attn-int-table">
                            <thead>
                                <tr>
                                    <th style="width: 150px;">日付</th>
                                    <th style="width: 180px;">従業員名</th>
                                    <th style="width: 200px;">所属店舗</th>
                                    <th>エラー内容</th>
                                    <th style="width: 130px; text-align: center;">操作</th>
                                </tr>
                            </thead>
                            <tbody id="attn-int-errors-body">
                                <tr><td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-secondary);"><i class="fas fa-search"></i> 共通フィルターを指定して「検索・表示」を押してください</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- 7. 【CSVエクスポート設定】専用モーダルポップアップ -->
    <div id="attn-int-csv-modal" class="attn-int-modal">
        <div class="attn-int-modal-content" style="background: white; border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.8rem;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-file-csv" style="color: #10b981;"></i>
                    TKC形式CSV出力設定
                </h3>
                <button onclick="window.closeIntCsvModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-secondary);"><i class="fas fa-times"></i></button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 1.2rem;">
                <div class="input-group" style="margin-bottom: 0;">
                    <label style="font-weight: 800; color: var(--text-secondary); margin-bottom: 0.4rem; font-size: 0.8rem;">出力対象店舗</label>
                    <select id="attn-int-csv-store" class="store-selector" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border); border-radius: 8px; font-weight: 600; background: white;">
                        <option value="">全店舗</option>
                    </select>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="input-group" style="margin-bottom: 0;">
                        <label style="font-weight: 800; color: var(--text-secondary); margin-bottom: 0.4rem; font-size: 0.8rem;">開始日 <span style="color: var(--danger); font-weight:bold;">*必須</span></label>
                        <input type="date" id="attn-int-csv-start" style="padding: 0.65rem; border: 1px solid var(--border); border-radius: 8px; font-weight: 600; background: white;">
                    </div>
                    <div class="input-group" style="margin-bottom: 0;">
                        <label style="font-weight: 800; color: var(--text-secondary); margin-bottom: 0.4rem; font-size: 0.8rem;">終了日 <span style="color: var(--danger); font-weight:bold;">*必須</span></label>
                        <input type="date" id="attn-int-csv-end" style="padding: 0.65rem; border: 1px solid var(--border); border-radius: 8px; font-weight: 600; background: white;">
                    </div>
                </div>
                
                <div style="font-size: 0.78rem; color: #64748b; line-height: 1.5; background: #f8fafc; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border);">
                    <i class="fas fa-info-circle" style="color:#3b82f6;"></i> <b>給与計算時のご注意:</b><br>
                    給与算定期間が <b>21日〜翌月20日</b> に指定されていることをご確認のうえ出力してください。<br>期間未指定の場合はCSV出力できません。
                </div>
                
                <div style="display: flex; gap: 0.8rem; justify-content: flex-end; margin-top: 0.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                    <button onclick="window.closeIntCsvModal()" class="btn" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-weight: 700; padding: 0.6rem 1.2rem; border-radius: 8px;">
                        キャンセル
                    </button>
                    <button id="btn-attn-int-csv-download" class="btn btn-primary" style="background: #10b981; border: none; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); font-weight: 700; padding: 0.6rem 1.5rem; border-radius: 8px; display: flex; align-items: center; gap: 0.4rem;">
                        <i class="fas fa-download"></i> CSVダウンロード
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    #attendance-mgmt-container .menu-card {
        padding: 2rem 1.5rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid var(--border);
        text-align: center;
        cursor: pointer;
    }
    #attendance-mgmt-container .menu-card:hover { transform: translateY(-5px); border-color: var(--primary); }
    #attendance-mgmt-container .menu-card i { font-size: 2.5rem; margin-bottom: 1rem; color: var(--primary); }
    
    .attn-row-input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 0.9rem;
    }
    
    #attn-daily-body tr:hover, #attn-monthly-body tr:hover { background: #fdf2f2; }
    #attn-daily-body td, #attn-monthly-body td { padding: 0.8rem 1rem; border-bottom: 1px solid #f1f5f9; }
    
    /* 統合ダッシュボード用のカスタムスタイル */
    .attn-int-tab {
        padding: 0.8rem 1.5rem;
        font-weight: 700;
        border: none;
        background: none;
        border-bottom: 3px solid transparent;
        cursor: pointer;
        color: var(--text-secondary);
        font-size: 0.9rem;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .attn-int-tab.active {
        color: var(--primary) !important;
        border-bottom-color: var(--primary) !important;
    }
    .attn-int-tab:hover {
        color: var(--primary);
    }
    .badge-attn-int {
        background: var(--danger);
        color: white;
        border-radius: 10px;
        padding: 1px 6px;
        font-size: 0.7rem;
        font-weight: 700;
        margin-left: 0.3rem;
        display: none;
    }
    .attn-int-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.88rem;
    }
    .attn-int-table th {
        background: #f8fafc;
        border-bottom: 2px solid var(--border);
        color: var(--text-secondary);
        padding: 0.8rem 1rem;
        font-weight: 700;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .attn-int-table td {
        padding: 0.9rem 1rem;
        border-bottom: 1px solid #f1f5f9;
        color: var(--text-primary);
        font-weight: 500;
        vertical-align: middle;
    }
    .attn-int-table tbody tr:nth-child(even) {
        background-color: #f8fafc25;
    }
    .attn-int-table tbody tr:hover {
        background-color: #fdf2f235 !important;
    }

    /* CSV出力設定モーダル用スタイル */
    .attn-int-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(8px);
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .attn-int-modal.show {
        display: block;
        opacity: 1;
    }
    .attn-int-modal-content {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        background: white;
        padding: 2.2rem 2rem;
        border-radius: 16px;
        width: 480px;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);
        border: 1px solid var(--border);
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .attn-int-modal.show .attn-int-modal-content {
        transform: translate(-50%, -50%) scale(1);
    }
</style>
`;

// ─── 状態 ────────────────────────────────────────────────────
let cachedStores = [];
let currentStaff = null;
let currentTargetDate = null; // YYYY-MM-DD (業務日)
let currentEditPunches = []; // 編集中の打刻リスト
let canDirectEdit = false;
let canRequestCorrection = false;
let unsubscribeApprovals = null;
let activeIntTab = 'daily'; // 新UI用アクティブタブ
let lastLoadedIntData = null; // 新UI用の統合計算済みデータキャッシュ

// ─── 初期化 ──────────────────────────────────────────────────
export async function initAttendanceManagementPage() {
    window.switchAttnView = switchView;
    window.openStaffEdit = openStaffEdit;
    window.backToAttnHub = backToAttnHub;
    window.switchToIntegratedDashboard = switchToIntegratedDashboard;
    window.switchToIntegratedDashboardBack = switchToIntegratedDashboardBack;
    window.openIntCsvModal = openIntCsvModal;
    window.closeIntCsvModal = closeIntCsvModal;

    // 権限取得
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
        const user = JSON.parse(userJson);
        const perms = window.appState?.permissions || [];
        // 管理者ロールまたは明示的な権限がある場合に許可
        canDirectEdit = (user.Role === 'Admin' || user.Role === '管理者' || perms.includes('attendance_direct_edit'));
        canRequestCorrection = (perms.includes('attendance_correction_request'));
    }

    await loadStoreList();

    // デフォルト日付セット
    const now = new Date();
    const todayYmd = now.toISOString().split('T')[0];
    const thisMonth = todayYmd.substring(0, 7);

    if (document.getElementById('attn-month-select')) document.getElementById('attn-month-select').value = thisMonth;
    if (document.getElementById('attn-daily-date')) document.getElementById('attn-daily-date').value = todayYmd;

    // 新UI用デフォルト日付セット
    if (document.getElementById('attn-int-month-select')) document.getElementById('attn-int-month-select').value = thisMonth;
    if (document.getElementById('attn-int-date-select')) document.getElementById('attn-int-date-select').value = todayYmd;

    // イベント
    document.getElementById('btn-attn-monthly-refresh').onclick = () => loadMonthlyData();
    document.getElementById('btn-attn-daily-refresh').onclick = () => loadDailyData();
    document.getElementById('btn-add-punch-row').onclick = () => addPunchRow();
    document.getElementById('btn-attn-save').onclick = () => saveAttendanceEdits();

    const btnError = document.getElementById('btn-attn-error-check');
    if (btnError) btnError.onclick = () => showAlert('情報', 'エラーチェック機能は現在準備中です。');

    // 新UI用イベント
    if (document.getElementById('btn-attn-int-search')) document.getElementById('btn-attn-int-search').onclick = () => loadIntegratedData();
    if (document.getElementById('btn-attn-int-day-prev')) document.getElementById('btn-attn-int-day-prev').onclick = () => shiftIntDay(-1);
    if (document.getElementById('btn-attn-int-day-next')) document.getElementById('btn-attn-int-day-next').onclick = () => shiftIntDay(1);
    if (document.getElementById('btn-attn-int-csv-download')) document.getElementById('btn-attn-int-csv-download').onclick = () => handleIntTkcExport();

    // タブクリックイベント
    document.querySelectorAll('.attn-int-tab').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.attn-int-tab').forEach(b => b.classList.remove('active'));
            const tabBtn = e.currentTarget;
            tabBtn.classList.add('active');
            activeIntTab = tabBtn.dataset.tab;
            
            // 日付フィルターの出し分け (日別データタブのときだけ表示日フィルターを見せる)
            const dateFilterGroup = document.getElementById('attn-int-date-filter-group');
            if (dateFilterGroup) {
                dateFilterGroup.style.display = activeIntTab === 'daily' ? 'block' : 'none';
            }

            switchIntTabPane();
        };
    });

    // 承認カードの表示制御 (管理者のみ表示)
    const cardApprovals = document.getElementById('card-attn-approvals');
    if (cardApprovals) {
        cardApprovals.style.display = canDirectEdit ? 'block' : 'none';
    }

    // 画面遷移ロジックの改善（新ダッシュボードへ直接遷移）
    if (!canDirectEdit && canRequestCorrection) {
        // 店長（申請のみ）の場合はハブをスキップして直接日別画面へ
        switchView('daily');
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = '勤怠修正申請';
    } else {
        // 管理者の場合は旧ハブ画面をスキップし、直接新しい統合ダッシュボードを起動
        switchToIntegratedDashboard();
        if (canDirectEdit) {
            startApprovalsListener();
        }
    }

    // 他のページから承認画面への直接遷移フラグをチェック
    if (window.__triggerAttnApprovals) {
        delete window.__triggerAttnApprovals;
        switchView('approvals');
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
    const target = document.getElementById(`attn-${viewName}-view`);
    if (target) {
        target.style.display = 'block';
        // ページを切り替えたらトップにスクロール
        window.scrollTo(0, 0);
    }

    if (viewName === 'monthly') loadMonthlyData();
    if (viewName === 'daily') loadDailyData();
    if (viewName === 'approvals' && window.__pendingAttnRequests) renderApprovalList(window.__pendingAttnRequests);
}

function backToAttnHub() {
    if (!canDirectEdit && canRequestCorrection) {
        // 店長でハブ画面を持たない場合は、ダッシュボード等に戻るなどの処理
        window.navigateTo('ops_hub');
    } else {
        switchView('hub');
    }
}

// ─── マスタ関連 ──────────────────────────────────────────
async function loadStoreList() {
    try {
        const snap = await getDocs(collection(db, "m_stores"));
        cachedStores = [];
        snap.forEach(d => {
            const data = d.data();
            cachedStores.push({ id: d.id, ...data });
        });

        // セレクターの更新
        const selectors = document.querySelectorAll('.store-selector');
        if (selectors.length === 0) {
            console.warn("No store selectors found during loadStoreList");
        }

        selectors.forEach(sel => {
            const isMonthly = sel.id === 'attn-mon-store-filter' || sel.id === 'attn-int-store-filter' || sel.id === 'attn-int-csv-store';
            sel.innerHTML = isMonthly ? '<option value="">全店舗</option>' : '';
            
            cachedStores.forEach(s => {
                const sid = s.store_id || s.StoreID || s.id;
                const snm = s.store_name || s.StoreName || s.Store || '名称未設定';
                const opt = document.createElement('option');
                opt.value = sid;
                opt.textContent = snm;
                sel.appendChild(opt);
            });
        });
        
        console.log(`Loaded ${cachedStores.length} stores to selectors.`);
    } catch (e) { 
        console.error("Store list load failed:", e);
        showAlert('エラー', '店舗リストの読み込みに失敗しました。');
    }
}

// ─── 日別データ表示 ────────────────────────────────────────
async function loadDailyData() {
    const date = document.getElementById('attn-daily-date').value;
    const storeName = document.getElementById('attn-day-store-filter').value;
    const body = document.getElementById('attn-daily-body');
    if (!body) return;
    if (!date || !storeName) return showAlert('通知', '店舗と日付を選択してください。');

    body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem;">読み込み中...</td></tr>';

    try {
        // 店舗取得（正規化されたID/名前で検索）
        const selectedSid = document.getElementById('attn-day-store-filter').value;
        const storeInfo = cachedStores.find(s => (s.store_id || s.id) === selectedSid);
        const storeNameForUserSearch = storeInfo?.store_name || storeInfo?.Store || "";
        const dayChangeTime = storeInfo?.day_change_time || 5;

        // 対象日のスタッフ取得（Storeフィールドで検索）
        const userSnap = await getDocs(query(collection(db, 'm_users'), where('Store', '==', storeNameForUserSearch)));
        const staffList = [];
        userSnap.forEach(d => {
            const data = d.data();
            // あらゆる可能性を網羅するスマート・マッピング
            const sId = data.EmployeeCode || data.staff_id || data.staff_code || data.UserId || data.id || d.id;
            const sName = data.Name || data.name || data.staff_name || data.DisplayName || data.name_kanji || '';
            
            // 文字列として確実に固定して保持
            staffList.push({ 
                id: sId ? String(sId).trim() : String(d.id), 
                name: (sName && String(sName).trim() !== 'undefined') ? String(sName).trim() : '(名前なし)',
                data: data 
            });
        });

        // デバッグ用ログ（ブラウザのコンソールで確認可能）
        console.log(`[v1.2] Loaded ${staffList.length} staff members for ${storeNameForUserSearch}`);
        if (staffList.length > 0) console.log("Sample staff data:", staffList[0]);
        
        if (staffList.length > 0) {
            console.log(`[Attendance] Found ${staffList.length} staff members for store ${storeNameForUserSearch}`);
        } else {
            console.warn(`[Attendance] No staff found for store: ${storeNameForUserSearch}`);
        }

        // 打刻データ取得（対象日 00:00 〜 翌日 05:00 などの範囲をカバー）
        const nextDay = getNextDateStr(date);
        const q = query(collection(db, 't_attendance'), 
            where('date', '>=', date), 
            where('date', '<=', nextDay));
        const punchSnap = await getDocs(q);
        const allPunches = [];
        punchSnap.forEach(d => allPunches.push({ id: d.id, ...d.data() }));

        // 業務日ベースでフィルタリング
        const startEdge = `${date}T${String(dayChangeTime).padStart(2, '0')}:00:00`;
        const nextDate = getNextDateStr(date);
        const endEdge = `${nextDate}T${String(dayChangeTime).padStart(2, '0')}:00:00`;

        const businessDayPunches = allPunches.filter(p => {
            const ts = p.timestamp;
            return ts >= startEdge && ts < endEdge;
        });

        body.innerHTML = '';
        staffList.sort((a,b) => (a.id || '').localeCompare(b.id || '')).forEach((s, rowIdx) => {
            const myPunches = businessDayPunches.filter(p => {
                // 打刻データ側のID取得も柔軟に
                const pid = p.staff_id || p.staff_code || p.EmployeeCode || p.UserId || "";
                return String(pid).trim() === String(s.id).trim();
            });
            myPunches.sort((a,b) => a.timestamp.localeCompare(b.timestamp));

            const checkIn = myPunches.find(p => p.type === 'check_in' || p.type === '出勤');
            const checkOut = [...myPunches].reverse().find(p => p.type === 'check_out' || p.type === '退勤');
            
            let hours = 0;
            if (checkIn && checkOut) {
                const diff = (new Date(checkOut.timestamp) - new Date(checkIn.timestamp)) / 3600000;
                let breaks = 0;
                let bStart = null;
                myPunches.forEach(p => {
                    if (p.type === 'break_start') bStart = new Date(p.timestamp);
                    else if (p.type === 'break_end' && bStart) {
                        breaks += (new Date(p.timestamp) - bStart) / 3600000;
                        bStart = null;
                    }
                });
                hours = Math.max(0, diff - breaks);
            }

            const tr = document.createElement('tr');
            const btnLabel = canDirectEdit ? '編集' : '修正依頼';
            const btnIcon = canDirectEdit ? 'fa-edit' : 'fa-paper-plane';
            
            tr.innerHTML = `
                <td style="font-family: monospace;">${s.id || '-'}</td>
                <td style="font-weight:600;">${s.name}</td>
                <td style="font-size:0.85rem;">${checkIn ? checkIn.timestamp.substring(11, 16) : '-'}</td>
                <td style="font-size:0.85rem;">${checkOut ? checkOut.timestamp.substring(11, 16) : '-'}</td>
                <td style="text-align:right; font-weight:700;">${hours > 0 ? hours.toFixed(2) + 'h' : '-'}</td>
                <td style="text-align:center;">
                    <button class="btn" style="padding:0.3rem 0.6rem; font-size:0.8rem; background:#e2e8f0;" onclick="window.openStaffEdit('${s.id}', '${s.name}', '${date}')">
                        <i class="fas ${btnIcon}"></i> ${btnLabel}
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        body.innerHTML = '<tr><td colspan="6" style="color:var(--danger); text-align:center;">読み込み失敗</td></tr>';
    }
}

// ─── 実績編集画面 ────────────────────────────────────────
async function openStaffEdit(staffId, staffName, date) {
    currentStaff = { id: staffId, name: staffName };
    currentTargetDate = date;
    
    const title = canDirectEdit ? '実績編集' : '修正依頼の作成';
    document.getElementById('attn-edit-title').textContent = `${staffName} さんの${title}`;
    document.getElementById('attn-edit-subtitle').textContent = `対象業務日: ${date}`;

    const saveBtn = document.getElementById('btn-attn-save');
    if (saveBtn) {
        saveBtn.innerHTML = canDirectEdit ? '<i class="fas fa-save"></i> 保存' : '<i class="fas fa-paper-plane"></i> 申請する';
    }
    
    const body = document.getElementById('attn-edit-body');
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem;">読み込み中...</td></tr>';
    
    switchView('edit');

    try {
        // インデックスエラー回避のため、日付範囲のみで取得し、JS側でスタッフIDをフィルタリング
        const nextDay = getNextDateStr(date);
        const q = query(collection(db, 't_attendance'), 
            where('date', '>=', date),
            where('date', '<=', nextDay));
        const snap = await getDocs(q);
        
        currentEditPunches = [];
        snap.forEach(d => {
            const data = d.data();
            // 保存済みデータのID特定ロジック
            const pid = data.staff_id || data.staff_code || data.EmployeeCode || data.UserId || "";
            if (String(pid).trim() === String(staffId).trim()) {
                // 正規化した状態で保持
                currentEditPunches.push({ 
                    docId: d.id, 
                    ...data,
                    staff_id: String(pid).trim(),
                    // Dashboardとの紐付け必須項目を確実に抽出
                    labor_store_id: data.labor_store_id || data.store_id || data.StoreID || "",
                    store_id: data.store_id || data.StoreID || ""
                });
            }
        });
        currentEditPunches.sort((a,b) => a.timestamp.localeCompare(b.timestamp));

        renderEditTable();
    } catch (e) {
        console.error(e);
        body.innerHTML = '<tr><td colspan="5" style="color:var(--danger);">取得失敗</td></tr>';
    }
}

function renderEditTable() {
    const body = document.getElementById('attn-edit-body');
    body.innerHTML = '';

    const selectedSid = document.getElementById('attn-day-store-filter')?.value;
    const storeInfo = cachedStores.find(s => (s.store_id || s.id) === selectedSid);
    const dayChangeTime = storeInfo?.day_change_time || 5;
    
    const startEdge = `${currentTargetDate}T${String(dayChangeTime).padStart(2, '0')}:00:00`;
    const nextDate = getNextDateStr(currentTargetDate);
    const endEdge = `${nextDate}T${String(dayChangeTime).padStart(2, '0')}:00:00`;

    let visibleCount = 0;

    currentEditPunches.forEach((p, idx) => {
        const tr = document.createElement('tr');
        
        const ts = p.timestamp;
        const isOutOfBusinessDay = ts && (ts < startEdge || ts >= endEdge);
        if (isOutOfBusinessDay) {
            tr.style.display = 'none';
        } else {
            visibleCount++;
        }

        const timeVal = p.timestamp ? p.timestamp.substring(11, 16) : '';
        const dateVal = p.date || currentTargetDate;

        tr.innerHTML = `
            <td>
                <select class="attn-row-input type-select" onchange="window.updateLocalPunch(${idx}, 'type', this.value)">
                    <option value="check_in" ${p.type === 'check_in' ? 'selected' : ''}>出勤</option>
                    <option value="check_out" ${p.type === 'check_out' ? 'selected' : ''}>退勤</option>
                    <option value="break_start" ${p.type === 'break_start' ? 'selected' : ''}>休憩開始</option>
                    <option value="break_end" ${p.type === 'break_end' ? 'selected' : ''}>休憩終了</option>
                </select>
            </td>
            <td>
                <input type="date" class="attn-row-input date-input" value="${dateVal}" onchange="window.updateLocalPunch(${idx}, 'date', this.value)">
            </td>
            <td>
                <input type="time" class="attn-row-input time-input" value="${timeVal}" onchange="window.updateLocalPunch(${idx}, 'time', this.value)">
            </td>
            <td>
                <select class="attn-row-input store-select" style="width:100%;" onchange="window.updateLocalPunch(${idx}, 'store_id', this.value)">
                    ${cachedStores.map(s => `<option value="${s.store_id}" ${(s.store_id === p.store_id || s.id === p.store_id) ? 'selected' : ''}>${s.store_name}</option>`).join('')}
                </select>
            </td>
            <td style="text-align: center;">
                ${canDirectEdit ? `
                    <button class="btn" style="color:var(--danger); padding:0.4rem;" onclick="window.removePunchRow(${idx})">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                        <input type="checkbox" style="width:18px; height:18px; cursor:pointer;" 
                               ${p.deleteRequest ? 'checked' : ''} 
                               onchange="window.updateLocalPunch(${idx}, 'deleteRequest', this.checked)">
                        <span style="font-size:0.65rem; color:var(--danger); font-weight:bold;">削除依頼</span>
                    </div>
                `}
            </td>
        `;
        body.appendChild(tr);
    });

    if (visibleCount === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-secondary);">打刻実績がありません。「行追加」で新規作成できます。</td></tr>';
    }
}

window.updateLocalPunch = (idx, field, val) => {
    if (field === 'time') {
        const d = currentEditPunches[idx].date || currentTargetDate;
        currentEditPunches[idx].timestamp = `${d}T${val}:00`;
    } else if (field === 'date') {
        currentEditPunches[idx].date = val;
        const t = currentEditPunches[idx].timestamp ? currentEditPunches[idx].timestamp.substring(11, 16) : '00:00';
        currentEditPunches[idx].timestamp = `${val}T${t}:00`;
    } else {
        currentEditPunches[idx][field] = val;
        if (field === 'store_id') {
            const s = cachedStores.find(st => (st.store_id || st.id) === val);
            currentEditPunches[idx].store_name = s ? (s.store_name || s.Store) : '';
        }
    }
};

function addPunchRow() {
    const selectedSid = document.getElementById('attn-day-store-filter').value;
    const store = cachedStores.find(s => (s.store_id || s.id) === selectedSid) || cachedStores[0];
    currentEditPunches.push({
        type: 'check_in',
        date: currentTargetDate,
        timestamp: `${currentTargetDate}T12:00:00`,
        store_id: store.store_id || store.id,
        store_name: store.store_name || store.Store,
        staff_id: currentStaff.id,
        staff_name: currentStaff.name
    });
    renderEditTable();
}

window.removePunchRow = (idx) => {
    currentEditPunches.splice(idx, 1);
    renderEditTable();
};

async function saveAttendanceEdits() {
    const confirmMsg = canDirectEdit ? 
        '勤怠データを更新しますか？\nこの操作は給与集計に直接反映されます。' : 
        '勤怠の修正申請を送信しますか？\n管理者の承認後に反映されます。';
    if (!showConfirm('確認', confirmMsg)) return;

    const btn = document.getElementById('btn-attn-save');
    btn.disabled = true;
    const label = canDirectEdit ? '保存中...' : '申請中...';
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${label}`;

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const loginUser = currentUser?.Name || 'Unknown';
    const loginUserId = currentUser?.id || '';
    
    // ─── バリデーション：店長申請時は空のデータを禁止 ───────────
    if (!canDirectEdit) {
        const validPunches = currentEditPunches.filter(p => {
            const hasTime = p.timestamp && p.timestamp.includes('T') && p.timestamp.split('T')[1].substring(0,5) !== '00:00';
            // 削除依頼があるか、もしくは時刻が入力されている
            return p.deleteRequest || (p.timestamp && p.timestamp.length >= 16);
        });
        
        if (currentEditPunches.length === 0 || validPunches.length === 0) {
            showAlert('入力エラー', '打刻データが入力されていません。行を追加して時刻を設定するか、既存の打刻の削除を依頼してください。');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> 申請する';
            return;
        }
    }

    try {
        const sorted = [...currentEditPunches].sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        let lastInTs = null;
        let breakMs = 0;
        let bStartTs = null;

        sorted.forEach(p => {
            const ts = p.timestamp ? new Date(p.timestamp) : null;
            if (!ts || isNaN(ts.getTime())) return;

            if (p.type === 'check_in') {
                lastInTs = ts;
                breakMs = 0;
                bStartTs = null;
            } else if (p.type === 'break_start') {
                bStartTs = ts;
            } else if (p.type === 'break_end' && bStartTs) {
                breakMs += (ts - bStartTs);
                bStartTs = null;
            } else if (p.type === 'check_out' && lastInTs) {
                const grossMs = ts - lastInTs;
                const netMs = Math.max(0, grossMs - breakMs);
                p.total_labor_hours = netMs / 3600000;
                lastInTs = null;
                breakMs = 0;
                bStartTs = null;
            } else {
                p.total_labor_hours = 0;
            }
        });

        if (canDirectEdit) {
            // ─── 管理者用：直接反映 ──────────────────────────────
            const nextDay = getNextDateStr(currentTargetDate);
            const targetDateSlash = currentTargetDate.replace(/-/g, '/');
            const nextDaySlash = nextDay.replace(/-/g, '/');
            
            // ハイフン形式とスラッシュ形式の両方を検索
            const qHyphen = query(collection(db, 't_attendance'), 
                where('date', '>=', currentTargetDate),
                where('date', '<=', nextDay));
            const qSlash = query(collection(db, 't_attendance'), 
                where('date', '>=', targetDateSlash),
                where('date', '<=', nextDaySlash));
            
            const [snapH, snapS] = await Promise.all([getDocs(qHyphen), getDocs(qSlash)]);
            const batch = writeBatch(db);
            
            const normalizeId = (id) => String(id || "").trim().replace(/^0+/, '');
            const targetIdNorm = normalizeId(currentStaff.id);

            const processSnap = (snap) => {
                snap.forEach(d => {
                    const data = d.data();
                    const pid = data.staff_id || data.EmployeeCode || d.id;
                    if (normalizeId(pid) === targetIdNorm) {
                        batch.delete(d.ref);
                    }
                });
            };
            processSnap(snapH);
            processSnap(snapS);

            sorted.forEach(p => {
                let finalTs = p.timestamp;
                if (p.timestamp && p.timestamp.length === 16) {
                    finalTs = p.timestamp + ':00+09:00';
                }

                const docId = `${p.staff_id}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
                const docRef = doc(collection(db, 't_attendance'), docId);
                
                const data = {
                    ...p,
                    timestamp: finalTs,
                    store_id: String(p.store_id || "").trim(), 
                    labor_store_id: String(p.labor_store_id || p.store_id || "").trim(), 
                    staff_id: String(p.staff_id || "").trim(),
                    year_month: p.date.substring(0, 7),
                    modifiedBy: loginUser,
                    modifiedAt: serverTimestamp()
                };
                if (data.docId) delete data.docId;
                batch.set(docRef, data);
            });

            await batch.commit();
            showAlert('成功', '勤怠実績を更新しました。');
        } else {
            // ─── 店長用：修正申請を作成（古い申請を自動整理） ──────────
            const storeId = document.getElementById('attn-day-store-filter')?.value || '';
            const batch = writeBatch(db);
            const staffId = String(currentStaff.id).trim();

            // 1. 同一スタッフ、同一日の既存の「Pending」申請を検索
            const oldReqsQuery = query(collection(db, 't_attendance_requests'), 
                where('staff_id', '==', staffId),
                where('date', '==', currentTargetDate),
                where('status', '==', 'pending')
            );
            const oldSnap = await getDocs(oldReqsQuery);

            // 見つかった古い申請をすべて「差し替え済み (superseded)」にし、通知も完了させる
            for (const oldDoc of oldSnap.docs) {
                batch.update(oldDoc.ref, { 
                    status: 'superseded', 
                    superseded_at: serverTimestamp(),
                    superseded_by: loginUserId
                });

                // 対応する通知もクリア（バッジ件数を減らす）
                const notifQuery = query(collection(db, "notifications"), 
                    where("type", "==", "attendance_correction_request"),
                    where("target_id", "==", oldDoc.id),
                    where("status", "==", "pending")
                );
                const notifSnap = await getDocs(notifQuery);
                notifSnap.forEach(nd => batch.update(nd.ref, { status: 'done', processed_at: serverTimestamp() }));
            }

            // 2. 新しい申請データの構築
            const newReqRef = doc(collection(db, 't_attendance_requests'));
            const requestData = {
                staff_id: staffId,
                staff_name: currentStaff.name,
                date: currentTargetDate,
                store_id: storeId,
                requested_punches: sorted.map(p => {
                    let finalTs = p.timestamp;
                    if (p.timestamp && p.timestamp.length === 16) {
                        finalTs = p.timestamp + ':00+09:00';
                    }
                    const cleanP = { ...p };
                    if (cleanP.docId) delete cleanP.docId;
                    return {
                        ...cleanP,
                        timestamp: finalTs,
                        staff_id: String(p.staff_id || "").trim(),
                        store_id: String(p.store_id || "").trim(),
                        deleteRequest: !!p.deleteRequest
                    };
                }),
                requested_by_id: loginUserId,
                requested_by_name: loginUser,
                status: 'pending',
                created_at: serverTimestamp()
            };
            batch.set(newReqRef, requestData);

            // 3. 管理者への新しい通知作成
            const newNotifRef = doc(collection(db, 'notifications'));
            batch.set(newNotifRef, {
                type: 'attendance_correction_request',
                title: '勤怠修正申請',
                message: `${loginUser}さんから ${currentStaff.name}さんの勤怠修正申請（${currentTargetDate}）が届きました。`,
                status: 'pending',
                store_id: storeId,
                target_date: currentTargetDate,
                target_id: newReqRef.id,
                staff_id: currentStaff.id,
                created_at: serverTimestamp(),
                staff_name: currentStaff.name,
                requester_name: loginUser
            });

            await batch.commit();
            showAlert('申請完了', '最新の修正申請を送信しました。以前の未承認分は自動的に取り下げられました。');
        }

        switchView('daily');
        loadDailyData();
    } catch (e) {
        console.error(e);
        showAlert('エラー', '保存に失敗しました: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = canDirectEdit ? '<i class="fas fa-save"></i> 保存' : '<i class="fas fa-paper-plane"></i> 申請する';
    }
}

// ─── ヘルパー ──────────────────────────────────────────
function getNextDateStr(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

// ─── 月別実績 ──────────────────────────────────────────
async function loadMonthlyData() {
    const month = document.getElementById('attn-month-select')?.value;
    const storeId = document.getElementById('attn-mon-store-filter')?.value;
    const body = document.getElementById('attn-monthly-body');
    if (!body || !month) return;

    body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem;">計中...</td></tr>';

    try {
        const userSnap = await getDocs(collection(db, 'm_users'));
        const staffMap = {};
        userSnap.forEach(d => {
            const data = d.data();
            // 日別データ表示 (line 292) と同様のより堅牢なスタッフ特定ロジックを採用
            const sid = data.EmployeeCode || data.staff_id || data.staff_code || data.UserId || data.id || d.id;
            const name = data.Name || data.name || data.staff_name || data.DisplayName || data.name_kanji || '(名前なし)';
            
            // ユーザーに紐付く店舗情報を特定
            const sName = data.Store || data.store_name || "";
            const matchedStore = cachedStores.find(st => 
                st.store_name === sName || 
                st.id === data.StoreID || 
                st.store_id === data.StoreID
            );
            
            const sidStr = String(sid).trim();
            staffMap[sidStr] = { 
                code: sidStr, 
                name: String(name).trim(), 
                store_id: matchedStore ? (matchedStore.store_id || matchedStore.id) : (data.StoreID || ""),
                store_name: matchedStore ? matchedStore.store_name : (data.Store || "不明"),
                days: new Set(), 
                totalHours: 0, 
                lateHours: 0 
            };
        });

        const q = query(collection(db, 't_attendance'), where('year_month', '==', month));
        const punchSnap = await getDocs(q);
        const punches = [];
        punchSnap.forEach(d => punches.push(d.data()));

        // 集計
        const staffGroup = {};
        punches.forEach(p => {
            if (!staffGroup[p.staff_id]) staffGroup[p.staff_id] = [];
            staffGroup[p.staff_id].push(p);
        });

        Object.keys(staffGroup).forEach(sid => {
            if (!staffMap[sid]) return;
            const records = staffGroup[sid].sort((a,b) => a.timestamp.localeCompare(b.timestamp));
            let lastIn = null;
            let bStart = null;
            let breakSessions = [];

            records.forEach(r => {
                const ts = new Date(r.timestamp);
                if (r.type === 'check_in') {
                    lastIn = ts;
                    breakSessions = [];
                    staffMap[sid].days.add(r.date);
                } else if (r.type === 'break_start' && lastIn) bStart = ts;
                else if (r.type === 'break_end' && bStart) {
                    breakSessions.push({ start: bStart, end: ts });
                    bStart = null;
                } else if (r.type === 'check_out' && lastIn) {
                    const totalBreaks = breakSessions.reduce((sum, s) => sum + (s.end - s.start) / 3600000, 0);
                    const dur = (ts - lastIn) / 3600000 - totalBreaks;
                    if (dur > 0) {
                        staffMap[sid].totalHours += dur;
                        
                        const rawLate = calculateOverlapLateNightHours(lastIn, ts);
                        const lateBreaks = breakSessions.reduce((sum, s) => sum + calculateOverlapLateNightHours(s.start, s.end), 0);
                        staffMap[sid].lateHours += Math.max(0, rawLate - lateBreaks);
                    }
                    lastIn = null;
                    breakSessions = [];
                }
            });
        });

        let filtered = Object.values(staffMap);
        if (storeId) {
            filtered = filtered.filter(s => String(s.store_id) === String(storeId));
        }

        body.innerHTML = '';
        filtered.sort((a,b) => a.code.localeCompare(b.code)).forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.code}</td>
                <td style="font-weight:600;">${s.name}</td>
                <td>${s.store_name}</td>
                <td style="text-align:right;">${s.days.size}日</td>
                <td style="text-align:right; font-weight:700;">${s.totalHours.toFixed(1)}h</td>
                <td style="text-align:right; color:var(--primary);">${s.lateHours.toFixed(1)}h</td>
                <td style="text-align:center;">
                    <button class="btn" style="padding:0.3rem 0.6rem; font-size:0.8rem; background:#e2e8f0;" onclick="window.switchToDailyFromMonthly('${s.store_name}', '${month}-01')">
                        <i class="fas fa-search"></i> 日別
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });
    } catch (e) { 
        console.error(e);
        body.innerHTML = '<tr><td colspan="7" style="color:var(--danger); text-align:center;">読み込み失敗: ' + e.message + '</td></tr>';
    }
}

window.switchToDailyFromMonthly = (store, date) => {
    document.getElementById('attn-day-store-filter').value = store;
    document.getElementById('attn-daily-date').value = date;
    switchView('daily');
};

function calculateOverlapLateNightHours(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    if (s >= e) return 0;

    let totalLateMs = 0;

    // startの前日〜endの翌日までループして、深夜時間枠（22:00〜翌05:00）をすべてカバー
    const loopStart = new Date(s.getTime());
    loopStart.setDate(loopStart.getDate() - 1);
    const loopEnd = new Date(e.getTime());
    loopEnd.setDate(loopEnd.getDate() + 1);

    for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
        // d日の 22:00
        const l22 = new Date(d);
        l22.setHours(22, 0, 0, 0);

        // d+1日の 05:00
        const l05 = new Date(d);
        l05.setDate(l05.getDate() + 1);
        l05.setHours(5, 0, 0, 0);

        // 重なりを計算
        const overlapStart = s > l22 ? s : l22;
        const overlapEnd = e < l05 ? e : l05;

        if (overlapEnd > overlapStart) {
            totalLateMs += (overlapEnd - overlapStart);
        }
    }

    return totalLateMs / 3600000;
}

// ─── 承認ワークフロー（Phase 2） ──────────────────────────────

function startApprovalsListener() {
    if (unsubscribeApprovals) unsubscribeApprovals();
    
    const q = query(collection(db, "t_attendance_requests"), where("status", "==", "pending"));
    unsubscribeApprovals = onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        
        // メモリ上でソート (最新順)
        requests.sort((a,b) => {
            const timeA = a.created_at?.seconds || 0;
            const timeB = b.created_at?.seconds || 0;
            return timeB - timeA;
        });
        
        // ハブ画面のバッジ更新
        const badge = document.getElementById('badge-attn-approvals');
        if (badge) {
            badge.textContent = requests.length;
            badge.style.display = requests.length > 0 ? 'block' : 'none';
        }
        
        // 承認一覧画面が開いていれば再描画
        const approvalsView = document.getElementById('attn-approvals-view');
        if (approvalsView && approvalsView.style.display !== 'none') {
            renderApprovalList(requests);
        }
        
        // グローバルキャッシュ
        window.__pendingAttnRequests = requests;
    }, (err) => {
        console.error("Approvals listener error:", err);
    });
}

function safeFormatDate(val) {
    if (!val) return '-';
    // Firebase Timestamp object
    if (typeof val.toDate === 'function') return val.toDate().toLocaleString();
    if (val.seconds !== undefined) return new Date(val.seconds * 1000).toLocaleString();
    // JS Date object
    if (val instanceof Date) return val.toLocaleString();
    // String or number
    const d = new Date(val);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString();
}

function renderApprovalList(requests) {
    const body = document.getElementById('attn-approvals-body');
    if (!body) return;

    if (requests.length === 0) {
        body.innerHTML = '<tr><td colspan="4" style="padding:3rem; text-align:center; color:var(--text-secondary);">現在、承認待ちの申請はありません。</td></tr>';
        return;
    }

    body.innerHTML = requests.map(req => {
        const punches = req.requested_punches || [];
        
        let punchDetails = '';
        if (punches.length === 0) {
            punchDetails = '<div style="color:var(--text-secondary); font-style:italic;">(打刻データなし)</div>';
        } else {
            punchDetails = punches.map(p => {
                const ts = p.timestamp || '';
                const timeStr = (typeof ts === 'string' && ts.length >= 16) ? ts.substring(11, 16) : '--:--';
                if (p.deleteRequest) {
                    return `<div style="color:var(--danger); margin-bottom:0.3rem;">
                        <i class="fas fa-trash-alt"></i> 削除依頼: ${p.type} (${timeStr})
                    </div>`;
                } else {
                    return `<div style="color:var(--primary); margin-bottom:0.3rem;">
                        <i class="fas fa-plus-circle"></i> ${p.type} (${timeStr})
                    </div>`;
                }
            }).join('');
        }

        const targetDate = req.date || req.target_date || '-';
        const requester = req.requested_by_name || req.requester_name || '店長';

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                <td style="padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <button class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:var(--secondary); border:none;" onclick="window.processAttnApproval('${req.id}', 'approve')">
                        <i class="fas fa-check"></i> 承認
                    </button>
                    <button class="btn" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:#fef2f2; color:#ef4444; border:1px solid #fee2e2;" onclick="window.processAttnApproval('${req.id}', 'reject')">
                        <i class="fas fa-times"></i> 却下
                    </button>
                </td>
                <td style="padding: 1rem; font-weight: 700; color: #1e293b;">
                    ${targetDate}
                </td>
                <td style="padding: 1rem;">
                    <div style="font-weight: 700;">${req.staff_name || '不明'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">コード: ${req.staff_id || '-'}</div>
                </td>
                <td style="padding: 1rem; font-size: 0.85rem;">
                    <div style="margin-bottom:0.5rem; font-size: 0.75rem; color:var(--text-secondary);">
                        <i class="fas fa-user-edit"></i> 申請者: ${requester} (${safeFormatDate(req.created_at)})
                    </div>
                    ${punchDetails}
                </td>
            </tr>
        `;
    }).join('');
}

window.processAttnApproval = async (requestId, action) => {
    const req = window.__pendingAttnRequests?.find(r => r.id === requestId);
    if (!req) return;

    const confirmMsg = action === 'approve' 
        ? 'この申請を承認し、勤怠実績データを更新しますか？' 
        : 'この申請を却下しますか？';
    
    if (!confirm(confirmMsg)) return;

    try {
        const batch = writeBatch(db);
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const adminName = currentUser?.Name || 'Admin';

        if (action === 'approve') {
            // 1. 既存の該当従業員・該当日の打刻を削除
            const staffId = req.staff_id;
            const dateStr = req.date || req.target_date;
            if (!dateStr) throw new Error("対象日が不明です。");

            const nextDay = getNextDateStr(dateStr);
            const dateStrSlash = dateStr.replace(/-/g, '/');
            const nextDaySlash = nextDay.replace(/-/g, '/');

            // ハイフン形式とスラッシュ形式の両方を検索
            const qHyphen = query(collection(db, "t_attendance"), 
                where("date", ">=", dateStr), 
                where("date", "<=", nextDay)
            );
            const qSlash = query(collection(db, "t_attendance"), 
                where("date", ">=", dateStrSlash), 
                where("date", "<=", nextDaySlash)
            );

            const [snapH, snapS] = await Promise.all([getDocs(qHyphen), getDocs(qSlash)]);
            
            const normalizeId = (id) => String(id || "").trim().replace(/^0+/, '');
            const targetIdNorm = normalizeId(staffId);

            const processSnap = (snap) => {
                snap.forEach(d => {
                    const data = d.data();
                    const pid = data.staff_id || data.EmployeeCode || d.id;
                    if (normalizeId(pid) === targetIdNorm) {
                        batch.delete(d.ref);
                    }
                });
            };
            processSnap(snapH);
            processSnap(snapS);

            // 2. 申請された新しい打刻を登録
            req.requested_punches.forEach(p => {
                if (!p.deleteRequest) {
                    const newId = `${staffId}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
                    const newRef = doc(collection(db, "t_attendance"), newId);
                    
                    // 申請時のデータをベースに管理者の更新情報を付与
                    const data = {
                        ...p,
                        staff_id: staffId,
                        staff_name: req.staff_name,
                        date: dateStr,
                        year_month: dateStr.substring(0, 7),
                        modifiedAt: serverTimestamp(),
                        modifiedBy: adminName,
                        is_manual: true
                    };
                    if (data.deleteRequest) delete data.deleteRequest;
                    
                    batch.set(newRef, data);
                }
            });
            
            // 3. 申請ステータスを更新
            batch.update(doc(db, "t_attendance_requests", requestId), {
                status: 'approved',
                processed_at: serverTimestamp(),
                processed_by: adminName
            });
        } else {
            // 却下処理
            batch.update(doc(db, "t_attendance_requests", requestId), {
                status: 'rejected',
                processed_at: serverTimestamp(),
                processed_by: adminName
            });
        }

        // 4. 対応する「通知」を完了（既読）にする
        const notifQuery = query(collection(db, "notifications"), 
            where("type", "==", "attendance_correction_request"),
            where("target_id", "==", requestId),
            where("status", "==", "pending")
        );
        const notifSnap = await getDocs(notifQuery);
        notifSnap.forEach(d => batch.update(d.ref, { status: 'done', processed_at: serverTimestamp() }));

        await batch.commit();
        showAlert('完了', action === 'approve' ? '申請を承認しました。' : '申請を却下しました。');
    } catch (e) {
        console.error("Approval error:", e);
        showAlert('エラー', '処理中にエラーが発生しました: ' + e.message);
    }
};

// =========================================================================
// ─── 【新UI】 King of TIME風 統合ダッシュボード関連ロジック ──────────────
// =========================================================================

// 統合ダッシュボードの表示切り替え
function switchToIntegratedDashboard() {
    document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
    const dbView = document.getElementById('attn-integrated-dashboard-view');
    if (dbView) {
        dbView.style.display = 'block';
    }
    // タブ状態の初期化
    activeIntTab = 'daily';
    document.querySelectorAll('.attn-int-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === 'daily');
    });
    const dateFilterGroup = document.getElementById('attn-int-date-filter-group');
    if (dateFilterGroup) dateFilterGroup.style.display = 'block';
    
    // 既存ハブ画面と同じ日付値を連動させる
    const oldMonth = document.getElementById('attn-month-select')?.value;
    const oldDate = document.getElementById('attn-daily-date')?.value;
    const oldStore = document.getElementById('attn-day-store-filter')?.value;
    
    if (oldMonth && document.getElementById('attn-int-month-select')) {
        document.getElementById('attn-int-month-select').value = oldMonth;
    }
    if (oldDate && document.getElementById('attn-int-date-select')) {
        document.getElementById('attn-int-date-select').value = oldDate;
    }
    if (oldStore && document.getElementById('attn-int-store-filter')) {
        document.getElementById('attn-int-store-filter').value = oldStore;
    }
    
    switchIntTabPane();
    loadIntegratedData();
}

function switchToIntegratedDashboardBack() {
    switchView('hub');
}

function switchIntTabPane() {
    document.querySelectorAll('.attn-int-pane').forEach(p => p.style.display = 'none');
    const targetPane = document.getElementById(`attn-int-pane-${activeIntTab}`);
    if (targetPane) {
        targetPane.style.display = 'block';
    }
    
    // すでにロード済みのデータがあれば描画のみ行う
    if (lastLoadedIntData) {
        renderIntActiveTab();
    }
}

function shiftIntDay(offset) {
    const dateInput = document.getElementById('attn-int-date-select');
    if (!dateInput || !dateInput.value) return;
    
    const d = new Date(dateInput.value);
    d.setDate(d.getDate() + offset);
    dateInput.value = d.toISOString().split('T')[0];
    
    loadIntegratedData();
}

// 統合データの一括ロード・計算（実績ある計算ロジックを100%踏襲）
async function loadIntegratedData() {
    const storeId = document.getElementById('attn-int-store-filter')?.value || '';
    const month = document.getElementById('attn-int-month-select')?.value;
    const date = document.getElementById('attn-int-date-select')?.value;
    
    if (!month) {
        return showAlert('通知', '対象月を選択してください。');
    }
    
    // 日付ラベルや月ラベルの更新
    const monthLabel = document.getElementById('attn-int-month-label');
    if (monthLabel) monthLabel.textContent = `${month.replace('-', '年')}月度 集計`;
    
    const dayLabel = document.getElementById('attn-int-day-label');
    if (dayLabel && date) {
        const dObj = new Date(date);
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dObj.getDay()];
        dayLabel.textContent = `${date.replace(/-/g, '/')} (${dayOfWeek})`;
    }

    // 読込中のUI表示
    const dailyBody = document.getElementById('attn-int-daily-body');
    const monthlyBody = document.getElementById('attn-int-monthly-body');
    const approvalsBody = document.getElementById('attn-int-approvals-body');
    const errorsBody = document.getElementById('attn-int-errors-body');
    
    const loadingHtml = '<tr><td colspan="10" style="text-align:center; padding:3rem;"><i class="fas fa-spinner fa-spin"></i> 計算中...</td></tr>';
    if (dailyBody) dailyBody.innerHTML = loadingHtml;
    if (monthlyBody) monthlyBody.innerHTML = loadingHtml;
    if (approvalsBody) approvalsBody.innerHTML = loadingHtml;
    if (errorsBody) errorsBody.innerHTML = loadingHtml;

    try {
        // 1. スタッフマスターのロード（実績ある堅牢なマッピング）
        const userSnap = await getDocs(collection(db, 'm_users'));
        const staffMap = {};
        userSnap.forEach(d => {
            const data = d.data();
            const sid = data.EmployeeCode || data.staff_id || data.staff_code || data.UserId || data.id || d.id;
            const name = data.Name || data.name || data.staff_name || data.DisplayName || data.name_kanji || '(名前なし)';
            const sName = data.Store || data.store_name || "";
            const matchedStore = cachedStores.find(st => 
                st.store_name === sName || 
                st.id === data.StoreID || 
                st.store_id === data.StoreID
            );
            
            const sidStr = String(sid).trim();
            staffMap[sidStr] = { 
                code: sidStr, 
                name: String(name).trim(), 
                store_id: matchedStore ? (matchedStore.store_id || matchedStore.id) : (data.StoreID || matchedStore?.id || ""),
                store_name: matchedStore ? matchedStore.store_name : (data.Store || "不明")
            };
        });

        // 2. 打刻データのロード（前月末日 + 対象月の全件 + 翌月1日まで（夜勤対応））
        const startDate = `${month}-01`;
        const [yearStr, monthStr] = month.split('-');
        let year = parseInt(yearStr);
        let m = parseInt(monthStr);

        // タイムゾーンによる1日のズレを防ぎつつ、前月の末日（YYYY-MM-DD）を算出
        const prevMonthLastDate = new Date(year, m - 1, 0); // 0を指定すると前月の末日
        const prevMonthLastDay = `${prevMonthLastDate.getFullYear()}-${String(prevMonthLastDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthLastDate.getDate()).padStart(2, '0')}`;

        // 翌月1日を算出
        m++;
        if (m > 12) {
            m = 1;
            year++;
        }
        const nextMonthFirstDay = `${year}-${String(m).padStart(2, '0')}-01`;

        // 前月末日から翌月1日まで広範囲にロードすることで、月またぎ夜勤のペアリングを完璧に成立させる
        const q = query(collection(db, 't_attendance'), 
            where('date', '>=', prevMonthLastDay),
            where('date', '<=', nextMonthFirstDay)
        );
        const punchSnap = await getDocs(q);
        const punches = [];
        punchSnap.forEach(d => punches.push({ docId: d.id, ...d.data() }));

        const staffSessions = {}; // { staff_id: [ sessions ] }
        const staffMonthlyStats = {}; // { staff_id: { code, name, totalHours, lateHours, days: Set, ... } }
        
        Object.keys(staffMap).forEach(sid => {
            staffMonthlyStats[sid] = {
                code: staffMap[sid].code,
                name: staffMap[sid].name,
                store_id: staffMap[sid].store_id,
                store_name: staffMap[sid].store_name,
                totalHours: 0,
                lateHours: 0,
                days: new Set(),
                errors: [] // エラー情報
            };
            staffSessions[sid] = [];
        });

        // スタッフごとにグループ化
        const staffPunches = {};
        punches.forEach(p => {
            const sid = String(p.staff_id || p.staff_code || p.EmployeeCode || "").trim();
            if (!staffPunches[sid]) staffPunches[sid] = [];
            staffPunches[sid].push(p);
        });

        // 当日・夜勤のエラー除外用ヘルパー
        const nowTime = new Date();
        const todayYmd = nowTime.toLocaleDateString('sv-SE'); // YYYY-MM-DD
        const yesterdayTime = new Date(nowTime);
        yesterdayTime.setDate(yesterdayTime.getDate() - 1);
        const yesterdayYmd = yesterdayTime.toLocaleDateString('sv-SE');

        const isCurrentOrOngoing = (errDate, staffStoreId) => {
            const storeInfo = cachedStores.find(st => (st.store_id || st.id) === staffStoreId);
            const dayChangeTime = storeInfo?.day_change_time !== undefined ? parseInt(storeInfo.day_change_time) : 5;
            
            const currentHour = nowTime.getHours();
            if (currentHour < dayChangeTime) {
                return errDate === todayYmd || errDate === yesterdayYmd;
            } else {
                return errDate === todayYmd;
            }
        };

        // 既存の計算アルゴリズムを 100% そのまま走らせて集計（インテリジェント・当月内フィルタリングを適用）
        for (const [sid, records] of Object.entries(staffPunches)) {
            if (!staffMonthlyStats[sid]) continue;
            
            records.sort((a,b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
            
            let lastIn = null;
            let bStart = null;
            let breakSessions = [];

            records.forEach(r => {
                const ts = new Date(r.timestamp);
                const type = r.type;

                if (type === 'check_in' || type === '出勤') {
                    if (lastIn) {
                        const errDate = r.date || r.timestamp.substring(0,10);
                        if (!isCurrentOrOngoing(errDate, staffMap[sid].store_id)) {
                            // ★当月内のエラーのみ今月のリストに登録
                            if (errDate >= startDate && errDate < nextMonthFirstDay) {
                                staffMonthlyStats[sid].errors.push({
                                    date: errDate,
                                    type: 'double_check_in',
                                    message: '退勤打刻がないまま、出勤打刻が連続して行われています。'
                                });
                            }
                        }
                    }
                    lastIn = { timestamp: ts, record: r };
                    breakSessions = [];
                    
                    // ★当月の出勤のみ、今月の出勤日数にカウントする
                    if (r.date >= startDate && r.date < nextMonthFirstDay) {
                        staffMonthlyStats[sid].days.add(r.date);
                    }
                } 
                else if ((type === 'break_start' || type === '休憩開始') && lastIn) {
                    bStart = { timestamp: ts, record: r };
                }
                else if ((type === 'break_end' || type === '休憩終了') && bStart) {
                    breakSessions.push({ start: bStart.timestamp, end: ts, startRecord: bStart.record, endRecord: r });
                    bStart = null;
                }
                else if (type === 'check_out' || type === '退勤') {
                    if (lastIn) {
                        const totalBreaks = breakSessions.reduce((sum, s) => sum + (s.end - s.start) / 3600000, 0);
                        const grossShift = (ts - lastIn.timestamp) / 3600000;
                        const netLabor = Math.max(0, grossShift - totalBreaks);
                        
                        let lateLabor = 0;
                        if (netLabor > 0) {
                            const rawLate = calculateOverlapLateNightHours(lastIn.timestamp, ts);
                            const lateBreaks = breakSessions.reduce((sum, s) => sum + calculateOverlapLateNightHours(s.start, s.end), 0);
                            lateLabor = Math.max(0, rawLate - lateBreaks);
                            
                            // ★セッション開始日（出勤日）が当月内の場合のみ、今月の労働時間に加算する
                            const sessionDate = lastIn.record.date || lastIn.record.timestamp.substring(0, 10);
                            if (sessionDate >= startDate && sessionDate < nextMonthFirstDay) {
                                staffMonthlyStats[sid].totalHours += netLabor;
                                staffMonthlyStats[sid].lateHours += lateLabor;
                            }
                        }

                        staffSessions[sid].push({
                            date: lastIn.record.date || lastIn.record.timestamp.substring(0, 10),
                            checkIn: lastIn,
                            checkOut: { timestamp: ts, record: r },
                            breakSessions: breakSessions,
                            netLabor: netLabor,
                            lateLabor: lateLabor
                        });

                        lastIn = null;
                        breakSessions = [];
                    } else {
                        const errDate = r.date || r.timestamp.substring(0,10);
                        if (!isCurrentOrOngoing(errDate, staffMap[sid].store_id)) {
                            // ★当月内のエラーのみ今月のリストに登録
                            if (errDate >= startDate && errDate < nextMonthFirstDay) {
                                staffMonthlyStats[sid].errors.push({
                                    date: errDate,
                                    type: 'no_check_in',
                                    message: '出勤打刻がない状態で、退勤打刻が行われています。'
                                });
                            }
                        }
                    }
                }
            });

            if (lastIn) {
                const errDate = lastIn.record.date || lastIn.record.timestamp.substring(0,10);
                if (!isCurrentOrOngoing(errDate, staffMap[sid].store_id)) {
                    // ★当月内のエラーのみ今月のリストに登録
                    if (errDate >= startDate && errDate < nextMonthFirstDay) {
                        staffMonthlyStats[sid].errors.push({
                            date: errDate,
                            type: 'no_check_out',
                            message: '出勤打刻はありますが、退勤打刻が行われていません。'
                        });
                    }
                }
            }
        }

        // 3. 承認待ちデータの取得（リアルタイムリスナーのキャッシュ window.__pendingAttnRequests からの連携）
        const pendingRequests = window.__pendingAttnRequests || [];

        // 4. キャッシュに格納
        lastLoadedIntData = {
            staffMap: staffMap,
            staffMonthlyStats: staffMonthlyStats,
            staffSessions: staffSessions,
            pendingRequests: pendingRequests,
            month: month,
            date: date,
            storeId: storeId
        };

        // 新UIの承認タブバッジもリアルタイムで更新
        const intBadge = document.getElementById('badge-attn-int-approvals');
        if (intBadge) {
            intBadge.textContent = pendingRequests.length;
            intBadge.style.display = pendingRequests.length > 0 ? 'inline-block' : 'none';
        }

        // 描画実行
        renderIntActiveTab();

    } catch (e) {
        console.error("loadIntegratedData error:", e);
        const errHtml = `<tr><td colspan="10" style="color:var(--danger); text-align:center; padding:3rem;"><i class="fas fa-exclamation-triangle"></i> 読み込み失敗: ${e.message}</td></tr>`;
        if (dailyBody) dailyBody.innerHTML = errHtml;
        if (monthlyBody) monthlyBody.innerHTML = errHtml;
    }
}

// アクティブタブに応じた描画の振り分け
function renderIntActiveTab() {
    if (activeIntTab === 'daily') renderIntDaily();
    else if (activeIntTab === 'monthly') renderIntMonthly();
    else if (activeIntTab === 'approvals') renderIntApprovals();
    else if (activeIntTab === 'errors') renderIntErrors();
}

// 6-1. 日別データの描画
function renderIntDaily() {
    const data = lastLoadedIntData;
    const body = document.getElementById('attn-int-daily-body');
    if (!body || !data) return;

    const storeId = data.storeId;
    const date = data.date;

    const activeStaff = Object.values(data.staffMap).filter(s => {
        return !storeId || String(s.store_id) === String(storeId);
    });

    body.innerHTML = '';

    if (activeStaff.length === 0) {
        body.innerHTML = '<tr><td colspan="8" style="padding:3rem; text-align:center; color:var(--text-secondary);">該当店舗の従業員データがありません。</td></tr>';
        return;
    }

    activeStaff.sort((a,b) => a.code.localeCompare(b.code)).forEach(s => {
        const mySessions = data.staffSessions[s.code] || [];
        const todaySession = mySessions.find(sess => sess.date === date);

        let checkInStr = '-';
        let checkOutStr = '-';
        let laborStr = '-';
        let lateStr = '-';

        if (todaySession) {
            checkInStr = todaySession.checkIn.record.timestamp.substring(11, 16);
            checkOutStr = todaySession.checkOut.record.timestamp.substring(11, 16);
            laborStr = `${todaySession.netLabor.toFixed(2)}h`;
            lateStr = todaySession.lateLabor > 0 ? `${todaySession.lateLabor.toFixed(2)}h` : '-';
        }

        const tr = document.createElement('tr');
        const btnLabel = canDirectEdit ? '実績編集' : '修正依頼';
        const btnIcon = canDirectEdit ? 'fa-edit' : 'fa-paper-plane';

        tr.innerHTML = `
            <td style="font-family: monospace; font-size: 0.85rem;">${s.code}</td>
            <td style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${s.name}</td>
            <td style="color: var(--text-secondary); font-size: 0.85rem;">${s.store_name}</td>
            <td style="font-weight: 600; font-size: 0.85rem; color: #475569;">${checkInStr}</td>
            <td style="font-weight: 600; font-size: 0.85rem; color: #475569;">${checkOutStr}</td>
            <td style="text-align: right; font-weight: 700; color: var(--text-primary);">${laborStr}</td>
            <td style="text-align: right; font-weight: 700; color: var(--primary);">${lateStr}</td>
            <td style="text-align: center;">
                <button class="btn" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; background: rgba(99, 102, 241, 0.08); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 6px; font-weight: 700; transition: all 0.2s;" onclick="window.openStaffEdit('${s.code}', '${s.name}', '${date}')">
                    <i class="fas ${btnIcon}"></i> ${btnLabel}
                </button>
            </td>
        `;
        body.appendChild(tr);
    });
}

// 6-2. 月別集計の描画
function renderIntMonthly() {
    const data = lastLoadedIntData;
    const body = document.getElementById('attn-int-monthly-body');
    if (!body || !data) return;

    const storeId = data.storeId;
    const activeStaff = Object.values(data.staffMap).filter(s => {
        return !storeId || String(s.store_id) === String(storeId);
    });

    body.innerHTML = '';

    if (activeStaff.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="padding:3rem; text-align:center; color:var(--text-secondary);">該当店舗の従業員データがありません。</td></tr>';
        return;
    }

    activeStaff.sort((a,b) => a.code.localeCompare(b.code)).forEach(s => {
        const stats = data.staffMonthlyStats[s.code];
        
        let daysCount = 0;
        let hoursCount = 0;
        let lateCount = 0;

        if (stats) {
            daysCount = stats.days.size;
            hoursCount = stats.totalHours;
            lateCount = stats.lateHours;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: monospace; font-size: 0.85rem;">${s.code}</td>
            <td style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${s.name}</td>
            <td style="color: var(--text-secondary); font-size: 0.85rem;">${s.store_name}</td>
            <td style="text-align: right; font-weight: 600; color: #475569;">${daysCount}日</td>
            <td style="text-align: right; font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${hoursCount.toFixed(2)}h</td>
            <td style="text-align: right; font-weight: 700; color: var(--primary); font-size: 0.9rem;">${lateCount.toFixed(2)}h</td>
            <td style="text-align: center;">
                <button class="btn" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; background: #f1f5f9; color: #475569; border: 1px solid var(--border); border-radius: 6px; font-weight: 700;" onclick="window.switchToDailyFromIntMonthly('${s.store_name}', '${data.month}-01')">
                    <i class="fas fa-search"></i> 日別で表示
                </button>
            </td>
        `;
        body.appendChild(tr);
    });
}

window.switchToDailyFromIntMonthly = (storeName, dateYmd) => {
    const store = cachedStores.find(st => (st.store_name || st.Store) === storeName);
    if (store) {
        document.getElementById('attn-int-store-filter').value = store.store_id || store.id;
    }
    document.getElementById('attn-int-date-select').value = dateYmd;
    
    document.querySelectorAll('.attn-int-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === 'daily');
    });
    activeIntTab = 'daily';
    const dateFilterGroup = document.getElementById('attn-int-date-filter-group');
    if (dateFilterGroup) dateFilterGroup.style.display = 'block';
    
    switchIntTabPane();
    loadIntegratedData();
};

// 6-3. 修正承認待ちの描画
function renderIntApprovals() {
    const data = lastLoadedIntData;
    const body = document.getElementById('attn-int-approvals-body');
    if (!body || !data) return;

    const requests = data.pendingRequests || [];

    const badge = document.getElementById('badge-attn-int-approvals');
    if (badge) {
        badge.textContent = requests.length;
        badge.style.display = requests.length > 0 ? 'inline-block' : 'none';
    }

    if (requests.length === 0) {
        body.innerHTML = '<tr><td colspan="4" style="padding:3rem; text-align:center; color:var(--text-secondary);">現在、承認待ちの申請はありません。</td></tr>';
        return;
    }

    body.innerHTML = requests.map(req => {
        const punches = req.requested_punches || [];
        
        let punchDetails = '';
        if (punches.length === 0) {
            punchDetails = '<div style="color:var(--text-secondary); font-style:italic;">(打刻データなし)</div>';
        } else {
            punchDetails = punches.map(p => {
                const ts = p.timestamp || '';
                const timeStr = (typeof ts === 'string' && ts.length >= 16) ? ts.substring(11, 16) : '--:--';
                if (p.deleteRequest) {
                    return `<span style="color:var(--danger); margin-right:1rem; font-weight:700; background:rgba(239, 68, 68, 0.08); padding:2px 8px; border-radius:4px; border:1px solid rgba(239, 68, 68, 0.2); display:inline-block; font-size:0.75rem;">
                        <i class="fas fa-trash-alt"></i> 削除: ${p.type} (${timeStr})
                    </span>`;
                } else {
                    return `<span style="color:#6366f1; margin-right:1rem; font-weight:700; background:rgba(99, 102, 241, 0.08); padding:2px 8px; border-radius:4px; border:1px solid rgba(99, 102, 241, 0.2); display:inline-block; font-size:0.75rem;">
                        <i class="fas fa-plus-circle"></i> 追加: ${p.type} (${timeStr})
                    </span>`;
                }
            }).join(' ');
        }

        const targetDate = req.date || req.target_date || '-';
        const requester = req.requested_by_name || req.requester_name || '店長';

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                <td style="padding: 1rem; display: flex; gap: 0.5rem; justify-content: center; align-items: center; min-height:60px;">
                    <button class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:#10b981; border:none; box-shadow: 0 2px 6px rgba(16,185,129,0.15);" onclick="window.processAttnIntApproval('${req.id}', 'approve')">
                        <i class="fas fa-check"></i> 承認
                    </button>
                    <button class="btn" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:#fef2f2; color:#ef4444; border:1px solid #fee2e2;" onclick="window.processAttnIntApproval('${req.id}', 'reject')">
                        <i class="fas fa-times"></i> 却下
                    </button>
                </td>
                <td style="padding: 1.1rem 1rem; font-weight: 800; color: #1e293b; font-size: 0.9rem;">
                    ${targetDate}
                </td>
                <td style="padding: 1rem;">
                    <div style="font-weight: 800; color: var(--text-primary);">${req.staff_name || '不明'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-family: monospace;">コード: ${req.staff_id || '-'}</div>
                </td>
                <td style="padding: 1rem; font-size: 0.85rem;">
                    <div style="margin-bottom:0.5rem; font-size: 0.75rem; color:var(--text-secondary);">
                        <i class="fas fa-user-edit"></i> 申請者: ${requester} (${safeFormatDate(req.created_at)})
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:0.3rem;">
                        ${punchDetails}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.processAttnIntApproval = async (requestId, action) => {
    await window.processAttnApproval(requestId, action);
    await loadIntegratedData();
};

// 6-4. エラーチェックの描画
function renderIntErrors() {
    const data = lastLoadedIntData;
    const body = document.getElementById('attn-int-errors-body');
    if (!body || !data) return;

    body.innerHTML = '';
    
    let errorRowsHtml = '';
    let errorCount = 0;

    Object.values(data.staffMap).forEach(s => {
        const stats = data.staffMonthlyStats[s.code];
        if (stats && stats.errors && stats.errors.length > 0) {
            stats.errors.forEach(err => {
                if (data.storeId && String(s.store_id) !== String(data.storeId)) return;
                
                errorCount++;
                errorRowsHtml += `
                    <tr>
                        <td style="font-weight: 700; color: #1e293b;">${err.date}</td>
                        <td style="font-weight: 800; color: var(--text-primary);">${s.name}</td>
                        <td style="color: var(--text-secondary); font-size: 0.85rem;">${s.store_name}</td>
                        <td>
                            <span style="color: var(--danger); font-weight: 700; background: rgba(239, 68, 68, 0.08); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2); font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.4rem;">
                                <i class="fas fa-exclamation-triangle"></i> ${err.message}
                            </span>
                        </td>
                        <td style="text-align: center;">
                            <button class="btn" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; background: rgba(239, 68, 68, 0.08); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; font-weight: 700;" onclick="window.openStaffEdit('${s.code}', '${s.name}', '${err.date}')">
                                <i class="fas fa-edit"></i> 修正する
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
    });

    if (errorCount === 0) {
        body.innerHTML = '<tr><td colspan="5" style="padding: 3rem; text-align: center; color: #10b981; font-weight: 700;"><i class="fas fa-check-circle"></i> エラーは検出されていません。すべての打刻データが正常に整合しています。</td></tr>';
    } else {
        body.innerHTML = errorRowsHtml;
    }
}

// CSV出力用のモーダル開閉
function openIntCsvModal() {
    const modal = document.getElementById('attn-int-csv-modal');
    if (!modal) return;
    
    // 対象店舗を新UIの共通フィルターから引き継ぐ
    const activeStore = document.getElementById('attn-int-store-filter')?.value || '';
    const modalStore = document.getElementById('attn-int-csv-store');
    if (modalStore) modalStore.value = activeStore;
    
    // 現在選択されている対象月を取得して、前月21日〜当月20日をプリセット
    const monthVal = document.getElementById('attn-int-month-select')?.value;
    if (monthVal) {
        const [yearStr, monthStr] = monthVal.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear -= 1;
        }
        
        const startYmd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-21`;
        const endYmd = `${year}-${String(month).padStart(2, '0')}-20`;
        
        const startInput = document.getElementById('attn-int-csv-start');
        const endInput = document.getElementById('attn-int-csv-end');
        if (startInput) startInput.value = startYmd;
        if (endInput) endInput.value = endYmd;
    }
    
    modal.classList.add('show');
}

function closeIntCsvModal() {
    const modal = document.getElementById('attn-int-csv-modal');
    if (modal) modal.classList.remove('show');
}

// CSV出力アクション（モーダルの期間指定・店舗指定に基づき、既存実績ロジックを100%踏襲して出力）
async function handleIntTkcExport() {
    const startDate = document.getElementById('attn-int-csv-start')?.value;
    const endDate = document.getElementById('attn-int-csv-end')?.value;
    const storeId = document.getElementById('attn-int-csv-store')?.value || ''; // モーダル内の店舗選択
    
    if (!startDate || !endDate) {
        return showAlert('警告', 'CSV出力期間（開始日・終了日）を入力してください。');
    }

    const btn = document.getElementById('btn-attn-int-csv-download');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 出力中...';

    try {
        // 1. スタッフマスターのロード（実績ある堅牢なマッピング）
        const userSnap = await getDocs(collection(db, 'm_users'));
        const staffMap = {};
        userSnap.forEach(d => {
            const data = d.data();
            const sid = data.EmployeeCode || data.staff_id || data.staff_code || data.UserId || data.id || d.id;
            const name = data.Name || data.name || data.staff_name || data.DisplayName || data.name_kanji || '(名前なし)';
            const sName = data.Store || data.store_name || "";
            const matchedStore = cachedStores.find(st => 
                st.store_name === sName || 
                st.id === data.StoreID || 
                st.store_id === data.StoreID
            );
            
            const sidStr = String(sid).trim();
            staffMap[sidStr] = { 
                code: sidStr, 
                name: String(name).trim(), 
                store_id: matchedStore ? (matchedStore.store_id || matchedStore.id) : (data.StoreID || matchedStore?.id || ""),
                store_name: matchedStore ? matchedStore.store_name : (data.Store || "不明")
            };
        });

        // 2. 打刻データの取得（翌日分まで取得して夜勤に対応）
        const nextDay = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
        
        // dateフィールドでフィルタ
        const q = query(collection(db, 't_attendance'), 
            where('date', '>=', startDate),
            where('date', '<=', nextDay)
        );
        const punchSnap = await getDocs(q);
        const punches = [];
        punchSnap.forEach(d => punches.push({ docId: d.id, ...d.data() }));
        
        punches.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

        // 3. 集計ロジック（エラーチェックも同時に実行）
        const staffStats = {};
        Object.keys(staffMap).forEach(sid => {
            staffStats[sid] = {
                code: staffMap[sid].code,
                name: staffMap[sid].name,
                store_id: staffMap[sid].store_id,
                store_name: staffMap[sid].store_name,
                totalHours: 0,
                lateHours: 0,
                days: new Set()
            };
        });

        const exportErrors = []; // 不整合エラーの一時収集配列

        // 進行中の夜勤（当日・前日の夜勤中データ）をエラーから除外するための判定用
        const nowTime = new Date();
        const todayYmd = nowTime.toLocaleDateString('sv-SE');
        const yesterdayTime = new Date(nowTime);
        yesterdayTime.setDate(yesterdayTime.getDate() - 1);
        const yesterdayYmd = yesterdayTime.toLocaleDateString('sv-SE');

        const isCurrentOrOngoing = (errDate, staffStoreId) => {
            const storeInfo = cachedStores.find(st => (st.store_id || st.id) === staffStoreId);
            const dayChangeTime = storeInfo?.day_change_time !== undefined ? parseInt(storeInfo.day_change_time) : 5;
            
            const currentHour = nowTime.getHours();
            if (currentHour < dayChangeTime) {
                return errDate === todayYmd || errDate === yesterdayYmd;
            } else {
                return errDate === todayYmd;
            }
        };

        // スタッフごとにグループ化
        const staffPunches = {};
        punches.forEach(p => {
            const sid = String(p.staff_id || p.staff_code || p.EmployeeCode || "").trim();
            if (!staffPunches[sid]) staffPunches[sid] = [];
            staffPunches[sid].push(p);
        });

        for (const [sid, records] of Object.entries(staffPunches)) {
            if (!staffStats[sid]) continue;

            let lastIn = null;
            let breakStart = null;
            let breakSessions = [];

            for (const p of records) {
                const type = p.type;
                const time = new Date(p.timestamp);

                if (type === 'check_in' || type === '出勤') {
                    if (p.date < startDate || p.date > endDate) {
                        lastIn = null;
                        continue;
                    }
                    if (lastIn) {
                        // エラー：連続出勤（未退勤）
                        const errDate = p.date || p.timestamp.substring(0, 10);
                        if (!isCurrentOrOngoing(errDate, staffMap[sid].store_id)) {
                            exportErrors.push({
                                staffName: staffMap[sid].name,
                                staffCode: staffMap[sid].code,
                                storeId: staffMap[sid].store_id,
                                date: errDate,
                                message: '退勤打刻がないまま、出勤打刻が連続して行われています。'
                            });
                        }
                    }
                    lastIn = { timestamp: time, record: p };
                    breakSessions = [];
                    staffStats[sid].days.add(p.date);
                } 
                else if ((type === 'break_start' || type === '休憩開始') && lastIn) {
                    breakStart = time;
                } 
                else if ((type === 'break_end' || type === '休憩終了') && breakStart) {
                    breakSessions.push({ start: breakStart, end: time });
                    breakStart = null;
                } 
                else if (type === 'check_out' || type === '退勤') {
                    if (lastIn) {
                        const totalBreaks = breakSessions.reduce((sum, s) => sum + (s.end - s.start) / 3600000, 0);
                        const totalShift = (time - lastIn.timestamp) / 3600000;
                        const netLabor = totalShift - totalBreaks;
                        
                        if (netLabor > 0) {
                            staffStats[sid].totalHours += netLabor;
                            
                            const rawLate = calculateOverlapLateNightHours(lastIn.timestamp, time);
                            const lateBreaks = breakSessions.reduce((sum, s) => sum + calculateOverlapLateNightHours(s.start, s.end), 0);
                            
                            staffStats[sid].lateHours += Math.max(0, rawLate - lateBreaks);
                        }
                        lastIn = null;
                        breakSessions = [];
                    } else {
                        // エラー：出勤なし退勤
                        const errDate = p.date || p.timestamp.substring(0, 10);
                        if (errDate >= startDate && errDate <= endDate) {
                            if (!isCurrentOrOngoing(errDate, staffMap[sid].store_id)) {
                                exportErrors.push({
                                    staffName: staffMap[sid].name,
                                    staffCode: staffMap[sid].code,
                                    storeId: staffMap[sid].store_id,
                                    date: errDate,
                                    message: '出勤打刻がない状態で、退勤打刻が行われています。'
                                });
                            }
                        }
                    }
                }
            }

            if (lastIn) {
                // エラー：出勤はあるが退勤なし
                const errDate = lastIn.record.date || lastIn.record.timestamp.substring(0, 10);
                if (!isCurrentOrOngoing(errDate, staffMap[sid].store_id)) {
                    exportErrors.push({
                        staffName: staffMap[sid].name,
                        staffCode: staffMap[sid].code,
                        storeId: staffMap[sid].store_id,
                        date: errDate,
                        message: '出勤打刻はありますが、退勤打刻が行われていません。'
                    });
                }
            }
        }

        // 4. エラー検証および出力ブロック処理
        let filteredErrors = exportErrors;
        if (storeId) {
            filteredErrors = exportErrors.filter(e => String(e.storeId) === String(storeId));
        }

        if (filteredErrors.length > 0) {
            btn.disabled = false;
            btn.innerHTML = originalText;

            const errLimit = 3;
            let errMsg = `指定期間内に打刻エラー（未退勤・未出勤など）が <strong>${filteredErrors.length}件</strong> 検出されたため、CSV出力をブロックしました。<br><br>`;
            
            filteredErrors.slice(0, errLimit).forEach(e => {
                errMsg += `・[${e.date}] <strong>${e.staffName}様</strong>: ${e.message}<br>`;
            });

            if (filteredErrors.length > errLimit) {
                errMsg += `・他 ${filteredErrors.length - errLimit} 件のエラー<br>`;
            }

            errMsg += `<br>ダッシュボードの<strong>「エラーチェック」</strong>タブ、または<strong>「日別データ」</strong>にて不整合を修正してから、再度出力してください。`;

            return showAlert('CSV出力ブロック (未修正エラーあり)', errMsg);
        }

        // 店舗フィルタリング
        let filteredStats = Object.values(staffStats);
        if (storeId) {
            filteredStats = filteredStats.filter(s => String(s.store_id) === String(storeId));
        }

        // CSV生成
        let csvContent = "\uFEFF"; // BOM for Excel
        csvContent += "従業員コード,名前,総労働時間,総労働時間（深夜）,出勤日数\n";

        filteredStats.sort((a, b) => a.code.localeCompare(b.code)).forEach(row => {
            const line = [
                row.code,
                row.name,
                row.totalHours.toFixed(2),
                row.lateHours.toFixed(2),
                row.days.size
            ].join(",");
            csvContent += line + "\n";
        });

        const storeInfo = cachedStores.find(s => (s.store_id || s.id) === storeId);
        const storeSuffix = storeInfo ? `_${storeInfo.store_name}` : '_全店舗';
        const filename = `勤怠データ_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}${storeSuffix}.csv`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        closeIntCsvModal();
        showAlert('成功', 'CSVの出力が完了しました。');

    } catch (e) {
        console.error(e);
        showAlert('エラー', 'CSVの出力に失敗しました: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}


