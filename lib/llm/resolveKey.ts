import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { LLMProvider } from './types';

export interface ResolvedApiConfig {
  provider: LLMProvider;
  apiKey: string;
  anthropicKey: string;
  model?: string;
  source: 'session' | 'byok' | 'env';
}

/**
 * Resolves the effective LLM config for a request:
 *  1. Authenticated session → use DB-stored settings (existing behaviour)
 *  2. Unauthenticated with X-Maven-Api-Key header → use BYOK headers
 *  3. Neither → return null (caller should return 401 with { error: 'needs_api_key' })
 *
 * The SSE jobs route can't send headers (EventSource limitation), so it reads
 * BYOK from URL query params (?p=<provider>&k=<key>) instead.
 */
export async function resolveApiConfig(req: NextRequest): Promise<ResolvedApiConfig | null> {
  const token = await getToken({ req });

  if (token) {
    // Authenticated: use DB settings (same as existing getLLMSettings())
    const { getLLMSettings } = await import('@/lib/db/queries');
    const s = await getLLMSettings();
    return {
      provider: s.provider,
      apiKey: s.apiKey,
      anthropicKey: s.anthropicKey || process.env.ANTHROPIC_API_KEY || '',
      model: s.model,
      source: 'session',
    };
  }

  // Unauthenticated: check for BYOK header (POST routes) or query param (SSE GET routes)
  const headerKey = req.headers.get('X-Maven-Api-Key');
  const headerProvider = req.headers.get('X-Maven-Provider');
  const paramKey = req.nextUrl.searchParams.get('k');
  const paramProvider = req.nextUrl.searchParams.get('p');

  const apiKey = headerKey || paramKey || '';
  const rawProvider = headerProvider || paramProvider || 'groq';
  const provider = (['groq', 'openai', 'anthropic'].includes(rawProvider)
    ? rawProvider
    : 'groq') as LLMProvider;

  if (!apiKey) return null;

  return {
    provider,
    apiKey,
    anthropicKey: provider === 'anthropic' ? apiKey : '',
    source: 'byok',
  };
}
