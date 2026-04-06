/**
 * UI Utilities for AntiGravity Portal
 * カスタムモーダル（Confirm/Alert）を提供し、
 * ネイティブの dialog が SPA の再レンダリングで消える問題を解決します。
 */

export function showAlert(title, message) {
    const modalId = 'ui-alert-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed !important; inset:0 !important; background:rgba(0,0,0,0.5) !important; z-index:10000 !important; display:none; align-items:center; justify-content:center; padding:1rem;';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="glass-panel animate-scale-in" style="width:100%; max-width:400px; padding:2rem; text-align:center; margin: auto;">
            <h3 style="margin-top:0; color:var(--text-primary); font-size: 1.2rem;">${title}</h3>
            <p style="color:var(--text-secondary); margin-bottom:1.5rem; line-height: 1.5;">${message}</p>
            <button id="alert-ok-btn" class="btn btn-primary" style="width:100%;">OK</button>
        </div>
    `;

    // 二重オーバーレイ防止
    document.querySelectorAll('.modal-overlay').forEach(m => {
        if (m.id !== modalId) m.style.setProperty('display', 'none', 'important');
    });

    modal.style.setProperty('display', 'flex', 'important');
    document.getElementById('alert-ok-btn').onclick = () => {
        modal.style.setProperty('display', 'none', 'important');
    };
}

export function showConfirm(title, message, onConfirm) {
    const modalId = 'ui-confirm-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed !important; inset:0 !important; background:rgba(0,0,0,0.5) !important; z-index:10000 !important; display:none; align-items:center; justify-content:center; padding:1rem;';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="glass-panel animate-scale-in" style="width:100%; max-width:400px; padding:2rem; margin: auto;">
            <h3 style="margin-top:0; color:var(--text-primary); text-align:center; font-size: 1.2rem;">${title}</h3>
            <p style="color:var(--text-secondary); margin-bottom:1.5rem; text-align:center; line-height: 1.5;">${message}</p>
            <div style="display:flex; gap:1rem;">
                <button id="confirm-cancel-btn" class="btn" style="flex:1; background:var(--surface-darker); font-size: 0.9rem;">キャンセル</button>
                <button id="confirm-ok-btn" class="btn btn-primary" style="flex:1; background:#ef4444; font-size: 0.9rem;">確定</button>
            </div>
        </div>
    `;

    // 二重オーバーレイ防止
    document.querySelectorAll('.modal-overlay').forEach(m => {
        if (m.id !== modalId) m.style.setProperty('display', 'none', 'important');
    });

    modal.style.setProperty('display', 'flex', 'important');

    document.getElementById('confirm-cancel-btn').onclick = () => {
        modal.style.setProperty('display', 'none', 'important');
    };

    document.getElementById('confirm-ok-btn').onclick = () => {
        modal.style.setProperty('display', 'none', 'important');
        if (onConfirm) onConfirm();
    };
}

export function showLoader() {
    const loaderId = 'ui-global-loader';
    let loader = document.getElementById(loaderId);
    if (!loader) {
        loader = document.createElement('div');
        loader.id = loaderId;
        loader.style.cssText = 'position:fixed; inset:0; BACKGROUND:rgba(255,255,255,0.7); z-index:11000; display:none; align-items:center; justify-content:center; backdrop-filter:blur(4px);';
        loader.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:3rem; color:var(--primary);"></i>';
        document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
    return {
        remove: () => loader.style.display = 'none'
    };
}
