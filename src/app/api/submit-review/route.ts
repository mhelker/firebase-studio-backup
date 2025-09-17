// src/app/api/submit-review/route.ts

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

const SubmitReviewAndTipInputSchema = z.object({
  bookingId: z.string(),
  performerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  tipAmount: z.number().min(0),
  userId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminFirestore();
    if (!admin) throw new Error("Firebase Admin not configured.");
    const { db: firestore, FieldValue, Timestamp } = admin;

    const body = await req.json();
    const input = SubmitReviewAndTipInputSchema.parse(body);
    const { bookingId, performerId, rating, comment, tipAmount, userId } = input;

    validateFirestoreId(bookingId, 'bookingId');
    validateFirestoreId(performerId, 'performerId');
    validateFirestoreId(userId, 'userId');

    await firestore.runTransaction(async (transaction) => {
      const bookingDocRef = firestore.collection('bookings').doc(bookingId);
      const customerDocRef = firestore.collection('customers').doc(userId);

      const [bookingSnap, customerSnap] = await Promise.all([
        transaction.get(bookingDocRef),
        transaction.get(customerDocRef),
      ]);

      if (!bookingSnap.exists) throw new Error("Booking not found.");
      if (!customerSnap.exists) throw new Error("Customer profile not found.");
      if (bookingSnap.data()!.customerReviewSubmitted) throw new Error("You have already reviewed this booking.");

      const customerData = customerSnap.data()!;
      const customerName = customerData.displayName || 'Anonymous';
      const customerImageUrl = customerData.imageUrl || '';

      const privateReviewRef = firestore.collection(`performers/${performerId}/reviews`).doc();
      transaction.set(privateReviewRef, {
        bookingId,
        performerId,
        userId,
        rating,
        comment,
        userName: customerName,
        userImageUrl: customerImageUrl,
        date: FieldValue.serverTimestamp(),
      });

      const bookingData = bookingSnap.data()!;
      const bookingUpdateData: any = {
        customerReviewSubmitted: true,
        customerRating: rating,
        customerComment: comment,
        customerName: customerName,
        customerImageUrl: customerImageUrl,
      };

      if (tipAmount > 0) bookingUpdateData.tipAmount = tipAmount;

      if (!bookingData.completedAt) {
        bookingUpdateData.completedAt = FieldValue.serverTimestamp();
      }

      const completionTime = (bookingData.completedAt || Timestamp.now()) as FirebaseFirestore.Timestamp;
      bookingUpdateData.reviewDeadline = new Timestamp(
        completionTime.seconds + 14 * 24 * 60 * 60,
        completionTime.nanoseconds
      );

      // Only set publicReviewsCreated to false if performer hasn't submitted their review yet
      if (!bookingData.performerReviewSubmitted) {
        bookingUpdateData.publicReviewsCreated = false;
      }

      transaction.update(bookingDocRef, bookingUpdateData);
    });

    return NextResponse.json({
      title: "Review Saved!",
      description: "Thank you for your feedback!",
    });
  } catch (error: any) {
    console.error("Error in submit-review API route:", error);
    return NextResponse.json({ message: error.message || "An internal server error occurred." }, { status: 500 });
  }
}
