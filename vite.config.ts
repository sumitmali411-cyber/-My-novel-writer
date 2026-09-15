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
        injectRegister: false,
        includeAssets: ['app-icon-192.png', 'app-icon-512.png', 'app-screenshot-mobile.png', 'app-screenshot-desktop.png'],
        workbox: {
          maximumFileSizeToCacheInBytes: 4000000 // 4MB
        },
        manifest: {
          id: '/',
          name: 'Inkwell',
          short_name: 'Inkwell',
          description: 'A beautiful, distraction-free writing environment.',
          theme_color: '#8b5cf6',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          orientation: 'portrait',
          categories: ['productivity', 'utilities', 'education'],
          dir: 'ltr',
          lang: 'en-US',
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          launch_handler: {
            client_mode: 'focus-existing'
          },
          file_handlers: [
            {
              action: '/',
              accept: {
                'text/plain': ['.txt'],
                'text/markdown': ['.md']
              }
            }
          ],
          protocol_handlers: [
            {
              protocol: 'web+inkwell',
              url: '/?url=%s'
            }
          ],
          share_target: {
            action: '/',
            method: 'GET',
            params: {
              title: 'title',
              text: 'text',
              url: 'url'
            }
          },
          edge_side_panel: {
            preferred_width: 400
          },
          prefer_related_applications: false,
          related_applications: [
            {
              platform: 'play',
              url: 'https://play.google.com/store/apps/details?id=com.inkwell.app',
              id: 'com.inkwell.app'
            }
          ],
          iarc_rating_id: 'e84b072d-71b3-4d3e-86ae-31a8ce4e53b7',
          scope_extensions: [
            {
              origin: '*.inkwell.app'
            }
          ],
          icons: [
            {
              src: 'https://placehold.co/192x192/8b5cf6/ffffff.png?text=IW',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'https://placehold.co/512x512/8b5cf6/ffffff.png?text=IW',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'https://placehold.co/192x192/8b5cf6/ffffff.png?text=IW',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'https://placehold.co/512x512/8b5cf6/ffffff.png?text=IW',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          screenshots: [
            {
              src: 'https://placehold.co/1080x1920/8b5cf6/ffffff.png?text=Inkwell+Mobile',
              sizes: '1080x1920',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Inkwell Mobile View'
            },
            {
              src: 'https://placehold.co/1920x1080/8b5cf6/ffffff.png?text=Inkwell+Desktop',
              sizes: '1920x1080',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Inkwell Desktop View'
            }
          ],
          shortcuts: [
            {
              name: 'New Story',
              short_name: 'New',
              description: 'Start writing a new story',
              url: '/',
              icons: [{ src: 'https://placehold.co/192x192/8b5cf6/ffffff.png?text=IW', sizes: '192x192', type: 'image/png' }]
            }
          ]
        },
        devOptions: {
          enabled: false,
        }
      })
    ],
    // NOTE: never `define` GEMINI_API_KEY here. Anything defined at build time
    // is inlined into the client bundle and readable by every visitor. The key
    // is used only by the Express server in server.ts.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
