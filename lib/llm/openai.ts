import OpenAI from 'openai';
import type { CallLLM, StreamResult } from './types';
import { isPlaceholderKey } from './types';

const DEFAULT_MODEL = 'gpt-4o';

export function createOpenAICallLLM(apiKey: string, model?: string): CallLLM {
  return async function callLLM(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    onChunk?: (chunk: string, totalSoFar: number) => void
  ): Promise<StreamResult> {
    if (isPlaceholderKey(apiKey)) {
      throw new Error(
        'OpenAI API key not configured. Go to Settings and enter your OpenAI API key.'
      );
    }

    const client = new OpenAI({ apiKey });
    const resolvedModel = model || DEFAULT_MODEL;

    const stream = await client.chat.completions.create({
      model: resolvedModel,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      stream_options: { include_usage: true },
    });

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
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? 0;
        completionTokens = chunk.usage.completion_tokens ?? 0;
        totalTokens = chunk.usage.total_tokens ?? 0;
      }
    }

    return { text: full, promptTokens, completionTokens, totalTokens };
  };
}

export { DEFAULT_MODEL as OPENAI_MODEL };
