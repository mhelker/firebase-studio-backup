import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Lazily import firebase-admin functions and static values
// This will correctly import getFirebaseAdminFirestore, FieldValue, Timestamp, etc.
async function getAdminFirestoreDependencies() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    // console.error("FIREBASE_SERVICE_ACCOUNT environment variable is not set.");
    return null;
  }
  // Destructure the *functions* and *values* that are actually exported
  const { getFirebaseAdminFirestore, FieldValue, Timestamp } = await import('@/lib/firebase-admin-lazy');
  return { getFirebaseAdminFirestore, FieldValue, Timestamp };
}

function validateFirestoreId(id: string, label: string) {
  if (!id || typeof id !== 'string' || id.includes('/')) {
    throw new Error(`Invalid ${label} used in Firestore path: "${id}"`);
  }
}

const SubmitPerformerReviewInputSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  userId: z.string(), // This is the performer's ID
});

export async function POST(req: NextRequest) {
  try {
    const adminDeps = await getAdminFirestoreDependencies();
    if (!adminDeps) {
      throw new Error("Firebase Admin not configured due to missing service account.");
    }

    // Correctly get the Firestore instance by calling the function
    const firestore = adminDeps.getFirebaseAdminFirestore();
    const { FieldValue, Timestamp } = adminDeps;

    const body = await req.json();
    const input = SubmitPerformerReviewInputSchema.parse(body);
    const { bookingId, customerId, rating, comment, userId: performerId } = input;

    validateFirestoreId(bookingId, 'bookingId');
    validateFirestoreId(customerId, 'customerId');
    validateFirestoreId(performerId, 'performerId');

    await firestore.runTransaction(async (transaction) => {
      const bookingDocRef = firestore.collection('bookings').doc(bookingId);
      const performerDocRef = firestore.collection('performers').doc(performerId);

      const [bookingSnap, performerSnap] = await Promise.all([
        transaction.get(bookingDocRef),
        transaction.get(performerDocRef),
      ]);

      if (!bookingSnap.exists) throw new Error("Booking not found.");
      if (!performerSnap.exists) throw new Error("Performer profile not found.");

      // Check if the review has already been submitted by the performer for this booking
      if (bookingSnap.data()?.performerReviewSubmitted) {
        throw new Error("You have already reviewed this booking.");
      }

      // Add a private review to the customer's subcollection
      const privateReviewRef = firestore.collection(`customers/${customerId}/reviews`).doc();
      transaction.set(privateReviewRef, {
        bookingId,
        performerId,
        userId: customerId, // Customer ID is the user being reviewed here
        rating,
        comment,
        userName: performerSnap.data()?.name || 'Anonymous Performer',
        userImageUrl: performerSnap.data()?.imageUrl || '',
        date: FieldValue.serverTimestamp(),
      });

      // Update the booking document
      const bookingData = bookingSnap.data()!;
      const bookingUpdateData: any = {
        performerReviewSubmitted: true,
        performerRatingOfCustomer: rating,
        performerCommentOnCustomer: comment,
        performerName: performerSnap.data()?.name,
        performerImageUrl: performerSnap.data()?.imageUrl,
      };

      // Set completedAt if not already set
      if (!bookingData.completedAt) {
        bookingUpdateData.completedAt = FieldValue.serverTimestamp();
      }

      // Calculate review deadline (14 days after completion time)
      const completionTime = (bookingData.completedAt || Timestamp.now()) as typeof Timestamp; // Use the actual Timestamp type
      bookingUpdateData.reviewDeadline = new Timestamp(
        completionTime.seconds + 14 * 24 * 60 * 60,
        completionTime.nanoseconds
      );

      // Only set publicReviewsCreated to false if customer hasn't submitted their review yet
      if (!bookingData.customerReviewSubmitted) {
        bookingUpdateData.publicReviewsCreated = false;
      }

      transaction.update(bookingDocRef, bookingUpdateData);
    });

    return NextResponse.json({
      title: "Review Saved!",
      description: "Thank you for your feedback!",
    });
  } catch (error: any) {
    console.error("Error in submit-performer-review API route:", error);
    // Provide more specific error messages for API consumers
    let status = 500;
    let message = "An internal server error occurred.";

    if (error instanceof z.ZodError) {
      status = 400;
      message = "Invalid request data.";
      // You might want to return error.issues for more detail in development
    } else if (error.message.includes("Booking not found") || error.message.includes("Performer profile not found") || error.message.includes("You have already reviewed this booking")) {
      status = 404; // Or 409 Conflict for "already reviewed"
      message = error.message;
    } else if (error.message.includes("Firebase Admin not configured")) {
      status = 500; // Still internal, configuration issue
      message = "Server configuration error.";
    } else if (error.message.includes("Invalid ") && error.message.includes("Firestore path")) {
      status = 400;
      message = error.message;
    }

    return NextResponse.json({ message }, { status });
  }
}