import type { Env, Provider } from '../types';
import { createClient } from '../ai/provider';

export const modelsResolver = async (_: unknown, args: { provider?: Provider }, ctx: { env: Env }) => {
  const client = createClient(ctx.env, args.provider);
  return client.models();
};

