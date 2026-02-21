/**
 * Gitignore management.
 * Ensures .agents-docs/ is in .gitignore.
 */

import fs from "fs";
import path from "path";
import { DOCS_BASE_DIR } from "./constants.js";

const GITIGNORE_ENTRY = `${DOCS_BASE_DIR}/`;
const COMMENT_HEADER = "# docs-agents-md";

export interface GitignoreResult {
  path: string;
  updated: boolean;
  alreadyPresent: boolean;
}

/**
 * Ensure .agents-docs/ is in .gitignore.
 * Creates .gitignore if it doesn't exist.
 * Idempotent — safe to call multiple times.
 */
export function ensureGitignoreEntry(cwd: string): GitignoreResult {
  const gitignorePath = path.join(cwd, ".gitignore");
  const entryRegex = new RegExp(`^\\s*\\${DOCS_BASE_DIR}(?:\\/.*)?$`);

  let content = "";
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, "utf-8");
  }

  const hasEntry = content.split(/\r?\n/).some((line) => entryRegex.test(line));

  if (hasEntry) {
    return { path: gitignorePath, updated: false, alreadyPresent: true };
  }

  const needsNewline = content.length > 0 && !content.endsWith("\n");
  const hasComment = content.includes(COMMENT_HEADER);
  const header = hasComment ? "" : `${COMMENT_HEADER}\n`;
  const newContent =
    content + (needsNewline ? "\n" : "") + header + `${GITIGNORE_ENTRY}\n`;

  fs.writeFileSync(gitignorePath, newContent, "utf-8");

  return { path: gitignorePath, updated: true, alreadyPresent: false };
}
