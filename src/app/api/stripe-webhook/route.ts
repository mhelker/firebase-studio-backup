// app/api/stripe-webhook/route.ts (Next.js App Router)
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db as adminDb } from '@/lib/firebase-admin'; // Adjust path as needed

// --- Start: Robust Environment Variable Loading ---
// Helper function to safely get and validate environment variables
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Log and throw an error if the variable is missing
    console.error(`🔴 Critical Error: Environment variable '${name}' is not set.`);
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

// Load and validate the Stripe API key and Webhook Secret once at startup
const STRIPE_SECRET_KEY = getRequiredEnv('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = getRequiredEnv('STRIPE_WEBHOOK_SECRET');
// --- End: Robust Environment Variable Loading ---

const stripe = new Stripe(STRIPE_SECRET_KEY, { // No '!' needed here
  apiVersion: "2024-06-20",
});

// IMPORTANT: This config is necessary for Next.js to not parse the body,
// allowing us to get the raw body for Stripe signature verification.
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: Request) {
  // --- Start Added Logging for Debugging ---
  console.log("--- Webhook Handler Start ---");
  // Now logging the validated variable, not directly process.env
  console.log("Value of STRIPE_WEBHOOK_SECRET (from code):", STRIPE_WEBHOOK_SECRET);
  console.log("--- ---");
  // --- End Added Logging for Debugging ---

  let event: Stripe.Event;

  try {
    const rawBody = await req.text(); // Next.js Request object provides .text()
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Stripe webhook received without signature.');
      return new NextResponse('No stripe-signature header found', { status: 400 });
    }

    // --- CRITICAL FIX HERE ---
    // Use the validated STRIPE_WEBHOOK_SECRET variable
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET); // No '!' needed here
    console.log("✅ Webhook event constructed successfully!"); // Add a success log
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`); // More descriptive error
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
      console.log(`✅ PaymentIntent succeeded: ${paymentIntentSucceeded.id}`);

      const bookingIdFromMetadata = paymentIntentSucceeded.metadata?.bookingId;
      const typeFromMetadata = paymentIntentSucceeded.metadata?.type;

      if (bookingIdFromMetadata) {
        const bookingRef = adminDb.collection('bookings').doc(bookingIdFromMetadata);
        try {
            if (typeFromMetadata === 'booking_payment') {
                await bookingRef.update({
                    paymentStatus: 'succeeded',
                });
                console.log(`Updated booking ${bookingIdFromMetadata} paymentStatus to succeeded.`);
            } else if (typeFromMetadata === 'tip_payment') {
                await bookingRef.update({
                    tipStatus: 'succeeded',
                });
                console.log(`Updated booking ${bookingIdFromMetadata} tipStatus to succeeded.`);
            }
        } catch (error) {
            console.error(`Error updating booking ${bookingIdFromMetadata} after PaymentIntent succeeded:`, error);
        }
      }
      break;
    case 'payment_intent.payment_failed':
      const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
      console.error(`❌ PaymentIntent failed: ${paymentIntentFailed.id}, Last error: ${paymentIntentFailed.last_payment_error?.message}`);

      const failedBookingId = paymentIntentFailed.metadata?.bookingId;
      const failedType = paymentIntentFailed.metadata?.type;

      if (failedBookingId) {
        const bookingRef = adminDb.collection('bookings').doc(failedBookingId);
        try {
            if (failedType === 'booking_payment') {
                await bookingRef.update({
                    paymentStatus: 'failed',
                    paymentErrorMessage: paymentIntentFailed.last_payment_error?.message || 'Payment failed',
                });
            } else if (failedType === 'tip_payment') {
                 await bookingRef.update({
                    tipStatus: 'failed',
                    tipErrorMessage: paymentIntentFailed.last_payment_error?.message || 'Tip payment failed',
                });
            }
        } catch (error) {
            console.error(`Error updating booking ${failedBookingId} after PaymentIntent failed:`, error);
        }
      }
      break;
    // ... handle other event types as needed
    default:
      console.warn(`⚠️ Unhandled event type ${event.type}`); // More descriptive warning
  }

  // Return a 200 response to acknowledge receipt of the event
  return new NextResponse('OK', { status: 200 });
}