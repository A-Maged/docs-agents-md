/**
 * Git sparse-checkout downloader.
 * Downloads only the docs folder from a GitHub repo efficiently.
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { REPO_REGEX, TAG_REGEX } from "./constants.js";

export function validateRepo(repo: string): void {
  if (!REPO_REGEX.test(repo)) {
    throw new Error(
      `Invalid repo format: "${repo}". Expected: owner/repo (e.g., vercel/next.js)`,
    );
  }
}

export function validateTag(tag: string): void {
  if (!TAG_REGEX.test(tag)) {
    throw new Error(
      `Invalid tag format: "${tag}". Expected a git tag or branch name (e.g., v15.1.0, main)`,
    );
  }
}

export function validateDocsPath(docsPath: string): void {
  if (!docsPath || docsPath.includes("..") || path.isAbsolute(docsPath)) {
    throw new Error(
      `Invalid docs path: "${docsPath}". Must be a non-empty relative path without "..".`,
    );
  }
}

export interface CloneDocsOptions {
  repo: string;
  tag: string;
  docsPath: string;
  destDir: string;
  timeoutMs?: number;
}

export interface CloneDocsResult {
  success: boolean;
  error?: string;
}

export function cloneDocs(options: CloneDocsOptions): CloneDocsResult {
  const { repo, tag, docsPath, destDir, timeoutMs = 60_000 } = options;

  // Validate inputs — throw hard before any I/O
  validateRepo(repo);
  validateTag(tag);
  validateDocsPath(docsPath);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-agents-md-"));

  try {
    // Step 1: Shallow clone with sparse filter
    try {
      execFileSync(
        "git",
        [
          "clone",
          "--depth",
          "1",
          "--filter=blob:none",
          "--sparse",
          "--branch",
          tag,
          `https://github.com/${repo}.git`,
          ".",
        ],
        { cwd: tempDir, stdio: "pipe", timeout: timeoutMs },
      );
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);

      if (error.killed || error.signal === "SIGTERM") {
        throw new Error(
          `Git clone timed out after ${timeoutMs / 1000}s. Check your network or try again.`,
        );
      }
      if (message.includes("not found") || message.includes("did not match")) {
        throw new Error(
          `Could not find tag/branch "${tag}" in repo "${repo}". Verify it exists on GitHub.`,
        );
      }
      if (
        message.includes("Could not resolve host") ||
        message.includes("unable to access")
      ) {
        throw new Error(
          `Network error: Could not reach GitHub. Check your internet connection.`,
        );
      }
      throw error;
    }

    // Step 2: Sparse-checkout the docs folder
    execFileSync("git", ["sparse-checkout", "set", docsPath], {
      cwd: tempDir,
      stdio: "pipe",
      timeout: 10_000,
    });

    // Step 3: Verify the docs folder exists
    const sourceDocsDir = path.join(tempDir, docsPath);
    if (!fs.existsSync(sourceDocsDir)) {
      throw new Error(
        `Docs folder "${docsPath}" not found in ${repo}@${tag}. Check the --docs-path value.`,
      );
    }

    // Step 4: Copy docs to destination
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true });
    }
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(sourceDocsDir, destDir, { recursive: true });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Always clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
