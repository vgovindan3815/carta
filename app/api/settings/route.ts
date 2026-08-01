import { NextRequest, NextResponse } from 'next/server';
import type { LLMProvider } from '@/lib/llm/types';
import { isPlaceholderKey } from '@/lib/llm/types';

// GET — returns provider/model and whether each key is configured, never the actual key values
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      provider: 'groq',
      model: '',
      groqKeySet: !!(process.env.GROQ_API_KEY),
      openaiKeySet: false,
      anthropicKeySet: false,
    });
  }
  try {
    const { getLLMSettings } = await import('@/lib/db/queries');
    const s = await getLLMSettings();
    return NextResponse.json({
      provider: s.provider,
      model: s.model ?? '',
      groqKeySet: !isPlaceholderKey(s.groqKey),
      openaiKeySet: !isPlaceholderKey(s.openaiKey),
      anthropicKeySet: !isPlaceholderKey(s.anthropicKey),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — saves provider/model; only overwrites a key if the user provided a non-empty value
export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'No database configured' }, { status: 503 });
  }
  try {
    const body = await req.json() as {
      provider?: LLMProvider;
      model?: string;
      groqKey?: string;
      openaiKey?: string;
      anthropicKey?: string;
    };

    const { getLLMSettings, saveLLMSettings } = await import('@/lib/db/queries');

    // Load existing keys so blank submissions preserve them
    const existing = await getLLMSettings();

    await saveLLMSettings({
      provider: body.provider ?? existing.provider,
      model: body.model ?? existing.model ?? '',
      // Only replace a key if the user typed something non-empty
      groqKey: body.groqKey?.trim() ? body.groqKey.trim() : existing.groqKey,
      openaiKey: body.openaiKey?.trim() ? body.openaiKey.trim() : existing.openaiKey,
      anthropicKey: body.anthropicKey?.trim() ? body.anthropicKey.trim() : existing.anthropicKey,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
