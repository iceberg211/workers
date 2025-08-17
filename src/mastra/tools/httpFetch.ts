import { createTool } from '@mastra/core';
import { z } from 'zod';

const HttpFetchInput = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST']).optional().default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.string().optional()
});

const HttpFetchOutput = z.object({
  status: z.number(),
  contentType: z.string().nullable().optional(),
  text: z.string()
});

function isAllowed(url: string, allowlist: string[]): boolean {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase();
    if (!allowlist || allowlist.length === 0) return false;
    return allowlist.some((allowed) => {
      const a = allowed.trim().toLowerCase();
      if (!a) return false;
      return host === a || host.endsWith(`.${a}`);
    });
  } catch {
    return false;
  }
}

export const httpFetchTool = createTool({
  id: 'http_fetch',
  description: 'Fetch a URL from the allowlist and return the response text.',
  inputSchema: HttpFetchInput,
  outputSchema: HttpFetchOutput,
  async execute(ctx) {
    const { input, runtimeContext } = ctx;
    const allowlist = (runtimeContext?.get('urlAllowlist') as string[] | undefined) ?? [];
    if (!isAllowed(input.url, allowlist)) {
      throw new Error('URL not in allowlist');
    }
    const res = await fetch(input.url, {
      method: input.method || 'GET',
      headers: input.headers,
      body: input.method === 'POST' ? input.body : undefined
    });
    const text = await res.text();
    return { status: res.status, contentType: res.headers.get('content-type'), text };
  }
});

