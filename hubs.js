import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { MENU_DEFINITION } from './menu_definition.js?v=20260710_02';

/**
 * HubページのHTMLテンプレートを生成する
 */
export const hubPageHtml = (title, description) => `
    <div class="hub-page animate-fade-in" style="width: 100%; max-width: 1200px; margin: 0 auto; padding-bottom: 5rem; padding-top: 1.5rem;">
        <div id="hub-content-container">
            <!-- Content will be injected here (either grid or sections) -->
        </div>
    </div>
`;

/**
 * 指定されたHubを描画する
 */
export function initHubPage(type) {
    const config = MENU_DEFINITION.find(hub => hub.id === type);
    if (!config) return;

    const container = document.getElementById('hub-content-container');
    if (!container) return;

    const permissions = window.appState ? window.appState.permissions : [];

    // セクション構造がある場合はタイル形式で描画
    if (config.sections) {
        container.innerHTML = `
            <div class="hub-sections-container">
                ${config.sections.map(section => {
                    const visibleItems = section.items.filter(item => {
                        return permissions.includes(item.id);
                    });

                    if (visibleItems.length === 0) return ''; // 表示可能なタイルが1つもないセクションは非表示にする

                    return `
                        <div class="hub-section">
                            <div class="hub-section-header">
                                <i class="fas ${section.icon}" style="color: var(--primary); font-size: 1.1rem;"></i>
                                <h2>${section.title}</h2>
                            </div>
                            <div class="tile-grid">
                                ${visibleItems.map(item => `
                                    <div class="business-tile ${item.isComingSoon ? 'tile-coming-soon' : ''}" 
                                         onclick="${item.isComingSoon ? "alert('この機能は現在開発中です。')" : `window.navigateTo('${item.id}')`}">
                                        ${item.isComingSoon ? '<span class="tile-badge-soon">開発中</span>' : ''}
                                        <div class="tile-icon" style="background: ${item.color}10; color: ${item.color};">
                                            <i class="fas ${item.icon}"></i>
                                        </div>
                                        <div class="tile-info">
                                            <span class="tile-name">${item.name}</span>
                                        </div>
                                        <i class="fas fa-chevron-right tile-chevron"></i>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else if (config.items) {
        // 従来のカード形式（グリッド）で描画
        const visibleItems = config.items.filter(item => {
            return permissions.includes(item.id);
        });

        if (visibleItems.length === 0) {
            container.innerHTML = `
                <div class="glass-panel animate-fade-in" style="padding: 4rem 2rem; text-align: center; max-width: 500px; margin: 3rem auto; border-radius: 24px; border: 1px solid var(--border); box-shadow: var(--shadow-md);">
                    <div style="width: 70px; height: 70px; border-radius: 50%; background: #f1f5f9; color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 1.5rem;">
                        <i class="fas fa-cubes"></i>
                    </div>
                    <h3 style="margin: 0 0 0.6rem 0; color: var(--text-primary); font-weight: 800; font-size: 1.25rem;">有効な個別メニューがありません</h3>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
                        この店舗では、現在有効化されている店舗個別メニューがありません。機能を追加・表示するには、システム管理者にお問い合わせください。
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div id="hub-content-grid" class="menu-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem;">
                ${visibleItems.map(item => `
                    <div class="glass-panel hub-card" onclick="window.navigateTo('${item.id}')" style="padding: 1.5rem; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 0.8rem; border: 1px solid rgba(255,255,255,0.4);">
                        <div style="width: 50px; height: 50px; border-radius: 12px; background: ${item.color}15; color: ${item.color}; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                            <i class="fas ${item.icon}"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">${item.name}</h3>
                            <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">${item.desc || ''}</p>
                        </div>
                        <i class="fas fa-chevron-right" style="position: absolute; right: 1.2rem; top: 1.2rem; font-size: 0.8rem; color: #cbd5e1;"></i>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

