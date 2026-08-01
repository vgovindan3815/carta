import type { CopybookDefinition, CopybookField } from './types';

// ---------------------------------------------------------------------------
// Copybook parser — extracts field definitions from COBOL copybook (.cpy) source
// ---------------------------------------------------------------------------

/** Strip fixed-format sequence area (cols 73-80) and skip comment/blank lines. */
function prepareLines(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((l) => (l.length > 72 ? l.slice(0, 72) : l))
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (l.length >= 7 && (l[6] === '*' || l[6] === '/')) return false;
      if (t.startsWith('*>')) return false;
      return true;
    });
}

/** Join continuation lines (col-7 = '-') into the previous logical line. */
function buildLogicalLines(lines: string[]): string[] {
  const logical: string[] = [];
  for (const line of lines) {
    if (line.length >= 7 && line[6] === '-') {
      const cont = line.slice(11).trimEnd();
      if (logical.length > 0) logical[logical.length - 1] += ' ' + cont.trim();
    } else {
      logical.push(line.trimEnd());
    }
  }
  return logical;
}

// Match: level name [PIC/PICTURE clause] [OCCURS n TIMES?]
// Level: 01-49, 66, 77, 78, 88
const FIELD_RE = /^\s*(\d{1,2})\s+([A-Z0-9#@$-]+)(.*)/i;
const PIC_RE = /\bPIC(?:TURE)?\s+(?:IS\s+)?([^\s.]+)/i;
const OCCURS_RE = /\bOCCURS\s+(\d+)/i;

export function parseCopybook(name: string, source: string): CopybookDefinition {
  const lines = prepareLines(source);
  const logicalLines = buildLogicalLines(lines);
  const fields: CopybookField[] = [];

  for (const line of logicalLines) {
    const m = FIELD_RE.exec(line);
    if (!m) continue;

    const level = parseInt(m[1], 10);
    const fieldName = m[2].toUpperCase();
    const rest = m[3] ?? '';

    // Skip FILLER entries and group-level entries without PIC
    if (fieldName === 'FILLER' && !PIC_RE.test(rest)) continue;

    const picMatch = PIC_RE.exec(rest);
    const occursMatch = OCCURS_RE.exec(rest);

    fields.push({
      level,
      name: fieldName,
      pic: picMatch ? picMatch[1].toUpperCase() : undefined,
      occurs: occursMatch ? parseInt(occursMatch[1], 10) : undefined,
    });
  }

  return { name: name.toUpperCase(), source, fields };
}

// ---------------------------------------------------------------------------
// Formatter — compact string for LLM context injection
// ---------------------------------------------------------------------------

export function formatCopybookContext(defs: CopybookDefinition[]): string {
  if (!defs.length) return '';

  const lines: string[] = ['COPYBOOK FIELD DEFINITIONS:'];
  for (const def of defs) {
    const fieldSummary = def.fields
      .slice(0, 40) // cap per copybook to avoid huge prompts
      .map((f) => {
        let desc = `${f.name}(${f.level < 10 ? '0' : ''}${f.level}`;
        if (f.pic) desc += `,PIC ${f.pic}`;
        if (f.occurs) desc += `,OCCURS ${f.occurs}`;
        desc += ')';
        return desc;
      })
      .join(' · ');
    const truncated = def.fields.length > 40 ? ` … +${def.fields.length - 40} more` : '';
    lines.push(`  ${def.name}: ${fieldSummary}${truncated}`);
  }
  return lines.join('\n');
}
