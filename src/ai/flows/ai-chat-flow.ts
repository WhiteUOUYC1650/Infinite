'use server';
/**
 * @fileOverview AI chat flow for custom bots.
 */

import { ai } from '@/ai/genkit';

export async function aiChat(message: string, systemPrompt: string) {
  if (!ai) return { response: 'AI is currently unavailable.' };
  
  try {
    const { text } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      system: systemPrompt,
      prompt: message,
    });

    return { response: text || '' };
  } catch (e: any) {
    console.error("Genkit Error:", e);
    return { response: 'Error: Could not generate AI response.' };
  }
}
