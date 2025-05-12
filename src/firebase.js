// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwv5427V3kGgMEtb5gU_mbrILssJgKgK4",
  authDomain: "interpark-21421.firebaseapp.com",
  projectId: "interpark-21421",
  storageBucket: "interpark-21421.firebasestorage.app",
  messagingSenderId: "407244848931",
  appId: "1:407244848931:web:923b261eec90771962d696",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };