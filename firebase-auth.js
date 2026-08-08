import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";


// ================================
// FIREBASE CONFIGURATION
// ================================

const firebaseConfig = {

    apiKey: "AIzaSyAGvHID5DApOs0toZzrwNqAMGffUZJYbY0",

    authDomain: "maniaxe-academy.firebaseapp.com",

    projectId: "maniaxe-academy",

    storageBucket: "maniaxe-academy.firebasestorage.app",

    messagingSenderId: "355090544639",

    appId: "1:355090544639:web:88433b09cedeaf648b19ca"

};


// ================================
// INITIALIZE FIREBASE
// ================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();


// ================================
// SIGN UP
// ================================

window.signUpUser = async function () {

    const name =
        document.getElementById("signupName").value.trim();

    const email =
        document.getElementById("signupEmail").value.trim();

    const password =
        document.getElementById("signupPassword").value;

    const message =
        document.getElementById("authMessage");


    if (!name || !email || !password) {

        message.textContent =
            "Please fill all fields.";

        return;

    }


    if (password.length < 6) {

        message.textContent =
            "Password must contain at least 6 characters.";

        return;

    }


    try {

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;


        await updateProfile(
            user,
            {
                displayName: name
            }
        );


        message.style.color = "#16a34a";

        message.textContent =
            "Account created successfully!";


        setTimeout(function () {

            window.location.href =
                "index.html";

        }, 1000);


    } catch (error) {

        console.error(error);

        message.style.color = "#dc2626";

        message.textContent =
            getFirebaseError(error.code);

    }

};


// ================================
// EMAIL LOGIN
// ================================

window.loginUser = async function () {

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    const message =
        document.getElementById("authMessage");


    if (!email || !password) {

        message.style.color = "#dc2626";

        message.textContent =
            "Please enter your email and password.";

        return;

    }


    try {

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );


        message.style.color = "#16a34a";

        message.textContent =
            "Login successful!";


        setTimeout(function () {

            window.location.href =
                "index.html";

        }, 700);


    } catch (error) {

        console.error(error);

        message.style.color = "#dc2626";

        message.textContent =
            getFirebaseError(error.code);

    }

};


// ================================
// GOOGLE LOGIN
// ================================

window.googleLogin = async function () {

    const message =
        document.getElementById("authMessage");


    try {

        await signInWithPopup(
            auth,
            googleProvider
        );


        message.style.color = "#16a34a";

        message.textContent =
            "Google login successful!";


        setTimeout(function () {

            window.location.href =
                "index.html";

        }, 700);


    } catch (error) {

        console.error(error);

        message.style.color = "#dc2626";

        message.textContent =
            getFirebaseError(error.code);

    }

};


// ================================
// FORGOT PASSWORD
// ================================

window.resetPassword = async function () {

    const email =
        document.getElementById("loginEmail").value.trim();

    const message =
        document.getElementById("authMessage");


    if (!email) {

        message.style.color = "#dc2626";

        message.textContent =
            "Enter your email first.";

        return;

    }


    try {

        await sendPasswordResetEmail(
            auth,
            email
        );


        message.style.color = "#16a34a";

        message.textContent =
            "Password reset email sent. Check your inbox.";

    } catch (error) {

        console.error(error);

        message.style.color = "#dc2626";

        message.textContent =
            getFirebaseError(error.code);

    }

};


// ================================
// LOGOUT
// ================================

window.logoutUser = async function () {

    try {

        await signOut(auth);

        window.location.href =
            "login.html";

    } catch (error) {

        console.error(error);

    }

};


// ================================
// PROTECT MAIN WEBSITE
// ================================

window.protectPage = function () {

    onAuthStateChanged(
        auth,
        function (user) {

            if (!user) {

                window.location.href =
                    "login.html";

            }

        }
    );

};


// ================================
// CHECK LOGIN PAGE
// ================================

window.checkLoginPage = function () {

    onAuthStateChanged(
        auth,
        function (user) {

            if (user) {

                window.location.href =
                    "index.html";

            }

        }
    );

};


// ================================
// FIREBASE ERROR MESSAGES
// ================================

function getFirebaseError(code) {

    switch (code) {

        case "auth/email-already-in-use":
            return "This email is already registered.";

        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/weak-password":
            return "Password must contain at least 6 characters.";

        case "auth/invalid-credential":
            return "Incorrect email or password.";

        case "auth/user-not-found":
            return "No account found with this email.";

        case "auth/wrong-password":
            return "Incorrect password.";

        case "auth/popup-closed-by-user":
            return "Google login was cancelled.";

        case "auth/popup-blocked":
            return "Please allow popups for this website.";

        case "auth/unauthorized-domain":
            return "This website domain is not authorized in Firebase.";

        default:
            return "Something went wrong. Please try again.";

    }

}