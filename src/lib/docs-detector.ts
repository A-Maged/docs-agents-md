/**
 * Auto-detect docs path in a GitHub repo using the Trees API.
 * Zero dependencies — uses Node built-in https module.
 */

import https from 'node:https'
import path from 'node:path'

/** Directories to exclude from detection */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.github',
  '.git',
  'examples',
  'example',
  '__tests__',
  'test',
  'tests',
  '__mocks__',
  'fixtures',
  '.vitepress',
  'public',
  'images',
  'icons',
  'logo',
  'snippets',
])

/** File extensions considered documentation */
const DOC_EXTENSIONS = new Set(['.md', '.mdx'])

/**
 * Fetch the file tree from a GitHub repo using the Trees API.
 * Returns null on any failure (rate limit, network, timeout).
 */
export async function fetchRepoTree(
  repo: string,
  tag: string
): Promise<string[] | null> {
  try {
    // Step 1: Resolve branch/tag to a commit SHA, then extract tree SHA
    const commitData = await githubGet<{ commit: { tree: { sha: string } } }>(
      `/repos/${repo}/commits/${tag}`
    )
    if (!commitData?.commit?.tree?.sha) return null

    // Step 2: Get the tree recursively using the commit's tree SHA
    const treeData = await githubGet<{
      tree: Array<{ path: string; type: string }>
    }>(`/repos/${repo}/git/trees/${commitData.commit.tree.sha}?recursive=1`)

    if (!treeData?.tree) return null

    return treeData.tree
      .filter((entry) => entry.type === 'blob')
      .map((entry) => entry.path)
  } catch {
    return null
  }
}

/**
 * Detect the most likely docs directory from a list of file paths.
 * Returns the directory path relative to repo root, or null.
 */
export function detectDocsPath(paths: string[]): string | null {
  const dirCounts = new Map<string, number>()

  for (const filePath of paths) {
    const ext = path.posix.extname(filePath).toLowerCase()
    if (!DOC_EXTENSIONS.has(ext)) continue

    // GitHub API always uses forward slashes — use posix
    const dir = path.posix.dirname(filePath)

    // Skip root-level files (e.g. README.md)
    if (dir === '.') continue

    // Skip excluded directories
    const parts = dir.split('/')
    if (parts.some((p) => EXCLUDED_DIRS.has(p))) continue

    dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1)
  }

  if (dirCounts.size === 0) return null

  // Aggregate: roll child counts up to parent dirs
  // e.g. docs/guide/intro.md counts for "docs/guide" AND "docs"
  const aggregated = new Map<string, number>()

  for (const [dir, count] of dirCounts) {
    // Add to this dir and all ancestors
    const parts = dir.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const ancestor = parts.slice(0, i).join('/')
      // Skip if the ancestor itself is excluded
      if (EXCLUDED_DIRS.has(parts[i - 1])) continue
      aggregated.set(ancestor, (aggregated.get(ancestor) || 0) + count)
    }
  }

  // Filter: minimum 3 doc files
  const candidates = [...aggregated.entries()]
    .filter(([, count]) => count >= 3)
    .map(([dir, count]) => ({
      dir,
      count,
      depth: dir.split('/').length,
    }))

  if (candidates.length === 0) return null

  // Score: docs-like name bonus first, then highest count, then shallowest depth
  const DOCS_LIKE_NAMES = new Set([
    'docs', 'doc', 'documentation', 'content', 'guide',
    'guides', 'wiki', 'reference', 'manual', 'pages',
  ])

  candidates.sort((a, b) => {
    const aLeaf = a.dir.split('/').pop() || ''
    const bLeaf = b.dir.split('/').pop() || ''
    const aBonus = DOCS_LIKE_NAMES.has(aLeaf) ? 1 : 0
    const bBonus = DOCS_LIKE_NAMES.has(bLeaf) ? 1 : 0
    if (bBonus !== aBonus) return bBonus - aBonus
    if (b.count !== a.count) return b.count - a.count
    return a.depth - b.depth
  })

  return candidates[0].dir
}

/**
 * Make a GET request to the GitHub API.
 * Returns null on rate limit (403/429), timeout, or network error.
 */
export function githubGet<T>(apiPath: string): Promise<T | null> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      headers: {
        'User-Agent': 'docs-agents-md',
        Accept: 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
      timeout: 15_000,
    }

    const req = https.get(options, (res) => {
      // Rate limit or auth error — fail gracefully
      if (res.statusCode === 403 || res.statusCode === 429) {
        res.resume()
        resolve(null)
        return
      }

      if (res.statusCode !== 200) {
        res.resume()
        resolve(null)
        return
      }

      let data = ''
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString()
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as T)
        } catch {
          resolve(null)
        }
      })
    })

    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
  })
}
