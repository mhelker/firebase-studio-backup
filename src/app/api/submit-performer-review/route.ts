import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFirebaseAdminFirestore, FieldValue, Timestamp } from "@/lib/firebase-admin-lazy";

const PerformerReviewSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  performerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT)
      throw new Error("Firebase Admin not configured.");
    const firestore = getFirebaseAdminFirestore();

    const body = await req.json();
    const input = PerformerReviewSchema.parse(body);
    const { bookingId, customerId, performerId, rating, comment } = input;

    const bookingRef = firestore.collection("bookings").doc(bookingId);
    const performerRef = firestore.collection("performers").doc(performerId);
    const customerRef = firestore.collection("customers").doc(customerId);

    await firestore.runTransaction(async (transaction) => {
      const [bookingSnap, performerSnap, customerSnap] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(performerRef),
        transaction.get(customerRef),
      ]);

      if (!bookingSnap.exists) throw new Error("Booking not found.");
      if (!performerSnap.exists) throw new Error("Performer profile not found.");
      if (!customerSnap.exists) throw new Error("Customer profile not found.");

      const bookingData = bookingSnap.data()!;

      // Prevent double submission for performer's review of customer
      if (bookingData.performerReviewedCustomer === true) { // Use the new specific field
        throw new Error("You have already reviewed this booking.");
      }

      // 🔒 Validate content
      if (!rating || !comment.trim() || comment.trim().length < 10) {
        throw new Error("A valid rating and comment are required before submitting your review.");
      }

      // ✅ Save performer’s review of the customer
      const reviewRef = firestore
        .collection(`customers/${customerId}/reviews`)
        .doc();
      transaction.set(reviewRef, {
        bookingId,
        performerId,
        customerId,
        rating,
        comment,
        userName: performerSnap.data()!.displayName || "Performer",
        userImageUrl: performerSnap.data()!.imageUrl || "",
        date: FieldValue.serverTimestamp(),
      });

      // Update booking with performer's review data of the customer
      const bookingUpdateData: any = {
        performerReviewedCustomer: true, // Mark that PERFORMER has reviewed CUSTOMER
        customerRatingByPerformer: rating, // The rating PERFORMER gave CUSTOMER
        customerCommentByPerformer: comment, // The comment PERFORMER wrote about CUSTOMER
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Check if BOTH parties have reviewed each other after this update
      // We need to fetch the LATEST state of the customerReviewedPerformer flag.
      // Since this is a transaction, bookingData already reflects the snapshot at the start.
      // We assume bookingData.customerReviewedPerformer is accurate from previous state.
      if (bookingData.customerReviewedPerformer === true) {
        bookingUpdateData.status = "completed";
        bookingUpdateData.completedAt = FieldValue.serverTimestamp();
        bookingUpdateData.publicReviewsCreated = true;
      } else {
        // If customer hasn't reviewed yet, publicReviewsCreated remains false
        bookingUpdateData.publicReviewsCreated = false;
      }

      // Re-evaluate review deadline: if status is now 'completed', set a new deadline relative to now
      // Otherwise, keep existing logic or remove if deadline is only for pending reviews
      if (bookingUpdateData.status === "completed") {
        bookingUpdateData.reviewDeadline = new Timestamp(
          Timestamp.now().seconds + 14 * 24 * 60 * 60, // 14 days from now
          Timestamp.now().nanoseconds
        );
      } else if (!bookingData.reviewDeadline) {
        // If no deadline exists yet, create one for the booking creation timestamp + 14 days
        const createdAt = bookingData.createdAt instanceof Timestamp ? bookingData.createdAt : Timestamp.now();
        bookingUpdateData.reviewDeadline = new Timestamp(
          createdAt.seconds + 14 * 24 * 60 * 60,
          createdAt.nanoseconds
        );
      }

      transaction.update(bookingRef, bookingUpdateData);
    });

    return NextResponse.json({
      title: "Review Submitted!",
      description: "Your review of the customer has been saved successfully.",
    });
  } catch (error: any) {
    console.error("Error in submit-performer-review API route:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}