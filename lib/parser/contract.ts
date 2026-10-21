import type { DependencyGraph, InternalFlow, ScanIssue } from './types';

export interface ArtifactDescriptor {
  filePath: string;
  language?: string;
  content?: string; // first 512 chars for heuristic detection
}

export interface ParserInput {
  filePath: string;
  content: string;
}

export interface ParserResult {
  name: string;
  language: string;
  loc: number;
  graph: DependencyGraph;
  internalFlow?: InternalFlow;
  scanIssues?: ScanIssue[];
}

export interface SourceParser {
  id: string;
  version: string;
  supportedLanguages: string[];
  canParse(artifact: ArtifactDescriptor): boolean;
  parse(input: ParserInput): ParserResult;
}
