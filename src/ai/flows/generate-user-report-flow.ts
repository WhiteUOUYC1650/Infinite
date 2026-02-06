'use server';
/**
 * @fileOverview An AI agent for generating a report on a user's behavior.
 *
 * - generateUserReport - A function that generates a report based on user messages.
 * - UserReportInput - The input type for the generateUserReport function.
 * - UserReportOutput - The return type for the generateUserReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const UserReportInputSchema = z.object({
  userName: z.string().describe('The name of the user being reported on.'),
  userUsername: z.string().describe('The unique username of the user.'),
  messages: z
    .array(
      z.object({
        content: z.string(),
      })
    )
    .describe('A list of recent messages sent by the user.'),
});
export type UserReportInput = z.infer<typeof UserReportInputSchema>;

const UserReportOutputSchema = z.object({
  report: z
    .string()
    .describe(
      "A detailed report on the user's behavior, in Russian. Include a summary, analysis of potential rule violations, and a recommendation. Use Markdown for formatting."
    ),
});
export type UserReportOutput = z.infer<typeof UserReportOutputSchema>;

export async function generateUserReport(
  input: UserReportInput
): Promise<UserReportOutput> {
  return generateUserReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateUserReportPrompt',
  input: { schema: UserReportInputSchema },
  output: { schema: UserReportOutputSchema },
  prompt: `Ты — ИИ-аналитик службы безопасности в чат-платформе. Тебе предоставлены последние сообщения от пользователя.

  Имя пользователя: {{userName}}
  Никнейм: {{userUsername}}
  
  Твоя задача — проанализировать эти сообщения на предмет нарушений правил платформы (спам, оскорбления, враждебные высказывания, подозрительная активность) и составить подробный отчет на РУССКОМ ЯЗЫКЕ.
  
  Структура отчета:
  1.  **Краткое резюме**: Общая оценка поведения пользователя в 1-2 предложениях.
  2.  **Анализ сообщений**: Если найдены подозрительные сообщения, процитируй их и объясни, в чем заключается потенциальное нарушение. Если нарушений нет, так и напиши.
  3.  **Рекомендация**: Вынеси вердикт: "Действий не требуется", "Рекомендуется наблюдение", "Рекомендуется предупреждение" или "Рекомендуется немедленная блокировка".
  
  Используй Markdown для форматирования отчета.
  
  Последние сообщения пользователя для анализа:
  {{#each messages}}
  - "{{this.content}}"
  {{/each}}`,
});

const generateUserReportFlow = ai.defineFlow(
  {
    name: 'generateUserReportFlow',
    inputSchema: UserReportInputSchema,
    outputSchema: UserReportOutputSchema,
  },
  async (input) => {
    if (input.messages.length === 0) {
      return {
        report: 'Недостаточно данных для анализа: у пользователя нет недавних сообщений.',
      };
    }

    const { output } = await prompt(input);
    return output!;
  }
);
