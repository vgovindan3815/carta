import { Octokit } from '@octokit/rest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepoFile {
  path: string;
  sha: string;
  size: number;
  language: 'COBOL' | 'HLASM' | 'other';
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
  if (
    lower.endsWith('.cbl') ||
    lower.endsWith('.cob') ||
    lower.endsWith('.cobol') ||
    lower.endsWith('.cpy')
  )
    return 'COBOL';
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
 * Fetches the git tree for `branch` recursively and returns all COBOL / HLASM
 * files (extensions: .cbl, .cob, .cobol, .cpy, .asm, .hlasm).
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
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  pat?: string
): Promise<string> {
  const octokit = makeOctokit(pat);

  const { data } = await withRetry(() =>
    octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    })
  );

  // getContent returns an array for directories; for a file it returns a single object
  if (Array.isArray(data)) {
    throw new Error(`Path "${path}" is a directory, not a file.`);
  }

  if (data.type !== 'file') {
    throw new Error(`Unexpected content type "${data.type}" for path "${path}".`);
  }

  if (!('content' in data) || typeof data.content !== 'string') {
    throw new Error(`No content returned for "${path}".`);
  }

  // GitHub returns content with newlines embedded in the base64 string
  const raw = data.content.replace(/\n/g, '');
  return Buffer.from(raw, 'base64').toString('utf-8');
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
