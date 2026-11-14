import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'slop');
const script = join(here, 'check-slop.mjs');

function find(dir, name) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const hit = find(full, name);
      if (hit) return hit;
    } else if (entry === name) {
      return full;
    }
  }
  return null;
}

function run(name) {
  const file = find(fixtures, name);
  if (!file) throw new Error(`Missing fixture ${name}`);
  const result = spawnSync(process.execPath, [script, resolve(file)], { encoding: 'utf8' });
  return { code: result.status, out: result.stdout + result.stderr };
}

test('flags a banned phrase in copy', () => expect(run('copy-banned.ts')).toMatchObject({ code: 1, out: expect.stringMatching(/seamless/i) }));
test('flags an exclamation mark in copy', () => expect(run('copy-bang.ts').code).toBe(1));
test('flags an em dash in copy', () => expect(run('copy-emdash.ts').code).toBe(1));
test('flags a gradient class in a component', () => expect(run('gradient.tsx').code).toBe(1));
test('flags literal JSX text in a screen', () => expect(run('literal.tsx').code).toBe(1));
test('flags an emoji', () => expect(run('emoji.tsx').code).toBe(1));
test('passes clean files', () => expect(run('clean.tsx').code).toBe(0));
test('flags a banned phrase in markdown', () => expect(run('md-banned.md').code).toBe(1));
test('ignores code in markdown', () => expect(run('md-code-bang.md').code).toBe(0));
