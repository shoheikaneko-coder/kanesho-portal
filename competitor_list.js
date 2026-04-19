export const competitorListPageHtml = `
    <div class="animate-fade-in">
        <div class="glass-panel" style="padding: 4rem 2rem; text-align: center;">
            <div style="font-size: 4rem; color: #3b82f6; margin-bottom: 2rem;">
                <i class="fas fa-map-marked-alt"></i>
            </div>
            <h2 style="margin-bottom: 1rem;">行きたい店リスト (開発中)</h2>
            <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto; line-height: 1.6;">
                従業員の皆さんが気になっているお店や、視察した記録を一括管理する機能です。
                現在、機能の実装を準備中です。
            </p>
            <div style="margin-top: 3rem;">
                <button class="btn btn-secondary" onclick="window.navigateTo('utility_hub')">
                    <i class="fas fa-arrow-left" style="margin-right: 0.5rem;"></i> 便利機能へ戻る
                </button>
            </div>
        </div>
    </div>
`;

export function initCompetitorListPage() {
    console.log("Competitor List Page initialized (Stub)");
}
