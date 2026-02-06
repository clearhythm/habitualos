// Firebase initialization for HabitualOS
// Import the functions you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// HabitualOS Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzDd-q3dv8JCODAItWI1r2pw-c-xwp0fM",
  authDomain: "habitualos.firebaseapp.com",
  projectId: "habitualos",
  storageBucket: "habitualos.firebasestorage.app",
  messagingSenderId: "757366609363",
  appId: "1:757366609363:web:9db09b35562a8d3c480b26",
  measurementId: "G-D4XFJZ3V9B"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Export Firebase services
export const db = getFirestore(firebaseApp);

// Export helpers so other modules don't import from gstatic directly
export { doc, getDoc, setDoc, collection, addDoc };
