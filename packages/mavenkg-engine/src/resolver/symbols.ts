/**
 * Symbol table and constant-propagation engine (spec §23).
 *
 * Tracks variable definitions and VALUE-clause assignments to resolve
 * dynamic CALL targets.  Implements bounded value sets and kill conditions:
 * if an unknown assignment overwrites a known value, the entry is widened
 * to UNKNOWN rather than leaving stale certainty.
 */

export type ValueState =
  | { kind: 'literal'; value: string }
  | { kind: 'candidates'; values: string[] }
  | { kind: 'unknown' };

export interface SymbolEntry {
  name: string;
  scope: string;
  dataType?: string;
  sourceLine: number;
  state: ValueState;
  aliases: string[];    // REDEFINES / RENAME targets
}

export class SymbolTable {
  private readonly symbols = new Map<string, SymbolEntry>();

  define(name: string, scope: string, sourceLine: number, dataType?: string): void {
    const key = `${scope}::${name}`;
    if (!this.symbols.has(key)) {
      this.symbols.set(key, {
        name,
        scope,
        dataType,
        sourceLine,
        state: { kind: 'unknown' },
        aliases: [],
      });
    }
  }

  /** Record a VALUE-clause initial value (compile-time literal assignment). */
  setLiteral(name: string, scope: string, value: string): void {
    const entry = this.get(name, scope);
    if (entry) {
      entry.state = { kind: 'literal', value };
    } else {
      this.symbols.set(`${scope}::${name}`, {
        name, scope, sourceLine: 0,
        state: { kind: 'literal', value },
        aliases: [],
      });
    }
  }

  /**
   * Record a MOVE statement: MOVE literal TO identifier.
   * If called with a non-literal (unknown source), widens to UNKNOWN.
   */
  move(
    targetName: string,
    scope: string,
    sourceLiteral: string | null
  ): void {
    const entry = this.get(targetName, scope);
    if (!entry) return;

    if (sourceLiteral === null) {
      // Unknown source — widen (spec §23.4 kill condition)
      entry.state = { kind: 'unknown' };
    } else {
      // Known literal — might narrow or add candidate
      if (entry.state.kind === 'unknown') {
        entry.state = { kind: 'literal', value: sourceLiteral };
      } else if (entry.state.kind === 'literal') {
        if (entry.state.value !== sourceLiteral) {
          entry.state = { kind: 'candidates', values: [entry.state.value, sourceLiteral] };
        }
      } else {
        // Already a candidate set — add if not already present
        if (!entry.state.values.includes(sourceLiteral)) {
          entry.state.values.push(sourceLiteral);
        }
      }
    }
  }

  /** Resolve a variable name to its current value state. */
  resolve(name: string, scope: string): ValueState {
    return this.get(name, scope)?.state ?? { kind: 'unknown' };
  }

  private get(name: string, scope: string): SymbolEntry | undefined {
    return this.symbols.get(`${scope}::${name}`)
      ?? this.symbols.get(`GLOBAL::${name}`);
  }

  entries(): IterableIterator<SymbolEntry> {
    return this.symbols.values();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True if the string looks like a valid COBOL identifier (not a keyword). */
export function isValidIdentifier(s: string): boolean {
  return /^[A-Z#@$][A-Z0-9#@$-]{0,29}$/.test(s);
}

/** Extract a string literal from a COBOL value: 'XYZPGM' → 'XYZPGM'. */
export function extractLiteral(raw: string): string | null {
  const m = /^['"]([A-Z0-9#@$-]{1,30})['"]$/.exec(raw.trim().toUpperCase());
  return m ? m[1] : null;
}
