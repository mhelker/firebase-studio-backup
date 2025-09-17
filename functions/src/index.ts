import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import Stripe from "stripe";

admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });
const db = admin.firestore();

// Initialize Stripe with the secret key from environment variables
// IMPORTANT: Set this in your Firebase environment:
// firebase functions:config:set stripe.secret_key="YOUR_STRIPE_SECRET_KEY"
let stripe: Stripe;
try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        throw new Error("Stripe secret key is not configured in Firebase environment.");
    }
    stripe = new Stripe(secretKey, {
      apiVersion: "2024-06-20",
    });
    console.log("Stripe client initialized successfully.");
} catch (error) {
    console.error("Stripe initialization failed:", error);
    // You might want to handle this more gracefully depending on your app's needs
}

async function processMainPayout(bookingId: string, bookingData: admin.firestore.DocumentData) {
    if (bookingData.payoutStatus === 'paid') {
        console.log(`Skipping main payout for booking ${bookingId}: Already paid.`);
        return;
    }

    if (!stripe) {
        console.error("Stripe client not initialized. Cannot process payout.");
        return;
    }

    const { performerId, performerPayout, paymentIntentId } = bookingData;

    if (!performerId || !performerPayout || !paymentIntentId) {
        console.error(`Booking ${bookingId} is missing required payout information.`);
        return;
    }

    try {
        const performerDoc = await db.collection("performers").doc(performerId).get();
        if (!performerDoc.exists) {
            throw new Error(`Performer ${performerId} not found.`);
        }

        const stripeAccountId = performerDoc.data()?.stripeAccountId;
        if (!stripeAccountId) {
            throw new Error(`Performer ${performerId} has not connected their Stripe account.`);
        }

        // Amount must be in cents
        const amountInCents = Math.round(performerPayout * 100);

        console.log(`Transferring main payout of ${amountInCents} cents to Stripe account ${stripeAccountId} for booking ${bookingId}.`);

        const transfer = await stripe.transfers.create({
            amount: amountInCents,
            currency: 'usd',
            destination: stripeAccountId,
            source_transaction: paymentIntentId,
            description: `Payout for booking #${bookingId}`,
        });

        console.log(`Stripe transfer successful! Transfer ID: ${transfer.id}`);

        await db.collection("bookings").doc(bookingId).update({
            payoutStatus: "paid",
            payoutTransferId: transfer.id,
        });

    } catch (error) {
        console.error(`Failed to process main payout for booking ${bookingId}:`, error);
        await db.collection("bookings").doc(bookingId).update({
            payoutStatus: "failed",
            payoutError: (error as Error).message,
        });
    }
}


// NEW function to handle tip payouts separately
async function processTipPayout(bookingId: string, bookingData: admin.firestore.DocumentData) {
    if (bookingData.tipPayoutStatus === 'paid') {
        console.log(`Skipping tip payout for booking ${bookingId}: Already paid.`);
        return;
    }
    
    if (!stripe) {
        console.error("Stripe client not initialized. Cannot process tip payout.");
        return;
    }

    const { performerId, tipAmount, paymentIntentId } = bookingData;

    // A tip of 0 or less is not an error, just nothing to do.
    if (!performerId || !paymentIntentId || !tipAmount || tipAmount <= 0) {
        console.log(`Booking ${bookingId} has no tip amount to pay out.`);
        return;
    }

    try {
        const performerDoc = await db.collection("performers").doc(performerId).get();
        if (!performerDoc.exists) {
            throw new Error(`Performer ${performerId} not found.`);
        }
        const stripeAccountId = performerDoc.data()?.stripeAccountId;
        if (!stripeAccountId) {
            throw new Error(`Performer ${performerId} has not connected their Stripe account for tip payout.`);
        }

        const amountInCents = Math.round(tipAmount * 100);
        console.log(`Transferring tip of ${amountInCents} cents to Stripe account ${stripeAccountId} for booking ${bookingId}.`);

        const transfer = await stripe.transfers.create({
            amount: amountInCents,
            currency: 'usd',
            destination: stripeAccountId,
            source_transaction: paymentIntentId,
            description: `Tip for booking #${bookingId}`,
        });

        console.log(`Stripe tip transfer successful! Transfer ID: ${transfer.id}`);

        await db.collection("bookings").doc(bookingId).update({
            tipPayoutStatus: "paid",
            tipPayoutTransferId: transfer.id,
        });

    } catch (error) {
        console.error(`Failed to process tip payout for booking ${bookingId}:`, error);
        await db.collection("bookings").doc(bookingId).update({
            tipPayoutStatus: "failed",
            tipPayoutError: (error as Error).message,
        });
    }
}


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

  // --- Customer reviewed Performer ---
  if (bookingData.customerReviewSubmitted) {
    const publicReviewRef = firestore.collection("reviews").doc();
    const performerReviewRef = firestore
      .collection("performers")
      .doc(bookingData.performerId)
      .collection("reviews")
      .doc(publicReviewRef.id);
    const customerReviewRef = firestore
      .collection("customers")
      .doc(bookingData.userId)
      .collection("reviews")
      .doc(publicReviewRef.id);

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

    batch.set(publicReviewRef, reviewData);
    batch.set(performerReviewRef, reviewData);
    batch.set(customerReviewRef, reviewData);
  }

  // --- Performer reviewed Customer ---
  if (bookingData.performerReviewSubmitted) {
    const publicReviewRef = firestore.collection("reviews").doc();
    const performerReviewRef = firestore
      .collection("performers")
      .doc(bookingData.performerId)
      .collection("reviews")
      .doc(publicReviewRef.id);
    const customerReviewRef = firestore
      .collection("customers")
      .doc(bookingData.userId)
      .collection("reviews")
      .doc(publicReviewRef.id);

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

    batch.set(publicReviewRef, reviewData);
    batch.set(performerReviewRef, reviewData);
    batch.set(customerReviewRef, reviewData);
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

    // --- MAIN PAYOUT LOGIC ---
    // If the status changed from anything to 'completed'
    if (beforeData.status !== 'completed' && afterData.status === 'completed') {
        console.log(`Booking ${event.params.bookingId} marked as completed. Initiating main payout.`);
        await processMainPayout(event.params.bookingId, afterData);
    }
    
    // --- TIP PAYOUT LOGIC ---
    // If the customer review was just submitted and there's a tip
    if (!beforeData.customerReviewSubmitted && afterData.customerReviewSubmitted && afterData.tipAmount > 0) {
        console.log(`Customer review for booking ${event.params.bookingId} submitted with a tip. Initiating tip payout.`);
        await processTipPayout(event.params.bookingId, afterData);
    }


    // --- REVIEW PUBLISHING LOGIC ---
    // Check if both reviews are now submitted
    const bothSubmitted =
      afterData.customerReviewSubmitted === true &&
      afterData.performerReviewSubmitted === true;

    // Publish reviews immediately if both are in
    if (bothSubmitted && !afterData.publicReviewsCreated) {
      console.log(`Both reviews submitted for booking ${event.params.bookingId}, publishing public reviews...`);
      try {
        await publishReviewsForBooking(event.params.bookingId, afterData);
      } catch (error) {
        console.error(`Error publishing reviews for booking ${event.params.bookingId}:`, error);
      }
    } else {
      console.log(`Conditions not met or reviews already published for booking ${event.params.bookingId}.`);
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

    console.log(`New stats for customer ${customerId}: Count=${reviewCount}, Avg Rating=${averageRating.toFixed(2)}`);

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

// === Trigger 4: Update performer rating when their reviews change ===
export const updatePerformerRating = onDocumentWritten(
  {
    document: "performers/{performerId}/reviews/{reviewId}",
    region: "us-west2",
  },
  async (event) => {
    const performerId = event.params.performerId;
    console.log(`Review changed for performer ${performerId}. Recalculating rating...`);

    const performerDocRef = db.collection("performers").doc(performerId);
    const reviewsRef = performerDocRef.collection("reviews");
    const reviewsSnapshot = await reviewsRef.get();

    let totalRating = 0;
    const reviewCount = reviewsSnapshot.size;

    reviewsSnapshot.forEach((doc) => {
      totalRating += doc.data().rating || 0;
    });

    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;

    console.log(`New stats for performer ${performerId}: Count=${reviewCount}, Avg Rating=${averageRating.toFixed(2)}`);

    try {
      await performerDocRef.update({
        rating: averageRating,
        reviewCount: reviewCount,
      });
      console.log(`Successfully updated performer document for ${performerId}.`);
    } catch (error) {
      console.error(`Failed to update performer document for ${performerId}:`, error);
    }
  }
);
