import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'app-icon-192.png',
          'app-icon-512.png',
          'app-icon-maskable-192.png',
          'app-icon-maskable-512.png',
          'app-screenshot-mobile.png',
          'app-screenshot-desktop.png',
        ],
        workbox: {
          maximumFileSizeToCacheInBytes: 4000000, // 4MB
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
        },
        manifest: {
          id: '/',
          name: 'Inkwell',
          short_name: 'Inkwell',
          description: 'A beautiful, distraction-free writing environment for story writers.',
          theme_color: '#8b5cf6',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/?source=pwa',
          orientation: 'portrait',
          categories: ['productivity', 'utilities', 'education'],
          dir: 'ltr',
          lang: 'en-US',
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          launch_handler: {
            client_mode: 'focus-existing',
          },
          file_handlers: [
            {
              action: '/',
              accept: {
                'text/plain': ['.txt'],
                'text/markdown': ['.md'],
              },
            },
          ],
          share_target: {
            action: '/',
            method: 'GET',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
            },
          },
          icons: [
            {
              src: '/app-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/app-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/app-icon-maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/app-icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: '/app-screenshot-mobile.png',
              sizes: '1080x1920',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Inkwell Mobile View',
            },
            {
              src: '/app-screenshot-desktop.png',
              sizes: '1920x1080',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Inkwell Desktop View',
            },
          ],
          shortcuts: [
            {
              name: 'New Story',
              short_name: 'New',
              description: 'Start writing a new story',
              url: '/',
              icons: [
                {
                  src: '/app-icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify -- file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
