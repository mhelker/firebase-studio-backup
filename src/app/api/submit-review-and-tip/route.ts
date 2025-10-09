// src/app/api/submit-review-and-tip/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFirebaseAdminFirestore, FieldValue, Timestamp } from "@/lib/firebase-admin-lazy";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

function validateFirestoreId(id: string, label: string) {
  if (!id || typeof id !== "string" || id.includes("/")) {
    throw new Error(`Invalid ${label} used in Firestore path: "${id}"`);
  }
}

const SubmitReviewAndTipInputSchema = z.object({
  bookingId: z.string(),
  performerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  tipAmount: z.number().min(0),
  customerId: z.string(),
  performerStripeAccountId: z.string().optional(),
  tipPaymentIntentId: z.string().optional().nullable(), // ✅ NEW: Sent from frontend if confirmed there
});

export async function POST(req: NextRequest) {
  let responseMessage: string;
  let responseTitle: string;
  let responseStatus: number = 200;

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
      tipPaymentIntentId: frontendTipPaymentIntentId, // ✅ Capture the PI ID sent from frontend
    } = input;

    validateFirestoreId(bookingId, "bookingId");
    validateFirestoreId(performerId, "performerId");
    validateFirestoreId(customerId, "customerId");

    console.log("Input tipAmount:", tipAmount);
    console.log("Input performerStripeAccountId:", performerStripeAccountId);
    console.log("Frontend tipPaymentIntentId:", frontendTipPaymentIntentId); // ✅ Log it

    let tipPaymentIntentId: string | null = frontendTipPaymentIntentId || null; // Start with frontend's PI ID

    // Create Tip PaymentIntent if tipAmount > 0 and a performerStripeAccountId is available
    if (tipAmount > 0 && performerStripeAccountId) {
        // If the frontend already confirmed the PI, we don't need to create/confirm again.
        // We trust the frontend's confirmation.
        if (frontendTipPaymentIntentId) {
            console.log(`Frontend already confirmed Payment Intent ${frontendTipPaymentIntentId}. Skipping backend confirmation.`);
            // Optionally, you could retrieve the PI from Stripe to verify its status
            // const pi = await stripe.paymentIntents.retrieve(frontendTipPaymentIntentId);
            // if (pi.status !== 'succeeded') {
            //     throw new Error(`Frontend-confirmed Payment Intent ${frontendTipPaymentIntentId} is not in 'succeeded' state.`);
            // }
        } else {
            // If the frontend didn't confirm (e.g., no redirect needed, or an error happened),
            // then we proceed with creating and confirming here.
            // This is a fallback / for non-redirect methods.
            console.log("Attempting to create Stripe Payment Intent for tip (backend fallback)...");
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(tipAmount * 100),
                currency: "usd",
                automatic_payment_methods: { enabled: true },
                transfer_data: {
                    destination: performerStripeAccountId,
                },
                metadata: {
                    type: "tip",
                    bookingId,
                    customerId,
                    performerId,
                },
            });

            tipPaymentIntentId = paymentIntent.id; // Store the newly created PI ID
            console.log("Stripe Payment Intent created. ID:", tipPaymentIntentId);

            const returnUrl = `${req.nextUrl.origin}/bookings/${bookingId}/review?payment_intent_client_secret=${paymentIntent.client_secret}`;

            await stripe.paymentIntents.confirm(paymentIntent.id, {
                return_url: returnUrl, // ✅ Keep this for backend-initiated confirms
            });
            console.log("Stripe Payment Intent confirmed by backend.");
        }
    } else {
      console.log("Skipping Stripe Payment Intent creation/confirmation. Conditions not met:", {
        tipAmount: tipAmount,
        performerStripeAccountId: performerStripeAccountId,
        frontendTipPaymentIntentId: frontendTipPaymentIntentId // Included for more complete logging
      });
    }

    await firestore.runTransaction(async (transaction) => {
      const bookingDocRef = firestore.collection("bookings").doc(bookingId);
      const customerDocRef = firestore.collection("customers").doc(customerId);

      const [bookingSnap, customerSnap] = await Promise.all([
        transaction.get(bookingDocRef),
        transaction.get(customerDocRef),
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
        userName: customerSnap.data()!.displayName || "Anonymous",
        userImageUrl: customerSnap.data()!.imageUrl || "",
        date: FieldValue.serverTimestamp(),
      });

      const bookingUpdateData: any = {
        customerReviewedPerformer: true,
        customerReviewSubmitted: true, // <--- ADD THIS LINE!
        performerRatingByCustomer: rating,
        performerCommentByCustomer: comment,
      };

      // Ensure tip amount and Payment Intent ID are only added if a tip was processed
      if (tipAmount > 0 && tipPaymentIntentId) { // Use the `tipPaymentIntentId` determined above
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

      if (bookingUpdateData.status === "completed") {
        bookingUpdateData.reviewDeadline = new Timestamp(
          Timestamp.now().seconds + 14 * 24 * 60 * 60,
          Timestamp.now().nanoseconds
        );
      } else if (!bookingData.reviewDeadline) {
        const createdAt = bookingData.createdAt instanceof Timestamp ? bookingData.createdAt : Timestamp.now();
        bookingUpdateData.reviewDeadline = new Timestamp(
          createdAt.seconds + 14 * 24 * 60 * 60,
          createdAt.nanoseconds
        );
      }

      transaction.update(bookingDocRef, bookingUpdateData);

      responseTitle = "Review & Tip Saved!";
      responseMessage = tipAmount > 0 && tipPaymentIntentId // Condition check for tipPaymentIntentId
          ? "Your review and tip have been submitted successfully!"
          : "Your review has been submitted successfully!";
      responseStatus = 200;
    });

    return NextResponse.json(
      {
        title: responseTitle,
        description: responseMessage,
      },
      { status: responseStatus }
    );
  } catch (error: any) {
    console.error("Error in submit-review-and-tip API route:", error);

    let statusCode = 500;
    let errorMessage = "An internal server error occurred.";
    let errorTitle = "Operation Failed";

    if (error.message === "ALREADY_REVIEWED") {
      statusCode = 400;
      errorMessage = "You have already reviewed this booking.";
      errorTitle = "Review Already Submitted";
    } else if (error.message.includes("Booking not found")) {
      statusCode = 404;
      errorMessage = "The booking could not be found.";
      errorTitle = "Booking Not Found";
    } else if (error.message.includes("Customer profile not found")) {
      statusCode = 404;
      errorMessage = "The customer profile could not be found.";
      errorTitle = "Customer Not Found";
    } else if (error.message.includes("Invalid bookingId")) {
      statusCode = 400;
      errorMessage = "The provided booking ID is invalid.";
      errorTitle = "Invalid Input";
    } else if (error.name === "ZodError") {
      statusCode = 400;
      errorMessage = "Invalid input data: " + error.errors.map((e: any) => e.message).join(", ");
      errorTitle = "Validation Error";
    } else if (error.message.includes("Firebase Admin not configured")) {
      statusCode = 500;
      errorMessage = "Server configuration error: Firebase Admin not set up.";
      errorTitle = "Server Config Error";
    } else if (error.type === 'StripeInvalidRequestError') { // ✅ Added for Stripe-specific errors
        statusCode = 400;
        errorMessage = error.raw?.message || "Stripe payment request failed. Please try again.";
        errorTitle = "Payment Error";
    }
    else if (error.message && typeof error.message === 'string' && error.message.length < 200) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        title: errorTitle,
        description: errorMessage,
      },
      { status: statusCode }
    );
  }
}