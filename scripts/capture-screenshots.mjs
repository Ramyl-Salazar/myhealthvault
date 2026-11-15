import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = 'http://localhost:5199';
const output = resolve(import.meta.dirname, '../docs/screenshots');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(base);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await page.getByText(/Possible duplicate: Glucophage, Metformin/).waitFor();
  await page.screenshot({ path: resolve(output, 'home.png') });

  await page.getByRole('link', { name: 'Timeline', exact: true }).click();
  await page.getByText('Metformin', { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve(output, 'timeline.png') });

  await page.getByRole('link', { name: 'Add', exact: true }).click();
  await page.getByRole('link', { name: 'Scan a document' }).click();
  await page.getByRole('button', { name: 'Prescription sample' }).waitFor();
  await page.screenshot({ path: resolve(output, 'scan.png') });

  await page.getByRole('link', { name: 'Share', exact: true }).click();
  await page.getByRole('link', { name: 'Make a share link' }).click();
  await page.getByLabel('How long it lasts').waitFor();
  await page.screenshot({ path: resolve(output, 'share.png') });
  await context.close();
} finally {
  await browser.close();
}
