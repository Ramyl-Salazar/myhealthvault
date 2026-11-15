import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';

const DAY_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: DAY_MS, staleTime: 30_000, retry: 1 } },
});

// Storage can be missing or throw (private windows, blocked site data).
// Every access is wrapped so persistence quietly turns off instead of failing.
const safeStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // storage unavailable or full
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // storage unavailable
    }
  },
};

export const persister = createSyncStoragePersister({ storage: safeStorage, key: 'mhv-query-cache' });

export const persistOptions = { persister, maxAge: DAY_MS };
