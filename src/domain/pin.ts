import { safeStorage } from './storage';

interface PinRecord { salt: number[]; hash: number[]; iterations: number; failures: number; waitUntil: number }
const key = 'mhv.pin.v1';
const iterations = 120000;
let memory: PinRecord | null = null;
let verificationChain: Promise<unknown> = Promise.resolve();

function read(): PinRecord | null {
  const raw = safeStorage.get(key);
  if (raw) {
    try {
      const value = JSON.parse(raw) as PinRecord;
      if (Array.isArray(value.salt) && Array.isArray(value.hash) && value.iterations >= 100000) return value;
    } catch { /* corrupted record */ }
  }
  return memory;
}
function write(value: PinRecord): boolean { memory = value; return safeStorage.set(key, JSON.stringify(value)); }
async function hash(pin: string, salt: number[], rounds: number): Promise<number[]> {
  const input = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return Array.from(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations: rounds }, input, 256)));
}
export async function setPin(pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin) || !safeStorage.available()) return false;
  try {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    const record = { salt, hash: await hash(pin, salt, iterations), iterations, failures: 0, waitUntil: 0 };
    if (!safeStorage.set(key, JSON.stringify(record))) return false;
    memory = record;
    return true;
  } catch { return false; }
}
export function hasPin(): boolean { return read() !== null; }
export function clearPin(): void { memory = null; safeStorage.remove(key); }
export function pinWaitSeconds(): number { return Math.max(0, Math.ceil(((read()?.waitUntil ?? 0) - Date.now()) / 1000)); }
export function verifyPin(pin: string): Promise<boolean> {
  const attempt = verificationChain.then(() => verifyPinOnce(pin));
  verificationChain = attempt.catch(() => false);
  return attempt;
}

async function verifyPinOnce(pin: string): Promise<boolean> {
  const record = read();
  if (!record || pinWaitSeconds() > 0) return false;
  try {
    const candidate = await hash(pin, record.salt, record.iterations);
    let difference = candidate.length ^ record.hash.length;
    for (let index = 0; index < candidate.length; index++) difference |= candidate[index] ^ (record.hash[index] ?? 0);
    if (difference === 0) { write({ ...record, failures: 0, waitUntil: 0 }); return true; }
    const failures = record.failures + 1;
    write({ ...record, failures, waitUntil: failures >= 5 ? Date.now() + 30000 : 0 });
    return false;
  } catch { return false; }
}
