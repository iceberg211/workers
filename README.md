# Cloudflare Workers GraphQL API (OpenAI + DeepSeek)

Backend API on Cloudflare Workers, exposing a GraphQL endpoint that integrates with OpenAI and DeepSeek (OpenAI-compatible) for chat and embeddings.

## Tech Stack
- Cloudflare Workers (Wrangler)
- GraphQL Yoga (Edge-friendly)
- TypeScript (ESM)
- OpenAI SDK (Edge-compatible)

## Quick Start

1) Install deps

```bash
npm i
```

2) Configure env vars (dev)

Create a `.dev.vars` file (ignored by Wrangler) with your keys:

```
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
ALLOWED_ORIGINS=http://localhost:3000
```

3) Run locally

```bash
npm run dev
# GraphQL endpoint: http://127.0.0.1:8787/aichat/graphql
# Health:          http://127.0.0.1:8787/aichat/health
```

4) Deploy

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put DEEPSEEK_API_KEY
wrangler deploy
```

## GraphQL

Endpoint: `/aichat/graphql`

Schema highlights:
- Query: `health`, `models(provider)`
- Mutation: `chat(input)`, `embeddings(input)`

### Example Queries

List models (DeepSeek):

```graphql
query {
  models(provider: DEEPSEEK) { id provider label }
}
```

Chat (OpenAI):

```graphql
mutation {
  chat(input: {
    provider: OPENAI,
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello!" }
    ],
    temperature: 0.3
  }) {
    id
    provider
    model
    content
    reasoning
    usage { promptTokens completionTokens totalTokens }
  }
}
```

Chat (DeepSeek Reasoner):

```graphql
mutation {
  chat(input: {
    provider: DEEPSEEK,
    model: "deepseek-reasoner",
    messages: [
      { role: "user", content: "Explain the Pythagorean theorem." }
    ]
  }) {
    content
    reasoning
  }
}
```

Embeddings (OpenAI):

```graphql
mutation {
  embeddings(input: {
    provider: OPENAI,
    model: "text-embedding-3-small",
    input: ["Hello world", "Cloudflare Workers"]
  }) {
    model
    provider
    data { index embedding }
  }
}
```

## Notes
- CORS: set `ALLOWED_ORIGINS` to a comma-separated whitelist or `*` in dev.
- Auth (optional): add a simple client token via `CLIENT_TOKEN` and check in `src/index.ts` if needed.
- DeepSeek: uses OpenAI-compatible API via `DEEPSEEK_BASE_URL` and `DEEPSEEK_API_KEY`.
- Streams: initial version is non-streaming; can extend with GraphQL SSE later.
