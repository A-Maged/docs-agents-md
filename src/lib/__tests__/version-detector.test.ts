import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { detectVersion } from '../version-detector.js'

vi.mock('fs')

function mockPackageJson(content: Record<string, unknown>) {
  vi.mocked(fs.existsSync).mockReturnValue(true)
  vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(content))
}

describe('detectVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- File system interaction ---

  it('reads package.json from process.cwd()', () => {
    mockPackageJson({ dependencies: { next: '15.0.0' } })
    detectVersion(['next'], 'v')

    const expectedPath = path.join(process.cwd(), 'package.json')
    expect(fs.existsSync).toHaveBeenCalledWith(expectedPath)
    expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8')
  })

  it('returns null when package.json does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    expect(detectVersion(['next'], 'v')).toBeNull()
    expect(fs.readFileSync).not.toHaveBeenCalled()
  })

  it('returns null when package is not in dependencies', () => {
    mockPackageJson({ dependencies: { 'other-lib': '1.0.0' } })
    expect(detectVersion(['next'], 'v')).toBeNull()
  })

  // --- Dependency source resolution ---

  it('detects from dependencies', () => {
    mockPackageJson({ dependencies: { next: '15.0.0' } })
    expect(detectVersion(['next'], 'v')).toEqual({
      packageName: 'next',
      version: '15.0.0',
      gitTag: 'v15.0.0',
    })
  })

  it('detects from devDependencies', () => {
    mockPackageJson({ devDependencies: { next: '14.2.0' } })
    expect(detectVersion(['next'], 'v')).toEqual({
      packageName: 'next',
      version: '14.2.0',
      gitTag: 'v14.2.0',
    })
  })

  it('detects from peerDependencies', () => {
    mockPackageJson({ peerDependencies: { react: '18.0.0' } })
    expect(detectVersion(['react'], 'v')).toEqual({
      packageName: 'react',
      version: '18.0.0',
      gitTag: 'v18.0.0',
    })
  })

  it('peerDependencies overrides dependencies for same package', () => {
    mockPackageJson({
      dependencies: { next: '14.0.0' },
      peerDependencies: { next: '15.0.0' },
    })
    expect(detectVersion(['next'], 'v')).toEqual({
      packageName: 'next',
      version: '15.0.0',
      gitTag: 'v15.0.0',
    })
  })

  // --- Version specifier stripping ---

  it('strips ^ prefix', () => {
    mockPackageJson({ dependencies: { next: '^15.1.0' } })
    expect(detectVersion(['next'], 'v')).toEqual({
      packageName: 'next',
      version: '15.1.0',
      gitTag: 'v15.1.0',
    })
  })

  it('strips ~ prefix', () => {
    mockPackageJson({ dependencies: { next: '~15.1.0' } })
    expect(detectVersion(['next'], 'v')).toEqual({
      packageName: 'next',
      version: '15.1.0',
      gitTag: 'v15.1.0',
    })
  })

  it('strips >= prefix', () => {
    mockPackageJson({ dependencies: { next: '>=15.0.0' } })
    expect(detectVersion(['next'], 'v')).toEqual({
      packageName: 'next',
      version: '15.0.0',
      gitTag: 'v15.0.0',
    })
  })

  it('strips workspace: prefix', () => {
    mockPackageJson({ dependencies: { next: 'workspace:^15.0.0' } })
    expect(detectVersion(['next'], 'v')).toEqual({
      packageName: 'next',
      version: '15.0.0',
      gitTag: 'v15.0.0',
    })
  })

  // --- Tag prefix formats ---

  it('applies svelte@ tagPrefix', () => {
    mockPackageJson({ dependencies: { svelte: '5.0.0' } })
    expect(detectVersion(['svelte'], 'svelte@')).toEqual({
      packageName: 'svelte',
      version: '5.0.0',
      gitTag: 'svelte@5.0.0',
    })
  })

  it('applies empty string tagPrefix (bare version)', () => {
    mockPackageJson({ dependencies: { '@angular/core': '19.0.0' } })
    expect(detectVersion(['@angular/core'], '')).toEqual({
      packageName: '@angular/core',
      version: '19.0.0',
      gitTag: '19.0.0',
    })
  })

  it('returns null gitTag when tagPrefix is null (docs repo)', () => {
    mockPackageJson({ dependencies: { react: '18.0.0' } })
    expect(detectVersion(['react'], null)).toEqual({
      packageName: 'react',
      version: '18.0.0',
      gitTag: null,
    })
  })

  // --- Package array resolution ---

  it('returns first matching package from array', () => {
    mockPackageJson({
      dependencies: { '@tanstack/react-query': '5.0.0' },
    })
    expect(
      detectVersion(['@tanstack/react-query', '@tanstack/vue-query'], 'v')
    ).toEqual({
      packageName: '@tanstack/react-query',
      version: '5.0.0',
      gitTag: 'v5.0.0',
    })
  })

  it('falls through to second package when first is absent', () => {
    mockPackageJson({
      dependencies: { '@tanstack/vue-query': '5.2.0' },
    })
    expect(
      detectVersion(['@tanstack/react-query', '@tanstack/vue-query'], 'v')
    ).toEqual({
      packageName: '@tanstack/vue-query',
      version: '5.2.0',
      gitTag: 'v5.2.0',
    })
  })

  it('returns null for empty packages array', () => {
    mockPackageJson({ dependencies: { next: '15.0.0' } })
    expect(detectVersion([], 'v')).toBeNull()
  })

  // --- Non-semver rejection ---

  it('skips workspace:* specifier (non-semver)', () => {
    mockPackageJson({ dependencies: { next: 'workspace:*' } })
    expect(detectVersion(['next'], 'v')).toBeNull()
  })

  it('skips latest specifier (non-semver)', () => {
    mockPackageJson({ dependencies: { next: 'latest' } })
    expect(detectVersion(['next'], 'v')).toBeNull()
  })

  it('extracts version from npm: alias', () => {
    mockPackageJson({ dependencies: { next: 'npm:@next/canary@15.0.0' } })
    expect(detectVersion(['next'], 'v')).toEqual({
      packageName: 'next',
      version: '15.0.0',
      gitTag: 'v15.0.0',
    })
  })

  it('extracts version from npm: alias with scoped package', () => {
    mockPackageJson({ dependencies: { react: 'npm:@preact/compat@10.0.0' } })
    expect(detectVersion(['react'], 'v')).toEqual({
      packageName: 'react',
      version: '10.0.0',
      gitTag: 'v10.0.0',
    })
  })

  it('skips malformed npm: alias without version', () => {
    mockPackageJson({ dependencies: { next: 'npm:foo' } })
    expect(detectVersion(['next'], 'v')).toBeNull()
  })

  // --- Prerelease ---

  it('handles prerelease versions', () => {
    mockPackageJson({ dependencies: { next: '15.0.0-beta.1' } })
    expect(detectVersion(['next'], 'v')).toEqual({
      packageName: 'next',
      version: '15.0.0-beta.1',
      gitTag: 'v15.0.0-beta.1',
    })
  })

  // --- Error handling ---

  it('returns null on malformed package.json', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json')
    expect(detectVersion(['next'], 'v')).toBeNull()
  })

  it('returns null when readFileSync throws', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })
    expect(detectVersion(['next'], 'v')).toBeNull()
  })

  it('skips non-string dependency values', () => {
    mockPackageJson({ dependencies: { next: 15 as unknown as string } })
    expect(detectVersion(['next'], 'v')).toBeNull()
  })
})
