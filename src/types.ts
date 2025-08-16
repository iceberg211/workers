export type Provider = 'OPENAI' | 'DEEPSEEK';

export interface Env {
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  ALLOWED_ORIGINS?: string; // comma-separated or "*"
  CLIENT_TOKEN?: string; // optional: for simple auth
}

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatInput = {
  provider?: Provider;
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
};

export type ChatResult = {
  id: string;
  provider: Provider;
  model: string;
  content: string;
  reasoning?: string | null;
  usage?: {
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
  } | null;
};

