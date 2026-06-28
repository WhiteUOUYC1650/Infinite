'use server';
/**
 * @fileOverview AI flow to generate a summary report of a user based on their status and profile.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';

const ReportInputSchema = z.object({
  name: z.string(),
  username: z.string(),
  statusMessage: z.string().optional(),
  infGold: z.number().optional(),
  tier: z.string().optional(),
});

export async function generateUserReport(input: z.infer<typeof ReportInputSchema>) {
  try {
    const { text } = await ai.generate({
      model: googleAI.model('gemini-1.5-flash'),
      system: 'You are an AI assistant for Infinite Messenger. Analyze the user profile data and provide a short, creative, and slightly humorous "intelligence report" or "summary" about this user. Be concise.',
      prompt: `User Profile:
Name: ${input.name}
Username: ${input.username}
Status: ${input.statusMessage || 'No status set'}
InfGold: ${input.infGold || 0}
Subscription: ${input.tier || 'none'}`,
    });

    return { report: text || 'No report generated.' };
  } catch (e) {
    console.error(e);
    return { report: 'AI failed to analyze this user.' };
  }
}
