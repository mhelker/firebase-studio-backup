import { NextRequest, NextResponse } from 'next/server';
import { Stripe } from 'stripe';
// IMPORTANT: Remove these client-side Firestore imports!
// import { doc, getDoc, updateDoc } from 'firebase/firestore'; 

import { db as adminDb, adminApp } from '@/lib/firebase-admin-lazy'; 
import { getAuth } from 'firebase-admin/auth';

// Assuming your Stripe initialization and getUserIdFromRequest function are defined elsewhere or correctly within this file.
// For example:
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16',
});

// This is a placeholder; implement your actual user ID retrieval logic
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  // Example: Extract from a custom header, a cookie, or a session token
  // For a simple test, you might hardcode or parse from a query param if secure
  // In a real app, this would likely involve verifying an auth token
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await getAuth(adminApp).verifyIdToken(idToken);
      return decodedToken.uid;
    }
  } catch (error) {
    console.error("Error verifying auth token:", error);
  }
  return null;
}


export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req); 

    if (!userId) {
      // This matches the "Unauthorized" error you sometimes saw in dev
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- THIS IS THE CRUCIAL CHANGE ---
    // Use the Firebase Admin SDK's way to get a DocumentReference
    const performerDocRef = adminDb.collection('performers').doc(userId); 
    const performerSnap = await performerDocRef.get(); // Use .get() method on the DocumentReference

    let stripeAccountId: string | undefined;

    if (performerSnap.exists) {
      const performerData = performerSnap.data();
      stripeAccountId = performerData?.stripeAccountId;
    }

    if (!stripeAccountId) {
      // Handle case where Stripe account ID doesn't exist yet,
      // e.g., create a new Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'express', // Or 'standard', depending on your needs
        country: 'US', // Or other relevant country
        email: 'user@example.com', // You'll need to fetch the user's email
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;

      // Save the new Stripe Account ID to Firestore
      await performerDocRef.set({ stripeAccountId }, { merge: true });
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${req.nextUrl.origin}/profile/edit`, // URL if onboarding fails or expires
      return_url: `${req.nextUrl.origin}/profile/edit?stripe_onboarding_success=true`, // URL after successful onboarding
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });

  } catch (error: any) {
    console.error("Error creating Stripe Connect link:", error);
    // Return a more generic error message to the client
    return NextResponse.json(
      { error: error.message || "Failed to create Stripe onboarding link." },
      { status: 500 }
    );
  }
}