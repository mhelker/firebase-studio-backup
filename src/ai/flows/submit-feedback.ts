'use server';
/**
 * @fileOverview A flow for saving user feedback to the database.
 *
 * - submitFeedback: Saves a user's feedback text to Firestore.
 * - SubmitFeedbackInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, serverTimestamp, addDoc } from "firebase/firestore"; 
import { db } from '@/lib/firebase';

const SubmitFeedbackInputSchema = z.object({
  feedback: z.string().min(10).max(1000).describe('The user feedback text.'),
});
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>;

export async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
    // The auth check is handled by the Genkit flow's auth policy.
    await submitFeedbackFlow(input);
}

const submitFeedbackFlow = ai.defineFlow(
  {
    name: 'submitFeedbackFlow',
    inputSchema: SubmitFeedbackInputSchema,
    outputSchema: z.void(),
    auth: (auth) => {
      // This policy ensures only authenticated users can trigger this flow.
      if (!auth) {
        throw new Error('You must be logged in to submit feedback.');
      }
    },
  },
  async (input, auth) => {
    if (!auth?.uid) {
        throw new Error('Authentication error: Auth object not found in flow despite policy.');
    }
    
    const feedbackData = {
      feedback: input.feedback,
      submittedAt: serverTimestamp(),
      submittedBy: auth.uid,
      status: 'new', // You could use this later to track feedback status
    };
    await addDoc(collection(db, "feedback"), feedbackData);
  }
);
