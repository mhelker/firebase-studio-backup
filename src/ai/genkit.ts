// src/ai/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
  ],
  // We will use a model that is known to be stable
  model: 'gemini-1.0-pro', 
  logSinks: [],
  enableTracingAndMetrics: true,
});