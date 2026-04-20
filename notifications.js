import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy, updateDoc, doc, deleteDoc, onSnapshot, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showAlert } from './ui_utils.js';

export const notificationsPageHtml = `
    <div id="notifications-container" class="animate-fade-in">
        <!-- Dashboard Category View -->
        <div id="notifications-categories" class="notifications-grid">
            <div class="notification-category-card recipe-card" id="cat-recipe-missing">
                <div class="category-icon">
                    <i class="fas fa-utensils"></i>
                </div>
                <div class="category-info">
                    <h3>レシピ未登録</h3>
                    <p>CSVインポートされた新規メニューのレシピ登録が必要です</p>
                    <div class="category-status">
                        <span class="count-badge" id="count-recipe-missing">0件</span>
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>

            <div class="notification-category-card info-card" id="cat-shift-published">
                <div class="category-icon">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <div class="category-info">
                    <h3>シフト公開</h3>
                    <p>店長によって確定・公開された最新のシフト情報です</p>
                    <div class="category-status">
                        <span class="count-badge" id="count-shift-published" style="background:var(--secondary);">0件</span>
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>

            <div class="notification-category-card task-card" id="cat-asset-check">
                <div class="category-icon">
                    <i class="fas fa-key"></i>
                </div>
                <div class="category-info">
                    <h3>貸与物確認アラート</h3>
                    <p>スタッフへの貸与物棚卸し、または未返却アイテムの確認が必要です</p>
                    <div class="category-status">
                        <span class="count-badge" id="count-asset-check" style="background:#8b5cf6;">0件</span>
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>

            <div class="notification-category-card danger-card" id="cat-deletion-request" style="display: none;">
                <div class="category-icon">
                    <i class="fas fa-trash-alt"></i>
                </div>
                <div class="category-info">
                    <h3>商品削除申請</h3>
                    <p>従業員から申請された、不要な食材やメニューの削除依頼を確認します</p>
                    <div class="category-status">
                        <span class="count-badge" id="count-deletion-request" style="background: #f59e0b;">0件</span>
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>

            <div class="notification-category-card approval-card" id="cat-request-approvals" style="display: none;">
                <div class="category-icon">
                    <i class="fas fa-check-double"></i>
                </div>
                <div class="category-info">
                    <h3>申請承認ワークフロー</h3>
                    <p>勤怠修正や、その他各種申請の内容を確認し承認を行います</p>
                    <div class="category-status">
                        <span class="count-badge" id="count-request-approvals" style="background: var(--secondary);">0件</span>
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detailed List View (Hidden by default) -->
        <div id="notifications-detail" style="display: none;">
            <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem;">
                <button id="btn-notif-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h3 id="detail-title" style="margin: 0; font-size: 1.25rem;">レシピ未登録リスト</h3>
            </div>
            
            <div class="glass-panel" style="padding: 0; overflow: hidden;">
                <div id="notif-list-body">
                    <!-- List items injected here -->
                </div>
            </div>
        </div>
    </div>

    <style>
        .notifications-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.5rem;
            margin-top: 1rem;
        }

        .notification-category-card {
            background: white;
            border-radius: 20px;
            padding: 1.5rem;
            display: flex;
            gap: 1.2rem;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(0,0,0,0.05);
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            position: relative;
            overflow: hidden;
        }

        .notification-category-card:hover:not(.disabled) {
            transform: translateY(-5px);
            box-shadow: 0 12px 20px -5px rgba(0,0,0,0.1);
            border-color: var(--primary);
        }

        .notification-category-card.disabled {
            opacity: 0.6;
            cursor: not-allowed;
            background: #f8fafc;
        }

        .category-icon {
            width: 56px;
            height: 56px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            flex-shrink: 0;
        }

        .recipe-card .category-icon { background: #fee2e2; color: #ef4444; }
        .info-card .category-icon { background: #e0f2fe; color: #0ea5e9; }
        .task-card .category-icon { background: #f0fdf4; color: #10b981; }
        .danger-card .category-icon { background: #fff7ed; color: #f59e0b; }
        .approval-card .category-icon { background: #ede9fe; color: var(--secondary); }

        .category-info { flex: 1; }
        .category-info h3 { margin: 0 0 0.4rem 0; font-size: 1.1rem; color: #1e293b; }
        .category-info p { margin: 0 0 1.2rem 0; font-size: 0.85rem; color: #64748b; line-height: 1.4; }
        
        .category-status {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 0.8rem;
            border-top: 1px solid #f1f5f9;
        }

        .count-badge {
            background: #ef4444;
            color: white;
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 700;
        }

        .count-badge.gray { background: #94a3b8; }

        .notif-item {
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.2s;
        }

        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: #f8fafc; }

        .notif-main-info { display: flex; flex-direction: column; gap: 0.3rem; }
        .notif-menu-name { font-weight: 800; color: #1e293b; font-size: 1rem; }
        .notif-meta { font-size: 0.75rem; color: #64748b; display: flex; gap: 0.8rem; align-items: center; }
        
        .btn-register-notif {
            background: var(--primary);
            color: white;
            border: none;
            padding: 0.6rem 1.2rem;
            border-radius: 8px;
            font-weight: 700;
            font-size: 0.85rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            transition: opacity 0.2s;
        }

        .btn-register-notif:hover { opacity: 0.9; }
    </style>
`;

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

let unsubscribeNotifs = null;

export function initNotificationsPage() {
    const catRecipe = document.getElementById('cat-recipe-missing');
    const catShift = document.getElementById('cat-shift-published');
    const btnBack = document.getElementById('btn-notif-back');
    const panelCategories = document.getElementById('notifications-categories');
    const panelDetail = document.getElementById('notifications-detail');
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');

    if (!user) {
        console.error("initNotificationsPage: User not found in localStorage.");
        // エラーで画面を止めないよう、空の状態でレンダリングするか、警告を表示
        return;
    }

    if (catRecipe) {
        catRecipe.onclick = () => {
            panelCategories.style.display = 'none';
            panelDetail.style.display = 'block';
            document.getElementById('detail-title').textContent = 'レシピ未登録リスト';
            loadDetails('recipe_missing');
        };
    }

    if (catShift) {
        catShift.onclick = () => {
            panelCategories.style.display = 'none';
            panelDetail.style.display = 'block';
            document.getElementById('detail-title').textContent = 'シフト公開通知';
            loadDetails('shift_published');
        };
    }

    const catAsset = document.getElementById('cat-asset-check');
    if (catAsset) {
        catAsset.onclick = () => {
            window.navigateTo('loans'); // 貸与物管理ページへ直接遷移
        };
    }

    if (btnBack) {
        btnBack.onclick = () => {
            panelDetail.style.display = 'none';
            panelCategories.style.display = 'grid';
        };
    }

    const catApproval = document.getElementById('cat-request-approvals');
    if (catApproval) {
        if (user.Role === 'Admin' || user.Role === '管理者') {
            catApproval.style.display = 'flex';
            catApproval.onclick = () => {
                panelCategories.style.display = 'none';
                panelDetail.style.display = 'block';
                document.getElementById('detail-title').textContent = '申請承認待ちリスト';
                loadDetails('attendance_correction_request');
            };
        }
    }

    // クリーンアップ
    if (unsubscribeNotifs) unsubscribeNotifs();

    // リアルタイム監視（件数更新用）
    const q = query(collection(db, "notifications"), where("status", "==", "pending"));
    unsubscribeNotifs = onSnapshot(q, (snapshot) => {
        if (!user) {
            console.warn("initNotificationsPage: User data is missing from listener.");
            return;
        }
        const notifs = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        
        // 店舗フィルタリング (ユーザーが管理者の場合は全件、スタッフなら自店舗のみ)
        const mySid = user?.StoreID || user?.StoreId;
        const visibleNotifs = notifs.filter(n => {
            if (!mySid || user.Role === 'Admin' || user.Role === '管理者') return true;
            return n.store_id == mySid;
        });

        const myId = user.id;

        const recipeMissingCount = visibleNotifs.filter(n => n.type === 'recipe_missing').length;
        const shiftPublishedCount = visibleNotifs.filter(n => {
            if (n.type !== 'shift_published') return false;
            const readBy = n.readBy || [];
            return !readBy.includes(myId);
        }).length;
        const deletionRequestCount = visibleNotifs.filter(n => n.type === 'deletion_request').length;
        const approvalCount = visibleNotifs.filter(n => n.type === 'attendance_correction_request').length;
        
        const rEl = document.getElementById('count-recipe-missing');
        if (rEl) rEl.textContent = `${recipeMissingCount}件`;
        
        const sEl = document.getElementById('count-shift-published');
        if (sEl) sEl.textContent = `${shiftPublishedCount}件`;

        const dEl = document.getElementById('count-deletion-request');
        if (dEl) dEl.textContent = `${deletionRequestCount}件`;

        const aEl = document.getElementById('count-request-approvals');
        if (aEl) aEl.textContent = `${approvalCount}件`;

        // 貸与物確認（30日以上未確認の件数）を簡易取得（リアルタイム監視は一旦無しで初期表示時に出すか、別クエリが必要）
        updateAssetCheckCount();
        
        // 詳細ビューが開いている場合はリストも更新
        window.__currentVisibleNotifs = visibleNotifs; // キャッシュ
        if (panelDetail.style.display === 'block') {
            const currentTitle = document.getElementById('detail-title').textContent;
            let type = 'recipe_missing';
            if (currentTitle.includes('シフト')) type = 'shift_published';
            if (currentTitle.includes('削除')) type = 'deletion_request';
            
            let itemsToRender = visibleNotifs.filter(n => n.type === type);
            if (type === 'shift_published') {
                // 既読のものは詳細リストからも除外
                itemsToRender = itemsToRender.filter(n => !(n.readBy || []).includes(myId));
            }
            renderNotifDetails(itemsToRender);
        }
    });
}

async function loadDetails(type) {
    const listBody = document.getElementById('notif-list-body');
    if (listBody && window.__currentVisibleNotifs) {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const myId = user.id;

        let items = window.__currentVisibleNotifs.filter(n => n.type === type);
        
        // シフト通知のみ、既読のものをリストから除外
        if (type === 'shift_published') {
            items = items.filter(n => !(n.readBy || []).includes(myId));
        }

        renderNotifDetails(items, type);
    }
}

function renderNotifDetails(items, type) {
    const listBody = document.getElementById('notif-list-body');
    if (!listBody) return;

    if (items.length === 0) {
        const msg = (type === 'shift_published') ? '新しいシフト通知はありません' : '未登録のレシピはありません';
        listBody.innerHTML = `<div style="padding: 3rem; text-align: center; color: #94a3b8;">${msg}</div>`;
        return;
    }

    // 日付順 (最新順)
    items.sort((a, b) => {
        const timeA = a.created_at?.seconds || new Date(a.created_at).getTime() / 1000 || 0;
        const timeB = b.created_at?.seconds || new Date(b.created_at).getTime() / 1000 || 0;
        return timeB - timeA;
    });

    listBody.innerHTML = items.map(item => {
        if (item.type === 'deletion_request') {
            return `
                <div class="notif-item">
                    <div class="notif-main-info">
                        <div class="notif-menu-name"><i class="fas fa-trash-alt" style="color:#f59e0b; margin-right:0.4rem;"></i>${item.target_name || '名称不明'}</div>
                        <div class="notif-meta">
                            <span><i class="fas fa-user"></i> 申請者: ${item.requester_name || '不明'}</span>
                            <span><i class="fas fa-clock"></i> ${new Date(item.created_at).toLocaleString()}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" style="background:#fef2f2; color:#ef4444; border:1px solid #fee2e2; font-weight:700; padding:0.5rem 1rem;" onclick="handleDeletionRequest('${item.id}', '${item.target_id}', 'approve')">
                            承認(削除)
                        </button>
                        <button class="btn" style="background:white; border:1px solid var(--border); color:var(--text-secondary); font-weight:700; padding:0.5rem 1rem;" onclick="handleDeletionRequest('${item.id}', null, 'reject')">
                            却下
                        </button>
                    </div>
                </div>
            `;
        }

        if (item.type === 'attendance_correction_request') {
            const staffName = item.staff_name || '名称不明';
            const targetDate = item.target_date || item.date || '-';
            const requester = item.requester_name || item.requested_by_name || '不明';

            return `
                <div class="notif-item">
                    <div class="notif-main-info">
                        <div class="notif-menu-name"><i class="fas fa-check-double" style="color:var(--secondary); margin-right:0.4rem;"></i>勤怠修正依頼: ${staffName}</div>
                        <div class="notif-meta">
                            <span><i class="fas fa-calendar"></i> 対象日: ${targetDate}</span>
                            <span><i class="fas fa-user-edit"></i> 申請者: ${requester}</span>
                            <span><i class="fas fa-clock"></i> ${safeFormatDate(item.created_at)}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-register-notif" style="background:var(--secondary);" onclick="goToAttendanceApproval()">
                            内容を確認
                        </button>
                    </div>
                </div>
            `;
        }

        const isShift = item.type === 'shift_published';
        return `
            <div class="notif-item">
                <div class="notif-main-info">
                    <div class="notif-menu-name">${isShift ? item.title : (item.menu_name || '名称不明')}</div>
                    <div class="notif-meta">
                        <span><i class="fas fa-store"></i> ${item.store_name || '店舗情報なし'}</span>
                        <span><i class="fas fa-calendar"></i> ${safeFormatDate(item.created_at)}</span>
                        ${isShift ? `<span><i class="fas fa-bullhorn"></i> ${item.message}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    ${isShift ? `
                        <button class="btn btn-register-notif" style="background:var(--secondary);" onclick="viewShiftDetail('${item.id}', '${item.store_id}', '${item.year || ''}', '${item.month || ''}', '${item.slot || ''}', '${item.message || ''}')">
                            <i class="fas fa-eye"></i> シフトを確認
                        </button>
                    ` : `
                        <button class="btn btn-register-notif" onclick="goToMenuRecipe('${item.menu_id}')">
                            <i class="fas fa-edit"></i> レシピを登録
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// シフト詳細へのインテリジェント遷移
window.viewShiftDetail = async (notifId, storeId, year, month, slot, message) => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    const isAdmin = user.Role === 'Admin' || user.Role === '管理者';

    // 既読処理 (readBy配列に自分を追加)
    try {
        const notifRef = doc(db, "notifications", notifId);
        await updateDoc(notifRef, {
            readBy: arrayUnion(user.id)
        });
    } catch (e) {
        console.warn("Failed to mark as read:", e);
    }

    if (isAdmin) {
        // 管理者の場合はコックピットへ。対象期間を抽出。
        let y = parseInt(year);
        let m = parseInt(month);
        let s = parseInt(slot);

        // 古い通知などでフィールドがない場合はメッセージからパース試行 (例: "2024/4 前半")
        if (!y || !m || !s) {
            const match = message.match(/(\d{4})\/(\d{1,2})\s+(前半|後半)/);
            if (match) {
                y = parseInt(match[1]);
                m = parseInt(match[2]);
                s = match[3] === '前半' ? 1 : 2;
            }
        }

        window.__shiftNavTarget = {
            storeId: storeId,
            year: y,
            month: m,
            slot: s
        };
        window.navigateTo('shift_admin');
    } else {
        // スタッフの場合は自分のカレンダーへ
        window.navigateTo('shift_viewer');
    }
};

// グローバルに公開（HTML文字列内のonclickから呼ぶ用）
window.goToMenuRecipe = (menuId) => {
    // productsページへの深リンク用フラグ
    window.__productTargetMenuId = menuId;
    if (window.navigateTo) {
        window.navigateTo('products');
    }
};

window.goToAttendanceApproval = () => {
    // 勤怠管理ページの承認ビューへ直接遷移するためのフラグ
    window.__triggerAttnApprovals = true;
    if (window.navigateTo) {
        window.navigateTo('attendance_management');
    }
};

window.handleDeletionRequest = async (notifId, targetId, action) => {
    if (action === 'approve') {
        const ok = confirm('本当に削除を承認し、アイテムをマスタから完全に削除しますか？\n(この操作は取り消せません)');
        if (!ok) return;

        try {
            await Promise.all([
                deleteDoc(doc(db, "m_items", targetId)),
                deleteDoc(doc(db, "m_ingredients", targetId)),
                deleteDoc(doc(db, "m_menus", targetId)),
                updateDoc(doc(db, "notifications", notifId), { status: 'done', processed_at: new Date().toISOString() })
            ]);
            showAlert('完了', '削除と承認を完了しました。');
        } catch (e) {
            console.error(e);
            showAlert('エラー', '削除処理に失敗しました。');
        }
    } else {
        try {
            await updateDoc(doc(db, "notifications", notifId), { status: 'done', processed_at: new Date().toISOString() });
            showAlert('完了', '申請を却下し、通知を解消しました。');
        } catch (e) {
            console.error(e);
            showAlert('エラー', '却下処理に失敗しました。');
        }
    }
};

async function updateAssetCheckCount() {
    const el = document.getElementById('count-asset-check');
    if (!el) return;
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // 貸与中の全件を取得してフィルタリング（小規模ならこれでOK）
        const q = query(collection(db, "t_staff_loans"), where("status", "==", "loaned"));
        if (!q) {
            console.warn("updateAssetCheckCount: query failed to initialize.");
            return;
        }
        const snap = await getDocs(q);
        let count = 0;
        snap.forEach(d => {
            const data = d.data();
            const lastCheck = data.lastVerifiedAt ? new Date(data.lastVerifiedAt.seconds * 1000) : null;
            if (!lastCheck || lastCheck < thirtyDaysAgo) {
                count++;
            }
        });
        el.textContent = `${count}件`;
    } catch (e) { console.error(e); }
}
