#!/usr/bin/env node
/**
 * MavenKG Engine CLI
 *
 * Usage:
 *   mavenkg analyze --source ./BankDemo --out report.json
 *   mavenkg analyze --source ./CardDemo --out cardemo-v2.json --format mkp
 *
 * The JSON output is directly importable into MKP via the existing
 * "Import CAST Report" button at /programs (POST /api/cast).
 */

import * as fs from 'fs';
import * as path from 'path';
import { classify, isCopybook } from './classifier';
import { parseCobolV2 } from './parsers/cobol';
import { parseJclV2 } from './parsers/jcl';
import { parseSqlDdl } from './parsers/sql';
import type { EngineReport, ArtifactReport, AnalysisMetrics } from './output';

const ENGINE_VERSION = '2.0.0';

// ─── CLI argument parser ──────────────────────────────────────────────────────

interface CliArgs {
  source: string;
  out: string;
  format: 'engine' | 'mkp';
  verbose: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = { format: 'engine', verbose: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--source': args.source = argv[++i]; break;
      case '--out':    args.out = argv[++i]; break;
      case '--format': args.format = argv[++i] as 'engine' | 'mkp'; break;
      case '--verbose': args.verbose = true; break;
      default:
        if (!argv[i].startsWith('--')) {
          // positional after 'analyze' sub-command
        }
    }
  }
  if (!args.source) { console.error('Error: --source is required'); process.exit(1); }
  if (!args.out)    { console.error('Error: --out is required'); process.exit(1); }
  return args as CliArgs;
}

// ─── File walker ──────────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...walkDir(full));
    else if (e.isFile()) results.push(full);
  }
  return results;
}

// ─── Main analyze function ────────────────────────────────────────────────────

function analyze(args: CliArgs): EngineReport {
  const sourceRoot = path.resolve(args.source);
  if (!fs.existsSync(sourceRoot)) {
    console.error(`Error: source directory '${sourceRoot}' does not exist`);
    process.exit(1);
  }

  const allFiles = walkDir(sourceRoot);
  if (args.verbose) console.log(`Found ${allFiles.length} files in ${sourceRoot}`);

  // ── First pass: build registry sets ─────────────────────────────────────
  const knownCopybooks = new Set<string>();
  const knownPrograms = new Set<string>();
  const knownProcs = new Set<string>();
  const knownDatasets = new Set<string>();

  let skippedCount = 0;

  for (const filepath of allFiles) {
    const rel = path.relative(sourceRoot, filepath);
    const basename = path.basename(filepath, path.extname(filepath)).toUpperCase();
    const content = readFileSafe(filepath, 512) ?? undefined;
    const cl = classify(rel, content);

    switch (cl.language) {
      case 'SKIP': skippedCount++; break;
      case 'COPYBOOK': knownCopybooks.add(basename); break;
      case 'PROC':     knownProcs.add(basename); break;
      case 'COBOL':
        if (!isCopybook(rel, content ?? undefined)) knownPrograms.add(basename);
        else knownCopybooks.add(basename);
        break;
      case 'SQL': {
        // Pre-parse SQL DDL to populate known datasets
        const sqlContent = readFileSafe(filepath);
        if (sqlContent) {
          const { definedEntities } = parseSqlDdl(sqlContent, rel);
          for (const e of definedEntities) knownDatasets.add(e);
        }
        break;
      }
    }
  }

  if (args.verbose) {
    console.log(`Registry: ${knownPrograms.size} programs, ${knownCopybooks.size} copybooks, ${knownProcs.size} procs, ${knownDatasets.size} DB2 tables`);
    if (skippedCount > 0) console.log(`Skipped:  ${skippedCount} non-mainframe files (.py, .java, .md, etc.)`);
  }

  // ── Second pass: parse each artifact ─────────────────────────────────────
  const artifacts: ArtifactReport[] = [];
  const reportDiagnostics: EngineReport['diagnostics'] = [];
  const metrics: AnalysisMetrics = {
    artifactsIngested: 0,
    artifactsParsed: 0,
    artifactsPartiallyParsed: 0,
    artifactsFailed: 0,
    referencesDetected: 0,
    referencesDeterministic: 0,
    referencesResolved: 0,
    referencesCandidate: 0,
    referencesUnresolved: 0,
    missingTargets: 0,
    externalTargets: 0,
  };

  for (const filepath of allFiles) {
    const rel = path.relative(sourceRoot, filepath);
    const content = readFileSafe(filepath);
    if (!content) continue;

    const cl = classify(rel, content);

    // Skip non-mainframe files silently
    if (cl.language === 'SKIP') continue;

    metrics.artifactsIngested++;

    try {
      let result: { report: ArtifactReport } | null = null;

      if (cl.language === 'COBOL' && !isCopybook(rel, content)) {
        result = parseCobolV2(content, rel, { knownCopybooks, knownPrograms, artifactId: rel });
      } else if (cl.language === 'JCL' || cl.language === 'PROC') {
        result = parseJclV2(content, rel, { knownPrograms, knownProcs, knownDatasets, artifactId: rel });
      } else if (cl.language === 'SQL') {
        result = parseSqlDdl(content, rel, rel);
      }
      // COPYBOOK, CSD, CTLCARD, UNKNOWN — count but don't parse for deps
      else {
        if (args.verbose) process.stdout.write(`  [${cl.language}] ${rel}\n`);
        metrics.artifactsParsed++;
        continue;
      }

      if (result) {
        artifacts.push(result.report);
        metrics.artifactsParsed++;

        // Accumulate metrics from artifact
        for (const edge of result.report.kgEdges) {
          metrics.referencesDetected++;
          switch (edge.confidence) {
            case 'DETERMINISTIC': metrics.referencesDeterministic++; break;
            case 'RESOLVED':      metrics.referencesResolved++; break;
            case 'CANDIDATE':     metrics.referencesCandidate++; break;
            case 'UNRESOLVED':    metrics.referencesUnresolved++; break;
            case 'MISSING':       metrics.missingTargets++; break;
            case 'EXTERNAL':      metrics.externalTargets++; break;
          }
        }
        if (result.report.diagnostics.length > 0) metrics.artifactsPartiallyParsed++;
      }
    } catch (err) {
      metrics.artifactsFailed++;
      reportDiagnostics.push({
        code: 'PARSE_SYNTAX_RECOVERED', severity: 'error',
        artifactId: rel, message: String(err), component: 'cli',
      });
      if (args.verbose) console.error(`  FAILED: ${rel}: ${err}`);
    }

    if (args.verbose) process.stdout.write(`  [${cl.language}] ${rel}\n`);
  }

  const resolvedCount = artifacts.filter(a => a.coveragePct === 100).length;

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceRoot,
    artifactCount: metrics.artifactsIngested,
    resolvedCount,
    artifacts,
    diagnostics: reportDiagnostics,
    metrics,
  };
}

// ─── MKP-compat output (same shape as CAST import JSON) ──────────────────────

function toMkpFormat(report: EngineReport): object {
  return report.artifacts.map(a => ({
    name: a.name,
    language: a.language,
    loc: a.loc,
    filePath: a.filePath,
    nodes: a.nodes,
    edges: a.edges,
    coveragePct: a.coveragePct,
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFileSafe(filepath: string, maxBytes?: number): string | null {
  try {
    if (maxBytes) {
      const fd = fs.openSync(filepath, 'r');
      const buf = Buffer.alloc(maxBytes);
      const read = fs.readSync(fd, buf, 0, maxBytes, 0);
      fs.closeSync(fd);
      return buf.slice(0, read).toString('utf8');
    }
    return fs.readFileSync(filepath, 'utf8');
  } catch {
    return null;
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function main() {
  const [, , subCommand, ...rest] = process.argv;

  if (subCommand !== 'analyze') {
    console.log('Usage: mavenkg analyze --source <dir> --out <file.json> [--format mkp] [--verbose]');
    process.exit(0);
  }

  const args = parseArgs(rest);
  console.log(`MavenKG Engine v${ENGINE_VERSION}`);
  console.log(`Analyzing: ${args.source}`);

  const report = analyze(args);

  const output = args.format === 'mkp' ? toMkpFormat(report) : report;
  fs.writeFileSync(args.out, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\nDone.`);
  console.log(`  Artifacts parsed:      ${report.metrics.artifactsParsed}`);
  console.log(`  References detected:   ${report.metrics.referencesDetected}`);
  console.log(`  DETERMINISTIC:         ${report.metrics.referencesDeterministic}`);
  console.log(`  RESOLVED:              ${report.metrics.referencesResolved}`);
  console.log(`  CANDIDATE:             ${report.metrics.referencesCandidate}`);
  console.log(`  UNRESOLVED:            ${report.metrics.referencesUnresolved}`);
  console.log(`  Missing targets:       ${report.metrics.missingTargets}`);
  console.log(`  Failed artifacts:      ${report.metrics.artifactsFailed}`);
  console.log(`\nReport written to: ${args.out}`);
}

main();
