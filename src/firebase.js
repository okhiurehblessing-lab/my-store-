// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBkQ5oE3LaiFGa2ir98MKjZzJ_ZTWQ08Cc",
  authDomain: "myshop-store-bbb1b.firebaseapp.com",
  projectId: "myshop-store-bbb1b",
  storageBucket: "myshop-store-bbb1b.firebasestorage.app",
  messagingSenderId: "292866448884",
  appId: "1:292866448884:web:899267f534f8344b086da1"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
