'use server';

import { submitFeedback, SubmitFeedbackInput } from '@/ai/flows/submit-feedback';

export async function submitFeedbackAction(input: SubmitFeedbackInput) {
  await submitFeedback(input);
}