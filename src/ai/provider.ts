import OpenAI from 'openai';
import type { ChatInput, ChatResult, Env, Message, Provider } from '../types';

function toOpenAIMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function pickProvider(input?: Provider): Provider {
  return input ?? 'OPENAI';
}

function getAllowedOrigin(request: Request, env: Env): string | null {
  const reqOrigin = request.headers.get('origin');
  const allowList = env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (!reqOrigin) return allowList.length === 0 ? '*' : allowList[0] ?? '*';
  if (allowList.includes('*')) return '*';
  if (allowList.includes(reqOrigin)) return reqOrigin;
  return allowList.length ? allowList[0] : '*';
}

export function corsHeaders(request: Request, env: Env) {
  const origin = getAllowedOrigin(request, env) ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400'
  } as Record<string, string>;
}

export function createClient(env: Env, provider?: Provider) {
  const selected = pickProvider(provider);

  if (selected === 'DEEPSEEK') {
    const apiKey = env.DEEPSEEK_API_KEY;
    const baseURL = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set');
    const client = new OpenAI({ apiKey, baseURL });

    return makeClient(client, 'DEEPSEEK');
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const client = new OpenAI({ apiKey });
  return makeClient(client, 'OPENAI');
}

function makeClient(client: OpenAI, provider: Provider) {
  return {
    provider,
    async chat(input: ChatInput): Promise<ChatResult> {
      const res = await client.chat.completions.create({
        model: input.model,
        messages: toOpenAIMessages(input.messages),
        temperature: input.temperature,
        max_tokens: input.maxTokens
      } as OpenAI.Chat.Completions.ChatCompletionCreateParams);

      const choice = res.choices?.[0];
      const msg: any = choice?.message ?? {};
      const content = typeof msg.content === 'string' ? msg.content : '';
      const reasoning = typeof msg.reasoning_content === 'string' ? msg.reasoning_content : undefined;
      const usage = res.usage ?? undefined;

      return {
        id: res.id,
        provider,
        model: res.model || input.model,
        content,
        reasoning: reasoning || null,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens ?? null,
              completionTokens: usage.completion_tokens ?? null,
              totalTokens: usage.total_tokens ?? null
            }
          : null
      } satisfies ChatResult;
    },

    async embeddings(params: { model: string; input: string[] }) {
      const res = await client.embeddings.create({
        model: params.model,
        input: params.input
      });
      return {
        model: res.model,
        data: res.data.map((d) => ({ index: d.index, embedding: d.embedding })),
        usage: res.usage
          ? {
              promptTokens: (res.usage as any).prompt_tokens ?? null,
              completionTokens: (res.usage as any).completion_tokens ?? null,
              totalTokens: (res.usage as any).total_tokens ?? null
            }
          : null
      };
    },

    async models(): Promise<{ id: string; provider: Provider; label?: string }[]> {
      // To keep deterministic and fast, return a curated list.
      if (provider === 'DEEPSEEK') {
        return [
          { id: 'deepseek-chat', provider: 'DEEPSEEK', label: 'DeepSeek Chat' },
          { id: 'deepseek-reasoner', provider: 'DEEPSEEK', label: 'DeepSeek Reasoner (R1)' }
        ];
      }
      return [
        { id: 'gpt-4o-mini', provider: 'OPENAI', label: 'GPT-4o mini' },
        { id: 'gpt-4o', provider: 'OPENAI', label: 'GPT-4o' },
        { id: 'gpt-4.1-mini', provider: 'OPENAI', label: 'GPT-4.1 mini' }
      ];
    }
  };
}

