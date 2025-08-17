# Cloudflare Workers GraphQL API (OpenAI + DeepSeek)

中文文档：见 `README.zh-CN.md`。

Backend API on Cloudflare Workers, exposing a GraphQL endpoint that integrates with OpenAI and DeepSeek (OpenAI-compatible) for chat and embeddings.

## Tech Stack

- Cloudflare Workers (Wrangler)
- GraphQL Yoga (Edge-friendly)
- TypeScript (ESM)
- OpenAI SDK (Edge-compatible)

## Quick Start

1. Install deps

```bash
pnpm i # or npm i / yarn
```

2. Configure env vars (dev)

Create a `.dev.vars` file (ignored by Wrangler) with your keys:

```
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
ALLOWED_ORIGINS=http://localhost:3000
```

3. Run locally

```bash
npm run dev
# GraphQL endpoint: http://127.0.0.1:8787/aichat/graphql
# Health:          http://127.0.0.1:8787/aichat/health
```

4. Deploy

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put DEEPSEEK_API_KEY
wrangler deploy
```

## GraphQL

Endpoint: `/aichat/graphql`

Schema highlights:

- Query: `health`, `models(provider)`
- Mutation: `chat(input)`, `embeddings(input)`, `agentRun(input)`

### New: Minimal Agent (Mastra)

- Added a one-shot agent via Mastra with two safe tools:
  - `http_fetch`: fetches content only from an allowlist of domains.
  - `now`: returns current time.
- No streaming, no session/memory. One request in, one answer out.
- Default allowlist if not provided in request: `example.com`, `developer.mozilla.org`, `api.github.com`.

SDL additions:

```graphql
input AgentRunInput {
  provider: Provider
  model: String!
  prompt: String!
  urlAllowlist: [String!]
  temperature: Float
  maxTokens: Int
}

type ToolCall { name: String!, args: String, ok: Boolean, error: String }
type AgentRunResult {
  id: String!
  provider: Provider!
  model: String!
  output: String!
  toolCalls: [ToolCall!]!
  durationMs: Int!
}

extend type Mutation {
  agentRun(input: AgentRunInput!): AgentRunResult!
}
```

### Example Queries

List models (DeepSeek):

```graphql
query {
  models(provider: DEEPSEEK) {
    id
    provider
    label
  }
}
```

Chat (OpenAI):

```graphql
mutation {
  chat(
    input: {
      provider: OPENAI
      model: "gpt-4o-mini"
      messages: [
        { role: "system", content: "You are a helpful assistant." }
        { role: "user", content: "Hello!" }
      ]
      temperature: 0.3
    }
  ) {
    id
    provider
    model
    content
    reasoning
    usage {
      promptTokens
      completionTokens
      totalTokens
    }
  }
}
```

Chat (DeepSeek Reasoner):

```graphql
mutation {
  chat(
    input: {
      provider: DEEPSEEK
      model: "deepseek-reasoner"
      messages: [{ role: "user", content: "Explain the Pythagorean theorem." }]
    }
  ) {
    content
    reasoning
  }
}
```

Embeddings (OpenAI):

```graphql
mutation {
  embeddings(
    input: {
      provider: OPENAI
      model: "text-embedding-3-small"
      input: ["Hello world", "Cloudflare Workers"]
    }
  ) {
    model
    provider
    data {
      index
      embedding
    }
  }
}
```

Agent run (Mastra, OpenAI):

```graphql
mutation AgentOnce {
  agentRun(
    input: {
      provider: OPENAI
      model: "gpt-4o-mini"
      prompt: "Summarize https://developer.mozilla.org/en-US/docs/Web/HTTP"
      # urlAllowlist: ["developer.mozilla.org"] # optional, else defaults
      temperature: 0.3
    }
  ) {
    id
    provider
    model
    output
    toolCalls { name args ok }
    durationMs
  }
}
```

Agent run (Mastra, DeepSeek):

```graphql
mutation AgentOnceDeepSeek {
  agentRun(
    input: {
      provider: DEEPSEEK
      model: "deepseek-chat"
      prompt: "What is the current time?"
    }
  ) {
    output
    toolCalls { name args ok }
  }
}
```

## Frontend Usage

- Endpoint: `POST /aichat/graphql`
- Headers: `Content-Type: application/json`
- CORS: set `ALLOWED_ORIGINS` (e.g., `http://localhost:3000`) in env for browser apps.

### fetch example

```ts
async function agentRun(prompt: string) {
  const res = await fetch('/aichat/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation($input: AgentRunInput!) {
          agentRun(input: $input) {
            id provider model output durationMs
            toolCalls { name args ok }
          }
        }
      `,
      variables: {
        input: {
          provider: 'OPENAI',
          model: 'gpt-4o-mini',
          prompt,
          // urlAllowlist: ['developer.mozilla.org'], // optional
          temperature: 0.3
        }
      }
    })
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data.agentRun;
}
```

### Apollo Client example

```ts
import { gql, useMutation } from '@apollo/client';

const AGENT_RUN = gql`
  mutation AgentRun($input: AgentRunInput!) {
    agentRun(input: $input) {
      id provider model output durationMs
      toolCalls { name args ok }
    }
  }
`;

function useAgentRun() {
  const [run, state] = useMutation(AGENT_RUN);
  const agentRun = (prompt: string) =>
    run({ variables: { input: { provider: 'OPENAI', model: 'gpt-4o-mini', prompt } } });
  return [agentRun, state] as const;
}
```

## Notes

- CORS: set `ALLOWED_ORIGINS` to a comma-separated whitelist or `*` in dev.
- Auth (optional): add a simple client token via `CLIENT_TOKEN` and check in `src/index.ts` if needed.
- DeepSeek: uses OpenAI-compatible API via `DEEPSEEK_BASE_URL` and `DEEPSEEK_API_KEY`.
- Streams: initial version is non-streaming; can extend with GraphQL SSE later.
- Agent: the Mastra-based agent is stateless and only uses two tools (`http_fetch`, `now`) with a server-side allowlist guard. Provide `urlAllowlist` per request to restrict domains further.
