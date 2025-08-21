// src/app/api/recommend-performers/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import { z } from 'zod';
import { searchPerformers } from '@/services/performer-service';

const RecommendPerformersInputSchema = z.object({
  eventDescription: z.string(),
  desiredMood: z.string(),
  budget: z.number(),
  talentType: z.string(),
});

const AiRecommendedPerformerSchema = z.object({
  id: z.string(),
  name: z.string(),
  talentTypes: z.array(z.string()),
  description: z.string(),
  price: z.number(),
  availability: z.string(),
  recommendationReason: z.string(),
});

const RecommendPerformersOutputSchema = z.array(AiRecommendedPerformerSchema);
export type RecommendPerformersOutput = z.infer<typeof RecommendPerformersOutputSchema>;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedInput = RecommendPerformersInputSchema.parse(body);

    const searchCriteria: { talentType?: string } = {};
    if (validatedInput.talentType && validatedInput.talentType.toLowerCase() !== 'any' && validatedInput.talentType.toLowerCase() !== 'all') {
      searchCriteria.talentType = validatedInput.talentType;
    }
    const availablePerformers = await searchPerformers(searchCriteria);
    if (availablePerformers.length === 0) {
      return NextResponse.json([]);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    
    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
    };
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest", generationConfig });

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
    const responseText = result.response.text();
    const parsedOutput = JSON.parse(responseText);
    
    const finalResult = RecommendPerformersOutputSchema.parse(parsedOutput);
    return NextResponse.json(finalResult);

  } catch (error: any) {
    console.error("Error in recommendPerformers API route:", error);
    return NextResponse.json(
      { message: "The AI agent failed to generate recommendations." },
      { status: 500 }
    );
  }
}