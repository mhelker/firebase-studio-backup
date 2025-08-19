// src/ai/flows/submit-review.ts
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Performer } from '@/types';

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

// == FLOW 1: CUSTOMER REVIEWS PERFORMER ==
const SubmitReviewAndTipInputSchema = z.object({
  bookingId: z.string(),
  performerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  tipAmount: z.number().min(0),
  userId: z.string(),
});

const SubmitReviewAndTipOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export async function submitReviewAndTip(input: z.infer<typeof SubmitReviewAndTipInputSchema>): Promise<z.infer<typeof SubmitReviewAndTipOutputSchema>> {
  const admin = await getAdminFirestore();
  if (!admin) throw new Error("Firebase Admin not configured.");
  const { db: firestore, FieldValue, Timestamp } = admin;
  const { bookingId, performerId, rating, comment, tipAmount, userId } = input;

  validateFirestoreId(bookingId, 'bookingId');
  validateFirestoreId(performerId, 'performerId');
  validateFirestoreId(userId, 'userId');

  await firestore.runTransaction(async (transaction) => {
    const bookingDocRef = firestore.collection('bookings').doc(bookingId);
    const customerDocRef = firestore.collection('customers').doc(userId);
    const [bookingSnap, customerSnap] = await Promise.all([transaction.get(bookingDocRef), transaction.get(customerDocRef)]);

    if (!bookingSnap.exists) throw new Error("Booking not found.");
    if (!customerSnap.exists) throw new Error("Customer profile not found.");
    if (bookingSnap.data()!.customerReviewSubmitted) throw new Error("You have already reviewed this booking.");

    // Action 1: Create the immediate, private review in the performer's subcollection
    const privateReviewRef = firestore.collection(`performers/${performerId}/reviews`).doc();
    transaction.set(privateReviewRef, {
      bookingId, performerId, userId, rating, comment,
      userName: customerSnap.data()!.displayName || 'Anonymous',
      userImageUrl: customerSnap.data()!.imageUrl || '',
      date: FieldValue.serverTimestamp(),
    });

    // Action 2: Update the master booking document
    const bookingUpdateData: any = {
      customerReviewSubmitted: true,
      customerRating: rating,
      customerComment: comment,
      customerName: customerSnap.data()!.displayName || 'Anonymous',
      customerImageUrl: customerSnap.data()!.imageUrl || '',
      publicReviewsCreated: false,
    };
    if (tipAmount > 0) bookingUpdateData.tipAmount = tipAmount;
    
    // --- THIS IS THE CRITICAL FIX ---
    // Ensure completedAt is set, which is needed by the Cloud Function
    if (!bookingSnap.data()!.completedAt) {
      bookingUpdateData.completedAt = FieldValue.serverTimestamp();
    }
    // --- END OF FIX ---

    // Set the deadline
    const completionTime = (bookingSnap.data()!.completedAt || Timestamp.now()) as FirebaseFirestore.Timestamp;
    bookingUpdateData.reviewDeadline = new Timestamp(completionTime.seconds + (14 * 24 * 60 * 60), completionTime.nanoseconds);
    
    transaction.update(bookingDocRef, bookingUpdateData);
  });
  
  return { title: "Review Saved!", description: "Thank you for your feedback!" };
}

// == FLOW 2: PERFORMER REVIEWS CUSTOMER ==
const SubmitPerformerReviewInputSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  userId: z.string(), // This is the performer's ID
});

export async function submitPerformerReview(input: z.infer<typeof SubmitPerformerReviewInputSchema>): Promise<z.infer<typeof SubmitReviewAndTipOutputSchema>> {
  const admin = await getAdminFirestore();
  if (!admin) throw new Error("Firebase Admin not configured.");
  const { db: firestore, FieldValue, Timestamp } = admin;
  const { bookingId, customerId, rating, comment, userId: performerId } = input;

  validateFirestoreId(bookingId, 'bookingId');
  validateFirestoreId(customerId, 'customerId');
  validateFirestoreId(performerId, 'performerId');

  await firestore.runTransaction(async (transaction) => {
    const bookingDocRef = firestore.collection('bookings').doc(bookingId);
    const performerDocRef = firestore.collection('performers').doc(performerId);
    const [bookingSnap, performerSnap] = await Promise.all([transaction.get(bookingDocRef), transaction.get(performerDocRef)]);

    if (!bookingSnap.exists) throw new Error("Booking not found.");
    if (!performerSnap.exists) throw new Error("Performer profile not found.");
    if (bookingSnap.data()!.performerReviewSubmitted) throw new Error("You have already reviewed this booking.");

    // Action 1: Create the immediate, private review
    const privateReviewRef = firestore.collection(`customers/${customerId}/reviews`).doc();
    transaction.set(privateReviewRef, {
      bookingId, performerId, userId: customerId, rating, comment,
      userName: performerSnap.data()!.name || 'Anonymous Performer',
      userImageUrl: performerSnap.data()!.imageUrl || '',
      date: FieldValue.serverTimestamp(),
    });

    // Action 2: Update the master booking document
    const bookingUpdateData: any = {
      performerReviewSubmitted: true,
      performerRatingOfCustomer: rating,
      performerCommentOnCustomer: comment,
      performerName: performerSnap.data()!.name,
      performerImageUrl: performerSnap.data()!.imageUrl,
      publicReviewsCreated: false,
    };
    
    // --- THIS IS THE CRITICAL FIX ---
    // Ensure completedAt is set, which is needed by the Cloud Function
    if (!bookingSnap.data()!.completedAt) {
      bookingUpdateData.completedAt = FieldValue.serverTimestamp();
    }
    // --- END OF FIX ---
    
    // Set the deadline
    const completionTime = (bookingSnap.data()!.completedAt || Timestamp.now()) as FirebaseFirestore.Timestamp;
    bookingUpdateData.reviewDeadline = new Timestamp(completionTime.seconds + (14 * 24 * 60 * 60), completionTime.nanoseconds);
    
    transaction.update(bookingDocRef, bookingUpdateData);
  });

  return { title: "Review Saved!", description: "Thank you for your feedback!" };
}