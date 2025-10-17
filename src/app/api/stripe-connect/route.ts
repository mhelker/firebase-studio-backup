// src/app/api/stripe-connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Stripe } from 'stripe';
// Changed import to match the new exports from firebase-admin-lazy.ts
import { adminApp, adminDb, adminAuth } from '@/lib/firebase-admin-lazy';
// No longer need these specific getAuth/getFirestore imports if adminAuth/adminDb are exported directly
// import { getAuth } from 'firebase-admin/auth';
// import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authorization = req.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    const idToken = authorization.split("Bearer ")[1];
    try {
      // Use the directly imported adminAuth
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      return decodedToken.uid;
    } catch (error) {
      console.error("Error verifying auth token:", error);
      return null;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the directly imported adminDb
    const performerDocRef = adminDb.collection('performers').doc(userId);
    const performerSnap = await performerDocRef.get();

    if (!performerSnap.exists) {
      return NextResponse.json({ error: 'Performer profile not found' }, { status: 404 });
    }

    const performerData = performerSnap.data()!;
    let stripeAccountId = performerData.stripeAccountId;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: performerData.contactEmail,
        business_type: 'individual',
        individual: {
          email: performerData.contactEmail,
        },
      });
      stripeAccountId = account.id;
      await performerDocRef.update({ stripeAccountId });
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${req.nextUrl.origin}/profile/edit`,
      return_url: `${req.nextUrl.origin}/profile?stripe_return=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });

  } catch (error: any) {
    console.error('Error creating Stripe Connect link:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
