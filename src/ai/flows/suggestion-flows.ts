
'use server';
/**
 * @fileOverview Flows for handling the public suggestions feature.
 *
 * - submitSuggestion: Saves a new user suggestion to Firestore.
 * - commentOnSuggestion: Saves a comment on an existing suggestion.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, serverTimestamp, addDoc, doc, updateDoc } from "firebase/firestore"; 
import { db } from '@/lib/firebase';
import { isAdmin } from '@/lib/admin-config';

const SubmitSuggestionInputSchema = z.object({
  suggestion: z.string().describe('The user suggestion text.'),
});
export type SubmitSuggestionInput = z.infer<typeof SubmitSuggestionInputSchema>;

export async function submitSuggestion(input: SubmitSuggestionInput): Promise<void> {
    // The auth check is handled by the Genkit flow's auth policy.
    await submitSuggestionFlow(input);
}

const submitSuggestionFlow = ai.defineFlow(
  {
    name: 'submitSuggestionFlow',
    inputSchema: SubmitSuggestionInputSchema,
    outputSchema: z.void(),
    auth: (auth) => {
      // This policy ensures only authenticated users can trigger this flow.
      if (!auth) {
        throw new Error('You must be logged in to make a suggestion.');
      }
    },
  },
  async (input, auth) => {
    if (!auth?.uid) {
        throw new Error('Authentication error: Auth object not found in flow despite policy.');
    }

    const suggestionData = {
      suggestion: input.suggestion,
      comment: '',
      status: 'new',
      createdAt: serverTimestamp(),
      commentedAt: null,
      suggestedBy: auth.uid,
    };
    await addDoc(collection(db, "suggestions"), suggestionData);
  }
);


const CommentOnSuggestionInputSchema = z.object({
    suggestionId: z.string().describe("The ID of the suggestion document to comment on."),
    comment: z.string().describe("The comment text."),
});
export type CommentOnSuggestionInput = z.infer<typeof CommentOnSuggestionInputSchema>;

export async function commentOnSuggestion(input: CommentOnSuggestionInput): Promise<void> {
    // Auth is handled by the flow's auth policy.
    await commentOnSuggestionFlow(input);
}

const commentOnSuggestionFlow = ai.defineFlow(
    {
        name: 'commentOnSuggestionFlow',
        inputSchema: CommentOnSuggestionInputSchema,
        outputSchema: z.void(),
        auth: (auth) => {
            if (!auth || !isAdmin(auth.uid)) {
                throw new Error('You do not have permission to perform this action.');
            }
        },
    },
    async (input) => {
        const suggestionDocRef = doc(db, "suggestions", input.suggestionId);
        await updateDoc(suggestionDocRef, {
            comment: input.comment,
            status: 'commented',
            commentedAt: serverTimestamp(),
        });
    }
);
