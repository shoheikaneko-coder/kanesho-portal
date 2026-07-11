import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { MENU_DEFINITION } from './menu_definition.js?v=20260710_02';
import { roleMasterService } from './role_master_service.js';

export const rolePermissionsPageHtml = `
    <div class="animate-fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                <i class="fas fa-user-shield" style="color: var(--primary);"></i>
                権限振り分け設定
            </h2>
        </div>

        <div style="display: grid; grid-template-columns: 250px 1fr; gap: 2rem;">
            <!-- ロール一覧 -->
            <div class="glass-panel" style="padding: 1.5rem; height: fit-content;">
                <h3 style="font-size: 1rem; margin-bottom: 1.5rem; color: var(--text-secondary);">ロール選択</h3>
                <div id="role-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="text-align: center; color: var(--text-secondary); padding: 1rem;"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>
                </div>
                
                <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px dashed var(--border);">
                    <button id="btn-goto-store-features" class="btn" style="width: 100%; background: #f8fafc; color: var(--text-primary); border: 1px solid var(--border); font-weight: 600; padding: 0.8rem;">
                        <i class="fas fa-store-slash" style="color: var(--primary); margin-right: 0.5rem;"></i> 店舗別メニュー設定
                    </button>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; text-align: center;">各店舗の「日本酒管理」などの<br>機能オン/オフを設定します。</p>
                </div>
            </div>

            <!-- 機能一覧（2カラム構成） -->
            <div class="glass-panel" style="padding: 2.5rem; display: flex; flex-direction: column; height: 75vh; max-height: 800px; min-height: 500px;">
                <!-- 上部ヘッダー -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-shrink: 0;">
                    <div>
                        <h3 id="current-role-title" style="margin: 0; font-size: 1.2rem;">管理者 (Admin) の権限設定</h3>
                        <p style="margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">このロールに許可するハブメニューと個別の機能を選択してください。</p>
                    </div>
                    <button id="save-permissions-btn" class="btn btn-primary" style="padding: 0.8rem 2rem;">
                        <i class="fas fa-save" style="margin-right: 0.5rem;"></i> 設定を保存
                    </button>
                </div>

                <!-- 2カラムコンテンツ -->
                <div class="perm-container-body" style="display: grid; grid-template-columns: 200px 1fr; gap: 2.5rem; flex: 1; min-height: 0;">
                    <!-- 左: 目次 (TOC) -->
                    <div id="hub-toc" style="display: flex; flex-direction: column; gap: 0.4rem; border-right: 1px solid var(--border); padding-right: 1rem; overflow-y: auto;">
                        <!-- JSで動的生成 -->
                    </div>
                    
                    <!-- 右: 縦一列スクロールコンテナ -->
                    <div id="permissions-scroll-container" style="overflow-y: auto; padding-right: 1rem; display: flex; flex-direction: column; gap: 2rem; scroll-behavior: smooth;">
                        <!-- JSでハブごとに縦一列のカードを動的生成 -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <style>
        .role-item {
            text-align: left;
            padding: 1rem;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 600;
            font-size: 0.9rem;
        }
        .role-item:hover { background: #f8fafc; border-color: var(--primary); }
        .role-item.active { background: var(--primary); color: white; border-color: var(--primary); box-shadow: 0 4px 12px rgba(230,57,70,0.2); }
        
        .toc-item {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            padding: 0.75rem 0.9rem;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            border-radius: 8px;
            text-align: left;
            transition: all 0.2s ease;
            border-left: 3px solid transparent;
            width: 100%;
            user-select: none;
        }
        .toc-item:hover {
            background: #f8fafc;
            color: var(--primary);
        }
        .toc-item.active {
            background: rgba(230,57,70,0.05);
            color: var(--primary);
            border-left-color: var(--primary);
        }

        .perm-hub-card {
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 2rem;
            background: white;
            transition: all 0.2s ease;
            width: 100%;
        }
        .perm-checkbox {
            width: 1.15rem;
            height: 1.15rem;
            cursor: pointer;
        }
        .perm-child-label {
            display: flex;
            align-items: flex-start;
            gap: 0.6rem;
            cursor: pointer;
            padding: 0.5rem 0.75rem;
            border-radius: 8px;
            transition: background 0.15s ease;
            margin: 0;
        }
        .perm-child-label:hover {
            background: #f8fafc;
        }

        /* 横幅が狭い場合のレスポンシブ対応 */
        @media (max-width: 1024px) {
            .perm-container-body {
                grid-template-columns: 1fr !important;
                gap: 1.5rem !important;
            }
            #hub-toc {
                display: none !important; /* タブレット以下では目次を非表示にして縦長スクロールのみにする */
            }
        }
    </style>
`;

let selectedRole = 'Admin';

export async function initRolePermissionsPage() {
    renderPermissions();
    
    // ロール一覧の動的生成
    const roleListContainer = document.getElementById('role-list');
    try {
        const roles = await roleMasterService.getRoles();
        roleListContainer.innerHTML = ''; // クリア
        
        roles.forEach((role, index) => {
            const btn = document.createElement('button');
            btn.className = 'role-item';
            if (index === 0) {
                btn.classList.add('active');
                selectedRole = role.id;
            }
            btn.dataset.role = role.id;
            btn.textContent = role.label;
            roleListContainer.appendChild(btn);
        });
    } catch (e) {
        console.error(e);
        roleListContainer.innerHTML = '<div style="color:red; padding:1rem;">読み込みエラー</div>';
    }

    document.getElementById('current-role-title').textContent = `${document.querySelector('.role-item.active')?.textContent || ''} の権限設定`;
    await loadRolePermissions(selectedRole);

    const roleBtns = document.querySelectorAll('.role-item');
    roleBtns.forEach(btn => {
        btn.onclick = async () => {
            roleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRole = btn.dataset.role;
            document.getElementById('current-role-title').textContent = `${btn.textContent} の権限設定`;
            await loadRolePermissions(selectedRole);
        };
    });

    const gotoBtn = document.getElementById('btn-goto-store-features');
    if (gotoBtn) {
        gotoBtn.onclick = () => {
            window.navigateTo('store_features_admin');
        };
    }

    const saveBtn = document.getElementById('save-permissions-btn');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const originalHtml = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            saveBtn.disabled = true;

            const checked = [];
            document.querySelectorAll('.perm-checkbox').forEach(cb => {
                if (cb.checked) checked.push(cb.dataset.id);
            });

            // セーフガード: 管理者ロールが保存される際、最低限の権限が絶対に抜け落ちないように補正
            if (selectedRole === 'Admin' || selectedRole === '管理者') {
                if (!checked.includes('role_permissions')) checked.push('role_permissions');
                if (!checked.includes('hr_hub')) checked.push('hr_hub');
                if (!checked.includes('home')) checked.push('home');
                if (!checked.includes('master_hub')) checked.push('master_hub');
            }

            try {
                await setDoc(doc(db, "m_role_permissions", selectedRole), {
                    permissions: checked,
                    updatedAt: new Date().toISOString()
                });
                
                // 現在ログイン中のユーザー自身の権限を変更した場合は即座にアプリ状態に反映
                if (window.state && window.state.currentUser && window.state.currentUser.Role === selectedRole) {
                    if (window.appState) {
                        window.appState.permissions = checked;
                    }
                }
                
                alert("権限設定を保存しました。");
            } catch (err) {
                alert("保存に失敗しました: " + err.message);
            } finally {
                saveBtn.innerHTML = originalHtml;
                saveBtn.disabled = false;
            }
        };
    }
}

function renderPermissions() {
    const toc = document.getElementById('hub-toc');
    const scrollContainer = document.getElementById('permissions-scroll-container');
    if (!toc || !scrollContainer) return;

    let tocHtml = '';
    let contentHtml = '';

    MENU_DEFINITION.forEach((hub, index) => {
        // 目次アイテムの生成
        tocHtml += `
            <button class="toc-item ${index === 0 ? 'active' : ''}" data-target="hub-section-${hub.id}" style="outline: none;">
                <i class="fas ${hub.icon}" style="width: 16px; text-align: center;"></i>
                <span>${hub.name}</span>
            </button>
        `;

        // 機能リストの生成
        let childrenHtml = '';
        
        if (hub.sections) {
            hub.sections.forEach(sec => {
                childrenHtml += `
                    <div class="perm-section" style="margin-top: 1.2rem; border-top: 1px dashed var(--border); padding-top: 0.8rem;">
                        <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
                            <i class="fas ${sec.icon}"></i> ${sec.title}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.4rem; padding-left: 0.2rem;">
                            ${sec.items.map(item => renderChildItem(item, hub.id)).join('')}
                        </div>
                    </div>
                `;
            });
        } else if (hub.items) {
            childrenHtml += `
                <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 1rem; border-top: 1px dashed var(--border); padding-top: 0.8rem;">
                    ${hub.items.map(item => renderChildItem(item, hub.id)).join('')}
                </div>
            `;
        }

        contentHtml += `
            <div class="perm-hub-card" id="hub-section-${hub.id}">
                <label style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer; font-weight: 800; font-size: 1.1rem; color: var(--text-primary); margin: 0 0 1rem 0; user-select: none; border-bottom: 1px solid var(--border); padding-bottom: 0.8rem;">
                    <input type="checkbox" class="perm-checkbox perm-parent" data-id="${hub.id}">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(230,57,70,0.06); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1rem;">
                        <i class="fas ${hub.icon}"></i>
                    </div>
                    <span>${hub.name}</span>
                </label>
                ${childrenHtml}
            </div>
        `;
    });

    toc.innerHTML = tocHtml;
    scrollContainer.innerHTML = contentHtml;

    bindPermissionEvents();
    bindTOCEvents();
    bindScrollSpy();
}

function renderChildItem(item, parentId) {
    const badge = item.isComingSoon ? '<span style="font-size: 0.65rem; padding: 0.1rem 0.3rem; background: #e2e8f0; color: #64748b; border-radius: 4px; margin-left: 0.5rem; font-weight: bold;">開発中</span>' : '';
    const desc = item.desc ? `<p style="margin: 0.1rem 0 0 0; font-size: 0.7rem; color: var(--text-secondary); font-weight: normal; line-height: 1.3;">${item.desc}</p>` : '';
    
    return `
        <label class="perm-child-label" style="display: flex; align-items: flex-start; gap: 0.6rem;">
            <input type="checkbox" class="perm-checkbox perm-child" data-id="${item.id}" data-parent="${parentId}" style="margin-top: 0.15rem;">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">
                    <i class="fas ${item.icon}" style="font-size: 0.8rem; color: var(--text-secondary); width: 14px; text-align: center; margin-right: 0.4rem;"></i>
                    <span>${item.name}</span>
                    ${badge}
                </div>
                ${desc}
            </div>
        </label>
    `;
}

function bindPermissionEvents() {
    // 親（ハブ）の変更イベント: 配下の子すべてを連動
    document.querySelectorAll('.perm-parent').forEach(parentCb => {
        parentCb.onchange = () => {
            const hubId = parentCb.dataset.id;
            const childCbs = document.querySelectorAll(`.perm-child[data-parent="${hubId}"]`);
            childCbs.forEach(childCb => {
                // Adminかつセーフガード対象の場合はオフにさせない
                if (selectedRole === 'Admin' && childCb.dataset.id === 'role_permissions') {
                    childCb.checked = true;
                    return;
                }
                childCb.checked = parentCb.checked;
                updateLabelStyle(childCb);
            });
            updateCardStyle(parentCb);
        };
    });

    // 子（個別機能）の変更イベント: オンになったら親ハブを自動オンにする
    document.querySelectorAll('.perm-child').forEach(childCb => {
        childCb.onchange = () => {
            const parentId = childCb.dataset.parent;
            const parentCb = document.querySelector(`.perm-parent[data-id="${parentId}"]`);

            // セーフガード: Adminのrole_permissionsはオフにさせない
            if (selectedRole === 'Admin' && childCb.dataset.id === 'role_permissions' && !childCb.checked) {
                childCb.checked = true;
                alert("管理者の「権限振り分け設定」権限は、システムロックアウト防止のため解除できません。");
                return;
            }

            if (childCb.checked && parentCb && !parentCb.checked) {
                parentCb.checked = true;
                updateCardStyle(parentCb);
            }
            updateLabelStyle(childCb);
        };
    });
}

function bindTOCEvents() {
    const scrollContainer = document.getElementById('permissions-scroll-container');
    if (!scrollContainer) return;

    document.querySelectorAll('.toc-item').forEach(btn => {
        btn.onclick = () => {
            const targetId = btn.dataset.target;
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                const topPos = targetEl.offsetTop - scrollContainer.offsetTop;
                scrollContainer.scrollTo({
                    top: topPos,
                    behavior: 'smooth'
                });

                // 目次のアクティブ状態を即時更新
                document.querySelectorAll('.toc-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        };
    });
}

function bindScrollSpy() {
    const scrollContainer = document.getElementById('permissions-scroll-container');
    if (!scrollContainer) return;

    scrollContainer.onscroll = () => {
        let activeHubId = null;
        const containerTop = scrollContainer.scrollTop;
        const cards = document.querySelectorAll('.perm-hub-card');

        cards.forEach(card => {
            const relativeTop = card.offsetTop - scrollContainer.offsetTop;
            // 検出ラインをコンテナ上部から50pxに設定
            if (relativeTop <= containerTop + 50) {
                activeHubId = card.id.replace('hub-section-', '');
            }
        });

        if (activeHubId) {
            document.querySelectorAll('.toc-item').forEach(btn => {
                const isActive = btn.dataset.target === `hub-section-${activeHubId}`;
                btn.classList.toggle('active', isActive);
            });
        }
    };
}

function updateCardStyle(parentCb) {
    const card = document.getElementById(`hub-section-${parentCb.dataset.id}`);
    if (card) {
        card.style.borderColor = parentCb.checked ? 'var(--primary)' : 'var(--border)';
        card.style.background = parentCb.checked ? 'rgba(230,57,70,0.01)' : 'white';
        card.style.boxShadow = parentCb.checked ? '0 4px 20px rgba(230,57,70,0.04)' : 'none';
    }
}

function updateLabelStyle(childCb) {
    const label = childCb.closest('.perm-child-label');
    if (label) {
        label.style.background = childCb.checked ? 'rgba(230,57,70,0.03)' : 'transparent';
    }
}

async function loadRolePermissions(role) {
    // 全リセット
    document.querySelectorAll('.perm-checkbox').forEach(cb => {
        cb.checked = false;
        cb.disabled = false;
        if (cb.classList.contains('perm-child')) {
            updateLabelStyle(cb);
        } else {
            updateCardStyle(cb);
        }
    });

    try {
        const docSnap = await getDoc(doc(db, "m_role_permissions", role));
        if (docSnap.exists()) {
            const perms = docSnap.data().permissions || [];
            perms.forEach(pid => {
                const cb = document.querySelector(`.perm-checkbox[data-id="${pid}"]`);
                if (cb) {
                    cb.checked = true;
                    if (cb.classList.contains('perm-child')) {
                        updateLabelStyle(cb);
                    } else {
                        updateCardStyle(cb);
                    }
                }
            });
        }

        // セーフガードの適用
        if (role === 'Admin' || role === '管理者') {
            const rpCb = document.querySelector('.perm-checkbox[data-id="role_permissions"]');
            if (rpCb) {
                rpCb.checked = true;
                rpCb.disabled = true;
                updateLabelStyle(rpCb);
            }
            const hrCb = document.querySelector('.perm-checkbox[data-id="hr_hub"]');
            if (hrCb) {
                hrCb.checked = true;
                updateCardStyle(hrCb);
            }
            const homeCb = document.querySelector('.perm-checkbox[data-id="home"]');
            if (homeCb) {
                homeCb.checked = true;
                updateCardStyle(homeCb);
            }
            const masterCb = document.querySelector('.perm-checkbox[data-id="master_hub"]');
            if (masterCb) {
                masterCb.checked = true;
                updateCardStyle(masterCb);
            }
        }
    } catch (err) {
        console.error("Error loading permissions:", err);
    }
}


