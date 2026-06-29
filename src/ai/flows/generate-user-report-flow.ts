'use server';
/**
 * @fileOverview AI flow to generate a deep summary report of a user based on their profile and recent activity.
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
  recentMessages: z.array(z.string()).optional().describe('A list of recent messages sent by the user for deeper analysis.'),
});

export async function generateUserReport(input: z.infer<typeof ReportInputSchema>) {
  try {
    const messagesContext = input.recentMessages && input.recentMessages.length > 0 
        ? `\n\nRecent messages from this user for analysis:\n${input.recentMessages.map(m => `- ${m}`).join('\n')}`
        : '\n\nNo recent messages available for analysis.';

    const { text } = await ai.generate({
      model: googleAI.model('gemini-1.5-flash'),
      system: 'You are a high-ranking intelligence officer for Infinite Messenger. Analyze the user profile data and their recent messages. Provide a creative, slightly humorous, and cynical "intelligence report". Be concise but impactful. Focus on their personality and "threat level" to the status quo.',
      prompt: `User Profile:
Name: ${input.name}
Username: ${input.username}
Status: ${input.statusMessage || 'No status set'}
InfGold: ${input.infGold || 0}
Subscription: ${input.tier || 'none'}${messagesContext}`,
    });

    return { report: text || 'No report generated.' };
  } catch (e) {
    console.error("Report Flow Error:", e);
    return { report: 'AI failed to analyze this user. Check API key settings.' };
  }
}
