// src/lib/payments.ts
import Stripe from "stripe";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin-lazy";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

/**
 * Releases the main performer payout for a booking.
 */
export async function releasePayment(bookingId: string) {
  const firestore = getFirebaseAdminFirestore();
  const bookingRef = firestore.collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();

  if (!bookingSnap.exists) throw new Error("Booking not found.");

  const booking = bookingSnap.data()!;
  if (!booking.performerId || !booking.stripePaymentIntentId) {
    throw new Error("Booking missing performer or Stripe payment info");
  }

  const performerRef = firestore.collection("performers").doc(booking.performerId);
  const performerSnap = await performerRef.get();
  if (!performerSnap.exists) throw new Error("Performer profile not found");

  const performer = performerSnap.data()!;
  if (!performer.stripeAccountId) throw new Error("Performer missing Stripe account ID");

  if (booking.payoutTransferId) {
    // Payout already sent
    return { message: "Payout already released", transferId: booking.payoutTransferId };
  }

  // Create transfer from platform → performer
  const transfer = await stripe.transfers.create({
    amount: Math.round(booking.performerPayout * 100), // payout in cents
    currency: "usd",
    destination: performer.stripeAccountId,
    transfer_group: `booking_${bookingId}`,
  });

  // Save transfer info in Firestore
  await bookingRef.update({
    payoutTransferId: transfer.id,
    payoutTransferredAt: new Date(),
  });

  return transfer;
}