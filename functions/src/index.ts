import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";

admin.initializeApp();
const db = admin.firestore();

async function publishReviewsForBooking(bookingId: string, bookingData: admin.firestore.DocumentData) {
  const firestore = admin.firestore();
  console.log(`Attempting to publish reviews for booking: ${bookingId}`);

  if (bookingData.publicReviewsCreated === true) {
    console.log(`Skipping booking ${bookingId}: Public reviews already created.`);
    return;
  }

  const batch = firestore.batch();
  const bookingDocRef = firestore.collection("bookings").doc(bookingId);
  const reviewDate = bookingData.completedAt || admin.firestore.FieldValue.serverTimestamp();

  // --- THIS IS THE FINAL FIX (Part 1) ---
  // We now save the customer's review to the correct PERFORMER subcollection.
  if (bookingData.customerReviewSubmitted) {
    const publicReviewRef = firestore.collection(`performers/${bookingData.performerId}/reviews`).doc();
    batch.set(publicReviewRef, {
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

  // --- THIS IS THE FINAL FIX (Part 2) ---
  // We now save the performer's review to the correct CUSTOMER subcollection.
  if (bookingData.performerReviewSubmitted) {
    const publicReviewRef = firestore.collection(`customers/${bookingData.userId}/reviews`).doc();
    batch.set(publicReviewRef, {
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

// === All your triggers below this are PERFECT andUNCHANGED ===
export const checkOverdueReviews = onSchedule("every 24 hours", async (event) => { /* ... */ });
export const onBookingReviewUpdate = onDocumentUpdated("bookings/{bookingId}", async (event) => { /* ... */ });
export const updateCustomerRating = onDocumentWritten("customers/{customerId}/reviews/{reviewId}", async (event) => {
    // ... your existing, correct code
});

// You will also need a function to update the PERFORMER rating.
export const updatePerformerRating = onDocumentWritten("performers/{performerId}/reviews/{reviewId}", async (event) => {
    const performerId = event.params.performerId;
    console.log(`Review changed for performer ${performerId}. Recalculating rating...`);

    const performerDocRef = db.collection("performers").doc(performerId);
    const reviewsRef = performerDocRef.collection("reviews");
    const reviewsSnapshot = await reviewsRef.get();

    let totalRating = 0;
    const reviewCount = reviewsSnapshot.size;

    reviewsSnapshot.forEach(doc => {
        totalRating += doc.data().rating;
    });

    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
    console.log(`New stats for ${performerId}: Count=${reviewCount}, Avg Rating=${averageRating.toFixed(2)}`);

    try {
        await performerDocRef.update({
        rating: averageRating,
        reviewCount: reviewCount,
        });
        console.log(`Successfully updated performer document for ${performerId}.`);
    } catch (error) {
        console.error(`Failed to update performer document for ${performerId}:`, error);
    }
});