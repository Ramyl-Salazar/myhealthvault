import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const icon = await readFile(resolve(root, 'scripts/icons/app-icon.svg'), 'utf8');
const foreground = await readFile(resolve(root, 'scripts/icons/android-foreground.svg'), 'utf8');
const densities = [
  ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
];
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const [density, iconSize, foregroundSize] of densities) {
    for (const [name, size, svg, transparent] of [
      ['ic_launcher.png', iconSize, icon, false],
      ['ic_launcher_round.png', iconSize, icon, false],
      ['ic_launcher_foreground.png', foregroundSize, foreground, true],
    ]) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<style>html,body{margin:0;width:${size}px;height:${size}px}svg{width:${size}px;height:${size}px}</style>${svg}`);
      await page.locator('svg').screenshot({ path: resolve(root, `android/app/src/main/res/mipmap-${density}/${name}`), omitBackground: transparent });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
