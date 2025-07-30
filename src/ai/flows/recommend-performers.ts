
'use server';

/**
 * @fileOverview A performer recommendation AI agent.
 *
 * - recommendPerformers - A function that handles the performer recommendation process.
 * - RecommendPerformersInput - The input type for the recommendPerformers function.
 * - RecommendPerformersOutput - The return type for the recommendPerformers function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { searchPerformers } from '@/services/performer-service';
import { Performer } from '@/types';

const getPerformersTool = ai.defineTool(
    {
        name: 'getPerformers',
        description: 'Get a list of available performers based on talent type.',
        inputSchema: z.object({ 
            talentType: z.string().describe('The category of talent to search for, e.g., "Music", "Magic", "Comedy".'),
        }),
        outputSchema: z.array(z.custom<Performer>()),
    },
    async (input) => {
        return await searchPerformers(input.talentType);
    }
);


const RecommendPerformersInputSchema = z.object({
  eventDescription: z
    .string()
    .describe('The description of the event for which performers are needed.'),
  desiredMood: z.string().describe('The desired mood or atmosphere of the event.'),
  budget: z.number().describe('The budget for the performer.'),
  talentType: z.string().describe('The primary type of talent required (e.g., music, magic, comedy). This helps narrow down the initial search.'),
});
export type RecommendPerformersInput = z.infer<typeof RecommendPerformersInputSchema>;

const RecommendedPerformerSchema = z.object({
  id: z.string().describe("The unique ID of the performer from the database."),
  name: z.string().describe('The name of the performer.'),
  talentTypes: z.array(z.string()).describe('An array of talent types the performer specializes in (e.g., ["Guitarist", "Singer", "Painter"]).'),
  description: z.string().describe('A brief description of the performer.'),
  price: z.number().describe('The price for the performance.'),
  availability: z.string().describe('The availability of the performer (e.g., "Weekends", "Evenings after 6 PM").'),
  recommendationReason: z.string().describe('A brief, compelling reason why this performer is recommended for the event.'),
});

const RecommendPerformersOutputSchema = z.array(RecommendedPerformerSchema).describe('A list of recommended performers.');
export type RecommendPerformersOutput = z.infer<typeof RecommendPerformersOutputSchema>;

export async function recommendPerformers(input: RecommendPerformersInput): Promise<RecommendPerformersOutput> {
  return recommendPerformersFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendPerformersPrompt',
  input: {schema: RecommendPerformersInputSchema},
  output: {schema: RecommendPerformersOutputSchema},
  tools: [getPerformersTool],
  prompt: `You are an expert talent agent. Your goal is to recommend the best real performers from our platform for a client's event.

  1. Use the \`getPerformers\` tool to find a list of available performers based on the primary talent type the user is looking for.
  2. From that list, carefully review the client's event details:
     - Event Description: {{{eventDescription}}}
     - Desired Mood: {{{desiredMood}}}
     - Budget: {{{budget}}}
  3. Select up to 3 performers who are the best fit. Your selection should be based on all the provided criteria.
  4. For each performer you select, you MUST include their real \`id\` from the tool's output.
  5. For each performer, write a short, personalized \`recommendationReason\` explaining *why* they are a great choice for this specific event.
  6. The output must be a JSON array of performer objects, matching the provided schema. If no performers are found or none are a good fit, return an empty array.`,
});

const recommendPerformersFlow = ai.defineFlow(
  {
    name: 'recommendPerformersFlow',
    inputSchema: RecommendPerformersInputSchema,
    outputSchema: RecommendPerformersOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output || [];
  }
);

