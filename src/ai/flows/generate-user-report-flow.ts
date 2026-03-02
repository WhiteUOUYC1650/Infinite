/**
 * @fileOverview An AI agent for generating a report on a user's behavior.
 *
 * - generateUserReport - A function that generates a report based on user messages.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const UserReportInputSchema = z.object({
  userName: z.string(),
  userUsername: z.string(),
  messages: z.array(
    z.object({
      content: z.string(),
      imageUrl: z.string().optional(),
    })
  ),
});
export type UserReportInput = z.infer<typeof UserReportInputSchema>;

export async function generateUserReport(input: UserReportInput) {
  if (input.messages.length === 0) {
    return { report: 'Недостаточно данных.' };
  }

  const { text } = await ai.generate({
    prompt: `Проанализируй сообщения от ${input.userName} (${input.userUsername}) на нарушения. Сообщения: ${JSON.stringify(input.messages)}. Напиши отчет на русском.`,
  });

  return { report: text || 'Ошибка анализа.' };
}
