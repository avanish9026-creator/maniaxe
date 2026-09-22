/* ==========================================================================
   MANIAXE TYPING — FIREBASE AUTH
   Reuses the existing Maniaxe Firebase project so accounts created on the
   old site (and new signups here) live in the same place.
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signInAnonymously,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAgFeXvBzX6WGLDgRxCbAQ0Xq5ukFptTPs",
    authDomain: "maniaxe-typing.firebaseapp.com",
    projectId: "maniaxe-typing",
    storageBucket: "maniaxe-typing.firebasestorage.app",
    messagingSenderId: "894793852647",
    appId: "1:894793852647:web:aa732f0d24814b0b83a442",
    measurementId: "G-24D3NESCQ4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
window.maniaxeFirebaseApp = app;
window.maniaxeAuth = auth;
const googleProvider = new GoogleAuthProvider();

/* ---------------- sign up ---------------- */

window.signUpUser = async function () {
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const message = document.getElementById("authMessage");

    if (!name || !email || !password) {
        message.style.color = "var(--error)";
        message.textContent = "Please fill all fields.";
        return;
    }
    if (password.length < 6) {
        message.style.color = "var(--error)";
        message.textContent = "Password must contain at least 6 characters.";
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });

        message.style.color = "var(--correct)";
        message.textContent = "Account created! Redirecting...";
        setTimeout(() => { window.location.href = "index.html"; }, 900);
    } catch (error) {
        message.style.color = "var(--error)";
        message.textContent = getFirebaseError(error.code);
    }
};

/* ---------------- email login ---------------- */

window.loginUser = async function () {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const message = document.getElementById("authMessage");

    if (!email || !password) {
        message.style.color = "var(--error)";
        message.textContent = "Please enter your email and password.";
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        message.style.color = "var(--correct)";
        message.textContent = "Login successful!";
        setTimeout(() => { window.location.href = "index.html"; }, 600);
    } catch (error) {
        message.style.color = "var(--error)";
        message.textContent = getFirebaseError(error.code);
    }
};

/* ---------------- google login ---------------- */

window.googleLogin = async function () {
    const message = document.getElementById("authMessage");
    try {
        await signInWithPopup(auth, googleProvider);
        message.style.color = "var(--correct)";
        message.textContent = "Google login successful!";
        setTimeout(() => { window.location.href = "index.html"; }, 600);
    } catch (error) {
        message.style.color = "var(--error)";
        message.textContent = getFirebaseError(error.code);
    }
};

/* ---------------- forgot password ---------------- */

window.resetPassword = async function () {
    const email = document.getElementById("loginEmail").value.trim();
    const message = document.getElementById("authMessage");

    if (!email) {
        message.style.color = "var(--error)";
        message.textContent = "Enter your email first.";
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        message.style.color = "var(--correct)";
        message.textContent = "Password reset email sent. Check your inbox.";
    } catch (error) {
        message.style.color = "var(--error)";
        message.textContent = getFirebaseError(error.code);
    }
};

/* ---------------- logout ---------------- */

window.logoutUser = async function () {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        console.error(error);
    }
};


/* ---------------- anonymous session for APK download counting ---------------- */

window.ensureDownloadAuth = async function () {
    if (auth.currentUser) return { user: auth.currentUser, temporary: false };
    const credential = await signInAnonymously(auth);
    return { user: credential.user, temporary: true };
};

window.endTemporaryDownloadAuth = async function () {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        await signOut(auth);
    }
};

/* ---------------- shared auth-state watcher (used by app.js on every page) ---------------- */

window.watchAuthState = function (callback) {
    onAuthStateChanged(auth, function (user) {
        callback(user && !user.isAnonymous ? user : null);
    });
};

/* ---------------- gate a page behind login (used by profile.html) ---------------- */

window.protectPage = function (onUser) {
    onAuthStateChanged(auth, function (user) {
        if (!user) {
            window.location.href = "login.html";
        } else if (typeof onUser === "function") {
            onUser(user);
        }
    });
};

/* ---------------- keep logged-in users off login/signup ---------------- */

window.checkLoginPage = function () {
    onAuthStateChanged(auth, function (user) {
        if (user) {
            window.location.href = "index.html";
        }
    });
};

/* ---------------- error copy ---------------- */

function getFirebaseError(code) {
    switch (code) {
        case "auth/email-already-in-use": return "This email is already registered.";
        case "auth/invalid-email": return "Please enter a valid email address.";
        case "auth/weak-password": return "Password must contain at least 6 characters.";
        case "auth/invalid-credential": return "Incorrect email or password.";
        case "auth/user-not-found": return "No account found with this email.";
        case "auth/wrong-password": return "Incorrect password.";
        case "auth/popup-closed-by-user": return "Google login was cancelled.";
        case "auth/popup-blocked": return "Please allow popups for this website.";
        case "auth/unauthorized-domain": return "This website domain is not authorized in Firebase.";
        default: return "Something went wrong. Please try again.";
    }
}
