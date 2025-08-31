import { NextRequest, NextResponse } from 'next/server';
import { Stripe } from 'stripe';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
// --- THIS IS THE FIX (Part 1) ---
// We import the ADMIN database instance and name it `adminDb` for clarity.
import { adminApp, db as adminDb } from '@/lib/firebase-admin-lazy'; 
import { getAuth } from 'firebase-admin/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const authorization = req.headers.get("Authorization");
    if (authorization?.startsWith("Bearer ")) {
        const idToken = authorization.split("Bearer ")[1];
        try {
            const decodedToken = await getAuth(adminApp).verifyIdToken(idToken);
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

    // --- THIS IS THE FIX (Part 2) ---
    // We now use the `adminDb` for all server-side database operations.
    const performerDocRef = doc(adminDb, 'performers', userId);
    const performerSnap = await getDoc(performerDocRef);

    if (!performerSnap.exists()) {
      return NextResponse.json({ error: 'Performer profile not found' }, { status: 404 });
    }

    const performerData = performerSnap.data();
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
      // This update also uses `adminDb`
      await updateDoc(performerDocRef, { stripeAccountId });
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