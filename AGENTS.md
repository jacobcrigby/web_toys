# AGENTS.md — web_toys

Monorepo-level guidance for AI agents and contributors. Read this first, then read the **subproject `AGENTS.md`** before touching any project's code.

## What this repo is

A collection of browser toys built by Jacob Rigby — games and tools that run entirely in the browser, deployed to GitHub Pages at `https://jacobcrigby.github.io/web_toys/`.

## Monorepo structure

```
web_toys/
  index.html                  # Landing page (plain HTML, no build step)
  package.json                # pnpm workspace root
  pnpm-workspace.yaml         # declares workspaces
  pnpm-lock.yaml              # single shared lockfile
  .github/workflows/
    deploy.yml                # builds all Vite projects → assembles dist/ → deploys to Pages
  ultimate-tic-tac-toe/       # Vite + TypeScript game (see its AGENTS.md)
  pdf-to-cbz/                 # Vite + TypeScript + PWA converter (see its AGENTS.md)
  marblegame/                 # Vite + Babylon.js + Havok physics game (see its AGENTS.md)
  microcosm/                  # Static HTML simulation — no build step, no package.json
```

`microcosm` is deliberately not a pnpm workspace — it is a single self-contained HTML file and ships as-is.

## Package manager: pnpm workspaces

This repo uses **pnpm** (not npm, not yarn, not bun). The three Vite projects are declared as workspaces; dependencies are hoisted into a shared root `node_modules`.

**Never create or commit a `package-lock.json` or `yarn.lock`.** The only lockfile is `pnpm-lock.yaml` at the repo root.

### Commands

| What | Command |
|---|---|
| Install all deps | `pnpm install` (run from repo root) |
| Build all projects | `pnpm run build:all` |
| Build one project | `pnpm -C ultimate-tic-tac-toe run build` (or `cd ultimate-tic-tac-toe && pnpm build`) |
| Dev server for one project | `pnpm -C marblegame run dev` |
| Run tests | `pnpm -C ultimate-tic-tac-toe run test` |

Within a subproject directory, `pnpm <script>` works directly (e.g. `pnpm build`, `pnpm dev`, `pnpm test`).

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) runs on every push to `main`:

1. `pnpm install` — installs all workspace dependencies
2. `pnpm run build:all` — builds each Vite project in parallel
3. Assembles `dist/`:
   - `dist/index.html` ← root landing page
   - `dist/ultimate-tic-tac-toe/` ← from `ultimate-tic-tac-toe/dist/`
   - `dist/microcosm/` ← copied as-is
   - `dist/pdf-to-cbz/` ← from `pdf-to-cbz/dist/`
   - `dist/marblegame/` ← from `marblegame/dist/`
4. Deploys `dist/` to GitHub Pages

Each Vite project's `base` is set to `/web_toys/<project>/` so asset URLs resolve correctly.

**One-time manual step on a new repo fork:** Settings → Pages → Source → GitHub Actions.

## License

All code in this repo is **Apache-2.0**. New source files in the Vite projects should carry the SPDX header:
```
// SPDX-License-Identifier: Apache-2.0
```

## Common conventions

- **TypeScript, strict mode** in all three Vite projects. No implicit `any`.
- **No external UI frameworks** at the monorepo level; each project decides its own dependencies.
- **No backend, no accounts, no telemetry.** Everything runs in the browser.
- **Commits:** imperative subject line, present tense ("Add X", "Fix Y"). Keep `main` always deployable — every push triggers a Pages deploy.
- **`dist/` and `node_modules/` are gitignored** at both the root and subproject level. Never commit build artifacts.

## Before touching any project

Read the project's own `AGENTS.md` — it contains the architecture, commands, conventions, and gotchas specific to that project. Each one is thorough; do not skip it.

| Project | Docs |
|---|---|
| ultimate-tic-tac-toe | `ultimate-tic-tac-toe/AGENTS.md` |
| pdf-to-cbz | `pdf-to-cbz/AGENTS.md` |
| marblegame | `marblegame/AGENTS.md` |
| microcosm | `microcosm/AGENTS.md` |
