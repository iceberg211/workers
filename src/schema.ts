import { createSchema } from 'graphql-yoga';
import { chatResolver, embeddingsResolver } from './resolvers/chat';
import { modelsResolver } from './resolvers/models';
import { agentRunResolver } from './resolvers/agent';

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    enum Provider { OPENAI DEEPSEEK }

    type Model { id: String!, provider: Provider!, label: String }

    input MessageInput { role: String!, content: String! }
    type Message { role: String!, content: String! }

    input ChatInput {
      provider: Provider
      model: String!
      messages: [MessageInput!]!
      temperature: Float
      maxTokens: Int
    }

    type Usage {
      promptTokens: Int
      completionTokens: Int
      totalTokens: Int
    }

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

    type Query {
      health: String!
      models(provider: Provider): [Model!]!
    }

    type Mutation {
      chat(input: ChatInput!): ChatCompletion!
      embeddings(input: EmbeddingInput!): EmbeddingResult!
      agentRun(input: AgentRunInput!): AgentRunResult!
    }
  `,
  resolvers: {
    Query: {
      health: () => 'ok',
      models: modelsResolver
    },
    Mutation: {
      chat: chatResolver,
      embeddings: embeddingsResolver,
      agentRun: agentRunResolver
    }
  }
});
