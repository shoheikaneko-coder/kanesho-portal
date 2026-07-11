import { db, collection, getDocs, getDoc, setDoc, updateDoc, doc, deleteDoc, addDoc, query, where, orderBy, serverTimestamp, arrayUnion } from './firebase.js';

export class WorkflowEngine {
    constructor() {
        this.collectionName = 'workflows';
    }

    /**
     * 新規ワークフローを作成する
     * @param {string} type ワークフローの種類 (例: "invoice")
     * @param {object} payload 業務固有のデータ
     * @param {object} assignees 次の担当者 { roles: ["president"], userIds: [] }
     * @param {string} initialStatus 初期ステータス (例: "pending_approval")
     * @param {string} requesterId 申請者のユーザーID
     */
    async createWorkflow(type, payload, assignees, initialStatus, requesterId) {
        try {
            const workflowRef = doc(collection(db, this.collectionName));
            const now = new Date();
            
            const newWorkflow = {
                id: workflowRef.id,
                type: type,
                status: initialStatus,
                requester_id: requesterId,
                assignee_roles: assignees.roles || [],
                assignee_user_ids: assignees.userIds || [],
                payload: payload,
                history: [{
                    timestamp: now.toISOString(),
                    user_id: requesterId,
                    action: 'CREATED',
                    comment: '申請を作成しました'
                }],
                attachments: [], // 必要に応じて配列で保持
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            };

            await setDoc(workflowRef, newWorkflow);
            return workflowRef.id;
        } catch (error) {
            console.error("Error creating workflow: ", error);
            throw error;
        }
    }

    /**
     * ワークフローのステータスと担当者を更新する
     * @param {string} workflowId 対象のワークフローID
     * @param {string} newStatus 新しいステータス
     * @param {object} nextAssignees 次の担当者 { roles: [], userIds: [] }。クローズ時は空配列
     * @param {string} actionUserId 操作を行ったユーザーID
     * @param {string} actionName アクション名（例: "APPROVED", "REJECTED"）
     * @param {string} comment コメント
     * @param {object} additionalPayload ペイロードに追加・上書きするデータ
     */
    async updateWorkflowStatus(workflowId, newStatus, nextAssignees, actionUserId, actionName, comment = '', additionalPayload = {}) {
        try {
            const workflowRef = doc(db, this.collectionName, workflowId);
            const now = new Date();
            
            const historyEntry = {
                timestamp: now.toISOString(),
                user_id: actionUserId,
                action: actionName,
                comment: comment
            };

            const updates = {
                status: newStatus,
                assignee_roles: nextAssignees.roles || [],
                assignee_user_ids: nextAssignees.userIds || [],
                history: arrayUnion(historyEntry),
                updated_at: serverTimestamp()
            };

            if (Object.keys(additionalPayload).length > 0) {
                const docSnap = await getDoc(workflowRef);
                if (docSnap.exists()) {
                    const currentData = docSnap.data();
                    updates.payload = { ...currentData.payload, ...additionalPayload };
                }
            }

            await updateDoc(workflowRef, updates);
            return true;
        } catch (error) {
            console.error("Error updating workflow status: ", error);
            throw error;
        }
    }

    /**
     * コメントを追加する（ステータスは変更しない）
     */
    async addComment(workflowId, actionUserId, comment, fileUrls = []) {
        try {
            const workflowRef = doc(db, this.collectionName, workflowId);
            const now = new Date();
            
            const historyEntry = {
                timestamp: now.toISOString(),
                user_id: actionUserId,
                action: 'COMMENT',
                comment: comment,
                files: fileUrls
            };

            const updates = {
                history: arrayUnion(historyEntry),
                updated_at: serverTimestamp()
            };
            
            await updateDoc(workflowRef, updates);
            return true;
        } catch (error) {
            console.error("Error adding comment: ", error);
            throw error;
        }
    }

    /**
     * ワークフロー一覧を取得する
     * @param {object} filters フィルター条件 { type: "invoice", status: ["pending_approval", ...] }
     */
    async getWorkflows(filters = {}) {
        try {
            const qConstraints = [];
            
            if (filters.type) {
                qConstraints.push(where("type", "==", filters.type));
            }
            if (filters.status) {
                if (Array.isArray(filters.status)) {
                    // statusが配列の場合は in クエリを使用。空配列の場合はエラーになるため分岐
                    if (filters.status.length > 0) {
                        qConstraints.push(where("status", "in", filters.status));
                    } else {
                        return []; // 検索対象なし
                    }
                } else {
                    qConstraints.push(where("status", "==", filters.status));
                }
            }
            
            const q = query(collection(db, this.collectionName), ...qConstraints);
            const querySnapshot = await getDocs(q);
            
            const results = [];
            querySnapshot.forEach((doc) => {
                results.push({ id: doc.id, ...doc.data() });
            });
            
            // クライアントサイドで updated_at 降順ソート
            results.sort((a, b) => {
                const timeA = a.updated_at ? (a.updated_at.toMillis ? a.updated_at.toMillis() : Date.parse(a.updated_at)) : 0;
                const timeB = b.updated_at ? (b.updated_at.toMillis ? b.updated_at.toMillis() : Date.parse(b.updated_at)) : 0;
                return timeB - timeA;
            });

            return results;
        } catch (error) {
            console.error("Error getting workflows: ", error);
            throw error;
        }
    }

    /**
     * ワークフローを削除する（管理者用）
     */
    async deleteWorkflow(workflowId) {
        try {
            const workflowRef = doc(db, this.collectionName, workflowId);
            await deleteDoc(workflowRef);
            return true;
        } catch (error) {
            console.error("Error deleting workflow: ", error);
            throw error;
        }
    }
}

export const workflowEngine = new WorkflowEngine();
