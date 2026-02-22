'use server';
/**
 * @fileOverview An AI agent for summarizing chat history.
 *
 * - summarizeChat - A function that generates a summary of recent messages.
 * - SummarizeChatInput - The input type for the summarizeChat function.
 * - SummarizeChatOutput - The return type for the summarizeChat function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeChatInputSchema = z.object({
  chatName: z.string().describe('The name of the chat being summarized.'),
  messages: z
    .array(
      z.object({
        senderName: z.string().describe('The name of the sender.'),
        content: z.string().describe('The text content of the message.'),
      })
    )
    .describe('A list of recent messages in the chat.'),
});
export type SummarizeChatInput = z.infer<typeof SummarizeChatInputSchema>;

const SummarizeChatOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      "A concise summary of the chat discussion, in Russian. Use bullet points if necessary."
    ),
});
export type SummarizeChatOutput = z.infer<typeof SummarizeChatOutputSchema>;

export async function summarizeChat(
  input: SummarizeChatInput
): Promise<SummarizeChatOutput> {
  return summarizeChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeChatPrompt',
  input: { schema: SummarizeChatInputSchema },
  output: { schema: SummarizeChatOutputSchema },
  prompt: `Ты — продвинутый ИИ-помощник в мессенджере Infinite. Твоя задача — составить краткий и содержательный пересказ последних сообщений в чате на РУССКОМ ЯЗЫКЕ.

  Название чата: {{chatName}}
  
  Проанализируй диалог и выдели основные темы обсуждения, принятые решения или важные вопросы.
  Стиль должен быть дружелюбным, но информативным.
  
  Сообщения для анализа:
  {{#each messages}}
  - {{this.senderName}}: {{this.content}}
  {{/each}}`,
});

const summarizeChatFlow = ai.defineFlow(
  {
    name: 'summarizeChatFlow',
    inputSchema: SummarizeChatInputSchema,
    outputSchema: SummarizeChatOutputSchema,
  },
  async (input) => {
    if (input.messages.length === 0) {
      return {
        summary: 'В этом чате пока нет сообщений для анализа.',
      };
    }

    const { output } = await prompt(input);
    return output!;
  }
);
