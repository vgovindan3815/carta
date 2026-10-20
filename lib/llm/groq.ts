import Groq from 'groq-sdk';
import type { CallLLM, StreamResult } from './types';

const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

export function createGroqCallLLM(apiKey: string, model?: string): CallLLM {
  const client = new Groq({ apiKey });

  return async function callLLM(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    onChunk?: (chunk: string, totalSoFar: number) => void
  ): Promise<StreamResult> {
    const primaryModel = model || DEFAULT_MODEL;

    async function callWithModel(m: string): Promise<AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>> {
      return (await client.chat.completions.create({
        model: m,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stream_options: { include_usage: true },
      } as any)) as unknown as AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>;
    }

    // Try the configured model; if it's not available on this account fall back to the instant model
    let stream: AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>;
    try {
      stream = await callWithModel(primaryModel);
    } catch (err: unknown) {
      const msg = String(err);
      if (msg.includes('model_not_found') || msg.includes('does not exist') || msg.includes('404')) {
        console.warn(`[Groq] Model ${primaryModel} not available — falling back to ${FALLBACK_MODEL}`);
        stream = await callWithModel(FALLBACK_MODEL);
      } else {
        throw err;
      }
    }

    const resolvedModel = primaryModel; // kept for compat
    void resolvedModel;

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
