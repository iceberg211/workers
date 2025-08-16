import type { Env, ChatInput } from '../types';
import { createClient } from '../ai/provider';

export const chatResolver = async (
  _: unknown,
  args: { input: ChatInput },
  ctx: { env: Env }
) => {
  try {
    const provider = args.input.provider;
    const client = createClient(ctx.env, provider);
    const result = await client.chat(args.input);
    return result;
  } catch (error) {
    console.error('Chat resolver error:', error);
    throw new Error(`Chat API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const embeddingsResolver = async (
  _: unknown,
  args: { input: { provider?: 'OPENAI' | 'DEEPSEEK'; model: string; input: string[] } },
  ctx: { env: Env }
) => {
  try {
    const client = createClient(ctx.env, args.input.provider);
    const result = await client.embeddings({ model: args.input.model, input: args.input.input });
    return { provider: client.provider, ...result };
  } catch (error) {
    console.error('Embeddings resolver error:', error);
    throw new Error(`Embeddings API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

