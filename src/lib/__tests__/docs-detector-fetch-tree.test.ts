import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingMessage, ClientRequest } from 'node:http'

// Use vi.hoisted to create mock reference available inside vi.mock factory
const mockGet = vi.hoisted(() => vi.fn())
vi.mock('node:https', () => ({
  default: { get: mockGet },
}))

import { fetchRepoTree } from '../docs-detector.js'

/**
 * Helper: simulate a GitHub API response for https.get.
 * Calls the callback with a fake IncomingMessage that fires data + end events.
 */
function simulateResponse(statusCode: number, body: string) {
  mockGet.mockImplementationOnce((_opts: any, cb: (res: IncomingMessage) => void) => {
    const handlers: Record<string, Function[]> = {}
    const fakeRes = {
      statusCode,
      on(event: string, handler: Function) {
        if (!handlers[event]) handlers[event] = []
        handlers[event].push(handler)
        if (event === 'end') {
          queueMicrotask(() => {
            if (statusCode === 200) {
              handlers['data']?.forEach((fn) => fn(Buffer.from(body)))
            }
            handlers['end']?.forEach((fn) => fn())
          })
        }
        return fakeRes
      },
      resume() {},
    } as unknown as IncomingMessage
    cb(fakeRes)
    return { on: vi.fn(), destroy: vi.fn() } as unknown as ClientRequest
  })
}

function simulateNon200(statusCode: number) {
  mockGet.mockImplementationOnce((_opts: any, cb: (res: IncomingMessage) => void) => {
    const fakeRes = {
      statusCode,
      resume() {},
      on() { return fakeRes },
    } as unknown as IncomingMessage
    cb(fakeRes)
    return { on: vi.fn(), destroy: vi.fn() } as unknown as ClientRequest
  })
}

describe('fetchRepoTree', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns blob paths on happy path', async () => {
    // First call: commit endpoint
    simulateResponse(200, JSON.stringify({
      commit: { tree: { sha: 'tree-sha-123' } },
    }))
    // Second call: tree endpoint
    simulateResponse(200, JSON.stringify({
      tree: [
        { path: 'docs/intro.md', type: 'blob' },
        { path: 'docs', type: 'tree' },
        { path: 'docs/guide.md', type: 'blob' },
      ],
    }))

    const result = await fetchRepoTree('owner/repo', 'main')
    expect(result).toEqual(['docs/intro.md', 'docs/guide.md'])
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('returns null when commit API returns rate limit (403)', async () => {
    simulateNon200(403)

    const result = await fetchRepoTree('owner/repo', 'v1.0.0')
    expect(result).toBeNull()
  })

  it('returns null when commit data is malformed (no commit.tree.sha)', async () => {
    simulateResponse(200, JSON.stringify({ commit: {} }))

    const result = await fetchRepoTree('owner/repo', 'main')
    expect(result).toBeNull()
  })

  it('returns null when tree API returns 404', async () => {
    simulateResponse(200, JSON.stringify({
      commit: { tree: { sha: 'tree-sha-123' } },
    }))
    simulateNon200(404)

    const result = await fetchRepoTree('owner/repo', 'main')
    expect(result).toBeNull()
  })

  it('returns empty array for empty tree', async () => {
    simulateResponse(200, JSON.stringify({
      commit: { tree: { sha: 'tree-sha-123' } },
    }))
    simulateResponse(200, JSON.stringify({ tree: [] }))

    const result = await fetchRepoTree('owner/repo', 'main')
    expect(result).toEqual([])
  })

  it('filters only blobs, excludes tree entries', async () => {
    simulateResponse(200, JSON.stringify({
      commit: { tree: { sha: 'tree-sha-123' } },
    }))
    simulateResponse(200, JSON.stringify({
      tree: [
        { path: 'src', type: 'tree' },
        { path: 'src/index.ts', type: 'blob' },
        { path: 'docs', type: 'tree' },
        { path: 'docs/readme.md', type: 'blob' },
      ],
    }))

    const result = await fetchRepoTree('owner/repo', 'main')
    expect(result).toEqual(['src/index.ts', 'docs/readme.md'])
  })
})
