import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from './schema';
import type { LLMProvider } from '../llm/types';
import { isPlaceholderKey } from '../llm/types';
import type { CopybookField, CopybookDefinition } from '../parser/types';

const SETTINGS_KEYS = ['llm_provider', 'llm_model', 'groq_api_key', 'openai_api_key', 'anthropic_api_key'] as const;

export interface LLMSettings {
  provider: LLMProvider;
  model?: string;
  groqKey: string;
  openaiKey: string;
  anthropicKey: string;
}

export async function getLLMSettings(): Promise<LLMSettings & { apiKey: string }> {
  const db = getDb();
  try {
    const rows = await db.select().from(schema.settings).where(inArray(schema.settings.key, [...SETTINGS_KEYS]));
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const savedProvider = (map.llm_provider as LLMProvider) || null;
    const model = map.llm_model || undefined;

    // Always fall back to env vars so all three providers work without a Settings visit
    const groqKey      = map.groq_api_key      || process.env.GROQ_API_KEY      || '';
    const openaiKey    = map.openai_api_key     || process.env.OPENAI_API_KEY    || '';
    const anthropicKey = map.anthropic_api_key  || process.env.ANTHROPIC_API_KEY || '';

    // Smart provider selection: use saved preference only if that provider has a real key.
    // Otherwise pick the first provider that does.
    const keyForProvider = (p: LLMProvider) =>
      p === 'groq' ? groqKey : p === 'openai' ? openaiKey : anthropicKey;

    // Preference: honour saved choice if its key is real; otherwise openai → groq → anthropic
    const preferenceOrder: LLMProvider[] = savedProvider
      ? [savedProvider, 'openai', 'groq', 'anthropic']
      : ['openai', 'groq', 'anthropic'];

    const provider = preferenceOrder.find(p => !isPlaceholderKey(keyForProvider(p))) ?? 'groq';

    const apiKey = keyForProvider(provider);
    return { provider, model, groqKey, openaiKey, anthropicKey, apiKey };
  } catch {
    return {
      provider: 'groq',
      model: undefined,
      groqKey: process.env.GROQ_API_KEY || '',
      openaiKey: process.env.OPENAI_API_KEY || '',
      anthropicKey: process.env.ANTHROPIC_API_KEY || '',
      apiKey: process.env.GROQ_API_KEY || '',
    };
  }
}

export async function saveLLMSettings(s: LLMSettings): Promise<void> {
  const db = getDb();
  const entries: { key: string; value: string }[] = [
    { key: 'llm_provider', value: s.provider },
    { key: 'llm_model', value: s.model ?? '' },
    { key: 'groq_api_key', value: s.groqKey },
    { key: 'openai_api_key', value: s.openaiKey },
    { key: 'anthropic_api_key', value: s.anthropicKey },
  ];
  for (const entry of entries) {
    await db.insert(schema.settings)
      .values({ key: entry.key, value: entry.value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: entry.value, updatedAt: new Date() } });
  }
}

export async function saveCopybook(
  repoId: string,
  name: string,
  source: string,
  fields: CopybookField[]
): Promise<void> {
  const db = getDb();
  await db.insert(schema.copybooks).values({ repoId, name: name.toUpperCase(), source, fields }).onConflictDoNothing();
}

export async function getCopybooksForRepo(repoId: string): Promise<CopybookDefinition[]> {
  const db = getDb();
  const rows = await db.select().from(schema.copybooks).where(eq(schema.copybooks.repoId, repoId));
  return rows.map((r) => ({ name: r.name, source: r.source, fields: (r.fields ?? []) as CopybookField[] }));
}

export async function getCopybooksByNames(repoId: string, names: string[]): Promise<CopybookDefinition[]> {
  if (!names.length) return [];
  const db = getDb();
  const upperNames = names.map((n) => n.toUpperCase());
  const rows = await db.select().from(schema.copybooks).where(and(eq(schema.copybooks.repoId, repoId), inArray(schema.copybooks.name, upperNames)));
  return rows.map((r) => ({ name: r.name, source: r.source, fields: (r.fields ?? []) as CopybookField[] }));
}

export interface GlossaryEntry {
  id: string;
  pattern: string;
  description: string;
  examples: string[];
}

export async function saveGlossaryEntry(
  repoId: string,
  pattern: string,
  description: string,
  examples: string[] = []
): Promise<void> {
  const db = getDb();
  await db.insert(schema.domainGlossary).values({ repoId, pattern, description, examples });
}

export async function getGlossaryForRepo(repoId: string): Promise<GlossaryEntry[]> {
  const db = getDb();
  const rows = await db.select().from(schema.domainGlossary).where(eq(schema.domainGlossary.repoId, repoId)).orderBy(schema.domainGlossary.pattern);
  return rows.map((r) => ({ id: r.id, pattern: r.pattern, description: r.description, examples: (r.examples ?? []) as string[] }));
}

export async function deleteGlossaryEntry(id: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.domainGlossary).where(eq(schema.domainGlossary.id, id));
}

export async function createValidation(data: {
  programId: string;
  artifactType: string;
  reviewer: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
}): Promise<void> {
  const db = getDb();
  await db.insert(schema.validations).values({
    programId: data.programId,
    artifactType: data.artifactType,
    reviewer: data.reviewer,
    notes: data.notes ?? null,
    status: data.status,
  });
}
