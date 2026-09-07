import { setTimeout as nodeSetTimeout } from 'timers'
import { appendLine, LogLevel } from '../utils/output'

type CacheEntry = { sha?: string; ts: number }

const CACHE_TTL = 1000 * 60 * 5 // 5 minutes
const cache: Record<string, CacheEntry> = {}

const pathToGithub = (repoPath: string): string =>
  `https://api.github.com/repos/mdn/content/commits?path=${encodeURIComponent(repoPath)}&per_page=1`

const parseShaFromBody = (body: string): string | undefined => {
  const parsed = JSON.parse(body) as unknown
  // If GitHub returns an array (commits list), use first.sha
  if (Array.isArray(parsed) && parsed.length > 0) {
    const first = parsed[0] as Record<string, unknown>
    if (typeof first.sha === 'string') return first.sha
  }
  // If GitHub returned a single object with sha, accept that too
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (typeof obj.sha === 'string') return obj.sha
  }
  return undefined
}

const fetchOnce = async (url: string): Promise<{ status?: number; body: string } | undefined> => {
  try {
    const response = await globalThis.fetch(url, {
      headers: {
        'User-Agent': 'mdn-macros-syntax',
        Accept: 'application/vnd.github+json'
      }
    })
    return { status: response.status, body: await response.text() }
  } catch (err) {
    appendLine(LogLevel.ERROR, `[versionProvider] fetchOnce error: ${String(err)}`)
    return undefined
  }
}

const fetchWithRetries = async (url: string, attempts = 3): Promise<{ status?: number; body: string } | undefined> => {
  let wait = 150
  for (let i = 0; i < attempts; i++) {
    const res = await fetchOnce(url)
    if (!res) {
      // Retry on errors
      if (i < attempts - 1) await new Promise(r => nodeSetTimeout(r, wait))
      wait *= 2
      continue
    }

    // If rate-limited or forbidden, do not retry here; caller handles logging
    if (res.status === 403 || res.status === 429) return res

    // Retry on server errors
    if (res.status && res.status >= 500 && i < attempts - 1) {
      await new Promise(r => nodeSetTimeout(r, wait))
      wait *= 2
      continue
    }
    appendLine(LogLevel.INFO, `[versionProvider] fetched ${url} -> HTTP ${res.status}`)
    return res
  }
  return undefined
}

// Deduplicate concurrent fetches per repo path
const fetched: Record<string, Promise<string | undefined> | undefined> = {}

export const getLatestShaForRepoPath = async (repoPath: string): Promise<string | undefined> => {
  const now = Date.now()
  const cached = cache[repoPath]
  if (cached && now - cached.ts < CACHE_TTL) return cached.sha

  // If there's already a request in flight for this path, reuse it
  if (fetched[repoPath]) return fetched[repoPath]!

  const url = pathToGithub(repoPath)
  const p = (async () => {
    const res = await fetchWithRetries(url)

    if (!res) {
      // Final failure (network or retries exhausted)
      appendLine(LogLevel.WARN, `[versionProvider] no response for ${url}`)
      cache[repoPath] = { sha: undefined, ts: Date.now() }
      return undefined
    }
    if (res.status === 403 || res.status === 429) {
      // Rate-limited or forbidden; record and return undefined
      appendLine(LogLevel.WARN, `[versionProvider] ${url} -> HTTP ${res.status}`)
      cache[repoPath] = { sha: undefined, ts: Date.now() }
      return undefined
    }

    if (res.status && res.status >= 200 && res.status < 300) {
      const sha = parseShaFromBody(res.body)
      cache[repoPath] = { sha, ts: Date.now() }
      return sha
    }

    // Other statuses
    appendLine(LogLevel.WARN, `[versionProvider] unexpected status ${res.status} for ${url}`)
    cache[repoPath] = { sha: undefined, ts: Date.now() }
    return undefined
  })()

  fetched[repoPath] = p
  try {
    return await p
  } finally {
    // Clear fetched after completion
    fetched[repoPath] = undefined
  }
}
