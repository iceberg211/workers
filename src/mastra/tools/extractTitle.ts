import { createTool } from '@mastra/core';
import { z } from 'zod';

const Input = z.object({ html: z.string() });
const Output = z.object({ title: z.string().nullable() });

export const extractTitleTool = createTool({
  id: 'extract_title',
  description: 'Extract the <title> from a small HTML document string.',
  inputSchema: Input,
  outputSchema: Output,
  async execute({ input }) {
    const m = input.html.match(/<title>(.*?)<\/title>/i);
    return { title: m ? m[1].trim() : null };
  },
});

