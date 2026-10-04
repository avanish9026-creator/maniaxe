const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

initializeApp({
  projectId: "trakey-b6002",
});

setGlobalOptions({
  maxInstances: 10,
});

const ADMIN_UID = "vbKeDnvMhfd4EFvx8F3kqc5M6m63";
const NOTIFICATION_TOPIC = "trakey_all_users";

exports.sendTrakeyNotification = onCall(async (request) => {
  // ---------------------------------------------------------
  // 1. Verify authentication
  // ---------------------------------------------------------
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in."
    );
  }

  // ---------------------------------------------------------
  // 2. Verify Trakey Admin account
  // ---------------------------------------------------------
  if (request.auth.uid !== ADMIN_UID) {
    throw new HttpsError(
      "permission-denied",
      "Admin access required."
    );
  }

  // ---------------------------------------------------------
  // 3. Validate notification content
  // ---------------------------------------------------------
  const title = String(request.data?.title || "").trim();
  const message = String(request.data?.message || "").trim();

  if (!title || !message) {
    throw new HttpsError(
      "invalid-argument",
      "Title and message are required."
    );
  }

  if (title.length > 100) {
    throw new HttpsError(
      "invalid-argument",
      "Title is too long."
    );
  }

  if (message.length > 1000) {
    throw new HttpsError(
      "invalid-argument",
      "Message is too long."
    );
  }

  // ---------------------------------------------------------
  // 4. Confirm which Firebase project the backend is using
  // ---------------------------------------------------------
  const firebaseApp = getApp();

  console.log(
    "Trakey FCM project:",
    firebaseApp.options.projectId
  );

  console.log(
    "Trakey FCM target:",
    NOTIFICATION_TOPIC
  );

  // ---------------------------------------------------------
  // 5. Build a Firebase-Console-style notification
  //
  // Important:
  // - notification payload = normal visible notification
  // - no unnecessary data payload
  // - high Android priority
  // - use our Trakey notification channel
  // ---------------------------------------------------------
  const fcmMessage = {
    topic: NOTIFICATION_TOPIC,

    notification: {
      title: title,
      body: message,
    },

    android: {
      priority: "high",

      notification: {
        channelId: "trakey_admin_push",
        visibility: "public",
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
  };

  // ---------------------------------------------------------
  // 6. Send through Firebase Cloud Messaging
  // ---------------------------------------------------------
  try {
    console.log(
      "Sending Trakey FCM notification..."
    );

    const messageId = await getMessaging().send(
      fcmMessage
    );

    console.log(
      "Trakey FCM message accepted:",
      messageId
    );

    // -------------------------------------------------------
    // 7. Save the notification to Firestore
    // -------------------------------------------------------
    await getFirestore()
      .collection("adminNotifications")
      .add({
        title,
        message,

        active: true,

        createdAt: FieldValue.serverTimestamp(),
        publishedAt: FieldValue.serverTimestamp(),

        publishedBy: request.auth.token.email || "",
        createdBy: request.auth.token.email || "",

        topic: NOTIFICATION_TOPIC,

        fcmMessageId: messageId,
      });

    console.log(
      "Trakey notification saved to Firestore."
    );

    // -------------------------------------------------------
    // 8. Return success to Admin panel
    // -------------------------------------------------------
    return {
      success: true,
      messageId,
      topic: NOTIFICATION_TOPIC,
    };

  } catch (error) {
    console.error(
      "Trakey FCM send failed:",
      error
    );

    throw new HttpsError(
      "internal",
      "Unable to send the Trakey notification."
    );
  }
});
