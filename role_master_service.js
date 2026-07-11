import { db, collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from './firebase.js';

export class RoleMasterService {
    constructor() {
        this.collectionName = 'm_roles';
        this.defaultRoles = [
            { id: 'Admin', label: '管理者', memo: '', isSystem: true, order: 10 },
            { id: 'Manager', label: '店長', memo: '', isSystem: true, order: 20 },
            { id: 'Staff', label: '一般社員', memo: '', isSystem: true, order: 30 },
            { id: 'PartTimer', label: 'アルバイトスタッフ', memo: '', isSystem: true, order: 40 },
            { id: 'Tablet', label: '店舗タブレット', memo: '', isSystem: true, order: 50 }
        ];
    }

    async getRoles() {
        try {
            const q = query(collection(db, this.collectionName), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            
            let roles = [];
            snapshot.forEach(doc => {
                roles.push({ id: doc.id, ...doc.data() });
            });

            // もしデータが一件も無ければ、シードデータ（デフォルト権限）を自動登録する
            if (roles.length === 0) {
                console.log('Seeding default roles...');
                for (const r of this.defaultRoles) {
                    await setDoc(doc(db, this.collectionName, r.id), r);
                    roles.push(r);
                }
            }

            return roles;
        } catch (error) {
            console.error("Error fetching roles:", error);
            // オフライン時やエラー時はフォールバックとしてデフォルトを返す
            return this.defaultRoles;
        }
    }

    async createRole(label, memo = '') {
        // IDは自動生成（プレフィックス + ランダム文字列）
        const id = 'role_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const newRole = {
            id,
            label,
            memo,
            isSystem: false,
            order: 100 // カスタム権限は後ろに並べる
        };
        await setDoc(doc(db, this.collectionName, id), newRole);
        return newRole;
    }

    async updateRole(id, updates) {
        // updates = { label: '...', memo: '...' }
        await setDoc(doc(db, this.collectionName, id), updates, { merge: true });
    }
}

export const roleMasterService = new RoleMasterService();
