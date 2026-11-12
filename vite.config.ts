import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.GITHUB_PAGES === 'true' ? '/wedding-planner/' : '/'
let outDir = resolve('dist')
let resolvedBase = base

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'maskable-192.png', 'maskable-512.png', 'images/hero.webp'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff,woff2,ttf}'],
        // Launch screens are read by iOS when the app is added to the home screen; no need to precache 2.5 MB of them.
        globIgnores: ['**/splash/**', '**/images/cat/**'],
        // Card photos (~40 KB each) are cached as they're first seen rather than all downloaded on install.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/images/cat/'),
            handler: 'CacheFirst',
            options: { cacheName: 'card-photos', expiration: { maxEntries: 40 } },
          },
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Wedding Planner',
        short_name: 'Wedding',
        description: 'Plan a Northern Ireland wedding together, from the first ideas to the last thank-you.',
        theme_color: '#1F3B2D',
        background_color: '#1F3B2D',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
    {
      // GitHub Pages has no SPA rewrites: an unknown path like /wedding-planner/budget gets 404.html.
      // That page bounces straight to /wedding-planner/?/budget (served 200 as index.html), and the
      // restore script in index.html turns the URL back into /wedding-planner/budget before React starts.
      // (The spa-github-pages pattern by Rafael Pedicini, MIT.)
      // Build only: Vitest's dev server also calls closeBundle on shutdown (without GITHUB_PAGES),
      // which used to overwrite dist/404.html with keep = 0 and break deep links after a test run.
      name: 'spa-fallback',
      apply: 'build',
      configResolved(config) {
        outDir = resolve(config.root, config.build.outDir)
        resolvedBase = config.base
      },
      closeBundle() {
        const keep = resolvedBase.split('/').filter(Boolean).length
        const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>Wedding Planner</title>
<meta name="robots" content="noindex">
<script>
  var keep = ${keep};
  var l = window.location;
  l.replace(
    l.protocol + '//' + l.host +
    l.pathname.split('/').slice(0, 1 + keep).join('/') + '/?/' +
    l.pathname.slice(1).split('/').slice(keep).join('/').replace(/&/g, '~and~') +
    (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
    l.hash
  );
</script>
</head>
<body style="background:#F4EFE4"></body>
</html>
`
        try {
          writeFileSync(resolve(outDir, '404.html'), html)
        } catch {
          // preview builds without dist yet
        }
      },
    },
  ],
})
