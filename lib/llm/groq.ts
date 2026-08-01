import Groq from 'groq-sdk';
import type { CallLLM, StreamResult } from './types';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export function createGroqCallLLM(apiKey: string, model?: string): CallLLM {
  const client = new Groq({ apiKey });

  return async function callLLM(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    onChunk?: (chunk: string, totalSoFar: number) => void
  ): Promise<StreamResult> {
    const resolvedModel = model || DEFAULT_MODEL;
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
