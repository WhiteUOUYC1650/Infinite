/**
 * @fileOverview An AI agent for summarizing chat history.
 *
 * - summarizeChat - A function that generates a summary of recent messages.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeChatInputSchema = z.object({
  chatName: z.string(),
  messages: z.array(
    z.object({
      senderName: z.string(),
      content: z.string(),
    })
  ),
});
export type SummarizeChatInput = z.infer<typeof SummarizeChatInputSchema>;

export async function summarizeChat(input: SummarizeChatInput) {
  if (input.messages.length === 0) {
    return { summary: 'Нет сообщений.' };
  }

  const { text } = await ai.generate({
    prompt: `Составь краткий пересказ чата ${input.chatName} на русском. Сообщения: ${JSON.stringify(input.messages)}`,
  });

  return { summary: text || 'Не удалось составить пересказ.' };
}
