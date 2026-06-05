import { describe, it, expect } from 'vitest'
import {
  formatOfferUsableHoursLabel,
  formatOfferUsableHoursStatus,
  hasOfferUsableHours,
  isOfferUsableNow,
} from './offers'

describe('offer usable hours', () => {
  const offer = {
    usable_from_time: '12:00:00',
    usable_to_time: '15:00:00',
  }

  it('detects configured window', () => {
    expect(hasOfferUsableHours(offer)).toBe(true)
    expect(hasOfferUsableHours({})).toBe(false)
  })

  it('formats label', () => {
    expect(formatOfferUsableHoursLabel('12:00', '15:00')).toBe('Доступно с 12:00 до 15:00')
  })

  it('allows usage inside window in Asia/Almaty', () => {
    const inside = new Date('2026-06-05T07:30:00.000Z') // 12:30 in Almaty (UTC+5)
    expect(isOfferUsableNow(offer, inside, 'Asia/Almaty')).toBe(true)
  })

  it('blocks usage outside window in Asia/Almaty', () => {
    const before = new Date('2026-06-05T06:30:00.000Z') // 11:30
    const after = new Date('2026-06-05T10:30:00.000Z') // 15:30
    expect(isOfferUsableNow(offer, before, 'Asia/Almaty')).toBe(false)
    expect(isOfferUsableNow(offer, after, 'Asia/Almaty')).toBe(false)
  })

  it('returns status with label', () => {
    const inside = new Date('2026-06-05T07:30:00.000Z')
    expect(formatOfferUsableHoursStatus(offer, inside, 'Asia/Almaty')).toEqual({
      isUsable: true,
      label: 'Доступно с 12:00 до 15:00',
    })
  })
})
