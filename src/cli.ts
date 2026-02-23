/**
 * CLI entry point for docs-agents-md.
 * Supports interactive mode, --lib presets, and raw --repo mode.
 */

import fs from "fs";
import path from "path";
import { createRequire } from "node:module";
import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { cloneDocs, validateRepo } from "./lib/git.js";
import { collectDocFiles, buildDocTree } from "./lib/tree.js";
import { generateIndex } from "./lib/index-generator.js";
import { injectIndex } from "./lib/inject.js";
import { ensureGitignoreEntry } from "./lib/gitignore.js";
import {
  getRegistryEntry,
  listRegistryKeys,
  REGISTRY,
} from "./lib/registry.js";
import { fetchRepoTree, detectDocsPath } from "./lib/docs-detector.js";
import { detectVersion } from "./lib/version-detector.js";
import {
  DOCS_BASE_DIR,
  DEFAULT_OUTPUT,
  REPO_REGEX as _REPO_REGEX,
  NAME_REGEX as _NAME_REGEX,
  TAG_REGEX as _TAG_REGEX,
  formatSize,
} from "./lib/constants.js";

// Bind regex references to local consts so tsup doesn't lose them
// during bundle-time variable renaming (esbuild collision bug).
const isValidRepo = (v: string) => _REPO_REGEX.test(v);
const isValidName = (v: string) => _NAME_REGEX.test(v);
const isValidTag = (v: string) => _TAG_REGEX.test(v);
import {
  ON_CANCEL,
  promptForOutputFile,
  confirmOrAutoAccept,
} from "./lib/prompt-helpers.js";

interface ResolvedOptions {
  repo: string;
  tag: string;
  docsPath: string;
  name: string;
  displayName: string;
  output: string;
  extensions: string[];
  libKey?: string;
  /** Clean semver for index header display (avoids double-v in index-generator) */
  detectedVersion?: string;
}

async function resolveOptions(flags: {
  repo?: string;
  tag?: string;
  docsPath?: string;
  name?: string;
  lib?: string;
  output?: string;
  extensions?: string;
}): Promise<ResolvedOptions> {
  const extensions = flags.extensions
    ? flags.extensions.split(",").map((e) => e.trim())
    : ["md", "mdx"];
  const output = flags.output || DEFAULT_OUTPUT;

  // Early validation: reject explicitly empty --docs-path
  if (flags.docsPath !== undefined && !flags.docsPath.trim()) {
    console.error(pc.red("Error: --docs-path cannot be empty."));
    process.exit(1);
  }

  // Conflict check
  if (flags.lib && flags.repo) {
    console.error(
      pc.red(
        "Error: --lib and --repo are mutually exclusive. Use one or the other.",
      ),
    );
    process.exit(1);
  }

  // Warn about ignored flags with --lib
  if (flags.lib) {
    const ignored: string[] = [];
    if (flags.name) ignored.push("--name");
    if (flags.docsPath) ignored.push("--docs-path");
    if (ignored.length > 0) {
      console.warn(
        pc.yellow(
          `Warning: ${ignored.join(", ")} ignored when using --lib (registry values used)`,
        ),
      );
    }
  }

  // Mode 1: Registry preset
  if (flags.lib) {
    const entry = getRegistryEntry(flags.lib);
    if (!entry) {
      console.error(
        pc.red(
          `Unknown library: "${flags.lib}". Run "docs-agents-md list" to see available presets.`,
        ),
      );
      process.exit(1);
    }

    // Warn about --extensions when preset has custom extensions
    if (flags.extensions && entry.extensions) {
      console.warn(
        pc.yellow(
          "Warning: --extensions ignored when using --lib (registry values used)",
        ),
      );
    }
    // Version detection when --tag is not provided
    let tag = flags.tag || entry.defaultTag;
    let detectedVersion: string | undefined;

    if (!flags.tag && entry.packages.length > 0 && entry.tagPrefix != null) {
      const detected = detectVersion(entry.packages, entry.tagPrefix);
      if (detected?.gitTag) {
        const accepted = await confirmOrAutoAccept({
          confirmMessage: `Detected ${entry.name} ${detected.version} → use tag ${pc.cyan(detected.gitTag)}?`,
          autoMessage: `Auto-detected ${entry.name} ${detected.version} → ${detected.gitTag}`,
        });
        if (accepted) {
          tag = detected.gitTag;
          detectedVersion = detected.version;
        }
      }
    }

    return {
      repo: entry.repo,
      tag,
      docsPath: entry.docsPath,
      name: flags.lib.toLowerCase(),
      displayName: entry.name,
      output,
      extensions: entry.extensions || extensions,
      libKey: flags.lib.toLowerCase(),
      detectedVersion,
    };
  }

  // Mode 2: Raw repo
  if (flags.repo) {
    try {
      validateRepo(flags.repo);
    } catch (e: any) {
      console.error(pc.red(`Error: ${e.message}`));
      process.exit(1);
    }
    if (!flags.name) {
      console.error(
        pc.red(
          "Error: --name is required when using --repo.\n" +
            "Example: npx docs-agents-md --repo owner/repo --name mylib --tag main",
        ),
      );
      process.exit(1);
    }
    const safeName = flags.name.trim().toLowerCase();
    if (!isValidName(safeName)) {
      console.error(
        pc.red(
          `Error: --name "${flags.name}" contains invalid characters. Use only letters, numbers, dots, hyphens, underscores.`,
        ),
      );
      process.exit(1);
    }

    let docsPath = flags.docsPath || "";
    const tag = flags.tag || "main";

    // Auto-detect docs path if not explicitly provided
    if (!flags.docsPath) {
      console.log(pc.gray("Detecting docs folder via GitHub API..."));
      const treePaths = await fetchRepoTree(flags.repo, tag);
      if (treePaths) {
        const detected = detectDocsPath(treePaths);
        if (detected) {
          const accepted = await confirmOrAutoAccept({
            confirmMessage: `Detected docs at "${detected}". Use this path?`,
            autoMessage: `Auto-detected docs path: "${detected}"`,
          });
          docsPath = accepted ? detected : "docs";
          if (!accepted) {
            console.log(pc.yellow('Using default "docs" path'));
          }
        } else {
          console.log(
            pc.yellow(
              'Could not auto-detect docs folder, using default "docs"',
            ),
          );
          docsPath = "docs";
        }
      } else {
        docsPath = "docs";
      }
    }

    return {
      repo: flags.repo,
      tag,
      docsPath,
      name: safeName,
      displayName: flags.name.trim(),
      output,
      extensions,
    };
  }

  // Mode 3: Interactive
  return await promptForOptions(output, extensions);
}

async function promptForOptions(
  defaultOutput: string,
  defaultExtensions: string[],
): Promise<ResolvedOptions> {
  console.log(
    pc.cyan("\n📚 docs-agents-md — Documentation Index for AI Agents\n"),
  );

  const keys = listRegistryKeys();
  const presetChoices = keys.map((k) => ({
    title: `${REGISTRY[k].name} (${REGISTRY[k].repo})`,
    value: k,
  }));

  const modeResponse = await prompts(
    {
      type: "select",
      name: "mode",
      message: "Choose a library or enter custom repo",
      choices: [
        ...presetChoices,
        { title: "Custom GitHub repo...", value: "__custom__" },
      ],
    },
    ON_CANCEL,
  );

  if (modeResponse.mode !== "__custom__") {
    const entry = REGISTRY[modeResponse.mode];

    // Detect version to pre-fill tag prompt
    let tagInitial = entry.defaultTag;
    let detectedVersion: string | undefined;

    if (entry.packages.length > 0 && entry.tagPrefix != null) {
      const detected = detectVersion(entry.packages, entry.tagPrefix);
      if (detected?.gitTag) {
        tagInitial = detected.gitTag;
        detectedVersion = detected.version;
        console.log(pc.green(`  Detected ${entry.name} ${detected.version}`));
      }
    }

    const tagResponse = await prompts(
      {
        type: "text",
        name: "tag",
        message: `Git tag/branch for ${entry.name}`,
        initial: tagInitial,
      },
      ON_CANCEL,
    );

    // If user changed the tag from the detected one, clear detectedVersion
    if (tagResponse.tag !== tagInitial) {
      detectedVersion = undefined;
    }

    const output = await promptForOutputFile();

    return {
      repo: entry.repo,
      tag: tagResponse.tag,
      docsPath: entry.docsPath,
      name: modeResponse.mode,
      displayName: entry.name,
      output,
      extensions: entry.extensions || defaultExtensions,
      libKey: modeResponse.mode,
      detectedVersion,
    };
  }

  // Custom repo mode — collect repo, name, tag first
  const customResponse = await prompts(
    [
      {
        type: "text",
        name: "repo",
        message: "GitHub repo (owner/repo)",
        validate: (v: string) =>
          isValidRepo(v.trim()) ? true : "Format: owner/repo",
      },
      {
        type: "text",
        name: "name",
        message: "Library name (used for markers/directory)",
        validate: (v: string) => {
          const trimmed = v.trim().toLowerCase();
          if (!trimmed) return "Required";
          if (!isValidName(trimmed))
            return "Use only letters, numbers, dots, hyphens, underscores";
          return true;
        },
      },
      {
        type: "text",
        name: "tag",
        message: "Git tag or branch",
        initial: "main",
        validate: (v: string) =>
          isValidTag(v.trim()) ? true : "Invalid characters in tag",
      },
    ],
    ON_CANCEL,
  );

  const repo = customResponse.repo.trim();
  const tag = customResponse.tag.trim();

  // Auto-detect docs path
  let docsPath = "";
  console.log(pc.gray("Detecting docs folder via GitHub API..."));
  const treePaths = await fetchRepoTree(repo, tag);
  if (treePaths) {
    const detected = detectDocsPath(treePaths);
    if (detected) {
      const accepted = await confirmOrAutoAccept({
        confirmMessage: `Detected docs at "${detected}". Use this path?`,
        autoMessage: `Auto-detected docs path: "${detected}"`,
      });
      if (accepted) {
        docsPath = detected;
      }
    }
  }

  // Fall back to manual prompt if auto-detection didn't resolve
  if (!docsPath) {
    console.log(pc.yellow("Could not auto-detect docs folder."));
    const docsPathResponse = await prompts(
      {
        type: "text",
        name: "docsPath",
        message: "Path to docs folder in repo",
        initial: "docs",
        validate: (v: string) => {
          const t = v.trim();
          if (!t) return "Required";
          if (t.includes("..")) return "Path traversal (..) not allowed";
          if (path.isAbsolute(t)) return "Must be a relative path";
          return true;
        },
      },
      ON_CANCEL,
    );
    docsPath = docsPathResponse.docsPath.trim();
  }

  const output = await promptForOutputFile();

  return {
    repo,
    tag,
    docsPath,
    name: customResponse.name.trim().toLowerCase(),
    displayName: customResponse.name.trim(),
    output,
    extensions: defaultExtensions,
  };
}

async function runAdd(flags: {
  repo?: string;
  tag?: string;
  docsPath?: string;
  name?: string;
  lib?: string;
  output?: string;
  extensions?: string;
}) {
  const options = await resolveOptions(flags);
  const cwd = process.cwd();
  const docsDir = path.join(cwd, DOCS_BASE_DIR, options.name);
  const docsLinkPath = `./${DOCS_BASE_DIR}/${options.name}`;
  const targetPath = path.resolve(cwd, options.output);

  // B-6: Validate output path stays within project directory
  if (!targetPath.startsWith(cwd + path.sep)) {
    console.error(
      pc.red(
        `Error: Output path "${options.output}" resolves outside the project directory.`,
      ),
    );
    process.exit(1);
  }

  // Read existing file if present
  let existingContent = "";
  let sizeBefore = 0;
  let isNewFile = true;

  if (fs.existsSync(targetPath)) {
    existingContent = fs.readFileSync(targetPath, "utf-8");
    sizeBefore = Buffer.byteLength(existingContent, "utf-8");
    isNewFile = false;
  }

  // Download docs
  console.log(
    `\nDownloading ${pc.cyan(options.displayName)} docs from ${pc.gray(options.repo)}@${pc.cyan(options.tag)}...`,
  );

  const result = cloneDocs({
    repo: options.repo,
    tag: options.tag,
    docsPath: options.docsPath,
    destDir: docsDir,
  });

  if (!result.success) {
    console.error(pc.red(`\n✗ ${result.error}`));
    process.exit(1);
  }

  // Build index
  const docFiles = collectDocFiles(docsDir, options.extensions);

  if (docFiles.length === 0) {
    console.warn(
      pc.yellow(
        `\n⚠ No doc files found (extensions: ${options.extensions.join(", ")}). ` +
          `Try --extensions to include other file types.`,
      ),
    );
    process.exit(1);
  }

  const sections = buildDocTree(docFiles);
  const indexContent = generateIndex(sections, {
    name: options.displayName,
    docsPath: docsLinkPath,
    version:
      options.detectedVersion ||
      (/^v\d/.test(options.tag) ? options.tag.replace(/^v/, "") : undefined),
    outputFile: options.output,
    libKey: options.libKey,
    repo: options.repo,
    repoDocsPath: options.docsPath,
  });

  // Inject into target file
  const newContent = injectIndex(existingContent, indexContent, options.name);
  fs.writeFileSync(targetPath, newContent, "utf-8");

  const sizeAfter = Buffer.byteLength(newContent, "utf-8");

  // Update .gitignore
  const gitignoreResult = ensureGitignoreEntry(cwd);

  // Output results
  const action = isNewFile ? "Created" : "Updated";
  const sizeInfo = isNewFile
    ? formatSize(sizeAfter)
    : `${formatSize(sizeBefore)} → ${formatSize(sizeAfter)}`;

  console.log(
    `${pc.green("✓")} ${action} ${pc.bold(options.output)} (${sizeInfo})`,
  );
  console.log(
    `${pc.green("✓")} ${docFiles.length} doc files indexed from ${pc.gray(docsLinkPath)}`,
  );
  if (gitignoreResult.updated) {
    console.log(
      `${pc.green("✓")} Added ${pc.bold(DOCS_BASE_DIR)} to .gitignore`,
    );
  }
  console.log("");
}

// --- CLI Setup ---

const program = new Command();

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

program
  .name("docs-agents-md")
  .description(
    "Download documentation from any GitHub repo and generate a compact index for AI coding agents.",
  )
  .version(pkg.version);

program
  .command("add", { isDefault: true })
  .description("Add documentation index for a library")
  .option("--repo <owner/repo>", "GitHub repository (e.g., vercel/next.js)")
  .option(
    "--tag <tag>",
    "Git tag or branch (default: main for --repo, preset-specific for --lib)",
  )
  .option("--docs-path <path>", "Path to docs folder in repo (default: docs)")
  .option(
    "--name <name>",
    "Library name for markers/directory (required with --repo)",
  )
  .option(
    "--lib <name>",
    "Use a built-in library preset (e.g., nextjs, react, angular, tailwindcss)",
  )
  .option("--output <file>", "Target agent file (default: AGENTS.md)")
  .option(
    "--extensions <exts>",
    "Comma-separated file extensions (default: md,mdx)",
  )
  .action(async (options) => {
    try {
      await runAdd(options);
    } catch (error) {
      console.error(
        pc.red(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all available library presets")
  .action(() => {
    console.log(pc.cyan("\n📚 Available library presets:\n"));

    const keys = listRegistryKeys();
    const maxKeyLen = Math.max(...keys.map((k) => k.length));

    for (const key of keys) {
      const entry = REGISTRY[key];
      const paddedKey = key.padEnd(maxKeyLen);
      console.log(
        `  ${pc.bold(paddedKey)}  ${pc.gray(entry.repo)} → ${pc.gray(entry.docsPath)} (${entry.defaultTag})`,
      );
    }

    console.log(`\n  Usage: ${pc.cyan("npx docs-agents-md --lib <name>")}\n`);
  });

program.parse();
