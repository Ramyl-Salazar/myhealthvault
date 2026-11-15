import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const SAMPLES = ['prescription', 'lab-report', 'discharge'];
const rootDir = process.cwd();
const outDir = resolve(rootDir, 'public', 'samples');

mkdirSync(outDir, { recursive: true });

async function makeSamples() {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1600 },
      deviceScaleFactor: 1,
    });

    for (const id of SAMPLES) {
      const htmlPath = resolve(rootDir, 'scripts', 'samples', `${id}.html`);
      const fileUrl = pathToFileURL(htmlPath).href;
      await page.goto(fileUrl, { waitUntil: 'load' });
      const outputPath = resolve(outDir, `${id}.png`);
      await page.screenshot({ path: outputPath, fullPage: true });
      console.log(`Rendered ${id} -> ${outputPath}`);
    }
  } finally {
    await browser.close();
  }
}

makeSamples().catch((err) => {
  console.error(err);
  process.exit(1);
});
