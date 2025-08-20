// src/ai/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { firebase } from '@genkit-ai/firebase'; // Ensure firebase plugin is included
import { configureOpenTelemetry } from '@genkit-ai/google-cloud'; // Import the telemetry configurator

export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
    firebase(), // Including the firebase plugin for consistency with your app's dependencies
  ],

  // --- THIS IS THE DEFINITIVE FIX ---
  // This block overrides Genkit's automatic production telemetry configuration.
  telemetry: configureOpenTelemetry({
    // This forces Genkit to use the simple console logger for traces,
    // preventing it from loading the complex exporters that cause the crash.
    forceDevLogger: true,
  }),

  model: 'gemini-1.0-pro',
  logSinks: [],
  enableTracingAndMetrics: true,
});