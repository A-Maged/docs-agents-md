/**
 * Shared prompt helpers for CLI interactive flows.
 * Eliminates duplication of output file prompts, TTY checks, and onCancel handlers.
 */

import prompts from "prompts";
import pc from "picocolors";
import { DEFAULT_OUTPUT } from "./constants.js";

/** Shared onCancel handler — exits cleanly on Ctrl+C */
export const ON_CANCEL = {
  onCancel: () => {
    process.exit(0);
  },
};

/**
 * Prompt user to select output file (AGENTS.md, CLAUDE.md, or custom).
 * Used in both preset and custom interactive flows.
 */
export async function promptForOutputFile(): Promise<string> {
  const outputResponse = await prompts(
    {
      type: "select",
      name: "output",
      message: "Target file",
      choices: [
        { title: DEFAULT_OUTPUT, value: DEFAULT_OUTPUT },
        { title: "CLAUDE.md", value: "CLAUDE.md" },
        { title: "Custom...", value: "__custom__" },
      ],
    },
    ON_CANCEL,
  );

  if (outputResponse.output === "__custom__") {
    const customResponse = await prompts(
      {
        type: "text",
        name: "file",
        message: "Enter file path",
        initial: DEFAULT_OUTPUT,
      },
      ON_CANCEL,
    );
    return customResponse.file;
  }

  return outputResponse.output;
}

/**
 * TTY-aware confirm-or-auto-accept pattern.
 * In TTY: prompts user for confirmation.
 * In non-TTY: auto-accepts and logs.
 */
export async function confirmOrAutoAccept(opts: {
  confirmMessage: string;
  autoMessage: string;
}): Promise<boolean> {
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  if (isTTY) {
    const confirm = await prompts(
      {
        type: "confirm",
        name: "ok",
        message: opts.confirmMessage,
        initial: true,
      },
      ON_CANCEL,
    );
    return confirm.ok;
  }
  console.log(pc.green(opts.autoMessage));
  return true;
}
