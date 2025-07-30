'use server';
/**
 * @fileOverview An AI flow for generating performer profile images.
 *
 * - generatePerformerImage - A function that generates an image based on talent types.
 * - GeneratePerformerImageInput - The input type for the generatePerformerImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GeneratePerformerImageInputSchema = z.object({
  talentTypes: z.array(z.string()).describe('A list of talent types for the performer, e.g., ["Magician", "Comedian"].'),
});
export type GeneratePerformerImageInput = z.infer<typeof GeneratePerformerImageInputSchema>;

export async function generatePerformerImage(input: GeneratePerformerImageInput): Promise<string> {
    const result = await generatePerformerImageFlow(input);
    if (!result) {
        throw new Error("Image generation failed to return a result.");
    }
    return result;
}

const generatePerformerImageFlow = ai.defineFlow(
  {
    name: 'generatePerformerImageFlow',
    inputSchema: GeneratePerformerImageInputSchema,
    outputSchema: z.string().describe('The generated image as a data URI string.'),
  },
  async (input) => {
    const talentPrompt = input.talentTypes.join(', ');
    const prompt = `Photorealistic professional portrait of a ${talentPrompt}. Dynamic and engaging for a performer profile photo. The image should be a close-up headshot, suitable for an avatar.`;

    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media || !media.url) {
        throw new Error("Image generation failed.");
    }

    return media.url;
  }
);
