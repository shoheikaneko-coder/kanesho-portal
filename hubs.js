import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * HubページのHTMLテンプレートを生成する
 */
export const hubPageHtml = (title, description) => `
    <div class="hub-page animate-fade-in" style="max-width: 1200px; margin: 0 auto; padding-bottom: 5rem; padding-top: 1.5rem;">
        
        <div id="hub-content-grid" class="menu-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem;">
            <!-- Hubカードがここに動的に生成される -->
        </div>
    </div>
`;

/**
 * 各Hubの内容を定義
 */
const HUB_CONFIG = {
    'ops_hub': {
        title: '店舗業務',
        description: '当日の営業・在庫・レシピに関する操作',
        items: [
            { id: 'attendance', name: '勤怠入力(打刻)', icon: 'fa-clock', color: '#ff5a5f', desc: '出退勤の打刻を行います' },
            { id: 'sales', name: '営業実績報告', icon: 'fa-calculator', color: '#f59e0b', desc: '売上・人数・客単価の報告' },
            { id: 'inventory', name: '在庫チェック', icon: 'fa-warehouse', color: '#10b981', desc: '現在庫の入力・確認・不足検知' },
            { id: 'procurement', name: '仕入れ・仕込み', icon: 'fa-shopping-cart', color: '#3b82f6', desc: '不足品目の仕入れ・仕込み・移動' },
            { id: 'stocktake', name: '棚卸し履歴', icon: 'fa-history', color: '#8b5cf6', desc: '日次棚卸し額の記録・推移確認' },
            { id: 'inventory_history', name: '在庫履歴', icon: 'fa-list-alt', color: '#64748b', desc: '在庫増減の全履歴ログ' },
            { id: 'recipe_viewer', name: 'レシピ閲覧', icon: 'fa-book-open', color: '#ec4899', desc: 'メニュー情報の確認' },
            { id: 'manager_meeting', name: '店長会議資料', icon: 'fa-file-signature', color: '#14b8a6', desc: '実績とPDCAの入力・印刷' },
            { id: 'goals_store', name: '月次計画(店長用)', icon: 'fa-tasks', color: '#f97316', desc: '目標管理と按分シミュ' }
        ]
    },
    'hr_hub': {
        title: '人事総務業務',
        description: '従業員管理・貸与物・権限の管理',
        items: [
            { id: 'attendance_check', name: '勤怠状況確認', icon: 'fa-clipboard-check', color: '#6366f1', desc: '全スタッフの出勤状況' },
            { id: 'users', name: 'ユーザー・従業員管理', icon: 'fa-users-cog', color: '#14b8a6', desc: 'スタッフ登録とステータス管理' },
            { id: 'loans', name: '貸与物管理(アセット)', icon: 'fa-key', color: '#8b5cf6', desc: '制服・鍵等の貸与状況' },
            { id: 'role_permissions', name: '権限振り分け設定', icon: 'fa-user-shield', color: '#ef4444', desc: 'アクセス制限・役職設定' }
        ]
    },
    'master_hub': {
        title: '設定・マスタ',
        description: 'システム基盤・マスタデータの管理',
        items: [
            { id: 'stores', name: '店舗マスタ', icon: 'fa-store-alt', color: '#4b5563', desc: '店舗情報の追加・編集' },
            { id: 'products', name: '商品・レシピマスタ', icon: 'fa-mortar-pestle', color: '#4b5563', desc: 'アイテム・レシピ登録' },
            { id: 'suppliers', name: '業者マスタ', icon: 'fa-truck', color: '#4b5563', desc: '取引先情報の管理' },
            { id: 'store_items', name: '店舗別在庫設定', icon: 'fa-boxes-stacked', color: '#4b5563', desc: '店舗ごとの取扱品指定' },
            { id: 'sales_correction', name: '営業実績修正', icon: 'fa-edit', color: '#4b5563', desc: '過去の実績データの補正' },
            { id: 'csv_export', name: 'CSV出力', icon: 'fa-file-csv', color: '#4b5563', desc: '全データの書き出し' },
            { id: 'csv_import', name: 'CSVインポート', icon: 'fa-file-import', color: '#4b5563', desc: '一括インポート' },
            { id: 'calendar_admin', name: '営業カレンダー作成', icon: 'fa-calendar-plus', color: '#4b5563', desc: '年間休日・イベント設定' },
            { id: 'goals_admin', name: '目標設定 (社長用)', icon: 'fa-bullseye', color: '#4b5563', desc: '全社売上ターゲット' }
        ]
    },
    'utility_hub': {
        title: '便利機能',
        description: '従業員のナレッジ共有・シミュレーションツール',
        items: [
            { id: 'prototype_menu', name: 'メニュー試作', icon: 'fa-flask', color: '#f59e0b', desc: '新メニューの原価計算シミュ' },
            { id: 'competitor_list', name: '行きたい店リスト', icon: 'fa-map-marked-alt', color: '#3b82f6', desc: '競合店の視察メモ・共有' }
        ]
    }
};

/**
 * 指定されたHubを描画する
 */
export function initHubPage(type) {
    const config = HUB_CONFIG[type];
    if (!config) return;

    const grid = document.getElementById('hub-content-grid');
    if (!grid) return;

    const permissions = window.appState ? window.appState.permissions : [];

    grid.innerHTML = config.items.filter(item => {
        // 権限チェック（全てのHubアイテムが権限制御されているわけではないが、基本は許可または個別チェック）
        // ※ 開発中のため、店長会議資料は無条件で表示させる
        return item.id === 'manager_meeting' || permissions.length === 0 || permissions.includes(item.id);
    }).map(item => `
        <div class="glass-panel hub-card" onclick="window.navigateTo('${item.id}')" style="padding: 1.5rem; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 0.8rem; border: 1px solid rgba(255,255,255,0.4);">
            <div style="width: 50px; height: 50px; border-radius: 12px; background: ${item.color}15; color: ${item.color}; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                <i class="fas ${item.icon}"></i>
            </div>
            <div>
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">${item.name}</h3>
                <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">${item.desc}</p>
            </div>
            <i class="fas fa-chevron-right" style="position: absolute; right: 1.2rem; top: 1.2rem; font-size: 0.8rem; color: #cbd5e1;"></i>
        </div>
    `).join('');

    // カードのホバーアニメーションをインラインスタイルでなくCSSでやりたいので、後ほどstyles.cssに追加する。
}
