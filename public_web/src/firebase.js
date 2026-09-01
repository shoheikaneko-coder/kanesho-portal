import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: "AIzaSyC574d5djCP7PCMdX8MKhvH0lOKPgd-H7M",
  authDomain: "kaneshow-portal.firebaseapp.com",
  projectId: "kaneshow-portal",
  storageBucket: "kaneshow-portal.firebasestorage.app",
  messagingSenderId: "189543945539",
  appId: "1:189543945539:web:390c5d84ddcd5354f94bf6",
  measurementId: "G-BGK2G4PPWC"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
