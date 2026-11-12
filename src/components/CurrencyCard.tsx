import { useEffect, useState } from 'react'
import { countAmounts, fetchRate } from '../data/currency'
import { CURRENCIES, convertAmount, currencySymbol, moneyExact, parseMoney, type Currency } from '../lib/money'
import { useStore } from '../state/store'

/** Plan currency (shared by both phones), how switching treats stored amounts, and a quick converter. */
export function CurrencyCard() {
  const { state, dispatch } = useStore()
  const cur: Currency = state.profile.currency ?? 'GBP'
  const other: Currency = cur === 'GBP' ? 'EUR' : 'GBP'
  const [target, setTarget] = useState<Currency | null>(null)
  const [mode, setMode] = useState<'convert' | 'relabel'>('convert')
  const [rateEdit, setRateText] = useState<{ pair: string; text: string } | null>(null)
  const [fetched, setFetched] = useState<{ pair: string; r: { rate: number; date: string } | null } | null>(null)
  const pair = `${cur}>${other}`
  const amounts = countAmounts(state)

  // ECB reference rate for the converter and the switch (fetched per visit; never stored in the plan).
  useEffect(() => {
    let live = true
    fetchRate(cur, other).then((r) => live && setFetched({ pair: `${cur}>${other}`, r }))
    return () => {
      live = false
    }
  }, [cur, other])
  const rateInfo = fetched?.pair === pair ? fetched.r : 'loading'
  const rateText = rateEdit?.pair === pair ? rateEdit.text : rateInfo && rateInfo !== 'loading' ? String(Math.round(rateInfo.rate * 10000) / 10000) : ''

  const rate = parseMoney(rateText)
  const [probe, setProbe] = useState('')
  const confirm = () => {
    if (!target) return
    dispatch({ type: 'setCurrency', currency: target, rate: mode === 'convert' && amounts > 0 ? rate : null })
    setTarget(null)
  }
  const info = rateInfo && rateInfo !== 'loading' ? rateInfo : null

  return (
    <section className="card currency-card" aria-labelledby="currency-title">
      <h2 id="currency-title">Currency</h2>
      <p className="tiny">For both of you — every amount in the plan uses it.</p>
      <div className="seg seg-2" role="radiogroup" aria-label="Plan currency">
        {CURRENCIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={(target ?? cur) === c.id}
            className={`seg-btn${(target ?? cur) === c.id ? ' on' : ''}`}
            onClick={() => setTarget(c.id === cur ? null : c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {target && (
        <div className="currency-switch" role="group" aria-label={`Switch to ${currencySymbol(target)}`}>
          {amounts > 0 ? (
            <>
              <p>
                You have {amounts} {amounts === 1 ? 'amount' : 'amounts'} saved in {currencySymbol(cur)}. What should happen to {amounts === 1 ? 'it' : 'them'}?
              </p>
              <label className="radio-line">
                <input type="radio" name="cur-mode" checked={mode === 'convert'} onChange={() => setMode('convert')} />
                <span>
                  Convert everything to {currencySymbol(target)} at
                  <input
                    className="rate-input"
                    inputMode="decimal"
                    aria-label="Exchange rate"
                    value={rateText}
                    onChange={(e) => setRateText({ pair, text: e.target.value })}
                    onFocus={() => setMode('convert')}
                  />
                  {currencySymbol(target)} per {currencySymbol(cur)}
                  <small className="tiny">
                    {info ? ` ECB reference rate, ${info.date}. Change it to your bank’s rate if you like.` : rateInfo === 'loading' ? ' Getting today’s rate…' : ' Couldn’t get today’s rate — type one in.'}
                  </small>
                </span>
              </label>
              <label className="radio-line">
                <input type="radio" name="cur-mode" checked={mode === 'relabel'} onChange={() => setMode('relabel')} />
                <span>Keep the numbers and just change the symbol — they were already in {currencySymbol(target)}.</span>
              </label>
            </>
          ) : (
            <p>Nothing has a price yet, so this just changes the symbol.</p>
          )}
          <div className="btn-row">
            <button type="button" className="btn small" onClick={confirm} disabled={amounts > 0 && mode === 'convert' && !(rate > 0)}>
              Switch to {currencySymbol(target)}
            </button>
            <button type="button" className="btn ghost small" onClick={() => setTarget(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="converter">
        <label className="field">
          <span>Quote in {currencySymbol(other)}?</span>
          <input inputMode="decimal" placeholder={`${currencySymbol(other)}0`} value={probe} onChange={(e) => setProbe(e.target.value)} aria-label={`Amount in ${currencySymbol(other)}`} />
        </label>
        <div className="converted" aria-live="polite">
          {parseMoney(probe) > 0 && info ? (
            <>
              ≈ <strong>{moneyExact(convertAmount(parseMoney(probe), 1 / info.rate))}</strong>
            </>
          ) : (
            <span className="tiny">{info ? `1 ${currencySymbol(cur)} = ${info.rate} ${currencySymbol(other)}` : ''}</span>
          )}
        </div>
      </div>
      <p className="tiny currency-note">
        <strong>How mixing works:</strong> the plan keeps one currency so totals never mix £ and €. If a supplier quotes in{' '}
        {currencySymbol(other)}, convert it here and type the {currencySymbol(cur)} figure. Registrar and GRO fees are official sterling prices, so
        they always show in £.
      </p>
    </section>
  )
}
