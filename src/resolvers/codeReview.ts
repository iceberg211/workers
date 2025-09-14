import type { Env, Provider } from '../types';
import { createClient } from '../ai/provider';

type CodeReviewInput = {
  provider?: Provider;
  model: string;
  code: string;
  filename?: string | null;
  language?: string | null;
  goals?: string[] | null;
  guidelines?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
};

type CodeIssue = {
  severity: 'INFO' | 'WARN' | 'ERROR';
  title: string;
  description: string;
  location?: { path?: string | null; lineStart?: number | null; lineEnd?: number | null } | null;
  suggestion?: string | null;
  rule?: string | null;
};

type CodeReviewResult = {
  summary: string;
  score?: number | null;
  issues: CodeIssue[];
};

function buildPrompt(input: CodeReviewInput) {
  const goals = (input.goals && input.goals.length ? input.goals : [
    'Correctness and potential bugs',
    'Security pitfalls',
    'Performance issues',
    'Readability and maintainability',
    'Edge cases and error handling',
  ]).map((g, i) => `${i + 1}. ${g}`).join('\n');

  const guidelines = input.guidelines?.trim() || '';
  const filename = input.filename ? `\n- File: ${input.filename}` : '';
  const language = input.language ? `\n- Language: ${input.language}` : '';

  // Instruct the model to return strict JSON only.
  const format = `\nReturn ONLY a minified JSON object with this exact shape (no markdown):\\n{\\n  \"summary\": string,\\n  \"score\": number (0-100) optional,\\n  \"issues\": [\\n    {\\n      \"severity\": one of [\"INFO\", \"WARN\", \"ERROR\"],\\n      \"title\": string,\\n      \"description\": string,\\n      \"location\": { \"path\": string optional, \"lineStart\": number optional, \"lineEnd\": number optional } optional,\\n      \"suggestion\": string optional,\\n      \"rule\": string optional\\n    }\\n  ]\\n}`;

  return [
    {
      role: 'system',
      content:
        'You are a meticulous senior code reviewer. Produce concise, actionable, structured feedback. Prefer precise pointers with line hints and short, concrete suggestions. Respond in English unless the code/comments are in Chinese, then respond in Chinese.'
    },
    {
      role: 'user',
      content:
        `Please review the following code. Context:${filename}${language}\n\nGoals:\n${goals}\n${guidelines ? `\nAdditional guidelines:\n${guidelines}\n` : ''}\n${format}\n\nCODE START\n\n\`\`\`\n${input.code}\n\`\`\`\n\nCODE END`
    }
  ] as { role: 'system' | 'user' | 'assistant'; content: string }[];
}

function safeParseJSON(text: string): CodeReviewResult | null {
  const trimmed = text.trim();
  const tryParse = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  let obj = tryParse(trimmed);
  if (obj) return obj;
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    obj = tryParse(trimmed.slice(first, last + 1));
    if (obj) return obj;
  }
  return null;
}

export const codeReviewResolver = async (
  _: unknown,
  args: { input: CodeReviewInput },
  ctx: { env: Env }
) => {
  const input = args.input;
  const client = createClient(ctx.env, input.provider);
  const messages = buildPrompt(input);

  try {
    const result = await client.chat({
      provider: input.provider,
      model: input.model,
      messages,
      temperature: input.temperature ?? 0,
      maxTokens: input.maxTokens ?? undefined
    } as any);

    const parsed = safeParseJSON(result.content || '');
    if (parsed && Array.isArray(parsed.issues)) {
      // Normalize values
      const issues: CodeIssue[] = parsed.issues.map((it: any) => ({
        severity: (it.severity === 'ERROR' || it.severity === 'WARN' || it.severity === 'INFO') ? it.severity : 'WARN',
        title: String(it.title || 'Issue'),
        description: String(it.description || ''),
        location: it.location ? {
          path: it.location.path ?? input.filename ?? null,
          lineStart: typeof it.location.lineStart === 'number' ? it.location.lineStart : null,
          lineEnd: typeof it.location.lineEnd === 'number' ? it.location.lineEnd : null,
        } : (input.filename ? { path: input.filename, lineStart: null, lineEnd: null } : null),
        suggestion: it.suggestion ?? null,
        rule: it.rule ?? null,
      }));

      const summary = String(parsed.summary || '');
      const score = typeof parsed.score === 'number' ? parsed.score : null;
      return { summary, score, issues } as CodeReviewResult;
    }

    // Fallback: return as a single INFO issue with the text
    const content = result.content || 'No response';
    return {
      summary: 'Model returned unstructured output; included as a single note.',
      score: null,
      issues: [
        {
          severity: 'INFO',
          title: 'Unstructured review',
          description: content,
          location: input.filename ? { path: input.filename, lineStart: null, lineEnd: null } : null,
          suggestion: null,
          rule: null,
        }
      ]
    } as CodeReviewResult;
  } catch (error) {
    console.error('CodeReview resolver error:', error);
    throw new Error(`CodeReview API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

