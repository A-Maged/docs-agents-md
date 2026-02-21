import { describe, it, expect } from "vitest";
import { REGISTRY, getRegistryEntry, listRegistryKeys } from "../registry.js";

describe("registry", () => {
  it("all entries have required fields", () => {
    for (const [key, entry] of Object.entries(REGISTRY)) {
      expect(entry.repo, `${key}.repo`).toBeTruthy();
      expect(entry.docsPath, `${key}.docsPath`).toBeTruthy();
      expect(entry.defaultTag, `${key}.defaultTag`).toBeTruthy();
      expect(entry.name, `${key}.name`).toBeTruthy();

      // repo format check
      expect(entry.repo, `${key}.repo format`).toMatch(
        /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/,
      );
    }
  });

  it("getRegistryEntry returns entry for valid key", () => {
    const entry = getRegistryEntry("nextjs");
    expect(entry).not.toBeNull();
    expect(entry!.repo).toBe("vercel/next.js");
  });

  it("getRegistryEntry is case-insensitive", () => {
    expect(getRegistryEntry("NextJS")).not.toBeNull();
    expect(getRegistryEntry("REACT")).not.toBeNull();
  });

  it("getRegistryEntry returns null for unknown key", () => {
    expect(getRegistryEntry("nonexistent")).toBeNull();
  });

  it("listRegistryKeys returns sorted list", () => {
    const keys = listRegistryKeys();
    expect(keys.length).toBeGreaterThan(0);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it("has a substantial number of registry entries", () => {
    expect(listRegistryKeys().length).toBeGreaterThanOrEqual(15);
  });

  it("resolves hyphenated keys", () => {
    expect(getRegistryEntry("react-router")).not.toBeNull();
    expect(getRegistryEntry("tanstack-query")).not.toBeNull();
  });

  it("has no duplicate repo values", () => {
    const repos = Object.values(REGISTRY).map((e) => e.repo);
    expect(new Set(repos).size).toBe(repos.length);
  });

  it("docsPath values are safe (no absolute paths or ..)", () => {
    for (const [key, entry] of Object.entries(REGISTRY)) {
      expect(entry.docsPath, `${key}.docsPath`).not.toMatch(/^\//);
      expect(entry.docsPath, `${key}.docsPath`).not.toContain("..");
    }
  });

  it("all entries have version detection fields", () => {
    for (const [key, entry] of Object.entries(REGISTRY)) {
      expect(entry.packages, `${key}.packages`).toBeDefined();
      expect(Array.isArray(entry.packages), `${key}.packages is array`).toBe(
        true,
      );
      expect(
        entry.packages.length,
        `${key}.packages non-empty`,
      ).toBeGreaterThan(0);
      for (const pkg of entry.packages) {
        expect(typeof pkg, `${key}.packages item type`).toBe("string");
        expect(pkg.length, `${key}.packages item non-empty`).toBeGreaterThan(0);
      }
      expect(entry.tagPrefix !== undefined, `${key}.tagPrefix defined`).toBe(
        true,
      );
      if (entry.tagPrefix !== null) {
        expect(typeof entry.tagPrefix, `${key}.tagPrefix type`).toBe("string");
      }
    }
  });
});
