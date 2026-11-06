import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  collectionGroup,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import app from "./firebase";
import "./App.css";
import { buildCsv, buildPdf, downloadBlob, financialYear, selectRecords } from "./paymentExport";
import { buildUserRows, buildUsersCsv, buildUsersPdf } from "./userExport";
import Overview from "./panels/Overview";
import DataExplorer from "./panels/DataExplorer";
import TeamPanel from "./panels/TeamPanel";
import UpdateGatePanel from "./panels/UpdateGatePanel";

const db = getFirestore(app);
const ADMIN_EMAIL = "support.trakey@gmail.com";

// The three Trakey Pro plans. Keep the prices the same as the app (TrakeyPro.kt) and the website (pro.js).
const PLANS = {
  monthly: { label: "Monthly", price: 19 },
  yearly: { label: "Yearly", price: 149 },
  lifetime: { label: "Lifetime", price: 699 },
};
// Sidebar. Third value true = owner only (editors never see it).
const NAV = [
  ["", [["dashboard", "Overview"]]],
  ["People", [["users", "Users", true], ["feedback", "Feedback"], ["contact", "Contact messages"]]],
  ["Money", [["payments", "Payments", true]]],
  ["Content", [["announcements", "Announcements"], ["notifications", "Notifications"], ["updates", "App updates"], ["gate", "Update gate"], ["history", "Message history"]]],
  ["Advanced", [["explorer", "Data explorer", true], ["team", "Team access", true]]],
];
const TRIAL_DAYS = 30;   // same as TRIAL_DAYS in the app and pro.js
const REWARD_DAYS = 30;  // 3-star reward
const ADM_DAY_MS = 24 * 60 * 60 * 1000;
const LIFETIME_MS = 4102444800000; // 1 Jan 2100
// Used to END a trial / reward without deleting the field (the app starts a new trial if the field is missing).
const ENDED_AT = Timestamp.fromDate(new Date("2020-01-01T00:00:00Z"));
const fmtDay = (ms) => (ms ? new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

const manualInputStyle = {
  background: "#11141a", color: "#fff", border: "1px solid #30343d", borderRadius: "8px", padding: "9px 10px", fontSize: "14px", width: "100%", boxSizing: "border-box",
};
const manualLabelStyle = { display: "grid", gap: "4px", fontSize: "12px", color: "#9da3ad" };

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(""); // "owner" | "editor"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [currentSection, setCurrentSection] = useState("dashboard");
  const [announcements, setAnnouncements] = useState([]);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("General");
  const [actionText, setActionText] = useState("");
  const [actionUrl, setActionUrl] = useState("");

  const [updates, setUpdates] = useState([]);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");
  const [version, setVersion] = useState("");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateDescription, setUpdateDescription] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationSuccess, setNotificationSuccess] = useState("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Phase 3 live data
  const [adminUsers, setAdminUsers] = useState([]);
  const [proItems, setProItems] = useState([]); // proStatus docs, used only for the user data download
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [contactItems, setContactItems] = useState([]);
  const [backupMainItems, setBackupMainItems] = useState([]);
  const [phase3Error, setPhase3Error] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [feedbackFilter, setFeedbackFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [phase3BusyId, setPhase3BusyId] = useState("");

  // Manual UPI payments (orders are created by the Trakey app, approved here)
  const [paymentItems, setPaymentItems] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState("pending");
  const [paymentBusyId, setPaymentBusyId] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [userPanel, setUserPanel] = useState(null); // { uid, kind: "gift" | "remove" }
  const [removeTrialToo, setRemoveTrialToo] = useState(false);
  const [userBusyId, setUserBusyId] = useState("");
  const [userMsg, setUserMsg] = useState("");
  const [userError, setUserError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [shotCache, setShotCache] = useState({});
  const [openShots, setOpenShots] = useState({});
  // Payment records download (tax) + manual records
  const [exportStatus, setExportStatus] = useState("both");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const emptyManual = () => ({
    status: "approved", plan: "yearly", amount: "", currency: "INR", date: todayIst(), name: "", email: "", uid: "",
    ref: "", method: "PayPal", country: "", note: "", grantPro: false, gift: false,
  });
  // Amount actually received. approveEdit = panel on a pending order; amountEdit = panel on an approved one.
  const [approveEdit, setApproveEdit] = useState(null); // { id, amount, note }
  const [amountEdit, setAmountEdit] = useState(null);   // { id, amount, reason }
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManual());
  const [manualBusy, setManualBusy] = useState(false);

  const checkAdmin = async (signedInUser) => {
    const mail = String(signedInUser.email || "").toLowerCase();
    if (mail === ADMIN_EMAIL) {
      setRole("owner");
      setUser(signedInUser);
      return true;
    }

    // Team members: the owner adds their Account ID in "Team access".
    try {
      const snap = await getDoc(doc(db, "adminStaff", signedInUser.uid));
      const d = snap.exists() ? snap.data() : null;
      if (d && d.role === "editor" && d.active !== false) {
        setRole("editor");
        setUser(signedInUser);
        return true;
      }
    } catch (err) {
      console.warn("Team access check failed:", err);
    }

    setError("This account is not authorized yet. To get access, send this Account ID to the Trakey owner: " + signedInUser.uid);
    signOut(auth);
    return false;
  };

  useEffect(() => {
    let cancelled = false;

    // Register the auth listener immediately so a slow browser persistence
    // operation can never leave the Admin stuck on "Restoring your admin session".
    const unsubscribe = onAuthStateChanged(auth, async (signedInUser) => {
      if (cancelled) return;

      if (signedInUser) {
        await checkAdmin(signedInUser);
      } else {
        setUser(null);
        setRole("");
      }

      if (!cancelled) setAuthReady(true);
    });

    // Persistence is best-effort and must not block initial auth restoration.
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      if (!cancelled) {
        console.warn("Firebase auth persistence warning:", err);
      }
    });

    // Safety fallback: never leave the UI permanently stuck on the restore screen.
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setAuthReady(true);
      }
    }, 8000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await checkAdmin(result.user);
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      await checkAdmin(result.user);
    } catch (err) {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setRole("");
    setCurrentSection("dashboard");
  };

  const loadAnnouncements = async () => {
    setAnnouncementLoading(true);
    setAnnouncementError("");

    try {
      const snapshot = await getDocs(collection(db, "adminAnnouncements"));

      const items = snapshot.docs
        .map((announcementDoc) => ({
          id: announcementDoc.id,
          ...announcementDoc.data(),
        }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

      setAnnouncements(items);
    } catch (err) {
      setAnnouncementError(
        err.message || "Unable to load announcements."
      );
    } finally {
      setAnnouncementLoading(false);
    }
  };

  useEffect(() => {
    if (user && currentSection === "announcements") {
      loadAnnouncements();
    }
  }, [user, currentSection]);

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();
    setAnnouncementError("");
    setSuccessMessage("");

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const cleanActionText = actionText.trim();
    const cleanActionUrl = actionUrl.trim();

    if (!cleanTitle || !cleanMessage) {
      setAnnouncementError("Title and message are required.");
      return;
    }

    if (cleanActionText && !cleanActionUrl) {
      setAnnouncementError(
        "Enter an action URL when an action button is provided."
      );
      return;
    }

    setAnnouncementLoading(true);

    try {
      await addDoc(collection(db, "adminAnnouncements"), {
        title: cleanTitle,
        message: cleanMessage,
        type,
        actionText: cleanActionText || null,
        actionUrl: cleanActionUrl || null,
        active: true,
        published: true,
        createdAt: serverTimestamp(),
        publishedAt: serverTimestamp(),
        publishedBy: user.email,
        createdBy: user.email,
      });

      setTitle("");
      setMessage("");
      setType("General");
      setActionText("");
      setActionUrl("");
      setSuccessMessage("Announcement published successfully.");

      await loadAnnouncements();
    } catch (err) {
      setAnnouncementError(
        err.message || "Unable to publish the announcement."
      );
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    const confirmed = window.confirm(
      "Delete this announcement? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setAnnouncementError("");
    setSuccessMessage("");
    setAnnouncementLoading(true);

    try {
      await deleteDoc(doc(db, "adminAnnouncements", announcementId));
      setAnnouncements((current) =>
        current.filter((item) => item.id !== announcementId)
      );
      setSuccessMessage("Announcement deleted.");
    } catch (err) {
      setAnnouncementError(
        err.message || "Unable to delete the announcement."
      );
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const loadUpdates = async () => {
    setUpdateLoading(true);
    setUpdateError("");
    try {
      const snapshot = await getDocs(collection(db, "appUpdates"));
      const items = snapshot.docs
        .map((updateDoc) => ({ id: updateDoc.id, ...updateDoc.data() }))
        .sort((a, b) => {
          const aTime = a.publishedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.publishedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
      setUpdates(items);
    } catch (err) {
      setUpdateError(err.message || "Unable to load updates.");
    } finally { setUpdateLoading(false); }
  };

  useEffect(() => {
    if (user && currentSection === "updates") loadUpdates();
  }, [user, currentSection]);

  const handleCreateUpdate = async (event) => {
    event.preventDefault();
    setUpdateError(""); setUpdateSuccess("");
    const cleanVersion = version.trim();
    const cleanTitle = updateTitle.trim();
    const cleanDescription = updateDescription.trim();
    const cleanReleaseNotes = releaseNotes.trim();
    const cleanDownloadUrl = downloadUrl.trim();
    if (!cleanVersion || !cleanTitle || !cleanDescription) {
      setUpdateError("Version, title and description are required."); return;
    }
    if (cleanDownloadUrl && !/^https?:\/\//i.test(cleanDownloadUrl)) {
      setUpdateError("Download URL must start with http:// or https://."); return;
    }
    setUpdateLoading(true);
    try {
      await addDoc(collection(db, "appUpdates"), {
        version: cleanVersion, title: cleanTitle, description: cleanDescription,
        releaseNotes: cleanReleaseNotes, downloadUrl: cleanDownloadUrl || null,
        active: true, createdAt: serverTimestamp(), publishedAt: serverTimestamp(), publishedBy: user.email,
      });
      setVersion(""); setUpdateTitle(""); setUpdateDescription(""); setReleaseNotes(""); setDownloadUrl("");
      setUpdateSuccess("Update published successfully.");
      await loadUpdates();
    } catch (err) {
      setUpdateError(err.message || "Unable to publish the update.");
    } finally { setUpdateLoading(false); }
  };

  const handleDeleteUpdate = async (updateId) => {
    if (!window.confirm("Delete this update? This cannot be undone.")) return;
    setUpdateError(""); setUpdateSuccess(""); setUpdateLoading(true);
    try {
      await deleteDoc(doc(db, "appUpdates", updateId));
      setUpdates((current) => current.filter((item) => item.id !== updateId));
      setUpdateSuccess("Update deleted.");
    } catch (err) {
      setUpdateError(err.message || "Unable to delete the update.");
    } finally { setUpdateLoading(false); }
  };

  const loadNotifications = async () => {
    setNotificationLoading(true);
    setNotificationError("");
    try {
      const snapshot = await getDocs(collection(db, "adminNotifications"));
      const items = snapshot.docs
        .map((notificationDoc) => ({ id: notificationDoc.id, ...notificationDoc.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setNotifications(items);
    } catch (err) {
      setNotificationError(err.message || "Unable to load notifications.");
    } finally {
      setNotificationLoading(false);
    }
  };

  useEffect(() => {
    if (user && currentSection === "notifications") loadNotifications();
  }, [user, currentSection]);

  const handleCreateNotification = async (event) => {
    event.preventDefault();

    if (notificationLoading) return;

    setNotificationError("");
    setNotificationSuccess("");

    const cleanTitle = notificationTitle.trim();
    const cleanMessage = notificationMessage.trim();

    if (!cleanTitle || !cleanMessage) {
      setNotificationError("Title and message are required.");
      return;
    }

    setNotificationLoading(true);

    try {
      const sendTrakeyNotification = httpsCallable(
        functions,
        "sendTrakeyNotification"
      );

      const result = await sendTrakeyNotification({
        title: cleanTitle,
        message: cleanMessage,
      });

      const resultData = result?.data;

      setNotificationTitle("");
      setNotificationMessage("");
      setNotificationSuccess(
        resultData?.message || "Notification sent successfully."
      );

      // The callable function is responsible for the actual FCM delivery
      // and server-side notification history. Reload the history only after
      // the function confirms that the request was accepted.
      await loadNotifications();
    } catch (err) {
      console.error("sendTrakeyNotification failed:", err);
      setNotificationError(
        err?.message ||
          "Unable to send the notification. Please try again."
      );
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleDeleteNotification = async (id) => {
    setNotificationLoading(true);
    setNotificationError("");
    try {
      await deleteDoc(doc(db, "adminNotifications", id));
      await loadNotifications();
    } catch (err) {
      setNotificationError(err.message || "Unable to delete the notification.");
    } finally {
      setNotificationLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const [announcementSnap, notificationSnap, updateSnap] = await Promise.all([
        getDocs(collection(db, "adminAnnouncements")),
        getDocs(collection(db, "adminNotifications")),
        getDocs(collection(db, "appUpdates")),
      ]);
      const items = [
        ...announcementSnap.docs.map((d) => ({ id: `announcement-${d.id}`, category: "Announcement", title: d.data().title || "Announcement", message: d.data().message || "", timestamp: d.data().createdAt, data: d.data() })),
        ...notificationSnap.docs.map((d) => ({ id: `notification-${d.id}`, category: "Notification", title: d.data().title || "Notification", message: d.data().message || "", timestamp: d.data().createdAt, data: d.data() })),
        ...updateSnap.docs.map((d) => ({ id: `update-${d.id}`, category: "Update", title: d.data().title || `Version ${d.data().version || ""}`, message: d.data().description || "", timestamp: d.data().createdAt, data: d.data() })),
      ].sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
      setHistory(items);
    } catch (err) {
      setHistoryError(err.message || "Unable to load message history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (user && currentSection === "history") loadHistory();
  }, [user, currentSection]);

  // One listener set keeps Dashboard / Users / Feedback / Contact live without refreshes.
  useEffect(() => {
    if (!user) {
      setAdminUsers([]);
      setFeedbackItems([]);
      setContactItems([]);
      setBackupMainItems([]);
      setPaymentItems([]);
      setProItems([]);
      return undefined;
    }

    setPhase3Error("");
    const unsubs = [];
    const isOwner = role === "owner";

    if (isOwner) unsubs.push(
      onSnapshot(
        collection(db, "users"),
        (snap) => setAdminUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => setPhase3Error(err.message || "Unable to load users.")
      )
    );

    if (isOwner) unsubs.push(
      onSnapshot(
        collectionGroup(db, "backup"),
        (snap) => setBackupMainItems(snap.docs.filter((d) => d.id === "main")),
        (err) => setPhase3Error(err.message || "Unable to load backup user data.")
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "feedbackSubmissions"),
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          items.sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0));
          setFeedbackItems(items);
        },
        (err) => setPhase3Error(err.message || "Unable to load feedback.")
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "contactMessages"),
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          items.sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0));
          setContactItems(items);
        },
        (err) => setPhase3Error(err.message || "Unable to load contact messages.")
      )
    );

    if (isOwner) unsubs.push(
      onSnapshot(
        collection(db, "payments"),
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
          setPaymentItems(items);
        },
        (err) => setPaymentError(err.message || "Unable to load payments.")
      )
    );

    if (isOwner) unsubs.push(
      onSnapshot(
        collection(db, "proStatus"),
        (snap) => setProItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setProItems([])
      )
    );

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [user, role]);

  const updateFeedbackHandled = async (id, handled) => {
    setPhase3BusyId(id);
    try {
      await updateDoc(doc(db, "feedbackSubmissions", id), { handled });
    } catch (err) {
      setPhase3Error(err.message || "Unable to update feedback status.");
    } finally {
      setPhase3BusyId("");
    }
  };

  const updateContactStatus = async (id, status) => {
    setPhase3BusyId(id);
    try {
      await updateDoc(doc(db, "contactMessages", id), { status });
    } catch (err) {
      setPhase3Error(err.message || "Unable to update contact status.");
    } finally {
      setPhase3BusyId("");
    }
  };

  // ---- Manual UPI payments ----
  const PAY_DAY_MS = 24 * 60 * 60 * 1000;
  const PAY_LIFETIME_UNTIL = 4102444800000; // 1 Jan 2100, the app shows this as "Lifetime"

  // Extends Pro from the later of now / current end. Never downgrades an existing Lifetime.
  const proPatchFor = (cur, plan) => {
    const base = Math.max(Number(cur.proUntil) || 0, Date.now());
    let proUntil;
    if (plan === "lifetime") proUntil = PAY_LIFETIME_UNTIL;
    else if (plan === "monthly") proUntil = base + 30 * PAY_DAY_MS;
    else proUntil = base + 365 * PAY_DAY_MS;
    return cur.plan === "lifetime" ? {} : { proUntil, plan };
  };

  const toggleShot = async (orderId) => {
    const open = !openShots[orderId];
    setOpenShots((prev) => ({ ...prev, [orderId]: open }));
    if (!open || shotCache[orderId]) return;
    try {
      const snap = await getDoc(doc(db, "paymentShots", orderId));
      setShotCache((prev) => ({ ...prev, [orderId]: snap.exists() ? snap.data().data || "" : "" }));
    } catch (err) {
      setPaymentError(err.message || "Unable to load the screenshot.");
    }
  };

  // List prices (same as the app). Used to show what a free gift was worth; never counted as income.
  const PLAN_LIST_PRICE = { monthly: PLANS.monthly.price, yearly: PLANS.yearly.price, lifetime: PLANS.lifetime.price };

  // "" or a bad number -> NaN. 0 is allowed (free gift).
  const parseMoney = (v) => {
    const s = String(v ?? "").trim();
    if (s === "") return NaN;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 && n <= 1000000 ? Math.round(n * 100) / 100 : NaN;
  };

  const startApprove = (order) => {
    setPaymentError("");
    setAmountEdit(null);
    setApproveEdit({ id: order.id, amount: String(order.amount ?? ""), note: "" });
  };

  const startAmountEdit = (order) => {
    setPaymentError("");
    setApproveEdit(null);
    setAmountEdit({ id: order.id, amount: String(order.amount ?? ""), reason: "" });
  };

  // One transaction: marks the order approved AND extends Pro, so they can never get out of step.
  // `received` = the money that really reached you (can differ from the plan price, or be 0 for a free gift).
  // That number becomes `amount`, which the tax downloads add up. The plan price is kept as `listAmount`.
  const approvePayment = async (order, received, adminNote) => {
    const amount = parseMoney(received);
    if (Number.isNaN(amount)) return setPaymentError("Enter the amount you actually received (0 if it was free).");
    setPaymentBusyId(order.id);
    setPaymentError("");
    try {
      await runTransaction(db, async (tx) => {
        const payRef = doc(db, "payments", order.id);
        const proRef = doc(db, "proStatus", order.uid);
        const paySnap = await tx.get(payRef);
        const proSnap = await tx.get(proRef);
        if (!paySnap.exists() || paySnap.data().status !== "pending") {
          throw new Error("This payment is no longer pending.");
        }
        const pay = paySnap.data();
        const listAmount = Number(pay.listAmount ?? pay.amount) || 0;
        const cur = proSnap.exists() ? proSnap.data() : {};
        const patch = proPatchFor(cur, order.plan);
        const upd = {
          status: "approved",
          reviewedAt: serverTimestamp(),
          amount,
          listAmount,
          amountAdjusted: amount !== listAmount,
          gift: amount === 0,
        };
        if (amount !== (Number(pay.amount) || 0)) {
          upd.amountHistory = arrayUnion({ from: Number(pay.amount) || 0, to: amount, at: Timestamp.now(), by: user?.email || ADMIN_EMAIL, why: "Set at approval" });
        }
        if ((adminNote || "").trim()) upd.note = adminNote.trim();
        tx.set(proRef, { ...patch, paidVia: amount === 0 ? "gift" : "upi", updatedAt: serverTimestamp() }, { merge: true });
        tx.update(payRef, upd);
      });
      setApproveEdit(null);
    } catch (err) {
      setPaymentError(err.message || "Unable to approve this payment.");
    } finally {
      setPaymentBusyId("");
    }
  };

  // Change the amount of an already approved record (e.g. you gave a discount, or it was a free gift).
  // Pro access is not touched. Every change is kept in amountHistory.
  const saveAmountEdit = async (order) => {
    const e = amountEdit;
    if (!e) return;
    const amount = parseMoney(e.amount);
    if (Number.isNaN(amount)) return setPaymentError("Enter a valid amount (0 if it was free).");
    if (amount === (Number(order.amount) || 0)) { setAmountEdit(null); return; }
    if (!e.reason.trim()) return setPaymentError("Write a short reason for the change (it is saved with the record).");
    setPaymentBusyId(order.id);
    setPaymentError("");
    try {
      const listAmount = Number(order.listAmount ?? order.amount) || 0;
      await updateDoc(doc(db, "payments", order.id), {
        amount,
        listAmount,
        amountAdjusted: amount !== listAmount,
        gift: amount === 0,
        adjustReason: e.reason.trim(),
        amountHistory: arrayUnion({ from: Number(order.amount) || 0, to: amount, at: Timestamp.now(), by: user?.email || ADMIN_EMAIL, why: e.reason.trim() }),
      });
      setAmountEdit(null);
    } catch (err) {
      setPaymentError(err.message || "Unable to change the amount.");
    } finally {
      setPaymentBusyId("");
    }
  };

  // Rejecting also frees the UTR, so the user can send the corrected number.
  const rejectPayment = async (order) => {
    const reason = window.prompt(
      "Reason shown to the user:",
      "We could not find this payment. Check the UTR and amount, then try again."
    );
    if (reason === null) return;
    setPaymentBusyId(order.id);
    setPaymentError("");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "payments", order.id), {
        status: "rejected",
        note: reason.trim(),
        reviewedAt: serverTimestamp(),
      });
      if (order.utr) batch.delete(doc(db, "paymentUtrs", order.utr));
      await batch.commit();
    } catch (err) {
      setPaymentError(err.message || "Unable to reject this payment.");
    } finally {
      setPaymentBusyId("");
    }
  };

  // ---- Payment records download (CSV / PDF) ----
  const exportPeriodLabel = () =>
    exportFrom || exportTo ? (exportFrom || "start") + " to " + (exportTo || "today") : "All dates";

  const downloadRecords = (format) => {
    setPaymentError("");
    const rows = selectRecords(paymentItems, { status: exportStatus, from: exportFrom, to: exportTo });
    if (rows.length === 0) {
      setPaymentError("No approved / rejected payments in this selection.");
      return;
    }
    const stamp = todayIst();
    const part = exportStatus === "both" ? "approved-rejected" : exportStatus;
    if (format === "csv") {
      downloadBlob(buildCsv(rows), "trakey-payment-records-" + part + "-" + stamp + ".csv");
    } else {
      const statusLabel = exportStatus === "both" ? "Approved and Rejected" : exportStatus === "approved" ? "Approved" : "Rejected";
      downloadBlob(buildPdf(rows, { period: exportPeriodLabel(), statusLabel }), "trakey-payment-records-" + part + "-" + stamp + ".pdf");
    }
  };

  const setExportFy = (offset) => {
    const fy = financialYear(offset);
    setExportFrom(fy.from);
    setExportTo(fy.to);
  };

  // ---- Manual payment records (outside India / offline payments) ----
  const setMF = (key, value) => setManualForm((prev) => ({ ...prev, [key]: value }));

  const addManualPayment = async () => {
    const f = manualForm;
    const amount = parseMoney(f.amount);
    if (Number.isNaN(amount)) return setPaymentError("Enter the amount received (0 for a free gift).");
    if (!f.name.trim() && !f.email.trim()) return setPaymentError("Enter the customer name or email.");
    if (!f.date) return setPaymentError("Choose the payment date.");
    // No Account ID typed? Try to find it from the email in the Users list.
    const typedEmail = f.email.trim().toLowerCase();
    const uid = f.uid.trim() || (typedEmail ? (mergedUsers.find((u) => (u.email || "").toLowerCase() === typedEmail) || {}).uid || "" : "");
    const isGift = f.status === "approved" && (f.gift || amount === 0);
    const grant = f.grantPro && f.status === "approved";
    if (grant && !uid) return setPaymentError("Could not find this person's account. Paste their Account ID (from the Users tab), or use the exact email they sign in with.");

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const id = "TKM-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const data = {
      uid,
      email: f.email.trim(),
      name: f.name.trim(),
      plan: f.plan,
      amount,
      // For a free gift: what the plan normally costs (so the record shows the value given away, not income).
      listAmount: isGift && (f.currency.trim() || "INR").toUpperCase() === "INR" ? PLAN_LIST_PRICE[f.plan] || amount : amount,
      amountAdjusted: false,
      gift: isGift,
      currency: (f.currency.trim() || "INR").toUpperCase(),
      utr: f.ref.trim(),
      method: f.method.trim(),
      country: f.country.trim(),
      status: f.status,
      note: f.note.trim(),
      manual: true,
      addedBy: user?.email || ADMIN_EMAIL,
      createdAt: Timestamp.fromDate(new Date(f.date + "T12:00:00+05:30")),
      reviewedAt: serverTimestamp(),
    };

    setManualBusy(true);
    setPaymentError("");
    try {
      if (grant) {
        // Record + Pro activation in one transaction, same rules as Approve.
        await runTransaction(db, async (tx) => {
          const proRef = doc(db, "proStatus", uid);
          const proSnap = await tx.get(proRef);
          const patch = proPatchFor(proSnap.exists() ? proSnap.data() : {}, f.plan);
          tx.set(proRef, { ...patch, paidVia: isGift ? "gift" : "manual", updatedAt: serverTimestamp() }, { merge: true });
          tx.set(doc(db, "payments", id), data);
        });
      } else {
        await setDoc(doc(db, "payments", id), data);
      }
      setManualForm(emptyManual());
      setShowManual(false);
    } catch (err) {
      setPaymentError(err.message || "Unable to save this record.");
    } finally {
      setManualBusy(false);
    }
  };

  // Only manual records can be removed here. App orders stay as the permanent audit trail.
  const deleteManualPayment = async (order) => {
    if (!order.manual) return;
    if (!window.confirm("Delete manual record " + order.id + "? This cannot be undone.\n\nIt does not change the user's Pro access.")) return;
    setPaymentBusyId(order.id);
    setPaymentError("");
    try {
      await deleteDoc(doc(db, "payments", order.id));
    } catch (err) {
      setPaymentError(err.message || "Unable to delete this record.");
    } finally {
      setPaymentBusyId("");
    }
  };

  const paymentStatusColor = (status) =>
    status === "approved" ? "#57d68d" : status === "rejected" ? "#ef6a6a" : "#f2a93b";

  const mergedUsers = (() => {
    const byId = new Map();
    adminUsers.forEach((item) => byId.set(item.id, { ...item }));
    backupMainItems.forEach((item) => {
      const uid = item.ref?.parent?.parent?.id;
      if (!uid) return;
      const data = item.data();
      byId.set(uid, {
        ...(byId.get(uid) || {}),
        id: uid,
        uid,
        name: byId.get(uid)?.name || data.displayName || "Trakey User",
        email: byId.get(uid)?.email || data.email || "",
        lastSeenAt: byId.get(uid)?.lastSeenAt || data.updatedAt || null,
      });
    });
    // Anyone with a Pro record (trial, reward, gift, payment) has really signed in, even if their profile was never indexed.
    proItems.forEach((item) => {
      if (!byId.has(item.id)) byId.set(item.id, { id: item.id, uid: item.id, name: "", email: "", lastSeenAt: item.trialStartedAt || item.updatedAt || null, notIndexed: true });
    });
    paymentItems.forEach((pay) => {
      const cur = pay.uid ? byId.get(pay.uid) : null;
      if (!cur) return;
      if (!cur.email && pay.email) cur.email = pay.email;
      if ((!cur.name || cur.name === "Trakey User") && pay.name) cur.name = pay.name;
    });
    return [...byId.values()].sort((a, b) => {
      const at = a.lastSeenAt?.toMillis?.() ?? a.lastSeenAt ?? 0;
      const bt = b.lastSeenAt?.toMillis?.() ?? b.lastSeenAt ?? 0;
      return bt - at;
    });
  })();

  const dashboardStats = {
    users: mergedUsers.length,
    feedback: feedbackItems.length,
    contacts: contactItems.length,
    unreadFeedback: feedbackItems.filter((item) => !item.handled).length,
    newContacts: contactItems.filter((item) => (item.status || "new") === "new").length,
    pendingPayments: paymentItems.filter((item) => (item.status || "pending") === "pending").length,
  };

  const formatTimestamp = (timestamp) => {
    if (typeof timestamp === "number" && timestamp > 0) {
      return new Date(timestamp).toLocaleString();
    }
    if (!timestamp?.toDate) {
      return "Just now";
    }
    return timestamp.toDate().toLocaleString();
  };


  const getPhase3TimestampMs = (timestamp) => {
    if (typeof timestamp === "number") return timestamp;
    return timestamp?.toMillis?.() ?? 0;
  };

  // ---- Users: Pro status, gift, remove ----
  const tsMsOf = (v) => v?.toMillis?.() ?? (typeof v === "number" ? v : 0);

  const proInfoOf = (uid) => {
    const raw = proItems.find((x) => x.id === uid) || {};
    const now = Date.now();
    const until = Number(raw.proUntil) || 0;
    const trialStart = tsMsOf(raw.trialStartedAt);
    const rewardStart = tsMsOf(raw.starRewardAt);
    const trialEnd = trialStart ? trialStart + TRIAL_DAYS * ADM_DAY_MS : 0;
    const rewardEnd = rewardStart ? rewardStart + REWARD_DAYS * ADM_DAY_MS : 0;
    const planLabel = PLANS[raw.plan]?.label || raw.plan || "";
    let key = "free";
    let label = "Free";
    let endMs = 0;
    if (until >= LIFETIME_MS) { key = "lifetime"; label = "Lifetime"; }
    else if (until > now) { key = "pro"; label = "Pro" + (planLabel ? " · " + planLabel : ""); endMs = until; }
    else if (trialEnd > now) { key = "trial"; label = "Free trial"; endMs = trialEnd; }
    else if (rewardEnd > now) { key = "reward"; label = "Star reward"; endMs = rewardEnd; }
    else if (until > 0) { key = "expired"; label = "Pro expired"; endMs = until; }
    else if (trialStart) { key = "ended"; label = "Trial ended"; endMs = trialEnd; }
    return { key, label, endMs, raw, hasAccess: ["lifetime", "pro", "trial", "reward"].includes(key), hasPaid: key === "lifetime" || key === "pro" };
  };

  const randomOrderId = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return "TKM-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  // Gift Pro from the Users tab: one transaction updates proStatus AND writes a free "gift" record (so it shows in Payments / exports, amount 0).
  const giftPro = async (item, planKey) => {
    const uid = item.uid || item.id;
    const plan = PLANS[planKey];
    if (!uid || !plan) return;
    setUserBusyId(uid);
    setUserMsg("");
    setUserError("");
    try {
      const orderId = randomOrderId();
      await runTransaction(db, async (tx) => {
        const proRef = doc(db, "proStatus", uid);
        const proSnap = await tx.get(proRef);
        const patch = proPatchFor(proSnap.exists() ? proSnap.data() : {}, planKey);
        tx.set(proRef, { ...patch, paidVia: "gift", updatedAt: serverTimestamp() }, { merge: true });
        tx.set(doc(db, "payments", orderId), {
          uid, email: item.email || "", name: item.name || "", plan: planKey,
          amount: 0, listAmount: plan.price, amountAdjusted: false, gift: true, currency: "INR",
          utr: "", method: "Gift", country: "", status: "approved", note: "Gifted from the Users tab", manual: true,
          addedBy: user?.email || ADMIN_EMAIL, createdAt: Timestamp.fromDate(new Date()), reviewedAt: serverTimestamp(),
        });
      });
      setUserPanel(null);
      setUserMsg(plan.label + " Pro gifted to " + (item.name || item.email || uid) + ".");
    } catch (err) {
      setUserError(err.message || "Unable to gift Pro.");
    } finally {
      setUserBusyId("");
    }
  };

  // Remove Pro: sets proUntil to 0. "Also end trial" sets the trial / reward start to 2020 (never deletes it, so the app cannot start a new trial).
  // Payment records are left alone: they are your audit trail. Refund separately if money was taken.
  const removePro = async (item, alsoEndTrial) => {
    const uid = item.uid || item.id;
    if (!uid) return;
    setUserBusyId(uid);
    setUserMsg("");
    setUserError("");
    try {
      const patch = {
        proUntil: 0, plan: deleteField(), paidVia: deleteField(),
        proRemovedAt: serverTimestamp(), proRemovedBy: user?.email || ADMIN_EMAIL, updatedAt: serverTimestamp(),
      };
      if (alsoEndTrial) {
        patch.trialStartedAt = ENDED_AT;
        if (proInfoOf(uid).raw.starRewardAt) patch.starRewardAt = ENDED_AT;
      }
      await setDoc(doc(db, "proStatus", uid), patch, { merge: true });
      setUserPanel(null);
      setRemoveTrialToo(false);
      setUserMsg("Pro removed for " + (item.name || item.email || uid) + ".");
    } catch (err) {
      setUserError(err.message || "Unable to remove Pro.");
    } finally {
      setUserBusyId("");
    }
  };

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); setUserMsg("Copied."); } catch { setUserError("Copy failed."); }
  };

  const isPhase3UserOnline = (item) => {
    const lastSeen = getPhase3TimestampMs(item.lastSeenAt);
    return lastSeen > 0 && Date.now() - lastSeen <= 5 * 60 * 1000;
  };

  const downloadPhase3UserData = () => {
    const normalize = (value) => {
      if (value?.toDate) return value.toDate().toISOString();
      if (Array.isArray(value)) return value.map(normalize);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([key, val]) => [key, normalize(val)])
        );
      }
      return value;
    };

    const payload = {
      exportedAt: new Date().toISOString(),
      users: mergedUsers.map((item) =>
        normalize({ ...item, online: isPhase3UserOnline(item) })
      ),
      feedback: feedbackItems.map((item) => normalize(item)),
      contactMessages: contactItems.map((item) => normalize(item)),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "trakey-admin-data-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Whole user data as CSV / PDF (all users, ignores the search box).
  const downloadUsersTable = (format) => {
    const data = buildUserRows({
      users: mergedUsers, proItems, paymentItems, feedbackItems, contactItems, isOnline: isPhase3UserOnline,
    });
    const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (format === "csv") downloadBlob(buildUsersCsv(data), "trakey-user-data-" + stamp + ".csv");
    else downloadBlob(buildUsersPdf(data), "trakey-user-data-" + stamp + ".pdf");
  };

  const monthKeyIst = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
  const realPayments = paymentItems.filter((p) => p.status === "approved" && !p.test && !p.gift && (p.currency || "INR").toUpperCase() === "INR");
  const sumAmount = (list) => list.reduce((t, p) => t + (Number(p.amount) || 0), 0);
  const thisMonth = monthKeyIst(Date.now());
  const userPro = mergedUsers.map((u) => proInfoOf(u.uid || u.id));
  const overviewStats = {
    ...dashboardStats,
    online: mergedUsers.filter(isPhase3UserOnline).length,
    pro: userPro.filter((x) => x.hasPaid).length,
    trial: userPro.filter((x) => x.key === "trial" || x.key === "reward").length,
    monthRevenue: sumAmount(realPayments.filter((p) => { const ms = p.createdAt?.toMillis?.() || 0; return ms && monthKeyIst(ms) === thisMonth; })),
    totalRevenue: sumAmount(realPayments),
  };
  const recentUsers = mergedUsers.slice(0, 5).map((u) => ({ ...u, proLabel: proInfoOf(u.uid || u.id).label }));

  if (!authReady) {
    return (
      <div className="login-page">
        <div className="login-box">
          <h1>Trakey Admin</h1>
          <p className="subtitle">Restoring your admin session...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="admin-page">
        <aside className="side">
          <div className="side-brand">
            <span className="logo">T</span>
            <div><b>Trakey Admin</b><small>{role === "owner" ? "Owner" : "Editor"}</small></div>
          </div>
          <nav className="side-nav">
            {NAV.map(([group, items]) => {
              const visible = items.filter((it) => !it[2] || role === "owner");
              if (!visible.length) return null;
              return (
                <div key={group || "top"} className="side-group">
                  {group && <p className="side-label">{group}</p>}
                  {visible.map(([key, label]) => {
                    const n = key === "payments" ? dashboardStats.pendingPayments : key === "feedback" ? dashboardStats.unreadFeedback : key === "contact" ? dashboardStats.newContacts : 0;
                    return (
                      <button key={key} type="button" className={currentSection === key ? "active" : ""} onClick={() => setCurrentSection(key)}>
                        {label}{n > 0 && <span className="nav-count">{n}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="side-foot">
            <small>{user.email}</small>
            <button type="button" onClick={handleLogout}>Sign out</button>
          </div>
        </aside>

        <main className="dashboard">
          {currentSection === "dashboard" && (
            <Overview role={role} email={user.email} stats={overviewStats} recentPayments={paymentItems.slice(0, 5)} recentUsers={recentUsers} go={setCurrentSection} />
          )}

          {currentSection === "users" && (() => {
            const rows = mergedUsers.map((item) => ({ item, pro: proInfoOf(item.uid || item.id), online: isPhase3UserOnline(item) }));
            const FILTERS = [
              ["all", "All", rows.length],
              ["pro", "Pro", rows.filter((r) => r.pro.hasPaid).length],
              ["trial", "Trial / reward", rows.filter((r) => r.pro.key === "trial" || r.pro.key === "reward").length],
              ["free", "Free", rows.filter((r) => !r.pro.hasAccess).length],
              ["online", "Online", rows.filter((r) => r.online).length],
            ];
            const q = userSearch.trim().toLowerCase();
            const shown = rows.filter((r) => {
              if (userFilter === "pro" && !r.pro.hasPaid) return false;
              if (userFilter === "trial" && !(r.pro.key === "trial" || r.pro.key === "reward")) return false;
              if (userFilter === "free" && r.pro.hasAccess) return false;
              if (userFilter === "online" && !r.online) return false;
              return !q || [r.item.name, r.item.email, r.item.uid, r.item.id].some((v) => String(v || "").toLowerCase().includes(q));
            });
            return (
              <>
                <div className="page-head">
                  <div><h2>Users</h2><p>{mergedUsers.length} people · live from Firestore</p></div>
                  <div className="page-actions">
                    <button type="button" onClick={() => downloadUsersTable("pdf")}>PDF</button>
                    <button type="button" onClick={() => downloadUsersTable("csv")}>CSV</button>
                    <button type="button" onClick={downloadPhase3UserData}>JSON</button>
                  </div>
                </div>
                {phase3Error && <div className="error-message">{phase3Error}</div>}
                {userError && <div className="error-message">{userError}</div>}
                {userMsg && <div className="ok-message">{userMsg}</div>}
                <div className="u-toolbar">
                  <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search name, email or UID" />
                  <div className="u-pills">
                    {FILTERS.map(([key, label, n]) => (
                      <button key={key} type="button" className={"u-pill" + (userFilter === key ? " on" : "")} onClick={() => setUserFilter(key)}>{label} <b>{n}</b></button>
                    ))}
                  </div>
                </div>
                <div className="u-list">
                  {shown.map(({ item, pro, online }) => {
                    const uid = item.uid || item.id;
                    const busy = userBusyId === uid;
                    const panel = userPanel && userPanel.uid === uid ? userPanel.kind : "";
                    return (
                      <article key={item.id} className="u-row">
                        <div className="u-main">
                          <div className="u-avatar">{String(item.name || item.email || "?").trim().charAt(0).toUpperCase() || "?"}</div>
                          <div className="u-id">
                            <h4>{item.name || "Trakey User"}</h4>
                            <p>{item.email || (item.notIndexed ? "Signed in · profile not synced yet" : "No email")}</p>
                          </div>
                          <div className="u-badges">
                            <span className={"badge b-" + pro.key}>{pro.label}</span>
                            <span className={"badge " + (online ? "b-online" : "b-off")}>{online ? "Online" : "Offline"}</span>
                          </div>
                        </div>
                        <div className="u-meta">
                          {pro.endMs > 0 && pro.key !== "lifetime" && <span>{pro.key === "expired" || pro.key === "ended" ? "Ended" : "Until"} {fmtDay(pro.endMs)}</span>}
                          <span>Last seen {formatTimestamp(item.lastSeenAt)}</span>
                          {item.location && <span>{item.location}</span>}
                          <span className="u-uid">UID {uid}</span>
                        </div>
                        <div className="u-actions">
                          <button type="button" disabled={busy} onClick={() => setUserPanel(panel === "gift" ? null : { uid, kind: "gift" })}>Gift Pro</button>
                          {pro.hasAccess && <button type="button" className="danger" disabled={busy} onClick={() => { setRemoveTrialToo(false); setUserPanel(panel === "remove" ? null : { uid, kind: "remove" }); }}>Remove Pro</button>}
                          <button type="button" className="quiet" onClick={() => copyText(uid)}>Copy UID</button>
                        </div>
                        {panel === "gift" && (
                          <div className="u-panel">
                            <p>Gift a plan. It is added after any Pro time they already have, and recorded as a free gift in Payments.</p>
                            <div className="u-panel-row">
                              {Object.entries(PLANS).map(([key, plan]) => (
                                <button key={key} type="button" disabled={busy} onClick={() => giftPro(item, key)}>{plan.label} · ₹{plan.price}</button>
                              ))}
                              <button type="button" className="quiet" onClick={() => setUserPanel(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                        {panel === "remove" && (
                          <div className="u-panel">
                            <p>This ends their paid or gifted Pro now. Their payment records stay as they are, so refund separately if they paid.</p>
                            <label className="u-check"><input type="checkbox" checked={removeTrialToo} onChange={(e) => setRemoveTrialToo(e.target.checked)} /> Also end their free trial and star reward</label>
                            <div className="u-panel-row">
                              <button type="button" className="danger" disabled={busy} onClick={() => removePro(item, removeTrialToo)}>{busy ? "Removing..." : "Remove Pro"}</button>
                              <button type="button" className="quiet" onClick={() => setUserPanel(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {shown.length === 0 && <p className="empty">{mergedUsers.length === 0 ? "No users yet." : "Nobody matches this filter."}</p>}
                </div>
              </>
            );
          })()}

          {currentSection === "gate" && <UpdateGatePanel userEmail={user.email} />}
          {currentSection === "explorer" && role === "owner" && <DataExplorer />}
          {currentSection === "team" && role === "owner" && <TeamPanel ownerEmail={user.email} />}

          {currentSection === "feedback" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "18px" }}>
                <div><h2 style={{ marginBottom: "6px" }}>Feedback</h2><p style={{ color: "#9da3ad", margin: 0 }}>Live ratings and survey responses.</p></div>
                
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
                {["all", "new", "handled"].map((filter) => <button key={filter} onClick={() => setFeedbackFilter(filter)}>{filter === "all" ? "All" : filter === "new" ? "Needs attention" : "Handled"}</button>)}
              </div>
              <div style={{ display: "grid", gap: "12px" }}>
                {feedbackItems.filter((item) => feedbackFilter === "all" || (feedbackFilter === "handled" ? item.handled : !item.handled)).map((item) => (
                  <article key={item.id} style={{ border: "1px solid #30343d", borderRadius: "10px", padding: "18px", background: "#1a1d23" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}><div><h4 style={{ margin: 0 }}>{item.name || "Trakey User"}</h4><p style={{ margin: "4px 0", color: "#9da3ad" }}>{item.email || "No email"} • {item.type || "Rating"}</p></div><strong style={{ color: "#8ec8ff" }}>{item.rating || 0}/5 ★</strong></div>
                    <p style={{ margin: "10px 0 5px", color: "#9da3ad", fontSize: "13px" }}>{formatTimestamp(item.submittedAt)} • v{item.appVersion || "—"}</p>
                    {item.additionalFeedback && <p style={{ whiteSpace: "pre-wrap", color: "#c2c7cf" }}>{item.additionalFeedback}</p>}
                    {item.answers && Object.keys(item.answers).length > 0 && <details><summary style={{ cursor: "pointer", color: "#8ec8ff" }}>Survey answers</summary><div style={{ marginTop: "10px", display: "grid", gap: "7px" }}>{Object.entries(item.answers).map(([k, v]) => <div key={k}><span style={{ color: "#9da3ad" }}>{k}: </span><span>{String(v)}</span></div>)}</div></details>}
                    <button type="button" onClick={() => updateFeedbackHandled(item.id, !item.handled)} disabled={phase3BusyId === item.id} style={{ marginTop: "14px" }}>{item.handled ? "Mark as new" : "Mark handled"}</button>
                  </article>
                ))}
                {feedbackItems.length === 0 && <p style={{ color: "#9da3ad" }}>No new detailed feedback has been submitted yet.</p>}
              </div>
            </>
          )}

          {currentSection === "contact" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "18px" }}>
                <div><h2 style={{ marginBottom: "6px" }}>Contact Us</h2><p style={{ color: "#9da3ad", margin: 0 }}>Live support messages from Trakey.</p></div>
                
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
                {["all", "new", "in_progress", "resolved"].map((filter) => <button key={filter} onClick={() => setContactFilter(filter)}>{filter === "all" ? "All" : filter.replace("_", " ")}</button>)}
              </div>
              <div style={{ display: "grid", gap: "12px" }}>
                {contactItems.filter((item) => contactFilter === "all" || (item.status || "new") === contactFilter).map((item) => (
                  <article key={item.id} style={{ border: "1px solid #30343d", borderRadius: "10px", padding: "18px", background: "#1a1d23" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}><div><h4 style={{ margin: 0 }}>{item.topic || "Support"}</h4><p style={{ margin: "4px 0", color: "#9da3ad" }}>{item.name || "Trakey User"} • {item.email || "No email"}</p></div><span style={{ color: "#8ec8ff", fontSize: "12px" }}>{item.status || "new"}</span></div>
                    <p style={{ margin: "10px 0", color: "#c2c7cf", whiteSpace: "pre-wrap" }}>{item.message}</p>
                    <p style={{ margin: "0 0 12px", color: "#9da3ad", fontSize: "13px" }}>{formatTimestamp(item.submittedAt)} • v{item.appVersion || "—"}</p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{["new", "in_progress", "resolved"].map((status) => <button key={status} type="button" onClick={() => updateContactStatus(item.id, status)} disabled={phase3BusyId === item.id}>{status.replace("_", " ")}</button>)}</div>
                  </article>
                ))}
                {contactItems.length === 0 && <p style={{ color: "#9da3ad" }}>No contact messages yet.</p>}
              </div>
            </>
          )}

          {currentSection === "payments" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "18px" }}>
                <div><h2 style={{ marginBottom: "6px" }}>Payments</h2><p style={{ color: "#9da3ad", margin: 0 }}>Manual UPI orders from the app. Match amount, UTR and time in your bank app before approving.</p></div>
                
              </div>
              {paymentError && <div className="error-message">{paymentError}</div>}
              <div style={{ border: "1px solid #30343d", borderRadius: "10px", padding: "16px", background: "#1a1d23", marginBottom: "18px" }}>
                <h4 style={{ margin: "0 0 4px" }}>Download payment records (for tax)</h4>
                <p style={{ margin: "0 0 12px", color: "#9da3ad", fontSize: "13px" }}>Approved and rejected payments with customer, plan, amount, UTR, country and dates (IST). Pending orders are never included.</p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "end", marginBottom: "12px" }}>
                  <label style={manualLabelStyle}>Status
                    <select value={exportStatus} onChange={(e) => setExportStatus(e.target.value)} style={manualInputStyle}>
                      <option value="both">Approved + Rejected</option>
                      <option value="approved">Approved only</option>
                      <option value="rejected">Rejected only</option>
                    </select>
                  </label>
                  <label style={manualLabelStyle}>From
                    <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} style={manualInputStyle} />
                  </label>
                  <label style={manualLabelStyle}>To
                    <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} style={manualInputStyle} />
                  </label>
                  <button type="button" onClick={() => setExportFy(0)}>{financialYear(0).label}</button>
                  <button type="button" onClick={() => setExportFy(1)}>{financialYear(1).label}</button>
                  <button type="button" onClick={() => { setExportFrom(""); setExportTo(""); }}>All dates</button>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => downloadRecords("pdf")}>Download PDF</button>
                  <button type="button" onClick={() => downloadRecords("csv")}>Download CSV</button>
                  <span style={{ color: "#7f8792", fontSize: "12px", alignSelf: "center" }}>{selectRecords(paymentItems, { status: exportStatus, from: exportFrom, to: exportTo }).length} records selected</span>
                </div>
              </div>

              <div style={{ border: "1px solid #30343d", borderRadius: "10px", padding: "16px", background: "#1a1d23", marginBottom: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div>
                    <h4 style={{ margin: "0 0 4px" }}>Add manual record</h4>
                    <p style={{ margin: 0, color: "#9da3ad", fontSize: "13px" }}>For payments outside India, discounts, or free gifts. The amount you type is what the tax downloads add up, so type what you really received (0 for a free gift).</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => { setManualForm({ ...emptyManual(), amount: "0", method: "Gift", country: "India", grantPro: true, gift: true, note: "Free gift" }); setShowManual(true); }}>Give Pro free (gift)</button>
                    <button type="button" onClick={() => setShowManual((v) => !v)}>{showManual ? "Close" : "Add record"}</button>
                  </div>
                </div>
                {showManual && (
                  <div style={{ marginTop: "14px", display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
                    <label style={manualLabelStyle}>Status
                      <select value={manualForm.status} onChange={(e) => setMF("status", e.target.value)} style={manualInputStyle}>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </label>
                    <label style={manualLabelStyle}>Subscription
                      <select value={manualForm.plan} onChange={(e) => { const v = e.target.value; setManualForm((prev) => ({ ...prev, plan: v, amount: prev.amount === "" || prev.amount === String(PLANS[prev.plan]?.price) ? String(PLANS[v].price) : prev.amount })); }} style={manualInputStyle}>
                        <option value="monthly">Monthly · ₹{PLANS.monthly.price}</option>
                        <option value="yearly">Yearly · ₹{PLANS.yearly.price}</option>
                        <option value="lifetime">Lifetime · ₹{PLANS.lifetime.price} (one-time)</option>
                      </select>
                    </label>
                    <label style={manualLabelStyle}>Amount received (0 = free)
                      <input type="number" min="0" step="0.01" value={manualForm.amount} onChange={(e) => setMF("amount", e.target.value)} style={manualInputStyle} />
                    </label>
                    <label style={manualLabelStyle}>Currency
                      <input value={manualForm.currency} onChange={(e) => setMF("currency", e.target.value)} maxLength={5} style={manualInputStyle} />
                    </label>
                    <label style={manualLabelStyle}>Payment date
                      <input type="date" value={manualForm.date} onChange={(e) => setMF("date", e.target.value)} style={manualInputStyle} />
                    </label>
                    <label style={manualLabelStyle}>Customer name
                      <input value={manualForm.name} onChange={(e) => setMF("name", e.target.value)} style={manualInputStyle} />
                    </label>
                    <label style={manualLabelStyle}>Customer email
                      <input type="email" value={manualForm.email} onChange={(e) => setMF("email", e.target.value)} style={manualInputStyle} />
                    </label>
                    <label style={manualLabelStyle}>Account ID (optional if the email is in Users)
                      <input value={manualForm.uid} onChange={(e) => setMF("uid", e.target.value)} placeholder="from the user's email or Users tab" style={manualInputStyle} />
                    </label>
                    <label style={manualLabelStyle}>Transaction ID / reference
                      <input value={manualForm.ref} onChange={(e) => setMF("ref", e.target.value)} style={manualInputStyle} />
                    </label>
                    <label style={manualLabelStyle}>Payment method
                      <input value={manualForm.method} onChange={(e) => setMF("method", e.target.value)} placeholder="PayPal, bank, card…" style={manualInputStyle} />
                    </label>
                    <label style={manualLabelStyle}>Country
                      <input value={manualForm.country} onChange={(e) => setMF("country", e.target.value)} style={manualInputStyle} />
                    </label>
                    <label style={{ ...manualLabelStyle, gridColumn: "1 / -1" }}>Note / reason
                      <textarea value={manualForm.note} onChange={(e) => setMF("note", e.target.value)} rows={2} style={{ ...manualInputStyle, resize: "vertical" }} />
                    </label>
                    {manualForm.status === "approved" && (
                      <label style={{ gridColumn: "1 / -1", display: "flex", gap: "8px", alignItems: "center", color: "#c2c7cf", fontSize: "13px" }}>
                        <input type="checkbox" checked={manualForm.grantPro} onChange={(e) => setMF("grantPro", e.target.checked)} />
                        Also activate Pro for this Account ID (same days as Approve)
                      </label>
                    )}
                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: "8px" }}>
                      <button type="button" onClick={addManualPayment} disabled={manualBusy}>{manualBusy ? "Saving…" : "Save record"}</button>
                      <button type="button" onClick={() => setManualForm(emptyManual())} disabled={manualBusy}>Clear</button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
                {["pending", "approved", "rejected", "all"].map((filter) => (
                  <button key={filter} onClick={() => setPaymentFilter(filter)}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)} ({filter === "all" ? paymentItems.length : paymentItems.filter((item) => (item.status || "pending") === filter).length})
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gap: "12px" }}>
                {paymentItems.filter((item) => paymentFilter === "all" || (item.status || "pending") === paymentFilter).map((item) => (
                  <article key={item.id} style={{ border: "1px solid #30343d", borderRadius: "10px", padding: "18px", background: "#1a1d23" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                      <div>
                        <h4 style={{ margin: 0 }}>{item.id} · {item.currency && item.currency !== "INR" ? item.currency : "Rs"} {item.amount} · {item.plan}{item.manual ? " · MANUAL" : ""}{item.gift ? " · FREE GIFT" : ""}</h4>
                        {item.listAmount != null && Number(item.listAmount) !== Number(item.amount) && (
                          <p style={{ margin: "2px 0 0", color: "#f2a93b", fontSize: "12px" }}>Plan price was {item.currency && item.currency !== "INR" ? item.currency : "Rs"} {item.listAmount}; received {item.amount}{item.adjustReason ? " · " + item.adjustReason : ""}</p>
                        )}
                        <p style={{ margin: "4px 0", color: "#9da3ad" }}>{item.name || "Trakey User"} • {item.email || "No email"}</p>
                      </div>
                      <span style={{ color: paymentStatusColor(item.status), fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>{item.status || "pending"}</span>
                    </div>
                    <p style={{ margin: "10px 0 4px", color: "#c2c7cf", fontSize: "15px" }}>{item.manual ? "Ref" : "UTR"}: <strong style={{ letterSpacing: "0.5px" }}>{item.utr || "—"}</strong>{item.manual && (item.method || item.country) ? " · " + [item.method, item.country].filter(Boolean).join(" · ") : ""}</p>
                    <p style={{ margin: "0 0 4px", color: "#9da3ad", fontSize: "13px" }}>{formatTimestamp(item.createdAt)} • v{item.appVersion || "—"}</p>
                    <p style={{ margin: "0 0 12px", color: "#7f8792", fontSize: "12px", wordBreak: "break-all" }}>UID: {item.uid || "—"}</p>
                    {item.note && <p style={{ margin: "0 0 12px", color: "#c2c7cf", whiteSpace: "pre-wrap" }}>Note: {item.note}</p>}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {!item.manual && <button type="button" onClick={() => toggleShot(item.id)}>{openShots[item.id] ? "Hide screenshot" : "View screenshot"}</button>}
                      {item.status === "approved" && <button type="button" onClick={() => startAmountEdit(item)} disabled={paymentBusyId === item.id}>Edit amount</button>}
                      {item.manual && <button type="button" onClick={() => deleteManualPayment(item)} disabled={paymentBusyId === item.id}>Delete record</button>}
                      {(item.status || "pending") === "pending" && (
                        <>
                          <button type="button" onClick={() => startApprove(item)} disabled={paymentBusyId === item.id}>Approve</button>
                          <button type="button" onClick={() => rejectPayment(item)} disabled={paymentBusyId === item.id}>Reject</button>
                        </>
                      )}
                    </div>
                    {approveEdit && approveEdit.id === item.id && (
                      <div style={{ marginTop: "14px", border: "1px solid #30343d", borderRadius: "10px", padding: "14px", background: "#11141a", display: "grid", gap: "10px" }}>
                        <p style={{ margin: 0, color: "#c2c7cf", fontSize: "13px" }}>Check the screenshot and your bank / UPI app. Type the amount that <strong>actually reached you</strong>. Plan price is Rs {item.amount}. Type 0 if you are giving it free. This amount is what the tax downloads add up.</p>
                        <label style={manualLabelStyle}>Amount received (Rs)
                          <input type="number" min="0" step="0.01" value={approveEdit.amount} onChange={(e) => setApproveEdit({ ...approveEdit, amount: e.target.value })} style={manualInputStyle} />
                        </label>
                        <label style={manualLabelStyle}>Note (optional, only you see it)
                          <input value={approveEdit.note} onChange={(e) => setApproveEdit({ ...approveEdit, note: e.target.value })} placeholder="e.g. friend, paid Rs 100 only" style={manualInputStyle} />
                        </label>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button type="button" onClick={() => approvePayment(item, approveEdit.amount, approveEdit.note)} disabled={paymentBusyId === item.id}>{paymentBusyId === item.id ? "Saving…" : "Approve and activate Pro"}</button>
                          <button type="button" onClick={() => setApproveEdit(null)} disabled={paymentBusyId === item.id}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {amountEdit && amountEdit.id === item.id && (
                      <div style={{ marginTop: "14px", border: "1px solid #30343d", borderRadius: "10px", padding: "14px", background: "#11141a", display: "grid", gap: "10px" }}>
                        <p style={{ margin: 0, color: "#c2c7cf", fontSize: "13px" }}>Change the amount received for this record. Pro access does not change. The old amount, new amount, date and reason are kept in the record.</p>
                        <label style={manualLabelStyle}>Amount received
                          <input type="number" min="0" step="0.01" value={amountEdit.amount} onChange={(e) => setAmountEdit({ ...amountEdit, amount: e.target.value })} style={manualInputStyle} />
                        </label>
                        <label style={manualLabelStyle}>Reason
                          <input value={amountEdit.reason} onChange={(e) => setAmountEdit({ ...amountEdit, reason: e.target.value })} placeholder="e.g. gave a discount, matches screenshot" style={manualInputStyle} />
                        </label>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button type="button" onClick={() => saveAmountEdit(item)} disabled={paymentBusyId === item.id}>{paymentBusyId === item.id ? "Saving…" : "Save amount"}</button>
                          <button type="button" onClick={() => setAmountEdit(null)} disabled={paymentBusyId === item.id}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {openShots[item.id] && (
                      <div style={{ marginTop: "14px" }}>
                        {shotCache[item.id] === undefined && <p style={{ color: "#9da3ad" }}>Loading screenshot…</p>}
                        {shotCache[item.id] === "" && <p style={{ color: "#ef6a6a" }}>No screenshot found for this order.</p>}
                        {shotCache[item.id] && (
                          <img
                            alt={"Payment screenshot " + item.id}
                            src={"data:image/jpeg;base64," + shotCache[item.id]}
                            style={{ maxWidth: "100%", maxHeight: "560px", borderRadius: "10px", border: "1px solid #30343d" }}
                          />
                        )}
                      </div>
                    )}
                  </article>
                ))}
                {paymentItems.length === 0 && <p style={{ color: "#9da3ad" }}>No payments yet.</p>}
              </div>
            </>
          )}

          {currentSection === "announcements" && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <h2 style={{ marginBottom: "6px" }}>Announcements</h2>
                  <p style={{ color: "#9da3ad", margin: 0 }}>
                    Create and manage messages shown to Trakey users.
                  </p>
                </div>

                <button onClick={() => setCurrentSection("dashboard")}>
                  Back
                </button>
              </div>

              <form
                onSubmit={handleCreateAnnouncement}
                style={{
                  border: "1px solid #30343d",
                  borderRadius: "8px",
                  padding: "22px",
                  background: "#1a1d23",
                  marginBottom: "24px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Create announcement</h3>

                <label>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Announcement title"
                  maxLength={120}
                  required
                />

                <label>Description / Message</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write the announcement message"
                  maxLength={2000}
                  rows={6}
                  required
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid #3a3f49",
                    background: "#111318",
                    color: "white",
                    resize: "vertical",
                  }}
                />

                <label>Type</label>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid #3a3f49",
                    background: "#111318",
                    color: "white",
                  }}
                >
                  <option>General</option>
                  <option>Update</option>
                  <option>Feature</option>
                  <option>Maintenance</option>
                  <option>Important</option>
                </select>

                <label>Action button text (optional)</label>
                <input
                  type="text"
                  value={actionText}
                  onChange={(event) => setActionText(event.target.value)}
                  placeholder="Example: View update"
                  maxLength={60}
                />

                <label>Action URL (optional)</label>
                <input
                  type="url"
                  value={actionUrl}
                  onChange={(event) => setActionUrl(event.target.value)}
                  placeholder="https://..."
                />

                <button
                  className="login-button"
                  type="submit"
                  disabled={announcementLoading}
                >
                  {announcementLoading ? "Publishing..." : "Publish"}
                </button>
              </form>

              {successMessage && (
                <div
                  style={{
                    marginBottom: "18px",
                    padding: "10px",
                    borderRadius: "6px",
                    background: "#17331f",
                    color: "#a8e6b5",
                  }}
                >
                  {successMessage}
                </div>
              )}

              {announcementError && (
                <div className="error-message">
                  {announcementError}
                </div>
              )}

              <section>
                <h3>Published announcements</h3>

                {announcementLoading && announcements.length === 0 ? (
                  <p style={{ color: "#9da3ad" }}>Loading...</p>
                ) : announcements.length === 0 ? (
                  <p style={{ color: "#9da3ad" }}>
                    No announcements have been published yet.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {announcements.map((announcement) => (
                      <article
                        key={announcement.id}
                        style={{
                          border: "1px solid #30343d",
                          borderRadius: "8px",
                          padding: "18px",
                          background: "#1a1d23",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "16px",
                          }}
                        >
                          <div>
                            <p
                              style={{
                                margin: "0 0 6px",
                                color: "#9da3ad",
                                fontSize: "13px",
                              }}
                            >
                              {announcement.type || "General"} •{" "}
                              {formatTimestamp(announcement.createdAt)}
                            </p>

                            <h4 style={{ margin: "0 0 10px" }}>
                              {announcement.title}
                            </h4>

                            <p
                              style={{
                                margin: 0,
                                color: "#c2c7cf",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {announcement.message}
                            </p>

                            {announcement.actionText &&
                              announcement.actionUrl && (
                                <p
                                  style={{
                                    margin: "12px 0 0",
                                    color: "#9da3ad",
                                    fontSize: "13px",
                                  }}
                                >
                                  Action: {announcement.actionText} →{" "}
                                  {announcement.actionUrl}
                                </p>
                              )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteAnnouncement(announcement.id)
                            }
                            disabled={announcementLoading}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {currentSection === "notifications" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                <div>
                  <h2 style={{ marginBottom: "6px" }}>Notifications</h2>
                  <p style={{ color: "#9da3ad", margin: 0 }}>Send a notification to Trakey users.</p>
                </div>
                
              </div>

              <form onSubmit={handleCreateNotification} style={{ border: "1px solid #30343d", borderRadius: "8px", padding: "22px", background: "#1a1d23", marginBottom: "24px" }}>
                <h3 style={{ marginTop: 0 }}>Send notification</h3>
                <label>Title</label>
                <input type="text" value={notificationTitle} onChange={(event) => setNotificationTitle(event.target.value)} placeholder="Example: Trakey 2.0.2 is available" maxLength={120} required />
                <label>Message</label>
                <textarea value={notificationMessage} onChange={(event) => setNotificationMessage(event.target.value)} placeholder="Write the notification message" maxLength={500} rows={5} required style={{ width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: "6px", border: "1px solid #3a3f49", background: "#111318", color: "white", resize: "vertical" }} />
                <button className="login-button" type="submit" disabled={notificationLoading}>{notificationLoading ? "Sending..." : "Send Notification"}</button>
              </form>

              {notificationSuccess && <div style={{ marginBottom: "18px", padding: "10px", borderRadius: "6px", background: "#17331f", color: "#a8e6b5" }}>{notificationSuccess}</div>}
              {notificationError && <div className="error-message">{notificationError}</div>}

              <section>
                <h3>Sent notifications</h3>
                {notificationLoading && notifications.length === 0 ? <p style={{ color: "#9da3ad" }}>Loading...</p> : notifications.length === 0 ? <p style={{ color: "#9da3ad" }}>No notifications have been sent yet.</p> : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {notifications.map((item) => (
                      <article key={item.id} style={{ border: "1px solid #30343d", borderRadius: "8px", padding: "18px", background: "#1a1d23" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                          <div>
                            <p style={{ margin: "0 0 6px", color: "#9da3ad", fontSize: "13px" }}>{formatTimestamp(item.createdAt)}</p>
                            <h4 style={{ margin: "0 0 10px" }}>{item.title}</h4>
                            <p style={{ margin: 0, color: "#c2c7cf", whiteSpace: "pre-wrap" }}>{item.message}</p>
                          </div>
                          <button type="button" onClick={() => handleDeleteNotification(item.id)} disabled={notificationLoading}>Delete</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {currentSection === "history" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                <div>
                  <h2 style={{ marginBottom: "6px" }}>Message History</h2>
                  <p style={{ color: "#9da3ad", margin: 0 }}>Announcements, notifications and updates published from Trakey Admin.</p>
                </div>
                
              </div>
              {historyError && <div className="error-message">{historyError}</div>}
              {historyLoading ? <p style={{ color: "#9da3ad" }}>Loading history...</p> : history.length === 0 ? <p style={{ color: "#9da3ad" }}>No message history yet.</p> : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {history.map((item) => (
                    <article key={item.id} style={{ border: "1px solid #30343d", borderRadius: "8px", padding: "18px", background: "#1a1d23" }}>
                      <p style={{ margin: "0 0 6px", color: "#9da3ad", fontSize: "13px" }}>{item.category} • {formatTimestamp(item.timestamp)}</p>
                      <h4 style={{ margin: "0 0 8px" }}>{item.title}</h4>
                      <p style={{ margin: 0, color: "#c2c7cf", whiteSpace: "pre-wrap" }}>{item.message}</p>
                      {item.category === "Update" && item.data.version && <p style={{ margin: "10px 0 0", color: "#9da3ad", fontSize: "13px" }}>Version: {item.data.version}</p>}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {currentSection === "updates" && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <h2 style={{ marginBottom: "6px" }}>Updates</h2>
                  <p style={{ color: "#9da3ad", margin: 0 }}>
                    Publish Trakey version updates and release notes.
                  </p>
                </div>
                
              </div>

              <form
                onSubmit={handleCreateUpdate}
                style={{
                  border: "1px solid #30343d",
                  borderRadius: "8px",
                  padding: "22px",
                  background: "#1a1d23",
                  marginBottom: "24px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Publish update</h3>

                <label>Version</label>
                <input
                  type="text"
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                  placeholder="Example: 1.2.0"
                  maxLength={30}
                  required
                />

                <label>Update title</label>
                <input
                  type="text"
                  value={updateTitle}
                  onChange={(event) => setUpdateTitle(event.target.value)}
                  placeholder="Example: Trakey 1.2 is here"
                  maxLength={120}
                  required
                />

                <label>Short description</label>
                <textarea
                  value={updateDescription}
                  onChange={(event) => setUpdateDescription(event.target.value)}
                  placeholder="Briefly describe what this update brings."
                  maxLength={500}
                  rows={4}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid #3a3f49",
                    background: "#111318",
                    color: "white",
                    resize: "vertical",
                  }}
                />

                <label>What's new / Release notes</label>
                <textarea
                  value={releaseNotes}
                  onChange={(event) => setReleaseNotes(event.target.value)}
                  placeholder={"Example:\n• New Goals improvements\n• Faster Notes loading\n• Bug fixes"}
                  maxLength={3000}
                  rows={8}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid #3a3f49",
                    background: "#111318",
                    color: "white",
                    resize: "vertical",
                    whiteSpace: "pre-wrap",
                  }}
                />

                <label>Update / Download URL (optional)</label>
                <input
                  type="url"
                  value={downloadUrl}
                  onChange={(event) => setDownloadUrl(event.target.value)}
                  placeholder="https://..."
                />

                <button
                  className="login-button"
                  type="submit"
                  disabled={updateLoading}
                >
                  {updateLoading ? "Publishing..." : "Publish Update"}
                </button>
              </form>

              {updateSuccess && (
                <div
                  style={{
                    marginBottom: "18px",
                    padding: "10px",
                    borderRadius: "6px",
                    background: "#17331f",
                    color: "#a8e6b5",
                  }}
                >
                  {updateSuccess}
                </div>
              )}

              {updateError && <div className="error-message">{updateError}</div>}

              <section>
                <h3>Published updates</h3>
                {updateLoading && updates.length === 0 ? (
                  <p style={{ color: "#9da3ad" }}>Loading...</p>
                ) : updates.length === 0 ? (
                  <p style={{ color: "#9da3ad" }}>No updates have been published yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {updates.map((update) => (
                      <article
                        key={update.id}
                        style={{
                          border: "1px solid #30343d",
                          borderRadius: "8px",
                          padding: "18px",
                          background: "#1a1d23",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: "0 0 6px", color: "#9da3ad", fontSize: "13px" }}>
                              Trakey v{update.version || "—"} • {formatTimestamp(update.publishedAt || update.createdAt)}
                            </p>
                            <h4 style={{ margin: "0 0 8px" }}>{update.title}</h4>
                            <p style={{ margin: "0 0 10px", color: "#c2c7cf", whiteSpace: "pre-wrap" }}>
                              {update.description}
                            </p>
                            {update.releaseNotes && (
                              <details>
                                <summary style={{ cursor: "pointer", color: "#8ec8ff" }}>What's new</summary>
                                <p style={{ color: "#c2c7cf", whiteSpace: "pre-wrap" }}>{update.releaseNotes}</p>
                              </details>
                            )}
                            {update.downloadUrl && (
                              <p style={{ margin: "10px 0 0", color: "#9da3ad", fontSize: "13px", wordBreak: "break-all" }}>
                                Update URL: {update.downloadUrl}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteUpdate(update.id)}
                            disabled={updateLoading}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

        </main>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Trakey Admin</h1>
        <p className="subtitle">Administrator Sign In</p>

        <button
          className="google-button"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          Continue with Google
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <form onSubmit={handleEmailLogin}>
          <label>Email</label>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Admin email"
            required
          />

          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
          />

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}

        <p className="security-note">
          Authorized administrators only.
        </p>
      </div>
    </div>
  );
}

export default App;
