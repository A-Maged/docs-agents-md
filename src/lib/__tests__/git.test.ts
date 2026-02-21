import { describe, it, expect } from 'vitest'
import { validateRepo, validateTag, validateDocsPath } from '../git.js'

describe('git input validation', () => {
  describe('validateRepo', () => {
    it('accepts valid repo formats', () => {
      expect(() => validateRepo('vercel/next.js')).not.toThrow()
      expect(() => validateRepo('facebook/react')).not.toThrow()
      expect(() => validateRepo('nestjs/docs.nestjs.com')).not.toThrow()
      expect(() => validateRepo('my-org/my-repo')).not.toThrow()
    })

    it('rejects invalid repo formats', () => {
      expect(() => validateRepo('just-a-name')).toThrow('Invalid repo format')
      expect(() => validateRepo('')).toThrow('Invalid repo format')
      expect(() => validateRepo('a/b/c')).toThrow('Invalid repo format')
      expect(() => validateRepo('owner/repo; rm -rf /')).toThrow(
        'Invalid repo format'
      )
      expect(() => validateRepo('owner/repo$(whoami)')).toThrow(
        'Invalid repo format'
      )
    })
  })

  describe('validateTag', () => {
    it('accepts valid tags', () => {
      expect(() => validateTag('v15.1.0')).not.toThrow()
      expect(() => validateTag('main')).not.toThrow()
      expect(() => validateTag('canary')).not.toThrow()
      expect(() => validateTag('feature/my-branch')).not.toThrow()
    })

    it('rejects invalid tags', () => {
      expect(() => validateTag('')).toThrow('Invalid tag format')
      expect(() => validateTag('; rm -rf /')).toThrow('Invalid tag format')
      expect(() => validateTag('tag$(whoami)')).toThrow('Invalid tag format')
    })
  })

  describe('validateDocsPath', () => {
    it('accepts valid doc paths', () => {
      expect(() => validateDocsPath('docs')).not.toThrow()
      expect(() => validateDocsPath('src/content')).not.toThrow()
      expect(() => validateDocsPath('documentation/docs')).not.toThrow()
    })

    it('rejects path traversal', () => {
      expect(() => validateDocsPath('../etc/passwd')).toThrow(
        'Invalid docs path'
      )
      expect(() => validateDocsPath('docs/../../etc')).toThrow(
        'Invalid docs path'
      )
    })

    it('rejects absolute paths', () => {
      expect(() => validateDocsPath('/etc/passwd')).toThrow(
        'Invalid docs path'
      )
    })

    it('rejects empty string', () => {
      expect(() => validateDocsPath('')).toThrow('Invalid docs path')
    })
  })

  describe('validateTag edge cases', () => {
    it('rejects backtick character', () => {
      // Backtick ` is not in TAG_REGEX charset — correctly rejected
      expect(() => validateTag('v1.0`whoami`')).toThrow()
    })

    it('accepts tags with @ and + characters', () => {
      expect(() => validateTag('v1.0.0+build.1')).not.toThrow()
      expect(() => validateTag('npm/@scope/pkg@1.0')).not.toThrow()
    })
  })
})
