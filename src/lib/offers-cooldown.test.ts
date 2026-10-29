import { describe, expect, it } from 'vitest'
import { formatOfferAvailableAgain, getOfferAvailableAgainAt } from './offers'

describe('offer cooldown', () => {
  it('defaults to 7 days after the last redemption', () => {
    const at = getOfferAvailableAgainAt('2026-10-29T10:00:00.000Z', null)
    expect(at.toISOString()).toBe('2026-11-05T10:00:00.000Z')
  })

  it('respects custom cooldown days', () => {
    const at = getOfferAvailableAgainAt('2026-10-29T10:00:00.000Z', 1)
    expect(at.toISOString()).toBe('2026-10-30T10:00:00.000Z')
  })

  it('formats the date in Almaty time', () => {
    expect(formatOfferAvailableAgain('2026-11-05T10:00:00.000Z', 'Asia/Almaty')).toBe(
      'Снова можно с 5 ноября, 15:00',
    )
  })
})
