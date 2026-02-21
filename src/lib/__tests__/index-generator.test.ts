import { describe, it, expect } from 'vitest'
import { generateIndex } from '../index-generator.js'
import { injectIndex } from '../inject.js'

describe('generateIndex', () => {
  it('generates correct pipe-separated format', () => {
    const sections = [
      {
        name: 'guide',
        files: [
          { relativePath: 'guide/intro.md' },
          { relativePath: 'guide/setup.md' },
        ],
        subsections: [],
      },
    ]

    const result = generateIndex(sections, {
      name: 'TestLib',
      docsPath: './.agents-docs/testlib',
      version: '1.0.0',
      outputFile: 'AGENTS.md',
      libKey: 'testlib',
    })

    expect(result).toContain('[TestLib Docs Index v1.0.0]')
    expect(result).toContain('root: ./.agents-docs/testlib')
    expect(result).toContain('IMPORTANT: Prefer retrieval-led reasoning')
    expect(result).toContain('--lib testlib')
    expect(result).toContain('--output AGENTS.md')
    expect(result).toContain('guide:{intro.md,setup.md}')
    // Uses pipe as separator
    expect(result.split('|').length).toBeGreaterThan(3)
  })

  it('omits version suffix when no version provided', () => {
    const result = generateIndex([], {
      name: 'MyLib',
      docsPath: './docs',
    })
    expect(result).toContain('[MyLib Docs Index]')
    expect(result).not.toContain(' v')
  })

  it('handles nested sections with grouped dirs', () => {
    const sections = [
      {
        name: 'api',
        files: [],
        subsections: [
          {
            name: 'endpoints',
            files: [
              { relativePath: 'api/endpoints/users.md' },
              { relativePath: 'api/endpoints/posts.md' },
            ],
            subsections: [],
          },
        ],
      },
    ]

    const result = generateIndex(sections, {
      name: 'API',
      docsPath: './docs',
    })

    expect(result).toContain('api/endpoints:{users.md,posts.md}')
  })

  it('generates regen command for --repo mode', () => {
    const result = generateIndex([], {
      name: 'CustomLib',
      docsPath: './docs',
      repo: 'owner/repo',
      repoDocsPath: 'content',
    })
    expect(result).toContain('--repo owner/repo')
    expect(result).toContain('--name customlib')
    expect(result).toContain('--docs-path content')
  })

  it('omits --docs-path when repoDocsPath is absent', () => {
    const result = generateIndex([], {
      name: 'CustomLib',
      docsPath: './docs',
      repo: 'owner/repo',
    })
    expect(result).toContain('--repo owner/repo')
    expect(result).not.toContain('--docs-path')
  })

  it('handles empty sections array', () => {
    const result = generateIndex([], {
      name: 'EmptyLib',
      docsPath: './docs',
    })
    expect(result).toContain('[EmptyLib Docs Index]')
    expect(result).toContain('root: ./docs')
    // No file listings, but still has header and instruction parts
    expect(result.split('|').length).toBeGreaterThanOrEqual(3)
  })

  it('URL-encodes pipe characters in filenames', () => {
    const sections = [
      {
        name: 'guide',
        files: [{ relativePath: 'guide/file|name.md' }],
        subsections: [],
      },
    ]
    const result = generateIndex(sections, {
      name: 'TestLib',
      docsPath: './docs',
    })
    expect(result).toContain('file%7Cname.md')
    expect(result).not.toContain('file|name.md')
  })

  it('URL-encodes comma characters in filenames', () => {
    const sections = [
      {
        name: 'guide',
        files: [{ relativePath: 'guide/a,b.md' }],
        subsections: [],
      },
    ]
    const result = generateIndex(sections, {
      name: 'TestLib',
      docsPath: './docs',
    })
    expect(result).toContain('a%2Cb.md')
    expect(result).not.toContain('a,b.md')
  })

  it('generateIndex output round-trips through injectIndex without corruption', () => {
    const sections = [{
      name: 'guide',
      files: [
        { relativePath: 'guide/file|with|pipes.md' },
        { relativePath: 'guide/file,with,commas.md' },
        { relativePath: 'guide/{braces}.md' },
      ],
      subsections: [],
    }]
    const index = generateIndex(sections, {
      name: 'TestLib',
      docsPath: './.agents-docs/testlib',
      version: 'main',
      libKey: 'testlib',
    })

    // Verify special characters are percent-encoded in the generated index
    expect(index).toContain('file%7Cwith%7Cpipes.md')
    expect(index).not.toContain('file|with|pipes.md')
    expect(index).toContain('file%2Cwith%2Ccommas.md')
    expect(index).toContain('%7Bbraces%7D.md')

    // Round-trip: inject → re-inject must be idempotent
    const injected = injectIndex('# My Project\n', index, 'testlib')
    const reinjected = injectIndex(injected, index, 'testlib')
    expect(reinjected).toBe(injected)

    expect(injected).toContain('<!-- DOCS-AGENTS-MD:testlib-START -->')
    expect(injected).toContain('<!-- DOCS-AGENTS-MD:testlib-END -->')
  })
})
