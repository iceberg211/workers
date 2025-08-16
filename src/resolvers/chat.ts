import type { Env, ChatInput } from '../types';
import { createClient } from '../ai/provider';

export const chatResolver = async (
  _: unknown,
  args: { input: ChatInput },
  ctx: { env: Env }
) => {
  const provider = args.input.provider;
  const client = createClient(ctx.env, provider);
  const result = await client.chat(args.input);
  return result;
};

export const embeddingsResolver = async (
  _: unknown,
  args: { input: { provider?: 'OPENAI' | 'DEEPSEEK'; model: string; input: string[] } },
  ctx: { env: Env }
) => {
  const client = createClient(ctx.env, args.input.provider);
  const result = await client.embeddings({ model: args.input.model, input: args.input.input });
  return { provider: client.provider, ...result };
};

