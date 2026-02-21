import { describe, it, expect } from "vitest";
import { injectIndex, hasExistingIndex, removeIndex } from "../inject.js";

const marker = (name: string, type: "START" | "END") =>
  `<!-- DOCS-AGENTS-MD:${name}-${type} -->`;

describe("injectIndex", () => {
  it("appends to empty string without leading blank lines", () => {
    const result = injectIndex("", "content", "react");
    expect(result).toBe(
      `${marker("react", "START")}content${marker("react", "END")}\n`,
    );
  });

  it("appends to file without markers", () => {
    const existing = "# My Project\n\nSome content.";
    const result = injectIndex(existing, "content", "nextjs");
    expect(result).toContain(existing);
    expect(result).toContain(
      `${marker("nextjs", "START")}content${marker("nextjs", "END")}`,
    );
  });

  it("replaces content between existing markers", () => {
    const existing = `# Header\n\n${marker("react", "START")}old content${marker("react", "END")}\n\nFooter`;
    const result = injectIndex(existing, "new content", "react");
    expect(result).toContain("new content");
    expect(result).not.toContain("old content");
    expect(result).toContain("# Header");
    expect(result).toContain("Footer");
  });

  it("is idempotent - running twice produces same result", () => {
    const initial = "# Project\n";
    const first = injectIndex(initial, "index v1", "lib");
    const second = injectIndex(first, "index v1", "lib");
    expect(second).toBe(first);
  });

  it("supports multiple libraries coexisting", () => {
    let content = "# My Project\n";
    content = injectIndex(content, "react stuff", "react");
    content = injectIndex(content, "nextjs stuff", "nextjs");
    content = injectIndex(content, "vue stuff", "vue");

    expect(content).toContain(
      `${marker("react", "START")}react stuff${marker("react", "END")}`,
    );
    expect(content).toContain(
      `${marker("nextjs", "START")}nextjs stuff${marker("nextjs", "END")}`,
    );
    expect(content).toContain(
      `${marker("vue", "START")}vue stuff${marker("vue", "END")}`,
    );
  });

  it("updates one library without affecting others", () => {
    let content = "# Project\n";
    content = injectIndex(content, "react v1", "react");
    content = injectIndex(content, "nextjs v1", "nextjs");

    // Update only react
    content = injectIndex(content, "react v2", "react");

    expect(content).toContain("react v2");
    expect(content).not.toContain("react v1");
    expect(content).toContain("nextjs v1");
  });

  it("handles corrupted marker order (END before START)", () => {
    // Simulate a manually corrupted file where END comes before START
    const corrupted = `# Header\n${marker("lib", "END")}old${marker("lib", "START")}\nFooter`;
    const result = injectIndex(corrupted, "new content", "lib");
    // Should not produce garbled output
    expect(result).toContain("new content");
    expect(result).toContain("# Header");
  });
  it("injectIndex recovers when END marker is missing", () => {
    const startOnly = `Some text\n${marker("lib", "START")}old content\nMore text`;
    const result = injectIndex(startOnly, "new content", "lib");

    // Should strip the orphaned START marker and re-append new index cleanly at end
    expect(result).toContain(marker("lib", "START"));
    expect(result).toContain(marker("lib", "END"));
    expect(result).toContain("new content");
    // The "old content" text (which was after orphaned START) stays in the non-marker text
    // but new properly-wrapped index is appended at the end
    expect(result).toContain("Some text");
  });
});

describe("hasExistingIndex", () => {
  it("returns false for empty content", () => {
    expect(hasExistingIndex("", "react")).toBe(false);
  });

  it("returns true when markers exist", () => {
    const content = `before ${marker("react", "START")}stuff${marker("react", "END")} after`;
    expect(hasExistingIndex(content, "react")).toBe(true);
  });

  it("returns false for different library name", () => {
    const content = `${marker("react", "START")}stuff${marker("react", "END")}`;
    expect(hasExistingIndex(content, "nextjs")).toBe(false);
  });

  it("does not confuse plain text containing DOCS-AGENTS-MD with markers", () => {
    const content =
      "This file uses DOCS-AGENTS-MD for indexing.\nSee docs for details.";
    expect(hasExistingIndex(content, "lib")).toBe(false);
    // Injecting should just append
    const result = injectIndex(content, "index data", "lib");
    expect(result).toContain(content);
    expect(result).toContain(marker("lib", "START"));
  });
});

describe("removeIndex", () => {
  it("removes an existing index block", () => {
    const content = `# Header\n\n${marker("react", "START")}stuff${marker("react", "END")}\n\nFooter`;
    const result = removeIndex(content, "react");
    expect(result).not.toContain("stuff");
    expect(result).toContain("# Header");
    expect(result).toContain("Footer");
  });

  it("returns unchanged content when no markers exist", () => {
    const content = "# No markers here";
    expect(removeIndex(content, "react")).toBe(content);
  });

  it("removes one library without affecting others", () => {
    let content = "# Project\n";
    content = injectIndex(content, "react content", "react");
    content = injectIndex(content, "vue content", "vue");

    content = removeIndex(content, "react");

    expect(content).not.toContain("react content");
    expect(content).toContain("vue content");
  });

  it("removeIndex recovers when END marker is missing", () => {
    const startOnly = `Some text\n${marker("lib", "START")}content without end`;
    const result = removeIndex(startOnly, "lib");

    // Should strip the orphaned START marker
    expect(result).not.toContain(marker("lib", "START"));
    expect(result).toContain("Some text");
  });

  it("preserves clean spacing when removing middle block of three", () => {
    let content = "# Project\n";
    content = injectIndex(content, "react idx", "react");
    content = injectIndex(content, "nextjs idx", "nextjs");
    content = injectIndex(content, "vue idx", "vue");

    content = removeIndex(content, "nextjs");

    expect(content).toContain("react idx");
    expect(content).toContain("vue idx");
    expect(content).not.toContain("nextjs idx");
    // Surviving markers must remain intact
    expect(content).toContain(marker("react", "START"));
    expect(content).toContain(marker("react", "END"));
    expect(content).toContain(marker("vue", "START"));
    expect(content).toContain(marker("vue", "END"));
    // Verify no 3+ consecutive newlines (max 2 = one blank line)
    expect(content).not.toMatch(/\n{3,}/);
  });

  it("preserves clean spacing when removing first block of three", () => {
    let content = "# Project\n";
    content = injectIndex(content, "react idx", "react");
    content = injectIndex(content, "nextjs idx", "nextjs");
    content = injectIndex(content, "vue idx", "vue");

    content = removeIndex(content, "react");

    expect(content).not.toContain("react idx");
    expect(content).toContain("nextjs idx");
    expect(content).toContain("vue idx");
    expect(content).not.toMatch(/\n{3,}/);
  });

  it("does not eat content trailing newline when only single \n precedes marker", () => {
    // Simulate a manually-edited file where only one \n precedes the marker
    const content = `abc\n${marker("lib", "START")}stuff${marker("lib", "END")}\n`;
    const result = removeIndex(content, "lib");
    // Must preserve the trailing \n of 'abc'
    expect(result).toBe("abc\n");
  });
});
