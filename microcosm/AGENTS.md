# AGENTS.md — microcosm

## What this is

A self-contained browser simulation: "MICROCOSM — a small pond of evolving minds." Artificial life agents compete, adapt, and evolve in real time.

## Key facts for agents

- **Single file:** `index.html` (≈41 KB of inline HTML, CSS, and JavaScript — no build step, no bundler, no package manager).
- **No dependencies to install.** Open `index.html` directly in a browser to run it.
- **No tests, no TypeScript, no linter.** Verify changes by opening the file in a browser and observing the simulation.
- **Not a pnpm workspace.** There is no `package.json` here; `pnpm install` at the monorepo root does nothing for this project.

## Deployment

Deployed to `https://jacobcrigby.github.io/web_toys/microcosm/` by copying the directory as-is — no build step in CI.

## Conventions

- Keep everything inline in `index.html`. Do not split into separate files.
- No external network requests beyond the Google Fonts stylesheet already present.
- License: Apache-2.0 (`LICENSE` file in this directory).
