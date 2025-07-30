
'use server';
/**
 * @fileOverview A server action for creating a Stripe Payment Intent for tips.
 *
 * - createTipIntent - A function that creates a payment intent for a tip.
 */

import { z } from 'zod';
import Stripe from 'stripe';

// IMPORTANT: Do not export Zod schemas from server-action files.
const CreateTipIntentInputSchema = z.object({
  bookingId: z.string().describe("The ID of the booking this tip is for."),
  tipAmount: z.number().positive().describe("The amount of the tip in dollars."),
});

const CreateTipIntentOutputSchema = z.object({
  clientSecret: z.string().nullable().describe("The client secret for the Stripe Payment Intent, or null if in demo mode."),
  isDemoMode: z.boolean().describe("Indicates if Stripe is in demo mode due to missing keys.")
});


/**
 * Creates a Stripe Payment Intent for a tip on a given booking.
 * This is a standard server action, not an AI flow.
 * If Stripe keys are not configured, it returns a demo mode response.
 * @param input An object containing the booking ID and the tip amount.
 * @returns An object containing the client secret (or null) and a demo mode flag.
 */
export async function createTipIntent(input: z.infer<typeof CreateTipIntentInputSchema>): Promise<z.infer<typeof CreateTipIntentOutputSchema>> {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'your_stripe_secret_key_here') {
    console.warn("Stripe keys not found. Running createTipIntent in demo mode.");
    return { clientSecret: null, isDemoMode: true };
  }
  
  const { bookingId, tipAmount } = CreateTipIntentInputSchema.parse(input);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(tipAmount * 100), // Amount in cents
      currency: 'usd',
      description: `Tip for booking ${bookingId}`,
      metadata: {
        bookingId: bookingId,
        type: 'tip'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Failed to create a valid payment intent from Stripe.');
    }

    return { clientSecret: paymentIntent.client_secret, isDemoMode: false };
  } catch (error: any) {
    console.error('Error creating PaymentIntent for tip:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    throw new Error(`An unexpected error occurred while processing the tip: ${errorMessage}`);
  }
}
