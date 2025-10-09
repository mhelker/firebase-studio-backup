import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export async function POST(req: NextRequest) {
  try {
    const { tipAmount, bookingId, currency = "usd" } = await req.json();

    if (!tipAmount || tipAmount < 0.5) {
      return NextResponse.json({ error: "Tip must be at least $0.50." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(tipAmount * 100),
      currency,
      payment_method_types: ["card"],
      metadata: { bookingId },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}