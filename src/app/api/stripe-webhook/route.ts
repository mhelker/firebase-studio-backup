// app/api/stripe-webhook/route.ts (Next.js App Router)
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db as adminDb } from '@/lib/firebase-admin'; // Adjust path as needed

// --- Environment Variable Loading ---
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`🔴 Critical Error: Environment variable '${name}' is not set.`);
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const STRIPE_SECRET_KEY = getRequiredEnv('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = getRequiredEnv('STRIPE_WEBHOOK_SECRET');
// --- End Environment Variable Loading ---

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export const config = { api: { bodyParser: false } };

export async function POST(req: Request) {
  console.log('--- Webhook Handler Start ---');
  console.log('Value of STRIPE_WEBHOOK_SECRET (from code):', STRIPE_WEBHOOK_SECRET);

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Stripe webhook received without signature.');
      return new NextResponse('No stripe-signature header found', { status: 400 });
    }

    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    console.log('✅ Webhook event constructed successfully!');
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
      console.log(`✅ PaymentIntent succeeded: ${paymentIntentSucceeded.id}`);

      const bookingIdFromMetadata = paymentIntentSucceeded.metadata?.bookingId;
      const typeFromMetadata = paymentIntentSucceeded.metadata?.type;

      if (bookingIdFromMetadata) {
        const bookingRef = adminDb.collection('bookings').doc(bookingIdFromMetadata);
        try {
          const bookingSnap = await bookingRef.get();
          const bookingData = bookingSnap.data() || {};
          const processedPayments: string[] = bookingData.processedPayments || [];

          if (processedPayments.includes(paymentIntentSucceeded.id)) {
            console.log(
              `PaymentIntent ${paymentIntentSucceeded.id} already processed for booking ${bookingIdFromMetadata}`
            );
          } else {
            const updateData: any = { processedPayments: [...processedPayments, paymentIntentSucceeded.id] };

            if (typeFromMetadata === 'booking_payment') {
  const pricePerHour = bookingData.pricePerHour || 0;
  const platformFee = bookingData.platformFee || 0;
  const performerPayout = pricePerHour - platformFee;

  updateData.paymentStatus = 'succeeded';
  updateData.performerPayout = performerPayout;
}
            else if (typeFromMetadata === 'tip_payment') updateData.tipStatus = 'succeeded';

            await bookingRef.update(updateData);
            console.log(`Updated booking ${bookingIdFromMetadata} for PaymentIntent ${paymentIntentSucceeded.id}`);
          }
        } catch (error) {
          console.error(`Error updating booking ${bookingIdFromMetadata}:`, error);
        }
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
      console.error(
        `❌ PaymentIntent failed: ${paymentIntentFailed.id}, Last error: ${paymentIntentFailed.last_payment_error?.message}`
      );

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
    }

    default:
      console.warn(`⚠️ Unhandled event type ${event.type}`);
  }

  return new NextResponse('OK', { status: 200 });
}