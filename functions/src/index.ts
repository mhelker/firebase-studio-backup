// functions/src/index.ts
import { Resend } from "resend";
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import Stripe from "stripe"; // Keep this import at the top

admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });
const db = admin.firestore();

// The global Stripe initialization and associated error checking have been REMOVED from here.
// Stripe client will now be initialized safely inside the specific functions that require it.

// ---------- Helper: publish public reviews ----------
async function publishReviewsForBooking(
  bookingId: string,
  bookingData: admin.firestore.DocumentData
) {
  console.log(`Attempting to publish reviews for booking: ${bookingId}`);

  if (bookingData.publicReviewsCreated) {
    console.log(`Booking ${bookingId} already has public reviews.`);
    return;
  }

  const batch = db.batch();
  const bookingDocRef = db.collection("bookings").doc(bookingId);
  const reviewDate =
    bookingData.completedAt || admin.firestore.FieldValue.serverTimestamp();

  // Ensure essential fields are defined, falling back to null or empty string if missing
  const customerId = bookingData.customerId || null; // <--- ADD THIS LINE
  const performerId = bookingData.performerId || null; // <--- ADD THIS LINE (good to do for consistency)

  // Customer reviewed Performer
  if (bookingData.customerReviewedPerformer) {
    if (!customerId || !performerId) { // <--- ADD THIS CHECK
        console.error(`Skipping customer review publishing for booking ${bookingId}: Missing essential IDs.`);
        return; // Or handle as an error if this should never happen
    }

    const publicRef = db.collection("reviews").doc();
    const performerRef = db
      .collection("performers")
      .doc(performerId) // Use the defined performerId
      .collection("reviews")
      .doc(publicRef.id);
    const customerRef = db
      .collection("customers")
      .doc(customerId) // Use the defined customerId
      .collection("reviews")
      .doc(publicRef.id);

    const reviewData = {
      bookingId,
      performerId,
      customerId,
      rating: bookingData.performerRatingByCustomer || 0, // ✅ Use new field name
      comment: bookingData.performerCommentByCustomer || '', // ✅ Use new field name
      author: "customer",
      userName: bookingData.customerName || 'Anonymous',
      userImageUrl: bookingData.customerImageUrl || '',
      date: reviewDate,
    };

    batch.set(publicRef, reviewData);
    batch.set(performerRef, reviewData);
    batch.set(customerRef, reviewData);
  }

  // Performer reviewed Customer
  if (bookingData.performerReviewedCustomer) {
    if (!customerId || !performerId) { // <--- ADD THIS CHECK
        console.error(`Skipping performer review publishing for booking ${bookingId}: Missing essential IDs.`);
        return;
    }

    const publicRef = db.collection("reviews").doc();
    const performerRef = db
      .collection("performers")
      .doc(performerId) // Use the defined performerId
      .collection("reviews")
      .doc(publicRef.id);
    const customerRef = db
      .collection("customers")
      .doc(customerId) // Use the defined customerId
      .collection("reviews")
      .doc(publicRef.id);

    const reviewData = {
      bookingId,
      performerId,
      customerId,
      rating: bookingData.customerRatingByPerformer || 0, // ✅ Use new field name
      comment: bookingData.customerCommentByPerformer || '', // ✅ Use new field name
      author: "performer",
      userName: bookingData.performerName || 'Anonymous',
      userImageUrl: bookingData.performerImageUrl || '',
      date: reviewDate,
    };

    batch.set(publicRef, reviewData);
    batch.set(performerRef, reviewData);
    batch.set(customerRef, reviewData);
  }

  // Only update publicReviewsCreated if at least one review was processed,
  // or if the intent is to mark it true regardless of review data being valid.
  // For now, let's keep it here, but be aware if reviews are skipped, this still fires.
  batch.update(bookingDocRef, { publicReviewsCreated: true });
  await batch.commit();
  console.log(`✅ Published public reviews for booking ${bookingId}`);
}

type NotificationType =
  | "bookingRequest"
  | "bookingAccepted"
  | "bookingDeclined"
  | "bookingCompleted"
  | "paymentSucceeded"
  | "payoutReleased"
  | "tipReceived"
  | "reviewReminder";

  // ✅ PASTE RIGHT HERE — EXACTLY HERE
function buildSubject(type: NotificationType): string {
  switch (type) {
    case "bookingRequest":
      return "New Booking Request 🎤";
    case "bookingAccepted":
      return "Booking Accepted ✅";
    case "bookingDeclined":
      return "Booking Declined";
    case "bookingCompleted":
      return "Booking Completed 🎉";
    case "paymentSucceeded":
      return "Payment Received 💳";
    case "payoutReleased":
      return "Your payout was released 💰";
    case "tipReceived":
      return "You received a tip! ⭐";
    case "reviewReminder":
      return "Reminder to leave a review";
    default:
      return "TalentHop Notification";
  }
}

function buildHtml(type: NotificationType, bookingId: string): string {
  switch (type) {
    case "bookingRequest":
      return `<p>You have a new booking request.</p>`;
    case "bookingAccepted":
      return `<p>Your booking was accepted.</p>`;
    case "bookingDeclined":
      return `<p>Your booking was declined.</p>`;
    case "bookingCompleted":
      return `<p>Your booking is complete.</p>`;
    case "paymentSucceeded":
      return `<p>Your payment was successful.</p>`;
    case "payoutReleased":
      return `<p>Your payout for booking <b>${bookingId}</b> has been released.</p>`;
    case "tipReceived":
      return `<p>You received a tip for booking <b>${bookingId}</b>.</p>`;
    case "reviewReminder":
      return `<p>Please remember to leave a review.</p>`;
    default:
      return `<p>You have a new notification.</p>`;
  }
}

interface SendNotificationParams {
  type: NotificationType;
  bookingId: string;
  recipientUid: string;
}

async function sendNotification({
  type,
  bookingId,
  recipientUid,
}: SendNotificationParams) {
  const userSnap = await db.collection("users").doc(recipientUid).get();
  if (!userSnap.exists) return;

  const user = userSnap.data();
  const prefs = user?.notificationPrefs?.[type];

  const emailEnabled = prefs?.email ?? false;
  const smsEnabled = prefs?.sms ?? false;
  const pushEnabled = prefs?.push ?? true;

  const notificationId = `${type}_${bookingId}`;

  // In-app notification (push = stored notification)
  if (pushEnabled) {
    await db
      .collection("users")
      .doc(recipientUid)
      .collection("notifications")
      .doc(notificationId)
      .set(
        {
          type,
          bookingId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  if (emailEnabled && user?.email) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "TalentHop <onboarding@onresend.dev>",
    to: user.email,
    subject: buildSubject(type),
    html: buildHtml(type, bookingId),
  });

  console.log(`📧 Email sent → ${user.email}`);
}

  if (smsEnabled && user?.phoneNumber) {
    console.log(`📱 SMS → ${user.phoneNumber} | ${type} | ${bookingId}`);
    // integrate Twilio later
  }
}

// ---------- 1. Scheduled check for overdue reviews ----------
export const checkOverdueReviews = onSchedule(
  { schedule: "every 24 hours", region: "us-west2" },
  async () => {
    console.log("Checking for overdue reviews...");
    const now = admin.firestore.Timestamp.now();

    const overdue = await db
      .collection("bookings")
      .where("reviewDeadline", "<=", now)
      .where("publicReviewsCreated", "==", false)
      .get();

    if (overdue.empty) {
      console.log("No overdue reviews found.");
      return;
    }

    await Promise.all(
      overdue.docs.map((doc) => publishReviewsForBooking(doc.id, doc.data()))
    );
    console.log(`Processed ${overdue.size} overdue booking(s).`);
  }
);

// ---------- 2. Publish reviews when both submitted ----------
export const onBookingReviewUpdate = onDocumentUpdated(
  { document: "bookings/{bookingId}", region: "us-west2" },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    const bookingId = event.params.bookingId;

    if (!beforeData || !afterData) return;

    const bothSubmitted =
      afterData.customerReviewedPerformer === true && // ✅ Use new field name
      afterData.performerReviewedCustomer === true;   // ✅ Use new field name

    if (bothSubmitted && !afterData.publicReviewsCreated) {
      console.log(`Both reviews submitted for booking ${bookingId}`);
      try {
        await publishReviewsForBooking(bookingId, afterData);
      } catch (err) {
        console.error(`Error publishing reviews for ${bookingId}:`, err);
      }
    }
  }
);

// ---------- 3. Update customer rating ----------
export const updateCustomerRating = onDocumentWritten(
  { document: "customers/{customerId}/reviews/{reviewId}", region: "us-west2" },
  async (event) => {
    const customerId = event.params.customerId;
    const reviewsSnap = await db
      .collection("customers")
      .doc(customerId)
      .collection("reviews")
      .get();

    const total = reviewsSnap.docs.reduce(
      (sum, d) => sum + (d.data().rating || 0),
      0
    );
    const count = reviewsSnap.size;
    const avg = count > 0 ? total / count : 0;

    await db.collection("customers").doc(customerId).update({
      rating: avg,
      reviewCount: count,
    });
    console.log(`Updated customer ${customerId}: ${avg.toFixed(2)}★`);
  }
);

// ---------- 4. Update performer rating ----------
export const updatePerformerRating = onDocumentWritten(
  { document: "performers/{performerId}/reviews/{reviewId}", region: "us-west2" },
  async (event) => {
    const performerId = event.params.performerId;
    const reviewsSnap = await db
      .collection("performers")
      .doc(performerId)
      .collection("reviews")
      .get();

    const total = reviewsSnap.docs.reduce(
      (sum, d) => sum + (d.data().rating || 0),
      0
    );
    const count = reviewsSnap.size;
    const avg = count > 0 ? total / count : 0;

    await db.collection("performers").doc(performerId).update({
      rating: avg,
      reviewCount: count,
    });
    console.log(`Updated performer ${performerId}: ${avg.toFixed(2)}★`);
  }
);


// ---------- 5. Transfer booking payment on performer review ----------
// ... (imports and sendNotification helper stay exactly as you had them)

export const transferPerformerPayouts = onDocumentUpdated(
  {
    document: "bookings/{bookingId}",
    region: "us-west2",
    secrets: ["STRIPE_SECRET_KEY", "RESEND_API_KEY"],
  },
  async (event) => {
    const bookingId = event.params.bookingId;
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    
    if (!after || !before) return;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
    const bookingRef = db.collection("bookings").doc(bookingId);

    try {
      // --- STAGE 1: INITIAL PAYOUT (Triggered by Performer Review) ---
      // We only move the base money if the Performer has reviewed.
      const canSendInitial = (after.performerReviewedCustomer || after.performerReviewSubmitted);
      
      if (canSendInitial && !after.initialPayoutTransferred && after.performerPayout > 0) {
        console.log(`Processing Initial Payout for ${bookingId}`);
        const pi = await stripe.paymentIntents.retrieve(after.stripePaymentIntentId);
        
        if (pi.latest_charge) {
          await stripe.transfers.create({
            amount: Math.round(after.performerPayout * 100),
            currency: "usd",
            destination: after.performerStripeAccountId,
            source_transaction: pi.latest_charge as string,
          });

          await bookingRef.update({ 
            initialPayoutTransferred: true,
            performerPaymentTransferred: true // syncing both your field names
          });

          // 🔔 NOTIFICATION: Payout Released
          await sendNotification({
            type: "payoutReleased",
            bookingId,
            recipientUid: after.performerId
          });
        }
      }

      // --- STAGE 2: TIP PAYOUT (Triggered by Customer Review) ---
      // We only move the tip if the Customer has reviewed AND the performer has reviewed.
      const canSendTip = (after.customerReviewedPerformer || after.customerReviewSubmitted) && 
                         (after.performerReviewedCustomer || after.performerReviewSubmitted);

      if (canSendTip && after.tipAmount > 0 && !after.tipPayoutReleased && after.tipPaymentIntentId) {
        console.log(`Processing Tip Payout for ${bookingId}`);
        const ti = await stripe.paymentIntents.retrieve(after.tipPaymentIntentId);
        
        if (ti.latest_charge) {
          await stripe.transfers.create({
            amount: Math.round(after.tipAmount * 100),
            currency: "usd",
            destination: after.performerStripeAccountId,
            source_transaction: ti.latest_charge as string,
          });

          await bookingRef.update({ 
            tipPayoutReleased: true, 
            tipStatus: "released",
            tipPayoutReleasedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // 🔔 NOTIFICATION: Tip Received
          await sendNotification({
            type: "tipReceived",
            bookingId,
            recipientUid: after.performerId
          });
        }
      }

      // --- FINAL CLOSE-OUT ---
      // Re-fetch to see if everything is finished
      const checkSnap = await bookingRef.get();
      const final = checkSnap.data();

      const isFullyDone = 
        final?.initialPayoutTransferred && 
        (final?.tipAmount > 0 ? final?.tipPayoutReleased : true) &&
        (final?.customerReviewedPerformer || final?.customerReviewSubmitted) &&
        (final?.performerReviewedCustomer || final?.performerReviewSubmitted);

      if (isFullyDone && final?.paymentStatus !== "released") {
        await bookingRef.update({
          paymentStatus: "released",
          initialPayoutReleased: true,
          payoutReleasedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ Booking ${bookingId} fully released and closed.`);
      }

    } catch (err) {
      console.error(`❌ Stripe/Payout Error for ${bookingId}:`, err);
    }
  }
);