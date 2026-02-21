import { describe, it, expect } from 'vitest'
import { buildDocTree, collectDocFiles } from '../tree.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('buildDocTree', () => {
  it('groups files by top-level directory', () => {
    const files = [
      { relativePath: '01-getting-started/installation.mdx' },
      { relativePath: '01-getting-started/project-structure.mdx' },
      { relativePath: '02-app/routing.mdx' },
    ]
    const tree = buildDocTree(files)

    expect(tree).toHaveLength(2)
    expect(tree[0].name).toBe('01-getting-started')
    expect(tree[0].files).toHaveLength(2)
    expect(tree[1].name).toBe('02-app')
    expect(tree[1].files).toHaveLength(1)
  })

  it('creates nested subsections for deeper paths', () => {
    const files = [
      { relativePath: '02-app/01-building/layouts.mdx' },
      { relativePath: '02-app/01-building/pages.mdx' },
      { relativePath: '02-app/02-api/route-handlers.mdx' },
    ]
    const tree = buildDocTree(files)

    expect(tree).toHaveLength(1)
    const appSection = tree[0]
    expect(appSection.name).toBe('02-app')
    expect(appSection.files).toHaveLength(0)
    expect(appSection.subsections).toHaveLength(2)

    const building = appSection.subsections.find(
      (s) => s.name === '01-building'
    )
    expect(building).toBeDefined()
    expect(building!.files).toHaveLength(2)
  })

  it('handles 5-level deep paths (recursive, no depth limit)', () => {
    const files = [
      {
        relativePath:
          '02-app/01-building/01-routing/01-advanced/dynamic-routes.mdx',
      },
      {
        relativePath:
          '02-app/01-building/01-routing/01-advanced/parallel-routes.mdx',
      },
    ]
    const tree = buildDocTree(files)

    const advanced =
      tree[0].subsections[0].subsections[0].subsections[0]
    expect(advanced.name).toBe('01-advanced')
    expect(advanced.files).toHaveLength(2)
  })

  it('includes root-level files in a "." section', () => {
    const files = [
      { relativePath: 'MIGRATION.md' },
      { relativePath: 'CONTRIBUTING.md' },
      { relativePath: '01-getting-started/intro.mdx' },
    ]
    const tree = buildDocTree(files)

    expect(tree).toHaveLength(2)
    // Root section comes first
    expect(tree[0].name).toBe('.')
    expect(tree[0].files).toHaveLength(2)
    expect(tree[1].name).toBe('01-getting-started')
  })

  it('sorts sections and files alphabetically', () => {
    const files = [
      { relativePath: 'z-section/b-file.mdx' },
      { relativePath: 'a-section/z-file.mdx' },
      { relativePath: 'a-section/a-file.mdx' },
      { relativePath: 'z-section/a-file.mdx' },
    ]
    const tree = buildDocTree(files)

    expect(tree[0].name).toBe('a-section')
    expect(tree[1].name).toBe('z-section')
    expect(tree[0].files[0].relativePath).toBe('a-section/a-file.mdx')
    expect(tree[0].files[1].relativePath).toBe('a-section/z-file.mdx')
  })

  it('handles empty input', () => {
    const tree = buildDocTree([])
    expect(tree).toEqual([])
  })

  it('preserves full relative paths in nested files', () => {
    const files = [
      { relativePath: 'guide/advanced/composition.md' },
    ]
    const tree = buildDocTree(files)

    const nested = tree[0].subsections[0]
    expect(nested.files[0].relativePath).toBe('guide/advanced/composition.md')
  })
})

describe('collectDocFiles', () => {
  it('collects md and mdx files from a directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-test-'))

    try {
      // Create test structure
      fs.mkdirSync(path.join(tmpDir, 'guide'), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'guide', 'intro.md'), 'test')
      fs.writeFileSync(path.join(tmpDir, 'guide', 'setup.mdx'), 'test')
      fs.writeFileSync(path.join(tmpDir, 'guide', 'styles.css'), 'test')
      fs.writeFileSync(path.join(tmpDir, 'guide', 'index.md'), 'test')

      const files = collectDocFiles(tmpDir)

      expect(files).toHaveLength(2) // intro.md + setup.mdx (not css, not index)
      expect(files.map((f) => f.relativePath).sort()).toEqual([
        'guide/intro.md',
        'guide/setup.mdx',
      ])
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('supports custom extensions', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-test-'))

    try {
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'docs', 'intro.rst'), 'test')
      fs.writeFileSync(path.join(tmpDir, 'docs', 'setup.md'), 'test')

      const files = collectDocFiles(tmpDir, ['rst'])

      expect(files).toHaveLength(1)
      expect(files[0].relativePath).toBe('docs/intro.rst')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('returns empty array for non-existent directory', () => {
    const files = collectDocFiles('/nonexistent/path')
    expect(files).toEqual([])
  })

  it('collects files with uppercase extensions (.MD, .MDX)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-test-'))

    try {
      fs.mkdirSync(path.join(tmpDir, 'guide'), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'guide', 'intro.MD'), 'test')
      fs.writeFileSync(path.join(tmpDir, 'guide', 'setup.Mdx'), 'test')

      const files = collectDocFiles(tmpDir)

      expect(files).toHaveLength(2)
      const paths = files.map((f) => f.relativePath)
      expect(paths).toContain('guide/intro.MD')
      expect(paths).toContain('guide/setup.Mdx')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('matches when user passes uppercase extensions', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-test-'))

    try {
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'docs', 'intro.md'), 'test')
      fs.writeFileSync(path.join(tmpDir, 'docs', 'setup.mdx'), 'test')

      // User passes uppercase extensions — extSet lowercasing should handle this
      const files = collectDocFiles(tmpDir, ['MD', 'MDX'])

      expect(files).toHaveLength(2)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
