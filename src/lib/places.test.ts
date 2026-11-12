import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/places', () => ({ PLACES_ENABLED: true, PLACES_FUNCTION_URL: 'https://example.test/functions/v1/places' }))

import { clearPlacesCache, fetchPlaceDetails, findPlaceId, problemFor, problemText, searchPlaces } from './places'

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

describe('places client', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    clearPlacesCache()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('searches and returns results, sending only the publishable key', async () => {
    fetchMock.mockReturnValueOnce(json(200, { results: [{ id: 'a', name: 'Barn' }] }))
    const r = await searchPlaces('  wedding venue near Antrim ')
    expect(r).toEqual({ ok: true, data: [{ id: 'a', name: 'Barn' }] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.test/functions/v1/places')
    expect(JSON.parse(init.body)).toEqual({ op: 'search', query: 'wedding venue near Antrim' })
    expect(init.headers.apikey).toMatch(/^sb_publishable_/)
  })

  it('caches successes for the session (one call for two looks)', async () => {
    fetchMock.mockReturnValue(json(200, { results: [] }))
    await searchPlaces('florist near Lisburn')
    await searchPlaces('florist near Lisburn')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports the daily cap as "limit" and does not cache it', async () => {
    fetchMock.mockReturnValueOnce(json(429, { error: 'daily limit' })).mockReturnValueOnce(json(200, { results: [] }))
    expect(await searchPlaces('dj near Bangor')).toEqual({ ok: false, problem: 'limit' })
    expect(await searchPlaces('dj near Bangor')).toEqual({ ok: true, data: [] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('treats network failures and 5xx as "down"', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockReturnValueOnce(json(503, { error: 'not configured' }))
    expect(await searchPlaces('cake near Derry')).toEqual({ ok: false, problem: 'down' })
    expect(await fetchPlaceDetails('x')).toEqual({ ok: false, problem: 'down' })
  })

  it('treats an older function without search as "unsupported"', async () => {
    fetchMock.mockReturnValueOnce(json(400, { error: 'op' }))
    expect(await searchPlaces('band near Newry')).toEqual({ ok: false, problem: 'unsupported' })
    expect(problemFor(400, { error: 'query' })).toBe('down')
  })

  it('findPlaceId returns null on failure', async () => {
    fetchMock.mockReturnValueOnce(json(429, { error: 'daily limit' }))
    expect(await findPlaceId('Galgorm', 'Ballymena')).toBeNull()
    fetchMock.mockReturnValueOnce(json(200, { id: 'ChIJ' }))
    expect(await findPlaceId('Galgorm', 'Ballymena')).toBe('ChIJ')
  })

  it('every problem has plain-English text that keeps the other routes in view', () => {
    expect(problemText('limit')).toMatch(/today’s limit.*tomorrow/)
    expect(problemText('down')).toMatch(/web search/)
    expect(problemText('unsupported')).toMatch(/approved list/)
  })
})
