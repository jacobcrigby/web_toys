import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { expect, test } from '@playwright/test';
import { makePdf } from './helpers/make-pdf';

test.describe('PDF to CBZ conversion', () => {
  let tmpDir: string;
  let singlePagePdf: string;
  let multiPagePdf: string;
  let longPdf: string;

  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-to-cbz-e2e-'));
    singlePagePdf = path.join(tmpDir, 'single-page.pdf');
    multiPagePdf = path.join(tmpDir, 'multi-page.pdf');
    longPdf = path.join(tmpDir, 'long.pdf');
    await Promise.all([
      fs.writeFile(singlePagePdf, await makePdf(1)),
      fs.writeFile(multiPagePdf, await makePdf(5)),
      fs.writeFile(longPdf, await makePdf(50)),
    ]);
  });

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // showSaveFilePicker is present in headless Chromium but throws AbortError (no
  // dialog). The app treats AbortError from the FSA picker as user dismissal and
  // calls onCancelled(). Remove it so capability detection returns false and the
  // app uses blob/anchor delivery instead.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript('delete window.showSaveFilePicker;');
  });

  test('single-page PDF converts and downloads a CBZ', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.locator('#file-input').setInputFiles(singlePagePdf);
    await page.locator('#metadata').waitFor({ state: 'visible' });

    const downloadPromise = page.waitForEvent('download');
    await page.locator('button[type="submit"]').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.cbz$/);

    await expect(page.locator('#status')).toContainText('Downloaded');
    await expect(page.locator('#progress')).toBeHidden();

    const savedPath = path.join(tmpDir, download.suggestedFilename());
    await download.saveAs(savedPath);
    const stat = await fs.stat(savedPath);
    expect(stat.size).toBeGreaterThan(0);

    expect(errors).toHaveLength(0);
  });

  test('multi-page PDF (5 pages) converts and downloads a CBZ', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.locator('#file-input').setInputFiles(multiPagePdf);
    await page.locator('#metadata').waitFor({ state: 'visible' });

    const downloadPromise = page.waitForEvent('download');
    await page.locator('button[type="submit"]').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.cbz$/);

    await expect(page.locator('#status')).toContainText('Downloaded');

    const savedPath = path.join(tmpDir, download.suggestedFilename());
    await download.saveAs(savedPath);
    const stat = await fs.stat(savedPath);
    expect(stat.size).toBeGreaterThan(0);

    expect(errors).toHaveLength(0);
  });

  test('cancel mid-conversion leaves no download and resets the UI', async ({ page }) => {
    let downloadTriggered = false;
    page.on('download', () => {
      downloadTriggered = true;
    });

    await page.goto('/');
    await page.locator('#file-input').setInputFiles(longPdf);
    await page.locator('#metadata').waitFor({ state: 'visible' });

    await page.locator('button[type="submit"]').click();

    // The progress bar is shown synchronously when Convert is clicked — before any
    // pages are rendered. Clicking cancel here aborts before completion.
    await expect(page.locator('#progress')).toBeVisible();
    await page.locator('#cancel').click();

    await expect(page.locator('#status')).toContainText('Cancelled', { timeout: 30_000 });
    await expect(page.locator('#status')).not.toContainText('Downloaded');
    await expect(page.locator('#progress')).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('#cancel')).toBeHidden();
    expect(downloadTriggered).toBe(false);
  });
});
