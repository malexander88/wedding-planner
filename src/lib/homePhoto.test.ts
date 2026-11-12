import { describe, expect, it } from 'vitest'
import { dataUrlBytes, fitWithin } from './homePhoto'

describe('home photo sizing', () => {
  it('scales the long edge down to the limit, keeping the shape', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 })
  })
  it('never scales a small photo up', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
  it('measures a data URL payload', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,' + btoa('hello'))).toBe(5)
    expect(dataUrlBytes('data:image/jpeg;base64,' + btoa('hell'))).toBe(4)
  })
})
