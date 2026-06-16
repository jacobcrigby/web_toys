# Monorepo Merge Design

**Date:** 2026-06-16  
**Status:** Approved

## Context

Five standalone toy projects built in separate repos are being merged into a single `web_toys` monorepo. The goal is consolidated hosting via one GitHub Pages deployment while keeping each project fully self-contained.

## Projects

| Directory | Source | Type |
|---|---|---|
| `ultimate-tic-tac-toe/` | `../ultimate-tic-tac-toe/` | Vite + TypeScript |
| `microcosm/` | `../claudes-choice/` (renamed) | Static HTML |
| `pdf-to-cbz/` | `../pdf-to-cbz/` | Vite + TypeScript + PWA |
| `marblegame/` | `../marblegame/` | Vite + Babylon.js |

`uma-card-manager` is excluded — it has a Python backend that can't run on GitHub Pages.

## Repository Structure

```
web_toys/
├── index.html                    # Landing page (plain HTML/CSS, no build)
├── .github/
│   └── workflows/
│       └── deploy.yml            # Single deploy workflow for all projects
├── ultimate-tic-tac-toe/         # Self-contained Vite project
├── microcosm/                    # Static HTML (no build step)
│   └── index.html
├── pdf-to-cbz/                   # Self-contained Vite project
└── marblegame/                   # Self-contained Vite project
```

Each sub-project keeps its own `package.json`, `node_modules`, and build config.

## Base Path Changes

Each Vite project's `base` config must be updated to reflect the new subpath under `web_toys`:

| Project | Old `base` | New `base` |
|---|---|---|
| `ultimate-tic-tac-toe` | `/ultimate-tic-tac-toe/` | `/web_toys/ultimate-tic-tac-toe/` |
| `pdf-to-cbz` | `./` | `/web_toys/pdf-to-cbz/` |
| `marblegame` | `/marblegame/` (prod only) | `/web_toys/marblegame/` |

`microcosm` is a self-contained static HTML file with no asset references requiring rebasing.

## GitHub Actions Workflow

Single `deploy.yml` workflow triggered on push to `main`:

1. Install + build each Vite project in sequence:
   - `ultimate-tic-tac-toe`: `npm ci && npm run build`
   - `pdf-to-cbz`: `npm ci && npm run build`
   - `marblegame`: `npm ci && npm run build`
2. Assemble `dist/`:
   ```
   dist/
   ├── index.html                      # root landing page
   ├── ultimate-tic-tac-toe/           # from ultimate-tic-tac-toe/dist/
   ├── microcosm/                      # copied directly
   ├── pdf-to-cbz/                     # from pdf-to-cbz/dist/
   └── marblegame/                     # from marblegame/dist/
   ```
3. Upload `dist/` artifact and deploy via `actions/deploy-pages@v4`.

## Landing Page

Plain `index.html` with inline CSS — no build step, no framework. Lists the four toys with name, one-line description, and a link to the subpath. Deployed as `dist/index.html`.

## Deployed URLs

```
https://jacobcrigby.github.io/web_toys/
https://jacobcrigby.github.io/web_toys/ultimate-tic-tac-toe/
https://jacobcrigby.github.io/web_toys/microcosm/
https://jacobcrigby.github.io/web_toys/pdf-to-cbz/
https://jacobcrigby.github.io/web_toys/marblegame/
```

## Files to Modify After Copying

- `ultimate-tic-tac-toe/vite.config.ts` — update `base`
- `pdf-to-cbz/vite.config.ts` — update `base`
- `marblegame/vite.config.ts` — update `base`

## Verification

1. Run each sub-project's build locally (`npm ci && npm run build`) and confirm the output is under `dist/`
2. Check that asset paths in the built HTML reference `/web_toys/<project>/assets/...`
3. After pushing to `main`, confirm the GitHub Actions workflow succeeds
4. Visit `https://jacobcrigby.github.io/web_toys/` and navigate to each project
