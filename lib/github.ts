import { Octokit } from '@octokit/rest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepoFile {
  path: string;
  sha: string;
  size: number;
  language: 'COBOL' | 'HLASM' | 'JCL' | 'PROC' | 'CPY' | 'PLI' | 'other';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOctokit(pat?: string): Octokit {
  return new Octokit(
    pat ? { auth: pat } : {}
  );
}

function classifyFile(path: string): RepoFile['language'] {
  const lower = path.toLowerCase();
  if (lower.endsWith('.asm') || lower.endsWith('.hlasm')) return 'HLASM';
  if (lower.endsWith('.jcl')) return 'JCL';
  if (lower.endsWith('.proc')) return 'PROC';
  if (lower.endsWith('.cpy')) return 'CPY';
  if (lower.endsWith('.pl1') || lower.endsWith('.pli')) return 'PLI';
  if (lower.endsWith('.cbl') || lower.endsWith('.cob') || lower.endsWith('.cobol')) return 'COBOL';
  return 'other';
}

/** Simple exponential-backoff retry for rate-limit (HTTP 429) responses. */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.response?.status;
      if (status === 429 || status === 403) {
        // Respect Retry-After header if present
        const retryAfter =
          err?.response?.headers?.['retry-after'] ??
          err?.response?.headers?.['x-ratelimit-reset'];
        const waitMs = retryAfter
          ? (parseInt(retryAfter, 10) - Math.floor(Date.now() / 1000)) * 1000
          : baseDelayMs * Math.pow(2, attempt);
        await new Promise((res) => setTimeout(res, Math.max(waitMs, baseDelayMs)));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches the git tree for `branch` recursively and returns all COBOL / HLASM / JCL / PROC / copybook
 * files (extensions: .cbl, .cob, .cobol, .cpy, .asm, .hlasm, .jcl, .proc).
 */
export async function listCobolFiles(
  owner: string,
  repo: string,
  branch: string,
  pat?: string
): Promise<RepoFile[]> {
  const octokit = makeOctokit(pat);

  // First resolve the branch to a commit SHA so we can get the tree
  const { data: refData } = await withRetry(() =>
    octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    })
  );

  const commitSha = refData.object.sha;

  // Fetch the recursive tree
  const { data: treeData } = await withRetry(() =>
    octokit.git.getTree({
      owner,
      repo,
      tree_sha: commitSha,
      recursive: 'true',
    })
  );

  const files: RepoFile[] = [];

  for (const item of treeData.tree) {
    if (item.type !== 'blob') continue;
    const language = classifyFile(item.path ?? '');
    if (language === 'other') continue;

    files.push({
      path: item.path ?? '',
      sha: item.sha ?? '',
      size: item.size ?? 0,
      language,
    });
  }

  return files;
}

/**
 * Fetches the raw content of a file from GitHub, decodes it from base64,
 * and returns it as a UTF-8 string.
 *
 * Strategy (fastest to slowest):
 *   1. raw.githubusercontent.com CDN — no base64, no rate limits, works for
 *      both public repos and private repos with a PAT.
 *   2. GitHub Contents API (repos.getContent) as fallback (e.g. when `ref`
 *      is a commit SHA not reachable via the CDN path).
 */
const FETCH_TIMEOUT_MS = 30_000; // 30 s — large COBOL files can be slow

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  pat?: string
): Promise<string> {
  // ── 1. Raw CDN path (fast, no API quota) ─────────────────────────────────
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path}`;
  try {
    const headers: Record<string, string> = {};
    if (pat) headers['Authorization'] = `token ${pat}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(rawUrl, { headers, signal: controller.signal });
      if (res.ok) return await res.text();
      // 404 → file not at this ref via CDN; fall through to API
      // 401/403 → PAT issue or private repo; fall through to API which gives a better error
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Network error or abort — fall through to API
  }

  // ── 2. GitHub Contents API (handles SHAs, redirects, edge cases) ─────────
  const octokit = makeOctokit(pat);

  const fetchPromise = withRetry(() =>
    octokit.repos.getContent({ owner, repo, path, ref })
  );
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`GitHub fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s for "${path}"`)),
      FETCH_TIMEOUT_MS
    )
  );

  const { data } = await Promise.race([fetchPromise, timeoutPromise]);

  if (Array.isArray(data)) throw new Error(`Path "${path}" is a directory, not a file.`);
  if (data.type !== 'file') throw new Error(`Unexpected content type "${data.type}" for path "${path}".`);
  if (!('content' in data) || typeof data.content !== 'string')
    throw new Error(`No content returned for "${path}".`);

  const raw = data.content.replace(/\n/g, '');
  return Buffer.from(raw, 'base64').toString('utf-8');
}

/**
 * Returns the default branch name for a GitHub repo (e.g. "main" or "master").
 */
export async function getDefaultBranch(
  owner: string,
  repo: string,
  pat?: string
): Promise<string> {
  const octokit = makeOctokit(pat);
  const { data } = await withRetry(() => octokit.repos.get({ owner, repo }));
  return data.default_branch;
}

/**
 * Returns the SHA of the latest commit on the specified branch.
 */
export async function getLatestCommitSha(
  owner: string,
  repo: string,
  branch: string,
  pat?: string
): Promise<string> {
  const octokit = makeOctokit(pat);

  const { data } = await withRetry(() =>
    octokit.repos.getBranch({
      owner,
      repo,
      branch,
    })
  );

  return data.commit.sha;
}

/**
 * Parses a GitHub URL into owner + repo components.
 * Handles:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   github.com/owner/repo
 *   git@github.com:owner/repo.git
 */
export async function parseGithubUrl(
  url: string
): Promise<{ owner: string; repo: string } | null> {
  const trimmed = url.trim();

  // SSH format: git@github.com:owner/repo[.git]
  const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // HTTPS format: https://github.com/owner/repo[.git] (protocol optional)
  const httpsMatch =
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(
      trimmed
    );
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  return null;
}

/**
 * Searches for a COBOL program's source file in a GitHub repo by program name.
 * Tries the git tree index so it costs only 1-2 API calls (no per-file fetches until a match).
 * Returns the source text if found, or null if not found.
 */
const TREE_TIMEOUT_MS = 20_000; // 20 s — large repos' recursive trees can be slow

export async function findProgramSource(
  owner: string,
  repo: string,
  branch: string,
  programName: string,
  pat?: string
): Promise<string | null> {
  try {
    const octokit = makeOctokit(pat);

    // ── Resolve branch → commit SHA ──────────────────────────────────────────
    let refData: Awaited<ReturnType<typeof octokit.git.getRef>>['data'];
    try {
      ({ data: refData } = await withRetry(() =>
        octokit.git.getRef({ owner, repo, ref: `heads/${branch}` })
      ));
    } catch {
      const defaultBranch = await getDefaultBranch(owner, repo, pat);
      ({ data: refData } = await withRetry(() =>
        octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` })
      ));
    }

    // ── Fetch recursive tree with timeout (large repos can hang) ─────────────
    const treePromise = withRetry(() =>
      octokit.git.getTree({ owner, repo, tree_sha: refData.object.sha, recursive: 'true' })
    );
    const treeTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tree fetch timed out')), TREE_TIMEOUT_MS)
    );
    const { data: treeData } = await Promise.race([treePromise, treeTimeout]);

    // ── Find file by name (case-insensitive stem match) ───────────────────────
    const nameUpper = programName.toUpperCase();
    const COBOL_EXTS = ['.cbl', '.cob', '.cobol'];
    const match = treeData.tree.find((item) => {
      if (item.type !== 'blob' || !item.path) return false;
      const base = item.path.split('/').pop() ?? '';
      const dotIdx = base.lastIndexOf('.');
      if (dotIdx === -1) return false;
      const ext = base.slice(dotIdx).toLowerCase();
      const stem = base.slice(0, dotIdx).toUpperCase();
      return stem === nameUpper && COBOL_EXTS.includes(ext);
    });

    if (!match?.path) return null;

    return await fetchFileContent(owner, repo, match.path, refData.object.sha, pat);
  } catch {
    return null;
  }
}
