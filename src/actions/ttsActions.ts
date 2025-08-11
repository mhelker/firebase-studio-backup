// src/actions/ttsActions.ts

export async function generateTtsAction(text: string) {
  // For now, just return a tiny silent audio clip as a base64 data URI
  const silentAudioDataUri = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

  return { audioDataUri: silentAudioDataUri };
}