import { createYoga } from 'graphql-yoga';
import { schema } from './schema';
import type { Env } from './types';
import { corsHeaders } from './ai/provider';

const GRAPHQL_ENDPOINT = '/aichat/graphql';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);

    if (url.pathname === '/aichat/health') {
      return new Response('ok', { status: 200, headers: { ...corsHeaders(request, env) } });
    }

    const yoga = createYoga<{ env: Env }>({
      schema,
      context: ({ request }) => ({ env }),
      graphqlEndpoint: GRAPHQL_ENDPOINT,
      fetchAPI: { fetch, Response, Request, Headers },
      maskedErrors: true,
      landingPage: {
        title: 'Workers GraphQL (AI)'
      }
    });

    const res = await yoga.fetch(request, env, ctx);
    const headers = new Headers(res.headers);
    const cors = corsHeaders(request, env);
    Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
    return new Response(res.body, { status: res.status, headers });
  }
};
