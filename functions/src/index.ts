import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";

admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });
const db = admin.firestore();

// Helper function to publish public reviews from a booking document
async function publishReviewsForBooking(bookingId: string, bookingData: admin.firestore.DocumentData) {
  const firestore = admin.firestore();
  console.log(`Attempting to publish reviews for booking: ${bookingId}`);

  if (bookingData.publicReviewsCreated === true) {
    console.log(`Skipping booking ${bookingId}: Public reviews already created.`);
    return;
  }

  const batch = firestore.batch();
  const bookingDocRef = firestore.collection("bookings").doc(bookingId);

  // Use bookingData.completedAt timestamp if available, otherwise server timestamp
  const reviewDate = bookingData.completedAt || admin.firestore.FieldValue.serverTimestamp();

  if (bookingData.customerReviewSubmitted) {
    const publicReviewRef = firestore.collection("reviews").doc();
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

  if (bookingData.performerReviewSubmitted) {
    const publicReviewRef = firestore.collection("reviews").doc();
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

// === Trigger 1: Scheduled check for overdue reviews to publish ===
export const checkOverdueReviews = onSchedule(
  {
    schedule: "every 24 hours",
    region: "us-west2",
  },
  async () => {
    console.log("Checking for overdue reviews to publish...");
    const now = admin.firestore.Timestamp.now();

    const overdueBookingsQuery = db
      .collection("bookings")
      .where("reviewDeadline", "<=", now)
      .where("publicReviewsCreated", "==", false);

    const overdueSnaps = await overdueBookingsQuery.get();

    if (overdueSnaps.empty) {
      console.log("No overdue reviews to publish.");
      return;
    }

    const promises = overdueSnaps.docs.map((doc) =>
      publishReviewsForBooking(doc.id, doc.data())
    );

    await Promise.all(promises);
    console.log(`Processed ${overdueSnaps.size} overdue booking(s).`);
  }
);

// === Trigger 2: Run instantly when a booking document updates ===
export const onBookingReviewUpdate = onDocumentUpdated(
  {
    document: "bookings/{bookingId}",
    region: "us-west2",
  },
  async (event) => {
    console.log(`Booking document updated: ${event.params.bookingId}`);

    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      console.log("No data available for before or after snapshot, skipping.");
      return;
    }

    // Check if both reviews are submitted in the updated data
    const bothSubmitted =
      afterData.customerReviewSubmitted === true &&
      afterData.performerReviewSubmitted === true;

    // Also check if public reviews are not yet created
    if (bothSubmitted && !afterData.publicReviewsCreated) {
      console.log(`Both reviews submitted for booking ${event.params.bookingId}, publishing public reviews...`);
      try {
        await publishReviewsForBooking(event.params.bookingId, afterData);
      } catch (error) {
        console.error(`Error publishing reviews for booking ${event.params.bookingId}:`, error);
      }
    } else {
      console.log(`Reviews not ready or already published for booking ${event.params.bookingId}.`);
    }
  }
);

// === Trigger 3: Update customer rating when their reviews change ===
export const updateCustomerRating = onDocumentWritten(
  {
    document: "customers/{customerId}/reviews/{reviewId}",
    region: "us-west2",
  },
  async (event) => {
    const customerId = event.params.customerId;
    console.log(`Review changed for customer ${customerId}. Recalculating rating...`);

    const customerDocRef = db.collection("customers").doc(customerId);
    const reviewsRef = customerDocRef.collection("reviews");
    const reviewsSnapshot = await reviewsRef.get();

    let totalRating = 0;
    const reviewCount = reviewsSnapshot.size;

    reviewsSnapshot.forEach((doc) => {
      totalRating += doc.data().rating || 0;
    });

    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;

    console.log(`New stats for ${customerId}: Count=${reviewCount}, Avg Rating=${averageRating.toFixed(2)}`);

    try {
      await customerDocRef.update({
        rating: averageRating,
        reviewCount: reviewCount,
      });
      console.log(`Successfully updated customer document for ${customerId}.`);
    } catch (error) {
      console.error(`Failed to update customer document for ${customerId}:`, error);
    }
  }
);