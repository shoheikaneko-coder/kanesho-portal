/**
 * Pull-to-Refresh Logic for Kaneshow Portal
 * スマホ・タブレットのタッチ操作を検知し、画面更新トリガーを提供します。
 */

export class PullToRefresh {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.options = {
            threshold: options.threshold || 70,
            onRefresh: options.onRefresh || null,
        };
        
        this.startY = 0;
        this.currentY = 0;
        this.isPulling = false;
        this.isLoading = false;
        
        this.ptrElement = null;
        this.initUI();
        this.initEvents();
    }

    /**
     * インジケーター要素の作成と挿入
     */
    initUI() {
        // すでに存在していれば削除（SPAの再描画対策）
        const old = document.getElementById('ptr-indicator');
        if (old) old.remove();

        this.ptrElement = document.createElement('div');
        this.ptrElement.id = 'ptr-indicator';
        this.ptrElement.className = 'ptr-container';
        this.ptrElement.innerHTML = `
            <div class="ptr-icon-box">
                <i class="fas fa-arrow-down"></i>
            </div>
        `;
        
        // コンテナの最上部に挿入
        this.container.prepend(this.ptrElement);
    }

    initEvents() {
        // コンテンツ領域のタッチイベントを監視
        // passive: false にすることで、引っ張り中のスクロールを完全に制御可能にする
        this.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        this.container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.container.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
    }

    handleTouchStart(e) {
        if (this.isLoading) return;

        // 判定: メインホーム画面以外では機能を完全停止する
        if (window.appState && window.appState.currentPage !== 'home') {
            this.isPulling = false;
            return;
        }

        // 判定: アコーディオンが表示されている間はPTRを無効化する
        const accordion = document.getElementById('mobile-accordion-container');
        if (accordion && accordion.classList.contains('active')) {
            this.isPulling = false;
            return;
        }

        // 判定: ボタンなどのインタラクティブ要素上でのタッチ開始はPTRを無効化する
        if (e.target.closest('button') || e.target.closest('.mobile-ops-tile') || e.target.closest('.quick-nav-bar')) {
            this.isPulling = false;
            return;
        }

        // 画面の最上部にいない場合は無視
        if (this.container.scrollTop > 5) {
            this.isPulling = false;
            return;
        }
        
        this.startY = e.touches[0].pageY;
        this.isPulling = true;
    }

    handleTouchMove(e) {
        if (!this.isPulling || this.isLoading) return;
        
        this.currentY = e.touches[0].pageY;
        const diff = this.currentY - this.startY;
        
        // 下方向への引っ張りのみ処理
        if (diff > 30 && this.container.scrollTop <= 5) {
            // ブラウザ標準のバウンスやリフレッシュを抑制
            if (e.cancelable) e.preventDefault();
            
            this.isPullingActive = true; // 明確な引っ張りが開始された
            const pullDistance = diff - 30; // 30px分を差し引いて計算開始
            
            this.ptrElement.style.height = `${Math.min(pullDistance * 0.4, this.options.threshold + 30)}px`;
            this.ptrElement.classList.add('ptr-active');
            
            const icon = this.ptrElement.querySelector('i');
            if (pullDistance * 0.4 > this.options.threshold) {
                icon.style.transform = 'rotate(180deg)';
                icon.style.color = 'var(--primary)';
            } else {
                icon.style.transform = 'rotate(0deg)';
                icon.style.color = '#cbd5e1';
            }
        } else if (diff < 0) {
            // 上方向へのスクロールは即座に無効化
            this.isPulling = false;
        }
    }

    handleTouchEnd() {
        if (!this.isPulling || this.isLoading) return;
        
        if (!this.isPullingActive) {
            this.reset();
            this.isPulling = false;
            return;
        }
        
        const diff = this.currentY - this.startY;
        const pullDistance = diff - 30;
        
        if (pullDistance * 0.4 > this.options.threshold) {
            this.triggerRefresh();
        } else {
            this.reset();
        }
        this.isPulling = false;
        this.isPullingActive = false;
    }

    async triggerRefresh() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        this.ptrElement.classList.add('ptr-loading');
        this.ptrElement.style.height = `${this.options.threshold}px`;
        
        const icon = this.ptrElement.querySelector('i');
        icon.className = 'fas fa-spinner';
        icon.style.transform = 'none';

        if (this.options.onRefresh) {
            try {
                await this.options.onRefresh();
            } catch (err) {
                console.error("PTR Refresh Error:", err);
            }
        }

        // 完了後に少し待ってから閉じる（「完了」を見せるため）
        setTimeout(() => this.reset(), 500);
    }

    reset() {
        this.isLoading = false;
        if (!this.ptrElement) return;

        this.ptrElement.style.height = '0';
        this.ptrElement.classList.remove('ptr-active', 'ptr-loading');
        
        setTimeout(() => {
            const icon = this.ptrElement.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-arrow-down';
                icon.style.transform = 'rotate(0deg)';
            }
        }, 300);
    }
}
