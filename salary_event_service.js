import { db } from './firebase.js';
import { collection, doc, runTransaction, query, where, getDocs, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * 給与イベント共通サービス
 * M1〜M9の各機能から共通利用される給与データ基盤
 */
export const salaryEventService = {
    eventsCollection: 't_salary_events',
    historyCollection: 't_salary_events_history',

    /**
     * IDをサニタイズして生成 (FirestoreのIDとして安全な文字にする)
     */
    _generateEventId(sourceType, sourceId, itemCode, subKey = '') {
        const rawId = `salary_evt_${sourceType}_${sourceId}_${itemCode}_${subKey}`;
        // FirestoreのドキュメントIDとして使えない文字(/など)をアンダースコアに置換
        return rawId.replace(/[\/\\?%*:|"<>]/g, '_');
    },

    /**
     * 金額のバリデーション
     */
    _validateAmount(amount) {
        if (amount === null) return true; // 未確定
        if (typeof amount !== 'number') throw new Error("Amount must be a number or null");
        if (amount < 0) throw new Error("Amount must be 0 or greater (use 'type' for deduction)");
        if (!Number.isInteger(amount)) throw new Error("Amount must be an integer");
        return true;
    },

    /**
     * 給与イベントを作成（冪等性担保）
     * 既存のイベントが存在する場合は上書きせずスキップする
     */
    async createEvent(data) {
        const {
            employeeId, targetMonth, type, itemCode, amount,
            sourceType, sourceId, subKey = '',
            occurredAt, description = '', createdBy
        } = data;

        if (!employeeId || !targetMonth || !type || !itemCode || !sourceType || !sourceId || !createdBy) {
            throw new Error("Missing required fields for createEvent");
        }
        if (type !== 'payment' && type !== 'deduction') {
            throw new Error("Type must be 'payment' or 'deduction'");
        }
        this._validateAmount(amount);

        const eventId = this._generateEventId(sourceType, sourceId, itemCode, subKey);
        const eventRef = doc(db, this.eventsCollection, eventId);
        const historyRef = doc(collection(db, this.historyCollection)); // Auto ID

        try {
            const result = await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(eventRef);
                if (docSnap.exists()) {
                    // 冪等性: 既に作成されている場合はスキップ
                    return { status: 'skipped', eventId: eventId };
                }

                const newEvent = {
                    eventId,
                    employeeId,
                    targetMonth,
                    type,
                    itemCode,
                    amount: amount,
                    sourceType,
                    sourceId,
                    subKey,
                    occurredAt: occurredAt || new Date().toISOString(),
                    description,
                    isActive: true,
                    processingStatus: 'unprocessed',
                    originEventId: null,
                    supersededBy: null,
                    createdBy,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                // 本体作成
                transaction.set(eventRef, newEvent);

                // 監査履歴作成
                const historyLog = {
                    eventId,
                    action: 'CREATE',
                    before: null,
                    after: newEvent,
                    changedBy: createdBy,
                    timestamp: serverTimestamp()
                };
                transaction.set(historyRef, historyLog);

                return { status: 'created', eventId: eventId };
            });
            return result;
        } catch (error) {
            console.error("Error in createEvent transaction: ", error);
            throw error;
        }
    },

    /**
     * 給与イベントを更新（金額確定・ステータス変更など）
     */
    async updateEvent(eventId, updates, userId, actionName = 'UPDATE') {
        const eventRef = doc(db, this.eventsCollection, eventId);
        const historyRef = doc(collection(db, this.historyCollection)); // Auto ID

        try {
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(eventRef);
                if (!docSnap.exists()) {
                    throw new Error("Event does not exist");
                }
                const currentData = docSnap.data();

                if (currentData.processingStatus === 'locked') {
                    throw new Error("Cannot update a locked event");
                }

                if ('amount' in updates) {
                    this._validateAmount(updates.amount);
                }

                // 更新するフィールド
                const updatedData = {
                    ...updates,
                    updatedAt: serverTimestamp()
                };

                // 本体更新
                transaction.update(eventRef, updatedData);

                // 履歴保存 (アトミック)
                const historyLog = {
                    eventId,
                    action: actionName,
                    before: currentData,
                    after: { ...currentData, ...updates },
                    changedBy: userId,
                    timestamp: serverTimestamp()
                };
                transaction.set(historyRef, historyLog);
            });
            return true;
        } catch (error) {
            console.error("Error in updateEvent transaction: ", error);
            throw error;
        }
    },

    /**
     * イベントを無効化（キャンセル）
     */
    async cancelEvent(eventId, userId) {
        return this.updateEvent(eventId, { isActive: false, processingStatus: 'cancelled' }, userId, 'CANCEL');
    },

    /**
     * 翌月へ繰り越す
     */
    async carryOverEvent(oldEventId, nextTargetMonth, userId) {
        const eventRef = doc(db, this.eventsCollection, oldEventId);
        
        try {
            const newEventId = await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(eventRef);
                if (!docSnap.exists()) throw new Error("Event does not exist");
                
                const oldData = docSnap.data();
                if (oldData.processingStatus === 'locked') throw new Error("Cannot carry over a locked event");
                
                // 新イベントデータ
                const nextSubKey = oldData.subKey ? `${oldData.subKey}_co_${nextTargetMonth}` : `co_${nextTargetMonth}`;
                const newId = this._generateEventId(oldData.sourceType, oldData.sourceId, oldData.itemCode, nextSubKey);
                const newEventRef = doc(db, this.eventsCollection, newId);
                const newSnap = await transaction.get(newEventRef);
                if(newSnap.exists()) throw new Error("Carried over event already exists");

                const newEvent = {
                    ...oldData,
                    eventId: newId,
                    targetMonth: nextTargetMonth,
                    isActive: true,
                    processingStatus: 'unprocessed',
                    originEventId: oldEventId,
                    supersededBy: null,
                    createdBy: userId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                
                // 旧データ更新
                const oldUpdates = {
                    isActive: false,
                    supersededBy: newId,
                    updatedAt: serverTimestamp()
                };

                const oldHistoryRef = doc(collection(db, this.historyCollection));
                const newHistoryRef = doc(collection(db, this.historyCollection));

                transaction.update(eventRef, oldUpdates);
                transaction.set(oldHistoryRef, {
                    eventId: oldEventId,
                    action: 'CARRY_OVER_SRC',
                    before: oldData,
                    after: { ...oldData, ...oldUpdates },
                    changedBy: userId,
                    timestamp: serverTimestamp()
                });

                transaction.set(newEventRef, newEvent);
                transaction.set(newHistoryRef, {
                    eventId: newId,
                    action: 'CARRY_OVER_DEST',
                    before: null,
                    after: newEvent,
                    changedBy: userId,
                    timestamp: serverTimestamp()
                });

                return newId;
            });
            return newEventId;
        } catch (error) {
            console.error("Error in carryOverEvent transaction: ", error);
            throw error;
        }
    },

    /**
     * 給与月ごとにイベントを取得 (単純取得、processingStatusは変えない)
     */
    async getEventsByMonth(targetMonth, includeInactive = false) {
        try {
            let q;
            if (includeInactive) {
                q = query(collection(db, this.eventsCollection), where("targetMonth", "==", targetMonth));
            } else {
                q = query(
                    collection(db, this.eventsCollection), 
                    where("targetMonth", "==", targetMonth),
                    where("isActive", "==", true)
                );
            }
            const snap = await getDocs(q);
            const events = [];
            snap.forEach(d => events.push(d.data()));
            return events;
        } catch (error) {
            console.error("Error fetching events by month: ", error);
            throw error;
        }
    }
};
