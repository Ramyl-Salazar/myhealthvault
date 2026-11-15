import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'scripts/icons');
const target = resolve(root, 'public/icons');
await mkdir(target, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const [name, size, file] of [
    ['app-icon.svg', 192, 'icon-192.png'],
    ['app-icon.svg', 512, 'icon-512.png'],
    ['app-icon-maskable.svg', 512, 'icon-512-maskable.png'],
    ['app-icon.svg', 180, 'apple-touch-icon.png'],
  ]) {
    const svg = await readFile(resolve(source, name), 'utf8');
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;width:${size}px;height:${size}px}svg{width:${size}px;height:${size}px}</style>${svg}`);
    await page.locator('svg').screenshot({ path: resolve(target, file) });
    await page.close();
  }
} finally {
  await browser.close();
}
