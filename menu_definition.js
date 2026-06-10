/**
 * かね将ポータル 全メニュー・ハブ構成定義
 * 
 * すべてのサイドバー表示、ハブ画面内のタイル表示、権限設定画面のツリー型UIは
 * この定義ファイルから動的に生成されます。
 */

export const MENU_DEFINITION = [
    {
        id: 'home',
        name: 'メインホーム',
        icon: 'fa-home',
        type: 'hub',
        desc: 'ポータルのメインホーム画面',
        items: [
            { id: 'home_performance', name: 'ホーム実績サマリー表示', icon: 'fa-eye-slash', desc: 'ホーム画面での営業実績サマリーの表示' },
            { id: 'my_page', name: 'マイページ', icon: 'fa-user', color: '#3b82f6', desc: '現在の等級、過去の評価シートの確認' }
        ]
    },
    {
        id: 'ops_hub',
        name: '店舗業務',
        icon: 'fa-store',
        type: 'hub',
        desc: '当日の営業・在庫・レシピに関する操作',
        items: [
            { id: 'attendance', name: '勤怠入力(打刻)', icon: 'fa-clock', color: '#ff5a5f', desc: '出退勤の打刻を行います' },
            { id: 'sales', name: '営業実績報告', icon: 'fa-calculator', color: '#f59e0b', desc: '売上・人数・客単価の報告' },
            { id: 'ops_hub_main', name: '在庫・調達', icon: 'fa-boxes-stacked', color: '#10b981', desc: '在庫チェック、移動、仕入れ、仕込みを一括管理' },
            { id: 'stocktake', name: '棚卸し履歴', icon: 'fa-history', color: '#8b5cf6', desc: '日次棚卸し額の記録・推移確認' },
            { id: 'inventory_history', name: '在庫履歴', icon: 'fa-list-alt', color: '#64748b', desc: '在庫増減の全履歴ログ' },
            { id: 'recipe_viewer', name: 'レシピ閲覧', icon: 'fa-book-open', color: '#ec4899', desc: 'メニュー情報の確認' },
            { id: 'menu_order', name: 'メニュー並び順', icon: 'fa-sort-amount-down', color: '#4b5563', desc: 'メニューの表示順設定' }
        ]
    },
    {
        id: 'special_hub',
        name: '店舗個別メニュー',
        icon: 'fa-cubes',
        type: 'hub',
        desc: '店舗ごとにカスタマイズ・導入されている個別の独自メニュー',
        items: [
            { id: 'daily_sakes', name: '日本酒管理', icon: 'fa-wine-glass-alt', color: '#10b981', desc: 'その日の日本酒のラインナップ・残量などを管理します', showInSidebar: true },
            { id: 'bottle_keep', name: 'ボトルキープ', icon: 'fa-wine-bottle', color: '#ff5a5f', desc: 'お客様のキープボトル配置・期限管理を行います', showInSidebar: true }
        ]
    },
    {
        id: 'hr_hub',
        name: '人事総務',
        icon: 'fa-user-friends',
        type: 'hub',
        desc: '従業員管理・労務・評価などの管理',
        sections: [
            {
                title: '勤怠・労務管理',
                icon: 'fa-user-clock',
                items: [
                    { id: 'attendance_management', name: '勤怠管理', icon: 'fa-user-clock', color: '#6366f1', desc: '全従業員の勤怠実績確認・修正・承認' },
                    { id: 'attendance_direct_edit', name: '[機能] 勤怠の直接編集(管理者用)', icon: 'fa-check-double', color: '#6366f1', desc: '勤怠データの直接書き換え権限' },
                    { id: 'attendance_check', name: '勤怠状況確認', icon: 'fa-clipboard-check', color: '#6366f1', desc: '従業員ごとの勤怠打刻ログの照会' },
                    { id: 'shift_submission', name: 'シフト提出・確認', icon: 'fa-calendar-alt', color: '#6366f1', desc: '従業員からのシフト希望の提出・確認', showInSidebar: true },
                    { id: 'attendance_approval', name: '勤怠修正承認', icon: 'fa-check-double', color: '#10b981', isComingSoon: true, desc: '勤怠修正の承認機能' },
                    { id: 'paid_leave_mgmt', name: '有給管理', icon: 'fa-umbrella-beach', color: '#0ea5e9', isComingSoon: true, desc: '有給休暇の付与・消化管理' },
                    { id: 'health_checkup', name: '健康診断受診', icon: 'fa-notes-medical', color: '#ef4444', isComingSoon: true, desc: '健康診断の受診履歴・案内管理' }
                ]
            },
            {
                title: '従業員・組織管理',
                icon: 'fa-sitemap',
                items: [
                    { id: 'users', name: 'ユーザー・従業員管理', icon: 'fa-users-cog', color: '#14b8a6', desc: '従業員アカウントの登録・編集' },
                    { id: 'invite_navi', name: '従業員への招待案内', icon: 'fa-paper-plane', color: '#3b82f6', desc: '新規スタッフへの招待メール送信・管理' },
                    { id: 'role_permissions', name: '権限振り分け設定', icon: 'fa-user-shield', color: '#ef4444', desc: 'ロール（役職）ごとのアクセス権限管理' },
                    { id: 'grades', name: '等級マスタ (給与テーブル)', icon: 'fa-table', color: '#f59e0b', desc: '等級別の給与テーブル管理' },
                    { id: 'org_chart', name: '組織図', icon: 'fa-network-wired', color: '#8b5cf6', isComingSoon: true, desc: '社内組織図の表示' }
                ]
            },
            {
                title: '教育・評価',
                icon: 'fa-graduation-cap',
                items: [
                    { id: 'skills', name: 'スキルマスタ設定', icon: 'fa-list-check', color: '#8b5cf6', desc: '業務スキル項目のマスタ設定' },
                    { id: 'exams_admin', name: 'テスト受験・管理', icon: 'fa-vials', color: '#f59e0b', isComingSoon: true, desc: '社内検定テストの実施・結果管理' },
                    { id: 'evaluation', name: 'スタッフ評価システム', icon: 'fa-star', color: '#ec4899', desc: '従業員人事評価' },
                    { id: 'training_progress', name: '研修進捗管理', icon: 'fa-chart-line', color: '#10b981', isComingSoon: true, desc: '新入社員の研修ステップ進捗' }
                ]
            },
            {
                title: '書類・資産管理',
                icon: 'fa-file-signature',
                items: [
                    { id: 'loans', name: '貸与物管理(アセット)', icon: 'fa-key', color: '#8b5cf6', desc: '鍵、スマホ、備品などの貸与履歴管理' },
                    { id: 'doc_gen', name: '書類作成(雇用契約書等)', icon: 'fa-file-pdf', color: '#ef4444', isComingSoon: true, desc: '契約書類の自動生成' }
                ]
            }
        ]
    },
    {
        id: 'manager_hub',
        name: 'マネジメント',
        icon: 'fa-user-tie',
        type: 'hub',
        desc: '店舗運営計画・経営分析・シフト管理',
        sections: [
            {
                title: '店舗経営',
                icon: 'fa-store',
                items: [
                    { id: 'dashboard', name: '分析ダッシュボード', icon: 'fa-chart-line', color: '#3b82f6', desc: '売上・客数・客単価などの分析ダッシュボード' },
                    { id: 'manager_meeting', name: '店舗PDCA', icon: 'fa-sync-alt', color: '#14b8a6', desc: '店長会議用のPDCA進捗・議事録管理' }
                ]
            },
            {
                title: '勤務・シフト管理',
                icon: 'fa-calendar-alt',
                items: [
                    { id: 'shift_admin', name: 'シフト作成・調整', icon: 'fa-user-edit', color: '#ec4899', desc: '月間・週間の従業員シフト作成・調整' },
                    { id: 'attendance_correction_request', name: '勤怠の修正申請', icon: 'fa-paper-plane', color: '#6366f1', desc: '店長からの勤怠修正申請の提出権限' }
                ]
            },
            {
                title: '目標・実績管理',
                icon: 'fa-chart-line',
                items: [
                    { id: 'goals_store', name: '月次計画(店長用)', icon: 'fa-tasks', color: '#f97316', desc: '月次店舗目標の按分シミュレーション' }
                ]
            }
        ]
    },
    {
        id: 'utility_hub',
        name: '便利機能',
        icon: 'fa-lightbulb',
        type: 'hub',
        desc: '従業員のナレッジ共有・シミュレーションツール',
        items: [
            { id: 'prototype_menu', name: 'メニュー試作', icon: 'fa-flask', color: '#f59e0b', desc: '新メニューの原価計算シミュレーター' },
            { id: 'competitor_list', name: '行きたい店リスト', icon: 'fa-map-marked-alt', color: '#3b82f6', desc: '競合店・他店の視察メモ共有' }
        ]
    },
    {
        id: 'manual_hub',
        name: 'マニュアル',
        icon: 'fa-book',
        type: 'hub',
        desc: '業務マニュアル、各種手順書',
        items: [
            { id: 'manual_viewer', name: 'マニュアル閲覧', icon: 'fa-book-open', color: '#64748b', desc: '業務マニュアルの検索・閲覧' }
        ]
    },
    {
        id: 'master_hub',
        name: '設定',
        icon: 'fa-cog',
        type: 'hub',
        desc: 'システム基盤・マスタデータの管理',
        items: [
            { id: 'stores', name: '店舗マスタ', icon: 'fa-store-alt', color: '#4b5563', desc: '店舗情報の追加・編集' },
            { id: 'products', name: '商品・レシピマスタ', icon: 'fa-mortar-pestle', color: '#4b5563', desc: '商品アイテムやレシピ構成の登録・管理' },
            { id: 'suppliers', name: '業者マスタ', icon: 'fa-truck', color: '#4b5563', desc: '仕入れ先・業者情報の管理' },
            { id: 'store_items', name: '店舗別在庫設定', icon: 'fa-boxes-stacked', color: '#4b5563', desc: '店舗ごとの取扱商品・初期在庫設定' },
            { id: 'sales_correction', name: '営業実績修正', icon: 'fa-edit', color: '#4b5563', desc: '過去の確定実績データの修正' },
            { id: 'csv_export', name: 'CSV出力', icon: 'fa-file-csv', color: '#4b5563', desc: '各種データのCSVダウンロード' },
            { id: 'csv_import', name: 'CSVインポート', icon: 'fa-file-import', color: '#4b5563', desc: 'データの一括インポート' },
            { id: 'calendar_admin', name: '営業カレンダー作成', icon: 'fa-calendar-plus', color: '#4b5563', desc: '年間休日・イベント設定' },
            { id: 'goals_admin', name: '目標設定 (社長用)', icon: 'fa-bullseye', color: '#4b5563', desc: '全社・店舗別の年間目標値設定' },
            { id: 'product_analysis', name: '商品分析（4つの窓）', icon: 'fa-chart-pie', color: '#4b5563', desc: '売上データのABC分析（4つの窓）' }
        ]
    },
    {
        id: 'quick_actions',
        name: 'クイック操作 (FAB)',
        icon: 'fa-fingerprint',
        type: 'virtual_hub',
        desc: '画面右下のフローティングアクションボタン（FAB）からのショートカット操作',
        items: [
            { id: 'fab_attendance', name: '[クイック操作] 出退勤打刻', icon: 'fa-fingerprint', desc: 'FAB経由の出退勤打刻' },
            { id: 'fab_sales', name: '[クイック操作] 営業実績報告', icon: 'fa-calculator', desc: 'FAB経由の営業実績報告' },
            { id: 'fab_inventory', name: '[クイック操作] 棚卸・在庫登録', icon: 'fa-warehouse', desc: 'FAB経由の棚卸・在庫登録' }
        ]
    }
];

/**
 * ページIDと親ハブIDの対応マップを動的にビルドする
 */
export function getPageParentMap() {
    const map = {};
    MENU_DEFINITION.forEach(hub => {
        // virtual_hub 以外の通常のハブに属するものをマッピングする
        if (hub.type === 'hub') {
            if (hub.sections) {
                hub.sections.forEach(sec => {
                    sec.items.forEach(item => {
                        map[item.id] = hub.id;
                    });
                });
            } else if (hub.items) {
                hub.items.forEach(item => {
                    map[item.id] = hub.id;
                });
            }
        }
    });
    // 特殊な親ページマッピングの手動補正
    map['inventory'] = 'ops_hub';
    map['procurement'] = 'ops_hub';
    map['calendar_viewer'] = 'ops_hub';
    map['shift_viewer'] = 'hr_hub';
    return map;
}

/**
 * 全機能ID（ハブID含む）のフラットなリストを取得する（Admin用などのフルパーミッションリスト生成に使用）
 */
export function getAllPermissionIds() {
    const ids = [];
    MENU_DEFINITION.forEach(hub => {
        ids.push(hub.id);
        if (hub.sections) {
            hub.sections.forEach(sec => {
                sec.items.forEach(item => {
                    ids.push(item.id);
                });
            });
        } else if (hub.items) {
            hub.items.forEach(item => {
                ids.push(item.id);
            });
        }
    });
    // 特殊な画面IDの追加
    const extraIds = ['inventory', 'procurement', 'calendar_viewer', 'shift_viewer', 'line_share'];
    extraIds.forEach(id => {
        if (!ids.includes(id)) ids.push(id);
    });
    return ids;
}
