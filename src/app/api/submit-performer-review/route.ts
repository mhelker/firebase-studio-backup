// src/app/api/submit-performer-review/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebase-admin-lazy';

// Use the lazily-initialized admin app
const firestore = getFirestore(adminApp);
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

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
      
      // Note: A performer's review of a customer does NOT go in a public collection.
      // It only updates the booking document itself to be held in escrow.
      // A function will later calculate the customer's average rating securely.

      const bookingData = bookingSnap.data()!;
      const bookingUpdateData: any = {
        performerReviewSubmitted: true,
        performerRatingOfCustomer: rating,
        performerCommentOnCustomer: comment,
        performerName: performerSnap.data()!.name,
        performerImageUrl: performerSnap.data()!.imageUrl,
      };

      // Set the completion and deadline timestamps if this is the first review submitted for the booking
      if (!bookingData.completedAt) {
        const now = Timestamp.now();
        bookingUpdateData.completedAt = now;
        bookingUpdateData.reviewDeadline = new Timestamp(
          now.seconds + 14 * 24 * 60 * 60, // 14 days from now
          now.nanoseconds
        );
      }

      // If the customer has already submitted their review, this one completes the set,
      // so we can mark public reviews as ready to be created.
      if (bookingData.customerReviewSubmitted) {
        bookingUpdateData.publicReviewsCreated = false; // Let the background function handle creation
      }

      transaction.update(bookingDocRef, bookingUpdateData);
    });

    return NextResponse.json({
      title: "Review Saved!",
      description: "Thank you for your feedback!",
    });
  } catch (error: any) {
    console.error("Error in submit-performer-review API route:", error);
    const errorMessage = error.message || "An internal server error occurred.";
    // Provide a more helpful error message if the service account is likely missing
    if (errorMessage.includes('Failed to parse service account') || errorMessage.includes('runTransaction')) {
        return NextResponse.json({ message: "Server configuration error: Could not connect to the database securely. Please check server logs." }, { status: 500 });
    }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}