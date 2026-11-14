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


const flags = (name, reason) => expect(run(name)).toMatchObject({ code: 1, out: expect.stringMatching(reason) });

test('flags a banned phrase in copy', () => flags('copy-banned.ts', /banned phrase "seamless"/i));
test('flags an exclamation mark in copy', () => flags('copy-bang.ts', /exclamation/));
test('flags an em dash in copy', () => flags('copy-emdash.ts', /em dash/));
test('flags a gradient class in a component', () => flags('gradient.tsx', /banned class pattern/));
test('flags literal JSX text in a screen', () => flags('literal.tsx', /JSX text/));
test('flags an emoji', () => flags('emoji.tsx', /emoji/));
test('passes clean files', () => expect(run('clean.tsx').code).toBe(0));
test('flags a banned phrase in markdown', () => flags('md-banned.md', /banned phrase "seamless"/));
test('ignores code in markdown', () => expect(run('md-code-bang.md').code).toBe(0));

test('flags JSX text with an apostrophe', () => flags('apostrophe.tsx', /JSX text "Don't do this"/));
test('flags JSX text on its own line, reporting that line', () => flags('multiline.tsx', /multiline\.tsx:5: readable JSX text/));
test('passes a screen with generics, conditionals, maps and comparisons', () => expect(run('clean-react.tsx')).toMatchObject({ code: 0 }));
test('passes a ui component with generics, conditionals, maps and comparisons', () => expect(run('clean-ui.tsx')).toMatchObject({ code: 0 }));
