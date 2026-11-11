// Renders the app icons and iPhone splash screens with headless Chrome so they
// use the same Cormorant Garamond "W" as the app. Run: node scripts/make-icons.mjs
// The committed PNGs were then palette-quantized (Pillow, 256 colours) to keep them small.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

const root = resolve(import.meta.dirname, '..')
const font = readFileSync(resolve(root, 'src/assets/fonts/CormorantGaramond.ttf')).toString('base64')
const C = { forest: '#1F3B2D', deep: '#16281F', gold: '#C9A55C', ivory: '#F8F1DF' }

const page = (w, h, body) => `<!doctype html><html><head><style>
@font-face { font-family: Corm; src: url(data:font/ttf;base64,${font}); font-weight: 300 700; }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
body { background: ${C.forest}; display: grid; place-items: center; font-family: Corm, Georgia, serif; }
</style></head><body>${body}</body></html>`

// Square, opaque, full-bleed: platforms round the corners themselves.
// `frame` draws the gold keyline; `scale` keeps the W inside the maskable safe zone.
function icon(size, { frame = true, scale = 1 } = {}) {
  const inset = Math.round(size * 0.06)
  const r = Math.round(size * 0.16)
  return page(size, size, `
    <div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 18%, #2A4B39 0%, ${C.forest} 45%, ${C.deep} 100%)"></div>
    ${frame ? `<div style="position:absolute;inset:${inset}px;border:${Math.max(2, Math.round(size * 0.012))}px solid ${C.gold};border-radius:${r}px"></div>` : ''}
    <div style="position:relative;color:${C.ivory};font-weight:500;font-size:${Math.round(size * 0.56 * scale)}px;line-height:1;transform:translateY(-${Math.round(size * 0.03 * scale)}px)">W</div>
    <div style="position:absolute;left:50%;top:${50 + 23 * scale}%;transform:translate(-50%,0);display:flex;align-items:center;gap:${Math.round(size * 0.02 * scale)}px">
      <i style="display:block;width:${Math.round(size * 0.1 * scale)}px;height:${Math.max(1, Math.round(size * 0.006))}px;background:${C.gold};opacity:.8"></i>
      <svg width="${Math.round(size * 0.045 * scale)}" height="${Math.round(size * 0.045 * scale)}" viewBox="0 0 12 12" fill="${C.gold}"><path d="M6 0c.2 2.4 1.6 4.4 3.6 5.2C7.6 6 6.2 8 6 10.4 5.8 8 4.4 6 2.4 5.2 4.4 4.4 5.8 2.4 6 0z"/></svg>
      <i style="display:block;width:${Math.round(size * 0.1 * scale)}px;height:${Math.max(1, Math.round(size * 0.006))}px;background:${C.gold};opacity:.8"></i>
    </div>`)
}

function splash(w, h) {
  const u = Math.min(w, h) / 100
  return page(w, h, `
    <div style="position:absolute;inset:0;background:radial-gradient(90% 60% at 50% 38%, #2A4B39 0%, ${C.forest} 50%, ${C.deep} 100%)"></div>
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-${u * 4}px)">
      <div style="width:${u * 30}px;height:${u * 30}px;border-radius:${u * 7.5}px;border:${u * 0.45}px solid ${C.gold};display:grid;place-items:center;color:${C.ivory};font-size:${u * 19}px;font-weight:500;line-height:1"><span style="transform:translateY(-${u * 0.6}px)">W</span></div>
      <div style="margin-top:${u * 7}px;color:${C.ivory};font-size:${u * 9}px;font-weight:500;letter-spacing:-0.01em">Wedding Planner</div>
      <div style="margin-top:${u * 3}px;display:flex;align-items:center;gap:${u * 2}px">
        <i style="display:block;width:${u * 12}px;height:${u * 0.3}px;background:${C.gold};opacity:.8"></i>
        <svg width="${u * 3.2}" height="${u * 3.2}" viewBox="0 0 12 12" fill="${C.gold}"><path d="M6 0c.2 2.4 1.6 4.4 3.6 5.2C7.6 6 6.2 8 6 10.4 5.8 8 4.4 6 2.4 5.2 4.4 4.4 5.8 2.4 6 0z"/></svg>
        <i style="display:block;width:${u * 12}px;height:${u * 0.3}px;background:${C.gold};opacity:.8"></i>
      </div>
    </div>`)
}

/** Portrait iPhone screens: [CSS width, CSS height, device pixel ratio]. */
export const IPHONES = [
  [440, 956, 3], // 16 Pro Max
  [402, 874, 3], // 16 Pro
  [430, 932, 3], // 14/15 Pro Max, 15/16 Plus
  [393, 852, 3], // 14/15 Pro, 15, 16
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 12/13 Pro
  [414, 896, 3], // XS Max, 11 Pro Max
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 2], // XR, 11
  [375, 667, 2], // SE (2nd/3rd gen), 6/7/8
]

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] })
async function shot(html, w, h, file) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await p.setContent(html)
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: resolve(root, 'public', file), omitBackground: false })
  await p.close()
}
await shot(icon(512), 512, 512, 'pwa-512.png')
await shot(icon(192), 192, 192, 'pwa-192.png')
await shot(icon(180, { frame: false, scale: 0.92 }), 180, 180, 'apple-touch-icon.png')
await shot(icon(512, { frame: false, scale: 0.72 }), 512, 512, 'maskable-512.png')
await shot(icon(192, { frame: false, scale: 0.72 }), 192, 192, 'maskable-192.png')
await shot(icon(64), 64, 64, 'favicon.png')
const links = []
for (const [cw, ch, dpr] of IPHONES) {
  const file = `splash/iphone-${cw * dpr}x${ch * dpr}.png`
  await shot(splash(cw * dpr, ch * dpr), cw * dpr, ch * dpr, file)
  links.push(`    <link rel="apple-touch-startup-image" href="${file}" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`)
}
writeFileSync(resolve(root, 'scripts/splash-links.html'), links.join('\n') + '\n') // paste into index.html
await browser.close()
console.log('icons and', IPHONES.length, 'splash screens written')
