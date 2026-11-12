// Renders the app icons and iPhone splash screens with headless Chrome so they
// use the app font: a gold ring with an italic ampersand. Run: node scripts/make-icons.mjs
// The committed PNGs were then palette-quantized (Pillow, 256 colours) to keep them small.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

const root = resolve(import.meta.dirname, '..')
const font = readFileSync(resolve(root, 'src/assets/fonts/CormorantGaramond.ttf')).toString('base64')
const italic = readFileSync(resolve(root, 'src/assets/fonts/CormorantGaramond-Italic.ttf')).toString('base64')
const C = { forest: '#1F3B2D', deep: '#122219', lift: '#2C4E3B', gold: '#C9A55C', goldHi: '#E8CF94', goldLo: '#A9853C', ivory: '#F8F1DF' }

const page = (w, h, body) => `<!doctype html><html><head><style>
@font-face { font-family: Corm; src: url(data:font/ttf;base64,${font}); font-weight: 300 700; }
@font-face { font-family: CormI; src: url(data:font/ttf;base64,${italic}); font-weight: 300 700; font-style: italic; }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
body { background: ${C.forest}; display: grid; place-items: center; font-family: Corm, Georgia, serif; }
.amp { font-family: CormI, Georgia, serif; font-style: italic; font-weight: 500; line-height: 1;
  background: linear-gradient(160deg, ${C.ivory} 25%, ${C.goldHi} 80%); -webkit-background-clip: text; background-clip: text; color: transparent; }
</style></head><body>${body}</body></html>`

const bg = (at = '32% 20%') =>
  `<div style="position:absolute;inset:0;background:radial-gradient(130% 95% at ${at}, ${C.lift} 0%, ${C.forest} 48%, ${C.deep} 100%)"></div>
   <div style="position:absolute;inset:0;background:radial-gradient(60% 40% at 50% 0%, rgba(232,207,148,.10), transparent 70%)"></div>`

/** The mark: a fine gold ring with a small sparkle set at the top, and an italic ampersand inside. d = ring diameter. */
function mark(d) {
  const stroke = Math.max(1.5, d * 0.034)
  const spark = d * 0.22
  return `<div style="position:relative;width:${d}px;height:${d}px">
    <div style="position:absolute;inset:0;border-radius:50%;padding:${stroke}px;
      background:conic-gradient(from 200deg, ${C.goldLo}, ${C.goldHi}, ${C.gold}, ${C.goldLo}, ${C.goldHi}, ${C.goldLo});
      -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude"></div>
    <svg style="position:absolute;left:50%;top:0;transform:translate(-50%,-50%)" width="${spark}" height="${spark}" viewBox="0 0 12 12">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.goldHi}"/><stop offset="1" stop-color="${C.gold}"/></linearGradient></defs>
      <circle cx="6" cy="6" r="3.4" fill="${C.forest}"/>
      <path fill="url(#g)" d="M6 0.6c.3 2.7 1.5 4.3 4.6 5.4C7.5 7.1 6.3 8.7 6 11.4 5.7 8.7 4.5 7.1 1.4 6 4.5 4.9 5.7 3.3 6 .6z"/>
    </svg>
    <div class="amp" style="position:absolute;inset:0;display:grid;place-items:center;font-size:${d * 0.72}px">
      <span style="transform:translate(${d * 0.005}px, ${d * 0.03}px)">&amp;</span></div>
  </div>`
}

// Square, opaque, full-bleed: platforms round the corners themselves. `scale` keeps the mark inside
// the maskable safe zone (a centred circle of 80%).
function icon(size, { scale = 1 } = {}) {
  return page(size, size, `${bg()}<div style="position:relative;transform:translateY(${size * 0.025 * scale}px)">${mark(size * 0.6 * scale)}</div>`)
}

function splash(w, h) {
  const u = Math.min(w, h) / 100
  return page(w, h, `
    ${bg('50% 34%')}
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-${u * 6}px)">
      ${mark(u * 34)}
      <div style="margin-top:${u * 10}px;color:${C.ivory};font-size:${u * 9.5}px;font-weight:500;letter-spacing:0.005em">Wedding Planner</div>
      <div style="margin-top:${u * 3.2}px;display:flex;align-items:center;gap:${u * 2.4}px;color:${C.gold};font-size:${u * 3.4}px;letter-spacing:0.3em;text-transform:uppercase;font-weight:600">
        <i style="display:block;width:${u * 9}px;height:${Math.max(1, u * 0.28)}px;background:linear-gradient(90deg,transparent,${C.gold})"></i>
        For the two of you
        <i style="display:block;width:${u * 9}px;height:${Math.max(1, u * 0.28)}px;background:linear-gradient(90deg,${C.gold},transparent)"></i>
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
await shot(icon(180, { scale: 1.05 }), 180, 180, 'apple-touch-icon.png')
await shot(icon(512, { scale: 0.86 }), 512, 512, 'maskable-512.png')
await shot(icon(192, { scale: 0.86 }), 192, 192, 'maskable-192.png')
await shot(icon(64, { scale: 1.2 }), 64, 64, 'favicon.png')
const links = []
for (const [cw, ch, dpr] of IPHONES) {
  const file = `splash/iphone-${cw * dpr}x${ch * dpr}.png`
  await shot(splash(cw * dpr, ch * dpr), cw * dpr, ch * dpr, file)
  links.push(`    <link rel="apple-touch-startup-image" href="${file}" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`)
}
writeFileSync(resolve(root, 'scripts/splash-links.html'), links.join('\n') + '\n') // paste into index.html
await browser.close()
console.log('icons and', IPHONES.length, 'splash screens written')
