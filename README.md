# docs-agents-md

**Give your AI coding agent the docs it needs — in one command.**

[![npm version](https://img.shields.io/npm/v/docs-agents-md.svg)](https://www.npmjs.com/package/docs-agents-md)
[![license](https://img.shields.io/npm/l/docs-agents-md.svg)](https://github.com/a-maged/docs-agents-md/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/docs-agents-md.svg)](https://nodejs.org)

```bash
npx docs-agents-md
```

Downloads docs from any GitHub repo and injects a compact, token-optimized index into your `AGENTS.md` or `CLAUDE.md` — so your AI agent uses **real docs** instead of hallucinating.

## Get Started

```bash
# Pick from 20+ presets interactively
npx docs-agents-md

# Or one-liner
npx docs-agents-md --lib nextjs

# Any GitHub repo
npx docs-agents-md --repo vercel/next.js --name nextjs --docs-path docs
```

## Presets

20 frameworks built-in. Run `npx docs-agents-md list` to see all.

|                |          |          |                  |
| -------------- | -------- | -------- | ---------------- |
| `nextjs`       | `react`  | `vue`    | `svelte`         |
| `angular`      | `nuxt`   | `astro`  | `tailwindcss`    |
| `drizzle`      | `prisma` | `nestjs` | `express`        |
| `fastify`      | `hono`   | `trpc`   | `tanstack-query` |
| `react-router` | `vite`   | `bun`    | `zustand`        |

> Missing one? Use `--repo` for any GitHub repo, or [open an issue](https://github.com/a-maged/docs-agents-md/issues).

## What It Does

1. **Downloads** only the docs folder via `git sparse-checkout` (fast, minimal)
2. **Indexes** all doc files into a single-line, pipe-separated format (minimal tokens)
3. **Injects** into your agent file with namespaced markers (multiple libs coexist)
4. **Auto-detects** your installed version to match the right docs tag
5. **Gitignores** the cache directory automatically

## Multiple Libraries

Each library gets its own marker block — they coexist and update independently:

```bash
npx docs-agents-md --lib react --output AGENTS.md
npx docs-agents-md --lib drizzle --output AGENTS.md
npx docs-agents-md --lib tailwindcss --output AGENTS.md
```

## Options

| Flag                  | Description                           | Default         |
| --------------------- | ------------------------------------- | --------------- |
| `--lib <name>`        | Built-in preset                       | —               |
| `--repo <owner/repo>` | Any GitHub repository                 | —               |
| `--name <name>`       | Library name (required with `--repo`) | —               |
| `--tag <tag>`         | Git tag or branch                     | `main` / preset |
| `--docs-path <path>`  | Docs folder in repo                   | `docs`          |
| `--output <file>`     | Target file                           | `AGENTS.md`     |
| `--extensions <exts>` | File types to index                   | `md,mdx`        |

Set `GITHUB_TOKEN` env var for higher API rate limits (5,000/hr vs 60/hr).

## Inspiration

Inspired by Vercel's research on [`AGENTS.md`](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals), which showed that documentation context via `AGENTS.md` significantly outperforms other approaches in agent evaluations.

## Contributing

1. Add an entry to [`src/lib/registry.ts`](src/lib/registry.ts)
2. Run `npm test`
3. Open a PR

## License

MIT
