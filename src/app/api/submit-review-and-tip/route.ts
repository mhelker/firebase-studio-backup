import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFirebaseAdminFirestore, FieldValue, Timestamp } from "@/lib/firebase-admin-lazy";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

// Helper: Validate Firestore IDs
function validateFirestoreId(id: string, label: string) {
  if (!id || typeof id !== "string" || id.includes("/")) {
    throw new Error(`Invalid ${label} used in Firestore path: "${id}"`);
  }
}

// ✅ Input schema
const SubmitReviewAndTipInputSchema = z.object({
  bookingId: z.string(),
  performerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  tipAmount: z.number().min(0),
  customerId: z.string(),
  performerStripeAccountId: z.string().optional(),
  tipPaymentIntentId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  let responseMessage = "";
  let responseTitle = "";
  let responseStatus = 200;

  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT)
      throw new Error("Firebase Admin not configured.");

    const firestore = getFirebaseAdminFirestore();
    const body = await req.json();
    const input = SubmitReviewAndTipInputSchema.parse(body);

    const {
      bookingId,
      performerId,
      rating,
      comment,
      tipAmount,
      customerId,
      performerStripeAccountId,
      tipPaymentIntentId: frontendTipPaymentIntentId,
    } = input;

    validateFirestoreId(bookingId, "bookingId");
    validateFirestoreId(performerId, "performerId");
    validateFirestoreId(customerId, "customerId");

    console.log("Input tipAmount:", tipAmount);
    console.log("Performer Stripe ID:", performerStripeAccountId);
    console.log("Frontend PI ID:", frontendTipPaymentIntentId);

    let tipPaymentIntentId: string | null = frontendTipPaymentIntentId || null;

    // --- STRIPE TIP LOGIC ---
    if (tipAmount > 0 && performerStripeAccountId) {
      if (frontendTipPaymentIntentId) {
        console.log(`Frontend already confirmed PI ${frontendTipPaymentIntentId}, skipping creation.`);
      } else {
        console.log("Backend creating PaymentIntent for tip...");

        // ✅ 15% platform fee (if desired)
        const PLATFORM_FEE_PERCENTAGE = 0.15;
        const totalAmountCents = Math.round(tipAmount * 100);
        const applicationFeeAmount = Math.round(totalAmountCents * PLATFORM_FEE_PERCENTAGE);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: totalAmountCents,
          currency: "usd",
          automatic_payment_methods: { enabled: true },
          description: `Tip for booking #${bookingId}`,
          transfer_data: {
            destination: performerStripeAccountId,
          },
          application_fee_amount: applicationFeeAmount, // ✅ platform fee
          metadata: {
            bookingId,
            performerId,
            customerId,
            type: "tip_payment",
          },
        });

        tipPaymentIntentId = paymentIntent.id;
        console.log("Created tip PaymentIntent:", tipPaymentIntentId);

        // Confirm (optional if using automatic confirmation)
        const returnUrl = `${req.nextUrl.origin}/bookings/${bookingId}/review?payment_intent_client_secret=${paymentIntent.client_secret}`;
        await stripe.paymentIntents.confirm(paymentIntent.id, { return_url: returnUrl });

        console.log("Confirmed tip PaymentIntent on backend.");
      }
    } else {
      console.log("Skipping PaymentIntent — no tip or missing Stripe account.");
    }

    // --- FIRESTORE TRANSACTION ---
    await firestore.runTransaction(async (transaction) => {
      const bookingRef = firestore.collection("bookings").doc(bookingId);
      const customerRef = firestore.collection("customers").doc(customerId);

      const [bookingSnap, customerSnap] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(customerRef),
      ]);

      if (!bookingSnap.exists) throw new Error("Booking not found.");
      if (!customerSnap.exists) throw new Error("Customer profile not found.");

      const bookingData = bookingSnap.data();

      if (bookingData.customerReviewedPerformer === true) {
        responseTitle = "Review Already Submitted";
        responseMessage = "You have already reviewed this booking.";
        responseStatus = 400;
        throw new Error("ALREADY_REVIEWED");
      }

      const privateReviewRef = firestore
        .collection(`performers/${performerId}/reviews`)
        .doc();

      transaction.set(privateReviewRef, {
        bookingId,
        performerId,
        customerId,
        rating,
        comment,
        userName: customerSnap.data()?.displayName || "Anonymous",
        userImageUrl: customerSnap.data()?.imageUrl || "",
        date: FieldValue.serverTimestamp(),
      });

      const bookingUpdateData: any = {
        customerReviewedPerformer: true,
        customerReviewSubmitted: true,
        performerRatingByCustomer: rating,
        performerCommentByCustomer: comment,
      };

      if (tipAmount > 0 && tipPaymentIntentId) {
        bookingUpdateData.tipAmount = tipAmount;
        bookingUpdateData.tipPaymentIntentId = tipPaymentIntentId;
      }

      if (bookingData.performerReviewedCustomer === true) {
        bookingUpdateData.status = "completed";
        bookingUpdateData.completedAt = FieldValue.serverTimestamp();
        bookingUpdateData.publicReviewsCreated = true;
      } else {
        bookingUpdateData.publicReviewsCreated = false;
      }

      // Add review deadline if missing or completed
      if (bookingUpdateData.status === "completed") {
        bookingUpdateData.reviewDeadline = new Timestamp(
          Timestamp.now().seconds + 14 * 24 * 60 * 60,
          Timestamp.now().nanoseconds
        );
      } else if (!bookingData.reviewDeadline) {
        const createdAt =
          bookingData.createdAt instanceof Timestamp ? bookingData.createdAt : Timestamp.now();
        bookingUpdateData.reviewDeadline = new Timestamp(
          createdAt.seconds + 14 * 24 * 60 * 60,
          createdAt.nanoseconds
        );
      }

      transaction.update(bookingRef, bookingUpdateData);

      responseTitle = "Review & Tip Saved!";
      responseMessage =
        tipAmount > 0 && tipPaymentIntentId
          ? "Your review and tip have been submitted successfully!"
          : "Your review has been submitted successfully!";
    });

    return NextResponse.json({ title: responseTitle, description: responseMessage }, { status: responseStatus });

  } catch (error: any) {
    console.error("❌ Error in submit-review-and-tip:", error);

    let statusCode = 500;
    let errorMessage = "An internal server error occurred.";
    let errorTitle = "Operation Failed";

    if (error.message === "ALREADY_REVIEWED") {
      statusCode = 400;
      errorTitle = "Review Already Submitted";
      errorMessage = "You have already reviewed this booking.";
    } else if (error.message.includes("Booking not found")) {
      statusCode = 404;
      errorTitle = "Booking Not Found";
      errorMessage = "The booking could not be found.";
    } else if (error.message.includes("Customer profile not found")) {
      statusCode = 404;
      errorTitle = "Customer Not Found";
      errorMessage = "The customer profile could not be found.";
    } else if (error.name === "ZodError") {
      statusCode = 400;
      errorTitle = "Validation Error";
      errorMessage = "Invalid input: " + error.errors.map((e: any) => e.message).join(", ");
    } else if (error.type === "StripeInvalidRequestError") {
      statusCode = 400;
      errorTitle = "Payment Error";
      errorMessage = error.raw?.message || "Stripe payment request failed.";
    }

    return NextResponse.json({ title: errorTitle, description: errorMessage }, { status: statusCode });
  }
}