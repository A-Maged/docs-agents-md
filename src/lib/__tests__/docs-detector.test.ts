import { describe, it, expect } from 'vitest'
import { detectDocsPath } from '../docs-detector.js'

describe('detectDocsPath', () => {
  it('detects standard docs/ layout', () => {
    const paths = [
      'README.md',
      'package.json',
      'src/index.ts',
      'docs/guide/intro.md',
      'docs/guide/setup.md',
      'docs/api/reference.md',
      'docs/index.md',
    ]
    expect(detectDocsPath(paths)).toBe('docs')
  })

  it('detects deeply nested docs path', () => {
    const paths = [
      'README.md',
      'package.json',
      'adev/src/content/guide/intro.md',
      'adev/src/content/guide/setup.md',
      'adev/src/content/reference/api.md',
      'adev/src/content/best-practices/perf.md',
    ]
    expect(detectDocsPath(paths)).toBe('adev/src/content')
  })

  it('returns null for repo with no docs', () => {
    const paths = [
      'package.json',
      'src/index.ts',
      'src/utils.ts',
      'tsconfig.json',
    ]
    expect(detectDocsPath(paths)).toBeNull()
  })

  it('returns null for repo with only root README', () => {
    const paths = [
      'README.md',
      'package.json',
      'src/index.ts',
    ]
    expect(detectDocsPath(paths)).toBeNull()
  })

  it('returns null when docs count below threshold', () => {
    const paths = [
      'docs/readme.md',
      'docs/contributing.md',
      'src/index.ts',
    ]
    expect(detectDocsPath(paths)).toBeNull()
  })

  it('picks directory with most md files when multiple exist', () => {
    const paths = [
      'docs/a.md',
      'docs/b.md',
      'docs/c.md',
      'content/x.md',
      'content/y.md',
      'content/z.md',
      'content/w.md',
      'content/v.md',
    ]
    expect(detectDocsPath(paths)).toBe('content')
  })

  it('prefers shallower dir when counts are equal', () => {
    const paths = [
      'docs/a.md',
      'docs/b.md',
      'docs/c.md',
      'src/content/x.md',
      'src/content/y.md',
      'src/content/z.md',
    ]
    expect(detectDocsPath(paths)).toBe('docs')
  })

  it('excludes node_modules and test directories', () => {
    const paths = [
      'node_modules/lib/readme.md',
      'node_modules/lib/api.md',
      'node_modules/lib/guide.md',
      'node_modules/lib/setup.md',
      '__tests__/fixtures/a.md',
      '__tests__/fixtures/b.md',
      '__tests__/fixtures/c.md',
      '__tests__/fixtures/d.md',
      'docs/intro.md',
      'docs/setup.md',
      'docs/api.md',
    ]
    expect(detectDocsPath(paths)).toBe('docs')
  })

  it('handles .mdx files', () => {
    const paths = [
      'docs/intro.mdx',
      'docs/quickstart.mdx',
      'docs/installation.mdx',
      'docs/typescript.mdx',
    ]
    expect(detectDocsPath(paths)).toBe('docs')
  })

  it('aggregates child dir counts to parent', () => {
    // 5 files spread across subdirs of "content"
    const paths = [
      'content/getting-started/intro.md',
      'content/getting-started/install.md',
      'content/guide/routing.md',
      'content/guide/middleware.md',
      'content/api/reference.md',
    ]
    // "content" aggregates all 5, individual subdirs only have 2 each
    expect(detectDocsPath(paths)).toBe('content')
  })

  it('returns null for empty array', () => {
    expect(detectDocsPath([])).toBeNull()
  })

  it('detects docs with mixed-case extensions (.MD, .Mdx)', () => {
    const paths = [
      'content/guide/intro.MD',
      'content/guide/setup.MDX',
      'content/guide/advanced.Mdx',
      'content/api/ref.md',
    ]
    expect(detectDocsPath(paths)).toBe('content')
  })

  it('picks highest count in monorepo layout', () => {
    const paths = [
      // 5 docs under packages/a/docs
      'packages/a/docs/one.md',
      'packages/a/docs/two.md',
      'packages/a/docs/three.md',
      'packages/a/docs/four.md',
      'packages/a/docs/five.md',
      // 3 docs under packages/b/docs
      'packages/b/docs/one.md',
      'packages/b/docs/two.md',
      'packages/b/docs/three.md',
    ]
    // Both a/docs and b/docs have docs-like bonus — tiebreaker is count (5 > 3)
    expect(detectDocsPath(paths)).toBe('packages/a/docs')
  })

  it('picks shallowest ancestor when all docs under src/content', () => {
    const paths = [
      'src/content/docs/a.md',
      'src/content/docs/b.md',
      'src/content/docs/c.md',
      'src/content/blog/d.md',
    ]
    // content has docs-like name bonus
    expect(detectDocsPath(paths)).toBe('src/content')
  })
})
