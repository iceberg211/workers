import { createTool } from '@mastra/core';
import { z } from 'zod';

const EchoInput = z.object({ text: z.string() });
const EchoOutput = z.object({ text: z.string(), length: z.number() });

export const echoTool = createTool({
  id: 'echo',
  description: 'Echo back the provided text and its length.',
  inputSchema: EchoInput,
  outputSchema: EchoOutput,
  async execute({ input }) {
    const text = input.text;
    return { text, length: text.length };
  },
});

