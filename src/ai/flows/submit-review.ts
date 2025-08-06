
// src/ai/flows/submit-review.ts
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Performer } from '@/types';

// Lazily import firebase-admin to prevent app crash on missing env var
async function getAdminFirestore() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return null;
  }
  const { db, FieldValue, Timestamp } = await import('@/lib/firebase-admin-lazy');
  return { db, FieldValue, Timestamp };
}

function validateFirestoreId(id: string, label: string) {
  if (!id || typeof id !== 'string' || id.includes('/')) {
    throw new Error(`Invalid ${label} used in Firestore path: "${id}"`);
  }
}

// == FLOW 1: CUSTOMER REVIEWS PERFORMER ==

const SubmitReviewAndTipInputSchema = z.object({
  bookingId: z.string(),
  performerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  tipAmount: z.number().min(0),
  userId: z.string(), // ✅ explicitly required
});
export type SubmitReviewAndTipInput = z.infer<typeof SubmitReviewAndTipInputSchema>;

const SubmitReviewAndTipOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
});
export type SubmitReviewAndTipOutput = z.infer<typeof SubmitReviewAndTipOutputSchema>;

export async function submitReviewAndTip(input: SubmitReviewAndTipInput): Promise<SubmitReviewAndTipOutput> {
  return submitReviewAndTipFlow(input);
}

const submitReviewAndTipFlow = ai.defineFlow(
  {
    name: 'submitReviewAndTipFlow',
    inputSchema: SubmitReviewAndTipInputSchema,
    outputSchema: SubmitReviewAndTipOutputSchema,
  },
  async (input) => {
    const admin = await getAdminFirestore();
    if (!admin) {
      console.warn("Firebase Admin SDK not configured. Running in demo mode.");
      return {
        title: "Review Submitted (Demo Mode)",
        description: "This is a demo. In a real app, your review would be saved. To enable this feature, configure your FIREBASE_SERVICE_ACCOUNT in the .env file."
      };
    }

    const { db: firestore, FieldValue, Timestamp } = admin;
    const { bookingId, performerId, rating, comment, tipAmount, userId } = input;

    validateFirestoreId(bookingId, 'bookingId');
    validateFirestoreId(performerId, 'performerId');
    validateFirestoreId(userId, 'userId');

    try {
      const resultMessage = await firestore.runTransaction(async (transaction) => {
        const bookingDocRef = firestore.collection('bookings').doc(bookingId);
        const performerDocRef = firestore.collection('performers').doc(performerId);
        const customerDocRef = firestore.collection('customers').doc(userId);

        const [bookingSnap, performerSnap, customerSnap] = await Promise.all([
          transaction.get(bookingDocRef),
          transaction.get(performerDocRef),
          transaction.get(customerDocRef),
        ]);

        if (!bookingSnap.exists) throw new Error("Booking not found.");
        if (!performerSnap.exists) throw new Error("Performer not found.");
        if (!customerSnap.exists) throw new Error("Customer profile not found.");

        const bookingData = bookingSnap.data()!;
        const customerData = customerSnap.data()!;

        if (bookingData.userId !== userId) throw new Error("You do not have permission to review this booking.");
        if (bookingData.customerReviewSubmitted) throw new Error("You have already reviewed this booking.");

        const bookingUpdateData: any = {
          customerReviewSubmitted: true,
          customerRating: rating,
          customerComment: comment,
          customerName: customerData.displayName || 'Anonymous',
          customerImageUrl: customerData.imageUrl || '',
        };

        if (tipAmount > 0) {
          bookingUpdateData.tipAmount = tipAmount;
        }

        if (bookingData.completedAt instanceof Timestamp) {
          bookingUpdateData.reviewDeadline = new Timestamp(
            bookingData.completedAt.seconds + (14 * 24 * 60 * 60),
            bookingData.completedAt.nanoseconds
          );
        }

        transaction.update(bookingDocRef, bookingUpdateData);

        if (bookingData.performerReviewSubmitted) {
          const performerData = performerSnap.data() as Performer;
          const newReviewCount = (performerData.reviewCount || 0) + 1;
          const newAverageRating = ((performerData.rating || 0) * (performerData.reviewCount || 0) + rating) / newReviewCount;

          transaction.update(performerDocRef, {
            rating: newAverageRating,
            reviewCount: newReviewCount,
          });

          const newReviewRef = firestore.collection(`performers/${performerId}/reviews`).doc();
          transaction.set(newReviewRef, {
            bookingId,
            performerId,
            userId,
            userName: customerData.displayName || 'Anonymous',
            userImageUrl: customerData.imageUrl || '',
            rating,
            comment,
            date: FieldValue.serverTimestamp(),
          });

          return {
            title: "Review Submitted!",
            description: "Both reviews are in! Your feedback is now public.",
          };
        } else {
          return {
            title: "Review Saved!",
            description: "Thank you! Your review will be published once the performer leaves their feedback, or after 14 days.",
          };
        }
      });

      return resultMessage;
    } catch (error: any) {
      console.error("Error in submitReviewAndTipFlow:", error);
      throw new Error(error.message || "An unexpected error occurred on the server.");
    }
  }
);

// === FLOW 2: PERFORMER REVIEWS CUSTOMER ===

const SubmitPerformerReviewInputSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  userId: z.string(), // ✅ explicitly required for safety
});
export type SubmitPerformerReviewInput = z.infer<typeof SubmitPerformerReviewInputSchema>;

export async function submitPerformerReview(input: SubmitPerformerReviewInput): Promise<SubmitReviewAndTipOutput> {
  return submitPerformerReviewFlow(input);
}

const submitPerformerReviewFlow = ai.defineFlow(
  {
    name: 'submitPerformerReviewFlow',
    inputSchema: SubmitPerformerReviewInputSchema,
    outputSchema: SubmitReviewAndTipOutputSchema,
  },
  async (input) => {
    const admin = await getAdminFirestore();
    if (!admin) {
      console.warn("Firebase Admin SDK not configured. Running in demo mode.");
      return {
        title: "Review Submitted (Demo Mode)",
        description: "This is a demo. In a real app, your review would be saved. To enable this feature, configure your FIREBASE_SERVICE_ACCOUNT in the .env file."
      };
    }
    
    const { db: firestore, FieldValue, Timestamp } = admin;
    const { bookingId, customerId, rating, comment, userId: performerId } = input;

    validateFirestoreId(bookingId, 'bookingId');
    validateFirestoreId(customerId, 'customerId');
    validateFirestoreId(performerId, 'performerId');

    try {
      const resultMessage = await firestore.runTransaction(async (transaction) => {
        const bookingDocRef = firestore.collection('bookings').doc(bookingId);
        const performerDocRef = firestore.collection('performers').doc(performerId);

        let customerDocRef = firestore.collection('customers').doc(customerId);
        let customerSnap = await transaction.get(customerDocRef);

        if (!customerSnap.exists) {
          customerDocRef = firestore.collection('users').doc(customerId);
          customerSnap = await transaction.get(customerDocRef);
        }

        const [bookingSnap, performerSnap] = await Promise.all([
          transaction.get(bookingDocRef),
          transaction.get(performerDocRef),
        ]);

        if (!bookingSnap.exists) throw new Error("Booking not found.");
        if (!performerSnap.exists) throw new Error("Performer profile not found.");
        if (!customerSnap.exists) throw new Error("Customer not found.");

        const bookingData = bookingSnap.data()!;
        const performerData = performerSnap.data();
        const customerData = customerSnap.data();

        if (bookingData.performerId !== performerId) throw new Error("You do not have permission to review this booking.");
        if (bookingData.userId !== customerId) throw new Error("Mismatched booking: The provided customer ID does not match the booking.");
        if (bookingData.performerReviewSubmitted) throw new Error("You have already reviewed this booking.");

        const bookingUpdateData: any = {
          performerReviewSubmitted: true,
          performerRatingOfCustomer: rating,
          performerCommentOnCustomer: comment,
        };

        if (bookingData.completedAt instanceof Timestamp) {
          bookingUpdateData.reviewDeadline = new Timestamp(
            bookingData.completedAt.seconds + 14 * 24 * 60 * 60,
            bookingData.completedAt.nanoseconds
          );
        }

        transaction.update(bookingDocRef, bookingUpdateData);

        if (bookingData.customerReviewSubmitted) {
          const newReviewCount = (customerData?.reviewCount || 0) + 1;
          const newAverageRating = ((customerData?.rating || 0) * (customerData?.reviewCount || 0) + rating) / newReviewCount;

          transaction.update(customerDocRef, {
            rating: newAverageRating,
            reviewCount: newReviewCount,
          });

          const newReviewRef = firestore.collection(`customers/${customerId}/reviews`).doc();
          transaction.set(newReviewRef, {
            bookingId,
            performerId,
            userId: performerId,
            userName: performerData?.name || 'Anonymous Performer',
            userImageUrl: performerData?.imageUrl || '',
            rating,
            comment,
            date: FieldValue.serverTimestamp(),
          });

          return {
            title: "Review Submitted!",
            description: "Both reviews are in! Your feedback is now public.",
          };
        } else {
          return {
            title: "Review Saved!",
            description: "Thank you! Your review will be published once the customer leaves their feedback, or after 14 days.",
          };
        }
      });

      return resultMessage;
    } catch (error: any) {
      console.error("Error in submitPerformerReviewFlow:", error);
      throw new Error(error.message || "An unexpected error occurred on the server.");
    }
  }
);

    