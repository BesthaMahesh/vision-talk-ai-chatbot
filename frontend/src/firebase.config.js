import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCNUzgTmhqscHUcKYZWOT35pN6k9R3GrOo",
  authDomain: "visiontalk-73e39.firebaseapp.com",
  projectId: "visiontalk-73e39",
  storageBucket: "visiontalk-73e39.firebasestorage.app",
  messagingSenderId: "956846294687",
  appId: "1:956846294687:web:da0a2b3934f07e9c6704aa",
  measurementId: "G-L1ZRGFBZ1E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { app, analytics, auth, googleProvider, storage };

