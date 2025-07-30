
'use server';
/**
 * @fileOverview An AI flow for generating audio from text (Text-to-Speech).
 *
 * - generateTts - A function that converts a string of text into an audio data URI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import wav from 'wav';
import { googleAI } from '@genkit-ai/googleai';

/**
 * Converts raw PCM audio data into a Base64-encoded WAV format.
 * @param pcmData The raw PCM audio buffer from the TTS model.
 * @param channels The number of audio channels (default: 1).
 * @param rate The sample rate of the audio (default: 24000).
 * @param sampleWidth The width of each audio sample in bytes (default: 2).
 * @returns A promise that resolves to the Base64-encoded WAV string.
 */
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', (d) => {
      bufs.push(d);
    });
    writer.on('end', () => {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const GenerateTtsOutputSchema = z.object({
  audioDataUri: z.string().describe('The generated audio as a data:audio/wav;base64 string.'),
});
export type GenerateTtsOutput = z.infer<typeof GenerateTtsOutputSchema>;

export async function generateTts(text: string): Promise<GenerateTtsOutput> {
  return generateTtsFlow(text);
}

const generateTtsFlow = ai.defineFlow(
  {
    name: 'generateTtsFlow',
    inputSchema: z.string(),
    outputSchema: GenerateTtsOutputSchema,
  },
  async (query) => {
    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' },
          },
        },
      },
      prompt: query,
    });

    if (!media || !media.url) {
      throw new Error('No audio media was returned from the TTS model.');
    }

    // The model returns raw PCM data in a base64 data URI
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    
    // Convert the raw PCM to a proper WAV format
    const wavBase64 = await toWav(audioBuffer);

    return {
      audioDataUri: 'data:audio/wav;base64,' + wavBase64,
    };
  }
);
