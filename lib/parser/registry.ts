import type { SourceParser, ArtifactDescriptor, ParserInput, ParserResult } from './contract';
import { parseCobolFile } from './cobol';
import { parsePliFile } from './pli';
import { parseJclFile } from './jcl';

const cobolParser: SourceParser = {
  id: 'cobol-fixed',
  version: '1.0.0',
  supportedLanguages: ['COBOL', 'HLASM'],
  canParse(a: ArtifactDescriptor): boolean {
    if (a.language && ['COBOL', 'HLASM'].includes(a.language.toUpperCase())) return true;
    return /\.(cbl|cob|cobol|asm|hlasm)$/i.test(a.filePath);
  },
  parse(input: ParserInput): ParserResult {
    const r = parseCobolFile(input.filePath, input.content);
    return { name: r.name, language: r.language, loc: r.loc, graph: r.graph, internalFlow: r.internalFlow, scanIssues: r.graph.scanIssues };
  },
};

const pliParser: SourceParser = {
  id: 'pli',
  version: '1.0.0',
  supportedLanguages: ['PLI', 'PL1'],
  canParse(a: ArtifactDescriptor): boolean {
    if (a.language && ['PLI', 'PL1'].includes(a.language.toUpperCase())) return true;
    if (/\.(pl1|pli)$/i.test(a.filePath)) return true;
    return !!a.content && /^\s*\w+\s*:\s*(PROCEDURE|PROC)\b/i.test(a.content);
  },
  parse(input: ParserInput): ParserResult {
    const r = parsePliFile(input.filePath, input.content);
    return { name: r.name, language: r.language, loc: r.loc, graph: r.graph };
  },
};

const jclParser: SourceParser = {
  id: 'jcl',
  version: '1.0.0',
  supportedLanguages: ['JCL', 'PROC'],
  canParse(a: ArtifactDescriptor): boolean {
    if (a.language && ['JCL', 'PROC'].includes(a.language.toUpperCase())) return true;
    if (/\.(jcl|proc)$/i.test(a.filePath)) return true;
    return !!a.content && /^\/\//.test(a.content.trimStart());
  },
  parse(input: ParserInput): ParserResult {
    const r = parseJclFile(input.filePath, input.content);
    return { name: r.name, language: r.language, loc: r.loc, graph: r.graph };
  },
};

// Order matters: PLI/JCL before COBOL fallback
const parsers: SourceParser[] = [pliParser, jclParser, cobolParser];

export function getParser(artifact: ArtifactDescriptor): SourceParser | undefined {
  return parsers.find(p => p.canParse(artifact));
}

export function parseArtifact(filePath: string, content: string, language?: string): ParserResult {
  const artifact: ArtifactDescriptor = { filePath, language, content: content.slice(0, 512) };
  const parser = getParser(artifact) ?? cobolParser;
  return parser.parse({ filePath, content });
}

export { parsers };
