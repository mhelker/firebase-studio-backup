import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";

admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });
const db = admin.firestore();

// Helper function to publish reviews
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

// === TRIGGER 1: Check on a schedule ===
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

// === TRIGGER 2: Instant check on update ===
export const onBookingReviewUpdate = onDocumentUpdated(
  {
    document: "bookings/{bookingId}",
    region: "us-west2",
  },
  async (event) => {
    const afterData = event.data?.after.data();
    const beforeData = event.data?.before.data();

    if (!afterData || !beforeData) {
      console.log("No data found in event, exiting.");
      return;
    }

    const bothSubmitted =
      afterData.customerReviewSubmitted && afterData.performerReviewSubmitted;

    if (bothSubmitted) {
      await publishReviewsForBooking(event.params.bookingId, afterData);
    }
  }
);

// === TRIGGER 3: Update customer rating on new review ===
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
      totalRating += doc.data().rating;
    });

    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
    console.log(
      `New stats for ${customerId}: Count=${reviewCount}, Avg Rating=${averageRating.toFixed(2)}`
    );

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