// /api/createTipIntent/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin-lazy"; // Firestore admin

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, performerStripeAccountId, bookingId, customerId } = body;

    if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    if (!performerStripeAccountId) return NextResponse.json({ error: "Missing performerStripeAccountId" }, { status: 400 });
    if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

    const firestore = getFirebaseAdminFirestore();
    const bookingRef = firestore.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    // 1️⃣ Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      payment_method_types: ["card"],
      transfer_data: {
        destination: performerStripeAccountId,
      },
      metadata: { type: "tip", bookingId, customerId, performerId: performerStripeAccountId },
    });

    // 2️⃣ Confirm immediately
    await stripe.paymentIntents.confirm(paymentIntent.id);

    // 3️⃣ Save tipPaymentIntentId in Firestore
    await bookingRef.update({
      tipPaymentIntentId: paymentIntent.id,
      tipAmount: amount,
    });

    return NextResponse.json({ success: true, tipPaymentIntentId: paymentIntent.id });
  } catch (error: any) {
    console.error("Error creating Tip PaymentIntent:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}