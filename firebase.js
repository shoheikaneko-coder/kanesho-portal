import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore,
    collection,
    getDocs,
    query,
    where,
    getDoc,
    doc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    addDoc,
    setDoc,
    deleteDoc,
    writeBatch,
    orderBy,
    limit,
    arrayUnion,
    arrayRemove,
    deleteField,
    increment,
    documentId,
    enableMultiTabIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { firebaseConfig } from "./env.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 【安全対策】Firebaseローカルキャッシュ（オフライン永続化）の有効化
// プライベートブラウズ等でIndexedDBがブロックされた場合はエラーを無視して通常通信にフォールバックする
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn("Firebase caching failed: Multiple tabs might be open, or unsupported.");
    } else if (err.code === 'unimplemented') {
        console.warn("Firebase caching is not supported by this browser.");
    } else {
        console.warn("Firebase caching error:", err);
    }
});

export const auth = getAuth(app);
export const storage = getStorage(app);

// Re-export Firestore helper functions
export {
    collection,
    getDocs,
    query,
    where,
    getDoc,
    doc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    addDoc,
    setDoc,
    deleteDoc,
    writeBatch,
    orderBy,
    limit,
    arrayUnion,
    arrayRemove,
    deleteField,
    increment,
    documentId
};

console.log("Firebase initialized successfully.");

