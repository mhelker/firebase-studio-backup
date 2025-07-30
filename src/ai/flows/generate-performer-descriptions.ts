'use server';
/**
 * @fileOverview An AI flow for generating performer profile descriptions.
 *
 * - generatePerformerDescriptions - A function that generates descriptions based on name and talent types.
 * - GeneratePerformerDescriptionsInput - The input type for the function.
 * - GeneratePerformerDescriptionsOutput - The output type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GeneratePerformerDescriptionsInputSchema = z.object({
  name: z.string().describe('The name or stage name of the performer.'),
  talentTypes: z.array(z.string()).describe('A list of talent types for the performer, e.g., ["Magician", "Comedian"].'),
});
export type GeneratePerformerDescriptionsInput = z.infer<typeof GeneratePerformerDescriptionsInputSchema>;

const GeneratePerformerDescriptionsOutputSchema = z.object({
  shortDescription: z.string().describe("A brief, catchy description of what the performer does, suitable for a profile card."),
  longDescription: z.string().describe("A more detailed description for the performer's main profile page, highlighting their skills and what makes their performance special.")
});
export type GeneratePerformerDescriptionsOutput = z.infer<typeof GeneratePerformerDescriptionsOutputSchema>;

export async function generatePerformerDescriptions(input: GeneratePerformerDescriptionsInput): Promise<GeneratePerformerDescriptionsOutput> {
    const result = await generatePerformerDescriptionsFlow(input);
    if (!result) {
        throw new Error("Description generation failed to return a result.");
    }
    return result;
}

const prompt = ai.definePrompt({
    name: 'generatePerformerDescriptionsPrompt',
    input: { schema: GeneratePerformerDescriptionsInputSchema },
    output: { schema: GeneratePerformerDescriptionsOutputSchema },
    prompt: `You are an expert copywriter specializing in creating engaging profiles for performers. Your task is to generate two descriptions for a performer based on their name and talent types.

- The \`shortDescription\` should be a catchy, single sentence (around 10-20 words) perfect for a profile card.
- The \`longDescription\` should be a more detailed paragraph (around 50-70 words) for their main profile page. It should be written in a warm and inviting tone, highlighting their skills and what makes them special for an event.

Performer Name: {{{name}}}
Talent Types: {{#each talentTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}`,
});


const generatePerformerDescriptionsFlow = ai.defineFlow(
  {
    name: 'generatePerformerDescriptionsFlow',
    inputSchema: GeneratePerformerDescriptionsInputSchema,
    outputSchema: GeneratePerformerDescriptionsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
