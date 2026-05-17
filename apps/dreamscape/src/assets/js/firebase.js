import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection,
  query, where, orderBy, limit,
  onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import {
  getDatabase,
  ref, set, onValue, onDisconnect,
  serverTimestamp as rtdbTimestamp,
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCgm0qq5l99IYWWElWYQxUQh3Ct10DPGeU",
  authDomain: "daily-practice-c5203.firebaseapp.com",
  databaseURL: "https://daily-practice-c5203-default-rtdb.firebaseio.com",
  projectId: "daily-practice-c5203",
  storageBucket: "daily-practice-c5203.firebasestorage.app",
  messagingSenderId: "1099037762298",
  appId: "1:1099037762298:web:f32cf6481d02e17cf1df43",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const rtdb = getDatabase(app);

export {
  doc, getDoc, setDoc, updateDoc,
  collection,
  query, where, orderBy, limit,
  onSnapshot, serverTimestamp,
  ref, set, onValue, onDisconnect, rtdbTimestamp,
};
