// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA8W2r7QmhTfdVwh-jcAKbv3zE9gBZd-rk",
  authDomain: "kaneshow-portal.firebaseapp.com",
  projectId: "kaneshow-portal",
  storageBucket: "kaneshow-portal.firebasestorage.app",
  messagingSenderId: "189543945539",
  appId: "1:189543945539:web:390c5d84ddcd5354f94bf6",
  measurementId: "G-BGK2G4PPWC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
export const auth = getAuth(app);

console.log("Firebase initialized successully.");
