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

    console.log("Performer Stripe Account ID:", performerStripeAccountId);

    if (!performerStripeAccountId || typeof performerStripeAccountId !== "string") {
      return NextResponse.json({ error: "Performer has no Stripe account connected." }, { status: 400 });
    }

    // --- PLATFORM FEE (still used later when releasing) ---
    const PLATFORM_FEE_PERCENTAGE = 0.15;
    const totalAmountFromCustomer = amount;
    const applicationFeeAmount = Math.round(totalAmountFromCustomer * PLATFORM_FEE_PERCENTAGE * 100);

    // --- CREATE PAYMENT INTENT (HOLD IN PLATFORM) ---
    const idempotencyKey = `${bookingId}_initial_payment`;
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(totalAmountFromCustomer * 100),
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: `Payment for booking #${bookingId}`,
        metadata: {
          bookingId,
          customerId: uid,
          performerId: bookingData.performerId,
          type: "initial_payment",
        },
        // ⚠️ No transfer_data here – funds stay in platform until performer reviews
      },
      { idempotencyKey }
    );

    await bookingRef.update({
      stripePaymentIntentId: paymentIntent.id,
      paymentStatus: "pending_release", // funds held in platform
      platformFee: applicationFeeAmount / 100,
      performerStripeAccountId,

      // 👇 New payout tracking fields
      initialPayoutReleased: false,
      tipPayoutReleased: false,
      payoutReleasedAt: null,
      tipPayoutReleasedAt: null,
    });

    console.log(`✅ PaymentIntent created for booking ${bookingId}: ${paymentIntent.id}`);
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Error creating PaymentIntent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}