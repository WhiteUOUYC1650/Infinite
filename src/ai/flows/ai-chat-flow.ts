'use server';
/**
 * @fileOverview AI chat flow for custom bots.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AIChatInputSchema = z.object({
  message: z.string().describe('The user message to respond to.'),
  systemPrompt: z.string().describe('Instructions for the AI on how to behave.'),
});

const AIChatOutputSchema = z.object({
  response: z.string().describe('The AI generated response.'),
});

export async function aiChat(message: string, systemPrompt: string) {
  if (!ai) return { response: 'AI is currently unavailable.' };
  
  const { text } = await ai.generate({
    model: 'googleai/gemini-1.5-flash',
    system: systemPrompt,
    prompt: message,
  });

  return { response: text };
}