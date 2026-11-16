import { defineConfig } from '@playwright/test';

const port = 5199;
// Set E2E_BASE_URL to run the tests against a deployed site instead of a local preview.
const live = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: live ?? `http://localhost:${port}`, channel: 'msedge' },
  projects: [
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 } } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: live
    ? undefined
    : {
        command: `npm run build && npm run preview -- --port ${port} --strictPort`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
