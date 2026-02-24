import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to create mock references that can be used inside vi.mock factory
const { mockExecFileSync, mockFs } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
  mockFs: {
    mkdtempSync: vi.fn(() => "/tmp/fake-docs-agents-md-xxx"),
    existsSync: vi.fn(),
    rmSync: vi.fn(),
    mkdirSync: vi.fn(),
    cpSync: vi.fn(),
  },
}));

vi.mock("child_process", () => ({ execFileSync: mockExecFileSync }));
vi.mock("fs", () => ({ default: mockFs }));

import { cloneDocs } from "../git.js";

const BASE_OPTIONS = {
  repo: "owner/repo",
  tag: "v1.0.0",
  docsPath: "docs",
  destDir: "/out/docs",
};

describe("cloneDocs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success on happy path", () => {
    // existsSync calls: sourceDocsDir=true, destDir=false, tempDir=true (cleanup)
    mockFs.existsSync
      .mockReturnValueOnce(true) // sourceDocsDir exists
      .mockReturnValueOnce(false) // destDir doesn't exist yet
      .mockReturnValueOnce(true); // tempDir exists for cleanup

    const result = cloneDocs(BASE_OPTIONS);

    expect(result).toEqual({ success: true });
    expect(mockExecFileSync).toHaveBeenCalledTimes(2); // clone + sparse-checkout
    expect(mockFs.cpSync).toHaveBeenCalledTimes(1);
    expect(mockFs.rmSync).toHaveBeenCalled(); // temp cleanup
  });

  it("passes git env overrides and progress stdio to both steps", () => {
    mockFs.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    cloneDocs(BASE_OPTIONS);

    // Both clone and sparse-checkout should receive env overrides
    for (const call of mockExecFileSync.mock.calls) {
      const opts = call[2] as { env?: Record<string, string>; stdio?: unknown };
      expect(opts.env).toBeDefined();
      expect(opts.env!.GIT_HTTP_LOW_SPEED_LIMIT).toBe("0");
      expect(opts.env!.GIT_HTTP_LOW_SPEED_TIME).toBe("999999");
      expect(opts.stdio).toEqual(["pipe", "pipe", "inherit"]);
    }

    // Clone should include --progress flag
    const cloneArgs = mockExecFileSync.mock.calls[0][1] as string[];
    expect(cloneArgs).toContain("--progress");
  });

  it("returns timeout error when clone is killed", () => {
    const error = Object.assign(new Error("killed"), {
      killed: true,
      signal: "SIGTERM",
    });
    mockExecFileSync.mockImplementationOnce(() => {
      throw error;
    });
    mockFs.existsSync.mockReturnValue(true); // for cleanup

    const result = cloneDocs(BASE_OPTIONS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timed out/i);
  });

  it("returns not-found error for invalid tag", () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error("fatal: Remote branch v999 did not match any");
    });
    mockFs.existsSync.mockReturnValue(true);

    const result = cloneDocs({ ...BASE_OPTIONS, tag: "v999" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not find tag/);
  });

  it("returns network error when host is unreachable", () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error("fatal: Could not resolve host github.com");
    });
    mockFs.existsSync.mockReturnValue(true);

    const result = cloneDocs(BASE_OPTIONS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/network error/i);
  });

  it("returns error when docs folder does not exist after checkout", () => {
    // clone and sparse-checkout succeed
    mockExecFileSync.mockImplementation(() => {});
    // sourceDocsDir doesn't exist
    mockFs.existsSync
      .mockReturnValueOnce(false) // sourceDocsDir missing
      .mockReturnValueOnce(true); // tempDir exists for cleanup

    const result = cloneDocs(BASE_OPTIONS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("cleans up temp directory even on failure", () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error("fatal: Could not resolve host");
    });
    mockFs.existsSync.mockReturnValue(true);

    cloneDocs(BASE_OPTIONS);

    // rmSync should be called at least once for the temp dir
    expect(mockFs.rmSync).toHaveBeenCalledWith("/tmp/fake-docs-agents-md-xxx", {
      recursive: true,
      force: true,
    });
  });
});
