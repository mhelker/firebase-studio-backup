// src/ai/flows/submit-review.ts
'use server';

import { z } from 'zod';

// We are keeping the input schema to match what the form sends
const SubmitReviewAndTipInputSchema = z.object({
  bookingId: z.string(),
  performerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  tipAmount: z.number().min(0),
  userId: z.string(),
});

// We are keeping the output schema to match what the form expects
const SubmitReviewAndTipOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
});


// This is the function that is called by your form
export async function submitReviewAndTip(input: z.infer<typeof SubmitReviewAndTipInputSchema>): Promise<z.infer<typeof SubmitReviewAndTipOutputSchema>> {
  
  // --- TEMPORARY TEST ---
  // We have removed ALL of the original Firebase database logic.
  // We are just printing the data we received to the Vercel logs.
  console.log("--- TEST: submitReviewAndTip was called successfully ---");
  console.log("Received data:", input);

  // We are returning a simple, fake success message.
  return { title: "TEST SUCCESSFUL", description: "The server function ran without crashing." };
  // --- END OF TEST ---
}


// We will also simplify the second function in this file just in case.
const SubmitPerformerReviewInputSchema = z.object({
  bookingId: z.string(),
  customerId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
  userId: z.string(),
});

export async function submitPerformerReview(input: z.infer<typeof SubmitPerformerReviewInputSchema>): Promise<z.infer<typeof SubmitReviewAndTipOutputSchema>> {
  console.log("--- TEST: submitPerformerReview was called ---");
  return { title: "TEST SUCCESSFUL", description: "The server function ran without crashing." };
}