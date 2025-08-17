'use server';

import { submitSuggestion, commentOnSuggestion } from '@/ai/flows/suggestion-flows';

export async function submitSuggestionAction(input: { suggestion: string }) {
  await submitSuggestion(input);
}

export async function commentOnSuggestionAction(input: { suggestionId: string; comment: string }) {
  await commentOnSuggestion(input);
}