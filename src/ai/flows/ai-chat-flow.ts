
'use server';
/**
 * @fileOverview A general purpose AI chat flow for the messenger bot.
 *
 * - aiChat - A function that generates an AI response based on message history.
 * - AiChatInput - The input type for the aiChat function.
 * - AiChatOutput - The return type for the aiChat function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiChatInputSchema = z.object({
  userName: z.string().describe('The name of the user talking to the bot.'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        content: z.string(),
      })
    )
    .describe('The conversation history.'),
});
export type AiChatInput = z.infer<typeof AiChatInputSchema>;

const AiChatOutputSchema = z.object({
  response: z.string().describe('The AI bot\'s response in text.'),
});
export type AiChatOutput = z.infer<typeof AiChatOutputSchema>;

export async function aiChat(input: AiChatInput): Promise<AiChatOutput> {
  return aiChatFlow(input);
}

const aiChatFlow = ai.defineFlow(
  {
    name: 'aiChatFlow',
    inputSchema: AiChatInputSchema,
    outputSchema: AiChatOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      system: `You are @GeminiBot, a friendly and helpful AI assistant integrated into the Infinite Messenger. 
      The user you are talking to is named ${input.userName}. 
      Keep your responses concise and friendly. Use Markdown for formatting if needed.
      You can answer questions, chat about anything, or help with tasks.`,
      prompt: input.history[input.history.length - 1].content,
      // Pass the previous history parts (excluding the last one which is our prompt)
      messages: input.history.slice(0, -1).map(h => ({
          role: h.role,
          content: [{ text: h.content }]
      }))
    });

    return { response: text || 'I am sorry, I could not think of a response.' };
  }
);
