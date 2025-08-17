'use server';

import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai'; // Import GenerationConfig
import { z } from 'zod';
import { searchPerformers } from '@/services/performer-service';
import type { Performer } from '@/types';

// Zod schemas remain the same
const RecommendPerformersInputSchema = z.object({
  eventDescription: z.string(), desiredMood: z.string(),
  budget: z.number(), talentType: z.string(),
});
export type RecommendPerformersInput = z.infer<typeof RecommendPerformersInputSchema>;
const AiRecommendedPerformerSchema = z.object({
  id: z.string(), name: z.string(), talentTypes: z.array(z.string()),
  description: z.string(), price: z.number(), availability: z.string(),
  recommendationReason: z.string(),
});
const RecommendPerformersOutputSchema = z.array(AiRecommendedPerformerSchema);
export type RecommendPerformersOutput = z.infer<typeof RecommendPerformersOutputSchema>;

export async function recommendPerformers(input: RecommendPerformersInput): Promise<RecommendPerformersOutput> {
  try {
    const validatedInput = RecommendPerformersInputSchema.parse(input);

    const searchCriteria: { talentType?: string } = {};
    if (validatedInput.talentType && validatedInput.talentType.toLowerCase() !== 'any' && validatedInput.talentType.toLowerCase() !== 'all') {
      searchCriteria.talentType = validatedInput.talentType;
    }
    const availablePerformers = await searchPerformers(searchCriteria);
    if (availablePerformers.length === 0) return [];

    // --- FINAL ATTEMPT: More robust initialization ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    
    // Explicitly define generation config to ensure JSON output
    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
    };
    
    // Use the latest, most powerful model available.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest", generationConfig });
    // --- END OF FINAL ATTEMPT ---

    const prompt = `Based on the following list of available performers and the client's event details, recommend up to 3 performers.
    
    AVAILABLE PERFORMERS (JSON):
    ${JSON.stringify(availablePerformers)}

    CLIENT EVENT DETAILS:
    - Event Description: ${validatedInput.eventDescription}
    - Desired Mood: ${validatedInput.desiredMood}
    - Budget: ${validatedInput.budget}

    Your task is to return a JSON array of the best-fit performers. For each performer, you MUST include their real 'id' from the list and write a short, personalized 'recommendationReason'.
    Your output MUST be ONLY the valid JSON array and nothing else.
    If none are a good fit, return an empty array [].`;

    const result = await model.generateContent(prompt);
    // When using JSON output mode, we parse directly from response.text()
    const responseText = result.response.text();
    const parsedOutput = JSON.parse(responseText);
    
    return RecommendPerformersOutputSchema.parse(parsedOutput);

  } catch (error) {
    console.error("Error in recommendPerformers flow:", error);
    throw new Error("The AI agent failed to generate recommendations.");
  }
}