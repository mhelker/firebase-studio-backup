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
  if (bookingData.performerReviewSubmitted) {
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
export const transferOnPerformerReview = onDocumentWritten(
  { document: "bookings/{bookingId}", region: "us-west2", secrets: ["STRIPE_SECRET_KEY"] },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after || !before) return;

    const performerJustReviewed =
      after.performerReviewedCustomer && !before.performerReviewedCustomer; // ✅ Use new field name
    if (!performerJustReviewed) return;

    const { totalAmount, performerId, stripePaymentIntentId } = after;
    if (!performerId || !stripePaymentIntentId || totalAmount === undefined) { // Check for undefined, 0 is valid
      console.warn(`Missing data for transferOnPerformerReview. PerformerId: ${performerId}, PaymentIntentId: ${stripePaymentIntentId}, TotalAmount: ${totalAmount}`);
      return;
    }

    const performerDoc = await db.collection("performers").doc(performerId).get();
    const accountId = performerDoc.data()?.stripeAccountId;
    if (!accountId) {
      console.error(`Stripe account ID not found for performer ${performerId}. Cannot transfer funds.`);
      return;
    }

    // Initialize Stripe INSIDE this function handler
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      console.error("Stripe secret key is missing inside transferOnPerformerReview. This should not happen if secret is configured.");
      return; // Or throw, depending on desired error handling
    }
    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2024-06-20", // CRITICAL: This MUST be "2024-06-20"
      typescript: true, // Recommended for better type safety
    });

    try {
        await stripe.transfers.create({
            amount: Math.round(totalAmount * 100), // Ensure amount is in cents and integer
            currency: "usd",
            destination: accountId,
            source_transaction: stripePaymentIntentId,
        });
        console.log(`💸 Base payment of ${totalAmount} USD transferred to performer ${performerId} for booking ${event.params.bookingId}`);
    } catch (error) {
        console.error(`❌ Error transferring base payment for booking ${event.params.bookingId} to performer ${performerId}:`, error);
        // Optionally update booking status to reflect transfer failure if you have one
    }
  }
);

// ---------- 6. Transfer tip on customer review ----------
export const transferTipOnCustomerReview = onDocumentWritten(
  { document: "bookings/{bookingId}", region: "us-west2", secrets: ["STRIPE_SECRET_KEY"] },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after || !before) return;

    const customerJustReviewed =
      after.customerReviewedPerformer && !before.customerReviewedPerformer; // ✅ Use new field name
    if (!customerJustReviewed) return;

    const { tipAmount, performerId, stripePaymentIntentId } = after;
    if (tipAmount === undefined || tipAmount <= 0 || !performerId || !stripePaymentIntentId) {
      if (tipAmount === undefined || tipAmount <= 0) {
          console.log(`No valid tip amount (${tipAmount}) for transfer. Skipping tip transfer for booking ${event.params.bookingId}.`);
      } else {
          console.warn(`Missing data for transferTipOnCustomerReview. PerformerId: ${performerId}, PaymentIntentId: ${stripePaymentIntentId}`);
      }
      return;
    }

    const performerDoc = await db.collection("performers").doc(performerId).get();
    const accountId = performerDoc.data()?.stripeAccountId;
    if (!accountId) {
      console.error(`Stripe account ID not found for performer ${performerId}. Cannot transfer tip.`);
      return;
    }

    // Initialize Stripe INSIDE this function handler
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      console.error("Stripe secret key is missing inside transferTipOnCustomerReview. This should not happen if secret is configured.");
      return; // Or throw, depending on desired error handling
    }
    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2024-06-20", // CRITICAL: This MUST be "2024-06-20"
      typescript: true, // Recommended for better type safety
    });

    try {
        await stripe.transfers.create({
            amount: Math.round(tipAmount * 100), // Ensure amount is in cents and integer
            currency: "usd",
            destination: accountId,
            source_transaction: stripePaymentIntentId,
        });
        console.log(`💸 Tip of ${tipAmount} USD transferred to performer ${performerId} for booking ${event.params.bookingId}`);
    } catch (error) {
        console.error(`❌ Error transferring tip for booking ${event.params.bookingId} to performer ${performerId}:`, error);
        // Optionally update booking status to reflect transfer failure if you have one
    }
  }
);