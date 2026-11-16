import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const sdk = process.env.ANDROID_HOME;
if (!sdk || !existsSync(sdk)) {
  console.error('Android build requires ANDROID_HOME to point to an installed Android SDK.');
  process.exit(1);
}

const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
const version = `${java.stdout ?? ''}\n${java.stderr ?? ''}`;
if (java.error || java.status !== 0 || !/(?:version\s+["']?21(?:[.\s"']|$)|openjdk\s+21(?:[.\s]|$))/i.test(version)) {
  console.error('Android build requires Java 21 on PATH.');
  process.exit(1);
}

const publicUrl = process.env.VITE_PUBLIC_URL;
if (!publicUrl || !/^https:\/\//i.test(publicUrl)) {
  console.error('Android build requires VITE_PUBLIC_URL set to the HTTPS live site.');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const windows = process.platform === 'win32';
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env: process.env, stdio: 'inherit', shell: windows });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(windows ? 'npm.cmd' : 'npm', ['run', 'build']);
run(windows ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android']);
run(windows ? 'gradlew.bat' : 'sh', windows ? ['assembleDebug'] : ['./gradlew', 'assembleDebug'], resolve(root, 'android'));
