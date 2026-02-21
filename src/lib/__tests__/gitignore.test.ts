import { describe, it, expect } from 'vitest'
import { ensureGitignoreEntry } from '../gitignore.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('ensureGitignoreEntry', () => {
  it('creates .gitignore if it does not exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-test-'))

    try {
      const result = ensureGitignoreEntry(tmpDir)

      expect(result.updated).toBe(true)
      expect(result.alreadyPresent).toBe(false)

      const content = fs.readFileSync(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      )
      expect(content).toContain('.agents-docs/')
      expect(content).toContain('# docs-agents-md')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('appends to existing .gitignore', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-test-'))

    try {
      fs.writeFileSync(
        path.join(tmpDir, '.gitignore'),
        'node_modules/\n',
        'utf-8'
      )

      const result = ensureGitignoreEntry(tmpDir)

      expect(result.updated).toBe(true)
      const content = fs.readFileSync(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      )
      expect(content).toContain('node_modules/')
      expect(content).toContain('.agents-docs/')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('is idempotent - does not add duplicate entries', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-test-'))

    try {
      ensureGitignoreEntry(tmpDir)
      const result = ensureGitignoreEntry(tmpDir)

      expect(result.updated).toBe(false)
      expect(result.alreadyPresent).toBe(true)

      const content = fs.readFileSync(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      )
      const matches = content.match(/\.agents-docs/g)
      expect(matches).toHaveLength(1)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
