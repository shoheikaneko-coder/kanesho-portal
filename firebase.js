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
    documentId
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { firebaseConfig } from "./env.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
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

