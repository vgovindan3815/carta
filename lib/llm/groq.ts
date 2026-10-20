import Groq from 'groq-sdk';
import type { CallLLM, StreamResult } from './types';

// Ordered preference list — largest/best first, smallest last as final fallback
const MODEL_PREFERENCE = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

export const DEFAULT_MODEL = MODEL_PREFERENCE[0];

// Cache the resolved model per API key so we only do discovery once per process lifetime
const resolvedModelCache = new Map<string, string>();

async function resolveModel(client: Groq, apiKey: string, preferred?: string): Promise<string> {
  const cacheKey = `${apiKey}:${preferred ?? ''}`;
  if (resolvedModelCache.has(cacheKey)) return resolvedModelCache.get(cacheKey)!;

  try {
    const list = await client.models.list();
    const available = new Set((list.data ?? []).map((m: { id: string }) => m.id));

    // If the caller specified a model and it's available, use it
    if (preferred && available.has(preferred)) {
      resolvedModelCache.set(cacheKey, preferred);
      return preferred;
    }

    // Walk preference list and pick first available
    for (const m of MODEL_PREFERENCE) {
      if (available.has(m)) {
        console.log(`[Groq] Auto-selected model: ${m} (from ${available.size} available)`);
        resolvedModelCache.set(cacheKey, m);
        return m;
      }
    }

    // Nothing matched — fall back to first available model
    const first = list.data?.[0]?.id;
    if (first) {
      console.warn(`[Groq] No preferred model found — using first available: ${first}`);
      resolvedModelCache.set(cacheKey, first);
      return first;
    }
  } catch {
    // models.list() failed (permissions / network) — just use the preferred or default
  }

  const fallback = preferred || DEFAULT_MODEL;
  resolvedModelCache.set(cacheKey, fallback);
  return fallback;
}

export function createGroqCallLLM(apiKey: string, model?: string): CallLLM {
  const client = new Groq({ apiKey });

  return async function callLLM(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    onChunk?: (chunk: string, totalSoFar: number) => void
  ): Promise<StreamResult> {
    const resolvedModel = await resolveModel(client, apiKey, model);

    const stream = (await client.chat.completions.create({
      model: resolvedModel,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stream_options: { include_usage: true },
    } as any)) as unknown as AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>;

    let full = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) {
        full += text;
        onChunk?.(text, full.length);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = (chunk as any).usage;
      if (u) {
        promptTokens = u.prompt_tokens ?? 0;
        completionTokens = u.completion_tokens ?? 0;
        totalTokens = u.total_tokens ?? 0;
      }
    }

    return { text: full, promptTokens, completionTokens, totalTokens };
  };
}

export { DEFAULT_MODEL as GROQ_MODEL };
