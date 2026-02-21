import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingMessage, ClientRequest } from 'node:http'

// Use vi.hoisted to ensure mockGet is available when vi.mock factory is hoisted
const mockGet = vi.hoisted(() => vi.fn())
vi.mock('node:https', () => ({
  default: { get: mockGet },
}))

// Import AFTER mock is set up (hoisted by vitest)
const { githubGet } = await import('../docs-detector.js')

/**
 * Helper: create a fake IncomingMessage with the given statusCode and body.
 */
function fakeResponse(statusCode: number, body: string) {
  const handlers: Record<string, Function[]> = {}
  return {
    statusCode,
    on(event: string, cb: Function) {
      if (!handlers[event]) handlers[event] = []
      handlers[event].push(cb)
      // Auto-fire data + end events after registration
      if (event === 'end') {
        queueMicrotask(() => {
          handlers['data']?.forEach((fn) => fn(Buffer.from(body)))
          handlers['end']?.forEach((fn) => fn())
        })
      }
      return this as unknown as IncomingMessage
    },
    resume() {},
  }
}

/**
 * Helper: create a fake IncomingMessage that only needs resume() (non-200).
 */
function fakeNon200Response(statusCode: number) {
  return {
    statusCode,
    resume() {},
    on() {
      return this as unknown as IncomingMessage
    },
  }
}

describe('githubGet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns parsed JSON on 200 with valid body', async () => {
    const body = JSON.stringify({ name: 'test-repo', id: 42 })
    mockGet.mockImplementation((_opts: any, cb: (res: IncomingMessage) => void) => {
      cb(fakeResponse(200, body) as unknown as IncomingMessage)
      return { on: vi.fn(), destroy: vi.fn() } as unknown as ClientRequest
    })

    const result = await githubGet('/repos/owner/repo')
    expect(result).toEqual({ name: 'test-repo', id: 42 })
  })

  it('returns null on 403 (rate limit)', async () => {
    mockGet.mockImplementation((_opts: any, cb: (res: IncomingMessage) => void) => {
      cb(fakeNon200Response(403) as unknown as IncomingMessage)
      return { on: vi.fn(), destroy: vi.fn() } as unknown as ClientRequest
    })

    const result = await githubGet('/repos/owner/repo')
    expect(result).toBeNull()
  })

  it('returns null on non-200 status (404)', async () => {
    mockGet.mockImplementation((_opts: any, cb: (res: IncomingMessage) => void) => {
      cb(fakeNon200Response(404) as unknown as IncomingMessage)
      return { on: vi.fn(), destroy: vi.fn() } as unknown as ClientRequest
    })

    const result = await githubGet('/repos/owner/repo')
    expect(result).toBeNull()
  })

  it('returns null on malformed JSON', async () => {
    mockGet.mockImplementation((_opts: any, cb: (res: IncomingMessage) => void) => {
      cb(fakeResponse(200, '{{not json}}') as unknown as IncomingMessage)
      return { on: vi.fn(), destroy: vi.fn() } as unknown as ClientRequest
    })

    const result = await githubGet('/repos/owner/repo')
    expect(result).toBeNull()
  })
})
