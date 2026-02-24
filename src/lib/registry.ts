/**
 * Built-in registry of popular library presets.
 * All docs paths verified against actual GitHub repos.
 */

export interface RegistryEntry {
  repo: string;
  docsPath: string;
  defaultTag: string;
  name: string;
  extensions?: string[];
  /** npm package name(s) to detect version from project's package.json */
  packages: string[];
  /** Git tag prefix for version tags (e.g., 'v' → 'v15.0.0'). null = no version tags exist. */
  tagPrefix: string | null;
}

export const REGISTRY: Record<string, RegistryEntry> = {
  nextjs: {
    repo: "vercel/next.js",
    docsPath: "docs",
    defaultTag: "canary",
    name: "Next.js",
    packages: ["next"],
    tagPrefix: "v",
  },
  react: {
    repo: "reactjs/react.dev",
    docsPath: "src/content",
    defaultTag: "main",
    name: "React",
    packages: ["react"],
    tagPrefix: null,
  },
  vue: {
    repo: "vuejs/docs",
    docsPath: "src",
    defaultTag: "main",
    name: "Vue",
    packages: ["vue"],
    tagPrefix: null,
  },
  svelte: {
    repo: "sveltejs/svelte",
    docsPath: "documentation/docs",
    defaultTag: "main",
    name: "Svelte",
    packages: ["svelte"],
    tagPrefix: "svelte@",
  },
  astro: {
    repo: "withastro/docs",
    docsPath: "src/content/docs",
    defaultTag: "main",
    name: "Astro",
    packages: ["astro"],
    tagPrefix: null,
  },
  drizzle: {
    repo: "drizzle-team/drizzle-orm-docs",
    docsPath: "src/content",
    defaultTag: "main",
    name: "Drizzle ORM",
    packages: ["drizzle-orm"],
    tagPrefix: null,
  },
  hono: {
    repo: "honojs/hono",
    docsPath: "docs",
    defaultTag: "main",
    name: "Hono",
    packages: ["hono"],
    tagPrefix: "v",
  },
  nestjs: {
    repo: "nestjs/docs.nestjs.com",
    docsPath: "content",
    defaultTag: "master",
    name: "NestJS",
    packages: ["@nestjs/core"],
    tagPrefix: null,
  },
  angular: {
    repo: "angular/angular",
    docsPath: "adev/src/content",
    defaultTag: "main",
    name: "Angular",
    packages: ["@angular/core"],
    tagPrefix: "",
  },
  nuxt: {
    repo: "nuxt/nuxt",
    docsPath: "docs",
    defaultTag: "main",
    name: "Nuxt",
    packages: ["nuxt"],
    tagPrefix: "v",
  },
  "react-router": {
    repo: "remix-run/react-router",
    docsPath: "docs",
    defaultTag: "main",
    name: "React Router",
    packages: ["react-router"],
    tagPrefix: "react-router@",
  },
  express: {
    repo: "expressjs/expressjs.com",
    docsPath: "en",
    defaultTag: "gh-pages",
    name: "Express",
    packages: ["express"],
    tagPrefix: null,
  },
  fastify: {
    repo: "fastify/fastify",
    docsPath: "docs",
    defaultTag: "main",
    name: "Fastify",
    packages: ["fastify"],
    tagPrefix: "v",
  },
  prisma: {
    repo: "prisma/docs",
    docsPath: "content",
    defaultTag: "main",
    name: "Prisma",
    packages: ["prisma"],
    tagPrefix: null,
  },
  "tanstack-query": {
    repo: "TanStack/query",
    docsPath: "docs",
    defaultTag: "main",
    name: "TanStack Query",
    packages: ["@tanstack/react-query"],
    tagPrefix: "v",
  },
  vite: {
    repo: "vitejs/vite",
    docsPath: "docs",
    defaultTag: "main",
    name: "Vite",
    packages: ["vite"],
    tagPrefix: "v",
  },
  tailwindcss: {
    repo: "tailwindlabs/tailwindcss.com",
    docsPath: "src/docs",
    defaultTag: "main",
    name: "Tailwind CSS",
    packages: ["tailwindcss"],
    tagPrefix: null,
  },
  trpc: {
    repo: "trpc/trpc",
    docsPath: "www/docs",
    defaultTag: "main",
    name: "tRPC",
    packages: ["@trpc/server"],
    tagPrefix: null,
  },
  bun: {
    repo: "oven-sh/bun",
    docsPath: "docs",
    defaultTag: "main",
    name: "Bun",
    packages: ["bun-types"],
    tagPrefix: "bun-v",
  },
  zustand: {
    repo: "pmndrs/zustand",
    docsPath: "docs",
    defaultTag: "main",
    name: "Zustand",
    packages: ["zustand"],
    tagPrefix: "v",
  },
  convex: {
    repo: "get-convex/convex-backend",
    docsPath: "npm-packages/docs/docs",
    defaultTag: "main",
    name: "Convex",
    packages: ["convex"],
    tagPrefix: null,
  },
};

/**
 * Get a registry entry by key.
 * Returns null if not found.
 */
export function getRegistryEntry(key: string): RegistryEntry | null {
  return REGISTRY[key.toLowerCase()] ?? null;
}

/**
 * List all available registry keys.
 */
export function listRegistryKeys(): string[] {
  return Object.keys(REGISTRY).sort();
}

/**
 * Find a registry entry by its repo field (e.g., "get-convex/convex-backend").
 * Returns the entry or null if no preset matches this repo.
 */
export function getRegistryEntryByRepo(repo: string): RegistryEntry | null {
  const lower = repo.toLowerCase();
  for (const entry of Object.values(REGISTRY)) {
    if (entry.repo.toLowerCase() === lower) return entry;
  }
  return null;
}
