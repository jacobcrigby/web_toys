// TEMPORARY — not part of the test suite, delete after run
import { test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const ROOT = process.cwd();
const PDFS = ['HWASG Full Final.pdf', 'MOM vol1.pdf', 'MixingMortarFull.pdf'];

for (const pdfName of PDFS) {
  test(`compare: ${pdfName}`, async ({ page }) => {
    test.setTimeout(600_000);

    const pdfPath = path.join(ROOT, pdfName);

    // --- source page count via pdf-lib ---
    let expectedPages: number | null = null;
    try {
      const bytes = await fs.readFile(pdfPath);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      expectedPages = doc.getPageCount();
    } catch (e) {
      console.log(`  pdf-lib parse warning: ${String(e)}`);
    }

    // --- convert via the app ---
    await page.addInitScript('delete window.showSaveFilePicker;');
    await page.goto('/');

    await page.locator('#file-input').setInputFiles(pdfPath);
    await page.locator('#metadata').waitFor({ state: 'visible' });

    const appWarning = (await page.locator('#warning').textContent())?.trim() ?? '';

    const downloadPromise = page.waitForEvent('download', { timeout: 600_000 });
    await page.locator('button[type="submit"]').click();
    const download = await downloadPromise;

    await page.locator('#status').waitFor();
    const appStatus = (await page.locator('#status').textContent())?.trim() ?? '';

    // --- inspect CBZ ---
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cbz-cmp-'));
    try {
      const cbzPath = path.join(tmpDir, download.suggestedFilename());
      await download.saveAs(cbzPath);
      const cbzStat = await fs.stat(cbzPath);
      const cbzBytes = await fs.readFile(cbzPath);
      const entries = unzipSync(new Uint8Array(cbzBytes));

      const images = Object.keys(entries)
        .filter((n) => /\.(jpg|jpeg|webp|png)$/i.test(n))
        .sort();

      const format = (images[0]?.split('.').pop() ?? '?').toUpperCase();
      const hasComicInfo = 'ComicInfo.xml' in entries;
      const pageMatch =
        expectedPages == null
          ? 'unknown'
          : expectedPages === images.length
            ? `YES (${images.length})`
            : `NO — PDF ${expectedPages} vs CBZ ${images.length}`;

      // spot-check: all images non-empty
      const emptyImages = images.filter((n) => (entries[n]?.length ?? 0) === 0);

      console.log(
        [
          `\n=== ${pdfName} ===`,
          `  Source pages (pdf-lib) : ${expectedPages ?? 'n/a'}`,
          `  CBZ images             : ${images.length}`,
          `  Page count match       : ${pageMatch}`,
          `  Image format           : ${format}`,
          `  CBZ size               : ${(cbzStat.size / 1024 / 1024).toFixed(1)} MB`,
          `  ComicInfo.xml          : ${hasComicInfo ? 'present' : 'MISSING'}`,
          `  Empty images           : ${emptyImages.length === 0 ? 'none' : emptyImages.join(', ')}`,
          `  App status             : ${appStatus}`,
          appWarning ? `  App warning            : ${appWarning}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
}
