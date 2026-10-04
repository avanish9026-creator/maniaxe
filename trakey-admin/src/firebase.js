
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDjq71StPRBPhJ5Fplt1Bhe7D96An3V1lc",
  authDomain: "trakey-b6002.firebaseapp.com",
  projectId: "trakey-b6002",
  storageBucket: "trakey-b6002.firebasestorage.app",
  messagingSenderId: "164803851209",
  appId: "1:164803851209:web:1d38106b96bdc4d2adee18",
  measurementId: "G-NW0840WDX2",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const functions = getFunctions(app);

export default app;
