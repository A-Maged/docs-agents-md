import { describe, it, expect } from "vitest";
import {
  DOCS_BASE_DIR,
  DEFAULT_OUTPUT,
  REPO_REGEX,
  TAG_REGEX,
  NAME_REGEX,
  formatSize,
} from "../constants.js";

describe("constants", () => {
  it("DOCS_BASE_DIR is a dotfile directory name", () => {
    expect(DOCS_BASE_DIR).toMatch(/^\./);
    expect(DOCS_BASE_DIR).not.toContain("/");
  });

  it("DEFAULT_OUTPUT ends with .md", () => {
    expect(DEFAULT_OUTPUT).toMatch(/\.md$/);
  });

  it("REPO_REGEX accepts valid repos", () => {
    expect(REPO_REGEX.test("vercel/next.js")).toBe(true);
    expect(REPO_REGEX.test("a/b")).toBe(true);
    expect(REPO_REGEX.test("drizzle-team/drizzle-orm-docs")).toBe(true);
  });

  it("REPO_REGEX rejects invalid repos", () => {
    expect(REPO_REGEX.test("just-a-name")).toBe(false);
    expect(REPO_REGEX.test("a/b/c")).toBe(false);
    expect(REPO_REGEX.test("a/b; rm -rf")).toBe(false);
    expect(REPO_REGEX.test("")).toBe(false);
  });

  it("TAG_REGEX accepts valid tags", () => {
    expect(TAG_REGEX.test("v1.0.0")).toBe(true);
    expect(TAG_REGEX.test("main")).toBe(true);
    expect(TAG_REGEX.test("svelte@5.0.0")).toBe(true);
    expect(TAG_REGEX.test("canary")).toBe(true);
    expect(TAG_REGEX.test("v15.1.0-canary.3")).toBe(true);
  });

  it("TAG_REGEX rejects shell injection", () => {
    expect(TAG_REGEX.test("; rm -rf /")).toBe(false);
    expect(TAG_REGEX.test("$(whoami)")).toBe(false);
    expect(TAG_REGEX.test("")).toBe(false);
  });

  it("NAME_REGEX accepts valid names", () => {
    expect(NAME_REGEX.test("nextjs")).toBe(true);
    expect(NAME_REGEX.test("my-lib")).toBe(true);
    expect(NAME_REGEX.test("lib_v2.0")).toBe(true);
    expect(NAME_REGEX.test("react-router")).toBe(true);
  });

  it("NAME_REGEX rejects invalid names", () => {
    expect(NAME_REGEX.test("My Lib")).toBe(false);
    expect(NAME_REGEX.test("UPPER")).toBe(false);
    expect(NAME_REGEX.test("")).toBe(false);
    expect(NAME_REGEX.test("has space")).toBe(false);
  });
});

describe("formatSize", () => {
  it("formats bytes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(10240)).toBe("10.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatSize(1048576)).toBe("1.0 MB");
    expect(formatSize(2621440)).toBe("2.5 MB");
  });
});
