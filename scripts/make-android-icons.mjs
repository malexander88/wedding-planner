// Renders the Android launcher icons and splash assets with the same mark as the PWA icons
// (gold ring, sparkle, italic ampersand on forest). Run: node scripts/make-android-icons.mjs
import { mkdirSync, readFileSync } from 'node:fs'
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

const RES = resolve(root, 'android/app/src/main/res')
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const transparent = (w, h, body) => page(w, h, body).replace(`background: ${C.forest}`, 'background: transparent')

// Adaptive icon (API 26+): 108dp layers, everything that matters inside the central 66dp.
const adaptiveBg = (s) => page(s, s, bg())
const adaptiveFg = (s) => transparent(s, s, `<div style="transform:translateY(${s * 0.012}px)">${mark(s * 0.42)}</div>`)
// Legacy icons (API 24-25): full square and round versions.
const legacy = (s, round) =>
  page(s, s, `<div style="position:absolute;inset:0;overflow:hidden;border-radius:${round ? '50%' : `${s * 0.18}px`}">${bg()}</div>
    <div style="position:relative;transform:translateY(${s * 0.02}px)">${mark(s * 0.56)}</div>`).replace(`background: ${C.forest}`, 'background: transparent')
// Splash (API 31+): icon area 288dp with content inside a 192dp circle; also used centred on older phones.
const splashIcon = (s) => transparent(s, s, `<div style="transform:translateY(${s * 0.01}px)">${mark(s * 0.46)}</div>`)
const branding = (w, h) =>
  transparent(w, h, `<div style="color:${C.ivory};font-size:${h * 0.3}px;font-weight:500;letter-spacing:0.005em;white-space:nowrap">Wedding Planner</div>`)

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] })
async function shot(html, w, h, file) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await p.setContent(html)
  await p.evaluate(() => document.fonts.ready)
  mkdirSync(resolve(file, '..'), { recursive: true })
  await p.screenshot({ path: file, omitBackground: true })
  await p.close()
}
for (const [d, k] of Object.entries(DENS)) {
  const mip = (n) => resolve(RES, `mipmap-${d}`, n)
  await shot(adaptiveBg(108 * k), 108 * k, 108 * k, mip('ic_launcher_background.png'))
  await shot(adaptiveFg(108 * k), 108 * k, 108 * k, mip('ic_launcher_foreground.png'))
  await shot(legacy(48 * k, false), 48 * k, 48 * k, mip('ic_launcher.png'))
  await shot(legacy(48 * k, true), 48 * k, 48 * k, mip('ic_launcher_round.png'))
  await shot(splashIcon(288 * k), 288 * k, 288 * k, resolve(RES, `drawable-${d}`, 'splash_icon.png'))
  await shot(branding(200 * k, 80 * k), 200 * k, 80 * k, resolve(RES, `drawable-${d}`, 'splash_branding.png'))
}
await browser.close()
console.log('android icons written')
