export const prototypeMenuPageHtml = `
    <div class="animate-fade-in">
        <div class="glass-panel" style="padding: 4rem 2rem; text-align: center;">
            <div style="font-size: 4rem; color: var(--primary); margin-bottom: 2rem;">
                <i class="fas fa-flask"></i>
            </div>
            <h2 style="margin-bottom: 1rem;">メニュー試作 (開発中)</h2>
            <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto; line-height: 1.6;">
                ここでは、商品レシピマスタに登録する前の試作メニューの原価計算や販売単価のシミュレーションができます。
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

export function initPrototypeMenuPage() {
    console.log("Prototype Menu Page initialized (Stub)");
}
