import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Project Pages live at https://<user>.github.io/wttracker/ — must match the repo name. */
const base = process.env.GITHUB_ACTIONS === 'true' ? '/wttracker/' : '/'

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
      includeAssets: ['favicon.svg', 'icons.svg'],
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
