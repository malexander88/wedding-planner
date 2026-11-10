import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.GITHUB_PAGES === 'true' ? '/wedding-planner/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.png', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'Wedding Planner',
        short_name: 'Wedding',
        description: 'Plan a Northern Ireland wedding together, from the first ideas to the last thank-you.',
        theme_color: '#C4787A',
        background_color: '#FBF6F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
    {
      name: 'spa-fallback',
      closeBundle() {
        try {
          copyFileSync(resolve('dist/index.html'), resolve('dist/404.html'))
        } catch {
          // preview builds without dist yet
        }
      },
    },
  ],
})
