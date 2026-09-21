import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';

// Extensions we recognise explicitly
const SUPPORTED_EXTS = new Set(['.cbl', '.cob', '.cobol', '.jcl', '.cpy', '.pli', '.plo']);

// Extensions that are definitely NOT source (skip silently)
const SKIP_EXTS = new Set([
  '.zip', '.tar', '.gz', '.jar', '.class', '.exe', '.dll', '.so',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.xml', '.json', '.yaml', '.yml', '.md', '.txt', '.csv',
  '.html', '.htm', '.css', '.js', '.ts', '.sh', '.bat', '.ps1',
  '.properties', '.config', '.ini', '.log',
]);

function extOf(filename: string) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

/**
 * Detect the language of a source file from its content.
 * Used for extensionless legacy files (which is the norm for mainframe).
 */
function detectLanguageFromContent(source: string): string {
  const head = source.slice(0, 3000);

  // JCL: lines starting with // or /*
  // Typical: //JOBNAME JOB ..., //STEP EXEC PGM=...
  if (/^\/\/\S*\s+(JOB|EXEC\s+PGM|EXEC\s+PROC)\b/im.test(head)) return 'JCL';
  if (/^\/\/\S*\s+DD\s+/im.test(head) && /^\/\/\S*\s+EXEC\b/im.test(head)) return 'JCL';

  // Copybook: level-number data definitions but NO PROCEDURE DIVISION
  const hasProcDiv = /PROCEDURE\s+DIVISION/i.test(head);
  const hasLevelNums = /^\s{6,}\d{2}\s+[A-Z@#$][A-Z0-9@#$-]*/m.test(head);
  if (hasLevelNums && !hasProcDiv) return 'COPYBOOK';

  // COBOL: explicit division markers or common COBOL keywords
  if (
    /IDENTIFICATION\s+DIVISION|PROCEDURE\s+DIVISION|ENVIRONMENT\s+DIVISION|DATA\s+DIVISION/i.test(head) ||
    /WORKING-STORAGE\s+SECTION|LINKAGE\s+SECTION/i.test(head) ||
    /^\s{6,}(PERFORM|MOVE|COMPUTE|IF\s|CALL\s|OPEN\s|READ\s|WRITE\s|CLOSE\s)/im.test(head)
  ) return 'COBOL';

  // PL/I: procedure statement
  if (/^\s*\w+\s*:\s*PROC(EDURE)?\b/im.test(head)) return 'PLI';

  // Default for extensionless files — assume COBOL (most common legacy type)
  return 'COBOL';
}

function classifyFile(filename: string, source: string): { language: string; include: boolean } {
  const ext = extOf(filename);

  if (SUPPORTED_EXTS.has(ext)) {
    // Known extension → map directly
    const lang =
      ['.cbl', '.cob', '.cobol'].includes(ext) ? 'COBOL' :
      ext === '.jcl' ? 'JCL' :
      ext === '.cpy' ? 'COPYBOOK' :
      ['.pli', '.plo'].includes(ext) ? 'PLI' : 'COBOL';
    return { language: lang, include: true };
  }

  if (SKIP_EXTS.has(ext)) {
    // Clearly not source — skip
    return { language: '', include: false };
  }

  if (ext === '') {
    // No extension → legacy mainframe file — detect from content
    const language = detectLanguageFromContent(source);
    return { language, include: true };
  }

  // Unknown extension — try content detection and include
  const language = detectLanguageFromContent(source);
  return { language, include: true };
}

interface ExtractedFile {
  name: string;   // basename
  source: string;
  language: string;
}

/**
 * Extract all source files from a ZIP buffer.
 * Handles extensionless legacy files via content detection.
 */
function extractFromZip(buffer: Buffer): ExtractedFile[] {
  const zip = new AdmZip(buffer);
  const results: ExtractedFile[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const fullPath = entry.entryName;
    // Skip macOS metadata and hidden files
    if (fullPath.includes('__MACOSX') || fullPath.includes('.DS_Store')) continue;
    if (fullPath.split('/').some((part) => part.startsWith('.'))) continue;

    const basename = fullPath.split('/').pop() ?? fullPath;
    let source: string;
    try {
      source = entry.getData().toString('utf-8');
    } catch {
      continue; // binary file — skip
    }
    if (!source.trim()) continue;

    const { language, include } = classifyFile(basename, source);
    if (!include) continue;

    results.push({ name: basename, source, language });
  }

  return results;
}

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const projectName = (formData.get('projectName') as string | null)?.trim() || 'Uploaded Project';
    const rawFiles = formData.getAll('files') as File[];

    if (!rawFiles || rawFiles.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Expand ZIPs; classify everything else
    const toImport: ExtractedFile[] = [];

    for (const file of rawFiles) {
      const ext = extOf(file.name);

      if (ext === '.zip') {
        const buf = Buffer.from(await file.arrayBuffer());
        toImport.push(...extractFromZip(buf));
      } else {
        const source = await file.text();
        const { language, include } = classifyFile(file.name, source);
        if (include) toImport.push({ name: file.name, source, language });
      }
    }

    if (toImport.length === 0) {
      return NextResponse.json(
        { error: 'No source files found. Upload a ZIP containing your COBOL/JCL modules, or select individual source files.' },
        { status: 400 }
      );
    }

    const { createRepo, upsertProgram, saveProgramSource } = await import('@/lib/db/queries');

    const repoSlug = projectName.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50);
    const repoRow = await createRepo({
      projectName,
      githubUrl: `upload://${repoSlug}`,
      owner: 'upload',
      repo: repoSlug,
      branch: 'main',
    });
    const repoId = repoRow.id;

    // Deduplicate by program name (last entry wins)
    const deduped = new Map<string, ExtractedFile>();
    for (const f of toImport) {
      const ext = extOf(f.name);
      const baseName = (ext ? f.name.slice(0, f.name.length - ext.length) : f.name).toUpperCase();
      deduped.set(baseName, { ...f, name: f.name });
    }

    let imported = 0;
    const programs: { name: string; language: string }[] = [];

    for (const [baseName, { name: filename, source, language }] of deduped) {
      const lines = source.split('\n').filter((l) => l.trim()).length;

      const progRow = await upsertProgram({
        repoId,
        name: baseName,
        filePath: filename,
        language,
        loc: lines,
        desc: `Uploaded file: ${filename}`,
      });

      await saveProgramSource(progRow.id, source);
      programs.push({ name: baseName, language });
      imported++;
    }

    return NextResponse.json({ imported, total: toImport.length, repoId, programs });
  } catch (err) {
    console.error('[upload]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
