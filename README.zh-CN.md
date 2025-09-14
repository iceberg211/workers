# Cloudflare Workers GraphQL API（OpenAI + DeepSeek）

基于 Cloudflare Workers 的 GraphQL API，提供 OpenAI/DeepSeek 聊天与文本嵌入能力。已新增一个基于 Mastra 的极简 Agent 通道（一次性调用，无流式、无会话）。

## 技术栈

- Cloudflare Workers（Wrangler）
- GraphQL Yoga（Edge 友好）
- TypeScript（ESM）
- OpenAI SDK（Edge 兼容）
- Mastra（Agent 与 Tool）

## 快速开始

1) 安装依赖

```bash
pnpm i # 或 npm i / yarn
```

2) 配置环境变量（本地）

在项目根目录创建 `.dev.vars` 文件（不会被提交），示例：

```
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
ALLOWED_ORIGINS=http://localhost:3000
```

3) 本地开发

```bash
pnpm dev
# GraphQL: http://127.0.0.1:8787/aichat/graphql
# 健康检查: http://127.0.0.1:8787/aichat/health
```

4) 部署（可选）

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put DEEPSEEK_API_KEY
wrangler deploy
```

## GraphQL 说明

- Endpoint：`/aichat/graphql`
- CORS：通过环境变量 `ALLOWED_ORIGINS` 控制（逗号分隔或 `*`）。

### 已有能力

- Query：`health`、`models(provider)`
- Mutation：`chat(input)`、`embeddings(input)`

### 新增（Mastra 极简 Agent）

- 目的：一次性调用的 Agent 通道，无流式、无会话、零额外基础设施。
- 工具：
  - `http_fetch`：仅允许访问白名单域名（allowlist）的 URL，返回文本内容。
  - `now`：返回当前时间（ISO 与时间戳）。
  - `echo`：回显输入文本与长度。
  - `math`：四则运算（add、sub、mul、div）。
  - `random_int`：生成 [min, max]（含端点）的随机整数。
  - `extract_title`：从小型 HTML 字符串中提取 标题（title）。
- 默认白名单（若请求未提供 `urlAllowlist`）：`example.com`、`developer.mozilla.org`、`api.github.com`。

新增的 SDL 片段：

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

## 示例请求

列出模型（DeepSeek）：

```graphql
query {
  models(provider: DEEPSEEK) { id provider label }
}
```

聊天（OpenAI）：

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
    id provider model content reasoning
    usage { promptTokens completionTokens totalTokens }
  }
}
```

嵌入（OpenAI）：

```graphql
mutation {
  embeddings(
    input: { provider: OPENAI, model: "text-embedding-3-small", input: ["Hello", "Workers"] }
  ) {
    model provider
    data { index embedding }
  }
}
```

Agent 一次性调用（Mastra + OpenAI）：

```graphql
mutation AgentOnce {
  agentRun(
    input: {
      provider: OPENAI
      model: "gpt-4o-mini"
      prompt: "请总结 https://developer.mozilla.org/en-US/docs/Web/HTTP 的核心内容"
      # urlAllowlist: ["developer.mozilla.org"] # 可选，未提供则使用默认白名单
      temperature: 0.3
    }
  ) {
    id provider model output durationMs
    toolCalls { name args ok }
  }
}
```

Agent 一次性调用（Mastra + DeepSeek）：

```graphql
mutation AgentOnceDeepSeek {
  agentRun(
    input: {
      provider: DEEPSEEK
      model: "deepseek-chat"
      prompt: "现在的时间是？"
    }
  ) {
    output
    toolCalls { name args ok }
  }
}
```

## 前端如何使用

- 请求地址：`POST /aichat/graphql`
- Headers：`Content-Type: application/json`
- CORS：浏览器端需要将你的前端来源加入 `ALLOWED_ORIGINS`。

使用 `fetch` 的示例：

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
          // urlAllowlist: ['developer.mozilla.org'], // 可选
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

使用 Apollo Client 的示例：

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
  const exec = (prompt: string) =>
    run({ variables: { input: { provider: 'OPENAI', model: 'gpt-4o-mini', prompt } } });
  return [exec, state] as const;
}
```

## 设计与约束

- 本次为“最小功能”集成：不引入 KV/D1/Vectorize，无会话与持久化，无流式输出。
- 工具层：
  - `http_fetch` 会校验目标 URL 是否在白名单内，默认白名单可满足演示与简单抓取。
  - `now` 仅用于时间相关回答。
- 模型路由：通过 `provider` 字段在 OpenAI/DeepSeek 间切换。
- 后续如需：流式输出、记忆、RAG、更多外部工具，可在现有接口基础上渐进式扩展。

## 目录与关键文件

- `src/schema.ts`：GraphQL Schema（新增 `agentRun`）
- `src/resolvers/agent.ts`：`agentRun` 的 Resolver（调用 Mastra Agent）
- `src/mastra/agent.ts`：最小 Agent 定义（含工具 & 模型选择）
- `src/mastra/tools/httpFetch.ts`：白名单抓取工具
- `src/mastra/tools/now.ts`：时间工具

如需调整默认白名单或增加工具，请告诉我要支持的域名或功能，我们可以按“最小增量”继续迭代。
