// src/app/api/submit-performer-review/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Lazily import firebase-admin
async function getAdminFirestore() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  const { db, FieldValue, Timestamp } = await import('@/lib/firebase-admin-lazy');
  return { db, FieldValue, Timestamp };
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
    const admin = await getAdminFirestore();
    if (!admin) throw new Error("Firebase Admin not configured.");
    const { db: firestore, FieldValue, Timestamp } = admin;

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
      if (bookingSnap.data()!.performerReviewSubmitted) throw new Error("You have already reviewed this booking.");

      const privateReviewRef = firestore.collection(`customers/${customerId}/reviews`).doc();
      transaction.set(privateReviewRef, {
        bookingId,
        performerId,
        userId: customerId,
        rating,
        comment,
        userName: performerSnap.data()!.name || 'Anonymous Performer',
        userImageUrl: performerSnap.data()!.imageUrl || '',
        date: FieldValue.serverTimestamp(),
      });

      const bookingData = bookingSnap.data()!;
      const bookingUpdateData: any = {
        performerReviewSubmitted: true,
        performerRatingOfCustomer: rating,
        performerCommentOnCustomer: comment,
        performerName: performerSnap.data()!.name,
        performerImageUrl: performerSnap.data()!.imageUrl,
      };

      if (!bookingData.completedAt) {
        bookingUpdateData.completedAt = FieldValue.serverTimestamp();
      }

      const completionTime = (bookingData.completedAt || Timestamp.now()) as FirebaseFirestore.Timestamp;
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
    return NextResponse.json({ message: error.message || "An internal server error occurred." }, { status: 500 });
  }
}
