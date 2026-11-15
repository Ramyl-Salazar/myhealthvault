import { act, cleanup, render, screen } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearPin, setPin } from '../domain/pin';
import { PinGate } from './PinLock';
const privateApp = 'Private app';

beforeEach(() => { localStorage.clear(); clearPin(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('locks after the page has been hidden for five minutes', async () => {
  await setPin('1234');
  vi.useFakeTimers();
  let visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility as DocumentVisibilityState);
  render(<MemoryRouter><PinGate><p>{privateApp}</p></PinGate></MemoryRouter>);
  expect(screen.getByText('Enter PIN')).not.toBeNull();
  cleanup();
  clearPin();
  render(<MemoryRouter><PinGate><p>{privateApp}</p></PinGate></MemoryRouter>);
  await setPin('1234');
  act(() => {
    visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(300000);
    visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(screen.getByText('Enter PIN')).not.toBeNull();
});
