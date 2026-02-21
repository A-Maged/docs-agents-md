/**
 * Doc tree builder.
 * Recursively builds a hierarchical tree from flat file paths.
 */

import fs from 'fs'
import path from 'path'

export interface DocFile {
  relativePath: string
}

export interface DocSection {
  name: string
  files: DocFile[]
  subsections: DocSection[]
}

/**
 * Collect all doc files from a directory.
 * Filters by extension and excludes index files (nav-only).
 */
export function collectDocFiles(
  dir: string,
  extensions: string[] = ['md', 'mdx']
): DocFile[] {
  if (!fs.existsSync(dir)) return []

  const extSet = new Set(extensions.map((e) => `.${e.toLowerCase()}`))

  return fs.readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => {
      const ext = f.slice(f.lastIndexOf('.')).toLowerCase()
      if (!extSet.has(ext)) return false
      // Skip index files (they're navigation-only)
      const basename = f.split('/').pop() || ''
      if (basename.startsWith('index.')) return false
      return true
    })
    .sort()
    .map((f) => ({ relativePath: f }))
}

/**
 * Build a hierarchical doc tree from flat file paths.
 * Recursive — handles arbitrary nesting depth.
 */
export function buildDocTree(files: DocFile[]): DocSection[] {
  const rootFiles: DocFile[] = []
  const root: Map<string, { files: DocFile[]; children: DocFile[] }> = new Map()

  for (const file of files) {
    const parts = file.relativePath.split('/')

    if (parts.length < 2) {
      // Root-level file — include it directly
      rootFiles.push(file)
      continue
    }

    const topDir = parts[0]

    if (!root.has(topDir)) {
      root.set(topDir, { files: [], children: [] })
    }

    const entry = root.get(topDir)!

    if (parts.length === 2) {
      entry.files.push(file)
    } else {
      // This file belongs deeper — pass it down with the top dir stripped
      entry.children.push({
        relativePath: parts.slice(1).join('/'),
      })
    }
  }

  const sections: DocSection[] = []

  // Add root-level files as a special section if any exist
  if (rootFiles.length > 0) {
    sections.push({
      name: '.',
      files: rootFiles.sort((a, b) =>
        a.relativePath.localeCompare(b.relativePath)
      ),
      subsections: [],
    })
  }

  for (const [name, entry] of root) {
    const subsections = buildDocTree(entry.children)

    // Restore the full relative paths in subsection files
    restoreFullPaths(subsections, name)

    sections.push({
      name,
      files: entry.files,
      subsections,
    })
  }

  // Sort sections alphabetically (root '.' stays first)
  sections.sort((a, b) => {
    if (a.name === '.') return -1
    if (b.name === '.') return 1
    return a.name.localeCompare(b.name)
  })
  for (const section of sections) {
    section.files.sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath)
    )
  }

  return sections
}

/**
 * Recursively restore full relative paths by prepending parent directory.
 */
function restoreFullPaths(sections: DocSection[], parentDir: string): void {
  for (const section of sections) {
    section.files = section.files.map((f) => ({
      relativePath: `${parentDir}/${f.relativePath}`,
    }))
    restoreFullPaths(section.subsections, `${parentDir}/${section.name}`)
  }
}
