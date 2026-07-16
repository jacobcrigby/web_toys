# AGENTS.md — opensauce

## What this is

A personal **schedule planner for Open Sauce 2026** (the maker/creator convention). It shows the full agenda — every session with its time and stage, sorted by time within each day — and lets the visitor star the sessions they plan to attend, filter by featured creator / day / stage, search, and export their picks to a `.ics` calendar file.

## Key facts for agents

- **Single file:** `index.html` (~64 KB of inline HTML, CSS, and JavaScript — no build step, no bundler, no package manager).
- **No dependencies to install.** Open `index.html` directly in a browser to run it.
- **No tests, no TypeScript, no linter.** Verify changes by opening the file in a browser and exercising the filters, starring, and `.ics` export.
- **Not a pnpm workspace.** There is no `package.json` here; `pnpm install` at the monorepo root does nothing for this project (same as `microcosm`).
- **Fully self-contained / offline.** The schedule data is embedded inline in `index.html`; the page makes **no runtime network requests**. Starred sessions persist in `localStorage`.

## The schedule data

The `SESSIONS` array at the top of the inline `<script>` is the entire agenda (74 sessions across Fri/Sat/Sun). It was extracted once from the official agenda page and baked in.

- Source: `https://www.opensauce.com/agenda`. The page is a Next.js app that server-streams the schedule as an RSC ("flight") payload — a JSON `sessions` array lives inside a `self.__next_f.push([1, "…"])` chunk under the key `47:[…{"sessions":[…]}]`. Extract it by concatenating the flight string chunks (decode each with a JSON string parse to preserve UTF-8 — do **not** use Python's `unicode_escape`, which mangles multibyte characters like `é`), then balance-matching the `sessions` array.
- Each source record has `sourceId, day (Fri/Sat/Sun), title, desc, stage, start, end, people[]`. Times are UTC; the event runs in Pacific (**UTC−7**, PDT). The absolute *dates* in the source are unreliable (some Sunday rows carry a May date), so the viewer derives dates from the `day` field (Fri→2026-07-17, Sat→2026-07-18, Sun→2026-07-19) and sorts by **time-of-day within each day**, never by the raw timestamp.
- To refresh the data, re-fetch the agenda, re-run the extraction, and regenerate the embedded `SESSIONS` array. Keep the cleaned record shape the JS expects: `{id, day, dayName, date, min, startLocal, endLocal, time, endTime, stage, title, desc, people[]}`.

## Featured creators

`FEATURED` (in the script) lists the creators surfaced as quick-filter chips and used to pre-seed a first-time visitor's starred list. Currently: William Osman, Kevin, BPS.space, Hank Green, Michael Reeves. On first visit every session featuring one of them is auto-starred (guarded by an `os26_seeded_v1` localStorage flag so it only happens once); the user can then add/remove any session freely.

## Deployment

Deployed to `https://jacobcrigby.github.io/web_toys/opensauce/` by copying the directory as-is — no build step in CI (see the repo-root `deploy.yml`, which does `cp -r opensauce dist/opensauce`).

## Conventions

- Keep everything inline in `index.html`. Do not split into separate files or add a build step.
- No external network requests, no fonts/CDNs — the page must stay self-contained and offline-capable.
- License: Apache-2.0 (`LICENSE` file in this directory); source files carry the `SPDX-License-Identifier: Apache-2.0` header.
- Not affiliated with or endorsed by Open Sauce — it's a fan-made viewer over publicly available agenda data.
