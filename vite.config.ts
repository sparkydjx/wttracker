import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Project Pages base path:
 * - local dev: '/'
 * - GitHub Actions: '/<repo-name>/'
 */
const base =
  process.env.GITHUB_ACTIONS === 'true'
    ? `/${(process.env.GITHUB_REPOSITORY ?? '').split('/')[1] ?? 'wttracker'}/`
    : '/'

export default defineConfig({
  base,
  server: {
    port: 4173,
  },
  preview: {
    port: 4173,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'WT Tracker',
        short_name: 'WT Tracker',
        description: 'WT Tracker progressive web app',
        theme_color: '#0e1018',
        background_color: '#0e1018',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/IMG_2793.PNG', '**/acotar-bg.png'],
      },
    }),
  ],
})
