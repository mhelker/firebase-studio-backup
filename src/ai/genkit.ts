import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { firebaseConfig, db } from '@/lib/firebase';

export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
  ],
  model: 'googleai/gemini-pro',
  enableTracingAndMetrics: true,
});
