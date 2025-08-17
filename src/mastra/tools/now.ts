import { createTool } from '@mastra/core';
import { z } from 'zod';

const NowOutput = z.object({ iso: z.string(), timestamp: z.number() });

export const nowTool = createTool({
  id: 'now',
  description: 'Get the current time as ISO string and epoch milliseconds.',
  outputSchema: NowOutput,
  async execute() {
    const d = new Date();
    return { iso: d.toISOString(), timestamp: d.getTime() };
  }
});

