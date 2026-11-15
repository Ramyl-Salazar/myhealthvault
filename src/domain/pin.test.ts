import { beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { clearPin, pinWaitSeconds, setPin, verifyPin } from './pin';

beforeEach(() => { localStorage.clear(); clearPin(); vi.stubGlobal('crypto', webcrypto); });

it('stores a salted hash and verifies only the right PIN', async () => {
  expect(await setPin('1234')).toBe(true);
  const stored = localStorage.getItem('mhv.pin.v1') ?? '';
  expect(stored).not.toContain('1234');
  expect(JSON.parse(stored).iterations).toBeGreaterThanOrEqual(100000);
  expect(await verifyPin('0000')).toBe(false);
  expect(await verifyPin('1234')).toBe(true);
});

it('refuses the sixth try during a 30 second wait', async () => {
  vi.useFakeTimers();
  expect(await setPin('1234')).toBe(true);
  for (let index = 0; index < 5; index++) expect(await verifyPin('0000')).toBe(false);
  expect(pinWaitSeconds()).toBe(30);
  expect(await verifyPin('1234')).toBe(false);
  vi.useRealTimers();
});

it('does not set a PIN when storage fails', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(await setPin('1234')).toBe(false);
  vi.restoreAllMocks();
});
