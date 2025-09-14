import { Agent } from '@mastra/core';
import { createOpenAI } from '@ai-sdk/openai';
import type { Env, Provider } from '../types';
import { httpFetchTool } from './tools/httpFetch';
import { nowTool } from './tools/now';
import { echoTool } from './tools/echo';
import { mathTool } from './tools/math';
import { randomIntTool } from './tools/random';
import { extractTitleTool } from './tools/extractTitle';

export function createMinimalAgent(env: Env, opts: { provider?: Provider; model: string; urlAllowlist?: string[] }) {
  const { provider, model, urlAllowlist = [] } = opts;

  const agent = new Agent({
    name: 'minimal-agent',
    description: 'One-shot agent with basic tools: http_fetch, now, echo, math, random_int, extract_title',
    instructions:
      'You are a helpful agent. Use tools only when needed. If a URL is not in the allowlist, do not fetch it and answer without fetching.',
    model: () => {
      if (provider === 'DEEPSEEK') {
        if (!env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not set');
        const openai = createOpenAI({ apiKey: env.DEEPSEEK_API_KEY, baseURL: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1' });
        return openai(model) as any;
      }
      if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      return openai(model) as any;
    },
    tools: {
      http_fetch: httpFetchTool,
      now: nowTool,
      echo: echoTool,
      math: mathTool,
      random_int: randomIntTool,
      extract_title: extractTitleTool
    }
  });

  const runtimeContext = {
    get(key: string) {
      if (key === 'urlAllowlist') return urlAllowlist;
      return undefined;
    }
  } as any;

  return { agent, runtimeContext };
}
