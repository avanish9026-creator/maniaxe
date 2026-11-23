// Every write the admin makes to Firestore lives here, so the pages stay simple.
// Each function throws a readable Error on failure; the page shows it as a message.
import {
  addDoc, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, runTransaction,
  serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch,
} from "firebase/firestore";
import { adminApi } from "./adminApi";
import { PLANS, proPatchFor } from "./pro";
import { parseMoney, randomOrderId } from "./format";

export const ADMIN_EMAIL = "support.trakey@gmail.com";
// Used to END a trial / reward without deleting the field (the app starts a new trial if the field is missing).
const ENDED_AT = Timestamp.fromDate(new Date("2020-01-01T00:00:00Z"));

export function makeActions(db, actorEmail) {
  const by = actorEmail || ADMIN_EMAIL;

  // ---------- Pro ----------
  // One transaction: updates proStatus AND writes a free "gift" record (amount 0), so Payments and tax exports stay complete.
  async function giftPro(person, planKey) {
    const uid = person.uid || person.id;
    const plan = PLANS[planKey];
    if (!uid || !plan) throw new Error("Choose a plan first.");
    const orderId = randomOrderId();
    await runTransaction(db, async (tx) => {
      const proRef = doc(db, "proStatus", uid);
      const proSnap = await tx.get(proRef);
      const patch = proPatchFor(proSnap.exists() ? proSnap.data() : {}, planKey);
      tx.set(proRef, { ...patch, paidVia: "gift", updatedAt: serverTimestamp() }, { merge: true });
      tx.set(doc(db, "payments", orderId), {
        uid, email: person.email || "", name: person.name || "", plan: planKey,
        amount: 0, listAmount: plan.price, amountAdjusted: false, gift: true, currency: "INR",
        utr: "", method: "Gift", country: "", status: "approved", note: "Gifted from Trakey Admin", manual: true,
        addedBy: by, createdAt: Timestamp.fromDate(new Date()), reviewedAt: serverTimestamp(),
      });
    });
    return plan;
  }

  // Sets proUntil to 0. "Also end trial" moves the trial / reward start to 2020 (never deletes it, so the app cannot start a new trial).
  // Payment records are left alone: they are the audit trail.
  async function removePro(person, alsoEndTrial, hasReward) {
    const uid = person.uid || person.id;
    const patch = {
      proUntil: 0, plan: deleteField(), paidVia: deleteField(),
      proRemovedAt: serverTimestamp(), proRemovedBy: by, updatedAt: serverTimestamp(),
    };
    if (alsoEndTrial) {
      patch.trialStartedAt = ENDED_AT;
      if (hasReward) patch.starRewardAt = ENDED_AT;
    }
    await setDoc(doc(db, "proStatus", uid), patch, { merge: true });
  }

  // ---------- Payments ----------
  // One transaction: marks the order approved AND extends Pro, so they can never get out of step.
  // `received` is the money that really reached you (can differ from the plan price, or be 0 for a free gift).
  async function approvePayment(order, received, adminNote) {
    const amount = parseMoney(received);
    if (Number.isNaN(amount)) throw new Error("Enter the amount you actually received (0 if it was free).");
    await runTransaction(db, async (tx) => {
      const payRef = doc(db, "payments", order.id);
      const proRef = doc(db, "proStatus", order.uid);
      const paySnap = await tx.get(payRef);
      const proSnap = await tx.get(proRef);
      if (!paySnap.exists() || paySnap.data().status !== "pending") throw new Error("This payment is no longer pending.");
      const pay = paySnap.data();
      const listAmount = Number(pay.listAmount ?? pay.amount) || 0;
      const cur = proSnap.exists() ? proSnap.data() : {};
      const patch = proPatchFor(cur, order.plan);
      const upd = {
        status: "approved", reviewedAt: serverTimestamp(), amount, listAmount,
        amountAdjusted: amount !== listAmount, gift: amount === 0,
      };
      if (amount !== (Number(pay.amount) || 0)) {
        upd.amountHistory = arrayUnion({ from: Number(pay.amount) || 0, to: amount, at: Timestamp.now(), by, why: "Set at approval" });
      }
      if ((adminNote || "").trim()) upd.note = adminNote.trim();
      tx.set(proRef, { ...patch, paidVia: amount === 0 ? "gift" : "upi", updatedAt: serverTimestamp() }, { merge: true });
      tx.update(payRef, upd);
    });
  }

  // Change the amount of an already approved record. Pro access is not touched. Every change is kept in amountHistory.
  async function saveAmount(order, amountText, reason) {
    const amount = parseMoney(amountText);
    if (Number.isNaN(amount)) throw new Error("Enter a valid amount (0 if it was free).");
    if (amount === (Number(order.amount) || 0)) return false;
    if (!String(reason || "").trim()) throw new Error("Write a short reason for the change (it is saved with the record).");
    const listAmount = Number(order.listAmount ?? order.amount) || 0;
    await updateDoc(doc(db, "payments", order.id), {
      amount, listAmount, amountAdjusted: amount !== listAmount, gift: amount === 0,
      adjustReason: reason.trim(),
      amountHistory: arrayUnion({ from: Number(order.amount) || 0, to: amount, at: Timestamp.now(), by, why: reason.trim() }),
    });
    return true;
  }

  // Rejecting also frees the UTR, so the user can send the corrected number.
  async function rejectPayment(order, reason) {
    const batch = writeBatch(db);
    batch.update(doc(db, "payments", order.id), { status: "rejected", note: String(reason || "").trim(), reviewedAt: serverTimestamp() });
    if (order.utr) batch.delete(doc(db, "paymentUtrs", order.utr));
    await batch.commit();
  }

  // Manual records: payments outside India, discounts, free gifts. `people` is used to find the Account ID from an email.
  async function addManualPayment(f, people) {
    const amount = parseMoney(f.amount);
    if (Number.isNaN(amount)) throw new Error("Enter the amount received (0 for a free gift).");
    if (!f.name.trim() && !f.email.trim()) throw new Error("Enter the customer name or email.");
    if (!f.date) throw new Error("Choose the payment date.");
    const typedEmail = f.email.trim().toLowerCase();
    const uid = f.uid.trim() || (typedEmail ? (people.find((u) => (u.email || "").toLowerCase() === typedEmail) || {}).uid || "" : "");
    const isGift = f.status === "approved" && (f.gift || amount === 0);
    const grant = f.grantPro && f.status === "approved";
    if (grant && !uid) throw new Error("Could not find this person's account. Paste their Account ID (from their user page), or use the exact email they sign in with.");

    const id = randomOrderId();
    const currency = (f.currency.trim() || "INR").toUpperCase();
    const data = {
      uid, email: f.email.trim(), name: f.name.trim(), plan: f.plan, amount,
      listAmount: isGift && currency === "INR" ? PLANS[f.plan]?.price || amount : amount,
      amountAdjusted: false, gift: isGift, currency,
      utr: f.ref.trim(), method: f.method.trim(), country: f.country.trim(), status: f.status, note: f.note.trim(),
      manual: true, addedBy: by,
      createdAt: Timestamp.fromDate(new Date(f.date + "T12:00:00+05:30")),
      reviewedAt: serverTimestamp(),
    };
    if (grant) {
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
    return id;
  }

  // Only manual records can be removed. App orders stay as the permanent audit trail.
  async function deleteManualPayment(order) {
    if (!order.manual) throw new Error("Only manual records can be deleted.");
    await deleteDoc(doc(db, "payments", order.id));
  }

  async function paymentShot(orderId) {
    const snap = await getDoc(doc(db, "paymentShots", orderId));
    return snap.exists() ? snap.data().data || "" : "";
  }

  // ---------- Inbox ----------
  const setFeedbackHandled = (id, handled) => updateDoc(doc(db, "feedbackSubmissions", id), { handled });
  const setContactStatus = (id, status) => updateDoc(doc(db, "contactMessages", id), { status });

  // ---------- Messages ----------
  // Emails are sent from the admin's own mail app, so we only keep a note of it here.
  const logMessage = (entry) =>
    addDoc(collection(db, "messageHistory"), { ...entry, by, createdAt: serverTimestamp() });

  // Notifications go through the Trakey Admin API (Cloudflare Worker), so no Cloud Functions plan is needed.
  const sendBroadcast = (title, message, imageUrl = "") =>
    adminApi("/send", { title, message, imageUrl, audience: "all" });

  // One or many people. Returns { sent, failed, results: [{ uid, ok, reason }] } and keeps a note of each one in messageHistory.
  async function sendUserPush(uids, title, message, imageUrl = "") {
    const results = [];
    const queue = [...uids];
    const worker = async () => {
      while (queue.length) {
        const uid = queue.shift();
        try {
          await adminApi("/send", { title, message, imageUrl, audience: "user", target: uid });
          results.push({ uid, ok: true });
          logMessage({ kind: "push", uid, title, message }).catch(() => {});
        } catch (err) {
          results.push({ uid, ok: false, reason: err?.message || "failed" });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, uids.length) }, worker));
    const sent = results.filter((r) => r.ok).length;
    return { success: sent > 0, sent, failed: results.length - sent, results };
  }

  // ---------- Announcements / updates / notifications ----------
  const publishAnnouncement = (a) =>
    addDoc(collection(db, "adminAnnouncements"), {
      title: a.title, message: a.message, type: a.type,
      actionText: a.actionText || null, actionUrl: a.actionUrl || null,
      active: true, published: true, createdAt: serverTimestamp(), publishedAt: serverTimestamp(),
      publishedBy: by, createdBy: by,
    });
  const deleteAnnouncement = (id) => deleteDoc(doc(db, "adminAnnouncements", id));

  // Shared by publish and edit. releaseDate (YYYY-MM-DD, optional) lets an older version be added with its real date.
  // historyOnly saves it as inactive, so it stays in this list but the app does not show it as a new update.
  const updateFields = (u) => {
    const fields = {
      version: u.version, title: u.title, description: u.description, releaseNotes: u.releaseNotes,
      downloadUrl: u.downloadUrl || null, pdfUrl: u.pdfUrl || null, active: !u.historyOnly,
    };
    if (u.releaseDate) {
      fields.releaseDate = u.releaseDate;
      fields.publishedAt = Timestamp.fromDate(new Date(u.releaseDate + "T12:00:00+05:30"));
    }
    return fields;
  };
  const publishUpdate = (u) =>
    addDoc(collection(db, "appUpdates"), {
      ...updateFields(u), createdAt: serverTimestamp(), ...(u.releaseDate ? {} : { publishedAt: serverTimestamp() }), publishedBy: by,
    });
  const editUpdate = (id, u) =>
    updateDoc(doc(db, "appUpdates", id), { ...updateFields(u), updatedAt: serverTimestamp(), updatedBy: by });
  const deleteUpdate = (id) => deleteDoc(doc(db, "appUpdates", id));
  const deleteNotification = (id) => deleteDoc(doc(db, "adminNotifications", id));

  return {
    giftPro, removePro, approvePayment, saveAmount, rejectPayment, addManualPayment, deleteManualPayment, paymentShot,
    setFeedbackHandled, setContactStatus, logMessage, sendBroadcast, sendUserPush,
    publishAnnouncement, deleteAnnouncement, publishUpdate, editUpdate, deleteUpdate, deleteNotification,
  };
}
