'use server';
/**
 * @fileOverview AI flow to generate user reports (Disabled).
 */

import { z } from 'genkit';

const ReportInputSchema = z.object({
  name: z.string(),
  username: z.string(),
  statusMessage: z.string().optional(),
  infGold: z.number().optional(),
  tier: z.string().optional(),
  recentMessages: z.array(z.string()).optional(),
});

export async function generateUserReport(input: z.infer<typeof ReportInputSchema>) {
  return { report: 'AI features are currently disabled.' };
}
