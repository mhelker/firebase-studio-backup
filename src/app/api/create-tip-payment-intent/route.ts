import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db as adminDb } from "@/lib/firebase-admin";
import { auth as adminAuth } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: Request) {
  try {
    const { tipAmount, bookingId, currency = "usd" } = await request.json();

    if (!tipAmount || tipAmount < 0.5) {
      return NextResponse.json({ error: "Tip must be at least $0.50." }, { status: 400 });
    }

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID is required." }, { status: 400 });
    }

    // ✅ Verify user identity
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: No token provided." }, { status: 401 });
    }
    const idToken = authorization.split(" ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // ✅ Fetch booking
    const bookingRef = adminDb.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const bookingData = bookingSnap.data() as {
      customerId: string;
      performerId: string;
    };

    if (bookingData.customerId !== uid) {
      return NextResponse.json({ error: "Forbidden: You are not the customer for this booking." }, { status: 403 });
    }

    // ✅ Get performer’s Stripe account
const performerDoc = await adminDb.collection("performers").doc(bookingData.performerId).get();
const performerStripeAccountId = performerDoc.data()?.stripeAccountId;

// ✅ Check if performer has a Stripe account
if (!performerStripeAccountId || typeof performerStripeAccountId !== "string") {
  return NextResponse.json({ error: "Performer has no Stripe account connected." }, { status: 400 });
}

    const amountInCents = Math.round(tipAmount * 100);

    // ✅ Create destination charge for the tip
    const tipIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      description: `Tip for booking #${bookingId}`,
      metadata: {
        bookingId,
        performerId: bookingData.performerId,
        customerId: uid,
        type: "tip_payment",
      },
      transfer_data: {
        destination: performerStripeAccountId,
      },
      application_fee_amount: 0, // adjust if you want to keep a small platform cut
    });

    await bookingRef.update({
      tipPaymentIntentId: tipIntent.id,
      tipStatus: "pending",
    });

    console.log(`💸 Tip PaymentIntent created for booking ${bookingId}: ${tipIntent.id}`);

    return NextResponse.json({ clientSecret: tipIntent.client_secret });
  } catch (error: any) {
    console.error("Error creating Tip PaymentIntent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}