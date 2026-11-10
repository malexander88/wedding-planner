import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const base = process.env.BASE_URL || 'http://127.0.0.1:4173/wedding-planner/'
const out = '/workspace/wedding-planner/shots/round1'
await mkdir(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

async function shot(page, name) {
  await page.addStyleTag({
    content: `
      .bottom-nav { display: none !important; }
      .main { padding-bottom: 32px !important; }
    `,
  })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log('saved', name)
}

async function onboard(page) {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByText('Let’s start from the beginning').waitFor()
  await page.getByPlaceholder('Alex').fill('Alex')
  await page.getByPlaceholder('Jordan').fill('Jordan')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Summer' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Garden' }).click()
}

async function run(width, height, prefix) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const logs = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') logs.push(msg.text())
  })
  page.on('pageerror', (err) => logs.push(String(err)))

  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByText('Let’s start from the beginning').waitFor()
  await shot(page, `${prefix}_01_onboarding`)

  await page.getByPlaceholder('Alex').fill('Alex')
  await page.getByPlaceholder('Jordan').fill('Jordan')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Summer' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Garden' }).click()
  await page.getByRole('button', { name: 'Start planning' }).click()
  await page.getByRole('heading', { name: 'Alex & Jordan' }).waitFor()
  await page.waitForTimeout(400)
  await shot(page, `${prefix}_02_home`)

  await page.goto(base + 'plan', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /What to do|Your deadlines/ }).waitFor()
  await shot(page, `${prefix}_03_checklist_staged`)

  await page.goto(base + 'dates', { waitUntil: 'networkidle' })
  const dayBtns = page.locator('.cal button')
  const count = await dayBtns.count()
  if (count > 20) {
    await dayBtns.nth(12).click()
    await dayBtns.nth(18).click()
    await dayBtns.nth(19).click()
  }
  await page.waitForTimeout(200)
  const useBtn = page.getByRole('button', { name: 'Use this date' }).first()
  if (await useBtn.count()) await useBtn.click()
  await page.waitForTimeout(400)
  await shot(page, `${prefix}_04_dates`)

  await page.goto(base + 'plan', { waitUntil: 'networkidle' })
  await shot(page, `${prefix}_05_checklist_dated`)

  await page.goto(base + 'find', { waitUntil: 'networkidle' })
  await shot(page, `${prefix}_06_find`)

  const shortlist = page.getByRole('button', { name: 'Shortlist' }).first()
  if (await shortlist.count()) {
    await shortlist.click()
    await page.getByRole('button', { name: 'Draft an enquiry' }).waitFor({ timeout: 8000 })
    await page.waitForTimeout(400)
    await shot(page, `${prefix}_07_supplier`)
    await page.getByRole('button', { name: 'Draft an enquiry' }).click()
    await page.getByText('Enquiry draft').waitFor()
    await shot(page, `${prefix}_08_enquiry`)
    await page.getByRole('button', { name: 'Close' }).click()
    await page.locator('input[type="number"]').first().fill('2400')
    await page.getByPlaceholder('Their answer').first().fill('Yes, VAT included')
    await page.getByRole('button', { name: 'Save quote' }).click()
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Book them' }).click()
    await page.getByText('Deposit (£)').waitFor()
    await page.locator('.modal input[type="number"]').first().fill('500')
    await page.getByRole('button', { name: 'Confirm booking' }).click()
    await page.getByRole('heading', { name: 'Budget and payments' }).waitFor({ timeout: 8000 })
    await page.waitForTimeout(400)
  }

  await page.goto(base + 'budget', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Budget and payments' }).waitFor()
  await shot(page, `${prefix}_09_budget`)

  await page.goto(base + 'guests', { waitUntil: 'networkidle' })
  await page.getByPlaceholder('The Murrays, or Jordan + guest').fill('The Murrays')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Add a person' }).click()
  await page.getByLabel('First name').fill('Sam')
  await page.getByLabel('Last name').fill('Murray')
  await page.getByLabel('Meal').fill('Chicken')
  await page.getByLabel('Dietary needs').fill('Vegetarian')
  await page.getByLabel('Travelling from').fill('Manchester')
  await page.getByRole('button', { name: 'Add a plus-one' }).click()
  await page.waitForTimeout(300)
  await shot(page, `${prefix}_10_guests`)

  await page.goto(base + 'settings', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Your wedding details' }).waitFor()
  await shot(page, `${prefix}_11_settings`)

  if (logs.length) console.log('CONSOLE', prefix, logs)
  else console.log('NO_CONSOLE_ERRORS', prefix)
  await context.close()
}

await run(390, 844, 'phone')
await run(1440, 900, 'desktop')
await browser.close()
