// src/app/api/stripe-login-link/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firebase-admin"; // import db (admin SDK)

// DO NOT initialize Stripe here at the top level

export async function POST(req: Request) {
  // Get the secret key from environment variables
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY environment variable is not set.");
    return NextResponse.json(
      { error: "Server configuration error: Stripe secret key missing." },
      { status: 500 }
    );
  }

  // Initialize Stripe INSIDE the function
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-08-16", // use your valid Stripe API version
  });

  try {
    const { performerId } = await req.json();
    if (!performerId)
      return NextResponse.json({ error: "Missing performerId" }, { status: 400 });

    // Get performer from Firestore
    const performerRef = db.collection("performers").doc(performerId);
    const snap = await performerRef.get();
    if (!snap.exists)
      return NextResponse.json({ error: "Performer not found" }, { status: 404 });

    const performerData = snap.data();
    let accountId = performerData?.stripeAccountId;
    const email = performerData?.contactEmail;

    if (!accountId) {
      if (!email) {
        return NextResponse.json({
          error: "Performer email not found, cannot create Stripe account.",
        }, { status: 400 });
      }

      // Create new Stripe Express account
      const stripeAccount = await stripe.accounts.create({
        type: "express",
        country: "US",
        email,
      });

      accountId = stripeAccount.id;
      await performerRef.update({ stripeAccountId: accountId });
    }

    // Retrieve account to check onboarding status
    const account = await stripe.accounts.retrieve(accountId);

    if (!account.charges_enabled) {
      // Onboarding not complete: create onboarding link
      const onboardingLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: "https://your-app.com/profile",
        return_url: "https://your-app.com/profile",
        type: "account_onboarding",
      });
      return NextResponse.json({ url: onboardingLink.url });
    }

    // Onboarding complete: create login link
    const link = await stripe.accounts.createLoginLink(accountId);
    return NextResponse.json({ url: link.url });

  } catch (err: any) {
    console.error("Stripe login link error:", err);
    return NextResponse.json({ error: err.message || "Failed to create login link" }, { status: 500 });
  }
}