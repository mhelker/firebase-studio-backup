import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firebase"; // adjust to where you init Firestore

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-08-16",
});

export async function POST(req: Request) {
  const { performerId } = await req.json();
  const snap = await db.collection("performers").doc(performerId).get();
  const accountId = snap.data()?.stripeAccountId;

  if (!accountId) {
    return NextResponse.json(
      { error: "No Stripe account found." },
      { status: 400 }
    );
  }

  const link = await stripe.accounts.createLoginLink(accountId);
  return NextResponse.json({ url: link.url });
}