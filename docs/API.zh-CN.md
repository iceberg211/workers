# Cloudflare Workers GraphQL API 使用文档（中文）

本服务基于 Cloudflare Workers 与 GraphQL Yoga，整合 OpenAI 与 DeepSeek（OpenAI 兼容）模型，提供统一的 GraphQL 接口用于聊天与向量嵌入。

- 运行时：Cloudflare Workers（通过 Wrangler 构建/部署）
- API 层：GraphQL（`/aichat/graphql`）
- 语言：TypeScript / ESM
- AI SDK：OpenAI 官方 SDK（通过 `baseURL` 切换 DeepSeek）

## 快速开始

1) 安装依赖

```bash
npm i
```

2) 本地配置环境变量（根目录创建 `.dev.vars`）

```
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
ALLOWED_ORIGINS=http://localhost:3000
```

3) 启动本地开发

```bash
npm run dev
# GraphQL: http://127.0.0.1:8787/aichat/graphql
# Health : http://127.0.0.1:8787/aichat/health
```

4) 部署到 Cloudflare

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put DEEPSEEK_API_KEY
npm run deploy
```

## 端点说明

- `GET /aichat/health`：健康检查，返回 `ok`
- `GET /aichat/graphql`：GraphiQL（开发界面）
- `POST /aichat/graphql`：GraphQL 请求（生产与集成使用）

CORS：通过环境变量 `ALLOWED_ORIGINS` 控制，逗号分隔白名单或 `*`（开发便捷）。

## GraphQL 概览

- Query
  - `health: String!`：服务健康
  - `models(provider: Provider): [Model!]!`：返回可用模型（静态精选）
- Mutation
  - `chat(input: ChatInput!): ChatCompletion!`：标准对话补全（非流式）
  - `embeddings(input: EmbeddingInput!): EmbeddingResult!`：文本向量嵌入

核心类型（节选）：

```graphql
enum Provider { OPENAI DEEPSEEK }

input MessageInput { role: String!, content: String! }

input ChatInput {
  provider: Provider
  model: String!
  messages: [MessageInput!]!
  temperature: Float
  maxTokens: Int
}

type Usage { promptTokens: Int, completionTokens: Int, totalTokens: Int }

type ChatCompletion {
  id: String!
  provider: Provider!
  model: String!
  content: String!
  reasoning: String
  usage: Usage
}

input EmbeddingInput {
  provider: Provider
  model: String!
  input: [String!]!
}

type EmbeddingVector { index: Int!, embedding: [Float!]! }

type EmbeddingResult { model: String!, provider: Provider!, data: [EmbeddingVector!]!, usage: Usage }
```

## 示例（GraphiQL）

- 模型列表（DeepSeek）：

```graphql
query { models(provider: DEEPSEEK) { id provider label } }
```

- Chat（OpenAI）：

```graphql
mutation {
  chat(input:{
    provider: OPENAI
    model: "gpt-4o-mini"
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello!" }
    ]
    temperature: 0.3
  }) {
    id provider model content usage { totalTokens }
  }
}
```

- Chat（DeepSeek Reasoner）：

```graphql
mutation {
  chat(input:{
    provider: DEEPSEEK
    model: "deepseek-reasoner"
    messages: [ { role: "user", content: "Explain the Pythagorean theorem." } ]
  }) {
    content
    reasoning
  }
}
```

- Embeddings（OpenAI）：

```graphql
mutation {
  embeddings(input:{
    provider: OPENAI
    model: "text-embedding-3-small"
    input: ["Hello world", "Cloudflare Workers"]
  }) {
    model provider data { index embedding }
  }
}
```

## 示例（curl）

- 健康检查：

```bash
curl -i http://127.0.0.1:8787/aichat/health
```

- 模型列表：

```bash
curl -s http://127.0.0.1:8787/aichat/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query($p:Provider){ models(provider:$p){ id provider label } }","variables":{"p":"OPENAI"}}'
```

- Chat（OpenAI）：

```bash
curl -s http://127.0.0.1:8787/aichat/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation($input:ChatInput!){ chat(input:$input){ id provider model content usage{ totalTokens } } }","variables":{"input":{"provider":"OPENAI","model":"gpt-4o-mini","messages":[{"role":"user","content":"Say hi in 5 words"}],"temperature":0.3}}}'
```

## 错误与兼容

- 上游错误会映射为 GraphQL 错误，`extensions` 会包含 `code` 等信息（Yoga 默认掩码错误详情，可在开发期关闭）。
- DeepSeek 的推理字段（如 `reasoning_content`）已做兼容，返回的 `ChatCompletion.reasoning` 中可查看。

## 安全与配置

- `ALLOWED_ORIGINS`：CORS 白名单；生产环境请配置成具体域。
- `CLIENT_TOKEN`（可选）：若需前端 Bearer 鉴权，可扩展在 Worker 中校验。
- 资源限制：建议限制 `messages` 长度、`maxTokens`、`temperature`，避免异常费用与请求失败。

## 常见模型（示例）

- OpenAI：`gpt-4o-mini`、`gpt-4o`、`gpt-4.1-mini` 等
- DeepSeek：`deepseek-chat`、`deepseek-reasoner`

---

如需开启流式（GraphQL SSE / multipart）或接入更多任务（如文件/图像输入、响应缓存、限流等），可以在此基础上扩展。
