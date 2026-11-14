// Fails the build on banned text and styles. Rules: docs/rules/no-slop.md.
// Usage: node scripts/check-slop.mjs [path ...]   (defaults to src)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const BANNED_PHRASES = [
  'welcome back', 'seamless', 'seamlessly', 'empower', 'journey', 'unlock', 'AI-powered',
  'effortless', 'effortlessly', 'supercharge', 'elevate', 'revolutionize', 'cutting-edge',
  'game-changing', 'at your fingertips', 'peace of mind', 'take control', 'say goodbye to',
  'oops', 'uh oh', 'whoops', 'hang tight', 'sit tight', 'awesome', 'magic', 'magical',
];

const BANNED_CLASSES = [
  'bg-gradient-to-', 'bg-linear-to-', 'from-purple-', 'from-indigo-', 'via-purple-',
  'to-purple-', 'to-indigo-', 'backdrop-blur', 'bg-clip-text',
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PHRASE_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${BANNED_PHRASES.map(escape).join('|')})(?![\\p{L}\\p{N}])`,
  'iu',
);
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const SCANNED = new Set(['.ts', '.tsx', '.css']);

const problems = [];
const report = (file, line, reason) => problems.push(`${file}:${line}: ${reason}`);

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const blank = (s) => s.replace(/[^\n]/g, ' ');

// Replace comments with spaces (keeping line breaks), leaving strings intact.
// Also returns the string literals found, with their start offsets.
function scan(code) {
  let out = '';
  const strings = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (c === '/' && next === '/') {
      const end = code.indexOf('\n', i);
      const stop = end === -1 ? code.length : end;
      out += blank(code.slice(i, stop));
      i = stop;
    } else if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end === -1 ? code.length : end + 2;
      out += blank(code.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c) {
        if (code[j] === '\\') j++;
        if (c !== '`' && code[j] === '\n') break;
        j++;
      }
      strings.push({ start: i, text: code.slice(i + 1, j) });
      out += code.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return { code: out, strings };
}

function checkProse(file, text, line) {
  const phrase = text.match(PHRASE_RE);
  if (phrase) report(file, line, `banned phrase "${phrase[1]}"`);
  if (text.includes('!')) report(file, line, 'exclamation mark');
  if (text.includes('\u2014')) report(file, line, 'em dash');
}

function checkMarkdown(file, source) {
  const lines = source.split('\n');
  let fenced = false;
  lines.forEach((raw, index) => {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    checkProse(file, raw.replace(/`[^`]*`/g, ''), index + 1);
  });
}

function checkSource(file, key, source) {
  const lines = source.split('\n');
  lines.forEach((line, index) => {
    if (EMOJI_RE.test(line)) report(file, index + 1, 'emoji');
  });

  const isCss = extname(file) === '.css';
  if (isCss) return;
  const { code, strings } = scan(source);

  if (key.includes('/copy/')) {
    for (const s of strings) checkProse(file, s.text, lineOf(source, s.start));
  }

  if (extname(file) === '.tsx') {
    for (const pattern of BANNED_CLASSES) {
      let at = code.indexOf(pattern);
      while (at !== -1) {
        report(file, lineOf(code, at), `banned class pattern "${pattern}"`);
        at = code.indexOf(pattern, at + 1);
      }
    }

    if (key.includes('/screens/') || key.includes('/ui/')) {
      // Blank string contents so quotes and angle brackets inside them are ignored.
      let jsx = code;
      for (const s of strings) {
        jsx = jsx.slice(0, s.start) + blank(source.slice(s.start, s.start + s.text.length + 2)) + jsx.slice(s.start + s.text.length + 2);
      }
      jsx = jsx.replace(/=>|>=/g, '  ');
      const re = />([^<>]*)</g;
      let m;
      while ((m = re.exec(jsx))) {
        const text = m[1].replace(/\{[^{}]*\}/g, '');
        if (/\p{L}/u.test(text)) {
          report(file, lineOf(jsx, m.index + 1 + m[1].search(/\S/)), `readable JSX text "${text.trim()}" (move it to src/copy/)`);
        }
      }
    }
  }
}

function checkFile(file) {
  const abs = resolve(file);
  const key = '/' + abs.split('\\').join('/');
  const display = file.split('\\').join('/');
  const source = readFileSync(abs, 'utf8');
  if (extname(abs) === '.md') checkMarkdown(display, source);
  else checkSource(display, key, source);
}

function* walk(path) {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path).sort()) {
      if (entry === 'node_modules') continue;
      yield* walk(join(path, entry));
    }
  } else if (SCANNED.has(extname(path)) || extname(path) === '.md') {
    yield path;
  }
}

const targets = process.argv.slice(2);
for (const target of targets.length ? targets : ['src']) {
  for (const file of walk(target)) checkFile(file);
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\ncheck:slop found ${problems.length} problem${problems.length === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log('check:slop: no problems found.');
