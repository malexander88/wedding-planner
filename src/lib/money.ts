// Money display.
//
// The plan has ONE currency (profile.currency: £ by default, or €), shared by both phones. Every amount the
// couple types is stored as a plain number in that currency — there is no per-amount currency, so totals never
// mix the two. Switching currency either converts every stored amount at a rate they confirm, or (if they had
// already been typing euro figures) just changes the symbol. See convertAmounts().
//
// Official Northern Ireland fees (registrar, GRO) are sterling prices set by law, so they always show in £
// via gbp(), whatever the plan currency.

export type Currency = 'GBP' | 'EUR'
export const CURRENCIES: { id: Currency; symbol: string; label: string }[] = [
  { id: 'GBP', symbol: '£', label: 'Pounds (£)' },
  { id: 'EUR', symbol: '€', label: 'Euro (€)' },
]

let current: Currency = 'GBP'
const formats = new Map<string, Intl.NumberFormat>()
function fmt(c: Currency, exact: boolean) {
  const key = `${c}:${exact}`
  let f = formats.get(key)
  if (!f) {
    f = new Intl.NumberFormat(c === 'EUR' ? 'en-IE' : 'en-GB', {
      style: 'currency',
      currency: c,
      ...(exact ? { maximumFractionDigits: 2, minimumFractionDigits: 2 } : { maximumFractionDigits: 0 }),
    })
    formats.set(key, f)
  }
  return f
}

/** Called by the store whenever the plan's currency is known/changes. */
export function setPlanCurrency(c: Currency | undefined) {
  current = c === 'EUR' ? 'EUR' : 'GBP'
}
export const planCurrency = (): Currency => current
export const currencySymbol = (c: Currency = current) => (c === 'EUR' ? '€' : '£')

/** A couple-entered amount, in the plan's currency, whole units. */
export function money(n: number): string {
  return fmt(current, false).format(n || 0)
}
/** A couple-entered amount with pence/cents when there are any. */
export function moneyExact(n: number): string {
  // Whole amounts without decimals; part amounts always with two (€12.50, not €12.5).
  return Number.isInteger(n || 0) ? fmt(current, false).format(n || 0) : fmt(current, true).format(n)
}

/** Official sterling prices (registrar and GRO fees). Always £. */
export function gbp(n: number): string {
  return fmt('GBP', false).format(n || 0)
}

/** Parse what someone typed: "£1,200", "€ 950.50", "1200". Negative or junk → 0. */
export function parseMoney(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === '') return 0
  const n = Number(String(v).replace(/[£€,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

/** Field label with the plan's symbol, e.g. "Deposit (£)" → "Deposit (€)". */
export const withSymbol = (label: string) => label.replace(/\(£\)/g, `(${currencySymbol()})`)

export function convertAmount(n: number, rate: number, whole = false): number {
  if (!n) return n
  const v = n * rate
  return whole ? Math.round(v) : Math.round(v * 100) / 100
}
