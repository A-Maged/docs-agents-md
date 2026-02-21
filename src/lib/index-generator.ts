/**
 * Index generator.
 * Produces a compact, single-line, pipe-separated index for AI agents.
 */

import type { DocSection } from "./tree.js";
import { DEFAULT_OUTPUT } from "./constants.js";

export interface IndexMeta {
  name: string;
  docsPath: string;
  version?: string;
  outputFile?: string;
  libKey?: string;
  repo?: string;
  repoDocsPath?: string;
}

/**
 * Generate a compact single-line index from doc sections.
 * Format: [Name Docs Index v1.0]|root: path|IMPORTANT: ...|dir:{files}|...
 */
export function generateIndex(sections: DocSection[], meta: IndexMeta): string {
  const { name, docsPath, version, outputFile, libKey } = meta;

  const parts: string[] = [];

  // Header with library name and version
  const versionSuffix = version ? ` v${version}` : "";
  parts.push(`[${name} Docs Index${versionSuffix}]`);

  // Root path
  parts.push(`root: ${docsPath}`);

  // Retrieval-led reasoning instruction
  parts.push(
    `IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any ${name} tasks.`,
  );

  // Regeneration command — include full flags so agents can auto-run
  const target = outputFile || DEFAULT_OUTPUT;
  let regenCmd = "npx docs-agents-md";
  if (libKey) {
    regenCmd += ` --lib ${libKey}`;
  } else if (meta.repo) {
    regenCmd += ` --repo ${meta.repo} --name ${name.toLowerCase()}`;
    if (meta.repoDocsPath) regenCmd += ` --docs-path ${meta.repoDocsPath}`;
  }
  regenCmd += ` --output ${target}`;
  parts.push(`If docs missing, run: ${regenCmd}`);

  // File listing grouped by directory
  const allFiles = collectAllFiles(sections);
  const grouped = groupByDirectory(allFiles);

  for (const [dir, files] of grouped) {
    const safeFiles = files.map((f) =>
      f
        .replace(/\|/g, "%7C")
        .replace(/,/g, "%2C")
        .replace(/\{/g, "%7B")
        .replace(/\}/g, "%7D"),
    );
    parts.push(`${dir}:{${safeFiles.join(",")}}`);
  }

  return parts.join("|");
}

function collectAllFiles(sections: DocSection[]): string[] {
  const files: string[] = [];

  for (const section of sections) {
    for (const file of section.files) {
      files.push(file.relativePath);
    }
    files.push(...collectAllFiles(section.subsections));
  }

  return files;
}

function groupByDirectory(files: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const filePath of files) {
    const lastSlash = filePath.lastIndexOf("/");
    const dir = lastSlash === -1 ? "." : filePath.slice(0, lastSlash);
    const fileName =
      lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);

    const existing = grouped.get(dir);
    if (existing) {
      existing.push(fileName);
    } else {
      grouped.set(dir, [fileName]);
    }
  }

  return grouped;
}
