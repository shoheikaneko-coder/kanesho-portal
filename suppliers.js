import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { showConfirm, showAlert } from './ui_utils.js';

let currentView = 'list';
let editingSupplierData = null;
let cachedSuppliers = [];
let cachedStores = [];
let currentPage = 1;
const pageSize = 30;

export const suppliersPageHtml = `
    <div id="suppliers-page-container" class="animate-fade-in">
        <!-- Content swapped here -->
    </div>
`;

function renderView() {
    const container = document.getElementById('suppliers-page-container');
    if (!container) return;

    if (currentView === 'form') {
        renderFormView(container);
    } else {
        renderListView(container);
    }
}

function renderListView(container) {
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h2 style="margin: 0; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas fa-truck" style="color: var(--primary);"></i>
                    業者マスタ管理
                </h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem;">仕入先の基本情報と担当店舗を管理します</p>
            </div>
            <button class="btn btn-primary" id="btn-add-supplier" style="padding: 0.8rem 1.5rem; font-weight: 700;">
                <i class="fas fa-plus"></i> 新規業者を登録
            </button>
        </div>
        
        <div class="glass-panel" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <div style="padding: 1.2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <div class="input-group" style="margin-bottom: 0; width: 350px;">
                    <i class="fas fa-search" style="top: 0.8rem;"></i>
                    <input type="text" id="supplier-search" placeholder="企業名や担当者で検索..." style="padding-top: 0.6rem; padding-bottom: 0.6rem; border-radius: 20px;">
                </div>
                <div id="suppliers-count" style="color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;">
                    読込中...
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: white; border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">
                            <th style="padding: 1rem; font-weight: 600;">業者ID</th>
                            <th style="padding: 1rem; font-weight: 600;">企業名</th>
                            <th style="padding: 1rem; font-weight: 600;">担当店舗</th>
                            <th style="padding: 1rem; font-weight: 600;">連絡先</th>
                            <th style="padding: 1rem; text-align: right; font-weight: 600;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="suppliers-table-body">
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const containerEl = document.getElementById('suppliers-page-container');
    
    // Pagination container
    if (!containerEl.querySelector('#supplier-pagination')) {
        const pagContainer = document.createElement('div');
        pagContainer.id = 'supplier-pagination';
        pagContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin: 1.5rem 0; clear: both;';
        containerEl.querySelector('.glass-panel').appendChild(pagContainer);
    }

    const btnAdd = containerEl.querySelector('#btn-add-supplier');
    if (btnAdd) {
        btnAdd.onclick = () => {
            editingSupplierData = null;
            currentView = 'form';
            renderView();
        };
    }

    const searchInput = containerEl.querySelector('#supplier-search');
    if (searchInput) {
        searchInput.oninput = () => {
            currentPage = 1;
            renderTable(searchInput.value);
        };
    }

    renderTable();
}

function renderFormView(container) {
    const isEdit = !!editingSupplierData;

    function createDropdownHtml(idPrefix, title, options, selectedValues, allowAdd = false) {
        const isChecked = (val) => selectedValues.includes(val);
        const optionsHtml = options.map(opt => `
            <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; padding: 0.6rem 0.8rem; background: ${isChecked(opt.value) ? '#eff6ff' : 'white'}; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; font-weight: 600; color: #475569; transition: background 0.2s;">
                <input type="checkbox" value="${opt.value}" data-label="${opt.label}" style="width: 16px; height: 16px;" ${isChecked(opt.value) ? 'checked' : ''}>
                ${opt.label}
            </label>
        `).join('');

        return `
            <div class="input-group compact-input">
                <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">${title}</label>
                <div id="${idPrefix}-dropdown-wrapper" class="custom-multi-select" style="position: relative; width: 100%;">
                    <div id="${idPrefix}-dropdown-header" style="flex: 1; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.95rem; background: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span id="${idPrefix}-dropdown-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%; color: #94a3b8">（読込中）</span>
                        <span class="fas fa-chevron-down" style="color: #94a3b8; font-size: 0.8rem; flex-shrink: 0;"></span>
                    </div>
                    <div id="${idPrefix}-dropdown-menu" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; margin-top: 0.2rem; background: white; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 1000; max-height: 250px; overflow-y: auto; flex-direction: column;">
                        <div id="${idPrefix}-container" class="dropdown-options-container" style="display: flex; flex-direction: column;">
                            ${optionsHtml}
                        </div>
                        ${allowAdd ? `
                        <div style="padding: 0.6rem 0.8rem; background: #f8fafc; border-top: 1px solid var(--border); position: sticky; bottom: 0;">
                            <button type="button" id="btn-add-${idPrefix}" class="btn" style="width: 100%; padding: 0.5rem; border-radius: 6px; border: 1px dashed var(--primary); background: transparent; color: var(--primary); font-size: 0.85rem; font-weight: 700;">
                                <span class="fas fa-plus"></span> 新規追加
                            </button>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    const defaultCategories = ["魚", "肉", "ドリンク", "スーパー", "備品", "野菜", "調味料"];
    const savedCategories = isEdit && editingSupplierData.categories ? editingSupplierData.categories : [];
    const allCategories = [...new Set([...defaultCategories, ...savedCategories])];
    const categoriesOptions = allCategories.map(c => ({ value: c, label: c }));

    const deliveryOptions = [
        { value: 'delivery', label: '配達' },
        { value: 'market_pickup', label: '市場受取' },
        { value: 'store_buy', label: '店舗買付' }
    ];
    const savedDeliveries = editingSupplierData?.delivery_methods || [];

    const storesOptions = cachedStores.map(s => ({ value: s.store_id || s.id, label: s.store_name || s.Name }));
    const savedStores = editingSupplierData?.responsible_stores || [];

    container.innerHTML = `
        <div class="glass-panel animate-fade-in" style="max-width: 700px; margin: 0 auto; padding: 0; overflow: hidden;">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; display: flex; align-items: center; gap: 0.8rem;">
                    <i class="fas ${isEdit ? 'fa-edit' : 'fa-plus-circle'}" style="color: var(--primary);"></i>
                    ${isEdit ? '業者情報の編集' : '新規業者の登録'}
                </h3>
                <button id="btn-form-back" class="btn" style="background: white; border: 1px solid var(--border); color: var(--text-secondary);">
                    <i class="fas fa-times"></i> キャンセル
                </button>
            </div>
            
            <div style="padding: 2.5rem;">
                <form id="supplier-form" class="product-edit-split pro-compact-form">
                    <!-- 左カラム: 基本情報 -->
                    <div class="form-col-left" style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <section style="background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
                            <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: var(--primary); font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; border-left: 4px solid var(--primary); padding-left: 0.8rem;">
                                基本情報
                            </h4>
                            <div class="input-group compact-input">
                                <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">業者ID <span style="color:red">*</span></label>
                                <input type="text" id="vendor-id" required placeholder="例: SUP-001" style="font-family: monospace; padding: 0.6rem;">
                            </div>
                            <div class="input-group compact-input">
                                <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">企業名 <span style="color:red">*</span></label>
                                <input type="text" id="vendor-name" required placeholder="例: ○○食品株式会社" style="padding: 0.6rem;">
                            </div>
                            <div class="input-group compact-input">
                                <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">担当者名</label>
                                <input type="text" id="vendor-contact" placeholder="例: 田中 太郎" style="padding: 0.6rem;">
                            </div>
                            <div class="input-group compact-input">
                                <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">電話番号・連絡先</label>
                                <input type="text" id="vendor-phone" placeholder="03-xxxx-xxxx" style="padding: 0.6rem;">
                            </div>
                            <div class="input-group compact-input" style="flex: 1; display: flex; flex-direction: column; margin-bottom: 0;">
                                <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">備考 (発注ルール、締日など)</label>
                                <textarea id="vendor-remarks" style="flex: 1; resize: none; width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem; min-height: 80px;" placeholder="特記事項があれば入力してください"></textarea>
                            </div>
                        </section>
                    </div>

                    <!-- 右カラム: 取引設定 -->
                    <div class="form-col-right" style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <section style="background: #f1f5f9; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
                            <h4 style="margin-top: 0; margin-bottom: 1.2rem; color: #2563EB; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; border-left: 4px solid #2563EB; padding-left: 0.8rem;">
                                取引・発注設定
                            </h4>

                            ${createDropdownHtml('cat', '取り扱いカテゴリー (複数選択可)', categoriesOptions, savedCategories, true)}
                            
                            <div class="input-group compact-input">
                                <label style="font-weight: 700; color: #475569; font-size: 0.8rem;">発注方法</label>
                                <select id="vendor-order-method" style="width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.95rem; background: white;">
                                    <option value="">（選択してください）</option>
                                    <option value="line">LINE</option>
                                    <option value="phone">電話</option>
                                    <option value="fax">FAX</option>
                                    <option value="web">Web発注</option>
                                    <option value="store_buy">店舗買付</option>
                                </select>
                            </div>

                            ${createDropdownHtml('del', '納品方法 (複数選択可)', deliveryOptions, savedDeliveries, false)}
                            ${createDropdownHtml('store', '担当店舗 (複数選択可)', storesOptions, savedStores, false)}
                        </section>

                        <!-- ボタン類 -->
                        <div class="mobile-fixed-bottom desktop-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: auto;">
                            <button type="button" id="btn-form-cancel" class="btn" style="flex: 1; max-width: 140px; background: #f8fafc; color: #64748b; font-weight: 700; padding: 1rem; border: 1px solid #e2e8f0; font-size: 0.95rem;"><i class="fas fa-times" style="margin-right: 0.4rem;"></i> キャンセル</button>
                            <button type="submit" class="btn btn-primary" style="flex: 2; background: linear-gradient(135deg, #059669, #10b981); color: white; font-weight: 800; padding: 1rem; font-size: 1rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">
                                <i class="fas fa-save" style="margin-right: 0.4rem;"></i>
                                業者情報を保存
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('btn-form-back').onclick = document.getElementById('btn-form-cancel').onclick = () => {
        currentView = 'list';
        renderView();
    };

    if (isEdit) {
        document.getElementById('vendor-id').value = editingSupplierData.vendor_id || '';
        document.getElementById('vendor-name').value = editingSupplierData.vendor_name || '';
        document.getElementById('vendor-contact').value = editingSupplierData.contact_person || '';
        document.getElementById('vendor-phone').value = editingSupplierData.phone || '';
        document.getElementById('vendor-remarks').value = editingSupplierData.remarks || '';
        document.getElementById('vendor-order-method').value = editingSupplierData.order_method || '';
    }

    function setupDropdowns() {
        function updateDropdownText(wrapper) {
            const textSpan = wrapper.querySelector('[id$="-dropdown-text"]');
            const checkedBoxes = Array.from(wrapper.querySelectorAll('input[type="checkbox"]:checked'));
            if (checkedBoxes.length === 0) {
                textSpan.textContent = '（選択してください）';
                textSpan.style.color = '#94a3b8';
            } else if (checkedBoxes.length <= 2) {
                textSpan.textContent = checkedBoxes.map(cb => cb.dataset.label).join(', ');
                textSpan.style.color = '#0f172a';
            } else {
                textSpan.textContent = checkedBoxes.length + '項目を選択中';
                textSpan.style.color = '#0f172a';
            }
        }

        document.querySelectorAll('.custom-multi-select').forEach(wrapper => {
            const header = wrapper.querySelector('[id$="-dropdown-header"]');
            const menu = wrapper.querySelector('[id$="-dropdown-menu"]');
            const container = wrapper.querySelector('.dropdown-options-container');

            updateDropdownText(wrapper);

            header.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-multi-select [id$="-dropdown-menu"]').forEach(m => {
                    if (m !== menu) {
                        m.style.display = 'none';
                        m.previousElementSibling.querySelector('span.fas').className = 'fas fa-chevron-down';
                    }
                });

                const isOpen = menu.style.display === 'flex';
                menu.style.display = isOpen ? 'none' : 'flex';
                header.querySelector('span.fas').className = isOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
            });

            container.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const label = e.target.closest('label');
                    label.style.background = e.target.checked ? '#eff6ff' : 'white';
                    updateDropdownText(wrapper);
                }
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-multi-select')) {
                document.querySelectorAll('.custom-multi-select [id$="-dropdown-menu"]').forEach(m => {
                    m.style.display = 'none';
                    m.previousElementSibling.querySelector('span.fas').className = 'fas fa-chevron-down';
                });
            }
        });

        const btnAddCat = document.getElementById('btn-add-cat');
        if (btnAddCat) {
            btnAddCat.addEventListener('click', (e) => {
                e.stopPropagation();
                const newCat = prompt('新しいカテゴリー名を最大10文字程度で入力してください:');
                if (!newCat) return;
                const trimmedCat = newCat.trim();
                if (!trimmedCat) return;
                
                const catContainer = document.getElementById('cat-container');
                const wrapper = catContainer.closest('.custom-multi-select');
                
                const existing = Array.from(catContainer.querySelectorAll('input[type="checkbox"]')).map(cb => cb.value);
                if (existing.includes(trimmedCat)) {
                    alert('指定されたカテゴリーはすでに存在しています。');
                    return;
                }

                const label = document.createElement('label');
                label.style.cssText = 'display: flex; align-items: center; gap: 0.6rem; cursor: pointer; padding: 0.6rem 0.8rem; background: #eff6ff; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; font-weight: 600; color: #475569; transition: background 0.2s;';
                label.innerHTML = `<input type="checkbox" value="${trimmedCat}" data-label="${trimmedCat}" style="width: 16px; height: 16px;" checked> ${trimmedCat}`;
                catContainer.appendChild(label);
                
                updateDropdownText(wrapper);
                const menu = document.getElementById('cat-dropdown-menu');
                menu.scrollTop = menu.scrollHeight;
            });
        }
    }

    setupDropdowns();
    setupFormLogic();
}

export async function initSuppliersPage() {
    const container = document.getElementById('suppliers-page-container');
    if (container) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem; color: var(--primary);"></i>
                <p>業者データを読み込んでいます...</p>
            </div>
        `;
    }

    try {
        await reloadStores();
        await fetchSuppliersData();
        currentView = 'list';
        currentPage = 1;
        renderView();
    } catch (error) {
        console.error("Failed to load suppliers data:", error);
        if (container) {
            container.innerHTML = `
                <div style="padding: 3rem; color: var(--danger); text-align: center; max-width: 600px; margin: 0 auto; background: #fef2f2; border-radius: 12px; margin-top: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3 style="margin-top: 0;">データの読み込みに失敗しました</h3>
                    <p style="font-weight: 600; font-size: 1.1rem;">Firebase APIまたはネットワークでエラーが発生しています。</p>
                    <p style="font-family: monospace; font-size: 0.9rem; background: rgba(0,0,0,0.05); padding: 1rem; border-radius: 8px; text-align: left; overflow-x: auto;">
                        ${error.message || error.toString()}
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 1.5rem;">※ 詳細なログはブラウザのコンソール(F12)をご確認ください。</p>
                </div>
            `;
        }
    }
}

async function fetchSuppliersData() {
    const snap = await getDocs(collection(db, "m_suppliers"));
    cachedSuppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function setupFormLogic() {
    const form = document.getElementById('supplier-form');
    if (!form) return;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        btnSubmit.disabled = true;

        const docId = editingSupplierData ? editingSupplierData.id : null;
        
        // Use optional chaining / safe selections for resilience
        const selectedCategories = Array.from(document.querySelectorAll('#cat-container input:checked')).map(cb => cb.value);
        const selectedStores = Array.from(document.querySelectorAll('#store-container input:checked')).map(cb => cb.value);
        const selectedDeliveries = Array.from(document.querySelectorAll('#del-container input:checked')).map(cb => cb.value);

        const vendorData = {
            vendor_id: document.getElementById('vendor-id').value,
            vendor_name: document.getElementById('vendor-name').value,
            contact_person: document.getElementById('vendor-contact').value,
            phone: document.getElementById('vendor-phone').value,
            categories: selectedCategories,
            responsible_stores: selectedStores,
            remarks: document.getElementById('vendor-remarks').value,
            order_method: document.getElementById('vendor-order-method').value,
            delivery_methods: selectedDeliveries,
            updated_at: new Date().toISOString()
        };

        try {
            if (docId) { 
                await updateDoc(doc(db, "m_suppliers", docId), vendorData); 
            } else { 
                await addDoc(collection(db, "m_suppliers"), vendorData); 
            }
            currentView = 'list';
            renderView();
            showAlert('成功', '業者情報を保存しました。');
        } catch (err) {
            console.error(err);
            showAlert('エラー', '保存に失敗しました。');
        } finally {
            btnSubmit.innerHTML = '<i class="fas fa-save"></i> 保存する';
            btnSubmit.disabled = false;
        }
    };
}

// Re-cached for full-screen mode
async function reloadStores() {
    try {
        if (cachedStores.length === 0) {
            const snap = await getDocs(collection(db, "m_stores"));
            cachedStores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
    } catch(e) { console.error(e); }
}

function renderTable(filter = "") {
    const tbody = document.getElementById('suppliers-table-body');
    const countLabel = document.getElementById('suppliers-count');
    if (!tbody) return;

    try {
        const filtered = cachedSuppliers.filter(s => {
            const f = filter.toLowerCase();
            return (s.vendor_name || '').toLowerCase().includes(f) || 
                   (s.contact_person || '').toLowerCase().includes(f) ||
                   (s.vendor_id || '').toLowerCase().includes(f);
        });

        const totalItems = filtered.length;
        let totalPages = Math.ceil(totalItems / pageSize);
        if (totalPages === 0) totalPages = 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * pageSize;
        const itemsToShow = filtered.slice(startIndex, startIndex + pageSize);

        if (countLabel) {
            if (totalItems === 0) {
                countLabel.textContent = '表示中: 0 件';
            } else {
                countLabel.textContent = `表示中: ${startIndex + 1}-${Math.min(startIndex + pageSize, totalItems)} / ${totalItems} 件`;
            }
        }

        tbody.innerHTML = '';
        renderPagination(totalPages, filter);

        if (itemsToShow.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 4rem; color: var(--text-secondary);">該当する業者が見つかりません</td></tr>';
            return;
        }

        itemsToShow.forEach(item => {
            const vendorId = item.vendor_id || '-';
            const vendorName = item.vendor_name || '-';
            const phone = item.phone || '-';
            const stores = (item.responsible_stores || []).map(sid => {
                const s = cachedStores.find(cs => (cs.store_id || cs.id) === sid);
                return s ? (s.store_name || s.Name) : sid;
            }).join(', ');

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.style.transition = 'background 0.2s';
            tr.innerHTML = `
                <td style="padding: 1rem; font-family: monospace; color: var(--text-secondary);">${vendorId}</td>
                <td style="padding: 1rem; font-weight: 600;">${vendorName}</td>
                <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.85rem;">${stores || '未設定'}</td>
                <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.9rem;">${phone}</td>
                <td style="padding: 1rem; text-align: right;">
                    <button class="btn btn-edit-supplier" style="padding: 0.4rem; background: transparent; color: var(--text-secondary);" title="編集"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete-supplier" style="padding: 0.4rem; background: transparent; color: var(--danger);" title="削除"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;

            tr.querySelector('.btn-edit-supplier').onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                editingSupplierData = item;
                currentView = 'form';
                renderView();
            };

            tr.querySelector('.btn-delete-supplier').onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const btn = e.currentTarget;
                const currentVendorName = item.vendor_name || '';
                showConfirm('業者の削除', `業者「${currentVendorName}」を削除してもよろしいですか？`, async () => {
                    try {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        await deleteDoc(doc(db, "m_suppliers", item.id));
                        await fetchSuppliersData();
                        renderTable(filter);
                        showAlert('成功', '削除しました。');
                    } catch (error) {
                        console.error(error);
                        showAlert('エラー', '削除に失敗しました。');
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                    }
                });
            };
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error rendering vendors list:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> エラーが発生しました</td></tr>';
    }
}

function renderPagination(totalPages, filter) {
    const container = document.getElementById('supplier-pagination');
    if (!container) return;
    container.innerHTML = '';
    
    if (totalPages <= 1) return;

    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn';
    btnPrev.style.padding = '0.4rem 0.8rem';
    btnPrev.style.background = 'var(--surface-darker)';
    btnPrev.disabled = currentPage === 1;
    btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnPrev.onclick = () => {
        currentPage--;
        renderTable(filter);
        document.querySelector('.page-content').scrollTop = 0;
    };
    container.appendChild(btnPrev);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.padding = '0.4rem 0.8rem';
        btn.style.minWidth = '36px';
        if (i === currentPage) {
            btn.classList.add('btn-primary');
        } else {
            btn.style.background = 'white';
            btn.style.border = '1px solid var(--border)';
            btn.onclick = () => {
                currentPage = i;
                renderTable(filter);
                document.querySelector('.page-content').scrollTop = 0;
            };
        }
        btn.textContent = i;
        container.appendChild(btn);
    }

    const btnNext = document.createElement('button');
    btnNext.className = 'btn';
    btnNext.style.padding = '0.4rem 0.8rem';
    btnNext.style.background = 'var(--surface-darker)';
    btnNext.disabled = currentPage === totalPages;
    btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnNext.onclick = () => {
        currentPage++;
        renderTable(filter);
        document.querySelector('.page-content').scrollTop = 0;
    };
    container.appendChild(btnNext);
}
