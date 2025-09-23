import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import Stripe from "stripe";

admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });
const db = admin.firestore();

// ---------- Stripe Initialization ----------
const stripeSecret =
  process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret;
if (!stripeSecret) {
  console.warn("⚠️  No Stripe secret key found. Transfers will fail.");
}
const stripe = new Stripe(stripeSecret || "", {
  apiVersion: "2024-08-16",
});

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

  // Customer reviewed Performer
  if (bookingData.customerReviewSubmitted) {
    const publicRef = db.collection("reviews").doc();
    const performerRef = db
      .collection("performers")
      .doc(bookingData.performerId)
      .collection("reviews")
      .doc(publicRef.id);
    const customerRef = db
      .collection("customers")
      .doc(bookingData.userId)
      .collection("reviews")
      .doc(publicRef.id);

    const reviewData = {
      bookingId,
      performerId: bookingData.performerId,
      customerId: bookingData.userId,
      rating: bookingData.customerRating,
      comment: bookingData.customerComment,
      author: "customer",
      userName: bookingData.customerName,
      userImageUrl: bookingData.customerImageUrl,
      date: reviewDate,
    };

    batch.set(publicRef, reviewData);
    batch.set(performerRef, reviewData);
    batch.set(customerRef, reviewData);
  }

  // Performer reviewed Customer
  if (bookingData.performerReviewSubmitted) {
    const publicRef = db.collection("reviews").doc();
    const performerRef = db
      .collection("performers")
      .doc(bookingData.performerId)
      .collection("reviews")
      .doc(publicRef.id);
    const customerRef = db
      .collection("customers")
      .doc(bookingData.userId)
      .collection("reviews")
      .doc(publicRef.id);

    const reviewData = {
      bookingId,
      performerId: bookingData.performerId,
      customerId: bookingData.userId,
      rating: bookingData.performerRatingOfCustomer,
      comment: bookingData.performerCommentOnCustomer,
      author: "performer",
      userName: bookingData.performerName,
      userImageUrl: bookingData.performerImageUrl,
      date: reviewDate,
    };

    batch.set(publicRef, reviewData);
    batch.set(performerRef, reviewData);
    batch.set(customerRef, reviewData);
  }

  batch.update(bookingDocRef, { publicReviewsCreated: true });
  await batch.commit();
  console.log(`✅ Published public reviews for booking ${bookingId}`);
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
      afterData.customerReviewSubmitted === true &&
      afterData.performerReviewSubmitted === true;

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
export const transferOnPerformerReview = onDocumentWritten(
  { document: "bookings/{bookingId}", region: "us-west2" },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after || !before) return;

    const performerJustReviewed =
      after.performerReviewSubmitted && !before.performerReviewSubmitted;
    if (!performerJustReviewed) return;

    const { totalAmount, performerId, stripePaymentIntentId } = after;
    if (!performerId || !stripePaymentIntentId || !totalAmount) return;

    const performerDoc = await db.collection("performers").doc(performerId).get();
    const accountId = performerDoc.data()?.stripeAccountId;
    if (!accountId) return;

    await stripe.transfers.create({
      amount: Math.round(totalAmount * 100),
      currency: "usd",
      destination: accountId,
      source_transaction: stripePaymentIntentId,
    });

    console.log(`💸 Base payment transferred to performer ${performerId}`);
  }
);

// ---------- 6. Transfer tip on customer review ----------
export const transferTipOnCustomerReview = onDocumentWritten(
  { document: "bookings/{bookingId}", region: "us-west2" },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after || !before) return;

    const customerJustReviewed =
      after.customerReviewSubmitted && !before.customerReviewSubmitted;
    if (!customerJustReviewed) return;

    const { tipAmount, performerId, stripePaymentIntentId } = after;
    if (!tipAmount || tipAmount <= 0 || !performerId || !stripePaymentIntentId)
      return;

    const performerDoc = await db.collection("performers").doc(performerId).get();
    const accountId = performerDoc.data()?.stripeAccountId;
    if (!accountId) return;

    await stripe.transfers.create({
      amount: Math.round(tipAmount * 100),
      currency: "usd",
      destination: accountId,
      source_transaction: stripePaymentIntentId,
    });

    console.log(`💸 Tip transferred to performer ${performerId}`);
  }
);