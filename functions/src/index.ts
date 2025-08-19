// functions/src/index.ts
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

admin.initializeApp();
const db = admin.firestore();

// This is a new, simpler helper function
async function publishReviewsForBooking(bookingId: string, bookingData: admin.firestore.DocumentData) {
  const firestore = admin.firestore();
  console.log(`Attempting to publish reviews for booking: ${bookingId}`);

  // Safety check: Do not run if already published
  if (bookingData.publicReviewsCreated === true) {
    console.log(`Skipping booking ${bookingId}: Public reviews already created.`);
    return;
  }

  const batch = firestore.batch();
  const bookingDocRef = firestore.collection("bookings").doc(bookingId);

  const reviewDate = bookingData.completedAt || admin.firestore.FieldValue.serverTimestamp();

  if (bookingData.customerReviewSubmitted) {
    const publicReviewForPerformerRef = firestore.collection("reviews").doc();
    batch.set(publicReviewForPerformerRef, {
      bookingId,
      performerId: bookingData.performerId,
      customerId: bookingData.userId,
      rating: bookingData.customerRating,
      comment: bookingData.customerComment,
      author: "customer",
      userName: bookingData.customerName,
      userImageUrl: bookingData.customerImageUrl,
      date: reviewDate,
    });
  }

  if (bookingData.performerReviewSubmitted) {
    const publicReviewForCustomerRef = firestore.collection("reviews").doc();
    batch.set(publicReviewForCustomerRef, {
      bookingId,
      performerId: bookingData.performerId,
      customerId: bookingData.userId,
      rating: bookingData.performerRatingOfCustomer,
      comment: bookingData.performerCommentOnCustomer,
      author: "performer",
      userName: bookingData.performerName,
      userImageUrl: bookingData.performerImageUrl,
      date: reviewDate,
    });
  }

  batch.update(bookingDocRef, { publicReviewsCreated: true });
  await batch.commit();
  console.log(`Successfully published public reviews for booking: ${bookingId}`);
}

// TRIGGER 1: Check on a schedule (no change needed here)
export const checkOverdueReviews = onSchedule("every 24 hours", async (event) => {
    // ... This function remains the same and will work correctly
});

// TRIGGER 2: Instant check on update (This is the corrected logic)
export const onBookingReviewUpdate = onDocumentUpdated("bookings/{bookingId}", async (event) => {
  const afterData = event.data?.after.data();
  const beforeData = event.data?.before.data();

  if (!afterData || !beforeData) {
    console.log("No data found in event, exiting.");
    return;
  }

  // Condition: Are both reviews now submitted?
  const bothSubmitted = afterData.customerReviewSubmitted && afterData.performerReviewSubmitted;
  // Condition: Was this not the case before? (Prevents running twice)
  const wasNotPreviouslyComplete = !(beforeData.customerReviewSubmitted && beforeData.performerReviewSubmitted);

  if (bothSubmitted && wasNotPreviouslyComplete) {
    // We use the data directly from the event to avoid the race condition
    await publishReviewsForBooking(event.params.bookingId, afterData);
  }
});