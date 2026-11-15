import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OfflineActionReason, OfflineBanner } from './OfflineBanner';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows the read-only banner and write reason when the browser goes offline', () => {
  let online = true;
  vi.stubGlobal('navigator', { ...navigator, get onLine() { return online; } });
  render(<><OfflineBanner /><OfflineActionReason /></>);
  expect(screen.queryByRole('status')).toBeNull();
  online = false;
  fireEvent(window, new Event('offline'));
  expect(screen.getByRole('status').textContent).toBe('You are offline. Records are read-only until you reconnect.');
  expect(screen.getByText('Reconnect to make changes.')).not.toBeNull();
});
