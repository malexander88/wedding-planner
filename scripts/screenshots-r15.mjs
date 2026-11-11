import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const base = process.env.BASE_URL || 'http://127.0.0.1:4173/'
const out = '/workspace/wedding-planner/shots/round1_5'
await mkdir(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
})

async function ready(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((img) =>
        img.complete && img.naturalWidth
          ? null
          : new Promise((res) => {
              img.addEventListener('load', res, { once: true })
              img.addEventListener('error', res, { once: true })
            }),
      ),
    )
  })
  await page.waitForTimeout(150)
}

async function shot(page, name) {
  await ready(page)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false })
  console.log('saved', name)
}

const logs = []
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})
const page = await context.newPage()
page.on('console', (msg) => {
  if (msg.type() === 'error') logs.push(msg.text())
})
page.on('pageerror', (err) => logs.push(String(err)))

await page.goto(base, { waitUntil: 'networkidle' })
await page.getByText('Let’s start from the beginning').waitFor()
await shot(page, '01_onboarding')

await page.getByPlaceholder('Alex').fill('Matt')
await page.getByPlaceholder('Jordan').fill('Sam')
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('button', { name: 'Summer' }).click()
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('button', { name: 'Garden' }).click()
await page.getByRole('button', { name: 'Start planning' }).click()
await page.getByRole('heading', { name: 'Matt & Sam' }).waitFor()
await shot(page, '02_home')

await page.goto(base + 'plan', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: /What to do|Your deadlines/ }).waitFor()
await shot(page, '03_plan')

await page.goto(base + 'find', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Discover venues and suppliers' }).waitFor()
await page.locator('.supplier-card').first().waitFor()
await page.locator('.supplier-card').first().scrollIntoViewIfNeeded()
await page.evaluate(() => window.scrollBy(0, -100))
await shot(page, '04_find')

const shortlist = page.getByRole('button', { name: 'Shortlist' }).first()
await shortlist.click()
await page.getByRole('button', { name: 'Draft an enquiry' }).waitFor({ timeout: 8000 })
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(200)
await shot(page, '05_supplier')

await page.goto(base + 'budget', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Budget and payments' }).waitFor()
await shot(page, '06_budget')

await page.goto(base + 'guests', { waitUntil: 'networkidle' })
await page.getByPlaceholder('The Murrays, or Jordan + guest').fill('The Murrays')
await page.getByRole('button', { name: 'Add', exact: true }).click()
await page.getByRole('button', { name: 'Add a person' }).click()
await page.getByLabel('First name').fill('Sam')
await page.getByLabel('Last name').fill('Murray')
await page.getByLabel('Meal').fill('Chicken')
await page.getByLabel('Dietary needs').fill('Vegetarian')
await page.getByLabel('Travelling from').fill('Manchester')
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(200)
await shot(page, '07_guests')

if (logs.length) console.log('CONSOLE phone', logs)
else console.log('NO_CONSOLE_ERRORS phone')

const dlogs = []
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const dpage = await desk.newPage()
dpage.on('console', (msg) => { if (msg.type() === 'error') dlogs.push(msg.text()) })
dpage.on('pageerror', (err) => dlogs.push(String(err)))
await dpage.goto(base, { waitUntil: 'networkidle' })
// desktop context is fresh — complete onboarding if shown, else we're already in
if (await dpage.getByText('Let’s start from the beginning').count()) {
  await dpage.getByPlaceholder('Alex').fill('Matt')
  await dpage.getByPlaceholder('Jordan').fill('Sam')
  for (let i = 0; i < 3; i++) await dpage.getByRole('button', { name: 'Continue' }).click()
  await dpage.getByRole('button', { name: 'Summer' }).click()
  await dpage.getByRole('button', { name: 'Continue' }).click()
  await dpage.getByRole('button', { name: 'Garden' }).click()
  await dpage.getByRole('button', { name: 'Start planning' }).click()
}
await dpage.getByRole('heading', { name: 'Matt & Sam' }).waitFor()
await ready(dpage)
await dpage.screenshot({ path: `${out}/desktop_home.png` })
for (const path of ['plan', 'find', 'budget', 'guests', 'settings', 'dates']) {
  const resp = await dpage.goto(base + path, { waitUntil: 'networkidle' })
  console.log('desktop', path, resp?.status())
}
if (dlogs.length) console.log('CONSOLE desktop', dlogs)
else console.log('NO_CONSOLE_ERRORS desktop')

await context.close()
await desk.close()
await browser.close()
