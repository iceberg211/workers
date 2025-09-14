import { createTool } from '@mastra/core';
import { z } from 'zod';

const RandomIntInput = z.object({ min: z.number().int(), max: z.number().int() });
const RandomIntOutput = z.object({ value: z.number().int() });

export const randomIntTool = createTool({
  id: 'random_int',
  description: 'Generate a random integer in [min, max] inclusive.',
  inputSchema: RandomIntInput,
  outputSchema: RandomIntOutput,
  async execute({ input }) {
    const { min, max } = input;
    if (min > max) throw new Error('min must be <= max');
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    return { value };
  },
});

