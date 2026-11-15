import { defineConfig } from '@playwright/test';

const port = 5199;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:${port}`, channel: 'msedge' },
  projects: [
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 } } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
