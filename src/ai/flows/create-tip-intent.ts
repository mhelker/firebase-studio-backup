
'use server';

import { z } from 'zod';
import Stripe from 'stripe';

const CreateTipIntentInputSchema = z.object({
  bookingId: z.string().describe("The ID of the booking this tip is for."),
  tipAmount: z.number().positive().describe("The amount of the tip in dollars."),
});

const CreateTipIntentOutputSchema = z.object({
  clientSecret: z.string().describe("The client secret for the Stripe Payment Intent."),
});

/**
 * Creates a Stripe Payment Intent for a tip on a given booking.
 * Throws an error if Stripe is not configured or creation fails.
 */
export async function createTipIntent(
  input: z.infer<typeof CreateTipIntentInputSchema>
): Promise<z.infer<typeof CreateTipIntentOutputSchema>> {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'your_stripe_secret_key_here') {
    throw new Error("Stripe secret key is not configured.");
  }

  const { bookingId, tipAmount } = CreateTipIntentInputSchema.parse(input);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(tipAmount * 100), // convert dollars to cents
      currency: 'usd',
      description: `Tip for booking ${bookingId}`,
      metadata: {
        bookingId,
        type: 'tip',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Failed to create a valid payment intent from Stripe.');
    }

    return { clientSecret: paymentIntent.client_secret };
  } catch (error: any) {
    console.error('Error creating PaymentIntent for tip:', error);
    throw new Error(error.message || 'An error occurred while creating the payment intent.');
  }
}