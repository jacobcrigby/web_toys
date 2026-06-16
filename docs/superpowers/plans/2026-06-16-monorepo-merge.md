# Monorepo Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy four toy projects into `web_toys/`, fix their base paths, relicense to Apache 2.0, add a landing page, wire up a single GitHub Actions deploy, and update `jacobcrigby.github.io` to point at the new locations.

**Architecture:** Each project is a self-contained Vite app (or static HTML) living in its own subdirectory. A single GitHub Actions workflow builds each Vite project, assembles their outputs under one `dist/`, and deploys to GitHub Pages at `jacobcrigby.github.io/web_toys/`. No npm workspaces — each project installs its own dependencies.

**Tech Stack:** Vite, TypeScript, GitHub Actions (actions/upload-pages-artifact, actions/deploy-pages), plain HTML/CSS for landing page, vite-plugin-pwa (pdf-to-cbz only).

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `ultimate-tic-tac-toe/` | Copy of source project |
| Modify | `ultimate-tic-tac-toe/vite.config.ts` | Update base path |
| Modify | `ultimate-tic-tac-toe/package.json` | Add `"license": "Apache-2.0"` |
| Create | `ultimate-tic-tac-toe/LICENSE` | Apache 2.0 text |
| Create | `microcosm/` | Copied from claudes-choice (renamed) |
| Create | `microcosm/LICENSE` | Apache 2.0 text |
| Create | `pdf-to-cbz/` | Copy of source project |
| Modify | `pdf-to-cbz/vite.config.ts` | Update base path; update PWA comment |
| Modify | `pdf-to-cbz/package.json` | Change `"license"` to `"Apache-2.0"` |
| Create | `pdf-to-cbz/LICENSE` | Apache 2.0 text (replace AGPL) |
| Create | `marblegame/` | Copy of source project |
| Modify | `marblegame/vite.config.ts` | Update base path |
| Modify | `marblegame/package.json` | Add `"license": "Apache-2.0"` |
| Create | `marblegame/LICENSE` | Apache 2.0 text |
| Create | `.github/workflows/deploy.yml` | Build + deploy all projects to Pages |
| Create | `index.html` | Landing page (Material You, plain HTML) |
| Modify | `../jacobcrigby.github.io/index.html` | Update hrefs; add microcosm card |

---

## Task 1: Copy ultimate-tic-tac-toe

**Files:**
- Create: `ultimate-tic-tac-toe/` (full project copy)
- Modify: `ultimate-tic-tac-toe/vite.config.ts`
- Modify: `ultimate-tic-tac-toe/package.json`
- Create: `ultimate-tic-tac-toe/LICENSE`

- [ ] **Step 1: Copy the project (exclude git, node_modules, dist)**

Run from `web_toys/`:
```bash
rsync -av \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  /home/jacob/Projects/ultimate-tic-tac-toe/ \
  ultimate-tic-tac-toe/
```
Expected: all source files copied; no `.git`, `node_modules`, or `dist` directory.

- [ ] **Step 2: Update vite.config.ts base path**

File: `ultimate-tic-tac-toe/vite.config.ts`

Replace:
```ts
  base: '/ultimate-tic-tac-toe/',
```
With:
```ts
  base: '/web_toys/ultimate-tic-tac-toe/',
```

Full file after edit:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/web_toys/ultimate-tic-tac-toe/',
  build: { target: 'es2022' },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add license field to package.json**

In `ultimate-tic-tac-toe/package.json`, add `"license": "Apache-2.0"` after the `"version"` field (or alongside other top-level fields if there is no version). Open the file and add the field — the exact location doesn't matter as long as it is a top-level key.

- [ ] **Step 4: Copy Apache 2.0 LICENSE**

```bash
cp /home/jacob/Projects/web_toys/LICENSE ultimate-tic-tac-toe/LICENSE
```

- [ ] **Step 5: Verify the build**

```bash
cd ultimate-tic-tac-toe && npm ci && npm run build && cd ..
```
Expected: no errors; `ultimate-tic-tac-toe/dist/index.html` references `/web_toys/ultimate-tic-tac-toe/assets/`.

- [ ] **Step 6: Commit**

```bash
git add ultimate-tic-tac-toe/
git commit -m "feat: add ultimate-tic-tac-toe to monorepo (Apache-2.0)"
```

---

## Task 2: Copy microcosm (from claudes-choice)

**Files:**
- Create: `microcosm/index.html`
- Create: `microcosm/README.md`
- Create: `microcosm/LICENSE`

- [ ] **Step 1: Copy the static files**

```bash
mkdir -p microcosm
cp /home/jacob/Projects/claudes-choice/index.html microcosm/index.html
cp /home/jacob/Projects/claudes-choice/README.md microcosm/README.md
```

- [ ] **Step 2: Copy Apache 2.0 LICENSE**

```bash
cp /home/jacob/Projects/web_toys/LICENSE microcosm/LICENSE
```

- [ ] **Step 3: Verify it opens**

```bash
# Quick sanity: confirm the HTML file is present and non-empty
wc -l microcosm/index.html
```
Expected: line count > 0 (the file is ~41 KB).

- [ ] **Step 4: Commit**

```bash
git add microcosm/
git commit -m "feat: add microcosm to monorepo (Apache-2.0)"
```

---

## Task 3: Copy pdf-to-cbz

**Files:**
- Create: `pdf-to-cbz/` (full project copy)
- Modify: `pdf-to-cbz/vite.config.ts`
- Modify: `pdf-to-cbz/package.json`
- Create: `pdf-to-cbz/LICENSE`

- [ ] **Step 1: Copy the project**

```bash
rsync -av \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='test-results' \
  /home/jacob/Projects/pdf-to-cbz/ \
  pdf-to-cbz/
```

- [ ] **Step 2: Update vite.config.ts**

File: `pdf-to-cbz/vite.config.ts`

The old file used `base: './'` (relative) because the deployment path was unknown at build time. We now know the path, so switch to absolute and update the comment.

Replace the entire file with:
```ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/web_toys/pdf-to-cbz/',
  build: {
    target: 'es2022',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,wasm,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'PDF → CBZ',
        short_name: 'PDF → CBZ',
        description: 'Convert a PDF into a CBZ comic archive entirely in your browser.',
        theme_color: '#4338ca',
        background_color: '#4338ca',
        display: 'standalone',
        start_url: '/web_toys/pdf-to-cbz/',
        scope: '/web_toys/pdf-to-cbz/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 3: Change license field in package.json**

In `pdf-to-cbz/package.json`, find:
```json
"license": "AGPL-3.0-or-later"
```
Replace with:
```json
"license": "Apache-2.0"
```

- [ ] **Step 4: Replace LICENSE file**

```bash
cp /home/jacob/Projects/web_toys/LICENSE pdf-to-cbz/LICENSE
```

- [ ] **Step 5: Verify the build**

```bash
cd pdf-to-cbz && npm ci && npm run build && cd ..
```
Expected: no errors; `pdf-to-cbz/dist/index.html` references `/web_toys/pdf-to-cbz/assets/`; a `sw.js` and `manifest.webmanifest` are present in `dist/`.

- [ ] **Step 6: Commit**

```bash
git add pdf-to-cbz/
git commit -m "feat: add pdf-to-cbz to monorepo (Apache-2.0, was AGPL-3.0)"
```

---

## Task 4: Copy marblegame

**Files:**
- Create: `marblegame/` (full project copy)
- Modify: `marblegame/vite.config.ts`
- Modify: `marblegame/package.json`
- Create: `marblegame/LICENSE`

- [ ] **Step 1: Copy the project**

```bash
rsync -av \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  /home/jacob/Projects/marblegame/ \
  marblegame/
```

- [ ] **Step 2: Update vite.config.ts base path**

File: `marblegame/vite.config.ts`

Replace:
```ts
  base: command === "build" ? "/marblegame/" : "/",
```
With:
```ts
  base: command === "build" ? "/web_toys/marblegame/" : "/",
```

Full file after edit:
```ts
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/web_toys/marblegame/" : "/",
  server: { host: true },
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
}));
```

- [ ] **Step 3: Add license field to package.json**

In `marblegame/package.json`, add `"license": "Apache-2.0"` as a top-level key.

- [ ] **Step 4: Copy Apache 2.0 LICENSE**

```bash
cp /home/jacob/Projects/web_toys/LICENSE marblegame/LICENSE
```

- [ ] **Step 5: Verify the build**

```bash
cd marblegame && npm ci && npm run build && cd ..
```
Expected: no errors; `marblegame/dist/index.html` references `/web_toys/marblegame/assets/`.

- [ ] **Step 6: Commit**

```bash
git add marblegame/
git commit -m "feat: add marblegame to monorepo (Apache-2.0)"
```

---

## Task 5: Create GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build ultimate-tic-tac-toe
        run: cd ultimate-tic-tac-toe && npm ci && npm run build

      - name: Build pdf-to-cbz
        run: cd pdf-to-cbz && npm ci && npm run build

      - name: Build marblegame
        run: cd marblegame && npm ci && npm run build

      - name: Assemble dist
        run: |
          mkdir -p dist
          cp index.html dist/index.html
          cp -r ultimate-tic-tac-toe/dist dist/ultimate-tic-tac-toe
          cp -r microcosm dist/microcosm
          cp -r pdf-to-cbz/dist dist/pdf-to-cbz
          cp -r marblegame/dist dist/marblegame

      - uses: actions/configure-pages@v4

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deploy workflow for monorepo"
```

---

## Task 6: Create the web_toys landing page

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create index.html**

This page uses the same Material You palette and card design as `jacobcrigby.github.io/index.html`. Links are relative so they work on any host.

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Web Toys — Jacob Rigby</title>
  <meta name="description" content="A collection of games and tools built by Jacob Rigby — all running in your browser." />
  <meta name="theme-color" content="#6750A4" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#141218" media="(prefers-color-scheme: dark)" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='28' fill='%236750A4'/><text x='50' y='68' font-size='56' font-family='sans-serif' font-weight='700' fill='%23EADDFF' text-anchor='middle'>JR</text></svg>" />
  <style>
    :root {
      --primary: #6750A4;
      --on-primary: #FFFFFF;
      --primary-container: #EADDFF;
      --on-primary-container: #21005D;
      --secondary-container: #E8DEF8;
      --on-secondary-container: #1D192B;
      --background: #FEF7FF;
      --surface-container-low: #F7F2FA;
      --outline-variant: #CAC4D0;
      --on-surface: #1D1B20;
      --on-surface-variant: #49454F;
      --shadow: rgba(0, 0, 0, 0.18);
      --state-layer: 0, 0, 0;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --primary: #D0BCFF;
        --on-primary: #381E72;
        --primary-container: #4F378B;
        --on-primary-container: #EADDFF;
        --secondary-container: #4A4458;
        --on-secondary-container: #E8DEF8;
        --background: #141218;
        --surface-container-low: #1D1B20;
        --outline-variant: #49454F;
        --on-surface: #E6E0E9;
        --on-surface-variant: #CAC4D0;
        --shadow: rgba(0, 0, 0, 0.5);
        --state-layer: 255, 255, 255;
      }
    }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'Google Sans', 'Roboto', system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: var(--background);
      color: var(--on-surface);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .page {
      width: 100%;
      max-width: 1040px;
      padding: 32px 24px 48px;
      flex: 1;
    }
    .hero {
      text-align: center;
      padding: 48px 16px 40px;
    }
    .monogram {
      width: 84px;
      height: 84px;
      margin: 0 auto 24px;
      border-radius: 28px;
      background: var(--primary-container);
      color: var(--on-primary-container);
      display: grid;
      place-items: center;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 0.5px;
      box-shadow: 0 1px 3px var(--shadow);
    }
    .hero h1 {
      margin: 0;
      font-size: clamp(2.2rem, 6vw, 3.4rem);
      font-weight: 600;
      letter-spacing: -0.5px;
    }
    .hero p {
      margin: 12px auto 0;
      max-width: 36ch;
      font-size: 1.05rem;
      color: var(--on-surface-variant);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 8px;
    }
    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 24px;
      border-radius: 28px;
      background: var(--surface-container-low);
      color: inherit;
      text-decoration: none;
      border: 1px solid var(--outline-variant);
      box-shadow: 0 1px 2px var(--shadow);
      transition: box-shadow .2s ease, transform .2s ease, background .2s ease;
      isolation: isolate;
    }
    .card::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: rgb(var(--state-layer));
      opacity: 0;
      transition: opacity .2s ease;
      pointer-events: none;
      z-index: -1;
    }
    .card:hover { box-shadow: 0 4px 10px var(--shadow); transform: translateY(-3px); }
    .card:hover::after { opacity: 0.05; }
    .card:focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }
    .card-icon {
      width: 56px;
      height: 56px;
      border-radius: 18px;
      background: var(--secondary-container);
      color: var(--on-secondary-container);
      display: grid;
      place-items: center;
      font-size: 28px;
    }
    .card h2 { margin: 0; font-size: 1.3rem; font-weight: 600; }
    .card p { margin: 0; color: var(--on-surface-variant); font-size: 0.98rem; flex: 1; }
    .open-pill {
      align-self: flex-start;
      margin-top: 4px;
      padding: 9px 20px;
      border-radius: 999px;
      background: var(--primary);
      color: var(--on-primary);
      font-size: 0.9rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .open-pill svg { width: 16px; height: 16px; }
    footer {
      width: 100%;
      max-width: 1040px;
      padding: 24px;
      text-align: center;
      color: var(--on-surface-variant);
      font-size: 0.9rem;
    }
    footer a { color: var(--primary); text-decoration: none; font-weight: 600; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div class="monogram" aria-hidden="true">JR</div>
      <h1>Web Toys</h1>
      <p>Games and tools by Jacob Rigby — all running right in your browser.</p>
    </header>

    <section class="grid" aria-label="Projects">
      <a class="card" href="./ultimate-tic-tac-toe/">
        <div class="card-icon" aria-hidden="true">#️⃣</div>
        <h2>Ultimate Tic-Tac-Toe</h2>
        <p>A twist on tic-tac-toe: nine boards nested into one big board. Win the small games to claim the meta-grid.</p>
        <span class="open-pill">Open
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </a>

      <a class="card" href="./microcosm/">
        <div class="card-icon" aria-hidden="true">🔬</div>
        <h2>Microcosm</h2>
        <p>A small pond of evolving minds — watch artificial life emerge, compete, and adapt.</p>
        <span class="open-pill">Open
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </a>

      <a class="card" href="./pdf-to-cbz/">
        <div class="card-icon" aria-hidden="true">📚</div>
        <h2>PDF → CBZ</h2>
        <p>Convert zine PDFs into CBZ files for your favorite comic reader app — offline-capable, zero uploads.</p>
        <span class="open-pill">Open
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </a>

      <a class="card" href="./marblegame/">
        <div class="card-icon" aria-hidden="true">🔵</div>
        <h2>Marble Game</h2>
        <p>Guide the marble to the goal, navigating each puzzle one roll at a time.</p>
        <span class="open-pill">Open
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </a>
    </section>
  </main>

  <footer>
    <a href="https://jacobcrigby.github.io">jacobcrigby.github.io</a> &nbsp;·&nbsp;
    <a href="https://github.com/jacobcrigby/web_toys">Source on GitHub</a>
  </footer>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add landing page for web_toys monorepo"
```

---

## Task 7: Update jacobcrigby.github.io

**Files:**
- Modify: `../jacobcrigby.github.io/index.html`

Work in `/home/jacob/Projects/jacobcrigby.github.io/` for this task.

- [ ] **Step 1: Update ultimate-tic-tac-toe href**

In `index.html`, replace:
```html
      <a class="card" href="https://jacobcrigby.github.io/ultimate-tic-tac-toe/">
```
With:
```html
      <a class="card" href="https://jacobcrigby.github.io/web_toys/ultimate-tic-tac-toe/">
```

- [ ] **Step 2: Update marblegame href**

Replace:
```html
      <a class="card" href="https://jacobcrigby.github.io/marblegame/">
```
With:
```html
      <a class="card" href="https://jacobcrigby.github.io/web_toys/marblegame/">
```

- [ ] **Step 3: Update pdf-to-cbz href**

Replace:
```html
      <a class="card" href="https://jacobcrigby.github.io/pdf-to-cbz/">
```
With:
```html
      <a class="card" href="https://jacobcrigby.github.io/web_toys/pdf-to-cbz/">
```

- [ ] **Step 4: Add microcosm card**

After the closing `</a>` of the pdf-to-cbz card (before `</section>`), insert:
```html

      <a class="card" href="https://jacobcrigby.github.io/web_toys/microcosm/">
        <div class="card-icon" aria-hidden="true">🔬</div>
        <h2>Microcosm</h2>
        <p>A small pond of evolving minds — watch artificial life emerge, compete, and adapt.</p>
        <span class="open-pill">Open
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </a>
```

- [ ] **Step 5: Commit from the jacobcrigby.github.io repo**

```bash
cd /home/jacob/Projects/jacobcrigby.github.io
git add index.html
git commit -m "feat: update project links to web_toys monorepo; add microcosm"
```

---

## Task 8: Enable GitHub Pages on the web_toys repo

This is a one-time manual step in the GitHub UI — it cannot be done from the CLI without the Pages API.

- [ ] **Step 1: Push all commits**

From `web_toys/`:
```bash
git push
```

- [ ] **Step 2: Enable Pages (manual)**

1. Go to `https://github.com/jacobcrigby/web_toys/settings/pages`
2. Under **Source**, select **GitHub Actions**
3. Save

The deploy workflow will run automatically on the next push to `main`, or can be triggered manually via the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**.

- [ ] **Step 3: Push jacobcrigby.github.io**

```bash
cd /home/jacob/Projects/jacobcrigby.github.io && git push
```

- [ ] **Step 4: Verify live URLs**

Once the workflow completes:
- `https://jacobcrigby.github.io/web_toys/` — landing page with four cards
- `https://jacobcrigby.github.io/web_toys/ultimate-tic-tac-toe/` — game loads
- `https://jacobcrigby.github.io/web_toys/microcosm/` — simulation loads
- `https://jacobcrigby.github.io/web_toys/pdf-to-cbz/` — converter loads; PWA install prompt appears
- `https://jacobcrigby.github.io/web_toys/marblegame/` — game loads
