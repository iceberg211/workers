import { createTool } from '@mastra/core';
import { z } from 'zod';

const MathInput = z.object({
  op: z.enum(['add', 'sub', 'mul', 'div']),
  a: z.number(),
  b: z.number(),
});

const MathOutput = z.object({
  op: z.string(),
  a: z.number(),
  b: z.number(),
  result: z.number(),
});

export const mathTool = createTool({
  id: 'math',
  description: 'Simple math operations: add, sub, mul, div.',
  inputSchema: MathInput,
  outputSchema: MathOutput,
  async execute({ input }) {
    const { op, a, b } = input;
    switch (op) {
      case 'add':
        return { op, a, b, result: a + b };
      case 'sub':
        return { op, a, b, result: a - b };
      case 'mul':
        return { op, a, b, result: a * b };
      case 'div':
        return { op, a, b, result: b === 0 ? NaN : a / b };
      default:
        throw new Error('Unsupported op');
    }
  },
});

