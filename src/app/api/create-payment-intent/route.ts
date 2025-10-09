// app/api/create-payment-intent/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
// --- IMPORTANT CHANGE: Import 'db' from firebase-admin.ts ---
import { db as adminDb } from '@/lib/firebase-admin'; // Alias it to adminDb for clarity
// --- And if you're doing server-side auth, import adminAuth ---
import { auth as adminAuth } from '@/lib/firebase-admin';

// No need for 'doc' and 'updateDoc' from 'firebase/firestore' anymore
// The methods are directly available on the adminDb instance.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  console.log('Stripe Secret Key present:', !!process.env.STRIPE_SECRET_KEY);

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'your_stripe_secret_key_here') {
    console.warn("Stripe keys not found. Running create-payment-intent in demo mode.");
    // Changed status to 400 as it's a configuration issue on the server, not necessarily an internal server error
    return NextResponse.json({ error: 'Stripe is not configured on the server. Please set STRIPE_SECRET_KEY.' }, { status: 400 });
  }

  try {
    const { amount, bookingId } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount provided.' }, { status: 400 });
    }
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
    }

    // --- Server-side Authorization (Highly Recommended) ---
    // Get the ID token from the Authorization header
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided in Authorization header.' }, { status: 401 });
    }
    const idToken = authorization.split(' ')[1];

    let uid: string;
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (error) {
      console.error('Error verifying ID token in API:', error);
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired authentication token.' }, { status: 401 });
    }

    // Fetch the booking using the Admin SDK's Firestore instance to verify ownership
    const bookingRef = adminDb.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const bookingData = bookingSnap.data() as { customerId: string; pricePerHour: number };

    // Verify that the user making the request is the customer for this booking
    if (bookingData.customerId !== uid) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to pay for this booking.' }, { status: 403 });
    }

    // Optional: Re-verify amount (the client should send the correct booking ID, and the backend should get the amount from the DB)
    // If you always want to use the DB's amount:
    // const amountInCents = Math.round(bookingData.pricePerHour * 100);
    // If you trust the client to send the correct amount for now:
    const amountInCents = Math.round(amount * 100);


    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: `Payment for booking #${bookingId}`,
      metadata: { bookingId, customerId: uid, type: 'booking_payment' }, // Add customerId to metadata
    });

    // Save PaymentIntent ID to Firestore booking document using Admin SDK Firestore
    // This `updateDoc` call now uses the `adminDb` instance, bypassing security rules.
    await bookingRef.update({ // Use bookingRef which is already from adminDb
      stripePaymentIntentId: paymentIntent.id,
      // You might also want to update the status to 'payment_pending' or similar here
      // status: 'payment_pending',
    });

    console.log(`✅ PaymentIntent created for booking ${bookingId}: ${paymentIntent.id}`);

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Error creating PaymentIntent:', error);
    // Be more specific with error messages to avoid leaking sensitive info
    const errorMessage = error.message || 'An unexpected error occurred while processing payment.';
    return NextResponse.json({ error: `Error creating PaymentIntent: ${errorMessage}` }, { status: 500 });
  }
}