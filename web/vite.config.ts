/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export const pwaOptions = {
  registerType: 'autoUpdate' as const,
  manifest: {
    name: 'Riptide',
    short_name: 'Riptide',
    description: 'Build and log full-body lifting programs.',
    display: 'standalone' as const,
    background_color: '#0D1013',
    theme_color: '#0D1013',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
};

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/*.emulator.test.{ts,tsx}'],
  },
});
