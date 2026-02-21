/**
 * Shared constants and utilities for docs-agents-md.
 * Single source of truth for values used across multiple modules.
 */

/** Directory name for cached documentation downloads */
export const DOCS_BASE_DIR = ".agents-docs";

/** Default output file name for generated index */
export const DEFAULT_OUTPUT = "AGENTS.md";

/** Validates GitHub repository format: owner/repo */
export const REPO_REGEX = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

/** Validates git tag/branch format — allows alphanumeric, dots, hyphens, slashes, plus, at */
export const TAG_REGEX = /^[a-zA-Z0-9._\-\/+@]+$/;

/** Validates library name format — lowercase alphanumeric, dots, hyphens, underscores */
export const NAME_REGEX = /^[a-z0-9._-]+$/;

/** Format byte count to human-readable size string */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
