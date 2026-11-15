import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'MyHealthVault', short_name: 'MyHealthVault', display: 'standalone', start_url: '/', scope: '/',
      theme_color: '#2b5fd9', background_color: '#f2f5fa',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{html,js,css,woff,woff2,png,svg,webmanifest}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/s\//],
    },
  })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs', 'supabase/functions/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'scripts/fixtures/**', 'tests/**'],
  },
});
