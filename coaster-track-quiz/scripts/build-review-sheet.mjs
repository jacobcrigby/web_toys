// SPDX-License-Identifier: Apache-2.0
//
// Step 2 of curation: turn the candidate JSON into a contact sheet you can actually look at.
//
//   pnpm data:sheet          # every manufacturer fetched so far
//   pnpm data:sheet -- gci
//
// Writes scripts/out/review-<manufacturer>.html. Every image URL is absolute https, so the
// file opens straight off disk. Mark each photo as a close-up or a context shot, then use the
// "Copy picks" button and paste into scripts/curation/picks.json.
//
// Picking is a human judgement call: the quiz asks you to read the track, so the close-up has
// to actually show spine, rails or ties. Filename search is no substitute — plenty of files
// called "...track.jpg" are wide shots, and most genuine close-ups are named something else.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OUT_DIR } from './lib/http.mjs';

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );

function renderCoaster(coaster) {
  const tiles = coaster.files
    .map((file) => {
      const name = escapeHtml(file.fileName);
      return `
      <figure class="tile">
        <img src="${escapeHtml(file.thumb)}" alt="" loading="lazy" />
        <figcaption>
          <span class="fn">${name}</span>
          <span class="dim">${file.width}&times;${file.height}</span>
          <label><input type="radio" name="${name}" value="closeup" data-file="${name}" /> close-up</label>
          <label><input type="radio" name="${name}" value="context" data-file="${name}" /> context</label>
          <label><input type="radio" name="${name}" value="" data-file="${name}" checked /> skip</label>
        </figcaption>
      </figure>`;
    })
    .join('');

  return `
  <section class="coaster" data-rcdb="${escapeHtml(coaster.rcdbId)}" data-name="${escapeHtml(coaster.name)}">
    <h2>${escapeHtml(coaster.name)}
      <small>${escapeHtml(coaster.park)}${coaster.opened ? ` · ${coaster.opened}` : ''}
        · <a href="https://rcdb.com/${escapeHtml(coaster.rcdbId)}.htm" target="_blank" rel="noopener">RCDB</a>
      </small>
    </h2>
    <div class="grid">${tiles}</div>
  </section>`;
}

function renderSheet(data) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Review — ${escapeHtml(data.label)}</title>
<style>
  body { background:#14161a; color:#e8e6e3; font:14px/1.45 system-ui, sans-serif; margin:0; padding:24px; }
  h1 { position:sticky; top:0; background:#14161a; padding:8px 0; margin:0 0 16px; }
  h2 { font-size:16px; margin:28px 0 8px; border-bottom:1px solid #2c3038; padding-bottom:6px; }
  small { font-weight:400; color:#9aa0aa; }
  a { color:#7fd1ff; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
  .tile { margin:0; background:#1b1e24; border-radius:8px; overflow:hidden; }
  .tile img { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; }
  figcaption { padding:6px 8px; font-size:11px; display:flex; flex-direction:column; gap:2px; }
  .fn { color:#9aa0aa; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .dim { color:#6b717c; }
  label { cursor:pointer; }
  #copy { position:fixed; right:24px; bottom:24px; padding:12px 18px; font-size:14px;
          background:#2f81f7; color:#fff; border:0; border-radius:8px; cursor:pointer; }
</style></head><body>
<h1>${escapeHtml(data.label)} — ${data.coasters.length} coasters</h1>
${data.coasters.map(renderCoaster).join('')}
<button id="copy">Copy picks</button>
<script>
document.getElementById('copy').addEventListener('click', () => {
  const picks = [];
  for (const section of document.querySelectorAll('.coaster')) {
    const chosen = { closeup: null, context: null };
    for (const input of section.querySelectorAll('input:checked')) {
      if (input.value) chosen[input.value] = input.dataset.file;
    }
    if (!chosen.closeup) continue;
    picks.push({
      id: section.dataset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      rcdbId: section.dataset.rcdb,
      family: 'TODO',
      closeup: chosen.closeup,
      context: chosen.context,
      blindAlt: 'TODO',
    });
  }
  navigator.clipboard.writeText(JSON.stringify(picks, null, 2));
  document.getElementById('copy').textContent = 'Copied ' + picks.length + ' picks';
});
</script>
</body></html>`;
}

const dir = join(OUT_DIR, 'candidates');
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const files =
  requested.length > 0
    ? requested.map((id) => `${id}.json`)
    : (await readdir(dir)).filter((name) => name.endsWith('.json'));

await mkdir(OUT_DIR, { recursive: true });

for (const file of files) {
  const data = JSON.parse(await readFile(join(dir, file), 'utf8'));
  const out = join(OUT_DIR, `review-${data.manufacturer}.html`);
  await writeFile(out, renderSheet(data));
  process.stdout.write(`${out}\n`);
}
