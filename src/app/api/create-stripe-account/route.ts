// src/app/api/create-stripe-account/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firebase"; // your Firestore instance

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-08-16",
});

export async function POST(req: Request) {
  const { performerId } = await req.json();

  if (!performerId) {
    return NextResponse.json({ error: "Missing performerId" }, { status: 400 });
  }

  try {
    // 1. Create a Stripe Express test account
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: `${performerId}@example.com`, // optional placeholder
    });

    // 2. Save the Stripe account ID to Firestore
    const performerDocRef = db.collection("performers").doc(performerId);
    await performerDocRef.set({ stripeAccountId: account.id }, { merge: true });

    return NextResponse.json({ stripeAccountId: account.id });
  } catch (err: any) {
    console.error("Error creating Stripe account:", err);
    return NextResponse.json({ error: err.message || "Stripe account creation failed" }, { status: 500 });
  }
}