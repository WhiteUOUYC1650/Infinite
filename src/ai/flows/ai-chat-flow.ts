/**
 * @fileOverview A general purpose AI chat flow for the messenger bot.
 *
 * - aiChat - A function that generates an AI response based on message history.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiChatInputSchema = z.object({
  userName: z.string(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.string(),
    })
  ),
});
export type AiChatInput = z.infer<typeof AiChatInputSchema>;

export async function aiChat(input: AiChatInput) {
  const { text } = await ai.generate({
    system: `You are @GeminiBot, a friendly AI assistant in Infinite Messenger. User: ${input.userName}. Keep it concise.`,
    prompt: input.history[input.history.length - 1].content,
    messages: input.history.slice(0, -1).map(h => ({
        role: h.role as any,
        content: [{ text: h.content }]
    }))
  });

  return { response: text || 'I am sorry, I could not think of a response.' };
}
