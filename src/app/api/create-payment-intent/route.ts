import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  // Demo mode check for Stripe keys
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'your_stripe_secret_key_here') {
    console.warn("Stripe keys not found. Running create-payment-intent in demo mode.");
    // In a real app, you might want more robust handling, but for demo, we can simulate success.
    // However, the client-side will prevent real payment attempts.
    // For the purpose of getting a client secret, we'll return an error if not configured.
    return NextResponse.json({ error: 'Stripe is not configured on the server.' }, { status: 500 });
  }

  try {
    const { amount, bookingId } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount provided.' }, { status: 400 });
    }
    if (!bookingId) {
        return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Amount in cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      description: `Payment for booking #${bookingId}`,
      metadata: {
        bookingId,
        type: 'booking_payment'
      }
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Error creating PaymentIntent:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
