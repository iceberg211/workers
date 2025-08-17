import type { Env } from '../types';
import { createMinimalAgent } from '../mastra/agent';

export const agentRunResolver = async (
  _: unknown,
  args: { input: { provider?: 'OPENAI' | 'DEEPSEEK'; model: string; prompt: string; urlAllowlist?: string[]; temperature?: number; maxTokens?: number } },
  ctx: { env: Env }
) => {
  const { provider, model, prompt, urlAllowlist, temperature, maxTokens } = args.input;
  const defaultAllow = ['example.com', 'developer.mozilla.org', 'api.github.com'];
  const allow = (urlAllowlist && urlAllowlist.length ? urlAllowlist : defaultAllow).map((s) => s.trim()).filter(Boolean);
  const { agent, runtimeContext } = createMinimalAgent(ctx.env, { provider, model, urlAllowlist: allow });

  const start = Date.now();
  const res = await agent.generate({
    messages: [
      { role: 'user', content: prompt }
    ],
    maxSteps: 2,
    temperature: temperature ?? 0.3,
    runtimeContext
  } as any);

  // agent.generate returns { text, toolCalls, ... } via ai SDK compatibility
  const output = (res as any).text ?? '';
  const toolCalls = Array.isArray((res as any).toolCalls) ? (res as any).toolCalls : [];

  return {
    id: `run_${Date.now()}`,
    provider: provider ?? 'OPENAI',
    model,
    output,
    toolCalls: toolCalls.map((t: any) => ({
      name: t.toolName || t.name || 'tool',
      args: t.args ? JSON.stringify(t.args) : null,
      ok: true
    })),
    durationMs: Date.now() - start
  };
};
