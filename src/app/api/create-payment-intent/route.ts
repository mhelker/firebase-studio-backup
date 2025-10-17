// app/api/create-payment-intent/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db as adminDb } from "@/lib/firebase-admin";
import { auth as adminAuth } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: Request) {
  try {
    const { amount, bookingId } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount provided." }, { status: 400 });
    }

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID is required." }, { status: 400 });
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: No token provided." }, { status: 401 });
    }

    const idToken = authorization.split(" ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // ✅ Fetch booking and performer data
    const bookingRef = adminDb.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const bookingData = bookingSnap.data() as {
      customerId: string;
      pricePerHour: number;
      performerId: string;
    };

    if (bookingData.customerId !== uid) {
      return NextResponse.json({ error: "Forbidden: You are not the customer for this booking." }, { status: 403 });
    }

    const performerDoc = await adminDb.collection("performers").doc(bookingData.performerId).get();
const performerStripeAccountId = performerDoc.data()?.stripeAccountId;

// Debug log
console.log("Performer Stripe Account ID:", performerStripeAccountId);

// ✅ Check if performer has a Stripe account
if (!performerStripeAccountId || typeof performerStripeAccountId !== "string") {
  return NextResponse.json({ error: "Performer has no Stripe account connected." }, { status: 400 });
}

    // --- START OF CRITICAL CHANGES FOR PLATFORM FEE ---
    const PLATFORM_FEE_PERCENTAGE = 0.15; // 15% platform fee
    const totalAmountFromCustomer = amount; // The `amount` received in the request is the customer's total
    const applicationFeeAmount = Math.round(totalAmountFromCustomer * PLATFORM_FEE_PERCENTAGE * 100); // Calculate fee in cents

    // The amount transferred to the performer (destination)
    const amountToPerformerInCents = Math.round((totalAmountFromCustomer - (totalAmountFromCustomer * PLATFORM_FEE_PERCENTAGE)) * 100);

    // Ensure amountToPerformerInCents is not negative or zero
    if (amountToPerformerInCents <= 0) {
      return NextResponse.json({ error: "Calculated amount to transfer to performer is zero or negative after fee." }, { status: 400 });
    }

    // --- END OF CRITICAL CHANGES ---

    // --- CRITICAL ADDITION: Idempotency Key ---
    const idempotencyKey = `${bookingId}_initial_payment`; // Generate a unique key for this booking's initial payment
    // --- END CRITICAL ADDITION ---

    // ✅ Create PaymentIntent as a destination charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmountFromCustomer * 100), // Total amount customer pays (THIS IS THE CORRECT LINE)
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `Payment for booking #${bookingId}`,
      metadata: {
        bookingId,
        customerId: uid,
        performerId: bookingData.performerId,
        type: "booking_payment",
      },
      transfer_data: {
        destination: performerStripeAccountId,
        // When using application_fee_amount, Stripe automatically transfers
        // (total_amount - application_fee_amount) to the destination.
        // So we don't need a separate `transfer_data.amount` if application_fee_amount is used.
      },
      application_fee_amount: applicationFeeAmount, // Set the calculated fee here!
    }, {
      idempotencyKey: idempotencyKey,
    });

    await bookingRef.update({
      stripePaymentIntentId: paymentIntent.id,
      paymentStatus: "payment_pending", // This will be updated later by webhook/confirmation
    });

    console.log(`✅ PaymentIntent created for booking ${bookingId}: ${paymentIntent.id}`);
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Error creating PaymentIntent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}